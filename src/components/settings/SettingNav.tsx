import { cn } from '@/lib/utils'
import type { Setting } from '@/types'
import type { SettingTreeNode } from '@/stores/settings-store'

// 左侧导航项
export function NavItem({ setting, depth, isActive, onClick }: {
  setting: Setting
  depth: number
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      className={cn(
        'block w-full text-left text-xs truncate py-1.5 px-2 rounded transition-colors',
        isActive
          ? 'bg-primary/10 text-primary font-semibold'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      title={setting.name}
      onClick={onClick}
    >
      {setting.name}
    </button>
  )
}

// 左侧导航树形项（递归）
export function NavTreeItem({ node, depth, selectedSettingId, onSelect }: {
  node: SettingTreeNode
  depth: number
  selectedSettingId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <>
      <NavItem
        setting={node.setting}
        depth={depth}
        isActive={selectedSettingId === node.setting.id}
        onClick={() => onSelect(node.setting.id)}
      />
      {node.children.map((child) => (
        <NavTreeItem
          key={child.setting.id}
          node={child}
          depth={depth + 1}
          selectedSettingId={selectedSettingId}
          onSelect={onSelect}
        />
      ))}
    </>
  )
}
