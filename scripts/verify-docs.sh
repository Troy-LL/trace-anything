#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"

status=0

required=(
  README.md
  AGENTS.md
  docs/architecture.md
  docs/design.md
  docs/eval.md
  docs/decisions/001-intermediate-format-and-adapters.md
  docs/decisions/002-harness-neutral-interface.md
  docs/decisions/003-section-first.md
  docs/decisions/004-full-page-segment-and-assemble.md
  docs/decisions/005-mvp-win-condition.md
  docs/decisions/006-skills-first-interface.md
  scripts/verify-docs.sh
)

for f in "${required[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "missing: $f"
    status=1
  fi
done

# Paths mapped in AGENTS.md bullets must exist.
map_list="$root/.verify-docs-map.$$"
python3 - << 'PY' > "$map_list"
from pathlib import Path
text = Path("AGENTS.md").read_text()
for line in text.splitlines():
    stripped = line.lstrip()
    if stripped.startswith("- ") and "`" in line:
        for part in line.split("`")[1::2]:
            if part.endswith(".md") and not part.startswith("CONTEXT") and not part.startswith("GLOSSARY") and part not in {"CONTEXT.md", "GLOSSARY.md"}:
                # load-ceiling mention of docs/eval.md is in a non-bullet line
                print(part)
PY
while IFS= read -r path; do
  if [[ ! -e "$path" ]]; then
    echo "mapped but missing: $path"
    status=1
  fi
done < "$map_list"
rm -f "$map_list"

for banned in CONTEXT.md GLOSSARY.md docs/glossary.md docs/CONTEXT.md docs/GLOSSARY.md; do
  if [[ -e "$banned" ]]; then
    echo "banned file present: $banned"
    status=1
  fi
done

hits=$(python3 - << 'PY'
from pathlib import Path
hits = []
for path in Path(".").rglob("*.md"):
    if "node_modules" in path.parts or ".git" in path.parts:
        continue
    text = path.read_text(encoding="utf-8")
    for i, line in enumerate(text.splitlines(), 1):
        if "\u2014" in line:
            hits.append(f"{path}:{i}: em dash")
print("\n".join(hits))
PY
)
if [[ -n "$hits" ]]; then
  echo "$hits"
  status=1
fi

if [[ "$status" -eq 0 ]]; then
  echo "verify-docs: ok"
fi
exit "$status"
