// 快捷键提示弹窗
// 显示上下文感知的快捷键列表，支持 F1 触发

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Keyboard, Command } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  getGroupedShortcutsForPath,
  getScopeFromPath,
  SCOPE_LABELS,
  type ShortcutGroup,
} from '@/lib/shortcuts'
import { cn } from '@/lib/utils'

interface ShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPath: string
}

// 快捷键徽章组件
function KeyBadge({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  )
}

// 解析并渲染快捷键
function ShortcutKeys({ keys }: { keys: string }) {
  const parts = keys.split('+')
  
  return (
    <div className="flex items-center gap-1">
      {parts.map((part, index) => (
        <KeyBadge key={index}>
          {part === 'Ctrl' ? (
            <span className="flex items-center gap-0.5">
              <Command className="h-3 w-3" />
              <span className="hidden sm:inline">Ctrl</span>
            </span>
          ) : part === 'Shift' ? (
            '⇧'
          ) : part === 'Alt' ? (
            'Alt'
          ) : part === 'Enter' ? (
            '↵'
          ) : part === 'Escape' ? (
            'Esc'
          ) : part === 'Space' ? (
            '␣'
          ) : part === 'Delete' ? (
            'Del'
          ) : part === 'Backspace' ? (
            '⌫'
          ) : (
            part
          )}
        </KeyBadge>
      ))}
    </div>
  )
}

// 快捷键分组组件
function ShortcutGroupSection({ group, index }: { group: ShortcutGroup; index: number }) {
  // 去除重复的快捷键（如 Ctrl+Y 和 Ctrl+Shift+Z 都是重做）
  const uniqueShortcuts = useMemo(() => {
    const seen = new Set<string>()
    return group.shortcuts.filter(shortcut => {
      // 用描述作为唯一标识
      if (seen.has(shortcut.description)) {
        return false
      }
      seen.add(shortcut.description)
      return true
    })
  }, [group.shortcuts])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <div className="mb-3">
        <h4 className="text-sm font-medium text-muted-foreground mb-2">
          {group.label}
        </h4>
        <div className="space-y-1.5">
          {uniqueShortcuts.map((shortcut) => (
            <div
              key={shortcut.id}
              className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{shortcut.description}</span>
                {shortcut.condition && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {shortcut.condition}
                  </Badge>
                )}
              </div>
              <ShortcutKeys keys={shortcut.keys} />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

export function ShortcutsDialog({ open, onOpenChange, currentPath }: ShortcutsDialogProps) {
  const groups = useMemo(() => getGroupedShortcutsForPath(currentPath), [currentPath])
  const currentScope = useMemo(() => getScopeFromPath(currentPath), [currentPath])
  const scopeLabel = SCOPE_LABELS[currentScope]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            快捷键一览
          </DialogTitle>
          <DialogDescription>
            当前页面：<span className="font-medium text-foreground">{scopeLabel}</span>
            <span className="text-muted-foreground ml-1">
              （按 F1 随时打开此面板）
            </span>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 py-2">
            {groups.map((group, index) => (
              <div key={group.id}>
                {index > 0 && <Separator className="my-4" />}
                <ShortcutGroupSection group={group} index={index} />
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className={cn(
          "pt-4 border-t text-center text-xs text-muted-foreground",
          "-mx-6 px-6"
        )}>
          提示：部分快捷键仅在特定条件下可用
        </div>
      </DialogContent>
    </Dialog>
  )
}

