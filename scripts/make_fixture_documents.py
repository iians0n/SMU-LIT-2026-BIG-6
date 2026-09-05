#!/usr/bin/env python3
"""
Generates the synthetic document corpus in fixtures/documents/.

Every file here exists to trigger a specific FR03 behaviour. The generated
files are committed, so you only need to run this to change them.

Requires (macOS system Python has all three): Pillow, reportlab, PyMuPDF.
    python3 scripts/make_fixture_documents.py

Everything is fictional. Names, amounts, and account numbers are synthetic
(PRD §8: use synthetic documents for the hackathon).
"""

import io
import os
import random
import shutil
import subprocess

import fitz  # PyMuPDF
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "fixtures", "documents")
os.makedirs(OUT, exist_ok=True)

FONTS = {
    "regular": "/System/Library/Fonts/Supplemental/Arial.ttf",
    "bold": "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
}


def font(kind: str, size: int) -> ImageFont.FreeTypeFont:
    path = FONTS[kind]
    if os.path.exists(path):
        return ImageFont.truetype(path, size)
    return ImageFont.load_default(size)


def p(name: str) -> str:
    return os.path.join(OUT, name)


# --------------------------------------------------------------- clean PDF
def make_quote() -> None:
    """Two-page PDF with a real text layer. The happy path: extraction, no OCR."""
    c = canvas.Canvas(p("quote-accepted.pdf"), pagesize=A4)
    w, h = A4

    c.setFont("Helvetica-Bold", 16)
    c.drawString(20 * mm, h - 25 * mm, "PRECISION HOME REPAIRS PTE LTD")
    c.setFont("Helvetica", 9)
    c.drawString(20 * mm, h - 31 * mm, "18 Kaki Bukit Road 3, #05-12, Singapore 417818")
    c.drawString(20 * mm, h - 35 * mm, "UEN 201412345K   ·   Tel 6123 4567")
    c.line(20 * mm, h - 39 * mm, w - 20 * mm, h - 39 * mm)

    c.setFont("Helvetica-Bold", 13)
    c.drawString(20 * mm, h - 52 * mm, "QUOTATION  ·  Ref Q-2026-0418")
    c.setFont("Helvetica", 10)
    c.drawString(20 * mm, h - 60 * mm, "To:      Ms Tan Wei Ling")
    c.drawString(20 * mm, h - 66 * mm, "Address: Blk 210 Ang Mo Kio Ave 3, #08-142, Singapore 560210")
    c.drawString(20 * mm, h - 72 * mm, "Date:    8 June 2026")

    # The scope-and-price line. Excerpt e1 anchors here.
    c.setFont("Helvetica-Bold", 11)
    c.drawString(20 * mm, h - 88 * mm, "Full bathroom waterproofing and re-tiling")
    c.setFont("Helvetica", 10)
    c.drawString(20 * mm, h - 95 * mm, "Hack off existing tiles, apply 2-coat waterproofing membrane,")
    c.drawString(20 * mm, h - 101 * mm, "supply and lay 300x600 ceramic tiles, make good and clear debris.")
    c.setFont("Helvetica-Bold", 12)
    c.drawString(20 * mm, h - 112 * mm, "Total: S$2,000 (inclusive of materials)")

    # The completion date. Excerpt e2 anchors here. This is the fact the chat later disturbs.
    c.setFont("Helvetica", 10)
    c.drawString(20 * mm, h - 128 * mm, "Works to be completed by 15 July 2026.")
    c.drawString(20 * mm, h - 136 * mm, "Payment: full amount on acceptance of this quotation.")

    c.setFont("Helvetica", 9)
    c.drawString(20 * mm, h - 165 * mm, "Accepted by: Tan Wei Ling")
    c.drawString(20 * mm, h - 171 * mm, "Date: 10 June 2026")
    c.showPage()

    c.setFont("Helvetica-Bold", 12)
    c.drawString(20 * mm, h - 25 * mm, "Terms and conditions")
    c.setFont("Helvetica", 9)
    terms = [
        "1. This quotation is valid for 30 days from the date above.",
        "2. Variation works will be quoted separately and require written agreement.",
        "3. Completion dates assume uninterrupted site access during working hours.",
        "4. Delays caused by material supply are not within the contractor's control.",
        "5. Any change to the agreed completion date is to be confirmed in writing.",
    ]
    for i, line in enumerate(terms):
        c.drawString(20 * mm, h - (35 + i * 6) * mm, line)
    c.showPage()
    c.save()
    print("quote-accepted.pdf          clean text layer, 2 pages")


