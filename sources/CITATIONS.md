# looptrace — corpus citations

The primary ground truth for every snippet in `data/snippets.js` is **execution**, not
citation: each snippet's code runs verbatim in a real Node child process (Node v25.4.0,
verified 2026-07-23) and the captured console order must exactly equal both the scheduler
model's prediction and the stored `expectedOrder` (`tools/verify.mjs`, permanently
enforced by `test/node-proof.test.js`). The citations below source the *rules* the
snippets demonstrate.

## Staged sources (fetched and read 2026-07-23)

1. **WHATWG HTML Standard — § Event loops**
   https://html.spec.whatwg.org/multipage/webappapis.html#event-loops
   Excerpt notes: `whatwg-event-loops.md`
   Confidence: the section structure (8.1.7 Event loops: Definitions / Queuing tasks /
   Processing model / Generic task sources) was confirmed by fetch on 2026-07-23, but the
   page is too large for the fetch tool to return the full normative text, so the
   drain-until-empty checkpoint rule was **cross-checked verbatim against MDN's in-depth
   guide** (source 2), which restates the same model. Anchors cited
   (`#event-loops`, `#perform-a-microtask-checkpoint`) are the spec's long-stable section
   anchors.

2. **MDN — In depth: Microtasks and the JavaScript runtime environment**
   https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide/In_depth
   Excerpt notes: `mdn-microtasks-in-depth.md` — verbatim quotes captured 2026-07-23.

3. **MDN — Using microtasks in JavaScript with queueMicrotask()**
   https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide
   Excerpt notes: `mdn-queuemicrotask.md` — verbatim quotes captured 2026-07-23.

4. **V8 blog — Faster async functions and promises** (Armyanova & Meurer, 2018-11-12)
   https://v8.dev/blog/fast-async
   Excerpt notes: `v8-fast-async.md` — verbatim quotes captured 2026-07-23. Documents the
   one-tick resolved-await behaviour standardised for ES2019
   (tc39/ecma262#1250).

5. **Node.js Learn — The Node.js Event Loop** (feeds the *not-simulated* aside only)
   https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick
   Excerpt notes: `nodejs-event-loop.md` — verbatim quotes captured 2026-07-23.
