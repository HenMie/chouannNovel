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
import { Header } from '@/components/layout/Header'
import { NodeConfigDrawer } from '@/components/node/NodeConfigDrawer'
import { StreamingOutput } from '@/components/execution/StreamingOutput'
import { useProjectStore } from '@/stores/project-store'
import { cn } from '@/lib/utils'
import type { WorkflowNode, NodeType } from '@/types'

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

  // 状态
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null)
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [currentNodeIndex, setCurrentNodeIndex] = useState<number | null>(null)
  const [outputContent, setOutputContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

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
    }

    loadData()
  }, [workflowId, setCurrentWorkflow, loadNodes])

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

  const handleRun = () => {
    setIsRunning(true)
    setIsPaused(false)
    setOutputContent('')
    setCurrentNodeIndex(0)
    // TODO: 实现完整的执行引擎
    // 这里只是演示流式输出效果
    simulateExecution()
  }

  const handlePause = () => {
    setIsPaused(true)
  }

  const handleResume = () => {
    setIsPaused(false)
  }

  const handleStop = () => {
    setIsRunning(false)
    setIsPaused(false)
    setCurrentNodeIndex(null)
    setIsStreaming(false)
  }

  // 模拟执行过程（演示用，实际执行引擎在 Phase 4 实现）
  const simulateExecution = async () => {
    setIsStreaming(true)
    const demoText = '这是一个演示输出。\n\n工作流执行引擎将在后续阶段实现，届时将支持：\n\n- AI 对话节点的流式输出\n- 变量插值和引用\n- 条件判断和循环控制\n- 执行暂停和继续\n\n敬请期待！'

    for (let i = 0; i <= demoText.length; i++) {
      if (!isRunning) break
      await new Promise((resolve) => setTimeout(resolve, 30))
      setOutputContent(demoText.slice(0, i))
    }

    setIsStreaming(false)
    setIsRunning(false)
    setCurrentNodeIndex(null)
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
          {!isRunning ? (
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
                    {nodes.map((node, index) => (
                      <SortableNodeCard
                        key={node.id}
                        node={node}
                        isActive={selectedNode?.id === node.id}
                        isRunning={isRunning && currentNodeIndex === index}
                        onDelete={() => handleDeleteNode(node.id)}
                        onEdit={() => handleEditNode(node)}
                      />
                    ))}
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
            <span className="text-sm font-medium">输出</span>
            {isStreaming && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                生成中...
              </span>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <StreamingOutput
              content={outputContent}
              isStreaming={isStreaming}
              className="h-full"
            />
          </div>
        </div>
      </div>

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
