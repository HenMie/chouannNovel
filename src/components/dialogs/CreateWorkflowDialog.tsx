// 新建工作流对话框组件
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useProjectStore } from '@/stores/project-store'
import { getErrorMessage, handleAppError } from '@/lib/errors'
import { toast } from 'sonner'

interface CreateWorkflowDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  onSuccess?: (workflowId: string) => void
}

export function CreateWorkflowDialog({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}: CreateWorkflowDialogProps) {
  const { createWorkflow, currentProject, setCurrentProject, projects } = useProjectStore()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // 确保当前项目已设置
  useEffect(() => {
    if (open && !currentProject) {
      const project = projects.find((p) => p.id === projectId)
      if (project) {
        setCurrentProject(project)
      }
    }
  }, [open, currentProject, projects, projectId, setCurrentProject])

  // 对话框关闭时重置表单
  useEffect(() => {
    if (!open) {
      setName('')
      setDescription('')
      setIsCreating(false)
    }
  }, [open])

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
        onOpenChange(false)
        onSuccess?.(workflow.id)
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>新建工作流</DialogTitle>
            <DialogDescription>
              工作流是 AI 创作的核心，由多个节点组成执行流程
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="workflow-name">工作流名称 *</Label>
              <Input
                id="workflow-name"
                placeholder="例如：角色对话生成"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workflow-description">工作流描述</Label>
              <Textarea
                id="workflow-description"
                placeholder="描述这个工作流的用途..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

