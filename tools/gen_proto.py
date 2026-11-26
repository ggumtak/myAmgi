#!/usr/bin/env python3
"""
Extract Anki 26.09.4 protobuf descriptors from the PyPI `anki==26.9.4` wheel,
cross-check field numbers and message names against `anki-backend-core-0.1.77-anki26.09.4.jar`,
and generate a compact filtered `protobufjs` bundle (`json-module` + `pbts` `.d.ts` + typed ESM entry)
under `web/src/anki/generated/`.
"""

from __future__ import annotations

import ast
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB_DIR = ROOT / "web"
OUT_DIR = WEB_DIR / "src" / "anki" / "generated"
CACHE_DIR = ROOT / ".gradle" / "proto-cache"

ANKI_VERSION = "26.9.4"
EXPECTED_JAR_PATTERN = "*anki-backend-core-0.1.77-anki26.09.4.jar"

# Every root protobuf message/enum required by web/src/anki/*.ts.
# Transitive field dependencies (nested messages, enums, map entries) are resolved automatically.
SEED_TYPES = [
    # anki.generic
    "anki.generic.Empty",
    "anki.generic.Bool",
    "anki.generic.Int32",
    "anki.generic.UInt32",
    "anki.generic.Int64",
    "anki.generic.String",
    "anki.generic.StringList",
    "anki.generic.Json",
    # anki.collection
    "anki.collection.OpChanges",
    "anki.collection.OpChangesWithCount",
    "anki.collection.OpChangesWithId",
    "anki.collection.UndoStatus",
    "anki.collection.OpChangesAfterUndo",
    "anki.collection.CheckDatabaseResponse",
    # anki.decks
    "anki.decks.DeckId",
    "anki.decks.DeckIds",
    "anki.decks.Deck",
    "anki.decks.DeckTreeRequest",
    "anki.decks.DeckTreeNode",
    "anki.decks.SetDeckCollapsedRequest",
    "anki.decks.GetDeckNamesRequest",
    "anki.decks.DeckNames",
    "anki.decks.DeckNameId",
    "anki.decks.ReparentDecksRequest",
    "anki.decks.RenameDeckRequest",
    "anki.decks.FilteredDeckForUpdate",
    # anki.deck_config
    "anki.deck_config.DeckConfigId",
    "anki.deck_config.DeckConfig",
    "anki.deck_config.DeckConfigsForUpdate",
    "anki.deck_config.UpdateDeckConfigsRequest",
    "anki.deck_config.UpdateDeckConfigsMode",
    # anki.scheduler
    "anki.scheduler.GetQueuedCardsRequest",
    "anki.scheduler.QueuedCards",
    "anki.scheduler.SchedulingStates",
    "anki.scheduler.SchedulingState",
    "anki.scheduler.CardAnswer",
    "anki.scheduler.BuryOrSuspendCardsRequest",
    "anki.scheduler.SetDueDateRequest",
    "anki.scheduler.ScheduleCardsAsNewRequest",
    "anki.scheduler.ScheduleCardsAsNewDefaultsRequest",
    "anki.scheduler.ScheduleCardsAsNewDefaultsResponse",
    "anki.scheduler.SortCardsRequest",
    "anki.scheduler.SortDeckRequest",
    "anki.scheduler.RepositionDefaultsResponse",
    "anki.scheduler.CongratsInfoResponse",
    "anki.scheduler.ComputeFsrsParamsRequest",
    "anki.scheduler.ComputeFsrsParamsResponse",
    "anki.scheduler.SimulateFsrsReviewRequest",
    "anki.scheduler.ComputeOptimalRetentionResponse",
    "anki.scheduler.UnburyDeckRequest",
    "anki.scheduler.CustomStudyRequest",
    "anki.scheduler.CustomStudyDefaultsRequest",
    "anki.scheduler.CustomStudyDefaultsResponse",
    "anki.scheduler.CountsForDeckTodayResponse",
    # anki.card_rendering
    "anki.card_rendering.RenderExistingCardRequest",
    "anki.card_rendering.RenderUncommittedCardRequest",
    "anki.card_rendering.RenderCardResponse",
    "anki.card_rendering.ExtractAvTagsRequest",
    "anki.card_rendering.ExtractAvTagsResponse",
    "anki.card_rendering.CompareAnswerRequest",
    "anki.card_rendering.ExtractClozeForTypingRequest",
    "anki.card_rendering.EmptyCardsReport",
    "anki.card_rendering.StripHtmlRequest",
    "anki.card_rendering.HtmlToTextLineRequest",
    # anki.cards
    "anki.cards.CardId",
    "anki.cards.CardIds",
    "anki.cards.Card",
    "anki.cards.UpdateCardsRequest",
    "anki.cards.RemoveCardsRequest",
    "anki.cards.SetDeckRequest",
    "anki.cards.SetFlagRequest",
    # anki.notes
    "anki.notes.NoteId",
    "anki.notes.NoteIds",
    "anki.notes.Note",
    "anki.notes.AddNoteRequest",
    "anki.notes.AddNoteResponse",
    "anki.notes.UpdateNotesRequest",
    "anki.notes.RemoveNotesRequest",
    "anki.notes.DefaultsForAddingRequest",
    "anki.notes.DeckAndNotetype",
    "anki.notes.NoteFieldsCheckResponse",
    "anki.notes.FieldNamesForNotesRequest",
    "anki.notes.FieldNamesForNotesResponse",
    "anki.notes.ClozeNumbersInNoteResponse",
    # anki.notetypes
    "anki.notetypes.NotetypeId",
    "anki.notetypes.Notetype",
    "anki.notetypes.NotetypeNames",
    "anki.notetypes.NotetypeNameId",
    "anki.notetypes.NotetypeUseCounts",
    "anki.notetypes.NotetypeNameIdUseCount",
    "anki.notetypes.StockNotetype",
    "anki.notetypes.AddOrUpdateNotetypeRequest",
    "anki.notetypes.ChangeNotetypeRequest",
    "anki.notetypes.GetChangeNotetypeInfoRequest",
    "anki.notetypes.ChangeNotetypeInfo",
    # anki.search
    "anki.search.SearchNode",
    "anki.search.JoinSearchNodesRequest",
    "anki.search.SearchRequest",
    "anki.search.SearchResponse",
    "anki.search.SortOrder",
    "anki.search.FindAndReplaceRequest",
    "anki.search.BrowserColumns",
    "anki.search.BrowserRow",
    # anki.stats
    "anki.stats.GraphsRequest",
    "anki.stats.GraphsResponse",
    "anki.stats.GraphPreferences",
    "anki.stats.CardStatsResponse",
    "anki.stats.ReviewLogs",
    # anki.tags
    "anki.tags.NoteIdsAndTagsRequest",
    "anki.tags.RenameTagsRequest",
    "anki.tags.ReparentTagsRequest",
    "anki.tags.FindAndReplaceTagRequest",
    "anki.tags.CompleteTagRequest",
    "anki.tags.CompleteTagResponse",
    "anki.tags.TagTreeNode",
    # anki.media
    "anki.media.CheckMediaResponse",
    "anki.media.TrashMediaFilesRequest",
    "anki.media.AddMediaFileRequest",
    # anki.config
    "anki.config.Preferences",
    "anki.config.ConfigKey",
    "anki.config.OptionalStringConfigKey",
    "anki.config.GetConfigBoolRequest",
    "anki.config.SetConfigBoolRequest",
    "anki.config.GetConfigStringRequest",
    "anki.config.SetConfigStringRequest",
    "anki.config.SetConfigJsonRequest",
]

