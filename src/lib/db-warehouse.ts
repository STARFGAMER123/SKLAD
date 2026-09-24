/**
 * SKLAD - Database layer using better-sqlite3
 * Full compatibility with Python SQLite database format
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// In Electron portable app, data is stored next to the .exe file.
// SKLAD_DATA_DIR is set by electron/main.js to the exe directory.
// In dev mode (no env var), fall back to project db/ folder.
function getDataDir(): string {
  const envDir = process.env.SKLAD_DATA_DIR;
  if (envDir) {
    if (!fs.existsSync(envDir)) fs.mkdirSync(envDir, { recursive: true });
    return envDir;
  }
  const cwd = path.join(process.cwd(), 'db');
  if (!fs.existsSync(cwd)) fs.mkdirSync(cwd, { recursive: true });
  return cwd;
}

const DEFAULT_DB_PATH = path.join(getDataDir(), 'warehouse.db');

let currentDbPath: string = DEFAULT_DB_PATH;
let db: Database.Database | null = null;

function getDb(dbPath?: string): Database.Database {
  const targetPath = dbPath || currentDbPath;
  if (db && currentDbPath === targetPath) {
    return db;
  }
  if (db) {
    db.close();
  }
  currentDbPath = targetPath;
  db = new Database(targetPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initializeSchema(db);
  return db;
}

function initializeSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER,
      description TEXT,
      FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL UNIQUE,
      position TEXT
    );

    CREATE TABLE IF NOT EXISTS operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      material_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      date TEXT NOT NULL,
      document TEXT,
      employee_id INTEGER,
      object TEXT,
      address TEXT,
      FOREIGN KEY(material_id) REFERENCES materials(id) ON DELETE RESTRICT,
      FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE SET NULL
    );
  `);
}

// ==================== Categories ====================

export interface Category {
  id: number;
  name: string;
  description: string | null;
}

export function getCategories(dbPath?: string): Category[] {
  return getDb(dbPath).prepare('SELECT * FROM categories ORDER BY id').all() as Category[];
}

export function getCategory(id: number, dbPath?: string): Category | undefined {
  return getDb(dbPath).prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category | undefined;
}

export function addCategory(name: string, description?: string, dbPath?: string): { success: boolean; error?: string } {
  try {
    getDb(dbPath).prepare('INSERT INTO categories (name, description) VALUES (?, ?)').run(name, description || null);
    return { success: true };
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) return { success: false, error: 'Категория с таким именем уже существует' };
    return { success: false, error: e.message };
  }
}

export function updateCategory(id: number, name: string, description?: string, dbPath?: string): { success: boolean; error?: string } {
  try {
    const result = getDb(dbPath).prepare('UPDATE categories SET name = ?, description = ? WHERE id = ?').run(name, description || null, id);
    if (result.changes === 0) return { success: false, error: 'Категория не найдена' };
    return { success: true };
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) return { success: false, error: 'Категория с таким именем уже существует' };
    return { success: false, error: e.message };
  }
}

export function deleteCategory(id: number, dbPath?: string): { success: boolean; error?: string } {
  try {
    const result = getDb(dbPath).prepare('DELETE FROM categories WHERE id = ?').run(id);
    if (result.changes === 0) return { success: false, error: 'Категория не найдена' };
    return { success: true };
  } catch (e: any) {
    if (e.message?.includes('FOREIGN KEY')) return { success: false, error: 'Нельзя удалить категорию с привязанными материалами' };
    return { success: false, error: e.message };
  }
}

// ==================== Materials ====================

export interface Material {
  id: number;
  name: string;
  category_id: number | null;
  description: string | null;
  category_name?: string;
}

export function getMaterials(dbPath?: string): Material[] {
  return getDb(dbPath).prepare(`
    SELECT m.id, m.name, m.category_id, m.description, c.name as category_name
    FROM materials m
    LEFT JOIN categories c ON m.category_id = c.id
    ORDER BY m.id
  `).all() as Material[];
}

export function addMaterial(name: string, categoryId: number | null, description?: string, dbPath?: string): { success: boolean; error?: string } {
  try {
    getDb(dbPath).prepare('INSERT INTO materials (name, category_id, description) VALUES (?, ?, ?)').run(name, categoryId, description || null);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export function updateMaterial(id: number, name: string, categoryId: number | null, description?: string, dbPath?: string): { success: boolean; error?: string } {
  try {
    const result = getDb(dbPath).prepare('UPDATE materials SET name = ?, category_id = ?, description = ? WHERE id = ?').run(name, categoryId, description || null, id);
    if (result.changes === 0) return { success: false, error: 'Материал не найден' };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export function deleteMaterial(id: number, dbPath?: string): { success: boolean; error?: string } {
  try {
    const result = getDb(dbPath).prepare('DELETE FROM materials WHERE id = ?').run(id);
    if (result.changes === 0) return { success: false, error: 'Материал не найден' };
    return { success: true };
  } catch (e: any) {
    if (e.message?.includes('FOREIGN KEY')) return { success: false, error: 'Нельзя удалить материал с привязанными операциями' };
    return { success: false, error: e.message };
  }
}

// ==================== Employees ====================

export interface Employee {
  id: number;
  full_name: string;
  position: string | null;
}

export function getEmployees(dbPath?: string): Employee[] {
  return getDb(dbPath).prepare('SELECT * FROM employees ORDER BY id').all() as Employee[];
}

export function addEmployee(fullName: string, position?: string, dbPath?: string): { success: boolean; error?: string } {
  try {
    getDb(dbPath).prepare('INSERT INTO employees (full_name, position) VALUES (?, ?)').run(fullName, position || null);
    return { success: true };
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) return { success: false, error: 'Сотрудник с таким ФИО уже существует' };
    return { success: false, error: e.message };
  }
}

export function updateEmployee(id: number, fullName: string, position?: string, dbPath?: string): { success: boolean; error?: string } {
  try {
    const result = getDb(dbPath).prepare('UPDATE employees SET full_name = ?, position = ? WHERE id = ?').run(fullName, position || null, id);
    if (result.changes === 0) return { success: false, error: 'Сотрудник не найден' };
    return { success: true };
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) return { success: false, error: 'Сотрудник с таким ФИО уже существует' };
    return { success: false, error: e.message };
  }
}

export function deleteEmployee(id: number, dbPath?: string): { success: boolean; error?: string } {
  try {
    const result = getDb(dbPath).prepare('DELETE FROM employees WHERE id = ?').run(id);
    if (result.changes === 0) return { success: false, error: 'Сотрудник не найден' };
    return { success: true };
  } catch (e: any) {
    if (e.message?.includes('FOREIGN KEY')) return { success: false, error: 'Нельзя удалить сотрудника с привязанными операциями' };
    return { success: false, error: e.message };
  }
}

// ==================== Operations ====================

export interface Operation {
  id: number;
  type: string;
  material_id: number;
  quantity: number;
  date: string;
  document: string | null;
  employee_id: number | null;
  object: string | null;
  address: string | null;
  material_name?: string;
  employee_name?: string;
  balance?: number;
}

export interface OperationFilters {
  start_date?: string;
  end_date?: string;
  type?: string;
  material?: string;
  address?: string;
  object?: string;
  document?: string;
}

export function getBalance(materialId: number, endDate?: string, dbPath?: string): number {
  const database = getDb(dbPath);
  let query = 'SELECT COALESCE(SUM(CASE WHEN type = ? THEN quantity ELSE -quantity END), 0) as balance FROM operations WHERE material_id = ?';
  const params: any[] = ['приход', materialId];

  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }

  const row = database.prepare(query).get(...params) as { balance: number };
  return row.balance;
}

export function getOperations(filters?: OperationFilters, dbPath?: string): Operation[] {
  const database = getDb(dbPath);
  let query = `
    SELECT
      o.id,
      o.date,
      o.type,
      o.document,
      o.object,
      o.address,
      m.name AS material,
      o.quantity,
      e.full_name AS employee,
      (SELECT COALESCE(SUM(CASE WHEN type='приход' THEN quantity ELSE -quantity END), 0)
         FROM operations
         WHERE material_id = o.material_id AND (date < o.date OR (date = o.date AND id <= o.id))) AS balance
    FROM operations o
    LEFT JOIN materials m ON o.material_id = m.id
    LEFT JOIN employees e ON o.employee_id = e.id
  `;

  const params: any[] = [];
  const clauses: string[] = [];

  if (filters) {
    if (filters.start_date) {
      clauses.push('o.date >= ?');
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      clauses.push('o.date <= ?');
      params.push(filters.end_date);
    }
    if (filters.type) {
      clauses.push('o.type = ?');
      params.push(filters.type);
    }
    if (filters.material) {
      clauses.push('m.name = ?');
      params.push(filters.material);
    }
    if (filters.address) {
      clauses.push('o.address LIKE ?');
      params.push(`%${filters.address}%`);
    }
    if (filters.object) {
      clauses.push('o.object LIKE ?');
      params.push(`%${filters.object}%`);
    }
    if (filters.document) {
      clauses.push('o.document LIKE ?');
      params.push(`%${filters.document}%`);
    }
  }

  if (clauses.length > 0) {
    query += ' WHERE ' + clauses.join(' AND ');
  }

  query += ' ORDER BY o.date, o.id';

  return database.prepare(query).all(...params) as Operation[];
}

export function getOperationById(id: number, dbPath?: string): Operation | undefined {
  const database = getDb(dbPath);
  return database.prepare(`
    SELECT o.*, m.name AS material_name, e.full_name AS employee_name
    FROM operations o
    LEFT JOIN materials m ON o.material_id = m.id
    LEFT JOIN employees e ON o.employee_id = e.id
    WHERE o.id = ?
  `).get(id) as Operation | undefined;
}

export function addOperation(data: {
  type: string;
  materialId: number;
  quantity: number;
  date: string;
  document?: string;
  employeeId?: number;
  object?: string;
  address?: string;
}, dbPath?: string): { success: boolean; error?: string } {
  const database = getDb(dbPath);
  const transaction = database.transaction(() => {
    database.prepare(`
      INSERT INTO operations (type, material_id, quantity, date, document, employee_id, object, address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.type,
      data.materialId,
      data.quantity,
      data.date,
      data.document || null,
      data.employeeId || null,
      data.object || null,
      data.address || null
    );
  });

  try {
    transaction();
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export function updateOperation(id: number, data: {
  type: string;
  materialId: number;
  quantity: number;
  date: string;
  document?: string;
  employeeId?: number;
  object?: string;
  address?: string;
}, dbPath?: string): { success: boolean; error?: string } {
  const database = getDb(dbPath);
  const transaction = database.transaction(() => {
    const current = database.prepare('SELECT type, material_id, quantity FROM operations WHERE id = ?').get(id) as any;
    if (!current) throw new Error('Операция не найдена');

    database.prepare(`
      UPDATE operations
      SET type = ?, material_id = ?, quantity = ?, date = ?, document = ?, employee_id = ?, object = ?, address = ?
      WHERE id = ?
    `).run(
      data.type,
      data.materialId,
      data.quantity,
      data.date,
      data.document || null,
      data.employeeId || null,
      data.object || null,
      data.address || null,
      id
    );
  });

  try {
    transaction();
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ==================== Balance Check ====================

export interface BalanceCheckResult {
 wouldBeNegative: boolean;
 currentBalance: number;
 newBalance: number;
 materialName: string;
 materialId: number;
}

export function checkOperationBalance(data: {
  type: string;
  materialId: number;
  quantity: number;
  editId?: number;
}, dbPath?: string): BalanceCheckResult {
  const database = getDb(dbPath);

  // Get material name
  const material = database.prepare('SELECT name FROM materials WHERE id = ?').get(data.materialId) as { name: string } | undefined;
  const materialName = material?.name || 'Неизвестный материал';

  // Get current balance for the material
  const currentBalance = getBalance(data.materialId, undefined, dbPath);

  // If editing, calculate the adjusted balance (remove the old operation's effect)
  let effectiveBalance = currentBalance;
  if (data.editId) {
    const current = database.prepare('SELECT type, material_id, quantity FROM operations WHERE id = ?').get(data.editId) as any;
    if (current && current.material_id === data.materialId) {
      // Remove the old operation's effect
      effectiveBalance = current.type === 'приход'
        ? currentBalance - current.quantity
        : currentBalance + current.quantity;
    }
  }

  // Calculate new balance after the operation
  const newBalance = data.type === 'приход'
    ? effectiveBalance + data.quantity
    : effectiveBalance - data.quantity;

  return {
    wouldBeNegative: newBalance < 0,
    currentBalance,
    newBalance,
    materialName,
    materialId: data.materialId,
  };
}

export function checkBatchOperationBalance(data: {
  type: string;
  materialId: number;
  quantity: number;
}, dbPath?: string): BalanceCheckResult {
  return checkOperationBalance(data, dbPath);
}

export function getOperationsByBatch(date: string, address: string | null, dbPath?: string): Operation[] {
  const database = getDb(dbPath);
  if (address) {
    return database.prepare(`
      SELECT o.id, o.date, o.type, o.document, o.material_id, o.quantity, o.employee_id, o.object, o.address,
        m.name AS material_name, e.full_name AS employee_name
      FROM operations o
      LEFT JOIN materials m ON o.material_id = m.id
      LEFT JOIN employees e ON o.employee_id = e.id
      WHERE o.date = ? AND o.address = ?
      ORDER BY o.type DESC, m.name
    `).all(date, address) as Operation[];
  }
  return database.prepare(`
    SELECT o.id, o.date, o.type, o.document, o.material_id, o.quantity, o.employee_id, o.object, o.address,
      m.name AS material_name, e.full_name AS employee_name
    FROM operations o
    LEFT JOIN materials m ON o.material_id = m.id
    LEFT JOIN employees e ON o.employee_id = e.id
    WHERE o.date = ? AND o.address IS NULL
    ORDER BY o.type DESC, m.name
  `).all(date) as Operation[];
}

export function deleteOperation(id: number, dbPath?: string): { success: boolean; error?: string } {
  try {
    const result = getDb(dbPath).prepare('DELETE FROM operations WHERE id = ?').run(id);
    if (result.changes === 0) return { success: false, error: 'Операция не найдена' };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ==================== Daily Summary ====================

export interface DailySummaryItem {
  date: string;
  incoming_qty: number;
  outgoing_qty: number;
  net_qty: number;
  incoming_count: number;
  outgoing_count: number;
}

export function getDailySummary(filters?: OperationFilters, dbPath?: string): DailySummaryItem[] {
  const database = getDb(dbPath);
  let query = `
    SELECT
      o.date,
      COALESCE(SUM(CASE WHEN o.type = 'приход' THEN o.quantity ELSE 0 END), 0) AS incoming_qty,
      COALESCE(SUM(CASE WHEN o.type = 'расход' THEN o.quantity ELSE 0 END), 0) AS outgoing_qty,
      COALESCE(SUM(CASE WHEN o.type = 'приход' THEN o.quantity ELSE -o.quantity END), 0) AS net_qty,
      SUM(CASE WHEN o.type = 'приход' THEN 1 ELSE 0 END) AS incoming_count,
      SUM(CASE WHEN o.type = 'расход' THEN 1 ELSE 0 END) AS outgoing_count
    FROM operations o
    LEFT JOIN materials m ON o.material_id = m.id
  `;

  const params: any[] = [];
  const clauses: string[] = [];

  if (filters) {
    if (filters.start_date) {
      clauses.push('o.date >= ?');
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      clauses.push('o.date <= ?');
      params.push(filters.end_date);
    }
    if (filters.type) {
      clauses.push('o.type = ?');
      params.push(filters.type);
    }
    if (filters.material) {
      clauses.push('m.name = ?');
      params.push(filters.material);
    }
    if (filters.address) {
      clauses.push('o.address LIKE ?');
      params.push(`%${filters.address}%`);
    }
    if (filters.object) {
      clauses.push('o.object LIKE ?');
      params.push(`%${filters.object}%`);
    }
    if (filters.document) {
      clauses.push('o.document LIKE ?');
      params.push(`%${filters.document}%`);
    }
  }

  if (clauses.length > 0) {
    query += ' WHERE ' + clauses.join(' AND ');
  }

  query += ' GROUP BY o.date ORDER BY o.date DESC';

  return database.prepare(query).all(...params) as DailySummaryItem[];
}

// ==================== Balances ====================

export interface BalanceItem {
  category_name: string | null;
  material_name: string;
  balance: number;
}

export function getBalances(endDate?: string, dbPath?: string): BalanceItem[] {
  const database = getDb(dbPath);
  const materials = database.prepare(`
    SELECT m.id, m.name, c.name as category_name
    FROM materials m
    LEFT JOIN categories c ON m.category_id = c.id
    ORDER BY c.name, m.name
  `).all() as { id: number; name: string; category_name: string | null }[];

  return materials.map(m => ({
    category_name: m.category_name,
    material_name: m.name,
    balance: getBalance(m.id, endDate, dbPath),
  }));
}

export interface FilteredBalanceItem extends BalanceItem {
  material_id: number;
}

/**
 * Get balances filtered by specific material IDs and/or category IDs.
 * Used for customizable reports.
 */
