import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Play,
  Pause,
  Square,
  Plus,
  GripVertical,
  Trash2,
  Settings,
  MessageSquare,
  FileInput,
  FileOutput,
  GitBranch,
  Repeat,
  Layers,
  Variable,
  Type,
  Scissors,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Header } from '@/components/layout/Header'
import { NodeConfigDrawer } from '@/components/node/NodeConfigDrawer'
import { StreamingOutput, NodeOutputPanel } from '@/components/execution/StreamingOutput'
import { useProjectStore } from '@/stores/project-store'
import { useExecutionStore } from '@/stores/execution-store'
import { getGlobalConfig } from '@/lib/db'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { WorkflowNode, NodeType, GlobalConfig } from '@/types'

interface WorkflowPageProps {
  projectId: string
  workflowId: string
  onNavigate: (path: string) => void
}

// 节点类型配置
const nodeTypeConfig: Record<
  NodeType,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  input: { label: '输入', icon: FileInput, color: 'text-green-500' },
  output: { label: '输出', icon: FileOutput, color: 'text-red-500' },
  ai_chat: { label: 'AI 对话', icon: MessageSquare, color: 'text-violet-500' },
  text_extract: { label: '内容提取', icon: Scissors, color: 'text-orange-500' },
  text_concat: { label: '文本拼接', icon: Type, color: 'text-cyan-500' },
  condition: { label: '条件判断', icon: GitBranch, color: 'text-yellow-500' },
  loop: { label: '循环', icon: Repeat, color: 'text-pink-500' },
  batch: { label: '批量执行', icon: Layers, color: 'text-indigo-500' },
  var_set: { label: '设置变量', icon: Variable, color: 'text-emerald-500' },
  var_get: { label: '读取变量', icon: Variable, color: 'text-teal-500' },
}

// 可排序的节点卡片
function SortableNodeCard({
  node,
  isActive,
  isRunning,
  onDelete,
  onEdit,
}: {
  node: WorkflowNode
  isActive?: boolean
  isRunning?: boolean
  onDelete: () => void
  onEdit: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: node.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const config = nodeTypeConfig[node.type]
  const Icon = config.icon

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn('group relative', isDragging && 'z-50')}
    >
      <Card
        className={cn(
          'cursor-pointer transition-all hover:shadow-md',
          isDragging && 'shadow-lg ring-2 ring-primary',
          isActive && 'ring-2 ring-primary',
          isRunning && 'ring-2 ring-yellow-500'
        )}
        onClick={onEdit}
      >
        <CardHeader className="flex flex-row items-center gap-3 space-y-0 p-4">
          {/* 拖拽手柄 */}
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none opacity-50 hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-5 w-5" />
          </button>

          {/* 状态指示器 */}
          {isRunning && (
            <div className="absolute -left-1 top-1/2 h-3 w-3 -translate-y-1/2">
              <div className="absolute h-full w-full animate-ping rounded-full bg-yellow-500 opacity-75" />
              <div className="relative h-full w-full rounded-full bg-yellow-500" />
            </div>
          )}

          {/* 节点图标 */}
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg bg-muted',
              config.color
            )}
          >
            <Icon className="h-5 w-5" />
          </div>

          {/* 节点信息 */}
          <div className="flex-1">
            <CardTitle className="text-sm font-medium">{node.name}</CardTitle>
            <p className="text-xs text-muted-foreground">{config.label}</p>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
      </Card>
    </motion.div>
  )
}

