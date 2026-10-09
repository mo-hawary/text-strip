import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Checks the agent-facing files: the agent skill, llms.txt, llms-full.txt, AGENTS.md and CLAUDE.md.
// Each check prints OK or FAIL on its own line. Exits 1 when any check fails.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_NAME = 'text-strip';
const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

let failed = false;

function report(ok, message) {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${message}`);
  if (!ok) failed = true;
}

// Reads a file under the repo root. Returns undefined and reports when it is missing.
function readRequired(rel) {
  const full = join(root, rel);
  if (!existsSync(full)) {
    report(false, `${rel} is missing. The file has not been created yet.`);
    return undefined;
  }
  return readFileSync(full, 'utf8');
}

// Minimal YAML frontmatter reader: top-level `key: value` pairs, with folded or literal block
// scalars (`>` or `|`) joined into one string. Enough for the name and description fields.
function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') return undefined;
  const end = lines.indexOf('---', 1);
  if (end === -1) return undefined;
  const fields = {};
  let key;
  for (const line of lines.slice(1, end)) {
    const top = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (top) {
      key = top[1];
      const value = top[2].trim();
      fields[key] = /^[>|][-+]?$/.test(value) ? '' : value;
    } else if (key && /^\s+\S/.test(line)) {
      fields[key] = `${fields[key]} ${line.trim()}`.trim();
    }
  }
  for (const k of Object.keys(fields)) {
    fields[k] = fields[k].replace(/^(['"])(.*)\1$/, '$2');
  }
  return fields;
}

// (a) skills/text-strip/SKILL.md
function checkSkill() {
  const rel = `skills/${SKILL_NAME}/SKILL.md`;
  const text = readRequired(rel);
  if (text === undefined) return;
  const fm = parseFrontmatter(text);
  if (!fm) {
    report(false, `${rel} has no YAML frontmatter between --- lines.`);
    return;
  }
  const name = fm.name ?? '';
  report(
    NAME_PATTERN.test(name),
    `${rel} name "${name}" matches /^[a-z0-9]+(-[a-z0-9]+)*$/.`,
  );
  report(
    name === SKILL_NAME,
    `${rel} name "${name}" equals the directory name "${SKILL_NAME}".`,
  );
  report(name.length <= 64, `${rel} name is ${name.length} characters (max 64).`);
  const description = fm.description ?? '';
  report(
    description.length >= 1 && description.length <= 1024,
    `${rel} description is ${description.length} characters (1 to 1024).`,
  );
}

// (b) llms.txt
function checkLlmsIndex() {
  const rel = 'llms.txt';
  const text = readRequired(rel);
  if (text === undefined) return;
  const first = text.trimStart().split(/\r?\n/)[0];
  report(first.startsWith('# '), `${rel} starts with an H1 ("# ").`);
  const hasQuote = text.split(/\r?\n/).some((line) => line.startsWith('> '));
  report(hasQuote, `${rel} has a "> " blockquote summary.`);
  const links = [...text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map((m) => m[1]);
  const bad = links.filter((url) => !/^https:\/\/[^\s/]+/.test(url));
  report(
    bad.length === 0,
    bad.length === 0
      ? `${rel} has ${links.length} markdown link(s), all absolute https.`
      : `${rel} has non-https or relative links: ${bad.join(', ')}`,
  );
}

// (c) llms-full.txt must mention every key of DEFAULTS in src/options.ts
function readDefaultsKeys() {
  const source = readFileSync(join(root, 'src/options.ts'), 'utf8');
  const start = source.indexOf('export const DEFAULTS');
  if (start === -1) return undefined;
  const body = source.slice(start);
  const end = body.indexOf('});');
  const block = end === -1 ? body : body.slice(0, end);
  return [...block.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*:/gm)].map((m) => m[1]);
}

function checkLlmsFull() {
  const rel = 'llms-full.txt';
  const text = readRequired(rel);
  const keys = readDefaultsKeys();
  if (keys === undefined || keys.length === 0) {
    report(false, 'src/options.ts: could not parse the keys of DEFAULTS.');
    return;
  }
  if (text === undefined) return;
  const missing = keys.filter((key) => !new RegExp(`\\b${key}\\b`).test(text));
  report(
    missing.length === 0,
    missing.length === 0
      ? `${rel} mentions all ${keys.length} DEFAULTS keys.`
      : `${rel} does not mention DEFAULTS keys: ${missing.join(', ')}`,
  );
}

// (d) AGENTS.md is at most 80 lines
function checkAgents() {
  const rel = 'AGENTS.md';
  const text = readRequired(rel);
  if (text === undefined) return;
  const lines = text.split(/\r?\n/);
  if (lines[lines.length - 1] === '') lines.pop();
  report(lines.length <= 80, `${rel} is ${lines.length} lines (max 80).`);
}

// (e) CLAUDE.md imports AGENTS.md
function checkClaude() {
  const rel = 'CLAUDE.md';
  const text = readRequired(rel);
  if (text === undefined) return;
  report(text.includes('@AGENTS.md'), `${rel} contains @AGENTS.md.`);
}

checkSkill();
checkLlmsIndex();
checkLlmsFull();
checkAgents();
checkClaude();

if (failed) {
  console.error('check-agent-docs: one or more checks failed.');
  process.exit(1);
}
console.log('check-agent-docs: all checks passed.');
