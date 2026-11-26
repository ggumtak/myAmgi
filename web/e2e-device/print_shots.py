#!/usr/bin/env python3
"""Prints small JPEG copies of chosen screenshots as base64 between -----BEGIN SHOT name----- markers,
so they can be looked at from the job log without downloading the artifact.

    python3 print_shots.py <shots dir> <name substring>...   (needs Pillow)
"""
import base64
import io
import pathlib
import sys

from PIL import Image

shots = sorted(pathlib.Path(sys.argv[1]).glob("*.png"))
wanted = sys.argv[2:]
for want in wanted:
    for f in [s for s in shots if want in s.name][:2]:
        img = Image.open(f).convert("RGB")
        w = 360
        img = img.resize((w, max(1, round(img.height * w / img.width))), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=60, optimize=True)
        print(f"-----BEGIN SHOT {f.stem}-----")
        data = base64.b64encode(buf.getvalue()).decode()
        for i in range(0, len(data), 120):
            print(data[i:i + 120])
        print(f"-----END SHOT {f.stem}-----")
