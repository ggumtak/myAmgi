import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import * as anki from '../../anki';
import { IconClose } from '../../ui';

export interface TagChipInputProps {
  tags: string[];
  onChange: (nextTags: string[]) => void;
}

export function TagChipInput({ tags, onChange }: TagChipInputProps) {
  const [input, setInput] = useState('');
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

  const addTag = (raw: string) => {
    const parts = raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = [...tags];
    for (const p of parts) {
      if (!next.includes(p)) next.push(p);
    }
    onChange(next);
    setInput('');
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
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
            window.setTimeout(() => setFocused(false), 160);
          }}
          onChange={(e) => setInput(e.target.value)}
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
}
