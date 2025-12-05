// 设定库 Tour 步骤配置
// 引导用户了解设定库管理功能

import type { TourStep } from '@/stores/tour-store'

export const SETTINGS_TOUR_STEPS: TourStep[] = [
  {
    target: 'settings-tabs',
    title: '设定分类',
    content: '设定库分为四大类：角色、世界观、笔触风格和大纲。点击标签切换不同的分类。',
    placement: 'bottom',
    showSkip: true,
  },
  {
    target: 'settings-search',
    title: '搜索设定',
    content: '当设定条目较多时，可以使用搜索功能快速定位需要的内容。',
    placement: 'bottom',
  },
  {
    target: 'settings-add-button',
    title: '添加设定',
    content: '点击这里为当前分类添加新的设定条目。每个设定包含名称和详细内容描述。',
    placement: 'left',
  },
  {
    target: 'settings-prompt-button',
    title: '注入提示词',
    content: '配置设定如何注入到 AI 提示词中。你可以自定义模板格式，控制设定在生成时的呈现方式。',
    placement: 'left',
  },
  {
    target: 'settings-list',
    title: '设定列表',
    content: '已创建的设定会显示在这里。你可以展开查看详情、编辑内容，或使用开关控制是否在生成时启用该设定。',
    placement: 'top',
    nextButtonText: '明白了',
  },
]

// Tour 配置
export const SETTINGS_TOUR_CONFIG = {
  id: 'settings' as const,
  name: '设定库引导',
  description: '学习如何管理角色、世界观等创作设定',
  steps: SETTINGS_TOUR_STEPS,
}

