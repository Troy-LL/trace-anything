import { readFile } from "node:fs/promises"
import jpeg from "jpeg-js"
import { PNG } from "pngjs"

export type Raster = {
  width: number
  height: number
  data: Uint8Array
}

export async function readRaster(file: string): Promise<Raster> {
  const bytes = await readFile(file)
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true })
    return { width: decoded.width, height: decoded.height, data: decoded.data }
  }
  const png = PNG.sync.read(bytes)
  return { width: png.width, height: png.height, data: png.data }
}

export function writePng(raster: Raster): Buffer {
  const png = new PNG({ width: raster.width, height: raster.height })
  png.data.set(raster.data)
  return PNG.sync.write(png)
}
