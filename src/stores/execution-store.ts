// 执行状态管理

import { create } from 'zustand'
import type { WorkflowNode, Workflow, GlobalConfig, Setting, SettingPrompt } from '@/types'
import {
  WorkflowExecutor,
  ExecutorStatus,
  ExecutionEvent,
  NodeExecutionState,
  executorStatusToDbStatus,
} from '@/lib/engine'
import * as db from '@/lib/db'

// 节点输出显示信息
export interface NodeOutputInfo {
  nodeId: string
  nodeName: string
  nodeType: string
  output: string
  isRunning: boolean
  isStreaming: boolean
}

interface ExecutionState {
  // 执行器实例
  executor: WorkflowExecutor | null
  
  // 执行状态
  status: ExecutorStatus
  
  // 当前执行 ID（数据库记录）
  executionId: string | null
  
  // 当前正在执行的节点索引
  currentNodeIndex: number | null
  
  // 节点状态列表
  nodeStates: NodeExecutionState[]
  
  // 节点输出列表（用于 UI 显示）
  nodeOutputs: NodeOutputInfo[]
  
  // 最终输出
  finalOutput: string
  
  // 流式输出内容（当前节点）
  streamingContent: string
  
  // 当前流式输出的节点 ID
  streamingNodeId: string | null
  
  // 错误信息
  error: string | null
  
  // 已用时间（秒）
  elapsedSeconds: number
  
  // 操作方法
  startExecution: (
    workflow: Workflow,
    nodes: WorkflowNode[],
    globalConfig: GlobalConfig,
    initialInput?: string,
    settings?: Setting[],
    settingPrompts?: SettingPrompt[]
  ) => Promise<void>
  pauseExecution: () => void
  resumeExecution: () => void
  cancelExecution: () => void
  modifyNodeOutput: (nodeId: string, newOutput: string) => void
  reset: () => void
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  // 初始状态
  executor: null,
  status: 'idle',
  executionId: null,
  currentNodeIndex: null,
  nodeStates: [],
  nodeOutputs: [],
  finalOutput: '',
  streamingContent: '',
  streamingNodeId: null,
  error: null,
  elapsedSeconds: 0,

  // 开始执行
  startExecution: async (workflow, nodes, globalConfig, initialInput, settings, settingPrompts) => {
    const { executor: existingExecutor } = get()
    
    // 如果已有执行器在运行，先取消
    if (existingExecutor) {
      existingExecutor.cancel()
    }

    // 创建执行记录
    const execution = await db.createExecution(workflow.id, initialInput)

    // 重置状态
    set({
      executionId: execution.id,
      status: 'running',
      currentNodeIndex: null,
      nodeStates: [],
      nodeOutputs: [],
      finalOutput: '',
      streamingContent: '',
      streamingNodeId: null,
      error: null,
      elapsedSeconds: 0,
    })

    // 清空节点结果 ID 映射
    nodeResultIds.clear()

    // 创建执行器
    const executor = new WorkflowExecutor({
      workflow,
      nodes,
      globalConfig,
      initialInput,
      settings,
      settingPrompts,
      onEvent: (event) => {
        // 异步处理事件，不阻塞执行器
        handleExecutionEvent(event, get, set).catch(console.error)
      },
    })

    set({ executor })

    // 执行
    try {
      const result = await executor.execute()
      
      // 更新数据库记录
      await db.updateExecution(execution.id, {
        status: executorStatusToDbStatus(result.status),
        final_output: result.output,
        variables_snapshot: executor.getContext().createSnapshot(),
        finished_at: new Date().toISOString(),
      })

      set({
        status: result.status,
        finalOutput: result.output || '',
        error: result.error || null,
        elapsedSeconds: result.elapsedSeconds,
        nodeStates: result.nodeStates,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // 更新数据库记录
      await db.updateExecution(execution.id, {
        status: 'failed',
        finished_at: new Date().toISOString(),
      })

      set({
        status: 'failed',
        error: errorMessage,
      })
    }
  },

  // 暂停执行
  pauseExecution: () => {
    const { executor } = get()
    if (executor) {
      executor.pause()
      set({ status: 'paused' })
    }
  },

  // 继续执行
  resumeExecution: () => {
    const { executor } = get()
    if (executor) {
      executor.resume()
      set({ status: 'running' })
    }
  },

  // 取消执行
  cancelExecution: () => {
    const { executor, executionId } = get()
    if (executor) {
      executor.cancel()
      set({ status: 'cancelled' })
      
      // 更新数据库记录
      if (executionId) {
        db.updateExecution(executionId, {
          status: 'cancelled',
          finished_at: new Date().toISOString(),
        })
      }
    }
  },

  // 修改节点输出（人工干预）
  modifyNodeOutput: (nodeId, newOutput) => {
    const { executor, nodeOutputs } = get()
    if (executor) {
      try {
        executor.modifyNodeOutput(nodeId, newOutput)
        
        // 更新 UI 显示
        set({
          nodeOutputs: nodeOutputs.map(o =>
            o.nodeId === nodeId ? { ...o, output: newOutput } : o
          ),
        })
      } catch (error) {
        console.error('修改节点输出失败:', error)
      }
    }
  },

  // 重置状态
  reset: () => {
    const { executor } = get()
    if (executor) {
      executor.cancel()
    }
    
    set({
      executor: null,
      status: 'idle',
      executionId: null,
      currentNodeIndex: null,
      nodeStates: [],
      nodeOutputs: [],
      finalOutput: '',
      streamingContent: '',
      streamingNodeId: null,
      error: null,
      elapsedSeconds: 0,
    })
  },
}))

