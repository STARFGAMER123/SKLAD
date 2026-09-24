import { NextResponse } from 'next/server';
import { getBalances } from '@/lib/db-warehouse';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const endDate = searchParams.get('endDate') || undefined;
    const balances = getBalances(endDate);
    return NextResponse.json(balances);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
