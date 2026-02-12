// 项目类型
export interface Project {
  id: string
  name: string
  description?: string
  created_at: string
  updated_at: string
}

// 工作流类型
export interface Workflow {
  id: string
  project_id: string
  name: string
  description?: string
  loop_max_count: number
  timeout_seconds: number
  created_at: string
  updated_at: string
}

// 节点类型枚举
export type NodeType =
  // 基础节点
  | 'start'
  | 'output'
  | 'ai_chat'
  | 'text_extract'
  | 'text_concat'
  | 'var_update'  // 更新全局变量
  // 控制结构 - 循环
  | 'loop_start'
  | 'loop_end'
  // 控制结构 - 并发
  | 'parallel_start'
  | 'parallel_end'
  // 控制结构 - 条件分支
  | 'condition_if'
  | 'condition_else'
  | 'condition_end'
  // 旧类型（向后兼容）
  | 'condition'
  | 'loop'
  | 'batch'

// 节点类型
export interface WorkflowNode {
  id: string
  workflow_id: string
  type: NodeType
  name: string
  config: NodeConfig
  order_index: number
  // 块结构支持
  block_id?: string          // 块 ID（用于关联开始和结束节点）
  parent_block_id?: string   // 父块 ID（用于嵌套结构）
  created_at: string
  updated_at: string
}

// 循环开始节点配置
export interface LoopStartConfig {
  loop_type: 'count' | 'condition'    // 循环类型：固定次数或条件循环
  max_iterations: number               // 最大迭代次数
  // 条件循环配置
  condition_variable?: string
  condition_type?: 'keyword' | 'length' | 'regex' | 'ai_judge'
  keywords?: string[]
  keyword_mode?: 'any' | 'all' | 'none'
  length_operator?: '>' | '<' | '=' | '>=' | '<='
  length_value?: number
  regex_pattern?: string
  ai_prompt?: string
  ai_provider?: string
  ai_model?: string
}

// 循环结束节点配置
export interface LoopEndConfig {
  // 引用对应的开始节点
  loop_start_id: string
}

// 并发开始节点配置
export interface ParallelStartConfig {
  concurrency: number              // 并发数限制
  output_mode: 'array' | 'concat'  // 输出模式
  output_separator?: string        // 输出分隔符
  retry_count?: number             // 失败重试次数（默认 3）
}

// 并发结束节点配置
export interface ParallelEndConfig {
  parallel_start_id: string
}

// 条件分支开始配置
export interface ConditionIfConfig {
  input_variable?: string
  condition_type: 'keyword' | 'length' | 'regex' | 'ai_judge'
  keywords?: string[]
  keyword_mode?: 'any' | 'all' | 'none'
  length_operator?: '>' | '<' | '=' | '>=' | '<='
  length_value?: number
  regex_pattern?: string
  ai_prompt?: string
  ai_provider?: string
  ai_model?: string
}

// 条件分支 else 配置
export interface ConditionElseConfig {
  condition_if_id: string
}

// 条件分支结束配置
export interface ConditionEndConfig {
  condition_if_id: string
}

// AI 提供商
export type AIProvider = 'openai' | 'gemini' | 'claude'

