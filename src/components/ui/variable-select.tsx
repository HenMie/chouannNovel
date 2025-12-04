// 变量选择下拉框组件
// 点击展开选择框，复用共享的内容组件

import * as React from 'react'
import { useState, useRef, useMemo, useEffect } from 'react'
import * as Portal from '@radix-ui/react-portal'
import { ChevronDown, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { VariablePickerContent } from './variable-picker-content'
import {
  buildCategories,
  getVariableText,
  parseVariableText,
  getDisplayTextByNodeId,
  type NodeCategory,
  type OutputVariable,
} from './variable-picker-shared'
import type { WorkflowNode } from '@/types'

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
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // 构建分类数据
  const categories = useMemo(
    () => buildCategories(nodes, currentNodeId),
    [nodes, currentNodeId]
  )

  // 解析当前值以显示
  const displayValue = useMemo(() => {
    if (!value) return null
    
    // 先尝试解析节点引用格式 {{@nodeId}}
    const parsed = parseVariableText(value)
    if (parsed) {
      // 根据 nodeId 动态获取完整显示文本
      const displayText = getDisplayTextByNodeId(nodes, parsed.nodeId)
      // 分割为节点名和描述
      const parts = displayText.split(' > ')
      return { 
        nodeName: parts[0], 
        description: parts[1] || '' 
      }
    }
    
    // 尝试解析全局变量格式 {{变量名}}
    const globalMatch = value.match(/^\{\{([^@}]+)\}\}$/)
    if (globalMatch) {
      const varName = globalMatch[1].trim()
      // 在 categories 中查找对应的全局变量
      for (const cat of categories) {
        const variable = cat.variables.find(v => v.type === 'global' && v.varName === varName)
        if (variable) {
          return {
            nodeName: cat.name,
            description: variable.description
          }
        }
      }
      // 找不到时直接显示变量名
      return { nodeName: varName, description: '' }
    }
    
    return null
  }, [value, nodes, categories])

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

  // 计算下拉框位置
  const updateDropdownPosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 400),
      })
    }
  }

  // 打开下拉框时计算位置
  const handleOpen = () => {
    if (!open) {
      updateDropdownPosition()
    }
    setOpen(!open)
  }

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      // 检查点击是否在容器外部，并且不在下拉面板内部
      const dropdownEl = document.querySelector('[data-variable-select-dropdown]')
      if (
        containerRef.current && 
        !containerRef.current.contains(target) &&
        (!dropdownEl || !dropdownEl.contains(target))
      ) {
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

    const currentCategory = categories[selectedCategoryIndex]

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
  }, [open, categories, selectedCategoryIndex])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* 触发按钮 */}
      <Button
        ref={triggerRef}
        variant="outline"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        className={cn(
          'w-full justify-between font-normal',
          !value && 'text-muted-foreground'
        )}
        onClick={handleOpen}
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

      {/* 下拉选择面板 - 使用 Portal 渲染到 body 避免被 overflow:hidden 截断 */}
      <AnimatePresence>
        {open && (
          <Portal.Root>
            <motion.div
              data-variable-select-dropdown
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="fixed z-[100] rounded-lg border bg-popover shadow-lg overflow-hidden"
              style={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
                minWidth: 400,
              }}
            >
              {/* 使用共享的内容组件 */}
              <VariablePickerContent
                categories={categories}
                selectedCategoryIndex={selectedCategoryIndex}
                onCategoryHover={setSelectedCategoryIndex}
                onCategoryClick={setSelectedCategoryIndex}
                onVariableClick={handleSelect}
                showVariableHighlight={false}
              />
            </motion.div>
          </Portal.Root>
        )}
      </AnimatePresence>
    </div>
  )
}
