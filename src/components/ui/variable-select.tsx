// 变量选择下拉框组件
// 点击展开选择框，复用共享的内容组件

import * as React from 'react'
import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
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

interface DropdownPosition {
  top: number
  left: number
  width: number
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
  const [position, setPosition] = useState<DropdownPosition>({ top: 0, left: 0, width: 320 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 构建分类数据
  const categories = useMemo(
    () => buildCategories(nodes, currentNodeId),
    [nodes, currentNodeId]
  )

  // 解析当前值以显示
  const displayValue = useMemo(() => {
    if (!value) return null

    const parsed = parseVariableText(value)
    if (parsed) {
      const displayText = getDisplayTextByNodeId(nodes, parsed.nodeId)
      const parts = displayText.split(' > ')
      return {
        nodeName: parts[0],
        description: parts[1] || '',
      }
    }

    const globalMatch = value.match(/^\{\{([^@}]+)\}\}$/)
    if (globalMatch) {
      const varName = globalMatch[1].trim()
      for (const cat of categories) {
        const variable = cat.variables.find(
          (v) => v.type === 'global' && v.varName === varName
        )
        if (variable) {
          return {
            nodeName: cat.name,
            description: variable.description,
          }
        }
      }
      return { nodeName: varName, description: '' }
    }

    return null
  }, [value, nodes, categories])

  // 计算弹层位置
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const width = Math.max(rect.width, 400)

    let left = rect.left
    if (left + width > window.innerWidth - 8) {
      left = window.innerWidth - width - 8
    }
    left = Math.max(8, left)

    let top = rect.bottom + 4
    const dropdownHeight = dropdownRef.current?.offsetHeight ?? 320
    if (top + dropdownHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - dropdownHeight - 4)
    }

    setPosition({ top, left, width })
  }, [])

  const openDropdown = () => {
    if (disabled) return
    setOpen((prev) => {
      const next = !prev
      if (!prev && next) {
        requestAnimationFrame(updatePosition)
      }
      return next
    })
  }

  // 点击选项
  const handleSelect = (category: NodeCategory, variable: OutputVariable) => {
    onChange(getVariableText(category, variable))
    setOpen(false)
  }

  // 下拉面板内的指针事件，阻止冒泡避免触发外部点击关闭
  const handleDropdownPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
  }, [])

  // 清除选择
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
  }

  // 点击外部关闭
  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [open])

  // 窗口尺寸变更时更新位置
  useEffect(() => {
    if (!open) return
    const handleResize = () => updatePosition()
    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleResize, true)
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleResize, true)
    }
  }, [open, updatePosition])

  // 键盘导航
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          setSelectedCategoryIndex((prev) =>
            prev > 0 ? prev - 1 : categories.length - 1
          )
          break
        case 'ArrowDown':
          e.preventDefault()
          setSelectedCategoryIndex((prev) =>
            prev < categories.length - 1 ? prev + 1 : 0
          )
          break
        case 'Enter': {
          e.preventDefault()
          const currentCategory = categories[selectedCategoryIndex]
          if (currentCategory?.variables[0]) {
            handleSelect(currentCategory, currentCategory.variables[0])
          }
          break
        }
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
    <div className={cn('relative', className)}>
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
        onClick={openDropdown}
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
            <X className="h-4 w-4 opacity-50 hover:opacity-100" onClick={handleClear} />
          )}
          <ChevronDown
            className={cn('h-4 w-4 opacity-50 transition-transform', open && 'rotate-180')}
          />
        </div>
      </Button>

      {/* 下拉面板通过 Portal 渲染到 body，避免被父级 overflow 裁剪 */}
      {typeof window !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              // 外层 div 用于稳定挂载 ref 和捕获事件，避免 motion.div 动画期间 ref 不稳定
              <div
                ref={dropdownRef}
                onPointerDownCapture={handleDropdownPointerDown}
                className="fixed z-[100]"
                style={{
                  top: position.top,
                  left: position.left,
                  width: position.width,
                  maxHeight: '360px',
                  // 确保面板可接收指针事件（防止被父级 pointer-events:none 影响）
                  pointerEvents: 'auto',
                }}
                data-variable-select-dropdown
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.98, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="rounded-lg border bg-popover shadow-xl overflow-hidden"
                >
                  <VariablePickerContent
                    categories={categories}
                    selectedCategoryIndex={selectedCategoryIndex}
                    onCategoryHover={setSelectedCategoryIndex}
                    onCategoryClick={setSelectedCategoryIndex}
                    onVariableClick={handleSelect}
                    showVariableHighlight={false}
                  />
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  )
}
