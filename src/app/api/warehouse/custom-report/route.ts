import { NextRequest, NextResponse } from 'next/server';
import { getFilteredBalances, getMaterialIdsByCategories, getMaterials, getCategories } from '@/lib/db-warehouse';
import ExcelJS from 'exceljs';

// ─── Color Palette ────────────────────────────────────────────────────────────
const C = {
  primary:       '1B2A4A',
  primaryLight:  'D6E4F0',
  secondary:     '4A5568',
  white:         'FFFFFF',
  offWhite:      'F7F8FA',
  altRow:        'EEF2F7',
  greenDark:     '166534',
  greenLight:    'DCFCE7',
  redDark:       '991B1B',
  redLight:      'FEE2E2',
  grayDark:      '374151',
  grayMed:       '6B7280',
  grayLight:     'D1D5DB',
  grayXLight:    'F3F4F6',
  catHeaderBg:   'E2E8F0',
  catHeaderFg:   '334155',
  amberBg:       'FEF3C7',
  amberFg:       '92400E',
};

// ─── GET: Return JSON data for preview ───────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endDate = searchParams.get('endDate') || undefined;
    const materialIdsParam = searchParams.get('materialIds') || '';
    const categoryIdsParam = searchParams.get('categoryIds') || '';

    const materialIds = materialIdsParam
      ? materialIdsParam.split(',').map(Number).filter(n => !isNaN(n))
      : [];
    const categoryIds = categoryIdsParam
      ? categoryIdsParam.split(',').map(Number).filter(n => !isNaN(n))
      : [];

    // Merge: selected materials + all materials from selected categories
    const categoryMaterialIds = getMaterialIdsByCategories(categoryIds);
    const allIds = [...new Set([...materialIds, ...categoryMaterialIds])];

    const balances = getFilteredBalances(allIds, endDate);

    return NextResponse.json({
      balances,
      materialCount: allIds.length,
      categoryCount: categoryIds.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ─── POST: Generate formatted Excel file ─────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endDate, materialIds = [], categoryIds = [] } = body as {
      endDate?: string;
      materialIds: number[];
      categoryIds: number[];
    };

    // Merge: selected materials + all materials from selected categories
    const categoryMaterialIds = getMaterialIdsByCategories(categoryIds);
    const allIds = [...new Set([...materialIds, ...categoryMaterialIds])];

    if (allIds.length === 0) {
      return NextResponse.json({ error: 'Не выбрано ни одного оборудования' }, { status: 400 });
    }

    const balances = getFilteredBalances(allIds, endDate);
    const dateStr = endDate || new Date().toISOString().slice(0, 10);

    // Resolve category/material names for the header
    const allCategories = getCategories();
    const allMaterials = getMaterials();
    const selectedCategoryNames = allCategories
      .filter(c => categoryIds.includes(c.id))
      .map(c => c.name);
    const selectedMaterialNames = allMaterials
      .filter(m => materialIds.includes(m.id) && !categoryIds.includes(m.category_id ?? -1))
      .map(m => m.name);

    // ── Build workbook ──
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SKLAD';
    wb.created = new Date();

    const ws = wb.addWorksheet('Настраиваемый отчёт', {
      properties: { tabColor: { argb: C.primary } },
      pageSetup: {
        paperSize: 9,
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
      },
    });

    // Column widths
    ws.getColumn(1).width = 4;   // margin
    ws.getColumn(2).width = 28;  // category
    ws.getColumn(3).width = 40;  // material
    ws.getColumn(4).width = 16;  // balance

    // ── Styles ──
    const titleStyle = {
      font: { name: 'Arial', size: 16, bold: true, color: { argb: C.primary } },
    };
    const subtitleStyle = {
      font: { name: 'Arial', size: 10, color: { argb: C.grayMed } },
    };
    const labelStyle = {
      font: { name: 'Arial', size: 10, bold: true, color: { argb: C.secondary } },
    };
    const valueStyle = {
      font: { name: 'Arial', size: 10, color: { argb: C.grayDark } },
    };
    const headerStyle = {
      font: { name: 'Arial', size: 10, bold: true, color: { argb: C.white } },
      fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: C.primary } },
      alignment: { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true },
      border: {
        bottom: { style: 'medium', color: { argb: C.primary } },
        top: { style: 'thin', color: { argb: C.primaryLight } },
      },
    };
    const catHeaderStyle = {
      font: { name: 'Arial', size: 10, bold: true, color: { argb: C.catHeaderFg } },
      fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: C.catHeaderBg } },
      alignment: { vertical: 'middle' as const },
    };
    const bodyStyle = {
      font: { name: 'Arial', size: 10, color: { argb: C.grayDark } },
      alignment: { vertical: 'middle' as const },
    };
    const bodyRightStyle = {
      ...bodyStyle,
      alignment: { horizontal: 'right' as const, vertical: 'middle' as const },
      numFmt: '#,##0',
    };
    const greenStyle = {
      ...bodyRightStyle,
      font: { name: 'Arial', size: 10, bold: true, color: { argb: C.greenDark } },
    };
    const redStyle = {
      ...bodyRightStyle,
      font: { name: 'Arial', size: 10, bold: true, color: { argb: C.redDark } },
    };
    const grayStyle = {
      ...bodyRightStyle,
      font: { name: 'Arial', size: 10, color: { argb: C.grayMed } },
    };
    const totalStyle = {
      font: { name: 'Arial', size: 11, bold: true, color: { argb: C.primary } },
      fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: C.primaryLight } },
      alignment: { vertical: 'middle' as const },
      border: {
        top: { style: 'medium', color: { argb: C.primary } },
        bottom: { style: 'double', color: { argb: C.primary } },
      },
    };
    const totalRightStyle = {
      ...totalStyle,
      alignment: { horizontal: 'right' as const, vertical: 'middle' as const },
      numFmt: '#,##0',
    };

    // ── Header section ──
    let row = 1;

    // Row 1: Spacer
    ws.getRow(row++).height = 6;

    // Row 2: Title
    ws.getRow(row).height = 32;
    Object.assign(ws.getCell(row, 2), { value: 'SKLAD — Настраиваемый отчёт' }, titleStyle);
    row++;

    // Row 3: Date
    ws.getRow(row).height = 20;
    Object.assign(ws.getCell(row, 2), { value: `Остатки по состоянию на: ${dateStr}` }, subtitleStyle);
    row++;

    // Row 4: Categories included
    if (selectedCategoryNames.length > 0) {
      ws.getRow(row).height = 18;
      Object.assign(ws.getCell(row, 2), { value: 'Категории:' }, labelStyle);
      Object.assign(ws.getCell(row, 3), { value: selectedCategoryNames.join(', ') }, valueStyle);
      row++;
    }

    // Row 5: Individual materials included
    if (selectedMaterialNames.length > 0) {
      ws.getRow(row).height = 18;
      Object.assign(ws.getCell(row, 2), { value: 'Оборудование:' }, labelStyle);
      Object.assign(ws.getCell(row, 3), { value: selectedMaterialNames.join(', ') }, valueStyle);
      row++;
    }

    // Row: Total count
    ws.getRow(row).height = 18;
    Object.assign(ws.getCell(row, 2), { value: 'Всего позиций:' }, labelStyle);
    Object.assign(ws.getCell(row, 3), { value: `${balances.length} ед. оборудования` }, valueStyle);
    row++;

    // Spacer
    ws.getRow(row++).height = 8;

    // Table header
    const headerRow = row;
    ws.getRow(row).height = 26;
    ['Категория', 'Оборудование', 'Остаток'].forEach((val, i) => {
      Object.assign(ws.getCell(row, i + 2), { value: val }, headerStyle);
    });
    row++;

    // Group balances by category
    const groups = new Map<string, typeof balances>();
    for (const b of balances) {
      const cat = b.category_name || 'Без категории';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(b);
    }
    const sortedCats = Array.from(groups.keys()).sort();

    let totalPositive = 0;
    let totalNegative = 0;
    let totalZero = 0;
    let grandTotal = 0;

    for (const cat of sortedCats) {
      const items = groups.get(cat)!;

      // Category header
      ws.getRow(row).height = 22;
      Object.assign(ws.getCell(row, 2), { value: `${cat}  (${items.length} поз.)` }, catHeaderStyle);
      for (const col of [3, 4]) {
        ws.getCell(row, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.catHeaderBg } };
      }
      row++;

      // Material rows
      for (const item of items) {
        const isOdd = (row - headerRow) % 2 === 0;
        const rowBg = isOdd ? C.altRow : C.white;
        const fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: rowBg } };
        const thinBorder = { bottom: { style: 'hair' as const, color: { argb: C.grayLight } } };

        ws.getRow(row).height = 20;

        // Category
        Object.assign(ws.getCell(row, 2), { value: item.category_name || '' }, bodyStyle, { fill, border: thinBorder });

        // Material
        Object.assign(ws.getCell(row, 3), { value: item.material_name }, bodyStyle, { fill, border: thinBorder });

        // Balance
        const bc = ws.getCell(row, 4);
        bc.value = item.balance;
        if (item.balance > 0) {
          Object.assign(bc, greenStyle, { fill, border: thinBorder });
          totalPositive++;
          grandTotal += item.balance;
        } else if (item.balance < 0) {
          Object.assign(bc, redStyle, { fill, border: thinBorder });
          totalNegative++;
          grandTotal += item.balance;
        } else {
          Object.assign(bc, grayStyle, { fill, border: thinBorder });
          totalZero++;
        }

        row++;
      }
    }

    // Spacer
    ws.getRow(row++).height = 6;

    // Totals
    ws.getRow(row).height = 26;
    Object.assign(ws.getCell(row, 2), { value: 'ИТОГО' }, totalStyle);
    Object.assign(ws.getCell(row, 3), { value: `${totalPositive} (+)  ·  ${totalNegative} (−)  ·  ${totalZero} (=)` }, totalStyle);
    Object.assign(ws.getCell(row, 4), { value: grandTotal }, totalRightStyle);

    // Freeze panes
    ws.views = [{ state: 'frozen', ySplit: headerRow, xSplit: 0, activeCell: 'B' + (headerRow + 1) }];

    // Print area
    ws.printArea = `B1:D${row}`;

    // Generate buffer
    const buffer = await wb.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="SKLAD_custom_report_${dateStr}.xlsx"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
