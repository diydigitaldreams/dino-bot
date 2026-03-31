import fetch from 'node-fetch'
import * as dotenv from 'dotenv'
dotenv.config()

const API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL   = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat-v3-0324:free'

export async function chat(systemPrompt, history, userMessage) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-20),
    { role: 'user', content: userMessage },
  ]

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/diydigitaldreams/dino-bot',
      'X-Title': 'Dino Bot',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: 300,
      temperature: 0.85,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenRouter error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() ?? '...'
}

export async function summarizeUrl(url, content) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/diydigitaldreams/dino-bot',
      'X-Title': 'Dino Bot',
    },
    body: JSON.stringify({
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
    }),
  })

  if (!res.ok) throw new Error(`OpenRouter summarize error ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}
