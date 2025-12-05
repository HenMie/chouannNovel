import { useCallback, useRef, useState } from 'react'

export interface WorkflowCommand<T = void> {
  description?: string
  redo: () => Promise<T> | T
  undo: () => Promise<void> | void
}

interface HistoryConfig {
  maxSize?: number
}

interface UseWorkflowHistoryReturn {
  canUndo: boolean
  canRedo: boolean
  historySize: number
  execute: <T>(command: WorkflowCommand<T>) => Promise<T>
  undo: () => Promise<void>
  redo: () => Promise<void>
  clear: () => void
}

/**
 * 命令式的撤销 / 重做管理 Hook
 * 通过记录命令而非全量快照，实现更轻量的历史管理
 */
export function useWorkflowHistory(config: HistoryConfig = {}): UseWorkflowHistoryReturn {
  const { maxSize = 50 } = config
  // 使用 unknown 类型允许存储任意返回值类型的命令
  const [undoStack, setUndoStack] = useState<WorkflowCommand<unknown>[]>([])
  const [redoStack, setRedoStack] = useState<WorkflowCommand<unknown>[]>([])

  const undoRef = useRef<WorkflowCommand<unknown>[]>([])
  const redoRef = useRef<WorkflowCommand<unknown>[]>([])

  const syncUndo = (stack: WorkflowCommand<unknown>[]) => {
    undoRef.current = stack
    setUndoStack(stack)
  }

  const syncRedo = (stack: WorkflowCommand<unknown>[]) => {
    redoRef.current = stack
    setRedoStack(stack)
  }

  const execute = useCallback(async <T,>(command: WorkflowCommand<T>): Promise<T> => {
    const result = await command.redo()
    const nextUndoStack: WorkflowCommand<unknown>[] = [...undoRef.current, command]
    if (nextUndoStack.length > maxSize) {
      nextUndoStack.splice(0, nextUndoStack.length - maxSize)
    }
    syncUndo(nextUndoStack)
    syncRedo([])
    return result
  }, [maxSize])

  const undo = useCallback(async () => {
    const currentUndo = undoRef.current
    if (currentUndo.length === 0) return
    const command = currentUndo[currentUndo.length - 1]
    await command.undo()
    const nextUndo = currentUndo.slice(0, -1)
    syncUndo(nextUndo)
    syncRedo([...redoRef.current, command])
  }, [])

  const redo = useCallback(async () => {
    const currentRedo = redoRef.current
    if (currentRedo.length === 0) return
    const command = currentRedo[currentRedo.length - 1]
    await command.redo()
    const nextRedo = currentRedo.slice(0, -1)
    syncRedo(nextRedo)
    const nextUndo = [...undoRef.current, command]
    if (nextUndo.length > maxSize) {
      nextUndo.splice(0, nextUndo.length - maxSize)
    }
    syncUndo(nextUndo)
  }, [maxSize])

  const clear = useCallback(() => {
    syncUndo([])
    syncRedo([])
  }, [])

  return {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    historySize: undoStack.length,
    execute,
    undo,
    redo,
    clear,
  }
}

export type { UseWorkflowHistoryReturn }

