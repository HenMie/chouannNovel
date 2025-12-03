import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  Eye,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Header } from '@/components/layout/Header'
import { StreamingOutput } from '@/components/execution/StreamingOutput'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import * as db from '@/lib/db'
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

// 单条执行记录组件
function ExecutionItem({
  execution,
  nodes,
  isExpanded,
  onToggle,
  onExport,
}: {
  execution: Execution
  nodes: WorkflowNode[]
  isExpanded: boolean
  onToggle: () => void
  onExport: (format: 'txt' | 'md') => void
}) {
  const [nodeResults, setNodeResults] = useState<NodeResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  
  const status = statusConfig[execution.status]
  const StatusIcon = status.icon

  // 展开时加载节点结果
  useEffect(() => {
    if (isExpanded && nodeResults.length === 0) {
      setIsLoading(true)
      db.getNodeResults(execution.id)
        .then(setNodeResults)
        .catch(console.error)
        .finally(() => setIsLoading(false))
    }
  }, [isExpanded, execution.id, nodeResults.length])

  // 获取节点名称
  const getNodeName = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId)
    return node?.name || '未知节点'
  }

  return (
    <Card className={cn('transition-all', isExpanded && 'ring-2 ring-primary')}>
      <CardHeader 
        className="flex flex-row items-center gap-4 space-y-0 p-4 cursor-pointer"
        onClick={onToggle}
      >
        {/* 展开/折叠图标 */}
        <button className="text-muted-foreground hover:text-foreground">
          {isExpanded ? (
            <ChevronDown className="h-5 w-5" />
          ) : (
            <ChevronRight className="h-5 w-5" />
          )}
        </button>

        {/* 状态徽章 */}
        <Badge variant="secondary" className={cn('gap-1', status.color)}>
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </Badge>

        {/* 时间信息 */}
        <div className="flex flex-1 items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatTime(execution.started_at)}
          </span>
          <span>耗时: {formatDuration(execution.started_at, execution.finished_at)}</span>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <FileDown className="mr-2 h-4 w-4" />
                导出
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onExport('txt')}>
                <FileText className="mr-2 h-4 w-4" />
                导出为 TXT
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport('md')}>
                <FileText className="mr-2 h-4 w-4" />
                导出为 Markdown
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      {/* 展开内容 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="border-t pt-4">
              {/* 输入内容 */}
              {execution.input && (
                <div className="mb-4">
                  <h4 className="mb-2 text-sm font-medium text-muted-foreground">初始输入</h4>
                  <div className="rounded-lg bg-muted p-3 text-sm">
                    <pre className="whitespace-pre-wrap">{execution.input}</pre>
                  </div>
                </div>
              )}

              {/* 节点执行结果 */}
              <div className="mb-4">
                <h4 className="mb-2 text-sm font-medium text-muted-foreground">节点执行记录</h4>
                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                ) : nodeResults.length > 0 ? (
                  <div className="space-y-2">
                    {nodeResults.map((result, index) => (
                      <div key={result.id} className="rounded-lg border p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-medium">
                            {index + 1}. {getNodeName(result.node_id)}
                          </span>
                          <Badge 
                            variant="secondary" 
                            className={cn(
                              result.status === 'completed' && 'text-green-500 bg-green-500/10',
                              result.status === 'failed' && 'text-red-500 bg-red-500/10',
                              result.status === 'running' && 'text-blue-500 bg-blue-500/10',
                            )}
                          >
                            {result.status === 'completed' ? '成功' : 
                             result.status === 'failed' ? '失败' : 
                             result.status === 'running' ? '执行中' : '待执行'}
                          </Badge>
                        </div>
                        {result.output && (
                          <StreamingOutput 
                            content={result.output} 
                            className="max-h-[200px] border-0 bg-muted/50" 
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    暂无节点执行记录
                  </p>
                )}
              </div>

              {/* 最终输出 */}
              {execution.final_output && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-muted-foreground">最终输出</h4>
                  <div className="rounded-lg border-2 border-primary bg-primary/5">
                    <StreamingOutput content={execution.final_output} className="max-h-[300px] border-0" />
                  </div>
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
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
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
        
        // 默认展开最新的一条
        if (executionList.length > 0) {
          setExpandedId(executionList[0].id)
        }
      } catch (error) {
        console.error('加载执行历史失败:', error)
        toast.error('加载执行历史失败')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [workflowId])

  // 导出功能
  const handleExport = async (execution: Execution, format: 'txt' | 'md') => {
    try {
      // 获取节点结果
      const nodeResults = await db.getNodeResults(execution.id)
      
      let content = ''
      const timestamp = formatTime(execution.started_at)
      
      if (format === 'md') {
        // Markdown 格式
        content = `# ${workflowName} - 执行记录\n\n`
        content += `**执行时间**: ${timestamp}\n\n`
        content += `**执行状态**: ${statusConfig[execution.status].label}\n\n`
        content += `**执行时长**: ${formatDuration(execution.started_at, execution.finished_at)}\n\n`
        
        if (execution.input) {
          content += `## 初始输入\n\n\`\`\`\n${execution.input}\n\`\`\`\n\n`
        }
        
        content += `## 节点执行记录\n\n`
        nodeResults.forEach((result, index) => {
          const nodeName = nodes.find(n => n.id === result.node_id)?.name || '未知节点'
          content += `### ${index + 1}. ${nodeName}\n\n`
          if (result.output) {
            content += `\`\`\`\n${result.output}\n\`\`\`\n\n`
          }
        })
        
        if (execution.final_output) {
          content += `## 最终输出\n\n\`\`\`\n${execution.final_output}\n\`\`\`\n`
        }
      } else {
        // TXT 格式
        content = `${workflowName} - 执行记录\n`
        content += `${'='.repeat(50)}\n\n`
        content += `执行时间: ${timestamp}\n`
        content += `执行状态: ${statusConfig[execution.status].label}\n`
        content += `执行时长: ${formatDuration(execution.started_at, execution.finished_at)}\n\n`
        
        if (execution.input) {
          content += `【初始输入】\n${execution.input}\n\n`
        }
        
        content += `【节点执行记录】\n${'-'.repeat(40)}\n\n`
        nodeResults.forEach((result, index) => {
          const nodeName = nodes.find(n => n.id === result.node_id)?.name || '未知节点'
          content += `${index + 1}. ${nodeName}\n`
          if (result.output) {
            content += `${result.output}\n\n`
          }
        })
        
        if (execution.final_output) {
          content += `${'-'.repeat(40)}\n【最终输出】\n${execution.final_output}\n`
        }
      }

      // 创建并下载文件
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
      console.error('导出失败:', error)
      toast.error('导出失败')
    }
  }

  return (
    <div className="flex h-full flex-col">
      <Header title={`${workflowName} - 执行历史`}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigate(`/project/${projectId}/workflow/${workflowId}`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回工作流
        </Button>
      </Header>

      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : executions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <History className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="mb-2 text-muted-foreground">暂无执行历史</p>
            <p className="text-sm text-muted-foreground/70">
              运行工作流后，执行记录将显示在这里
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {executions.map((execution) => (
              <ExecutionItem
                key={execution.id}
                execution={execution}
                nodes={nodes}
                isExpanded={expandedId === execution.id}
                onToggle={() => setExpandedId(expandedId === execution.id ? null : execution.id)}
                onExport={(format) => handleExport(execution, format)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

