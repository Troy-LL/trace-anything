import CoreGraphics
import CoreText
import Foundation
import ImageIO
import Vision

struct Line: Codable {
  let text: String
  let x: Double
  let y: Double
  let width: Double
  let height: Double
  let confidence: Float
  let fontFamily: String
  let fontWeight: Int
  let fontSize: Double
  let top: Double
  let left: Double
}

let families = [
  "Arial", "Helvetica Neue", "Helvetica", "Georgia", "Times New Roman", "Verdana", "Tahoma",
  "Trebuchet MS", "Courier New", "Palatino", "Gill Sans", "Avenir Next", "Futura", "Menlo",
  "Baskerville", "American Typewriter", "Charter", "Hoefler Text", "Optima", "Didot",
]

func loadImage(_ path: String) -> CGImage? {
  let url = URL(fileURLWithPath: path) as CFURL
  guard let source = CGImageSourceCreateWithURL(url, nil) else { return nil }
  return CGImageSourceCreateImageAtIndex(source, 0, nil)
}

func scaled(_ image: CGImage, factor: Int) -> CGImage? {
  if factor == 1 { return image }
  let width = image.width * factor
  let height = image.height * factor
  guard let context = CGContext(
    data: nil,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: 0,
    space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
  ) else { return nil }
  context.interpolationQuality = .none
  context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
  return context.makeImage()
}

func font(family: String, weight: Int, size: CGFloat) -> CTFont? {
  let traits = [
    kCTFontWeightTrait: NSNumber(value: weight >= 700 ? 0.4 : 0.0),
  ] as NSDictionary
  let descriptor = CTFontDescriptorCreateWithAttributes([
    kCTFontFamilyNameAttribute: family,
    kCTFontTraitsAttribute: traits,
  ] as CFDictionary)
  let face = CTFontCreateWithFontDescriptor(descriptor, size, nil)
  let actual = CTFontCopyFamilyName(face) as String
  if actual.caseInsensitiveCompare(family) != ComparisonResult.orderedSame { return nil }
  return face
}

func imageBounds(_ text: String, _ face: CTFont) -> CGRect? {
  let attributes = [kCTFontAttributeName: face] as CFDictionary
  let attributed = CFAttributedStringCreate(nil, text as CFString, attributes)
  let line = CTLineCreateWithAttributedString(attributed!)
  let bounds = CTLineGetImageBounds(line, nil)
  if bounds.width <= 0 || bounds.height <= 0 { return nil }
  return bounds
}

func sized(_ text: String, family: String, weight: Int, targetWidth: CGFloat, targetHeight: CGFloat) -> (CGFloat, CGRect, CGFloat)? {
  guard font(family: family, weight: weight, size: 16) != nil else { return nil }
  var low: CGFloat = 4
  var high = max(targetHeight * 4, 24)
  var size = low
  for _ in 0..<16 {
    size = (low + high) / 2
    guard let face = font(family: family, weight: weight, size: size),
          let bounds = imageBounds(text, face) else { return nil }
    if bounds.width < targetWidth { low = size } else { high = size }
  }
  guard let face = font(family: family, weight: weight, size: size),
        let bounds = imageBounds(text, face) else { return nil }
  let score = abs(bounds.height - targetHeight) + abs(bounds.width - targetWidth) * 0.25
  return (size, bounds, score)
}

func chooseFace(_ samples: [(String, CGFloat, CGFloat, CGFloat)]) -> (String, Int) {
  var bestFamily = "Arial"
  var bestWeight = 400
  var bestScore = CGFloat.greatestFiniteMagnitude
  for family in families {
    for weight in [400, 700] {
      var total: CGFloat = 0
      var used = 0
      for sample in samples {
        guard let fitted = sized(sample.0, family: family, weight: weight, targetWidth: sample.1, targetHeight: sample.2) else {
          used = -1
          break
        }
        total += fitted.2 * sample.3
        used += 1
      }
      if used == samples.count && total < bestScore {
        bestScore = total
        bestFamily = family
        bestWeight = weight
      }
    }
  }
  return (bestFamily, bestWeight)
}

let path = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : ""
guard let image = loadImage(path) else {
  fputs("no image\n", stderr)
  exit(2)
}
guard let prepared = scaled(image, factor: 2) else {
  fputs("no scaled image\n", stderr)
  exit(2)
}
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.recognitionLanguages = ["en-US"]
request.minimumTextHeight = 0.004
let handler = VNImageRequestHandler(cgImage: prepared, options: [:])
do {
  try handler.perform([request])
} catch {
  fputs("vision \(error)\n", stderr)
  exit(3)
}

let pixelWidth = Double(image.width)
let pixelHeight = Double(image.height)
struct Seen {
  let text: String
  let x: Double
  let y: Double
  let width: Double
  let height: Double
  let confidence: Float
}
var seen: [Seen] = []
for observation in request.results ?? [] {
  guard let candidate = observation.topCandidates(1).first else { continue }
  let text = candidate.string.trimmingCharacters(in: .whitespacesAndNewlines)
  if text.isEmpty { continue }
  let box = observation.boundingBox
  seen.append(Seen(
    text: text,
    x: box.origin.x * pixelWidth,
    y: (1 - box.origin.y - box.height) * pixelHeight,
    width: box.width * pixelWidth,
    height: box.height * pixelHeight,
    confidence: candidate.confidence
  ))
}
let face = chooseFace(seen.map { ($0.text, CGFloat($0.width), CGFloat($0.height), CGFloat($0.width)) })
var lines: [Line] = []
for item in seen {
  guard let fitted = sized(item.text, family: face.0, weight: face.1, targetWidth: CGFloat(item.width), targetHeight: CGFloat(item.height)),
        let drawn = font(family: face.0, weight: face.1, size: fitted.0) else { continue }
  let bounds = fitted.1
  let ascent = CTFontGetAscent(drawn)
  let imageTop = bounds.origin.y + bounds.size.height
  lines.append(Line(
    text: item.text,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    confidence: item.confidence,
    fontFamily: face.0,
    fontWeight: face.1,
    fontSize: Double(fitted.0),
    top: item.y - Double(ascent - imageTop),
    left: item.x - Double(bounds.origin.x)
  ))
}
let data = try JSONEncoder().encode(lines)
FileHandle.standardOutput.write(data)
