// 执行引擎核心 - 工作流执行逻辑

import type {
  WorkflowNode,
  Workflow,
  GlobalConfig,
  AIChatConfig,
  InputConfig,
  OutputConfig,
  VarSetConfig,
  VarGetConfig,
  ExecutionStatus,
} from '@/types'
import type { Message } from '@/lib/ai/types'
import { chatStream } from '@/lib/ai'
import { ExecutionContext, NodeExecutionState } from './context'

// 执行器状态
export type ExecutorStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'timeout'

// 执行事件类型
export type ExecutionEventType =
  | 'execution_started'
  | 'execution_paused'
  | 'execution_resumed'
  | 'execution_completed'
  | 'execution_failed'
  | 'execution_cancelled'
  | 'execution_timeout'
  | 'node_started'
  | 'node_streaming'
  | 'node_completed'
  | 'node_failed'
  | 'node_skipped'

// 执行事件
export interface ExecutionEvent {
  type: ExecutionEventType
  nodeId?: string
  nodeName?: string
  nodeType?: string
  content?: string
  error?: string
  timestamp: Date
}

// 执行事件监听器
export type ExecutionEventListener = (event: ExecutionEvent) => void

// 执行结果
export interface ExecutionResult {
  status: ExecutorStatus
  output?: string
  error?: string
  nodeStates: NodeExecutionState[]
  elapsedSeconds: number
}

// 执行器选项
export interface ExecutorOptions {
  workflow: Workflow
  nodes: WorkflowNode[]
  globalConfig: GlobalConfig
  initialInput?: string
  onEvent?: ExecutionEventListener
}

/**
 * 工作流执行器
 */
export class WorkflowExecutor {
  private workflow: Workflow
  private nodes: WorkflowNode[]
  private globalConfig: GlobalConfig
  private context: ExecutionContext
  private status: ExecutorStatus = 'idle'
  private currentNodeIndex: number = 0
  private onEvent?: ExecutionEventListener
  
  // 暂停控制
  private pausePromise: Promise<void> | null = null
  private pauseResolve: (() => void) | null = null
  
  // 取消控制
  private isCancelled: boolean = false
  
  // 流式输出 AbortController
  private abortController: AbortController | null = null

  constructor(options: ExecutorOptions) {
    this.workflow = options.workflow
    this.nodes = options.nodes
    this.globalConfig = options.globalConfig
    this.onEvent = options.onEvent
    this.context = new ExecutionContext({
      initialInput: options.initialInput,
      maxLoopCount: options.workflow.loop_max_count,
      timeoutSeconds: options.workflow.timeout_seconds,
    })
    
    // 初始化所有节点状态
    this.nodes.forEach(node => {
      this.context.initNodeState(node)
    })
  }

  /**
   * 发送执行事件
   */
  private emit(event: Omit<ExecutionEvent, 'timestamp'>): void {
    this.onEvent?.({ ...event, timestamp: new Date() })
  }

  /**
   * 获取当前状态
   */
  getStatus(): ExecutorStatus {
    return this.status
  }

  /**
   * 获取当前节点索引
   */
  getCurrentNodeIndex(): number {
    return this.currentNodeIndex
  }

  /**
   * 获取执行上下文
   */
  getContext(): ExecutionContext {
    return this.context
  }

