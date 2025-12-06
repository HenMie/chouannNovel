import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Header } from '@/components/layout/Header'
import { useProjectStore } from '@/stores/project-store'
import { getErrorMessage, handleAppError } from '@/lib/errors'
import { toast } from 'sonner'

interface EditProjectPageProps {
  projectId: string
  onNavigate: (path: string) => void
}

export function EditProjectPage({ projectId, onNavigate }: EditProjectPageProps) {
  const { projects, loadProjects, updateProject } = useProjectStore()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // 加载项目数据
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      if (projects.length === 0) {
        await loadProjects()
      }
      const project = useProjectStore.getState().projects.find((p) => p.id === projectId)
      if (project) {
        setName(project.name)
        setDescription(project.description || '')
      } else {
        toast.error('项目不存在')
        onNavigate('/')
      }
      setIsLoading(false)
    }
    loadData()
  }, [projectId, projects.length, loadProjects, onNavigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('请输入项目名称')
      return
    }

    setIsSaving(true)
    try {
      await updateProject(projectId, {
        name: name.trim(),
        description: description.trim() || undefined,
      })
      toast.success('项目已更新')
      onNavigate(`/project/${projectId}`)
    } catch (error) {
      handleAppError({
        error,
        context: '更新项目',
        toastMessage: `更新项目失败：${getErrorMessage(error)}`,
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <Header title="编辑项目">
        <Button variant="ghost" size="sm" onClick={() => onNavigate(`/project/${projectId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>
      </Header>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-lg px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>编辑项目</CardTitle>
                <CardDescription>
                  修改项目名称和描述
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">项目名称 *</Label>
                    <Input
                      id="name"
                      placeholder="例如：我的新小说"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoFocus
                      autoComplete="off"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">项目描述</Label>
                    <Textarea
                      id="description"
                      placeholder="简单描述一下这个项目..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      autoComplete="off"
                    />
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onNavigate(`/project/${projectId}`)}
                    >
                      取消
                    </Button>
                    <Button type="submit" disabled={isSaving || !name.trim()}>
                      {isSaving ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          保存中...
                        </>
                      ) : (
                        '保存'
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

