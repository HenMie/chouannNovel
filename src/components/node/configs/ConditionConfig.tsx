// 条件判断节点配置表单

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getAvailableModels, getModelConfig, type ModelConfig } from '@/lib/ai'
import type { 
  ConditionConfig as ConditionConfigType, 
  GlobalConfig, 
  AIProvider,
  WorkflowNode 
} from '@/types'

interface ConditionConfigProps {
  config: Partial<ConditionConfigType>
  globalConfig: GlobalConfig | null
  nodes?: WorkflowNode[]  // 用于跳转目标选择
  currentNodeId?: string  // 当前节点 ID（排除自己）
  onChange: (config: Partial<ConditionConfigType>) => void
}

// 默认配置
const defaultConfig: ConditionConfigType = {
  input_source: 'previous',
  condition_type: 'keyword',
  keywords: [],
  keyword_mode: 'any',
  length_operator: '>',
  length_value: 0,
  regex_pattern: '',
  ai_prompt: '',
  ai_provider: 'openai',
  ai_model: 'gpt-4o',
  true_action: 'next',
  false_action: 'next',
}

// 条件类型标签
const conditionTypeLabels: Record<ConditionConfigType['condition_type'], string> = {
  keyword: '关键词匹配',
  length: '长度判断',
  regex: '正则匹配',
  ai_judge: 'AI 智能判断',
}

// 长度操作符标签
const lengthOperatorLabels: Record<string, string> = {
  '>': '大于',
  '<': '小于',
  '=': '等于',
  '>=': '大于等于',
  '<=': '小于等于',
}

// 动作标签
const actionLabels: Record<ConditionConfigType['true_action'], string> = {
  next: '继续执行下一节点',
  jump: '跳转到指定节点',
  end: '结束工作流',
}

