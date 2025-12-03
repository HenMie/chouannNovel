// 快捷键 Hook
// 支持组合键（Ctrl+S, Ctrl+Enter 等）

import { useEffect, useCallback, useRef } from 'react'

// 快捷键配置类型
export interface HotkeyConfig {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  handler: () => void
  enabled?: boolean
  preventDefault?: boolean
}

// 检查快捷键是否匹配
function matchHotkey(event: KeyboardEvent, config: HotkeyConfig): boolean {
  // 检查修饰键
  const ctrlMatch = config.ctrl === undefined ? true : event.ctrlKey === config.ctrl
  const shiftMatch = config.shift === undefined ? true : event.shiftKey === config.shift
  const altMatch = config.alt === undefined ? true : event.altKey === config.alt
  const metaMatch = config.meta === undefined ? true : event.metaKey === config.meta

  // 如果配置了任何修饰键，需要精确匹配
  if (config.ctrl !== undefined || config.shift !== undefined || 
      config.alt !== undefined || config.meta !== undefined) {
    if (!ctrlMatch || !shiftMatch || !altMatch || !metaMatch) {
      return false
    }
  }

  // 检查按键
  return event.key.toLowerCase() === config.key.toLowerCase()
}

// 单个快捷键 Hook
export function useHotkey(config: HotkeyConfig): void {
  const configRef = useRef(config)
  configRef.current = config

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const current = configRef.current
      
      // 检查是否启用
      if (current.enabled === false) return

      // 忽略输入元素中的快捷键（除非是特定的全局快捷键）
      const target = event.target as HTMLElement
      const isInputElement = 
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable

      // 对于 Escape 键，总是允许
      if (current.key.toLowerCase() !== 'escape' && isInputElement) {
        // 只允许带有 Ctrl 或 Meta 的组合键在输入框中生效
        if (!event.ctrlKey && !event.metaKey) {
          return
        }
      }

      if (matchHotkey(event, current)) {
        if (current.preventDefault !== false) {
          event.preventDefault()
        }
        current.handler()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}

// 多个快捷键 Hook
export function useHotkeys(configs: HotkeyConfig[]): void {
  const configsRef = useRef(configs)
  configsRef.current = configs

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const currentConfigs = configsRef.current
      
      // 忽略输入元素中的快捷键
      const target = event.target as HTMLElement
      const isInputElement = 
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable

      for (const config of currentConfigs) {
        // 检查是否启用
        if (config.enabled === false) continue

        // 对于非 Escape 键，检查是否在输入框中
        if (config.key.toLowerCase() !== 'escape' && isInputElement) {
          if (!event.ctrlKey && !event.metaKey) {
            continue
          }
        }

        if (matchHotkey(event, config)) {
          if (config.preventDefault !== false) {
            event.preventDefault()
          }
          config.handler()
          break // 只执行第一个匹配的快捷键
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}

// 预定义的快捷键类型
export const HOTKEY_PRESETS = {
  // 保存: Ctrl+S / Cmd+S
  save: (handler: () => void, enabled = true): HotkeyConfig => ({
    key: 's',
    ctrl: true,
    handler,
    enabled,
  }),
  
  // 运行: Ctrl+Enter
  run: (handler: () => void, enabled = true): HotkeyConfig => ({
    key: 'Enter',
    ctrl: true,
    handler,
    enabled,
  }),
  
  // 暂停/继续: Space (仅在非输入状态)
  togglePause: (handler: () => void, enabled = true): HotkeyConfig => ({
    key: ' ',
    handler,
    enabled,
    preventDefault: true,
  }),
  
  // 关闭/取消: Escape
  escape: (handler: () => void, enabled = true): HotkeyConfig => ({
    key: 'Escape',
    handler,
    enabled,
  }),
  
  // 新建: Ctrl+N
  new: (handler: () => void, enabled = true): HotkeyConfig => ({
    key: 'n',
    ctrl: true,
    handler,
    enabled,
  }),
  
  // 复制: Ctrl+C
  copy: (handler: () => void, enabled = true): HotkeyConfig => ({
    key: 'c',
    ctrl: true,
    handler,
    enabled,
  }),
  
  // 粘贴: Ctrl+V
  paste: (handler: () => void, enabled = true): HotkeyConfig => ({
    key: 'v',
    ctrl: true,
    handler,
    enabled,
  }),
}

export default useHotkeys

