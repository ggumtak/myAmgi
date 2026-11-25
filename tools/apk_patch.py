#!/usr/bin/env python3
"""Binary delta patcher for myAmgi Android APKs.

Usage:
    python3 tools/apk_patch.py make OLD.apk NEW.apk OUT.patch
    python3 tools/apk_patch.py apply OLD.apk PATCH OUT.apk
    python3 tools/apk_patch.py sha256 FILE

An APK is a ZIP archive. Unchanged ZIP entries are copied directly from OLD.apk,
changed stored (uncompressed) entries are diffed line-by-line, and compressed or
new bytes (headers, DEX/native changes, APK signature) are stored as literals.

Binary format:
    - 8-byte magic: b"AMGPAT01"
    - zlib-compressed stream containing:
        - old_size (uint64 big-endian)
        - old_sha256 (32 bytes)
        - new_size (uint64 big-endian)
        - new_sha256 (32 bytes)
        - sequence of operations:
            - b"C" + offset (uint64 BE) + length (uint64 BE)  [copy from OLD]
            - b"D" + length (uint64 BE) + raw bytes           [literal data]
            - b"E"                                            [end of stream]
"""

from __future__ import annotations

import hashlib
import os
import struct
import sys
import zipfile
import zlib

MAGIC = b"AMGPAT01"
# Skip writing a patch if it is >= 65% of the new APK size.
WORTH = 0.65


def sha256_bytes(data: bytes) -> bytes:
    return hashlib.sha256(data).digest()


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def entries(path: str, data: bytes) -> dict[str, tuple[int, int, int, int]]:
    """Return name -> (data_offset, compressed_size, compress_type, crc32)."""
    out: dict[str, tuple[int, int, int, int]] = {}
    with zipfile.ZipFile(path, "r") as z:
        for info in z.infolist():
            h = info.header_offset
            if data[h : h + 4] != b"PK\x03\x04":
                raise ValueError(f"bad local header: {info.filename}")
            name_len, extra_len = struct.unpack("<HH", data[h + 26 : h + 30])
            start = h + 30 + name_len + extra_len
            out[info.filename] = (start, info.compress_size, info.compress_type, info.CRC)
    return out


class Ops:
    def __init__(self) -> None:
        self.ops: list[list] = []

    def copy(self, off: int, length: int) -> None:
        if length <= 0:
            return
        if self.ops and self.ops[-1][0] == "C" and self.ops[-1][1] + self.ops[-1][2] == off:
            self.ops[-1][2] += length
        else:
            self.ops.append(["C", off, length])

    def data(self, b: bytes) -> None:
        if not b:
            return
        if self.ops and self.ops[-1][0] == "D":
            self.ops[-1][1].extend(b)
        else:
            self.ops.append(["D", bytearray(b)])


def lines(b: bytes) -> list[tuple[int, bytes]]:
    out: list[tuple[int, bytes]] = []
    start = 0
    while start < len(b):
        end = b.find(b"\n", start)
        end = len(b) if end < 0 else end + 1
        out.append((start, b[start:end]))
        start = end
    return out


def diff_lines(ops: Ops, old: bytes, old_start: int, old_len: int, new: bytes) -> None:
    """For a stored entry, copy matching lines from the old entry."""
    where: dict[bytes, int] = {}
    for off, line in lines(old[old_start : old_start + old_len]):
        where.setdefault(line, off)
    expect: int | None = None
    for _, line in lines(new):
        off: int | None = None
        if expect is not None and old[old_start + expect : old_start + expect + len(line)] == line:
            off = expect
        elif line in where:
            off = where[line]
        if off is None:
            ops.data(line)
            expect = None
        else:
            ops.copy(old_start + off, len(line))
            expect = off + len(line)


def make_ops(old_path: str, new_path: str) -> tuple[bytes, bytes, list[list]]:
    with open(old_path, "rb") as f:
        old = f.read()
    with open(new_path, "rb") as f:
        new = f.read()

    eo = entries(old_path, old)
    en = entries(new_path, new)
    ops = Ops()
    pos = 0

    for name, (start, length, kind, crc) in sorted(en.items(), key=lambda e: e[1][0]):
        if start < pos:
            raise ValueError(f"overlapping ZIP entry: {name}")
        ops.data(new[pos:start])
        piece = new[start : start + length]
        o = eo.get(name)
        if o and o[1] == length and o[2] == kind and o[3] == crc and old[o[0] : o[0] + length] == piece:
            ops.copy(o[0], length)
        elif o and kind == 0 and o[2] == 0:
            diff_lines(ops, old, o[0], o[1], piece)
        else:
            ops.data(piece)
        pos = start + length

    ops.data(new[pos:])
    return old, new, ops.ops


