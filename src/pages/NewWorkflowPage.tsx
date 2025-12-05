import { useState } from 'react'
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

interface NewWorkflowPageProps {
  projectId: string
  onNavigate: (path: string) => void
}

export function NewWorkflowPage({ projectId, onNavigate }: NewWorkflowPageProps) {
  const { createWorkflow, currentProject, setCurrentProject } = useProjectStore()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // 确保当前项目已设置
  useState(() => {
    if (!currentProject) {
      const { projects } = useProjectStore.getState()
      const project = projects.find((p) => p.id === projectId)
      if (project) {
        setCurrentProject(project)
      }
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('请输入工作流名称')
      return
    }

    setIsCreating(true)
    try {
      const workflow = await createWorkflow(name.trim(), description.trim() || undefined)
      if (workflow) {
        toast.success('工作流创建成功')
        onNavigate(`/project/${projectId}/workflow/${workflow.id}`)
      }
    } catch (error) {
      handleAppError({
        error,
        context: '创建工作流',
        toastMessage: `创建工作流失败：${getErrorMessage(error)}`,
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <Header title="新建工作流">
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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>创建新工作流</CardTitle>
                <CardDescription>
                  工作流是 AI 创作的核心，由多个节点组成执行流程
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">工作流名称 *</Label>
                    <Input
                      id="name"
                      placeholder="例如：角色对话生成"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoFocus
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">工作流描述</Label>
                    <Textarea
                      id="description"
                      placeholder="描述这个工作流的用途..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
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
                    <Button type="submit" disabled={isCreating || !name.trim()}>
                      {isCreating ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          创建中...
                        </>
                      ) : (
                        '创建工作流'
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

