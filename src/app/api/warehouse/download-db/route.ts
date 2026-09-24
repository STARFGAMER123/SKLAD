import { NextResponse } from 'next/server';
import { exportToPythonDb, getCurrentDbPath } from '@/lib/db-warehouse';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function GET() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const tempDir = os.tmpdir();
    const tempPath = path.join(tempDir, `sklad_export_${timestamp}.db`);

    const result = exportToPythonDb(tempPath);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Read the exported file and return as download
    const fileBuffer = fs.readFileSync(tempPath);

    // Clean up temp file
    try { fs.unlinkSync(tempPath); } catch { /* ignore */ }

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/x-sqlite3',
        'Content-Disposition': `attachment; filename="warehouse_export_${timestamp}.db"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
