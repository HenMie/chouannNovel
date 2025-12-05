import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  BookOpen,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Layout,
  Download,
  ArrowUpDown,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { TypographyH2, TypographyMuted, TypographyH4 } from '@/components/ui/typography'
import { useProjectStore } from '@/stores/project-store'
import { importProjectFromFile } from '@/lib/import-export'
import { toast } from 'sonner'
import type { Project } from '@/types'
import { cn } from '@/lib/utils'
import { getErrorMessage, handleAppError } from '@/lib/errors'
import { Tour } from '@/components/help/Tour'
import { HOME_TOUR_STEPS } from '@/tours'
import { CreateProjectDialog } from '@/components/dialogs'

interface HomePageProps {
  onNavigate: (path: string) => void
}

function timeAgo(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (seconds < 60) return '刚刚'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  return date.toLocaleDateString('zh-CN')
}

function getAvatarColor(name: string) {
  const colors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-green-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-sky-500',
    'bg-blue-500',
    'bg-indigo-500',
    'bg-violet-500',
    'bg-purple-500',
    'bg-fuchsia-500',
    'bg-pink-500',
    'bg-rose-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export function HomePage({ onNavigate }: HomePageProps) {
  const { projects, loadProjects, isLoadingProjects, deleteProject, globalStats, loadGlobalStats } = useProjectStore()
  const [sortOrder, setSortOrder] = useState<'updated' | 'name'>('updated')
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [showCreateProjectDialog, setShowCreateProjectDialog] = useState(false)

  useEffect(() => {
    loadProjects()
    loadGlobalStats()
  }, [loadProjects, loadGlobalStats])

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      if (sortOrder === 'updated') {
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      } else {
        return a.name.localeCompare(b.name)
      }
    })
  }, [projects, sortOrder])

  const handleDeleteConfirm = async () => {
    if (projectToDelete) {
      await deleteProject(projectToDelete.id)
      setProjectToDelete(null)
    }
  }

  // 从备份导入项目
  const handleImportProject = async () => {
    try {
      const result = await importProjectFromFile()
      if (result.success && result.project) {
        // 重新加载项目列表
        loadProjects()
        toast.success(`项目 "${result.project.name}" 导入成功`)
        // 导航到新导入的项目
        onNavigate(`/project/${result.project.id}`)
      }
    } catch (error) {
      handleAppError({
        error,
        context: '导入项目',
        toastMessage: `导入失败: ${getErrorMessage(error)}`,
      })
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <Header title="首页" />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">
          {/* 欢迎区域 Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10 flex flex-col items-center text-center md:flex-row md:text-left md:justify-between"
            data-tour="home-welcome"
          >
            <div>
              <TypographyH2 className="mb-2 border-b-0">
                欢迎回来, 创作者
              </TypographyH2>
              <TypographyMuted className="max-w-lg text-base">
                继续你的创作之旅。你已经创建了 {projects.length} 个精彩的世界。
              </TypographyMuted>
            </div>
            <div className="mt-6 flex gap-4 md:mt-0" data-tour="home-stats">
              <Card className="flex flex-col items-center justify-center p-4 min-w-[120px]">
                 <span className="text-2xl font-bold">{globalStats?.active_projects || projects.length}</span>
                 <span className="text-xs text-muted-foreground">活跃项目</span>
              </Card>
              <Card className="flex flex-col items-center justify-center p-4 min-w-[120px]">
                 <span className="text-2xl font-bold">{globalStats?.today_word_count || 0}</span>
                 <span className="text-xs text-muted-foreground">今日字数</span>
              </Card>
            </div>
          </motion.div>

          {/* 操作栏 */}
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
               <TypographyH4>我的项目</TypographyH4>
            </div>
            <div className="flex items-center gap-2">
               <Select
                 value={sortOrder}
                 onValueChange={(v) => setSortOrder(v as 'updated' | 'name')}
               >
                 <SelectTrigger className="w-[140px] h-9">
                   <ArrowUpDown className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                   <SelectValue placeholder="排序方式" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="updated">最近更新</SelectItem>
                   <SelectItem value="name">名称顺序</SelectItem>
                 </SelectContent>
               </Select>
               <Button
                 variant="outline"
                 size="sm"
                 className="h-9 gap-2"
                 onClick={handleImportProject}
                 data-tour="home-import-project"
               >
                 <Download className="h-3.5 w-3.5" />
                 导入项目
               </Button>
               <Button
                  size="sm"
                  className="h-9 gap-2"
                  onClick={() => setShowCreateProjectDialog(true)}
                  data-tour="home-new-project"
               >
                 <Plus className="h-3.5 w-3.5" />
                 新建项目
               </Button>
            </div>
          </div>

          {/* 项目列表 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            data-tour="home-project-list"
          >
            {isLoadingProjects ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="h-full overflow-hidden">
                    <CardHeader className="flex flex-row items-start gap-3 pb-2">
                      <Skeleton className="h-10 w-10 rounded-md" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </CardContent>
                    <CardFooter className="bg-muted/30 px-6 py-3">
                      <div className="flex w-full justify-between">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : sortedProjects.length === 0 ? (
              <Card className="border-dashed">
                <EmptyState
                  icon={BookOpen}
                  title="开始你的第一个项目"
                  description="ChouannNovel 帮助你通过 AI 驱动的工作流构建复杂的小说世界。"
                  action={
                    <Button onClick={() => setShowCreateProjectDialog(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      创建新项目
                    </Button>
                  }
                />
              </Card>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {sortedProjects.map((project, index) => (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * index }}
                  >
                    <Card
                      data-testid="project-card"
                      data-project-id={project.id}
                      className="group relative h-full overflow-hidden transition-all hover:shadow-md hover:border-primary/50"
                      onClick={() => onNavigate(`/project/${project.id}`)}
                    >
                      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                        <div className="flex items-center gap-3">
                           <div className={cn(
                             "flex h-10 w-10 items-center justify-center rounded-md text-white font-bold text-sm shadow-sm",
                             getAvatarColor(project.name)
                           )}>
                             {project.name.slice(0, 2).toUpperCase()}
                           </div>
                           <div>
                             <CardTitle className="text-base font-semibold leading-none mb-1">
                               {project.name}
                             </CardTitle>
                             <CardDescription className="flex items-center text-xs">
                               <Clock className="mr-1 h-3 w-3" />
                               {timeAgo(project.updated_at)}
                             </CardDescription>
                           </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                              onClick={(e) => e.stopPropagation()}
                              data-testid="project-card-menu"
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
                              重命名
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation()
                                setProjectToDelete(project)
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                          {project.description || "暂无描述"}
                        </p>
                      </CardContent>
                      <CardFooter className="bg-muted/30 px-6 py-3">
                         <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                               <Layout className="h-3.5 w-3.5" />
                               <span>工作流</span>
                            </div>
                            <div className="flex items-center gap-1">
                               <BookOpen className="h-3.5 w-3.5" />
                               <span>设定</span>
                            </div>
                         </div>
                      </CardFooter>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      <AlertDialog
        open={!!projectToDelete}
        onOpenChange={(open) => !open && setProjectToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除项目?</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除项目 "{projectToDelete?.name}" 吗？这将永久删除该项目及其所有数据，无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 新建项目对话框 */}
      <CreateProjectDialog
        open={showCreateProjectDialog}
        onOpenChange={setShowCreateProjectDialog}
        onSuccess={(projectId) => onNavigate(`/project/${projectId}`)}
      />

      {/* 新手引导 */}
      <Tour module="home" steps={HOME_TOUR_STEPS} />
    </div>
  )
}

