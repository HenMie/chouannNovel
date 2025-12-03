// 节点配置抽屉组件

import { useEffect, useState, useCallback } from 'react'
import { Save, HelpCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { AIChatConfigForm } from './configs/AIChatConfig'
import { TextExtractConfigForm } from './configs/TextExtractConfig'
import { TextConcatConfigForm } from './configs/TextConcatConfig'
import { ConditionConfigForm } from './configs/ConditionConfig'
import { LoopConfigForm } from './configs/LoopConfig'
import { BatchConfigForm } from './configs/BatchConfig'
import { LoopStartConfigForm } from './configs/LoopStartConfig'
import { ParallelConfigForm } from './configs/ParallelConfig'
import { ConditionIfConfigForm } from './configs/ConditionIfConfig'
import { toast } from 'sonner'
import { useHotkeys, HOTKEY_PRESETS } from '@/lib/hooks'
import * as db from '@/lib/db'
import type { 
  WorkflowNode, 
  NodeConfig, 
  GlobalConfig, 
  AIChatConfig,
  TextExtractConfig,
  TextConcatConfig,
  ConditionConfig,
  LoopConfig,
  BatchConfig,
  LoopStartConfig,
  ParallelStartConfig,
  ConditionIfConfig,
} from '@/types'

interface NodeConfigDrawerProps {
  node: WorkflowNode | null
  nodes?: WorkflowNode[]  // 所有节点，用于跳转目标选择
  projectId?: string      // 项目 ID，用于加载设定库
  open: boolean
  onClose: () => void
  onSave: (node: WorkflowNode) => void
}

// 节点类型标签
const nodeTypeLabels: Record<string, string> = {
  input: '输入节点',
  output: '输出节点',
  ai_chat: 'AI 对话节点',
  text_extract: '内容提取节点',
  text_concat: '文本拼接节点',
  condition: '条件判断节点',
  loop: '循环节点',
  batch: '批量执行节点',
  var_set: '设置变量节点',
  var_get: '读取变量节点',
  // 新的块结构节点
  loop_start: 'for 循环开始',
  loop_end: 'for 循环结束',
  parallel_start: '并发执行开始',
  parallel_end: '并发执行结束',
  condition_if: 'if 条件分支',
  condition_else: 'else 分支',
  condition_end: 'if 分支结束',
}

export function NodeConfigDrawer({
  node,
  nodes = [],
  projectId,
  open,
  onClose,
  onSave,
}: NodeConfigDrawerProps) {
  const [name, setName] = useState('')
  const [config, setConfig] = useState<NodeConfig>({})
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // 加载全局配置
  useEffect(() => {
    const loadGlobalConfig = async () => {
      try {
        const config = await db.getGlobalConfig()
        setGlobalConfig(config)
      } catch (error) {
        console.error('加载全局配置失败:', error)
      }
    }
    loadGlobalConfig()
  }, [])

  // 当节点变化时，更新表单
  useEffect(() => {
    if (node) {
      setName(node.name)
      setConfig(node.config)
    }
  }, [node])

  // 保存节点配置
  const handleSave = useCallback(async () => {
    if (!node) return

    setIsSaving(true)
    try {
      await db.updateNode(node.id, {
        name,
        config,
      })

      onSave({
        ...node,
        name,
        config,
        updated_at: new Date().toISOString(),
      })

      toast.success('节点配置已保存')
      onClose()
    } catch (error) {
      console.error('保存节点配置失败:', error)
      toast.error('保存失败')
    } finally {
      setIsSaving(false)
    }
  }, [node, name, config, onSave, onClose])

  // 快捷键: Ctrl+S 保存, Escape 关闭
  useHotkeys([
    HOTKEY_PRESETS.save(() => {
      if (open && !isSaving) {
        handleSave()
      }
    }, open),
    HOTKEY_PRESETS.escape(() => {
      if (open) {
        onClose()
      }
    }, open),
  ])

  // 渲染节点配置表单
  const renderConfigForm = () => {
    if (!node) return null

    switch (node.type) {
      case 'ai_chat':
        return (
          <AIChatConfigForm
            config={config as Partial<AIChatConfig>}
            globalConfig={globalConfig}
            projectId={projectId}
            onChange={setConfig}
          />
        )

      case 'input':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="placeholder">占位提示文本</Label>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    当需要用户输入时显示的提示文字
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="placeholder"
                placeholder="请输入..."
                value={(config as any).placeholder || ''}
                onChange={(e) =>
                  setConfig({ ...config, placeholder: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="default_value">默认值</Label>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    用于测试或默认情况下的输入内容
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="default_value"
                placeholder="默认输入内容"
                value={(config as any).default_value || ''}
                onChange={(e) =>
                  setConfig({ ...config, default_value: e.target.value })
                }
              />
            </div>
          </div>
        )

      case 'output':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>输出格式</Label>
              <Select
                value={(config as any).format || 'text'}
                onValueChange={(value) =>
                  setConfig({ ...config, format: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择输出格式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">纯文本</SelectItem>
                  <SelectItem value="markdown">Markdown</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )

      case 'var_set':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="variable_name">变量名</Label>
              <Input
                id="variable_name"
                placeholder="输入变量名（例如：user_name）"
                value={(config as any).variable_name || ''}
                onChange={(e) =>
                  setConfig({ ...config, variable_name: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                后续节点可通过此名称访问该变量
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>值来源</Label>
              <Select
                value={(config as any).value_source || 'previous'}
                onValueChange={(value) =>
                  setConfig({ ...config, value_source: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择值来源" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="previous">上一节点输出</SelectItem>
                  <SelectItem value="custom">自定义值</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(config as any).value_source === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="custom_value">自定义值</Label>
                <Input
                  id="custom_value"
                  placeholder="输入自定义值"
                  value={(config as any).custom_value || ''}
                  onChange={(e) =>
                    setConfig({ ...config, custom_value: e.target.value })
                  }
                />
              </div>
            )}
          </div>
        )

      case 'var_get':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="variable_name">变量名</Label>
              <Input
                id="variable_name"
                placeholder="输入要读取的变量名"
                value={(config as any).variable_name || ''}
                onChange={(e) =>
                  setConfig({ ...config, variable_name: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                读取此前已设置的变量值作为当前节点的输出
              </p>
            </div>
          </div>
        )

      case 'text_extract':
        return (
          <TextExtractConfigForm
            config={config as Partial<TextExtractConfig>}
            onChange={setConfig}
          />
        )

      case 'text_concat':
        return (
          <TextConcatConfigForm
            config={config as Partial<TextConcatConfig>}
            onChange={setConfig}
          />
        )

      case 'condition':
        return (
          <ConditionConfigForm
            config={config as Partial<ConditionConfig>}
            globalConfig={globalConfig}
            nodes={nodes}
            currentNodeId={node.id}
            onChange={setConfig}
          />
        )

      case 'loop':
        return (
          <LoopConfigForm
            config={config as Partial<LoopConfig>}
            globalConfig={globalConfig}
            nodes={nodes}
            currentNodeId={node.id}
            onChange={setConfig}
          />
        )

      case 'batch':
        return (
          <BatchConfigForm
            config={config as Partial<BatchConfig>}
            onChange={setConfig}
            nodes={nodes}
            currentNodeId={node.id}
          />
        )

      // 新的块结构节点配置
      case 'loop_start':
        return (
          <LoopStartConfigForm
            config={config as Partial<LoopStartConfig>}
            globalConfig={globalConfig}
            onChange={setConfig}
          />
        )

      case 'loop_end':
        return (
          <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            <p>循环结束节点无需配置。</p>
            <p className="mt-2">执行时会自动跳回对应的循环开始节点。</p>
          </div>
        )

      case 'parallel_start':
        return (
          <ParallelConfigForm
            config={config as Partial<ParallelStartConfig>}
            onChange={setConfig}
          />
        )

      case 'parallel_end':
        return (
          <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            <p>并发结束节点无需配置。</p>
            <p className="mt-2">并发块内的所有任务完成后，结果会在这里汇总输出。</p>
          </div>
        )

      case 'condition_if':
        return (
          <ConditionIfConfigForm
            config={config as Partial<ConditionIfConfig>}
            globalConfig={globalConfig}
            onChange={setConfig}
          />
        )

      case 'condition_else':
        return (
          <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            <p>else 节点无需配置。</p>
            <p className="mt-2">当 if 条件为 false 时，会执行 else 之后到 end if 之间的节点。</p>
          </div>
        )

      case 'condition_end':
        return (
          <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            <p>条件分支结束节点无需配置。</p>
            <p className="mt-2">标记条件分支块的结束位置。</p>
          </div>
        )

      // 其他节点类型的配置表单将在后续阶段实现
      default:
        return (
          <EmptyState
            icon={AlertCircle}
            title="配置表单开发中"
            description="该节点类型的配置表单正在开发中，敬请期待后续更新"
            className="border border-dashed rounded-lg py-8"
          />
        )
    }
  }

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-[480px] sm:max-w-[480px] flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 py-4 border-b bg-muted/10">
          <SheetTitle className="text-lg font-semibold">
            {node ? nodeTypeLabels[node.type] : '节点配置'}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-6">
          <div className="space-y-6 pb-20">
            {/* 节点名称 */}
            <div className="space-y-2">
              <Label htmlFor="node-name">节点名称</Label>
              <Input
                id="node-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="给节点起一个容易识别的名字"
                className="font-medium"
              />
            </div>

            <Separator />

            {/* 节点配置表单 */}
            {renderConfigForm()}
          </div>
        </ScrollArea>

        {/* 底部操作栏 */}
        <div className="border-t bg-background p-4 px-6">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  保存
                </>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
