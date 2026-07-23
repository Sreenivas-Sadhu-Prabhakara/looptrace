# MDN — In depth: Microtasks and the JavaScript runtime environment

- URL: https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide/In_depth
- Fetched: 2026-07-23 (page title confirmed: "In depth: Microtasks and the JavaScript runtime environment")

## Verbatim excerpts

On tasks (one per event-loop iteration):

> "When a new iteration of the event loop begins, the runtime executes the next task from
> the task queue. Further tasks and tasks added to the queue after the start of the
> iteration *will not run until the next iteration*."

On microtasks (drained fully, including ones queued during the drain):

> "Whenever a task exits and the execution context stack is empty, all microtasks in the
> microtask queue are executed in turn. The difference is that execution of microtasks
> continues until the queue is empty — even if new ones are scheduled in the interim. In
> other words, microtasks can enqueue new microtasks and those new microtasks will execute
> before the next task begins to run, and before the end of the current event loop
> iteration."
