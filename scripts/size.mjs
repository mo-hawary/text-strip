import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const LIMIT_BYTES = 3072;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'dist', 'index.global.js');

if (!existsSync(file)) {
  console.error(`text-strip: ${file} not found. Run "npm run build" first.`);
  process.exit(1);
}

const raw = readFileSync(file);
const gzip = gzipSync(raw, { level: 9 });

console.log(`dist/index.global.js: ${raw.length} bytes raw, ${gzip.length} bytes gzip (limit ${LIMIT_BYTES} bytes gzip)`);

if (gzip.length > LIMIT_BYTES) {
  console.error(`text-strip: gzip size ${gzip.length} bytes is over the ${LIMIT_BYTES} byte limit.`);
  process.exit(1);
}
