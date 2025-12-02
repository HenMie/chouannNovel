import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { FileText, Plus, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Header } from '@/components/layout/Header'
import { useProjectStore } from '@/stores/project-store'

interface ProjectPageProps {
  projectId: string
  onNavigate: (path: string) => void
}

export function ProjectPage({ projectId, onNavigate }: ProjectPageProps) {
  const {
    currentProject,
    workflows,
    isLoadingWorkflows,
    loadWorkflows,
    setCurrentProject,
    setCurrentWorkflow,
  } = useProjectStore()

  useEffect(() => {
    // 加载项目和工作流
    const loadData = async () => {
      const { projects, loadProjects } = useProjectStore.getState()
      if (projects.length === 0) {
        await loadProjects()
      }

      const project = useProjectStore.getState().projects.find((p) => p.id === projectId)
      if (project) {
        setCurrentProject(project)
        loadWorkflows(project.id)
      }
    }

    loadData()
  }, [projectId, setCurrentProject, loadWorkflows])

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <Header title={currentProject.name}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigate(`/project/${projectId}/settings`)}
        >
          <Settings2 className="mr-2 h-4 w-4" />
          设定库
        </Button>
      </Header>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl px-6 py-8">
          {/* 项目信息 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            {currentProject.description && (
              <p className="mb-4 text-muted-foreground">{currentProject.description}</p>
            )}
          </motion.div>

          {/* 工作流列表 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">工作流</h2>
              <Button
                size="sm"
                onClick={() => onNavigate(`/project/${projectId}/workflow/new`)}
              >
                <Plus className="mr-2 h-4 w-4" />
                新建工作流
              </Button>
            </div>

            {isLoadingWorkflows ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : workflows.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="mb-2 text-muted-foreground">暂无工作流</p>
                  <p className="text-sm text-muted-foreground/70">
                    工作流是 AI 创作的核心，点击上方按钮创建
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {workflows.map((workflow, index) => (
                  <motion.div
                    key={workflow.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * index }}
                  >
                    <Card
                      className="cursor-pointer transition-colors hover:bg-accent"
                      onClick={() => {
                        setCurrentWorkflow(workflow)
                        onNavigate(`/project/${projectId}/workflow/${workflow.id}`)
                      }}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <FileText className="h-4 w-4 text-blue-500" />
                          {workflow.name}
                        </CardTitle>
                        {workflow.description && (
                          <CardDescription className="line-clamp-2">
                            {workflow.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground">
                          更新于{' '}
                          {new Date(workflow.updated_at).toLocaleDateString('zh-CN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}

