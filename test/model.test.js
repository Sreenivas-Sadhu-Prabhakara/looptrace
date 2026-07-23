'use strict';

/* looptrace — scheduler-model self-tests.
   Re-derives the brief's hand-computed fixtures exactly and proves
   model invariants. Run with bare `node --test`. */

const test = require('node:test');
const assert = require('node:assert/strict');

const { SNIPPETS } = require('../data/snippets.js');
const { compileOps, simulate, predictOrder, traceSnippet } = require('../data/model.js');

/* ---------- the six hand-computed fixtures (from the brief) ---------- */

test('fixture: classic-interleave → A D C B', () => {
  assert.deepStrictEqual(predictOrder('classic-interleave'), ['A', 'D', 'C', 'B']);
});

test('fixture: await-suspends → 1 3 2', () => {
  assert.deepStrictEqual(predictOrder('await-suspends'), ['1', '3', '2']);
});

test('fixture: microtasks-drain-fully → p1 p2 t1 t2 (full drain beats first macrotask)', () => {
  assert.deepStrictEqual(predictOrder('microtasks-drain-fully'), ['p1', 'p2', 't1', 't2']);
});

test('fixture: micro-between-macros → t1 m1 t2 (checkpoint after every task)', () => {
  assert.deepStrictEqual(predictOrder('micro-between-macros'), ['t1', 'm1', 't2']);
});

test('fixture: await-resolved-one-tick → a b c (ES2019 one-tick await)', () => {
  assert.deepStrictEqual(predictOrder('await-resolved-one-tick'), ['a', 'b', 'c']);
});

test('fixture: nested-timeout → x1 x2 x3', () => {
  assert.deepStrictEqual(predictOrder('nested-timeout'), ['x1', 'x2', 'x3']);
});

/* ---------- whitelist guard ---------- */

test('compileOps refuses non-whitelisted ops, never guesses', () => {
  assert.throws(() => compileOps('setImmediate(fn)'), /whitelist/);
  assert.throws(() => compileOps("process.nextTick(() => console.log('x'))"), /whitelist/);
  assert.throws(() => compileOps('setInterval(() => {}, 0)'), /whitelist/);
  assert.throws(() => compileOps("fetch('https://example.com')"), /whitelist/);
  assert.throws(() => compileOps('new Promise((r) => r())'), /whitelist/);
  assert.throws(() => compileOps("setTimeout(() => { console.log('x'); }, 500)"), /whitelist/);
  assert.throws(() => compileOps('setTimeout(someRef, 0)'), /whitelist/);
  assert.throws(() => compileOps(''), /whitelist/);
});

test('compileOps accepts every corpus snippet', () => {
  for (const s of SNIPPETS) {
    assert.deepStrictEqual(compileOps(s.code), { ok: true }, s.id);
  }
});

test('simulate refuses an unknown op', () => {
  assert.throws(() => simulate([{ op: 'setImmediate', name: 'x', body: [] }]), /whitelist/);
});

/* ---------- model invariants (property tests over all 36) ---------- */

test('determinism: simulating twice yields byte-identical timelines', () => {
  for (const s of SNIPPETS) {
    const a = simulate(s.ops);
    const b = simulate(s.ops);
    assert.deepStrictEqual(a, b, s.id);
  }
});

test('every timeline ends idle: stack and both queues empty, console complete', () => {
  for (const s of SNIPPETS) {
    const { steps, order } = simulate(s.ops);
    const last = steps[steps.length - 1];
    assert.equal(last.phase, 'idle', s.id);
    assert.deepStrictEqual(last.stack, [], s.id);
    assert.deepStrictEqual(last.micro, [], s.id);
    assert.deepStrictEqual(last.macro, [], s.id);
    assert.deepStrictEqual(last.console, order, s.id);
  }
});

test('console output grows monotonically (each step appends, never rewrites)', () => {
  for (const s of SNIPPETS) {
    const { steps } = simulate(s.ops);
    let prev = [];
    for (const st of steps) {
      assert.ok(st.console.length >= prev.length, s.id);
      assert.deepStrictEqual(st.console.slice(0, prev.length), prev, s.id);
      prev = st.console;
    }
  }
});

test('phase dial only ever shows script → micro/macro cycles → idle', () => {
  const allowed = new Set(['script', 'micro', 'macro', 'idle']);
  for (const s of SNIPPETS) {
    const { steps } = simulate(s.ops);
    assert.equal(steps[0].phase, 'script', s.id);
    for (const st of steps) {
      assert.ok(allowed.has(st.phase), s.id + ': ' + st.phase);
      assert.equal(typeof st.caption, 'string', s.id);
      assert.ok(st.caption.length > 0, s.id);
    }
  }
});

test('a macrotask is only dequeued when the microtask queue is empty', () => {
  for (const s of SNIPPETS) {
    const { steps } = simulate(s.ops);
    for (const st of steps) {
      if (st.caption.includes('takes ONE macrotask')) {
        // snapshot is taken after the dequeue; micro must already be drained
        assert.deepStrictEqual(st.micro, [], s.id);
      }
    }
  }
});

test('traceSnippet exposes steps and order consistently with predictOrder', () => {
  for (const s of SNIPPETS) {
    const t = traceSnippet(s.id);
    assert.deepStrictEqual(t.order, predictOrder(s.id), s.id);
    assert.ok(t.steps.length >= 2, s.id);
  }
});
