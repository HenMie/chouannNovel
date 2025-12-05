// AI 配置 Tour 步骤配置
// 引导用户了解 AI 服务配置

import type { TourStep } from '@/stores/tour-store'

export const AI_CONFIG_TOUR_STEPS: TourStep[] = [
  {
    target: 'ai-config-nav',
    title: '设置导航',
    content: '在左侧导航可以切换 AI 服务配置和通用设置。我们先来配置 AI 服务。',
    placement: 'right',
    showSkip: true,
  },
  {
    target: 'ai-config-providers',
    title: 'AI 服务提供商',
    content: '目前支持 Google Gemini、OpenAI 和 Anthropic Claude 三大 AI 服务。你可以同时配置多个，在工作流中灵活选择。',
    placement: 'right',
  },
  {
    target: 'ai-config-api-key',
    title: '配置 API Key',
    content: '在对应服务商处获取 API Key，填入这里即可启用该服务。API Key 会安全地存储在本地。',
    placement: 'top',
  },
  {
    target: 'ai-config-models',
    title: '模型配置',
    content: '展开模型配置，可以选择启用哪些模型。你还可以添加自定义模型来使用第三方代理服务。',
    placement: 'top',
  },
  {
    target: 'ai-config-save',
    title: '保存配置',
    content: '修改完成后，点击保存按钮应用配置。配置好 AI 服务后，就可以在工作流中使用 AI 节点了！',
    placement: 'left',
    nextButtonText: '开始使用',
  },
]

// Tour 配置
export const AI_CONFIG_TOUR_CONFIG = {
  id: 'ai_config' as const,
  name: 'AI 配置引导',
  description: '学习如何配置 AI 服务以启用智能创作功能',
  steps: AI_CONFIG_TOUR_STEPS,
}

