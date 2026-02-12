import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Sidebar } from './Sidebar'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'
import { ShortcutsDialog } from '@/components/help/ShortcutsDialog'
import { useHotkey } from '@/lib/hooks'

// 页面组件
import { HomePage } from '@/pages/HomePage'
import { ProjectPage } from '@/pages/ProjectPage'
import { WorkflowPage } from '@/pages/WorkflowPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { SettingsLibraryPage } from '@/pages/SettingsLibraryPage'
import { NewProjectPage } from '@/pages/NewProjectPage'
import { NewWorkflowPage } from '@/pages/NewWorkflowPage'
import { ExecutionHistoryPage } from '@/pages/ExecutionHistoryPage'
import { EditWorkflowPage } from '@/pages/EditWorkflowPage'
import { EditProjectPage } from '@/pages/EditProjectPage'
import { getWorkflow } from '@/lib/db'

export function MainLayout() {
  const [currentPath, setCurrentPath] = useState('/')
  const [workflowNames, setWorkflowNames] = useState<Record<string, string>>({})
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [sidebarOverlayVisible, setSidebarOverlayVisible] = useState(false)
  const overlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 判断是否为项目页面（需要自动隐藏侧边栏）
  const isProjectPage = useMemo(() => {
    const pathname = currentPath.split('?')[0]
    return pathname.startsWith('/project/')
  }, [currentPath])

  // 鼠标进入热区时显示 overlay
  const handleHotZoneEnter = useCallback(() => {
    if (overlayTimeoutRef.current) {
      clearTimeout(overlayTimeoutRef.current)
      overlayTimeoutRef.current = null
    }
    setSidebarOverlayVisible(true)
  }, [])

  // 鼠标离开 overlay 区域时延迟隐藏（防止误触）
  const handleOverlayLeave = useCallback(() => {
    overlayTimeoutRef.current = setTimeout(() => {
      setSidebarOverlayVisible(false)
    }, 200)
  }, [])

  // 鼠标重新进入 overlay 区域时取消隐藏
  const handleOverlayEnter = useCallback(() => {
    if (overlayTimeoutRef.current) {
      clearTimeout(overlayTimeoutRef.current)
      overlayTimeoutRef.current = null
    }
  }, [])

  // 路由变化时关闭 overlay
  useEffect(() => {
    setSidebarOverlayVisible(false)
  }, [currentPath])

  // 清理 timeout
  useEffect(() => {
    return () => {
      if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current)
    }
  }, [])

  // 启动时静默检查更新
  useEffect(() => {
    if (!window.__TAURI_INTERNALS__) return
    const timer = setTimeout(async () => {
      try {
        const { check } = await import('@tauri-apps/plugin-updater')
        const update = await check()
        if (update) {
          toast.info(`发现新版本 v${update.version}`, {
            description: '前往设置页面下载更新',
            action: {
              label: '前往更新',
              onClick: () => setCurrentPath('/settings'),
            },
            duration: 10000,
          })
        }
      } catch {
        // 静默失败，不打扰用户
      }
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

  const navigate = useCallback((path: string) => {
    setCurrentPath(path)
  }, [])

  // 注册 F1 快捷键打开快捷键帮助
  useHotkey({
    key: 'F1',
    handler: () => setShowShortcuts(true),
    preventDefault: true,
  })

  // 加载工作流名称（用于历史页面显示）
  useEffect(() => {
    const historyMatch = currentPath.match(/^\/project\/([^/]+)\/workflow\/([^/]+)\/history$/)
    if (historyMatch && !workflowNames[historyMatch[2]]) {
      getWorkflow(historyMatch[2]).then(workflow => {
        if (workflow) {
          setWorkflowNames(prev => ({ ...prev, [workflow.id]: workflow.name }))
        }
      })
    }
  }, [currentPath, workflowNames])

  // 解析路径和查询参数
  const parsePathAndQuery = (path: string) => {
    const [pathname, queryString] = path.split('?')
    const params = new URLSearchParams(queryString || '')
    return { pathname, params }
  }

  // 简单的路由匹配
  const renderPage = () => {
    const { pathname, params } = parsePathAndQuery(currentPath)

    if (pathname === '/') {
      return <HomePage onNavigate={navigate} />
    }

    if (pathname === '/settings') {
      return <SettingsPage onNavigate={navigate} />
    }

    if (pathname === '/project/new') {
      return <NewProjectPage onNavigate={navigate} />
    }

    // 匹配 /project/:id/edit
    const editProjectMatch = pathname.match(/^\/project\/([^/]+)\/edit$/)
    if (editProjectMatch) {
      return <EditProjectPage projectId={editProjectMatch[1]} onNavigate={navigate} />
    }

    // 匹配 /project/:id/workflow/new
    const newWorkflowMatch = pathname.match(/^\/project\/([^/]+)\/workflow\/new$/)
    if (newWorkflowMatch) {
      return <NewWorkflowPage projectId={newWorkflowMatch[1]} onNavigate={navigate} />
    }

    // 匹配 /project/:id/workflow/:wid/edit
    const editWorkflowMatch = pathname.match(/^\/project\/([^/]+)\/workflow\/([^/]+)\/edit$/)
    if (editWorkflowMatch) {
      return (
        <EditWorkflowPage
          projectId={editWorkflowMatch[1]}
          workflowId={editWorkflowMatch[2]}
          onNavigate={navigate}
        />
      )
    }

    // 匹配 /project/:id/settings (设定库)
    const settingsLibraryMatch = pathname.match(/^\/project\/([^/]+)\/settings$/)
    if (settingsLibraryMatch) {
      const initialTab = params.get('tab') as 'character' | 'worldview' | 'style' | 'outline' | undefined
      return <SettingsLibraryPage projectId={settingsLibraryMatch[1]} onNavigate={navigate} initialTab={initialTab} />
    }

    // 匹配 /project/:id/workflow/:wid/history (执行历史)
    const historyMatch = pathname.match(/^\/project\/([^/]+)\/workflow\/([^/]+)\/history$/)
    if (historyMatch) {
      return (
        <ExecutionHistoryPage
          projectId={historyMatch[1]}
          workflowId={historyMatch[2]}
          workflowName={workflowNames[historyMatch[2]] || '工作流'}
          onNavigate={navigate}
        />
      )
    }

    // 匹配 /project/:id/workflow/:wid
    const workflowMatch = pathname.match(/^\/project\/([^/]+)\/workflow\/([^/]+)$/)
    if (workflowMatch) {
      return (
        <WorkflowPage
          projectId={workflowMatch[1]}
          workflowId={workflowMatch[2]}
          onNavigate={navigate}
        />
      )
    }

    // 匹配 /project/:id
    const projectMatch = pathname.match(/^\/project\/([^/]+)$/)
    if (projectMatch) {
      return <ProjectPage projectId={projectMatch[1]} onNavigate={navigate} />
    }

    return <HomePage onNavigate={navigate} />
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* 侧边栏：非项目页面正常显示 */}
      {!isProjectPage && (
        <Sidebar onNavigate={navigate} currentPath={currentPath} />
      )}

      {/* 项目页面：左侧热区 + overlay 侧边栏 */}
      {isProjectPage && (
        <>
          {/* 不可见热区：鼠标贴左边缘时触发 */}
          {!sidebarOverlayVisible && (
            <div
              className="fixed left-0 top-0 h-full w-2 z-40"
              onMouseEnter={handleHotZoneEnter}
            />
          )}

          {/* Overlay 侧边栏 */}
          <div
            className="fixed left-0 top-0 h-full z-50 transition-transform duration-200 ease-in-out"
            style={{ transform: sidebarOverlayVisible ? 'translateX(0)' : 'translateX(-100%)' }}
            onMouseLeave={handleOverlayLeave}
            onMouseEnter={handleOverlayEnter}
          >
            <div className="h-full shadow-xl">
              <Sidebar onNavigate={navigate} currentPath={currentPath} />
            </div>
          </div>
        </>
      )}

      {/* 主内容区 */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {renderPage()}
      </main>

      {/* Toast 通知 */}
      <Toaster position="top-right" richColors closeButton />

      {/* 快捷键帮助弹窗 */}
      <ShortcutsDialog
        open={showShortcuts}
        onOpenChange={setShowShortcuts}
        currentPath={currentPath}
      />
    </div>
  )
}

