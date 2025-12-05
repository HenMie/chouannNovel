import { useState, useCallback, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { Toaster } from '@/components/ui/sonner'
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
      {/* 侧边栏 */}
      <Sidebar onNavigate={navigate} currentPath={currentPath} />

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

