#!/usr/bin/env python3
import argparse
import os
from typing import List


def escape_pdf_text(s: str) -> str:
    return s.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')


def encode_pdf_latin1(s: str) -> bytes:
    # Keep builds resilient if input contains non-Latin-1 characters.
    return s.encode("latin-1", errors="replace")


def split_pages(lines: List[str], max_lines: int) -> List[List[str]]:
    if not lines:
        return [[]]
    return [lines[i:i + max_lines] for i in range(0, len(lines), max_lines)]


def build_pdf(lines: List[str]) -> bytes:
    # US Letter portrait in points.
    width, height = 612, 792
    margin_left = 72
    top = 720
    line_height = 16
    max_lines = 40

    pages = split_pages(lines, max_lines)
    objects = []

    objects.append("<< /Type /Catalog /Pages 2 0 R >>")

    # First page object starts at 5 because we define:
    # 1 Catalog, 2 Pages, 3 Helvetica, 4 Helvetica-Bold.
    kids = " ".join(f"{5 + i * 2} 0 R" for i in range(len(pages)))
    objects.append(f"<< /Type /Pages /Kids [{kids}] /Count {len(pages)} >>")

    objects.append("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    objects.append("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")

    for i, page_lines in enumerate(pages):
        page_obj = 5 + i * 2
        content_obj = page_obj + 1
        objects.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {width} {height}] "
            f"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {content_obj} 0 R >>"
        )

        content_parts = ["BT"]
        y = top
        for line_idx, line in enumerate(page_lines):
            text = line
            if i == 0 and line_idx == 0:
                # Allow markdown-style headings in the source text file.
                text = text.lstrip("#").strip()
                content_parts.append("/F2 18 Tf")
            else:
                content_parts.append("/F1 12 Tf")
            content_parts.append(f"1 0 0 1 {margin_left} {y} Tm")
            content_parts.append(f"({escape_pdf_text(text)}) Tj")
            y -= 24 if i == 0 and line_idx == 0 else line_height
        content_parts.append("ET")
        stream = "\n".join(content_parts) + "\n"
        objects.append(f"<< /Length {len(encode_pdf_latin1(stream))} >>\nstream\n{stream}endstream")

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]

    for idx, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{idx} 0 obj\n".encode("ascii"))
        pdf.extend(encode_pdf_latin1(obj))
        pdf.extend(b"\nendobj\n")

    xref_start = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    pdf.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        pdf.extend(f"{off:010d} 00000 n \n".encode("ascii"))

    pdf.extend(
        (
            f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_start}\n%%EOF\n"
        ).encode("ascii")
    )
    return bytes(pdf)


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert plain text to a simple PDF.")
    parser.add_argument("input", help="Path to input .txt file")
    parser.add_argument("output", help="Path to output .pdf file")
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        raw_lines = [line.rstrip("\n") for line in f]

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    pdf_bytes = build_pdf(raw_lines)
    with open(args.output, "wb") as f:
        f.write(pdf_bytes)


if __name__ == "__main__":
    main()
