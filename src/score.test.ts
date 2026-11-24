import assert from "node:assert/strict"
import test from "node:test"
import type { Raster } from "./decode.ts"
import { scoreRasters, sourceEmbedded } from "./score.ts"

function solid(width: number, height: number, rgb: [number, number, number]): Raster {
  const data = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = rgb[0]
    data[i * 4 + 1] = rgb[1]
    data[i * 4 + 2] = rgb[2]
    data[i * 4 + 3] = 255
  }
  return { width, height, data }
}

test("identical rasters score 1 on every component", () => {
  const raster = solid(8, 6, [32, 64, 128])
  const score = scoreRasters(raster, raster)
  assert.equal(score.components.perceptual, 1)
  assert.equal(score.components.layout, 1)
  assert.equal(score.components.text, 1)
  assert.equal(score.components.color, 1)
  assert.equal(score.combined, 1)
  assert.deepEqual(score.mismatches, [])
})

test("a different flat color scores below a matching color", () => {
  const source = solid(8, 6, [255, 0, 0])
  const match = scoreRasters(source, solid(8, 6, [250, 4, 4]))
  const miss = scoreRasters(source, solid(8, 6, [0, 0, 255]))
  assert.ok(match.components.color > 0.9)
  assert.ok(miss.components.color < match.components.color)
  assert.ok(miss.components.perceptual < 0.5)
  assert.equal(miss.mismatches.some((item) => item.component === "color" && item.severity === "high"), true)
})

function paint(raster: Raster, points: [number, number][]): void {
  for (const [x, y] of points) {
    const pixel = (y * raster.width + x) * 4
    raster.data[pixel] = 0
    raster.data[pixel + 1] = 0
    raster.data[pixel + 2] = 0
  }
}

test("ink shifted a few pixels still scores and missing ink does not", () => {
  const points: [number, number][] = [
    [4, 3],
    [5, 3],
    [4, 5],
    [10, 8],
    [11, 8],
  ]
  const source = solid(40, 16, [255, 255, 255])
  paint(source, points)
  const shifted = solid(40, 16, [255, 255, 255])
  paint(
    shifted,
    points.map(([x, y]) => [x + 2, y]),
  )
  const far = solid(40, 16, [255, 255, 255])
  paint(
    far,
    points.map(([x, y]) => [x + 12, y]),
  )
  const blank = solid(40, 16, [255, 255, 255])
  const near = scoreRasters(source, shifted)
  const missed = scoreRasters(source, blank)
  const elsewhere = scoreRasters(source, far)
  assert.ok(near.components.text > 0.8)
  assert.ok(missed.components.text < 0.2)
  assert.ok(elsewhere.components.text < 0.2)
  assert.ok(missed.components.text < near.components.text)
})

test("the same ink keeps its text score when the render is only shorter below it", () => {
  const points: [number, number][] = [
    [4, 2],
    [6, 2],
    [5, 4],
    [12, 7],
  ]
  const source = solid(40, 20, [255, 255, 255])
  paint(source, points)
  const shot = solid(40, 12, [255, 255, 255])
  paint(shot, points)
  const score = scoreRasters(source, shot)
  assert.ok(score.components.text > 0.8)
})

test("ink that the render drops lowers text and leaves a flat color match alone", () => {
  const source = solid(8, 4, [255, 255, 255])
  source.data[0] = 0
  source.data[1] = 0
  source.data[2] = 0
  const blank = solid(8, 4, [255, 255, 255])
  const dropped = scoreRasters(source, blank)
  const kept = scoreRasters(source, source)
  assert.ok(dropped.components.text < kept.components.text)
  assert.equal(kept.components.text, 1)
})

test("embedded image markup fails the source gate", () => {
  assert.equal(sourceEmbedded('<section style="background:#fff"></section>'), false)
  assert.equal(sourceEmbedded('background-image:url("shot.png")'), true)
  assert.equal(sourceEmbedded('<img src="data:image/png;base64,aaaa">'), true)
  const crop =
    '<body style="width:100px"><section style="height:80px"><img alt="" src="./crops/mark.png" style="position:absolute;left:4px;top:6px;width:12px;height:12px"></section></body>'
  const page =
    '<body style="width:100px"><section style="height:80px"><img alt="" src="./crops/all.png" style="position:absolute;left:0px;top:0px;width:100px;height:80px"></section></body>'
  assert.equal(sourceEmbedded(crop), false)
  assert.equal(sourceEmbedded(page), true)
})
