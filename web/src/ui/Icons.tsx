import type { SVGProps } from 'react';

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
  strokeWidth?: number;
}

const baseProps = (size: number, strokeWidth: number, rest: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': rest['aria-label'] ? undefined : true,
  ...rest,
});

export function IconDeck({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <rect x="6" y="4" width="14" height="16" rx="2.5" />
      <path d="M3 8v10a2.5 2.5 0 0 0 2.5 2.5H16" />
      <path d="M10 9h6" />
      <path d="M10 13h4" />
    </svg>
  );
}

export function IconSearch({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.8-3.8" />
    </svg>
  );
}

export function IconStats({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M21 20H3" />
    </svg>
  );
}

export function IconSettings({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.77 1 1.51 1H21a2 2 0 1 1 0 4h-.09c-.74 0-1.25.4-1.51 1Z" />
    </svg>
  );
}

export function IconSync({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="M21 12a9 9 0 0 0-15.5-6.36L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 15.5 6.36L21 16" />
      <path d="M21 21v-5h-5" />
    </svg>
  );
}

export function IconPlus({ size = 20, strokeWidth = 2.0, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function IconChevronRight({ size = 20, strokeWidth = 2.0, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function IconChevronDown({ size = 20, strokeWidth = 2.0, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function IconArrowLeft({ size = 20, strokeWidth = 2.0, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}

export function IconMore({ size = 20, strokeWidth = 2.0, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <circle cx="12" cy="5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconUndo({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </svg>
  );
}

export function IconRedo({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
    </svg>
  );
}

export function IconFlag({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </svg>
  );
}

export function IconStar({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="m12 3.5 2.65 5.37 5.93.86-4.29 4.18 1.01 5.91L12 17.03l-5.3 2.79 1.01-5.91-4.29-4.18 5.93-.86L12 3.5Z" />
    </svg>
  );
}

export function IconEdit({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  );
}

export function IconPlay({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="M6 4.75a1 1 0 0 1 1.52-.85l11.25 7.25a1 1 0 0 1 0 1.7L7.52 20.1A1 1 0 0 1 6 19.25V4.75Z" />
    </svg>
  );
}

export function IconCheck({ size = 20, strokeWidth = 2.1, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function IconClose({ size = 20, strokeWidth = 2.0, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function IconTrash({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export function IconFolder({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H9l2 2.5h7.5A2.5 2.5 0 0 1 21 9v8.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11Z" />
    </svg>
  );
}

export function IconUpload({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="M12 15V4" />
      <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

export function IconDownload({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="M12 4v11" />
      <path d="m7.5 11.5 4.5 4.5 4.5-4.5" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

export function IconSpark({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="M12 3c.6 4.2 1.8 5.4 6 6-4.2.6-5.4 1.8-6 6-.6-4.2-1.8-5.4-6-6 4.2-.6 5.4-1.8 6-6Z" />
      <path d="M18.5 16c.3 1.7.8 2.2 2.5 2.5-1.7.3-2.2.8-2.5 2.5-.3-1.7-.8-2.2-2.5-2.5 1.7-.3 2.2-.8 2.5-2.5Z" />
    </svg>
  );
}

export function IconFilter({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </svg>
  );
}

export function IconEye({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  );
}

export function IconPin({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="M12 17v5" />
      <path d="M9 4h6l-1 5 3 3v2H7v-2l3-3-1-5Z" />
    </svg>
  );
}

export function IconCode({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="m8 8-4 4 4 4" />
      <path d="m16 8 4 4-4 4" />
      <path d="m13.5 5-3 14" />
    </svg>
  );
}

export function IconImage({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m20.5 15.5-4.5-4.5-6.5 6.5" />
    </svg>
  );
}

export function IconVolume({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 6a8.5 8.5 0 0 1 0 12" />
    </svg>
  );
}

export function IconExternal({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </svg>
  );
}

export function IconCopy({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function IconRefresh({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4" />
      <path d="M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4" />
    </svg>
  );
}

export function IconShield({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="M12 3 5 6v5.5c0 4.6 3 8.2 7 9.5 4-1.3 7-4.9 7-9.5V6l-7-3Z" />
      <path d="m9.5 12 1.8 1.8 3.4-3.6" />
    </svg>
  );
}

export function IconPen({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

export function IconEraser({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
      <path d="M22 21H7" />
      <path d="m5 11 9 9" />
    </svg>
  );
}

export function IconTag({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconFlame({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}

export function IconSidebar({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </svg>
  );
}

export function IconKeyboard({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <rect x="2" y="5" width="20" height="14" rx="2.5" />
      <path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M10 13h.01M14 13h.01M18 13h.01M8 16h8" />
    </svg>
  );
}

export function IconClock({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function IconSun({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

export function IconMoon({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

export function IconBook({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  );
}

export function IconMove({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="M4 7h12M12 3l4 4-4 4" />
      <path d="M20 17H8M12 13l-4 4 4 4" />
    </svg>
  );
}

export function IconSort({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="M3 6h14M3 12h10M3 18h6" />
      <path d="m18 14 2 2 2-2M20 8v8" />
    </svg>
  );
}

export function IconLayers({ size = 20, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, rest)}>
      <path d="m12 2 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </svg>
  );
}