# ------------------------------------------------------------- image files
def make_receipt() -> None:
    """A photographed receipt: no text layer, so the pipeline must OCR it."""
    img = Image.new("RGB", (900, 1250), (246, 244, 238))
    d = ImageDraw.Draw(img)

    d.text((60, 70), "PRECISION HOME REPAIRS", font=font("bold", 40), fill=(30, 30, 30))
    d.text((60, 120), "PTE LTD", font=font("bold", 40), fill=(30, 30, 30))
    d.text((60, 185), "UEN 201412345K", font=font("regular", 26), fill=(70, 70, 70))
    d.line((60, 235, 840, 235), fill=(120, 120, 120), width=2)

    d.text((60, 275), "OFFICIAL RECEIPT", font=font("bold", 34), fill=(30, 30, 30))
    d.text((60, 330), "No. R-2026-0663", font=font("regular", 26), fill=(70, 70, 70))

    # Excerpt e3 anchors here.
    d.text((60, 420), "Received with thanks", font=font("regular", 30), fill=(30, 30, 30))
    d.text((60, 470), "S$2,000.00", font=font("bold", 54), fill=(20, 20, 20))
    d.text((60, 545), "from Tan Wei Ling.", font=font("regular", 30), fill=(30, 30, 30))
    d.text((60, 600), "20 June 2026", font=font("regular", 30), fill=(30, 30, 30))

    d.text((60, 700), "Being payment for:", font=font("regular", 26), fill=(70, 70, 70))
    d.text((60, 740), "Bathroom waterproofing and", font=font("regular", 26), fill=(70, 70, 70))
    d.text((60, 776), "re-tiling per quote Q-2026-0418", font=font("regular", 26), fill=(70, 70, 70))

    d.line((60, 950, 500, 950), fill=(120, 120, 120), width=2)
    d.text((60, 965), "Authorised signature", font=font("regular", 22), fill=(120, 120, 120))

    # Photographed, not scanned: slight rotation and uneven lighting.
    img = img.rotate(-1.1, expand=True, fillcolor=(246, 244, 238))
    shade = Image.new("L", img.size, 0)
    ImageDraw.Draw(shade).ellipse((-300, -300, img.width + 100, img.height + 200), fill=28)
    img = Image.composite(Image.new("RGB", img.size, (215, 212, 205)), img, shade)

    img.save(p("receipt.jpg"), "JPEG", quality=88)
    # Byte-identical copy. Same hash -> duplicate detection, and FR05's rule that
    # duplicate evidence must not improve support.
    shutil.copyfile(p("receipt.jpg"), p("receipt-photo-2.jpg"))
    print("receipt.jpg                 needs OCR")
    print("receipt-photo-2.jpg         byte-identical duplicate")


