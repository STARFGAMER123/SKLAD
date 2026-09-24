import { NextResponse } from 'next/server';
import { getBalances, getOperations, getCategories } from '@/lib/db-warehouse';
import ExcelJS from 'exceljs';

// ─── Color Palette (professional, matching SKLAD theme) ─────────────────────

const C = {
  primary:       '1B2A4A',
  primaryLight:  'D6E4F0',
  secondary:     '4A5568',
  white:         'FFFFFF',
  offWhite:      'F7F8FA',
  altRow:        'EEF2F7',
  greenDark:     '166534',
  greenLight:    'DCFCE7',
  greenMed:      'BBF7D0',
  redDark:       '991B1B',
  redLight:      'FEE2E2',
  redMed:        'FECACA',
  amberDark:     '92400E',
  amberLight:    'FEF3C7',
  grayDark:      '374151',
  grayMed:       '6B7280',
  grayLight:     'D1D5DB',
  grayXLight:    'F3F4F6',
  catHeaderBg:   'E2E8F0',
  catHeaderFg:   '334155',
};

// ─── Shared Styles Factory ───────────────────────────────────────────────────

function createStyles() {
  const headerFont: Partial<ExcelJS.Style> = {
    font: { name: 'Arial', size: 10, bold: true, color: { argb: C.white } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.primary } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: {
      bottom: { style: 'medium', color: { argb: C.primary } },
      top: { style: 'thin', color: { argb: C.primaryLight } },
    },
  };

  const titleFont: Partial<ExcelJS.Style> = {
    font: { name: 'Arial', size: 16, bold: true, color: { argb: C.primary } },
  };

  const subtitleFont: Partial<ExcelJS.Style> = {
    font: { name: 'Arial', size: 10, color: { argb: C.grayMed } },
  };

  const bodyFont: Partial<ExcelJS.Style> = {
    font: { name: 'Arial', size: 10, color: { argb: C.grayDark } },
    alignment: { vertical: 'middle' },
  };

  const bodyFontCenter: Partial<ExcelJS.Style> = {
    ...bodyFont,
    alignment: { horizontal: 'center', vertical: 'middle' },
  };

  const bodyFontRight: Partial<ExcelJS.Style> = {
    ...bodyFont,
    alignment: { horizontal: 'right', vertical: 'middle' },
    numFmt: '#,##0',
  };

  const catHeaderFont: Partial<ExcelJS.Style> = {
    font: { name: 'Arial', size: 10, bold: true, color: { argb: C.catHeaderFg } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.catHeaderBg } },
    alignment: { vertical: 'middle' },
  };

  const greenFont: Partial<ExcelJS.Style> = {
    ...bodyFontRight,
    font: { name: 'Arial', size: 10, bold: true, color: { argb: C.greenDark } },
  };

  const redFont: Partial<ExcelJS.Style> = {
    ...bodyFontRight,
    font: { name: 'Arial', size: 10, bold: true, color: { argb: C.redDark } },
  };

  const grayFont: Partial<ExcelJS.Style> = {
    ...bodyFontRight,
    font: { name: 'Arial', size: 10, color: { argb: C.grayMed } },
  };

  const thinBorder: Partial<ExcelJS.Style> = {
    border: {
      bottom: { style: 'thin', color: { argb: C.grayXLight } },
    },
  };

  const totalFont: Partial<ExcelJS.Style> = {
    font: { name: 'Arial', size: 11, bold: true, color: { argb: C.primary } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.primaryLight } },
    alignment: { vertical: 'middle' },
    border: {
      top: { style: 'medium', color: { argb: C.primary } },
      bottom: { style: 'double', color: { argb: C.primary } },
    },
  };

  const totalFontRight: Partial<ExcelJS.Style> = {
    ...totalFont,
    alignment: { horizontal: 'right', vertical: 'middle' },
    numFmt: '#,##0',
  };

  return {
    headerFont, titleFont, subtitleFont, bodyFont, bodyFontCenter, bodyFontRight,
    catHeaderFont, greenFont, redFont, grayFont, thinBorder, totalFont, totalFontRight,
  };
}

