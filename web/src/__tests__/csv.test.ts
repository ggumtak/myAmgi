import { describe, expect, it } from 'vitest';
import { decodeTextWithAutoEncoding, detectDelimiter, parseDelimitedRows } from '../importers/csv';

function encodeUtf16Le(str: string, withBom = false): Uint8Array {
  const bytes = new Uint8Array((withBom ? 2 : 0) + str.length * 2);
  let offset = 0;
  if (withBom) {
    bytes[0] = 0xff;
    bytes[1] = 0xfe;
    offset = 2;
  }
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bytes[offset++] = code & 0xff;
    bytes[offset++] = (code >> 8) & 0xff;
  }
  return bytes;
}

function encodeUtf16Be(str: string, withBom = false): Uint8Array {
  const bytes = new Uint8Array((withBom ? 2 : 0) + str.length * 2);
  let offset = 0;
  if (withBom) {
    bytes[0] = 0xfe;
    bytes[1] = 0xff;
    offset = 2;
  }
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bytes[offset++] = (code >> 8) & 0xff;
    bytes[offset++] = code & 0xff;
  }
  return bytes;
}

describe('CSV / Encoding Auto-Detection', () => {
  it('detects UTF-8 with and without BOM', () => {
    const text = 'apple,사과\nbanana,바나나';
    const utf8 = new TextEncoder().encode(text);
    const res1 = decodeTextWithAutoEncoding(utf8);
    expect(res1.encoding).toBe('utf-8');
    expect(res1.text).toBe(text);

    const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8]);
    const res2 = decodeTextWithAutoEncoding(bom);
    expect(res2.encoding).toBe('utf-8-bom');
    expect(res2.text).toBe(text);
  });

  it('detects UTF-16 LE and BE (with and without BOM)', () => {
    const sample = 'front\tback\nhello\t안녕';
    const leBom = decodeTextWithAutoEncoding(encodeUtf16Le(sample, true));
    expect(leBom.encoding).toBe('utf-16le');
    expect(leBom.text).toBe(sample);

    const beBom = decodeTextWithAutoEncoding(encodeUtf16Be(sample, true));
    expect(beBom.encoding).toBe('utf-16be');
    expect(beBom.text).toBe(sample);

    const leNoBom = decodeTextWithAutoEncoding(encodeUtf16Le('word\tmeaning', false));
    expect(leNoBom.encoding).toBe('utf-16le');
    expect(leNoBom.text).toBe('word\tmeaning');
  });

  it('detects EUC-KR / CP949 bytes', () => {
    // "가나다" in EUC-KR: 0xB0 0xA1, 0xB3 0xAA, 0xB4 0xD9
    const eucKrBytes = new Uint8Array([
      0xb0, 0xa1, 0xb3, 0xaa, 0xb4, 0xd9, 0x2c, 0x61, 0x62, 0x63,
    ]);
    const res = decodeTextWithAutoEncoding(eucKrBytes);
    expect(res.encoding).toBe('euc-kr');
    expect(res.text).toBe('가나다,abc');
  });

  it('detects Shift-JIS bytes', () => {
    // "あいう" in Shift-JIS: 0x82 0xA0, 0x82 0xA2, 0x82 0xA4
    const sjisBytes = new Uint8Array([
      0x82, 0xa0, 0x82, 0xa2, 0x82, 0xa4, 0x2c, 0x74, 0x65, 0x73, 0x74,
    ]);
    const res = decodeTextWithAutoEncoding(sjisBytes);
    expect(res.encoding).toBe('shift-jis');
    expect(res.text).toBe('あいう,test');
  });

  it('parses quoted CSV and TSV rows accurately', () => {
    const tsv = 'term\tdefinition\n"hello, world"\t"line1\nline2"';
    const delim = detectDelimiter(tsv);
    expect(delim).toBe('\t');
    const rows = parseDelimitedRows(tsv, delim);
    expect(rows).toHaveLength(2);
    expect(rows[1][0]).toBe('hello, world');
    expect(rows[1][1]).toBe('line1\nline2');
  });
});
