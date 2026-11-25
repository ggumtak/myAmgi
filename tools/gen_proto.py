#!/usr/bin/env python3
"""Generate the web UI's protobuf layer from the official Anki Python wheel.

The Anki backend used by myAmgi is pinned to one Anki release. Its protobuf
definitions ship inside the PyPI wheel ``anki==<ANKI_VERSION>`` as compiled
``anki/*_pb2.py`` modules. This script:

1. installs that wheel (and a matching ``protobuf`` runtime) into a temporary
   directory with pip (``--wheel PATH`` uses an already downloaded wheel);
2. loads every ``anki/*_pb2.py`` in a child interpreter and converts the
   descriptors into a protobufjs JSON root (messages, enums, maps, oneofs,
   proto3 ``optional``);
3. runs ``pbjs``/``pbts`` from ``web/node_modules`` to emit a static ES module
   (protobufjs/minimal runtime, no reflection) and its ``.d.ts``;
4. writes ``methods.ts``: every backend service method (``XxxService`` and
   ``BackendXxxService``, de-duplicated) with its ``/_anki/<lowerCamelName>``
   path and request/response classes.

Outputs go to ``web/src/anki/generated/``. Re-run whenever the backend version
changes: bump ANKI_VERSION, run ``python3 tools/gen_proto.py``, commit.

Usage:
    python3 tools/gen_proto.py [--wheel anki-....whl] [--out DIR] [--json-only]
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

# The one place the Anki version is pinned. Must match the backend artifact
# (io.github.david-allison:anki-backend-*:<x>-anki26.09.4).
ANKI_VERSION = "26.9.4"
# protobuf runtime used only to load the descriptors (range from the wheel's METADATA).
PROTOBUF_REQUIREMENT = "protobuf>=6.0,<8.0"

REPO = Path(__file__).resolve().parent.parent
WEB = REPO / "web"
DEFAULT_OUT = WEB / "src" / "anki" / "generated"

SCALARS = {
    1: "double", 2: "float", 3: "int64", 4: "uint64", 5: "int32", 6: "fixed64",
    7: "fixed32", 8: "bool", 9: "string", 12: "bytes", 13: "uint32",
    15: "sfixed32", 16: "sfixed64", 17: "sint32", 18: "sint64",
}
TYPE_MESSAGE = 11
TYPE_ENUM = 14
LABEL_REPEATED = 3


def lower_camel(name: str) -> str:
    return name[:1].lower() + name[1:]


# --------------------------------------------------------------------------
# Descriptor -> protobufjs JSON (runs in the child interpreter)
# --------------------------------------------------------------------------


def _camel(name: str) -> str:
    """snake_case -> lowerCamelCase, keeping a leading underscore (proto3 synthetic oneofs)."""
    lead = "_" if name.startswith("_") else ""
    parts = name.lstrip("_").split("_")
    return lead + parts[0] + "".join(p[:1].upper() + p[1:] for p in parts[1:])


def _enum_json(enum) -> dict:
    if not enum.value or enum.value[0].number != 0:
        raise SystemExit(f"enum {enum.name}: first value must be 0 (proto3 default)")
    out: dict = {"values": {v.name: v.number for v in enum.value}}
    if enum.options.allow_alias:
        out["options"] = {"allow_alias": True}
    return out


def _message_json(msg) -> dict:
    map_entries = {
        n.name: n for n in msg.nested_type if n.options.map_entry
    }
    fields: dict = {}
    oneof_members: dict[int, list[str]] = {}
    for f in msg.field:
        entry: dict = {"id": f.number}
        if f.type in SCALARS:
            entry["type"] = SCALARS[f.type]
        elif f.type in (TYPE_MESSAGE, TYPE_ENUM):
            entry["type"] = f.type_name  # fully qualified, leading dot
        else:
            raise SystemExit(f"unsupported field type {f.type} in {msg.name}.{f.name}")
        short = f.type_name.rsplit(".", 1)[-1] if f.type_name else ""
        if f.type == TYPE_MESSAGE and f.label == LABEL_REPEATED and short in map_entries:
            kv = {x.name: x for x in map_entries[short].field}
            key, val = kv["key"], kv["value"]
            entry["keyType"] = SCALARS[key.type]
            entry["type"] = SCALARS.get(val.type) or val.type_name
        elif f.label == LABEL_REPEATED:
            entry["rule"] = "repeated"
        if f.proto3_optional:
            entry["options"] = {"proto3_optional": True}
        # Use the canonical proto3 JSON name (lowerCamelCase), as protobufjs does for .proto input.
        name = _camel(f.name)
        if f.HasField("oneof_index"):
            oneof_members.setdefault(f.oneof_index, []).append(name)
        fields[name] = entry
    out: dict = {"fields": fields}
    if msg.oneof_decl:
        out["oneofs"] = {
            _camel(o.name): {"oneof": oneof_members.get(i, [])}
            for i, o in enumerate(msg.oneof_decl)
        }
    nested: dict = {}
    for n in msg.nested_type:
        if n.options.map_entry:
            continue
        nested[n.name] = _message_json(n)
    for e in msg.enum_type:
        nested[e.name] = _enum_json(e)
    if nested:
        out["nested"] = nested
    if msg.reserved_range or msg.reserved_name:
        reserved: list = [[r.start, r.end - 1] for r in msg.reserved_range]
        reserved.extend(msg.reserved_name)
        out["reserved"] = reserved
    return out


def extract(site: str, out_path: str) -> None:
    """Child-process entry: load anki/*_pb2.py from `site`, write JSON."""
    sys.path.insert(0, site)
    import importlib

    from google.protobuf import descriptor_pb2

    anki_dir = Path(site) / "anki"
    modules = sorted(p.stem for p in anki_dir.glob("*_pb2.py"))
    if not modules:
        raise SystemExit(f"no *_pb2.py found in {anki_dir}")

    root: dict = {"nested": {}}
    methods: dict = {}
    for mod_name in modules:
        mod = importlib.import_module(f"anki.{mod_name}")
        fdp = descriptor_pb2.FileDescriptorProto()
        mod.DESCRIPTOR.CopyToProto(fdp)
        if fdp.syntax not in ("", "proto3"):
            raise SystemExit(f"{fdp.name}: unexpected syntax {fdp.syntax!r}")
        if fdp.syntax != "proto3":
            raise SystemExit(f"{fdp.name}: expected proto3")
        ns = root
        for part in fdp.package.split("."):
            ns = ns["nested"].setdefault(part, {"nested": {}})
        for m in fdp.message_type:
            j = _message_json(m)
            j["edition"] = "proto3"
            ns["nested"][m.name] = j
        for e in fdp.enum_type:
            j = _enum_json(e)
            j["edition"] = "proto3"
            ns["nested"][e.name] = j
        for svc in fdp.service:
            for m in svc.method:
                key = lower_camel(m.name)
                info = {
                    "name": m.name,
                    "service": f"{fdp.package}.{svc.name}",
                    "request": m.input_type.lstrip("."),
                    "response": m.output_type.lstrip("."),
                }
                prev = methods.get(key)
                if prev is None:
                    methods[key] = info
                elif (prev["request"], prev["response"]) != (info["request"], info["response"]):
                    raise SystemExit(
                        f"method {m.name} defined with different types in "
                        f"{prev['service']} and {info['service']}"
                    )
                # else: duplicate (XxxService vs BackendXxxService) - keep first
    Path(out_path).write_text(
        # No sort_keys: declaration order matters (protobufjs takes the first enum value as default).
        json.dumps({"root": root, "methods": methods}, indent=1),
        encoding="utf-8",
    )


# --------------------------------------------------------------------------
# Main (parent process)
# --------------------------------------------------------------------------


def install_wheel(tmp: Path, wheel: str | None) -> Path:
    site = tmp / "site"
    spec = wheel if wheel else f"anki=={ANKI_VERSION}"
    subprocess.run(
        [sys.executable, "-m", "pip", "install", "--quiet", "--disable-pip-version-check",
         "--no-deps", "--target", str(site), spec, PROTOBUF_REQUIREMENT],
        check=True,
    )
    dist = list(site.glob("anki-*.dist-info"))
    found = dist[0].name[len("anki-"):-len(".dist-info")] if dist else "?"
    if found != ANKI_VERSION:
        raise SystemExit(f"wheel is anki {found}, expected {ANKI_VERSION}")
    return site


def write_methods_ts(methods: dict, out: Path) -> None:
    lines = [
        "// GENERATED by tools/gen_proto.py from the anki==" + ANKI_VERSION + " wheel. DO NOT EDIT.",
        "// Every backend service method (XxxService and BackendXxxService, de-duplicated by",
        "// name) with its raw-dispatch path and protobuf request/response classes.",
        "/* eslint-disable */",
        "import { anki } from './proto.js';",
        "",
        f"export const ANKI_VERSION = '{ANKI_VERSION}';",
        "",
        "export const methods = {",
    ]
    for key in sorted(methods):
        m = methods[key]
        lines.append(
            f"  {key}: {{ path: '/_anki/{key}', service: '{m['service']}', "
            f"request: {m['request']}, response: {m['response']} }},"
        )
    lines += [
        "} as const;",
        "",
        "export type MethodName = keyof typeof methods;",
        "type Spec<M extends MethodName> = (typeof methods)[M];",
        "/** Plain-object request accepted by `invoke(M, ...)`. */",
        "export type MethodRequest<M extends MethodName> = Parameters<Spec<M>['request']['encode']>[0];",
        "/** Decoded response of method M. */",
        "export type MethodResponse<M extends MethodName> = ReturnType<Spec<M>['response']['decode']>;",
        "",
    ]
    out.write_text("\n".join(lines), encoding="utf-8")


