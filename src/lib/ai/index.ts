// AI 服务统一入口 - 使用 Vercel AI SDK

import { generateText, streamText, type CoreMessage } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAnthropic } from '@ai-sdk/anthropic'
import type { AIRequestOptions, AIResponse, StreamChunk, Message, ThinkingConfig } from './types'
import type { AIProvider, GlobalConfig } from '@/types'

// 导出类型
export type { AIRequestOptions, AIResponse, StreamChunk, Message, ThinkingConfig }
export type { MessageRole } from './types'

// Thinking/Reasoning 配置模式
export type ThinkingMode = 
  | 'thinkingLevel'    // Gemini 3 Pro: 'low' | 'high'
  | 'thinkingBudget'   // Gemini 2.5: 数值 token 预算
  | 'effort'           // Claude: 'low' | 'medium' | 'high'
  | 'none'             // 不支持

// 模型配置：每个模型支持的参数
export interface ModelConfig {
  id: string
  name: string
  provider: AIProvider
  supportsTemperature: boolean
  supportsMaxTokens: boolean
  supportsTopP: boolean
  /**
   * Thinking/Reasoning 支持模式:
   * - 'thinkingLevel': Gemini 3 Pro 使用，支持 'low' 和 'high'
   * - 'thinkingBudget': Gemini 2.5 系列使用，支持数值 token 预算
   * - 'effort': Claude 使用，支持 'low' | 'medium' | 'high'
   * - 'none': 不支持
   */
  thinkingMode?: ThinkingMode
  /**
   * thinkingBudget 的有效范围 [min, max]
   * 仅当 thinkingMode === 'thinkingBudget' 时有效
   */
  thinkingBudgetRange?: [number, number]
  /**
   * 是否可以禁用 thinking（设置 thinkingBudget = 0）
   * 仅当 thinkingMode === 'thinkingBudget' 时有效
   */
  canDisableThinking?: boolean
  /**
   * 默认最大输出 token 数（仅当用户启用 maxTokens 时使用）
   */
  defaultMaxTokens?: number
}

// 系统内置模型列表
export const BUILTIN_MODELS: ModelConfig[] = [
  // Gemini 模型
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro Preview',
    provider: 'gemini',
    // Gemini 3 Pro 官方建议保持 temperature=1.0 和 top_p=0.95 的默认值
    // 因为模型内置思维链推理机制，调整这些参数可能导致推理能力下降
    supportsTemperature: false,
    supportsMaxTokens: true,
    supportsTopP: false,
    thinkingMode: 'thinkingLevel',
    defaultMaxTokens: 8192,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    supportsTemperature: true,
    supportsMaxTokens: true,
    supportsTopP: true,
    thinkingMode: 'thinkingBudget',
    thinkingBudgetRange: [128, 32768],
    canDisableThinking: false,
    defaultMaxTokens: 8192,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    supportsTemperature: true,
    supportsMaxTokens: true,
    supportsTopP: true,
    thinkingMode: 'thinkingBudget',
    thinkingBudgetRange: [0, 24576],
    canDisableThinking: true,
    defaultMaxTokens: 8192,
  },

  // OpenAI 模型
  {
    id: 'gpt-5.1',
    name: 'GPT-5.1',
    provider: 'openai',
    supportsTemperature: true,
    supportsMaxTokens: true,
    supportsTopP: true,
    defaultMaxTokens: 4096,
  },
  {
    id: 'gpt-5',
    name: 'GPT-5',
    provider: 'openai',
    supportsTemperature: true,
    supportsMaxTokens: true,
    supportsTopP: true,
    defaultMaxTokens: 4096,
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'openai',
    supportsTemperature: true,
    supportsMaxTokens: true,
    supportsTopP: true,
    defaultMaxTokens: 4096,
  },

  // Claude 模型
  {
    id: 'claude-opus-4-5-20251101',
    name: 'Claude Opus 4.5',
    provider: 'claude',
    supportsTemperature: true,
    supportsMaxTokens: true,
    supportsTopP: true,
    // Claude Opus 4.5 支持 effort 参数控制推理深度
    thinkingMode: 'effort',
    defaultMaxTokens: 8192,
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    provider: 'claude',
    supportsTemperature: true,
    supportsMaxTokens: true,
    supportsTopP: true,
    // Claude Sonnet 4.5 支持 effort 参数控制推理深度
    thinkingMode: 'effort',
    defaultMaxTokens: 8192,
  },
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    provider: 'claude',
    supportsTemperature: true,
    supportsMaxTokens: true,
    supportsTopP: true,
    // Haiku 不支持 effort 参数
    defaultMaxTokens: 4096,
  },
]

// 兼容旧版本：MODELS 指向 BUILTIN_MODELS
export const MODELS = BUILTIN_MODELS

/**
 * 获取指定提供商的内置模型列表
 */
export function getBuiltinModelsByProvider(provider: AIProvider): ModelConfig[] {
  return BUILTIN_MODELS.filter((m) => m.provider === provider)
}

/**
 * 获取可用的模型列表（已启用的提供商 + 已启用的模型）
 */