export function ConditionConfigForm({ 
  config, 
  globalConfig, 
  nodes = [],
  currentNodeId,
  onChange 
}: ConditionConfigProps) {
  // 合并默认配置
  const currentConfig: ConditionConfigType = { ...defaultConfig, ...config }

  // 获取可用模型列表
  const availableModels = globalConfig ? getAvailableModels(globalConfig) : []
  
  // 按提供商分组模型
  const modelsByProvider = availableModels.reduce(
    (acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = []
      }
      acc[model.provider].push(model)
      return acc
    },
    {} as Record<AIProvider, ModelConfig[]>
  )

  // 提供商名称映射
  const providerNames: Record<AIProvider, string> = {
    openai: 'OpenAI',
    gemini: 'Google Gemini',
    claude: 'Anthropic Claude',
  }

  // 可跳转的节点（排除当前节点）
  const jumpableNodes = nodes.filter(n => n.id !== currentNodeId)

  // 更新配置
  const updateConfig = (updates: Partial<ConditionConfigType>) => {
    onChange({ ...currentConfig, ...updates })
  }

  // 解析关键词字符串
  const keywordsString = (currentConfig.keywords || []).join('\n')
  const handleKeywordsChange = (value: string) => {
    const keywords = value.split('\n').filter(k => k.trim())
    updateConfig({ keywords })
  }

  // 当模型变化时，自动更新提供商
  const handleModelChange = (modelId: string) => {
    const modelConfig = getModelConfig(modelId)
    if (modelConfig) {
      updateConfig({
        ai_model: modelId,
        ai_provider: modelConfig.provider,
      })
    }
  }

  // 渲染动作选择
  const renderActionSelect = (
    label: string, 
    actionKey: 'true_action' | 'false_action',
    targetKey: 'true_target' | 'false_target'
  ) => {
    const action = currentConfig[actionKey]
    const target = currentConfig[targetKey]

    return (
      <div className="space-y-3">
        <Label>{label}</Label>
        <Select
          value={action}
          onValueChange={(value: ConditionConfigType['true_action']) =>
            updateConfig({ [actionKey]: value, [targetKey]: undefined })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(actionLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {action === 'jump' && (
          <Select
            value={target || ''}
            onValueChange={(value) => updateConfig({ [targetKey]: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择跳转目标节点" />
            </SelectTrigger>
            <SelectContent>
              {jumpableNodes.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  暂无可跳转的节点
                </div>
              ) : (
                jumpableNodes.map((node) => (
                  <SelectItem key={node.id} value={node.id}>
                    {node.name} ({node.type})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 数据源设置 */}
      <div className="space-y-4">
        <Label>输入数据源</Label>
        <Select
          value={currentConfig.input_source}
          onValueChange={(value: 'previous' | 'variable') =>
            updateConfig({ input_source: value })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="previous">上一节点输出</SelectItem>
            <SelectItem value="variable">引用变量</SelectItem>
          </SelectContent>
        </Select>

        {currentConfig.input_source === 'variable' && (
          <Input
            placeholder="变量名"
            value={currentConfig.input_variable || ''}
            onChange={(e) => updateConfig({ input_variable: e.target.value })}
          />
        )}
      </div>

      <Separator />

      {/* 条件类型 */}
      <div className="space-y-4">
        <Label>条件类型</Label>
        <Select
          value={currentConfig.condition_type}
          onValueChange={(value: ConditionConfigType['condition_type']) =>
            updateConfig({ condition_type: value })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(conditionTypeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* 关键词匹配配置 */}
      {currentConfig.condition_type === 'keyword' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="keywords">关键词列表</Label>
            <Textarea
              id="keywords"
              placeholder="每行一个关键词..."
              className="min-h-[100px]"
              value={keywordsString}
              onChange={(e) => handleKeywordsChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>匹配模式</Label>
            <Select
              value={currentConfig.keyword_mode}
              onValueChange={(value: 'any' | 'all' | 'none') =>
                updateConfig({ keyword_mode: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">包含任意一个</SelectItem>
                <SelectItem value="all">包含全部</SelectItem>
                <SelectItem value="none">不包含任何一个</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* 长度判断配置 */}
      {currentConfig.condition_type === 'length' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-2">
              <Label>比较运算符</Label>
              <Select
                value={currentConfig.length_operator}
                onValueChange={(value: '>' | '<' | '=' | '>=' | '<=') =>
                  updateConfig({ length_operator: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(lengthOperatorLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label} ({value})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="length_value">字符数</Label>
              <Input
                id="length_value"
                type="number"
                min={0}
                value={currentConfig.length_value || 0}
                onChange={(e) => updateConfig({ length_value: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            判断输入文本长度是否满足条件
          </p>
        </div>
      )}

      {/* 正则匹配配置 */}
      {currentConfig.condition_type === 'regex' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="regex_pattern">正则表达式</Label>
            <Textarea
              id="regex_pattern"
              placeholder="例如：完成|结束|END"
              className="min-h-[80px] font-mono text-sm"
              value={currentConfig.regex_pattern || ''}
              onChange={(e) => updateConfig({ regex_pattern: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              如果正则表达式匹配成功，条件为真
            </p>
          </div>
        </div>
      )}

      {/* AI 智能判断配置 */}
      {currentConfig.condition_type === 'ai_judge' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>选择模型</Label>
            {availableModels.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  请先在全局设置中配置 AI 服务
                </p>
              </div>
            ) : (
              <Select value={currentConfig.ai_model} onValueChange={handleModelChange}>
                <SelectTrigger>
                  <SelectValue placeholder="选择 AI 模型" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(modelsByProvider).map(([provider, models]) => (
                    <div key={provider}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        {providerNames[provider as AIProvider]}
                      </div>
                      {models.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai_prompt">判断提示词</Label>
            <Textarea
              id="ai_prompt"
              placeholder="请判断以下内容是否满足条件...（AI 会根据此提示返回 true/false）"
              className="min-h-[100px]"
              value={currentConfig.ai_prompt || ''}
              onChange={(e) => updateConfig({ ai_prompt: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              AI 将根据提示词判断输入内容，返回 true 或 false
            </p>
          </div>
        </div>
      )}

      <Separator />

      {/* 条件为真时的动作 */}
      <Card className="border-green-200 dark:border-green-900">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Badge variant="default" className="bg-green-600">条件为真</Badge>
            执行动作
          </CardTitle>
        </CardHeader>
        <CardContent>
          {renderActionSelect('', 'true_action', 'true_target')}
        </CardContent>
      </Card>

      {/* 条件为假时的动作 */}
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Badge variant="destructive">条件为假</Badge>
            执行动作
          </CardTitle>
        </CardHeader>
        <CardContent>
          {renderActionSelect('', 'false_action', 'false_target')}
        </CardContent>
      </Card>
    </div>
  )
}

