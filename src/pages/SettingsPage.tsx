import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Check,
  Bot,
  Cpu,
  Copy,
  Wifi,
  Settings,
  Save,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { TypographyH3, TypographyMuted } from '@/components/ui/typography'
import { Header } from '@/components/layout/Header'
import { toast } from 'sonner'
import * as db from '@/lib/db'
import type { GlobalConfig, AIProvider, CustomModel } from '@/types'
import { getBuiltinModelsByProvider } from '@/lib/ai'
import { cn } from '@/lib/utils'

interface SettingsPageProps {
  onNavigate: (path: string) => void
}

// AI 提供商配置
const aiProviders: Array<{
  id: AIProvider
  name: string
  description: string
  defaultBaseUrl: string
  icon: React.ReactNode
}> = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini 3 Pro, Gemini 2.5 Pro/Flash 等模型',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    icon: <SparklesIcon className="h-6 w-6 text-blue-500" />,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-5.1, GPT-5, GPT-5 Mini 等模型',
    defaultBaseUrl: 'https://api.openai.com/v1',
    icon: <Bot className="h-6 w-6 text-green-500" />,
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    description: 'Claude Opus 4.5, Sonnet 4.5, Haiku 4.5 等模型',
    defaultBaseUrl: 'https://api.anthropic.com',
    icon: <Cpu className="h-6 w-6 text-orange-500" />,
  },
]

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  )
}

