import { NextResponse } from 'next/server';
import { getMaterials, getBalances, getOperations, getCategories } from '@/lib/db-warehouse';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    const endDate = searchParams.get('endDate') || undefined;

    if (format === 'csv-operations') {
      const operations = getOperations(endDate ? { end_date: endDate } : undefined);
      const csv = [
        'ID;Дата;Тип;Объект;Адрес;Материал;Количество;Сотрудник;Остаток',
        ...operations.map(o =>
          `${o.id};${o.date};${o.type};${o.object || ''};${o.address || ''};${o.material};${o.quantity};${o.employee || ''};${o.balance || 0}`
        )
      ].join('\n');
      return new NextResponse('\uFEFF' + csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="operations_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    // CSV balances export
    const balances = getBalances(endDate);
    const csv = [
      'Категория;Материал;Остаток',
      ...balances.map(b => `"${b.category_name || ''}";"${b.material_name}";${b.balance}`)
    ].join('\n');
    return new NextResponse('\uFEFF' + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="balances_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
