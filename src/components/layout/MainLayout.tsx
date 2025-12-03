import { useState, useCallback, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { Toaster } from '@/components/ui/sonner'

// 页面组件
import { HomePage } from '@/pages/HomePage'
import { ProjectPage } from '@/pages/ProjectPage'
import { WorkflowPage } from '@/pages/WorkflowPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { SettingsLibraryPage } from '@/pages/SettingsLibraryPage'
import { NewProjectPage } from '@/pages/NewProjectPage'
import { NewWorkflowPage } from '@/pages/NewWorkflowPage'
import { ExecutionHistoryPage } from '@/pages/ExecutionHistoryPage'
import { getWorkflow } from '@/lib/db'

export function MainLayout() {
  const [currentPath, setCurrentPath] = useState('/')
  const [workflowNames, setWorkflowNames] = useState<Record<string, string>>({})

  const navigate = useCallback((path: string) => {
    setCurrentPath(path)
  }, [])

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

  // 简单的路由匹配
  const renderPage = () => {
    if (currentPath === '/') {
      return <HomePage onNavigate={navigate} />
    }

    if (currentPath === '/settings') {
      return <SettingsPage onNavigate={navigate} />
    }

    if (currentPath === '/project/new') {
      return <NewProjectPage onNavigate={navigate} />
    }

    // 匹配 /project/:id/workflow/new
    const newWorkflowMatch = currentPath.match(/^\/project\/([^/]+)\/workflow\/new$/)
    if (newWorkflowMatch) {
      return <NewWorkflowPage projectId={newWorkflowMatch[1]} onNavigate={navigate} />
    }

    // 匹配 /project/:id/settings (设定库)
    const settingsLibraryMatch = currentPath.match(/^\/project\/([^/]+)\/settings$/)
    if (settingsLibraryMatch) {
      return <SettingsLibraryPage projectId={settingsLibraryMatch[1]} onNavigate={navigate} />
    }

    // 匹配 /project/:id/workflow/:wid/history (执行历史)
    const historyMatch = currentPath.match(/^\/project\/([^/]+)\/workflow\/([^/]+)\/history$/)
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
    const workflowMatch = currentPath.match(/^\/project\/([^/]+)\/workflow\/([^/]+)$/)
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
    const projectMatch = currentPath.match(/^\/project\/([^/]+)$/)
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
      <Toaster position="top-right" />
    </div>
  )
}

