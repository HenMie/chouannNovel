// AI 服务相关类型定义

import type { AIProvider } from '@/types'

// AI 消息角色
export type MessageRole = 'system' | 'user' | 'assistant'

// AI 消息
export interface Message {
  role: MessageRole
  content: string
}

// Thinking/Reasoning 配置（跨提供商统一接口）
export interface ThinkingConfig {
  /**
   * Gemini 3 Pro 的思考深度
   */
  thinkingLevel?: 'low' | 'high'
  /**
   * Gemini 2.5 系列的思考预算
   * - 0: 禁用思考
   * - -1: 动态思考
   * - 正数: 指定 token 预算
   */
  thinkingBudget?: number
  /**
   * Claude 的推理努力程度
   * 影响 thinking、文本响应和函数调用
   * 默认为 'high'
   */
  effort?: 'low' | 'medium' | 'high'
  /**
   * 是否返回思考摘要（Gemini）
   */
  includeThoughts?: boolean
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
  /**
   * Gemini 模型的 thinking 配置
   */
  thinkingConfig?: ThinkingConfig
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
