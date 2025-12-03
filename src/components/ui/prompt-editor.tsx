// 提示词编辑器组件
// 支持 {{变量名}} 语法高亮

import * as React from 'react'
import { useRef, useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

// 变量匹配正则表达式
const VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g

// 内置变量列表
const BUILTIN_VARIABLES = ['input', 'previous', '上一节点']

interface PromptEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
  disabled?: boolean
  id?: string
}

// 将文本中的变量转换为高亮 HTML
function highlightVariables(text: string): string {
  if (!text) return ''
  
  // 转义 HTML 特殊字符
  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')

  // 分割文本，保留变量
  const parts: string[] = []
  let lastIndex = 0
  let match

  // 重置正则表达式
  const pattern = new RegExp(VARIABLE_PATTERN.source, 'g')

  while ((match = pattern.exec(text)) !== null) {
    // 添加匹配前的文本
    if (match.index > lastIndex) {
      parts.push(escapeHtml(text.slice(lastIndex, match.index)))
    }

    // 添加高亮的变量
    const varName = match[1].trim()
    const isBuiltin = BUILTIN_VARIABLES.includes(varName)
    const colorClass = isBuiltin ? 'prompt-var-builtin' : 'prompt-var-custom'
    parts.push(
      `<span class="prompt-var ${colorClass}" data-variable="${escapeHtml(varName)}">{{${escapeHtml(varName)}}}</span>`
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

// 从 HTML 中提取纯文本
function htmlToPlainText(html: string): string {
  // 创建临时元素
  const temp = document.createElement('div')
  temp.innerHTML = html
  
  // 处理 <br> 标签为换行符
  temp.querySelectorAll('br').forEach((br) => {
    br.replaceWith('\n')
  })
  
  // 处理 <div> 标签为换行符（某些浏览器会用 div 包裹行）
  temp.querySelectorAll('div').forEach((div) => {
    if (div.previousSibling) {
      div.insertBefore(document.createTextNode('\n'), div.firstChild)
    }
  })

  return temp.textContent || ''
}

// 获取光标位置
function getCaretPosition(element: HTMLElement): number {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return 0

  const range = selection.getRangeAt(0)
  const preCaretRange = range.cloneRange()
  preCaretRange.selectNodeContents(element)
  preCaretRange.setEnd(range.endContainer, range.endOffset)
  
  // 计算纯文本位置
  const tempDiv = document.createElement('div')
  tempDiv.appendChild(preCaretRange.cloneContents())
  
  // 将 br 转换为换行符
  tempDiv.querySelectorAll('br').forEach((br) => {
    br.replaceWith('\n')
  })
  
  return tempDiv.textContent?.length || 0
}

// 设置光标位置
function setCaretPosition(element: HTMLElement, position: number): void {
  const selection = window.getSelection()
  if (!selection) return

  const range = document.createRange()
  
  // 遍历节点找到正确的位置
  let currentPos = 0
  let targetNode: Node | null = null
  let targetOffset = 0
  let found = false

  const walkNodes = (node: Node) => {
    if (found) return

    if (node.nodeType === Node.TEXT_NODE) {
      const textLength = node.textContent?.length || 0
      if (currentPos + textLength >= position) {
        targetNode = node
        targetOffset = position - currentPos
        found = true
        return
      }
      currentPos += textLength
    } else if (node.nodeName === 'BR') {
      if (currentPos >= position) {
        targetNode = node.parentNode
        targetOffset = Array.from(node.parentNode?.childNodes || []).indexOf(node as ChildNode)
        found = true
        return
      }
      currentPos += 1
    } else {
      for (const child of Array.from(node.childNodes)) {
        walkNodes(child)
        if (found) return
      }
    }
  }

  walkNodes(element)

  if (targetNode) {
    try {
      range.setStart(targetNode, targetOffset)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
    } catch {
      // 如果设置位置失败，将光标移动到末尾
      range.selectNodeContents(element)
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
    }
  } else {
    // 如果没找到位置，将光标移动到末尾
    range.selectNodeContents(element)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }
}

export function PromptEditor({
  value,
  onChange,
  placeholder,
  className,
  minHeight = '120px',
  disabled = false,
  id,
}: PromptEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [isFocused, setIsFocused] = useState(false)
  const isComposing = useRef(false)
  const lastValue = useRef(value)

  // 更新编辑器内容（高亮显示）
  const updateHighlight = useCallback(() => {
    if (!editorRef.current) return
    
    const caretPos = getCaretPosition(editorRef.current)
    editorRef.current.innerHTML = highlightVariables(value)
    
    // 只在聚焦时恢复光标位置
    if (isFocused) {
      setCaretPosition(editorRef.current, caretPos)
    }
  }, [value, isFocused])

  // 当 value 改变时更新高亮（仅当非输入引起的变化时）
  useEffect(() => {
    if (value !== lastValue.current) {
      lastValue.current = value
      updateHighlight()
    }
  }, [value, updateHighlight])

  // 初始化时设置内容
  useEffect(() => {
    if (editorRef.current && !isFocused) {
      editorRef.current.innerHTML = highlightVariables(value)
    }
  }, [])

  // 处理输入事件
  const handleInput = useCallback(() => {
    if (!editorRef.current || isComposing.current) return

    const newValue = htmlToPlainText(editorRef.current.innerHTML)
    lastValue.current = newValue
    onChange(newValue)
  }, [onChange])

  // 处理粘贴事件 - 只粘贴纯文本
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
  }, [])

  // 处理按键事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // 处理 Tab 键
    if (e.key === 'Tab') {
      e.preventDefault()
      document.execCommand('insertText', false, '  ')
    }
  }, [])

  // 处理中文输入法
  const handleCompositionStart = useCallback(() => {
    isComposing.current = true
  }, [])

  const handleCompositionEnd = useCallback(() => {
    isComposing.current = false
    handleInput()
  }, [handleInput])

  // 处理聚焦
  const handleFocus = useCallback(() => {
    setIsFocused(true)
  }, [])

  // 处理失焦 - 更新高亮
  const handleBlur = useCallback(() => {
    setIsFocused(false)
    // 失焦时更新高亮
    if (editorRef.current) {
      editorRef.current.innerHTML = highlightVariables(value)
    }
  }, [value])

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
          'font-mono whitespace-pre-wrap break-words overflow-auto',
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
      {/* 占位符 */}
      {!value && placeholder && (
        <div className="pointer-events-none absolute left-3 top-2 text-muted-foreground text-sm md:text-sm">
          {placeholder}
        </div>
      )}
    </div>
  )
}

export { highlightVariables, BUILTIN_VARIABLES, VARIABLE_PATTERN }

