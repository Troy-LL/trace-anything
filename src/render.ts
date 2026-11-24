import { access, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { chromium } from "playwright"

async function screenshotHtml(url: string, width: number, out: string): Promise<string> {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width, height: 1 } })
    await page.goto(url)
    const height = await page.evaluate(() =>
      Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
    )
    const documentHeight = Math.max(1, height)
    await page.setViewportSize({ width, height: documentHeight })
    const buffer = await page.screenshot({ type: "png" })
    await writeFile(path.resolve(out), buffer)
    return path.resolve(out)
  } finally {
    await browser.close()
  }
}

export async function renderBuiltPage(options: {
  projectDir: string
  width: number
  out: string
}): Promise<string> {
  const entry = path.resolve(options.projectDir, "dist", "index.html")
  await access(entry)
  const shot = path.join(path.dirname(entry), ".shot.html")
  await writeFile(shot, (await readFile(entry, "utf8")).replaceAll(" crossorigin", ""))
  try {
    return await screenshotHtml(pathToFileURL(shot).href, options.width, options.out)
  } finally {
    await rm(shot, { force: true })
  }
}

export async function renderHtmlPage(options: { html: string; width: number; out: string }): Promise<string> {
  const entry = path.resolve(options.html)
  await access(entry)
  return screenshotHtml(pathToFileURL(entry).href, options.width, options.out)
}