export function getFilteredBalances(
  materialIds: number[],
  endDate?: string,
  dbPath?: string,
): FilteredBalanceItem[] {
  if (materialIds.length === 0) return [];

  const database = getDb(dbPath);
  const placeholders = materialIds.map(() => '?').join(',');
  const materials = database.prepare(`
    SELECT m.id, m.name, c.name as category_name
    FROM materials m
    LEFT JOIN categories c ON m.category_id = c.id
    WHERE m.id IN (${placeholders})
    ORDER BY c.name, m.name
  `).all(...materialIds) as { id: number; name: string; category_name: string | null }[];

  return materials.map(m => ({
    material_id: m.id,
    category_name: m.category_name,
    material_name: m.name,
    balance: getBalance(m.id, endDate, dbPath),
  }));
}

/**
 * Get all material IDs belonging to given category IDs.
 */
export function getMaterialIdsByCategories(categoryIds: number[], dbPath?: string): number[] {
  if (categoryIds.length === 0) return [];
  const database = getDb(dbPath);
  const placeholders = categoryIds.map(() => '?').join(',');
  const rows = database.prepare(`
    SELECT id FROM materials WHERE category_id IN (${placeholders})
  `).all(...categoryIds) as { id: number }[];
  return rows.map(r => r.id);
}

