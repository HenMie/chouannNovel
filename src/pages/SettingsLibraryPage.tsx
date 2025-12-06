import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
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
  CheckSquare,
  X,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Header } from '@/components/layout/Header'
import { useProjectStore } from '@/stores/project-store'
import { useSettingsStore, type SettingFilterStatus, type SettingSortBy, type SettingSortOrder } from '@/stores/settings-store'
import { Tour } from '@/components/help/Tour'
import { SETTINGS_TOUR_STEPS } from '@/tours'
import { useDebouncedValue, cn } from '@/lib/utils'
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
  selectedIds,
  selectionMode,
  onEdit,
  onDelete,
  onToggle,
  onSelect,
  onShiftSelect,
}: {
  settings: Setting[]
  selectedIds: Set<string>
  selectionMode: boolean
  onEdit: (setting: Setting) => void
  onDelete: (setting: Setting) => void
  onToggle: (id: string) => void
  onSelect: (id: string, selected: boolean) => void
  onShiftSelect: (id: string) => void
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
              isSelected={selectedIds.has(setting.id)}
              selectionMode={selectionMode}
              onEdit={() => onEdit(setting)}
              onDelete={() => onDelete(setting)}
              onToggle={() => onToggle(setting.id)}
              onSelect={(selected) => onSelect(setting.id, selected)}
              onShiftSelect={() => onShiftSelect(setting.id)}
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
                isSelected={selectedIds.has(setting.id)}
                selectionMode={selectionMode}
                onToggleExpand={() => {
                  toggleExpanded(setting.id)
                  // 重新测量
                  virtualizer.measureElement(null)
                }}
                onEdit={() => onEdit(setting)}
                onDelete={() => onDelete(setting)}
                onToggle={() => onToggle(setting.id)}
                onSelect={(selected) => onSelect(setting.id, selected)}
                onShiftSelect={() => onShiftSelect(setting.id)}
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
  isSelected,
  selectionMode,
  onToggleExpand,
  onEdit,
  onDelete,
  onToggle,
  onSelect,
  onShiftSelect,
}: {
  setting: Setting
  isExpanded: boolean
  isSelected: boolean
  selectionMode: boolean
  onToggleExpand: () => void
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  onSelect: (selected: boolean) => void
  onShiftSelect: () => void
}) {
  // 处理点击卡片（用于 Shift 选择）
  const handleCardClick = (e: React.MouseEvent) => {
    if (selectionMode && e.shiftKey) {
      e.preventDefault()
      onShiftSelect()
    }
  }
  const cardContent = (
    <Card 
      className={cn(
        'transition-colors hover:border-primary/50',
        !setting.enabled && 'opacity-60',
        isSelected && 'border-primary ring-1 ring-primary/30 bg-primary/5'
      )}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-2 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {selectionMode && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onSelect(!!checked)}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4"
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation()
                onToggleExpand()
              }}
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
              onClick={(e) => e.stopPropagation()}
              className="scale-75 mr-2"
            />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEdit() }}>
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete() }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      {isExpanded ? (
        <CardContent className={cn("pt-0 pb-3 px-3", selectionMode ? "ml-[52px]" : "ml-9")}>
          <div className="rounded bg-muted/30 p-3 text-sm font-mono whitespace-pre-wrap">
            {setting.content}
          </div>
        </CardContent>
      ) : (
        <CardContent className={cn("pt-0 pb-3 px-3", selectionMode ? "ml-[52px]" : "ml-9")}>
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {setting.content}
          </p>
        </CardContent>
      )}
    </Card>
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger className="block">
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
    batchToggleSettings,
    batchRemoveSettings,
    saveSettingPrompt,
    getFilteredAndSortedSettings,
    getSettingPromptByCategory,
  } = useSettingsStore()

  const [activeTab, setActiveTab] = useState<SettingCategory>(initialTab || 'character')
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingSetting, setEditingSetting] = useState<Setting | null>(null)
  const [deletingSetting, setDeletingSetting] = useState<Setting | null>(null)
  const [isPromptSheetOpen, setIsPromptSheetOpen] = useState(false)
  const [promptTemplate, setPromptTemplate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // 批量选择状态
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false)

  // 筛选和排序状态
  const [filterStatus, setFilterStatus] = useState<SettingFilterStatus>('all')
  const [sortBy, setSortBy] = useState<SettingSortBy>('name')
  const [sortOrder, setSortOrder] = useState<SettingSortOrder>('asc')

  // 表单状态
  const [formName, setFormName] = useState('')
  const [formContent, setFormContent] = useState('')
  const contentInputRef = useRef<HTMLTextAreaElement>(null)
  const promptInputRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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

  // 获取当前分类的设定（应用筛选和排序）
  const currentCategorySettings = useMemo(() => {
    return getFilteredAndSortedSettings(activeTab, filterStatus, sortBy, sortOrder)
  }, [activeTab, filterStatus, sortBy, sortOrder, getFilteredAndSortedSettings])
  
  const currentCategory = CATEGORIES.find((c) => c.key === activeTab)

  // 切换分类时清空选择
  useEffect(() => {
    setSelectedIds(new Set())
    setLastSelectedId(null)
  }, [activeTab])

  // 退出选择模式时清空选择
  useEffect(() => {
    if (!selectionMode) {
      setSelectedIds(new Set())
      setLastSelectedId(null)
    }
  }, [selectionMode])

  // 快捷键处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果正在输入，忽略快捷键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Ctrl+A 全选
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && selectionMode) {
        e.preventDefault()
        const allIds = new Set(currentCategorySettings.map(s => s.id))
        setSelectedIds(allIds)
        toast.success(`已选择 ${allIds.size} 个设定`)
      }

      // Delete 批量删除
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectionMode && selectedIds.size > 0) {
        e.preventDefault()
        setBatchDeleteConfirmOpen(true)
      }

      // Escape 退出选择模式
      if (e.key === 'Escape' && selectionMode) {
        setSelectionMode(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectionMode, selectedIds.size, currentCategorySettings])

  // 处理单个选择
  const handleSelect = useCallback((id: string, selected: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (selected) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
    setLastSelectedId(id)
  }, [])

  // 处理 Shift 选择（范围选择）
  const handleShiftSelect = useCallback((id: string) => {
    if (!lastSelectedId) {
      handleSelect(id, true)
      return
    }

    const currentIndex = currentCategorySettings.findIndex(s => s.id === id)
    const lastIndex = currentCategorySettings.findIndex(s => s.id === lastSelectedId)

    if (currentIndex === -1 || lastIndex === -1) return

    const start = Math.min(currentIndex, lastIndex)
    const end = Math.max(currentIndex, lastIndex)

    setSelectedIds(prev => {
      const next = new Set(prev)
      for (let i = start; i <= end; i++) {
        next.add(currentCategorySettings[i].id)
      }
      return next
    })
  }, [lastSelectedId, currentCategorySettings, handleSelect])

  // 全选/反选
  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === currentCategorySettings.length) {
      // 已全选，取消全选
      setSelectedIds(new Set())
    } else {
      // 全选
      setSelectedIds(new Set(currentCategorySettings.map(s => s.id)))
    }
  }, [selectedIds.size, currentCategorySettings])

  // 批量启用
  const handleBatchEnable = useCallback(async () => {
    const ids = Array.from(selectedIds)
    await batchToggleSettings(ids, true)
    toast.success(`已启用 ${ids.length} 个设定`)
    setSelectedIds(new Set())
    setSelectionMode(false)
  }, [selectedIds, batchToggleSettings])

  // 批量禁用
  const handleBatchDisable = useCallback(async () => {
    const ids = Array.from(selectedIds)
    await batchToggleSettings(ids, false)
    toast.success(`已禁用 ${ids.length} 个设定`)
    setSelectedIds(new Set())
    setSelectionMode(false)
  }, [selectedIds, batchToggleSettings])

  // 批量删除
  const handleBatchDelete = useCallback(async () => {
    const ids = Array.from(selectedIds)
    await batchRemoveSettings(ids)
    toast.success(`已删除 ${ids.length} 个设定`)
    setSelectedIds(new Set())
    setSelectionMode(false)
    setBatchDeleteConfirmOpen(false)
  }, [selectedIds, batchRemoveSettings])

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
                 {/* 筛选下拉 */}
                 <DropdownMenu>
                   <DropdownMenuTrigger asChild>
                     <Button variant="outline" size="icon" className="h-9 w-9">
                       <Filter className="h-4 w-4" />
                     </Button>
                   </DropdownMenuTrigger>
                   <DropdownMenuContent align="end" className="w-48">
                     <DropdownMenuLabel>状态筛选</DropdownMenuLabel>
                     <DropdownMenuRadioGroup value={filterStatus} onValueChange={(v) => setFilterStatus(v as SettingFilterStatus)}>
                       <DropdownMenuRadioItem value="all">全部</DropdownMenuRadioItem>
                       <DropdownMenuRadioItem value="enabled">
                         <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                         已启用
                       </DropdownMenuRadioItem>
                       <DropdownMenuRadioItem value="disabled">
                         <XCircle className="mr-2 h-4 w-4 text-muted-foreground" />
                         已禁用
                       </DropdownMenuRadioItem>
                     </DropdownMenuRadioGroup>
                     <DropdownMenuSeparator />
                     <DropdownMenuLabel>排序方式</DropdownMenuLabel>
                     <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => setSortBy(v as SettingSortBy)}>
                       <DropdownMenuRadioItem value="name">按名称</DropdownMenuRadioItem>
                       <DropdownMenuRadioItem value="created_at">按创建时间</DropdownMenuRadioItem>
                       <DropdownMenuRadioItem value="updated_at">按更新时间</DropdownMenuRadioItem>
                     </DropdownMenuRadioGroup>
                     <DropdownMenuSeparator />
                     <DropdownMenuItem onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                       <ArrowUpDown className="mr-2 h-4 w-4" />
                       {sortOrder === 'asc' ? '升序 → 降序' : '降序 → 升序'}
                     </DropdownMenuItem>
                   </DropdownMenuContent>
                 </DropdownMenu>
                 {/* 批量选择按钮 */}
                 <Button
                   variant={selectionMode ? 'secondary' : 'outline'}
                   size="icon"
                   className="h-9 w-9"
                   onClick={() => setSelectionMode(!selectionMode)}
                   title={selectionMode ? '退出选择模式' : '进入选择模式'}
                 >
                   {selectionMode ? <X className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
                 </Button>
              </div>
            </div>

            {/* 筛选状态提示 */}
            {(filterStatus !== 'all' || sortBy !== 'name' || sortOrder !== 'asc') && (
              <div className="mb-4 flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">当前筛选：</span>
                {filterStatus !== 'all' && (
                  <Badge variant="secondary" className="gap-1">
                    {filterStatus === 'enabled' ? '已启用' : '已禁用'}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterStatus('all')} />
                  </Badge>
                )}
                {(sortBy !== 'name' || sortOrder !== 'asc') && (
                  <Badge variant="secondary" className="gap-1">
                    {sortBy === 'name' ? '名称' : sortBy === 'created_at' ? '创建时间' : '更新时间'}
                    ({sortOrder === 'asc' ? '升序' : '降序'})
                    <X className="h-3 w-3 cursor-pointer" onClick={() => { setSortBy('name'); setSortOrder('asc') }} />
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => { setFilterStatus('all'); setSortBy('name'); setSortOrder('asc') }}
                >
                  重置
                </Button>
              </div>
            )}

            {/* 批量操作工具栏 */}
            <AnimatePresence>
              {selectionMode && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-4 flex items-center gap-2 rounded-lg border bg-muted/50 p-3"
                >
                  <Checkbox
                    checked={selectedIds.size === currentCategorySettings.length && currentCategorySettings.length > 0}
                    onCheckedChange={handleSelectAll}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">
                    {selectedIds.size > 0 
                      ? `已选择 ${selectedIds.size} 项` 
                      : '点击复选框选择设定，Shift+点击可范围选择'}
                  </span>
                  {selectedIds.size > 0 && (
                    <>
                      <div className="mx-2 h-4 w-px bg-border" />
                      <Button variant="outline" size="sm" onClick={handleBatchEnable}>
                        <ToggleRight className="mr-1.5 h-3.5 w-3.5" />
                        启用
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleBatchDisable}>
                        <ToggleLeft className="mr-1.5 h-3.5 w-3.5" />
                        禁用
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setBatchDeleteConfirmOpen(true)}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        删除
                      </Button>
                    </>
                  )}
                  <div className="flex-1" />
                  <span className="text-xs text-muted-foreground">
                    Ctrl+A 全选 · Delete 删除 · Esc 退出
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

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
                          {searchQuery || filterStatus !== 'all' ? '未找到匹配的设定' : `暂无${category.label}设定`}
                        </p>
                        {!searchQuery && filterStatus === 'all' && (
                           <p className="text-sm text-muted-foreground/70">
                              点击上方按钮添加{category.label}设定
                           </p>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <div data-tour="settings-list" ref={containerRef}>
                    <VirtualSettingsList
                      settings={currentCategorySettings}
                      selectedIds={selectedIds}
                      selectionMode={selectionMode}
                      onEdit={handleEdit}
                      onDelete={setDeletingSetting}
                      onToggle={toggleSetting}
                      onSelect={handleSelect}
                      onShiftSelect={handleShiftSelect}
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
                autoComplete="off"
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

      {/* 批量删除确认对话框 */}
      <AlertDialog open={batchDeleteConfirmOpen} onOpenChange={setBatchDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除选中的 {selectedIds.size} 个设定吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除 {selectedIds.size} 项
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
  isSelected: boolean
  selectionMode: boolean
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  onSelect: (selected: boolean) => void
  onShiftSelect: () => void
}

function SettingCard({ setting, index, isSelected, selectionMode, onEdit, onDelete, onToggle, onSelect, onShiftSelect }: SettingCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // 处理点击卡片（用于 Shift 选择）
  const handleCardClick = (e: React.MouseEvent) => {
    if (selectionMode && e.shiftKey) {
      e.preventDefault()
      onShiftSelect()
    }
  }

  const cardContent = (
    <Card 
      className={cn(
        'transition-colors hover:border-primary/50',
        !setting.enabled && 'opacity-60',
        isSelected && 'border-primary ring-1 ring-primary/30 bg-primary/5'
      )}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-2 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {selectionMode && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onSelect(!!checked)}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4"
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation()
                setIsExpanded(!isExpanded)
              }}
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
              onClick={(e) => e.stopPropagation()}
              className="scale-75 mr-2"
            />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEdit() }}>
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete() }}
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
            <CardContent className={cn("pt-0 pb-3 px-3", selectionMode ? "ml-[52px]" : "ml-9")}>
              <div className="rounded bg-muted/30 p-3 text-sm font-mono whitespace-pre-wrap">
                {setting.content}
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
      {!isExpanded && (
        <CardContent className={cn("pt-0 pb-3 px-3", selectionMode ? "ml-[52px]" : "ml-9")}>
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
        <ContextMenuTrigger className="block">
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

