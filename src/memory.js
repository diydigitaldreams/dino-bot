import fetch from 'node-fetch'
import { summarizeUrl } from './ai.js'

const URL_REGEX = /https?:\/\/[^\s]+/gi

// Private/internal IP ranges — blocked to prevent SSRF
const BLOCKED_HOSTS = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,   // AWS metadata
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
]

function isSafeUrl(urlStr) {
  try {
    const url = new URL(urlStr)
    if (!['http:', 'https:'].includes(url.protocol)) return false
    const host = url.hostname
    // Block raw IPs — only allow domain names
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false
    if (BLOCKED_HOSTS.some(r => r.test(host))) return false
    return true
  } catch {
    return false
  }
}

export function extractUrls(text) {
  const raw = text.match(URL_REGEX) ?? []
  return raw
    .map(u => u.replace(/[.,!?)>»\]'"]+$/, '')) // strip trailing punctuation
    .filter(isSafeUrl)
}

// Transient states to exclude from personality storage
const TRANSIENT_PATTERNS = [
  /^i(?:'m| am) (?:going|trying|about to|not sure|just|also|still|here|back|done|good|ok|fine|tired|busy|ready|sorry|glad|happy|excited|scared|worried)/i,
  /^i(?:'m| am) (?:a )?(?:bit|little|kind of|sort of|pretty|very|really|so|too|not)/i,
]

export function extractPersonalityTraits(text) {
  // Skip commands entirely
  if (text.startsWith('/')) return []

  const traits = []
  const patterns = [
    /i (?:love|like|enjoy|hate|dislike|prefer|am into|really like|can't stand|obsess over|adore) ([^.!?,\n]{4,80})/gi,
    /my (?:favorite|favourite) [^.!?,\n]{2,40} is ([^.!?,\n]{2,60})/gi,
    /i work (?:as|in|on|with) ([^.!?,\n]{4,60})/gi,
    /i (?:spend|spent) (?:a lot of )?time ([^.!?,\n]{4,60})/gi,
    /i grew up (?:in|on|with|around) ([^.!?,\n]{4,60})/gi,
    /i (?:study|studied|am learning|learned) ([^.!?,\n]{4,60})/gi,
    /i(?:'m| am) (?:really |super |very )?(?:into|passionate about|obsessed with) ([^.!?,\n]{4,60})/gi,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const trait = match[0].trim().toLowerCase()
      // Skip transient states
      if (TRANSIENT_PATTERNS.some(p => p.test(trait))) continue
      if (trait.length > 5 && trait.length < 120) traits.push(trait)
    }
  }
  return traits
}

export async function scrapeUrl(url) {
  if (!isSafeUrl(url)) {
    console.log(`[url] blocked: ${url}`)
    return null
  }
  console.log(`[url] fetching: ${url}`)
  try {
    const jinaUrl = `https://r.jina.ai/${url}`
    const res = await fetch(jinaUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DinoBot/1.0)',
        'Accept': 'text/plain',
      },
      signal: AbortSignal.timeout(15000),
    })
    console.log(`[url] jina status: ${res.status} for ${url}`)
    if (!res.ok) return null
    const text = await res.text()
    const titleMatch = text.match(/^Title:\s*(.+)/m)
    const title = titleMatch ? titleMatch[1].trim() : url
    const body  = text.slice(0, 6000)
    return { title, body }
  } catch (err) {
    console.log(`[url] fetch error: ${err.message}`)
    return null
  }
}

export async function processUrl(url) {
  try {
    const scraped = await scrapeUrl(url)
    if (!scraped) return null
    const summary = await summarizeUrl(url, scraped.body)
    return { title: scraped.title, summary, url }
  } catch {
    return null
  }
}
