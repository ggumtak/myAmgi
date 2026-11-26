#!/usr/bin/env python3
"""Package the built web UI (web/dist) as the OTA UI bundle for the myAmgi app.

Usage:
    python3 tools/make_ui_bundle.py \
        --dist web/dist \
        --out-dir dist \
        --version 1.0.123 \
        --repo ggumtak/myAmgi \
        [--tag update-files] [--min-apk-build 12]

Writes to --out-dir:
    myAmgi-ui-<version>.zip   the bundle (index.html, ui-version.json, assets...) with stable entry order
                              and timestamps, so an unchanged bundle has an unchanged SHA-256
    ui-manifest.json          {"version", "url", "sha256", "size", "minApkBuild"}

Both are published on the `update-files` release. The app downloads the manifest, refuses a bundle whose
minApkBuild is above its own build, verifies size and SHA-256, unpacks it safely and checks that
ui-version.json inside says the same version.

--min-apk-build: the oldest APK build the bundle may run on. Raise it (tools/ui_min_apk_build.txt) when the
web UI starts to need something only a newer APK shell provides.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
import zipfile

DEFAULT_TAG = "update-files"
MANIFEST_NAME = "ui-manifest.json"
VERSION_FILE = "ui-version.json"
VERSION_RE = re.compile(r"^\d{1,9}(\.\d{1,9}){1,3}$")
MAX_ZIP_BYTES = 60 * 1024 * 1024  # the app refuses larger bundles (UiOtaManifest.MAX_ZIP_BYTES)
FIXED_TIME = (1980, 1, 1, 0, 0, 0)


class BundleError(Exception):
    pass


def zip_name(version: str) -> str:
    return f"myAmgi-ui-{version}.zip"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def bundle_files(dist: Path) -> list[tuple[str, Path]]:
    """(archive name, file) pairs, sorted; rejects symlinks and names the app would refuse."""
    out: list[tuple[str, Path]] = []
    for p in sorted(dist.rglob("*")):
        if p.is_symlink():
            raise BundleError(f"symbolic link in the bundle: {p}")
        if not p.is_file():
            continue
        rel = p.relative_to(dist).as_posix()
        if "\\" in rel or any(part in ("", ".", "..") for part in rel.split("/")):
            raise BundleError(f"unsafe file name: {rel}")
        out.append((rel, p))
    return out


def make_bundle(
    dist: Path,
    out_dir: Path,
    version: str,
    repo: str,
    tag: str = DEFAULT_TAG,
    min_apk_build: int = 0,
) -> dict:
    if not VERSION_RE.match(version):
        raise BundleError(f"bad version: {version!r} (expected dotted numbers like 1.0.123)")
    if min_apk_build < 0:
        raise BundleError("min-apk-build must be >= 0")
    if not (dist / "index.html").is_file():
        raise BundleError(f"{dist}/index.html is missing: build the web UI first")

    version_file = dist / VERSION_FILE
    version_bytes: bytes | None = None
    if version_file.is_file():
        try:
            declared = str(json.loads(version_file.read_text(encoding="utf-8")).get("version", "")).strip()
        except (ValueError, AttributeError) as e:
            raise BundleError(f"{version_file} is not valid JSON: {e}") from e
        if declared != version:
            raise BundleError(f"{version_file} says {declared!r} but --version is {version!r}")
    else:
        # The web build normally writes it (from AMGI_UI_VERSION); add it to the bundle if it did not.
        version_bytes = (json.dumps({"version": version}) + "\n").encode("utf-8")

    out_dir.mkdir(parents=True, exist_ok=True)
    zip_path = out_dir / zip_name(version)
    files = bundle_files(dist)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        entries = [(name, path.read_bytes()) for name, path in files]
        if version_bytes is not None:
            entries.append((VERSION_FILE, version_bytes))
        for name, data in sorted(entries):
            info = zipfile.ZipInfo(name, date_time=FIXED_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            zf.writestr(info, data)

    size = zip_path.stat().st_size
    if size > MAX_ZIP_BYTES:
        raise BundleError(f"bundle is {size} bytes; the app accepts at most {MAX_ZIP_BYTES}")
    manifest = {
        "version": version,
        "url": f"https://github.com/{repo}/releases/download/{tag}/{zip_path.name}",
        "sha256": sha256_file(zip_path),
        "size": size,
        "minApkBuild": min_apk_build,
    }
    (out_dir / MANIFEST_NAME).write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--dist", required=True, type=Path, help="built web UI directory (web/dist)")
    p.add_argument("--out-dir", required=True, type=Path)
    p.add_argument("--version", required=True, help="UI version, e.g. 1.0.123")
    p.add_argument("--repo", required=True, help="owner/name of the GitHub repository")
    p.add_argument("--tag", default=DEFAULT_TAG, help="release tag the files are published on")
    p.add_argument("--min-apk-build", type=int, default=0)
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    try:
        m = make_bundle(args.dist, args.out_dir, args.version, args.repo, args.tag, args.min_apk_build)
    except BundleError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    print(f"{zip_name(m['version'])}: {m['size']} bytes, sha256 {m['sha256']}, minApkBuild {m['minApkBuild']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
