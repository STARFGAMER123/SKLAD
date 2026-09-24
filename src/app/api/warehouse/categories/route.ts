import { NextResponse } from 'next/server';
import { getCategories, addCategory, updateCategory, deleteCategory } from '@/lib/db-warehouse';

export async function GET() {
  try {
    const categories = getCategories();
    return NextResponse.json(categories);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description } = body;
    if (!name) return NextResponse.json({ error: 'Название обязательно' }, { status: 400 });
    const result = addCategory(name, description);
    if (result.success) return NextResponse.json({ success: true });
    return NextResponse.json({ error: result.error }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, description } = body;
    if (!id || !name) return NextResponse.json({ error: 'ID и название обязательны' }, { status: 400 });
    const result = updateCategory(id, name, description);
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
    const result = deleteCategory(id);
    if (result.success) return NextResponse.json({ success: true });
    return NextResponse.json({ error: result.error }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
