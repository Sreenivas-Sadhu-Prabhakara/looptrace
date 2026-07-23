/* ============================================================
   looptrace — scheduler model
   A small, deterministic model of the WHATWG HTML event loop over
   a whitelisted op-set: sync call/return, console.log, setTimeout(0),
   Promise.resolve().then chains, queueMicrotask, async/await (ES2019
   one-tick resolved await).
   Ground truth is NOT this model: every corpus snippet is executed in
   a real Node child process and the model's prediction must match
   (see test/node-proof.test.js). Any disagreement cuts the snippet.
   Works in both the browser (globals) and Node (module.exports).
   ============================================================ */

'use strict';

/* ---------- whitelist guard -------------------------------------
   compileOps(code) validates a snippet's source text against the
   whitelisted construct set. It never evaluates code; it refuses
   anything outside the model's vocabulary so the corpus can only
   contain snippets the model actually understands. */

const BANNED_TOKENS = [
  'setImmediate', 'process.nextTick', 'nextTick', 'setInterval',
  'requestAnimationFrame', 'requestIdleCallback', 'fetch(', 'XMLHttpRequest',
  'WebSocket', 'addEventListener', 'new Worker', 'importScripts', 'eval(',
  'new Function', 'MutationObserver', 'MessageChannel', 'postMessage',
  'new Promise', 'Promise.all', 'Promise.race', 'Promise.allSettled',
  'Promise.any', '.catch(', '.finally(', 'throw ', 'async () =>',
  'setTimeout(', // re-allowed below only as setTimeout(fn, 0)
];

function compileOps(code) {
  if (typeof code !== 'string' || code.trim() === '') {
    throw new Error('whitelist: empty snippet');
  }
  for (const tok of BANNED_TOKENS) {
    if (tok === 'setTimeout(') continue; // handled structurally below
    if (code.includes(tok)) {
      throw new Error('whitelist: "' + tok.trim() + '" is not in the modelled op-set');
    }
  }
  // setTimeout is allowed ONLY with an inline function callback and 0 delay
  let at = code.indexOf('setTimeout(');
  while (at !== -1) {
    const tail = code.slice(at + 'setTimeout('.length);
    if (!/^\s*(?:\(\)\s*=>|function\b)/.test(tail)) {
      throw new Error('whitelist: setTimeout only accepts an inline function callback');
    }
    at = code.indexOf('setTimeout(', at + 1);
  }
  const delays = code.match(/\}\s*,\s*(\d+)\s*\)/g) || [];
  for (const d of delays) {
    const n = d.match(/,\s*(\d+)\s*\)/);
    if (n && n[1] !== '0') {
      throw new Error('whitelist: setTimeout is modelled as 0-delay only');
    }
  }
  return { ok: true };
}

/* ---------- the simulator ---------------------------------------
   simulate(ops) interprets a snippet's compiled op sequence and emits
   { steps, order }:
     steps: [{ phase, caption, stack[], micro[], macro[], console[] }]
     order: the predicted console order (array of strings)

   Op vocabulary (authored per snippet in data/snippets.js):
     { op:'log',   text }
     { op:'call',  name, body }              // sync function call
     { op:'timeout', name, body }            // setTimeout(fn, 0)
     { op:'micro', name, body }              // queueMicrotask(fn)
     { op:'then',  chain:[{name, body},…] }  // Promise.resolve().then(…).then(…)
     { op:'asyncCall', name, body }          // async fn call, fire-and-forget
     { op:'await', target }                  // inside async bodies only
       target: {kind:'value'} | {kind:'promise'} |
               {kind:'asyncCall', name, body}
*/

