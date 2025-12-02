// 执行上下文 - 管理执行过程中的变量、对话历史等

import type { WorkflowNode, AIChatConfig } from '@/types'
import type { Message } from '@/lib/ai/types'

// 节点执行状态
export interface NodeExecutionState {
  nodeId: string
  nodeName: string
  nodeType: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  input?: string
  output?: string
  error?: string
  startedAt?: Date
  finishedAt?: Date
}

// 执行上下文类
export class ExecutionContext {
  // 变量存储
  private variables: Map<string, string> = new Map()
  
  // 对话历史（每个节点的对话历史）
  private conversationHistory: Map<string, Message[]> = new Map()
  
  // 上一个节点的输出
  private previousOutput: string = ''
  
  // 初始输入
  private initialInput: string = ''
  
  // 节点执行状态列表
  private nodeStates: Map<string, NodeExecutionState> = new Map()
  
  // 循环计数器（用于循环节点）
  private loopCounters: Map<string, number> = new Map()
  
  // 最大循环次数
  private maxLoopCount: number = 10
  
  // 超时时间（秒）
  private timeoutSeconds: number = 300
  
  // 执行开始时间
  private startTime: Date = new Date()

  constructor(options?: {
    initialInput?: string
    maxLoopCount?: number
    timeoutSeconds?: number
  }) {
    if (options?.initialInput) {
      this.initialInput = options.initialInput
      this.previousOutput = options.initialInput
    }
    if (options?.maxLoopCount) {
      this.maxLoopCount = options.maxLoopCount
    }
    if (options?.timeoutSeconds) {
      this.timeoutSeconds = options.timeoutSeconds
    }
  }

  // ========== 变量操作 ==========

  /**
   * 设置变量
   */
  setVariable(name: string, value: string): void {
    this.variables.set(name, value)
  }

  /**
   * 获取变量
   */
  getVariable(name: string): string | undefined {
    return this.variables.get(name)
  }

  /**
   * 获取所有变量
   */
  getAllVariables(): Record<string, string> {
    const result: Record<string, string> = {}
    this.variables.forEach((value, key) => {
      result[key] = value
    })
    return result
  }

  /**
   * 变量插值 - 替换 {{变量名}} 格式
   */
  interpolate(template: string): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const trimmedName = varName.trim()
      
      // 特殊变量
      if (trimmedName === 'input' || trimmedName === '输入') {
        return this.initialInput
      }
      if (trimmedName === 'previous' || trimmedName === '上一个输出') {
        return this.previousOutput
      }
      
      // 普通变量
      return this.variables.get(trimmedName) ?? match
    })
  }

  // ========== 对话历史操作 ==========

  /**
   * 添加消息到节点的对话历史
   */
  addToHistory(nodeId: string, message: Message): void {
    const history = this.conversationHistory.get(nodeId) || []
    history.push(message)
    this.conversationHistory.set(nodeId, history)
  }

  /**
   * 获取节点的对话历史
   */
  getHistory(nodeId: string, limit?: number): Message[] {
    const history = this.conversationHistory.get(nodeId) || []
    if (limit && limit > 0) {
      return history.slice(-limit)
    }
    return history
  }

  /**
   * 清空节点的对话历史
   */
  clearHistory(nodeId: string): void {
    this.conversationHistory.delete(nodeId)
  }

  // ========== 输出操作 ==========

  /**
   * 设置上一个节点的输出
   */
  setPreviousOutput(output: string): void {
    this.previousOutput = output
  }

  /**
   * 获取上一个节点的输出
   */
  getPreviousOutput(): string {
    return this.previousOutput
  }

  /**
   * 获取初始输入
   */
  getInitialInput(): string {
    return this.initialInput
  }

  // ========== 节点状态操作 ==========

  /**
   * 初始化节点状态
   */
  initNodeState(node: WorkflowNode): void {
    this.nodeStates.set(node.id, {
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      status: 'pending',
    })
  }

  /**
   * 更新节点状态
   */
  updateNodeState(nodeId: string, updates: Partial<NodeExecutionState>): void {
    const current = this.nodeStates.get(nodeId)
    if (current) {
      this.nodeStates.set(nodeId, { ...current, ...updates })
    }
  }

  /**
   * 获取节点状态
   */
  getNodeState(nodeId: string): NodeExecutionState | undefined {
    return this.nodeStates.get(nodeId)
  }

  /**
   * 获取所有节点状态
   */
  getAllNodeStates(): NodeExecutionState[] {
    return Array.from(this.nodeStates.values())
  }

  // ========== 循环控制 ==========

  /**
   * 增加循环计数
   */
  incrementLoopCount(nodeId: string): number {
    const current = this.loopCounters.get(nodeId) || 0
    const newCount = current + 1
    this.loopCounters.set(nodeId, newCount)
    return newCount
  }

  /**
   * 获取循环计数
   */
  getLoopCount(nodeId: string): number {
    return this.loopCounters.get(nodeId) || 0
  }

  /**
   * 重置循环计数
   */
  resetLoopCount(nodeId: string): void {
    this.loopCounters.delete(nodeId)
  }

  /**
   * 检查是否超过最大循环次数
   */
  isLoopLimitReached(nodeId: string): boolean {
    return this.getLoopCount(nodeId) >= this.maxLoopCount
  }

  // ========== 超时检查 ==========

  /**
   * 检查是否超时
   */
  isTimeout(): boolean {
    const elapsed = (new Date().getTime() - this.startTime.getTime()) / 1000
    return elapsed >= this.timeoutSeconds
  }

  /**
   * 获取已用时间（秒）
   */
  getElapsedSeconds(): number {
    return (new Date().getTime() - this.startTime.getTime()) / 1000
  }

  // ========== 输入解析 ==========

  /**
   * 根据节点配置获取输入
   */
  getNodeInput(node: WorkflowNode): string {
    const config = node.config as AIChatConfig

    switch (config.input_source) {
      case 'previous':
        return this.previousOutput
      case 'variable':
        return config.input_variable 
          ? (this.getVariable(config.input_variable) ?? '') 
          : ''
      case 'custom':
        return config.custom_input 
          ? this.interpolate(config.custom_input) 
          : ''
      default:
        return this.previousOutput
    }
  }

  // ========== 快照 ==========

  /**
   * 创建上下文快照（用于保存到数据库）
   */
  createSnapshot(): Record<string, unknown> {
    return {
      variables: this.getAllVariables(),
      previousOutput: this.previousOutput,
      initialInput: this.initialInput,
      nodeStates: this.getAllNodeStates(),
      loopCounters: Object.fromEntries(this.loopCounters),
      elapsedSeconds: this.getElapsedSeconds(),
    }
  }

  /**
   * 从快照恢复上下文
   */
  static fromSnapshot(snapshot: Record<string, unknown>): ExecutionContext {
    const ctx = new ExecutionContext({
      initialInput: snapshot.initialInput as string,
    })

    // 恢复变量
    const variables = snapshot.variables as Record<string, string>
    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        ctx.setVariable(key, value)
      })
    }

    // 恢复上一个输出
    if (snapshot.previousOutput) {
      ctx.setPreviousOutput(snapshot.previousOutput as string)
    }

    // 恢复循环计数
    const loopCounters = snapshot.loopCounters as Record<string, number>
    if (loopCounters) {
      Object.entries(loopCounters).forEach(([key, value]) => {
        ctx.loopCounters.set(key, value)
      })
    }

    return ctx
  }
}

