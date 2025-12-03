// 流式输出显示组件

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check, Edit2, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

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

  // 自动滚动到底部
  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
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
    <div className={cn('relative h-full', className)} ref={scrollRef}>
      <ScrollArea className="h-full">
        <div className="p-4">
          {/* 输出内容 */}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap break-words rounded-lg bg-muted p-4 font-mono text-sm">
              {content}
              {/* 流式输出时显示光标 */}
              {isStreaming && (
                <motion.span
                  className="inline-block h-4 w-2 bg-primary"
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />
              )}
            </pre>
          </div>
        </div>
      </ScrollArea>

      {/* 复制按钮 */}
      {showCopy && content && (
        <Button
          variant="outline"
          size="icon"
          className="absolute right-4 top-4 h-8 w-8"
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
}: NodeOutputPanelProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedOutput, setEditedOutput] = useState(output)

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

// 执行输出面板（显示所有节点输出）
interface ExecutionOutputPanelProps {
  outputs: Array<{
    nodeId: string
    nodeName: string
    nodeType: string
    output: string
    isRunning?: boolean
    isStreaming?: boolean
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

