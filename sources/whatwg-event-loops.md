# WHATWG HTML Standard — § Event loops

- URL: https://html.spec.whatwg.org/multipage/webappapis.html#event-loops
- Fetched: 2026-07-23

## What was verified

The fetch on 2026-07-23 confirmed the section structure of 8.1.7 "Event loops":

- 8.1.7.1 Definitions
- 8.1.7.2 Queuing tasks
- 8.1.7.3 Processing model
- 8.1.7.4 Generic task sources
- 8.1.7.5 Dealing with the event loop from other specifications

The page is larger than the fetch tool returns in one pass, so the full normative
processing-model text could not be captured verbatim here. The rules looptrace models —
one task per loop iteration, then a microtask checkpoint that drains the microtask queue
until it is empty — were cross-checked **verbatim** against MDN's restatement of this
section (see `mdn-microtasks-in-depth.md` and `mdn-queuemicrotask.md`), and are proven
behaviourally by the real-Node execution of all 36 snippets.

Anchors cited by the corpus (`#event-loops`, `#perform-a-microtask-checkpoint`) are the
spec's long-stable section anchors for 8.1.7 and its microtask-checkpoint algorithm.
