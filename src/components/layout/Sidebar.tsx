import { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useProjectStore } from '@/stores/project-store'
import { cn } from '@/lib/utils'
import type { Project, Workflow } from '@/types'

interface SidebarProps {
  onNavigate: (path: string) => void
  currentPath: string
}

export function Sidebar({ onNavigate, currentPath: _currentPath }: SidebarProps) {
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

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())

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

  const handleProjectClick = (project: Project) => {
    setCurrentProject(project)
    onNavigate(`/project/${project.id}`)
  }

  const handleWorkflowClick = (workflow: Workflow) => {
    setCurrentWorkflow(workflow)
    onNavigate(`/project/${workflow.project_id}/workflow/${workflow.id}`)
  }

  const handleDeleteProject = async (e: React.MouseEvent, project: Project) => {
    e.stopPropagation()
    if (confirm(`确定要删除项目 "${project.name}" 吗？这将删除所有相关的工作流和数据。`)) {
      await deleteProject(project.id)
      if (currentProject?.id === project.id) {
        onNavigate('/')
      }
    }
  }

  const handleDeleteWorkflow = async (e: React.MouseEvent, workflow: Workflow) => {
    e.stopPropagation()
    if (confirm(`确定要删除工作流 "${workflow.name}" 吗？`)) {
      await deleteWorkflow(workflow.id)
      if (currentWorkflow?.id === workflow.id) {
        onNavigate(`/project/${workflow.project_id}`)
      }
    }
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
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : projects.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              暂无项目
            </div>
          ) : (
            <div className="space-y-1">
              {projects.map((project) => (
                <div key={project.id}>
                  {/* 项目项 */}
                  <div
                    className={cn(
                      'group flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 hover:bg-accent',
                      currentProject?.id === project.id && 'bg-accent'
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
                          onClick={(e) => handleDeleteProject(e, project)}
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
                        className="ml-4 overflow-hidden"
                      >
                        {/* 新建工作流按钮 */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="my-1 w-full justify-start gap-2 text-muted-foreground"
                          onClick={() => onNavigate(`/project/${project.id}/workflow/new`)}
                        >
                          <Plus className="h-3 w-3" />
                          新建工作流
                        </Button>

                        {workflows.map((workflow) => (
                          <div
                            key={workflow.id}
                            className={cn(
                              'group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent',
                              currentWorkflow?.id === workflow.id && 'bg-accent'
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
                                  onClick={(e) => handleDeleteWorkflow(e, workflow)}
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
    </div>
  )
}

