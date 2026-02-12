import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Trash2,
  Edit2,
  FolderPlus,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { cn } from '@/lib/utils'
import type { Setting } from '@/types'
import type { SettingTreeNode } from '@/stores/settings-store'

// 设定树形项组件（用于层级展示）
export function SettingTreeItem({
  node,
  depth,
  selectionMode,
  selectedIds,
  selectedSettingId,
  onEdit,
  onDelete,
  onToggle,
  onSelect,
  onShiftSelect,
  onAddChild,
  onSelectSetting,
}: {
  node: SettingTreeNode
  depth: number
  selectionMode: boolean
  selectedIds: Set<string>
  selectedSettingId: string | null
  onEdit: (setting: Setting) => void
  onDelete: (setting: Setting) => void
  onToggle: (id: string) => void
  onSelect: (id: string, selected: boolean) => void
  onShiftSelect: (id: string) => void
  onAddChild: (parentId: string) => void
  onSelectSetting: (id: string) => void
}) {
  const [childrenCollapsed, setChildrenCollapsed] = useState(false)
  const { setting, children } = node
  const isSelected = selectedIds.has(setting.id)
  const isActive = selectedSettingId === setting.id
  const hasChildren = children.length > 0

  const handleCardClick = (e: React.MouseEvent) => {
    if (selectionMode && e.shiftKey) {
      e.preventDefault()
      onShiftSelect(setting.id)
    } else {
      onSelectSetting(setting.id)
    }
  }

  return (
    <div className="relative" style={{ paddingLeft: depth > 0 ? `${depth * 16}px` : undefined }}>
      {/* 连接细线 */}
      {depth > 0 && (
        <div
          className="absolute top-0 bottom-0 border-l border-border/50"
          style={{ left: `${(depth - 1) * 16 + 7}px` }}
        />
      )}
      <ContextMenu>
        <ContextMenuTrigger className="block">
          <Card
            className={cn(
              'transition-colors hover:border-primary/50 mb-1.5 py-0 gap-0',
              !setting.enabled && 'opacity-60',
              isSelected && 'border-primary ring-1 ring-primary/30 bg-primary/5',
              isActive && !isSelected && 'border-primary/60 bg-primary/5'
            )}
            onClick={handleCardClick}
          >
            <CardHeader className="pb-0 pt-1.5 px-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {selectionMode && (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => onSelect(setting.id, !!checked)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4"
                    />
                  )}
                  {hasChildren && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                      onClick={(e) => { e.stopPropagation(); setChildrenCollapsed(!childrenCollapsed) }}
                    >
                      {childrenCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-semibold">{setting.name}</CardTitle>
                    {!setting.enabled && (
                      <span className="text-[10px] bg-muted px-1.5 rounded text-muted-foreground">已禁用</span>
                    )}
                    {hasChildren && (
                      <span className="text-[10px] bg-muted px-1.5 rounded text-muted-foreground">{children.length}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Switch
                    id={`switch-${setting.id}`}
                    checked={setting.enabled}
                    onCheckedChange={() => onToggle(setting.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="scale-75 mr-2"
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onAddChild(setting.id) }} title="添加子设定">
                    <FolderPlus className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEdit(setting) }}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); onDelete(setting) }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-1.5 px-3 ml-5">
              <p className="line-clamp-2 text-xs text-muted-foreground">{setting.content}</p>
            </CardContent>
          </Card>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={() => onEdit(setting)}>
            <Edit2 className="mr-2 h-4 w-4" />
            编辑设定
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onAddChild(setting.id)}>
            <FolderPlus className="mr-2 h-4 w-4" />
            添加子设定
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onToggle(setting.id)}>
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
          <ContextMenuItem onClick={() => onDelete(setting)} variant="destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            删除设定
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* 子设定 */}
      {!childrenCollapsed && children.map((child) => (
        <SettingTreeItem
          key={child.setting.id}
          node={child}
          depth={depth + 1}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          selectedSettingId={selectedSettingId}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggle={onToggle}
          onSelect={onSelect}
          onShiftSelect={onShiftSelect}
          onAddChild={onAddChild}
          onSelectSetting={onSelectSetting}
        />
      ))}
    </div>
  )
}
