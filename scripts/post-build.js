/**
 * Post-build script: prepares Next.js standalone output for Electron packaging
 * Copies static assets and public folder into standalone directory
 */
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const standaloneDir = path.join(rootDir, '.next', 'standalone');
const staticDir = path.join(rootDir, '.next', 'static');
const publicDir = path.join(rootDir, 'public');
const dbDir = path.join(rootDir, 'db');

console.log('=== SKLAD Post-Build ===\n');

// Check standalone directory exists
if (!fs.existsSync(standaloneDir)) {
  console.error('[ERROR] .next/standalone directory not found!');
  console.error('Make sure next.config.ts has output: "standalone"');
  process.exit(1);
}

// Copy .next/static into .next/standalone/.next/static
const targetStaticDir = path.join(standaloneDir, '.next', 'static');
if (fs.existsSync(staticDir)) {
  console.log('[1/4] Copying .next/static -> .next/standalone/.next/static');
  fs.rmSync(targetStaticDir, { recursive: true, force: true });
  copyDirRecursive(staticDir, targetStaticDir);
  console.log('  Done.');
} else {
  console.warn('[1/4] .next/static not found, skipping...');
}

// Copy public/ into .next/standalone/public/
const targetPublicDir = path.join(standaloneDir, 'public');
if (fs.existsSync(publicDir)) {
  console.log('[2/4] Copying public/ -> .next/standalone/public/');
  fs.rmSync(targetPublicDir, { recursive: true, force: true });
  copyDirRecursive(publicDir, targetPublicDir);
  console.log('  Done.');
} else {
  console.warn('[2/4] public/ not found, skipping...');
}

// Step 3: no db/ directory needed in standalone anymore.
// Portable app stores data next to the .exe file via SKLAD_DATA_DIR env var.
console.log('[3/3] Skipping db/ (portable stores data next to .exe)');
console.log('  Done.');

console.log('\n=== Post-Build Complete ===');
console.log('Standalone directory is ready for Electron packaging.\n');

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