// AI 聊天节点配置
export interface AIChatConfig {
  provider: AIProvider
  model: string
  system_prompt: string      // 系统提示词 (system message)
  user_prompt: string        // 用户问题 (user message)
  system_prompt_mode?: 'manual' | 'variable'  // 系统提示词输入模式
  system_prompt_manual?: string               // 手动输入内容
  system_prompt_variable?: string             // 变量引用内容
  user_prompt_mode?: 'manual' | 'variable'    // 用户提示词输入模式
  user_prompt_manual?: string                 // 手动输入内容
  user_prompt_variable?: string               // 变量引用内容
  temperature?: number
  max_tokens?: number
  top_p?: number
  retry_count?: number
  /**
   * Gemini 3 Pro 使用的思考深度参数
   * - 'low': 浅层思考（快速响应）
   * - 'high': 深度思考（更深入推理）
   */
  thinking_level?: 'low' | 'high'
  /**
   * Gemini 2.5 系列使用的思考预算参数
   * - 0: 禁用思考（仅 2.5 Flash 支持）
   * - -1: 动态思考（模型自动决定）
   * - 正数: 指定 token 预算
   */
  thinking_budget?: number
  /**
   * Claude 的推理努力程度
   * - 'low': 低努力（快速响应）
   * - 'medium': 中等努力
   * - 'high': 高努力（深入推理，默认）
   */
  effort?: 'low' | 'medium' | 'high'
  enable_history: boolean
  history_count: number
  setting_ids: string[]
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

// 条件节点配置
export interface ConditionConfig {
  input_variable?: string
  condition_type: 'keyword' | 'length' | 'regex' | 'ai_judge'
  keywords?: string[]
  keyword_mode?: 'any' | 'all' | 'none'
  length_operator?: '>' | '<' | '=' | '>=' | '<='
  length_value?: number
  regex_pattern?: string
  ai_prompt?: string
  ai_provider?: string
  ai_model?: string
  true_action: 'next' | 'jump' | 'end'
  true_target?: string
  false_action: 'next' | 'jump' | 'end'
  false_target?: string
}

// 循环节点配置
export interface LoopConfig {
  max_iterations: number
  condition_type: 'count' | 'condition'
  condition?: ConditionConfig
}

// 批量执行节点配置
export interface BatchConfig {
  input_variable?: string
  split_mode: 'line' | 'separator' | 'json_array'
  separator?: string
  target_nodes: string[]
  concurrency: number
  output_mode: 'array' | 'concat'
  output_separator?: string
}

// 文本提取节点配置
export interface TextExtractConfig {
  input_variable?: string
  input_mode?: 'manual' | 'variable'  // 输入模式
  input_manual?: string               // 手动输入内容
  input_variable_ref?: string         // 变量引用内容
  extract_mode: 'regex' | 'start_end' | 'json_path' | 'md_to_text'
  regex_pattern?: string
  start_marker?: string
  end_marker?: string
  json_path?: string
}

// 文本拼接节点配置
export interface TextConcatConfig {
  sources: Array<{
    mode: 'manual' | 'variable'   // 输入模式
    manual?: string               // 手动输入内容
    variable?: string             // 变量引用内容
    // 兼容旧版字段
    type?: 'variable' | 'custom'
    custom?: string
  }>
  separator: string
}

// 自定义全局变量定义
export interface CustomVariable {
  name: string           // 变量名
  default_value: string  // 默认值
}

// 开始流程节点配置
export interface StartConfig {
  default_value?: string           // 用户输入默认值（用于测试）
  custom_variables?: CustomVariable[]  // 自定义全局变量
}

// 更新变量节点配置
export interface VarUpdateConfig {
  variable_name: string   // 要更新的变量名（必须是已定义的全局变量）
  value_template: string  // 新值模板，支持 {{变量}} 插值
  value_mode?: 'manual' | 'variable'  // 输入模式
  value_manual?: string               // 手动输入内容
  value_variable?: string             // 变量引用内容
}


// 输出节点配置
export interface OutputConfig {
  format: 'text' | 'markdown'
}

// 节点配置联合类型
export type NodeConfig =
  | AIChatConfig
  | ConditionConfig
  | LoopConfig
  | BatchConfig
  | TextExtractConfig
  | TextConcatConfig
  | VarUpdateConfig
  | StartConfig
  | OutputConfig
  // 新的控制结构配置
  | LoopStartConfig
  | LoopEndConfig
  | ParallelStartConfig
  | ParallelEndConfig
  | ConditionIfConfig
  | ConditionElseConfig
  | ConditionEndConfig
  | Record<string, unknown>

// 设定分类
export type SettingCategory = 'character' | 'worldview' | 'style' | 'outline'

// 设定库类型
export interface Setting {
  id: string
  project_id: string
  category: SettingCategory
  name: string
  content: string
  enabled: boolean
  parent_id: string | null
  order_index: number
  created_at: string
  updated_at: string
}

// 设定注入提示词
export interface SettingPrompt {
  id: string
  project_id: string
  category: SettingCategory
  prompt_template: string
  enabled: boolean
}

// 自定义模型配置
export interface CustomModel {
  id: string
  name: string
  enabled: boolean
}

// AI 提供商配置
export interface AIProviderConfig {
  api_key: string
  base_url?: string
  enabled: boolean
  // 启用的内置模型 ID 列表
  enabled_models?: string[]
  // 用户自定义模型
  custom_models?: CustomModel[]
}

// 全局配置
export interface GlobalConfig {
  id: number
  ai_providers: Record<AIProvider, AIProviderConfig>
  theme: 'light' | 'dark' | 'system'
  default_loop_max: number
  default_timeout: number
}

// 执行状态
export type ExecutionStatus =
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout'

// 执行记录
export interface Execution {
  id: string
  workflow_id: string
  status: ExecutionStatus
  input?: string
  final_output?: string
  variables_snapshot?: Record<string, unknown>
  started_at: string
  finished_at?: string
}

// 解析后的节点配置（用于历史记录显示）
export interface ResolvedNodeConfig {
  // === AI 对话节点 ===
  systemPrompt?: string     // 解析后的系统提示词
  userPrompt?: string       // 解析后的用户问题
  provider?: string         // AI 提供商
  model?: string            // 模型名称
  temperature?: number      // 温度
  maxTokens?: number        // 最大 token 数
  topP?: number             // Top P
  enableHistory?: boolean   // 是否启用对话历史
  historyCount?: number     // 对话历史轮数
  settingNames?: string[]   // 使用的设定名称列表
  
