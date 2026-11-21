# Section first

Status: Accepted

## Context

Whole-page generation in one shot is the usual approach, and it would look right to start there. Prior work matches more closely when a page is split into sections, generated, and stitched later.

## Decision

We will run the extract, generate, render, score, and fix loop on one section image at a time. Full pages, multi-page sites, and Figma input stay out of scope until that loop beats the baseline on the section-cropped eval set.

## Consequences

Eval for v0.1 uses the Design2Code slice cropped to sections, not full pages. A whole-page generator that skips the section loop does not satisfy v0.1, even if it looks impressive on a demo page.
