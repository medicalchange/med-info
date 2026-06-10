#!/usr/bin/env python3

from __future__ import annotations

import argparse
import re
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LINK_DIR = ROOT / "aharrismd" / "_interesting_links"


def slugify(value: str) -> str:
    slug = value.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    return slug or "new-link"


def quote(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create a new Medicallinks interesting-links entry."
    )
    parser.add_argument("title", help="Link title shown on the site.")
    parser.add_argument("url", help="Full URL for the article or resource.")
    parser.add_argument(
        "summary",
        nargs="?",
        default="Add one or two sentences on why this is worth reading.",
        help="Short note shown under the link.",
    )
    parser.add_argument(
        "--date",
        default=str(date.today()),
        help="Entry date in YYYY-MM-DD format. Defaults to today.",
    )
    parser.add_argument(
        "--slug",
        help="Optional custom filename slug. Defaults to a slugified title.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    slug = args.slug or slugify(args.title)
    target = LINK_DIR / f"{args.date}-{slug}.md"

    if target.exists():
        raise SystemExit(f"Refusing to overwrite existing file: {target}")

    target.write_text(
        "\n".join(
            [
                "---",
                f'title: "{quote(args.title)}"',
                f"date: {args.date}",
                f'link_url: "{quote(args.url)}"',
                f'summary: "{quote(args.summary)}"',
                "---",
                "",
            ]
        ),
        encoding="utf-8",
    )

    print(target)


if __name__ == "__main__":
    main()
