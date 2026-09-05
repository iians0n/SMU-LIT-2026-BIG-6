#!/usr/bin/env python3
"""Generate a polished, fully fictional evidence pack for the live browser demo."""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "demo" / "clean-case"
OUT.mkdir(parents=True, exist_ok=True)

NAVY = colors.HexColor("#17324D")
BLUE = colors.HexColor("#1769C2")
PALE = colors.HexColor("#EEF5FC")
INK = colors.HexColor("#18212B")
MUTED = colors.HexColor("#5C6873")
LINE = colors.HexColor("#D8E0E8")
GREEN = colors.HexColor("#167A45")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="DocTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=21, leading=25, textColor=NAVY, spaceAfter=6))
styles.add(ParagraphStyle(name="Kicker", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=BLUE, tracking=1.2, spaceAfter=4))
styles.add(ParagraphStyle(name="Heading", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=NAVY, spaceBefore=9, spaceAfter=7))
styles.add(ParagraphStyle(name="BodyClean", parent=styles["BodyText"], fontName="Helvetica", fontSize=10.2, leading=15, textColor=INK, spaceAfter=11))
styles.add(ParagraphStyle(name="SmallClean", parent=styles["BodyText"], fontName="Helvetica", fontSize=8.5, leading=12, textColor=MUTED, spaceAfter=6))
styles.add(ParagraphStyle(name="Callout", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=10.5, leading=15, textColor=GREEN, leftIndent=10, rightIndent=10, spaceBefore=6, spaceAfter=6))
styles.add(ParagraphStyle(name="RightClean", parent=styles["BodyText"], fontName="Helvetica", fontSize=9, leading=12, alignment=TA_RIGHT, textColor=MUTED))
styles.add(ParagraphStyle(name="CenterClean", parent=styles["BodyText"], fontName="Helvetica", fontSize=8.5, leading=11, alignment=TA_CENTER, textColor=MUTED))


