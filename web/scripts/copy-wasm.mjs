import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const src = path.join(root, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
const destDir = path.join(root, 'public');
const dest = path.join(destDir, 'sql-wasm.wasm');

if (fs.existsSync(src)) {
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
  console.log('Copied sql-wasm.wasm to public/sql-wasm.wasm');
}
