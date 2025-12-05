import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  History,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  StopCircle,
  Play,
  FileDown,
  FileText,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Maximize2,
  Copy,
  Check,
  Settings2,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Header } from '@/components/layout/Header'
import { StreamingOutput, hasResolvedConfig, ResolvedConfigDisplay } from '@/components/execution/StreamingOutput'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import * as db from '@/lib/db'
import { getErrorMessage, handleAppError } from '@/lib/errors'
import type { Execution, NodeResult, WorkflowNode, ExecutionStatus } from '@/types'

interface ExecutionHistoryPageProps {
  projectId: string
  workflowId: string
  workflowName: string
  onNavigate: (path: string) => void
}

// 执行状态配置
const statusConfig: Record<ExecutionStatus, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  running: { label: '执行中', icon: Play, color: 'text-blue-500 bg-blue-500/10' },
  paused: { label: '已暂停', icon: StopCircle, color: 'text-yellow-500 bg-yellow-500/10' },
  completed: { label: '已完成', icon: CheckCircle2, color: 'text-green-500 bg-green-500/10' },
  failed: { label: '执行失败', icon: XCircle, color: 'text-red-500 bg-red-500/10' },
  cancelled: { label: '已取消', icon: StopCircle, color: 'text-gray-500 bg-gray-500/10' },
  timeout: { label: '已超时', icon: AlertTriangle, color: 'text-orange-500 bg-orange-500/10' },
}

