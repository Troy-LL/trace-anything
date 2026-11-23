# Full-page input through segment and assemble

Status: Accepted

## Context

Users can give a whole-page picture, not only a pre-cropped section. It would look right to send that page through generate in one shot. Decision 003 still holds: the generation unit is one section. The missing stage is isolation and annotation, plus a page-level score after the sections come back together.

## Decision

We will add a first stage, `segment`, for full-page input. A full-page image goes in. The stage detects section boundaries (horizontal bands first, then nested blocks), crops each section, assigns a semantic label (nav/header, hero, features, testimonials, pricing, CTA, footer, other) with a confidence, and writes an annotations file (JSON: `schemaVersion`, `source`, section id, bbox in source-image pixels, label, confidence, order) plus an annotated overlay PNG with boxes and labels. The field list is in [architecture](../architecture.md). The user or agent can review or edit the annotations before generation. That human checkpoint is optional via a flag. Each section then runs the existing loop. A final step assembles the sections into a page and scores the whole page against the original too.

The CLI command is `trace segment`. Agents drive it through the skills pack. Assembly is `trace assemble`. Segmentation feeds decision 003; it does not replace it.

## Consequences

A generator that treats a full-page screenshot as one section, or that skips annotation review when the review flag is set, is a bug. Multi-page sites, Figma input, and an interactive GUI editor for annotations stay out of scope. Review is JSON edit plus the overlay only.

## Worked example

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
  "schemaVersion": 1,
  "source": {"hash": "source-image-hash", "width": 1440, "height": 7520},
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
