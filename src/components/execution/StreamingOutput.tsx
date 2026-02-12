// 流式输出显示组件

import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, Check, Edit2, Save, X, ChevronDown, ChevronRight, Settings2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { ResolvedNodeConfig } from '@/lib/engine'

const MarkdownRenderer = lazy(() => import('@/components/ui/markdown-renderer'))

interface StreamingOutputProps {
  content: string
  isStreaming?: boolean
  className?: string
  showCopy?: boolean
}

export function StreamingOutput({
  content,
  isStreaming = false,
  className,
  showCopy = true,
}: StreamingOutputProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [isStalled, setIsStalled] = useState(false)
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 流式输出时节流渲染 Markdown，避免每个 chunk 都全量重渲染
  const [throttledContent, setThrottledContent] = useState(content)
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isStreaming) {
      // 非流式状态，直接同步内容
      setThrottledContent(content)
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current)
        throttleTimerRef.current = null
      }
      return
    }

    // 流式状态：节流更新（每 150ms 最多渲染一次）
    if (!throttleTimerRef.current) {
      throttleTimerRef.current = setTimeout(() => {
        setThrottledContent(content)
        throttleTimerRef.current = null
      }, 150)
    }

    return () => {
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current)
        throttleTimerRef.current = null
      }
    }
  }, [content, isStreaming])

  // 自动滚动到底部
  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [content, isStreaming])

  // 流式输出停滞检测（30 秒无新内容则警告）
  useEffect(() => {
    if (isStreaming) {
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current)
      }
      setIsStalled(false)
      stallTimerRef.current = setTimeout(() => {
        setIsStalled(true)
      }, 30000)
    } else {
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current)
        stallTimerRef.current = null
      }
      setIsStalled(false)
    }
    return () => {
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current)
        stallTimerRef.current = null
      }
    }
  }, [content, isStreaming])

  // 复制内容
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      toast.success('已复制到剪贴板')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('复制失败')
    }
  }

  if (!content && !isStreaming) {
    return (
      <div className={cn('flex items-center justify-center py-12 text-center', className)}>
        <p className="text-sm text-muted-foreground">运行工作流后，输出将显示在这里</p>
      </div>
    )
  }

  return (
    <div className={cn('relative h-full group', className)} ref={scrollRef}>
      <ScrollArea className="h-full">
        <div className="p-4">
          {/* 输出内容 */}
          <Suspense fallback={
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </div>
          }>
            <MarkdownRenderer
              content={throttledContent + (isStreaming ? ' ▍' : '')}
            />
          </Suspense>
        </div>
        {isStalled && (
          <div className="flex items-center gap-2 px-4 py-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 border-t">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>流式输出已停滞超过 30 秒，可能存在网络问题或 API 响应中断</span>
          </div>
        )}
      </ScrollArea>

      {/* 复制按钮 */}
      {showCopy && content && (
        <Button
          variant="outline"
          size="icon"
          className="absolute right-4 top-4 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  )
}

// 节点输出面板组件
interface NodeOutputPanelProps {
  nodeId: string
  nodeName: string
  nodeType: string
  output: string
  isRunning?: boolean
  isStreaming?: boolean
  canEdit?: boolean       // 是否可以编辑（暂停状态）
  onEdit?: (nodeId: string, newOutput: string) => void  // 编辑回调
  resolvedConfig?: ResolvedNodeConfig  // 解析后的节点配置
}

export function NodeOutputPanel({
  nodeId,
  nodeName,
  nodeType,
  output,
  isRunning = false,
  isStreaming = false,
  canEdit = false,
  onEdit,
  resolvedConfig,
}: NodeOutputPanelProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedOutput, setEditedOutput] = useState(output)
  const [showConfig, setShowConfig] = useState(false)  // 是否展开配置详情

  // 当输出变化时同步编辑内容
  useEffect(() => {
    if (!isEditing) {
      setEditedOutput(output)
    }
  }, [output, isEditing])

  // 保存编辑
  const handleSave = () => {
    if (onEdit && editedOutput !== output) {
      onEdit(nodeId, editedOutput)
      toast.success('节点输出已修改')
    }
    setIsEditing(false)
  }

  // 取消编辑
  const handleCancel = () => {
    setEditedOutput(output)
    setIsEditing(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-lg border bg-card',
        isEditing && 'ring-2 ring-primary'
      )}
    >
      {/* 节点标题 */}
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <div
          className={cn(
            'h-2 w-2 rounded-full',
            isRunning ? 'animate-pulse bg-yellow-500' : output ? 'bg-green-500' : 'bg-muted'
          )}
        />
        <span className="text-sm font-medium">{nodeName}</span>
        <span className="text-xs text-muted-foreground">({nodeType})</span>
        
        {/* 编辑按钮 */}
        <div className="ml-auto flex items-center gap-1">
          {canEdit && !isRunning && !isStreaming && output && (
            <>
              {isEditing ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleSave}
                  >
                    <Save className="h-3.5 w-3.5 text-green-500" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleCancel}
                  >
                    <X className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setIsEditing(true)}
                  title="编辑输出（人工干预）"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 解析后的配置详情（可折叠） */}
      {resolvedConfig && hasResolvedConfig(resolvedConfig) && (
        <div className="border-b">
          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs hover:bg-muted/50 transition-colors"
          >
            {showConfig ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">执行配置详情</span>
          </button>
          <AnimatePresence initial={false}>
            {showConfig && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <ResolvedConfigDisplay config={resolvedConfig} nodeType={nodeType} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 输出内容 */}
      <div className="max-h-[300px]">
        {isRunning && !output ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              执行中...
            </div>
          </div>
        ) : isEditing ? (
          <div className="p-4">
            <Textarea
              value={editedOutput}
              onChange={(e) => setEditedOutput(e.target.value)}
              rows={10}
              className="min-h-[200px] font-mono text-sm"
              placeholder="编辑节点输出..."
            />
            <p className="mt-2 text-xs text-muted-foreground">
              提示：修改此节点输出后，后续节点将使用修改后的内容
            </p>
          </div>
        ) : (
          <StreamingOutput
            content={output}
            isStreaming={isStreaming}
            showCopy={!isStreaming}
            className="max-h-[250px]"
          />
        )}
      </div>
    </motion.div>
  )
}

// 检查是否有解析后的配置
export function hasResolvedConfig(config: ResolvedNodeConfig): boolean {
  return !!(
    config.systemPrompt ||
    config.userPrompt ||
    config.provider ||
    config.model ||
    config.inputText ||
    config.conditionInput ||
    config.variableName ||
    (config.resolvedSources && config.resolvedSources.length > 0)
  )
}

// 提取模式显示名称
const extractModeLabels: Record<string, string> = {
  regex: '正则表达式',
  start_end: '起止标记',
  json_path: 'JSON 路径',
}

// 条件类型显示名称
const conditionTypeLabels: Record<string, string> = {
  keyword: '关键词匹配',
  length: '长度判断',
  regex: '正则匹配',
  ai_judge: 'AI 智能判断',
}

// 关键词模式显示名称
const keywordModeLabels: Record<string, string> = {
  any: '包含任一',
  all: '包含全部',
  none: '不包含任何',
}

// 解析后配置显示组件
export function ResolvedConfigDisplay({ 
  config, 
  nodeType: _nodeType 
}: { 
  config: ResolvedNodeConfig
  nodeType: string 
}) {
  return (
    <div className="space-y-3 px-4 py-3 bg-muted/30 text-xs">
      {/* === AI 对话节点 === */}
      {(config.provider || config.model) && (
        <div className="flex flex-wrap gap-2 pb-2 border-b border-border/50">
          {config.provider && (
            <ConfigBadge label="提供商" value={config.provider} />
          )}
          {config.model && (
            <ConfigBadge label="模型" value={config.model} />
          )}
          {config.temperature !== undefined && (
            <ConfigBadge label="温度" value={String(config.temperature)} />
          )}
          {config.maxTokens !== undefined && (
            <ConfigBadge label="最大 Token" value={String(config.maxTokens)} />
          )}
          {config.topP !== undefined && (
            <ConfigBadge label="Top P" value={String(config.topP)} />
          )}
          {config.enableHistory && (
            <ConfigBadge label="对话历史" value={`${config.historyCount || 0} 轮`} />
          )}
        </div>
      )}
      
      {/* 使用的设定 */}
      {config.settingNames && config.settingNames.length > 0 && (
        <div className="flex flex-wrap gap-1 pb-2 border-b border-border/50">
          <span className="text-muted-foreground mr-1">使用设定:</span>
          {config.settingNames.map((name, i) => (
            <span key={i} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px]">
              {name}
            </span>
          ))}
        </div>
      )}
      
      {/* 用户问题 */}
      {config.userPrompt && (
        <ConfigItem 
          label="用户问题" 
          value={config.userPrompt}
          highlight
        />
      )}
      
      {/* 系统提示词 */}
      {config.systemPrompt && (
        <ConfigItem 
          label="系统提示词" 
          value={config.systemPrompt}
        />
      )}
      
      {/* === 文本提取节点 === */}
      {config.extractMode && (
        <div className="flex flex-wrap gap-2 pb-2 border-b border-border/50">
          <ConfigBadge label="提取模式" value={extractModeLabels[config.extractMode] || config.extractMode} />
          {config.regexPattern && (
            <ConfigBadge label="正则" value={config.regexPattern} />
          )}
          {config.startMarker && (
            <ConfigBadge label="起始标记" value={config.startMarker} />
          )}
          {config.endMarker && (
            <ConfigBadge label="结束标记" value={config.endMarker} />
          )}
          {config.jsonPath && (
            <ConfigBadge label="JSON 路径" value={config.jsonPath} />
          )}
        </div>
      )}
      
      {config.inputText && (
        <ConfigItem 
          label="输入文本" 
          value={config.inputText}
        />
      )}
      
      {/* === 条件判断节点 === */}
      {config.conditionType && (
        <div className="flex flex-wrap gap-2 pb-2 border-b border-border/50">
          <ConfigBadge label="条件类型" value={conditionTypeLabels[config.conditionType] || config.conditionType} />
          {config.keywordMode && (
            <ConfigBadge label="匹配模式" value={keywordModeLabels[config.keywordMode] || config.keywordMode} />
          )}
          {config.keywords && config.keywords.length > 0 && (
            <ConfigBadge label="关键词" value={config.keywords.join(', ')} />
          )}
        </div>
      )}
      
      {config.conditionInput && (
        <ConfigItem 
          label="条件输入" 
          value={config.conditionInput}
        />
      )}
      
      {/* === 文本拼接节点 === */}
      {config.resolvedSources && config.resolvedSources.length > 0 && (
        <>
          {config.separator && (
            <div className="pb-2 border-b border-border/50">
              <ConfigBadge label="分隔符" value={config.separator === '\n' ? '换行符' : `"${config.separator}"`} />
            </div>
          )}
          <div className="space-y-2">
            <span className="font-medium text-muted-foreground">拼接来源:</span>
            {config.resolvedSources.map((source, index) => (
              <ConfigItem 
                key={index}
                label={`来源 ${index + 1}`}
                value={source}
              />
            ))}
          </div>
        </>
      )}
      
      {/* === 变量节点 === */}
      {config.variableName && (
        <div className="flex flex-wrap gap-2 pb-2 border-b border-border/50">
          <ConfigBadge label="变量名" value={config.variableName} />
        </div>
      )}
      {config.variableValue && (
        <ConfigItem 
          label="变量值" 
          value={config.variableValue}
        />
      )}
      
      {/* === 循环节点 === */}
      {config.loopType && (
        <div className="flex flex-wrap gap-2">
          <ConfigBadge label="循环类型" value={config.loopType === 'count' ? '固定次数' : '条件循环'} />
          {config.maxIterations !== undefined && (
            <ConfigBadge label="最大次数" value={String(config.maxIterations)} />
          )}
          {config.currentIteration !== undefined && (
            <ConfigBadge label="当前迭代" value={String(config.currentIteration)} />
          )}
        </div>
      )}
    </div>
  )
}

