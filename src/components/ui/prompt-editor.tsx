// 提示词编辑器组件
// 支持 {{变量名}} 作为不可编辑的整体标签
// 支持输入 / 触发变量选择器

import * as React from 'react'
import { useRef, useCallback, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { VariablePicker } from './variable-picker'
import type { WorkflowNode } from '@/types'

// 变量匹配正则表达式
const VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g

// 系统内置变量列表（显示为蓝色标签）
// - 用户问题/input/输入: 初始用户输入
// - loop_index: 当前循环索引
const SYSTEM_VARIABLES = ['用户问题', 'input', '输入', 'loop_index']

interface PromptEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
  disabled?: boolean
  id?: string
  // 新增：节点列表用于变量选择
  nodes?: WorkflowNode[]
  currentNodeId?: string
}

// 转义 HTML 特殊字符
const escapeHtml = (str: string) =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

// 将文本中的变量转换为不可编辑的标签 HTML
function renderToHtml(text: string): string {
  if (!text) return ''
  
  const parts: string[] = []
  let lastIndex = 0
  let match

  const pattern = new RegExp(VARIABLE_PATTERN.source, 'g')

  while ((match = pattern.exec(text)) !== null) {
    // 添加匹配前的文本
    if (match.index > lastIndex) {
      parts.push(escapeHtml(text.slice(lastIndex, match.index)))
    }

    // 添加不可编辑的变量标签
    const varName = match[1].trim()
    const fullVar = `{{${varName}}}`
    const isBuiltin = SYSTEM_VARIABLES.includes(varName)
    const colorClass = isBuiltin ? 'prompt-var-builtin' : 'prompt-var-custom'
    
    // contenteditable="false" 使标签不可编辑
    // data-var 存储完整变量文本用于提取
    parts.push(
      `<span class="prompt-var ${colorClass}" contenteditable="false" data-var="${escapeHtml(fullVar)}">${escapeHtml(fullVar)}</span>`
    )

    lastIndex = match.index + match[0].length
  }

  // 添加剩余文本
  if (lastIndex < text.length) {
    parts.push(escapeHtml(text.slice(lastIndex)))
  }

  // 将换行符转换为 <br>
  return parts.join('').replace(/\n/g, '<br>')
}

// 从编辑器 DOM 中提取纯文本值
function extractValue(element: HTMLElement): string {
  let result = ''
  
  const walkNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent || ''
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      
      // 如果是变量标签，使用 data-var 属性
      if (el.classList.contains('prompt-var')) {
        result += el.getAttribute('data-var') || el.textContent || ''
        return // 不遍历子节点
      }
      
      // 处理换行
      if (el.tagName === 'BR') {
        result += '\n'
        return
      }
      
      // 处理 div（某些浏览器用 div 换行）
      if (el.tagName === 'DIV' && result.length > 0 && !result.endsWith('\n')) {
        result += '\n'
      }
      
      // 遍历子节点
      for (const child of Array.from(node.childNodes)) {
        walkNode(child)
      }
    }
  }
  
  walkNode(element)
  return result
}

// 获取光标位置
function getCaretPosition(): { x: number; y: number } | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  
  const range = selection.getRangeAt(0)
  const rect = range.getBoundingClientRect()
  
  return {
    x: rect.left,
    y: rect.bottom + 4, // 在光标下方显示
  }
}

// 删除 / 字符并保持光标位置
function removeSlashBeforeCaret(): void {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return
  
  const range = selection.getRangeAt(0)
  const container = range.startContainer
  const offset = range.startOffset
  
  if (container.nodeType === Node.TEXT_NODE && offset > 0) {
    const text = container.textContent || ''
    if (text[offset - 1] === '/') {
      // 删除 / 字符
      container.textContent = text.slice(0, offset - 1) + text.slice(offset)
      
      // 恢复光标位置
      const newRange = document.createRange()
      newRange.setStart(container, offset - 1)
      newRange.setEnd(container, offset - 1)
      selection.removeAllRanges()
      selection.addRange(newRange)
    }
  }
}

