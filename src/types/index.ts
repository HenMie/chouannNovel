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
  | 'input'
  | 'output'
  | 'ai_chat'
  | 'text_extract'
  | 'text_concat'
  | 'condition'
  | 'loop'
  | 'batch'
  | 'var_set'
  | 'var_get'

// 节点类型
export interface WorkflowNode {
  id: string
  workflow_id: string
  type: NodeType
  name: string
  config: NodeConfig
  order_index: number
  created_at: string
  updated_at: string
}

// AI 提供商
export type AIProvider = 'openai' | 'gemini' | 'claude'

// AI 聊天节点配置
export interface AIChatConfig {
  provider: AIProvider
  model: string
  prompt: string
  temperature?: number
  max_tokens?: number
  top_p?: number
  thinking_level?: 'low' | 'high'
  enable_history: boolean
  history_count: number
  setting_ids: string[]
  input_source: 'previous' | 'variable' | 'custom'
  input_variable?: string
  custom_input?: string
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

// AI 提供商配置
export interface AIProviderConfig {
  api_key: string
  base_url?: string
  enabled: boolean
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

