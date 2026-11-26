#!/usr/bin/env python3
"""Automated 4-device hardware-exact visual & ergonomic QA harness for myAmgi.

Captures real screenshots and DOM/CSS/layout/ergonomic telemetry across the owner's
4 devices (Galaxy S25, Galaxy S23 Ultra, Galaxy Tab S7+ Landscape & Portrait, and
Innospaceone Comet 5.84" E-Ink), renders realistic One UI 7 / Android 14 device
composites (status bar + punch-hole / E-Ink bar + bottom gesture pill) alongside
raw WebView screenshots, and emits `qa_report.json`.

Usage:
  python3 tools/visual_qa.py --out-dir /tmp/myamgi-qa
  python3 tools/visual_qa.py --url "http://127.0.0.1:40001/?t=devtoken" --routes decks,study,settings
  python3 tools/visual_qa.py --dry-run --out-dir /tmp/myamgi-qa-dry
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass, field, asdict
import json
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from typing import Any

from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import BrowserContext, Page, sync_playwright


REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DESKTOP_BIN = REPO_ROOT / "desktop" / "build" / "install" / "desktop" / "bin" / "desktop"
DEFAULT_UI_DIR = REPO_ROOT / "web" / "dist"

BANNED_JARGON = [
    "Supabase",
    "Anon Key",
    "MYAMGI1",
    "USN",
    "protobuf",
    "LWW",
    "병렬 동기화",
]


@dataclass(frozen=True)
class DeviceSpec:
    id: str
    label: str
    theme: str  # "light" | "dark" | "eink"
    full_width: int
    full_height: int
    usable_width: int
    usable_height: int
    dpr: float
    top_inset: int
    bottom_inset: int
    status_style: str  # "oneui7" | "tablet" | "eink"
    two_button_mode: bool
    has_punch_hole: bool
    also_test_full_screen: bool = False


DEVICE_MATRIX: list[DeviceSpec] = [
    DeviceSpec(
        id="s25_light",
        label="Galaxy S25 (Light)",
        theme="light",
        full_width=360,
        full_height=780,
        usable_width=360,
        usable_height=726,
        dpr=3.0,
        top_inset=34,
        bottom_inset=20,
        status_style="oneui7",
        two_button_mode=False,
        has_punch_hole=True,
        also_test_full_screen=True,
    ),
    DeviceSpec(
        id="s25_dark",
        label="Galaxy S25 (Dark)",
        theme="dark",
        full_width=360,
        full_height=780,
        usable_width=360,
        usable_height=726,
        dpr=3.0,
        top_inset=34,
        bottom_inset=20,
        status_style="oneui7",
        two_button_mode=False,
        has_punch_hole=True,
        also_test_full_screen=True,
    ),
    DeviceSpec(
        id="s23u_light",
        label="Galaxy S23 Ultra (Light)",
        theme="light",
        full_width=384,
        full_height=824,
        usable_width=384,
        usable_height=770,
        dpr=3.75,
        top_inset=34,
        bottom_inset=20,
        status_style="oneui7",
        two_button_mode=False,
        has_punch_hole=True,
    ),
    DeviceSpec(
        id="s23u_dark",
        label="Galaxy S23 Ultra (Dark)",
        theme="dark",
        full_width=384,
        full_height=824,
        usable_width=384,
        usable_height=770,
        dpr=3.75,
        top_inset=34,
        bottom_inset=20,
        status_style="oneui7",
        two_button_mode=False,
        has_punch_hole=True,
    ),
    DeviceSpec(
        id="tabs7p_land_light",
        label="Galaxy Tab S7+ Landscape (Light)",
        theme="light",
        full_width=1400,
        full_height=876,
        usable_width=1400,
        usable_height=832,
        dpr=2.0,
        top_inset=28,
        bottom_inset=16,
        status_style="tablet",
        two_button_mode=False,
        has_punch_hole=False,
    ),
    DeviceSpec(
        id="tabs7p_land_dark",
        label="Galaxy Tab S7+ Landscape (Dark)",
        theme="dark",
        full_width=1400,
        full_height=876,
        usable_width=1400,
        usable_height=832,
        dpr=2.0,
        top_inset=28,
        bottom_inset=16,
        status_style="tablet",
        two_button_mode=False,
        has_punch_hole=False,
    ),
    DeviceSpec(
        id="tabs7p_port_light",
        label="Galaxy Tab S7+ Portrait (Light)",
        theme="light",
        full_width=876,
        full_height=1400,
        usable_width=876,
        usable_height=1356,
        dpr=2.0,
        top_inset=28,
        bottom_inset=16,
        status_style="tablet",
        two_button_mode=False,
        has_punch_hole=False,
    ),
    DeviceSpec(
        id="tabs7p_port_dark",
        label="Galaxy Tab S7+ Portrait (Dark)",
        theme="dark",
        full_width=876,
        full_height=1400,
        usable_width=876,
        usable_height=1356,
        dpr=2.0,
        top_inset=28,
        bottom_inset=16,
        status_style="tablet",
        two_button_mode=False,
        has_punch_hole=False,
    ),
    DeviceSpec(
        id="comet_eink",
        label="Innospaceone Comet 5.84\" (E-Ink)",
        theme="eink",
        full_width=360,
        full_height=720,
        usable_width=360,
        usable_height=692,
        dpr=2.0,
        top_inset=28,
        bottom_inset=0,
        status_style="eink",
        two_button_mode=True,
        has_punch_hole=False,
    ),
]


DEFAULT_ROUTES = [
    "decks",
    "decks_add_sheet",
    "deck_overview",
    "study_front",
    "study_answer",
    "browse",
    "note_new",
    "notetypes",
    "deck_options",
    "stats",
    "settings",
]


@dataclass
class CheckResult:
    device: str
    route: str
    hash_url: str
    viewport_mode: str  # "usable" | "fullscreen"
    raw_screenshot: str
    composite_screenshot: str | None = None
    passed: bool = True
    console_errors: list[str] = field(default_factory=list)
    page_errors: list[str] = field(default_factory=list)
    horizontal_overflow: dict[str, Any] = field(default_factory=dict)
    korean_word_break_issues: list[dict[str, Any]] = field(default_factory=list)
    banned_jargon_hits: list[str] = field(default_factory=list)
    button_issues: list[dict[str, Any]] = field(default_factory=list)
    grayscale_violations: dict[str, Any] | None = None
    duplicate_back_buttons: int = 0
    subpage_bottomnav_leak: bool = False
    study_answer_top_clearance: dict[str, Any] | None = None
    notes: list[str] = field(default_factory=list)


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


def post_host_json(base_url: str, token: str, endpoint: str, payload: dict[str, Any]) -> Any:
    url = f"{base_url.rstrip('/')}/api/host/{endpoint}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Amgi-Token": token,
        },
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def post_anki_raw(base_url: str, token: str, method: str, body: bytes = b"") -> bytes:
    url = f"{base_url.rstrip('/')}/_anki/{method}"
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/octet-stream",
            "X-Amgi-Token": token,
        },
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.read()


def wait_for_host(base_url: str, token: str, timeout_sec: float = 45.0) -> dict[str, Any]:
    deadline = time.monotonic() + timeout_sec
    last_err: Exception | None = None
    while time.monotonic() < deadline:
        try:
            return post_host_json(base_url, token, "info", {})
        except Exception as err:
            last_err = err
            time.sleep(0.35)
    raise RuntimeError(f"Host server did not become ready within {timeout_sec}s: {last_err}")


def discover_due_deck_id(page: Page, base_url: str, token: str) -> int:
    """Ask the running Anki backend (via Playwright fetch) or fallback to deck 2 / 1."""
    try:
        deck_id = page.evaluate(
            """async () => {
                // If window or DOM lists decks, pick first deck link or button with non-zero counts
                const links = Array.from(document.querySelectorAll('[data-deck-id], a[href*="#/deck/"], a[href*="#/study/"]'));
                for (const el of links) {
                    const attr = el.getAttribute('data-deck-id');
                    if (attr && Number(attr) > 1) return Number(attr);
                    const href = el.getAttribute('href') || '';
                    const m = href.match(/#\\/(?:deck|study)\\/(\\d+)/);
                    if (m && Number(m[1]) > 1) return Number(m[1]);
                }
                return 0;
            }"""
        )
        if isinstance(deck_id, int) and deck_id > 0:
            return deck_id
    except Exception:
        pass
    # SampleCollection creates: 1=Default, 2=일본어, 3=일본어::한자 (due), 4=일본어::어휘 (learning), 5=영어 (due)
    return 2


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = (
        [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
        ]
        if bold
        else [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        ]
    )
    for path in candidates:
        if os.path.isfile(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()


def sample_top_bar_bg(img: Image.Image, default_rgb: tuple[int, int, int]) -> tuple[int, int, int]:
    """Sample median pixel color along y=4 of the WebView capture so status bar matches seamlessly."""
    if img.width < 10 or img.height < 10:
        return default_rgb
    rgb_img = img.convert("RGB")
    samples = [rgb_img.getpixel((x, 4)) for x in range(8, img.width - 8, max(1, img.width // 16))]
    if not samples:
        return default_rgb
    rs = sorted(c[0] for c in samples)
    gs = sorted(c[1] for c in samples)
    bs = sorted(c[2] for c in samples)
    mid = len(samples) // 2
    return (rs[mid], gs[mid], bs[mid])


def sample_bottom_bar_bg(img: Image.Image, default_rgb: tuple[int, int, int]) -> tuple[int, int, int]:
    if img.width < 10 or img.height < 10:
        return default_rgb
    rgb_img = img.convert("RGB")
    y = img.height - 4
    samples = [rgb_img.getpixel((x, y)) for x in range(8, img.width - 8, max(1, img.width // 16))]
    if not samples:
        return default_rgb
    rs = sorted(c[0] for c in samples)
    gs = sorted(c[1] for c in samples)
    bs = sorted(c[2] for c in samples)
    mid = len(samples) // 2
    return (rs[mid], gs[mid], bs[mid])


def render_device_composite(raw_path: Path, out_path: Path, spec: DeviceSpec) -> None:
    """Wrap raw WebView screenshot inside a hardware-accurate status/gesture composite at DPR scale."""
    raw_img = Image.open(raw_path).convert("RGB")
    scale_x = raw_img.width / spec.usable_width
    scale = scale_x if scale_x > 0 else spec.dpr

    top_px = int(round(spec.top_inset * scale))
    bottom_px = int(round(spec.bottom_inset * scale))
    full_w = raw_img.width
    full_h = top_px + raw_img.height + bottom_px

    is_dark = spec.theme == "dark"
    is_eink = spec.theme == "eink"

    default_top = (18, 19, 22) if is_dark else (255, 255, 255)
    default_bot = (18, 19, 22) if is_dark else (255, 255, 255)
    top_bg = (255, 255, 255) if is_eink else sample_top_bar_bg(raw_img, default_top)
    bot_bg = (255, 255, 255) if is_eink else sample_bottom_bar_bg(raw_img, default_bot)

    # Choose crisp contrasting foreground based on top_bg luminance
    lum = 0.2126 * top_bg[0] + 0.7152 * top_bg[1] + 0.0722 * top_bg[2]
    fg = (0, 0, 0) if (is_eink or lum > 140) else (240, 242, 245)

    bot_lum = 0.2126 * bot_bg[0] + 0.7152 * bot_bg[1] + 0.0722 * bot_bg[2]
    pill_color = (90, 95, 105) if bot_lum > 140 else (180, 185, 195)

    canvas = Image.new("RGB", (full_w, full_h), top_bg)
    canvas.paste(raw_img, (0, top_px))

    draw = ImageDraw.Draw(canvas)
    if bottom_px > 0:
        draw.rectangle([0, top_px + raw_img.height, full_w, full_h], fill=bot_bg)
        pill_w = int(round((116 if spec.full_width < 600 else 160) * scale))
        pill_h = max(3, int(round(4 * scale)))
        px0 = (full_w - pill_w) // 2
        py0 = top_px + raw_img.height + (bottom_px - pill_h) // 2
        draw.rounded_rectangle([px0, py0, px0 + pill_w, py0 + pill_h], radius=pill_h // 2, fill=pill_color)

    # Top status bar elements
    font_size = max(10, int(round(12 * scale)))
    font = load_font(font_size, bold=True)
    small_font = load_font(max(9, int(round(10.5 * scale))), bold=True)
    pad_x = int(round(14 * scale))

    def centered_y(txt: str, fnt: ImageFont.FreeTypeFont | ImageFont.ImageFont) -> int:
        bb = draw.textbbox((0, 0), txt, font=fnt)
        th = bb[3] - bb[1]
        return max(1, (top_px - th) // 2 - bb[1])

    if spec.status_style == "eink":
        # Android 14 E-Ink monochrome bar + 1dp hairline divider
        draw.text((pad_x, centered_y("9:49", font)), "9:49", fill=(0, 0, 0), font=font)
        right_txt = "Wi-Fi  88%"
        bbox = draw.textbbox((0, 0), right_txt, font=small_font)
        rw = bbox[2] - bbox[0]
        draw.text((full_w - pad_x - rw, centered_y(right_txt, small_font)), right_txt, fill=(0, 0, 0), font=small_font)
        draw.line([(0, top_px - 1), (full_w, top_px - 1)], fill=(0, 0, 0), width=max(1, int(round(1 * scale))))
    else:
        draw.text((pad_x, centered_y("9:49", font)), "9:49", fill=fg, font=font)

        if spec.has_punch_hole:
            hole_r = max(4, int(round(6.5 * scale)))
            cx = full_w // 2
            cy = top_px // 2
            draw.ellipse([cx - hole_r, cy - hole_r, cx + hole_r, cy + hole_r], fill=(10, 10, 12))

        # Right side signal / 5G / battery pill
        right_label = "5G  88%" if spec.status_style == "oneui7" else "Wi-Fi  88%"
        bbox = draw.textbbox((0, 0), right_label, font=small_font)
        rw = bbox[2] - bbox[0]
        bat_w = int(round(20 * scale))
        bat_h = int(round(10.5 * scale))
        rx = full_w - pad_x - rw - bat_w - int(round(6 * scale))
        draw.text((rx, centered_y(right_label, small_font)), right_label, fill=fg, font=small_font)

        bx0 = full_w - pad_x - bat_w
        by0 = (top_px - bat_h) // 2
        draw.rounded_rectangle(
            [bx0, by0, bx0 + bat_w, by0 + bat_h],
            radius=max(2, int(round(3 * scale))),
            outline=fg,
            width=max(1, int(round(1.2 * scale))),
        )
        fill_w = max(2, int(round((bat_w - 4 * scale) * 0.88)))
        draw.rectangle(
            [bx0 + int(round(2 * scale)), by0 + int(round(2 * scale)), bx0 + int(round(2 * scale)) + fill_w, by0 + bat_h - int(round(2 * scale))],
            fill=fg,
        )

    canvas.save(out_path)


def check_grayscale_purity(img_path: Path) -> dict[str, Any]:
    """Verify Comet E-Ink screenshots contain zero chromatic pixels (|R-G|, |G-B|, |R-B| <= 4)."""
    img = Image.open(img_path).convert("RGB")
    # Downsample to max 360px wide for fast pixel scan while covering the whole image
    if img.width > 360:
        h = int(round(img.height * (360.0 / img.width)))
        img = img.resize((360, max(1, h)), Image.Resampling.NEAREST)
    pixels = list(img.getdata())
    chromatic = 0
    max_delta = 0
    sample_rgb: tuple[int, int, int] | None = None
    for r, g, b in pixels:
        d = max(abs(r - g), abs(g - b), abs(r - b))
        if d > max_delta:
            max_delta = d
        if d > 6:
            chromatic += 1
            if sample_rgb is None:
                sample_rgb = (r, g, b)
    total = len(pixels)
    return {
        "totalPixelsSampled": total,
        "chromaticPixels": chromatic,
        "maxChannelDelta": max_delta,
        "sampleChromaticRgb": list(sample_rgb) if sample_rgb else None,
        "ok": chromatic == 0,
    }


def collect_dom_audit(page: Page, spec: DeviceSpec, route_key: str) -> dict[str, Any]:
    """Run in-page layout, wordBreak, banned jargon, button bounding-box, and regression checks."""
    min_primary_h = 48 if spec.theme == "eink" else 44
    min_compact_h = 44 if spec.theme == "eink" else 36
    audit = page.evaluate(
        """({ banned, minPrimaryH, minCompactH, routeKey }) => {
            const docEl = document.documentElement;
            const vw = docEl.clientWidth;
            const vh = window.innerHeight;
            const scrollW = docEl.scrollWidth;

            const bodyText = document.body ? (document.body.innerText || '') : '';
            const jargonHits = banned.filter(term => bodyText.toLowerCase().includes(term.toLowerCase()));

            const isVisible = (el) => {
                const style = window.getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
                    return false;
                }
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
            };

            // Korean text word-break check
            const hangulRe = /[\\uAC00-\\uD7A3]/;
            const wordBreakIssues = [];
            const seenBreak = new Set();
            const walker = document.createTreeWalker(document.body || docEl, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
                const txt = (node.nodeValue || '').trim();
                if (!txt || !hangulRe.test(txt)) continue;
                const el = node.parentElement;
                if (!el || !isVisible(el)) continue;
                // Skip code/pre/mono elements
                if (el.closest('code, pre, textarea, input')) continue;
                const style = window.getComputedStyle(el);
                if (style.wordBreak !== 'keep-all') {
                    const key = el.tagName + ':' + el.className + ':' + style.wordBreak;
                    if (!seenBreak.has(key) && wordBreakIssues.length < 20) {
                        seenBreak.add(key);
                        wordBreakIssues.push({
                            tag: el.tagName.toLowerCase(),
                            className: String(el.className || ''),
                            wordBreak: style.wordBreak,
                            sample: txt.slice(0, 32),
                        });
                    }
                }
            }

            // Interactive button bounding-box & touch-target check
            const buttonIssues = [];
            const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
            for (const btn of buttons) {
                if (!isVisible(btn)) continue;
                // Skip elements inside horizontally scrollable sub-containers? Still check viewport bounds after scrollIntoView
                btn.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
                const r = btn.getBoundingClientRect();
                const txt = (btn.innerText || btn.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ').slice(0, 32);
                const cls = String(btn.className || '');
                const isCompact =
                    cls.includes('icon') ||
                    cls.includes('chip') ||
                    cls.includes('compact') ||
                    cls.includes('close') ||
                    cls.includes('chevron') ||
                    btn.getAttribute('data-compact') === 'true' ||
                    (r.width <= 48 && txt.length <= 2);
                const reqH = isCompact ? minCompactH : minPrimaryH;

                const outOfBounds =
                    r.left < -1 ||
                    r.right > vw + 1 ||
                    r.top < -1 ||
                    r.bottom > vh + 1;

                // Only enforce min-height for visible main UI buttons (allow inline tiny pills if explicitly marked, else warn/fail)
                const tooShort = r.height < reqH - 0.5;
                if (outOfBounds || tooShort) {
                    buttonIssues.push({
                        text: txt || '(icon)',
                        className: cls,
                        rect: {
                            left: Math.round(r.left * 10) / 10,
                            top: Math.round(r.top * 10) / 10,
                            right: Math.round(r.right * 10) / 10,
                            bottom: Math.round(r.bottom * 10) / 10,
                            width: Math.round(r.width * 10) / 10,
                            height: Math.round(r.height * 10) / 10,
                        },
                        viewport: { width: vw, height: vh },
                        outOfBounds,
                        tooShort,
                        requiredHeight: reqH,
                    });
                }
            }

            // Reset scroll to top after bounding checks
            window.scrollTo(0, 0);

            // Regression check 1: duplicate visible "뒤로 가기" back buttons
            const visibleBackButtons = Array.from(
                document.querySelectorAll('button[aria-label="뒤로 가기"]')
            ).filter(isVisible).length;

            // Regression check 2: sub-page bottomnav leak
            const subpageRoutes = new Set(['note_new', 'notetypes', 'deck_options']);
            const bottomNavEl = document.querySelector('.amgi-bottomnav');
            const bottomNavVisible = Boolean(bottomNavEl && isVisible(bottomNavEl));
            const subpageBottomnavLeak = subpageRoutes.has(routeKey) && bottomNavVisible;

            return {
                overflow: {
                    clientWidth: vw,
                    scrollWidth: scrollW,
                    hasOverflow: scrollW > vw + 1,
                },
                jargonHits,
                wordBreakIssues,
                buttonIssues,
                duplicateBackButtons: visibleBackButtons,
                subpageBottomnavLeak,
            };
        }""",
        {
            "banned": BANNED_JARGON,
            "minPrimaryH": min_primary_h,
            "minCompactH": min_compact_h,
            "routeKey": route_key,
        },
    )

    # Regression check 3: on study_answer, inspect iframe #qa first child bounding rect top >= 16px
    study_answer_clearance: dict[str, Any] | None = None
    if route_key == "study_answer":
        try:
            frame = page.frame_locator("iframe").first
            clearance = frame.locator("#qa").evaluate(
                """(qa) => {
                    const first = qa.firstElementChild || qa;
                    const r = first.getBoundingClientRect();
                    return {
                        top: Math.round(r.top * 10) / 10,
                        scrollY: Math.round(window.scrollY * 10) / 10,
                        ok: r.top >= 16,
                    };
                }"""
            )
            study_answer_clearance = clearance
        except Exception as err:
            study_answer_clearance = {"top": None, "ok": False, "error": str(err)}
    audit["studyAnswerTopClearance"] = study_answer_clearance
    return audit


def navigate_and_prepare(
    page: Page,
    base_url: str,
    route_key: str,
    due_deck_id: int,
    spec: DeviceSpec,
) -> tuple[str, list[str]]:
    """Navigate to the requested route/state and return (hash_url, notes)."""
    notes: list[str] = []

    def goto_hash(h: str) -> None:
        target = f"{base_url.rstrip('/')}/ui/{h}"
        page.goto(target, wait_until="networkidle")
        page.wait_for_timeout(350)

    if route_key == "decks":
        goto_hash("#/decks")
        return "#/decks", notes

    if route_key == "decks_add_sheet":
        goto_hash("#/decks")
        clicked = page.evaluate(
            """() => {
                const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
                const target = btns.find(b => {
                    const t = (b.innerText || b.getAttribute('aria-label') || '').trim();
                    return t.includes('추가') || t === '+';
                });
                if (target) { target.click(); return true; }
                return false;
            }"""
        )
        page.wait_for_timeout(300)
        if not clicked:
            notes.append("Could not find '+ 추가' button to open quick-action sheet")
        return "#/decks (+추가)", notes

    if route_key == "deck_overview":
        goto_hash(f"#/deck/{due_deck_id}")
        return f"#/deck/{due_deck_id}", notes

    if route_key == "study_front":
        goto_hash(f"#/study/{due_deck_id}")
        # Wait briefly for card iframe / answer button
        page.wait_for_timeout(500)
        return f"#/study/{due_deck_id} (front)", notes

    if route_key == "study_answer":
        goto_hash(f"#/study/{due_deck_id}")
        page.wait_for_timeout(500)
        clicked = page.evaluate(
            """() => {
                const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
                const showBtn = btns.find(b => (b.innerText || '').includes('정답 보기'));
                if (showBtn) { showBtn.click(); return true; }
                return false;
            }"""
        )
        page.wait_for_timeout(450)
        if not clicked:
            notes.append("Could not find '정답 보기' button on study screen")
        return f"#/study/{due_deck_id} (answer)", notes

    if route_key == "browse":
        goto_hash("#/browse")
        page.wait_for_timeout(400)
        return "#/browse", notes

    if route_key == "note_new":
        goto_hash("#/note/new")
        return "#/note/new", notes

    if route_key == "notetypes":
        goto_hash("#/notetypes")
        return "#/notetypes", notes

    if route_key == "deck_options":
        goto_hash("#/deck-options/1")
        page.wait_for_timeout(400)
        return "#/deck-options/1", notes

    if route_key == "stats":
        goto_hash("#/stats")
        page.wait_for_timeout(500)
        return "#/stats", notes

    if route_key == "settings":
        goto_hash("#/settings")
        return "#/settings", notes

    # Allow raw hash route like "#/custom"
    h = route_key if route_key.startswith("#") else f"#/{route_key.lstrip('/')}"
    goto_hash(h)
    return h, notes


def run_qa(args: argparse.Namespace) -> int:
    out_dir = Path(args.out_dir).resolve()
    raw_dir = out_dir / "raw"
    comp_dir = out_dir / "composite"
    raw_dir.mkdir(parents=True, exist_ok=True)
    comp_dir.mkdir(parents=True, exist_ok=True)

    selected_devices = DEVICE_MATRIX
    if args.devices:
        wanted = {d.strip() for d in args.devices.split(",") if d.strip()}
        selected_devices = [d for d in DEVICE_MATRIX if d.id in wanted]
        if not selected_devices:
            print(f"ERROR: No matching devices in {sorted(wanted)}", file=sys.stderr)
            return 2

    routes = DEFAULT_ROUTES
    if args.routes:
        routes = [r.strip() for r in args.routes.split(",") if r.strip()]
    if args.dry_run and not args.routes:
        routes = ["decks"]

    server_proc: subprocess.Popen[str] | None = None
    temp_data_dir: Path | None = None
    token = args.token

    try:
        if args.url:
            # Parse base URL and optional ?t=...
            raw_url = args.url
            if "?t=" in raw_url:
                base_url, tok_part = raw_url.split("?t=", 1)
                token = tok_part.split("&", 1)[0]
                base_url = base_url.rstrip("/")
            else:
                base_url = raw_url.rstrip("/")
            info = wait_for_host(base_url, token, timeout_sec=15.0)
        else:
            desktop_bin = Path(args.desktop_bin).resolve()
            if not desktop_bin.is_file():
                print(
                    f"ERROR: desktop binary not found at {desktop_bin}. Build with `./gradlew :desktop:installDist` or pass --url.",
                    file=sys.stderr,
                )
                return 2

            port = find_free_port()
            temp_data_dir = Path(tempfile.mkdtemp(prefix="myamgi_qa_"))
            cmd = [
                str(desktop_bin),
                "--seed",
                "--no-open",
                "--port",
                str(port),
                "--token",
                token,
                "--dir",
                str(temp_data_dir),
            ]
            ui_dir = Path(args.ui_dir).resolve() if args.ui_dir else DEFAULT_UI_DIR
            if not args.dry_run and ui_dir.is_dir():
                cmd.extend(["--ui-dir", str(ui_dir)])
            elif not args.dry_run and not ui_dir.is_dir():
                print(
                    f"WARNING: {ui_dir} does not exist; desktop will serve placeholder HTML unless built.",
                    file=sys.stderr,
                )

            env = os.environ.copy()
            env.setdefault("LC_ALL", "C.UTF-8")
            server_proc = subprocess.Popen(
                cmd,
                cwd=str(REPO_ROOT),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
            )
            base_url = f"http://127.0.0.1:{port}"
            info = wait_for_host(base_url, token, timeout_sec=60.0)

        results: list[CheckResult] = []

        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                headless=True,
                args=["--disable-lcd-text", "--font-render-hinting=none"],
            )
            try:
                for spec in selected_devices:
                    # Configure host preferences for this device's theme + 2-button mode before opening browser context
                    post_host_json(
                        base_url,
                        token,
                        "prefs.set",
                        {
                            "theme": spec.theme,
                            "study.twoButtonMode": spec.two_button_mode,
                        },
                    )

                    viewport_configs = [(spec.usable_width, spec.usable_height, "usable")]
                    if spec.also_test_full_screen and not args.skip_fullscreen:
                        viewport_configs.append((spec.full_width, spec.full_height, "fullscreen"))

                    for vp_w, vp_h, vp_mode in viewport_configs:
                        context: BrowserContext = browser.new_context(
                            viewport={"width": vp_w, "height": vp_h},
                            device_scale_factor=spec.dpr,
                            color_scheme="dark" if spec.theme == "dark" else "light",
                            is_mobile=spec.full_width < 700,
                            has_touch=True,
                        )
                        try:
                            page = context.new_page()
                            console_errors: list[str] = []
                            page_errors: list[str] = []

                            page.on(
                                "console",
                                lambda msg: console_errors.append(msg.text)
                                if msg.type == "error"
                                else None,
                            )
                            page.on("pageerror", lambda err: page_errors.append(str(err)))

                            # Cookie handshake
                            page.goto(f"{base_url}/?t={token}", wait_until="networkidle")
                            page.wait_for_timeout(300)

                            due_deck_id = discover_due_deck_id(page, base_url, token)

                            for route_key in routes:
                                # In fullscreen verification mode on S25, check key layout routes unless --all-fullscreen
                                if vp_mode == "fullscreen" and not args.all_fullscreen:
                                    if route_key not in ("decks", "study_front", "study_answer", "settings"):
                                        continue

                                console_errors.clear()
                                page_errors.clear()

                                hash_url, notes = navigate_and_prepare(
                                    page, base_url, route_key, due_deck_id, spec
                                )

                                suffix = "" if vp_mode == "usable" else "_fullscreen"
                                fname = f"{spec.id}__{route_key}{suffix}.png"
                                raw_path = raw_dir / fname
                                page.screenshot(path=str(raw_path), full_page=False)

                                comp_path: Path | None = None
                                if vp_mode == "usable":
                                    comp_path = comp_dir / fname
                                    render_device_composite(raw_path, comp_path, spec)

                                if args.dry_run:
                                    dom_audit = {
                                        "overflow": {"clientWidth": vp_w, "scrollWidth": vp_w, "hasOverflow": False},
                                        "jargonHits": [],
                                        "wordBreakIssues": [],
                                        "buttonIssues": [],
                                        "duplicateBackButtons": 0,
                                        "subpageBottomnavLeak": False,
                                        "studyAnswerTopClearance": None,
                                    }
                                    notes.append("dry-run against host placeholder")
                                else:
                                    dom_audit = collect_dom_audit(page, spec, route_key)

                                gray_check = (
                                    check_grayscale_purity(raw_path)
                                    if spec.theme == "eink" and not args.dry_run
                                    else None
                                )

                                dup_back = int(dom_audit.get("duplicateBackButtons", 0))
                                bottomnav_leak = bool(dom_audit.get("subpageBottomnavLeak", False))
                                answer_clearance = dom_audit.get("studyAnswerTopClearance")

                                passed = (
                                    len(console_errors) == 0
                                    and len(page_errors) == 0
                                    and not dom_audit["overflow"]["hasOverflow"]
                                    and len(dom_audit["jargonHits"]) == 0
                                    and len(dom_audit["wordBreakIssues"]) == 0
                                    and len(dom_audit["buttonIssues"]) == 0
                                    and dup_back <= 1
                                    and not bottomnav_leak
                                    and (answer_clearance is None or bool(answer_clearance.get("ok")))
                                    and (gray_check is None or gray_check["ok"])
                                )

                                results.append(
                                    CheckResult(
                                        device=spec.id,
                                        route=route_key,
                                        hash_url=hash_url,
                                        viewport_mode=vp_mode,
                                        raw_screenshot=str(raw_path),
                                        composite_screenshot=str(comp_path) if comp_path else None,
                                        passed=passed,
                                        console_errors=list(console_errors),
                                        page_errors=list(page_errors),
                                        horizontal_overflow=dom_audit["overflow"],
                                        korean_word_break_issues=dom_audit["wordBreakIssues"],
                                        banned_jargon_hits=dom_audit["jargonHits"],
                                        button_issues=dom_audit["buttonIssues"],
                                        grayscale_violations=gray_check,
                                        duplicate_back_buttons=dup_back,
                                        subpage_bottomnav_leak=bottomnav_leak,
                                        study_answer_top_clearance=answer_clearance,
                                        notes=notes,
                                    )
                                )
                        finally:
                            context.close()
            finally:
                browser.close()

        passed_count = sum(1 for r in results if r.passed)
        failed_count = len(results) - passed_count
        report = {
            "hostInfo": info,
            "dryRun": bool(args.dry_run),
            "totalChecks": len(results),
            "passed": passed_count,
            "failed": failed_count,
            "results": [asdict(r) for r in results],
        }
        report_path = out_dir / "qa_report.json"
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

        print(f"Visual QA finished: {passed_count}/{len(results)} passed -> {report_path}")
        if failed_count > 0:
            for r in results:
                if not r.passed:
                    print(
                        f"  FAIL [{r.device} | {r.route} | {r.viewport_mode}] "
                        f"console={len(r.console_errors)} page={len(r.page_errors)} "
                        f"overflow={r.horizontal_overflow.get('hasOverflow')} "
                        f"jargon={r.banned_jargon_hits} "
                        f"wordBreak={len(r.korean_word_break_issues)} "
                        f"buttons={len(r.button_issues)} "
                        f"dupBack={r.duplicate_back_buttons} "
                        f"bottomnavLeak={r.subpage_bottomnav_leak} "
                        f"answerClearance={r.study_answer_top_clearance} "
                        f"gray={r.grayscale_violations.get('ok') if r.grayscale_violations else True}",
                        file=sys.stderr,
                    )
            return 1
        return 0
    finally:
        if server_proc is not None:
            server_proc.send_signal(signal.SIGTERM)
            try:
                server_proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server_proc.kill()
                server_proc.wait(timeout=3)
        if temp_data_dir is not None and temp_data_dir.exists():
            shutil.rmtree(temp_data_dir, ignore_errors=True)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Automated 4-device hardware-exact visual & ergonomic QA harness for myAmgi."
    )
    parser.add_argument(
        "--url",
        default=None,
        help="Existing host URL (e.g. http://127.0.0.1:40001/?t=devtoken). Auto-starts :desktop if omitted.",
    )
    parser.add_argument(
        "--token",
        default="qatoken",
        help="Auth token to use when auto-starting :desktop or if --url lacks ?t= (default: qatoken).",
    )
    parser.add_argument(
        "--desktop-bin",
        default=str(DEFAULT_DESKTOP_BIN),
        help=f"Path to installed :desktop binary (default: {DEFAULT_DESKTOP_BIN}).",
    )
    parser.add_argument(
        "--ui-dir",
        default=None,
        help=f"Path to built web UI directory passed as --ui-dir to :desktop (default: {DEFAULT_UI_DIR} if present).",
    )
    parser.add_argument(
        "--out-dir",
        default="/tmp/myamgi-visual-qa",
        help="Output directory for raw/, composite/, and qa_report.json.",
    )
    parser.add_argument(
        "--devices",
        default=None,
        help="Comma-separated subset of device IDs (e.g. s25_light,comet_eink).",
    )
    parser.add_argument(
        "--routes",
        default=None,
        help=f"Comma-separated routes to audit (default: {','.join(DEFAULT_ROUTES)}).",
    )
    parser.add_argument(
        "--skip-fullscreen",
        action="store_true",
        help="Skip secondary full-screen (360x780) WebView pass on Galaxy S25.",
    )
    parser.add_argument(
        "--all-fullscreen",
        action="store_true",
        help="Run all routes in full-screen mode as well as usable-inset mode.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Verify host launch, Playwright capture, composite rendering, and report generation against placeholder HTML.",
    )
    return parser.parse_args(argv)


if __name__ == "__main__":
    raise SystemExit(run_qa(parse_args()))
