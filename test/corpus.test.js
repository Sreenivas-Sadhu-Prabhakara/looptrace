'use strict';

/* looptrace — corpus invariants. */

const test = require('node:test');
const assert = require('node:assert/strict');

const { SNIPPETS, VERIFIED_NODE, VERIFIED_DATE } = require('../data/snippets.js');
const { simulate } = require('../data/model.js');

const TOPICS = ['stack', 'timeout', 'then-chain', 'microtask', 'async-await', 'mixed'];

test('corpus has exactly 36 snippets with unique ids', () => {
  assert.equal(SNIPPETS.length, 36);
  const ids = new Set(SNIPPETS.map((s) => s.id));
  assert.equal(ids.size, 36);
});

test('every snippet carries the full field set', () => {
  for (const s of SNIPPETS) {
    assert.equal(typeof s.id, 'string', s.id);
    assert.match(s.id, /^[a-z0-9-]+$/, s.id); // hash-linkable
    assert.equal(typeof s.title, 'string');
    assert.ok(TOPICS.includes(s.topic), s.id + ': topic ' + s.topic);
    assert.ok([1, 2, 3].includes(s.difficulty), s.id);
    assert.equal(typeof s.code, 'string');
    assert.ok(s.code.length > 0, s.id);
    assert.ok(Array.isArray(s.ops) && s.ops.length > 0, s.id);
    assert.ok(Array.isArray(s.expectedOrder) && s.expectedOrder.length > 0, s.id);
    assert.ok(Array.isArray(s.stepCaptions), s.id);
    assert.equal(typeof s.rule, 'string', s.id);
    assert.equal(typeof s.cite, 'object', s.id);
    assert.match(s.cite.url, /^https:\/\//, s.id);
    assert.ok(s.cite.label.length > 0, s.id);
    assert.equal(s.verifiedNode, VERIFIED_NODE, s.id);
    assert.equal(s.verifiedDate, VERIFIED_DATE, s.id);
    assert.match(s.verifiedDate, /^\d{4}-\d{2}-\d{2}$/, s.id);
  }
});

test('every topic group is populated (6 per topic)', () => {
  for (const t of TOPICS) {
    assert.equal(SNIPPETS.filter((s) => s.topic === t).length, 6, t);
  }
});

test('model prediction matches stored expectedOrder for all 36', () => {
  for (const s of SNIPPETS) {
    assert.deepStrictEqual(simulate(s.ops).order, s.expectedOrder, s.id);
  }
});

test('stepCaptions overrides, when present, match the timeline length', () => {
  for (const s of SNIPPETS) {
    if (s.stepCaptions.length > 0) {
      assert.equal(s.stepCaptions.length, simulate(s.ops).steps.length, s.id);
    }
  }
});

test('cited sources are the four staged references', () => {
  const staged = [
    'html.spec.whatwg.org',
    'developer.mozilla.org',
    'v8.dev',
  ];
  for (const s of SNIPPETS) {
    assert.ok(staged.some((h) => s.cite.url.includes(h)), s.id + ': ' + s.cite.url);
  }
});
