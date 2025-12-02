// AI 服务统一入口 - 使用 Vercel AI SDK

import { generateText, streamText, type CoreMessage } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAnthropic } from '@ai-sdk/anthropic'
import type { AIRequestOptions, AIResponse, StreamChunk, Message } from './types'
import type { AIProvider, GlobalConfig } from '@/types'

// 导出类型
export type { AIRequestOptions, AIResponse, StreamChunk, Message }
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
    id: 'gemini-2.5-pro-preview-06-05',
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
 * 创建 AI 模型实例
 */
function createModel(
  provider: AIProvider,
  modelId: string,
  globalConfig: GlobalConfig
) {
  const providerConfig = globalConfig.ai_providers[provider]
  if (!providerConfig?.enabled || !providerConfig.api_key) {
    throw new Error(`提供商 ${provider} 未配置或未启用`)
  }

  switch (provider) {
    case 'openai': {
      const openai = createOpenAI({
        apiKey: providerConfig.api_key,
        baseURL: providerConfig.base_url || undefined,
      })
      return openai(modelId)
    }
    case 'gemini': {
      const google = createGoogleGenerativeAI({
        apiKey: providerConfig.api_key,
      })
      return google(modelId)
    }
    case 'claude': {
      const anthropic = createAnthropic({
        apiKey: providerConfig.api_key,
      })
      return anthropic(modelId)
    }
    default:
      throw new Error(`不支持的提供商: ${provider}`)
  }
}

/**
 * 转换消息格式为 Vercel AI SDK 格式
 */
function convertMessages(messages: Message[]): CoreMessage[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))
}

/**
 * 发送 AI 聊天请求（非流式）
 */
export async function chat(
  options: AIRequestOptions,
  globalConfig: GlobalConfig
): Promise<AIResponse> {
  const model = createModel(options.provider, options.model, globalConfig)
  const modelConfig = getModelConfig(options.model)

  const result = await generateText({
    model,
    messages: convertMessages(options.messages),
    temperature: modelConfig?.supportsTemperature ? options.temperature : undefined,
    maxOutputTokens: modelConfig?.supportsMaxTokens ? options.maxTokens : undefined,
    topP: modelConfig?.supportsTopP ? options.topP : undefined,
  })

  return {
    content: result.text,
    usage: result.usage
      ? {
          promptTokens: result.usage.inputTokens ?? 0,
          completionTokens: result.usage.outputTokens ?? 0,
          totalTokens: result.usage.totalTokens ?? 0,
        }
      : undefined,
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
  const model = createModel(options.provider, options.model, globalConfig)
  const modelConfig = getModelConfig(options.model)

  const result = streamText({
    model,
    messages: convertMessages(options.messages),
    temperature: modelConfig?.supportsTemperature ? options.temperature : undefined,
    maxOutputTokens: modelConfig?.supportsMaxTokens ? options.maxTokens : undefined,
    topP: modelConfig?.supportsTopP ? options.topP : undefined,
  })

  // 处理流式响应
  for await (const textPart of result.textStream) {
    onChunk({ content: textPart, done: false })
  }

  // 流结束
  onChunk({ content: '', done: true })
}

/**
 * 流式聊天请求 - 返回 AsyncIterable（用于更灵活的控制）
 */
export async function* chatStreamIterable(
  options: AIRequestOptions,
  globalConfig: GlobalConfig
): AsyncGenerator<StreamChunk> {
  const model = createModel(options.provider, options.model, globalConfig)
  const modelConfig = getModelConfig(options.model)

  const result = streamText({
    model,
    messages: convertMessages(options.messages),
    temperature: modelConfig?.supportsTemperature ? options.temperature : undefined,
    maxOutputTokens: modelConfig?.supportsMaxTokens ? options.maxTokens : undefined,
    topP: modelConfig?.supportsTopP ? options.topP : undefined,
  })

  for await (const textPart of result.textStream) {
    yield { content: textPart, done: false }
  }

  yield { content: '', done: true }
}