  // === 文本拼接节点 ===
  resolvedSources?: string[]  // 解析后的各个来源值
  separator?: string          // 分隔符
  
  // === 文本提取节点 ===
  inputText?: string        // 输入文本
  extractMode?: string      // 提取模式
  regexPattern?: string     // 正则表达式
  startMarker?: string      // 起始标记
  endMarker?: string        // 结束标记
  jsonPath?: string         // JSON 路径
  
  // === 条件判断节点 ===
  conditionInput?: string   // 条件判断的输入
  conditionType?: string    // 条件类型
  keywords?: string[]       // 关键词列表
  keywordMode?: string      // 关键词模式
  
  // === 循环节点 ===
  loopType?: string         // 循环类型
  maxIterations?: number    // 最大迭代次数
  currentIteration?: number // 当前迭代次数
  
  // === 变量节点 ===
  variableName?: string     // 变量名
  variableValue?: string    // 变量值
  
  // 通用扩展
  [key: string]: unknown
}

// 节点执行结果
export interface NodeResult {
  id: string
  execution_id: string
  node_id: string
  iteration: number
  input?: string
  output?: string
  token_usage?: TokenUsage
  resolved_config?: ResolvedNodeConfig  // 解析后的节点配置
  status: 'pending' | 'running' | 'completed' | 'failed'
  started_at: string
  finished_at?: string
}

// 主题类型
export type Theme = 'light' | 'dark' | 'system'

// 项目统计
export interface ProjectStats {
  character_count: number
  worldview_count: number
  workflow_count: number
  total_word_count: number
}

// 全局统计
export interface GlobalStats {
  active_projects: number
  today_word_count: number
}

// ========== 导入/导出类型 ==========

// 导出的工作流数据格式
export interface ExportedWorkflow {
  version: string                      // 导出格式版本
  exported_at: string                  // 导出时间
  workflow: Omit<Workflow, 'id' | 'project_id' | 'created_at' | 'updated_at'>
  nodes: Array<Omit<WorkflowNode, 'id' | 'workflow_id' | 'created_at' | 'updated_at'>>
}

// 导出的设定数据格式
export interface ExportedSettingItem {
  id?: string
  category: SettingCategory
  name: string
  content: string
  enabled: boolean
  parent_id?: string | null
  order_index?: number
}

export interface ExportedSettings {
  version: string
  exported_at: string
  settings: ExportedSettingItem[]
  setting_prompts?: Array<Omit<SettingPrompt, 'id' | 'project_id'>>
}

// 导出的完整项目数据格式
export interface ExportedProject {
  version: string
  exported_at: string
  project: Omit<Project, 'id' | 'created_at' | 'updated_at'>
  workflows: Array<{
    workflow: Omit<Workflow, 'id' | 'project_id' | 'created_at' | 'updated_at'>
    nodes: Array<Omit<WorkflowNode, 'id' | 'workflow_id' | 'created_at' | 'updated_at'>>
  }>
  settings: ExportedSettingItem[]
  setting_prompts: Array<Omit<SettingPrompt, 'id' | 'project_id'>>
}

// 导出格式版本号
export const EXPORT_VERSION = '1.0.0'

// ========== 工作流版本历史类型 ==========

// 工作流版本快照
export interface WorkflowVersion {
  id: string
  workflow_id: string
  version_number: number
  snapshot: string                     // JSON 字符串，包含工作流和节点的完整数据
  description?: string                 // 版本描述（可选）
  created_at: string
}

// 工作流快照内容
export interface WorkflowSnapshot {
  workflow: Omit<Workflow, 'id' | 'project_id' | 'created_at' | 'updated_at'>
  nodes: Array<Omit<WorkflowNode, 'id' | 'workflow_id' | 'created_at' | 'updated_at'>>
}
