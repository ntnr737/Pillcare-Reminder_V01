import os
import re
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

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
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(40, 760, "PillCare Reminder V01 — Enterprise Documentation Architecture")
            self.setStrokeColor(colors.HexColor("#cbd5e1"))
            self.setLineWidth(0.5)
            self.line(40, 752, 572, 752)
        
        # Footer
        footer_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(572, 25, footer_text)
        self.drawString(40, 25, "CONFIDENTIAL — PillCare Healthcare Enterprise Engine")
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(40, 36, 572, 36)
        
        self.restoreState()

def parse_markdown_to_flowables(file_path, styles):
    flowables = []
    
    with open(file_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    in_code_block = False
    code_lines = []
    table_lines = []
    
    def format_inline(text):
        # Escape HTML entities first safely
        text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        # Bold **text**
        text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
        # Code `code`
        text = re.sub(r'`(.*?)`', r'<font face="Courier" color="#7c3aed">\1</font>', text)
        return text

    def flush_table(t_lines):
        if not t_lines:
            return
        table_data = []
        for row in t_lines:
            cells = [format_inline(c.strip()) for c in row.strip('| \n').split('|')]
            if all(set(c).issubset({'-', ':', ' '}) for c in cells):
                continue # Skip separator line
            table_data.append([Paragraph(cell, styles["TableCell"]) for cell in cells])
        
        if table_data:
            num_cols = max(len(r) for r in table_data)
            col_width = (7.1 * inch) / max(num_cols, 1)
            t = Table(table_data, colWidths=[col_width] * num_cols)
            t.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#f1f5f9")),
                ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
                ('TOPPADDING', (0,0), (-1,-1), 4),
                ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ]))
            flowables.append(Spacer(1, 4))
            flowables.append(t)
            flowables.append(Spacer(1, 6))

    for line in lines:
        raw_line = line.rstrip('\n')
        
        # Code blocks
        if raw_line.startswith("```"):
            if in_code_block:
                in_code_block = False
                code_text = "<br/>".join([c.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace(" ", "&nbsp;") for c in code_lines])
                flowables.append(Spacer(1, 4))
                flowables.append(Paragraph(code_text, styles["CodeBlock"]))
                flowables.append(Spacer(1, 6))
                code_lines = []
            else:
                in_code_block = True
            continue
            
        if in_code_block:
            code_lines.append(raw_line)
            continue
            
        # Tables
        if raw_line.startswith("|"):
            table_lines.append(raw_line)
            continue
        elif table_lines:
            flush_table(table_lines)
            table_lines = []
            
        # Headings
        if raw_line.startswith("# "):
            flowables.append(Spacer(1, 8))
            flowables.append(Paragraph(format_inline(raw_line[2:]), styles["DocH1"]))
            flowables.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#7c3aed"), spaceAfter=6))
        elif raw_line.startswith("## "):
            flowables.append(Spacer(1, 6))
            flowables.append(Paragraph(format_inline(raw_line[3:]), styles["DocH2"]))
        elif raw_line.startswith("### "):
            flowables.append(Spacer(1, 4))
            flowables.append(Paragraph(format_inline(raw_line[4:]), styles["DocH3"]))
        elif raw_line.startswith("- ") or raw_line.startswith("* "):
            flowables.append(Paragraph(f"• {format_inline(raw_line[2:])}", styles["DocBullet"]))
        elif raw_line.strip() == "---":
            flowables.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0"), spaceBefore=4, spaceAfter=4))
        elif raw_line.strip():
            flowables.append(Paragraph(format_inline(raw_line), styles["DocBody"]))

    if table_lines:
        flush_table(table_lines)
        
    return flowables

