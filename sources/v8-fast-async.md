# V8 blog — Faster async functions and promises

- URL: https://v8.dev/blog/fast-async
- Authors/date: Maya Armyanova and Benedikt Meurer, 2018-11-12
- Fetched: 2026-07-23

## Verbatim excerpts

Old await cost (pre-optimization):

> "for each `await` the engine has to create **two additional** promises (even if the
> right hand side is already a promise) and it needs **at least three** microtask queue
> ticks."

The optimization (one tick for an already-resolved awaited promise):

> "This way you save one of the additional promises, plus two ticks on the microtask
> queue, for the common case that the value passed to `await` is already a promise."

Standardisation:

> "We've proposed this change to the ECMAScript specification as well."
> (tc39/ecma262#1250 — merged; normative for ES2019+.)

looptrace consequence: `await Promise.resolve()` / `await null` queue the function's
continuation as exactly ONE microtask on modern engines; pre-2019 engines ordered some
await snippets differently. Stated as an honest limit in-app and in the README.
