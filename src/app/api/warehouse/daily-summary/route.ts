import { NextResponse } from 'next/server';
import {
  getDailySummary,
  type OperationFilters
} from '@/lib/db-warehouse';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const filters: OperationFilters = {};
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');
    const type = searchParams.get('type');
    const material = searchParams.get('material');
    const address = searchParams.get('address');
    const object = searchParams.get('object');
    const document = searchParams.get('document');

    if (start_date) filters.start_date = start_date;
    if (end_date) filters.end_date = end_date;
    if (type) filters.type = type;
    if (material) filters.material = material;
    if (address) filters.address = address;
    if (object) filters.object = object;
    if (document) filters.document = document;

    const summary = getDailySummary(Object.keys(filters).length > 0 ? filters : undefined);
    return NextResponse.json(summary);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