def run_pbjs(json_path: Path, out: Path) -> None:
    bin_dir = WEB / "node_modules" / ".bin"
    pbjs, pbts = bin_dir / "pbjs", bin_dir / "pbts"
    if not pbjs.exists():
        raise SystemExit("web/node_modules missing: run `npm ci` in web/ first")
    js = out / "proto.js"
    commented = json_path.with_name("proto.commented.js")
    flags = ["-t", "static-module", "-w", "es6", "--es6", "--force-number",
             "--no-create", "--no-verify", "--no-convert", "--no-delimited", "--no-typeurl",
             "--no-service", "-r", "anki"]
    # The shipped module has no JSDoc; pbts needs the JSDoc, so it reads a commented twin.
    subprocess.run([str(pbjs), *flags, "--no-comments", "-o", str(js), str(json_path)], check=True, cwd=WEB)
    subprocess.run([str(pbjs), *flags, "-o", str(commented), str(json_path)], check=True, cwd=WEB)
    src = js.read_text(encoding="utf-8")
    anchor = 'import $protobuf from "protobufjs/minimal.js";\n'
    if anchor not in src:
        raise SystemExit("unexpected pbjs output: protobufjs/minimal import not found")
    # Anki's 64-bit integers are ids / ms timestamps (< 2^53): decode them as JS
    # numbers everywhere (pbjs --force-number only changes the typings).
    src = src.replace(anchor, anchor + "$protobuf.util.Long = undefined;\n$protobuf.configure();\n", 1)
    header = f"// GENERATED by tools/gen_proto.py from the anki=={ANKI_VERSION} wheel. DO NOT EDIT.\n"
    js.write_text(header + src, encoding="utf-8")
    subprocess.run(
        [str(pbts), "--no-comments", "-o", str(out / "proto.d.ts"), str(commented)],
        check=True, cwd=WEB,
    )
    dts = (out / "proto.d.ts").read_text(encoding="utf-8")
    (out / "proto.d.ts").write_text(header + dts, encoding="utf-8")


