import { NextResponse } from 'next/server';
import {
  getOperations, getOperationById, addOperation, updateOperation, deleteOperation,
  type OperationFilters
} from '@/lib/db-warehouse';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const operation = getOperationById(parseInt(id));
      if (!operation) return NextResponse.json({ error: 'Операция не найдена' }, { status: 404 });
      return NextResponse.json(operation);
    }

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

    const operations = getOperations(Object.keys(filters).length > 0 ? filters : undefined);
    return NextResponse.json(operations);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, materialId, quantity, date, document, employeeId, object, address } = body;

    if (!type || !materialId || !quantity || !date) {
      return NextResponse.json({ error: 'Тип, материал, количество и дата обязательны' }, { status: 400 });
    }

    // Support batch operations (multiple materials in one operation)
    const items = Array.isArray(body.items) ? body.items : [{ materialId, quantity }];

    for (const item of items) {
      const result = addOperation({
        type,
        materialId: item.materialId,
        quantity: item.quantity,
        date,
        document,
        employeeId,
        object,
        address,
      });
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, type, materialId, quantity, date, document, employeeId, object, address } = body;
    if (!id) return NextResponse.json({ error: 'ID обязателен' }, { status: 400 });
    const result = updateOperation(id, { type, materialId, quantity, date, document, employeeId, object, address });
    if (result.success) return NextResponse.json({ success: true });
    return NextResponse.json({ error: result.error }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '');
    if (!id) return NextResponse.json({ error: 'ID обязателен' }, { status: 400 });
    const result = deleteOperation(id);
    if (result.success) return NextResponse.json({ success: true });
    return NextResponse.json({ error: result.error }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
