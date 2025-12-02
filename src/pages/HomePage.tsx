import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Header } from '@/components/layout/Header'
import { useProjectStore } from '@/stores/project-store'

interface HomePageProps {
  onNavigate: (path: string) => void
}

export function HomePage({ onNavigate }: HomePageProps) {
  const { projects, loadProjects, isLoadingProjects } = useProjectStore()

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  return (
    <div className="flex h-full flex-col">
      <Header title="首页" />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl px-6 py-8">
          {/* 欢迎区域 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 text-center"
          >
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
              <Sparkles className="h-8 w-8" />
            </div>
            <h1 className="mb-2 text-3xl font-bold tracking-tight">
              欢迎使用 ChouannNovel
            </h1>
            <p className="text-muted-foreground">
              AI 驱动的小说创作工作流软件，让创作更高效
            </p>
          </motion.div>

          {/* 快速开始 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <Card className="border-dashed">
              <CardHeader className="text-center">
                <CardTitle className="text-lg">快速开始</CardTitle>
                <CardDescription>
                  创建你的第一个小说项目，开启 AI 辅助创作之旅
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Button
                  size="lg"
                  className="gap-2"
                  onClick={() => onNavigate('/project/new')}
                >
                  <Plus className="h-5 w-5" />
                  新建项目
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* 最近项目 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="mb-4 text-lg font-semibold">最近项目</h2>

            {isLoadingProjects ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : projects.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="mb-2 text-muted-foreground">暂无项目</p>
                  <p className="text-sm text-muted-foreground/70">
                    点击上方按钮创建你的第一个项目
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {projects.slice(0, 6).map((project, index) => (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * index }}
                  >
                    <Card
                      className="cursor-pointer transition-colors hover:bg-accent"
                      onClick={() => onNavigate(`/project/${project.id}`)}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{project.name}</CardTitle>
                        {project.description && (
                          <CardDescription className="line-clamp-2">
                            {project.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground">
                          更新于{' '}
                          {new Date(project.updated_at).toLocaleDateString('zh-CN', {
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

