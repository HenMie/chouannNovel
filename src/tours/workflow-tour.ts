// 工作流 Tour 步骤配置
// 引导用户了解工作流编辑功能

import type { TourStep } from '@/stores/tour-store'

export const WORKFLOW_TOUR_STEPS: TourStep[] = [
  {
    target: 'workflow-node-list',
    title: '节点列表',
    content: '工作流由一系列节点组成。节点按顺序执行，每个节点完成特定的任务，如 AI 对话、文本处理等。',
    placement: 'right',
    showSkip: true,
  },
  {
    target: 'workflow-add-node-button',
    title: '添加节点',
    content: '点击这里添加新节点。你可以选择 AI 对话、文本拼接、内容提取、循环、条件分支等多种节点类型。',
    placement: 'bottom',
  },
  {
    target: 'workflow-undo-redo',
    title: '撤销与重做',
    content: '编辑操作支持撤销（Ctrl+Z）和重做（Ctrl+Shift+Z），不用担心误操作。',
    placement: 'bottom',
  },
  {
    target: 'workflow-paste-button',
    title: '复制粘贴',
    content: '你可以复制节点（Ctrl+C）并粘贴到当前工作流或其他工作流中。支持批量操作。',
    placement: 'bottom',
  },
  {
    target: 'workflow-run-button',
    title: '运行工作流',
    content: '配置好节点后，点击运行按钮（或按 Ctrl+Enter）执行工作流。执行过程中可以暂停和继续。',
    placement: 'left',
  },
  {
    target: 'workflow-output-panel',
    title: '执行输出',
    content: '执行结果会实时显示在这里。你可以查看每个节点的输出内容，暂停时还可以手动修改中间结果。',
    placement: 'left',
    nextButtonText: '开始创作',
  },
]

// Tour 配置
export const WORKFLOW_TOUR_CONFIG = {
  id: 'workflow' as const,
  name: '工作流编辑引导',
  description: '学习如何构建和运行 AI 驱动的创作工作流',
  steps: WORKFLOW_TOUR_STEPS,
}

