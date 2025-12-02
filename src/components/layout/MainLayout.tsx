import { useState, useCallback } from 'react'
import { Sidebar } from './Sidebar'
import { Toaster } from '@/components/ui/sonner'

// 页面组件
import { HomePage } from '@/pages/HomePage'
import { ProjectPage } from '@/pages/ProjectPage'
import { WorkflowPage } from '@/pages/WorkflowPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { NewProjectPage } from '@/pages/NewProjectPage'
import { NewWorkflowPage } from '@/pages/NewWorkflowPage'

export function MainLayout() {
  const [currentPath, setCurrentPath] = useState('/')

  const navigate = useCallback((path: string) => {
    setCurrentPath(path)
  }, [])

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

