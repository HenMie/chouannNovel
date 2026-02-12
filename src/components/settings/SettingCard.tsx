import { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Users,
  Globe,
  Palette,
  FileText,
  Trash2,
  Edit2,
  ToggleLeft,
  ToggleRight,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { cn } from '@/lib/utils'
import type { Setting, SettingCategory } from '@/types'

// 分类配置
export const CATEGORIES: Array<{
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

// 设定卡片组件（带动画）
interface SettingCardProps {
  setting: Setting
  index: number
  isSelected: boolean
  isActive: boolean
  selectionMode: boolean
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  onSelect: (selected: boolean) => void
  onShiftSelect: () => void
  onSelectSetting: () => void
}

export function SettingCard({ setting, index, isSelected, isActive, selectionMode, onEdit, onDelete, onToggle, onSelect, onShiftSelect, onSelectSetting }: SettingCardProps) {
  // 处理点击卡片（用于 Shift 选择）
  const handleCardClick = (e: React.MouseEvent) => {
    if (selectionMode && e.shiftKey) {
      e.preventDefault()
      onShiftSelect()
    } else {
      onSelectSetting()
    }
  }

  const cardContent = (
    <Card
      className={cn(
        'transition-all duration-200 hover:border-primary/50 hover:-translate-y-px hover:shadow-md py-0 gap-0',
        !setting.enabled && 'opacity-60',
        isSelected && 'border-primary ring-1 ring-primary/30 bg-primary/5',
        isActive && !isSelected && 'border-primary/60 bg-primary/5'
      )}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-0 pt-1.5 px-3">
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
            <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold">{setting.name}</CardTitle>
                {setting.injection_mode === 'auto' && (
                  <Badge variant="secondary" className="h-4 px-1 text-[9px] gap-0.5">
                    <Zap className="h-2.5 w-2.5" />自动
                  </Badge>
                )}
                {setting.priority === 'high' && (
                  <Badge variant="destructive" className="h-4 px-1 text-[9px]">高优</Badge>
                )}
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
      <CardContent className={cn("pt-0 pb-1.5 px-3", selectionMode ? "ml-[52px]" : "ml-3")}>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {setting.content}
        </p>
      </CardContent>
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

// 虚拟列表专用的设定卡片（无动画版本，提高性能）
export function SettingCardVirtual({
  setting,
  isSelected,
  isActive,
  selectionMode,
  onEdit,
  onDelete,
  onToggle,
  onSelect,
  onShiftSelect,
  onSelectSetting,
}: {
  setting: Setting
  isSelected: boolean
  isActive: boolean
  selectionMode: boolean
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  onSelect: (selected: boolean) => void
  onShiftSelect: () => void
  onSelectSetting: () => void
}) {
  // 处理点击卡片（用于 Shift 选择）
  const handleCardClick = (e: React.MouseEvent) => {
    if (selectionMode && e.shiftKey) {
      e.preventDefault()
      onShiftSelect()
    } else {
      onSelectSetting()
    }
  }
  const cardContent = (
    <Card
      className={cn(
        'transition-all duration-200 hover:border-primary/50 hover:-translate-y-px hover:shadow-md py-0 gap-0',
        !setting.enabled && 'opacity-60',
        isSelected && 'border-primary ring-1 ring-primary/30 bg-primary/5',
        isActive && !isSelected && 'border-primary/60 bg-primary/5'
      )}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-0 pt-1.5 px-3">
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
            <div className="flex items-center gap-2">
               <CardTitle className="text-sm font-semibold">{setting.name}</CardTitle>
               {setting.injection_mode === 'auto' && (
                 <Badge variant="secondary" className="h-4 px-1 text-[9px] gap-0.5">
                   <Zap className="h-2.5 w-2.5" />自动
                 </Badge>
               )}
               {setting.priority === 'high' && (
                 <Badge variant="destructive" className="h-4 px-1 text-[9px]">高优</Badge>
               )}
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
      <CardContent className={cn("pt-0 pb-1.5 px-3", selectionMode ? "ml-[52px]" : "ml-3")}>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {setting.content}
        </p>
      </CardContent>
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

// 虚拟设定列表组件
export function VirtualSettingsList({
  settings,
  selectedIds,
  selectionMode,
  selectedSettingId,
  onEdit,
  onDelete,
  onToggle,
  onSelect,
  onShiftSelect,
  onSelectSetting,
}: {
  settings: Setting[]
  selectedIds: Set<string>
  selectionMode: boolean
  selectedSettingId: string | null
  onEdit: (setting: Setting) => void
  onDelete: (setting: Setting) => void
  onToggle: (id: string) => void
  onSelect: (id: string, selected: boolean) => void
  onShiftSelect: (id: string) => void
  onSelectSetting: (id: string) => void
}) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: settings.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
    getItemKey: (index) => settings[index].id,
  })

  const virtualItems = virtualizer.getVirtualItems()

  // 如果设定数量较少（<20），直接渲染不使用虚拟化
  if (settings.length < 50) {
    return (
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {settings.map((setting, index) => (
            <SettingCard
              key={setting.id}
              setting={setting}
              index={index}
              isSelected={selectedIds.has(setting.id)}
              isActive={selectedSettingId === setting.id}
              selectionMode={selectionMode}
              onEdit={() => onEdit(setting)}
              onDelete={() => onDelete(setting)}
              onToggle={() => onToggle(setting.id)}
              onSelect={(selected) => onSelect(setting.id, selected)}
              onShiftSelect={() => onShiftSelect(setting.id)}
              onSelectSetting={() => onSelectSetting(setting.id)}
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
                isSelected={selectedIds.has(setting.id)}
                isActive={selectedSettingId === setting.id}
                selectionMode={selectionMode}
                onEdit={() => onEdit(setting)}
                onDelete={() => onDelete(setting)}
                onToggle={() => onToggle(setting.id)}
                onSelect={(selected) => onSelect(setting.id, selected)}
                onShiftSelect={() => onShiftSelect(setting.id)}
                onSelectSetting={() => onSelectSetting(setting.id)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
