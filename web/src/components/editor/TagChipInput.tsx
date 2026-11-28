import {
  forwardRef,
  useCallback,
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
  /** Commits any typed-but-uncommitted text into tags and synchronously returns the final list. */
  flush: () => string[];
  /** True when the input box currently holds non-whitespace text not yet committed as a chip. */
  hasPendingInput: () => boolean;
}

function mergeRawTags(current: string[], raw: string): { next: string[]; changed: boolean } {
  const parts = raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return { next: current, changed: false };
  }
  const next = [...current];
  let changed = false;
  for (const p of parts) {
    if (!next.includes(p)) {
      next.push(p);
      changed = true;
    }
  }
  return { next, changed };
}

export const TagChipInput = forwardRef<TagChipInputHandle, TagChipInputProps>(
  function TagChipInput({ tags, onChange }, ref) {
    const [input, setInput] = useState('');
    const [allTags, setAllTags] = useState<string[]>([]);
    const [completed, setCompleted] = useState<string[]>([]);
    const [focused, setFocused] = useState(false);

    const tagsRef = useRef<string[]>(tags);
    tagsRef.current = tags;
    const inputRef = useRef<string>(input);
    inputRef.current = input;
    const domInputRef = useRef<HTMLInputElement | null>(null);
    const isComposingRef = useRef(false);
    const selectingSuggestionRef = useRef(false);
    const completeSeqRef = useRef(0);

    useEffect(() => {
      let cancelled = false;
      anki
        .getAllTags()
        .then((res) => {
          if (!cancelled) setAllTags(res);
        })
        .catch(() => {
          if (!cancelled) setAllTags([]);
        });
      return () => {
        cancelled = true;
      };
    }, []);

    useEffect(() => {
      if (isComposingRef.current) return;
      const q = input.trim();
      if (!q) {
        setCompleted([]);
        return;
      }
      const seq = ++completeSeqRef.current;
      anki
        .completeTag(q, 12)
        .then((res) => {
          if (seq === completeSeqRef.current) setCompleted(res);
        })
        .catch(() => {
          if (seq === completeSeqRef.current) setCompleted([]);
        });
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

    const commitRaw = useCallback(
      (raw: string): string[] => {
        const { next, changed } = mergeRawTags(tagsRef.current, raw);
        inputRef.current = '';
        setInput('');
        if (domInputRef.current && domInputRef.current.value !== '') {
          domInputRef.current.value = '';
        }
        if (changed) {
          tagsRef.current = next;
          onChange(next);
        }
        return next;
      },
      [onChange]
    );

    useImperativeHandle(
      ref,
      () => ({
        flush() {
          const liveRaw = domInputRef.current?.value ?? inputRef.current;
          if (!liveRaw.trim()) {
            return tagsRef.current;
          }
          return commitRaw(liveRaw);
        },
        hasPendingInput() {
          const liveRaw = domInputRef.current?.value ?? inputRef.current;
          return liveRaw.trim().length > 0;
        },
      }),
      [commitRaw]
    );

    useEffect(() => {
      const clearSelection = () => {
        selectingSuggestionRef.current = false;
      };
      window.addEventListener('pointerup', clearSelection);
      window.addEventListener('pointercancel', clearSelection);
      return () => {
        window.removeEventListener('pointerup', clearSelection);
        window.removeEventListener('pointercancel', clearSelection);
      };
    }, []);

    const removeTag = (tag: string) => {
      const next = tagsRef.current.filter((t) => t !== tag);
      tagsRef.current = next;
      onChange(next);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      // Korean IME guard: never intercept keys during active composition
      if (e.nativeEvent.isComposing || e.keyCode === 229 || isComposingRef.current) {
        return;
      }
      if (e.key === 'Enter' || e.key === ' ' || e.key === ',') {
        const liveVal = e.currentTarget.value;
        if (liveVal.trim()) {
          e.preventDefault();
          commitRaw(liveVal);
        } else if (e.key === 'Enter') {
          e.preventDefault();
        }
      } else if (e.key === 'Backspace' && !inputRef.current && tagsRef.current.length > 0) {
        e.preventDefault();
        const next = tagsRef.current.slice(0, -1);
        tagsRef.current = next;
        onChange(next);
      }
    };

    return (
      <div className="amgi-tag-box">
        <div className="amgi-tag-label">태그</div>

        <div className="amgi-tag-chips">
          {tags.map((tag) => (
            <span key={tag} className="amgi-tag-chip">
              <span className="amgi-tag-chip-text">{tag}</span>
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
            ref={domInputRef}
            type="text"
            className="amgi-tag-input"
            placeholder="태그 입력 후 Enter 또는 스페이스..."
            value={input}
            onFocus={() => setFocused(true)}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={(e) => {
              isComposingRef.current = false;
              const val = e.currentTarget.value;
              inputRef.current = val;
              setInput(val);
              // Commit immediately when a trailing delimiter completed the Korean tag
              if (/[\s,]$/.test(val) && val.trim()) {
                commitRaw(val);
              }
            }}
            onBlur={(e) => {
              isComposingRef.current = false;
              const val = e.currentTarget.value;
              if (!selectingSuggestionRef.current && val.trim()) {
                commitRaw(val);
              }
              window.setTimeout(() => {
                selectingSuggestionRef.current = false;
                setFocused(false);
              }, 140);
            }}
            onChange={(e) => {
              const val = e.target.value;
              inputRef.current = val;
              if (!isComposingRef.current && /[\s,]$/.test(val) && val.trim()) {
                commitRaw(val);
                return;
              }
              setInput(val);
            }}
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
                onPointerDown={(e) => {
                  e.preventDefault();
                  selectingSuggestionRef.current = true;
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectingSuggestionRef.current = true;
                }}
                onClick={() => {
                  selectingSuggestionRef.current = false;
                  commitRaw(s);
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
);
