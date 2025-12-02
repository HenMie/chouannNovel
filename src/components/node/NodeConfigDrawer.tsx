// 节点配置抽屉组件

import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AIChatConfigForm } from './configs/AIChatConfig'
import { TextExtractConfigForm } from './configs/TextExtractConfig'
import { TextConcatConfigForm } from './configs/TextConcatConfig'
import { ConditionConfigForm } from './configs/ConditionConfig'
import { LoopConfigForm } from './configs/LoopConfig'
import { toast } from 'sonner'
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
  const handleSave = async () => {
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
  }

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
              <Label htmlFor="placeholder">占位提示文本</Label>
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
              <Label htmlFor="default_value">默认值</Label>
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
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2"
                value={(config as any).format || 'text'}
                onChange={(e) =>
                  setConfig({ ...config, format: e.target.value })
                }
              >
                <option value="text">纯文本</option>
                <option value="markdown">Markdown</option>
              </select>
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
                placeholder="输入变量名"
                value={(config as any).variable_name || ''}
                onChange={(e) =>
                  setConfig({ ...config, variable_name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>值来源</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2"
                value={(config as any).value_source || 'previous'}
                onChange={(e) =>
                  setConfig({ ...config, value_source: e.target.value })
                }
              >
                <option value="previous">上一节点输出</option>
                <option value="custom">自定义值</option>
              </select>
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

      // 其他节点类型的配置表单将在后续阶段实现
      default:
        return (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">
              该节点类型的配置表单将在后续版本中实现
            </p>
          </div>
        )
    }
  }

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-[480px] sm:max-w-[480px]">
        <SheetHeader className="pb-4">
          <SheetTitle>{node ? nodeTypeLabels[node.type] : '节点配置'}</SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)] pr-4">
          <div className="space-y-6">
            {/* 节点名称 */}
            <div className="space-y-2">
              <Label htmlFor="node-name">节点名称</Label>
              <Input
                id="node-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入节点名称"
              />
            </div>

            <Separator />

            {/* 节点配置表单 */}
            {renderConfigForm()}
          </div>
        </ScrollArea>

        {/* 底部操作栏 */}
        <div className="absolute bottom-0 left-0 right-0 border-t bg-background p-4">
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

