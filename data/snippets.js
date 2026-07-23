/* ============================================================
   looptrace — verified snippet corpus (36 snippets)
   Every snippet's `code` is verbatim runnable JavaScript. Its
   `expectedOrder` was captured from a REAL Node run, and the test
   suite permanently re-runs each snippet in a Node child process,
   asserting real output === model prediction === expectedOrder
   (test/node-proof.test.js). A snippet the model cannot predict is
   cut, never patched by hand.
   `ops` is the hand-compiled sequence over the whitelisted op-set
   that data/model.js interprets. `stepCaptions` is an optional
   per-step override; empty means the engine's generated captions
   are used.
   ============================================================ */

'use strict';

const VERIFIED_NODE = 'v25.4.0';
const VERIFIED_DATE = '2026-07-23';

const CITES = {
  whatwgLoop: {
    label: 'WHATWG HTML Standard § Event loops',
    url: 'https://html.spec.whatwg.org/multipage/webappapis.html#event-loops',
  },
  whatwgCheckpoint: {
    label: 'WHATWG HTML Standard § Perform a microtask checkpoint',
    url: 'https://html.spec.whatwg.org/multipage/webappapis.html#perform-a-microtask-checkpoint',
  },
  mdnInDepth: {
    label: 'MDN — In depth: Microtasks and the JavaScript runtime environment',
    url: 'https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide/In_depth',
  },
  mdnMicro: {
    label: 'MDN — Using microtasks in JavaScript with queueMicrotask()',
    url: 'https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide',
  },
  v8Async: {
    label: 'V8 blog — Faster async functions and promises (ES2019 one-tick await)',
    url: 'https://v8.dev/blog/fast-async',
  },
};

function base(s) {
  return Object.assign({ stepCaptions: [], verifiedNode: VERIFIED_NODE, verifiedDate: VERIFIED_DATE }, s);
}

