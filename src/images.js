import { deflateSync } from 'zlib'

// Pure JS CRC32 — no zlib.crc32 dependency (unstable across Node builds)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function uint32BE(n) {
  const b = Buffer.alloc(4)
  b.writeUInt32BE(n >>> 0)
  return b
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const crcVal = crc32(Buffer.concat([t, data]))
  return Buffer.concat([uint32BE(data.length), t, data, uint32BE(crcVal)])
}

function solidColorPNG(r, g, b, size = 256) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = pngChunk('IHDR', Buffer.concat([
    uint32BE(size), uint32BE(size),
    Buffer.from([8, 2, 0, 0, 0])
  ]))
  const scanline = Buffer.alloc(1 + size * 3)
  scanline[0] = 0
  for (let x = 0; x < size; x++) {
    scanline[1 + x * 3]     = r
    scanline[1 + x * 3 + 1] = g
    scanline[1 + x * 3 + 2] = b
  }
  const raw  = Buffer.concat(Array.from({ length: size }, () => scanline))
  const idat = pngChunk('IDAT', deflateSync(raw))
  const iend = pngChunk('IEND', Buffer.alloc(0))
  return Buffer.concat([sig, ihdr, idat, iend])
}

// Personality category keyword maps → base RGB colors
const CATEGORIES = [
  { name: 'creative', keywords: ['music','art','film','design','writing','poetry','dance','draw','paint','create','creative','aesthetic','photography'], color: [220, 80, 120] },
  { name: 'tech',     keywords: ['code','coding','programming','software','ai','data','engineering','developer','tech','computer','python','javascript','cybersecurity'], color: [60, 130, 220] },
  { name: 'nature',   keywords: ['hiking','plants','animals','outdoors','ocean','garden','nature','forest','environment','wildlife','earth','beach'], color: [60, 180, 90] },
  { name: 'social',   keywords: ['people','friends','community','culture','travel','social','conversation','family','relationships','politics'], color: [230, 160, 40] },
  { name: 'dark',     keywords: ['horror','crime','death','noir','metal','goth','dark','mystery','thriller','paranormal','occult','true crime'], color: [100, 50, 180] },
  { name: 'food',     keywords: ['cooking','food','restaurant','coffee','eating','cuisine','baking','chef','recipe','drink','bar'], color: [220, 110, 40] },
  { name: 'sport',    keywords: ['fitness','sport','gym','running','football','basketball','training','workout','exercise','athlete','boxing'], color: [30, 180, 170] },
]

// Derive a blended RGB color from personality traits
export function personalityColor(traits) {
  if (!traits || traits.length === 0) return [160, 160, 160]

  const weights = CATEGORIES.map(cat => {
    const count = traits.filter(t =>
      cat.keywords.some(k => t.toLowerCase().includes(k))
    ).length
    return { color: cat.color, weight: count }
  })

  const total = weights.reduce((s, w) => s + w.weight, 0)
  if (total === 0) return [160, 160, 160]

  const blended = weights.reduce(
    (acc, { color, weight }) => [
      acc[0] + color[0] * weight / total,
      acc[1] + color[1] * weight / total,
      acc[2] + color[2] * weight / total,
    ],
    [0, 0, 0]
  )
  return blended.map(Math.round)
}

// Stage accent colors
const STAGE_ACCENT = {
  egg:      [255, 220, 80],
  hatchling:[100, 210, 140],
  baby:     [80,  150, 220],
  adult:    [130, 80,  210],
}

// Blend personality color with stage accent — more personality as dino matures
export function stagePersonalityImage(stage, traits) {
  const pColor = personalityColor(traits)
  const sColor = STAGE_ACCENT[stage] ?? [160, 160, 160]
  const pWeight = stage === 'adult' ? 0.8 : stage === 'baby' ? 0.65 : 0.4
  const sWeight = 1 - pWeight
  const r = Math.round(pColor[0] * pWeight + sColor[0] * sWeight)
  const g = Math.round(pColor[1] * pWeight + sColor[1] * sWeight)
  const b = Math.round(pColor[2] * pWeight + sColor[2] * sWeight)
  return solidColorPNG(r, g, b)
}

// Fallback static images (used when no traits exist yet)
export const STAGE_IMAGES = {
  egg:      () => solidColorPNG(255, 220, 80),
  hatchling:() => solidColorPNG(100, 210, 140),
  baby:     () => solidColorPNG(80,  150, 220),
  adult:    () => solidColorPNG(130, 80,  210),
}
