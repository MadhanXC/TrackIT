import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { format } from 'date-fns';

export interface AuditReportConfig {
  basis: string;
  timeFrame: string;
  fromDate?: string;
  toDate?: string;
  includePOC: boolean;
  includeSurvey: boolean;
  includePermit: boolean;
  includeMaterials: boolean;
  includeShipping: boolean;
  summaryStats?: {
    total: number;
    completed: number;
    active: number;
    successRate: number;
    surveys: { total: number; pending: number; completed: number };
    permits: { total: number; pending: number; approved: number };
    shipments: { total: number; pending: number; delivered: number };
  };
}

export async function generateAuditPdf(tasks: any[], config: AuditReportConfig) {
  // Professional A2 Landscape Width
  const pageWidth = 1684; 
  const margin = 50;
  const headerHeight = 150;
  const rowHeight = 60;
  const summaryBoxHeight = 180;
  const bottomPadding = 60;

  // Dynamic Height Calculation: Header + Table Rows + Summary
  const tableRowsHeight = tasks.length * rowHeight;
  const summaryHeight = config.summaryStats ? summaryBoxHeight + 80 : 0;
  const totalContentHeight = headerHeight + tableRowsHeight + summaryHeight + margin + bottomPadding;
  
  // PDF height is calculated dynamically based on content
  const pageHeight = Math.max(800, totalContentHeight); 

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  let currentY = pageHeight - margin;

  // Header: PLS REPORT
  page.drawText('PLS REPORT', {
    x: margin,
    y: currentY,
    size: 28,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  
  // Date of Report Generation
  page.drawText(`Report Generated: ${format(new Date(), "PPP p")}`, {
    x: pageWidth - margin - 350,
    y: currentY,
    size: 10,
    font: font,
    color: rgb(0.4, 0.4, 0.4),
  });
  
  currentY -= 35;

  const dateRangeStr = config.timeFrame === 'all' ? 'Full History' : `${config.fromDate} to ${config.toDate || format(new Date(), 'yyyy-MM-dd')}`;
  page.drawText(`Basis: ${config.basis === 'createdAt' ? 'Date Created' : 'Date Initiated'} | Period: ${dateRangeStr}`, {
    x: margin,
    y: currentY,
    size: 11,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });
  currentY -= 65;

  // Weighted Column System - Address gets 10 weights to prevent collision
  const headers = ['#', 'Ref Address - Title', 'Type', 'State', 'Priority', 'Source'];
  const weights = [1, 10, 3, 3, 3, 3]; 

  if (config.includePOC) { headers.push('Site POC'); weights.push(6); }
  if (config.includeSurvey) { headers.push('Survey'); weights.push(5); }
  if (config.includePermit) { headers.push('Permit'); weights.push(5); }
  if (config.includeMaterials) { headers.push('Inventory'); weights.push(6); }
  if (config.includeShipping) { headers.push('Shipments'); weights.push(4); }

  headers.push('Created', 'Initiated', 'Completed');
  weights.push(3, 3, 3);

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const usableWidth = pageWidth - margin * 2;
  const unitWidth = usableWidth / totalWeight;
  const gutter = 15; 

  const getColX = (index: number) => {
    let x = margin;
    for (let i = 0; i < index; i++) {
      x += weights[i] * unitWidth;
    }
    return x;
  };

  // Draw Table Header
  page.drawRectangle({
    x: margin,
    y: currentY - 10,
    width: usableWidth,
    height: 35,
    color: rgb(0, 0, 0),
  });

  headers.forEach((header, i) => {
    page.drawText(header.toUpperCase(), {
      x: getColX(i) + 5,
      y: currentY + 4,
      size: 9,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
  });
  currentY -= 50;

  // Draw Data Rows
  const fontSize = 8.5;
  for (let idx = 0; idx < tasks.length; idx++) {
    const t = tasks[idx];
    const rowData = [
      (idx + 1).toString(),
      `${t.siteAddressStreet || ''}\n${t.title || ''}`,
      t.workItemType || '',
      t.overallWorkStatus || '',
      t.priority || '',
      t.source || ''
    ];

    if (config.includePOC) rowData.push(t.pocName || '—');
    if (config.includeSurvey) rowData.push(t.surveyRequired ? `${t.surveyStatus}\nBy: ${t.surveyHandler}` : 'N/A');
    if (config.includePermit) rowData.push(t.permitRequired ? `${t.permitStatus}\nBy: ${t.permitHandler}` : 'N/A');
    if (config.includeMaterials) {
      const matStr = t.materialsRequired && t.materialsList 
        ? t.materialsList.map((m: any) => `${m.name} (x${m.quantity})`).join(', ')
        : 'None';
      rowData.push(matStr);
    }
    if (config.includeShipping) rowData.push(t.shipmentRequired ? t.shipmentStatus || 'Pending' : 'N/A');
    
    rowData.push(
      t.createdAt ? format(new Date(t.createdAt), 'yyyy-MM-dd') : '—',
      t.dateInitiated || '—',
      t.dateCompleted || 'Not Completed'
    );

    rowData.forEach((text, i) => {
      const colWidth = weights[i] * unitWidth - gutter;
      const lines = text.split('\n');
      
      lines.forEach((line, lineIdx) => {
        let displayLine = line;
        if (font.widthOfTextAtSize(displayLine, fontSize) > colWidth) {
           while (font.widthOfTextAtSize(displayLine + '...', fontSize) > colWidth && displayLine.length > 0) {
             displayLine = displayLine.slice(0, -1);
           }
           displayLine += '...';
        }

        page.drawText(displayLine, {
          x: getColX(i) + 5,
          y: currentY - lineIdx * 12,
          size: fontSize,
          font: (lineIdx === 0 && (i === 1)) ? fontBold : font,
          color: rgb(0, 0, 0),
        });
      });
    });

    page.drawLine({
      start: { x: margin, y: currentY - 35 },
      end: { x: pageWidth - margin, y: currentY - 35 },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.85),
    });

    currentY -= rowHeight;
  }

  // OPERATIONAL SUMMARY at Bottom
  if (config.summaryStats) {
    currentY -= 40;
    page.drawText('SUMMARY', {
      x: margin,
      y: currentY,
      size: 16,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    currentY -= 45;

    const s = config.summaryStats;
    const metrics = [
      { label: 'TOTAL ITEMS', value: s.total.toString() },
      { label: 'COMPLETION RATE', value: `${s.successRate}%` },
      { label: 'PENDING ITEMS', value: s.active.toString() },
      { 
        label: 'SURVEY PHASE', 
        value: `${s.surveys.total} Total Items`, 
        sub: `Pending: ${s.surveys.pending} / Completed: ${s.surveys.completed}` 
      },
      { 
        label: 'PERMIT STATUS', 
        value: `${s.permits.total} Total Items`, 
        sub: `Pending: ${s.permits.pending} / Approved: ${s.permits.approved}` 
      },
      { 
        label: 'SHIPMENT STATUS', 
        value: `${s.shipments.total} Total Items`, 
        sub: `Pending: ${s.shipments.pending} / Delivered: ${s.shipments.delivered}` 
      },
    ];

    const boxWidth = (pageWidth - margin * 2) / metrics.length;
    metrics.forEach((m, i) => {
      const x = margin + i * boxWidth;
      page.drawText(m.label, { x: x + 10, y: currentY, size: 9, font: fontBold, color: rgb(0.4, 0.4, 0.4) });
      page.drawText(m.value, { x: x + 10, y: currentY - 25, size: 16, font: fontBold, color: rgb(0, 0, 0) });
      if (m.sub) {
        page.drawText(m.sub, { x: x + 10, y: currentY - 45, size: 8, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
      }
    });
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}
