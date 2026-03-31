import fetch from 'node-fetch'
import { load } from 'cheerio'
import { summarizeUrl } from './ai.js'

const URL_REGEX = /https?:\/\/[^\s]+/gi

export function extractUrls(text) {
  return text.match(URL_REGEX) ?? []
}

export function extractPersonalityTraits(text) {
  const traits = []
  const patterns = [
    /i (?:love|like|enjoy|hate|dislike|prefer|am into|really like|can't stand|obsess over|adore) (.+?)(?:\.|,|!|\?|$)/gi,
    /my (?:favorite|favourite) (.+?) is (.+?)(?:\.|,|!|\?|$)/gi,
    /i(?:'m| am) (?:a |an )?(.+?)(?:\.|,|!|\?|$)/gi,
    /i work (?:as|in|on|with) (.+?)(?:\.|,|!|\?|$)/gi,
    /i (?:think|believe|feel) (?:that )?(.+?)(?:\.|,|!|\?|$)/gi,
    /i (?:spend|spent) (?:a lot of )?time (.+?)(?:\.|,|!|\?|$)/gi,
    /i grew up (?:in|on|with|around) (.+?)(?:\.|,|!|\?|$)/gi,
    /i(?:'ve| have) (?:always |been |never )?(.+?)(?:\.|,|!|\?|$)/gi,
    /i (?:study|studied|learning|learned) (.+?)(?:\.|,|!|\?|$)/gi,
    /i(?:'m| am) (?:really |super |very )?(?:into|passionate about|obsessed with) (.+?)(?:\.|,|!|\?|$)/gi,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const trait = match[0].trim().toLowerCase()
      if (trait.length > 5 && trait.length < 120) {
        traits.push(trait)
      }
    }
  }
  return traits
}

export async function scrapeUrl(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DinoBot/1.0)' },
      signal: AbortSignal.timeout(8000),
    })
    const html = await res.text()
    const $    = load(html)

    // Remove noise
    $('script, style, nav, footer, header, aside, iframe').remove()

    const title = $('title').text().trim()
    const body  = $('body').text().replace(/\s+/g, ' ').trim()

    return { title, body: body.slice(0, 6000) }
  } catch (err) {
    return null
  }
}

export async function processUrl(url) {
  const scraped = await scrapeUrl(url)
  if (!scraped) return null
  const summary = await summarizeUrl(url, scraped.body)
  return { title: scraped.title, summary, url }
}