def header_footer(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(NAVY)
    canvas.rect(0, height - 14 * mm, width, 14 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 8.5)
    canvas.drawString(18 * mm, height - 9 * mm, "CASEPATH SYNTHETIC DEMO EVIDENCE")
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(18 * mm, 10 * mm, "Fictional data for product demonstration only - not a real person, business, or dispute")
    canvas.drawRightString(width - 18 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build(filename, story):
    path = OUT / filename
    doc = BaseDocTemplate(
        str(path), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=23 * mm, bottomMargin=18 * mm,
        title=filename.replace("_", " ").replace(".pdf", ""), author="Casepath Demo",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
    doc.addPageTemplates(PageTemplate(id="clean", frames=[frame], onPage=header_footer))
    doc.build(story)
    return path


def title(kicker, heading, reference):
    return [
        Paragraph(kicker.upper(), styles["Kicker"]),
        Paragraph(heading, styles["DocTitle"]),
        Paragraph(reference, styles["SmallClean"]),
        Spacer(1, 5 * mm),
    ]


def info_table(rows, widths=(48 * mm, 112 * mm)):
    data = [[Paragraph(f"<b>{a}</b>", styles["SmallClean"]), Paragraph(b, styles["BodyClean"])] for a, b in rows]
    table = Table(data, colWidths=list(widths), hAlign="LEFT")
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (0, -1), PALE),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return table


def agreement():
    s = title("Signed service agreement", "Bathroom Renovation Agreement", "Agreement BR-2026-061 | Signed 3 June 2026")
    s += [info_table([
        ("Customer", "Ms Aisha Rahman (NRIC S9000001A)<br/>51 Demo Street, #09-18, Singapore 540051"),
        ("Contractor", "Northstar Bathroom Works Pte. Ltd. (UEN 202600001N)<br/>18 Ubi Demo Road 1, #03-07, Singapore 408018"),
        ("Work site", "51 Demo Street, #09-18, Singapore 540051"),
    ]), Spacer(1, 7 * mm)]
    s += [Paragraph("Agreed work and price", styles["Heading"]), Paragraph(
        "Northstar Bathroom Works Pte. Ltd. agrees to remove the existing bathroom floor and wall tiles, apply a two-coat waterproofing membrane, supply and install new tiles, reconnect the shower fittings, test for leaks, clear all debris, and leave the bathroom usable.", styles["BodyClean"]),
        Paragraph("The fixed contract price is <b>S$8,400.00</b>, inclusive of labour and materials. Aisha Rahman will pay S$4,200.00 on signing and S$4,200.00 when work begins.", styles["Callout"]),
        Paragraph("Programme", styles["Heading"]),
        Paragraph("Work will begin on 10 June 2026. All agreed work will be completed and the bathroom will be ready for normal use by <b>30 June 2026</b>.", styles["Callout"]),
        Paragraph("Any change to the scope, price, or completion date must be agreed by both parties in writing. No change was written into this agreement.", styles["BodyClean"]),
        Spacer(1, 12 * mm),
        info_table([("Customer signature", "Aisha Rahman - signed 3 June 2026"), ("For contractor", "Daniel Koh, Director - signed 3 June 2026")]),
    ]
    return build("01_signed_service_agreement.pdf", s)


def payments():
    s = title("Payment record", "Receipts and Account Ledger", "Customer account AR-0051 | Issued 15 June 2026")
    rows = [
        ["Date", "Reference", "Description", "Amount"],
        ["3 Jun 2026", "PAYNOW-0306-441", "Deposit received from Aisha Rahman for agreement BR-2026-061", "S$4,200.00"],
        ["15 Jun 2026", "PAYNOW-1506-882", "Second payment received from Aisha Rahman after work began", "S$4,200.00"],
        ["", "", "Total received", "S$8,400.00"],
    ]
    table = Table(rows, colWidths=[27 * mm, 35 * mm, 82 * mm, 30 * mm], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.7), ("LEADING", (0, 0), (-1, -1), 12),
        ("GRID", (0, 0), (-1, -1), 0.5, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (-1, 1), (-1, -1), "RIGHT"), ("BACKGROUND", (0, -1), (-1, -1), PALE),
        ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    s += [Paragraph("Payment summary", styles["Heading"]), table, Spacer(1, 9 * mm),
          Paragraph("Northstar Bathroom Works Pte. Ltd. confirms that the full contract price of <b>S$8,400.00</b> was received from Aisha Rahman by 15 June 2026.", styles["Callout"]),
          Paragraph("Both payments relate only to the bathroom renovation described in signed agreement BR-2026-061.", styles["BodyClean"]),
          Spacer(1, 18 * mm), info_table([("Issued by", "Melissa Ong, Accounts"), ("Business", "Northstar Bathroom Works Pte. Ltd. | UEN 202600001N")])]
    return build("02_payment_receipts.pdf", s)


def contractor_response():
    s = title("Contractor correspondence", "Email Admission and Partial Refund", "Email thread | 2-5 July 2026")
    s += [Paragraph("From: Daniel Koh &lt;daniel.koh@northstar-demo.example&gt;<br/>To: Aisha Rahman &lt;aisha.rahman@example.com&gt;<br/>Date: 2 July 2026, 10:14 AM<br/>Subject: BR-2026-061 - unfinished bathroom", styles["SmallClean"]),
          Paragraph("Dear Ms Rahman,", styles["BodyClean"]),
          Paragraph("I confirm that we did not complete your bathroom renovation by the agreed date of <b>30 June 2026</b>. Our tiler left unexpectedly and the waterproofing, floor tiling, shower reconnection, testing, and clean-up remain unfinished. The bathroom is not ready for normal use.", styles["Callout"]),
          Paragraph("We can return on 25 July 2026 to finish the work. Alternatively, we can refund S$1,000.00 now while you decide whether to appoint someone else. I apologise for the delay.", styles["BodyClean"]),
          Paragraph("Regards,<br/>Daniel Koh<br/>Director, Northstar Bathroom Works Pte. Ltd.", styles["BodyClean"]),
          Spacer(1, 6 * mm),
          Paragraph("Refund confirmation", styles["Heading"]),
          Paragraph("Transaction NR-0507-119 confirms that <b>S$1,000.00 was refunded to Aisha Rahman on 5 July 2026</b>. The customer confirmed receipt that day.", styles["Callout"]),
          Paragraph("Aisha Rahman replied that she would arrange an independent inspection before deciding the next step.", styles["BodyClean"])]
    return build("03_contractor_email_and_refund.pdf", s)


def inspection():
    s = title("Independent inspection", "Bathroom Condition Report", "Report SI-2026-071 | Inspection on 8 July 2026")
    s += [info_table([
        ("Inspector", "Mei Chen, Building Surveyor - Demo Property Inspections"),
        ("Property", "51 Demo Street, #09-18, Singapore 540051"),
        ("Instruction", "Record the visible condition of the bathroom; no legal opinion requested"),
    ]), Spacer(1, 7 * mm),
    Paragraph("Observed condition", styles["Heading"]),
    Paragraph("At the inspection, the bathroom floor substrate was exposed. Waterproofing membrane was present only around part of the shower area and had not been completed across the floor. No floor tiles were installed. Several wall tiles were missing. The shower fittings were disconnected and construction debris remained in the room.", styles["Callout"]),
    Paragraph("A controlled water test was not carried out because the waterproofing layer was incomplete. Based on the visible condition, the bathroom was <b>not ready for normal use on 8 July 2026</b>.", styles["Callout"]),
    Paragraph("Recommended work", styles["Heading"]),
    Paragraph("The unfinished layers should be checked, the waterproofing system completed as a continuous installation, the tiling and fittings installed, and a leak test performed before handover.", styles["BodyClean"]),
    Spacer(1, 11 * mm), info_table([("Signed", "Mei Chen - 8 July 2026"), ("Report reference", "SI-2026-071")])]
    return build("04_independent_inspection_report.pdf", s)


def demand():
    s = title("Claim calculation", "Net Payment Request and Supporting Calculation", "Notice sent by email | 10 July 2026")
    rows = [
        ["Item", "Evidence", "Amount"],
        ["Contract payments made", "Receipts dated 3 and 15 June 2026", "S$8,400.00"],
        ["Less amount already returned", "Transaction NR-0507-119 dated 5 July 2026", "(S$1,000.00)"],
        ["Net amount still paid to contractor", "S$8,400.00 - S$1,000.00", "S$7,400.00"],
    ]
    table = Table(rows, colWidths=[54 * mm, 82 * mm, 38 * mm], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9), ("GRID", (0, 0), (-1, -1), 0.5, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("ALIGN", (-1, 1), (-1, -1), "RIGHT"),
        ("BACKGROUND", (0, -1), (-1, -1), PALE), ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    s += [Paragraph("Calculation", styles["Heading"]), table, Spacer(1, 9 * mm),
          Paragraph("I am asking Northstar Bathroom Works Pte. Ltd. to pay the remaining <b>S$7,400.00</b>. This is the original S$8,400.00 paid, less the S$1,000.00 already returned. I am not claiming the returned sum again.", styles["Callout"]),
          Paragraph("Reason for request", styles["Heading"]),
          Paragraph("The completion date in agreement BR-2026-061 was 30 June 2026. The contractor confirmed that the work remained unfinished, and inspection report SI-2026-071 records that the bathroom was not ready for normal use.", styles["BodyClean"]),
          Paragraph("Please pay S$7,400.00 by 24 July 2026. This notice records the amount requested and does not add any interest, inspection fee, or replacement-contractor cost.", styles["BodyClean"]),
          Spacer(1, 13 * mm), info_table([("From", "Aisha Rahman | aisha.rahman@example.com"), ("To", "Northstar Bathroom Works Pte. Ltd. | 18 Ubi Demo Road 1, #03-07, Singapore 408018")])]
    return build("05_loss_calculation_and_demand.pdf", s)


if __name__ == "__main__":
    paths = [agreement(), payments(), contractor_response(), inspection(), demand()]
    for path in paths:
        print(path.relative_to(ROOT))
