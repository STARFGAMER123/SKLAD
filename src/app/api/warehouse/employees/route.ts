import { NextResponse } from 'next/server';
import { getEmployees, addEmployee, updateEmployee, deleteEmployee } from '@/lib/db-warehouse';

export async function GET() {
  try {
    const employees = getEmployees();
    return NextResponse.json(employees);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fullName, position } = body;
    if (!fullName) return NextResponse.json({ error: 'ФИО обязательно' }, { status: 400 });
    const result = addEmployee(fullName, position);
    if (result.success) return NextResponse.json({ success: true });
    return NextResponse.json({ error: result.error }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, fullName, position } = body;
    if (!id || !fullName) return NextResponse.json({ error: 'ID и ФИО обязательны' }, { status: 400 });
    const result = updateEmployee(id, fullName, position);
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
    const result = deleteEmployee(id);
    if (result.success) return NextResponse.json({ success: true });
    return NextResponse.json({ error: result.error }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
