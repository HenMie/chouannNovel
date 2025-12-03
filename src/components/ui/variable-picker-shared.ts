// 变量选择器共享逻辑
// 包含类型定义、节点映射、工具函数等

import {
  MessageSquare,
  FileInput,
  FileOutput,
  Repeat,
  GitBranch,
  Layers,
  Variable,
  Type,
  Scissors,
  CornerDownRight,
} from 'lucide-react'
import type { WorkflowNode, NodeType, VarSetConfig } from '@/types'

// 节点图标映射
export const nodeIconMap: Record<NodeType, React.ComponentType<{ className?: string }>> = {
  start: FileInput,
  output: FileOutput,
  ai_chat: MessageSquare,
  text_extract: Scissors,
  text_concat: Type,
  var_set: Variable,
  var_get: Variable,
  loop_start: Repeat,
  loop_end: CornerDownRight,
  parallel_start: Layers,
  parallel_end: CornerDownRight,
  condition_if: GitBranch,
  condition_else: GitBranch,
  condition_end: CornerDownRight,
  condition: GitBranch,
  loop: Repeat,
  batch: Layers,
}

// 节点颜色映射
export const nodeColorMap: Record<NodeType, string> = {
  start: 'bg-green-500',
  output: 'bg-red-500',
  ai_chat: 'bg-violet-500',
  text_extract: 'bg-orange-500',
  text_concat: 'bg-cyan-500',
  var_set: 'bg-emerald-500',
  var_get: 'bg-teal-500',
  loop_start: 'bg-pink-500',
  loop_end: 'bg-pink-500',
  parallel_start: 'bg-indigo-500',
  parallel_end: 'bg-indigo-500',
  condition_if: 'bg-yellow-500',
  condition_else: 'bg-yellow-500',
  condition_end: 'bg-yellow-500',
  condition: 'bg-yellow-500',
  loop: 'bg-pink-500',
  batch: 'bg-indigo-500',
}

// 输出变量信息
export interface OutputVariable {
  varName: string      // 实际变量名（用于执行引擎解析）
  description: string  // 友好的描述（显示用）
}

// 节点分类
export interface NodeCategory {
  id: string
  name: string
  icon: React.ComponentType<{ className?: string }>
  nodeType: NodeType
  variables: OutputVariable[]
}

// 获取节点输出变量（带描述）
export function getNodeOutputVariables(node: WorkflowNode): OutputVariable[] {
  const config = node.config as any
  
  switch (node.type) {
    case 'start':
      return [{ varName: '用户问题', description: '用户输入' }]
    case 'ai_chat':
      return [{ varName: node.name, description: 'AI 回答内容' }]
    case 'text_extract':
      return [{ varName: node.name, description: '提取结果' }]
    case 'text_concat':
      return [{ varName: node.name, description: '拼接结果' }]
    case 'var_set':
      const varConfig = config as VarSetConfig
      if (varConfig?.variable_name) {
        return [{ varName: varConfig.variable_name, description: '保存的变量' }]
      }
      return []
    case 'var_get':
      return [{ varName: node.name, description: '读取的值' }]
    case 'loop_start':
      return [{ varName: 'loop_index', description: '循环次数' }]
    case 'condition_if':
      return [{ varName: node.name, description: '判断结果' }]
    case 'parallel_start':
      return [{ varName: node.name, description: '并发结果' }]
    case 'output':
    case 'loop_end':
    case 'parallel_end':
    case 'condition_else':
    case 'condition_end':
      return []
    default:
      return [{ varName: node.name, description: '节点输出' }]
  }
}

// 构建分类数据 - 按节点分组
export function buildCategories(nodes: WorkflowNode[], currentNodeId?: string): NodeCategory[] {
  const result: NodeCategory[] = []
  
  // 获取当前节点之前的所有节点
  const currentIndex = nodes.findIndex(n => n.id === currentNodeId)
  const previousNodes = currentIndex >= 0 ? nodes.slice(0, currentIndex) : nodes
  
  // 按节点分组，只显示有输出的节点
  previousNodes.forEach(node => {
    const variables = getNodeOutputVariables(node)
    if (variables.length > 0) {
      result.push({
        id: node.id,
        name: node.name,
        icon: nodeIconMap[node.type] || Variable,
        nodeType: node.type,
        variables,
      })
    }
  })
  
  return result
}

// 生成变量文本格式: {{节点名称 > 输出描述}}
export function getVariableText(category: NodeCategory, variable: OutputVariable): string {
  return `{{${category.name} > ${variable.description}}}`
}

// 解析变量文本，返回 { nodeName, description } 或 null
export function parseVariableText(value: string): { nodeName: string; description: string } | null {
  if (!value) return null
  // 解析 {{节点名 > 描述}} 格式
  const match = value.match(/^\{\{(.+?)\s*>\s*(.+?)\}\}$/)
  if (match) {
    return { nodeName: match[1], description: match[2] }
  }
  // 简单变量名格式
  return { nodeName: value, description: '' }
}

