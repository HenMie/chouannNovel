// OpenAI 服务封装

import { fetch } from '@tauri-apps/plugin-http'
import type { AIRequestOptions, AIResponse, StreamChunk, ProviderSettings } from '../types'

// OpenAI API 请求格式
interface OpenAIRequest {
  model: string
  messages: Array<{ role: string; content: string }>
  temperature?: number
  max_tokens?: number
  top_p?: number
  stream?: boolean
}

// OpenAI API 响应格式
interface OpenAIResponse {
  id: string
  choices: Array<{
    message: { role: string; content: string }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// OpenAI 流式响应格式
interface OpenAIStreamChunk {
  id: string
  choices: Array<{
    delta: { content?: string }
    finish_reason: string | null
  }>
}

// 默认 API 地址
const DEFAULT_BASE_URL = 'https://api.openai.com/v1'

/**
 * 发送 OpenAI 聊天请求（非流式）
 */
export async function chat(
  options: AIRequestOptions,
  settings: ProviderSettings
): Promise<AIResponse> {
  const baseUrl = settings.baseUrl || DEFAULT_BASE_URL
  const url = `${baseUrl}/chat/completions`

  const body: OpenAIRequest = {
    model: options.model,
    messages: options.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    stream: false,
  }

  // 添加可选参数
  if (options.temperature !== undefined) {
    body.temperature = options.temperature
  }
  if (options.max_tokens !== undefined) {
    body.max_tokens = options.max_tokens
  }
  if (options.top_p !== undefined) {
    body.top_p = options.top_p
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API 错误: ${response.status} - ${error}`)
  }

  const data = (await response.json()) as OpenAIResponse

  return {
    content: data.choices[0]?.message?.content || '',
    usage: data.usage,
  }
}

/**
 * 发送 OpenAI 流式聊天请求
 */
export async function chatStream(
  options: AIRequestOptions,
  settings: ProviderSettings,
  onChunk: (chunk: StreamChunk) => void
): Promise<void> {
  const baseUrl = settings.baseUrl || DEFAULT_BASE_URL
  const url = `${baseUrl}/chat/completions`

  const body: OpenAIRequest = {
    model: options.model,
    messages: options.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    stream: true,
  }

  // 添加可选参数
  if (options.temperature !== undefined) {
    body.temperature = options.temperature
  }
  if (options.max_tokens !== undefined) {
    body.max_tokens = options.max_tokens
  }
  if (options.top_p !== undefined) {
    body.top_p = options.top_p
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API 错误: ${response.status} - ${error}`)
  }

  // 处理 SSE 流
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('无法读取响应流')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') continue
        if (!trimmed.startsWith('data: ')) continue

        try {
          const json = JSON.parse(trimmed.slice(6)) as OpenAIStreamChunk
          const content = json.choices[0]?.delta?.content
          const isDone = json.choices[0]?.finish_reason !== null

          if (content) {
            onChunk({ content, done: false })
          }
          if (isDone) {
            onChunk({ content: '', done: true })
          }
        } catch {
          // 忽略解析错误
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