// 在光标位置插入变量
function insertVariableAtCursor(editor: HTMLElement, variable: string): void {
  const selection = window.getSelection()
  if (!selection) return
  
  // 确保编辑器获得焦点
  editor.focus()
  
  const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : document.createRange()
  
  // 创建变量标签
  const varName = variable.replace(/^\{\{|\}\}$/g, '')
  const isBuiltin = SYSTEM_VARIABLES.includes(varName)
  const colorClass = isBuiltin ? 'prompt-var-builtin' : 'prompt-var-custom'
  
  const span = document.createElement('span')
  span.className = `prompt-var ${colorClass}`
  span.contentEditable = 'false'
  span.setAttribute('data-var', variable)
  span.textContent = variable
  
  // 删除选中内容并插入
  range.deleteContents()
  range.insertNode(span)
  
  // 将光标移到标签后面
  range.setStartAfter(span)
  range.setEndAfter(span)
  selection.removeAllRanges()
  selection.addRange(range)
}

export function PromptEditor({
  value,
  onChange,
  placeholder,
  className,
  minHeight = '120px',
  disabled = false,
  id,
  nodes = [],
  currentNodeId,
}: PromptEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const isComposing = useRef(false)
  const lastValue = useRef(value)
  const isInternalUpdate = useRef(false)
  
  // 变量选择器状态
  const [showPicker, setShowPicker] = useState(false)
  const [pickerPosition, setPickerPosition] = useState({ x: 0, y: 0 })

  // 同步外部 value 到编辑器
  useEffect(() => {
    if (!editorRef.current) return
    
    // 如果是内部更新引起的 value 变化，不重新渲染
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false
      return
    }
    
    // 外部 value 变化时更新编辑器
    if (value !== lastValue.current) {
      lastValue.current = value
      editorRef.current.innerHTML = renderToHtml(value)
    }
  }, [value])

  // 初始化
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = renderToHtml(value)
    }
  }, [])

  // 通知外部 value 变化
  const emitChange = useCallback(() => {
    if (!editorRef.current) return
    
    const newValue = extractValue(editorRef.current)
    if (newValue !== lastValue.current) {
      lastValue.current = newValue
      isInternalUpdate.current = true
      onChange(newValue)
    }
  }, [onChange])

  // 处理输入事件
  const handleInput = useCallback(() => {
    if (isComposing.current) return
    emitChange()
  }, [emitChange])

  // 处理粘贴事件 - 只粘贴纯文本
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
    emitChange()
  }, [emitChange])

  // 处理按键事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const editor = editorRef.current
    if (!editor) return
    
    // 如果选择器打开，阻止 Tab 和 Enter 键
    if (showPicker) {
      if (e.key === 'Tab' || e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowPicker(false)
        return
      }
    }
    
    // 输入 / 时显示变量选择器（仅当有节点数据时）
    if (e.key === '/' && !isComposing.current && nodes.length > 0) {
      // 延迟一点，等待 / 字符被插入后获取位置
      setTimeout(() => {
        const pos = getCaretPosition()
        if (pos) {
          // 删除刚输入的 /
          removeSlashBeforeCaret()
          emitChange()
          
          setPickerPosition(pos)
          setShowPicker(true)
        }
      }, 0)
      return
    }
    
    // Tab 键插入空格
    if (e.key === 'Tab') {
      e.preventDefault()
      document.execCommand('insertText', false, '  ')
      return
    }
    
    // 处理退格键和删除键 - 整体删除变量标签
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return
      
      const range = selection.getRangeAt(0)
      
      // 如果有选中内容，让浏览器默认处理
      if (!range.collapsed) return
      
      const container = range.startContainer
      const offset = range.startOffset
      
      // 检查光标是否紧邻变量标签
      if (e.key === 'Backspace') {
        // 退格：检查光标前面是否是变量标签
        let prevNode: Node | null = null
        
        if (container.nodeType === Node.TEXT_NODE && offset === 0) {
          // 光标在文本节点开头，检查前一个兄弟
          prevNode = container.previousSibling
        } else if (container.nodeType === Node.ELEMENT_NODE) {
          // 光标在元素节点中
          const children = container.childNodes
          if (offset > 0) {
            prevNode = children[offset - 1]
          }
        }
        
        if (prevNode && prevNode.nodeType === Node.ELEMENT_NODE) {
          const el = prevNode as HTMLElement
          if (el.classList?.contains('prompt-var')) {
            e.preventDefault()
            el.remove()
            emitChange()
            return
          }
        }
      } else if (e.key === 'Delete') {
        // 删除：检查光标后面是否是变量标签
        let nextNode: Node | null = null
        
        if (container.nodeType === Node.TEXT_NODE) {
          const textLength = container.textContent?.length || 0
          if (offset === textLength) {
            nextNode = container.nextSibling
          }
        } else if (container.nodeType === Node.ELEMENT_NODE) {
          const children = container.childNodes
          if (offset < children.length) {
            nextNode = children[offset]
          }
        }
        
        if (nextNode && nextNode.nodeType === Node.ELEMENT_NODE) {
          const el = nextNode as HTMLElement
          if (el.classList?.contains('prompt-var')) {
            e.preventDefault()
            el.remove()
            emitChange()
            return
          }
        }
      }
    }
  }, [emitChange, showPicker, nodes])

  // 处理中文输入法
  const handleCompositionStart = useCallback(() => {
    isComposing.current = true
  }, [])

  const handleCompositionEnd = useCallback(() => {
    isComposing.current = false
    emitChange()
  }, [emitChange])

  // 处理聚焦
  const handleFocus = useCallback(() => {
    // 可以在这里添加聚焦时的逻辑
  }, [])

  // 处理失焦
  const handleBlur = useCallback(() => {
    // 延迟关闭选择器，以便能够点击选择器中的选项
    setTimeout(() => {
      // 检查焦点是否在选择器内
      const activeElement = document.activeElement
      const picker = document.querySelector('.variable-picker')
      if (picker && picker.contains(activeElement)) {
        return
      }
      setShowPicker(false)
    }, 150)
  }, [])

  // 暴露插入变量的方法
  const insertVariable = useCallback((variable: string) => {
    if (editorRef.current) {
      insertVariableAtCursor(editorRef.current, variable)
      emitChange()
    }
  }, [emitChange])

  // 将 insertVariable 挂载到 DOM 元素上供外部调用
  useEffect(() => {
    if (editorRef.current) {
      (editorRef.current as any).insertVariable = insertVariable
    }
  }, [insertVariable])

  // 处理变量选择
  const handleSelectVariable = useCallback((variable: string) => {
    setShowPicker(false)
    if (editorRef.current) {
      editorRef.current.focus()
      insertVariableAtCursor(editorRef.current, variable)
      emitChange()
    }
  }, [emitChange])

  return (
    <div className="relative">
      <div
        ref={editorRef}
        id={id}
        contentEditable={!disabled}
        suppressContentEditableWarning
        className={cn(
          'prompt-editor',
          'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50',
          'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
          'dark:bg-input/30 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs',
          'transition-[color,box-shadow] outline-none focus-visible:ring-[3px]',
          'disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          'whitespace-pre-wrap break-words overflow-auto',
          disabled && 'cursor-not-allowed opacity-50',
          className
        )}
        style={{ minHeight }}
        onInput={handleInput}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onFocus={handleFocus}
        onBlur={handleBlur}
        data-placeholder={placeholder}
      />
      
      {/* 输入 / 提示 */}
      {nodes.length > 0 && !showPicker && (
        <div className="absolute right-2 bottom-2 text-xs text-muted-foreground/50 pointer-events-none select-none">
          输入 <kbd className="px-1 py-0.5 rounded bg-muted/50 text-[10px] font-mono">/</kbd> 插入变量
        </div>
      )}
      
      {/* 变量选择器 */}
      <AnimatePresence>
        {showPicker && (
          <VariablePicker
            nodes={nodes}
            currentNodeId={currentNodeId}
            position={pickerPosition}
            onSelect={handleSelectVariable}
            onClose={() => setShowPicker(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export { renderToHtml as highlightVariables, SYSTEM_VARIABLES, VARIABLE_PATTERN }
