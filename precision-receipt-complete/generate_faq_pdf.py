"""Generate FAQ.pdf from FAQ.md using ReportLab"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor, white, black
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.pdfgen import canvas
from reportlab.platypus.doctemplate import PageTemplate, BaseDocTemplate
from reportlab.platypus.frames import Frame
import re, os

# ── Colours ──────────────────────────────────────────────────────────────────
PURPLE      = HexColor("#4B0082")   # Meezan-style deep purple
LIGHT_PURPLE= HexColor("#7B2D8B")
ACCENT      = HexColor("#2E7D32")   # Green accent
BG_HEADER   = HexColor("#F3E5F5")   # Soft lavender background
TABLE_HDR   = HexColor("#6A1B9A")
TABLE_ALT   = HexColor("#F8F0FF")
GREY_LINE   = HexColor("#CCCCCC")
DARK_TEXT   = HexColor("#1A1A1A")
MID_TEXT    = HexColor("#444444")
LIGHT_TEXT  = HexColor("#666666")
CODE_BG     = HexColor("#F5F5F5")
CODE_BORDER = HexColor("#DDDDDD")

PAGE_W, PAGE_H = A4
MARGIN = 2.2 * cm

# ── Styles ────────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

def S(name, **kw):
    """Build a ParagraphStyle."""
    return ParagraphStyle(name, **kw)

cover_title = S("CoverTitle",
    fontSize=28, leading=34, textColor=white,
    fontName="Helvetica-Bold", alignment=TA_CENTER, spaceAfter=8)

cover_sub = S("CoverSub",
    fontSize=13, leading=18, textColor=HexColor("#E1BEE7"),
    fontName="Helvetica", alignment=TA_CENTER, spaceAfter=4)

cover_org = S("CoverOrg",
    fontSize=11, leading=15, textColor=HexColor("#CE93D8"),
    fontName="Helvetica-Oblique", alignment=TA_CENTER)

h1 = S("H1",
    fontSize=16, leading=22, textColor=white,
    fontName="Helvetica-Bold", spaceBefore=18, spaceAfter=6,
    backColor=PURPLE, leftIndent=-0.5*cm, rightIndent=-0.5*cm,
    borderPad=8)

h2 = S("H2",
    fontSize=11, leading=15, textColor=PURPLE,
    fontName="Helvetica-Bold", spaceBefore=14, spaceAfter=4,
    borderPad=0)

question = S("Question",
    fontSize=10.5, leading=15, textColor=LIGHT_PURPLE,
    fontName="Helvetica-Bold", spaceBefore=10, spaceAfter=3,
    leftIndent=0)

answer = S("Answer",
    fontSize=9.5, leading=14.5, textColor=DARK_TEXT,
    fontName="Helvetica", spaceBefore=0, spaceAfter=6,
    alignment=TA_JUSTIFY)

bullet_style = S("Bullet",
    fontSize=9.5, leading=14, textColor=MID_TEXT,
    fontName="Helvetica", leftIndent=18, bulletIndent=8,
    spaceBefore=1, spaceAfter=1)

code_style = S("Code",
    fontSize=8.5, leading=12, textColor=HexColor("#333333"),
    fontName="Courier", leftIndent=14, spaceBefore=4, spaceAfter=4,
    backColor=CODE_BG, borderColor=CODE_BORDER, borderWidth=0.5,
    borderPad=6)

toc_title = S("TocTitle",
    fontSize=14, leading=20, textColor=PURPLE,
    fontName="Helvetica-Bold", spaceBefore=0, spaceAfter=10,
    alignment=TA_CENTER)

toc_item = S("TocItem",
    fontSize=10, leading=16, textColor=DARK_TEXT,
    fontName="Helvetica", leftIndent=10)

footer_style = S("Footer",
    fontSize=8, leading=10, textColor=LIGHT_TEXT,
    fontName="Helvetica", alignment=TA_CENTER)

# ── Header / Footer canvas callbacks ─────────────────────────────────────────
def on_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    # Top bar
    canvas.setFillColor(PURPLE)
    canvas.rect(0, h - 1.2*cm, w, 1.2*cm, fill=1, stroke=0)
    canvas.setFillColor(white)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(MARGIN, h - 0.75*cm, "Precision Receipt System")
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(w - MARGIN, h - 0.75*cm, "FAQ — CIO / CDO Edition")
    # Bottom bar
    canvas.setFillColor(BG_HEADER)
    canvas.rect(0, 0, w, 1.0*cm, fill=1, stroke=0)
    canvas.setFillColor(LIGHT_TEXT)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawCentredString(w/2, 0.38*cm,
        f"Page {doc.page}  |  Confidential — Internal Use Only  |  March 2026")
    canvas.restoreState()

def on_first_page(canvas, doc):
    # No header/footer on cover page
    pass

# ── Cover Page ────────────────────────────────────────────────────────────────
def cover_page():
    w, h = A4
    elems = []

    # Purple gradient backdrop via stacked rects
    class CoverCanvas:
        def __init__(self):
            pass
        def draw(self, canvas, doc):
            pass

    # We'll draw the cover using a Table as a colour block
    cover_data = [[""]]
    cover_table = Table(cover_data, colWidths=[PAGE_W - 2*MARGIN],
                        rowHeights=[12*cm])
    cover_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), PURPLE),
        ("ROUNDEDCORNERS", [12]),
        ("BOX", (0,0), (-1,-1), 0, PURPLE),
    ]))

    # Build cover content as inner paragraphs
    elems.append(Spacer(1, 3*cm))
    elems.append(Paragraph("Precision Receipt System", cover_title))
    elems.append(Spacer(1, 0.3*cm))
    elems.append(Paragraph("Frequently Asked Questions", cover_sub))
    elems.append(Spacer(1, 0.2*cm))
    elems.append(Paragraph("CIO &amp; CDO Edition", cover_sub))
    elems.append(Spacer(1, 1.5*cm))

    # Accent line
    elems.append(HRFlowable(width="60%", thickness=2,
                             color=HexColor("#CE93D8"),
                             hAlign="CENTER", spaceAfter=20))

    elems.append(Paragraph("Meezan Bank — Digital Innovation Initiative", cover_org))
    elems.append(Spacer(1, 0.3*cm))
    elems.append(Paragraph("March 2026 · Confidential", cover_org))
    elems.append(Spacer(1, 4*cm))

    # Section count badges as a mini table
    badge_data = [["8\nSections", "40+\nQ&amp;As", "3\nIntegration Guides"]]
    badge_table = Table(badge_data, colWidths=[4*cm, 4*cm, 4*cm])
    badge_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), LIGHT_PURPLE),
        ("TEXTCOLOR", (0,0), (-1,-1), white),
        ("ALIGN", (0,0), (-1,-1), "CENTER"),
        ("FONTNAME", (0,0), (-1,-1), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,-1), 12),
        ("LEADING", (0,0), (-1,-1), 16),
        ("TOPPADDING", (0,0), (-1,-1), 10),
        ("BOTTOMPADDING", (0,0), (-1,-1), 10),
        ("ROUNDEDCORNERS", [8]),
        ("BOX", (0,0), (-1,-1), 0, LIGHT_PURPLE),
        ("LINEAFTER", (0,0), (1,-1), 1, HexColor("#9C27B0")),
    ]))
    elems.append(badge_table)
    elems.append(PageBreak())
    return elems


# ── Table of Contents ─────────────────────────────────────────────────────────
def toc_page():
    sections = [
        ("1", "Security & Compliance"),
        ("2", "Reliability & Operations"),
        ("3", "Scalability"),
        ("4", "Data Governance"),
        ("5", "AML & Regulatory"),
        ("6", "Business & Operations"),
        ("7", "Integrating with Temenos Transact (T24)"),
        ("8", "Integrating with Meta WhatsApp Business API"),
    ]
    elems = []
    elems.append(Spacer(1, 0.5*cm))
    elems.append(Paragraph("Table of Contents", toc_title))
    elems.append(HRFlowable(width="100%", thickness=1.5,
                             color=PURPLE, spaceAfter=16))

    for num, title in sections:
        row_data = [[
            Paragraph(f"<font color='#6A1B9A'><b>{num}.</b></font>", answer),
            Paragraph(title, answer),
        ]]
        row_table = Table(row_data, colWidths=[1*cm, PAGE_W - 2*MARGIN - 1*cm])
        row_table.setStyle(TableStyle([
            ("TOPPADDING", (0,0), (-1,-1), 6),
            ("BOTTOMPADDING", (0,0), (-1,-1), 6),
            ("LINEBELOW", (0,0), (-1,-1), 0.5, GREY_LINE),
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ]))
        elems.append(row_table)

    elems.append(PageBreak())
    return elems


# ── Parse FAQ.md ──────────────────────────────────────────────────────────────
def parse_md(path):
    """
    Returns list of sections:
      {"heading": str, "items": [{"q": str, "a_blocks": [block,...]}]}
    where block is ("p"|"bullet"|"code"|"table", content)
    """
    with open(path, encoding="utf-8") as f:
        raw = f.read()

    # Split on ## headings (section level)
    parts = re.split(r'\n## ', raw)
    sections = []

    for part in parts[1:]:   # skip preamble / TOC
        lines = part.split("\n")
        heading = lines[0].strip()
        # Strip leading number like "1. Security…" or "7. Integrating…"
        heading = re.sub(r'^\d+\.\s+', '', heading)
        body = "\n".join(lines[1:])

        # Split on Q/A pairs: lines starting with **Q:
        qa_blocks = re.split(r'\n---\n', body)
        items = []
        for block in qa_blocks:
            block = block.strip()
            if not block:
                continue
            q_match = re.search(r'\*\*Q:\s*(.*?)\*\*', block, re.DOTALL)
            a_match = re.search(r'\*\*Q:.*?\*\*\s*\n+A:\s*(.*)', block, re.DOTALL)
            if not q_match:
                continue
            q_text = q_match.group(1).strip()
            a_text = a_match.group(1).strip() if a_match else ""
            a_blocks = parse_answer(a_text)
            items.append({"q": q_text, "a_blocks": a_blocks})

        if items:
            sections.append({"heading": heading, "items": items})

    return sections


def parse_answer(text):
    """Split answer text into typed blocks: p / bullet / code / table"""
    blocks = []
    lines = text.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]

        # Code block
        if line.strip().startswith("```"):
            code_lines = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            blocks.append(("code", "\n".join(code_lines)))
            i += 1
            continue

        # Markdown table
        if line.strip().startswith("|") and i+1 < len(lines) and "|---" in lines[i+1]:
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                table_lines.append(lines[i])
                i += 1
            blocks.append(("table", table_lines))
            continue

        # Bullet / numbered list
        if re.match(r'^\s*[-*]\s+', line) or re.match(r'^\s*\d+\.\s+', line):
            bullet_lines = []
            while i < len(lines) and (
                re.match(r'^\s*[-*]\s+', lines[i]) or
                re.match(r'^\s*\d+\.\s+', lines[i])
            ):
                bullet_lines.append(lines[i].strip())
                i += 1
            blocks.append(("bullet", bullet_lines))
            continue

        # Empty line — skip
        if not line.strip():
            i += 1
            continue

        # Paragraph — collect until blank line or list/code starts
        para_lines = []
        while i < len(lines):
            l = lines[i]
            if not l.strip():
                break
            if l.strip().startswith("```"):
                break
            if l.strip().startswith("|"):
                break
            if re.match(r'^\s*[-*]\s+', l) or re.match(r'^\s*\d+\.\s+', l):
                break
            para_lines.append(l.strip())
            i += 1
        if para_lines:
            blocks.append(("p", " ".join(para_lines)))

    return blocks


def md_to_rl(text):
    """Convert basic markdown inline formatting to ReportLab XML."""
    # Step 1: Extract code spans first to prevent their content from being
    # processed by bold/italic regexes (asterisks inside backticks break nesting).
    code_spans = []
    def save_code(m):
        inner = m.group(1)
        # Escape XML special chars inside code spans
        inner = inner.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        code_spans.append(f'<font name="Courier" color="#8B0000">{inner}</font>')
        return f'\x00CODE{len(code_spans)-1}\x00'
    text = re.sub(r'`([^`]+)`', save_code, text)

    # Step 2: Escape & in remaining text (not inside already-saved code spans)
    text = re.sub(r'&(?!amp;|lt;|gt;|quot;|apos;|#)', '&amp;', text)

    # Step 3: Apply bold-italic, bold, italic
    text = re.sub(r'\*\*\*(.*?)\*\*\*', r'<b><i>\1</i></b>', text)
    text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', text)

    # Step 4: Restore code spans
    for idx, replacement in enumerate(code_spans):
        text = text.replace(f'\x00CODE{idx}\x00', replacement)

    return text


def build_table(table_lines):
    """Convert markdown table lines to a ReportLab Table."""
    rows = []
    for line in table_lines:
        if "|---" in line:
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        rows.append(cells)

    if not rows:
        return None

    col_count = max(len(r) for r in rows)
    # Pad rows
    rows = [r + [""] * (col_count - len(r)) for r in rows]

    col_w = (PAGE_W - 2*MARGIN) / col_count

    rl_rows = []
    for ri, row in enumerate(rows):
        rl_row = []
        for cell in row:
            style = answer if ri > 0 else S(
                f"TH{ri}", fontSize=9, fontName="Helvetica-Bold",
                textColor=white, alignment=TA_CENTER, leading=12)
            rl_row.append(Paragraph(md_to_rl(cell), style))
        rl_rows.append(rl_row)

    t = Table(rl_rows, colWidths=[col_w]*col_count, repeatRows=1)
    ts = TableStyle([
        ("BACKGROUND", (0,0), (-1,0), TABLE_HDR),
        ("TEXTCOLOR", (0,0), (-1,0), white),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,-1), 8.5),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [white, TABLE_ALT]),
        ("GRID", (0,0), (-1,-1), 0.4, GREY_LINE),
        ("TOPPADDING", (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING", (0,0), (-1,-1), 6),
        ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
    ])
    t.setStyle(ts)
    return t


# ── Build PDF ─────────────────────────────────────────────────────────────────
def build_pdf(md_path, out_path):
    sections = parse_md(md_path)

    doc = SimpleDocTemplate(
        out_path,
        pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=2.0*cm, bottomMargin=1.8*cm,
        title="Precision Receipt System — FAQ",
        author="Precision Engineering Team",
        subject="CIO / CDO FAQ",
    )

    story = []

    # Cover
    story += cover_page()

    # TOC
    story += toc_page()

    for sec in sections:
        # Section heading block with coloured background
        sec_block = []
        sec_block.append(Spacer(1, 0.3*cm))

        # Purple header bar
        hdr_data = [[Paragraph(sec["heading"], h1)]]
        hdr_table = Table(hdr_data,
                          colWidths=[PAGE_W - 2*MARGIN])
        hdr_table.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), PURPLE),
            ("TOPPADDING", (0,0), (-1,-1), 10),
            ("BOTTOMPADDING", (0,0), (-1,-1), 10),
            ("LEFTPADDING", (0,0), (-1,-1), 14),
            ("RIGHTPADDING", (0,0), (-1,-1), 14),
        ]))
        sec_block.append(hdr_table)
        sec_block.append(Spacer(1, 0.4*cm))

        story += sec_block

        for item in sec["items"]:
            qa_block = []

            # Question
            q_text = md_to_rl(item["q"])
            q_data = [[Paragraph(f"Q: {q_text}", question)]]
            q_table = Table(q_data, colWidths=[PAGE_W - 2*MARGIN])
            q_table.setStyle(TableStyle([
                ("BACKGROUND", (0,0), (-1,-1), BG_HEADER),
                ("TOPPADDING", (0,0), (-1,-1), 8),
                ("BOTTOMPADDING", (0,0), (-1,-1), 8),
                ("LEFTPADDING", (0,0), (-1,-1), 12),
                ("RIGHTPADDING", (0,0), (-1,-1), 12),
                ("LINEAFTER", (0,0), (0,-1), 4, PURPLE),
            ]))
            qa_block.append(q_table)
            qa_block.append(Spacer(1, 0.15*cm))

            # Answer label
            qa_block.append(Paragraph(
                '<font color="#2E7D32"><b>A:</b></font>', answer))

            # Answer blocks
            for btype, bcontent in item["a_blocks"]:
                if btype == "p":
                    qa_block.append(
                        Paragraph(md_to_rl(bcontent), answer))

                elif btype == "bullet":
                    for bline in bcontent:
                        bline_clean = re.sub(r'^[-*\d.]+\s+', '', bline)
                        qa_block.append(Paragraph(
                            f"• {md_to_rl(bline_clean)}", bullet_style))

                elif btype == "code":
                    # Escape for XML
                    safe = (bcontent
                            .replace("&", "&amp;")
                            .replace("<", "&lt;")
                            .replace(">", "&gt;"))
                    qa_block.append(
                        Paragraph(safe.replace("\n", "<br/>"),
                                  code_style))

                elif btype == "table":
                    tbl = build_table(bcontent)
                    if tbl:
                        qa_block.append(Spacer(1, 0.1*cm))
                        qa_block.append(tbl)
                        qa_block.append(Spacer(1, 0.1*cm))

            qa_block.append(HRFlowable(
                width="100%", thickness=0.5,
                color=GREY_LINE, spaceAfter=6, spaceBefore=4))

            story.append(KeepTogether(qa_block[:4]))  # keep Q + first answer para together
            story += qa_block[4:]

    doc.build(story,
              onFirstPage=on_first_page,
              onLaterPages=on_page)
    print(f"PDF saved: {out_path}")


if __name__ == "__main__":
    base = "F:/edm/ReceiptSystem/ReceiptSystemproj/precision-receipt-complete"
    build_pdf(
        md_path=f"{base}/FAQ.md",
        out_path=f"{base}/FAQ.pdf"
    )
    build_pdf(
        md_path=f"{base}/TECHNICAL_FAQ.md",
        out_path=f"{base}/TECHNICAL_FAQ.pdf"
    )
