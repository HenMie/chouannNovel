// AI 对话节点配置表单

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
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { getAvailableModels, getModelConfig, type ModelConfig } from '@/lib/ai'
import type { AIChatConfig as AIChatConfigType, GlobalConfig, AIProvider } from '@/types'

interface AIChatConfigProps {
  config: Partial<AIChatConfigType>
  globalConfig: GlobalConfig | null
  onChange: (config: Partial<AIChatConfigType>) => void
}

// 默认配置
const defaultConfig: AIChatConfigType = {
  provider: 'openai',
  model: 'gpt-4o',
  prompt: '',
  temperature: 0.7,
  max_tokens: 4096,
  enable_history: false,
  history_count: 5,
  setting_ids: [],
  input_source: 'previous',
}

export function AIChatConfigForm({ config, globalConfig, onChange }: AIChatConfigProps) {
  // 合并默认配置
  const currentConfig: AIChatConfigType = { ...defaultConfig, ...config }

  // 获取可用模型列表
  const availableModels = globalConfig ? getAvailableModels(globalConfig) : []
  const currentModelConfig = getModelConfig(currentConfig.model)

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

  // 更新配置
  const updateConfig = (updates: Partial<AIChatConfigType>) => {
    onChange({ ...currentConfig, ...updates })
  }

  // 当模型变化时，自动更新提供商
  const handleModelChange = (modelId: string) => {
    const modelConfig = getModelConfig(modelId)
    if (modelConfig) {
      updateConfig({
        model: modelId,
        provider: modelConfig.provider,
        // 重置不支持的参数
        temperature: modelConfig.supportsTemperature ? currentConfig.temperature : undefined,
        max_tokens: modelConfig.supportsMaxTokens
          ? currentConfig.max_tokens || modelConfig.defaultMaxTokens
          : undefined,
        top_p: modelConfig.supportsTopP ? currentConfig.top_p : undefined,
      })
    }
  }

  // 如果没有可用模型，显示提示
  if (availableModels.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground">
          暂无可用的 AI 模型
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          请先在全局设置中配置并启用 AI 服务
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 模型选择 */}
      <div className="space-y-2">
        <Label>选择模型</Label>
        <Select value={currentConfig.model} onValueChange={handleModelChange}>
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
      </div>

      <Separator />

      {/* 提示词 */}
      <div className="space-y-2">
        <Label htmlFor="prompt">提示词</Label>
        <Textarea
          id="prompt"
          placeholder="输入提示词，支持 {{变量名}} 插值..."
          className="min-h-[120px] font-mono text-sm"
          value={currentConfig.prompt}
          onChange={(e) => updateConfig({ prompt: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          使用 {`{{变量名}}`} 引用变量，{`{{上一节点}}`} 引用上一节点输出
        </p>
      </div>

      <Separator />

      {/* 数据源设置 */}
      <div className="space-y-4">
        <Label>输入数据源</Label>
        <Select
          value={currentConfig.input_source}
          onValueChange={(value: 'previous' | 'variable' | 'custom') =>
            updateConfig({ input_source: value })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="previous">上一节点输出</SelectItem>
            <SelectItem value="variable">引用变量</SelectItem>
            <SelectItem value="custom">自定义内容</SelectItem>
          </SelectContent>
        </Select>

        {currentConfig.input_source === 'variable' && (
          <Input
            placeholder="变量名"
            value={currentConfig.input_variable || ''}
            onChange={(e) => updateConfig({ input_variable: e.target.value })}
          />
        )}

        {currentConfig.input_source === 'custom' && (
          <Textarea
            placeholder="输入自定义内容..."
            className="min-h-[80px]"
            value={currentConfig.custom_input || ''}
            onChange={(e) => updateConfig({ custom_input: e.target.value })}
          />
        )}
      </div>

      <Separator />

      {/* 模型参数 */}
      <div className="space-y-4">
        <Label className="text-base font-medium">模型参数</Label>

        {/* Temperature */}
        {currentModelConfig?.supportsTemperature && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="temperature" className="text-sm">
                Temperature
              </Label>
              <span className="text-sm text-muted-foreground">
                {currentConfig.temperature?.toFixed(1) ?? '0.7'}
              </span>
            </div>
            <Slider
              id="temperature"
              min={0}
              max={2}
              step={0.1}
              value={[currentConfig.temperature ?? 0.7]}
              onValueChange={([value]) => updateConfig({ temperature: value })}
            />
            <p className="text-xs text-muted-foreground">
              较低的值使输出更确定，较高的值使输出更随机
            </p>
          </div>
        )}

        {/* Max Tokens */}
        {currentModelConfig?.supportsMaxTokens && (
          <div className="space-y-2">
            <Label htmlFor="max_tokens">最大 Token 数</Label>
            <Input
              id="max_tokens"
              type="number"
              min={1}
              max={32000}
              value={currentConfig.max_tokens || currentModelConfig.defaultMaxTokens || 4096}
              onChange={(e) => updateConfig({ max_tokens: parseInt(e.target.value) || 4096 })}
            />
          </div>
        )}

        {/* Top P */}
        {currentModelConfig?.supportsTopP && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="top_p" className="text-sm">
                Top P
              </Label>
              <span className="text-sm text-muted-foreground">
                {currentConfig.top_p?.toFixed(2) ?? '1.00'}
              </span>
            </div>
            <Slider
              id="top_p"
              min={0}
              max={1}
              step={0.01}
              value={[currentConfig.top_p ?? 1]}
              onValueChange={([value]) => updateConfig({ top_p: value })}
            />
          </div>
        )}

        {/* Thinking Level (Gemini) */}
        {currentModelConfig?.supportsThinkingLevel && (
          <div className="space-y-2">
            <Label>思考级别</Label>
            <Select
              value={currentConfig.thinking_level || 'low'}
              onValueChange={(value: 'low' | 'high') =>
                updateConfig({ thinking_level: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">低</SelectItem>
                <SelectItem value="high">高</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Separator />

      {/* 上下文设置 */}
      <div className="space-y-4">
        <Label className="text-base font-medium">上下文设置</Label>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="enable_history">启用对话历史</Label>
            <p className="text-xs text-muted-foreground">
              将之前的对话作为上下文发送
            </p>
          </div>
          <Switch
            id="enable_history"
            checked={currentConfig.enable_history}
            onCheckedChange={(checked) => updateConfig({ enable_history: checked })}
          />
        </div>

        {currentConfig.enable_history && (
          <div className="space-y-2">
            <Label htmlFor="history_count">历史消息数量</Label>
            <Input
              id="history_count"
              type="number"
              min={1}
              max={20}
              value={currentConfig.history_count}
              onChange={(e) =>
                updateConfig({ history_count: parseInt(e.target.value) || 5 })
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}