// 节点结果 ID 映射（用于追踪数据库记录）
const nodeResultIds: Map<string, string> = new Map()

// 处理执行事件
async function handleExecutionEvent(
  event: ExecutionEvent,
  get: () => ExecutionState,
  set: (state: Partial<ExecutionState>) => void
) {
  const { nodeOutputs, executionId } = get()

  switch (event.type) {
    case 'node_started': {
      // 节点开始执行
      set({
        currentNodeIndex: nodeOutputs.length,
        streamingContent: '',
        streamingNodeId: event.nodeId || null,
        nodeOutputs: [
          ...nodeOutputs,
          {
            nodeId: event.nodeId!,
            nodeName: event.nodeName!,
            nodeType: event.nodeType!,
            output: '',
            isRunning: true,
            isStreaming: false,
          },
        ],
      })
      
      // 保存节点结果到数据库
      if (executionId && event.nodeId) {
        try {
          const nodeResult = await db.createNodeResult(executionId, event.nodeId)
          nodeResultIds.set(event.nodeId, nodeResult.id)
        } catch (error) {
          console.error('保存节点结果失败:', error)
        }
      }
      break
    }

    case 'node_streaming':
      // 流式输出更新
      set({
        streamingContent: event.content || '',
        nodeOutputs: nodeOutputs.map(o =>
          o.nodeId === event.nodeId
            ? { ...o, output: event.content || '', isStreaming: true }
            : o
        ),
      })
      break

    case 'node_completed': {
      // 节点执行完成
      set({
        streamingContent: '',
        streamingNodeId: null,
        nodeOutputs: nodeOutputs.map(o =>
          o.nodeId === event.nodeId
            ? { ...o, output: event.content || '', isRunning: false, isStreaming: false }
            : o
        ),
      })
      
      // 更新数据库中的节点结果
      if (event.nodeId) {
        const resultId = nodeResultIds.get(event.nodeId)
        if (resultId) {
          try {
            await db.updateNodeResult(resultId, {
              output: event.content || '',
              status: 'completed',
              finished_at: new Date().toISOString(),
            })
          } catch (error) {
            console.error('更新节点结果失败:', error)
          }
        }
      }
      break
    }

    case 'node_failed': {
      // 节点执行失败
      set({
        streamingContent: '',
        streamingNodeId: null,
        error: event.error || '节点执行失败',
        nodeOutputs: nodeOutputs.map(o =>
          o.nodeId === event.nodeId
            ? { ...o, output: `错误: ${event.error}`, isRunning: false, isStreaming: false }
            : o
        ),
      })
      
      // 更新数据库中的节点结果
      if (event.nodeId) {
        const resultId = nodeResultIds.get(event.nodeId)
        if (resultId) {
          try {
            await db.updateNodeResult(resultId, {
              output: `错误: ${event.error}`,
              status: 'failed',
              finished_at: new Date().toISOString(),
            })
          } catch (error) {
            console.error('更新节点结果失败:', error)
          }
        }
      }
      break
    }

    case 'node_skipped': {
      // 节点被跳过
      set({
        nodeOutputs: nodeOutputs.map(o =>
          o.nodeId === event.nodeId
            ? { ...o, output: '(已跳过)', isRunning: false, isStreaming: false }
            : o
        ),
      })
      break
    }

    case 'execution_paused':
      set({ status: 'paused' })
      break

    case 'execution_resumed':
      set({ status: 'running' })
      break

    case 'execution_completed':
      // 清空节点结果 ID 映射
      nodeResultIds.clear()
      set({
        status: 'completed',
        currentNodeIndex: null,
        streamingContent: '',
        streamingNodeId: null,
      })
      break

    case 'execution_failed':
      nodeResultIds.clear()
      set({
        status: 'failed',
        error: event.error || '执行失败',
        currentNodeIndex: null,
        streamingContent: '',
        streamingNodeId: null,
      })
      break

    case 'execution_cancelled':
      nodeResultIds.clear()
      set({
        status: 'cancelled',
        currentNodeIndex: null,
        streamingContent: '',
        streamingNodeId: null,
      })
      break

    case 'execution_timeout':
      nodeResultIds.clear()
      set({
        status: 'timeout',
        error: '执行超时',
        currentNodeIndex: null,
        streamingContent: '',
        streamingNodeId: null,
      })
      break
  }
}

