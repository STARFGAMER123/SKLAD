/**
 * Codemod: оборачивает строковые литералы '/api/...' в apiUrl(...) во всех
 * клиентских файлах (компоненты, page, store) и добавляет импорт.
 * Запуск: node scripts/api-url-wrap.js
 */
const fs = require('fs');
const path = require('path');

const targets = [
  'src/components/sklad/operations-tab.tsx',
  'src/components/sklad/references-tab.tsx',
  'src/components/sklad/movements-tab.tsx',
  'src/components/sklad/reports-tab.tsx',
  'src/app/page.tsx',
  'src/stores/sklad-store.ts',
];

const root = path.join(__dirname, '..');
let total = 0;

for (const rel of targets) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    console.error('MISSING:', rel);
    continue;
  }
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes('apiUrl(') && src.includes("from '@/lib/api-client'")) {
    console.log('SKIP (already):', rel);
    continue;
  }

  let count = 0;

  // шаблонные строки `/api/...` (в т.ч. с ${...})
  src = src.replace(/`(\/api\/[^`]*)`/g, (m, p1) => {
    count++;
    return 'apiUrl(`' + p1 + '`)';
  });
  // одинарные кавычки
  src = src.replace(/'(\/api\/[^']*)'/g, (m, p1) => {
    count++;
    return "apiUrl('" + p1 + "')";
  });
  // двойные кавычки
  src = src.replace(/"(\/api\/[^"]*)"/g, (m, p1) => {
    count++;
    return 'apiUrl("' + p1 + '")';
  });

  if (count === 0) {
    console.log('NO MATCHES:', rel);
    continue;
  }

  // импорт после первого import
  const firstImport = src.match(/^import .*?;$/m);
  if (firstImport) {
    const at = firstImport.index + firstImport[0].length;
    src =
      src.slice(0, at) +
      "\nimport { apiUrl } from '@/lib/api-client';" +
      src.slice(at);
  } else {
    src = "import { apiUrl } from '@/lib/api-client';\n" + src;
  }

  fs.writeFileSync(file, src);
  total += count;
  console.log(`OK: ${rel} (${count} литералов)`);
}

console.log(`\nTotal wrapped: ${total}`);