def make_chat() -> None:
    """The chat thread carrying the contradiction the whole demo turns on."""
    W, H = 820, 1400
    img = Image.new("RGB", (W, H), (229, 221, 213))
    d = ImageDraw.Draw(img)

    d.rectangle((0, 0, W, 96), fill=(0, 92, 75))
    d.ellipse((22, 24, 74, 76), fill=(180, 180, 180))
    d.text((92, 30), "Ah Seng (Precision Repairs)", font=font("bold", 28), fill=(255, 255, 255))
    d.text((92, 64), "last seen today at 09:14", font=font("regular", 19), fill=(200, 225, 215))

    messages = [
        ("in", "Hi Ms Tan, we start hacking tomorrow morning 9am ok?", "24 Jun", "09:02"),
        ("out", "Ok noted. Please keep the corridor clear.", "24 Jun", "09:20"),
        ("in", "Waterproofing done. Tiles arriving next week.", "5 Jul", "17:41"),
        # The contradiction. Excerpt e4 anchors here.
        ("in", "Sorry ah, supplier delay on the tiles. Can we push to\nend of the month? Will finish by 29 Jul.", "12 Jul", "11:08"),
        # Excerpt e5. Ambiguous: agreement to the new date, or acknowledgement of the delay?
        ("out", "ok", "12 Jul", "11:26"),
        ("out", "Any update? Bathroom still not usable.", "3 Aug", "20:15"),
        ("in", "Boss say next week can. Sorry for the delay.", "4 Aug", "08:37"),
    ]

    y = 130
    for side, text, date, time in messages:
        lines = text.split("\n")
        f = font("regular", 25)
        tw = max(d.textlength(ln, font=f) for ln in lines)
        bw = int(tw) + 46
        bh = 30 + len(lines) * 34
        x = W - bw - 26 if side == "out" else 26
        bg = (216, 251, 199) if side == "out" else (255, 255, 255)

        d.rounded_rectangle((x, y, x + bw, y + bh), radius=16, fill=bg)
        for i, ln in enumerate(lines):
            d.text((x + 20, y + 12 + i * 34), ln, font=f, fill=(20, 20, 20))
        stamp = f"{date}  {time}"
        d.text((x + bw - d.textlength(stamp, font=font("regular", 17)) - 16, y + bh - 24),
               stamp, font=font("regular", 17), fill=(130, 140, 130))
        y += bh + 18

    # Crop to content so it reads as a real screenshot rather than a tall canvas.
    img = img.crop((0, 0, W, y + 14))
    img.save(p("whatsapp-thread.png"), "PNG")
    print("whatsapp-thread.png         carries the contradiction")


def make_blurry_note() -> None:
    """
    Low-quality scan. The pipeline must flag uncertainty rather than guess at
    the text - FR03's single most important acceptance criterion.
    """
    img = Image.new("RGB", (1000, 700), (250, 248, 240))
    d = ImageDraw.Draw(img)
    d.text((70, 90), "Paid deposit cash", font=font("regular", 46), fill=(40, 40, 60))
    d.text((70, 170), "$3OO to Ah Seng", font=font("regular", 46), fill=(40, 40, 60))
    d.text((70, 250), "on 2 June - no receipt", font=font("regular", 46), fill=(40, 40, 60))
    d.text((70, 350), "(check bank app)", font=font("regular", 40), fill=(40, 40, 60))

    img = img.filter(ImageFilter.GaussianBlur(radius=3.4))
    px = img.load()
    rnd = random.Random(7)
    for _ in range(90_000):
        x, y = rnd.randrange(img.width), rnd.randrange(img.height)
        n = rnd.randint(-55, 55)
        r, g, b = px[x, y]
        px[x, y] = (max(0, min(255, r + n)), max(0, min(255, g + n)), max(0, min(255, b + n)))

    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=18)
    buf.seek(0)
    Image.open(buf).save(p("handwritten-note.jpg"), "JPEG", quality=30)
    print("handwritten-note.jpg        low quality -> uncertainty, never invented text")


def make_unrelated() -> None:
    """No dispute-relevant content. Should be flagged possibly unrelated, not deleted."""
    img = Image.new("RGB", (1100, 780), (137, 190, 224))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 470, 1100, 780), fill=(226, 208, 168))
    for cx, cy, r in ((190, 130, 62), (900, 210, 44)):
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(255, 246, 214))
    d.polygon([(430, 470), (560, 250), (690, 470)], fill=(120, 150, 120))
    d.text((60, 700), "IMG_20260714_langkawi.jpg", font=font("regular", 24), fill=(90, 80, 60))
    img.save(p("holiday-photo.jpg"), "JPEG", quality=80)
    print("holiday-photo.jpg           possibly unrelated")


