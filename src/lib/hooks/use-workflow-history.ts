import { useState, useCallback, useRef } from 'react'
import type { WorkflowNode } from '@/types'

// 历史记录操作类型
type HistoryActionType = 'add' | 'delete' | 'update' | 'reorder' | 'batch_delete'

// 历史记录项
interface HistoryEntry {
  type: HistoryActionType
  timestamp: number
  // 操作前的节点状态快照
  beforeNodes: WorkflowNode[]
  // 操作后的节点状态快照
  afterNodes: WorkflowNode[]
  // 操作描述（用于调试）
  description?: string
}

// 历史记录配置
interface HistoryConfig {
  maxSize?: number // 最大历史记录数，默认 50
}

// 返回类型
interface UseWorkflowHistoryReturn {
  // 状态
  canUndo: boolean
  canRedo: boolean
  historySize: number
  
  // 操作方法
  pushHistory: (
    type: HistoryActionType,
    beforeNodes: WorkflowNode[],
    afterNodes: WorkflowNode[],
    description?: string
  ) => void
  undo: () => WorkflowNode[] | null
  redo: () => WorkflowNode[] | null
  clear: () => void
  
  // 用于包装操作的辅助方法
  trackOperation: <T>(
    type: HistoryActionType,
    currentNodes: WorkflowNode[],
    operation: () => Promise<T>,
    getNewNodes: () => WorkflowNode[],
    description?: string
  ) => Promise<T>
}

/**
 * 工作流历史记录 Hook
 * 用于实现撤销/重做功能
 */
export function useWorkflowHistory(config: HistoryConfig = {}): UseWorkflowHistoryReturn {
  const { maxSize = 50 } = config
  
  // 撤销栈
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([])
  // 重做栈
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([])
  
  // 使用 ref 防止闭包问题
  const undoStackRef = useRef(undoStack)
  const redoStackRef = useRef(redoStack)
  undoStackRef.current = undoStack
  redoStackRef.current = redoStack
  
  // 添加历史记录
  const pushHistory = useCallback((
    type: HistoryActionType,
    beforeNodes: WorkflowNode[],
    afterNodes: WorkflowNode[],
    description?: string
  ) => {
    const entry: HistoryEntry = {
      type,
      timestamp: Date.now(),
      beforeNodes: JSON.parse(JSON.stringify(beforeNodes)), // 深拷贝
      afterNodes: JSON.parse(JSON.stringify(afterNodes)),   // 深拷贝
      description,
    }
    
    setUndoStack(prev => {
      const newStack = [...prev, entry]
      // 限制历史记录大小
      if (newStack.length > maxSize) {
        return newStack.slice(-maxSize)
      }
      return newStack
    })
    
    // 清空重做栈
    setRedoStack([])
  }, [maxSize])
  
  // 撤销操作
  const undo = useCallback((): WorkflowNode[] | null => {
    const currentUndoStack = undoStackRef.current
    if (currentUndoStack.length === 0) return null
    
    const entry = currentUndoStack[currentUndoStack.length - 1]
    
    // 移动到重做栈
    setUndoStack(prev => prev.slice(0, -1))
    setRedoStack(prev => [...prev, entry])
    
    // 返回操作前的节点状态
    return entry.beforeNodes
  }, [])
  
  // 重做操作
  const redo = useCallback((): WorkflowNode[] | null => {
    const currentRedoStack = redoStackRef.current
    if (currentRedoStack.length === 0) return null
    
    const entry = currentRedoStack[currentRedoStack.length - 1]
    
    // 移动到撤销栈
    setRedoStack(prev => prev.slice(0, -1))
    setUndoStack(prev => [...prev, entry])
    
    // 返回操作后的节点状态
    return entry.afterNodes
  }, [])
  
  // 清空历史
  const clear = useCallback(() => {
    setUndoStack([])
    setRedoStack([])
  }, [])
  
  // 辅助方法：包装一个操作并自动记录历史
  const trackOperation = useCallback(async <T>(
    type: HistoryActionType,
    currentNodes: WorkflowNode[],
    operation: () => Promise<T>,
    getNewNodes: () => WorkflowNode[],
    description?: string
  ): Promise<T> => {
    const beforeNodes = JSON.parse(JSON.stringify(currentNodes))
    
    // 执行操作
    const result = await operation()
    
    // 获取新的节点状态并记录
    const afterNodes = getNewNodes()
    pushHistory(type, beforeNodes, afterNodes, description)
    
    return result
  }, [pushHistory])
  
  return {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    historySize: undoStack.length,
    pushHistory,
    undo,
    redo,
    clear,
    trackOperation,
  }
}

export type { HistoryActionType, HistoryEntry, UseWorkflowHistoryReturn }