export function SettingsPage({ onNavigate }: SettingsPageProps) {
  const [config, setConfig] = useState<GlobalConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'ai' | 'general'>('ai')
  const [showApiKeys, setShowApiKeys] = useState<Record<AIProvider, boolean>>({
    openai: false,
    gemini: false,
    claude: false,
  })
  const [isTestingConnection, setIsTestingConnection] = useState<string | null>(null)
  // 模型配置展开状态
  const [expandedModels, setExpandedModels] = useState<Record<AIProvider, boolean>>({
    openai: false,
    gemini: false,
    claude: false,
  })
  // 自定义模型表单
  const [newCustomModel, setNewCustomModel] = useState<Record<AIProvider, { id: string; name: string }>>({
    openai: { id: '', name: '' },
    gemini: { id: '', name: '' },
    claude: { id: '', name: '' },
  })

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const globalConfig = await db.getGlobalConfig()
      setConfig(globalConfig)
    } catch (error) {
      console.error('加载配置失败:', error)
      toast.error('加载配置失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!config) return

    setIsSaving(true)
    try {
      await db.updateGlobalConfig({
        ai_providers: config.ai_providers,
        theme: config.theme,
        default_loop_max: config.default_loop_max,
        default_timeout: config.default_timeout,
      })
      toast.success('配置已保存')
    } catch (error) {
      console.error('保存配置失败:', error)
      toast.error('保存配置失败')
    } finally {
      setIsSaving(false)
    }
  }

  const updateProviderConfig = (
    provider: AIProvider,
    key: 'api_key' | 'base_url' | 'enabled',
    value: string | boolean
  ) => {
    if (!config) return

    setConfig({
      ...config,
      ai_providers: {
        ...config.ai_providers,
        [provider]: {
          ...config.ai_providers[provider],
          [key]: value,
        },
      },
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('已复制到剪贴板')
  }

  const testConnection = async (providerId: string) => {
    setIsTestingConnection(providerId)
    // 模拟连接测试
    setTimeout(() => {
      setIsTestingConnection(null)
      toast.success(`${providerId} 连接测试成功 (模拟)`)
    }, 1500)
  }

  // 切换内置模型的启用状态
  const toggleBuiltinModel = (provider: AIProvider, modelId: string) => {
    if (!config) return

    const currentModels = config.ai_providers[provider]?.enabled_models || []
    const isEnabled = currentModels.includes(modelId)
    const newModels = isEnabled
      ? currentModels.filter((id) => id !== modelId)
      : [...currentModels, modelId]

    setConfig({
      ...config,
      ai_providers: {
        ...config.ai_providers,
        [provider]: {
          ...config.ai_providers[provider],
          enabled_models: newModels,
        },
      },
    })
  }

  // 添加自定义模型
  const addCustomModel = (provider: AIProvider) => {
    if (!config) return

    const { id, name } = newCustomModel[provider]
    if (!id.trim() || !name.trim()) {
      toast.error('请填写模型 ID 和名称')
      return
    }

    // 检查是否已存在
    const existingModels = config.ai_providers[provider]?.custom_models || []
    if (existingModels.some((m) => m.id === id.trim())) {
      toast.error('该模型 ID 已存在')
      return
    }

    const newModel: CustomModel = {
      id: id.trim(),
      name: name.trim(),
      enabled: true,
    }

    setConfig({
      ...config,
      ai_providers: {
        ...config.ai_providers,
        [provider]: {
          ...config.ai_providers[provider],
          custom_models: [...existingModels, newModel],
        },
      },
    })

    // 清空表单
    setNewCustomModel((prev) => ({
      ...prev,
      [provider]: { id: '', name: '' },
    }))
    toast.success('自定义模型已添加')
  }

  // 删除自定义模型
  const removeCustomModel = (provider: AIProvider, modelId: string) => {
    if (!config) return

    const currentModels = config.ai_providers[provider]?.custom_models || []
    setConfig({
      ...config,
      ai_providers: {
        ...config.ai_providers,
        [provider]: {
          ...config.ai_providers[provider],
          custom_models: currentModels.filter((m) => m.id !== modelId),
        },
      },
    })
    toast.success('自定义模型已删除')
  }

  // 切换自定义模型的启用状态
  const toggleCustomModel = (provider: AIProvider, modelId: string) => {
    if (!config) return

    const currentModels = config.ai_providers[provider]?.custom_models || []
    setConfig({
      ...config,
      ai_providers: {
        ...config.ai_providers,
        [provider]: {
          ...config.ai_providers[provider],
          custom_models: currentModels.map((m) =>
            m.id === modelId ? { ...m, enabled: !m.enabled } : m
          ),
        },
      },
    })
  }

  if (isLoading) {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="flex h-14 items-center border-b px-4 gap-4">
           <Skeleton className="h-4 w-4 rounded-full" />
           <Skeleton className="h-5 w-24" />
        </div>
        <div className="flex flex-1 overflow-hidden">
           <aside className="w-64 border-r bg-muted/30 p-4 hidden md:block space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
           </aside>
           <main className="flex-1 overflow-y-auto p-6 md:p-8">
              <div className="mx-auto max-w-3xl space-y-6">
                 <div className="flex justify-between">
                    <div className="space-y-2">
                       <Skeleton className="h-8 w-48" />
                       <Skeleton className="h-4 w-64" />
                    </div>
                    <Skeleton className="h-9 w-24" />
                 </div>
                 <Separator className="my-6" />
                 <div className="space-y-6">
                    <Skeleton className="h-64 w-full rounded-xl" />
                    <Skeleton className="h-64 w-full rounded-xl" />
                 </div>
              </div>
           </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <Header
        title="全局设置"
        breadcrumbs={[{ label: '首页', href: '/' }, { label: '全局设置' }]}
        onNavigate={onNavigate}
      >
        <Button variant="ghost" size="sm" onClick={() => onNavigate('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>
      </Header>

      <div className="flex flex-1 overflow-hidden">
        {/* 左侧导航 */}
        <aside className="w-64 border-r bg-muted/30 p-4 hidden md:block">
          <nav className="space-y-1">
            <Button
              variant={activeTab === 'ai' ? 'secondary' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActiveTab('ai')}
            >
              <Bot className="mr-2 h-4 w-4" />
              AI 服务
            </Button>
            <Button
              variant={activeTab === 'general' ? 'secondary' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActiveTab('general')}
            >
              <Settings className="mr-2 h-4 w-4" />
              通用设置
            </Button>
          </nav>
        </aside>

        {/* 右侧内容 */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="mx-auto max-w-3xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <TypographyH3>
                  {activeTab === 'ai' ? 'AI 服务配置' : '通用设置'}
                </TypographyH3>
                <TypographyMuted>
                  {activeTab === 'ai'
                    ? '管理 AI 模型提供商的连接和密钥'
                    : '调整应用的基础行为和默认值'}
                </TypographyMuted>
              </div>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    保存更改
                  </>
                )}
              </Button>
            </div>

            <Separator className="my-6" />

            {activeTab === 'ai' && (
              <div className="space-y-6">
                {aiProviders.map((provider) => (
                  <Card key={provider.id} className="overflow-hidden">
                    <CardHeader className="bg-muted/40 px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background border shadow-sm">
                            {provider.icon}
                          </div>
                          <div>
                            <CardTitle className="text-base">{provider.name}</CardTitle>
                            <CardDescription className="text-xs">
                              {provider.description}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <Button
                              variant="ghost"
                              size="sm"
                              disabled={!config?.ai_providers[provider.id]?.api_key}
                              onClick={() => testConnection(provider.name)}
                           >
                              {isTestingConnection === provider.name ? (
                                <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              ) : (
                                <Wifi className="h-4 w-4 mr-1" />
                              )}
                              <span className="text-xs">测试连接</span>
                           </Button>
                           <Separator orientation="vertical" className="h-6" />
                           <Button
                             variant={
                               config?.ai_providers[provider.id]?.enabled
                                 ? 'default'
                                 : 'outline'
                             }
                             size="sm"
                             onClick={() =>
                               updateProviderConfig(
                                 provider.id,
                                 'enabled',
                                 !config?.ai_providers[provider.id]?.enabled
                               )
                             }
                           >
                             {config?.ai_providers[provider.id]?.enabled ? (
                               <>
                                 <Check className="mr-2 h-4 w-4" />
                                 已启用
                               </>
                             ) : (
                               '启用'
                             )}
                           </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor={`${provider.id}-api-key`}>API Key</Label>
                        <div className="relative flex gap-2">
                          <div className="relative flex-1">
                            <Input
                              id={`${provider.id}-api-key`}
                              type={showApiKeys[provider.id] ? 'text' : 'password'}
                              placeholder={`sk-...`}
                              value={config?.ai_providers[provider.id]?.api_key || ''}
                              onChange={(e) =>
                                updateProviderConfig(provider.id, 'api_key', e.target.value)
                              }
                              className="pr-10 font-mono text-sm"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              onClick={() =>
                                setShowApiKeys((prev) => ({
                                  ...prev,
                                  [provider.id]: !prev[provider.id],
                                }))
                              }
                            >
                              {showApiKeys[provider.id] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <Button
                            variant="outline"
                            size="icon"
                            title="复制 API Key"
                            onClick={() =>
                              copyToClipboard(config?.ai_providers[provider.id]?.api_key || '')
                            }
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`${provider.id}-base-url`}>
                          代理地址 / Base URL
                        </Label>
                        <Input
                          id={`${provider.id}-base-url`}
                          placeholder={provider.defaultBaseUrl}
                          value={config?.ai_providers[provider.id]?.base_url || ''}
                          onChange={(e) =>
                            updateProviderConfig(provider.id, 'base_url', e.target.value)
                          }
                          className="font-mono text-sm"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          默认: {provider.defaultBaseUrl}
                        </p>
                      </div>

                      {/* 模型配置区域 */}
                      <Separator />
                      <div className="space-y-3">
                        <div 
                          className="flex items-center justify-between cursor-pointer py-1"
                          onClick={() => setExpandedModels((prev) => ({
                            ...prev,
                            [provider.id]: !prev[provider.id],
                          }))}
                        >
                          <Label className="cursor-pointer">模型配置</Label>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {(config?.ai_providers[provider.id]?.enabled_models?.length || 0) + 
                               (config?.ai_providers[provider.id]?.custom_models?.filter(m => m.enabled).length || 0)} 个启用
                            </Badge>
                            {expandedModels[provider.id] ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>

                        {expandedModels[provider.id] && (
                          <div className="space-y-4 pt-2">
                            {/* 内置模型 */}
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">内置模型</p>
                              <div className="grid gap-2">
                                {getBuiltinModelsByProvider(provider.id).map((model) => {
                                  const isEnabled = config?.ai_providers[provider.id]?.enabled_models?.includes(model.id) || false
                                  return (
                                    <div
                                      key={model.id}
                                      className={cn(
                                        "flex items-center justify-between rounded-lg border p-3 transition-colors",
                                        isEnabled ? "bg-primary/5 border-primary/20" : "bg-muted/30"
                                      )}
                                    >
                                      <div className="space-y-0.5">
                                        <p className="text-sm font-medium">{model.name}</p>
                                        <p className="text-xs text-muted-foreground font-mono">{model.id}</p>
                                      </div>
                                      <Switch
                                        checked={isEnabled}
                                        onCheckedChange={() => toggleBuiltinModel(provider.id, model.id)}
                                      />
                                    </div>
                                  )
                                })}
                              </div>
                            </div>

                            {/* 自定义模型 */}
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">自定义模型</p>
                              
                              {/* 已添加的自定义模型 */}
                              {(config?.ai_providers[provider.id]?.custom_models || []).length > 0 && (
                                <div className="grid gap-2 mb-3">
                                  {config?.ai_providers[provider.id]?.custom_models?.map((model) => (
                                    <div
                                      key={model.id}
                                      className={cn(
                                        "flex items-center justify-between rounded-lg border p-3 transition-colors",
                                        model.enabled ? "bg-primary/5 border-primary/20" : "bg-muted/30"
                                      )}
                                    >
                                      <div className="space-y-0.5">
                                        <p className="text-sm font-medium">{model.name}</p>
                                        <p className="text-xs text-muted-foreground font-mono">{model.id}</p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Switch
                                          checked={model.enabled}
                                          onCheckedChange={() => toggleCustomModel(provider.id, model.id)}
                                        />
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                          onClick={() => removeCustomModel(provider.id, model.id)}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* 添加自定义模型表单 */}
                              <div className="flex gap-2">
                                <Input
                                  placeholder="模型 ID"
                                  value={newCustomModel[provider.id].id}
                                  onChange={(e) =>
                                    setNewCustomModel((prev) => ({
                                      ...prev,
                                      [provider.id]: { ...prev[provider.id], id: e.target.value },
                                    }))
                                  }
                                  className="flex-1 font-mono text-sm"
                                />
                                <Input
                                  placeholder="显示名称"
                                  value={newCustomModel[provider.id].name}
                                  onChange={(e) =>
                                    setNewCustomModel((prev) => ({
                                      ...prev,
                                      [provider.id]: { ...prev[provider.id], name: e.target.value },
                                    }))
                                  }
                                  className="flex-1"
                                />
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => addCustomModel(provider.id)}
                                  disabled={!newCustomModel[provider.id].id.trim() || !newCustomModel[provider.id].name.trim()}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                添加该提供商支持的其他模型
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {activeTab === 'general' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>执行设置</CardTitle>
                    <CardDescription>
                      控制工作流执行的默认行为
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="default-loop-max">默认循环上限</Label>
                        <Input
                          id="default-loop-max"
                          type="number"
                          min={1}
                          max={100}
                          value={config?.default_loop_max || 10}
                          onChange={(e) =>
                            setConfig((prev) =>
                              prev
                                ? { ...prev, default_loop_max: parseInt(e.target.value) || 10 }
                                : prev
                            )
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          防止死循环的安全限制
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="default-timeout">默认超时 (秒)</Label>
                        <Input
                          id="default-timeout"
                          type="number"
                          min={30}
                          max={3600}
                          value={config?.default_timeout || 300}
                          onChange={(e) =>
                            setConfig((prev) =>
                              prev
                                ? { ...prev, default_timeout: parseInt(e.target.value) || 300 }
                                : prev
                            )
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          单次执行的最长等待时间
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

