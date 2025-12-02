import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Eye, EyeOff, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Header } from '@/components/layout/Header'
import { toast } from 'sonner'
import * as db from '@/lib/db'
import type { GlobalConfig, AIProvider } from '@/types'

interface SettingsPageProps {
  onNavigate: (path: string) => void
}

// AI 提供商配置
const aiProviders: Array<{
  id: AIProvider
  name: string
  description: string
  models: string[]
  defaultBaseUrl: string
}> = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o、GPT-4o-mini、o1 等模型',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini'],
    defaultBaseUrl: 'https://api.openai.com/v1',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini 2.0 Flash、Gemini 2.5 Pro 等模型',
    models: ['gemini-2.0-flash-exp', 'gemini-2.5-pro', 'gemini-1.5-pro'],
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    description: 'Claude Sonnet、Claude Haiku 等模型',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022'],
    defaultBaseUrl: 'https://api.anthropic.com',
  },
]

export function SettingsPage({ onNavigate }: SettingsPageProps) {
  const [config, setConfig] = useState<GlobalConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showApiKeys, setShowApiKeys] = useState<Record<AIProvider, boolean>>({
    openai: false,
    gemini: false,
    claude: false,
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

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <Header title="全局设置">
        <Button variant="ghost" size="sm" onClick={() => onNavigate('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>
      </Header>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <Tabs defaultValue="ai" className="space-y-6">
            <TabsList>
              <TabsTrigger value="ai">AI 服务</TabsTrigger>
              <TabsTrigger value="general">通用设置</TabsTrigger>
            </TabsList>

            {/* AI 服务配置 */}
            <TabsContent value="ai" className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h2 className="mb-4 text-lg font-semibold">AI 服务配置</h2>
                <p className="mb-6 text-sm text-muted-foreground">
                  配置各 AI 服务提供商的 API Key，启用后可在工作流中使用对应的模型
                </p>

                <div className="space-y-4">
                  {aiProviders.map((provider, index) => (
                    <motion.div
                      key={provider.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index }}
                    >
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-base">{provider.name}</CardTitle>
                              <CardDescription>{provider.description}</CardDescription>
                            </div>
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
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor={`${provider.id}-api-key`}>API Key</Label>
                            <div className="relative">
                              <Input
                                id={`${provider.id}-api-key`}
                                type={showApiKeys[provider.id] ? 'text' : 'password'}
                                placeholder={`输入 ${provider.name} API Key`}
                                value={config?.ai_providers[provider.id]?.api_key || ''}
                                onChange={(e) =>
                                  updateProviderConfig(provider.id, 'api_key', e.target.value)
                                }
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
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
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`${provider.id}-base-url`}>
                              Base URL（可选）
                            </Label>
                            <Input
                              id={`${provider.id}-base-url`}
                              placeholder={provider.defaultBaseUrl}
                              value={config?.ai_providers[provider.id]?.base_url || ''}
                              onChange={(e) =>
                                updateProviderConfig(provider.id, 'base_url', e.target.value)
                              }
                            />
                            <p className="text-xs text-muted-foreground">
                              留空使用默认地址，可填写代理或兼容 API 地址
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className="text-xs text-muted-foreground">支持的模型：</span>
                            {provider.models.map((model) => (
                              <span
                                key={model}
                                className="rounded-md bg-muted px-2 py-0.5 text-xs"
                              >
                                {model}
                              </span>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </TabsContent>

            {/* 通用设置 */}
            <TabsContent value="general" className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h2 className="mb-4 text-lg font-semibold">通用设置</h2>

                <Card>
                  <CardContent className="space-y-6 pt-6">
                    <div className="space-y-2">
                      <Label htmlFor="default-loop-max">默认最大循环次数</Label>
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
                        新建工作流时的默认循环保护次数
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="default-timeout">默认超时时间（秒）</Label>
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
                        新建工作流时的默认执行超时时间
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </Tabs>

          {/* 保存按钮 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-6 flex justify-end"
          >
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  保存中...
                </>
              ) : (
                '保存设置'
              )}
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

