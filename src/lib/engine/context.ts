// 执行上下文 - 管理执行过程中的变量、对话历史等

import type { WorkflowNode } from '@/types'
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
  
  // 节点输出存储（按节点ID索引）
  private nodeOutputs: Map<string, string> = new Map()
  
  // 最后一个节点的输出（用于工作流最终结果）
  private lastOutput: string = ''
  
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
      // 将初始输入也保存为变量 "用户问题"
      this.variables.set('用户问题', options.initialInput)
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
   * 支持以下变量类型（按优先级）：
   * 1. {{@node_id > 输出描述}} - 使用节点ID引用节点输出（推荐，改名不影响）
   * 2. {{变量名}} - 系统变量如 {{用户问题}}、全局变量等
   */
  interpolate(template: string): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      let trimmedName = varName.trim()
      
      // 检查是否是 @nodeId 格式的节点引用
      if (trimmedName.startsWith('@')) {
        // 解析 "@nodeId > 输出描述" 格式，提取节点ID
        let nodeId = trimmedName.slice(1) // 去掉 @
        if (nodeId.includes('>')) {
          nodeId = nodeId.split('>')[0].trim()
        }
        
        // 从节点输出中查找（按节点ID）
        const nodeOutput = this.nodeOutputs.get(nodeId)
        if (nodeOutput !== undefined) {
          return nodeOutput
        }
        
        // 未找到匹配，返回原始占位符
        return match
      }
      
      // 普通变量格式：尝试从变量中查找（包括系统变量和用户设置的变量）
      const variable = this.variables.get(trimmedName)
      if (variable !== undefined) {
        return variable
      }
      
      // 未找到匹配，返回原始占位符
      return match
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
   * 设置节点输出
   * @param output 输出内容
   * @param nodeId 节点ID（用于通过 {{@nodeId}} 引用）
   */
  setNodeOutput(output: string, nodeId: string): void {
    this.lastOutput = output
    this.nodeOutputs.set(nodeId, output)
  }

  /**
   * 获取指定节点的输出
   * @param nodeId 节点ID
   */
  getNodeOutput(nodeId: string): string | undefined {
    return this.nodeOutputs.get(nodeId)
  }

  /**
   * 获取最后一个节点的输出（用于工作流最终结果）
   */
  getLastOutput(): string {
    return this.lastOutput
  }

  /**
   * 设置最后一个节点的输出
   */
  setLastOutput(output: string): void {
    this.lastOutput = output
  }

  /**
   * 获取所有节点输出
   */
  getAllNodeOutputs(): Record<string, string> {
    const result: Record<string, string> = {}
    this.nodeOutputs.forEach((value, key) => {
      result[key] = value
    })
    return result
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
   * 使用精确变量引用方式
   */
  getNodeInput(node: WorkflowNode): string {
    // 通用的输入配置接口
    interface NodeInputConfig {
      input_variable?: string  // 节点ID（以 @ 开头）或变量名
      custom_input?: string
    }
    
    const config = node.config as NodeInputConfig

    // 优先使用指定的变量
    if (config.input_variable) {
      // 检查是否是节点ID引用（以 @ 开头）
      if (config.input_variable.startsWith('@')) {
        const nodeId = config.input_variable.slice(1)
        const nodeOutput = this.nodeOutputs.get(nodeId)
        if (nodeOutput !== undefined) {
          return nodeOutput
        }
      }
      // 尝试从变量中获取
      return this.getVariable(config.input_variable) ?? ''
    }
    
    // 如果有自定义输入，进行插值
    if (config.custom_input) {
      return this.interpolate(config.custom_input)
    }
    
    return ''
  }

  // ========== 快照 ==========

  /**
   * 创建上下文快照（用于保存到数据库）
   */
  createSnapshot(): Record<string, unknown> {
    return {
      variables: this.getAllVariables(),
      nodeOutputs: this.getAllNodeOutputs(),
      lastOutput: this.lastOutput,
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

    // 恢复节点输出
    const nodeOutputs = snapshot.nodeOutputs as Record<string, string>
    if (nodeOutputs) {
      Object.entries(nodeOutputs).forEach(([key, value]) => {
        ctx.nodeOutputs.set(key, value)
      })
    }

    // 恢复最后输出
    if (snapshot.lastOutput) {
      ctx.setLastOutput(snapshot.lastOutput as string)
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

