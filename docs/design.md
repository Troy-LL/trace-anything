# Design

v0.1 has no graphical product UI. The operator interface is the `trace` CLI. The agent interface is a skills pack that drives that CLI.

## Who it is for

A person or an agent in any IDE or harness who has a section image, or a whole-page picture, and wants a real component. The same operations must work from a terminal with no editor at all, and from an agent in Cursor, VS Code, Claude Code, Codex, or a similar harness after the skills pack is installed.

## CLI

The CLI name is `trace`. Every command takes JSON on stdin or as a file argument, and writes JSON to stdout. Errors go to stderr and a non-zero exit. The planned commands are:

| Command | Job |
| --- | --- |
| `trace segment` | Read a full-page image, isolate sections, and write the annotations JSON plus an annotated overlay PNG. |
| `trace extract` | Read a section image and write the spec (OCR text, colors, spacing, fonts, layout boxes, snapped to design tokens) and the intermediate tree. |
| `trace generate` | Read the intermediate description and the chosen stack, and write a scaffolded project that builds. |
| `trace render` | Build the project, open it in Playwright at the source image's exact width, and write the screenshot. |
| `trace score` | Compare the screenshot to the source image and write the combined score plus mismatched regions. |
| `trace loop` | Run extract, generate, render, score, and fix until the score clears the documented threshold or N rounds. |
| `trace assemble` | Stitch scored sections into a page and score that page against the original full-page image. |

`trace loop` is how issue #2 is run end to end on one section. Stack choices (framework, build tool, styling, optional library or tokens, deploy target) are inputs to `generate` and `loop`, not separate product screens.

### Segment and review

`trace segment` detects section boundaries (horizontal bands first, then nested blocks), crops each section, and assigns a semantic label (nav/header, hero, features, testimonials, pricing, CTA, footer, other) with a confidence. The annotations file records section id, bbox, label, confidence, and order. The overlay PNG draws those boxes and labels on the page image.

A human checkpoint lets a person or agent review or edit the annotations before generation. The checkpoint is optional via a flag. When the flag is set, `segment` writes the JSON and overlay and waits for an edited annotations file before any section loop starts. When the flag is unset, the cropped sections go straight into the loop. There is no interactive GUI editor; review is JSON edit plus the overlay.

### Worked example

Example input: a tall, single-column screenshot of the ASES Manila landing page. The image itself is not in this repo. Expected sections, in order:

1. nav/header
2. hero, "Build before it becomes obvious"
3. About, "We are learners" (label: other)
4. Programs carousel (label: features)
5. "100+ active student builders" stats with logos (label: other)
6. Partners logo strip (label: other)
7. "Come build with us" with a photo and 4 cards (label: CTA)
8. "More rooms we run" with 2 cards (label: features)
9. Special thanks logos (label: other)
10. FAQ accordion, "Got Questions?" (label: other)
11. "Show your work" contact form (label: CTA)
12. footer

Short sample of the annotations file. The bboxes are illustrative of the schema, not measured pixels from the screenshot:

```json
{
  "sections": [
    {
      "id": "sec-01",
      "bbox": {"x": 0, "y": 0, "width": 1440, "height": 88},
      "label": "nav/header",
      "confidence": 0.96,
      "order": 1
    },
    {
      "id": "sec-02",
      "bbox": {"x": 0, "y": 88, "width": 1440, "height": 820},
      "label": "hero",
      "confidence": 0.94,
      "order": 2
    },
    {
      "id": "sec-12",
      "bbox": {"x": 0, "y": 7200, "width": 1440, "height": 320},
      "label": "footer",
      "confidence": 0.93,
      "order": 12
    }
  ]
}
```

## Skills pack

The primary agent interface is a skills pack in this repo: SKILL.md folders that follow the Agent Skills standard. The skills teach an agent to drive the CLI for segment, a section loop, score, the fix loop, and assemble.

Install is planned as:

```sh
npx skills add https://github.com/Troy-LL/trace-anything
```

The same folders can be copied into `~/.cursor/skills`, `~/.claude/skills`, or `~/.codex/skills`.

No IDE-specific code belongs in the core. Editor integrations are thin wrappers around the CLI or the skills pack and are out of scope for v0.1, and are post-MVP.

## Optional MCP server

A tiny MCP server is an optional extra. It is not required for the MVP, and it is not required for any other issue. If it exists, it exposes two tools in the Code Mode pattern: `search` over the typed CLI and library surface, and `execute`, which runs a short script against that surface in a sandbox. The point is to keep context cost around a thousand tokens, instead of one tool per operation. It is not a catalog of segment, extract, generate, render, score, loop, and assemble tools. See [decision 006](decisions/006-skills-first-interface.md).

## Loop behavior

The threshold and N are chosen and written down before an eval run. Each failed pass returns the mismatched regions to generate. If the cap of N is hit, the last output, the score history, and the remaining mismatches are returned. The tool does not deploy. Deploy config files such as `vercel.json` and `wrangler.toml` are post-MVP.

## Input quality

**Stance.** Accept a section image or a full-page screenshot. Warn or refuse when the picture is too blurry to read text, or so tightly cropped that a section is incomplete. Very tall pages are tiled, then stitched. Dark-mode screenshots are valid input; the tool does not invent a light-mode twin. Size limits will be documented once they are set.

**Open questions.** What is the minimum resolution, and what is the maximum file size? How many tiles, and how is overlap handled? Do we accept a mobile crop of a desktop page?

## What a picture can't show

**Stance.** Hover and open states, animation, responsive behavior, and real link targets are not in a still image. Guess conservative defaults (no hover style unless it is visible, a closed accordion stays closed, a single width, placeholder hrefs) and flag every guess in the intermediate description so a person can edit them.

**Open questions.** Which guesses are flagged vs left as silent defaults? MVP renders at the image's exact width only; when, if ever, is a second width generated?

## Fonts and assets

**Stance.** Match type to the closest free font and record the substitution. Photographs, logos, and icons are cropped from the source or replaced with placeholders. Third-party logos are not redistributed in this repo or in published demos.

**Open questions.** Which free-font catalog is the default? When is a crop acceptable vs a placeholder? How is the ASES example demonstrated without publishing partner logos?

## Output quality beyond looks

**Stance.** Markup should be accessible: real headings, alt text, a documented contrast bar, clean component boundaries, and design tokens rather than one-off pixel values.

**Open questions.** Which contrast bar is the gate? Are accessibility checks part of the combined score, or a separate gate so the visual score stays honest?

## Safety and legal

**Stance.** The tool is for your own designs, or for inspiration. Cloning someone else's brand for release is not acceptable use. That stance will be stated in the docs for strangers. The CLI never runs arbitrary host commands. The optional two-tool MCP server, if present, only searches and executes against the typed library surface, in a sandbox.

**Open questions.** Does the acceptable-use statement live only in the README, or also as a short legal page? Do we refuse obvious brand-clone prompts, or only document the stance?

## Distribution

**Stance.** A stranger should be able to install the MVP as an npm package or a single binary, plus the skills pack, with a small config and docs that explain the CLI and how to add the skills.

**Open questions.** Which shipping form comes first, npm or a single binary? What is the minimum config file?
