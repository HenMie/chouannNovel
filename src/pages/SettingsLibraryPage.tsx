import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useVirtualizer } from '@tanstack/react-virtual'
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
  Search,
  Bold,
  Italic,
  List,
  Code,
  Quote,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Header } from '@/components/layout/Header'
import { useProjectStore } from '@/stores/project-store'
import { useSettingsStore } from '@/stores/settings-store'
import { Tour } from '@/components/help/Tour'
import { SETTINGS_TOUR_STEPS } from '@/tours'
import { useDebouncedValue } from '@/lib/utils'
import { toast } from 'sonner'
import type { SettingCategory, Setting } from '@/types'

interface SettingsLibraryPageProps {
  projectId: string
  onNavigate: (path: string) => void
  initialTab?: SettingCategory
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

// 虚拟设定列表组件
function VirtualSettingsList({
  settings,
  onEdit,
  onDelete,
  onToggle,
}: {
  settings: Setting[]
  onEdit: (setting: Setting) => void
  onDelete: (setting: Setting) => void
  onToggle: (id: string) => void
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  // 跟踪展开状态以动态调整高度
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const virtualizer = useVirtualizer({
    count: settings.length,
    getScrollElement: () => parentRef.current,
    // 根据展开状态动态计算高度
    estimateSize: useCallback((index: number) => {
      const setting = settings[index]
      const isExpanded = expandedIds.has(setting.id)
      // 基础高度约 70px，展开后根据内容增加
      return isExpanded ? Math.min(200, 70 + setting.content.length / 3) : 70
    }, [settings, expandedIds]),
    overscan: 5,
    getItemKey: (index) => settings[index].id,
  })

  const virtualItems = virtualizer.getVirtualItems()

  // 如果设定数量较少（<20），直接渲染不使用虚拟化
  if (settings.length < 20) {
    return (
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {settings.map((setting, index) => (
            <SettingCard
              key={setting.id}
              setting={setting}
              index={index}
              onEdit={() => onEdit(setting)}
              onDelete={() => onDelete(setting)}
              onToggle={() => onToggle(setting.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      className="h-[calc(100vh-320px)] min-h-[300px] overflow-auto"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const setting = settings[virtualItem.index]
          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
                paddingBottom: '12px',
              }}
            >
              <SettingCardVirtual
                setting={setting}
                isExpanded={expandedIds.has(setting.id)}
                onToggleExpand={() => {
                  toggleExpanded(setting.id)
                  // 重新测量
                  virtualizer.measureElement(null)
                }}
                onEdit={() => onEdit(setting)}
                onDelete={() => onDelete(setting)}
                onToggle={() => onToggle(setting.id)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// 虚拟列表专用的设定卡片（无动画版本，提高性能）
function SettingCardVirtual({
  setting,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onToggle,
}: {
  setting: Setting
  isExpanded: boolean
  onToggleExpand: () => void
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}) {
  const cardContent = (
    <Card className={`transition-colors hover:border-primary/50 ${!setting.enabled ? 'opacity-60' : ''}`}>
      <CardHeader className="pb-2 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={onToggleExpand}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            <div className="flex items-center gap-2">
               <CardTitle className="text-sm font-semibold">{setting.name}</CardTitle>
               {!setting.enabled && (
                  <span className="text-[10px] bg-muted px-1.5 rounded text-muted-foreground">已禁用</span>
               )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Switch
              id={`switch-${setting.id}`}
              checked={setting.enabled}
              onCheckedChange={onToggle}
              className="scale-75 mr-2"
            />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      {isExpanded ? (
        <CardContent className="pt-0 pb-3 px-3 ml-9">
          <div className="rounded bg-muted/30 p-3 text-sm font-mono whitespace-pre-wrap">
            {setting.content}
          </div>
        </CardContent>
      ) : (
        <CardContent className="pt-0 pb-3 px-3 ml-9">
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {setting.content}
          </p>
        </CardContent>
      )}
    </Card>
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {cardContent}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={onEdit}>
          <Edit2 className="mr-2 h-4 w-4" />
          编辑设定
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onToggle}>
          {setting.enabled ? (
            <>
              <ToggleLeft className="mr-2 h-4 w-4" />
              禁用设定
            </>
          ) : (
            <>
              <ToggleRight className="mr-2 h-4 w-4" />
              启用设定
            </>
          )}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onDelete} variant="destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          删除设定
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function SettingsLibraryPage({ projectId, onNavigate, initialTab }: SettingsLibraryPageProps) {
  const { currentProject, setCurrentProject, projects, loadProjects, loadWorkflows } = useProjectStore()
  const {
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

  const [activeTab, setActiveTab] = useState<SettingCategory>(initialTab || 'character')
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingSetting, setEditingSetting] = useState<Setting | null>(null)
  const [deletingSetting, setDeletingSetting] = useState<Setting | null>(null)
  const [isPromptSheetOpen, setIsPromptSheetOpen] = useState(false)
  const [promptTemplate, setPromptTemplate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // 表单状态
  const [formName, setFormName] = useState('')
  const [formContent, setFormContent] = useState('')
  const contentInputRef = useRef<HTMLTextAreaElement>(null)
  const promptInputRef = useRef<HTMLTextAreaElement>(null)

  // 加载项目和设定
  useEffect(() => {
    const loadData = async () => {
      if (projects.length === 0) {
        await loadProjects()
      }
      const project = useProjectStore.getState().projects.find((p) => p.id === projectId)
      if (project) {
        setCurrentProject(project)
        // 显式加载工作流，因为 setCurrentProject 会清空 workflows
        loadWorkflows(project.id)
      }
    }
    loadData()
  }, [projectId, projects.length, loadProjects, setCurrentProject, loadWorkflows])

  // 使用防抖的搜索查询
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300)

  // 搜索和加载设定
  useEffect(() => {
    loadSettings(projectId, debouncedSearchQuery)
  }, [projectId, debouncedSearchQuery, loadSettings])

  // 获取当前分类的设定
  const currentCategorySettings = getSettingsByCategory(activeTab)
  const currentCategory = CATEGORIES.find((c) => c.key === activeTab)

  // 打开新增抽屉
  const handleAdd = () => {
    setFormName('')
    setFormContent('')
    setEditingSetting(null)
    setIsSheetOpen(true)
  }

  // 打开编辑抽屉
  const handleEdit = (setting: Setting) => {
    setFormName(setting.name)
    setFormContent(setting.content)
    setEditingSetting(setting)
    setIsSheetOpen(true)
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

    setIsSheetOpen(false)
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
    setIsPromptSheetOpen(true)
  }

  // 保存提示词模板
  const handleSavePrompt = async () => {
    await saveSettingPrompt(activeTab, promptTemplate)
    toast.success('注入提示词已保存')
    setIsPromptSheetOpen(false)
  }

  // 插入 Markdown 格式
  const insertFormat = (start: string, end: string = '') => {
    if (!contentInputRef.current) return
    const input = contentInputRef.current
    const startPos = input.selectionStart
    const endPos = input.selectionEnd
    const text = formContent
    const selectedText = text.substring(startPos, endPos)
    const replacement = `${start}${selectedText}${end}`
    const newText = text.substring(0, startPos) + replacement + text.substring(endPos)
    setFormContent(newText)
    setTimeout(() => {
      input.focus()
      input.setSelectionRange(startPos + start.length, endPos + start.length)
    }, 0)
  }

  // 插入变量到提示词
  const insertVariable = (variable: string) => {
    if (!promptInputRef.current) return
    const input = promptInputRef.current
    const startPos = input.selectionStart
    const endPos = input.selectionEnd
    const text = promptTemplate
    const newText = text.substring(0, startPos) + variable + text.substring(endPos)
    setPromptTemplate(newText)
    setTimeout(() => {
      input.focus()
      input.setSelectionRange(startPos + variable.length, startPos + variable.length)
    }, 0)
  }

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <Header
        title="设定库"
        breadcrumbs={[
          { label: '首页', href: '/' },
          { label: currentProject.name, href: `/project/${projectId}` },
          { label: '设定库' },
        ]}
        onNavigate={onNavigate}
      >
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
        <div className="mx-auto max-w-6xl px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold">设定库管理</h1>
                <p className="mt-1 text-muted-foreground">
                  管理角色、世界观、笔触风格和大纲等创作设定
                </p>
              </div>
              <div className="flex items-center gap-2" data-tour="settings-search">
                 <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="搜索设定..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                 </div>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SettingCategory)}>
              <TabsList className="mb-6 grid w-full grid-cols-4" data-tour="settings-tabs">
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
                        data-tour="settings-prompt-button"
                      >
                        <Settings2 className="mr-2 h-4 w-4" />
                        注入提示词
                      </Button>
                      <Button size="sm" onClick={handleAdd} data-tour="settings-add-button">
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
                        <p className="mb-2 text-muted-foreground">
                          {searchQuery ? '未找到匹配的设定' : `暂无${category.label}设定`}
                        </p>
                        {!searchQuery && (
                           <p className="text-sm text-muted-foreground/70">
                              点击上方按钮添加{category.label}设定
                           </p>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <div data-tour="settings-list">
                    <VirtualSettingsList
                      settings={currentCategorySettings}
                      onEdit={handleEdit}
                      onDelete={setDeletingSetting}
                      onToggle={toggleSetting}
                    />
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </motion.div>
        </div>
      </div>

      {/* 编辑设定抽屉 (Sheet) */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-[400px] sm:w-[600px] flex flex-col">
          <SheetHeader>
            <SheetTitle>
              {editingSetting ? '编辑设定' : `添加${currentCategory?.label}`}
            </SheetTitle>
            <SheetDescription>
              {currentCategory?.description}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-4">
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
              <div className="flex items-center justify-between">
                <Label htmlFor="setting-content">内容</Label>
                {/* Markdown Toolbar */}
                <div className="flex items-center gap-1">
                   <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => insertFormat('**', '**')} title="粗体">
                      <Bold className="h-3 w-3" />
                   </Button>
                   <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => insertFormat('*', '*')} title="斜体">
                      <Italic className="h-3 w-3" />
                   </Button>
                   <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => insertFormat('- ')} title="列表">
                      <List className="h-3 w-3" />
                   </Button>
                   <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => insertFormat('`', '`')} title="代码">
                      <Code className="h-3 w-3" />
                   </Button>
                   <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => insertFormat('> ')} title="引用">
                      <Quote className="h-3 w-3" />
                   </Button>
                </div>
              </div>
              <Textarea
                ref={contentInputRef}
                id="setting-content"
                placeholder="输入详细内容... (支持 Markdown)"
                className="min-h-[400px] resize-none font-mono text-sm"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
              />
            </div>
          </div>

          <SheetFooter>
            <Button variant="outline" onClick={() => setIsSheetOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              保存
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* 注入提示词编辑器 (Sheet) */}
      <Sheet open={isPromptSheetOpen} onOpenChange={setIsPromptSheetOpen}>
        <SheetContent className="w-[400px] sm:w-[600px] flex flex-col">
          <SheetHeader>
            <SheetTitle>编辑注入提示词模板</SheetTitle>
            <SheetDescription>
              配置 AI 节点中引用此分类设定时的提示词格式。
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-2">
              <p className="font-medium">快速插入变量：</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="xs" onClick={() => insertVariable('{{#each items}}...{{/each}}')}>
                   遍历循环
                </Button>
                <Button variant="secondary" size="xs" onClick={() => insertVariable('{{name}}')}>
                   名称
                </Button>
                <Button variant="secondary" size="xs" onClick={() => insertVariable('{{content}}')}>
                   内容
                </Button>
              </div>
            </div>
            <div className="space-y-2 flex-1 flex flex-col">
              <Label htmlFor="prompt-template">提示词模板</Label>
              <Textarea
                ref={promptInputRef}
                id="prompt-template"
                placeholder="输入提示词模板..."
                className="flex-1 min-h-[300px] font-mono text-sm resize-none"
                value={promptTemplate}
                onChange={(e) => setPromptTemplate(e.target.value)}
              />
            </div>
            <div className="rounded-lg border p-3 bg-muted/10">
               <Label className="mb-2 block text-xs text-muted-foreground">预览效果 (示例)</Label>
               <div className="text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-[100px] overflow-y-auto">
                  {promptTemplate
                    .replace(/{{#each items}}([\s\S]*?){{\/each}}/g, '$1\n$1')
                    .replace(/{{name}}/g, '示例设定名')
                    .replace(/{{content}}/g, '示例设定内容...')}
               </div>
            </div>
          </div>

          <SheetFooter>
            <Button variant="outline" onClick={() => setIsPromptSheetOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSavePrompt}>
              <Save className="mr-2 h-4 w-4" />
              保存
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

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

      {/* 新手引导 */}
      <Tour module="settings" steps={SETTINGS_TOUR_STEPS} />
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

  const cardContent = (
    <Card className={`transition-colors hover:border-primary/50 ${!setting.enabled ? 'opacity-60' : ''}`}>
      <CardHeader className="pb-2 py-3">
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
            <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold">{setting.name}</CardTitle>
                {!setting.enabled && (
                  <span className="text-[10px] bg-muted px-1.5 rounded text-muted-foreground">已禁用</span>
                )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Switch
              id={`switch-${setting.id}`}
              checked={setting.enabled}
              onCheckedChange={onToggle}
              className="scale-75 mr-2"
            />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
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
            <CardContent className="pt-0 pb-3 px-3 ml-9">
              <div className="rounded bg-muted/30 p-3 text-sm font-mono whitespace-pre-wrap">
                {setting.content}
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
      {!isExpanded && (
        <CardContent className="pt-0 pb-3 px-3 ml-9">
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {setting.content}
          </p>
        </CardContent>
      )}
    </Card>
  )

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05 }}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {cardContent}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={onEdit}>
            <Edit2 className="mr-2 h-4 w-4" />
            编辑设定
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onToggle}>
            {setting.enabled ? (
              <>
                <ToggleLeft className="mr-2 h-4 w-4" />
                禁用设定
              </>
            ) : (
              <>
                <ToggleRight className="mr-2 h-4 w-4" />
                启用设定
              </>
            )}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onDelete} variant="destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            删除设定
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </motion.div>
  )
}

