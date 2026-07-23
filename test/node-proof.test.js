'use strict';

/* looptrace — the permanent real-Node proof.
   Every corpus snippet's verbatim code is executed in a Node child
   process; its captured console output must deepStrictEqual BOTH the
   scheduler model's prediction and the stored expectedOrder.
   A snippet where Node disagrees with the model is cut, never
   patched by hand — this test enforces that policy forever. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const { SNIPPETS } = require('../data/snippets.js');
const { simulate } = require('../data/model.js');

function runInNodeChild(code) {
  const out = execFileSync(process.execPath, ['-e', code], {
    encoding: 'utf8',
    timeout: 10000,
  });
  return out.split('\n').filter((l) => l !== '');
}

for (const s of SNIPPETS) {
  test('real Node proof: ' + s.id, () => {
    const real = runInNodeChild(s.code);
    assert.deepStrictEqual(real, simulate(s.ops).order,
      s.id + ': real Node disagrees with the model');
    assert.deepStrictEqual(real, s.expectedOrder,
      s.id + ': stored expectedOrder is stale');
  });
}
