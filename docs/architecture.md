# Architecture

Trace Anything turns a section image into a scored component. There is no runnable code yet. This file is the topology the implementation must follow.

## Processes

- **Library.** Editor-neutral core. It owns extract, generate, render, score, and the full loop. No IDE-specific code lives here.
- **CLI.** The `trace` binary calls the library. JSON in, JSON out.
- **MCP server.** The same library operations, over stdio by default, and optionally over HTTP. Any MCP-capable harness can call it.
- **Renderer.** Playwright opens the adapter's built output at the source image's exact width and captures a screenshot.
- **Adapters.** Each adapter turns the same intermediate component description into a concrete project (framework, build tool, styling, deploy config).
- **Eval runner.** Scores a fixed slice and writes dated results under `evals/`. See [eval](eval.md).

Editor integrations, if they exist later, are thin wrappers around the CLI or the MCP server. They are not part of the core.

## Data flow

1. Input is one section image, plus the chosen stack (framework, build tool, styling, optional component library or tokens, deploy target).
2. Extract a spec: text via OCR, colors, spacing, fonts, and layout boxes, snapped to design tokens.
3. Write one framework-neutral intermediate component description: the spec plus the tree.
4. The selected adapter emits HTML, CSS, and TS (or the target's equivalent) and a scaffolded project that builds, including deploy config when the target is Vercel (`vercel.json`), Cloudflare Pages or Workers (`wrangler.toml`), or static.
5. Playwright renders the build at the image's exact width.
6. Score the screenshot against the source image with the combined metric: perceptual similarity, block/layout match, OCR text match, and color. Official Design2Code metrics (visual/CLIP, block match, text, position, color) are used on the baseline and for published comparisons.
7. Mark mismatched regions and feed them back into generate.
8. Repeat from generate until the combined score clears a documented threshold, or a maximum of N rounds.

The scoring loop does not change per stack. Only the adapter's emitted code changes.

## Adapters

The adapter interface is documented in code when adapters ship. The first adapter (the reference adapter) is plain TS plus Vite plus static. The second is React plus Vite. Later adapters may include Vue, Svelte, Rust options such as Leptos or Yew, and build tools such as Next.js, Astro, or Trunk. Those are listed, not built, in the first adapter pass.

## What this system does not do

- It does not deploy, and it does not perform account auth.
- It does not generate a full page or a multi-page site in v0.1.
- It does not take Figma input in v0.1.
- It does not include a graphical product UI in v0.1.