// ─── Balances Sheet ──────────────────────────────────────────────────────────

function buildBalancesSheet(
  wb: ExcelJS.Workbook,
  balances: { category_name: string | null; material_name: string; balance: number }[],
  endDate: string,
  styles: ReturnType<typeof createStyles>,
) {
  const ws = wb.addWorksheet('Остатки', {
    properties: { tabColor: { argb: C.primary } },
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
    },
  });

  // Group by category
  const groups = new Map<string, typeof balances>();
  for (const b of balances) {
    const cat = b.category_name || 'Без категории';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(b);
  }
  const sortedCats = Array.from(groups.keys()).sort();

  // Column widths
  ws.getColumn(1).width = 4;   // margin
  ws.getColumn(2).width = 28;  // category
  ws.getColumn(3).width = 40;  // material
  ws.getColumn(4).width = 16;  // balance

  // Row 1: Spacer
  ws.getRow(1).height = 6;

  // Row 2: Title
  const r2 = ws.getRow(2);
  r2.height = 32;
  const c2 = ws.getCell(2, 2);
  c2.value = 'SKLAD — Остатки материалов';
  Object.assign(c2, styles.titleFont);

  // Row 3: Subtitle with date
  const r3 = ws.getRow(3);
  r3.height = 20;
  const c3 = ws.getCell(3, 2);
  c3.value = `По состоянию на ${endDate}`;
  Object.assign(c3, styles.subtitleFont);

  // Row 4: Spacer
  ws.getRow(4).height = 8;

  // Row 5: Table header
  const hr = ws.getRow(5);
  hr.height = 26;
  const hCells = ['Категория', 'Материал', 'Остаток'];
  const hCols = [2, 3, 4];
  hCells.forEach((val, i) => {
    const cell = ws.getCell(5, hCols[i]);
    cell.value = val;
    Object.assign(cell, styles.headerFont);
  });

  // Data rows
  let rowNum = 6;
  let totalPositive = 0;
  let totalNegative = 0;
  let totalZero = 0;

  for (const cat of sortedCats) {
    const items = groups.get(cat)!;

    // Category header row
    const catRow = ws.getRow(rowNum);
    catRow.height = 22;
    const catCell = ws.getCell(rowNum, 2);
    catCell.value = `${cat}  (${items.length} поз.)`;
    Object.assign(catCell, styles.catHeaderFont);
    ws.getCell(rowNum, 3);
    ws.getCell(rowNum, 4);
    // Extend cat header bg across columns
    for (const col of [3, 4]) {
      const cell = ws.getCell(rowNum, col);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.catHeaderBg } };
    }
    rowNum++;

    // Material rows
    for (const item of items) {
      const isOdd = (rowNum - 6) % 2 === 1;
      const rowBg = isOdd ? C.altRow : C.white;

      // Category
      const cc = ws.getCell(rowNum, 2);
      cc.value = item.category_name || '';
      Object.assign(cc, styles.bodyFont, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } } });

      // Material
      const mc = ws.getCell(rowNum, 3);
      mc.value = item.material_name;
      Object.assign(mc, styles.bodyFont, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } } });

      // Balance
      const bc = ws.getCell(rowNum, 4);
      bc.value = item.balance;
      if (item.balance > 0) {
        Object.assign(bc, styles.greenFont, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } } });
        totalPositive++;
      } else if (item.balance < 0) {
        Object.assign(bc, styles.redFont, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } } });
        totalNegative++;
      } else {
        Object.assign(bc, styles.grayFont, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } } });
        totalZero++;
      }

      // Thin bottom border
      for (const col of [2, 3, 4]) {
        ws.getCell(rowNum, col).border = {
          bottom: { style: 'hair', color: { argb: C.grayLight } },
        };
      }

      ws.getRow(rowNum).height = 20;
      rowNum++;
    }
  }

  // Spacer
  ws.getRow(rowNum).height = 6;
  rowNum++;

  // Totals row
  const tr = ws.getRow(rowNum);
  tr.height = 26;

  const tc1 = ws.getCell(rowNum, 2);
  tc1.value = 'ИТОГО';
  Object.assign(tc1, styles.totalFont);

  const tc2 = ws.getCell(rowNum, 3);
  tc2.value = `${totalPositive} поз. (+)  ·  ${totalNegative} поз. (−)  ·  ${totalZero} поз. (=)`;
  Object.assign(tc2, styles.totalFont);

  const tc3 = ws.getCell(rowNum, 4);
  tc3.value = balances.length;
  Object.assign(tc3, styles.totalFontRight);

  // Freeze panes
  ws.views = [{ state: 'frozen', ySplit: 5, xSplit: 0, activeCell: 'B6' }];

  // Print area
  ws.printArea = `B1:D${rowNum}`;
}