TYPE_MAP = {
    1: "double",
    2: "float",
    3: "int64",
    4: "uint64",
    5: "int32",
    6: "fixed64",
    7: "fixed32",
    8: "bool",
    9: "string",
    10: "group",
    11: "message",
    12: "bytes",
    13: "uint32",
    14: "enum",
    15: "sfixed32",
    16: "sfixed64",
    17: "sint32",
    18: "sint64",
}
LABEL_MAP = {1: "optional", 2: "required", 3: "repeated"}


def ensure_google_protobuf(work_dir: Path) -> None:
    try:
        import google.protobuf.descriptor_pb2  # noqa: F401
        return
    except ImportError:
        pass
    py_pb = CACHE_DIR / "py_pb"
    if not (py_pb / "google" / "protobuf" / "descriptor_pb2.py").is_file():
        py_pb.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "--quiet", "--target", str(py_pb), "protobuf==6.31.1"],
            check=True,
        )
    sys.path.insert(0, str(py_pb))


def find_or_download_wheel(work_dir: Path) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    existing = sorted(CACHE_DIR.glob(f"anki-{ANKI_VERSION}-*.whl"))
    if existing:
        return existing[0]
    subprocess.run(
        [sys.executable, "-m", "pip", "download", "--no-deps", "--quiet", "--dest", str(CACHE_DIR), f"anki=={ANKI_VERSION}"],
        check=True,
    )
    downloaded = sorted(CACHE_DIR.glob(f"anki-{ANKI_VERSION}-*.whl"))
    if not downloaded:
        raise RuntimeError(f"Failed to download anki=={ANKI_VERSION} wheel")
    return downloaded[0]


