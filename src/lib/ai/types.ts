// AI 服务相关类型定义

import type { AIProvider } from '@/types'

// AI 消息角色
export type MessageRole = 'system' | 'user' | 'assistant'

// AI 消息
export interface Message {
  role: MessageRole
  content: string
}

// AI 请求参数
export interface AIRequestOptions {
  provider: AIProvider
  model: string
  messages: Message[]
  temperature?: number
  maxTokens?: number
  topP?: number
  stream?: boolean
}

// AI 响应
export interface AIResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

// 流式响应块
export interface StreamChunk {
  content: string
  done: boolean
}

// 提供商配置
export interface ProviderSettings {
  apiKey: string
  baseUrl?: string
}
