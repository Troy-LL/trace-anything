import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { pageHtml, writeReferenceProject } from "./reference-adapter.ts"

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

test("an image node is a positioned crop file", () => {
  const html = pageHtml(80, [
    {
      id: "sec",
      kind: "box",
      box: { x: 0, y: 0, width: 80, height: 40 },
      style: { background: "#ffffff", color: "#000000" },
      children: [
        {
          id: "g1",
          kind: "image",
          box: { x: 4, y: 6, width: 12, height: 12 },
          style: { src: "./crops/g1.png" },
          children: [],
        },
      ],
    },
  ])
  assert.match(html, /<img[^>]*src="\.\/crops\/g1\.png"/)
  assert.match(html, /width:12px/)
  assert.match(html, /height:12px/)
  assert.equal(html.includes("background-image"), false)
})

test("the adapter copies a crop into the built project", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "trace-crop-"))
  const intermediate = path.join(dir, "intermediate.json")
  const project = path.join(dir, "project")
  const description = {
    schemaVersion: 1,
    sectionId: "sec-crop",
    source: { imageHash: "abc", bbox: { x: 0, y: 0, width: 40, height: 40 }, width: 40 },
    tokens: { colors: ["#ffffff", "#000000"], spacing: [], fonts: [], radii: [] },
    fontSubstitutions: [],
    root: {
      id: "sec-crop",
      kind: "box",
      box: { x: 0, y: 0, width: 40, height: 40 },
      style: { background: "colors.0", color: "colors.1" },
      children: [
        {
          id: "g1",
          kind: "image",
          box: { x: 4, y: 4, width: 10, height: 10 },
          style: { src: "./crops/g1.png" },
          children: [],
        },
      ],
    },
  }
  try {
    await mkdir(path.join(dir, "crops"), { recursive: true })
    await writeFile(path.join(dir, "crops", "g1.png"), Buffer.from([1, 2, 3, 4]))
    await writeFile(intermediate, JSON.stringify(description))
    await writeReferenceProject(intermediate, project)
    const copied = await readFile(path.join(project, "public", "crops", "g1.png"))
    assert.deepEqual([...copied], [1, 2, 3, 4])
    const html = await readFile(path.join(project, "index.html"), "utf8")
    assert.match(html, /src="\.\/crops\/g1\.png"/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})