# -------------------------------------------------------- failure-mode PDFs
def make_password_protected() -> None:
    """Password protected. Must fail visibly with a retry path, not silently."""
    tmp = p("_tmp-statement.pdf")
    c = canvas.Canvas(tmp, pagesize=A4)
    w, h = A4
    c.setFont("Helvetica-Bold", 14)
    c.drawString(20 * mm, h - 25 * mm, "OCBC 360 Account  ·  Statement")
    c.setFont("Helvetica", 10)
    c.drawString(20 * mm, h - 33 * mm, "Tan Wei Ling  ·  Account ending 4471  ·  June 2026")
    rows = [
        ("02 Jun", "FAST TRANSFER  AH SENG", "-300.00"),
        ("20 Jun", "PAYNOW  PRECISION HOME REPAIRS", "-2,000.00"),
        ("28 Aug", "PAYNOW  KIM SENG RENOVATION", "-500.00"),
    ]
    for i, (date, desc, amt) in enumerate(rows):
        y = h - (50 + i * 8) * mm
        c.drawString(20 * mm, y, date)
        c.drawString(45 * mm, y, desc)
        c.drawRightString(w - 20 * mm, y, amt)
    c.showPage()
    c.save()

    doc = fitz.open(tmp)
    doc.save(
        p("bank-statement.pdf"),
        encryption=fitz.PDF_ENCRYPT_AES_256,
        owner_pw="ownerpw",
        user_pw="weiling2026",
    )
    doc.close()
    os.remove(tmp)
    print("bank-statement.pdf          password protected (user pw: weiling2026)")


def make_truncated() -> None:
    """120 pages, over the 100-page budget. Read partly, marked truncated."""
    c = canvas.Canvas(p("long-appendix.pdf"), pagesize=A4)
    w, h = A4
    for i in range(1, 121):
        c.setFont("Helvetica", 10)
        c.drawString(20 * mm, h - 25 * mm, f"Site photograph log — page {i} of 120")
        c.drawString(20 * mm, h - 33 * mm, f"Entry {i:03d}: bathroom, north wall, no change since previous entry.")
        c.showPage()
    c.save()
    print("long-appendix.pdf           120 pages -> exceeds page budget, truncated")


def make_corrupted() -> None:
    """Valid header, garbage body. Unreadable — must not produce invented text."""
    c = canvas.Canvas(p("_tmp-corrupt.pdf"), pagesize=A4)
    c.drawString(72, 720, "Site inspection report")
    c.showPage()
    c.save()
    raw = open(p("_tmp-corrupt.pdf"), "rb").read()
    os.remove(p("_tmp-corrupt.pdf"))
    head = raw[: len(raw) // 3]
    with open(p("corrupted-scan.pdf"), "wb") as f:
        f.write(head)
        f.write(bytes(random.Random(11).randrange(256) for _ in range(400)))
    print("corrupted-scan.pdf          malformed -> unreadable")


def make_unsupported() -> None:
    """.rtf is outside the supported set. Must be visibly unsupported, never 'read'."""
    rtf = (
        r"{\rtf1\ansi\deff0 {\fonttbl{\f0 Helvetica;}}\fs24 "
        r"Draft agreement between Tan Wei Ling and Precision Home Repairs Pte Ltd.\par "
        r"\par Scope: bathroom waterproofing and re-tiling.\par "
        r"Price: S$2,000.\par Completion: 15 July 2026.\par "
        r"\par NOTE: this file type is not supported by the tool and must not be "
        r"presented as having been read.\par}"
    )
    with open(p("contract-draft.rtf"), "w", encoding="ascii") as f:
        f.write(rtf)
    print("contract-draft.rtf          unsupported type")


if __name__ == "__main__":
    make_quote()
    make_receipt()
    make_chat()
    make_blurry_note()
    make_unrelated()
    make_password_protected()
    make_truncated()
    make_corrupted()
    make_unsupported()
    print("\nfixtures/documents/ regenerated")