def find_backend_jar() -> Path | None:
    gradle_home = Path(os.environ.get("GRADLE_USER_HOME", Path.home() / ".gradle"))
    matches = list((gradle_home / "caches").rglob(EXPECTED_JAR_PATTERN))
    return matches[0] if matches else None


def load_descriptors_from_wheel(wheel_path: Path):
    from google.protobuf import descriptor_pb2

    descriptors = []
    with zipfile.ZipFile(wheel_path) as zf:
        pb2_names = sorted(n for n in zf.namelist() if n.startswith("anki/") and n.endswith("_pb2.py"))
        for name in pb2_names:
            txt = zf.read(name).decode("utf-8")
            m = re.search(r"AddSerializedFile\((b'.*?')\)", txt, re.DOTALL)
            if not m:
                raise RuntimeError(f"No serialized FileDescriptorProto found in {name}")
            raw = ast.literal_eval(m.group(1))
            descriptors.append(descriptor_pb2.FileDescriptorProto.FromString(raw))
    return descriptors


def cross_check_against_jar(descriptors, jar_path: Path) -> None:
    with zipfile.ZipFile(jar_path) as zf:
        jar_entries = set(zf.namelist())

    missing_classes = []
    javap_targets = []
    for fdp in descriptors:
        pkg_path = fdp.package.replace(".", "/")

        def check_msgs(msgs, prefix=""):
            for msg in msgs:
                if msg.options.map_entry:
                    continue
                fqn = f"{fdp.package}.{prefix}{msg.name}"
                if fqn not in SEED_TYPES:
                    continue
                cls_name = f"{pkg_path}/{prefix.replace('.', '$')}{msg.name}.class"
                if cls_name not in jar_entries:
                    missing_classes.append(cls_name)
                else:
                    javap_targets.append((fqn, cls_name[:-6].replace("/", "."), msg))
                check_msgs(msg.nested_type, f"{prefix}{msg.name}.")

        check_msgs(fdp.message_type)

    if missing_classes:
        raise RuntimeError(f"Classes missing in {jar_path.name}: {missing_classes}")

    # Verify every field number of our seed messages against `javap` *_FIELD_NUMBER constants in the JAR.
    if javap_targets:
        cls_list = [t[1] for t in javap_targets]
        proc = subprocess.run(
            ["javap", "-cp", str(jar_path), "-constants", *cls_list],
            capture_output=True,
            text=True,
            check=True,
        )
        blocks = proc.stdout.split("Compiled from ")
        by_cls = {}
        for blk in blocks[1:]:
            header = blk.splitlines()[1] if len(blk.splitlines()) > 1 else ""
            m_cls = re.search(r"class ([A-Za-z0-9_.$]+)", header)
            if not m_cls:
                continue
            const_map = {}
            for fm in re.finditer(r"public static final int ([A-Z0-9_]+)_FIELD_NUMBER = (\d+);", blk):
                const_map[fm.group(1)] = int(fm.group(2))
            by_cls[m_cls.group(1)] = const_map

        for fqn, java_cls, msg in javap_targets:
            const_map = by_cls.get(java_cls)
            if const_map is None:
                raise RuntimeError(f"javap did not return class {java_cls}")
            for field in msg.field:
                expected_const = field.name.upper()
                if expected_const not in const_map:
                    raise RuntimeError(f"Field {fqn}.{field.name} missing in JAR class {java_cls}")
                if const_map[expected_const] != field.number:
                    raise RuntimeError(
                        f"Field number mismatch for {fqn}.{field.name}: wheel={field.number} jar={const_map[expected_const]}"
                    )


