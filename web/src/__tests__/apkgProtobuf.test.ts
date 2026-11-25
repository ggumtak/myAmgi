import { describe, expect, it } from 'vitest';
import {
  parseCardDataJson,
  parseDeckConfigProtobuf,
  parseV21bMediaManifest,
} from '../importers/apkg';

function encodeVarint(n: number): number[] {
  const out: number[] = [];
  let v = n >>> 0;
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v);
  return out;
}

function encodeTag(fieldNum: number, wireType: number): number[] {
  return encodeVarint((fieldNum << 3) | wireType);
}

function encodeFloat32(val: number): number[] {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setFloat32(0, val, true);
  return Array.from(new Uint8Array(buf));
}

describe('APKG v21b Protobuf & FSRS Data Parser', () => {
  it('parses deck_config protobuf new_per_day, reviews_per_day, desired_retention, and fsrs_params', () => {
    const fsrsParams = Array.from({ length: 19 }, (_, i) => Number((0.1 * (i + 1)).toFixed(2)));
    const packedFloats: number[] = [];
    for (const p of fsrsParams) {
      packedFloats.push(...encodeFloat32(p));
    }

    const bytes = new Uint8Array([
      ...encodeTag(2, 0),
      ...encodeVarint(35), // new_per_day = 35
      ...encodeTag(3, 0),
      ...encodeVarint(250), // reviews_per_day = 250
      ...encodeTag(34, 5),
      ...encodeFloat32(0.88), // desired_retention = 0.88
      ...encodeTag(35, 2),
      ...encodeVarint(packedFloats.length),
      ...packedFloats,
    ]);

    const parsed = parseDeckConfigProtobuf(bytes);
    expect(parsed.newPerDay).toBe(35);
    expect(parsed.revPerDay).toBe(250);
    expect(parsed.desiredRetention).toBeCloseTo(0.88, 3);
    expect(parsed.fsrsEnabled).toBe(true);
    expect(parsed.fsrsParams).toHaveLength(19);
    expect(parsed.fsrsParams?.[0]).toBeCloseTo(0.1, 3);
  });

  it('parses cards.data JSON for FSRS stability, difficulty, and desired retention', () => {
    const data = parseCardDataJson('{"s":14.25,"d":5.41,"dr":0.92}');
    expect(data.s).toBe(14.25);
    expect(data.d).toBe(5.41);
    expect(data.dr).toBe(0.92);
    expect(data.fsrs).toBe(true);

    expect(parseCardDataJson('{}')).toEqual({});
    expect(parseCardDataJson('invalid')).toEqual({});
  });

  it('parses v21b protobuf MediaEntries manifest', () => {
    const name1 = Array.from(new TextEncoder().encode('audio1.mp3'));
    const entry1 = [
      ...encodeTag(1, 2),
      ...encodeVarint(name1.length),
      ...name1,
    ];
    const name2 = Array.from(new TextEncoder().encode('pic.png'));
    const entry2 = [
      ...encodeTag(1, 2),
      ...encodeVarint(name2.length),
      ...name2,
    ];

    const manifest = new Uint8Array([
      ...encodeTag(1, 2),
      ...encodeVarint(entry1.length),
      ...entry1,
      ...encodeTag(1, 2),
      ...encodeVarint(entry2.length),
      ...entry2,
    ]);

    const map = parseV21bMediaManifest(manifest);
    expect(map.get('0')).toBe('audio1.mp3');
    expect(map.get('1')).toBe('pic.png');
  });
});
