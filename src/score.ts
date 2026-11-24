import type { Mismatch, ScoreComponentName } from "./records.ts"
import type { Raster } from "./decode.ts"

export type RasterScore = {
  components: Record<ScoreComponentName, number>
  combined: number
  mismatches: Mismatch[]
}

function clamp(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function luma(r: number, g: number, b: number): number {
  return r * 0.3 + g * 0.59 + b * 0.11
}

function sample(raster: Raster, x: number, y: number, width: number, height: number): [number, number, number] {
  const sx = Math.min(raster.width - 1, Math.max(0, Math.floor(((x + 0.5) * raster.width) / width)))
  const sy = Math.min(raster.height - 1, Math.max(0, Math.floor(((y + 0.5) * raster.height) / height)))
  const pixel = (sy * raster.width + sx) * 4
  return [raster.data[pixel] ?? 0, raster.data[pixel + 1] ?? 0, raster.data[pixel + 2] ?? 0]
}

const inkMatchRadius = 3

function inkMask(raster: Raster): Uint8Array {
  const mask = new Uint8Array(raster.width * raster.height)
  for (let y = 0; y < raster.height; y += 1) {
    let sum = 0
    const row = new Float64Array(raster.width)
    for (let x = 0; x < raster.width; x += 1) {
      const pixel = (y * raster.width + x) * 4
      const value = luma(raster.data[pixel] ?? 0, raster.data[pixel + 1] ?? 0, raster.data[pixel + 2] ?? 0)
      row[x] = value
      sum += value
    }
    const mean = raster.width === 0 ? 0 : sum / raster.width
    for (let x = 0; x < raster.width; x += 1) {
      if (Math.abs((row[x] ?? 0) - mean) > 18) mask[y * raster.width + x] = 1
    }
  }
  return mask
}

function inkNearby(mask: Uint8Array, width: number, height: number, x: number, y: number): boolean {
  const y0 = Math.max(0, y - inkMatchRadius)
  const y1 = Math.min(height - 1, y + inkMatchRadius)
  const x0 = Math.max(0, x - inkMatchRadius)
  const x1 = Math.min(width - 1, x + inkMatchRadius)
  for (let yy = y0; yy <= y1; yy += 1) {
    const row = yy * width
    for (let xx = x0; xx <= x1; xx += 1) {
      if (mask[row + xx]) return true
    }
  }
  return false
}

function textScore(source: Raster, shot: Raster): number {
  const sourceInk = inkMask(source)
  const shotInk = inkMask(shot)
  let sourceCount = 0
  let shotCount = 0
  let sourceHit = 0
  let shotHit = 0
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      if (!sourceInk[y * source.width + x]) continue
      sourceCount += 1
      if (inkNearby(shotInk, shot.width, shot.height, x, y)) sourceHit += 1
    }
  }
  for (let y = 0; y < shot.height; y += 1) {
    for (let x = 0; x < shot.width; x += 1) {
      if (!shotInk[y * shot.width + x]) continue
      shotCount += 1
      if (inkNearby(sourceInk, source.width, source.height, x, y)) shotHit += 1
    }
  }
  if (sourceCount === 0 && shotCount === 0) return 1
  if (sourceCount === 0 || shotCount === 0) return 0
  const precision = shotHit / shotCount
  const recall = sourceHit / sourceCount
  const total = precision + recall
  return total === 0 ? 0 : clamp((2 * precision * recall) / total)
}

export function sourceEmbedded(html: string): boolean {
  return /background-image\s*:/i.test(html) || /data:image\//i.test(html)
}

export function scoreRasters(source: Raster, shot: Raster): RasterScore {
  const width = source.width
  const height = source.height
  const count = width * height
  if (count === 0 || shot.width === 0 || shot.height === 0) {
    const components = { perceptual: 0, layout: 0, text: 0, color: 0 }
    return { components, combined: 0, mismatches: [] }
  }

  let abs = 0
  let rowAbs = 0

  for (let y = 0; y < height; y += 1) {
    let sourceRow = 0
    let shotRow = 0
    for (let x = 0; x < width; x += 1) {
      const origin = (y * width + x) * 4
      const sr = source.data[origin] ?? 0
      const sg = source.data[origin + 1] ?? 0
      const sb = source.data[origin + 2] ?? 0
      const [tr, tg, tb] = sample(shot, x, y, width, height)
      abs += Math.abs(sr - tr) + Math.abs(sg - tg) + Math.abs(sb - tb)
      sourceRow += luma(sr, sg, sb)
      shotRow += luma(tr, tg, tb)
    }
    rowAbs += Math.abs(sourceRow / width - shotRow / width)
  }

  const block = 16
  let colorSum = 0
  let blocks = 0
  const maxDistance = Math.sqrt(255 * 255 * 3)
  for (let y = 0; y < height; y += block) {
    for (let x = 0; x < width; x += block) {
      const yEnd = Math.min(height, y + block)
      const xEnd = Math.min(width, x + block)
      let sr = 0
      let sg = 0
      let sb = 0
      let tr = 0
      let tg = 0
      let tb = 0
      let n = 0
      for (let yy = y; yy < yEnd; yy += 1) {
        for (let xx = x; xx < xEnd; xx += 1) {
          const origin = (yy * width + xx) * 4
          sr += source.data[origin] ?? 0
          sg += source.data[origin + 1] ?? 0
          sb += source.data[origin + 2] ?? 0
          const [r, g, b] = sample(shot, xx, yy, width, height)
          tr += r
          tg += g
          tb += b
          n += 1
        }
      }
      const dr = sr / n - tr / n
      const dg = sg / n - tg / n
      const db = sb / n - tb / n
      colorSum += Math.sqrt(dr * dr + dg * dg + db * db)
      blocks += 1
    }
  }

  const components = {
    perceptual: clamp(1 - abs / (count * 3 * 255)),
    layout: clamp(1 - rowAbs / (height * 255)),
    text: textScore(source, shot),
    color: clamp(1 - colorSum / (blocks * maxDistance)),
  }
  const combined = (components.perceptual + components.layout + components.text + components.color) / 4
  const mismatches: Mismatch[] = []
  const names: ScoreComponentName[] = ["perceptual", "layout", "text", "color"]
  for (const name of names) {
    const value = components[name]
    if (value >= 0.8) continue
    mismatches.push({
      bbox: { x: 0, y: 0, width, height },
      component: name,
      severity: value < 0.5 ? "high" : "low",
      detail: `${name} ${value.toFixed(3)}`,
    })
  }
  return { components, combined, mismatches }
}
