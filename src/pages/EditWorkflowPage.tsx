import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Header } from '@/components/layout/Header'
import { useProjectStore } from '@/stores/project-store'
import { toast } from 'sonner'
import { getWorkflow } from '@/lib/db'

interface EditWorkflowPageProps {
  projectId: string
  workflowId: string
  onNavigate: (path: string) => void
}

export function EditWorkflowPage({ projectId, workflowId, onNavigate }: EditWorkflowPageProps) {
  const {
    currentProject,
    projects,
    workflows,
    loadProjects,
    setCurrentProject,
    updateWorkflow,
  } = useProjectStore()

  const workflowFromStore = workflows.find((w) => w.id === workflowId)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // 确保已有项目数据，方便面包屑展示
  useEffect(() => {
    if (!projects.length) {
      loadProjects()
      return
    }

    if (!currentProject || currentProject.id !== projectId) {
      const project = projects.find((p) => p.id === projectId)
      if (project) {
        setCurrentProject(project)
      }
    }
  }, [projects, projectId, currentProject, loadProjects, setCurrentProject])

  // 载入工作流信息
  useEffect(() => {
    let isMounted = true

    const applyWorkflowData = (workflow: { name: string; description?: string | null }) => {
      if (!isMounted) return
      setName(workflow.name)
      setDescription(workflow.description || '')
      setIsLoading(false)
    }

    if (workflowFromStore) {
      applyWorkflowData(workflowFromStore)
      return () => {
        isMounted = false
      }
    }

    const fetchWorkflow = async () => {
      setIsLoading(true)
      try {
        const workflow = await getWorkflow(workflowId)
        if (!workflow) {
          toast.error('未找到工作流')
          onNavigate(`/project/${projectId}`)
          return
        }
        applyWorkflowData(workflow)
      } catch (error) {
        console.error('加载工作流失败:', error)
        toast.error('加载工作流失败')
        onNavigate(`/project/${projectId}`)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchWorkflow()

    return () => {
      isMounted = false
    }
  }, [workflowFromStore, workflowId, onNavigate, projectId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('请输入工作流名称')
      return
    }

    setIsSaving(true)
    try {
      await updateWorkflow(workflowId, {
        name: name.trim(),
        description: description.trim() || undefined,
      })
      toast.success('工作流更新成功')
      onNavigate(`/project/${projectId}/workflow/${workflowId}`)
    } catch (error) {
      console.error('更新工作流失败:', error)
      toast.error('更新工作流失败')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <Header title="编辑工作流">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigate(`/project/${projectId}`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>
      </Header>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-lg px-6 py-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle>更新工作流信息</CardTitle>
                <CardDescription>修改名称或描述，保持流程信息同步</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-24 w-full" />
                    </div>
                    <div className="flex justify-end gap-3">
                      <Skeleton className="h-10 w-24" />
                      <Skeleton className="h-10 w-32" />
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">工作流名称 *</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="请输入工作流名称"
                        disabled={isSaving}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">工作流描述</Label>
                      <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="用于帮助团队了解流程意图"
                        rows={3}
                        disabled={isSaving}
                      />
                    </div>

                    <div className="flex justify-end gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => onNavigate(`/project/${projectId}`)}
                        disabled={isSaving}
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
                          '保存修改'
                        )}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}