export function WorkflowPage({ projectId: _projectId, workflowId, onNavigate: _onNavigate }: WorkflowPageProps) {
  const {
    currentWorkflow,
    nodes,
    isLoadingNodes,
    loadNodes,
    setCurrentWorkflow,
    createNode,
    deleteNode,
    reorderNodes,
    updateNode,
  } = useProjectStore()

  // 执行状态
  const {
    status: executionStatus,
    currentNodeIndex,
    nodeOutputs,
    finalOutput,
    streamingContent,
    streamingNodeId,
    error: executionError,
    startExecution,
    pauseExecution,
    resumeExecution,
    cancelExecution,
    reset: resetExecution,
  } = useExecutionStore()

  // 本地状态
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null)
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig | null>(null)
  const [initialInput, setInitialInput] = useState('')
  const [showInputDialog, setShowInputDialog] = useState(false)
  
  // 派生状态
  const isRunning = executionStatus === 'running'
  const isPaused = executionStatus === 'paused'
  const isExecuting = isRunning || isPaused

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    // 加载工作流和节点
    const loadData = async () => {
      const { workflows, loadWorkflows, currentProject } = useProjectStore.getState()
      if (workflows.length === 0 && currentProject) {
        await loadWorkflows(currentProject.id)
      }

      const workflow = useProjectStore.getState().workflows.find((w) => w.id === workflowId)
      if (workflow) {
        setCurrentWorkflow(workflow)
        loadNodes(workflow.id)
      }

      // 加载全局配置
      try {
        const config = await getGlobalConfig()
        setGlobalConfig(config)
      } catch (error) {
        console.error('加载全局配置失败:', error)
      }
    }

    loadData()

    // 组件卸载时重置执行状态
    return () => {
      resetExecution()
    }
  }, [workflowId, setCurrentWorkflow, loadNodes, resetExecution])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = nodes.findIndex((n) => n.id === active.id)
      const newIndex = nodes.findIndex((n) => n.id === over.id)
      const newOrder = arrayMove(nodes, oldIndex, newIndex)
      reorderNodes(newOrder.map((n) => n.id))
    }
  }

  const handleAddNode = async (type: NodeType) => {
    const config = nodeTypeConfig[type]
    await createNode(type, `${config.label} ${nodes.length + 1}`)
  }

  const handleDeleteNode = async (nodeId: string) => {
    if (confirm('确定要删除这个节点吗？')) {
      await deleteNode(nodeId)
    }
  }

  const handleEditNode = (node: WorkflowNode) => {
    setSelectedNode(node)
    setIsConfigOpen(true)
  }

  const handleSaveNode = async (updatedNode: WorkflowNode) => {
    await updateNode(updatedNode.id, {
      name: updatedNode.name,
      config: updatedNode.config,
    })
    // 更新本地状态中的选中节点
    setSelectedNode(updatedNode)
  }

  // 检查是否有输入节点
  const hasInputNode = nodes.some(n => n.type === 'input')

  const handleRun = async () => {
    // 检查全局配置
    if (!globalConfig) {
      toast.error('加载配置失败，请刷新页面重试')
      return
    }

    // 检查是否有 AI 节点
    const hasAINode = nodes.some(n => n.type === 'ai_chat')
    if (hasAINode) {
      // 检查是否配置了 AI 服务
      const hasEnabledProvider = Object.values(globalConfig.ai_providers).some(
        p => p.enabled && p.api_key
      )
      if (!hasEnabledProvider) {
        toast.error('请先在设置页面配置 AI 服务')
        return
      }
    }

    // 如果有输入节点且没有输入，显示输入对话框
    if (hasInputNode && !initialInput) {
      setShowInputDialog(true)
      return
    }

    // 开始执行
    try {
      await startExecution(currentWorkflow!, nodes, globalConfig, initialInput)
    } catch (error) {
      const message = error instanceof Error ? error.message : '执行失败'
      toast.error(message)
    }
  }

  const handleStartWithInput = async () => {
    if (!globalConfig || !currentWorkflow) return
    
    setShowInputDialog(false)
    
    try {
      await startExecution(currentWorkflow, nodes, globalConfig, initialInput)
    } catch (error) {
      const message = error instanceof Error ? error.message : '执行失败'
      toast.error(message)
    }
  }

  const handlePause = () => {
    pauseExecution()
  }

  const handleResume = () => {
    resumeExecution()
  }

  const handleStop = () => {
    cancelExecution()
    setInitialInput('')
  }

  if (!currentWorkflow) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <Header title={currentWorkflow.name}>
        {/* 执行控制按钮 */}
        <div className="flex items-center gap-2">
          {!isExecuting ? (
            <Button size="sm" onClick={handleRun} disabled={nodes.length === 0}>
              <Play className="mr-2 h-4 w-4" />
              运行
            </Button>
          ) : (
            <>
              {isPaused ? (
                <Button size="sm" variant="outline" onClick={handleResume}>
                  <Play className="mr-2 h-4 w-4" />
                  继续
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={handlePause}>
                  <Pause className="mr-2 h-4 w-4" />
                  暂停
                </Button>
              )}
              <Button size="sm" variant="destructive" onClick={handleStop}>
                <Square className="mr-2 h-4 w-4" />
                停止
              </Button>
            </>
          )}
        </div>
      </Header>

      <div className="flex flex-1 overflow-hidden">
        {/* 节点列表区域 */}
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="text-sm font-medium">节点列表</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  添加节点
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => handleAddNode('input')}>
                  <FileInput className="mr-2 h-4 w-4 text-green-500" />
                  输入节点
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAddNode('output')}>
                  <FileOutput className="mr-2 h-4 w-4 text-red-500" />
                  输出节点
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleAddNode('ai_chat')}>
                  <MessageSquare className="mr-2 h-4 w-4 text-violet-500" />
                  AI 对话
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleAddNode('text_extract')}>
                  <Scissors className="mr-2 h-4 w-4 text-orange-500" />
                  内容提取
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAddNode('text_concat')}>
                  <Type className="mr-2 h-4 w-4 text-cyan-500" />
                  文本拼接
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleAddNode('condition')}>
                  <GitBranch className="mr-2 h-4 w-4 text-yellow-500" />
                  条件判断
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAddNode('loop')}>
                  <Repeat className="mr-2 h-4 w-4 text-pink-500" />
                  循环
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAddNode('batch')}>
                  <Layers className="mr-2 h-4 w-4 text-indigo-500" />
                  批量执行
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleAddNode('var_set')}>
                  <Variable className="mr-2 h-4 w-4 text-emerald-500" />
                  设置变量
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAddNode('var_get')}>
                  <Variable className="mr-2 h-4 w-4 text-teal-500" />
                  读取变量
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <ScrollArea className="flex-1 p-4">
            {isLoadingNodes ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : nodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Plus className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <p className="mb-2 text-muted-foreground">暂无节点</p>
                <p className="text-sm text-muted-foreground/70">
                  点击上方按钮添加节点开始创作
                </p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={nodes} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {nodes.map((node, index) => {
                      const nodeOutput = nodeOutputs.find(o => o.nodeId === node.id)
                      return (
                        <SortableNodeCard
                          key={node.id}
                          node={node}
                          isActive={selectedNode?.id === node.id}
                          isRunning={nodeOutput?.isRunning || (isExecuting && currentNodeIndex === index)}
                          onDelete={() => handleDeleteNode(node.id)}
                          onEdit={() => handleEditNode(node)}
                        />
                      )
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </ScrollArea>
        </div>

        {/* 输出面板 */}
        <Separator orientation="vertical" />
        <div className="flex w-96 flex-col border-l">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="text-sm font-medium">执行输出</span>
            {/* 执行状态指示器 */}
            {executionStatus === 'running' && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                执行中...
              </span>
            )}
            {executionStatus === 'paused' && (
              <span className="flex items-center gap-1 text-xs text-yellow-500">
                <Pause className="h-3 w-3" />
                已暂停
              </span>
            )}
            {executionStatus === 'completed' && (
              <span className="flex items-center gap-1 text-xs text-green-500">
                <CheckCircle2 className="h-3 w-3" />
                完成
              </span>
            )}
            {executionStatus === 'failed' && (
              <span className="flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="h-3 w-3" />
                失败
              </span>
            )}
            {executionStatus === 'timeout' && (
              <span className="flex items-center gap-1 text-xs text-orange-500">
                <Clock className="h-3 w-3" />
                超时
              </span>
            )}
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-4 p-4">
              {/* 节点输出列表 */}
              {nodeOutputs.map((output) => (
                <NodeOutputPanel
                  key={output.nodeId}
                  nodeId={output.nodeId}
                  nodeName={output.nodeName}
                  nodeType={nodeTypeConfig[output.nodeType as NodeType]?.label || output.nodeType}
                  output={output.output}
                  isRunning={output.isRunning}
                  isStreaming={output.isStreaming}
                />
              ))}
              
              {/* 最终输出 */}
              {executionStatus === 'completed' && finalOutput && (
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

              {/* 错误信息 */}
              {executionError && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-red-500 bg-red-50 p-4 dark:bg-red-950/20"
                >
                  <div className="flex items-center gap-2 text-red-500">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">执行错误</span>
                  </div>
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                    {executionError}
                  </p>
                </motion.div>
              )}

              {/* 空状态 */}
              {nodeOutputs.length === 0 && !executionError && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Play className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    运行工作流后，输出将显示在这里
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* 输入对话框 */}
      {showInputDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg"
          >
            <h3 className="mb-4 text-lg font-semibold">输入内容</h3>
            <Textarea
              value={initialInput}
              onChange={(e) => setInitialInput(e.target.value)}
              placeholder="请输入要处理的内容..."
              rows={6}
              className="mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowInputDialog(false)}
              >
                取消
              </Button>
              <Button onClick={handleStartWithInput}>
                <Play className="mr-2 h-4 w-4" />
                开始执行
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 节点配置抽屉 */}
      <NodeConfigDrawer
        node={selectedNode}
        open={isConfigOpen}
        onClose={() => {
          setIsConfigOpen(false)
          setSelectedNode(null)
        }}
        onSave={handleSaveNode}
      />
    </div>
  )
}
