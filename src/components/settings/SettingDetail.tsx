import { useState, useMemo } from 'react'
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Maximize2,
  Clock,
  Type,
  Zap,
  Flag,
  Link2,
  Plus,
  X as XIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { parseContentToSections, type ContentSection } from '@/lib/markdown-headings'
import { useSettingsStore } from '@/stores/settings-store'
import type { Setting, SettingRelation } from '@/types'

// 相对时间格式化
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()

  if (diffMs < 0) return '刚刚'

  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) return '刚刚'
  if (diffMinutes < 60) return `${diffMinutes}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  return `${diffDays}天前`
}

// 估算 token 数 (中英文混合粗略估算)
function estimateTokens(text: string): number {
  return Math.ceil(text.length * 0.6)
}

// 注入模式标签
const INJECTION_MODE_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  auto: { label: '自动注入', variant: 'default' },
  manual: { label: '手动注入', variant: 'secondary' },
}

// 优先级标签
const PRIORITY_LABELS: Record<string, { label: string; className: string }> = {
  high: { label: '高', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800' },
  medium: { label: '中', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800' },
  low: { label: '低', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800' },
}

// 树形内容节点组件
function ContentTreeNode({ section, depth = 0 }: { section: ContentSection; depth?: number }) {
  const [collapsed, setCollapsed] = useState(false)
  const hasChildren = section.children.length > 0

  return (
    <div id={section.id} style={{ paddingLeft: depth > 0 ? `${depth * 16}px` : undefined }}>
      {section.title && (
        <div className="flex items-center gap-1 py-1">
          {hasChildren ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 shrink-0"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>
          ) : (
            <span className="w-5 shrink-0" />
          )}
          <span className={cn(
            'font-semibold',
            section.level === 1 && 'text-base',
            section.level === 2 && 'text-sm',
            section.level >= 3 && 'text-sm text-muted-foreground',
          )}>
            {section.title}
          </span>
        </div>
      )}
      {!collapsed && (
        <>
          {section.content && (
            <div className={cn(
              'text-sm whitespace-pre-wrap',
              section.title ? 'pl-6 pb-1' : 'pb-1',
            )}>
              {section.content}
            </div>
          )}
          {hasChildren && section.children.map((child) => (
            <ContentTreeNode key={child.id} section={child} depth={depth + 1} />
          ))}
        </>
      )}
    </div>
  )
}

// 设定内容树形展示
export function SettingContentTree({ content }: { content: string }) {
  const sections = useMemo(() => parseContentToSections(content), [content])

  if (sections.length === 0) return null

  // 如果内容没有标题结构，使用原始展示
  if (sections.length === 1 && !sections[0].title) {
    return (
      <div className="text-sm whitespace-pre-wrap">
        {content}
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      {sections.map((section) => (
        <ContentTreeNode key={section.id} section={section} />
      ))}
    </div>
  )
}

// 右侧详情面板
export function SettingDetailPanel({
  selectedSetting,
  breadcrumbPath,
  onSelectSetting,
  onEdit,
  onToggle,
  onDelete,
  projectId,
  allSettings,
}: {
  selectedSetting: Setting | null
  breadcrumbPath: Setting[]
  onSelectSetting: (id: string) => void
  onEdit?: (setting: Setting) => void
  onToggle?: (setting: Setting) => void
  onDelete?: (setting: Setting) => void
  projectId?: string
  allSettings?: Setting[]
}) {
  const [fullScreenOpen, setFullScreenOpen] = useState(false)

  const charCount = selectedSetting ? selectedSetting.content.length : 0
  const tokenEstimate = selectedSetting ? estimateTokens(selectedSetting.content) : 0

  return (
    <div className="w-80 shrink-0">
      <div className="sticky top-4 max-h-[calc(100vh-280px)] overflow-y-auto rounded-lg border bg-card p-2.5">
        {selectedSetting ? (
          <div>
            {breadcrumbPath.length > 0 && (
              <div className="flex items-center gap-1 mb-1.5 text-[10px] text-muted-foreground flex-wrap">
                {breadcrumbPath.map((ancestor, i) => (
                  <span key={ancestor.id} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight className="h-2.5 w-2.5" />}
                    <button
                      type="button"
                      className="hover:text-foreground transition-colors hover:underline"
                      onClick={() => onSelectSetting(ancestor.id)}
                    >
                      {ancestor.name}
                    </button>
                  </span>
                ))}
                <ChevronRight className="h-2.5 w-2.5" />
              </div>
            )}

            {/* 标题行 + 快捷操作 */}
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold truncate" title={selectedSetting.name}>
                {selectedSetting.name}
              </h3>
              <div className="flex items-center gap-0.5 shrink-0 ml-2">
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    title="编辑"
                    onClick={() => onEdit(selectedSetting)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                {onToggle && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    title={selectedSetting.enabled ? '禁用' : '启用'}
                    onClick={() => onToggle(selectedSetting)}
                  >
                    {selectedSetting.enabled ? (
                      <ToggleRight className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    title="删除"
                    onClick={() => onDelete(selectedSetting)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  title="全屏查看"
                  onClick={() => setFullScreenOpen(true)}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* 元数据区域 */}
            <div className="mb-2 space-y-1.5">
              {/* 徽章行: 启用状态 + 注入模式 + 优先级 */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {!selectedSetting.enabled && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                    已禁用
                  </Badge>
                )}
                {selectedSetting.injection_mode && (
                  <Badge
                    variant={INJECTION_MODE_LABELS[selectedSetting.injection_mode]?.variant ?? 'secondary'}
                    className="text-[10px] px-1.5 py-0 h-4"
                  >
                    <Zap className="h-2.5 w-2.5" />
                    {INJECTION_MODE_LABELS[selectedSetting.injection_mode]?.label ?? selectedSetting.injection_mode}
                  </Badge>
                )}
                {selectedSetting.priority && PRIORITY_LABELS[selectedSetting.priority] && (
                  <Badge
                    variant="outline"
                    className={cn('text-[10px] px-1.5 py-0 h-4', PRIORITY_LABELS[selectedSetting.priority].className)}
                  >
                    <Flag className="h-2.5 w-2.5" />
                    {PRIORITY_LABELS[selectedSetting.priority].label}
                  </Badge>
                )}
              </div>

              {/* 统计信息 */}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-0.5" title="字数">
                  <Type className="h-2.5 w-2.5" />
                  {charCount.toLocaleString()} 字
                </span>
                <span title="预估 Token 数">
                  ~{tokenEstimate.toLocaleString()} tokens
                </span>
              </div>

              {/* 时间信息 */}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                {selectedSetting.created_at && (
                  <span className="flex items-center gap-0.5" title={`创建于 ${selectedSetting.created_at}`}>
                    <Clock className="h-2.5 w-2.5" />
                    创建: {formatRelativeTime(selectedSetting.created_at)}
                  </span>
                )}
                {selectedSetting.updated_at && selectedSetting.updated_at !== selectedSetting.created_at && (
                  <span title={`更新于 ${selectedSetting.updated_at}`}>
                    更新: {formatRelativeTime(selectedSetting.updated_at)}
                  </span>
                )}
              </div>
            </div>

            {/* 内容区域 */}
            <div className="rounded bg-muted/30 p-2">
              <SettingContentTree content={selectedSetting.content} />
            </div>

            {/* 关联设定 */}
            <RelationsSection
              setting={selectedSetting}
              projectId={projectId}
              allSettings={allSettings}
              onSelectSetting={onSelectSetting}
            />

            {/* 全屏查看 Dialog */}
            <Dialog open={fullScreenOpen} onOpenChange={setFullScreenOpen}>
              <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>{selectedSetting.name}</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto rounded bg-muted/30 p-4">
                  <SettingContentTree content={selectedSetting.content} />
                </div>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">点击左侧设定查看详情</p>
          </div>
        )}
      </div>
    </div>
  )
}

function RelationsSection({
  setting,
  projectId,
  allSettings,
  onSelectSetting,
}: {
  setting: Setting
  projectId?: string
  allSettings?: Setting[]
  onSelectSetting: (id: string) => void
}) {
  const { getRelationsForSetting, addRelation, removeRelation } = useSettingsStore()
  const [addOpen, setAddOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [newLabel, setNewLabel] = useState('')

  const relations = getRelationsForSetting(setting.id)

  const relatedIds = new Set(relations.map(r => r.source_id === setting.id ? r.target_id : r.source_id))
  const candidates = (allSettings || []).filter(s =>
    s.id !== setting.id &&
    !relatedIds.has(s.id) &&
    (searchQuery ? s.name.toLowerCase().includes(searchQuery.toLowerCase()) : true)
  ).slice(0, 10)

  const handleAddRelation = async (targetId: string) => {
    if (!projectId) return
    await addRelation(projectId, setting.id, targetId, newLabel || undefined)
    setAddOpen(false)
    setSearchQuery('')
    setNewLabel('')
  }

  const handleRemoveRelation = async (relationId: string) => {
    await removeRelation(relationId)
  }

  const getOtherSetting = (relation: SettingRelation) => {
    const otherId = relation.source_id === setting.id ? relation.target_id : relation.source_id
    return (allSettings || []).find(s => s.id === otherId)
  }

  if (!projectId) return null

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Link2 className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-medium text-muted-foreground">关联设定</span>
        </div>
        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
              <Plus className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" side="left">
            <div className="space-y-2">
              <Input
                placeholder="搜索设定..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-7 text-xs"
                autoComplete="off"
              />
              <Input
                placeholder={'关系标签（可选，如\u201c师徒\u201d）'}
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                className="h-7 text-xs"
                autoComplete="off"
              />
              <div className="max-h-[150px] overflow-y-auto space-y-0.5">
                {candidates.length > 0 ? candidates.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted transition-colors truncate"
                    onClick={() => handleAddRelation(s.id)}
                  >
                    {s.name}
                    <span className="ml-1 text-[10px] text-muted-foreground">({s.category})</span>
                  </button>
                )) : (
                  <p className="text-[10px] text-muted-foreground text-center py-2">
                    {searchQuery ? '未找到匹配设定' : '输入关键词搜索'}
                  </p>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {relations.length > 0 ? (
        <div className="space-y-1">
          {relations.map(rel => {
            const other = getOtherSetting(rel)
            if (!other) return null
            return (
              <div key={rel.id} className="flex items-center gap-1.5 group">
                <button
                  type="button"
                  className="flex-1 min-w-0 flex items-center gap-1.5 text-xs text-left px-1.5 py-1 rounded hover:bg-muted transition-colors"
                  onClick={() => onSelectSetting(other.id)}
                >
                  <span className="truncate">{other.name}</span>
                  {rel.label && (
                    <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 shrink-0">
                      {rel.label}
                    </Badge>
                  )}
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={() => handleRemoveRelation(rel.id)}
                >
                  <XIcon className="h-2.5 w-2.5 text-muted-foreground" />
                </Button>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground">暂无关联</p>
      )}
    </div>
  )
}
