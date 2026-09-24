import { NextResponse } from 'next/server';
import { checkOperationBalance, type BalanceCheckResult } from '@/lib/db-warehouse';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, materialId, quantity, editId } = body;

    if (!type || !materialId || !quantity) {
      return NextResponse.json(
        { error: 'Тип, материал и количество обязательны' },
        { status: 400 }
      );
    }

    const result = checkOperationBalance({
      type,
      materialId,
      quantity,
      editId: editId || undefined,
    });

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
