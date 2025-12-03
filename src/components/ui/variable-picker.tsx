// 变量选择器组件（浮动弹窗版本）
// 输入 / 时弹出，配合 PromptEditor 使用

import * as React from 'react'
import { useState, useEffect, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import { VariablePickerContent } from './variable-picker-content'
import {
  buildCategories,
  getVariableText,
  type NodeCategory,
  type OutputVariable,
} from './variable-picker-shared'
import type { WorkflowNode } from '@/types'

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

  // 构建分类数据
  const categories = useMemo(
    () => buildCategories(nodes, currentNodeId),
    [nodes, currentNodeId]
  )

  // 当前选中的分类和变量
  const currentCategory = categories[selectedCategoryIndex]
  const currentVariables = currentCategory?.variables || []

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
    const height = 320

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

  // 处理变量选择
  const handleVariableClick = (category: NodeCategory, variable: OutputVariable) => {
    onSelect(getVariableText(category, variable))
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

        {/* 主体内容 - 使用共享组件 */}
        <VariablePickerContent
          categories={categories}
          selectedCategoryIndex={selectedCategoryIndex}
          selectedVarIndex={selectedVarIndex}
          onCategoryHover={(index) => {
            setSelectedCategoryIndex(index)
            setSelectedVarIndex(0)
          }}
          onCategoryClick={(index) => {
            setSelectedCategoryIndex(index)
            setSelectedVarIndex(0)
          }}
          onVariableHover={setSelectedVarIndex}
          onVariableClick={handleVariableClick}
          showVariableHighlight={true}
        />

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

// 导出共享类型
export type { NodeCategory, OutputVariable } from './variable-picker-shared'
