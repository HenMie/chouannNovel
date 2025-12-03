import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  History,
  Copy,
  Clipboard,
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
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
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
import { useSettingsStore } from '@/stores/settings-store'
import { getGlobalConfig } from '@/lib/db'
import { cn } from '@/lib/utils'
import { useHotkeys, HOTKEY_PRESETS } from '@/lib/hooks'
import { toast } from 'sonner'
import type { WorkflowNode, NodeType, GlobalConfig } from '@/types'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface WorkflowPageProps {
  projectId: string
  workflowId: string
  onNavigate: (path: string) => void
}

// 节点类型配置
const nodeTypeConfig: Record<
  NodeType,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bgColor: string }
> = {
  input: { label: '输入', icon: FileInput, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/20' },
  output: { label: '输出', icon: FileOutput, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/20' },
  ai_chat: { label: 'AI 对话', icon: MessageSquare, color: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-100 dark:bg-violet-900/20' },
  text_extract: { label: '内容提取', icon: Scissors, color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/20' },
  text_concat: { label: '文本拼接', icon: Type, color: 'text-cyan-600 dark:text-cyan-400', bgColor: 'bg-cyan-100 dark:bg-cyan-900/20' },
  condition: { label: '条件判断', icon: GitBranch, color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-100 dark:bg-yellow-900/20' },
  loop: { label: '循环', icon: Repeat, color: 'text-pink-600 dark:text-pink-400', bgColor: 'bg-pink-100 dark:bg-pink-900/20' },
  batch: { label: '批量执行', icon: Layers, color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-100 dark:bg-indigo-900/20' },
  var_set: { label: '设置变量', icon: Variable, color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-100 dark:bg-emerald-900/20' },
  var_get: { label: '读取变量', icon: Variable, color: 'text-teal-600 dark:text-teal-400', bgColor: 'bg-teal-100 dark:bg-teal-900/20' },
}

// 可排序的节点卡片
function SortableNodeCard({
  node,
  isActive,
  isRunning,
  onDelete,
  onEdit,
  onCopy,
}: {
  node: WorkflowNode
  isActive?: boolean
  isRunning?: boolean
  onDelete: () => void
  onEdit: () => void
  onCopy: () => void
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
          'cursor-pointer transition-all duration-200',
          isDragging ? 'shadow-xl ring-2 ring-primary scale-105' : 'hover:shadow-md hover:border-primary/50',
          isActive && 'ring-2 ring-primary border-primary',
          isRunning && 'ring-2 ring-yellow-500 border-yellow-500 shadow-yellow-200 dark:shadow-yellow-900/20'
        )}
        onClick={onEdit}
      >
        <CardHeader className="flex flex-row items-center gap-3 space-y-0 p-3">
          {/* 拖拽手柄 */}
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none rounded p-1 text-muted-foreground/50 opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </button>

          {/* 状态指示器 */}
          {isRunning && (
            <div className="absolute -left-1 top-1/2 h-3 w-3 -translate-y-1/2">
              <div className="absolute h-full w-full animate-ping rounded-full bg-yellow-500 opacity-75" />
              <div className="relative h-full w-full rounded-full bg-yellow-500 shadow-sm" />
            </div>
          )}

          {/* 节点图标 */}
          <div
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-inset ring-black/5',
              config.bgColor,
              config.color
            )}
          >
            <Icon className="h-5 w-5" />
          </div>

          {/* 节点信息 */}
          <div className="flex-1 min-w-0">
            <CardTitle className="truncate text-sm font-medium leading-none mb-1">{node.name}</CardTitle>
            <p className="truncate text-xs text-muted-foreground">{config.label}</p>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCopy()
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>复制节点</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit()
                  }}
                >
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>配置节点</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>删除节点</TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
      </Card>
    </motion.div>
  )
}

export function WorkflowPage({ projectId, workflowId, onNavigate }: WorkflowPageProps) {
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
    copyNode,
    pasteNode,
    hasCopiedNode,
  } = useProjectStore()

  // 执行状态
  const {
    status: executionStatus,
    currentNodeIndex,
    nodeOutputs,
    finalOutput,
    error: executionError,
    startExecution,
    pauseExecution,
    resumeExecution,
    cancelExecution,
    modifyNodeOutput,
    reset: resetExecution,
  } = useExecutionStore()

  // 设定库
  const { settings, settingPrompts, loadSettings } = useSettingsStore()

  // 本地状态
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null)
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig | null>(null)
  const [initialInput, setInitialInput] = useState('')
  const [showInputDialog, setShowInputDialog] = useState(false)
  const [nodeToDelete, setNodeToDelete] = useState<string | null>(null)
  
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

      // 加载项目设定
      if (projectId) {
        await loadSettings(projectId)
      }
    }

    loadData()

    // 组件卸载时重置执行状态
    return () => {
      resetExecution()
    }
  }, [workflowId, projectId, setCurrentWorkflow, loadNodes, resetExecution, loadSettings])

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

  const handleDeleteClick = (nodeId: string) => {
    setNodeToDelete(nodeId)
  }

  const confirmDeleteNode = async () => {
    if (nodeToDelete) {
      await deleteNode(nodeToDelete)
      setNodeToDelete(null)
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
      await startExecution(currentWorkflow!, nodes, globalConfig, initialInput, settings, settingPrompts)
    } catch (error) {
      const message = error instanceof Error ? error.message : '执行失败'
      toast.error(message)
    }
  }

  const handleStartWithInput = async () => {
    if (!globalConfig || !currentWorkflow) return
    
    setShowInputDialog(false)
    
    try {
      await startExecution(currentWorkflow, nodes, globalConfig, initialInput, settings, settingPrompts)
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

  // 复制节点
  const handleCopyNode = (node: WorkflowNode) => {
    copyNode(node)
    toast.success('节点已复制')
  }

  // 粘贴节点
  const handlePasteNode = async () => {
    if (!hasCopiedNode()) {
      toast.error('剪贴板为空')
      return
    }
    const newNode = await pasteNode()
    if (newNode) {
      toast.success('节点已粘贴')
    }
  }

  // 快捷键配置
  useHotkeys([
    // Ctrl+Enter: 运行工作流
    HOTKEY_PRESETS.run(() => {
      if (!isExecuting && nodes.length > 0) {
        handleRun()
      }
    }, !isExecuting && nodes.length > 0),
    
    // Space: 暂停/继续执行
    HOTKEY_PRESETS.togglePause(() => {
      if (isRunning) {
        pauseExecution()
        toast.info('已暂停执行')
      } else if (isPaused) {
        resumeExecution()
        toast.info('继续执行')
      }
    }, isExecuting && !showInputDialog),
    
    // Escape: 停止执行或关闭对话框
    HOTKEY_PRESETS.escape(() => {
      if (showInputDialog) {
        setShowInputDialog(false)
      } else if (isConfigOpen) {
        setIsConfigOpen(false)
        setSelectedNode(null)
      } else if (isExecuting) {
        cancelExecution()
        setInitialInput('')
        toast.info('已停止执行')
      }
    }),

    // Ctrl+V: 粘贴节点
    HOTKEY_PRESETS.paste(() => {
      if (!isExecuting && hasCopiedNode()) {
        handlePasteNode()
      }
    }, !isExecuting),
  ])

  if (!currentWorkflow) {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="flex h-14 items-center border-b px-4 gap-4">
          <Skeleton className="h-4 w-4 rounded-full" />
          <div className="flex flex-1 items-center gap-2">
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="flex items-center gap-2">
             <Skeleton className="h-9 w-24" />
             <Skeleton className="h-9 w-20" />
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 flex-col min-w-0">
             <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2 h-[53px]">
               <Skeleton className="h-5 w-20" />
               <div className="flex gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-24" />
               </div>
             </div>
             <div className="flex-1 bg-muted/10 p-4">
                <div className="space-y-3 max-w-3xl mx-auto">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i} className="h-[72px] flex items-center p-3">
                      <div className="flex items-center gap-3 w-full">
                        <Skeleton className="h-9 w-9 rounded-lg" />
                        <div className="flex-1 space-y-2">
                           <Skeleton className="h-4 w-1/3" />
                           <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
             </div>
          </div>
          <div className="w-[1px] bg-border" />
          <div className="flex w-96 flex-col border-l bg-background">
             <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2 h-[53px]">
               <Skeleton className="h-5 w-20" />
             </div>
             <div className="flex-1 p-4 space-y-4">
                <Skeleton className="h-32 w-full rounded-lg" />
                <Skeleton className="h-32 w-full rounded-lg" />
             </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <Header
        title={currentWorkflow.name}
        breadcrumbs={[
          { label: '首页', href: '/' },
          { label: '项目', href: `/project/${projectId}` },
          { label: currentWorkflow.name },
        ]}
        onNavigate={onNavigate}
      >
        {/* 执行控制按钮 */}
        <div className="flex items-center gap-2">
          {/* 执行历史按钮 */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onNavigate(`/project/${projectId}/workflow/${workflowId}/history`)}
          >
            <History className="mr-2 h-4 w-4" />
            执行历史
          </Button>
          
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
        <div className="flex flex-1 flex-col min-w-0">
          <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
            <span className="text-sm font-medium">节点列表</span>
            <div className="flex items-center gap-2">
              {/* 粘贴按钮 */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handlePasteNode}
                    disabled={!hasCopiedNode()}
                  >
                    <Clipboard className="mr-2 h-4 w-4" />
                    粘贴
                  </Button>
                </TooltipTrigger>
                <TooltipContent>粘贴节点 (Ctrl+V)</TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    添加节点
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => handleAddNode('input')}>
                    <FileInput className="mr-2 h-4 w-4 text-green-500" />
                    <span>输入节点</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddNode('output')}>
                    <FileOutput className="mr-2 h-4 w-4 text-red-500" />
                    <span>输出节点</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleAddNode('ai_chat')}>
                    <MessageSquare className="mr-2 h-4 w-4 text-violet-500" />
                    <span>AI 对话</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleAddNode('text_extract')}>
                    <Scissors className="mr-2 h-4 w-4 text-orange-500" />
                    <span>内容提取</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddNode('text_concat')}>
                    <Type className="mr-2 h-4 w-4 text-cyan-500" />
                    <span>文本拼接</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleAddNode('condition')}>
                    <GitBranch className="mr-2 h-4 w-4 text-yellow-500" />
                    <span>条件判断</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddNode('loop')}>
                    <Repeat className="mr-2 h-4 w-4 text-pink-500" />
                    <span>循环</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddNode('batch')}>
                    <Layers className="mr-2 h-4 w-4 text-indigo-500" />
                    <span>批量执行</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleAddNode('var_set')}>
                    <Variable className="mr-2 h-4 w-4 text-emerald-500" />
                    <span>设置变量</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddNode('var_get')}>
                    <Variable className="mr-2 h-4 w-4 text-teal-500" />
                    <span>读取变量</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <ScrollArea className="flex-1 bg-muted/10">
            <div className="p-4">
              {isLoadingNodes ? (
                <div className="space-y-3 max-w-3xl mx-auto">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i} className="h-[72px] flex items-center p-3">
                      <div className="flex items-center gap-3 w-full">
                        <Skeleton className="h-9 w-9 rounded-lg" />
                        <div className="flex-1 space-y-2">
                           <Skeleton className="h-4 w-1/3" />
                           <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : nodes.length === 0 ? (
                <EmptyState
                  icon={Plus}
                  title="暂无节点"
                  description="点击右上角'添加节点'按钮开始构建您的工作流"
                />
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={nodes} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3 max-w-3xl mx-auto">
                      <AnimatePresence mode="popLayout">
                        {nodes.map((node, index) => {
                          const nodeOutput = nodeOutputs.find(o => o.nodeId === node.id)
                          return (
                            <SortableNodeCard
                              key={node.id}
                              node={node}
                              isActive={selectedNode?.id === node.id}
                              isRunning={nodeOutput?.isRunning || (isExecuting && currentNodeIndex === index)}
                              onDelete={() => handleDeleteClick(node.id)}
                              onEdit={() => handleEditNode(node)}
                              onCopy={() => handleCopyNode(node)}
                            />
                          )
                        })}
                      </AnimatePresence>
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* 输出面板 */}
        <Separator orientation="vertical" />
        <div className="flex w-96 flex-col border-l bg-background">
          <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
            <span className="text-sm font-medium">执行输出</span>
            {/* 执行状态指示器 */}
            {executionStatus === 'running' && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                执行中...
              </span>
            )}
            {executionStatus === 'paused' && (
              <span className="flex items-center gap-1 text-xs font-medium text-yellow-500">
                <Pause className="h-3 w-3" />
                已暂停
              </span>
            )}
            {executionStatus === 'completed' && (
              <span className="flex items-center gap-1 text-xs font-medium text-green-500">
                <CheckCircle2 className="h-3 w-3" />
                完成
              </span>
            )}
            {executionStatus === 'failed' && (
              <span className="flex items-center gap-1 text-xs font-medium text-red-500">
                <AlertCircle className="h-3 w-3" />
                失败
              </span>
            )}
            {executionStatus === 'timeout' && (
              <span className="flex items-center gap-1 text-xs font-medium text-orange-500">
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
                  canEdit={isPaused}
                  onEdit={modifyNodeOutput}
                />
              ))}
              
              {/* 最终输出 */}
              {executionStatus === 'completed' && finalOutput && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border-2 border-primary bg-card overflow-hidden shadow-sm"
                >
                  <div className="flex items-center gap-2 border-b bg-primary/5 px-4 py-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-sm font-medium">最终输出</span>
                  </div>
                  <StreamingOutput content={finalOutput} className="max-h-[400px] p-4" />
                </motion.div>
              )}

              {/* 错误信息 */}
              {executionError && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/20"
                >
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium text-sm">执行错误</span>
                  </div>
                  <p className="mt-2 text-sm text-red-600/90 dark:text-red-400/90 break-words">
                    {executionError}
                  </p>
                </motion.div>
              )}

              {/* 空状态 */}
              {nodeOutputs.length === 0 && !executionError && (
                <EmptyState
                  icon={Play}
                  title="暂无输出"
                  description="运行工作流后，输出将显示在这里"
                />
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* 输入对话框 */}
      <Dialog open={showInputDialog} onOpenChange={setShowInputDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>输入内容</DialogTitle>
            <DialogDescription>
              请输入工作流的初始输入内容
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Textarea
              value={initialInput}
              onChange={(e) => setInitialInput(e.target.value)}
              placeholder="请输入要处理的内容..."
              rows={6}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInputDialog(false)}>
              取消
            </Button>
            <Button onClick={handleStartWithInput}>
              <Play className="mr-2 h-4 w-4" />
              开始执行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={!!nodeToDelete} onOpenChange={(open) => !open && setNodeToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定要删除这个节点吗？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销，该节点及其配置将被永久删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteNode} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 节点配置抽屉 */}
      <NodeConfigDrawer
        node={selectedNode}
        nodes={nodes}
        projectId={projectId}
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
