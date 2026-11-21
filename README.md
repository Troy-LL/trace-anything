# Trace Anything

Trace Anything reverse engineers any image into real HTML, CSS and TS components.

It is usable from any IDE or agent harness. The core is an editor-neutral library plus a CLI (`trace` commands with JSON in and out). The same operations are exposed as an MCP server (stdio, and optionally HTTP) so Cursor, VS Code, Claude Code, Codex, Zed, or any MCP-capable harness can call it. Editor integrations are thin wrappers and are out of scope for v0.1.

## How it works

You give it a picture of a UI section, or a whole page. If the input is a full page, a first stage called `segment` detects section boundaries (horizontal bands first, then nested blocks), crops each section, assigns a semantic label and a confidence, and writes an annotations file plus an annotated overlay PNG. The user or agent can review or edit those annotations before generation. That human checkpoint is optional via a flag. Each section then runs the loop below. A final step assembles the sections into a page and scores the whole page against the original too.

For a single section, the tool extracts a visual spec, generates the component, renders it, scores the result against the original image, and sends the mismatches back for another pass. That build, render, score, and fix loop repeats until the match clears a set threshold or it hits a round limit.

The generator writes one framework-neutral intermediate component description (the spec plus the tree). Per-target adapters emit the code, so the scoring loop stays the same for every stack. You pick the UI framework, the build tool, the styling (and optionally your own component library or tokens), and the deploy target. The first adapter is plain TS plus Vite plus static. The second is React plus Vite. The chosen deploy target emits the matching config files (`vercel.json`, `wrangler.toml`, or a static setup) and a scaffolded project that builds. Nothing is deployed.

Work happens one section at a time, not as a whole page in one shot. A full-page image is isolated into annotated sections first. After each section is scored, assemble stitches them into a page and scores that page against the original too.

## Goal

Beat screenshot-to-code and v0 on the public Design2Code benchmark, using Design2Code's official metrics, and publish the comparison.

## Status

Spec stage. Nothing is implemented yet. The first work is a baseline run of screenshot-to-code on a fixed Design2Code slice, then a v0.1 loop that turns a single section image into a component. Target-stack adapters and the harness-neutral CLI and MCP server follow that loop. Full-page input through `segment`, annotate, and assemble is specified too.

## Planned interface

These commands are specified, not implemented.

- `trace segment`: isolate a full-page image into annotated sections
- `trace extract`: extract the spec from a section image
- `trace generate`: emit a component from the intermediate format through a target adapter
- `trace render`: render the component with Playwright at the image's exact width
- `trace score`: score the render against the image
- `trace loop`: run extract, generate, render, score, and fix until the threshold or a round limit
- `trace assemble`: stitch scored sections into a page and score that page against the original

The MCP server exposes the same operations over stdio, and optionally over HTTP.

## Docs

- [Architecture](docs/architecture.md)
- [Design](docs/design.md)
- [Eval](docs/eval.md)

## Limits

- The generation unit is one section, not a whole page in one shot. A full-page image is allowed as input through `segment`, then assemble.
- Multi-page sites, Figma input, and a graphical product UI are out of scope for v0.1. Annotation review is JSON edit plus the overlay PNG, not an interactive GUI editor.
- Deploy config is generated. The tool does not deploy, and it does not handle account auth.
- No IDE-specific code belongs in the core.