def encode(old: bytes, new: bytes, ops: list[list]) -> bytes:
    body = bytearray()
    body += struct.pack(">Q", len(old)) + sha256_bytes(old)
    body += struct.pack(">Q", len(new)) + sha256_bytes(new)
    for op in ops:
        if op[0] == "C":
            body += b"C" + struct.pack(">QQ", op[1], op[2])
        elif op[0] == "D":
            body += b"D" + struct.pack(">Q", len(op[1])) + op[1]
        else:
            raise ValueError(f"unknown op: {op[0]}")
    body += b"E"
    return MAGIC + zlib.compress(bytes(body), 9)


def apply(old: bytes, patch: bytes) -> bytes:
    if len(patch) < 8 or patch[:8] != MAGIC:
        raise ValueError("not an AMGPAT01 patch")
    body = zlib.decompress(patch[8:])
    if len(body) < 80:
        raise ValueError("truncated patch header")

    (old_size,) = struct.unpack(">Q", body[0:8])
    if old_size != len(old) or body[8:40] != sha256_bytes(old):
        raise ValueError("patch does not match old APK")

    (new_size,) = struct.unpack(">Q", body[40:48])
    want_sha256 = body[48:80]

    out = bytearray()
    i = 80
    while i < len(body):
        op = body[i : i + 1]
        i += 1
        if op == b"C":
            if i + 16 > len(body):
                raise ValueError("truncated copy operation")
            off, length = struct.unpack(">QQ", body[i : i + 16])
            i += 16
            if off + length > len(old):
                raise ValueError("copy out of range")
            out += old[off : off + length]
        elif op == b"D":
            if i + 8 > len(body):
                raise ValueError("truncated data operation")
            (length,) = struct.unpack(">Q", body[i : i + 8])
            i += 8
            if i + length > len(body):
                raise ValueError("data payload out of range")
            out += body[i : i + length]
            i += length
        elif op == b"E":
            break
        else:
            raise ValueError(f"bad operation: {op!r}")
    else:
        raise ValueError("missing end marker")

    result = bytes(out)
    if len(result) != new_size or sha256_bytes(result) != want_sha256:
        raise ValueError("rebuilt APK does not match expected SHA-256")
    return result


def make_patch_file(old_path: str, new_path: str, out_path: str, max_ratio: float = WORTH) -> bool:
    old, new, ops = make_ops(old_path, new_path)
    patch = encode(old, new, ops)
    rebuilt = apply(old, patch)
    if rebuilt != new:
        raise RuntimeError("self-verification failed: rebuilt APK differs from new APK")

    share = len(patch) / len(new) if len(new) > 0 else 1.0
    print(f"{out_path}: {len(patch):,} bytes ({share:.1%} of {len(new):,})")
    if share < max_ratio:
        out_dir = os.path.dirname(os.path.abspath(out_path))
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
        with open(out_path, "wb") as f:
            f.write(patch)
        return True
    print(f"not worth it (>= {max_ratio:.0%} of new APK): no patch written")
    return False


def apply_patch_file(old_path: str, patch_path: str, out_path: str) -> None:
    with open(old_path, "rb") as f:
        old = f.read()
    with open(patch_path, "rb") as f:
        patch = f.read()
    rebuilt = apply(old, patch)
    out_dir = os.path.dirname(os.path.abspath(out_path))
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    with open(out_path, "wb") as f:
        f.write(rebuilt)


def main(argv: list[str]) -> int:
    if len(argv) == 5 and argv[1] == "make":
        make_patch_file(argv[2], argv[3], argv[4])
        return 0
    if len(argv) == 5 and argv[1] == "apply":
        apply_patch_file(argv[2], argv[3], argv[4])
        return 0
    if len(argv) == 3 and argv[1] == "sha256":
        print(sha256_file(argv[2]))
        return 0
    sys.stderr.write(__doc__ or "")
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
