# Design

v0.1 has no graphical product UI. The operator and agent interface is the CLI and the MCP server.

## Who it is for

A person or an agent in any IDE or harness who has a section image and wants a real component. The same operations must work from Cursor, VS Code, Claude Code, Codex, Zed, or any MCP-capable harness, and from a terminal with no editor at all.

## CLI

The CLI name is `trace`. Every command takes JSON on stdin or as a file argument, and writes JSON to stdout. Errors go to stderr and a non-zero exit. The planned commands are:

| Command | Job |
| --- | --- |
| `trace extract` | Read a section image and write the spec (OCR text, colors, spacing, fonts, layout boxes, snapped to design tokens) and the intermediate tree. |
| `trace generate` | Read the intermediate description and the chosen stack, and write a scaffolded project that builds. |
| `trace render` | Build the project, open it in Playwright at the source image's exact width, and write the screenshot. |
| `trace score` | Compare the screenshot to the source image and write the combined score plus mismatched regions. |
| `trace loop` | Run extract, generate, render, score, and fix until the score clears the documented threshold or N rounds. |

`trace loop` is how issue #2 is run end to end. Stack choices (framework, build tool, styling, optional library or tokens, deploy target) are inputs to `generate` and `loop`, not separate product screens.

## MCP server

The MCP server exposes the same five operations as tools: extract the spec, generate, render, score, and the full loop. Transport is stdio by default. HTTP is optional.

No IDE-specific code belongs in the core. Editor integrations are thin wrappers around these tools and are out of scope for v0.1.

## Loop behavior

The threshold and N are chosen and written down before an eval run. Each failed pass returns the mismatched regions to generate. If the cap of N is hit, the last output, the score history, and the remaining mismatches are returned. The tool does not deploy, even when it has written `vercel.json`, `wrangler.toml`, or a static setup.
