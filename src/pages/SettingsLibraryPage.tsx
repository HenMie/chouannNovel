import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft, 
  Plus, 
  Users, 
  Globe, 
  Palette, 
  FileText,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronRight,
  Save,
  Settings2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
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
import { useProjectStore } from '@/stores/project-store'
import { useSettingsStore } from '@/stores/settings-store'
import { toast } from 'sonner'
import type { SettingCategory, Setting } from '@/types'

interface SettingsLibraryPageProps {
  projectId: string
  onNavigate: (path: string) => void
}

// 分类配置
const CATEGORIES: Array<{
  key: SettingCategory
  label: string
  icon: React.ElementType
  description: string
  defaultPrompt: string
}> = [
  {
    key: 'character',
    label: '角色',
    icon: Users,
    description: '定义故事中的角色设定，包括性格、外貌、背景等',
    defaultPrompt: '【角色设定】\n{{#each items}}\n角色名：{{name}}\n{{content}}\n{{/each}}',
  },
  {
    key: 'worldview',
    label: '世界观',
    icon: Globe,
    description: '描述故事发生的世界背景、规则和设定',
    defaultPrompt: '【世界观设定】\n{{#each items}}\n{{name}}：{{content}}\n{{/each}}',
  },
  {
    key: 'style',
    label: '笔触风格',
    icon: Palette,
    description: '定义写作风格、语言特点和叙事方式',
    defaultPrompt: '【笔触风格】\n{{#each items}}\n{{name}}：{{content}}\n{{/each}}',
  },
  {
    key: 'outline',
    label: '大纲',
    icon: FileText,
    description: '故事的整体结构、章节规划和剧情走向',
    defaultPrompt: '【故事大纲】\n{{#each items}}\n{{name}}：{{content}}\n{{/each}}',
  },
]

