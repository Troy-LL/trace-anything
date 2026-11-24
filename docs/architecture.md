# Architecture

Trace Anything turns a section image, or a full-page image isolated into sections, into scored components. The library in `src/` runs that path. `trace loop` segments, extracts, generates, renders, scores, and assembles. `trace generate`, `trace render`, and `trace score` are separate commands. `trace segment`, `trace extract`, and `trace assemble` are not separate commands yet. This file is the topology.

## Processes

- **Library.** Editor-neutral core. It owns segment, extract, generate, render, score, assemble, and the full loop. No IDE-specific code lives here.
- **CLI.** The `trace` binary calls the library. JSON in, JSON out. This is the engine the skills pack, and any later wrapper, must call.
- **Skills pack.** SKILL.md folders in this repo, following the Agent Skills standard. They teach any agent to drive the CLI for segment, a section loop, score, the fix loop, and assemble. The section-loop skill calls `trace loop`. The fix-loop skill calls `generate` with chosen mismatches only after `trace loop` has stopped short of the threshold. Install is planned as `npx skills add https://github.com/Troy-LL/trace-anything`, or by copying the folders into `~/.cursor/skills`, `~/.claude/skills`, or `~/.codex/skills`.
- **Optional MCP server.** A tiny two-tool server in the Code Mode pattern: `search` over the typed CLI and library surface, and `execute`, which runs a short script against that surface in a sandbox. Not required for the MVP. See [decision 006](decisions/006-skills-first-interface.md).
- **Renderer.** Playwright opens the adapter's built output at the source image's exact width and captures a screenshot.
- **Adapters.** Each adapter turns the same intermediate component description into a concrete project (framework, build tool, styling, deploy config).
- **Eval runner.** Scores a fixed slice and writes dated results under `evals/`. See [eval](eval.md).

Editor integrations, if they exist later, are thin wrappers around the CLI or the skills pack. They are not part of the core.

## Records

These records are the contract every command shares. A later phase reads one of these; it does not invent a parallel shape.

### Annotations

Top-level `schemaVersion` (integer), `source` (`hash`, `width`, `height`), and `sections[]`. Each section has `id`, `bbox` (`x`, `y`, `width`, `height` in source-image pixels), `label`, `confidence`, and `order`. Labels are `nav/header`, `hero`, `features`, `testimonials`, `pricing`, `CTA`, `footer`, and `other`.

### Intermediate description

One document per section, written as `intermediate.json`. It is decision 001's spec plus the tree. Fields: `schemaVersion`, `sectionId`, `source` (`imageHash`, `bbox`, `width`), `tokens` (`colors`, `spacing`, `fonts`, `radii`), `fontSubstitutions[]` (`requested`, `used`), and `root`.

`root` is a node. A node has a stable `id` (the same id across passes of that section), `kind`, `box`, optional `text`, `style` (token references only), `children[]`, and `guesses[]` (`field`, `reason`, `confidence`). `kind` is `box`, `text`, `image`, `link`, or `control`. The phrase "intermediate tree" means `root` only.

### Score record

One record is a section score, a page score, and one entry of score history. Fields: `subject` (`kind` of `section` or `page`, plus `id`), `pass`, `components` (`perceptual`, `layout`, `text`, `color`), `combined`, `gates[]` (`name`, `passed`, `detail`), `mismatches[]`, `model` (`name`, `version`), `seed`, `scorerVersion`, and `inputs` (`intermediateHash`, `screenshotHash`).

Each component is a number from 0 to 1. `combined` is their mean, equal weights of 0.25. Accessibility, including contrast, is a gate in `gates[]` and is outside `combined`. Official Design2Code metrics, including position, are a second eval report. See [eval](eval.md).

A mismatch has required `bbox` (source-section pixels), optional `nodeId` (a node `id` from the intermediate description for that pass), `component` (one of the four component names), `severity` (`low` or `high`), and `detail`.

### CLI result

Success on stdout is `ok` true, `command`, `schemaVersion`, `runId`, `data`, and `warnings[]` (`code`, `message`). Failure on stderr is `ok` false, `command`, and `error` (`code`, `message`, `retryable`, optional `details`), with a non-zero exit. A usable but degraded input is a warning. A refusal is an `error.code`.

`data` is the record the command writes, plus paths into the run directory. It does not inline a project tree or a screenshot.