// 格式化时间
function formatTime(date: string): string {
  const d = new Date(date)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// 计算执行时长
function formatDuration(startedAt: string, finishedAt?: string): string {
  const start = new Date(startedAt).getTime()
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now()
  const diff = end - start
  
  if (diff < 1000) return '< 1秒'
  if (diff < 60000) return `${Math.floor(diff / 1000)}秒`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分${Math.floor((diff % 60000) / 1000)}秒`
  return `${Math.floor(diff / 3600000)}时${Math.floor((diff % 3600000) / 60000)}分`
}

// 虚拟执行列表组件
function VirtualExecutionList({
  executions,
  onItemClick,
  onExport,
  onDelete,
}: {
  executions: Execution[]
  onItemClick: (execution: Execution) => void
  onExport: (execution: Execution, format: 'txt' | 'md') => void
  onDelete: (execution: Execution) => void
}) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: executions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 76, // 预估每项高度(包含 padding 和 gap)
    overscan: 5,
    getItemKey: (index) => executions[index].id,
  })

  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div
      ref={parentRef}
      className="h-full overflow-auto"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const execution = executions[virtualItem.index]
          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
                paddingBottom: '8px',
              }}
            >
              <ExecutionListItem
                execution={execution}
                onClick={() => onItemClick(execution)}
                onExport={(format) => onExport(execution, format)}
                onDelete={() => onDelete(execution)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// 单条执行记录组件 (列表项)
function ExecutionListItem({
  execution,
  onClick,
  onExport,
  onDelete,
}: {
  execution: Execution
  onClick: () => void
  onExport: (format: 'txt' | 'md') => void
  onDelete: () => void
}) {
  const status = statusConfig[execution.status]
  const StatusIcon = status.icon
  const summary = execution.final_output 
    ? execution.final_output.slice(0, 60) + (execution.final_output.length > 60 ? '...' : '')
    : execution.status === 'running' ? '正在生成...' : '无输出'

  return (
    <div 
      className="group grid grid-cols-12 gap-4 p-4 items-center hover:bg-accent/50 rounded-lg border transition-all cursor-pointer bg-card"
      onClick={onClick}
    >
      <div className="col-span-3 sm:col-span-2 flex items-center gap-2">
        <div className={cn("p-2 rounded-full", status.color)}>
           <StatusIcon className="h-4 w-4" />
        </div>
        <span className={cn("text-sm font-medium hidden sm:inline-block", status.color.split(' ')[0])}>
           {status.label}
        </span>
      </div>
      
      <div className="col-span-4 sm:col-span-3 flex flex-col justify-center">
         <span className="text-sm font-medium">{formatTime(execution.started_at)}</span>
         <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(execution.started_at, execution.finished_at)}
         </span>
      </div>

      <div className="col-span-3 sm:col-span-5">
         <p className="text-sm text-muted-foreground truncate" title={execution.final_output || ''}>
           {summary}
         </p>
      </div>

      <div className="col-span-2 flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
         <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClick}>
            <Maximize2 className="h-4 w-4" />
         </Button>
         <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                <FileDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onExport('txt'); }}>
                <FileText className="mr-2 h-4 w-4" />
                导出为 TXT
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onExport('md'); }}>
                <FileText className="mr-2 h-4 w-4" />
                导出为 Markdown
              </DropdownMenuItem>
            </DropdownMenuContent>
         </DropdownMenu>
         <Button 
           variant="ghost" 
           size="icon" 
           className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" 
           onClick={(e) => { e.stopPropagation(); onDelete(); }}
         >
            <Trash2 className="h-4 w-4" />
         </Button>
      </div>
    </div>
  )
}

// 节点结果项组件（支持配置详情折叠）
function NodeResultItem({
  result,
  nodeName,
  nodeType,
}: {
  result: NodeResult
  nodeName: string
  nodeType?: string
}) {
  const [showConfig, setShowConfig] = useState(false)
  const hasConfig = result.resolved_config && hasResolvedConfig(result.resolved_config)

  // 开始节点没有实际执行时间，不显示耗时
  const showDuration = nodeType !== 'start'

  return (
    <div className="relative">
      <div className={cn(
        "absolute -left-[29px] top-0 h-4 w-4 rounded-full border-2 border-background ring-1 ring-muted",
        result.status === 'completed' ? "bg-green-500" : 
        result.status === 'failed' ? "bg-red-500" : "bg-muted"
      )} />
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm">{nodeName}</span>
        {showDuration && (
          <span className="text-xs text-muted-foreground">
            {formatDuration(result.started_at, result.finished_at)}
          </span>
        )}
      </div>
      
      <div className="rounded-lg border bg-card overflow-hidden shadow-sm">
        {/* 配置详情折叠区域 */}
        {hasConfig && (
          <div className="border-b">
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/50 transition-colors"
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
                  <ResolvedConfigDisplay config={result.resolved_config!} nodeType="" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        
        {/* 输出内容 */}
        {result.output && (
          <StreamingOutput content={result.output} className="max-h-[300px] text-sm" />
        )}
      </div>
    </div>
  )
}

// 详情对话框
function ExecutionDetailDialog({
  execution,
  nodes,
  open,
  onOpenChange,
}: {
  execution: Execution | null
  nodes: WorkflowNode[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [nodeResults, setNodeResults] = useState<NodeResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open && execution) {
      setIsLoading(true)
      db.getNodeResults(execution.id)
        .then(setNodeResults)
        .catch(error => handleAppError({ error, context: '加载节点结果', silent: true }))
        .finally(() => setIsLoading(false))
    }
  }, [open, execution])

  if (!execution) return null

  const status = statusConfig[execution.status]
  
  const getNodeName = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId)
    return node?.name || '未知节点'
  }

  const getNodeType = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId)
    return node?.type
  }

  const handleCopyFinal = () => {
    if (execution.final_output) {
       navigator.clipboard.writeText(execution.final_output)
       setCopied(true)
       toast.success('已复制最终输出')
       setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30 flex-shrink-0">
          <div className="flex items-center justify-between mr-8">
             <div className="flex items-center gap-3">
                <DialogTitle>执行详情</DialogTitle>
                <Badge variant="outline" className={cn(status.color, "border-0")}>
                   {status.label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                   {formatTime(execution.started_at)}
                </span>
             </div>
             <div className="text-sm text-muted-foreground">
                耗时: {formatDuration(execution.started_at, execution.finished_at)}
             </div>
          </div>
          <DialogDescription className="hidden">
             查看工作流执行的详细记录
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-background">
           {/* 输入 */}
           {execution.input && (
              <div className="space-y-2">
                 <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">初始输入</h3>
                 <div className="rounded-md bg-muted p-4 text-sm whitespace-pre-wrap font-mono border">
                    {execution.input}
                 </div>
              </div>
           )}

           {/* 节点结果 */}
           <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">执行流程</h3>
              {isLoading ? (
                 <div className="relative border-l-2 border-muted ml-3 space-y-6 pl-6 py-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                       <div key={i} className="relative">
                          <div className="absolute -left-[29px] top-0 h-4 w-4 rounded-full border-2 border-background ring-1 ring-muted bg-muted" />
                          <div className="flex items-center justify-between mb-2">
                             <Skeleton className="h-4 w-24" />
                             <Skeleton className="h-3 w-16" />
                          </div>
                          <Skeleton className="h-20 w-full rounded-lg" />
                       </div>
                    ))}
                 </div>
              ) : nodeResults.length === 0 ? (
                 <div className="text-center py-8 text-muted-foreground">无节点记录</div>
              ) : (
                 <div className="relative border-l-2 border-muted ml-3 space-y-6 pl-6 py-2">
                    {nodeResults.map((result) => (
                       <NodeResultItem 
                         key={result.id}
                         result={result}
                         nodeName={getNodeName(result.node_id)}
                         nodeType={getNodeType(result.node_id)}
                       />
                    ))}
                 </div>
              )}
           </div>

           {/* 最终输出 */}
           {execution.final_output && (
              <div className="space-y-2 pt-4 border-t">
                 <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">最终输出</h3>
                    <Button variant="ghost" size="sm" onClick={handleCopyFinal}>
                       {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                       {copied ? '已复制' : '复制'}
                    </Button>
                 </div>
                 <div className="rounded-lg border-2 border-primary/20 bg-card shadow-sm overflow-hidden">
                    <StreamingOutput content={execution.final_output} className="min-h-[100px]" />
                 </div>
              </div>
           )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function ExecutionHistoryPage({
  projectId,
  workflowId,
  workflowName,
  onNavigate,
}: ExecutionHistoryPageProps) {
  const [executions, setExecutions] = useState<Execution[]>([])
  const [nodes, setNodes] = useState<WorkflowNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(null)
  const [executionToDelete, setExecutionToDelete] = useState<Execution | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        const [executionList, nodeList] = await Promise.all([
          db.getExecutions(workflowId),
          db.getNodes(workflowId),
        ])
        setExecutions(executionList)
        setNodes(nodeList)
      } catch (error) {
      handleAppError({
        error,
        context: '加载执行历史',
        toastMessage: `加载执行历史失败：${getErrorMessage(error)}`,
      })
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [workflowId])

  // 导出功能
  const handleExport = async (execution: Execution, format: 'txt' | 'md') => {
    try {
      const nodeResults = await db.getNodeResults(execution.id)
      let content = ''
      const timestamp = formatTime(execution.started_at)
      
      if (format === 'md') {
        content = `# ${workflowName} - 执行记录\n\n`
        content += `**执行时间**: ${timestamp}\n\n`
        content += `**执行状态**: ${statusConfig[execution.status].label}\n\n`
        content += `**执行时长**: ${formatDuration(execution.started_at, execution.finished_at)}\n\n`
        if (execution.input) content += `## 初始输入\n\n\`\`\`\n${execution.input}\n\`\`\`\n\n`
        content += `## 节点执行记录\n\n`
        nodeResults.forEach((result, index) => {
          const nodeName = nodes.find(n => n.id === result.node_id)?.name || '未知节点'
          content += `### ${index + 1}. ${nodeName}\n\n`
          if (result.output) content += `\`\`\`\n${result.output}\n\`\`\`\n\n`
        })
        if (execution.final_output) content += `## 最终输出\n\n\`\`\`\n${execution.final_output}\n\`\`\`\n`
      } else {
        content = `${workflowName} - 执行记录\n`
        content += `${'='.repeat(50)}\n\n`
        content += `执行时间: ${timestamp}\n`
        content += `执行状态: ${statusConfig[execution.status].label}\n`
        content += `执行时长: ${formatDuration(execution.started_at, execution.finished_at)}\n\n`
        if (execution.input) content += `【初始输入】\n${execution.input}\n\n`
        content += `【节点执行记录】\n${'-'.repeat(40)}\n\n`
        nodeResults.forEach((result, index) => {
          const nodeName = nodes.find(n => n.id === result.node_id)?.name || '未知节点'
          content += `${index + 1}. ${nodeName}\n`
          if (result.output) content += `${result.output}\n\n`
        })
        if (execution.final_output) content += `${'-'.repeat(40)}\n【最终输出】\n${execution.final_output}\n`
      }

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${workflowName}_${timestamp.replace(/[:/\s]/g, '-')}.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success(`已导出为 ${format.toUpperCase()} 文件`)
    } catch (error) {
    handleAppError({
      error,
      context: '导出执行记录',
      toastMessage: `导出失败：${getErrorMessage(error)}`,
    })
    }
  }

  // 删除执行记录
  const handleDelete = async () => {
    if (!executionToDelete) return
    
    setIsDeleting(true)
    try {
      await db.deleteExecution(executionToDelete.id)
      setExecutions(executions.filter(e => e.id !== executionToDelete.id))
      toast.success('执行记录已删除')
    } catch (error) {
    handleAppError({
      error,
      context: '删除执行记录',
      toastMessage: `删除失败：${getErrorMessage(error)}`,
    })
    } finally {
      setIsDeleting(false)
      setExecutionToDelete(null)
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <Header
         title={`${workflowName} - 执行历史`}
         breadcrumbs={[
            { label: '首页', href: '/' },
            { label: '项目', href: `/project/${projectId}` },
            { label: workflowName, href: `/project/${projectId}/workflow/${workflowId}` },
            { label: '执行历史' },
         ]}
         onNavigate={onNavigate}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigate(`/project/${projectId}/workflow/${workflowId}`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回工作流
        </Button>
      </Header>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="p-4 border-b bg-muted/10">
           <div className="flex items-center justify-between max-w-5xl mx-auto w-full">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                 <History className="h-5 w-5" />
                 历史记录
              </h2>
              <Badge variant="outline">{executions.length} 条记录</Badge>
           </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="max-w-5xl mx-auto w-full h-full p-4">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-12 gap-4 p-4 items-center rounded-lg border bg-card">
                     <div className="col-span-3 sm:col-span-2 flex items-center gap-2">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-5 w-16 hidden sm:inline-block" />
                     </div>
                     <div className="col-span-4 sm:col-span-3 flex flex-col justify-center gap-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                     </div>
                     <div className="col-span-3 sm:col-span-5">
                        <Skeleton className="h-4 w-full" />
                     </div>
                     <div className="col-span-2 flex justify-end gap-1">
                        <Skeleton className="h-8 w-8" />
                     </div>
                  </div>
                ))}
              </div>
            ) : executions.length === 0 ? (
              <EmptyState
                icon={History}
                title="暂无执行历史"
                description="运行工作流后，执行记录将显示在这里"
              />
            ) : (
              <VirtualExecutionList
                executions={executions}
                onItemClick={setSelectedExecution}
                onExport={handleExport}
                onDelete={setExecutionToDelete}
              />
            )}
          </div>
        </div>
      </div>

      <ExecutionDetailDialog
        execution={selectedExecution}
        nodes={nodes}
        open={!!selectedExecution}
        onOpenChange={(open) => !open && setSelectedExecution(null)}
      />

      {/* 删除确认对话框 */}
      <AlertDialog open={!!executionToDelete} onOpenChange={(open) => !open && setExecutionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这条执行记录吗？此操作无法撤销，相关的节点执行结果也会被一并删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? '删除中...' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

