// 变量选择器组件
// 输入 / 时弹出，左列显示节点名称，右列显示该节点输出的变量

import * as React from 'react'
import { useState, useEffect, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
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
import { cn } from '@/lib/utils'
import type { WorkflowNode, NodeType, VarSetConfig } from '@/types'

// 节点图标映射
const nodeIconMap: Record<NodeType, React.ComponentType<{ className?: string }>> = {
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
const nodeColorMap: Record<NodeType, string> = {
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
interface OutputVariable {
  varName: string      // 实际变量名（用于执行引擎解析）
  description: string  // 友好的描述（显示用）
}

// 获取节点输出变量（带描述）
function getNodeOutputVariables(node: WorkflowNode): OutputVariable[] {
  const config = node.config as any
  
  switch (node.type) {
    case 'start':
      return [{ 
        varName: '用户问题', 
        description: '用户输入',
      }]
    
    case 'ai_chat':
      return [{ 
        varName: node.name, 
        description: 'AI 回答内容',
      }]
    
    case 'text_extract':
      return [{ 
        varName: node.name, 
        description: '提取结果',
      }]
    
    case 'text_concat':
      return [{ 
        varName: node.name, 
        description: '拼接结果',
      }]
    
    case 'var_set':
      const varConfig = config as VarSetConfig
      if (varConfig?.variable_name) {
        return [{ 
          varName: varConfig.variable_name, 
          description: '保存的变量',
        }]
      }
      return []
    
    case 'var_get':
      return [{ 
        varName: node.name, 
        description: '读取的值',
      }]
    
    case 'loop_start':
      return [{ 
        varName: 'loop_index', 
        description: '循环次数',
      }]
    
    case 'condition_if':
      return [{ 
        varName: node.name, 
        description: '判断结果',
      }]
    
    case 'parallel_start':
      return [{ 
        varName: node.name, 
        description: '并发结果',
      }]
    
    // 以下节点类型没有输出
    case 'output':
    case 'loop_end':
    case 'parallel_end':
    case 'condition_else':
    case 'condition_end':
      return []
    
    default:
      return [{ 
        varName: node.name, 
        description: '节点输出',
      }]
  }
}

// 节点分类
interface NodeCategory {
  id: string
  name: string
  icon: React.ComponentType<{ className?: string }>
  nodeType: NodeType
  variables: OutputVariable[]
}

interface VariablePickerProps {
  nodes: WorkflowNode[]
  currentNodeId?: string
  position: { x: number; y: number }
  onSelect: (variable: string) => void
  onClose: () => void
}

export function VariablePicker({
  nodes,
  currentNodeId,
  position,
  onSelect,
  onClose,
}: VariablePickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0)
  const [selectedVarIndex, setSelectedVarIndex] = useState(0)

  // 构建分类数据 - 按节点分组
  const categories = useMemo(() => {
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
  }, [nodes, currentNodeId])

  // 当前选中的分类和变量
  const currentCategory = categories[selectedCategoryIndex]
  const currentVariables = currentCategory?.variables || []

  // 生成插入的变量文本格式: {{节点名称 > 输出描述}}
  const getVariableText = (category: NodeCategory, variable: OutputVariable) => {
    return `{{${category.name} > ${variable.description}}}`
  }

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          setSelectedCategoryIndex(prev => 
            prev > 0 ? prev - 1 : categories.length - 1
          )
          setSelectedVarIndex(0)
          break
        case 'ArrowDown':
          e.preventDefault()
          setSelectedCategoryIndex(prev => 
            prev < categories.length - 1 ? prev + 1 : 0
          )
          setSelectedVarIndex(0)
          break
        case 'ArrowRight':
          e.preventDefault()
          if (currentVariables.length > 0) {
            setSelectedVarIndex(prev => 
              prev < currentVariables.length - 1 ? prev + 1 : 0
            )
          }
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (currentVariables.length > 0) {
            setSelectedVarIndex(prev => 
              prev > 0 ? prev - 1 : currentVariables.length - 1
            )
          }
          break
        case 'Enter':
          e.preventDefault()
          if (currentCategory && currentVariables[selectedVarIndex]) {
            onSelect(getVariableText(currentCategory, currentVariables[selectedVarIndex]))
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [categories, currentCategory, currentVariables, selectedCategoryIndex, selectedVarIndex, onSelect, onClose])

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // 调整位置以防止溢出
  const adjustedPosition = useMemo(() => {
    const padding = 8
    const width = 480
    const height = 280

    let x = position.x
    let y = position.y

    // 检查右边界
    if (x + width > window.innerWidth - padding) {
      x = window.innerWidth - width - padding
    }
    
    // 检查下边界
    if (y + height > window.innerHeight - padding) {
      y = position.y - height - 24 // 显示在光标上方
    }

    return { x: Math.max(padding, x), y: Math.max(padding, y) }
  }, [position])

  // 如果没有可用的变量，显示提示
  if (categories.length === 0) {
    return (
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.95, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -4 }}
        transition={{ duration: 0.15 }}
        className="variable-picker fixed z-50"
        style={{
          left: adjustedPosition.x,
          top: adjustedPosition.y,
        }}
      >
        <div className="w-[300px] rounded-lg border bg-popover shadow-xl overflow-hidden">
          <div className="px-4 py-6 text-center">
            <div className="text-sm text-muted-foreground">
              当前节点之前没有可引用的变量
            </div>
            <div className="mt-2 text-xs text-muted-foreground/70">
              请先添加开始节点或其他产生输出的节点
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      transition={{ duration: 0.15 }}
      className="variable-picker fixed z-50"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      <div className="w-[480px] rounded-lg border bg-popover shadow-xl overflow-hidden">
        {/* 标题栏 */}
        <div className="px-3 py-2 border-b bg-muted/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium">选择变量</span>
            <span className="opacity-50">·</span>
            <span>引用节点输出</span>
          </div>
        </div>

        {/* 主体内容 */}
        <div className="flex h-[240px]">
          {/* 左列：节点列表 */}
          <div className="w-[180px] border-r bg-muted/20 overflow-y-auto">
            {categories.map((category, index) => {
              const Icon = category.icon
              const isSelected = index === selectedCategoryIndex
              const bgColor = nodeColorMap[category.nodeType]
              
              return (
                <div
                  key={category.id}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors',
                    isSelected 
                      ? 'bg-primary/10 text-foreground' 
                      : 'text-muted-foreground hover:bg-muted/50'
                  )}
                  onMouseEnter={() => {
                    setSelectedCategoryIndex(index)
                    setSelectedVarIndex(0)
                  }}
                  onClick={() => {
                    setSelectedCategoryIndex(index)
                    setSelectedVarIndex(0)
                  }}
                >
                  <div className={cn(
                    'flex h-5 w-5 items-center justify-center rounded flex-shrink-0',
                    bgColor,
                    'text-white'
                  )}>
                    <Icon className="h-3 w-3" />
                  </div>
                  <span className="text-sm truncate">{category.name}</span>
                </div>
              )
            })}
          </div>

          {/* 右列：变量列表（只显示输出描述） */}
          <div className="flex-1 overflow-y-auto p-2">
            {currentCategory && currentVariables.length > 0 ? (
              <div className="space-y-1">
                {currentVariables.map((item, index) => {
                  const isSelected = index === selectedVarIndex
                  const displayText = getVariableText(currentCategory, item)
                  
                  return (
                    <div
                      key={`${currentCategory.id}-${item.varName}`}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2.5 rounded-md cursor-pointer transition-all',
                        isSelected 
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-muted'
                      )}
                      onMouseEnter={() => setSelectedVarIndex(index)}
                      onClick={() => onSelect(displayText)}
                    >
                      {/* 只显示输出描述 */}
                      <span className={cn(
                        'text-sm',
                        isSelected ? 'text-primary-foreground' : 'text-foreground'
                      )}>
                        {item.description}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                该节点没有输出变量
              </div>
            )}
          </div>
        </div>

        {/* 底部提示 */}
        <div className="px-3 py-1.5 border-t bg-muted/30 flex items-center gap-4 text-xs text-muted-foreground">
          <span><kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">↑↓</kbd> 选择节点</span>
          <span><kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">←→</kbd> 选择变量</span>
          <span><kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Enter</kbd> 确认</span>
          <span><kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Esc</kbd> 关闭</span>
        </div>
      </div>
    </motion.div>
  )
}

// 导出类型
export type { NodeCategory, OutputVariable }
