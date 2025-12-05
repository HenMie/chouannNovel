// AI 对话节点配置表单

import React, { useEffect, useState } from 'react'
import { Users, Globe, Palette, FileText, Check, Settings2, ChevronDown, ChevronRight } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { PromptInputField, type PromptInputMode } from '@/components/ui/prompt-input-field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getAvailableModels, getModelConfig, type ModelConfig } from '@/lib/ai'
import { useSettingsStore } from '@/stores/settings-store'
import type { AIChatConfig as AIChatConfigType, GlobalConfig, AIProvider, SettingCategory, WorkflowNode } from '@/types'
import { cn } from '@/lib/utils'

interface AIChatConfigProps {
  config: Partial<AIChatConfigType>
  globalConfig: GlobalConfig | null
  projectId?: string
  nodes?: WorkflowNode[]  // 所有节点，用于检测变量
  currentNodeId?: string  // 当前节点 ID，用于变量选择器过滤
  onChange: (config: Partial<AIChatConfigType>) => void
  onNavigate?: (path: string) => void  // 导航函数，用于跳转到设置页
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
  provider: 'gemini',
  model: 'gemini-2.5-flash',
  system_prompt: '',
  user_prompt: '{{用户问题}}',  // 使用系统内置变量，引用初始用户输入
  system_prompt_mode: 'manual',
  system_prompt_manual: '',
  system_prompt_variable: '',
  user_prompt_mode: 'manual',
  user_prompt_manual: '{{用户问题}}',
  user_prompt_variable: '',
  temperature: 1,
  top_p: 0.95,
  // max_tokens 默认不启用，用户在高级设置中手动开启
  enable_history: false,
  history_count: 5,
  setting_ids: [],
}

const normalizeMode = (mode?: PromptInputMode): PromptInputMode =>
  mode === 'variable' ? 'variable' : 'manual'