// 配置标签组件（用于显示简短的配置项）
function ConfigBadge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-[10px]">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium truncate max-w-[150px]" title={value}>{value}</span>
    </span>
  )
}

// 配置项显示组件
function ConfigItem({ 
  label, 
  value, 
  highlight = false 
}: { 
  label: string
  value: string 
  highlight?: boolean
}) {
  const [copied, setCopied] = useState(false)
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success('已复制')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('复制失败')
    }
  }
  
  // 截断长文本显示
  const displayValue = value.length > 500 ? value.slice(0, 500) + '...' : value
  const isLong = value.length > 200
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className={cn(
          "font-medium",
          highlight ? "text-primary" : "text-muted-foreground"
        )}>
          {label}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>
      <div className={cn(
        "rounded-md border bg-background p-2 font-mono whitespace-pre-wrap break-all",
        isLong && "max-h-[150px] overflow-y-auto"
      )}>
        {displayValue}
      </div>
    </div>
  )
}

// 执行输出面板（显示所有节点输出）
interface ExecutionOutputPanelProps {
  outputs: Array<{
    nodeId: string
    nodeName: string
    nodeType: string
    output: string
    isRunning?: boolean
    isStreaming?: boolean
    resolvedConfig?: ResolvedNodeConfig
  }>
  finalOutput?: string
  isExecuting?: boolean
}

export function ExecutionOutputPanel({
  outputs,
  finalOutput,
  isExecuting = false,
}: ExecutionOutputPanelProps) {
  if (outputs.length === 0 && !finalOutput) {
    return (
      <div className="flex h-full items-center justify-center text-center">
        <p className="text-sm text-muted-foreground">运行工作流后，输出将显示在这里</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      {/* 节点输出列表 */}
      {outputs.map((output) => (
        <NodeOutputPanel
          key={output.nodeId}
          {...output}
        />
      ))}

      {/* 最终输出 */}
      {finalOutput && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border-2 border-primary bg-card"
        >
          <div className="flex items-center gap-2 border-b px-4 py-2">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-sm font-medium">最终输出</span>
          </div>
          <StreamingOutput content={finalOutput} className="max-h-[400px]" />
        </motion.div>
      )}

      {/* 执行状态 */}
      {isExecuting && (
        <div className="flex items-center justify-center py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            正在执行工作流...
          </div>
        </div>
      )}
    </div>
  )
}

