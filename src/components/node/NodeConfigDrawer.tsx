// 节点配置抽屉组件

import { useEffect, useState, useCallback } from 'react'
import { Save, HelpCircle, AlertCircle, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
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
import { PromptInputField, type PromptInputMode } from '@/components/ui/prompt-input-field'
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
import { handleAppError } from '@/lib/errors'
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
  StartConfig,
  CustomVariable,
  VarUpdateConfig,
} from '@/types'

interface NodeConfigDrawerProps {
  node: WorkflowNode | null
  nodes?: WorkflowNode[]  // 所有节点，用于跳转目标选择
  projectId?: string      // 项目 ID，用于加载设定库
  open: boolean
  onClose: () => void
  onSave: (node: WorkflowNode) => void
  onNavigate?: (path: string) => void  // 导航函数，用于跳转到设置页等
}

// 节点类型标签
const nodeTypeLabels: Record<string, string> = {
  start: '开始流程',
  output: '输出节点',
  ai_chat: 'AI 对话节点',
  text_extract: '内容提取节点',
  text_concat: '文本拼接节点',
  var_update: '更新变量节点',
  condition: '条件判断节点',
  loop: '循环节点',
  batch: '批量执行节点',
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
  onNavigate,
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
        handleAppError({ error, context: '加载全局配置', silent: true })
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
      handleAppError({
        error,
        context: '保存节点配置',
        toastMessage: '保存失败',
      })
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
            nodes={nodes}
            currentNodeId={node.id}
            onChange={setConfig}
            onNavigate={onNavigate}
          />
        )

      case 'start': {
        const startConfig = config as Partial<StartConfig>
        const customVars = startConfig.custom_variables || []
        
        // 添加新变量
        const addCustomVariable = () => {
          const newVar: CustomVariable = { name: '', default_value: '' }
          setConfig({ 
            ...config, 
            custom_variables: [...customVars, newVar] 
          })
        }
        
        // 更新变量
        const updateCustomVariable = (index: number, field: keyof CustomVariable, value: string) => {
          const updated = [...customVars]
          updated[index] = { ...updated[index], [field]: value }
          setConfig({ ...config, custom_variables: updated })
        }
        
        // 删除变量
        const removeCustomVariable = (index: number) => {
          const updated = customVars.filter((_, i) => i !== index)
          setConfig({ ...config, custom_variables: updated })
        }
        
        return (
          <div className="space-y-6">
            {/* 系统变量说明 */}
            <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
              <p>用户输入将自动保存到全局变量 <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">用户问题</code> 中。</p>
            </div>
            
            {/* 默认值 */}
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
                value={startConfig.default_value || ''}
                onChange={(e) =>
                  setConfig({ ...config, default_value: e.target.value })
                }
                autoComplete="off"
              />
            </div>
            
            {/* 自定义全局变量 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label>自定义全局变量</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      在此定义的变量可在整个工作流中使用，通过「更新变量」节点修改值
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCustomVariable}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  添加变量
                </Button>
              </div>
              
              {customVars.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  暂无自定义变量
                </div>
              ) : (
                <div className="space-y-2">
                  {customVars.map((variable, index) => (
                    <div key={index} className="flex items-center gap-2 rounded-lg border p-3">
                      <div className="flex-1 space-y-2">
                        <Input
                          placeholder="变量名"
                          value={variable.name}
                          onChange={(e) => updateCustomVariable(index, 'name', e.target.value)}
                          autoComplete="off"
                        />
                        <Input
                          placeholder="默认值（可选）"
                          value={variable.default_value}
                          onChange={(e) => updateCustomVariable(index, 'default_value', e.target.value)}
                          autoComplete="off"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeCustomVariable(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      }

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

      case 'var_update': {
        const varUpdateConfig = config as Partial<VarUpdateConfig>
        // 获取开始节点中定义的全局变量
        const startNode = nodes?.find(n => n.type === 'start')
        const startConfig = startNode?.config as StartConfig | undefined
        const availableVars = [
          { name: '用户问题', description: '系统变量' },
          ...(startConfig?.custom_variables?.map(v => ({ name: v.name, description: '自定义变量' })) || [])
        ]
        
        // 值输入模式相关
        const valueMode: PromptInputMode = varUpdateConfig.value_mode === 'variable' ? 'variable' : 'manual'
        const valueManual = varUpdateConfig.value_manual ?? varUpdateConfig.value_template ?? ''
        const valueVariable = varUpdateConfig.value_variable ?? 
          (valueMode === 'variable' ? varUpdateConfig.value_template ?? '' : '')
        
        const handleValueModeChange = (mode: PromptInputMode) => {
          if (mode === 'manual') {
            setConfig({ ...config, value_mode: 'manual', value_template: valueManual })
          } else {
            setConfig({ ...config, value_mode: 'variable', value_template: valueVariable })
          }
        }
        
        const handleValueManualChange = (value: string) => {
          setConfig({
            ...config,
            value_mode: 'manual',
            value_template: value,
            value_manual: value,
          })
        }
        
        const handleValueVariableChange = (value: string) => {
          setConfig({
            ...config,
            value_mode: 'variable',
            value_template: value,
            value_variable: value,
          })
        }
        
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="variable_name">选择变量</Label>
              <Select
                value={varUpdateConfig.variable_name || ''}
                onValueChange={(value) =>
                  setConfig({ ...config, variable_name: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择要更新的变量" />
                </SelectTrigger>
                <SelectContent>
                  {availableVars.map((v) => (
                    <SelectItem key={v.name} value={v.name}>
                      {v.name}
                      <span className="ml-2 text-xs text-muted-foreground">({v.description})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                只能更新在开始节点中定义的全局变量
              </p>
            </div>
            
            <PromptInputField
              id="value_template"
              label="新值"
              description="设置变量的新值"
              mode={valueMode}
              manualValue={valueManual}
              variableValue={valueVariable}
              onModeChange={handleValueModeChange}
              onManualChange={handleValueManualChange}
              onVariableChange={handleValueVariableChange}
              nodes={nodes}
              currentNodeId={node.id}
              placeholder="输入新值，输入 / 选择变量..."
              minHeight="80px"
            />
          </div>
        )
      }

      case 'text_extract':
        return (
          <TextExtractConfigForm
            config={config as Partial<TextExtractConfig>}
            onChange={setConfig}
            nodes={nodes}
            currentNodeId={node.id}
          />
        )

      case 'text_concat':
        return (
          <TextConcatConfigForm
            config={config as Partial<TextConcatConfig>}
            onChange={setConfig}
            nodes={nodes}
            currentNodeId={node.id}
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
            onNavigate={onNavigate}
          />
        )

      case 'loop':
        return (
          <LoopConfigForm
            config={config as Partial<LoopConfig>}
            onChange={setConfig}
            nodes={nodes}
            currentNodeId={node.id}
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
            onChange={setConfig}
            nodes={nodes}
            currentNodeId={node.id}
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
            onChange={setConfig}
            nodes={nodes}
            currentNodeId={node.id}
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
          <SheetDescription className="sr-only">
            配置节点参数
          </SheetDescription>
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
                autoComplete="off"
              />
            </div>

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
