---
name: trace-score
description: Check a generated section against the source without treating a close screenshot as a pass. Use after generate.
---

# Score

Read `pass-1/score.json`. `combined` is the mean of `perceptual`, `layout`, `text`, and `color`, each from 0 to 1. Accessibility stays in `gates`, outside `combined`.

Open the project HTML. A page that contains the source image, including as `background-image`, fails the `source-not-embedded` gate. Do not raise `combined` to hide that.

Section heights, with `box-sizing: border-box`, sum to the source height. If they do not, the layout component is wrong.
