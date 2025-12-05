// 首页 Tour 步骤配置
// 引导用户了解项目管理功能

import type { TourStep } from '@/stores/tour-store'

export const HOME_TOUR_STEPS: TourStep[] = [
  {
    target: 'home-welcome',
    title: '欢迎使用 ChouannNovel!',
    content: '这是你的创作工作台。在这里，你可以管理所有的小说创作项目，查看整体创作进度。',
    placement: 'bottom',
    showSkip: true,
  },
  {
    target: 'home-stats',
    title: '创作统计',
    content: '这里显示你的活跃项目数量和今日创作字数，帮助你追踪创作进度。',
    placement: 'left',
  },
  {
    target: 'home-project-list',
    title: '项目列表',
    content: '所有创建的项目都会在这里显示。点击项目卡片进入项目详情，管理工作流和设定库。',
    placement: 'top',
  },
  {
    target: 'home-new-project',
    title: '创建新项目',
    content: '点击这个按钮开始创建一个新的小说项目。每个项目都可以包含多个工作流和设定库。',
    placement: 'bottom',
    nextButtonText: '了解了',
  },
  {
    target: 'home-import-project',
    title: '导入项目',
    content: '如果你有之前导出的项目备份文件，可以通过这里导入恢复。',
    placement: 'bottom',
  },
]

// Tour 配置
export const HOME_TOUR_CONFIG = {
  id: 'home' as const,
  name: '首页引导',
  description: '了解项目管理和创作工作台的基本功能',
  steps: HOME_TOUR_STEPS,
}

