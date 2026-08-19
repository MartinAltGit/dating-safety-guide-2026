#!/usr/bin/env python3
"""Apply editorial chrome to remaining Date Safely HTML pages."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

ARROW = (
    '<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    'stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
)

NAV = [
    ("index.html", "Guide", "home"),
    ("best-dating-apps-2026.html", "Apps", "apps"),
    ("pricing.html", "Pricing", "pricing"),
    ("how-to-cancel-dating-apps.html", "Cancel", "cancel"),
    ("red-flags.html", "Red flags", "red"),
    ("privacy.html", "Privacy", "privacy"),
]

CURRENT = {
    "index.html": "home",
    "best-dating-apps-2026.html": "apps",
    "pricing.html": "pricing",
    "refund.html": "cancel",
    "red-flags.html": "red",
    "privacy.html": "privacy",
    "ai-companions.html": "home",
    "how-to-spot-fake-profiles.html": "red",
    "dating-app-statistics-2026.html": "apps",
    "how-to-cancel-tinder.html": "cancel",
    "how-to-cancel-bumble.html": "cancel",
    "how-to-cancel-hinge.html": "cancel",
    "how-to-cancel-match.html": "cancel",
    "how-to-cancel-dating-apps.html": "cancel",
    "tinder-refund-guide.html": "cancel",
    "bumble-refund-guide.html": "cancel",
    "delete-tinder-account.html": "cancel",
}

STICKY = {
    "ai-companions.html": "ai-companions-sticky",
    "dating-app-statistics-2026.html": "statistics-sticky",
}

SKIP = {
    "index.html",
    "best-dating-apps-2026.html",
    "how-to-cancel-dating-apps.html",
    "tinder-refund-guide.html",
    "bumble-refund-guide.html",
    "delete-tinder-account.html",
    "fullvideo/index.html",
    "og.html",
}

HEAD_ICONS = """<meta name="theme-color" content="#f3eee6">
<link rel="icon" href="{p}/favicon.svg" type="image/svg+xml">
<link rel="icon" href="{p}/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="{p}/apple-touch-icon.png">
<link rel="manifest" href="{p}/site.webmanifest">"""


def header(current: str, prefix: str) -> str:
    links = []
    for href, label, key in NAV:
        cur = ' aria-current="page"' if key == current else ""
        links.append(f'<a href="{prefix}{href}"{cur}>{label}</a>')
    return f"""<header class="site-header">
  <div class="header-inner">
    <a class="brand" href="{prefix}index.html">
      <span class="mark" aria-hidden="true"></span>
      Date Safely<span class="brand-sub">Guide</span>
    </a>
    <nav class="nav" aria-label="Primary">
      {"".join(links)}
    </nav>
  </div>
</header>"""


def footer(prefix: str) -> str:
    return f"""<footer class="site-footer">
  <div class="wrap">
    <a class="footer-brand" href="{prefix}index.html"><span class="mark" aria-hidden="true"></span> Date Safely</a>
    <p class="age-line">18+ educational guide</p>
    <nav class="footer-nav" aria-label="Footer">
      <a href="{prefix}best-dating-apps-2026.html">Apps</a>
      <a href="{prefix}pricing.html">Pricing</a>
      <a href="{prefix}how-to-cancel-dating-apps.html">Cancel</a>
      <a href="{prefix}refund.html">Refunds</a>
      <a href="{prefix}red-flags.html">Red flags</a>
      <a href="{prefix}privacy.html">Privacy</a>
      <a href="{prefix}ai-companions.html">AI companions</a>
    </nav>
    <p>Some links are partner links. If you sign up through them we may earn a commission, at no extra cost to you. We do not guarantee matches or outcomes. Always review each service’s own terms, pricing, and cancellation policy before paying. This site is for adults 18 and over. Trademarks belong to their owners.</p>
    <p>Last updated: 17 August 2026.</p>
  </div>
</footer>"""


def offer(src: str, title: str | None = None, body: str | None = None) -> str:
    title = title or "Compare dating sites open near you"
    body = body or (
        "Mainstream apps are only part of the market. We also check adult and casual "
        "dating sites that accept new members in your region — including how they bill and how you cancel."
    )
    return f"""<aside class="offer" id="compare">
  <p class="kicker">Partner offer · 18+</p>
  <h2>{title}</h2>
  <p>{body}</p>
  <a class="btn btn-large" href="/go?src={src}" rel="sponsored nofollow noopener" target="_blank">Compare dating sites near you {ARROW}</a>
  <p class="fine">Partner link. We may earn a commission if you sign up; the price you pay does not change. Always read that site’s own terms before you pay.</p>
</aside>"""


def sticky(src: str) -> str:
    return f"""<div class="sticky-cta">
  <a class="btn" href="/go?src={src}" rel="sponsored nofollow noopener" target="_blank">Compare dating sites near you {ARROW}</a>