  /**
   * 开始执行
   */
  async execute(): Promise<ExecutionResult> {
    if (this.status !== 'idle') {
      throw new Error('执行器已在运行中')
    }

    this.status = 'running'
    this.emit({ type: 'execution_started' })

    try {
      // 按顺序执行节点
      while (this.currentNodeIndex < this.nodes.length) {
        // 检查是否已取消
        if (this.isCancelled) {
          this.status = 'cancelled'
          this.emit({ type: 'execution_cancelled' })
          break
        }

        // 检查是否超时
        if (this.context.isTimeout()) {
          this.status = 'timeout'
          this.emit({ type: 'execution_timeout' })
          break
        }

        // 检查是否暂停
        if (this.pausePromise) {
          await this.pausePromise
        }

        const node = this.nodes[this.currentNodeIndex]
        
        try {
          await this.executeNode(node)
          this.currentNodeIndex++
        } catch (error) {
          // 节点执行失败
          const errorMessage = error instanceof Error ? error.message : String(error)
          this.context.updateNodeState(node.id, {
            status: 'failed',
            error: errorMessage,
            finishedAt: new Date(),
          })
          this.emit({
            type: 'node_failed',
            nodeId: node.id,
            nodeName: node.name,
            nodeType: node.type,
            error: errorMessage,
          })
          
          this.status = 'failed'
          this.emit({ type: 'execution_failed', error: errorMessage })
          
          return {
            status: this.status,
            error: errorMessage,
            nodeStates: this.context.getAllNodeStates(),
            elapsedSeconds: this.context.getElapsedSeconds(),
          }
        }
      }

      // 执行完成
      if (this.status === 'running') {
        this.status = 'completed'
        this.emit({ type: 'execution_completed' })
      }

      return {
        status: this.status,
        output: this.context.getPreviousOutput(),
        nodeStates: this.context.getAllNodeStates(),
        elapsedSeconds: this.context.getElapsedSeconds(),
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.status = 'failed'
      this.emit({ type: 'execution_failed', error: errorMessage })
      
      return {
        status: this.status,
        error: errorMessage,
        nodeStates: this.context.getAllNodeStates(),
        elapsedSeconds: this.context.getElapsedSeconds(),
      }
    }
  }

  /**
   * 执行单个节点
   */
  private async executeNode(node: WorkflowNode): Promise<void> {
    // 更新节点状态为运行中
    this.context.updateNodeState(node.id, {
      status: 'running',
      startedAt: new Date(),
    })
    
    this.emit({
      type: 'node_started',
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
    })

    let output: string = ''

    // 根据节点类型执行
    switch (node.type) {
      case 'input':
        output = await this.executeInputNode(node)
        break
      case 'output':
        output = await this.executeOutputNode(node)
        break
      case 'ai_chat':
        output = await this.executeAIChatNode(node)
        break
      case 'var_set':
        output = await this.executeVarSetNode(node)
        break
      case 'var_get':
        output = await this.executeVarGetNode(node)
        break
      default:
        // 未实现的节点类型，跳过
        this.context.updateNodeState(node.id, {
          status: 'skipped',
          finishedAt: new Date(),
        })
        this.emit({
          type: 'node_skipped',
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
        })
        return
    }

    // 更新节点状态为完成
    this.context.updateNodeState(node.id, {
      status: 'completed',
      output,
      finishedAt: new Date(),
    })

    // 更新上一个输出
    this.context.setPreviousOutput(output)

    this.emit({
      type: 'node_completed',
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      content: output,
    })
  }

  /**
   * 执行输入节点
   */
  private async executeInputNode(node: WorkflowNode): Promise<string> {
    const config = node.config as InputConfig
    const input = this.context.getInitialInput()
    
    // 如果没有输入，使用默认值
    if (!input && config.default_value) {
      return config.default_value
    }
    
    return input
  }

  /**
   * 执行输出节点
   */
  private async executeOutputNode(node: WorkflowNode): Promise<string> {
    // 输出节点直接返回上一个节点的输出
    return this.context.getPreviousOutput()
  }

  /**
   * 执行 AI 对话节点
   */
  private async executeAIChatNode(node: WorkflowNode): Promise<string> {
    const config = node.config as AIChatConfig
    
    // 检查 API 配置
    const providerConfig = this.globalConfig.ai_providers[config.provider]
    if (!providerConfig?.enabled || !providerConfig.api_key) {
      throw new Error(`AI 提供商 ${config.provider} 未配置或未启用`)
    }

    // 获取输入
    const input = this.context.getNodeInput(node)
    
    // 更新节点输入
    this.context.updateNodeState(node.id, { input })

    // 构建提示词（变量插值）
    const prompt = this.context.interpolate(config.prompt)

    // 构建消息列表
    const messages: Message[] = []
    
    // 添加对话历史
    if (config.enable_history && config.history_count > 0) {
      const history = this.context.getHistory(node.id, config.history_count)
      messages.push(...history)
    }

    // 添加当前消息
    // 如果 prompt 不为空，使用 prompt 作为系统消息，input 作为用户消息
    if (prompt) {
      messages.push({ role: 'system', content: prompt })
    }
    if (input) {
      messages.push({ role: 'user', content: input })
    } else if (!prompt) {
      throw new Error('AI 对话节点需要输入或提示词')
    }

    // 创建 AbortController
    this.abortController = new AbortController()

    // 流式输出
    let fullOutput = ''
    
    try {
      await chatStream(
        {
          provider: config.provider,
          model: config.model,
          messages,
          temperature: config.temperature,
          maxTokens: config.max_tokens,
          topP: config.top_p,
        },
        this.globalConfig,
        (chunk) => {
          if (this.isCancelled) {
            throw new Error('执行已取消')
          }
          
          if (!chunk.done) {
            fullOutput += chunk.content
            
            // 发送流式事件
            this.emit({
              type: 'node_streaming',
              nodeId: node.id,
              nodeName: node.name,
              nodeType: node.type,
              content: fullOutput,
            })
          }
        }
      )
    } finally {
      this.abortController = null
    }

    // 保存到对话历史
    if (config.enable_history) {
      if (input) {
        this.context.addToHistory(node.id, { role: 'user', content: input })
      }
      this.context.addToHistory(node.id, { role: 'assistant', content: fullOutput })
    }

    return fullOutput
  }

  /**
   * 执行变量设置节点
   */
  private async executeVarSetNode(node: WorkflowNode): Promise<string> {
    const config = node.config as VarSetConfig
    
    let value: string
    
    if (config.value_source === 'previous') {
      value = this.context.getPreviousOutput()
    } else {
      value = config.custom_value ? this.context.interpolate(config.custom_value) : ''
    }
    
    this.context.setVariable(config.variable_name, value)
    
    return value
  }

  /**
   * 执行变量读取节点
   */
  private async executeVarGetNode(node: WorkflowNode): Promise<string> {
    const config = node.config as VarGetConfig
    
    const value = this.context.getVariable(config.variable_name)
    
    if (value === undefined) {
      throw new Error(`变量 "${config.variable_name}" 不存在`)
    }
    
    return value
  }

  /**
   * 暂停执行
   */
  pause(): void {
    if (this.status !== 'running') return
    
    this.status = 'paused'
    this.pausePromise = new Promise(resolve => {
      this.pauseResolve = resolve
    })
    
    this.emit({ type: 'execution_paused' })
  }

  /**
   * 继续执行
   */
  resume(): void {
    if (this.status !== 'paused') return
    
    this.status = 'running'
    
    if (this.pauseResolve) {
      this.pauseResolve()
      this.pauseResolve = null
      this.pausePromise = null
    }
    
    this.emit({ type: 'execution_resumed' })
  }

  /**
   * 取消执行
   */
  cancel(): void {
    this.isCancelled = true
    
    // 如果正在暂停，先恢复
    if (this.status === 'paused') {
      this.resume()
    }
    
    // 中断流式请求
    if (this.abortController) {
      this.abortController.abort()
    }
  }

  /**
   * 修改节点输出（人工干预）
   */
  modifyNodeOutput(nodeId: string, newOutput: string): void {
    if (this.status !== 'paused') {
      throw new Error('只能在暂停状态下修改节点输出')
    }
    
    const nodeState = this.context.getNodeState(nodeId)
    if (!nodeState) {
      throw new Error(`节点 ${nodeId} 不存在`)
    }
    
    // 更新节点输出
    this.context.updateNodeState(nodeId, { output: newOutput })
    
    // 如果是最后一个完成的节点，更新 previousOutput
    const completedNodes = this.context.getAllNodeStates()
      .filter(s => s.status === 'completed')
    
    const lastCompleted = completedNodes[completedNodes.length - 1]
    if (lastCompleted?.nodeId === nodeId) {
      this.context.setPreviousOutput(newOutput)
    }
  }
}

/**
 * 将执行器状态转换为数据库状态
 */
export function executorStatusToDbStatus(status: ExecutorStatus): ExecutionStatus {
  switch (status) {
    case 'running':
      return 'running'
    case 'paused':
      return 'paused'
    case 'completed':
      return 'completed'
    case 'failed':
      return 'failed'
    case 'cancelled':
      return 'cancelled'
    case 'timeout':
      return 'timeout'
    default:
      return 'running'
  }
}

