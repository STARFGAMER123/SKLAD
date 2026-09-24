import { NextResponse } from 'next/server';
import {
  getCurrentDbPath, switchDatabase, createDatabase, backupDatabase,
  importFromPythonDb, exportToPythonDb, getDatabaseStats, getDataDirectory
} from '@/lib/db-warehouse';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const stats = getDatabaseStats();
    return NextResponse.json(stats);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, path: filePath } = body;

    switch (action) {
      case 'switch': {
        if (!filePath) return NextResponse.json({ error: 'Путь не указан' }, { status: 400 });
        const result = switchDatabase(filePath);
        if (result.success) return NextResponse.json({ success: true, dbPath: getCurrentDbPath() });
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      case 'create': {
        if (!filePath) return NextResponse.json({ error: 'Путь не указан' }, { status: 400 });
        const result = createDatabase(filePath);
        if (result.success) return NextResponse.json({ success: true, dbPath: getCurrentDbPath() });
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      case 'backup': {
        const dataDir = getDataDirectory();
        const backupDir = path.join(dataDir, 'backups');
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const dbFileName = path.basename(getCurrentDbPath(), '.db');
        const backupPath = path.join(backupDir, `${dbFileName}_backup_${timestamp}.db`);
        const result = backupDatabase(backupPath);
        if (result.success) return NextResponse.json({ success: true, backupPath });
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      case 'import-python': {
        if (!filePath) return NextResponse.json({ error: 'Путь не указан' }, { status: 400 });
        const result = importFromPythonDb(filePath);
        if (result.success) return NextResponse.json({ success: true, imported: result.imported });
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      case 'export-python': {
        const dataDir = getDataDirectory();
        const exportDir = path.join(dataDir, 'exports');
        if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const exportPath = filePath || path.join(exportDir, `warehouse_export_${timestamp}.db`);
        const result = exportToPythonDb(exportPath);
        if (result.success) return NextResponse.json({ success: true, exportPath });
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      default:
        return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
