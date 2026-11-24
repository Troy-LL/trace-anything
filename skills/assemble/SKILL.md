---
name: trace-assemble
description: Read the assembled page a person would scroll. Use after every section has a project.
---

# Assemble

Open `runs/<runId>/out/index.html`. That file is the page, in annotation order, at the source width.

Each band keeps its own background from its token color and its own ink so the type stays readable. The page does not include the source image. If the scroll order and the annotation order disagree, fix the order in the assembled file by regenerating from the trees, not by restyling one section in place.
