---
name: trace-fix-loop
description: Take one more generate pass after trace loop stops short. Use only when stopReason is cap.
---

# Fix loop

`trace loop` owns its own pass and writes `pass-1`. When the result says `stopReason` `cap`, you may take one more pass. Do not edit `pass-1`.

Copy `intermediate.json` to a new file, change the tree, and run `trace generate --intermediate <new file> --out <new project dir>`. Check the new HTML the same way the score skill does. One pass, one directory.
