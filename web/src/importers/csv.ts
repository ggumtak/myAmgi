export interface CsvParseResult {
  encoding: string;
  delimiter: '\t' | ',' | ';';
  rows: string[][];
}

function hasUtf8Bom(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

function hasUtf16LeBom(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe;
}

function hasUtf16BeBom(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff;
}

/**
 * Heuristic detection for UTF-16 LE/BE without BOM based on null-byte distribution.
 */
function detectUtf16WithoutBom(bytes: Uint8Array): 'utf-16le' | 'utf-16be' | null {
  const sampleLen = Math.min(bytes.length, 512);
  if (sampleLen < 4) return null;
  let evenNulls = 0;
  let oddNulls = 0;
  let pairs = 0;
  for (let i = 0; i + 1 < sampleLen; i += 2) {
    pairs++;
    if (bytes[i] === 0) evenNulls++;
    if (bytes[i + 1] === 0) oddNulls++;
  }
  if (pairs === 0) return null;
  if (oddNulls / pairs > 0.3 && evenNulls / pairs < 0.05) return 'utf-16le';
  if (evenNulls / pairs > 0.3 && oddNulls / pairs < 0.05) return 'utf-16be';
  return null;
}

/**
 * Score decoded text readability to distinguish EUC-KR / CP949 vs Shift-JIS when not valid UTF-8.
 */
function scoreCjkText(text: string): { hangul: number; kana: number; replacement: number } {
  let hangul = 0;
  let kana = 0;
  let replacement = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 0xfffd) replacement++;
    else if ((code >= 0xac00 && code <= 0xd7af) || (code >= 0x3131 && code <= 0x318e)) hangul++;
    else if ((code >= 0x3040 && code <= 0x309f) || (code >= 0x30a0 && code <= 0x30ff)) kana++;
  }
  return { hangul, kana, replacement };
}

/**
 * Decode bytes into string with automatic encoding detection:
 * UTF-8 (with/without BOM), UTF-16 LE/BE, CP949/EUC-KR (`euc-kr`), Shift-JIS (`shift-jis`).
 */
export function decodeTextWithAutoEncoding(bytes: Uint8Array): {
  text: string;
  encoding: string;
} {
  if (hasUtf8Bom(bytes)) {
    return {
      text: new TextDecoder('utf-8').decode(bytes.subarray(3)),
      encoding: 'utf-8-bom',
    };
  }
  if (hasUtf16LeBom(bytes)) {
    return {
      text: new TextDecoder('utf-16le').decode(bytes.subarray(2)),
      encoding: 'utf-16le',
    };
  }
  if (hasUtf16BeBom(bytes)) {
    return {
      text: new TextDecoder('utf-16be').decode(bytes.subarray(2)),
      encoding: 'utf-16be',
    };
  }

  const utf16Guess = detectUtf16WithoutBom(bytes);
  if (utf16Guess) {
    return {
      text: new TextDecoder(utf16Guess).decode(bytes),
      encoding: utf16Guess,
    };
  }

  // Try strict UTF-8 first
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { text, encoding: 'utf-8' };
  } catch {
    // Not valid UTF-8 -> check EUC-KR / CP949 vs Shift-JIS
  }

  let eucKrText = '';
  let sjisText = '';
  let eucScore = { hangul: 0, kana: 0, replacement: Number.MAX_SAFE_INTEGER };
  let sjisScore = { hangul: 0, kana: 0, replacement: Number.MAX_SAFE_INTEGER };

  try {
    eucKrText = new TextDecoder('euc-kr', { fatal: false }).decode(bytes);
    eucScore = scoreCjkText(eucKrText);
  } catch {
    // ignore if unsupported
  }

  try {
    sjisText = new TextDecoder('shift-jis', { fatal: false }).decode(bytes);
    sjisScore = scoreCjkText(sjisText);
  } catch {
    // ignore if unsupported
  }

  // Heuristic: prefer fewer replacement characters, then Hangul vs Kana dominance
  if (sjisText && !eucKrText) {
    return { text: sjisText, encoding: 'shift-jis' };
  }
  if (eucKrText && !sjisText) {
    return { text: eucKrText, encoding: 'euc-kr' };
  }

  const eucRank = eucScore.hangul * 3 + eucScore.kana - eucScore.replacement * 10;
  const sjisRank = sjisScore.kana * 3 - sjisScore.replacement * 10;

  // Check byte-level Shift-JIS half-width katakana or lead bytes (0x81..0x9F)
  let sjisExclusiveBytes = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b >= 0x81 && b <= 0x9f) {
      sjisExclusiveBytes++;
      i++;
    }
  }

  if (sjisExclusiveBytes > 0 && sjisScore.replacement <= eucScore.replacement && sjisScore.kana > 0) {
    return { text: sjisText, encoding: 'shift-jis' };
  }

  if (sjisRank > eucRank && sjisScore.kana > eucScore.hangul) {
    return { text: sjisText, encoding: 'shift-jis' };
  }

  if (eucKrText) {
    return { text: eucKrText, encoding: 'euc-kr' };
  }

  return {
    text: new TextDecoder('utf-8', { fatal: false }).decode(bytes),
    encoding: 'utf-8',
  };
}

export function detectDelimiter(text: string): '\t' | ',' | ';' {
  const firstLines = text.split(/\r?\n/).slice(0, 5).filter((l) => l.trim().length > 0);
  if (firstLines.length === 0) return ',';
  const sample = firstLines.join('\n');
  const tabs = (sample.match(/\t/g) ?? []).length;
  const commas = (sample.match(/,/g) ?? []).length;
  const semis = (sample.match(/;/g) ?? []).length;
  if (tabs >= commas && tabs >= semis && tabs > 0) return '\t';
  if (semis > commas && semis > tabs) return ';';
  return ',';
}

export function parseDelimitedRows(text: string, delimiter: '\t' | ',' | ';'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        row.push(field);
        field = '';
      } else if (ch === '\r' && next === '\n') {
        row.push(field);
        if (row.some((c) => c.trim().length > 0)) rows.push(row);
        row = [];
        field = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        row.push(field);
        if (row.some((c) => c.trim().length > 0)) rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((c) => c.trim().length > 0)) rows.push(row);
  }

  return rows;
}

export async function importCsvFile(file: File | Uint8Array): Promise<CsvParseResult> {
  const bytes =
    file instanceof Uint8Array ? file : new Uint8Array(await file.arrayBuffer());
  const { text, encoding } = decodeTextWithAutoEncoding(bytes);
  const delimiter = detectDelimiter(text);
  const rows = parseDelimitedRows(text, delimiter);
  return { encoding, delimiter, rows };
}