def build_pdf(docs_dir, output_pdf_path):
    doc = SimpleDocTemplate(
        output_pdf_path,
        pagesize=letter,
        leftMargin=40,
        rightMargin=40,
        topMargin=50,
        bottomMargin=50
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    styles.add(ParagraphStyle(
        "CoverTitle",
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=28,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=10
    ))
    
    styles.add(ParagraphStyle(
        "CoverSubtitle",
        fontName="Helvetica",
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#475569"),
        spaceAfter=20
    ))
    
    styles.add(ParagraphStyle(
        "DocH1",
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=10,
        spaceAfter=4
    ))
    
    styles.add(ParagraphStyle(
        "DocH2",
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        textColor=colors.HexColor("#6d28d9"),
        spaceBefore=8,
        spaceAfter=4
    ))

    styles.add(ParagraphStyle(
        "DocH3",
        fontName="Helvetica-Bold",
        fontSize=10.5,
        leading=13,
        textColor=colors.HexColor("#0284c7"),
        spaceBefore=6,
        spaceAfter=3
    ))

    styles.add(ParagraphStyle(
        "DocBody",
        fontName="Helvetica",
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor("#1e293b"),
        spaceAfter=4
    ))

    styles.add(ParagraphStyle(
        "DocBullet",
        fontName="Helvetica",
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor("#1e293b"),
        leftIndent=12,
        spaceAfter=2
    ))

    styles.add(ParagraphStyle(
        "TableCell",
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#1e293b")
    ))

    styles.add(ParagraphStyle(
        "CodeBlock",
        fontName="Courier",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#0f172a"),
        backColor=colors.HexColor("#f8fafc"),
        borderColor=colors.HexColor("#e2e8f0"),
        borderWidth=0.5,
        borderPadding=6,
        spaceAfter=6
    ))

    story = []

    # Cover Page Header
    story.append(Paragraph("PillCare Reminder V01", styles["CoverTitle"]))
    story.append(Paragraph("<b>Complete 10-Module Enterprise Documentation Architecture</b><br/>Product, Technical Architecture, Security & Operations Master Specification", styles["CoverSubtitle"]))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#7c3aed"), spaceAfter=15))
    
    # Overview Table of Modules
    modules = [
        ("01_Product", ["PRD.md", "Product_Roadmap.md", "Feature_Requirements.md"]),
        ("02_UI_UX", ["User_Flows.md", "Wireframes.md", "UI_Specification.md", "Design_System.md"]),
        ("03_Technical", ["SRS.md", "System_Architecture.md", "Database_Design.md", "API_Documentation.md", "Integration_Documentation.md"]),
        ("04_Security_Privacy", ["Privacy_Policy.md", "Terms_Conditions.md", "Security_Architecture.md", "Data_Retention.md", "Consent_Management.md"]),
        ("05_Development", ["Development_Setup.md", "Coding_Standards.md", "Git_Workflow.md", "Environment_Configuration.md"]),
        ("06_QA", ["Test_Plan.md", "Test_Cases.md", "UAT.md", "Bug_Reports.md"]),
        ("07_Deployment", ["Deployment_Guide.md", "CI_CD.md", "Release_Checklist.md", "Rollback_Procedure.md"]),
        ("08_Admin_Panel", ["Requirements.md", "RBAC.md", "Admin_Functions.md", "Audit_Logs.md"]),
        ("09_Play_Store", ["Store_Listing.md", "Data_Safety.md", "Release_Documentation.md"]),
        ("10_Operations", ["SOPs.md", "Incident_Management.md", "Backup_Recovery.md", "Maintenance.md"])
    ]

    for mod_name, files in modules:
        mod_path = os.path.join(docs_dir, mod_name)
        if not os.path.exists(mod_path):
            continue
            
        story.append(Paragraph(f"Module: {mod_name.replace('_', ' ')}", styles["DocH1"]))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#0284c7"), spaceAfter=10))
        
        for file_name in files:
            file_path = os.path.join(mod_path, file_name)
            if os.path.exists(file_path):
                story.append(Paragraph(f"Document: {file_name}", styles["DocH2"]))
                flowables = parse_markdown_to_flowables(file_path, styles)
                story.extend(flowables)
                story.append(Spacer(1, 10))
                
        story.append(PageBreak())

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Master PDF compiled successfully: {output_pdf_path}")

if __name__ == "__main__":
    docs_directory = "/Users/nitin/Documents/PillCare-Reminder_V01.1/Pillcare-Reminder_V01/docs"
    out_pdf = "/Users/nitin/Documents/PillCare-Reminder_V01.1/Pillcare-Reminder_V01/docs/PillCare_Master_Documentation_V01.pdf"
    
    # Also artifact path
    art_pdf = "/Users/nitin/.gemini/antigravity-ide/brain/ab9e7541-30b3-4896-8d84-a9da5c16544a/PillCare_Master_Documentation_V01.pdf"
    
    build_pdf(docs_directory, out_pdf)
    build_pdf(docs_directory, art_pdf)
