# Trace Anything

**Turn a picture of a web page into components you can actually keep.**

Give it a screenshot, it writes HTML/CSS/TS, renders it, checks the result against your picture and keeps fixing until they match.

> [!NOTE]
> The local loop runs. `trace loop` segments a page, reads text with macOS Vision when it is available, writes HTML, renders it, and scores it. `generate`, `render`, and `score` are separate commands. The four MVP checks are still open, and the paid Design2Code baseline has not been run. See [Where it's at](#where-its-at).

![Loop running](https://img.shields.io/badge/status-loop%20running-0f766e?style=flat-square)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-3f3f46?style=flat-square)](LICENSE)
![Skills and CLI](https://img.shields.io/badge/interface-Skills%20%2B%20CLI-0f766e?style=flat-square)
![TypeScript](https://img.shields.io/badge/language-TypeScript-3178c6?style=flat-square)
[![Docs](https://img.shields.io/github/actions/workflow/status/Troy-LL/trace-anything/docs.yml?branch=main&style=flat-square&label=docs)](https://github.com/Troy-LL/trace-anything/actions/workflows/docs.yml)

<p>
  <img src="docs/assets/concept.svg" alt="A page picture on the left, a rendered component on the right, and a score with a fix loop between them" width="1280">
</p>

Concept, not real output.

You give us a screenshot. We write the code, open the result at the same width as your picture, compare the two, and send the misses back into the next pass. That loop runs until the match is close enough, or we hit a round limit.

## Why not just paste the screenshot?

A screenshot in a div is a picture. You cannot edit the text, reuse a section, or keep a layout that belongs in your codebase.

We write real markup instead, then check that markup against your picture so the result stays honest.

## What you give it, what you get

| You give it | It does | You get |
| --- | --- | --- |
| A section image | Write the component, render it, score it, and fix the misses | A component, plus a score against that crop |
| A full-page image | Split the page into sections, wait for your review if you want it, then build each section and put the page back together | Annotations, an overlay, section crops, an assembled page, and a page-level score |
| A stack choice | Emit the project in that stack | A project that builds. For now that means plain HTML/CSS/TS, Vite, and a static build |
| A call from your agent | Install the skills pack, or run the CLI | The agent drives `trace`. JSON in and out. No editor-specific code in the core |

## See a run

This is the planned flow, not a captured result, and it invents no scores. The example input is a tall, single-column screenshot of the ASES Manila landing page. The image itself is not in this repo. The expected sections are listed in [design](docs/design.md#worked-example).

Split a full-page screenshot into labeled sections:

```text
trace segment
  in:   ases-manila-landing.png
  out:  runs/<runId>/annotations.json
        runs/<runId>/overlay.png
        runs/<runId>/sections/sec-01/source.png   nav/header
        runs/<runId>/sections/sec-02/source.png   hero
        runs/<runId>/sections/sec-12/source.png   footer
```

Review the overlay, and edit `annotations.json` if a cut is wrong:

```text
# optional
edit annotations.json after looking at overlay.png
```

Build and score one section, then repeat for the rest of the page:

```text
trace loop
  in:   runs/<runId>/sections/sec-02/source.png, plus plain HTML/CSS/TS with Vite
  out:  runs/<runId>/sections/sec-02/pass-<n>/project/
        runs/<runId>/sections/sec-02/pass-<n>/score.json
  then: generate, render, and score until that crop's baseline combined, or 3 passes
```

Put the scored sections back together and score the whole page:

```text
trace assemble
  out:  runs/<runId>/out/          the stitched page
        runs/<runId>/.../score.json   page-level score vs the original
```

The same commands take JSON in and write JSON out. File layout is in [architecture](docs/architecture.md#project-files).

## How it checks its own work

We score the render against your picture with the signals below. Layout, text, and color are also scored on their own. Using your screenshot as a background image, or embedding it in the output in any other way, does not count.

We will also publish a comparison on the public Design2Code benchmark against screenshot-to-code and v0, using Design2Code's official metrics. We will put numbers here only after that run is committed. See [eval](docs/eval.md).

| Signal | What it catches |
| --- | --- |
| Perceptual | Overall visual closeness of the render to the picture |
| Layout / blocks | Missing, extra, or misplaced regions |
| OCR text | Copy that does not match the picture |
| Color | Fill and type color that does not match |

## Use it from your agent

The skills pack is in `skills/`. It teaches an agent to drive the `trace` CLI. Install from a registry is still planned. Until then, copy the folders or run the CLI directly.

```sh
npx skills add https://github.com/Troy-LL/trace-anything
```

You can also copy the skill folders into `~/.cursor/skills`, `~/.claude/skills`, or `~/.codex/skills`.

Ask your agent:

```text
Here's a screenshot of my landing page. Segment it, let me review the overlay, then build each section in plain HTML, CSS and TypeScript with Vite and assemble the page. Tell me how close each section is to the picture.
```

Or from the terminal:

```text
npm run trace -- loop --image page.png
npm run trace -- generate --intermediate runs/<runId>/sections/sec-01/pass-1/intermediate.json --out project
npm run trace -- render --project project --width 1280 --out shot.png
npm run trace -- score --source section.png --screenshot shot.png
```

A tiny two-tool MCP server is an optional extra, not required for the first version. See [decision 006](docs/decisions/006-skills-first-interface.md).

## How it's different from screenshot-to-code

- We render what we wrote, score it against your picture, and keep fixing until a threshold or a round limit. A single un-checked pass is not the product.
- We build one section at a time, then assemble the page. We do not generate a whole page in one shot.
- You get components you can keep, snapped to design tokens, not a one-off dump of guessed pixels.
- You can aim at more than one stack later. The first stack is plain HTML/CSS/TS with Vite.
- You can run it from a terminal, or from an agent that has the skills pack. Editor plugins come later.

## What counts as done

The first version is done only when all four of these hold. The full list is in [decision 005](docs/decisions/005-mvp-win-condition.md).

- [ ] On the same fixed Design2Code slice, with the same model, the single-section loop beats screenshot-to-code on the combined metric. Results and scripts are committed so anyone can rerun them.
- [ ] The ASES full-page example runs end to end: segment, review overlay, build every section in plain HTML/CSS/TS with Vite, assemble, and record the page-level score.
- [ ] The same run works from the CLI and from an agent via the skills pack, with JSON in and out.
- [ ] Text stays HTML. A non-text mark is its own crop. A CSS background, a data URI, or an image that covers the page does not count. A product eval run of the fixed slice stays under $10, and each section stops after 3 passes. See [decision 005](docs/decisions/005-mvp-win-condition.md).

<details>
<summary>Under the hood</summary>

An editor-neutral library owns the pipeline. The CLI is the engine. A skills pack teaches any agent to drive that CLI. Adapters turn one shared description into a concrete project. The scoring loop stays the same when the stack changes. See [architecture](docs/architecture.md).

```mermaid
flowchart TD
  A[Image] --> B{Full page?}
  B -->|yes| C[segment]
  C --> D[annotations.json and overlay.png]
  D --> E[Optional review]
  E --> F[Per section]
  B -->|no| F
  F --> G[extract one intermediate description]
  G --> I[adapter]
  I --> J[render]
  J --> K[score]
  K --> L{Threshold or N?}
  L -->|no, fix| I
  L -->|yes| M[assemble if a page]
  M --> N[page-level score]
```

A harness talks to the same core:

```mermaid
flowchart LR
  A[IDE or agent] --> B[Skills pack]
  B --> C[CLI]
  D[Terminal] --> C
  C --> E[Core library]
  E --> F[Adapters]
```

| Path | What's in it |
| --- | --- |
| `runs/<runId>/annotations.json` | Snapshot: schemaVersion, source, section id, bbox, label, confidence, order |
| `runs/<runId>/overlay.png` | The page image with boxes and labels |
| `runs/<runId>/sections/<id>/source.png` | Cropped section image |
| `runs/<runId>/sections/<id>/pass-<n>/` | That pass's intermediate description, project, screenshot, and score record |
| `runs/<runId>/out/` | The assembled page |

</details>

<details>
<summary>Stacks</summary>

You choose the framework, the build tool, the styling (and optionally your own tokens), and the deploy target. The tool does not deploy, and it does not handle account auth. See [architecture](docs/architecture.md) and [decision 001](docs/decisions/001-intermediate-format-and-adapters.md).

| Layer | First choice | Later |
| --- | --- | --- |
| Framework | Plain HTML/CSS/TS | React, Vue, Svelte, Leptos, Yew |
| Build tool | Vite | Next.js, Astro, Trunk |
| Styling | Plain CSS | CSS modules, Tailwind, or your own component library or tokens |
| Deploy target | Static | Vercel (`vercel.json`) or Cloudflare Pages/Workers (`wrangler.toml`), config only |

React, Tailwind, Rust, deploy configs, and editor plugins come after the first version.

</details>

<details>
<summary>Commands</summary>

`loop`, `generate`, `render`, and `score` run. `segment`, `extract`, and `assemble` happen inside `trace loop` and are not separate commands yet.

| CLI command | What it does | Status |
| --- | --- | --- |
| `trace segment` | Isolate a full-page image into annotated sections | Inside `trace loop` |
| `trace extract` | Write one intermediate description for that pass | Inside `trace loop` |
| `trace generate` | Emit a component through an adapter | Runs |
| `trace render` | Render the component at the image's exact width | Runs |
| `trace score` | Score the render and mark mismatches | Runs |
| `trace loop` | Segment, extract, generate, render, score, and assemble | Runs. Stops after one pass when the crop has no baseline |
| `trace assemble` | Stitch sections and score the full page | Inside `trace loop` |

</details>

## Where it's at

The library runs locally. `npm test` is the check. Issue #1's paid baseline is still the measurement that has not been run.

A color-band pass on the ASES landing page, run `ec18ea2bf460`, scored combined 0.665 (perceptual 0.821, layout 0.872, text 0.117, color 0.848). macOS Vision on Design2Code `d2c-171` (inteliCharts), run `21128d8f21d7`, scored combined 0.964 (text 0.896). The words are real HTML, and some of them are still misread. screenshot-to-code and v0 were not run. Numbers are in [eval](docs/eval.md).

| Issue | What | Depends on |
| --- | --- | --- |
| [#1](https://github.com/Troy-LL/trace-anything/issues/1) | Baseline: screenshot-to-code on a Design2Code slice | None. First, and measurement only. |
| [#2](https://github.com/Troy-LL/trace-anything/issues/2) | v0.1: single-section image to component loop | #1 |
| [#3](https://github.com/Troy-LL/trace-anything/issues/3) | Extra stacks, after the first version | MVP (#1, #2, #4, #6) |
| [#4](https://github.com/Troy-LL/trace-anything/issues/4) | Skills pack and CLI | #2 |
| [#5](https://github.com/Troy-LL/trace-anything/pull/5) | Product spec and docs, now on main | None. Docs pull request. |
| [#6](https://github.com/Troy-LL/trace-anything/issues/6) | Full-page input: segment, annotate, assemble | #2 |

Docs: [architecture](docs/architecture.md), [design](docs/design.md), [eval](docs/eval.md), [001](docs/decisions/001-intermediate-format-and-adapters.md), [002](docs/decisions/002-harness-neutral-interface.md), [003](docs/decisions/003-section-first.md), [004](docs/decisions/004-full-page-segment-and-assemble.md), [005](docs/decisions/005-mvp-win-condition.md), [006](docs/decisions/006-skills-first-interface.md).

## Want to help?

The first loop runs. These are the open gaps:

- An adapter for another stack, tracked in [issue #3](https://github.com/Troy-LL/trace-anything/issues/3).
- The baseline measurement itself, on [issue #1](https://github.com/Troy-LL/trace-anything/issues/1). The score formula is already set.
- Test images for the hand-labeled full-page set, on [issue #6](https://github.com/Troy-LL/trace-anything/issues/6). Please do not send logos or pictures you cannot share.

See [CONTRIBUTING.md](CONTRIBUTING.md). Run `bash scripts/verify-docs.sh` before you ask for review.

## License

Apache License 2.0. Copyright 2026 Troy-LL. See [LICENSE](LICENSE).
