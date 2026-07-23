#!/usr/bin/env node
/* ============================================================
   looptrace — authoring-time corpus verifier.
   Executes every snippet's `code` verbatim in a REAL Node child
   process, captures console.log lines, and compares them against
   BOTH the scheduler model's prediction and the stored
   expectedOrder. Exits non-zero on any mismatch.
   The same proof runs permanently under `node --test`
   (test/node-proof.test.js) — this script exists for fast
   authoring feedback and for printing captured output.
   Usage: node tools/verify.mjs [--print]
   ============================================================ */

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { SNIPPETS } = require('../data/snippets.js');
const { simulate, compileOps } = require('../data/model.js');

const printMode = process.argv.includes('--print');
let failures = 0;

function runInNodeChild(code) {
  const out = execFileSync(process.execPath, ['-e', code], {
    encoding: 'utf8',
    timeout: 10000,
  });
  return out.split('\n').filter((l) => l !== '');
}

for (const s of SNIPPETS) {
  let real;
  try {
    compileOps(s.code);
    real = runInNodeChild(s.code);
  } catch (e) {
    console.error(`✗ ${s.id}: failed to run — ${e.message}`);
    failures += 1;
    continue;
  }
  const predicted = simulate(s.ops).order;
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  if (printMode) {
    console.log(`${s.id}: real Node → ${JSON.stringify(real)}`);
  }
  if (!eq(real, predicted)) {
    console.error(`✗ ${s.id}: MODEL DISAGREES WITH NODE (cut this snippet, never patch)\n    node : ${JSON.stringify(real)}\n    model: ${JSON.stringify(predicted)}`);
    failures += 1;
  } else if (!eq(real, s.expectedOrder)) {
    console.error(`✗ ${s.id}: stored expectedOrder is stale\n    node  : ${JSON.stringify(real)}\n    stored: ${JSON.stringify(s.expectedOrder)}`);
    failures += 1;
  } else {
    console.log(`✓ ${s.id} (${real.length} lines, node === model === stored)`);
  }
}

console.log(failures === 0
  ? `\nAll ${SNIPPETS.length} snippets verified against ${process.version}.`
  : `\n${failures} FAILURE(S).`);
process.exit(failures === 0 ? 0 : 1);
