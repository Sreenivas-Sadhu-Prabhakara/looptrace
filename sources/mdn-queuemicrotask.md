# MDN — Using microtasks in JavaScript with queueMicrotask()

- URL: https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide
- Fetched: 2026-07-23 (page title confirmed: "Using microtasks in JavaScript with queueMicrotask()")

## Verbatim excerpts

When microtasks run relative to tasks:

> "Each time a task exits, the event loop checks to see if the task is returning control
> to other JavaScript code. If not, it runs all of the microtasks in the microtask queue.
> The microtask queue is, then, processed multiple times per iteration of the event loop,
> including after handling events and other callbacks."

Microtasks added during the drain still beat the next task:

> "If a microtask adds more microtasks to the queue by calling `queueMicrotask()`, those
> newly-added microtasks *execute before the next task is run*. That's because the event
> loop will keep calling microtasks until there are none left in the queue, even if more
> keep getting added."

Promise callbacks are microtasks:

> "JavaScript promises and the Mutation Observer API both use the microtask queue to run
> their callbacks"
