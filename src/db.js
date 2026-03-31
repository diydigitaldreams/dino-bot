import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR  = join(__dirname, '..', 'data', 'dinos')

mkdirSync(DATA_DIR, { recursive: true })

function dinoPath(phone) {
  return join(DATA_DIR, `${phone}.json`)
}

export function getDino(phone) {
  const path = dinoPath(phone)
  if (!existsSync(path)) return null
  try { return JSON.parse(readFileSync(path, 'utf8')) }
  catch { return null }
}

export function createDino(phone) {
  const dino = {
    phone,
    name:         null,
    stage:        'egg',
    hunger:       100,
    happiness:    100,
    xp:           0,
    interactions: 0,
    url_feeds:    0,
    personality:  [],
    memories:     [],
    history:      [],
    created_at:   Math.floor(Date.now() / 1000),
    last_seen:    Math.floor(Date.now() / 1000),
  }
  saveDino(dino)
  return dino
}

export function saveDino(dino) {
  dino.last_seen = Math.floor(Date.now() / 1000)
  writeFileSync(dinoPath(dino.phone), JSON.stringify(dino, null, 2))
}

export function getAllDinos() {
  if (!existsSync(DATA_DIR)) return []
  return readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        const d = JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8'))
        return { phone: d.phone, name: d.name, stage: d.stage, xp: d.xp, last_seen: d.last_seen }
      } catch { return null }
    })
    .filter(Boolean)
}
