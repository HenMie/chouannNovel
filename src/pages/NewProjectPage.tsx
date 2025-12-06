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

interface NewProjectPageProps {
  onNavigate: (path: string) => void
}

export function NewProjectPage({ onNavigate }: NewProjectPageProps) {
  const { createProject } = useProjectStore()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('请输入项目名称')
      return
    }

    setIsCreating(true)
    try {
      const project = await createProject(name.trim(), description.trim() || undefined)
      toast.success('项目创建成功')
      onNavigate(`/project/${project.id}`)
    } catch (error) {
      handleAppError({
        error,
        context: '创建项目',
        toastMessage: `创建项目失败：${getErrorMessage(error)}`,
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <Header title="新建项目">
        <Button variant="ghost" size="sm" onClick={() => onNavigate('/')}>
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
                <CardTitle>创建新项目</CardTitle>
                <CardDescription>
                  每个项目对应一部小说，包含多个工作流和设定
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
                      onClick={() => onNavigate('/')}
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
                        '创建项目'
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

