---
name: trace-segment
description: Segment a full-page image into labeled bands before any HTML is written. Use when the input is a whole page rather than one section.
---

# Segment

Run `trace loop --image <file>`. Read `runs/<runId>/annotations.json` before you touch a project.

Labels are only `nav/header`, `hero`, `features`, `testimonials`, `pricing`, `CTA`, `footer`, or `other`. The first band is `nav/header` when it is at most a fifth of the page. The last band is `footer` on that same rule. A tall second band is `hero`. Everything else is `other`.

Bboxes tile the page: they start at x 0, share the source width, and the next band starts where the previous one ends. If a gap or an overlap shows up, fix the annotations before generation.
