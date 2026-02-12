// AI 设定助手 - 帮助用户创建、扩展、总结设定内容

import type { SettingAIAction, SettingCategory, GlobalConfig, AIProvider } from '@/types'
import type { Message, StreamChunk } from './types'
import { chatStream } from './index'

// 分类中文标签
const CATEGORY_LABELS: Record<SettingCategory, string> = {
  character: '角色',
  worldview: '世界观',
  style: '笔触风格',
  outline: '大纲',
}

// 根据动作和分类构建 system prompt
function buildSystemPrompt(action: SettingAIAction, category: SettingCategory, customPrompt?: string): string {
  // 如果有自定义提示词，直接使用
  if (customPrompt) return customPrompt

  const categoryLabel = CATEGORY_LABELS[category]

  switch (action) {
    case 'expand':
      return `你是一位专业的小说创作助手。你的任务是基于用户提供的${categoryLabel}设定内容，进行丰富和扩展。

要求：
- 保持原有设定的核心不变
- 补充更多具体细节，使设定更加立体
- 使用清晰的 Markdown 格式组织内容
- 语言风格与原文保持一致
- 直接输出扩展后的完整内容，不要添加解释性文字`

    case 'generate':
      return `你是一位专业的小说创作助手。你的任务是根据给定的名称和分类，从零生成一份完整的${categoryLabel}设定。

要求：
- 内容丰富、具有创意，但保持合理性
- 使用清晰的 Markdown 格式，适当使用标题分节
- 涵盖该${categoryLabel}的关键要素
- 直接输出设定内容，不要添加解释性文字`

    case 'summarize':
      return `你是一位专业的小说创作助手。你的任务是为给定的${categoryLabel}设定生成一份简短摘要。

要求：
- 摘要长度控制在 50-100 字以内
- 提取最核心的特征和信息
- 适合作为快速浏览的概要
- 直接输出摘要文本，不要添加标题或前缀`
  }
}

// 根据动作构建 user prompt
function buildUserPrompt(
  action: SettingAIAction,
  name: string,
  category: SettingCategory,
  content: string,
  contextSettings?: Array<{ name: string; content: string }>,
): string {
  const categoryLabel = CATEGORY_LABELS[category]
  let contextText = ''

  if (contextSettings && contextSettings.length > 0) {
    contextText = '\n\n【参考上下文 - 同项目的其他设定】\n' +
      contextSettings.map(s => `${s.name}：${s.content.substring(0, 200)}`).join('\n\n')
  }

  switch (action) {
    case 'expand':
      return `请扩展以下${categoryLabel}设定：\n\n名称：${name}\n\n现有内容：\n${content}${contextText}`

    case 'generate':
      return `请为以下${categoryLabel}生成完整设定：\n\n名称：${name}${content ? `\n\n用户备注：${content}` : ''}${contextText}`

    case 'summarize':
      return `请为以下${categoryLabel}设定生成简短摘要：\n\n名称：${name}\n\n完整内容：\n${content}`
  }
}

// 获取显式配置的 AI 提供商和模型
function getConfiguredProvider(globalConfig: GlobalConfig): { provider: AIProvider; model: string; prompts?: { expand?: string; generate?: string; summarize?: string } } | null {
  const config = globalConfig.setting_assistant
  if (!config) return null

  // 验证对应的提供商已启用且有 API key
  const providerConfig = globalConfig.ai_providers[config.provider]
  if (!providerConfig?.enabled || !providerConfig.api_key) return null

  return config
}

export interface SettingAssistantOptions {
  action: SettingAIAction
  name: string
  category: SettingCategory
  content: string
  contextSettings?: Array<{ name: string; content: string }>
  globalConfig: GlobalConfig
  onChunk: (chunk: StreamChunk) => void
  signal?: AbortSignal
}

/**
 * 调用 AI 设定助手
 * 使用用户已配置的第一个可用 AI 提供商
 */
export async function runSettingAssistant(options: SettingAssistantOptions): Promise<void> {
  const { action, name, category, content, contextSettings, globalConfig, onChunk, signal } = options

  const providerInfo = getConfiguredProvider(globalConfig)
  if (!providerInfo) {
    throw new Error('未配置设定助手的 AI 模型，请先在设定编辑器中选择提供商和模型')
  }

  const systemPrompt = buildSystemPrompt(action, category, providerInfo.prompts?.[action])
  const userPrompt = buildUserPrompt(action, name, category, content, contextSettings)

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  await chatStream(
    {
      provider: providerInfo.provider,
      model: providerInfo.model,
      messages,
      temperature: action === 'summarize' ? 0.3 : 1.0,
      signal,
    },
    globalConfig,
    onChunk,
  )
}

/**
 * 获取 AI 助手已配置的提供商名称（用于 UI 展示）
 */
export function getAssistantProviderName(globalConfig: GlobalConfig): string | null {
  const providerInfo = getConfiguredProvider(globalConfig)
  if (!providerInfo) return null

  const names: Record<AIProvider, string> = {
    gemini: 'Google Gemini',
    openai: 'OpenAI',
    claude: 'Claude',
  }
  return names[providerInfo.provider]
}