def compute_reachable_types(descriptors, seeds: list[str]) -> set[str]:
    defs: dict[str, tuple[object, set[str]]] = {}
    for fdp in descriptors:
        def walk_msgs(msgs, prefix: str):
            for msg in msgs:
                fqn = f"{prefix}.{msg.name}"
                deps = {f.type_name.lstrip(".") for f in msg.field if f.type in (11, 14)}
                defs[fqn] = (msg, deps)
                for e in msg.enum_type:
                    defs[f"{fqn}.{e.name}"] = (e, set())
                walk_msgs(msg.nested_type, fqn)

        def walk_enums(enums, prefix: str):
            for e in enums:
                defs[f"{prefix}.{e.name}"] = (e, set())

        walk_msgs(fdp.message_type, fdp.package)
        walk_enums(fdp.enum_type, fdp.package)

    keep: set[str] = set()
    stack = list(seeds)
    while stack:
        cur = stack.pop()
        if cur in keep:
            continue
        if cur not in defs:
            raise RuntimeError(f"Seed/dependency type not found in wheel descriptors: {cur}")
        keep.add(cur)
        _, deps = defs[cur]
        for dep in deps:
            if dep not in keep:
                stack.append(dep)
    return keep


def collect_needed_ancestors(keep: set[str]) -> set[str]:
    """If a nested type a.b.Outer.Inner is kept, Outer must exist as a container (though unreferenced fields can be pruned)."""
    containers = set(keep)
    for fqn in list(keep):
        parts = fqn.split(".")
        for i in range(3, len(parts)):
            containers.add(".".join(parts[:i]))
    return containers


def render_enum(e, indent: int = 0) -> list[str]:
    pad = "  " * indent
    lines = [f"{pad}enum {e.name} {{"]
    if e.options.allow_alias:
        lines.append(f"{pad}  option allow_alias = true;")
    for v in e.value:
        lines.append(f"{pad}  {v.name} = {v.number};")
    lines.append(f"{pad}}}")
    return lines