export function SettingsLibraryPage({ projectId, onNavigate }: SettingsLibraryPageProps) {
  const { currentProject, setCurrentProject, projects, loadProjects } = useProjectStore()
  const {
    settings,
    settingPrompts,
    loading,
    loadSettings,
    addSetting,
    editSetting,
    removeSetting,
    toggleSetting,
    saveSettingPrompt,
    getSettingsByCategory,
    getSettingPromptByCategory,
  } = useSettingsStore()

  const [activeTab, setActiveTab] = useState<SettingCategory>('character')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingSetting, setEditingSetting] = useState<Setting | null>(null)
  const [deletingSetting, setDeletingSetting] = useState<Setting | null>(null)
  const [isPromptEditorOpen, setIsPromptEditorOpen] = useState(false)
  const [promptTemplate, setPromptTemplate] = useState('')
  
  // 表单状态
  const [formName, setFormName] = useState('')
  const [formContent, setFormContent] = useState('')

  // 加载项目和设定
  useEffect(() => {
    const loadData = async () => {
      if (projects.length === 0) {
        await loadProjects()
      }
      const project = useProjectStore.getState().projects.find((p) => p.id === projectId)
      if (project) {
        setCurrentProject(project)
        await loadSettings(projectId)
      }
    }
    loadData()
  }, [projectId, projects.length, loadProjects, setCurrentProject, loadSettings])

  // 获取当前分类的设定
  const currentCategorySettings = getSettingsByCategory(activeTab)
  const currentCategory = CATEGORIES.find((c) => c.key === activeTab)

  // 打开新增对话框
  const handleAdd = () => {
    setFormName('')
    setFormContent('')
    setEditingSetting(null)
    setIsAddDialogOpen(true)
  }

  // 打开编辑对话框
  const handleEdit = (setting: Setting) => {
    setFormName(setting.name)
    setFormContent(setting.content)
    setEditingSetting(setting)
    setIsAddDialogOpen(true)
  }

  // 保存设定
  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('请输入名称')
      return
    }
    if (!formContent.trim()) {
      toast.error('请输入内容')
      return
    }

    if (editingSetting) {
      await editSetting(editingSetting.id, {
        name: formName.trim(),
        content: formContent.trim(),
      })
      toast.success('设定已更新')
    } else {
      await addSetting(activeTab, formName.trim(), formContent.trim())
      toast.success('设定已创建')
    }

    setIsAddDialogOpen(false)
    setEditingSetting(null)
  }

  // 删除设定
  const handleDelete = async () => {
    if (!deletingSetting) return
    await removeSetting(deletingSetting.id)
    toast.success('设定已删除')
    setDeletingSetting(null)
  }

  // 打开提示词编辑器
  const handleOpenPromptEditor = () => {
    const prompt = getSettingPromptByCategory(activeTab)
    setPromptTemplate(prompt?.prompt_template || currentCategory?.defaultPrompt || '')
    setIsPromptEditorOpen(true)
  }

  // 保存提示词模板
  const handleSavePrompt = async () => {
    await saveSettingPrompt(activeTab, promptTemplate)
    toast.success('注入提示词已保存')
    setIsPromptEditorOpen(false)
  }

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <Header title="设定库">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigate(`/project/${projectId}`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回项目
        </Button>
      </Header>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="mb-6">
              <h1 className="text-2xl font-bold">{currentProject.name} - 设定库</h1>
              <p className="mt-1 text-muted-foreground">
                管理角色、世界观、笔触风格和大纲等创作设定
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SettingCategory)}>
              <TabsList className="mb-6 grid w-full grid-cols-4">
                {CATEGORIES.map((category) => (
                  <TabsTrigger 
                    key={category.key} 
                    value={category.key}
                    className="flex items-center gap-2"
                  >
                    <category.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{category.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {CATEGORIES.map((category) => (
                <TabsContent key={category.key} value={category.key}>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{category.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenPromptEditor}
                      >
                        <Settings2 className="mr-2 h-4 w-4" />
                        注入提示词
                      </Button>
                      <Button size="sm" onClick={handleAdd}>
                        <Plus className="mr-2 h-4 w-4" />
                        添加{category.label}
                      </Button>
                    </div>
                  </div>

                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  ) : currentCategorySettings.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <category.icon className="mb-4 h-12 w-12 text-muted-foreground/50" />
                        <p className="mb-2 text-muted-foreground">暂无{category.label}设定</p>
                        <p className="text-sm text-muted-foreground/70">
                          点击上方按钮添加{category.label}设定
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      <AnimatePresence mode="popLayout">
                        {currentCategorySettings.map((setting, index) => (
                          <SettingCard
                            key={setting.id}
                            setting={setting}
                            index={index}
                            onEdit={() => handleEdit(setting)}
                            onDelete={() => setDeletingSetting(setting)}
                            onToggle={() => toggleSetting(setting.id)}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </motion.div>
        </div>
      </div>

      {/* 添加/编辑对话框 */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingSetting ? '编辑设定' : `添加${currentCategory?.label}`}
            </DialogTitle>
            <DialogDescription>
              {currentCategory?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="setting-name">名称</Label>
              <Input
                id="setting-name"
                placeholder="输入名称..."
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="setting-content">内容</Label>
              <Textarea
                id="setting-content"
                placeholder="输入详细内容..."
                className="min-h-[200px] resize-none"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={!!deletingSetting} onOpenChange={() => setDeletingSetting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除设定「{deletingSetting?.name}」吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 注入提示词编辑器 */}
      <Dialog open={isPromptEditorOpen} onOpenChange={setIsPromptEditorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑注入提示词模板</DialogTitle>
            <DialogDescription>
              配置 AI 节点中引用此分类设定时的提示词格式。支持 Handlebars 语法。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="font-medium mb-2">可用变量：</p>
              <ul className="space-y-1 text-muted-foreground">
                <li><code className="bg-muted px-1 rounded">{'{{#each items}}'}</code> - 遍历所有已启用的设定</li>
                <li><code className="bg-muted px-1 rounded">{'{{name}}'}</code> - 设定名称</li>
                <li><code className="bg-muted px-1 rounded">{'{{content}}'}</code> - 设定内容</li>
                <li><code className="bg-muted px-1 rounded">{'{{/each}}'}</code> - 结束遍历</li>
              </ul>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prompt-template">提示词模板</Label>
              <Textarea
                id="prompt-template"
                placeholder="输入提示词模板..."
                className="min-h-[200px] font-mono text-sm resize-none"
                value={promptTemplate}
                onChange={(e) => setPromptTemplate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPromptEditorOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSavePrompt}>
              <Save className="mr-2 h-4 w-4" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// 设定卡片组件
interface SettingCardProps {
  setting: Setting
  index: number
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}

function SettingCard({ setting, index, onEdit, onDelete, onToggle }: SettingCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className={`transition-colors ${!setting.enabled ? 'opacity-60' : ''}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
              <CardTitle className="text-base">{setting.name}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor={`switch-${setting.id}`} className="text-xs text-muted-foreground">
                  启用
                </Label>
                <Switch
                  id={`switch-${setting.id}`}
                  checked={setting.enabled}
                  onCheckedChange={onToggle}
                />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CardContent className="pt-0">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="whitespace-pre-wrap text-sm">{setting.content}</p>
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
        {!isExpanded && (
          <CardContent className="pt-0">
            <p className="line-clamp-1 text-sm text-muted-foreground">
              {setting.content}
            </p>
          </CardContent>
        )}
      </Card>
    </motion.div>
  )
}

