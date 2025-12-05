import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FileText,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Settings,
  Search,
  ChevronsDown,
  ChevronsUp,
  Keyboard,
  GraduationCap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useProjectStore } from '@/stores/project-store'
import { useTourStore, type TourModule } from '@/stores/tour-store'
import { cn } from '@/lib/utils'
import type { Project, Workflow } from '@/types'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface SidebarProps {
  onNavigate: (path: string) => void
  currentPath: string
}

interface DeleteDialogState {
  open: boolean
  type: 'project' | 'workflow'
  data: Project | Workflow | null
}

export function Sidebar({ onNavigate, currentPath }: SidebarProps) {
  const {
    projects,
    currentProject,
    workflows,
    currentWorkflow,
    isLoadingProjects,
    loadProjects,
    loadWorkflows,
    setCurrentProject,
    setCurrentWorkflow,
    deleteProject,
    deleteWorkflow,
  } = useProjectStore()
  
  const { startTour, resetTour } = useTourStore()

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({
    open: false,
    type: 'project',
    data: null,
  })

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // 当选中项目时加载工作流
  useEffect(() => {
    if (currentProject) {
      loadWorkflows(currentProject.id)
      setExpandedProjects((prev) => new Set(prev).add(currentProject.id))
    }
  }, [currentProject, loadWorkflows])

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

  const expandAll = () => {
    setExpandedProjects(new Set(projects.map((p) => p.id)))
  }

  const collapseAll = () => {
    setExpandedProjects(new Set())
  }

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects
    return projects.filter((project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [projects, searchQuery])

  const handleProjectClick = (project: Project) => {
    setCurrentProject(project)
    onNavigate(`/project/${project.id}`)
  }

  const handleWorkflowClick = (workflow: Workflow) => {
    setCurrentWorkflow(workflow)
    onNavigate(`/project/${workflow.project_id}/workflow/${workflow.id}`)
  }

  const handleDeleteClick = (
    e: React.MouseEvent,
    type: 'project' | 'workflow',
    data: Project | Workflow
  ) => {
    e.stopPropagation()
    setDeleteDialog({ open: true, type, data })
  }

  const handleConfirmDelete = async () => {
    const { type, data } = deleteDialog
    if (!data) return

    if (type === 'project') {
      await deleteProject(data.id)
      if (currentProject?.id === data.id) {
        onNavigate('/')
      }
    } else {
      // 类型守卫：workflow 类型的 data 一定有 project_id 属性
      const workflowData = data as Workflow
      await deleteWorkflow(workflowData.id)
      if (currentWorkflow?.id === workflowData.id) {
        onNavigate(`/project/${workflowData.project_id}`)
      }
    }
    setDeleteDialog({ open: false, type: 'project', data: null })
  }

  return (
    <div className="flex h-full w-64 flex-col border-r bg-sidebar">
      {/* 头部 */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <h1 className="text-lg font-semibold tracking-tight">ChouannNovel</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onNavigate('/settings')}
          className="h-8 w-8"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* 搜索和操作栏 */}
      <div className="flex flex-col gap-2 p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索项目..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-8"
          />
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 flex-1 px-2 text-xs"
            onClick={expandAll}
          >
            <ChevronsDown className="mr-1 h-3 w-3" />
            全部展开
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 flex-1 px-2 text-xs"
            onClick={collapseAll}
          >
            <ChevronsUp className="mr-1 h-3 w-3" />
            全部折叠
          </Button>
        </div>
      </div>

      {/* 项目列表 */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* 新建项目按钮 */}
          <Button
            variant="outline"
            className="mb-2 w-full justify-start gap-2"
            onClick={() => onNavigate('/project/new')}
          >
            <Plus className="h-4 w-4" />
            新建项目
          </Button>

          {isLoadingProjects ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                 <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                    <Skeleton className="h-5 w-5 rounded-md" />
                    <Skeleton className="h-4 flex-1" />
                 </div>
              ))}
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {searchQuery ? '无匹配项目' : '暂无项目'}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredProjects.map((project) => (
                <div key={project.id}>
                  {/* 项目项 */}
                  <div
                    className={cn(
                      'group flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 hover:bg-accent transition-colors',
                      currentProject?.id === project.id && 'bg-accent border-l-2 border-primary pl-1.5'
                    )}
                    onClick={() => handleProjectClick(project)}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleProject(project.id)
                      }}
                    >
                      {expandedProjects.has(project.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    {expandedProjects.has(project.id) ? (
                      <FolderOpen className="h-4 w-4 text-amber-500" />
                    ) : (
                      <Folder className="h-4 w-4 text-amber-500" />
                    )}
                    <span className="flex-1 truncate text-sm">{project.name}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onNavigate(`/project/${project.id}/edit`)
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => handleDeleteClick(e, 'project', project)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* 工作流列表 */}
                  <AnimatePresence>
                    {expandedProjects.has(project.id) && currentProject?.id === project.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="ml-4 overflow-hidden border-l border-border pl-2 my-1"
                      >
                        {/* 新建工作流按钮 */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mb-1 w-full justify-start gap-2 text-muted-foreground h-7 text-xs"
                          onClick={() => onNavigate(`/project/${project.id}/workflow/new`)}
                        >
                          <Plus className="h-3 w-3" />
                          新建工作流
                        </Button>

                        {workflows.map((workflow) => (
                          <div
                            key={workflow.id}
                            className={cn(
                              'group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent transition-colors',
                              currentWorkflow?.id === workflow.id && 'bg-accent text-accent-foreground'
                            )}
                            onClick={() => handleWorkflowClick(workflow)}
                          >
                            <FileText className="h-4 w-4 text-blue-500" />
                            <span className="flex-1 truncate text-sm">
                              {workflow.name}
                            </span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
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
                                      `/project/${project.id}/workflow/${workflow.id}/edit`
                                    )
                                  }}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  编辑
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={(e) => handleDeleteClick(e, 'workflow', workflow)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  删除
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 底部帮助区域 */}
      <div className="border-t p-2">
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 h-8 text-xs justify-start"
                onClick={() => {
                  // 根据当前路径确定要启动的 Tour
                  let module: TourModule = 'home'
                  if (currentPath.includes('/workflow/')) {
                    module = 'workflow'
                  } else if (currentPath.includes('/settings-library') || currentPath.includes('/settings')) {
                    module = currentPath.includes('/settings-library') ? 'settings' : 'ai_config'
                  }
                  resetTour(module)
                  startTour(module)
                }}
              >
                <GraduationCap className="mr-2 h-3.5 w-3.5" />
                开始引导
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">重新开始当前页面的新手引导</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
              >
                <Keyboard className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">按 F1 查看快捷键</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) =>
          setDeleteDialog((prev) => ({ ...prev, open }))
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              确认删除{deleteDialog.type === 'project' ? '项目' : '工作流'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog.type === 'project'
                ? `您确定要删除项目 "${deleteDialog.data?.name}" 吗？这将永久删除该项目及其所有相关的工作流和数据，无法撤销。`
                : `您确定要删除工作流 "${deleteDialog.data?.name}" 吗？此操作无法撤销。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

