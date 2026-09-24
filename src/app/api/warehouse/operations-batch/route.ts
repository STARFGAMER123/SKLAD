import { NextResponse } from 'next/server';
import { getOperationsByBatch } from '@/lib/db-warehouse';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const address = searchParams.get('address');

    if (!date) {
      return NextResponse.json({ error: 'Дата обязательна' }, { status: 400 });
    }

    const operations = getOperationsByBatch(date, address || null);
    return NextResponse.json(operations);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
