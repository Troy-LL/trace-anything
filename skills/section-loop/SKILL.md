---
name: trace-section-loop
description: Fill one section's intermediate tree, then let trace write the HTML. Use for a single section or for each band after segment.
---

# Section loop

Run the section through the CLI:

```text
trace loop --image <section.png> [--out <dir>]
```

The command writes `intermediate.json`, the Vite project, the screenshot, and `score.json`. JSON comes back on stdout.

A node is a `box`, `text`, `image`, `link`, or `control`. Readable copy belongs on a `text` node. A button is `control`. A real anchor is `link`. Leave `image` empty. Do not point any style at the source screenshot.

Colors come from `tokens.colors`. Invented copy carries `guesses[]` with `field`, `reason`, and `confidence` on that node.

When `stopReason` is `cap`, stop. The fix-loop skill owns the next generate.
