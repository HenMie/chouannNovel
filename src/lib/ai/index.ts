// AI 服务统一入口

import * as openai from './providers/openai'
import * as gemini from './providers/gemini'
import * as claude from './providers/claude'
import type { AIRequestOptions, AIResponse, StreamChunk, ProviderSettings, Message } from './types'
import type { AIProvider, GlobalConfig } from '@/types'

// 导出类型
export type { AIRequestOptions, AIResponse, StreamChunk, ProviderSettings, Message }
export type { MessageRole } from './types'

// 模型配置：每个模型支持的参数
export interface ModelConfig {
  id: string
  name: string
  provider: AIProvider
  supportsTemperature: boolean
  supportsMaxTokens: boolean
  supportsTopP: boolean
  supportsThinkingLevel?: boolean
  defaultMaxTokens?: number
}

// 支持的模型列表
export const MODELS: ModelConfig[] = [
  // OpenAI 模型
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    supportsTemperature: true,
    supportsMaxTokens: true,
    supportsTopP: true,
    defaultMaxTokens: 4096,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    supportsTemperature: true,
    supportsMaxTokens: true,
    supportsTopP: true,
    defaultMaxTokens: 4096,
  },
  {
    id: 'o1',
    name: 'o1',
    provider: 'openai',
    supportsTemperature: false,
    supportsMaxTokens: true,
    supportsTopP: false,
    defaultMaxTokens: 4096,
  },
  {
    id: 'o1-mini',
    name: 'o1 Mini',
    provider: 'openai',
    supportsTemperature: false,
    supportsMaxTokens: true,
    supportsTopP: false,
    defaultMaxTokens: 4096,
  },

  // Gemini 模型
  {
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash',
    provider: 'gemini',
    supportsTemperature: true,
    supportsMaxTokens: true,
    supportsTopP: true,
    supportsThinkingLevel: true,
    defaultMaxTokens: 8192,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    supportsTemperature: true,
    supportsMaxTokens: true,
    supportsTopP: true,
    supportsThinkingLevel: true,
    defaultMaxTokens: 8192,
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'gemini',
    supportsTemperature: true,
    supportsMaxTokens: true,
    supportsTopP: true,
    defaultMaxTokens: 8192,
  },

  // Claude 模型
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    provider: 'claude',
    supportsTemperature: true,
    supportsMaxTokens: true,
    supportsTopP: true,
    defaultMaxTokens: 4096,
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'claude',
    supportsTemperature: true,
    supportsMaxTokens: true,
    supportsTopP: true,
    defaultMaxTokens: 4096,
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'claude',
    supportsTemperature: true,
    supportsMaxTokens: true,
    supportsTopP: true,
    defaultMaxTokens: 4096,
  },
]

/**
 * 获取提供商设置
 */
export function getProviderSettings(
  provider: AIProvider,
  globalConfig: GlobalConfig
): ProviderSettings | null {
  const config = globalConfig.ai_providers[provider]
  if (!config || !config.enabled || !config.api_key) {
    return null
  }
  return {
    apiKey: config.api_key,
    baseUrl: config.base_url,
  }
}

/**
 * 获取可用的模型列表（已启用的提供商）
 */
export function getAvailableModels(globalConfig: GlobalConfig): ModelConfig[] {
  return MODELS.filter((model) => {
    const config = globalConfig.ai_providers[model.provider]
    return config?.enabled && config.api_key
  })
}

/**
 * 根据模型 ID 获取模型配置
 */
export function getModelConfig(modelId: string): ModelConfig | undefined {
  return MODELS.find((m) => m.id === modelId)
}

/**
 * 发送 AI 聊天请求（非流式）
 */
export async function chat(
  options: AIRequestOptions,
  globalConfig: GlobalConfig
): Promise<AIResponse> {
  const settings = getProviderSettings(options.provider, globalConfig)
  if (!settings) {
    throw new Error(`提供商 ${options.provider} 未配置或未启用`)
  }

  switch (options.provider) {
    case 'openai':
      return openai.chat(options, settings)
    case 'gemini':
      return gemini.chat(options, settings)
    case 'claude':
      return claude.chat(options, settings)
    default:
      throw new Error(`不支持的提供商: ${options.provider}`)
  }
}

/**
 * 发送 AI 流式聊天请求
 */
export async function chatStream(
  options: AIRequestOptions,
  globalConfig: GlobalConfig,
  onChunk: (chunk: StreamChunk) => void
): Promise<void> {
  const settings = getProviderSettings(options.provider, globalConfig)
  if (!settings) {
    throw new Error(`提供商 ${options.provider} 未配置或未启用`)
  }

  switch (options.provider) {
    case 'openai':
      return openai.chatStream(options, settings, onChunk)
    case 'gemini':
      return gemini.chatStream(options, settings, onChunk)
    case 'claude':
      return claude.chatStream(options, settings, onChunk)
    default:
      throw new Error(`不支持的提供商: ${options.provider}`)
  }
}

