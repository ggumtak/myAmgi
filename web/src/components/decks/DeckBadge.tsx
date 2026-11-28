import type React from 'react';

export type DeckBadgeTone =
  | 'rose'
  | 'blue'
  | 'amber'
  | 'emerald'
  | 'indigo'
  | 'teal'
  | 'slate';

export interface DeckThemeMeta {
  tone: DeckBadgeTone;
  kind: 'jp' | 'en' | 'zh' | 'med' | 'code' | 'exam' | 'cards';
  label: string;
}

const FALLBACK_TONES: readonly DeckBadgeTone[] = [
  'slate',
  'teal',
  'blue',
  'indigo',
  'emerald',
  'amber',
  'rose',
];

function hashDeckRoot(name: string): number {
  let hash = 2166136261;
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Classifies a deck name into a study category and calm architectural accent tone.
 * Unmatched decks deterministically hash their root deck name across muted tones
 * so sibling decks remain visually distinguishable without clashing.
 */
export function resolveDeckTheme(deckName: string): DeckThemeMeta {
  const rootName = deckName.split('::')[0]?.trim() || deckName.trim();
  const s = deckName.toLowerCase();

  if (
    /일본|일어|jlpt|jpt|한자|히라가나|가타카나|japan|kanji|kana|nihongo|[\u3040-\u30ff]/.test(
      s
    )
  ) {
    return { tone: 'rose', kind: 'jp', label: '일본어' };
  }
  if (
    /영어|영단어|영문|회화|toeic|toefl|ielts|teps|voca|english|word|수능|보카|말해/.test(
      s
    )
  ) {
    return { tone: 'blue', kind: 'en', label: '영어' };
  }
  if (/중국|중어|hsk|chinese|mandarin/.test(s)) {
    return { tone: 'amber', kind: 'zh', label: '중국어' };
  }
  if (/의학|의대|해부|약학|간호|생물|병리|해부학|med|bio|anat|pharm/.test(s)) {
    return { tone: 'emerald', kind: 'med', label: '의학·과학' };
  }
  if (/코딩|개발|알고리즘|컴퓨터|프로그래밍|파이썬|자바|리눅스|code|cs|dev|js|ts|sql|aws/.test(s)) {
    return { tone: 'indigo', kind: 'code', label: '개발·CS' };
  }
  if (/시험|자격|법|헌법|민법|형법|경제|금융|회계|세무|한국사|역사|공무원|임용|exam/.test(s)) {
    return { tone: 'teal', kind: 'exam', label: '시험·자격' };
  }

  const rootLower = rootName.toLowerCase();
  if (!rootLower || rootLower === '기본' || rootLower === 'default') {
    return { tone: 'slate', kind: 'cards', label: '암기장' };
  }

  const tone = FALLBACK_TONES[hashDeckRoot(rootLower) % FALLBACK_TONES.length];
  return { tone, kind: 'cards', label: '암기장' };
}

export const DeckCategoryIcon: React.FC<{ deckName: string; size?: number }> = ({
  deckName,
  size = 16,
}) => {
  const { kind } = resolveDeckTheme(deckName);

  switch (kind) {
    case 'jp':
      // Torii gate inspired minimal line emblem
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.95"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 6.5c4.5 1.1 11.5 1.1 16 0" />
          <path d="M5.5 10.5h13" />
          <path d="M8 7v12" />
          <path d="M16 7v12" />
          <path d="M12 7v3.5" />
        </svg>
      );
    case 'en':
      // Speech & alphabet bubble emblem
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.95"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 18l4.5-12L13 18" />
          <path d="M5.8 14h5.4" />
          <circle cx="17.5" cy="14.5" r="3" />
          <path d="M20.5 11.5v6" />
        </svg>
      );
    case 'zh':
      // Classic scroll / character emblem
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.95"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 4v3" />
          <path d="M5 7h14" />
          <path d="M16 7c-1 5-4.5 9.5-10 12" />
          <path d="M8.5 10.5c2 3.5 5.5 6.5 10 8.5" />
        </svg>
      );
    case 'med':
      // Heartbeat pulse emblem
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.95"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 12h4l2.5-6 4 12 2.5-6h5" />
        </svg>
      );
    case 'code':
      // Code chevrons
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.95"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="8 7 3 12 8 17" />
          <polyline points="16 7 21 12 16 17" />
          <line x1="13.5" y1="5" x2="10.5" y2="19" />
        </svg>
      );
    case 'exam':
      // Ribbon award medal
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.95"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="9" r="5" />
          <path d="M8.5 13.5L7 21l5-2.5L17 21l-1.5-7.5" />
        </svg>
      );
    default:
      // Layered flashcards emblem
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.95"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="4" y="6" width="13" height="14" rx="2.5" />
          <path d="M8 6V4.5A2 2 0 0 1 10 2.5h8.5a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2H17" />
          <path d="M8 11h5" />
          <path d="M8 14.5h3.5" />
        </svg>
      );
  }
};

export const DailyProgressRing: React.FC<{
  pct: number;
  done: boolean;
  empty?: boolean;
  size?: number;
}> = ({ pct, done, empty = false, size = 48 }) => {
  const stroke = size <= 48 ? 4 : 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = empty ? 0 : Math.max(0, Math.min(100, pct));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className={`amgi-ring-wrap ${done ? 'is-done' : ''} ${empty ? 'is-empty' : ''}`.trim()}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="amgi-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        {!empty && clamped > 0 && (
          <circle
            className="amgi-ring-fill"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <span className="amgi-ring-label tabular">
        {empty ? '–' : done ? '완료' : `${clamped}%`}
      </span>
    </div>
  );
};

export const CelebrationBadge: React.FC<{ size?: number }> = ({ size = 56 }) => (
  <div className="amgi-celebration-badge" aria-hidden="true">
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 14h24v12a12 12 0 0 1-24 0V14Z" />
      <path d="M20 19h-6a4 4 0 0 0 0 8h6" />
      <path d="M44 19h6a4 4 0 0 1 0 8h-6" />
      <path d="M32 38v10" />
      <path d="M22 48h20" />
      <path d="M26 52h12" />
      <path d="M32 20l1.6 3.2 3.4.5-2.5 2.4.6 3.4L32 27.9l-3.1 1.6.6-3.4-2.5-2.4 3.4-.5L32 20Z" />
    </svg>
  </div>
);

export function getPersonalGreeting(totalDue: number, doneToday: number): string {
  if (totalDue === 0 && doneToday > 0) return '오늘 학습 완료';
  if (totalDue === 0) return '여유로운 하루예요';
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return '가벼운 아침 복습';
  if (hour >= 12 && hour < 18) return '오후 집중 복습';
  if (hour >= 18 && hour < 23) return '오늘 복습 마무리';
  return '고요한 밤 복습';
}
