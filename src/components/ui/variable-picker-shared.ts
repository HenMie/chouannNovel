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
import type { WorkflowNode, NodeType, StartConfig } from '@/types'

// 节点图标映射
export const nodeIconMap: Record<NodeType, React.ComponentType<{ className?: string }>> = {
  start: FileInput,
  output: FileOutput,
  ai_chat: MessageSquare,
  text_extract: Scissors,
  text_concat: Type,
  var_update: Variable,
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
  var_update: 'bg-emerald-500',
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

// 变量类型
export type VariableType = 'global' | 'node'

// 输出变量信息
export interface OutputVariable {
  varName: string       // 变量名或节点ID
  description: string   // 友好的描述（显示用）
  type: VariableType    // 变量类型：global=全局变量，node=节点引用
}

// 节点分类
export interface NodeCategory {
  id: string
  name: string
  icon: React.ComponentType<{ className?: string }>
  nodeType: NodeType
  variables: OutputVariable[]
}

// 获取节点输出变量
// - 全局变量（start 定义）：直接用变量名，如 {{用户问题}}
// - 普通变量（其他节点输出）：用节点ID，显示为 {{节点名 > 描述}}
export function getNodeOutputVariables(node: WorkflowNode): OutputVariable[] {
  const config = node.config as any
  
  switch (node.type) {
    case 'start': {
      // 开始节点定义全局变量
      const startConfig = config as StartConfig
      const variables: OutputVariable[] = [
        // 系统内置的全局变量
        { varName: '用户问题', description: '用户问题', type: 'global' },
      ]
      // 添加用户自定义的全局变量
      if (startConfig?.custom_variables) {
        startConfig.custom_variables.forEach(v => {
          variables.push({ 
            varName: v.name, 
            description: v.name, 
            type: 'global' 
          })
        })
      }
      return variables
    }
    case 'ai_chat':
      return [{ varName: node.id, description: 'AI 回答内容', type: 'node' }]
    case 'text_extract':
      return [{ varName: node.id, description: '提取结果', type: 'node' }]
    case 'text_concat':
      return [{ varName: node.id, description: '拼接结果', type: 'node' }]
    case 'var_update':
      // 更新变量节点没有输出（只是更新已有变量）
      return []
    case 'loop_start':
      // 循环索引是全局变量
      return [{ varName: 'loop_index', description: '循环次数', type: 'global' }]
    case 'condition_if':
      return [{ varName: node.id, description: '判断结果', type: 'node' }]
    case 'parallel_start':
      return [{ varName: node.id, description: '并发结果', type: 'node' }]
    // === 无输出的节点 ===
    case 'output':
    case 'loop_end':
    case 'parallel_end':
    case 'condition_else':
    case 'condition_end':
      return []
    default:
      return [{ varName: node.id, description: '节点输出', type: 'node' }]
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

// 生成变量文本格式
// - 全局变量：{{变量名}}（如 {{用户问题}}）
// - 普通变量：{{@nodeId}}（显示为 {{节点名 > 描述}}）
export function getVariableText(category: NodeCategory, variable: OutputVariable): string {
  if (variable.type === 'global') {
    // 全局变量直接用变量名
    return `{{${variable.varName}}}`
  }
  // 普通变量用节点ID
  return `{{@${category.id}}}`
}

// 解析变量文本结果
export interface ParsedVariable {
  nodeId: string       // 节点ID（不含 @ 前缀）
}

// 解析变量文本，返回 { nodeId } 或 null
export function parseVariableText(value: string): ParsedVariable | null {
  if (!value) return null
  // 解析 {{@nodeId}} 格式（新格式，只有节点ID）
  const simpleMatch = value.match(/^\{\{@([^}>]+)\}\}$/)
  if (simpleMatch) {
    return { nodeId: simpleMatch[1].trim() }
  }
  // 兼容旧格式 {{@nodeId > 描述}}
  const oldMatch = value.match(/^\{\{@(.+?)\s*>\s*.+?\}\}$/)
  if (oldMatch) {
    return { nodeId: oldMatch[1] }
  }
  return null
}

// 根据节点ID查找节点名称
export function findNodeNameById(nodes: WorkflowNode[], nodeId: string): string | null {
  const node = nodes.find(n => n.id === nodeId)
  return node?.name ?? null
}

// 根据节点ID获取显示文本（节点名 > 描述）
// 用于将 {{@nodeId}} 转换为友好的显示格式
export function getDisplayTextByNodeId(nodes: WorkflowNode[], nodeId: string): string {
  const node = nodes.find(n => n.id === nodeId)
  if (!node) return nodeId  // 找不到节点时显示原始ID
  
  // 获取节点的输出变量信息
  const variables = getNodeOutputVariables(node)
  const variable = variables[0]
  
  if (!variable) return node.name
  
  // 返回 "节点名 > 描述" 格式
  return `${node.name} > ${variable.description}`
}