// ─── Operations Sheet ────────────────────────────────────────────────────────

function buildOperationsSheet(
  wb: ExcelJS.Workbook,
  operations: {
    id: number; date: string; type: string; document: string | null;
    object: string | null; address: string | null; material: string;
    quantity: number; employee: string | null; balance: number;
  }[],
  endDate: string | undefined,
  styles: ReturnType<typeof createStyles>,
) {
  const ws = wb.addWorksheet('Операции', {
    properties: { tabColor: { argb: C.secondary } },
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
    },
  });

  // Column widths
  ws.getColumn(1).width = 4;   // margin
  ws.getColumn(2).width = 7;   // ID
  ws.getColumn(3).width = 13;  // date
  ws.getColumn(4).width = 9;   // type
  ws.getColumn(5).width = 18;  // document
  ws.getColumn(6).width = 18;  // object
  ws.getColumn(7).width = 26;  // address
  ws.getColumn(8).width = 30;  // material
  ws.getColumn(9).width = 11;  // quantity
  ws.getColumn(10).width = 20; // employee
  ws.getColumn(11).width = 12; // balance

  // Row 1: Spacer
  ws.getRow(1).height = 6;

  // Row 2: Title
  const r2 = ws.getRow(2);
  r2.height = 32;
  const c2 = ws.getCell(2, 2);
  c2.value = 'SKLAD — Журнал операций';
  Object.assign(c2, styles.titleFont);

  // Row 3: Subtitle
  const r3 = ws.getRow(3);
  r3.height = 20;
  const c3 = ws.getCell(3, 2);
  c3.value = endDate ? `По состоянию на ${endDate}  ·  ${operations.length} записей` : `${operations.length} записей`;
  Object.assign(c3, styles.subtitleFont);

  // Row 4: Spacer
  ws.getRow(4).height = 8;

  // Row 5: Table header
  const hr = ws.getRow(5);
  hr.height = 26;
  const headers = ['ID', 'Дата', 'Тип', 'Документ', 'Объект', 'Адрес', 'Материал', 'Кол-во', 'Сотрудник', 'Остаток'];
  headers.forEach((val, i) => {
    const cell = ws.getCell(5, i + 2);
    cell.value = val;
    Object.assign(cell, styles.headerFont);
  });

  // Data rows
  let rowNum = 6;
  for (let idx = 0; idx < operations.length; idx++) {
    const op = operations[idx];
    const isOdd = idx % 2 === 1;
    const rowBg = isOdd ? C.altRow : C.white;
    const isIncoming = op.type === 'приход';

    const row = ws.getRow(rowNum);
    row.height = 19;

    // Common base style
    const baseFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: rowBg } };
    const commonBorder = { bottom: { style: 'hair' as const, color: { argb: C.grayLight } } };

    // ID
    const cId = ws.getCell(rowNum, 2);
    cId.value = op.id;
    Object.assign(cId, styles.bodyFontCenter, { fill: baseFill, border: commonBorder });

    // Date
    const cDate = ws.getCell(rowNum, 3);
    cDate.value = op.date;
    Object.assign(cDate, styles.bodyFontCenter, { fill: baseFill, border: commonBorder });

    // Type badge (colored cell)
    const cType = ws.getCell(rowNum, 4);
    cType.value = op.type;
    if (isIncoming) {
      Object.assign(cType, {
        font: { name: 'Arial', size: 9, bold: true, color: { argb: C.greenDark } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.greenLight } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: commonBorder,
      });
    } else {
      Object.assign(cType, {
        font: { name: 'Arial', size: 9, bold: true, color: { argb: C.redDark } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.redLight } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: commonBorder,
      });
    }

    // Document
    const cDoc = ws.getCell(rowNum, 5);
    cDoc.value = op.document || '';
    Object.assign(cDoc, styles.bodyFont, { fill: baseFill, border: commonBorder });

    // Object
    const cObj = ws.getCell(rowNum, 6);
    cObj.value = op.object || '';
    Object.assign(cObj, styles.bodyFont, { fill: baseFill, border: commonBorder });

    // Address
    const cAddr = ws.getCell(rowNum, 7);
    cAddr.value = op.address || '';
    Object.assign(cAddr, styles.bodyFont, { fill: baseFill, border: commonBorder });

    // Material
    const cMat = ws.getCell(rowNum, 8);
    cMat.value = op.material;
    Object.assign(cMat, styles.bodyFont, { fill: baseFill, border: commonBorder });

    // Quantity
    const cQty = ws.getCell(rowNum, 9);
    cQty.value = op.quantity;
    if (isIncoming) {
      Object.assign(cQty, styles.greenFont, { fill: baseFill, border: commonBorder });
    } else {
      Object.assign(cQty, styles.redFont, { fill: baseFill, border: commonBorder });
    }

    // Employee
    const cEmp = ws.getCell(rowNum, 10);
    cEmp.value = op.employee || '';
    Object.assign(cEmp, styles.bodyFont, { fill: baseFill, border: commonBorder });

    // Balance
    const cBal = ws.getCell(rowNum, 11);
    cBal.value = op.balance;
    if (op.balance > 0) {
      Object.assign(cBal, styles.greenFont, { fill: baseFill, border: commonBorder });
    } else if (op.balance < 0) {
      Object.assign(cBal, styles.redFont, { fill: baseFill, border: commonBorder });
    } else {
      Object.assign(cBal, styles.grayFont, { fill: baseFill, border: commonBorder });
    }

    rowNum++;
  }

  // Freeze panes
  ws.views = [{ state: 'frozen', ySplit: 5, xSplit: 0, activeCell: 'B6' }];

  // Print area
  ws.printArea = `B1:K${rowNum - 1}`;
}

// ─── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'balances';
    const endDate = searchParams.get('endDate') || undefined;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'SKLAD';
    wb.created = new Date();

    const styles = createStyles();

    if (mode === 'balances' || mode === 'both') {
      const balances = getBalances(endDate);
      buildBalancesSheet(wb, balances, endDate || new Date().toISOString().slice(0, 10), styles);
    }

    if (mode === 'operations' || mode === 'both') {
      const operations = getOperations(endDate ? { end_date: endDate } : undefined);
      buildOperationsSheet(wb, operations as any, endDate, styles);
    }

    const buffer = await wb.xlsx.writeBuffer();

    const filename = mode === 'operations'
      ? `SKLAD_operations_${endDate || 'all'}.xlsx`
      : mode === 'both'
        ? `SKLAD_report_${endDate || 'all'}.xlsx`
        : `SKLAD_balances_${endDate || 'all'}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
