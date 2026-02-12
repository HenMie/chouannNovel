// 执行引擎核心 - 工作流执行逻辑

import type {
  WorkflowNode,
  Workflow,
  GlobalConfig,
  AIChatConfig,
  StartConfig,
  VarUpdateConfig,
  TextExtractConfig,
  TextConcatConfig,
  ConditionConfig,
  LoopConfig,
  LoopStartConfig,
  ParallelStartConfig,
  ConditionIfConfig,
  ExecutionStatus,
  Setting,
  SettingPrompt,
  ResolvedNodeConfig,
} from '@/types'
import type { Message } from '@/lib/ai/types'
import { chatStream } from '@/lib/ai'
import { logError } from '@/lib/errors'
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
  resolvedConfig?: ResolvedNodeConfig  // 解析后的节点配置
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
  settings?: Setting[]           // 项目设定
  settingPrompts?: SettingPrompt[] // 设定注入提示词模板
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
  
  // 设定库
  private settings: Setting[] = []
  private settingPrompts: SettingPrompt[] = []
  
  // 暂停控制
  private pausePromise: Promise<void> | null = null
  private pauseResolve: (() => void) | null = null
  
  // 取消控制
  private isCancelled: boolean = false
  
  // 流式输出 AbortController
  private abortController: AbortController | null = null
  
  // 流程控制
  private shouldEnd: boolean = false        // 是否结束工作流
  private jumpTarget: string | null = null  // 跳转目标节点 ID
  private loopStartNode: string | null = null  // 当前循环的起始节点 ID
  private loopStartIndex: number = -1       // 当前循环的起始索引

  constructor(options: ExecutorOptions) {
    this.workflow = options.workflow
    this.nodes = options.nodes
    this.globalConfig = options.globalConfig
    this.onEvent = options.onEvent
    this.settings = options.settings || []
    this.settingPrompts = options.settingPrompts || []
    this.context = new ExecutionContext({
      initialInput: options.initialInput,
      maxLoopCount: this.workflow.loop_max_count,
      timeoutSeconds: this.workflow.timeout_seconds,
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
          
          // 检查是否需要结束工作流
          if (this.shouldEnd) {
            this.status = 'completed'
            this.emit({ type: 'execution_completed' })
            break
          }
          
          // 检查是否需要跳转
          if (this.jumpTarget) {
            const targetIndex = this.nodes.findIndex(n => n.id === this.jumpTarget)
            if (targetIndex === -1) {
              throw new Error(`跳转目标节点 ${this.jumpTarget} 不存在`)
            }
            this.currentNodeIndex = targetIndex
            this.jumpTarget = null
          } else {
            // 正常前进到下一个节点
            this.currentNodeIndex++
            
            // 检查是否是循环的最后一个节点（需要回到循环开始）
            if (this.loopStartNode && this.currentNodeIndex >= this.nodes.length) {
              // 回到循环节点检查条件
              this.currentNodeIndex = this.loopStartIndex
              this.loopStartNode = null
            }
          }
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
        output: this.context.getLastOutput(),
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
    let resolvedConfig: ResolvedNodeConfig = {}

    // 根据节点类型执行
    switch (node.type) {
      case 'start':
        output = await this.executeStartNode(node)
        break
      case 'output':
        output = await this.executeOutputNode(node)
        break
      case 'ai_chat': {
        const result = await this.executeAIChatNode(node)
        output = result.output
        resolvedConfig = result.resolvedConfig
        break
      }
      case 'var_update': {
        const result = await this.executeVarUpdateNode(node)
        output = result.output
        resolvedConfig = result.resolvedConfig
        break
      }
      case 'text_extract': {
        const result = await this.executeTextExtractNode(node)
        output = result.output
        resolvedConfig = result.resolvedConfig
        break
      }
      case 'text_concat': {
        const result = await this.executeTextConcatNode(node)
        output = result.output
        resolvedConfig = result.resolvedConfig
        break
      }
      case 'condition': {
        const result = await this.executeConditionNode(node)
        output = result.output
        resolvedConfig = result.resolvedConfig
        break
      }
      case 'loop': {
        const result = await this.executeLoopNode(node)
        output = result.output
        resolvedConfig = result.resolvedConfig
        break
      }
      // 新的块结构节点
      case 'loop_start': {
        const result = await this.executeLoopStartNode(node)
        output = result.output
        resolvedConfig = result.resolvedConfig
        break
      }
      case 'loop_end':
        output = await this.executeLoopEndNode(node)
        break
      case 'parallel_start':
        output = await this.executeParallelStartNode(node)
        break
      case 'parallel_end':
        output = await this.executeParallelEndNode(node)
        break
      case 'condition_if': {
        const result = await this.executeConditionIfNode(node)
        output = result.output
        resolvedConfig = result.resolvedConfig
        break
      }
      case 'condition_else':
        output = await this.executeConditionElseNode(node)
        break
      case 'condition_end':
        output = await this.executeConditionEndNode(node)
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

    // 更新节点输出（使用节点ID，支持 {{@nodeId}} 引用）
    this.context.setNodeOutput(output, node.id)

    this.emit({
      type: 'node_completed',
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      content: output,
      resolvedConfig,
    })
  }

  /**
   * 执行输入节点
   */
  /**
   * 执行开始流程节点
   * 1. 将用户输入保存到"用户问题"变量
   * 2. 初始化自定义全局变量
   */
  private async executeStartNode(node: WorkflowNode): Promise<string> {
    const config = node.config as StartConfig
    const input = this.context.getInitialInput()
    
    // 如果没有输入，使用默认值
    const value = (!input && config.default_value) ? config.default_value : input
    
    // 将用户输入保存到固定变量"用户问题"中
    this.context.setVariable('用户问题', value)
    
    // 初始化自定义全局变量（使用默认值）
    if (config.custom_variables) {
      for (const variable of config.custom_variables) {
        // 默认值支持变量插值
        const defaultValue = this.context.interpolate(variable.default_value)
        this.context.setVariable(variable.name, defaultValue)
      }
    }
    
    return value
  }

  /**
   * 执行输出节点
   */
  private async executeOutputNode(_node: WorkflowNode): Promise<string> {
    // 输出节点直接返回最后一个节点的输出
    return this.context.getLastOutput()
  }

  /**
   * 生成设定注入内容
   */
  private generateSettingsInjection(settingIds: string[]): string {
    if (!settingIds || settingIds.length === 0) {
      return ''
    }

    // 获取选中的设定，只选择启用的
    const selectedSettings = this.settings.filter(
      (s) => settingIds.includes(s.id) && s.enabled
    )

    if (selectedSettings.length === 0) {
      return ''
    }

    // 按分类分组
    const settingsByCategory: Record<string, Setting[]> = {}
    selectedSettings.forEach((s) => {
      if (!settingsByCategory[s.category]) {
        settingsByCategory[s.category] = []
      }
      settingsByCategory[s.category].push(s)
    })

    // 默认模板
    const defaultTemplates: Record<string, string> = {
      character: '【角色设定】\n{{items}}',
      worldview: '【世界观设定】\n{{items}}',
      style: '【笔触风格】\n{{items}}',
      outline: '【故事大纲】\n{{items}}',
    }

    // 生成各分类的注入内容
    const parts: string[] = []

    for (const [category, settings] of Object.entries(settingsByCategory)) {
      // 查找该分类的自定义模板
      const promptTemplate = this.settingPrompts.find(
        (p) => p.category === category && p.enabled
      )

      let template = promptTemplate?.prompt_template || defaultTemplates[category]

      // 生成设定项内容
      const items = settings.map((s) => `${s.name}：${s.content}`).join('\n\n')

      // 简单的模板替换（支持 {{items}} 和 {{#each items}}...{{/each}}）
      if (template.includes('{{#each items}}')) {
        // Handlebars 风格模板
        const eachMatch = template.match(/\{\{#each items\}\}([\s\S]*?)\{\{\/each\}\}/)
        if (eachMatch) {
          const itemTemplate = eachMatch[1]
          const renderedItems = settings.map((s) => {
            return itemTemplate
              .replace(/\{\{name\}\}/g, s.name)
              .replace(/\{\{content\}\}/g, s.content)
          }).join('')
          template = template.replace(eachMatch[0], renderedItems)
        }
      } else {
        // 简单替换
        template = template.replace(/\{\{items\}\}/g, items)
      }

      parts.push(template)
    }

    return parts.join('\n\n')
  }

  /**
   * 执行 AI 对话节点
   */
  private async executeAIChatNode(node: WorkflowNode): Promise<{ output: string; resolvedConfig: ResolvedNodeConfig }> {
    const config = node.config as AIChatConfig
    const legacyConfig = node.config as any  // 兼容旧版配置
    
    // 检查 API 配置
    const providerConfig = this.globalConfig.ai_providers[config.provider]
    if (!providerConfig?.enabled || !providerConfig.api_key) {
      throw new Error(`AI 提供商 ${config.provider} 未配置或未启用`)
    }

    // 构建系统提示词（变量插值），兼容旧版 prompt 字段
    const systemPromptRaw = config.system_prompt ?? legacyConfig.prompt ?? ''
    let systemPrompt = systemPromptRaw ? this.context.interpolate(systemPromptRaw) : ''

    // 注入设定到系统提示词
    const settingsInjection = this.generateSettingsInjection(config.setting_ids || [])
    if (settingsInjection) {
      systemPrompt = settingsInjection + (systemPrompt ? '\n\n' + systemPrompt : '')
    }

    // 构建用户问题（变量插值）
    const userPrompt = config.user_prompt ? this.context.interpolate(config.user_prompt) : ''
    
    // 更新节点输入（显示用户问题）
    this.context.updateNodeState(node.id, { input: userPrompt })

    // 构建消息列表
    const messages: Message[] = []
    
    // 添加对话历史
    if (config.enable_history && config.history_count > 0) {
      const history = this.context.getHistory(node.id, config.history_count)
      messages.push(...history)
    }

    // 添加系统消息
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }
    
    // 添加用户消息
    if (userPrompt) {
      messages.push({ role: 'user', content: userPrompt })
    } else if (!systemPrompt) {
      throw new Error('AI 对话节点需要系统提示词或用户问题')
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
          // 传递 thinking/reasoning 配置
          thinkingConfig: {
            thinkingLevel: config.thinking_level,
            thinkingBudget: config.thinking_budget,
            effort: config.effort,
          },
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
      if (userPrompt) {
        this.context.addToHistory(node.id, { role: 'user', content: userPrompt })
      }
      this.context.addToHistory(node.id, { role: 'assistant', content: fullOutput })
    }

    // 获取使用的设定名称
    const settingNames = (config.setting_ids || [])
      .map(id => this.settings.find(s => s.id === id)?.name)
      .filter((name): name is string => !!name)

    return {
      output: fullOutput,
      resolvedConfig: {
        // 基本配置
        provider: config.provider,
        model: config.model,
        // 提示词
        systemPrompt,
        userPrompt,
        // 高级设置
        temperature: config.temperature,
        maxTokens: config.max_tokens,
        topP: config.top_p,
        // 对话历史
        enableHistory: config.enable_history,
        historyCount: config.history_count,
        // 使用的设定
        settingNames: settingNames.length > 0 ? settingNames : undefined,
      },
    }
  }

  /**
   * 执行更新变量节点
   * 更新已定义的全局变量的值
   */
  private async executeVarUpdateNode(node: WorkflowNode): Promise<{ output: string; resolvedConfig: ResolvedNodeConfig }> {
    const config = node.config as VarUpdateConfig
    
    // 检查变量是否存在
    const existingValue = this.context.getVariable(config.variable_name)
    if (existingValue === undefined) {
      throw new Error(`变量 "${config.variable_name}" 未定义。请先在开始节点中定义此变量。`)
    }
    
    // 使用变量插值处理新值
    const newValue = this.context.interpolate(config.value_template)
    
    // 更新变量
    this.context.setVariable(config.variable_name, newValue)
    
    return {
      output: newValue,
      resolvedConfig: {
        variableName: config.variable_name,
        variableValue: newValue,
      },
    }
  }

  /**
   * 执行文本提取节点
   */
  private async executeTextExtractNode(node: WorkflowNode): Promise<{ output: string; resolvedConfig: ResolvedNodeConfig }> {
    const config = node.config as TextExtractConfig
    
    // 获取输入
    let input: string = ''
    if (config.input_variable) {
      // 根据输入模式处理
      if (config.input_mode === 'manual') {
        // 手动输入模式：支持变量插值
        input = this.context.interpolate(config.input_variable)
      } else {
        // 变量引用模式（默认）：优先从节点输出中获取
        input = this.context.getNodeOutput(config.input_variable) 
          ?? this.context.getVariable(config.input_variable) 
          ?? ''
      }
    }
    
    // 更新节点输入状态
    this.context.updateNodeState(node.id, { input })
    
    let result: string = ''
    
    switch (config.extract_mode) {
      case 'regex': {
        if (!config.regex_pattern) {
          throw new Error('正则表达式不能为空')
        }
        try {
          const regex = new RegExp(config.regex_pattern, 'g')
          const matches: string[] = []
          let match
          
          while ((match = regex.exec(input)) !== null) {
            // 如果有捕获组，使用捕获组的内容
            if (match.length > 1) {
              const groups = match.slice(1).filter(g => g !== undefined)
              matches.push(groups.join('\n'))
            } else {
              matches.push(match[0])
            }
          }
          
          result = matches.join('\n')
        } catch (e) {
          throw new Error(`正则表达式无效: ${e instanceof Error ? e.message : String(e)}`)
        }
        break
      }
      
      case 'start_end': {
        if (!config.start_marker) {
          throw new Error('起始标记不能为空')
        }
        
        const startIndex = input.indexOf(config.start_marker)
        if (startIndex === -1) {
          result = ''
          break
        }
        
        const contentStart = startIndex + config.start_marker.length
        
        // 如果没有结束标记，提取到末尾
        if (!config.end_marker) {
          result = input.slice(contentStart)
        } else {
          const endIndex = input.indexOf(config.end_marker, contentStart)
          if (endIndex === -1) {
            // 结束标记不存在，提取到末尾
            result = input.slice(contentStart)
          } else {
            result = input.slice(contentStart, endIndex)
          }
        }
        break
      }
      
      case 'json_path': {
        if (!config.json_path) {
          throw new Error('JSON 路径不能为空')
        }
        
        try {
          const json = JSON.parse(input)
          const value = this.getJsonPathValue(json, config.json_path)
          
          if (value === undefined) {
            result = ''
          } else if (typeof value === 'string') {
            result = value
          } else {
            result = JSON.stringify(value)
          }
        } catch (e) {
          throw new Error(`JSON 解析失败: ${e instanceof Error ? e.message : String(e)}`)
        }
        break
      }
      
      case 'md_to_text': {
        result = this.convertMarkdownToPlainText(input)
        break
      }
      
      default:
        throw new Error(`不支持的提取模式: ${config.extract_mode}`)
    }
    
    return {
      output: result.trim(),
      resolvedConfig: {
        inputText: input,
        extractMode: config.extract_mode,
        regexPattern: config.regex_pattern,
        startMarker: config.start_marker,
        endMarker: config.end_marker,
        jsonPath: config.json_path,
      },
    }
  }

  /**
   * 根据 JSON 路径获取值
   */
  private getJsonPathValue(obj: unknown, path: string): unknown {
    const parts = path.split(/\.|\[|\]/).filter(p => p !== '')
    let current: unknown = obj
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined
      }
      
      if (typeof current === 'object') {
        // 尝试作为数组索引解析
        const index = parseInt(part, 10)
        if (!isNaN(index) && Array.isArray(current)) {
          current = current[index]
        } else {
          current = (current as Record<string, unknown>)[part]
        }
      } else {
        return undefined
      }
    }
    
    return current
  }

  /**
   * 将 Markdown 文本转换为纯文本
   * 移除所有 Markdown 格式标记，保留纯文本内容
   */
  private convertMarkdownToPlainText(markdown: string): string {
    let text = markdown

    // 移除代码块（包括语言标识）
    text = text.replace(/```[\s\S]*?```/g, (match) => {
      // 提取代码块内的内容（去掉 ``` 和语言标识）
      const content = match.replace(/^```[^\n]*\n?/, '').replace(/\n?```$/, '')
      return content
    })

    // 移除行内代码的反引号，保留内容
    text = text.replace(/`([^`]+)`/g, '$1')

    // 移除图片，保留 alt 文本
    text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')

    // 移除链接，保留链接文本
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

    // 移除标题标记
    text = text.replace(/^#{1,6}\s+/gm, '')

    // 移除加粗标记
    text = text.replace(/\*\*([^*]+)\*\*/g, '$1')
    text = text.replace(/__([^_]+)__/g, '$1')

    // 移除斜体标记
    text = text.replace(/\*([^*]+)\*/g, '$1')
    text = text.replace(/_([^_]+)_/g, '$1')

    // 移除删除线标记
    text = text.replace(/~~([^~]+)~~/g, '$1')

    // 移除引用标记
    text = text.replace(/^>\s*/gm, '')

    // 移除无序列表标记
    text = text.replace(/^[\s]*[-*+]\s+/gm, '')

    // 移除有序列表标记
    text = text.replace(/^[\s]*\d+\.\s+/gm, '')

    // 移除水平线
    text = text.replace(/^[-*_]{3,}\s*$/gm, '')

    // 移除 HTML 标签
    text = text.replace(/<[^>]+>/g, '')

    // 移除转义字符的反斜杠
    text = text.replace(/\\([\\`*_{}[\]()#+\-.!])/g, '$1')

    // 将多个连续空行合并为一个
    text = text.replace(/\n{3,}/g, '\n\n')

    return text
  }

  /**
   * 执行文本拼接节点
   */
  private async executeTextConcatNode(node: WorkflowNode): Promise<{ output: string; resolvedConfig: ResolvedNodeConfig }> {
    const config = node.config as TextConcatConfig
    
    const parts: string[] = []
    
    for (const source of config.sources || []) {
      let value: string = ''
      
      // 支持新格式（mode）和旧格式（type）
      const isVariableMode = source.mode === 'variable' || source.type === 'variable'
      const isManualMode = source.mode === 'manual' || source.type === 'custom'
      
      if (isVariableMode && source.variable) {
        // 变量引用模式：优先从节点输出中获取
        value = this.context.getNodeOutput(source.variable) 
          ?? this.context.getVariable(source.variable) 
          ?? ''
      } else if (isManualMode) {
        // 手动输入模式：支持变量插值
        const content = source.manual ?? source.custom ?? ''
        value = content ? this.context.interpolate(content) : ''
      }
      
      parts.push(value)
    }
    
    const separator = config.separator ?? '\n'
    return {
      output: parts.join(separator),
      resolvedConfig: {
        resolvedSources: parts,
        separator: separator,
      },
    }
  }

  /**
   * 执行条件判断节点
   */
  private async executeConditionNode(node: WorkflowNode): Promise<{ output: string; resolvedConfig: ResolvedNodeConfig }> {
    const config = node.config as ConditionConfig
    
    // 获取输入（通过变量引用）
    let input: string = ''
    if (config.input_variable) {
      // 优先从节点输出中获取
      input = this.context.getNodeOutput(config.input_variable) 
        ?? this.context.getVariable(config.input_variable) 
        ?? ''
    }
    
    // 更新节点输入状态
    this.context.updateNodeState(node.id, { input })
    
    // 执行条件判断
    const result = await this.evaluateCondition(config, input)
    
    // 保存判断结果到变量，方便后续使用
    this.context.setVariable(`_condition_${node.id}`, result ? 'true' : 'false')
    
    // 获取要执行的动作
    const action = result ? config.true_action : config.false_action
    const target = result ? config.true_target : config.false_target
    
    // 根据动作决定下一步
    if (action === 'end') {
      // 结束工作流
      this.shouldEnd = true
    } else if (action === 'jump' && target) {
      // 跳转到指定节点
      this.jumpTarget = target
    }
    // action === 'next' 时不需要特殊处理，继续执行下一个节点
    
    return {
      output: result ? 'true' : 'false',
      resolvedConfig: {
        conditionInput: input,
        conditionType: config.condition_type,
        keywords: config.keywords,
        keywordMode: config.keyword_mode,
      },
    }
  }

  /**
   * 评估条件
   */
  private async evaluateCondition(config: ConditionConfig, input: string): Promise<boolean> {
    switch (config.condition_type) {
      case 'keyword': {
        const keywords = config.keywords || []
        if (keywords.length === 0) return true
        
        switch (config.keyword_mode) {
          case 'any':
            return keywords.some(k => input.includes(k))
          case 'all':
            return keywords.every(k => input.includes(k))
          case 'none':
            return keywords.every(k => !input.includes(k))
          default:
            return false
        }
      }
      
      case 'length': {
        const length = input.length
        const value = config.length_value || 0
        
        switch (config.length_operator) {
          case '>': return length > value
          case '<': return length < value
          case '=': return length === value
          case '>=': return length >= value
          case '<=': return length <= value
          default: return false
        }
      }
      
      case 'regex': {
        if (!config.regex_pattern) return false
        try {
          const regex = new RegExp(config.regex_pattern)
          return regex.test(input)
        } catch {
          return false
        }
      }
      
      case 'ai_judge': {
        // AI 智能判断
        if (!config.ai_provider || !config.ai_model || !config.ai_prompt) {
          throw new Error('AI 判断缺少必要配置')
        }
        
        const providerConfig = this.globalConfig.ai_providers[config.ai_provider as 'openai' | 'gemini' | 'claude']
        if (!providerConfig?.enabled || !providerConfig.api_key) {
          throw new Error(`AI 提供商 ${config.ai_provider} 未配置或未启用`)
        }
        
        // 构建判断提示词
        const prompt = `${config.ai_prompt}

请根据以上要求判断以下内容，只需要回复 true 或 false：

${input}`

        let response = ''
        await chatStream(
          {
            provider: config.ai_provider as 'openai' | 'gemini' | 'claude',
            model: config.ai_model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0,
            maxTokens: 10,
          },
          this.globalConfig,
          (chunk) => {
            if (!chunk.done) {
              response += chunk.content
            }
          }
        )
        
        // 解析 AI 回复
        const lowerResponse = response.toLowerCase().trim()
        return lowerResponse.includes('true') && !lowerResponse.includes('false')
      }
      
      default:
        return false
    }
  }

  /**
   * 执行循环节点
   */
  private async executeLoopNode(node: WorkflowNode): Promise<{ output: string; resolvedConfig: ResolvedNodeConfig }> {
    const config = node.config as LoopConfig
    
    // 获取当前循环次数
    const loopCount = this.context.getLoopCount(node.id)
    
    // 检查是否达到最大迭代次数
    if (loopCount >= config.max_iterations) {
      this.context.resetLoopCount(node.id)
      return {
        output: `循环结束（已达到最大迭代次数 ${config.max_iterations}）`,
        resolvedConfig: {
          loopType: config.condition_type,
          maxIterations: config.max_iterations,
          currentIteration: loopCount,
        },
      }
    }
    
    // 判断是否继续循环
    let shouldContinue = false
    
    if (config.condition_type === 'count') {
      // 固定次数循环，只要没到最大次数就继续
      shouldContinue = loopCount < config.max_iterations
    } else if (config.condition && loopCount > 0) {
      // 条件循环，第一次无条件执行，之后根据条件判断
      let input: string = ''
      if (config.condition.input_variable) {
        input = this.context.getNodeOutput(config.condition.input_variable) 
          ?? this.context.getVariable(config.condition.input_variable) 
          ?? ''
      }
      
      shouldContinue = await this.evaluateCondition(config.condition, input)
    } else {
      // 第一次执行
      shouldContinue = true
    }
    
    if (shouldContinue) {
      // 增加循环计数
      this.context.incrementLoopCount(node.id)
      
      // 设置循环开始位置（用于循环结束后回跳）
      this.loopStartNode = node.id
      this.loopStartIndex = this.currentNodeIndex
      
      return {
        output: `开始第 ${loopCount + 1} 次循环`,
        resolvedConfig: {
          loopType: config.condition_type,
          maxIterations: config.max_iterations,
          currentIteration: loopCount + 1,
        },
      }
    } else {
      // 循环结束
      this.context.resetLoopCount(node.id)
      return {
        output: `循环结束（条件不满足，共执行 ${loopCount} 次）`,
        resolvedConfig: {
          loopType: config.condition_type,
          maxIterations: config.max_iterations,
          currentIteration: loopCount,
        },
      }
    }
  }

  // ========== 新的块结构节点执行 ==========

  /**
   * 执行循环开始节点（新块结构）
   */
  private async executeLoopStartNode(node: WorkflowNode): Promise<{ output: string; resolvedConfig: ResolvedNodeConfig }> {
    const config = node.config as LoopStartConfig
    const blockId = node.block_id
    
    if (!blockId) {
      throw new Error('循环节点缺少 block_id')
    }
    
    // 获取当前循环次数
    const loopCount = this.context.getLoopCount(blockId)
    
    const makeConfig = (iteration: number): ResolvedNodeConfig => ({
      loopType: config.loop_type,
      maxIterations: config.max_iterations,
      currentIteration: iteration,
    })
    
    // 检查是否达到最大迭代次数
    if (loopCount >= config.max_iterations) {
      // 跳过整个循环块，直接跳到对应的 loop_end 之后
      const endNodeIndex = this.nodes.findIndex(
        n => n.type === 'loop_end' && n.block_id === blockId
      )
      if (endNodeIndex !== -1) {
        this.jumpTarget = this.nodes[endNodeIndex + 1]?.id ?? null
        if (!this.jumpTarget) {
          // 没有下一个节点，结束执行
          this.shouldEnd = true
        }
      }
      this.context.resetLoopCount(blockId)
      return {
        output: `循环结束（已达到最大迭代次数 ${config.max_iterations}）`,
        resolvedConfig: makeConfig(loopCount),
      }
    }
    
    // 判断是否继续循环
    let shouldContinue = false
    
    if (config.loop_type === 'count') {
      // 固定次数循环
      shouldContinue = loopCount < config.max_iterations
    } else if (loopCount > 0) {
      // 条件循环（第一次无条件执行）
      let input: string = ''
      if (config.condition_variable) {
        input = this.context.getNodeOutput(config.condition_variable) 
          ?? this.context.getVariable(config.condition_variable) 
          ?? ''
      }
      
      // 使用条件配置进行判断
      const conditionConfig: ConditionConfig = {
        input_variable: config.condition_variable,
        condition_type: config.condition_type || 'keyword',
        keywords: config.keywords,
        keyword_mode: config.keyword_mode,
        length_operator: config.length_operator,
        length_value: config.length_value,
        regex_pattern: config.regex_pattern,
        ai_prompt: config.ai_prompt,
        ai_provider: config.ai_provider,
        ai_model: config.ai_model,
        true_action: 'next',
        false_action: 'next',
      }
      
      shouldContinue = await this.evaluateCondition(conditionConfig, input)
    } else {
      // 第一次执行
      shouldContinue = true
    }
    
    if (shouldContinue) {
      // 增加循环计数
      this.context.incrementLoopCount(blockId)
      
      // 记录循环开始位置
      this.loopStartNode = node.id
      this.loopStartIndex = this.currentNodeIndex
      
      return {
        output: `开始第 ${loopCount + 1} 次循环`,
        resolvedConfig: makeConfig(loopCount + 1),
      }
    } else {
      // 跳过整个循环块
      const endNodeIndex = this.nodes.findIndex(
        n => n.type === 'loop_end' && n.block_id === blockId
      )
      if (endNodeIndex !== -1) {
        this.jumpTarget = this.nodes[endNodeIndex + 1]?.id ?? null
        if (!this.jumpTarget) {
          this.shouldEnd = true
        }
      }
      this.context.resetLoopCount(blockId)
      return {
        output: `循环结束（条件不满足，共执行 ${loopCount} 次）`,
        resolvedConfig: makeConfig(loopCount),
      }
    }
  }

  /**
   * 执行循环结束节点
   */
  private async executeLoopEndNode(node: WorkflowNode): Promise<string> {
    const blockId = node.block_id
    
    if (!blockId) {
      throw new Error('循环结束节点缺少 block_id')
    }
    
    // 找到对应的循环开始节点
    const startNodeIndex = this.nodes.findIndex(
      n => n.type === 'loop_start' && n.block_id === blockId
    )
    
    if (startNodeIndex === -1) {
      throw new Error('找不到对应的循环开始节点')
    }
    
    // 跳回循环开始节点，让它判断是否继续
    this.jumpTarget = this.nodes[startNodeIndex].id
    
    return '循环迭代完成'
  }

  /**
   * 执行并发开始节点
   */
  private async executeParallelStartNode(node: WorkflowNode): Promise<string> {
    const config = node.config as ParallelStartConfig
    const blockId = node.block_id
    
    if (!blockId) {
      throw new Error('并发节点缺少 block_id')
    }
    
    // 找到并发块内的所有节点（从 parallel_start 到 parallel_end 之间）
    const startIndex = this.currentNodeIndex
    const endIndex = this.nodes.findIndex(
      n => n.type === 'parallel_end' && n.block_id === blockId
    )
    
    if (endIndex === -1) {
      throw new Error('找不到对应的并发结束节点')
    }
    
    // 获取并发执行的节点（开始和结束之间的节点）
    const parallelNodes = this.nodes.slice(startIndex + 1, endIndex)
    
    if (parallelNodes.length === 0) {
      return '并发块为空'
    }
    
    // 保存当前输入，供所有并发节点使用
    const parallelInput = this.context.getLastOutput()
    this.context.setVariable(`_parallel_${blockId}_input`, parallelInput)
    
    // 并发执行所有节点
    const concurrency = config.concurrency || 3
    const retryCount = Math.max(0, config.retry_count ?? 3)
    const results: string[] = []
    
    // 按批次并发执行
    for (let i = 0; i < parallelNodes.length; i += concurrency) {
      const batch = parallelNodes.slice(i, i + concurrency)
      
      const batchResults = await Promise.all(
        batch.map(async (parallelNode) => {
          return this.executeParallelNodeWithRetry(parallelNode, retryCount)
        })
      )
      
      results.push(...batchResults)
    }
    
    // 保存并发结果
    if (config.output_mode === 'array') {
      this.context.setVariable(`_parallel_${blockId}_results`, JSON.stringify(results))
    } else {
      const separator = config.output_separator || '\n'
      this.context.setVariable(`_parallel_${blockId}_results`, results.join(separator))
    }
    
    // 跳过并发块内的节点（已经执行过了），直接跳到 parallel_end
    this.jumpTarget = this.nodes[endIndex].id
    
    return `并发执行 ${parallelNodes.length} 个任务完成`
  }

  /**
   * 并发节点执行（带重试）
   */
  private async executeParallelNodeWithRetry(node: WorkflowNode, retryCount: number): Promise<string> {
    let lastError: unknown = null

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        await this.executeNode(node)
        const nodeState = this.context.getNodeState(node.id)
        return nodeState?.output || ''
      } catch (error) {
        lastError = error
        const currentAttempt = attempt + 1
        const totalAttempt = retryCount + 1
        logError({
          error,
          context: `并发执行节点 ${node.name} 失败（第 ${currentAttempt}/${totalAttempt} 次）`,
        })

        if (attempt === retryCount) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          throw new Error(`并发节点 ${node.name} 执行失败（重试 ${retryCount} 次后仍失败）: ${errorMessage}`)
        }
      }
    }

    const fallbackMessage = lastError instanceof Error ? lastError.message : String(lastError)
    throw new Error(`并发节点 ${node.name} 执行失败: ${fallbackMessage}`)
  }

  /**
   * 执行并发结束节点
   */
  private async executeParallelEndNode(node: WorkflowNode): Promise<string> {
    const blockId = node.block_id
    
    if (!blockId) {
      throw new Error('并发结束节点缺少 block_id')
    }
    
    // 获取并发结果
    const results = this.context.getVariable(`_parallel_${blockId}_results`) || ''
    
    return results
  }

  /**
   * 执行条件分支开始节点
   */
  private async executeConditionIfNode(node: WorkflowNode): Promise<{ output: string; resolvedConfig: ResolvedNodeConfig }> {
    const config = node.config as ConditionIfConfig
    const blockId = node.block_id
    
    if (!blockId) {
      throw new Error('条件节点缺少 block_id')
    }
    
    // 获取输入（通过变量引用）
    let input: string = ''
    if (config.input_variable) {
      input = this.context.getNodeOutput(config.input_variable) 
        ?? this.context.getVariable(config.input_variable) 
        ?? ''
    }
    
    // 评估条件
    const conditionConfig: ConditionConfig = {
      input_variable: config.input_variable,
      condition_type: config.condition_type,
      keywords: config.keywords,
      keyword_mode: config.keyword_mode,
      length_operator: config.length_operator,
      length_value: config.length_value,
      regex_pattern: config.regex_pattern,
      ai_prompt: config.ai_prompt,
      ai_provider: config.ai_provider,
      ai_model: config.ai_model,
      true_action: 'next',
      false_action: 'next',
    }
    
    const result = await this.evaluateCondition(conditionConfig, input)
    
    // 保存条件结果
    this.context.setVariable(`_condition_${blockId}_result`, result ? 'true' : 'false')
    
    if (!result) {
      // 条件为 false，跳到 else 或 end_if
      const elseNodeIndex = this.nodes.findIndex(
        n => n.type === 'condition_else' && n.block_id === blockId
      )
      
      if (elseNodeIndex !== -1) {
        // 有 else 分支，跳到 else
        this.jumpTarget = this.nodes[elseNodeIndex].id
      } else {
        // 没有 else，跳到 end_if
        const endNodeIndex = this.nodes.findIndex(
          n => n.type === 'condition_end' && n.block_id === blockId
        )
        if (endNodeIndex !== -1) {
          this.jumpTarget = this.nodes[endNodeIndex].id
        }
      }
    }
    
    return {
      output: result ? 'true' : 'false',
      resolvedConfig: {
        conditionInput: input,
        conditionType: config.condition_type,
        keywords: config.keywords,
        keywordMode: config.keyword_mode,
      },
    }
  }

  /**
   * 执行条件分支 else 节点
   */
  private async executeConditionElseNode(node: WorkflowNode): Promise<string> {
    const blockId = node.block_id
    
    if (!blockId) {
      throw new Error('else 节点缺少 block_id')
    }
    
    // 检查条件结果
    const conditionResult = this.context.getVariable(`_condition_${blockId}_result`)
    
    if (conditionResult === 'true') {
      // 如果 if 条件为 true，跳过 else 分支，跳到 end_if
      const endNodeIndex = this.nodes.findIndex(
        n => n.type === 'condition_end' && n.block_id === blockId
      )
      if (endNodeIndex !== -1) {
        this.jumpTarget = this.nodes[endNodeIndex].id
      }
    }
    // 否则继续执行 else 分支的内容
    
    return 'else 分支'
  }

  /**
   * 执行条件分支结束节点
   */
  private async executeConditionEndNode(_node: WorkflowNode): Promise<string> {
    // 条件块结束，不需要特殊处理
    return '条件分支结束'
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
    
    // 同时更新节点输出映射（使用节点ID）
    if (nodeState.nodeId) {
      this.context.setNodeOutput(newOutput, nodeState.nodeId)
      this.context.setVariable(nodeState.nodeId, newOutput)
    }
    
    // 如果是最后一个完成的节点，更新 lastOutput
    const completedNodes = this.context.getAllNodeStates()
      .filter(s => s.status === 'completed')
    
    const lastCompleted = completedNodes[completedNodes.length - 1]
    if (lastCompleted?.nodeId === nodeId) {
      this.context.setLastOutput(newOutput)
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
