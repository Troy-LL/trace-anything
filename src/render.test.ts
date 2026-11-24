import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { readRaster } from "./decode.ts"
import { renderBuiltPage } from "./render.ts"

test("renderBuiltPage screenshot width matches requested width", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "trace-render-"))
  const project = path.join(dir, "project")
  const dist = path.join(project, "dist")
  const out = path.join(dir, "shot.png")
  const width = 240
  try {
    await mkdir(dist, { recursive: true })
    await writeFile(
      path.join(dist, "index.html"),
      `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;width:${width}px;height:80px;background:rgb(51,102,255)"></body></html>`,
    )
    const screenshot = await renderBuiltPage({ projectDir: project, width, out })
    assert.equal(screenshot, out)
    const raster = await readRaster(out)
    assert.equal(raster.width, width)
    assert.equal(raster.height, 80)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("renderBuiltPage captures full document height beyond default viewport", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "trace-render-tall-"))
  const project = path.join(dir, "project")
  const dist = path.join(project, "dist")
  const out = path.join(dir, "shot.png")
  const width = 20
  const documentHeight = 1024
  try {
    await mkdir(dist, { recursive: true })
    await writeFile(
      path.join(dist, "index.html"),
      `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;width:${width}px;height:${documentHeight}px;background:rgb(255,0,0)"></body></html>`,
    )
    const screenshot = await renderBuiltPage({ projectDir: project, width, out })
    assert.equal(screenshot, out)
    const raster = await readRaster(out)
    assert.equal(raster.width, width)
    assert.equal(raster.height, documentHeight)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})