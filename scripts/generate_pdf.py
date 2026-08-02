import os
import sys

# Ensure site-packages path is included
sys.path.append(r'C:\Users\iwanw\AppData\Roaming\Python\Python314\site-packages')

from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas
import re

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_number(self, page_count):
        if self._pageNumber == 1:
            return  # Skip cover page footer
        self.saveState()
        self.setFont("Helvetica", 9)
        self.setFillColor(colors.HexColor("#64748b"))
        
        # Header
        self.drawString(54, 800, "MYADAMEDIA BILLING — Proposal Penawaran Investasi")
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(54, 792, 541, 792)
        
        # Footer
        page_text = f"Halaman {self._pageNumber} dari {page_count}"
        self.drawRightString(541, 36, page_text)
        self.drawString(54, 36, "CONFIDENTIAL & PROPRIETARY — MYADAMEDIA")
        self.line(54, 48, 541, 48)
        self.restoreState()

def build_pdf(md_path, pdf_path):
    with open(md_path, 'r', encoding='utf-8') as f:
        content = f.read()

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=A4,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Custom Palette
    NAVY = colors.HexColor("#0f172a")
    BLUE = colors.HexColor("#1d4ed8")
    TEXT = colors.HexColor("#334155")
    MUTED = colors.HexColor("#64748b")
    BG_LIGHT = colors.HexColor("#f8fafc")

    # Custom Styles
    style_title = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=NAVY,
        spaceAfter=8
    )

    style_subtitle = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=BLUE,
        spaceAfter=15
    )

    style_h1 = ParagraphStyle(
        'H1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        textColor=NAVY,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )

    style_h2 = ParagraphStyle(
        'H2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=BLUE,
        spaceBefore=10,
        spaceAfter=6,
        keepWithNext=True
    )

    style_body = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=TEXT,
        spaceAfter=6
    )

    style_bullet = ParagraphStyle(
        'Bullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=TEXT,
        leftIndent=15,
        spaceAfter=4
    )

    style_code = ParagraphStyle(
        'Code',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#0f172a"),
        backColor=colors.HexColor("#f1f5f9"),
        borderColor=colors.HexColor("#cbd5e1"),
        borderWidth=0.5,
        borderPadding=6,
        spaceBefore=6,
        spaceAfter=8
    )

    story = []

    lines = content.split('\n')
    i = 0
    in_code = False
    code_lines = []

    in_table = False
    table_lines = []

    while i < len(lines):
        line = lines[i]

        # Code blocks
        if line.startswith('```'):
            if in_code:
                in_code = False
                code_text = '\n'.join(code_lines)
                # Format code blocks neatly
                formatted_code = code_text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('\n', '<br/>').replace(' ', '&nbsp;')
                story.append(Paragraph(formatted_code, style_code))
                code_lines = []
            else:
                in_code = True
                code_lines = []
            i += 1
            continue

        if in_code:
            code_lines.append(line)
            i += 1
            continue

        # Tables (Markdown Table)
        if '|' in line and (line.strip().startswith('|') or line.strip().endswith('|')):
            if not in_table:
                in_table = True
                table_lines = []
            table_lines.append(line)
            i += 1
            continue
        elif in_table:
            in_table = False
            # Render Markdown Table
            rows_data = []
            for tline in table_lines:
                if '---' in tline:
                    continue
                cells = [c.strip() for c in tline.strip('|').split('|')]
                rows_data.append(cells)
            
            if rows_data:
                table_cells = []
                for r_idx, row in enumerate(rows_data):
                    r_cells = []
                    for c_idx, cell in enumerate(row):
                        # Clean Markdown bold inside table
                        cell_clean = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', cell)
                        st = ParagraphStyle('TCellHeader', parent=style_body, fontName='Helvetica-Bold', textColor=colors.white, fontSize=9, leading=11) if r_idx == 0 else ParagraphStyle('TCell', parent=style_body, fontSize=8.5, leading=11)
                        r_cells.append(Paragraph(cell_clean, st))
                    table_cells.append(r_cells)

                # Widths
                num_cols = len(table_cells[0])
                col_w = 487 / num_cols
                t = Table(table_cells, colWidths=[col_w]*num_cols)
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,0), NAVY),
                    ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                    ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 5),
                    ('TOPPADDING', (0,0), (-1,-1), 5),
                    ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
                    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")])
                ]))
                story.append(Spacer(1, 4))
                story.append(t)
                story.append(Spacer(1, 6))
            table_lines = []

        # Horizontal Rule
        if line.strip() in ['---', '***', '___']:
            story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor("#cbd5e1"), spaceBefore=10, spaceAfter=10))
            i += 1
            continue

        # Headings
        if line.startswith('# '):
            title_text = line[2:].strip()
            story.append(Paragraph(title_text, style_title))
        elif line.startswith('## '):
            h1_text = line[3:].strip()
            story.append(Paragraph(h1_text, style_h1))
        elif line.startswith('### '):
            h2_text = line[4:].strip()
            story.append(Paragraph(h2_text, style_h2))
        elif line.startswith('- ') or line.startswith('* '):
            bullet_text = line[2:].strip()
            bullet_text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', bullet_text)
            story.append(Paragraph(f"• {bullet_text}", style_bullet))
        elif line.strip():
            body_text = line.strip()
            body_text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', body_text)
            body_text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', body_text)
            story.append(Paragraph(body_text, style_body))

        i += 1

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF Generated successfully at: {pdf_path}")

if __name__ == '__main__':
    md = r'd:\WEBAPP\myadamedia-billing\investor\PROPOSAL_INVESTASI.md'
    pdf = r'd:\WEBAPP\myadamedia-billing\investor\PROPOSAL_INVESTASI.pdf'
    build_pdf(md, pdf)
