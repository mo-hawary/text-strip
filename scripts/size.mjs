import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

// gzip level 9 budgets. The ESM build is what bundlers ship, the IIFE build is
// the CDN bundle loaded with a script tag.
const BUDGETS = [
  { file: 'dist/index.js', limit: 3900 },
  { file: 'dist/index.global.js', limit: 4150 },
];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const missing = BUDGETS.filter(({ file }) => !existsSync(join(root, file)));
if (missing.length > 0) {
  for (const { file } of missing) {
    console.error(`text-strip: ${file} not found.`);
  }
  console.error('Run "npm run build" first.');
  process.exit(1);
}

let failed = false;

for (const { file, limit } of BUDGETS) {
  const raw = readFileSync(join(root, file));
  const gzip = gzipSync(raw, { level: 9 });
  const over = gzip.length > limit;

  console.log(`${file}: ${raw.length} bytes raw, ${gzip.length} bytes gzip (limit ${limit} bytes gzip)${over ? ' OVER' : ''}`);

  if (over) {
    console.error(`text-strip: ${file} gzip size ${gzip.length} bytes is over the ${limit} byte limit.`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
