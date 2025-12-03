// AI 对话节点配置表单

import { useEffect, useState } from 'react'
import { Users, Globe, Palette, FileText, Check, Settings2, ChevronDown, ChevronRight } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PromptEditor } from '@/components/ui/prompt-editor'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getAvailableModels, getModelConfig, type ModelConfig } from '@/lib/ai'
import { useSettingsStore } from '@/stores/settings-store'
import type { AIChatConfig as AIChatConfigType, GlobalConfig, AIProvider, SettingCategory } from '@/types'
import { cn } from '@/lib/utils'

interface AIChatConfigProps {
  config: Partial<AIChatConfigType>
  globalConfig: GlobalConfig | null
  projectId?: string
  onChange: (config: Partial<AIChatConfigType>) => void
}

// 设定分类配置
const SETTING_CATEGORIES: Array<{
  key: SettingCategory
  label: string
  icon: React.ElementType
}> = [
  { key: 'character', label: '角色', icon: Users },
  { key: 'worldview', label: '世界观', icon: Globe },
  { key: 'style', label: '笔触风格', icon: Palette },
  { key: 'outline', label: '大纲', icon: FileText },
]

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

export function AIChatConfigForm({ config, globalConfig, projectId, onChange }: AIChatConfigProps) {
  // 合并默认配置
  const currentConfig: AIChatConfigType = { ...defaultConfig, ...config }
  const [showAdvanced, setShowAdvanced] = useState(false)

  // 获取设定库
  const { settings, loadSettings, getSettingsByCategory } = useSettingsStore()

  // 加载设定库
  useEffect(() => {
    if (projectId) {
      loadSettings(projectId)
    }
  }, [projectId, loadSettings])

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
        <PromptEditor
          id="prompt"
          placeholder="输入提示词，支持 {{变量名}} 插值..."
          value={currentConfig.prompt}
          onChange={(value) => updateConfig({ prompt: value })}
        />
        <p className="text-xs text-muted-foreground">
          使用 <span className="prompt-var prompt-var-custom">{'{{变量名}}'}</span> 引用变量，
          <span className="prompt-var prompt-var-builtin">{'{{上一节点}}'}</span> 引用上一节点输出
        </p>
      </div>

      <Separator />

      {/* 数据源设置 */}
      <div className="space-y-4">
        <Label>输入数据源</Label>
        <div className="grid gap-4 rounded-lg border p-4 bg-muted/20">
          <Select
            value={currentConfig.input_source}
            onValueChange={(value: 'previous' | 'variable' | 'custom') =>
              updateConfig({ input_source: value })
            }
          >
            <SelectTrigger className="bg-background">
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
              placeholder="输入变量名"
              value={currentConfig.input_variable || ''}
              onChange={(e) => updateConfig({ input_variable: e.target.value })}
              className="bg-background"
            />
          )}

          {currentConfig.input_source === 'custom' && (
            <Textarea
              placeholder="输入自定义内容..."
              className="min-h-[80px] bg-background"
              value={currentConfig.custom_input || ''}
              onChange={(e) => updateConfig({ custom_input: e.target.value })}
            />
          )}
        </div>
      </div>

      <Separator />

      {/* 设定引用 */}
      {projectId && settings.length > 0 && (
        <>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-base font-medium">设定引用</Label>
              <p className="text-xs text-muted-foreground">
                选择要注入到提示词中的设定
              </p>
            </div>

            <div className="space-y-3">
              {SETTING_CATEGORIES.map((category) => {
                const categorySettings = getSettingsByCategory(category.key).filter(s => s.enabled)
                if (categorySettings.length === 0) return null

                return (
                  <div key={category.key} className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <category.icon className="h-4 w-4" />
                      <span>{category.label}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {categorySettings.map((setting) => {
                        const isSelected = currentConfig.setting_ids?.includes(setting.id)
                        return (
                          <Badge
                            key={setting.id}
                            variant={isSelected ? 'default' : 'outline'}
                            className={cn(
                              "cursor-pointer transition-all hover:scale-105 active:scale-95",
                              !isSelected && "hover:bg-secondary hover:text-secondary-foreground"
                            )}
                            onClick={() => {
                              const currentIds = currentConfig.setting_ids || []
                              const newIds = isSelected
                                ? currentIds.filter((id) => id !== setting.id)
                                : [...currentIds, setting.id]
                              updateConfig({ setting_ids: newIds })
                            }}
                          >
                            {isSelected && <Check className="mr-1 h-3 w-3" />}
                            {setting.name}
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {currentConfig.setting_ids && currentConfig.setting_ids.length > 0 && (
              <p className="text-xs text-muted-foreground">
                已选择 {currentConfig.setting_ids.length} 个设定
              </p>
            )}
          </div>

          <Separator />
        </>
      )}

      {/* 高级设置（模型参数 & 上下文） */}
      <Card className={cn("border shadow-sm transition-all", showAdvanced ? "bg-muted/10" : "bg-background")}>
        <Button 
          variant="ghost" 
          className="w-full flex justify-between items-center p-4 h-auto hover:bg-transparent"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            <span className="font-medium">高级设置</span>
          </div>
          {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
        
        {showAdvanced && (
          <CardContent className="p-4 pt-0 space-y-6 animate-in slide-in-from-top-2 duration-200">
            <Separator />
            
            {/* 上下文设置 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enable_history">对话历史</Label>
                  <p className="text-xs text-muted-foreground">
                    附带历史对话作为上下文
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
                  <Label htmlFor="history_count" className="text-xs">保留轮数</Label>
                  <Input
                    id="history_count"
                    type="number"
                    min={1}
                    max={20}
                    className="bg-background"
                    value={currentConfig.history_count}
                    onChange={(e) =>
                      updateConfig({ history_count: parseInt(e.target.value) || 5 })
                    }
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* 模型参数 */}
            <div className="space-y-4">
              <Label className="text-sm font-medium text-muted-foreground">模型参数</Label>

              {/* Temperature */}
              {currentModelConfig?.supportsTemperature && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="temperature" className="text-xs">
                      随机性 (Temperature)
                    </Label>
                    <span className="text-xs text-muted-foreground">
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
                </div>
              )}

              {/* Max Tokens */}
              {currentModelConfig?.supportsMaxTokens && (
                <div className="space-y-2">
                  <Label htmlFor="max_tokens" className="text-xs">最大长度 (Tokens)</Label>
                  <Input
                    id="max_tokens"
                    type="number"
                    min={1}
                    max={32000}
                    className="bg-background"
                    value={currentConfig.max_tokens || currentModelConfig.defaultMaxTokens || 4096}
                    onChange={(e) => updateConfig({ max_tokens: parseInt(e.target.value) || 4096 })}
                  />
                </div>
              )}

              {/* Top P */}
              {currentModelConfig?.supportsTopP && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="top_p" className="text-xs">
                      Top P
                    </Label>
                    <span className="text-xs text-muted-foreground">
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
                  <Label className="text-xs">思考深度</Label>
                  <Select
                    value={currentConfig.thinking_level || 'low'}
                    onValueChange={(value: 'low' | 'high') =>
                      updateConfig({ thinking_level: value })
                    }
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">浅层思考 (快)</SelectItem>
                      <SelectItem value="high">深度思考 (慢)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