function simulate(ops) {
  const micro = [];   // microtask queue: {name, exec}
  const macro = [];   // macrotask queue: {name, exec}
  const out = [];     // console output so far
  const stack = [];   // call stack frame names (bottom → top)
  const steps = [];
  let phase = 'script';

  function step(caption) {
    steps.push({
      phase,
      caption,
      stack: stack.slice(),
      micro: micro.map((t) => t.name),
      macro: macro.map((t) => t.name),
      console: out.slice(),
    });
  }

  function scheduleChain(chain, idx) {
    if (idx >= chain.length) return;
    const link = chain[idx];
    micro.push({
      name: link.name,
      exec: () => runBody(link.name, link.body, 0, () => scheduleChain(chain, idx + 1)),
    });
  }

  function startAsync(op) {
    const st = { done: false, waiters: [] };
    runBody(op.name + '()', op.body, 0, () => {
      st.done = true;
      st.waiters.forEach((w) => w());
    });
    return st;
  }

  // Runs a body from startIdx. onDone fires when the body truly completes
  // (possibly after any number of await suspensions).
  function runBody(name, ops2, startIdx, onDone) {
    stack.push(name);
    step(startIdx === 0
      ? name + ' is pushed onto the call stack'
      : name + ' resumes — its continuation is back on the call stack');
    let i = startIdx;
    while (i < ops2.length) {
      const op = ops2[i];
      i += 1;
      switch (op.op) {
        case 'log':
          out.push(op.text);
          step("console.log('" + op.text + "') prints → console");
          break;
        case 'call':
          runBody(op.name + '()', op.body, 0, null);
          break;
        case 'timeout':
          macro.push({ name: op.name, exec: () => runBody(op.name, op.body, 0, null) });
          step('setTimeout(…, 0) schedules ' + op.name + ' in the MACROTASK queue');
          break;
        case 'micro':
          micro.push({ name: op.name, exec: () => runBody(op.name, op.body, 0, null) });
          step('queueMicrotask() puts ' + op.name + ' in the MICROTASK queue');
          break;
        case 'then':
          scheduleChain(op.chain, 0);
          step('.then() on a resolved promise queues ' + op.chain[0].name + ' as a microtask' +
            (op.chain.length > 1 ? ' (later links wait for it to finish)' : ''));
          break;
        case 'asyncCall':
          startAsync(op);
          break;
        case 'await': {
          const rest = i;
          const resume = () => {
            micro.push({
              name: name + ' ↺ resume',
              exec: () => runBody(name, ops2, rest, onDone),
            });
          };
          const t = op.target;
          if (t.kind === 'asyncCall') {
            const st = startAsync(t); // callee runs its sync part on top of us
            stack.pop();
            if (st.done) {
              resume();
              step('await: ' + t.name + '() already finished, so ' + name +
                "'s continuation is queued as ONE microtask (ES2019)");
            } else {
              st.waiters.push(resume);
              step('await suspends ' + name + ' until ' + t.name + '() settles; ' +
                'its continuation will be queued as a microtask then');
            }
          } else {
            stack.pop();
            resume();
            step('await suspends ' + name + '; its continuation is queued as ONE microtask (ES2019 resolved-await)');
          }
          return; // suspended — completion happens via the queued resume
        }
        default:
          throw new Error('whitelist: unknown op "' + op.op + '"');
      }
    }
    stack.pop();
    step(name === 'script'
      ? 'script runs to completion — the call stack is empty'
      : name + ' returns — its frame pops off the stack');
    if (onDone) onDone();
  }

  // ---- the event loop ----
  runBody('script', ops, 0, null);
  for (;;) {
    while (micro.length > 0) {
      phase = 'micro';
      const t = micro.shift();
      step('microtask checkpoint: dequeue ' + t.name + ' (drain until EMPTY, before any macrotask)');
      t.exec();
    }
    if (macro.length === 0) break;
    phase = 'macro';
    const t = macro.shift();
    step('microtask queue empty → event loop takes ONE macrotask: ' + t.name);
    t.exec();
  }
  phase = 'idle';
  step('both queues empty — the event loop is idle. Final console order above.');
  return { steps, order: out.slice() };
}

/* ---------- corpus-facing helpers ---------------------------- */

function getSnippets() {
  if (typeof module !== 'undefined' && typeof require === 'function') {
    return require('./snippets.js').SNIPPETS;
  }
  /* global SNIPPETS */
  return SNIPPETS;
}

function findSnippet(id) {
  const s = getSnippets().find((x) => x.id === id);
  if (!s) throw new Error('unknown snippet id: ' + id);
  return s;
}

function predictOrder(id) {
  return simulate(findSnippet(id).ops).order;
}

function traceSnippet(id) {
  return simulate(findSnippet(id).ops);
}

if (typeof module !== 'undefined') {
  module.exports = { compileOps, simulate, predictOrder, traceSnippet, findSnippet };
}