export function AIChatConfigForm({ config, globalConfig, projectId, nodes = [], currentNodeId, onChange, onNavigate }: AIChatConfigProps) {
  // 合并默认配置，兼容旧版 prompt 字段
  const legacyConfig = config as any
  const fallbackSystemPrompt = config.system_prompt ?? legacyConfig.prompt ?? ''
  const fallbackUserPrompt = config.user_prompt ?? '{{用户问题}}'
  const migratedConfig: Partial<AIChatConfigType> = {
    ...config,
    // 如果有旧的 prompt 字段，迁移到 system_prompt
    system_prompt: fallbackSystemPrompt,
    user_prompt: fallbackUserPrompt,
    system_prompt_manual: config.system_prompt_manual ?? fallbackSystemPrompt,
    user_prompt_manual: config.user_prompt_manual ?? fallbackUserPrompt,
    system_prompt_variable:
      config.system_prompt_variable ??
      (config.system_prompt_mode === 'variable' ? fallbackSystemPrompt : ''),
    user_prompt_variable:
      config.user_prompt_variable ??
      (config.user_prompt_mode === 'variable' ? fallbackUserPrompt : ''),
  }
  const currentConfig: AIChatConfigType = { ...defaultConfig, ...migratedConfig }
  const [showAdvanced, setShowAdvanced] = useState(false)

  const systemPromptMode = normalizeMode(currentConfig.system_prompt_mode)
  const systemPromptManualValue =
    currentConfig.system_prompt_manual ?? currentConfig.system_prompt ?? ''
  const systemPromptVariableValue =
    currentConfig.system_prompt_variable ??
    (systemPromptMode === 'variable' ? currentConfig.system_prompt ?? '' : '')

  const userPromptMode = normalizeMode(currentConfig.user_prompt_mode)
  const userPromptManualValue =
    currentConfig.user_prompt_manual ?? currentConfig.user_prompt ?? ''
  const userPromptVariableValue =
    currentConfig.user_prompt_variable ??
    (userPromptMode === 'variable' ? currentConfig.user_prompt ?? '' : '')

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
  const currentModelConfig = getModelConfig(currentConfig.model, globalConfig ?? undefined)

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

  // === 提示词输入模式相关处理 ===
  const handleSystemModeChange = (mode: PromptInputMode) => {
    if (mode === 'manual') {
      updateConfig({
        system_prompt_mode: 'manual',
        system_prompt: systemPromptManualValue,
      })
    } else {
      updateConfig({
        system_prompt_mode: 'variable',
        system_prompt: systemPromptVariableValue,
      })
    }
  }

  const handleSystemManualChange = (value: string) => {
    updateConfig({
      system_prompt_mode: 'manual',
      system_prompt: value,
      system_prompt_manual: value,
    })
  }

  const handleSystemVariableChange = (value: string) => {
    updateConfig({
      system_prompt_mode: 'variable',
      system_prompt: value,
      system_prompt_variable: value,
    })
  }

  const handleUserModeChange = (mode: PromptInputMode) => {
    if (mode === 'manual') {
      updateConfig({
        user_prompt_mode: 'manual',
        user_prompt: userPromptManualValue,
      })
    } else {
      updateConfig({
        user_prompt_mode: 'variable',
        user_prompt: userPromptVariableValue,
      })
    }
  }

  const handleUserManualChange = (value: string) => {
    updateConfig({
      user_prompt_mode: 'manual',
      user_prompt: value,
      user_prompt_manual: value,
    })
  }

  const handleUserVariableChange = (value: string) => {
    updateConfig({
      user_prompt_mode: 'variable',
      user_prompt: value,
      user_prompt_variable: value,
    })
  }

  // 当模型变化时，自动更新提供商
  const handleModelChange = (modelId: string) => {
    const modelConfig = getModelConfig(modelId, globalConfig ?? undefined)
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
        {onNavigate && (
          <Button
            variant="link"
            size="sm"
            className="mt-3 text-primary"
            onClick={() => onNavigate('/settings')}
          >
            <Settings2 className="mr-1.5 h-3.5 w-3.5" />
            去配置
          </Button>
        )}
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

      <PromptInputField
        id="system_prompt"
        label="系统提示词"
        description="作为 System Message 发送，用于设定 AI 的角色和行为"
        mode={systemPromptMode}
        manualValue={systemPromptManualValue}
        variableValue={systemPromptVariableValue}
        onModeChange={handleSystemModeChange}
        onManualChange={handleSystemManualChange}
        onVariableChange={handleSystemVariableChange}
        nodes={nodes}
        currentNodeId={currentNodeId}
        placeholder="输入系统提示词，输入 / 选择变量..."
      />

      <PromptInputField
        id="user_prompt"
        label="用户问题"
        description="作为 User Message 发送给 AI"
        mode={userPromptMode}
        manualValue={userPromptManualValue}
        variableValue={userPromptVariableValue}
        onModeChange={handleUserModeChange}
        onManualChange={handleUserManualChange}
        onVariableChange={handleUserVariableChange}
        nodes={nodes}
        currentNodeId={currentNodeId}
        placeholder="输入用户问题，输入 / 选择变量..."
        minHeight="80px"
      />

      {/* 设定引用 */}
      {projectId && settings.length > 0 && (
        <>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-base font-medium">设定引用</Label>
              <p className="text-xs text-muted-foreground">
                选择要注入到系统提示词中的设定
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
                      {currentConfig.temperature?.toFixed(1) ?? '1.0'}
                    </span>
                  </div>
                  <Slider
                    id="temperature"
                    min={0}
                    max={2}
                    step={0.1}
                    value={[currentConfig.temperature ?? 1]}
                    onValueChange={([value]) => updateConfig({ temperature: value })}
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
                      {currentConfig.top_p?.toFixed(2) ?? '0.95'}
                    </span>
                  </div>
                  <Slider
                    id="top_p"
                    min={0}
                    max={1}
                    step={0.01}
                    value={[currentConfig.top_p ?? 0.95]}
                    onValueChange={([value]) => updateConfig({ top_p: value })}
                  />
                </div>
              )}

              {/* Max Tokens (可选) */}
              {currentModelConfig?.supportsMaxTokens && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="enable_max_tokens" className="text-xs">
                      限制输出长度
                    </Label>
                    <Switch
                      id="enable_max_tokens"
                      checked={currentConfig.max_tokens !== undefined}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          updateConfig({ max_tokens: currentModelConfig.defaultMaxTokens || 4096 })
                        } else {
                          updateConfig({ max_tokens: undefined })
                        }
                      }}
                    />
                  </div>
                  {currentConfig.max_tokens !== undefined && (
                    <Input
                      id="max_tokens"
                      type="number"
                      min={1}
                      max={32000}
                      className="bg-background"
                      value={currentConfig.max_tokens}
                      onChange={(e) => updateConfig({ max_tokens: parseInt(e.target.value) || 4096 })}
                    />
                  )}
                </div>
              )}

              {/* Thinking Level (Gemini 3 Pro) */}
              {currentModelConfig?.thinkingMode === 'thinkingLevel' && (
                <div className="space-y-2">
                  <Label className="text-xs">思考深度 (Gemini 3)</Label>
                  <Select
                    value={currentConfig.thinking_level || 'high'}
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

              {/* Thinking Budget (Gemini 2.5 系列) */}
              {currentModelConfig?.thinkingMode === 'thinkingBudget' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="thinking_budget" className="text-xs">
                      思考预算 (Gemini 2.5)
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      {currentConfig.thinking_budget === -1 
                        ? '动态' 
                        : currentConfig.thinking_budget === 0 
                          ? '禁用' 
                          : `${currentConfig.thinking_budget ?? -1} tokens`}
                    </span>
                  </div>
                  <Select
                    value={String(currentConfig.thinking_budget ?? -1)}
                    onValueChange={(value) => {
                      const numValue = parseInt(value)
                      updateConfig({ thinking_budget: numValue })
                    }}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-1">动态思考 (推荐)</SelectItem>
                      {currentModelConfig?.canDisableThinking && (
                        <SelectItem value="0">禁用思考 (最快)</SelectItem>
                      )}
                      <SelectItem value="1024">1K tokens (轻度)</SelectItem>
                      <SelectItem value="4096">4K tokens (中度)</SelectItem>
                      <SelectItem value="8192">8K tokens (深度)</SelectItem>
                      <SelectItem value="16384">16K tokens (极深)</SelectItem>
                      {(currentModelConfig?.thinkingBudgetRange?.[1] ?? 0) >= 24576 && (
                        <SelectItem value="24576">24K tokens (最大)</SelectItem>
                      )}
                      {(currentModelConfig?.thinkingBudgetRange?.[1] ?? 0) >= 32768 && (
                        <SelectItem value="32768">32K tokens (最大)</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {currentModelConfig?.canDisableThinking 
                      ? '控制模型思考的 token 数量，动态模式让模型自动决定'
                      : '此模型不支持禁用思考，动态模式让模型自动决定'}
                  </p>
                </div>
              )}

              {/* Effort (Claude) */}
              {currentModelConfig?.thinkingMode === 'effort' && (
                <div className="space-y-2">
                  <Label className="text-xs">推理努力 (Claude)</Label>
                  <Select
                    value={currentConfig.effort || 'high'}
                    onValueChange={(value: 'low' | 'medium' | 'high') =>
                      updateConfig({ effort: value })
                    }
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">低 (快速响应)</SelectItem>
                      <SelectItem value="medium">中等</SelectItem>
                      <SelectItem value="high">高 (深入推理)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    控制模型的推理深度，影响响应质量和速度
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
