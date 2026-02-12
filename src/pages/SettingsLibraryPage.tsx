import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Search,
  Settings2,
  CheckSquare,
  X,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  BarChart3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { useDebouncedValue } from '@/lib/utils'
import { toast } from 'sonner'
import type { SettingCategory, Setting, SettingInjectionMode, SettingPriority, GlobalConfig } from '@/types'
import { getGlobalConfig } from '@/lib/db'
import { handleAppError } from '@/lib/errors'
import { getAssistantProviderName } from '@/lib/ai/setting-assistant'

// 从拆分的组件中导入
import { CATEGORIES, VirtualSettingsList } from '@/components/settings/SettingCard'
import { SettingDetailPanel } from '@/components/settings/SettingDetail'
import { SettingEditorSheet, PromptEditorSheet } from '@/components/settings/SettingEditor'
import { NavItem, NavTreeItem } from '@/components/settings/SettingNav'
import { SettingTreeItem } from '@/components/settings/SettingTree'
import { SettingsDashboard } from '@/components/settings/SettingsDashboard'

interface SettingsLibraryPageProps {
  projectId: string
  onNavigate: (path: string) => void
  initialTab?: SettingCategory
}

export function SettingsLibraryPage({ projectId, onNavigate, initialTab }: SettingsLibraryPageProps) {
  const { currentProject, setCurrentProject, projects, loadProjects, loadWorkflows } = useProjectStore()
  const {
    settings,
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
    getSettingTree,
    loadRelations,
  } = useSettingsStore()

  const [activeTab, setActiveTab] = useState<SettingCategory | 'overview'>(initialTab || 'character')
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingSetting, setEditingSetting] = useState<Setting | null>(null)
  const [deletingSetting, setDeletingSetting] = useState<Setting | null>(null)
  const [isPromptSheetOpen, setIsPromptSheetOpen] = useState(false)
  const [promptTemplate, setPromptTemplate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSettingId, setSelectedSettingId] = useState<string | null>(null)

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
  const [formParentId, setFormParentId] = useState<string | null>(null)
  const [formInjectionMode, setFormInjectionMode] = useState<SettingInjectionMode>('manual')
  const [formPriority, setFormPriority] = useState<SettingPriority>('medium')
  const [formKeywords, setFormKeywords] = useState('')
  const [formSummary, setFormSummary] = useState('')
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig | null>(null)
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
      // 加载全局配置（用于 AI 助手）
      try {
        const config = await getGlobalConfig()
        setGlobalConfig(config)
      } catch (error) {
        handleAppError({ error, context: '加载全局配置', silent: true })
      }
    }
    loadData()
  }, [projectId, projects.length, loadProjects, setCurrentProject, loadWorkflows])

  // 使用防抖的搜索查询
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300)

  // 搜索和加载设定
  useEffect(() => {
    loadSettings(projectId, debouncedSearchQuery)
    loadRelations(projectId)
  }, [projectId, debouncedSearchQuery, loadSettings, loadRelations])

  // 获取当前分类的设定（应用筛选和排序）
  const currentCategorySettings = useMemo(() => {
    if (activeTab === 'overview') return []
    return getFilteredAndSortedSettings(activeTab, filterStatus, sortBy, sortOrder)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filterStatus, sortBy, sortOrder, getFilteredAndSortedSettings, settings])

  // 每个分类的设定数量统计
  const categoryCounts = useMemo(() => {
    const counts: Record<string, { total: number; enabled: number }> = {}
    for (const cat of CATEGORIES) {
      const catSettings = settings.filter(s => s.category === cat.key)
      counts[cat.key] = {
        total: catSettings.length,
        enabled: catSettings.filter(s => s.enabled).length,
      }
    }
    return counts
  }, [settings])

  const currentCategory = CATEGORIES.find((c) => c.key === activeTab)

  // 当前选中的设定（用于右侧详情面板）
  const selectedSetting = useMemo(() => {
    if (!selectedSettingId) return null
    return settings.find(s => s.id === selectedSettingId) ?? null
  }, [selectedSettingId, settings])

  // 是否使用搜索/筛选模式（使用扁平列表）还是树形模式
  const isFilterMode = !!debouncedSearchQuery || filterStatus !== 'all'

  // 树形结构
  const currentSettingTree = useMemo(() => {
    if (isFilterMode || activeTab === 'overview') return []
    return getSettingTree(activeTab)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isFilterMode, getSettingTree, settings])

  // 构建设定面包屑路径
  const breadcrumbPath = useMemo(() => {
    if (!selectedSetting || !selectedSetting.parent_id) return []
    const path: Setting[] = []
    let currentId: string | null = selectedSetting.parent_id
    while (currentId) {
      const parent = settings.find(s => s.id === currentId)
      if (!parent) break
      path.unshift(parent)
      currentId = parent.parent_id
    }
    return path
  }, [selectedSetting, settings])

  // 切换分类时清空选择
  useEffect(() => {
    setSelectedIds(new Set())
    setLastSelectedId(null)
    setSelectedSettingId(null)
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
  const handleAdd = (parentId?: string | null) => {
    setFormName('')
    setFormContent('')
    setFormParentId(parentId ?? null)
    setFormInjectionMode('manual')
    setFormPriority('medium')
    setFormKeywords('')
    setFormSummary('')
    setEditingSetting(null)
    setIsSheetOpen(true)
  }

  // 打开编辑抽屉
  const handleEdit = (setting: Setting) => {
    setFormName(setting.name)
    setFormContent(setting.content)
    setFormParentId(setting.parent_id)
    setFormInjectionMode(setting.injection_mode)
    setFormPriority(setting.priority)
    setFormKeywords(setting.keywords ? setting.keywords.join(', ') : '')
    setFormSummary(setting.summary ?? '')
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

    const parsedKeywords = formKeywords.trim()
      ? formKeywords.split(',').map(k => k.trim()).filter(Boolean)
      : null

    if (editingSetting) {
      const updates: Partial<Pick<Setting, 'name' | 'content' | 'parent_id' | 'injection_mode' | 'priority' | 'keywords' | 'summary'>> = {
        name: formName.trim(),
        content: formContent.trim(),
        injection_mode: formInjectionMode,
        priority: formPriority,
        keywords: parsedKeywords,
        summary: formSummary.trim() || null,
      }
      if (editingSetting.parent_id !== formParentId) {
        updates.parent_id = formParentId
      }
      await editSetting(editingSetting.id, updates)
      toast.success('设定已更新')
    } else {
      const newSetting = await addSetting(activeTab, formName.trim(), formContent.trim(), formParentId)
      if (newSetting) {
        // 保存注入相关字段
        await editSetting(newSetting.id, {
          injection_mode: formInjectionMode,
          priority: formPriority,
          keywords: parsedKeywords,
          summary: formSummary.trim() || null,
        })
      }
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
    if (activeTab === 'overview') return
    const prompt = getSettingPromptByCategory(activeTab)
    setPromptTemplate(prompt?.prompt_template || currentCategory?.defaultPrompt || '')
    setIsPromptSheetOpen(true)
  }

  // 保存提示词模板
  const handleSavePrompt = async () => {
    if (activeTab === 'overview') return
    await saveSettingPrompt(activeTab, promptTemplate)
    toast.success('注入提示词已保存')
    setIsPromptSheetOpen(false)
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

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SettingCategory | 'overview')}>
              <TabsList className="mb-6 grid w-full grid-cols-5" data-tour="settings-tabs">
                <TabsTrigger value="overview" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">总览</span>
                </TabsTrigger>
                {CATEGORIES.map((category) => (
                  <TabsTrigger
                    key={category.key}
                    value={category.key}
                    className="flex items-center gap-2"
                  >
                    <category.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{category.label}</span>
                    {categoryCounts[category.key]?.total > 0 && (
                      <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px] leading-none">
                        {categoryCounts[category.key].enabled}/{categoryCounts[category.key].total}
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview">
                <SettingsDashboard
                  settings={settings}
                  onSelectSetting={setSelectedSettingId}
                  onSwitchTab={(tab) => setActiveTab(tab)}
                />
              </TabsContent>

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
                      <Button size="sm" onClick={() => handleAdd()} data-tour="settings-add-button">
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
                          <div className="space-y-3 mt-2">
                            <p className="text-sm text-muted-foreground/70">
                              {category.key === 'character' && '创建角色设定，定义人物外貌、性格、背景等信息'}
                              {category.key === 'worldview' && '创建世界观设定，定义故事发生的世界规则'}
                              {category.key === 'style' && '创建笔触风格设定，定义写作语言和叙事风格'}
                              {category.key === 'outline' && '创建大纲设定，规划故事的结构和发展脉络'}
                            </p>
                            <div className="flex gap-2 justify-center">
                              <Button size="sm" onClick={() => handleAdd()}>
                                <Plus className="mr-1.5 h-4 w-4" />
                                手动创建
                              </Button>
                              {globalConfig && getAssistantProviderName(globalConfig) && (
                                <Button size="sm" variant="outline" onClick={() => {
                                  handleAdd()
                                  // Dialog 打开后用户可使用 AI 生成按钮
                                }}>
                                  <Sparkles className="mr-1.5 h-4 w-4" />
                                  AI 辅助创建
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="flex gap-3">
                      {/* 左侧：标题导航 */}
                      <div className="w-44 shrink-0">
                        <div className="sticky top-4 max-h-[calc(100vh-280px)] overflow-y-auto rounded-lg border bg-card p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-2">标题导航</p>
                          {isFilterMode ? (
                            /* 搜索/筛选模式：扁平列表 */
                            currentCategorySettings.map((setting) => (
                              <NavItem
                                key={setting.id}
                                setting={setting}
                                depth={0}
                                isActive={selectedSettingId === setting.id}
                                onClick={() => setSelectedSettingId(setting.id)}
                              />
                            ))
                          ) : (
                            /* 默认模式：树形导航 */
                            currentSettingTree.map((node) => (
                              <NavTreeItem
                                key={node.setting.id}
                                node={node}
                                depth={0}
                                selectedSettingId={selectedSettingId}
                                onSelect={setSelectedSettingId}
                              />
                            ))
                          )}
                        </div>
                      </div>
                      {/* 中间：设定列表 */}
                      <div className="flex-1 min-w-0" data-tour="settings-list" ref={containerRef}>
                        {isFilterMode ? (
                          /* 筛选/搜索模式：扁平列表 */
                          <VirtualSettingsList
                            settings={currentCategorySettings}
                            selectedIds={selectedIds}
                            selectionMode={selectionMode}
                            selectedSettingId={selectedSettingId}
                            onEdit={handleEdit}
                            onDelete={setDeletingSetting}
                            onToggle={toggleSetting}
                            onSelect={handleSelect}
                            onShiftSelect={handleShiftSelect}
                            onSelectSetting={setSelectedSettingId}
                          />
                        ) : (
                          /* 默认模式：树形展示 */
                          <div className="space-y-0">
                            {currentSettingTree.map((node) => (
                              <SettingTreeItem
                                key={node.setting.id}
                                node={node}
                                depth={0}
                                selectionMode={selectionMode}
                                selectedIds={selectedIds}
                                selectedSettingId={selectedSettingId}
                                onEdit={handleEdit}
                                onDelete={setDeletingSetting}
                                onToggle={toggleSetting}
                                onSelect={handleSelect}
                                onShiftSelect={handleShiftSelect}
                                onAddChild={(parentId) => handleAdd(parentId)}
                                onSelectSetting={setSelectedSettingId}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      {/* 右侧：详情面板 */}
                      <SettingDetailPanel
                        selectedSetting={selectedSetting}
                        breadcrumbPath={breadcrumbPath}
                        onSelectSetting={setSelectedSettingId}
                        onEdit={handleEdit}
                        onToggle={(s) => toggleSetting(s.id)}
                        onDelete={setDeletingSetting}
                        projectId={projectId}
                        allSettings={settings}
                      />
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </motion.div>
        </div>
      </div>

      {/* 编辑设定 (Dialog 居中浮动窗) */}
      <SettingEditorSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        editingSetting={editingSetting}
        categoryLabel={currentCategory?.label}
        categoryDescription={currentCategory?.description}
        formName={formName}
        setFormName={setFormName}
        formContent={formContent}
        setFormContent={setFormContent}
        formParentId={formParentId}
        setFormParentId={setFormParentId}
        formInjectionMode={formInjectionMode}
        setFormInjectionMode={setFormInjectionMode}
        formPriority={formPriority}
        setFormPriority={setFormPriority}
        formKeywords={formKeywords}
        setFormKeywords={setFormKeywords}
        formSummary={formSummary}
        setFormSummary={setFormSummary}
        activeTab={activeTab}
        settings={settings}
        globalConfig={globalConfig}
        onGlobalConfigChange={setGlobalConfig}
        onSave={handleSave}
      />

      {/* 注入提示词编辑器 (Dialog 居中浮动窗) */}
      <PromptEditorSheet
        open={isPromptSheetOpen}
        onOpenChange={setIsPromptSheetOpen}
        promptTemplate={promptTemplate}
        setPromptTemplate={setPromptTemplate}
        onSave={handleSavePrompt}
      />

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
