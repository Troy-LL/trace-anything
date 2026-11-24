import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { writeReferenceProject } from "./reference-adapter.ts"

const packageRoot = path.resolve(import.meta.dirname, "..")

function runViteBuild(projectDir: string): Promise<void> {
  const viteBin = path.join(packageRoot, "node_modules", "vite", "bin", "vite.js")
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [viteBin, "build"], {
      cwd: projectDir,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stderr = ""
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr || `vite build exited ${code}`))
    })
  })
}

test("reference adapter vite build emits fixture heading without background-image", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "trace-adapter-"))
  const intermediate = path.join(dir, "intermediate.json")
  const project = path.join(dir, "project")
  const description = {
    schemaVersion: 1,
    sectionId: "sec-fixture",
    source: {
      imageHash: "abc",
      bbox: { x: 0, y: 0, width: 120, height: 64 },
      width: 120,
    },
    tokens: { colors: ["#3366ff", "#071633"], spacing: [], fonts: [], radii: [] },
    fontSubstitutions: [],
    root: {
      id: "sec-fixture",
      kind: "box",
      box: { x: 0, y: 0, width: 120, height: 64 },
      style: { background: "colors.0", color: "colors.1" },
      children: [
        {
          id: "sec-fixture-label",
          kind: "text",
          text: "Fixture heading",
          box: { x: 0, y: 0, width: 120, height: 32 },
          children: [],
        },
      ],
      guesses: [],
    },
  }
  try {
    await writeFile(intermediate, JSON.stringify(description))
    await writeReferenceProject(intermediate, project)
    await runViteBuild(project)
    const html = await readFile(path.join(project, "dist", "index.html"), "utf8")
    assert.match(html, /Fixture heading/)
    assert.match(html, /#3366ff/i)
    assert.equal(html.includes("colors.0"), false)
    assert.equal(html.includes("background-image"), false)
    const css = await readFile(path.join(project, "styles.css"), "utf8")
    assert.match(css, /border-box/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})