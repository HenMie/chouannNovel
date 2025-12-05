// 运行按钮状态 Hook
// 统一管理运行按钮的禁用状态和禁用原因

import { useMemo } from 'react'
import type { WorkflowNode, GlobalConfig } from '@/types'

export interface RunButtonState {
  /** 按钮是否禁用 */
  disabled: boolean
  /** 禁用原因，用于 Tooltip 显示 */
  reason: string | null
  /** 可跳转的配置页面 URL */
  actionUrl?: string
  /** 操作按钮文本 */
  actionLabel?: string
}

/**
 * 获取运行按钮的状态
 * 根据节点配置和全局配置判断是否可以运行工作流
 */
export function useRunButtonState(
  nodes: WorkflowNode[],
  globalConfig: GlobalConfig | null,
  isExecuting: boolean = false
): RunButtonState {
  return useMemo(() => {
    // 正在执行时不禁用（由其他逻辑控制）
    if (isExecuting) {
      return { disabled: false, reason: null }
    }

    // 检查 1：全局配置是否加载
    if (!globalConfig) {
      return {
        disabled: true,
        reason: '正在加载配置...',
      }
    }

    // 检查 2：是否有可执行节点（除开始节点外）
    const hasExecutableNode = nodes.some(n => n.type !== 'start')
    if (!hasExecutableNode) {
      return {
        disabled: true,
        reason: '请添加至少一个执行节点',
      }
    }

    // 检查 3：是否有 AI 节点但未配置 AI 服务
    const hasAINode = nodes.some(n => n.type === 'ai_chat')
    if (hasAINode) {
      const hasEnabledProvider = Object.values(globalConfig.ai_providers).some(
        p => p.enabled && p.api_key
      )
      if (!hasEnabledProvider) {
        return {
          disabled: true,
          reason: '包含 AI 节点，请先配置 AI 服务',
          actionUrl: '/settings',
          actionLabel: '去配置',
        }
      }

      // 检查 AI 节点是否配置了模型
      const aiNodes = nodes.filter(n => n.type === 'ai_chat')
      for (const node of aiNodes) {
        const config = node.config as { model?: string }
        if (!config.model) {
          return {
            disabled: true,
            reason: `节点"${node.name}"未选择 AI 模型`,
          }
        }
      }
    }

    // 所有检查通过
    return { disabled: false, reason: null }
  }, [nodes, globalConfig, isExecuting])
}

export default useRunButtonState

