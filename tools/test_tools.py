#!/usr/bin/env python3
"""Unit tests for myAmgi update tools (apk_patch.py and make_ota_manifest.py)."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile

TOOLS_DIR = Path(__file__).resolve().parent
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import apk_patch
import make_ota_manifest


def build_sample_apk(
    path: Path,
    *,
    dex_seed: bytes,
    lib_seed: bytes,
    asset_lines: list[str],
    extra_entries: dict[str, tuple[bytes, int]] | None = None,
) -> None:
    """Create a realistic ZIP/APK fixture with stored assets and deflated native/dex entries."""
    with zipfile.ZipFile(path, "w") as zf:
        # Large unchanged compressed native library (arm64-v8a)
        zf.writestr(
            "lib/arm64-v8a/libnative.so",
            lib_seed * 4000,
            compress_type=zipfile.ZIP_DEFLATED,
        )
        # Unchanged large stored dictionary/asset
        zf.writestr(
            "assets/hanja/dict.txt",
            ("".join(f"entry_{i:04d}\tmeaning_{i}\n" for i in range(400))).encode("utf-8"),
            compress_type=zipfile.ZIP_STORED,
        )
        # Stored asset that changes slightly line-by-line
        zf.writestr(
            "assets/card/card-base.css",
            ("".join(asset_lines)).encode("utf-8"),
            compress_type=zipfile.ZIP_STORED,
        )
        # Compressed classes.dex that changes between builds
        zf.writestr(
            "classes.dex",
            dex_seed * 500,
            compress_type=zipfile.ZIP_DEFLATED,
        )
        if extra_entries:
            for name, (content, ctype) in extra_entries.items():
                zf.writestr(name, content, compress_type=ctype)


class TestApkPatch(unittest.TestCase):
    def test_magic_is_8_bytes(self) -> None:
        self.assertEqual(apk_patch.MAGIC, b"AMGPAT01")
        self.assertEqual(len(apk_patch.MAGIC), 8)

    def test_make_and_apply_byte_exact_rebuild(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            old_apk = tmp_path / "old.apk"
            new_apk = tmp_path / "new.apk"
            patch_file = tmp_path / "update.patch"
            rebuilt_apk = tmp_path / "rebuilt.apk"

            base_lines = [f".c{i} {{ color: #{i % 9}{i % 9}{i % 9}; }}\n" for i in range(250)]
            updated_lines = list(base_lines)
            updated_lines[100] = ".c100 { color: #ff0000; }\n"
            updated_lines.append(".c250 { font-weight: bold; }\n")

            build_sample_apk(
                old_apk,
                dex_seed=b"DEX_V1_DATA_",
                lib_seed=b"ARM64_SO_PAYLOAD_ABCDEF0123456789",
                asset_lines=base_lines,
            )
            build_sample_apk(
                new_apk,
                dex_seed=b"DEX_V2_DATA_",
                lib_seed=b"ARM64_SO_PAYLOAD_ABCDEF0123456789",
                asset_lines=updated_lines,
            )

            written = apk_patch.make_patch_file(str(old_apk), str(new_apk), str(patch_file))
            self.assertTrue(written, "Patch should be written when significantly smaller than new APK")
            self.assertTrue(patch_file.is_file())
            self.assertLess(patch_file.stat().st_size, new_apk.stat().st_size * 0.65)

            patch_bytes = patch_file.read_bytes()
            self.assertTrue(patch_bytes.startswith(b"AMGPAT01"))

            apk_patch.apply_patch_file(str(old_apk), str(patch_file), str(rebuilt_apk))
            self.assertEqual(rebuilt_apk.read_bytes(), new_apk.read_bytes())
            self.assertEqual(apk_patch.sha256_file(str(rebuilt_apk)), apk_patch.sha256_file(str(new_apk)))

    def test_skips_patch_when_above_threshold(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            old_apk = tmp_path / "old.apk"
            new_apk = tmp_path / "new.apk"
            patch_file = tmp_path / "too_big.patch"

            with zipfile.ZipFile(old_apk, "w") as zf:
                zf.writestr("a.bin", os.urandom(4096), compress_type=zipfile.ZIP_STORED)
            with zipfile.ZipFile(new_apk, "w") as zf:
                zf.writestr("b.bin", os.urandom(4096), compress_type=zipfile.ZIP_STORED)

            written = apk_patch.make_patch_file(str(old_apk), str(new_apk), str(patch_file))
            self.assertFalse(written)
            self.assertFalse(patch_file.exists())

    def test_rejects_wrong_old_apk(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            old_apk = tmp_path / "old.apk"
            wrong_apk = tmp_path / "wrong.apk"
            new_apk = tmp_path / "new.apk"
            patch_file = tmp_path / "update.patch"
            out_apk = tmp_path / "out.apk"

            lines = [f"line {i}\n" for i in range(100)]
            build_sample_apk(old_apk, dex_seed=b"V1", lib_seed=b"SHARED_LIB_BYTES_", asset_lines=lines)
            build_sample_apk(wrong_apk, dex_seed=b"WRONG", lib_seed=b"SHARED_LIB_BYTES_", asset_lines=lines)
            build_sample_apk(new_apk, dex_seed=b"V2", lib_seed=b"SHARED_LIB_BYTES_", asset_lines=lines + ["new\n"])

            written = apk_patch.make_patch_file(str(old_apk), str(new_apk), str(patch_file))
            self.assertTrue(written)

            with self.assertRaises(ValueError):
                apk_patch.apply_patch_file(str(wrong_apk), str(patch_file), str(out_apk))
            self.assertFalse(out_apk.exists())

    def test_cli_sha256_and_apply(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            old_apk = tmp_path / "old.apk"
            new_apk = tmp_path / "new.apk"
            patch_file = tmp_path / "p.patch"
            rebuilt = tmp_path / "rebuilt.apk"

            lines = [f"line {i}\n" for i in range(100)]
            build_sample_apk(old_apk, dex_seed=b"D1", lib_seed=b"LIB_CHUNK_", asset_lines=lines)
            build_sample_apk(new_apk, dex_seed=b"D2", lib_seed=b"LIB_CHUNK_", asset_lines=lines + ["extra\n"])

            self.assertEqual(apk_patch.main(["apk_patch.py", "make", str(old_apk), str(new_apk), str(patch_file)]), 0)
            self.assertEqual(apk_patch.main(["apk_patch.py", "apply", str(old_apk), str(patch_file), str(rebuilt)]), 0)
            self.assertEqual(rebuilt.read_bytes(), new_apk.read_bytes())
            self.assertEqual(
                apk_patch.sha256_file(str(rebuilt)),
                hashlib.sha256(new_apk.read_bytes()).hexdigest(),
            )
            self.assertEqual(apk_patch.main(["apk_patch.py", "sha256", str(rebuilt)]), 0)


class TestMakeOtaManifest(unittest.TestCase):
    def test_manifest_generation_and_flattened_files(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            assets_dir = tmp_path / "assets"
            out_dir = tmp_path / "dist" / "ota"

            tracked = {
                "card/card-base.css": b"body { background: #fff; }\n",
                "card/card-bridge.js": b"window.myAmgi = { version: 1 };\n",
                "hanja/anki-tap.js": b"console.log('hanja tap');\n",
                "editor/large-editor.html": b"<!doctype html><html><body>Editor</body></html>\n",
            }
            for rel, content in tracked.items():
                p = assets_dir / rel
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_bytes(content)

            # Untracked file should not appear in manifest or out_dir
            untracked = assets_dir / "other/ignore.txt"
            untracked.parent.mkdir(parents=True, exist_ok=True)
            untracked.write_bytes(b"ignore me")

            rc = make_ota_manifest.main(
                [
                    "--assets-dir",
                    str(assets_dir),
                    "--out-dir",
                    str(out_dir),
                    "--version",
                    "42",
                    "--repo",
                    "ggumtak/myAmgi",
                ]
            )
            self.assertEqual(rc, 0)

            manifest_path = out_dir / "ota-manifest.json"
            self.assertTrue(manifest_path.is_file())
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

            self.assertEqual(manifest["version"], 42)
            self.assertIn("generatedAt", manifest)
            self.assertRegex(manifest["generatedAt"], r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")

            files = manifest["files"]
            self.assertEqual(len(files), 4)
            by_path = {entry["path"]: entry for entry in files}

            for rel, content in tracked.items():
                expected_asset = "ota__" + rel.replace("/", "__")
                expected_sha = hashlib.sha256(content).hexdigest()
                entry = by_path[rel]
                self.assertEqual(entry["assetName"], expected_asset)
                self.assertEqual(entry["sha256"], expected_sha)
                self.assertEqual(entry["size"], len(content))
                self.assertEqual(
                    entry["url"],
                    f"https://github.com/ggumtak/myAmgi/releases/download/latest/{expected_asset}",
                )
                copied = out_dir / expected_asset
                self.assertTrue(copied.is_file())
                self.assertEqual(copied.read_bytes(), content)

            self.assertFalse((out_dir / "ota__other__ignore.txt").exists())

    def test_handles_partial_missing_assets(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            assets_dir = tmp_path / "assets"
            out_dir = tmp_path / "ota"
            css = assets_dir / "card/card-base.css"
            css.parent.mkdir(parents=True, exist_ok=True)
            css.write_bytes(b".card { color: black; }\n")

            manifest = make_ota_manifest.generate_ota_manifest(
                assets_dir=assets_dir,
                out_dir=out_dir,
                version=7,
            )
            self.assertEqual(manifest["version"], 7)
            self.assertEqual(len(manifest["files"]), 1)
            self.assertEqual(manifest["files"][0]["assetName"], "ota__card__card-base.css")


if __name__ == "__main__":
    unittest.main()