- `segment`: the annotations snapshot, plus the overlay path
- `extract`: the intermediate description, plus its path
- `generate`: the project path
- `render`: the screenshot path
- `score`: the score record
- `loop`: `lastOutput`, `history` (score records), `remainingMismatches`, and `stopReason` (`threshold` or `cap`)
- `assemble`: the page score record, plus the `out/` path

`trace loop` runs extract once, then generate, render, and score until it stops. The fix loop does not run inside this command.

### Run manifest

`runs/<runId>/manifest.json` holds `runId`, `input` (`path`, `hash`, `width`, `height`), `seed`, `toolVersion`, and `sections[]` (`id`, `status`, `passes`).

## Data flow

If the input is a full-page image, `segment` runs first. Very tall pages are tiled, then stitched, so segmentation and scoring stay within a documented size limit once that limit is set.

1. Detect section boundaries, horizontal bands first, then nested blocks.
2. Crop each section and assign a semantic label (nav/header, hero, features, testimonials, pricing, CTA, footer, other) with a confidence.
3. Write an annotations file and an annotated overlay PNG with boxes and labels. Bboxes are source-image pixels.
4. If the optional review flag is set, stop so a person or agent can edit the annotations. When review ends, or when the flag is unset, snapshot that file into the run directory and continue from the snapshot.

Each cropped section then follows the loop below. After every section has been scored, a final assemble step stitches the sections into a page and scores that page against the original full-page image too.

### Section loop

1. Input is one section image, plus the chosen stack (framework, build tool, styling, optional component library or tokens, deploy target).
2. Extract text via OCR, colors, spacing, fonts, and layout boxes, snapped to design tokens, and write one intermediate description for this pass.
3. The selected adapter reads that description and emits HTML, CSS, and TS (or the target's equivalent) and a scaffolded project that builds, including deploy config when the target is Vercel (`vercel.json`), Cloudflare Pages or Workers (`wrangler.toml`), or static.
4. Playwright renders the build at the image's exact width.
5. Score the screenshot against the source image and write one score record. The product combined score uses perceptual similarity, block/layout match, OCR text match, and color. Official Design2Code metrics stay on the eval report.
6. The score record's mismatches feed the next generate.
7. `trace loop` repeats from generate until `combined` clears that crop's baseline `combined`, or 3 passes. Each repeat is a new pass with its own files. The slice wins when its average `combined` is higher than the baseline slice average.

The scoring loop does not change per stack. Only the adapter's emitted code changes. Output must not embed the source image, including as a CSS background. Repeated extract and score work is cached. The cache key is the input bytes, the command, its params, the model name and version, the seed, and the tool version. A cache write is a temp file renamed into place. Reruns are seeded.

## Models

**Stance.** Each step may use a different vision or generation model. Users can bring their own key or model. There is no single-vendor lock-in. The model name and version used at each step are recorded in the score history so a run can be repeated.

The local extract uses macOS Vision OCR (`scripts/vision-ocr.swift`) when it runs, and records `local-vision-ocr`. When Vision does not run, position labels are not painted as page text, and the record is `local-color-bands`. Region cuts are still horizontal color bands. No paid model is called.

**Open questions.** How is a user-supplied endpoint configured?

## Project files

A run writes this layout under `runs/<runId>/`.

- `manifest.json`: run id, input hash and size, seed, tool version, and per-section status
- `annotations.json`: the annotations snapshot taken when review ends, or when review is skipped
- `overlay.png`: the page image with boxes and labels
- `sections/<id>/source.png`: the cropped section
- `sections/<id>/pass-<n>/intermediate.json`: that pass's intermediate description
- `sections/<id>/pass-<n>/project/`: the adapter project for that pass
- `sections/<id>/pass-<n>/screenshot.png`: the Playwright capture
- `sections/<id>/pass-<n>/score.json`: that pass's score record
- `out/`: the assembled page, written only by assemble

Score history is the ordered list of per-pass `score.json` files. Dated eval scores still live under `evals/`. See [eval](eval.md).

## Concurrency

One writer owns each artifact for a pass.

- Annotations are snapshotted into the run when review ends. Later passes read that snapshot.
- A pass writes a new `intermediate.json`. It does not edit an earlier pass.
- A pass has its own `project/`. Assemble is the only writer of `out/`.
- A score-cache entry is content-addressed and published by rename.
- A pass has its own `score.json`. History is the list of those files.

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
