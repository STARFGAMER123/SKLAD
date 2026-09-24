import { NextResponse } from 'next/server';
import { importFromPythonDb } from '@/lib/db-warehouse';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Файл не загружен' }, { status: 400 });
    }

    if (!file.name.endsWith('.db')) {
      return NextResponse.json({ error: 'Файл должен иметь расширение .db' }, { status: 400 });
    }

    // Save uploaded file to temp directory
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const tempDir = os.tmpdir();
    const tempPath = path.join(tempDir, `sklad_import_${Date.now()}.db`);

    fs.writeFileSync(tempPath, buffer);

    // Import from the temp file
    const result = importFromPythonDb(tempPath);

    // Clean up temp file
    try { fs.unlinkSync(tempPath); } catch { /* ignore */ }

    if (result.success) {
      return NextResponse.json({ success: true, imported: result.imported });
    }
    return NextResponse.json({ error: result.error }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
