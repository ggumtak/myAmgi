import type { AnkiTypes } from '../../anki/generated';

export type FieldItem = AnkiTypes.notetypes.Notetype.Field.$Properties;
export type TemplateItem = AnkiTypes.notetypes.Notetype.Template.$Properties;

/** A field/template plus a client-only React key that survives reorders and saves. */
export type Keyed<T> = T & { clientKey: string };

let keySeq = 0;
function nextKey(): string {
  keySeq += 1;
  return `k${keySeq}`;
}

/**
 * For `updateNotetype`, `ord` is the item's PREVIOUS position: the engine moves that
 * position's note content / cards to wherever the item now sits. A new item must
 * therefore have NO ord; giving it `maxOrd + 1` makes it inherit the content of a
 * deleted item that used to sit there (verified against the engine).
 */
export function newFieldItem(name: string): Keyed<FieldItem> {
  return {
    clientKey: nextKey(),
    name,
    config: {
      fontName: 'Arial',
      fontSize: 20,
      sticky: false,
      rtl: false,
      plainText: false,
    },
  };
}

export function newTemplateItem(name: string, qFormat: string, aFormat: string): Keyed<TemplateItem> {
  return {
    clientKey: nextKey(),
    name,
    config: { qFormat, aFormat },
  };
}

export function withKeys<T>(items: readonly T[]): Keyed<T>[] {
  return items.map((it) => ({ ...it, clientKey: nextKey() }));
}

/** Drops the client key so only protobuf fields are sent. */
export function toPayloadItems<T>(items: readonly Keyed<T>[]): T[] {
  return items.map((it) => {
    const copy: Keyed<T> = { ...it };
    delete (copy as Partial<Keyed<T>>).clientKey;
    return copy as T;
  });
}

/**
 * After a save, takes the engine-assigned `ord` (and template mtime/usn) from the saved
 * notetype, matched by position, so a following save treats the new items as existing.
 * Returns null when the lists no longer line up (caller should reload instead).
 */
export function adoptSavedOrds<T extends FieldItem | TemplateItem>(
  local: readonly Keyed<T>[],
  saved: readonly T[]
): Keyed<T>[] | null {
  if (local.length !== saved.length) return null;
  if (local.some((it, i) => saved[i]?.name !== it.name)) return null;
  return local.map((it, i) => {
    const s = saved[i];
    const next = { ...it, ord: s.ord ? { val: s.ord.val } : undefined } as unknown as Keyed<T>;
    if ('mtimeSecs' in s) {
      (next as Keyed<TemplateItem>).mtimeSecs = (s as TemplateItem).mtimeSecs;
      (next as Keyed<TemplateItem>).usn = (s as TemplateItem).usn;
    }
    return next;
  });
}
