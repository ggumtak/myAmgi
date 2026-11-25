"""Engine sidecar for the fake host: the REAL Anki engine (pip `anki`) over stdio.

Started by server.mjs. Opens (and on first use seeds) a collection, then serves
framed requests on stdin/stdout:

  request : u32 BE header length, header JSON, u32 BE body length, body bytes
            header = {"op": "anki", "method": "<lowerCamelCase>"}
                   | {"op": "info"}            -> JSON about the collection
                   | {"op": "check"}           -> JSON integrity check (dev only)
  response: u8 status (0 ok, 1 error), u32 BE length, payload
            (ok: raw protobuf / JSON bytes; error: UTF-8 message)

`op: anki` is a raw protobuf passthrough: the bytes go straight into
`RustBackend.<snake_case>_raw(bytes)`, the same raw dispatch the Kotlin host uses
(`<method>Raw(byte[])`), and the response bytes come straight back.
"""

from __future__ import annotations

import json
import os
import re
import struct
import sys
import time
import traceback

from anki._backend import RustBackend
from anki.collection import Collection
from anki.scheduler_pb2 import CardAnswer


def snake(name: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()


def build_dispatch(backend: RustBackend) -> dict:
    table = {}
    for attr in dir(backend):
        if attr.endswith("_raw") and not attr.startswith("_"):
            base = attr[: -len("_raw")]
            parts = base.split("_")
            camel = parts[0] + "".join(p[:1].upper() + p[1:] for p in parts[1:])
            table[camel] = getattr(backend, attr)
    return table


# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------

KANJI = [
    ("漢字", "한자 (かんじ)"),
    ("日本", "일본 (にほん)"),
    ("学校", "학교 (がっこう)"),
    ("先生", "선생님 (せんせい)"),
    ("電車", "전철 (でんしゃ)"),
    ("天気", "날씨 (てんき)"),
    ("時間", "시간 (じかん)"),
    ("会社", "회사 (かいしゃ)"),
]
VOCAB = [
    ("ありがとう", "고마워"),
    ("おはよう", "좋은 아침"),
    ("たべる", "먹다"),
    ("のむ", "마시다"),
    ("いく", "가다"),
    ("くる", "오다"),
]
CLOZE = [
    "The {{c1::early}} bird catches the {{c2::worm}}. (일찍 일어나는 새가 벌레를 잡는다)",
    "Practice makes {{c1::perfect}}. (연습이 완벽을 만든다)",
    "{{c1::Seoul}} is the capital of {{c2::Korea}}. (서울은 한국의 수도)",
]


def seed(col: Collection) -> None:
    decks = col.decks
    kanji = decks.id("일본어::한자")
    vocab = decks.id("일본어::어휘")
    english = decks.id("영어")
    deck = decks.get(kanji)
    deck["desc"] = (
        "<b>JLPT N3</b> 한자 카드입니다. <i>매일 조금씩!</i>"
        "<script>window.__xss = 1</script><span onclick=\"window.__xss=2\"></span>"
    )
    decks.save(deck)

    basic = col.models.by_name("Basic")
    cloze = col.models.by_name("Cloze")
    for front, back in KANJI:
        n = col.new_note(basic)
        n["Front"], n["Back"] = front, back
        col.add_note(n, kanji)
    for front, back in VOCAB:
        n = col.new_note(basic)
        n["Front"], n["Back"] = front, back
        n.tags = ["어휘"]
        col.add_note(n, vocab)
    for text in CLOZE:
        n = col.new_note(cloze)
        n["Text"] = text
        col.add_note(n, english)

    # Make review cards due today: 3 kanji + 2 vocab + 1 cloze card.
    def cids(did: int) -> list[int]:
        return sorted(col.find_cards(f"did:{did}"))

    k, v, e = cids(kanji), cids(vocab), cids(english)
    col.sched.set_due_date(k[:3] + v[:2] + e[:1], "0")
    # Learning cards: answer two new cards "Again" through the v3 queue.
    for did in (kanji, vocab):
        decks.select(did)
        queued = col.sched.get_queued_cards(fetch_limit=1)
        card = col.get_card(queued.cards[0].card.id)
        states = queued.cards[0].states
        card.start_timer()
        answer = col.sched.build_answer(card=card, states=states, rating=CardAnswer.AGAIN)
        col.sched.answer_card(answer)
    # A filtered deck (shown in --primary in the deck list) holding one English card.
    fdid = col.decks.new_filtered("집중 복습")
    fdeck = col.decks.get(fdid)
    fdeck["terms"] = [["deck:영어 is:new", 1, 0]]
    col.decks.save(fdeck)
    col.sched.rebuild_filtered_deck(fdid)
    # New decks start collapsed in the engine; show 일본어 expanded at first.
    col._backend.set_deck_collapsed(deck_id=decks.id("일본어"), collapsed=False, scope=0)
    decks.select(kanji)


def open_collection(directory: str) -> Collection:
    os.makedirs(directory, exist_ok=True)
    path = os.path.join(directory, "collection.anki2")
    fresh = not os.path.exists(path)
    backend = RustBackend(langs=["ko", "en"])
    col = Collection(path, backend=backend)
    if fresh:
        seed(col)
    return col


# ---------------------------------------------------------------------------
# Framed stdio loop
# ---------------------------------------------------------------------------


def read_exact(stream, n: int) -> bytes:
    buf = b""
    while len(buf) < n:
        chunk = stream.read(n - len(buf))
        if not chunk:
            raise EOFError
        buf += chunk
    return buf


def main() -> None:
    directory = sys.argv[1]
    col = open_collection(directory)
    dispatch = build_dispatch(col._backend)
    stdin, stdout = sys.stdin.buffer, sys.stdout.buffer
    # Anything printed by the engine must not corrupt the protocol stream.
    sys.stdout = sys.stderr

    def reply(status: int, payload: bytes) -> None:
        stdout.write(struct.pack(">BI", status, len(payload)) + payload)
        stdout.flush()

    reply(0, json.dumps({"ready": True, "methods": len(dispatch)}).encode())
    while True:
        try:
            (hlen,) = struct.unpack(">I", read_exact(stdin, 4))
            header = json.loads(read_exact(stdin, hlen))
            (blen,) = struct.unpack(">I", read_exact(stdin, 4))
            body = read_exact(stdin, blen)
        except EOFError:
            break
        op = header.get("op")
        try:
            if op == "anki":
                fn = dispatch.get(header["method"])
                if fn is None:
                    reply(1, f"unknown backend method: {header['method']}".encode())
                    continue
                reply(0, fn(body))
            elif op == "info":
                info = {
                    "path": col.path,
                    "mediaDir": col.media.dir(),
                    "size": os.path.getsize(col.path),
                    "time": time.time(),
                }
                reply(0, json.dumps(info).encode())
            elif op == "close":
                col.close()
                reply(0, b"{}")
                break
            else:
                reply(1, f"unknown op {op}".encode())
        except Exception as err:  # engine errors carry the localized message
            msg = str(err) or err.__class__.__name__
            print(traceback.format_exc(), file=sys.stderr)
            reply(1, msg.encode("utf-8"))


if __name__ == "__main__":
    main()
