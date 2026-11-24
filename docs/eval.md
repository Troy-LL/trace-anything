# Eval

The claim to beat is public: Trace Anything should beat screenshot-to-code and v0 on the official Design2Code metrics (visual/CLIP, block match, text, position, and color), and the comparison should be published.

There is no eval runner yet. This file is the protocol the runner must follow. Gold stays rigid. Prompt text, when it exists, lives in `prompts/` as code. Dated scores live in `evals/`.

## Baseline

A fixed slice of about 50 pages from the official Design2Code benchmark. How the slice was chosen, including any seed, is recorded and committed. Open-source screenshot-to-code (https://github.com/abi/screenshot-to-code) is run on that exact slice with one stated model. Every output is scored with Design2Code's official metrics. The results table (per-page scores plus slice averages) and the scripts are committed so a second run with the same seed and slice reproduces the same table.

API spend for the baseline is capped at about $10. If the cap is reached, commit whatever completed pages are already scored and mark the run as partial.

This baseline does not include building Trace Anything.

The committed slice is `eval/baseline/slice.json`: seed 1, 50 ids from Design2Code test indices 0 through 483, provider `cursor`, model `composer-2.5`, 3 passes, and a $10 cap. Page images are not in this repo.

Dry run, which does not open the network:

```sh
node --experimental-strip-types scripts/baseline.ts --dry-run
```

Live run refuses without `CURSOR_API_KEY` or without `--confirm-spend 10`. When both are present this phase still does not call the provider. The official score table stays pending until a paid run is committed. That commit is what lets issue #2 start.

```sh
node --experimental-strip-types scripts/baseline.ts --confirm-spend 10
```

| id | combined | status |
| --- | --- | --- |
| pending | pending | pending |

## Local probe

This is not the official baseline. screenshot-to-code and v0 were not run. The product scorer compared a trace to the source image. `combined` is the mean of perceptual similarity, row-luma layout, ink-pixel text overlap, and 16px-block color. Text allows a few pixels of shift. The source image was not embedded. Dated numbers are in `evals/2026-11-24-local-comparison.json`.

| id | method | combined | text |
| --- | --- | --- | --- |
| ASES `ec18ea2bf460` | color bands | 0.665 | 0.117 |
| d2c-438 reference HTML | original HTML, rendered | 0.738 | 0.131 |
| d2c-438 trace | color bands | 0.737 | 0 |
| d2c-171 reference HTML | original HTML, rendered | 0.938 | 0.773 |
| d2c-171 trace | color bands | 0.732 | 0.004 |
| d2c-171 `21128d8f21d7` | macOS Vision OCR | 0.964 | 0.896 |

The Vision pass writes the words as HTML. Some words are still misread, so the page is not a 1:1 trace. The reference HTML text score can stay low when glyphs do not land on the same pixels as the screenshot.

## v0.1 probe

The same slice, cropped to sections, is the eval set for the single-section loop. The product combined score is perceptual similarity, block/layout match, OCR text match, and color. Each component is a number from 0 to 1, and `combined` is their mean. Accessibility is a gate on the same score record and is outside that combined score. Issue #1 scores the baseline outputs with this same `combined`, not only with the official metrics. The threshold for a section is that crop's baseline `combined`. N is 3 generate/render/score passes. The slice wins when its average `combined` is higher than the baseline slice average. The official Design2Code metrics (visual/CLIP, block match, text, position, and color) are a second report on the same outputs. Position stays in that report and is not a component of the product combined score. The eval set, both reports, and the score history are committed.

## Adapter gap

Every adapter's output is built and rendered through the same Playwright scoring. Every adapter must stay within a small, documented score gap of the reference adapter (plain TS plus Vite plus static) on the eval set.

## Segmentation and page assembly

A small, hand-labeled set of full-page screenshots is the gold for `segment`. Segmentation quality is measured with box IoU and label accuracy against those labels. After each section has run the v0.1 loop, assemble is scored at page level against the original full-page image, using the same combined score as the section loop. The hand-labeled set, the IoU and label-accuracy table, and the page-level scores are committed.

## Gold command

When the runner exists, the gold command is `trace eval`. It writes dated score files under `evals/`. A rerun with the same seed and slice must reproduce the committed table. The sample floor is the fixed baseline slice (about 50 pages), that slice cropped to sections for v0.1, and the hand-labeled full-page set for segmentation and page-level scores.

Until `trace eval` exists, baseline scripts committed for the issue #1 run are the gold command, and they write to the same `evals/` directory.

## Scoring honesty

**Stance.** Image-as-background, and any embedding of the source image in the output, are banned. Perceptual similarity, layout, text, and color are stored separately, as well as the combined metric. A close-looking screenshot that cheats does not count. See [decision 005](decisions/005-mvp-win-condition.md).

**Open questions.** How is an embedded source image detected automatically? Are the official Design2Code metrics enough, or is a dedicated cheat check required?

## Cost and speed

**Stance.** A product eval run of the fixed slice stays under $10. The cap is per slice, and it is separate from the about $10 cap on the baseline measurement. If a run would pass $10, stop and commit the completed sections as a partial run. N is 3 generate/render/score passes per section. Repeated extract and score work is cached. The cache stores extract results and score records. Its key is the input bytes, the command, its params, the model name and version, the seed, and the tool version. See [architecture](architecture.md). Reruns use a fixed seed so the same slice reproduces the same table.

## Proof

**Stance.** Proof is a public comparison on the Design2Code slice, a recorded end-to-end run of the ASES full-page example, and before/after examples we have the rights to publish. No score claims until results and scripts are committed.

**Open questions.** Where do demo videos and before/after images live without shipping third-party logos? How many published examples besides ASES?
