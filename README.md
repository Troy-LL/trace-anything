# Trace Anything

You have a picture of a page, and you want real components that match it, not a screenshot pasted into a div.

This repo is the spec for a tool that does that. You give it a section or a whole page. It isolates the page into sections, writes HTML, CSS and TS, renders the result, scores it against the picture, and sends the misses back until the score clears a threshold or a round limit. Nothing is implemented yet.

## A planned run

The walk-through below is the planned flow, not a captured result, and it invents no scores. The example input is a tall, single-column screenshot of the ASES Manila landing page. The image itself is not in this repo. The expected section list is in [design](docs/design.md#worked-example).

```text
input:  ases-manila-landing.png

trace segment
  in:   the full-page PNG
  out:  annotations.json      section id, bbox, label, confidence, order
        overlay.png           boxes and labels, for review
        sections/sec-01.png   nav/header
        sections/sec-02.png   hero, "Build before it becomes obvious"
        ...                   (the rest of the page, in order)
        sections/sec-12.png   footer

  optional: edit annotations.json after looking at overlay.png

trace loop
  in:   sections/sec-02.png, plus plain HTML/CSS/TS with Vite
  out:  out/sec-02/           the built component
        checks/sec-02.json    combined score vs that crop, written after the run
  then: generate, render, score, and fix until the threshold or N
  repeat for every section

trace assemble
  out:  out/page/             the stitched page
        checks/page.json      page-level score vs the original, written after the run
```

The same commands take JSON in and write JSON out. Details of the loop, the annotation schema, and the files a run writes are in [design](docs/design.md) and [architecture](docs/architecture.md#project-files).

## What makes it different

- The build is rendered and scored, and misses go back into generate. A single un-checked pass is not the product.
- A page is cut into sections. Each section is built and scored, then the page is assembled. We do not generate a whole page in one shot.
- The output is components you can keep, snapped to design tokens, in a real stack. We will publish a comparison on the public Design2Code benchmark against screenshot-to-code and v0. Nothing is built yet, so there is no win to claim.

## Quick reference

These operations are specified, not implemented. They work from a terminal, or from any MCP client such as Cursor, VS Code, Claude Code or Zed. The MCP server speaks stdio, and optionally HTTP. It never runs arbitrary commands. No IDE-specific code belongs in the core.

| Job | CLI | MCP tool |
| --- | --- | --- |
| Isolate a full page into annotated sections | `trace segment` | `segment` |
| Extract the spec and intermediate tree | `trace extract` | `extract` |
| Emit a component through an adapter | `trace generate` | `generate` |
| Render at the image's exact width | `trace render` | `render` |
| Score the render and mark mismatches | `trace score` | `score` |
| Run extract through fix until the threshold or N | `trace loop` | `loop` |
| Stitch sections and score the full page | `trace assemble` | `assemble` |

## Stacks

The MVP stack is plain HTML/CSS/TS, Vite, and a static build. React, Tailwind, Rust, and deploy configs are post-MVP. You will pick framework, build tool, styling (and optionally your own tokens), and a deploy target. The tool does not deploy. See [architecture](docs/architecture.md) and [decision 001](docs/decisions/001-intermediate-format-and-adapters.md).

## MVP win condition

All four must hold. The full decision is in [decision 005](docs/decisions/005-mvp-win-condition.md).

1. On the same fixed Design2Code slice, with the same model, the single-section loop beats screenshot-to-code on the combined metric. Results and scripts are committed so anyone can rerun them.
2. The ASES full-page example runs end to end: segment, review overlay, build every section in plain HTML/CSS/TS with Vite, assemble, and record the page-level score.
3. The same run works from both the CLI and an MCP client, with JSON in and out.
4. No image-as-background tricks, and each run stays under a set spend cap and round limit. Those values are TBD and will be set in [issue #1](https://github.com/Troy-LL/trace-anything/issues/1).

## Status

Spec stage. Nothing is implemented. The work that has to satisfy the [MVP win condition](#mvp-win-condition) is [#1](https://github.com/Troy-LL/trace-anything/issues/1) (baseline), [#2](https://github.com/Troy-LL/trace-anything/issues/2) (section loop), [#4](https://github.com/Troy-LL/trace-anything/issues/4) (CLI and MCP), and [#6](https://github.com/Troy-LL/trace-anything/issues/6) (full-page segment and assemble). [#3](https://github.com/Troy-LL/trace-anything/issues/3) is extra stacks, post-MVP. [#5](https://github.com/Troy-LL/trace-anything/pull/5) was the docs pull request, now on main.

Docs: [architecture](docs/architecture.md), [design](docs/design.md), [eval](docs/eval.md), [001](docs/decisions/001-intermediate-format-and-adapters.md), [002](docs/decisions/002-harness-neutral-interface.md), [003](docs/decisions/003-section-first.md), [004](docs/decisions/004-full-page-segment-and-assemble.md), [005](docs/decisions/005-mvp-win-condition.md).

Contributing: issues are the specs. See [CONTRIBUTING.md](CONTRIBUTING.md). Run `bash scripts/verify-docs.sh` before you ask for review.

License: Apache License 2.0. Copyright 2026 Troy-LL. See [LICENSE](LICENSE).
