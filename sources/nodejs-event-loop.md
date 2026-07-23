# Node.js Learn — The Node.js Event Loop

- URL: https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick
- Fetched: 2026-07-23 (page title confirmed: "The Node.js Event Loop")
- Feeds ONLY the labelled "explained, not simulated" aside in looptrace.

## Verbatim excerpts

Phases (in order): timers → pending callbacks → idle, prepare → poll → check → close
callbacks.

setImmediate:

> "`setImmediate()` is actually a special timer that runs in a separate phase of the event
> loop. It uses a libuv API that schedules callbacks to execute after the **poll** phase
> has completed."

process.nextTick:

> "`process.nextTick()` is not technically part of the event loop. Instead, the
> `nextTickQueue` will be processed after the current operation is completed, regardless
> of the current phase of the event loop."
