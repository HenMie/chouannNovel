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
  | 'input'
  | 'output'
  | 'ai_chat'
  | 'text_extract'
  | 'text_concat'
  | 'var_set'
  | 'var_get'
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
  condition_source?: 'previous' | 'variable'
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
}

// 并发结束节点配置
export interface ParallelEndConfig {
  parallel_start_id: string
}

// 条件分支开始配置
export interface ConditionIfConfig {
  input_source: 'previous' | 'variable'
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
  user_prompt: string        // 用户问题 (user message)，默认 {{上一节点}}
  temperature?: number
  max_tokens?: number
  top_p?: number
  thinking_level?: 'low' | 'high'
  enable_history: boolean
  history_count: number
  setting_ids: string[]
}

// 条件节点配置
export interface ConditionConfig {
  input_source: 'previous' | 'variable'
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
  input_source: 'previous' | 'variable'
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
  input_source: 'previous' | 'variable'
  input_variable?: string
  extract_mode: 'regex' | 'start_end' | 'json_path'
  regex_pattern?: string
  start_marker?: string
  end_marker?: string
  json_path?: string
}

// 文本拼接节点配置
export interface TextConcatConfig {
  sources: Array<{
    type: 'previous' | 'variable' | 'custom'
    variable?: string
    custom?: string
  }>
  separator: string
}

// 变量设置节点配置
export interface VarSetConfig {
  variable_name: string
  value_source: 'previous' | 'custom'
  custom_value?: string
}

// 变量读取节点配置
export interface VarGetConfig {
  variable_name: string
}

// 输入节点配置
export interface InputConfig {
  placeholder?: string
  default_value?: string
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
  | VarSetConfig
  | VarGetConfig
  | InputConfig
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

// 节点执行结果
export interface NodeResult {
  id: string
  execution_id: string
  node_id: string
  iteration: number
  input?: string
  output?: string
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