</div>"""


def cancel_subnav(current: str, prefix: str) -> str:
    items = [
        ("how-to-cancel-dating-apps.html", "Overview", "hub"),
        ("how-to-cancel-tinder.html", "Tinder", "tinder"),
        ("how-to-cancel-bumble.html", "Bumble", "bumble"),
        ("how-to-cancel-hinge.html", "Hinge", "hinge"),
        ("how-to-cancel-match.html", "Match", "match"),
        ("cancel/tinder.html" if prefix == "" else "tinder.html", "More apps", "more"),
    ]
    # For cancel/ folder, point hub to ../how-to-cancel-dating-apps.html
    if prefix == "../":
        items = [
            ("../how-to-cancel-dating-apps.html", "Overview", "hub"),
            ("tinder.html", "Tinder", "tinder"),
            ("bumble.html", "Bumble", "bumble"),
            ("hinge.html", "Hinge", "hinge"),
            ("badoo.html", "Badoo", "badoo"),
            ("refund.html", "Refunds", "refund"),
            ("stop-charges.html", "Stop charges", "stop"),
        ]
    links = []
    for href, label, key in items:
        cur = ' aria-current="page"' if key == current else ""
        links.append(f'<a href="{href}"{cur}>{label}</a>')
    return '<nav class="subnav" aria-label="Cancel guides">' + "".join(links) + "</nav>"


def restyle(path: Path) -> None:
    rel = str(path.relative_to(ROOT)).replace("\\", "/")
    if rel in SKIP or path.name == "og.html":
        return
    text = path.read_text(encoding="utf-8")
    in_cancel = rel.startswith("cancel/")
    prefix = "../" if in_cancel else ""
    current = "cancel" if in_cancel else CURRENT.get(path.name, "home")
    p_abs = "" if in_cancel else ""
    icon_prefix = ".." if in_cancel else ""

    text = re.sub(
        r'<link rel="preconnect" href="https://fonts\.googleapis\.com">\s*',
        "",
        text,
    )
    text = re.sub(
        r'<link rel="preconnect" href="https://fonts\.gstatic.com"[^>]*>\s*',
        "",
        text,
    )
    text = re.sub(
        r'<link href="https://fonts\.googleapis\.com/css2\?[^"]+" rel="stylesheet">\s*',
        "",
        text,
    )

    if 'name="theme-color"' not in text:
        text = text.replace(
            '<link rel="canonical"',
            HEAD_ICONS.format(p=icon_prefix if icon_prefix else "") + "\n<link rel=\"canonical\"",
            1,
        )
        # empty prefix produced "/favicon" wait - p="" gives href="/favicon" if I use {p}/ 
        # I used {p}/favicon - if p is "" that's "/favicon" which is correct for root
        # if p is ".." that's "../favicon" correct for cancel
        pass

    # Fix double slash if p is empty: href="/favicon is actually href="/favicon when format p="" -> "/favicon.svg" 
    # HEAD_ICONS has href="{p}/favicon.svg" with p="" -> href="/favicon.svg" YES good
    # with p=".." -> href="../favicon.svg" good

    if in_cancel:
        text = text.replace('href="/favicon', 'href="../favicon')
        text = text.replace('href="/apple-touch', 'href="../apple-touch')
        text = text.replace('href="/site.webmanifest', 'href="../site.webmanifest')
        text = text.replace(
            '<meta property="og:image" content="https://www.datesafelyguide.com/og-image.png">',
            '<meta property="og:image" content="https://www.datesafelyguide.com/og-image.png">',
        )
        if 'og:image' not in text:
            text = text.replace(
                '<meta name="twitter:card"',
                '<meta property="og:image" content="https://www.datesafelyguide.com/og-image.png">\n<meta name="twitter:card"',
                1,
            )

    if "site.js" not in text:
        text = text.replace(
            "</head>",
            '<script defer src="' + prefix + 'site.js"></script>\n</head>',
            1,
        )

    text = re.sub(
        r'<div id="agegate"[\s\S]*?</div>\s*</div>\s*',
        "",
        text,
        count=1,
    )

    text = re.sub(
        r"<header class=\"site-header\"[\s\S]*?</header>",
        header(current, prefix),
        text,
        count=1,
    )

    # body class
    if path.name in STICKY:
        text = re.sub(r"<body[^>]*>", '<body class="has-sticky">', text, count=1)
    else:
        text = re.sub(r"<body[^>]*>", "<body>", text, count=1)

    def repl_cta(m: re.Match) -> str:
        src = m.group(1)
        if path.name in ("refund.html",) or in_cancel or path.name.startswith("how-to-cancel"):
            if in_cancel or path.name.startswith("how-to-cancel"):
                return offer(
                    src,
                    title="Looking for a different kind of dating?",
                    body="If you cancelled because the app was a poor fit, compare adult and casual dating sites that take new members where you live — and check how they bill before you pay again.",
                )
            return (
                '<div class="note"><h3>Prevention beats refunds</h3>'
                f"<p>Set a reminder two days before renewal. Cancel in the store, not by deleting the app. "
                f'<a href="{prefix}how-to-cancel-dating-apps.html">Cancel hub</a> · '
                f'<a href="{prefix}pricing.html">Pricing checklist</a>.</p></div>'
            )
        return offer(src)

    text = re.sub(
        r'<div class="card" style="text-align:\s*center;?\s*padding:var\(--space-2xl\);?">[\s\S]*?href="/go\?src=([^"]+)"[\s\S]*?</div>',
        repl_cta,
        text,
        count=1,
    )

    # leftover generic cta links (hero etc)
    text = re.sub(
        r">See Services Available in Your Region\s*<",
        ">Compare dating sites near you <",
        text,
    )
    text = re.sub(
        r">See Services in Your Region\s*(?:→)?\s*<",
        ">Compare dating sites near you <",
        text,
    )
    text = re.sub(
        r">See Dating Services in Your Region\s*(?:→)?\s*<",
        ">Compare dating sites near you <",
        text,
    )
    text = re.sub(
        r">View Recommended Services\s*<",
        ">Compare dating sites near you <",
        text,
    )

    def faq_repl(m: re.Match) -> str:
        q = re.sub(r"\s+", " ", m.group(1)).strip()
        a = re.sub(r"\s+", " ", m.group(2)).strip()
        return f'<details class="faq">\n      <summary>{q}</summary>\n      <p>{a}</p>\n    </details>'

    text = re.sub(
        r'<div class="faq-item">\s*<div class="faq-question"[^>]*>\s*(.*?)\s*<span class="icon">\+</span>\s*</div>\s*<div class="faq-answer">\s*([\s\S]*?)\s*</div>\s*</div>',
        faq_repl,
        text,
    )

    text = re.sub(
        r"<footer[\s\S]*?</footer>",
        footer(prefix),
        text,
        count=1,
    )

    text = re.sub(
        r'<!-- Sticky CTA[\s\S]*?<div class="sticky-cta">[\s\S]*?</div>',
        sticky(STICKY[path.name]) if path.name in STICKY else "",
        text,
        count=1,
    )
    # cancel pages may have no sticky comment
    if path.name in STICKY and 'class="sticky-cta"' not in text:
        text = text.replace("</body>", sticky(STICKY[path.name]) + "\n</body>")

    text = re.sub(
        r"<script>\s*\(function\(\)\{\s*try\{if\(localStorage\.getItem\('ageOk'\)[\s\S]*?</script>\s*",
        "",
        text,
    )
    text = re.sub(
        r"<script>\s*function toggleFAQ[\s\S]*?</script>\s*",
        "",
        text,
    )
    text = re.sub(
        r"<script>\s*\(function\(\)\{\s*try\{\s*var m = location\.search\.match[\s\S]*?</script>\s*",
        "",
        text,
    )

    # Fix broken related links
    text = text.replace("how-to-cancel-dating-apps.html", prefix + "how-to-cancel-dating-apps.html" if in_cancel and "how-to-cancel-dating-apps.html" in text else "how-to-cancel-dating-apps.html")
    if not in_cancel:
        text = text.replace('href="tinder-refund-guide.html"', 'href="tinder-refund-guide.html"')
        text = text.replace(
            "https://dating-safety-guide.vercel.app/",
            "https://www.datesafelyguide.com/",
        )

    if in_cancel:
        text = text.replace(
            "https://dating-safety-guide.vercel.app/",
            "https://www.datesafelyguide.com/",
        )
        text = re.sub(
            r'href="https://www\.datesafelyguide\.com/pricing\.html\?ref=[^"]+"',
            'href="../pricing.html"',
            text,
        )
        # insert subnav after <article> or after first badge/h1 block
        key = {
            "index.html": "hub",
            "tinder.html": "tinder",
            "bumble.html": "bumble",
            "hinge.html": "hinge",
            "badoo.html": "badoo",
            "refund.html": "refund",
            "stop-charges.html": "stop",
            "faq.html": "hub",
            "pricing.html": "hub",
        }.get(path.name, "hub")
        if 'class="subnav"' not in text:
            text = text.replace(
                "<article>",
                "<article>\n" + cancel_subnav(key, "../"),
                1,
            )

    # cards wrapping only linkcards -> add links class
    text = re.sub(
        r'<div class="card">\s*(<a class="linkcard")',
        r'<div class="card links">\n      \1',
        text,
    )

    path.write_text(text, encoding="utf-8")
    print("updated", rel)


def main() -> None:
    files = list(ROOT.glob("*.html")) + list((ROOT / "cancel").glob("*.html"))
    for f in sorted(files):
        restyle(f)


if __name__ == "__main__":
    main()