def main() -> None:
    if len(sys.argv) >= 2 and sys.argv[1] == "--extract":
        extract(sys.argv[2], sys.argv[3])
        return
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--wheel", help="use this local anki wheel instead of downloading")
    ap.add_argument("--out", default=str(DEFAULT_OUT), help="output directory")
    ap.add_argument("--json-only", action="store_true",
                    help="only write anki.json (descriptor JSON) to --out; skip pbjs")
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    tmp = Path(tempfile.mkdtemp(prefix="amgi-proto-"))
    try:
        site = install_wheel(tmp, args.wheel)
        json_path = tmp / "anki.json"
        subprocess.run(
            [sys.executable, "-I", str(Path(__file__).resolve()), "--extract", str(site), str(json_path)],
            check=True,
        )
        data = json.loads(json_path.read_text(encoding="utf-8"))
        root_path = tmp / "root.json"
        root_path.write_text(json.dumps(data["root"]), encoding="utf-8")
        if args.json_only:
            shutil.copy(json_path, out / "anki.json")
            return
        run_pbjs(root_path, out)
        write_methods_ts(data["methods"], out / "methods.ts")
        print(f"wrote {out} ({len(data['methods'])} methods)")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    os.environ.setdefault("PYTHONDONTWRITEBYTECODE", "1")
    main()