const SNIPPETS = [

  /* ============ stack — sync basics ============ */

  base({
    id: 'sync-top-to-bottom',
    title: 'Synchronous code runs top to bottom',
    topic: 'stack',
    difficulty: 1,
    code: "console.log('one');\nconsole.log('two');\nconsole.log('three');",
    ops: [
      { op: 'log', text: 'one' },
      { op: 'log', text: 'two' },
      { op: 'log', text: 'three' },
    ],
    expectedOrder: ['one', 'two', 'three'],
    cite: CITES.mdnInDepth,
    rule: 'The script itself is one task: statements execute in order until the stack empties.',
  }),

  base({
    id: 'sync-call',
    title: 'A function call pushes a stack frame',
    topic: 'stack',
    difficulty: 1,
    code: "function greet() { console.log('inside greet'); }\nconsole.log('before');\ngreet();\nconsole.log('after');",
    ops: [
      { op: 'log', text: 'before' },
      { op: 'call', name: 'greet', body: [{ op: 'log', text: 'inside greet' }] },
      { op: 'log', text: 'after' },
    ],
    expectedOrder: ['before', 'inside greet', 'after'],
    cite: CITES.mdnInDepth,
    rule: 'Calling a function pushes a frame; returning pops it — no queues involved yet.',
  }),

  base({
    id: 'sync-nested-calls',
    title: 'Nested calls stack up, then unwind',
    topic: 'stack',
    difficulty: 1,
    code: "function h() { console.log('h: deepest'); }\nfunction g() { console.log('g: calls h'); h(); }\nfunction f() { console.log('f: calls g'); g(); }\nf();\nconsole.log('back at script');",
    ops: [
      {
        op: 'call', name: 'f', body: [
          { op: 'log', text: 'f: calls g' },
          {
            op: 'call', name: 'g', body: [
              { op: 'log', text: 'g: calls h' },
              { op: 'call', name: 'h', body: [{ op: 'log', text: 'h: deepest' }] },
            ],
          },
        ],
      },
      { op: 'log', text: 'back at script' },
    ],
    expectedOrder: ['f: calls g', 'g: calls h', 'h: deepest', 'back at script'],
    cite: CITES.mdnInDepth,
    rule: 'Each nested call adds a frame on top; the deepest frame finishes first (LIFO).',
  }),

  base({
    id: 'sync-return-order',
    title: 'Code after a call waits for the callee to return',
    topic: 'stack',
    difficulty: 1,
    code: "function inner() { console.log('inner runs'); }\nfunction outer() { console.log('outer: before inner'); inner(); console.log('outer: after inner'); }\nouter();",
    ops: [
      {
        op: 'call', name: 'outer', body: [
          { op: 'log', text: 'outer: before inner' },
          { op: 'call', name: 'inner', body: [{ op: 'log', text: 'inner runs' }] },
          { op: 'log', text: 'outer: after inner' },
        ],
      },
    ],
    expectedOrder: ['outer: before inner', 'inner runs', 'outer: after inner'],
    cite: CITES.mdnInDepth,
    rule: 'A synchronous call blocks its caller: outer resumes only when inner has popped.',
  }),

  base({
    id: 'sync-two-calls',
    title: 'The same function runs to completion each call',
    topic: 'stack',
    difficulty: 1,
    code: "function tick() { console.log('tick'); }\ntick();\ntick();\nconsole.log('done');",
    ops: [
      { op: 'call', name: 'tick', body: [{ op: 'log', text: 'tick' }] },
      { op: 'call', name: 'tick', body: [{ op: 'log', text: 'tick' }] },
      { op: 'log', text: 'done' },
    ],
    expectedOrder: ['tick', 'tick', 'done'],
    cite: CITES.mdnInDepth,
    rule: 'Each invocation is a fresh frame; there is no interleaving in synchronous code.',
  }),

  base({
    id: 'sync-interleaved-returns',
    title: 'Two-level unwind: a resumes after b pops',
    topic: 'stack',
    difficulty: 2,
    code: "function b() { console.log('b: start'); console.log('b: end'); }\nfunction a() { console.log('a: start'); b(); console.log('a: end'); }\na();\nconsole.log('script: end');",
    ops: [
      {
        op: 'call', name: 'a', body: [
          { op: 'log', text: 'a: start' },
          {
            op: 'call', name: 'b', body: [
              { op: 'log', text: 'b: start' },
              { op: 'log', text: 'b: end' },
            ],
          },
          { op: 'log', text: 'a: end' },
        ],
      },
      { op: 'log', text: 'script: end' },
    ],
    expectedOrder: ['a: start', 'b: start', 'b: end', 'a: end', 'script: end'],
    cite: CITES.mdnInDepth,
    rule: 'The stack unwinds strictly inside-out; the script frame is always the last to finish.',
  }),

  /* ============ timeout — setTimeout(0) macrotasks ============ */

  base({
    id: 'timeout-after-sync',
    title: 'setTimeout(0) still waits for the whole script',
    topic: 'timeout',
    difficulty: 1,
    code: "console.log('first');\nsetTimeout(() => { console.log('second (from setTimeout)'); }, 0);\nconsole.log('third');",
    ops: [
      { op: 'log', text: 'first' },
      { op: 'timeout', name: 'setTimeout cb', body: [{ op: 'log', text: 'second (from setTimeout)' }] },
      { op: 'log', text: 'third' },
    ],
    expectedOrder: ['first', 'third', 'second (from setTimeout)'],
    cite: CITES.whatwgLoop,
    rule: 'A 0 ms timeout only queues a macrotask; the current task must finish first.',
  }),

  base({
    id: 'timeout-fifo',
    title: 'Equal-delay timers fire in FIFO order',
    topic: 'timeout',
    difficulty: 1,
    code: "setTimeout(() => { console.log('timer 1'); }, 0);\nsetTimeout(() => { console.log('timer 2'); }, 0);\nconsole.log('sync end');",
    ops: [
      { op: 'timeout', name: 'timer 1 cb', body: [{ op: 'log', text: 'timer 1' }] },
      { op: 'timeout', name: 'timer 2 cb', body: [{ op: 'log', text: 'timer 2' }] },
      { op: 'log', text: 'sync end' },
    ],
    expectedOrder: ['sync end', 'timer 1', 'timer 2'],
    cite: CITES.whatwgLoop,
    rule: 'The macrotask queue is first-in first-out for callbacks with the same delay.',
  }),

  base({
    id: 'timeout-zero-still-waits',
    title: 'Zero delay is not "immediately"',
    topic: 'timeout',
    difficulty: 1,
    code: "setTimeout(() => { console.log('zero-delay timer'); }, 0);\nconsole.log('a');\nconsole.log('b');",
    ops: [
      { op: 'timeout', name: 'timer cb', body: [{ op: 'log', text: 'zero-delay timer' }] },
      { op: 'log', text: 'a' },
      { op: 'log', text: 'b' },
    ],
    expectedOrder: ['a', 'b', 'zero-delay timer'],
    cite: CITES.whatwgLoop,
    rule: 'setTimeout(fn, 0) means "as soon as the loop is free", never "right now".',
  }),

  base({
    id: 'nested-timeout',
    title: 'A timer scheduled inside a timer goes to the back',
    topic: 'timeout',
    difficulty: 2,
    code: "setTimeout(() => { console.log('x1'); setTimeout(() => { console.log('x3'); }, 0); }, 0);\nsetTimeout(() => { console.log('x2'); }, 0);",
    ops: [
      {
        op: 'timeout', name: 'x1 cb', body: [
          { op: 'log', text: 'x1' },
          { op: 'timeout', name: 'x3 cb', body: [{ op: 'log', text: 'x3' }] },
        ],
      },
      { op: 'timeout', name: 'x2 cb', body: [{ op: 'log', text: 'x2' }] },
    ],
    expectedOrder: ['x1', 'x2', 'x3'],
    cite: CITES.whatwgLoop,
    rule: 'x3 is enqueued while x2 is already waiting, so it runs after x2.',
  }),

  base({
    id: 'timeout-inside-call',
    title: 'Scheduling inside a function is still just scheduling',
    topic: 'timeout',
    difficulty: 2,
    code: "function schedule() { setTimeout(() => { console.log('callback fires'); }, 0); console.log('scheduled'); }\nschedule();\nconsole.log('sync end');",
    ops: [
      {
        op: 'call', name: 'schedule', body: [
          { op: 'timeout', name: 'callback', body: [{ op: 'log', text: 'callback fires' }] },
          { op: 'log', text: 'scheduled' },
        ],
      },
      { op: 'log', text: 'sync end' },
    ],
    expectedOrder: ['scheduled', 'sync end', 'callback fires'],
    cite: CITES.whatwgLoop,
    rule: 'setTimeout returns instantly; the enclosing function keeps running.',
  }),

  base({
    id: 'sync-vs-queued-call',
    title: 'Same function: called now vs queued for later',
    topic: 'timeout',
    difficulty: 2,
    code: "function work() { console.log('work runs now'); }\nsetTimeout(() => { work(); }, 0);\nwork();\nconsole.log('end of script');",
    ops: [
      {
        op: 'timeout', name: 'timer cb', body: [
          { op: 'call', name: 'work', body: [{ op: 'log', text: 'work runs now' }] },
        ],
      },
      { op: 'call', name: 'work', body: [{ op: 'log', text: 'work runs now' }] },
      { op: 'log', text: 'end of script' },
    ],
    expectedOrder: ['work runs now', 'end of script', 'work runs now'],
    cite: CITES.whatwgLoop,
    rule: 'The direct call runs on the current stack; the queued call waits its macrotask turn.',
  }),

  /* ============ then-chain — promise callbacks ============ */

  base({
    id: 'then-basic',
    title: '.then on a resolved promise is a microtask',
    topic: 'then-chain',
    difficulty: 1,
    code: "console.log('start');\nPromise.resolve().then(() => { console.log('then callback'); });\nconsole.log('end');",
    ops: [
      { op: 'log', text: 'start' },
      { op: 'then', chain: [{ name: 'then cb', body: [{ op: 'log', text: 'then callback' }] }] },
      { op: 'log', text: 'end' },
    ],
    expectedOrder: ['start', 'end', 'then callback'],
    cite: CITES.mdnMicro,
    rule: 'Even an already-resolved promise never runs its callback synchronously.',
  }),

  base({
    id: 'two-promises-fifo',
    title: 'Independent promise callbacks run in FIFO order',
    topic: 'then-chain',
    difficulty: 1,
    code: "Promise.resolve().then(() => { console.log('p'); });\nPromise.resolve().then(() => { console.log('q'); });\nconsole.log('s');",
    ops: [
      { op: 'then', chain: [{ name: 'p cb', body: [{ op: 'log', text: 'p' }] }] },
      { op: 'then', chain: [{ name: 'q cb', body: [{ op: 'log', text: 'q' }] }] },
      { op: 'log', text: 's' },
    ],
    expectedOrder: ['s', 'p', 'q'],
    cite: CITES.mdnMicro,
    rule: 'The microtask queue is FIFO: callbacks run in the order they were queued.',
  }),

  base({
    id: 'then-chain-two',
    title: 'Each .then link waits for the previous one',
    topic: 'then-chain',
    difficulty: 1,
    code: "Promise.resolve().then(() => { console.log('link one'); }).then(() => { console.log('link two'); });\nconsole.log('sync');",
    ops: [
      {
        op: 'then', chain: [
          { name: 'link one cb', body: [{ op: 'log', text: 'link one' }] },
          { name: 'link two cb', body: [{ op: 'log', text: 'link two' }] },
        ],
      },
      { op: 'log', text: 'sync' },
    ],
    expectedOrder: ['sync', 'link one', 'link two'],
    cite: CITES.mdnMicro,
    rule: 'Only the first link is queued now; link two is queued when link one returns.',
  }),

  base({
    id: 'then-chain-interleave',
    title: 'Two chains interleave link by link',
    topic: 'then-chain',
    difficulty: 2,
    code: "Promise.resolve().then(() => { console.log('a1'); }).then(() => { console.log('a2'); });\nPromise.resolve().then(() => { console.log('b1'); }).then(() => { console.log('b2'); });",
    ops: [
      {
        op: 'then', chain: [
          { name: 'a1 cb', body: [{ op: 'log', text: 'a1' }] },
          { name: 'a2 cb', body: [{ op: 'log', text: 'a2' }] },
        ],
      },
      {
        op: 'then', chain: [
          { name: 'b1 cb', body: [{ op: 'log', text: 'b1' }] },
          { name: 'b2 cb', body: [{ op: 'log', text: 'b2' }] },
        ],
      },
    ],
    expectedOrder: ['a1', 'b1', 'a2', 'b2'],
    cite: CITES.mdnMicro,
    rule: 'a2 is queued only after a1 runs — by then b1 is already ahead of it in the queue.',
  }),

  base({
    id: 'then-three-vs-one',
    title: 'A long chain does not block a short one',
    topic: 'then-chain',
    difficulty: 2,
    code: "Promise.resolve().then(() => { console.log('c1'); }).then(() => { console.log('c2'); }).then(() => { console.log('c3'); });\nPromise.resolve().then(() => { console.log('d1'); });",
    ops: [
      {
        op: 'then', chain: [
          { name: 'c1 cb', body: [{ op: 'log', text: 'c1' }] },
          { name: 'c2 cb', body: [{ op: 'log', text: 'c2' }] },
          { name: 'c3 cb', body: [{ op: 'log', text: 'c3' }] },
        ],
      },
      { op: 'then', chain: [{ name: 'd1 cb', body: [{ op: 'log', text: 'd1' }] }] },
    ],
    expectedOrder: ['c1', 'd1', 'c2', 'c3'],
    cite: CITES.mdnMicro,
    rule: 'Chains advance one microtask at a time, so unrelated callbacks slot in between.',
  }),

  base({
    id: 'then-inside-then',
    title: 'A promise queued inside a callback beats the next link',
    topic: 'then-chain',
    difficulty: 3,
    code: "Promise.resolve().then(() => { console.log('outer'); Promise.resolve().then(() => { console.log('inner'); }); }).then(() => { console.log('chained'); });",
    ops: [
      {
        op: 'then', chain: [
          {
            name: 'outer cb', body: [
              { op: 'log', text: 'outer' },
              { op: 'then', chain: [{ name: 'inner cb', body: [{ op: 'log', text: 'inner' }] }] },
            ],
          },
          { name: 'chained cb', body: [{ op: 'log', text: 'chained' }] },
        ],
      },
    ],
    expectedOrder: ['outer', 'inner', 'chained'],
    cite: CITES.mdnMicro,
    rule: 'inner is queued while outer runs; chained is queued only when outer returns.',
  }),

  /* ============ microtask — queueMicrotask + drain rules ============ */

  base({
    id: 'qm-basic',
    title: 'queueMicrotask runs after the current task',
    topic: 'microtask',
    difficulty: 1,
    code: "console.log('s1');\nqueueMicrotask(() => { console.log('microtask'); });\nconsole.log('s2');",
    ops: [
      { op: 'log', text: 's1' },
      { op: 'micro', name: 'microtask cb', body: [{ op: 'log', text: 'microtask' }] },
      { op: 'log', text: 's2' },
    ],
    expectedOrder: ['s1', 's2', 'microtask'],
    cite: CITES.mdnMicro,
    rule: 'A microtask runs when the stack empties — after the script, before any timer.',
  }),

  base({
    id: 'qm-vs-then',
    title: 'Promises and queueMicrotask share one queue',
    topic: 'microtask',
    difficulty: 1,
    code: "Promise.resolve().then(() => { console.log('then'); });\nqueueMicrotask(() => { console.log('qm'); });\nconsole.log('sync');",
    ops: [
      { op: 'then', chain: [{ name: 'then cb', body: [{ op: 'log', text: 'then' }] }] },
      { op: 'micro', name: 'qm cb', body: [{ op: 'log', text: 'qm' }] },
      { op: 'log', text: 'sync' },
    ],
    expectedOrder: ['sync', 'then', 'qm'],
    cite: CITES.mdnMicro,
    rule: 'There is one microtask queue; .then and queueMicrotask enqueue to the same place.',
  }),

  base({
    id: 'qm-nested',
    title: 'Microtasks queued by microtasks run in the same drain',
    topic: 'microtask',
    difficulty: 2,
    code: "queueMicrotask(() => { console.log('m1'); queueMicrotask(() => { console.log('m2'); }); });\nconsole.log('sync');",
    ops: [
      {
        op: 'micro', name: 'm1 cb', body: [
          { op: 'log', text: 'm1' },
          { op: 'micro', name: 'm2 cb', body: [{ op: 'log', text: 'm2' }] },
        ],
      },
      { op: 'log', text: 'sync' },
    ],
    expectedOrder: ['sync', 'm1', 'm2'],
    cite: CITES.whatwgCheckpoint,
    rule: 'The checkpoint drains until the queue is EMPTY — even for freshly added microtasks.',
  }),

  base({
    id: 'qm-before-timeout',
    title: 'A microtask always beats a waiting macrotask',
    topic: 'microtask',
    difficulty: 1,
    code: "setTimeout(() => { console.log('timer'); }, 0);\nqueueMicrotask(() => { console.log('micro'); });\nconsole.log('sync');",
    ops: [
      { op: 'timeout', name: 'timer cb', body: [{ op: 'log', text: 'timer' }] },
      { op: 'micro', name: 'micro cb', body: [{ op: 'log', text: 'micro' }] },
      { op: 'log', text: 'sync' },
    ],
    expectedOrder: ['sync', 'micro', 'timer'],
    cite: CITES.mdnMicro,
    rule: 'The timer was queued FIRST but still loses: microtasks drain before the next task.',
  }),

  base({
    id: 'micro-between-macros',
    title: 'Microtasks drain between every two macrotasks',
    topic: 'microtask',
    difficulty: 2,
    code: "setTimeout(() => { console.log('t1'); queueMicrotask(() => { console.log('m1'); }); }, 0);\nsetTimeout(() => { console.log('t2'); }, 0);",
    ops: [
      {
        op: 'timeout', name: 't1 cb', body: [
          { op: 'log', text: 't1' },
          { op: 'micro', name: 'm1 cb', body: [{ op: 'log', text: 'm1' }] },
        ],
      },
      { op: 'timeout', name: 't2 cb', body: [{ op: 'log', text: 't2' }] },
    ],
    expectedOrder: ['t1', 'm1', 't2'],
    cite: CITES.whatwgCheckpoint,
    rule: 'After EVERY task the loop runs a microtask checkpoint — m1 cuts in before t2.',
  }),

  base({
    id: 'microtasks-drain-fully',
    title: 'The whole microtask cascade beats the first timer',
    topic: 'microtask',
    difficulty: 2,
    code: "setTimeout(() => { console.log('t1'); }, 0);\nsetTimeout(() => { console.log('t2'); }, 0);\nPromise.resolve().then(() => { console.log('p1'); Promise.resolve().then(() => { console.log('p2'); }); });",
    ops: [
      { op: 'timeout', name: 't1 cb', body: [{ op: 'log', text: 't1' }] },
      { op: 'timeout', name: 't2 cb', body: [{ op: 'log', text: 't2' }] },
      {
        op: 'then', chain: [
          {
            name: 'p1 cb', body: [
              { op: 'log', text: 'p1' },
              { op: 'then', chain: [{ name: 'p2 cb', body: [{ op: 'log', text: 'p2' }] }] },
            ],
          },
        ],
      },
    ],
    expectedOrder: ['p1', 'p2', 't1', 't2'],
    cite: CITES.whatwgCheckpoint,
    rule: 'p2 was queued DURING the drain and still runs before either waiting timer.',
  }),

  /* ============ async-await ============ */

  base({
    id: 'await-suspends',
    title: 'await suspends the function, not the script',
    topic: 'async-await',
    difficulty: 1,
    code: "async function f() { console.log('1'); await null; console.log('2'); }\nf();\nconsole.log('3');",
    ops: [
      {
        op: 'asyncCall', name: 'f', body: [
          { op: 'log', text: '1' },
          { op: 'await', target: { kind: 'value' } },
          { op: 'log', text: '2' },
        ],
      },
      { op: 'log', text: '3' },
    ],
    expectedOrder: ['1', '3', '2'],
    cite: CITES.v8Async,
    rule: "await suspends f(); its continuation is queued as a microtask while the script continues.",
  }),

  base({
    id: 'async-sync-part',
    title: 'An async function starts synchronously',
    topic: 'async-await',
    difficulty: 1,
    code: "async function f() { console.log('f: before await'); await null; console.log('f: after await'); }\nconsole.log('before call');\nf();\nconsole.log('after call');",
    ops: [
      { op: 'log', text: 'before call' },
      {
        op: 'asyncCall', name: 'f', body: [
          { op: 'log', text: 'f: before await' },
          { op: 'await', target: { kind: 'value' } },
          { op: 'log', text: 'f: after await' },
        ],
      },
      { op: 'log', text: 'after call' },
    ],
    expectedOrder: ['before call', 'f: before await', 'after call', 'f: after await'],
    cite: CITES.v8Async,
    rule: 'Everything before the first await runs on the caller’s stack, synchronously.',
  }),

  base({
    id: 'await-resolved-one-tick',
    title: 'Awaiting a resolved promise costs exactly one tick',
    topic: 'async-await',
    difficulty: 3,
    code: "async function f() { await Promise.resolve(); console.log('a'); }\nf();\nPromise.resolve().then(() => { console.log('b'); }).then(() => { console.log('c'); });",
    ops: [
      {
        op: 'asyncCall', name: 'f', body: [
          { op: 'await', target: { kind: 'promise' } },
          { op: 'log', text: 'a' },
        ],
      },
      {
        op: 'then', chain: [
          { name: 'b cb', body: [{ op: 'log', text: 'b' }] },
          { name: 'c cb', body: [{ op: 'log', text: 'c' }] },
        ],
      },
    ],
    expectedOrder: ['a', 'b', 'c'],
    cite: CITES.v8Async,
    rule: 'Since ES2019 a resolved await takes ONE microtask tick — a lands before b.',
  }),

  base({
    id: 'await-async-fn',
    title: 'Awaiting an async function that finishes instantly',
    topic: 'async-await',
    difficulty: 2,
    code: "async function b() { console.log('b runs'); }\nasync function a() { console.log('a: start'); await b(); console.log('a: end'); }\na();\nconsole.log('sync');",
    ops: [
      {
        op: 'asyncCall', name: 'a', body: [
          { op: 'log', text: 'a: start' },
          { op: 'await', target: { kind: 'asyncCall', name: 'b', body: [{ op: 'log', text: 'b runs' }] } },
          { op: 'log', text: 'a: end' },
        ],
      },
      { op: 'log', text: 'sync' },
    ],
    expectedOrder: ['a: start', 'b runs', 'sync', 'a: end'],
    cite: CITES.v8Async,
    rule: "b() runs synchronously to completion; a's continuation still waits one tick.",
  }),

  base({
    id: 'two-awaits',
    title: 'Each await is its own suspension',
    topic: 'async-await',
    difficulty: 2,
    code: "async function f() { console.log('one'); await null; console.log('two'); await null; console.log('three'); }\nf();\nconsole.log('sync');",
    ops: [
      {
        op: 'asyncCall', name: 'f', body: [
          { op: 'log', text: 'one' },
          { op: 'await', target: { kind: 'value' } },
          { op: 'log', text: 'two' },
          { op: 'await', target: { kind: 'value' } },
          { op: 'log', text: 'three' },
        ],
      },
      { op: 'log', text: 'sync' },
    ],
    expectedOrder: ['one', 'sync', 'two', 'three'],
    cite: CITES.v8Async,
    rule: 'The function suspends at every await; each continuation is a separate microtask.',
  }),

  base({
    id: 'two-async-fns',
    title: 'Two suspended functions resume in call order',
    topic: 'async-await',
    difficulty: 2,
    code: "async function f() { console.log('f: sync'); await null; console.log('f: resumed'); }\nasync function g() { console.log('g: sync'); await null; console.log('g: resumed'); }\nf();\ng();\nconsole.log('script end');",
    ops: [
      {
        op: 'asyncCall', name: 'f', body: [
          { op: 'log', text: 'f: sync' },
          { op: 'await', target: { kind: 'value' } },
          { op: 'log', text: 'f: resumed' },
        ],
      },
      {
        op: 'asyncCall', name: 'g', body: [
          { op: 'log', text: 'g: sync' },
          { op: 'await', target: { kind: 'value' } },
          { op: 'log', text: 'g: resumed' },
        ],
      },
      { op: 'log', text: 'script end' },
    ],
    expectedOrder: ['f: sync', 'g: sync', 'script end', 'f: resumed', 'g: resumed'],
    cite: CITES.v8Async,
    rule: 'Continuations are queued FIFO: f suspended first, so f resumes first.',
  }),

  /* ============ mixed — interview classics ============ */

  base({
    id: 'classic-interleave',
    title: 'The classic: sync, promise, timeout',
    topic: 'mixed',
    difficulty: 2,
    code: "console.log('A');\nsetTimeout(() => { console.log('B'); }, 0);\nPromise.resolve().then(() => { console.log('C'); });\nconsole.log('D');",
    ops: [
      { op: 'log', text: 'A' },
      { op: 'timeout', name: 'B cb', body: [{ op: 'log', text: 'B' }] },
      { op: 'then', chain: [{ name: 'C cb', body: [{ op: 'log', text: 'C' }] }] },
      { op: 'log', text: 'D' },
    ],
    expectedOrder: ['A', 'D', 'C', 'B'],
    cite: CITES.whatwgCheckpoint,
    rule: 'Sync first, then the microtask (C), and only then the macrotask (B).',
  }),

  base({
    id: 'interview-classic-full',
    title: 'The full interview classic: async1 / async2',
    topic: 'mixed',
    difficulty: 3,
    code: "async function async2() { console.log('async2'); }\nasync function async1() { console.log('async1 start'); await async2(); console.log('async1 end'); }\nconsole.log('script start');\nsetTimeout(() => { console.log('setTimeout'); }, 0);\nasync1();\nPromise.resolve().then(() => { console.log('promise1'); }).then(() => { console.log('promise2'); });\nconsole.log('script end');",
    ops: [
      { op: 'log', text: 'script start' },
      { op: 'timeout', name: 'setTimeout cb', body: [{ op: 'log', text: 'setTimeout' }] },
      {
        op: 'asyncCall', name: 'async1', body: [
          { op: 'log', text: 'async1 start' },
          { op: 'await', target: { kind: 'asyncCall', name: 'async2', body: [{ op: 'log', text: 'async2' }] } },
          { op: 'log', text: 'async1 end' },
        ],
      },
      {
        op: 'then', chain: [
          { name: 'promise1 cb', body: [{ op: 'log', text: 'promise1' }] },
          { name: 'promise2 cb', body: [{ op: 'log', text: 'promise2' }] },
        ],
      },
      { op: 'log', text: 'script end' },
    ],
    expectedOrder: ['script start', 'async1 start', 'async2', 'script end', 'async1 end', 'promise1', 'promise2', 'setTimeout'],
    cite: CITES.v8Async,
    rule: "async1's continuation was queued before promise1's callback, so it resumes first (ES2019).",
  }),

  base({
    id: 'macro-own-microtasks',
    title: 'Every macrotask gets its own microtask drain',
    topic: 'mixed',
    difficulty: 3,
    code: "setTimeout(() => { console.log('macro 1'); Promise.resolve().then(() => { console.log('micro in macro 1'); }); }, 0);\nsetTimeout(() => { console.log('macro 2'); }, 0);\nPromise.resolve().then(() => { console.log('micro 1'); });\nconsole.log('sync');",
    ops: [
      {
        op: 'timeout', name: 'macro 1 cb', body: [
          { op: 'log', text: 'macro 1' },
          { op: 'then', chain: [{ name: 'micro-in-macro cb', body: [{ op: 'log', text: 'micro in macro 1' }] }] },
        ],
      },
      { op: 'timeout', name: 'macro 2 cb', body: [{ op: 'log', text: 'macro 2' }] },
      { op: 'then', chain: [{ name: 'micro 1 cb', body: [{ op: 'log', text: 'micro 1' }] }] },
      { op: 'log', text: 'sync' },
    ],
    expectedOrder: ['sync', 'micro 1', 'macro 1', 'micro in macro 1', 'macro 2'],
    cite: CITES.whatwgCheckpoint,
    rule: 'micro-in-macro-1 runs between the two timers — a checkpoint follows every task.',
  }),

  base({
    id: 'await-vs-timeout',
    title: 'A continuation beats a timer queued earlier',
    topic: 'mixed',
    difficulty: 2,
    code: "async function f() { console.log('f: sync part'); await null; console.log('f: continuation'); }\nsetTimeout(() => { console.log('timer'); }, 0);\nf();\nconsole.log('script end');",
    ops: [
      { op: 'timeout', name: 'timer cb', body: [{ op: 'log', text: 'timer' }] },
      {
        op: 'asyncCall', name: 'f', body: [
          { op: 'log', text: 'f: sync part' },
          { op: 'await', target: { kind: 'value' } },
          { op: 'log', text: 'f: continuation' },
        ],
      },
      { op: 'log', text: 'script end' },
    ],
    expectedOrder: ['f: sync part', 'script end', 'f: continuation', 'timer'],
    cite: CITES.v8Async,
    rule: 'The timer was queued first, but await continuations are microtasks — they win.',
  }),

  base({
    id: 'qm-await-order',
    title: 'queueMicrotask vs an await continuation',
    topic: 'mixed',
    difficulty: 2,
    code: "async function f() { await null; console.log('after await'); }\nqueueMicrotask(() => { console.log('qm'); });\nf();\nconsole.log('sync');",
    ops: [
      { op: 'micro', name: 'qm cb', body: [{ op: 'log', text: 'qm' }] },
      {
        op: 'asyncCall', name: 'f', body: [
          { op: 'await', target: { kind: 'value' } },
          { op: 'log', text: 'after await' },
        ],
      },
      { op: 'log', text: 'sync' },
    ],
    expectedOrder: ['sync', 'qm', 'after await'],
    cite: CITES.mdnMicro,
    rule: 'One FIFO queue: qm was enqueued before f() suspended, so qm runs first.',
  }),

  base({
    id: 'grand-finale',
    title: 'Grand finale: everything at once',
    topic: 'mixed',
    difficulty: 3,
    code: "console.log('start');\nsetTimeout(() => { console.log('timeout 1'); }, 0);\nqueueMicrotask(() => { console.log('microtask'); });\nasync function main() { console.log('main sync'); await Promise.resolve(); console.log('main resumed'); }\nmain();\nPromise.resolve().then(() => { console.log('then 1'); }).then(() => { console.log('then 2'); });\nsetTimeout(() => { console.log('timeout 2'); Promise.resolve().then(() => { console.log('then in timeout'); }); }, 0);\nconsole.log('end');",
    ops: [
      { op: 'log', text: 'start' },
      { op: 'timeout', name: 'timeout 1 cb', body: [{ op: 'log', text: 'timeout 1' }] },
      { op: 'micro', name: 'microtask cb', body: [{ op: 'log', text: 'microtask' }] },
      {
        op: 'asyncCall', name: 'main', body: [
          { op: 'log', text: 'main sync' },
          { op: 'await', target: { kind: 'promise' } },
          { op: 'log', text: 'main resumed' },
        ],
      },
      {
        op: 'then', chain: [
          { name: 'then 1 cb', body: [{ op: 'log', text: 'then 1' }] },
          { name: 'then 2 cb', body: [{ op: 'log', text: 'then 2' }] },
        ],
      },
      {
        op: 'timeout', name: 'timeout 2 cb', body: [
          { op: 'log', text: 'timeout 2' },
          { op: 'then', chain: [{ name: 'then-in-timeout cb', body: [{ op: 'log', text: 'then in timeout' }] }] },
        ],
      },
      { op: 'log', text: 'end' },
    ],
    expectedOrder: ['start', 'main sync', 'end', 'microtask', 'main resumed', 'then 1', 'then 2', 'timeout 1', 'timeout 2', 'then in timeout'],
    cite: CITES.whatwgCheckpoint,
    rule: 'Script → full microtask drain (FIFO: microtask, main resumed, then 1, then 2) → timers one by one.',
  }),
];

if (typeof module !== 'undefined') {
  module.exports = { SNIPPETS, CITES, VERIFIED_NODE, VERIFIED_DATE };
}
