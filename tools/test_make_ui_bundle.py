#!/usr/bin/env python3
"""Unit tests for make_ui_bundle.py."""

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

import make_ui_bundle as mub


def make_dist(root: Path, version: str | None = "1.0.42") -> Path:
    dist = root / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><div id=root></div>", encoding="utf-8")
    (dist / "card-frame.html").write_text("<html></html>", encoding="utf-8")
    (dist / "assets" / "index-abc.js").write_text("console.log(1)", encoding="utf-8")
    if version is not None:
        (dist / "ui-version.json").write_text(json.dumps({"version": version}), encoding="utf-8")
    return dist


class TestMakeUiBundle(unittest.TestCase):
    def test_bundle_and_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            dist = make_dist(root)
            out = root / "out"
            m = mub.make_bundle(dist, out, "1.0.42", "o/r", min_apk_build=12)
            zip_path = out / "myAmgi-ui-1.0.42.zip"
            self.assertEqual(m["url"], "https://github.com/o/r/releases/download/update-files/myAmgi-ui-1.0.42.zip")
            self.assertEqual(m["size"], zip_path.stat().st_size)
            self.assertEqual(m["sha256"], hashlib.sha256(zip_path.read_bytes()).hexdigest())
            self.assertEqual(m["minApkBuild"], 12)
            self.assertEqual(json.loads((out / "ui-manifest.json").read_text()), m)
            with zipfile.ZipFile(zip_path) as zf:
                names = zf.namelist()
                self.assertEqual(names, sorted(names))
                self.assertIn("index.html", names)
                self.assertIn("assets/index-abc.js", names)
                self.assertEqual(json.loads(zf.read("ui-version.json"))["version"], "1.0.42")
                self.assertTrue(all(not n.endswith("/") for n in names))

    def test_deterministic(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            dist = make_dist(root)
            a = mub.make_bundle(dist, root / "a", "1.0.42", "o/r")
            os.utime(dist / "index.html", (1, 1))
            b = mub.make_bundle(dist, root / "b", "1.0.42", "o/r")
            self.assertEqual(a["sha256"], b["sha256"])

    def test_adds_missing_version_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            dist = make_dist(root, version=None)
            mub.make_bundle(dist, root / "out", "1.0.7", "o/r")
            with zipfile.ZipFile(root / "out" / "myAmgi-ui-1.0.7.zip") as zf:
                self.assertEqual(json.loads(zf.read("ui-version.json")), {"version": "1.0.7"})
            self.assertFalse((dist / "ui-version.json").exists())

    def test_rejects_bad_input(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            dist = make_dist(root)
            with self.assertRaises(mub.BundleError):
                mub.make_bundle(dist, root / "o", "1.0.43", "o/r")  # ui-version.json disagrees
            for bad in ("1", "abc", "1.0.x", "1.0.0.0.0"):
                with self.assertRaises(mub.BundleError):
                    mub.make_bundle(dist, root / "o", bad, "o/r")
            with self.assertRaises(mub.BundleError):
                mub.make_bundle(dist, root / "o", "1.0.42", "o/r", min_apk_build=-1)
            (dist / "index.html").unlink()
            with self.assertRaises(mub.BundleError):
                mub.make_bundle(dist, root / "o", "1.0.42", "o/r")

    def test_rejects_symlinks(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            dist = make_dist(root)
            (dist / "link.js").symlink_to(dist / "index.html")
            with self.assertRaises(mub.BundleError):
                mub.make_bundle(dist, root / "o", "1.0.42", "o/r")

    def test_cli(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            dist = make_dist(root)
            rc = mub.main(["--dist", str(dist), "--out-dir", str(root / "o"), "--version", "1.0.42",
                           "--repo", "o/r", "--min-apk-build", "12"])
            self.assertEqual(rc, 0)
            self.assertEqual(mub.main(["--dist", str(dist), "--out-dir", str(root / "o"), "--version", "2",
                                       "--repo", "o/r"]), 1)

    def test_min_apk_build_file_is_a_number(self) -> None:
        value = (TOOLS_DIR / "ui_min_apk_build.txt").read_text().strip()
        self.assertTrue(value.isdigit(), value)


if __name__ == "__main__":
    unittest.main()
