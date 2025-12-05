import { useEffect } from 'react'
import { MainLayout } from '@/components/layout/MainLayout'
import { AppErrorBoundary } from '@/components/layout/AppErrorBoundary'
import { GlobalErrorListener } from '@/components/layout/GlobalErrorListener'
import { useThemeStore } from '@/stores/theme-store'

function App() {
  const { theme } = useThemeStore()

  // 初始化主题
  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      root.classList.add(systemTheme)
    } else {
      root.classList.add(theme)
    }
  }, [theme])

  // 禁用浏览器默认右键菜单（Tauri 桌面应用不需要浏览器菜单）
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // 检查是否点击在 Radix UI 的 ContextMenu 触发器上
      // Radix UI 会自己处理这些事件，不需要我们干预
      const target = e.target as HTMLElement
      const isContextMenuTrigger = target.closest('[data-slot="context-menu-trigger"]')
      
      // 如果不是 ContextMenu 触发器，阻止默认的浏览器右键菜单
      if (!isContextMenuTrigger) {
        e.preventDefault()
      }
    }

    document.addEventListener('contextmenu', handleContextMenu)
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [])

  return (
    <AppErrorBoundary>
      <GlobalErrorListener />
      <MainLayout />
    </AppErrorBoundary>
  )
}

export default App
