# Eval

The claim to beat is public: Trace Anything should beat screenshot-to-code and v0 on the official Design2Code metrics (visual/CLIP, block match, text, position, and color), and the comparison should be published.

There is no eval runner yet. This file is the protocol the runner must follow. Gold stays rigid. Prompt text, when it exists, lives in `prompts/` as code. Dated scores live in `evals/`.

## Baseline

A fixed slice of about 50 pages from the official Design2Code benchmark. How the slice was chosen, including any seed, is recorded and committed. Open-source screenshot-to-code (https://github.com/abi/screenshot-to-code) is run on that exact slice with one stated model. Every output is scored with Design2Code's official metrics. The results table (per-page scores plus slice averages) and the scripts are committed so a second run with the same seed and slice reproduces the same table.

API spend for the baseline is capped at about $10. If the cap is reached, commit whatever completed pages are already scored and mark the run as partial.

This baseline does not include building Trace Anything.

## v0.1 probe

The same slice, cropped to sections, is the eval set for the single-section loop. The combined score is perceptual similarity, block/layout match, OCR text match, and color. The threshold and the maximum number of rounds N are chosen and written down before the run. The loop must beat the baseline on that combined score. The eval set, the threshold, N, and the score history are committed.

## Adapter gap

Every adapter's output is built and rendered through the same Playwright scoring. Every adapter must stay within a small, documented score gap of the reference adapter (plain TS plus Vite plus static) on the eval set.

## Segmentation and page assembly

A small, hand-labeled set of full-page screenshots is the gold for `segment`. Segmentation quality is measured with box IoU and label accuracy against those labels. After each section has run the v0.1 loop, assemble is scored at page level against the original full-page image, using the same combined score as the section loop. The hand-labeled set, the IoU and label-accuracy table, and the page-level scores are committed.

## Gold command

When the runner exists, the gold command is `trace eval`. It writes dated score files under `evals/`. A rerun with the same seed and slice must reproduce the committed table. The sample floor is the fixed baseline slice (about 50 pages), that slice cropped to sections for v0.1, and the hand-labeled full-page set for segmentation and page-level scores.

Until `trace eval` exists, baseline scripts committed for the issue #1 run are the gold command, and they write to the same `evals/` directory.

## Scoring honesty

**Stance.** Image-as-background, and any embedding of the source image in the output, are banned. Layout, text, and color are scored separately, as well as the combined metric. A close-looking screenshot that cheats does not count. See [decision 005](decisions/005-mvp-win-condition.md).

**Open questions.** How is an embedded source image detected automatically? Are the official Design2Code metrics enough, or is a dedicated cheat check required?

## Cost and speed

**Stance.** Every scored product run stays under a spend cap and a round limit. Those values are TBD and will be set in issue #1. They are separate from the about $10 cap on the baseline measurement. Repeated extract and score work is cached. Reruns use a fixed seed so the same slice reproduces the same table.

**Open questions.** Is the spend cap per section, per page, or per eval slice? What is cached: specs, renders, or model calls?

## Proof

**Stance.** Proof is a public comparison on the Design2Code slice, a recorded end-to-end run of the ASES full-page example, and before/after examples we have the rights to publish. No score claims until results and scripts are committed.

**Open questions.** Where do demo videos and before/after images live without shipping third-party logos? How many published examples besides ASES?
