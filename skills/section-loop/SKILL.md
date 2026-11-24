---
name: trace-section-loop
description: Fill one section's intermediate tree, then let trace write the HTML. Use for a single section or for each band after segment.
---

# Section loop

The tree exists before the HTML. Open `sections/<id>/pass-1/intermediate.json`.

A node is a `box`, `text`, `image`, `link`, or `control`. Put readable copy on a `text` node. Put a button on `control` and a real anchor on `link`. Leave `image` empty. Do not point any style at the source screenshot.

Colors come from `tokens.colors`. If you invent copy, add `guesses[]` with `field`, `reason`, and `confidence` on that node.

Write the file, then run `trace generate --intermediate <that file> --out <project dir>`.
