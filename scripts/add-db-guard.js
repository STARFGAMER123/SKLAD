/**
 * Codemod: добавляет ensureDbReady() guard во все warehouse-роуты.
 * Запуск: node scripts/add-db-guard.js
 */
const fs = require('fs');
const path = require('path');

const warehouseDir = path.join(__dirname, '..', 'src', 'app', 'api', 'warehouse');

const GUARD_BLOCK = '  const guard = ensureDbReady();\n  if (guard) return guard;\n\n';
let patched = 0;
let skipped = 0;

for (const entry of fs.readdirSync(warehouseDir)) {
  const routeDir = path.join(warehouseDir, entry);
  const file = path.join(routeDir, 'route.ts');
  if (!fs.existsSync(file)) continue;

  let src = fs.readFileSync(file, 'utf8');

  if (src.includes('ensureDbReady')) {
    skipped++;
    continue;
  }

  // 1. импорт после последнего import-а
  const importRegex = /^import .*?;$/m;
  const imports = [...src.matchAll(/^import .*?;.*$/gm)];
  const lastImport = imports[imports.length - 1];
  if (!lastImport) {
    console.error('NO IMPORTS:', file);
    continue;
  }
  const insertAt = lastImport.index + lastImport[0].length;
  src =
    src.slice(0, insertAt) +
    "\nimport { ensureDbReady } from '@/lib/db-guard';" +
    src.slice(insertAt);

  // 2. guard в начало каждого export async function
  src = src.replace(
    /export async function (GET|POST|PUT|DELETE|PATCH)\s*\([^)]*\)\s*{\n/,
    (m) => m + GUARD_BLOCK,
  );
  // многократная замена (replace с функцией заменяет только первое вхождение глобально без /g)
  let prev;
  do {
    prev = src;
    src = src.replace(
      /(export async function (?:GET|POST|PUT|DELETE|PATCH)\s*\([^)]*\)\s*{\n(?:(?!const guard = ensureDbReady).)*?)\n\n/,
      (m, head) => (head.includes('const guard = ensureDbReady') ? m : m),
    );
  } while (src !== prev);

  // повторяем простую вставку для всех оставшихся функций
  const fnRegex = /export async function (GET|POST|PUT|DELETE|PATCH)\s*\([^)]*\)\s*{\n(?!\s*const guard)/g;
  src = src.replace(fnRegex, (m) => m + GUARD_BLOCK);

  fs.writeFileSync(file, src);
  patched++;
  console.log('PATCHED:', path.relative(process.cwd(), file));
}

console.log(`\nDone. patched=${patched}, skipped(already)=${skipped}`);
