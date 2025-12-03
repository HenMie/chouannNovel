import { useState, useCallback, useMemo } from 'react'
import type { WorkflowNode } from '@/types'

// 选择模式
type SelectionMode = 'single' | 'multi'

// 返回类型
interface UseNodeSelectionReturn {
  // 选中的节点 ID 集合
  selectedIds: Set<string>
  // 选中的节点数量
  selectionCount: number
  // 是否为多选模式
  isMultiSelectMode: boolean
  
  // 选择操作
  select: (nodeId: string) => void
  toggle: (nodeId: string) => void
  selectRange: (nodeId: string, nodes: WorkflowNode[]) => void
  selectAll: (nodes: WorkflowNode[]) => void
  deselect: (nodeId: string) => void
  clearSelection: () => void
  
  // 检查方法
  isSelected: (nodeId: string) => boolean
  getSelectedNodes: (nodes: WorkflowNode[]) => WorkflowNode[]
  
  // 多选模式控制
  setMultiSelectMode: (enabled: boolean) => void
  
  // 处理点击（自动处理 Ctrl/Shift 修饰键）
  handleClick: (nodeId: string, event: React.MouseEvent, nodes: WorkflowNode[]) => void
}

/**
 * 节点选择 Hook
 * 支持单选、多选、范围选择
 */
export function useNodeSelection(): UseNodeSelectionReturn {
  // 选中的节点 ID
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // 多选模式
  const [isMultiSelectMode, setMultiSelectMode] = useState(false)
  // 最后一次点击的节点（用于范围选择）
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)
  
  // 单选
  const select = useCallback((nodeId: string) => {
    setSelectedIds(new Set([nodeId]))
    setLastSelectedId(nodeId)
  }, [])
  
  // 切换选择状态
  const toggle = useCallback((nodeId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
    setLastSelectedId(nodeId)
  }, [])
  
  // 范围选择（Shift+点击）
  const selectRange = useCallback((nodeId: string, nodes: WorkflowNode[]) => {
    if (!lastSelectedId) {
      select(nodeId)
      return
    }
    
    const lastIndex = nodes.findIndex(n => n.id === lastSelectedId)
    const currentIndex = nodes.findIndex(n => n.id === nodeId)
    
    if (lastIndex === -1 || currentIndex === -1) {
      select(nodeId)
      return
    }
    
    const start = Math.min(lastIndex, currentIndex)
    const end = Math.max(lastIndex, currentIndex)
    
    const rangeIds = nodes.slice(start, end + 1).map(n => n.id)
    setSelectedIds(prev => {
      const next = new Set(prev)
      rangeIds.forEach(id => next.add(id))
      return next
    })
    // 范围选择不更新 lastSelectedId，保持原始锚点
  }, [lastSelectedId, select])
  
  // 全选
  const selectAll = useCallback((nodes: WorkflowNode[]) => {
    // 排除开始流程节点
    const selectableNodes = nodes.filter(n => n.type !== 'start')
    setSelectedIds(new Set(selectableNodes.map(n => n.id)))
  }, [])
  
  // 取消选择单个
  const deselect = useCallback((nodeId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.delete(nodeId)
      return next
    })
  }, [])
  
  // 清空选择
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    setLastSelectedId(null)
    setMultiSelectMode(false)
  }, [])
  
  // 检查是否选中
  const isSelected = useCallback((nodeId: string) => {
    return selectedIds.has(nodeId)
  }, [selectedIds])
  
  // 获取选中的节点
  const getSelectedNodes = useCallback((nodes: WorkflowNode[]) => {
    return nodes.filter(n => selectedIds.has(n.id))
  }, [selectedIds])
  
  // 处理点击事件（带修饰键）
  const handleClick = useCallback((
    nodeId: string,
    event: React.MouseEvent,
    nodes: WorkflowNode[]
  ) => {
    // 检查是否为开始流程节点（不可选中进行批量操作）
    const node = nodes.find(n => n.id === nodeId)
    if (node?.type === 'start') {
      // 开始节点只能单选
      clearSelection()
      return
    }
    
    const isCtrlOrMeta = event.ctrlKey || event.metaKey
    const isShift = event.shiftKey
    
    if (isShift && selectedIds.size > 0) {
      // Shift+点击：范围选择
      selectRange(nodeId, nodes)
    } else if (isCtrlOrMeta) {
      // Ctrl/Cmd+点击：切换选择
      toggle(nodeId)
    } else {
      // 普通点击：单选
      select(nodeId)
    }
  }, [selectedIds.size, selectRange, toggle, select, clearSelection])
  
  // 选中数量
  const selectionCount = useMemo(() => selectedIds.size, [selectedIds])
  
  return {
    selectedIds,
    selectionCount,
    isMultiSelectMode,
    select,
    toggle,
    selectRange,
    selectAll,
    deselect,
    clearSelection,
    isSelected,
    getSelectedNodes,
    setMultiSelectMode,
    handleClick,
  }
}

export type { UseNodeSelectionReturn, SelectionMode }

