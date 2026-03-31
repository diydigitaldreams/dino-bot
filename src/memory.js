import fetch from 'node-fetch'
import { load } from 'cheerio'
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
  return (text.match(URL_REGEX) ?? []).filter(isSafeUrl)
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
  if (!isSafeUrl(url)) return null
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DinoBot/1.0)' },
      signal: AbortSignal.timeout(8000),
      follow: 3, // limit redirects
    })
    const html = await res.text()
    const $    = load(html)
    $('script, style, nav, footer, header, aside, iframe').remove()
    const title = $('title').text().trim()
    const body  = $('body').text().replace(/\s+/g, ' ').trim()
    return { title, body: body.slice(0, 6000) }
  } catch {
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
