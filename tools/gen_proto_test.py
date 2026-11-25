"""Tests for tools/gen_proto.py (descriptor -> protobufjs JSON conversion).

Run: python3 -m unittest tools/gen_proto_test.py   (needs the `protobuf` package;
skipped otherwise). The end-to-end check that the generated JS encodes exactly
like the engine lives in web/src/anki/__tests__/rpc.test.ts.
"""

import importlib.util
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("gen_proto", HERE / "gen_proto.py")
gen = importlib.util.module_from_spec(spec)
sys.modules["gen_proto"] = gen
spec.loader.exec_module(gen)

try:
    from google.protobuf import descriptor_pb2
except ImportError:  # pragma: no cover
    descriptor_pb2 = None


@unittest.skipIf(descriptor_pb2 is None, "protobuf not installed")
class ConvertTest(unittest.TestCase):
    def message(self):
        F = descriptor_pb2.FieldDescriptorProto
        m = descriptor_pb2.DescriptorProto(name="Thing")
        m.field.add(name="deck_id", number=1, type=F.TYPE_INT64, label=F.LABEL_OPTIONAL)
        m.field.add(name="card_ids", number=2, type=F.TYPE_INT64, label=F.LABEL_REPEATED)
        m.field.add(name="args", number=3, type=F.TYPE_MESSAGE, label=F.LABEL_REPEATED,
                    type_name=".pkg.Thing.ArgsEntry")
        m.field.add(name="maybe_limit", number=4, type=F.TYPE_UINT32, label=F.LABEL_OPTIONAL,
                    proto3_optional=True, oneof_index=0)
        m.field.add(name="text", number=5, type=F.TYPE_STRING, oneof_index=1)
        m.field.add(name="kind", number=6, type=F.TYPE_ENUM, type_name=".pkg.Thing.Kind", oneof_index=1)
        m.oneof_decl.add(name="_maybe_limit")
        m.oneof_decl.add(name="value")
        entry = m.nested_type.add(name="ArgsEntry")
        entry.options.map_entry = True
        entry.field.add(name="key", number=1, type=F.TYPE_STRING)
        entry.field.add(name="value", number=2, type=F.TYPE_MESSAGE, type_name=".pkg.Value")
        e = m.enum_type.add(name="Kind")
        e.value.add(name="ZETA", number=0)
        e.value.add(name="ALPHA", number=1)
        return m

    def test_fields_maps_oneofs_optionals(self):
        j = gen._message_json(self.message())
        self.assertEqual(j["fields"]["deckId"], {"id": 1, "type": "int64"})
        self.assertEqual(j["fields"]["cardIds"], {"id": 2, "type": "int64", "rule": "repeated"})
        self.assertEqual(j["fields"]["args"], {"id": 3, "type": ".pkg.Value", "keyType": "string"})
        self.assertEqual(j["fields"]["maybeLimit"]["options"], {"proto3_optional": True})
        self.assertEqual(j["oneofs"], {"_maybeLimit": {"oneof": ["maybeLimit"]}, "value": {"oneof": ["text", "kind"]}})
        self.assertNotIn("ArgsEntry", j["nested"])

    def test_enum_keeps_declaration_order(self):
        j = gen._message_json(self.message())
        self.assertEqual(list(j["nested"]["Kind"]["values"]), ["ZETA", "ALPHA"])

    def test_enum_must_start_at_zero(self):
        e = descriptor_pb2.EnumDescriptorProto(name="Bad")
        e.value.add(name="ONE", number=1)
        with self.assertRaises(SystemExit):
            gen._enum_json(e)


class NamesTest(unittest.TestCase):
    def test_lower_camel(self):
        self.assertEqual(gen.lower_camel("GetQueuedCards"), "getQueuedCards")
        self.assertEqual(gen.lower_camel("I18nResources"), "i18nResources")

    def test_camel(self):
        self.assertEqual(gen._camel("intraday_learning_only"), "intradayLearningOnly")
        self.assertEqual(gen._camel("_first_review"), "_firstReview")
        self.assertEqual(gen._camel("field_1"), "field1")

    def test_version_pinned_once(self):
        self.assertRegex(gen.ANKI_VERSION, r"^\d+\.\d+\.\d+$")


if __name__ == "__main__":
    unittest.main()
