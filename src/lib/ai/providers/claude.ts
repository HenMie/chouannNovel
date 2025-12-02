// Anthropic Claude 服务封装

import { fetch } from '@tauri-apps/plugin-http'
import type { AIRequestOptions, AIResponse, StreamChunk, ProviderSettings } from '../types'

// Claude API 请求格式
interface ClaudeRequest {
  model: string
  max_tokens: number
  system?: string
  messages: Array<{ role: string; content: string }>
  temperature?: number
  top_p?: number
  stream?: boolean
}

// Claude API 响应格式
interface ClaudeResponse {
  id: string
  type: string
  content: Array<{ type: string; text: string }>
  stop_reason: string
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

// Claude 流式事件类型
interface ClaudeStreamEvent {
  type: string
  index?: number
  delta?: { type: string; text?: string }
  content_block?: { type: string; text: string }
  message?: ClaudeResponse
}

// 默认 API 地址
const DEFAULT_BASE_URL = 'https://api.anthropic.com'

// API 版本
const API_VERSION = '2023-06-01'

/**
 * 发送 Claude 聊天请求（非流式）
 */
export async function chat(
  options: AIRequestOptions,
  settings: ProviderSettings
): Promise<AIResponse> {
  const baseUrl = settings.baseUrl || DEFAULT_BASE_URL
  const url = `${baseUrl}/v1/messages`

  // 提取系统消息
  const messages = [...options.messages]
  let systemPrompt: string | undefined

  if (messages[0]?.role === 'system') {
    systemPrompt = messages[0].content
    messages.shift()
  }

  const body: ClaudeRequest = {
    model: options.model,
    max_tokens: options.max_tokens || 4096,
    messages: messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
    stream: false,
  }

  // 添加系统提示词
  if (systemPrompt) {
    body.system = systemPrompt
  }

  // 添加可选参数
  if (options.temperature !== undefined) {
    body.temperature = options.temperature
  }
  if (options.top_p !== undefined) {
    body.top_p = options.top_p
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': API_VERSION,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Claude API 错误: ${response.status} - ${error}`)
  }

  const data = (await response.json()) as ClaudeResponse

  // 提取文本内容
  const content = data.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')

  return {
    content,
    usage: {
      prompt_tokens: data.usage.input_tokens,
      completion_tokens: data.usage.output_tokens,
      total_tokens: data.usage.input_tokens + data.usage.output_tokens,
    },
  }
}

/**
 * 发送 Claude 流式聊天请求
 */
export async function chatStream(
  options: AIRequestOptions,
  settings: ProviderSettings,
  onChunk: (chunk: StreamChunk) => void
): Promise<void> {
  const baseUrl = settings.baseUrl || DEFAULT_BASE_URL
  const url = `${baseUrl}/v1/messages`

  // 提取系统消息
  const messages = [...options.messages]
  let systemPrompt: string | undefined

  if (messages[0]?.role === 'system') {
    systemPrompt = messages[0].content
    messages.shift()
  }

  const body: ClaudeRequest = {
    model: options.model,
    max_tokens: options.max_tokens || 4096,
    messages: messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
    stream: true,
  }

  // 添加系统提示词
  if (systemPrompt) {
    body.system = systemPrompt
  }

  // 添加可选参数
  if (options.temperature !== undefined) {
    body.temperature = options.temperature
  }
  if (options.top_p !== undefined) {
    body.top_p = options.top_p
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': API_VERSION,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Claude API 错误: ${response.status} - ${error}`)
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
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        try {
          const event = JSON.parse(trimmed.slice(6)) as ClaudeStreamEvent

          if (event.type === 'content_block_delta' && event.delta?.text) {
            onChunk({ content: event.delta.text, done: false })
          } else if (event.type === 'message_stop') {
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