// ==================== Database Management ====================

export function getCurrentDbPath(): string {
  return currentDbPath;
}

export function switchDatabase(dbPath: string): { success: boolean; error?: string } {
  try {
    if (!fs.existsSync(dbPath)) return { success: false, error: 'Файл базы данных не найден' };
    if (db) db.close();
    db = null;
    currentDbPath = dbPath;
    getDb();
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export function createDatabase(dbPath: string): { success: boolean; error?: string } {
  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (db) db.close();
    db = null;
    currentDbPath = dbPath;
    getDb();
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export function backupDatabase(backupPath: string): { success: boolean; error?: string } {
  try {
    if (!fs.existsSync(currentDbPath)) return { success: false, error: 'Файл базы данных не найден' };
    fs.copyFileSync(currentDbPath, backupPath);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export function importFromPythonDb(pythonDbPath: string): { success: boolean; error?: string; imported?: { categories: number; materials: number; employees: number; operations: number } } {
  try {
    if (!fs.existsSync(pythonDbPath)) return { success: false, error: 'Файл базы данных Python не найден' };

    const pythonDb = new Database(pythonDbPath, { readonly: true });

    const targetDb = getDb();

    // Clear existing data (in reverse dependency order)
    targetDb.exec('DELETE FROM operations');
    targetDb.exec('DELETE FROM materials');
    targetDb.exec('DELETE FROM employees');
    targetDb.exec('DELETE FROM categories');

    const categories = pythonDb.prepare('SELECT * FROM categories').all() as any[];
    const materials = pythonDb.prepare('SELECT * FROM materials').all() as any[];
    const employees = pythonDb.prepare('SELECT * FROM employees').all() as any[];
    const operations = pythonDb.prepare('SELECT * FROM operations').all() as any[];

    const insertCategory = targetDb.prepare('INSERT INTO categories (id, name, description) VALUES (?, ?, ?)');
    const insertMaterial = targetDb.prepare('INSERT INTO materials (id, name, category_id, description) VALUES (?, ?, ?, ?)');
    const insertEmployee = targetDb.prepare('INSERT INTO employees (id, full_name, position) VALUES (?, ?, ?)');
    const insertOperation = targetDb.prepare('INSERT INTO operations (id, type, material_id, quantity, date, document, employee_id, object, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');

    const transaction = targetDb.transaction(() => {
      for (const cat of categories) insertCategory.run(cat.id, cat.name, cat.description);
      for (const mat of materials) insertMaterial.run(mat.id, mat.name, mat.category_id, mat.description);
      for (const emp of employees) insertEmployee.run(emp.id, emp.full_name, emp.position);
      for (const op of operations) insertOperation.run(op.id, op.type, op.material_id, op.quantity, op.date, op.document, op.employee_id, op.object, op.address);
    });

    transaction();
    pythonDb.close();

    return {
      success: true,
      imported: {
        categories: categories.length,
        materials: materials.length,
        employees: employees.length,
        operations: operations.length,
      },
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export function exportToPythonDb(exportPath: string): { success: boolean; error?: string } {
  try {
    if (fs.existsSync(exportPath)) fs.unlinkSync(exportPath);

    const exportDb = new Database(exportPath);
    exportDb.pragma('foreign_keys = ON');

    exportDb.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT
      );
      CREATE TABLE IF NOT EXISTS materials (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        category_id INTEGER,
        description TEXT,
        FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE RESTRICT
      );
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY,
        full_name TEXT NOT NULL UNIQUE,
        position TEXT
      );
      CREATE TABLE IF NOT EXISTS operations (
        id INTEGER PRIMARY KEY,
        type TEXT NOT NULL,
        material_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        date TEXT NOT NULL,
        document TEXT,
        employee_id INTEGER,
        object TEXT,
        address TEXT,
        FOREIGN KEY(material_id) REFERENCES materials(id) ON DELETE RESTRICT,
        FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE SET NULL
      );
    `);

    const sourceDb = getDb();

    const insertCat = exportDb.prepare('INSERT INTO categories (id, name, description) VALUES (?, ?, ?)');
    const insertMat = exportDb.prepare('INSERT INTO materials (id, name, category_id, description) VALUES (?, ?, ?, ?)');
    const insertEmp = exportDb.prepare('INSERT INTO employees (id, full_name, position) VALUES (?, ?, ?)');
    const insertOp = exportDb.prepare('INSERT INTO operations (id, type, material_id, quantity, date, document, employee_id, object, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');

    const categories = sourceDb.prepare('SELECT * FROM categories').all() as any[];
    const materials = sourceDb.prepare('SELECT * FROM materials').all() as any[];
    const employees = sourceDb.prepare('SELECT * FROM employees').all() as any[];
    const operations = sourceDb.prepare('SELECT * FROM operations').all() as any[];

    const transaction = exportDb.transaction(() => {
      for (const cat of categories) insertCat.run(cat.id, cat.name, cat.description);
      for (const mat of materials) insertMat.run(mat.id, mat.name, mat.category_id, mat.description);
      for (const emp of employees) insertEmp.run(emp.id, emp.full_name, emp.position);
      for (const op of operations) insertOp.run(op.id, op.type, op.material_id, op.quantity, op.date, op.document, op.employee_id, op.object, op.address);
    });

    transaction();
    exportDb.close();

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export function getDatabaseStats(dbPath?: string): {
  categories: number;
  materials: number;
  employees: number;
  operations: number;
  dbPath: string;
} {
  const database = getDb(dbPath);
  return {
    categories: (database.prepare('SELECT COUNT(*) as c FROM categories').get() as any).c,
    materials: (database.prepare('SELECT COUNT(*) as c FROM materials').get() as any).c,
    employees: (database.prepare('SELECT COUNT(*) as c FROM employees').get() as any).c,
    operations: (database.prepare('SELECT COUNT(*) as c FROM operations').get() as any).c,
    dbPath: currentDbPath,
  };
}

/**
 * Returns the data directory (for backup/export paths).
 * In Electron portable: next to the .exe.
 * In dev: project db/ folder.
 */
export function getDataDirectory(): string {
  return getDataDir();
}