def render_filtered_msg(m, fqn: str, syntax: str, keep: set[str], containers: set[str], indent: int = 0) -> tuple[list[str], set[str]]:
    pad = "  " * indent
    lines = [f"{pad}message {m.name} {{"]
    referenced_types: set[str] = set()

    include_fields = fqn in keep

    map_entries = {}
    for nt in m.nested_type:
        if nt.options.map_entry:
            k_f = next(f for f in nt.field if f.number == 1)
            v_f = next(f for f in nt.field if f.number == 2)
            map_entries[f".{fqn}.{nt.name}"] = (k_f, v_f)
            map_entries[f"{fqn}.{nt.name}"] = (k_f, v_f)

    for e in m.enum_type:
        e_fqn = f"{fqn}.{e.name}"
        if include_fields or e_fqn in keep:
            lines.extend(render_enum(e, indent + 1))

    for nt in m.nested_type:
        if nt.options.map_entry:
            continue
        nt_fqn = f"{fqn}.{nt.name}"
        if nt_fqn in containers:
            sub_lines, sub_refs = render_filtered_msg(nt, nt_fqn, syntax, keep, containers, indent + 1)
            lines.extend(sub_lines)
            referenced_types.update(sub_refs)

    if include_fields:
        oneofs = {i: [] for i in range(len(m.oneof_decl))}
        regular = []
        for f in m.field:
            if f.HasField("oneof_index") and not f.proto3_optional:
                oneofs[f.oneof_index].append(f)
            else:
                regular.append(f)

        def fmt_type(f) -> str:
            if f.type in (11, 14):
                t = f.type_name.lstrip(".")
                referenced_types.add(t)
                return t
            return TYPE_MAP[f.type]

        def get_map_entry(f):
            if f.label == 3 and f.type == 11:
                return map_entries.get(f.type_name.lstrip("."))
            return None

        for f in regular:
            mf = get_map_entry(f)
            if mf:
                kf, vf = mf
                lines.append(f"{pad}  map<{fmt_type(kf)}, {fmt_type(vf)}> {f.name} = {f.number};")
                continue
            prefix = ""
            if f.label == 3:
                prefix = "repeated "
            elif f.proto3_optional or syntax == "proto2":
                prefix = f"{LABEL_MAP[f.label]} "
            lines.append(f"{pad}  {prefix}{fmt_type(f)} {f.name} = {f.number};")

        for idx, decl in enumerate(m.oneof_decl):
            fields = oneofs[idx]
            if not fields:
                continue
            lines.append(f"{pad}  oneof {decl.name} {{")
            for f in fields:
                lines.append(f"{pad}    {fmt_type(f)} {f.name} = {f.number};")
            lines.append(f"{pad}  }}")

    lines.append(f"{pad}}}")
    return lines, referenced_types


def write_filtered_protos(descriptors, proto_dir: Path, keep: set[str], containers: set[str]) -> list[Path]:
    pkg_to_file = {fdp.package: fdp.name for fdp in descriptors}
    type_to_file: dict[str, str] = {}
    for fdp in descriptors:
        def reg(msgs, prefix):
            for msg in msgs:
                fqn = f"{prefix}.{msg.name}"
                type_to_file[fqn] = fdp.name
                reg(msg.nested_type, fqn)
        for e in fdp.enum_type:
            type_to_file[f"{fdp.package}.{e.name}"] = fdp.name
        reg(fdp.message_type, fdp.package)

    written: list[Path] = []
    for fdp in descriptors:
        syntax = fdp.syntax or "proto2"
        body_lines: list[str] = []
        refs: set[str] = set()

        for e in fdp.enum_type:
            e_fqn = f"{fdp.package}.{e.name}"
            if e_fqn in keep:
                body_lines.extend(render_enum(e, 0))

        for msg in fdp.message_type:
            m_fqn = f"{fdp.package}.{msg.name}"
            if m_fqn in containers:
                m_lines, m_refs = render_filtered_msg(msg, m_fqn, syntax, keep, containers, 0)
                body_lines.extend(m_lines)
                refs.update(m_refs)

        if not body_lines:
            continue

        needed_imports = sorted({type_to_file[r] for r in refs if r in type_to_file and type_to_file[r] != fdp.name})
        header = [f'syntax = "{syntax}";']
        if fdp.package:
            header.append(f"package {fdp.package};")
        for dep in needed_imports:
            header.append(f'import "{dep}";')
        header.append("")

        out_path = proto_dir / fdp.name
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text("\n".join(header + body_lines) + "\n", encoding="utf-8")
        written.append(out_path)
    return written


def build_namespace_wrapper(keep: set[str]) -> str:
    """Builds `index.ts` re-exporting typed `anki.*` runtime reflection types backed by `json-module`."""
    return """/* eslint-disable */
// Auto-generated by tools/gen_proto.py from anki==26.9.4 descriptors. Do not edit by hand.
import root from './anki-json.js';
import type { anki as AnkiTypes } from './anki-types';

root.resolveAll();

function bindNamespace(node: unknown): unknown {
  if (!node || typeof node !== 'object') return node;
  const record = node as Record<string, unknown>;
  const nested = record.nested as Record<string, unknown> | undefined;
  if (nested) {
    for (const [key, child] of Object.entries(nested)) {
      if (!(key in record)) {
        record[key] = child;
      }
      bindNamespace(child);
    }
  }
  return record;
}

export const anki = bindNamespace(root.lookup('anki')) as typeof AnkiTypes;
export type { AnkiTypes };
export default anki;
"""


