// 变量选择下拉框组件
// 点击展开选择框，左列节点名称，右列变量名称

import * as React from 'react'
import { useState, useRef, useMemo, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Button } from './button'
import type { WorkflowNode, NodeType, VarSetConfig } from '@/types'

// 节点图标映射 - 复用 variable-picker 的配色
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
  varName: string
  description: string
}

// 获取节点输出变量
function getNodeOutputVariables(node: WorkflowNode): OutputVariable[] {
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

// 节点分类
interface NodeCategory {
  id: string
  name: string
  icon: React.ComponentType<{ className?: string }>
  nodeType: NodeType
  variables: OutputVariable[]
}

interface VariableSelectProps {
  value: string
  onChange: (value: string) => void
  nodes: WorkflowNode[]
  currentNodeId?: string
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function VariableSelect({
  value,
  onChange,
  nodes,
  currentNodeId,
  placeholder = '选择引用变量',
  className,
  disabled = false,
}: VariableSelectProps) {
  const [open, setOpen] = useState(false)
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // 构建分类数据
  const categories = useMemo(() => {
    const result: NodeCategory[] = []
    const currentIndex = nodes.findIndex(n => n.id === currentNodeId)
    const previousNodes = currentIndex >= 0 ? nodes.slice(0, currentIndex) : nodes
    
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

  // 当前选中的分类
  const currentCategory = categories[selectedCategoryIndex]

  // 解析当前值以显示
  const displayValue = useMemo(() => {
    if (!value) return null
    // 解析 {{节点名 > 描述}} 格式
    const match = value.match(/^\{\{(.+?)\s*>\s*(.+?)\}\}$/)
    if (match) {
      return { nodeName: match[1], description: match[2] }
    }
    // 简单变量名格式
    return { nodeName: value, description: '' }
  }, [value])

  // 生成变量文本
  const getVariableText = (category: NodeCategory, variable: OutputVariable) => {
    return `{{${category.name} > ${variable.description}}}`
  }

  // 处理选择
  const handleSelect = (category: NodeCategory, variable: OutputVariable) => {
    onChange(getVariableText(category, variable))
    setOpen(false)
  }

  // 清除选择
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
  }

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  // 键盘导航
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          setSelectedCategoryIndex(prev => 
            prev > 0 ? prev - 1 : categories.length - 1
          )
          break
        case 'ArrowDown':
          e.preventDefault()
          setSelectedCategoryIndex(prev => 
            prev < categories.length - 1 ? prev + 1 : 0
          )
          break
        case 'Enter':
          e.preventDefault()
          if (currentCategory && currentCategory.variables[0]) {
            handleSelect(currentCategory, currentCategory.variables[0])
          }
          break
        case 'Escape':
          e.preventDefault()
          setOpen(false)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, categories, currentCategory, selectedCategoryIndex])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* 触发按钮 */}
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        className={cn(
          'w-full justify-between font-normal',
          !value && 'text-muted-foreground'
        )}
        onClick={() => setOpen(!open)}
      >
        <span className="truncate">
          {displayValue ? (
            <span className="flex items-center gap-1.5">
              <span className="text-foreground">{displayValue.nodeName}</span>
              {displayValue.description && (
                <>
                  <span className="text-muted-foreground">{'>'}</span>
                  <span className="text-muted-foreground">{displayValue.description}</span>
                </>
              )}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {value && (
            <X
              className="h-4 w-4 opacity-50 hover:opacity-100"
              onClick={handleClear}
            />
          )}
          <ChevronDown className={cn(
            'h-4 w-4 opacity-50 transition-transform',
            open && 'rotate-180'
          )} />
        </div>
      </Button>

      {/* 下拉选择面板 */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 w-full min-w-[400px] rounded-lg border bg-popover shadow-lg overflow-hidden"
          >
            {categories.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <div className="text-sm text-muted-foreground">
                  当前节点之前没有可引用的变量
                </div>
                <div className="mt-2 text-xs text-muted-foreground/70">
                  请先添加开始节点或其他产生输出的节点
                </div>
              </div>
            ) : (
              <div className="flex h-[240px]">
                {/* 左列：节点列表 */}
                <div className="w-[160px] border-r bg-muted/20 overflow-y-auto">
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
                        onMouseEnter={() => setSelectedCategoryIndex(index)}
                        onClick={() => setSelectedCategoryIndex(index)}
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

                {/* 右列：变量列表 */}
                <div className="flex-1 overflow-y-auto p-2">
                  {currentCategory && currentCategory.variables.length > 0 ? (
                    <div className="space-y-1">
                      {currentCategory.variables.map((item) => (
                        <div
                          key={`${currentCategory.id}-${item.varName}`}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-md cursor-pointer transition-all hover:bg-primary hover:text-primary-foreground"
                          onClick={() => handleSelect(currentCategory, item)}
                        >
                          <span className="text-sm">{item.description}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                      该节点没有输出变量
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