export function getAvailableModels(globalConfig: GlobalConfig): ModelConfig[] {
  const result: ModelConfig[] = []

  for (const provider of ['openai', 'gemini', 'claude'] as AIProvider[]) {
    const config = globalConfig.ai_providers[provider]
    if (!config?.enabled || !config.api_key) continue

    // 获取该提供商启用的内置模型
    const enabledModelIds = config.enabled_models || []
    const builtinModels = BUILTIN_MODELS.filter(
      (m) => m.provider === provider && enabledModelIds.includes(m.id)
    )
    result.push(...builtinModels)

    // 添加自定义模型
    const customModels = config.custom_models || []
    for (const custom of customModels) {
      if (custom.enabled) {
        result.push({
          id: custom.id,
          name: custom.name,
          provider,
          supportsTemperature: true,
          supportsMaxTokens: true,
          supportsTopP: true,
          defaultMaxTokens: 4096,
        })
      }
    }
  }

  return result
}

/**
 * 根据模型 ID 获取模型配置
 */
export function getModelConfig(modelId: string, globalConfig?: GlobalConfig): ModelConfig | undefined {
  // 首先在内置模型中查找
  const builtinModel = BUILTIN_MODELS.find((m) => m.id === modelId)
  if (builtinModel) return builtinModel

  // 如果提供了全局配置，在自定义模型中查找
  if (globalConfig) {
    for (const provider of ['openai', 'gemini', 'claude'] as AIProvider[]) {
      const config = globalConfig.ai_providers[provider]
      const customModel = config?.custom_models?.find((m) => m.id === modelId)
      if (customModel) {
        return {
          id: customModel.id,
          name: customModel.name,
          provider,
          supportsTemperature: true,
          supportsMaxTokens: true,
          supportsTopP: true,
          defaultMaxTokens: 4096,
        }
      }
    }
  }

  return undefined
}

/**
 * 根据模型 ID 获取其所属的提供商
 */
export function getModelProvider(modelId: string, globalConfig?: GlobalConfig): AIProvider | undefined {
  const config = getModelConfig(modelId, globalConfig)
  return config?.provider
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
        baseURL: providerConfig.base_url || undefined,
      })
      return google(modelId)
    }
    case 'claude': {
      const anthropic = createAnthropic({
        apiKey: providerConfig.api_key,
        baseURL: providerConfig.base_url || undefined,
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
 * 构建提供商特定的 providerOptions
 * 根据模型类型返回相应的配置
 */
function buildProviderOptions(
  thinkingConfig: ThinkingConfig | undefined,
  modelConfig: ModelConfig | undefined
) {
  if (!thinkingConfig || !modelConfig) {
    return undefined
  }

  const thinkingMode = modelConfig.thinkingMode

  // 不支持 thinking 的模型
  if (!thinkingMode || thinkingMode === 'none') {
    return undefined
  }

  // Gemini 模型
  if (modelConfig.provider === 'gemini') {
    // Gemini 3 Pro 使用 thinkingLevel
    if (thinkingMode === 'thinkingLevel' && thinkingConfig.thinkingLevel) {
      return {
        google: {
          thinkingConfig: {
            thinkingLevel: thinkingConfig.thinkingLevel,
            includeThoughts: thinkingConfig.includeThoughts ?? false,
          },
        },
      }
    }

    // Gemini 2.5 系列使用 thinkingBudget
    if (thinkingMode === 'thinkingBudget' && thinkingConfig.thinkingBudget !== undefined) {
      return {
        google: {
          thinkingConfig: {
            thinkingBudget: thinkingConfig.thinkingBudget,
            includeThoughts: thinkingConfig.includeThoughts ?? false,
          },
        },
      }
    }
  }

  // Claude 模型
  if (modelConfig.provider === 'claude') {
    // Claude Opus/Sonnet 使用 effort 参数
    if (thinkingMode === 'effort' && thinkingConfig.effort) {
      return {
        anthropic: {
          effort: thinkingConfig.effort,
        },
      }
    }
  }

  return undefined
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

  // 构建提供商特定选项
  const providerOptions = buildProviderOptions(options.thinkingConfig, modelConfig)

  const result = await generateText({
    model,
    messages: convertMessages(options.messages),
    temperature: modelConfig?.supportsTemperature ? options.temperature : undefined,
    maxOutputTokens: modelConfig?.supportsMaxTokens ? options.maxTokens : undefined,
    topP: modelConfig?.supportsTopP ? options.topP : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    providerOptions: providerOptions as any,
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

  // 构建提供商特定选项
  const providerOptions = buildProviderOptions(options.thinkingConfig, modelConfig)

  const result = streamText({
    model,
    messages: convertMessages(options.messages),
    temperature: modelConfig?.supportsTemperature ? options.temperature : undefined,
    maxOutputTokens: modelConfig?.supportsMaxTokens ? options.maxTokens : undefined,
    topP: modelConfig?.supportsTopP ? options.topP : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    providerOptions: providerOptions as any,
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

  // 构建提供商特定选项
  const providerOptions = buildProviderOptions(options.thinkingConfig, modelConfig)

  const result = streamText({
    model,
    messages: convertMessages(options.messages),
    temperature: modelConfig?.supportsTemperature ? options.temperature : undefined,
    maxOutputTokens: modelConfig?.supportsMaxTokens ? options.maxTokens : undefined,
    topP: modelConfig?.supportsTopP ? options.topP : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    providerOptions: providerOptions as any,
  })

  for await (const textPart of result.textStream) {
    yield { content: textPart, done: false }
  }

  yield { content: '', done: true }
}
