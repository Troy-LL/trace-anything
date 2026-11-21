# Architecture

Trace Anything turns a section image, or a full-page image isolated into sections, into scored components. There is no runnable code yet. This file is the topology the implementation must follow.

## Processes

- **Library.** Editor-neutral core. It owns segment, extract, generate, render, score, assemble, and the full loop. No IDE-specific code lives here.
- **CLI.** The `trace` binary calls the library. JSON in, JSON out. This is the engine the skills pack, and any later wrapper, must call.
- **Skills pack.** SKILL.md folders in this repo, following the Agent Skills standard. They teach any agent to drive the CLI for segment, a section loop, score, the fix loop, and assemble. Install is planned as `npx skills add https://github.com/Troy-LL/trace-anything`, or by copying the folders into `~/.cursor/skills`, `~/.claude/skills`, or `~/.codex/skills`.
- **Optional MCP server.** A tiny two-tool server in the Code Mode pattern: `search` over the typed CLI and library surface, and `execute`, which runs a short script against that surface in a sandbox. Not required for the MVP. See [decision 006](decisions/006-skills-first-interface.md).
- **Renderer.** Playwright opens the adapter's built output at the source image's exact width and captures a screenshot.
- **Adapters.** Each adapter turns the same intermediate component description into a concrete project (framework, build tool, styling, deploy config).
- **Eval runner.** Scores a fixed slice and writes dated results under `evals/`. See [eval](eval.md).

Editor integrations, if they exist later, are thin wrappers around the CLI or the skills pack. They are not part of the core.

## Data flow

If the input is a full-page image, `segment` runs first. Very tall pages are tiled, then stitched, so segmentation and scoring stay within a documented size limit once that limit is set.

1. Detect section boundaries, horizontal bands first, then nested blocks.
2. Crop each section and assign a semantic label (nav/header, hero, features, testimonials, pricing, CTA, footer, other) with a confidence.
3. Write an annotations file (JSON: section id, bbox, label, confidence, order) and an annotated overlay PNG with boxes and labels.
4. If the optional review flag is set, stop so a person or agent can edit the annotations, then continue with the edited file.

Each cropped section then follows the loop below. After every section has been scored, a final assemble step stitches the sections into a page and scores that page against the original full-page image too.

### Section loop

1. Input is one section image, plus the chosen stack (framework, build tool, styling, optional component library or tokens, deploy target).
2. Extract a spec: text via OCR, colors, spacing, fonts, and layout boxes, snapped to design tokens.
3. Write one framework-neutral intermediate component description: the spec plus the tree.
4. The selected adapter emits HTML, CSS, and TS (or the target's equivalent) and a scaffolded project that builds, including deploy config when the target is Vercel (`vercel.json`), Cloudflare Pages or Workers (`wrangler.toml`), or static.
5. Playwright renders the build at the image's exact width.
6. Score the screenshot against the source image with the combined metric: perceptual similarity, block/layout match, OCR text match, and color. Official Design2Code metrics (visual/CLIP, block match, text, position, color) are used on the baseline and for published comparisons.
7. Mark mismatched regions and feed them back into generate.
8. Repeat from generate until the combined score clears a documented threshold, or a maximum of N rounds.

The scoring loop does not change per stack. Only the adapter's emitted code changes. Output must not embed the source image, including as a CSS background. Repeated extract and score work is cached. Reruns are seeded.

## Models

**Stance.** Each step may use a different vision or generation model. Users can bring their own key or model. There is no single-vendor lock-in. The model name and version used at each step are recorded in the score history so a run can be repeated.

**Open questions.** What is the default model for each step in the MVP? How is a user-supplied endpoint configured?

## Project files

A run writes this layout. The paths are planned; nothing is generated yet.

- `annotations.json`: section id, bbox, label, confidence, and order
- `overlay.png`: the page image with boxes and labels
- `sections/`: cropped section images
- `checks/`: scores, mismatch regions, and score history
- `out/`: the scaffolded project the adapter emits, including deploy config when requested

Dated eval scores still live under `evals/`. See [eval](eval.md).

## Adapters

The adapter interface is documented in code when adapters ship. The MVP adapter (the reference adapter) is plain HTML/CSS/TS plus Vite plus static. React, Tailwind, Rust options, other build tools, and deploy configs are post-MVP. See [decision 005](decisions/005-mvp-win-condition.md).

## What this system does not do

- It does not deploy, and it does not perform account auth.
- It does not generate a full page in one shot. Full-page input goes through `segment`, the section loop, and assemble.
- It does not take a multi-page site or Figma input in v0.1.
- It does not include a graphical product UI in v0.1, and it does not include an interactive GUI editor for annotations.
- It does not run arbitrary host commands through the CLI. The optional MCP server, if present, only searches and executes against the typed library surface, in a sandbox.
- It does not embed the source image in the output, including as a background.
- It does not redistribute third-party logos.
