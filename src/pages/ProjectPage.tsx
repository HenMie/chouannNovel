import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  FileText,
  Plus,
  Settings2,
  Users,
  Book,
  MoreVertical,
  Pencil,
  Trash2,
  Play,
  Layout,
  Download,
  Upload,
  MoreHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Header } from '@/components/layout/Header'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { useProjectStore } from '@/stores/project-store'
import { useSettingsStore } from '@/stores/settings-store'
import { exportProjectToFile, exportSettingsToFile, importSettingsFromFile } from '@/lib/import-export'
import { toast } from 'sonner'
import type { Workflow } from '@/types'

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
    deleteWorkflow,
    projectStats,
    loadProjectStats,
  } = useProjectStore()

  const { settings, loadSettings } = useSettingsStore()
  const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(null)

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
        loadSettings(project.id)
        loadProjectStats(project.id)
      }
    }

    loadData()
  }, [projectId, setCurrentProject, loadWorkflows, loadSettings])

  const characterCount = settings.filter((s) => s.category === 'character').length
  const worldCount = settings.filter((s) => s.category === 'worldview').length

  const handleDeleteWorkflow = async () => {
    if (workflowToDelete) {
      await deleteWorkflow(workflowToDelete.id)
      setWorkflowToDelete(null)
    }
  }

  // 导出项目备份
  const handleExportProject = async () => {
    if (!currentProject) return
    try {
      const success = await exportProjectToFile(currentProject.id)
      if (success) {
        toast.success('项目备份导出成功')
      }
    } catch (error) {
      toast.error('导出失败: ' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  // 导出设定库
  const handleExportSettings = async () => {
    if (!currentProject) return
    try {
      const success = await exportSettingsToFile(currentProject.id, currentProject.name)
      if (success) {
        toast.success('设定库导出成功')
      }
    } catch (error) {
      toast.error('导出失败: ' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  // 导入设定库
  const handleImportSettings = async (mode: 'merge' | 'replace') => {
    if (!currentProject) return
    try {
      const success = await importSettingsFromFile(currentProject.id, mode)
      if (success) {
        // 重新加载设定库
        loadSettings(currentProject.id)
        toast.success(mode === 'merge' ? '设定库合并导入成功' : '设定库替换导入成功')
      }
    } catch (error) {
      toast.error('导入失败: ' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  if (!currentProject) {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="flex h-14 items-center border-b px-4 gap-4">
          <Skeleton className="h-4 w-4 rounded-full" />
          <div className="flex flex-1 items-center gap-2">
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-6xl px-6 py-8">
            <div className="mb-8 grid gap-4 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-9 w-28" />
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <Header
        title={currentProject.name}
        breadcrumbs={[
          { label: '首页', href: '/' },
          { label: currentProject.name },
        ]}
        onNavigate={onNavigate}
      >
        {/* 更多操作菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportProject}>
              <Upload className="mr-2 h-4 w-4" />
              导出项目备份
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportSettings}>
              <Upload className="mr-2 h-4 w-4" />
              导出设定库
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleImportSettings('merge')}>
              <Download className="mr-2 h-4 w-4" />
              导入设定库（合并）
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleImportSettings('replace')}>
              <Download className="mr-2 h-4 w-4" />
              导入设定库（替换）
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate(`/project/${projectId}/settings`)}
        >
          <Settings2 className="mr-2 h-4 w-4" />
          设定库
        </Button>
      </Header>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-6 py-8">
          {/* 概览仪表盘 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 grid gap-4 md:grid-cols-3"
          >
            <Card
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => onNavigate(`/project/${projectId}/settings?tab=character`)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">角色设定</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{characterCount}</div>
                <p className="text-xs text-muted-foreground">
                  已创建的角色档案
                </p>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => onNavigate(`/project/${projectId}/settings?tab=worldview`)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">世界观设定</CardTitle>
                <Book className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{worldCount}</div>
                <p className="text-xs text-muted-foreground">
                  世界规则与背景设定
                </p>
              </CardContent>
            </Card>
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">工作流</CardTitle>
                <Layout className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{workflows.length}</div>
                <p className="text-xs text-muted-foreground">
                  自动化创作流程
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* 项目描述 */}
          {currentProject.description && (
             <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               className="mb-8 text-muted-foreground"
             >
               {currentProject.description}
             </motion.div>
          )}

          {/* 工作流列表 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5" />
                工作流列表
              </h2>
              <Button
                onClick={() => onNavigate(`/project/${projectId}/workflow/new`)}
              >
                <Plus className="mr-2 h-4 w-4" />
                新建工作流
              </Button>
            </div>

            {isLoadingWorkflows ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="h-full">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2 w-full">
                          <Skeleton className="h-8 w-8 rounded-md" />
                          <Skeleton className="h-5 w-1/2" />
                        </div>
                      </div>
                      <Skeleton className="h-4 w-full mt-2" />
                      <Skeleton className="h-4 w-2/3 mt-1" />
                    </CardHeader>
                    <CardContent className="pb-3">
                      <div className="flex items-center justify-between mt-2">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : workflows.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-0">
                  <EmptyState
                    icon={Layout}
                    title="暂无工作流"
                    description="工作流是 AI 创作的核心，可以包含多个步骤的自动化任务"
                    action={
                      <Button onClick={() => onNavigate(`/project/${projectId}/workflow/new`)}>
                        <Plus className="mr-2 h-4 w-4" />
                        创建第一个工作流
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {workflows.map((workflow, index) => (
                  <motion.div
                    key={workflow.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * index }}
                  >
                    <Card
                      className="group relative h-full cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
                      onClick={() => {
                        setCurrentWorkflow(workflow)
                        onNavigate(`/project/${projectId}/workflow/${workflow.id}`)
                      }}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="flex items-center gap-2 text-base leading-tight">
                            <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-600">
                              <Layout className="h-4 w-4" />
                            </div>
                            <span className="line-clamp-1">{workflow.name}</span>
                          </CardTitle>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 -mr-2 -mt-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onNavigate(
                                    `/project/${projectId}/workflow/${workflow.id}/edit`
                                  )
                                }}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                编辑
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setWorkflowToDelete(workflow)
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {workflow.description && (
                          <CardDescription className="line-clamp-2 min-h-[2.5rem] mt-2">
                            {workflow.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="pb-3">
                         <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                            <span>循环上限: {workflow.loop_max_count}</span>
                            <span>超时: {workflow.timeout_seconds}s</span>
                         </div>
                      </CardContent>
                      <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                         <Button size="icon" className="h-8 w-8 rounded-full shadow-sm">
                            <Play className="h-3.5 w-3.5 fill-current" />
                         </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      <AlertDialog
        open={!!workflowToDelete}
        onOpenChange={(open) => !open && setWorkflowToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除工作流?</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除工作流 "{workflowToDelete?.name}" 吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteWorkflow}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