def main() -> None:
    pbjs = WEB_DIR / "node_modules" / ".bin" / "pbjs"
    pbts = WEB_DIR / "node_modules" / ".bin" / "pbts"
    esbuild = WEB_DIR / "node_modules" / ".bin" / "esbuild"
    if not pbjs.is_file() or not pbts.is_file():
        raise RuntimeError("Run `npm install` in web/ first (pbjs/pbts missing).")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        ensure_google_protobuf(tmp_path)
        wheel_path = find_or_download_wheel(tmp_path)
        descriptors = load_descriptors_from_wheel(wheel_path)

        jar_path = find_backend_jar()
        if jar_path is not None:
            cross_check_against_jar(descriptors, jar_path)
            print(f"Verified field numbers against {jar_path.name}")
        else:
            print("Warning: anki-backend-core JAR not found in Gradle cache; skipping JAR cross-check.")

        keep = compute_reachable_types(descriptors, SEED_TYPES)
        containers = collect_needed_ancestors(keep)
        proto_dir = tmp_path / "protos"
        proto_files = write_filtered_protos(descriptors, proto_dir, keep, containers)
        print(f"Filtered to {len(keep)} reachable types across {len(proto_files)} .proto files")

        OUT_DIR.mkdir(parents=True, exist_ok=True)
        static_js_tmp = tmp_path / "anki-static.js"
        json_js_out = OUT_DIR / "anki-json.js"
        dts_out = OUT_DIR / "anki-types.d.ts"
        index_ts_out = OUT_DIR / "index.ts"
        json_dts_out = OUT_DIR / "anki-json.d.ts"

        # 1. Generate compact runtime json-module (~60 KB minified) using protobufjs/light.
        subprocess.run(
            [
                str(pbjs),
                "-t",
                "json-module",
                "-w",
                "es6",
                "-p",
                str(proto_dir),
                "-o",
                str(json_js_out),
                *[str(p) for p in proto_files],
            ],
            check=True,
        )

        # Minify anki-json.js in-place via esbuild while preserving ES export so the committed bundle stays compact.
        if esbuild.is_file():
            min_tmp = tmp_path / "anki-json.min.js"
            subprocess.run(
                [str(esbuild), str(json_js_out), "--minify", f"--outfile={min_tmp}"],
                check=True,
            )
            shutil.copy2(min_tmp, json_js_out)

        # 2. Generate exact static TypeScript declarations via pbjs static-module + pbts.
        subprocess.run(
            [
                str(pbjs),
                "-t",
                "static-module",
                "-w",
                "es6",
                "--no-verify",
                "--no-convert",
                "--no-delimited",
                "--no-typeurl",
                "-p",
                str(proto_dir),
                "-o",
                str(static_js_tmp),
                *[str(p) for p in proto_files],
            ],
            check=True,
        )
        subprocess.run(
            [str(pbts), "-o", str(dts_out), str(static_js_tmp)],
            check=True,
        )

        # Fix pbts `import Long = require("long");` so TypeScript with `module: ESNext` compiles cleanly.
        dts_text = dts_out.read_text(encoding="utf-8")
        dts_text = dts_text.replace('import Long = require("long");', 'import type Long from "long";')
        dts_out.write_text(dts_text, encoding="utf-8")

        json_dts_out.write_text(
            "import type * as $protobuf from 'protobufjs';\n"
            "declare const root: $protobuf.Root;\n"
            "export default root;\n",
            encoding="utf-8",
        )
        index_ts_out.write_text(build_namespace_wrapper(keep), encoding="utf-8")

        print(f"Generated {json_js_out} ({json_js_out.stat().st_size} bytes)")
        print(f"Generated {dts_out} ({dts_out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
