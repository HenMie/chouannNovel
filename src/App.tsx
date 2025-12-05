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

  return (
    <AppErrorBoundary>
      <GlobalErrorListener />
      <MainLayout />
    </AppErrorBoundary>
  )
}

export default App
