# MVP win condition

Status: Accepted

## Context

It would look right to call the product done once a React adapter, a deploy config, or an editor plugin exists. The first win is narrower, and it has to be provable by anyone who reruns the committed scripts.

## Decision

We will treat the MVP as won only when all four of the following hold:

1. On the same fixed Design2Code slice, with the same model, the single-section loop beats screenshot-to-code on the combined metric. Results and scripts are committed so anyone can rerun them.
2. The ASES full-page example runs end to end: segment, review overlay, build every section in plain HTML/CSS/TS with Vite, assemble, and a page-level score is recorded.
3. The same run works from the CLI and from an agent via the skills pack, with JSON in and out.
4. No image-as-background tricks, and each run stays under a set spend cap and round limit. Those values are TBD and will be set in issue #1.

The optional two-tool MCP server in [decision 006](006-skills-first-interface.md) is out of MVP scope. React, Tailwind, Rust, deploy configs, and editor plugins are post-MVP.

## Consequences

Shipping a React adapter, a deploy config, or an editor plugin does not satisfy the MVP. A run that beats the baseline by embedding the source image, or that exceeds the cap, does not satisfy it either. Issues #1, #2, #4, and #6 are the work that makes these four conditions true. Considerations that shape input, output, scoring, models, safety, and distribution live in [design](../design.md), [eval](../eval.md), and [architecture](../architecture.md).
