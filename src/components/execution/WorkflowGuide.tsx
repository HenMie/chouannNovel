// 工作流操作指引组件
// 在执行输出面板空闲时显示操作提示和快捷键

import { motion } from 'framer-motion'
import {
  Play,
  Pause,
  Square,
  Keyboard,
  Lightbulb,
  Zap,
  MousePointer,
  Copy,
  Undo2,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface WorkflowGuideProps {
  hasNodes: boolean
  hasAINode: boolean
  isAIConfigured: boolean
  onNavigateToSettings?: () => void
  className?: string
}

// 快捷键配置
const shortcuts = [
  { keys: ['Ctrl', 'Enter'], label: '运行工作流', icon: Play },
  { keys: ['Space'], label: '暂停/继续', icon: Pause },
  { keys: ['Esc'], label: '停止执行', icon: Square },
  { keys: ['Ctrl', 'Z'], label: '撤销', icon: Undo2 },
  { keys: ['Ctrl', 'C'], label: '复制节点', icon: Copy },
  { keys: ['Ctrl', 'V'], label: '粘贴节点', icon: Copy },
]

// 快捷键徽章组件
function KeyBadge({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground shadow-sm">
      {children}
    </kbd>
  )
}

export function WorkflowGuide({
  hasNodes,
  hasAINode,
  isAIConfigured,
  onNavigateToSettings,
  className,
}: WorkflowGuideProps) {
  // 动画变体
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  }

  return (
    <motion.div
      className={cn('flex flex-col gap-4 p-4', className)}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* 标题区域 */}
      <motion.div variants={itemVariants} className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Zap className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-sm font-medium">准备就绪</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {hasNodes ? '配置好节点后，点击运行开始执行' : '添加节点来构建你的工作流'}
        </p>
      </motion.div>

      {/* AI 配置提示 */}
      {hasAINode && !isAIConfigured && (
        <motion.div
          variants={itemVariants}
          className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900/50 dark:bg-yellow-950/20"
        >
          <div className="flex items-start gap-2">
            <Settings className="mt-0.5 h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <div className="flex-1">
              <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200">
                需要配置 AI 服务
              </p>
              <p className="mt-0.5 text-xs text-yellow-700 dark:text-yellow-300">
                检测到 AI 对话节点，请先配置 API Key
              </p>
              {onNavigateToSettings && (
                <Button
                  variant="link"
                  size="sm"
                  className="mt-1 h-auto p-0 text-xs text-yellow-700 underline dark:text-yellow-300"
                  onClick={onNavigateToSettings}
                >
                  前往设置 →
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* 快捷键提示 */}
      <motion.div variants={itemVariants}>
        <div className="mb-2 flex items-center gap-1.5">
          <Keyboard className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">快捷键</span>
        </div>
        <div className="space-y-1.5">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5"
            >
              <div className="flex items-center gap-1.5">
                <shortcut.icon className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{shortcut.label}</span>
              </div>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <KeyBadge>{key}</KeyBadge>
                    {i < shortcut.keys.length - 1 && (
                      <span className="text-[10px] text-muted-foreground">+</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* 操作提示 */}
      <motion.div variants={itemVariants}>
        <div className="mb-2 flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">小提示</span>
        </div>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex items-start gap-2 rounded-md bg-muted/50 px-2 py-1.5">
            <MousePointer className="mt-0.5 h-3 w-3 shrink-0" />
            <span>点击节点可编辑配置，拖拽可调整顺序</span>
          </div>
          <div className="flex items-start gap-2 rounded-md bg-muted/50 px-2 py-1.5">
            <Play className="mt-0.5 h-3 w-3 shrink-0" />
            <span>执行时可暂停并修改中间输出，实现人工干预</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// 折叠状态下的迷你指示器
interface CollapsedIndicatorProps {
  executionStatus: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'timeout'
  onExpand: () => void
}

export function CollapsedOutputIndicator({ executionStatus, onExpand }: CollapsedIndicatorProps) {
  // 状态配置
  const statusConfig: Record<string, { icon: typeof Play; color: string; label: string; animate?: boolean }> = {
    idle: { icon: Play, color: 'text-muted-foreground', label: '就绪' },
    running: { icon: Play, color: 'text-primary', label: '执行中', animate: true },
    paused: { icon: Pause, color: 'text-yellow-500', label: '已暂停' },
    completed: { icon: Zap, color: 'text-green-500', label: '完成' },
    failed: { icon: Square, color: 'text-red-500', label: '失败' },
    cancelled: { icon: Square, color: 'text-muted-foreground', label: '已取消' },
    timeout: { icon: Square, color: 'text-orange-500', label: '超时' },
  }

  const config = statusConfig[executionStatus] || statusConfig.idle
  const Icon = config.icon

  return (
    <motion.div
      className="flex h-full flex-col items-center border-l bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
      initial={{ opacity: 0, width: 0 }}
      animate={{ opacity: 1, width: 48 }}
      exit={{ opacity: 0, width: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onExpand}
      title="展开输出面板"
    >
      {/* 展开按钮 - 顶部，与折叠按钮位置对应 */}
      <div className="flex h-[53px] w-full items-center justify-center border-b bg-muted/30">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation()
            onExpand()
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Button>
      </div>
      
      {/* 状态图标和文字 */}
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4">
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full',
            executionStatus === 'running' ? 'bg-primary/10' : 'bg-muted'
          )}
        >
          <Icon
            className={cn(
              'h-4 w-4',
              config.color,
              config.animate && 'animate-pulse'
            )}
          />
        </div>
        {/* 竖排文字 */}
        <div className="flex flex-col items-center">
          {config.label.split('').map((char, i) => (
            <span
              key={i}
              className={cn('text-[10px] leading-tight', config.color)}
            >
              {char}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

