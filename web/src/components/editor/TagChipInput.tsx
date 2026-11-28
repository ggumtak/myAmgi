import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import * as anki from '../../anki';
import { IconClose } from '../../ui';

export interface TagChipInputProps {
  tags: string[];
  onChange: (nextTags: string[]) => void;
}

export interface TagChipInputHandle {
  /**
   * Commits any text still in the input box and returns the resulting tag list
   * (call before saving, e.g. for a Ctrl+Enter save that never blurs the input).
   */
  flush: () => string[];
}

const TAG_SEPARATORS = /[\s,\u3000]+/;

/** Splits typed text into tags; `rest` is the unfinished last piece (no trailing separator). */
export function splitTagInput(raw: string): { complete: string[]; rest: string } {
  const pieces = raw.split(TAG_SEPARATORS);
  const rest = pieces.pop() ?? '';
  return { complete: pieces.map((p) => p.trim()).filter(Boolean), rest };
}

export function mergeTags(existing: readonly string[], added: readonly string[]): string[] {
  const next = [...existing];
  for (const t of added) {
    if (t && !next.includes(t)) next.push(t);
  }
  return next;
}

export const TagChipInput = forwardRef<TagChipInputHandle, TagChipInputProps>(function TagChipInput(
  { tags, onChange },
  ref
) {
  const [input, setInput] = useState('');
  // Latest values for flush() and IME-safe commits outside React's render cycle.
  const inputRef = useRef('');
  const tagsRef = useRef(tags);
  tagsRef.current = tags;
  const composingRef = useRef(false);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [completed, setCompleted] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    anki
      .getAllTags()
      .then(setAllTags)
      .catch(() => setAllTags([]));
  }, []);

  useEffect(() => {
    const q = input.trim();
    if (!q) {
      setCompleted([]);
      return;
    }
    let cancelled = false;
    anki
      .completeTag(q, 12)
      .then((res) => {
        if (!cancelled) setCompleted(res);
      })
      .catch(() => {
        if (!cancelled) setCompleted([]);
      });
    return () => {
      cancelled = true;
    };
  }, [input]);

  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    const existing = new Set(tags);
    const merged = new Set<string>(completed);
    for (const t of allTags) {
      if (!q || t.toLowerCase().includes(q)) {
        merged.add(t);
      }
      if (merged.size >= 12) break;
    }
    return Array.from(merged)
      .filter((t) => !existing.has(t))
      .slice(0, 12);
  }, [input, completed, allTags, tags]);

  const updateInput = (text: string) => {
    inputRef.current = text;
    setInput(text);
  };

  const commit = (added: string[]): string[] => {
    const next = mergeTags(tagsRef.current, added);
    if (next.length !== tagsRef.current.length) {
      tagsRef.current = next;
      onChange(next);
    }
    return next;
  };

  const addTag = (raw: string) => {
    const parts = raw.split(TAG_SEPARATORS).map((s) => s.trim()).filter(Boolean);
    updateInput('');
    if (parts.length > 0) commit(parts);
  };

  /** Commits complete pieces as soon as a separator is typed (works for keyCode 229 keyboards). */
  const handleInputText = (text: string) => {
    if (composingRef.current) {
      updateInput(text);
      return;
    }
    const { complete, rest } = splitTagInput(text);
    updateInput(rest);
    if (complete.length > 0) commit(complete);
  };

  useImperativeHandle(ref, () => ({
    flush() {
      const pending = inputRef.current.trim();
      if (!pending) return tagsRef.current;
      updateInput('');
      return commit(pending.split(TAG_SEPARATORS).filter(Boolean));
    },
  }));

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || composingRef.current || e.keyCode === 229) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === ',') {
      if (input.trim()) {
        e.preventDefault();
        addTag(input);
      }
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      e.preventDefault();
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div className="amgi-tag-box">
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--text-2)',
        }}
      >
        태그
      </div>

      <div className="amgi-tag-chips">
        {tags.map((tag) => (
          <span key={tag} className="amgi-tag-chip">
            <span>{tag}</span>
            <button
              type="button"
              className="amgi-tag-chip-remove"
              aria-label={`${tag} 태그 제거`}
              onClick={() => removeTag(tag)}
            >
              <IconClose size={14} />
            </button>
          </span>
        ))}
        <input
          type="text"
          className="amgi-tag-input"
          placeholder="태그 입력 후 Enter 또는 스페이스..."
          value={input}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            if (!composingRef.current && inputRef.current.trim()) addTag(inputRef.current);
            window.setTimeout(() => setFocused(false), 160);
          }}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={(e) => {
            composingRef.current = false;
            handleInputText(e.currentTarget.value);
          }}
          onChange={(e) => handleInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="태그 입력"
        />
      </div>

      {(focused || input.trim().length > 0) && suggestions.length > 0 && (
        <div className="amgi-tag-suggestions" role="listbox" aria-label="태그 추천">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              role="option"
              aria-selected={false}
              className="amgi-tag-suggestion-item"
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(s);
              }}
              onClick={() => addTag(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
