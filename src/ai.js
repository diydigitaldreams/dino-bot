import fetch from 'node-fetch'
import * as dotenv from 'dotenv'
dotenv.config()

const API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL   = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat-v3-0324:free'

async function fetchWithRetry(body, maxAttempts = 3) {
  let lastError
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const delay = 1000 * Math.pow(2, attempt - 1) // 1s, 2s
      await new Promise(r => setTimeout(r, delay))
    }
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/diydigitaldreams/dino-bot',
          'X-Title': 'Dino Bot',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      })
      // Retry on server errors and rate limits
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`OpenRouter ${res.status}`)
        continue
      }
      if (!res.ok) {
        const err = await res.text()
        throw new Error(`OpenRouter error ${res.status}: ${err}`)
      }
      return await res.json()
    } catch (err) {
      lastError = err
      if (err.name === 'AbortError') continue
      throw err
    }
  }
  throw lastError
}

export async function chat(systemPrompt, history, userMessage) {
  const data = await fetchWithRetry({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      ...history.slice(-20),
      { role: 'user', content: userMessage },
    ],
    max_tokens: 300,
    temperature: 0.85,
  })
  return data.choices?.[0]?.message?.content?.trim() ?? '...'
}

export async function summarizeUrl(url, content) {
  const data = await fetchWithRetry({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'You extract key ideas from web content. Return 3-5 concise bullet points of the most important things. No preamble.',
      },
      {
        role: 'user',
        content: `URL: ${url}\n\nContent:\n${content.slice(0, 4000)}`,
      },
    ],
    max_tokens: 200,
    temperature: 0.3,
  })
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}
