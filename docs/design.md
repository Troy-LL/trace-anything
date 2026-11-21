# Design

v0.1 has no graphical product UI. The operator and agent interface is the CLI and the MCP server.

## Who it is for

A person or an agent in any IDE or harness who has a section image, or a whole-page picture, and wants a real component. The same operations must work from Cursor, VS Code, Claude Code, Codex, Zed, or any MCP-capable harness, and from a terminal with no editor at all.

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

## MCP server

The MCP server exposes the same operations as tools: segment, extract the spec, generate, render, score, the full loop, and assemble. Transport is stdio by default. HTTP is optional.

No IDE-specific code belongs in the core. Editor integrations are thin wrappers around these tools and are out of scope for v0.1.

## Loop behavior

The threshold and N are chosen and written down before an eval run. Each failed pass returns the mismatched regions to generate. If the cap of N is hit, the last output, the score history, and the remaining mismatches are returned. The tool does not deploy, even when it has written `vercel.json`, `wrangler.toml`, or a static setup.
