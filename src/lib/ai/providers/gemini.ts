// Google Gemini 服务封装

import { fetch } from '@tauri-apps/plugin-http'
import type { AIRequestOptions, AIResponse, StreamChunk, ProviderSettings } from '../types'

// Gemini API 请求格式
interface GeminiRequest {
  contents: Array<{
    role: string
    parts: Array<{ text: string }>
  }>
  generationConfig?: {
    temperature?: number
    maxOutputTokens?: number
    topP?: number
  }
}

// Gemini API 响应格式
interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>
      role: string
    }
    finishReason: string
  }>
  usageMetadata?: {
    promptTokenCount: number
    candidatesTokenCount: number
    totalTokenCount: number
  }
}

// Gemini 流式响应格式
interface GeminiStreamChunk {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
    finishReason?: string
  }>
}

// 默认 API 地址
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

/**
 * 将消息角色转换为 Gemini 格式
 */
function convertRole(role: string): string {
  if (role === 'assistant') return 'model'
  if (role === 'system') return 'user' // Gemini 不支持 system role，转为 user
  return 'user'
}

/**
 * 发送 Gemini 聊天请求（非流式）
 */
export async function chat(
  options: AIRequestOptions,
  settings: ProviderSettings
): Promise<AIResponse> {
  const baseUrl = settings.baseUrl || DEFAULT_BASE_URL
  const url = `${baseUrl}/models/${options.model}:generateContent?key=${settings.apiKey}`

  // 处理系统提示词：将 system 消息和第一个 user 消息合并
  const messages = [...options.messages]
  let systemPrompt = ''

  if (messages[0]?.role === 'system') {
    systemPrompt = messages[0].content + '\n\n'
    messages.shift()
  }

  // 如果有系统提示词，将其添加到第一个用户消息前
  if (systemPrompt && messages.length > 0 && messages[0].role === 'user') {
    messages[0] = {
      ...messages[0],
      content: systemPrompt + messages[0].content,
    }
  }

  const body: GeminiRequest = {
    contents: messages.map((m) => ({
      role: convertRole(m.role),
      parts: [{ text: m.content }],
    })),
    generationConfig: {},
  }

  // 添加可选参数
  if (options.temperature !== undefined) {
    body.generationConfig!.temperature = options.temperature
  }
  if (options.max_tokens !== undefined) {
    body.generationConfig!.maxOutputTokens = options.max_tokens
  }
  if (options.top_p !== undefined) {
    body.generationConfig!.topP = options.top_p
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Gemini API 错误: ${response.status} - ${error}`)
  }

  const data = (await response.json()) as GeminiResponse

  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const usage = data.usageMetadata
    ? {
        prompt_tokens: data.usageMetadata.promptTokenCount,
        completion_tokens: data.usageMetadata.candidatesTokenCount,
        total_tokens: data.usageMetadata.totalTokenCount,
      }
    : undefined

  return { content, usage }
}

/**
 * 发送 Gemini 流式聊天请求
 */
export async function chatStream(
  options: AIRequestOptions,
  settings: ProviderSettings,
  onChunk: (chunk: StreamChunk) => void
): Promise<void> {
  const baseUrl = settings.baseUrl || DEFAULT_BASE_URL
  const url = `${baseUrl}/models/${options.model}:streamGenerateContent?alt=sse&key=${settings.apiKey}`

  // 处理系统提示词
  const messages = [...options.messages]
  let systemPrompt = ''

  if (messages[0]?.role === 'system') {
    systemPrompt = messages[0].content + '\n\n'
    messages.shift()
  }

  if (systemPrompt && messages.length > 0 && messages[0].role === 'user') {
    messages[0] = {
      ...messages[0],
      content: systemPrompt + messages[0].content,
    }
  }

  const body: GeminiRequest = {
    contents: messages.map((m) => ({
      role: convertRole(m.role),
      parts: [{ text: m.content }],
    })),
    generationConfig: {},
  }

  // 添加可选参数
  if (options.temperature !== undefined) {
    body.generationConfig!.temperature = options.temperature
  }
  if (options.max_tokens !== undefined) {
    body.generationConfig!.maxOutputTokens = options.max_tokens
  }
  if (options.top_p !== undefined) {
    body.generationConfig!.topP = options.top_p
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Gemini API 错误: ${response.status} - ${error}`)
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
          const json = JSON.parse(trimmed.slice(6)) as GeminiStreamChunk
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text
          const finishReason = json.candidates?.[0]?.finishReason

          if (text) {
            onChunk({ content: text, done: false })
          }
          if (finishReason === 'STOP') {
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

