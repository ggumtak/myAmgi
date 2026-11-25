#!/usr/bin/env python3
"""Generate OTA hot-patch manifest and flattened release assets for myAmgi.

Usage:
    python3 tools/make_ota_manifest.py \
        --assets-dir app/src/main/assets \
        --out-dir dist/ota \
        --version 1 \
        --repo ggumtak/myAmgi
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys

TRACKED_ASSETS: tuple[str, ...] = (
    "card/card-base.css",
    "card/card-bridge.js",
    "hanja/anki-tap.js",
    "editor/large-editor.html",
)


def flatten_asset_name(rel_path: str) -> str:
    return "ota__" + rel_path.replace("/", "__")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(65536)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def generate_ota_manifest(
    assets_dir: str | Path,
    out_dir: str | Path,
    version: int,
    repo: str = "ggumtak/myAmgi",
    tag: str = "latest",
    tracked_assets: tuple[str, ...] = TRACKED_ASSETS,
) -> dict:
    assets_root = Path(assets_dir)
    out_root = Path(out_dir)
    out_root.mkdir(parents=True, exist_ok=True)

    files_entries: list[dict] = []
    for rel_path in tracked_assets:
        src = assets_root / rel_path
        if not src.is_file():
            continue

        asset_name = flatten_asset_name(rel_path)
        dst = out_root / asset_name
        shutil.copy2(src, dst)

        size = src.stat().st_size
        digest = sha256_file(src)
        url = f"https://github.com/{repo}/releases/download/{tag}/{asset_name}"
        files_entries.append(
            {
                "path": rel_path,
                "assetName": asset_name,
                "sha256": digest,
                "size": size,
                "url": url,
            }
        )

    manifest = {
        "version": version,
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "files": files_entries,
    }

    manifest_path = out_root / "ota-manifest.json"
    with manifest_path.open("w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write("\n")

    return manifest


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate myAmgi OTA manifest and flattened assets.")
    parser.add_argument("--assets-dir", required=True, help="Path to Android assets directory (e.g. app/src/main/assets)")
    parser.add_argument("--out-dir", required=True, help="Output directory for ota-manifest.json and ota__* files")
    parser.add_argument("--version", type=int, default=1, help="Build/version number (integer)")
    parser.add_argument("--repo", default="ggumtak/myAmgi", help="GitHub owner/repo for download URLs")
    parser.add_argument("--tag", default="latest", help="GitHub release tag for download URLs")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    manifest = generate_ota_manifest(
        assets_dir=args.assets_dir,
        out_dir=args.out_dir,
        version=args.version,
        repo=args.repo,
        tag=args.tag,
    )
    print(f"Generated ota-manifest.json (version={manifest['version']}, files={len(manifest['files'])}) in {args.out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
