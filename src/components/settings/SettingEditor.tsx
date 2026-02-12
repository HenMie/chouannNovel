import { useRef, useState, useCallback, useMemo } from 'react'
import {
  Save,
  Bold,
  Italic,
  List,
  Code,
  Quote,
  Zap,
  Sparkles,
  Wand2,
  FileText,
  Loader2,
  Square,
  Replace,
  Plus,
  X,
  Eye,
  EyeOff,
  Heading1,
  Heading2,
  Heading3,
  Minus,
  Link,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import type { Setting, SettingCategory, SettingInjectionMode, SettingPriority, SettingAIAction, GlobalConfig, AIProvider } from '@/types'
import type { StreamChunk } from '@/lib/ai/types'
import { runSettingAssistant, getAssistantProviderName } from '@/lib/ai/setting-assistant'
import { getAvailableModels } from '@/lib/ai'
import { updateGlobalConfig } from '@/lib/db'
import { SETTING_TEMPLATES, templateFieldsToMarkdown } from '@/lib/setting-templates'

// 设定编辑 Dialog（居中浮动窗）
export function SettingEditorSheet({
  open,
  onOpenChange,
  editingSetting,
  categoryLabel,
  categoryDescription,
  formName,
  setFormName,
  formContent,
  setFormContent,
  formParentId,
  setFormParentId,
  formInjectionMode,
  setFormInjectionMode,
  formPriority,
  setFormPriority,
  formKeywords,
  setFormKeywords,
  formSummary,
  setFormSummary,
  activeTab,
  settings,
  globalConfig,
  onGlobalConfigChange,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingSetting: Setting | null
  categoryLabel: string | undefined
  categoryDescription: string | undefined
  formName: string
  setFormName: (name: string) => void
  formContent: string
  setFormContent: (content: string) => void
  formParentId: string | null
  setFormParentId: (id: string | null) => void
  formInjectionMode: SettingInjectionMode
  setFormInjectionMode: (mode: SettingInjectionMode) => void
  formPriority: SettingPriority
  setFormPriority: (priority: SettingPriority) => void
  formKeywords: string
  setFormKeywords: (keywords: string) => void
  formSummary: string
  setFormSummary: (summary: string) => void
  activeTab: SettingCategory
  settings: Setting[]
  globalConfig: GlobalConfig | null
  onGlobalConfigChange?: (config: GlobalConfig) => void
  onSave: () => void
}) {
  const contentInputRef = useRef<HTMLTextAreaElement>(null)

  // AI 助手状态
  const [aiLoading, setAiLoading] = useState(false)
  const [aiAction, setAiAction] = useState<SettingAIAction | null>(null)
  const [aiResult, setAiResult] = useState('')
  const abortControllerRef = useRef<AbortController | null>(null)
  const [previewMode, setPreviewMode] = useState(false)

  // 模板选择状态
  const [useTemplate, setUseTemplate] = useState(false)
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({})
  const currentTemplate = SETTING_TEMPLATES[activeTab]

  // 退出确认状态
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)

  const hasUnsavedChanges = useMemo(() => {
    if (editingSetting) {
      return formName !== editingSetting.name || formContent !== editingSetting.content
    }
    return formName.trim() !== '' || formContent.trim() !== ''
  }, [formName, formContent, editingSetting])

  const handleClose = useCallback((nextOpen: boolean) => {
    if (!nextOpen && hasUnsavedChanges) {
      setShowCloseConfirm(true)
      return
    }
    onOpenChange(nextOpen)
  }, [hasUnsavedChanges, onOpenChange])

  const confirmClose = useCallback(() => {
    setShowCloseConfirm(false)
    onOpenChange(false)
  }, [onOpenChange])

  const providerName = globalConfig ? getAssistantProviderName(globalConfig) : null

  // AI 助手内联配置状态
  const [configProvider, setConfigProvider] = useState<AIProvider | ''>('')
  const [configModel, setConfigModel] = useState('')
  const [configSaving, setConfigSaving] = useState(false)

  // 可用的模型（按提供商分组）
  const availableModels = useMemo(() => {
    if (!globalConfig) return []
    return getAvailableModels(globalConfig)
  }, [globalConfig])

  const availableProviders = useMemo(() => {
    const providers = new Map<AIProvider, string>()
    for (const m of availableModels) {
      if (!providers.has(m.provider)) {
        const names: Record<AIProvider, string> = { gemini: 'Google Gemini', openai: 'OpenAI', claude: 'Claude' }
        providers.set(m.provider, names[m.provider])
      }
    }
    return Array.from(providers.entries())
  }, [availableModels])

  const modelsForSelectedProvider = useMemo(() => {
    if (!configProvider) return []
    return availableModels.filter(m => m.provider === configProvider)
  }, [availableModels, configProvider])

  // 保存 AI 助手配置
  const handleSaveAssistantConfig = useCallback(async () => {
    if (!configProvider || !configModel) return
    setConfigSaving(true)
    try {
      await updateGlobalConfig({ setting_assistant: { provider: configProvider as AIProvider, model: configModel } })
      const updatedConfig = { ...globalConfig!, setting_assistant: { provider: configProvider as AIProvider, model: configModel } }
      onGlobalConfigChange?.(updatedConfig)
      toast.success('AI 助手已配置')
      setConfigProvider('')
      setConfigModel('')
    } catch {
      toast.error('配置保存失败')
    } finally {
      setConfigSaving(false)
    }
  }, [configProvider, configModel, globalConfig, onGlobalConfigChange])

  // 字数统计
  const wordStats = useMemo(() => {
    const text = formContent
    const charCount = text.length
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0
    const tokenEstimate = Math.ceil(charCount * 0.6)
    return { charCount, wordCount, tokenEstimate }
  }, [formContent])

  // 调用 AI 助手
  const handleAIAction = useCallback(async (action: SettingAIAction) => {
    if (!globalConfig) {
      toast.error('未加载全局配置')
      return
    }
    if (!providerName) {
      toast.error('未配置可用的 AI 提供商，请在全局设置中配置并启用至少一个 AI 服务')
      return
    }
    if (action !== 'generate' && !formContent.trim()) {
      toast.error('请先输入内容')
      return
    }
    if (!formName.trim()) {
      toast.error('请先输入名称')
      return
    }

    const controller = new AbortController()
    abortControllerRef.current = controller
    setAiLoading(true)
    setAiAction(action)
    setAiResult('')

    // 收集同分类其他设定作为上下文
    const contextSettings = settings
      .filter(s => s.category === activeTab && s.id !== editingSetting?.id && s.enabled)
      .slice(0, 5)
      .map(s => ({ name: s.name, content: s.content }))

    try {
      await runSettingAssistant({
        action,
        name: formName.trim(),
        category: activeTab,
        content: formContent.trim(),
        contextSettings,
        globalConfig,
        signal: controller.signal,
        onChunk: (chunk: StreamChunk) => {
          if (chunk.content) {
            setAiResult(prev => prev + chunk.content)
          }
        },
      })
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        // 用户主动取消
      } else {
        const msg = error instanceof Error ? error.message : '未知错误'
        toast.error(`AI 助手出错: ${msg}`)
      }
    } finally {
      setAiLoading(false)
      abortControllerRef.current = null
    }
  }, [globalConfig, providerName, formContent, formName, settings, activeTab, editingSetting])

  // 取消 AI 调用
  const handleAICancel = useCallback(() => {
    abortControllerRef.current?.abort()
    setAiLoading(false)
    setAiAction(null)
    setAiResult('')
  }, [])

  // 采纳 AI 结果 - 替换
  const handleAIReplace = useCallback(() => {
    if (aiAction === 'summarize') {
      setFormSummary(aiResult)
      toast.success('摘要已更新')
    } else {
      setFormContent(aiResult)
      toast.success('内容已替换')
    }
    setAiAction(null)
    setAiResult('')
  }, [aiResult, aiAction, setFormContent, setFormSummary])

  // 采纳 AI 结果 - 追加
  const handleAIAppend = useCallback(() => {
    if (aiAction === 'summarize') {
      setFormSummary(formSummary ? formSummary + '\n' + aiResult : aiResult)
      toast.success('摘要已追加')
    } else {
      setFormContent(formContent ? formContent + '\n\n' + aiResult : aiResult)
      toast.success('内容已追加')
    }
    setAiAction(null)
    setAiResult('')
  }, [aiResult, aiAction, formContent, formSummary, setFormContent, setFormSummary])

  // 关闭 AI 结果
  const handleAIDismiss = useCallback(() => {
    setAiAction(null)
    setAiResult('')
  }, [])

  // 插入 Markdown 格式
  const insertFormat = (start: string, end: string = '') => {
    if (!contentInputRef.current) return
    const input = contentInputRef.current
    const startPos = input.selectionStart
    const endPos = input.selectionEnd
    const text = formContent
    const selectedText = text.substring(startPos, endPos)
    const replacement = `${start}${selectedText}${end}`
    const newText = text.substring(0, startPos) + replacement + text.substring(endPos)
    setFormContent(newText)
    setTimeout(() => {
      input.focus()
      input.setSelectionRange(startPos + start.length, endPos + start.length)
    }, 0)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="w-[92vw] h-[88vh] max-w-[1400px] sm:max-w-[1400px] flex flex-col p-0 gap-0"
        showCloseButton={false}
        onInteractOutside={(e) => {
          if (hasUnsavedChanges) {
            e.preventDefault()
            setShowCloseConfirm(true)
          }
        }}
        onEscapeKeyDown={(e) => {
          if (hasUnsavedChanges) {
            e.preventDefault()
            setShowCloseConfirm(true)
          }
        }}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>
            {editingSetting ? '编辑设定' : `添加${categoryLabel}`}
          </DialogTitle>
          <DialogDescription>
            {categoryDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 min-h-full">
            {/* 左列: 基础信息 + 注入设置 */}
            <div className="space-y-4 flex flex-col">
              <div className="space-y-2">
                <Label htmlFor="setting-name">名称</Label>
                <Input
                  id="setting-name"
                  placeholder="输入名称..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  autoComplete="off"
                />
              </div>

              {/* 父设定选择 */}
              <div className="space-y-2">
                <Label htmlFor="setting-parent">父设定（可选）</Label>
                <select
                  id="setting-parent"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formParentId ?? ''}
                  onChange={(e) => setFormParentId(e.target.value || null)}
                >
                  <option value="">无（根级设定）</option>
                  {settings
                    .filter((s) => {
                      if (s.category !== activeTab) return false
                      if (!editingSetting) return true
                      const descendants = new Set<string>()
                      function collectDesc(parentId: string) {
                        descendants.add(parentId)
                        settings.filter(c => c.parent_id === parentId).forEach(c => collectDesc(c.id))
                      }
                      collectDesc(editingSetting.id)
                      return !descendants.has(s.id)
                    })
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.parent_id ? '  \u2514 ' : ''}{s.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* 模板选择 (仅新建且有模板时显示) */}
              {!editingSetting && currentTemplate && (
                <div className="space-y-2 rounded-lg border p-3 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">{currentTemplate.label}</Label>
                    <Button
                      variant={useTemplate ? 'secondary' : 'outline'}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setUseTemplate(!useTemplate)
                        if (!useTemplate) setTemplateValues({})
                      }}
                    >
                      {useTemplate ? '切换为自由编写' : '从模板开始'}
                    </Button>
                  </div>
                  {useTemplate && (
                    <div className="space-y-3 pt-1">
                      <p className="text-[11px] text-muted-foreground">{currentTemplate.description}</p>
                      {currentTemplate.fields.map(field => (
                        <div key={field.key} className="space-y-1">
                          <Label className="text-xs">{field.label}</Label>
                          {field.type === 'textarea' ? (
                            <Textarea
                              placeholder={field.placeholder}
                              className="min-h-[60px] resize-none text-xs bg-background"
                              value={templateValues[field.key] || ''}
                              onChange={e => setTemplateValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                            />
                          ) : (
                            <Input
                              placeholder={field.placeholder}
                              className="h-8 text-xs bg-background"
                              value={templateValues[field.key] || ''}
                              onChange={e => setTemplateValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                              autoComplete="off"
                            />
                          )}
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-8 text-xs"
                        onClick={() => {
                          const md = templateFieldsToMarkdown(currentTemplate.fields, templateValues)
                          if (md) {
                            setFormContent(md)
                            toast.success('模板内容已生成到编辑区')
                          } else {
                            toast.error('请至少填写一个字段')
                          }
                        }}
                      >
                        <FileText className="mr-1.5 h-3 w-3" />
                        生成到编辑区
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* 注入设置 */}
              <div className="space-y-3 rounded-lg border p-3 bg-muted/20 flex-1 flex flex-col">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-blue-500" />
                      <Label className="text-sm font-medium">自动注入</Label>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      开启后，此设定会自动注入到所有 AI 节点
                    </p>
                  </div>
                  <Switch
                    checked={formInjectionMode === 'auto'}
                    onCheckedChange={(checked) => setFormInjectionMode(checked ? 'auto' : 'manual')}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">优先级</Label>
                  <Select value={formPriority} onValueChange={(v) => setFormPriority(v as SettingPriority)}>
                    <SelectTrigger className="h-8 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive" className="h-4 px-1 text-[10px]">高</Badge>
                          <span>优先注入</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="medium">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="h-4 px-1 text-[10px]">中</Badge>
                          <span>默认</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="low">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="h-4 px-1 text-[10px]">低</Badge>
                          <span>可省略</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="setting-keywords" className="text-xs">关键词（逗号分隔，可选）</Label>
                  <Input
                    id="setting-keywords"
                    placeholder="如：武侠,江湖,侠客"
                    className="h-8 bg-background"
                    value={formKeywords}
                    onChange={(e) => setFormKeywords(e.target.value)}
                    autoComplete="off"
                  />
                  <p className="text-[10px] text-muted-foreground">用于未来的智能关键词匹配注入</p>
                </div>

                <div className="space-y-1.5 flex-1 flex flex-col">
                  <Label htmlFor="setting-summary" className="text-xs">摘要（可选）</Label>
                  <Textarea
                    id="setting-summary"
                    placeholder="简短概要，当 token 预算不足时替代完整内容..."
                    className="flex-1 min-h-[60px] resize-none text-xs bg-background"
                    value={formSummary}
                    onChange={(e) => setFormSummary(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* 右列: 内容编辑器 + AI 助手 */}
            <div className="space-y-4 flex flex-col">
              {/* AI 助手 */}
              {providerName ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                      <Label className="text-sm font-medium">AI 助手</Label>
                      <Badge variant="outline" className="h-4 px-1.5 text-[9px]">{providerName}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      disabled={aiLoading}
                      onClick={() => handleAIAction('expand')}
                    >
                      <Wand2 className="mr-1.5 h-3 w-3" />
                      AI 扩展
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      disabled={aiLoading}
                      onClick={() => handleAIAction('generate')}
                    >
                      <Sparkles className="mr-1.5 h-3 w-3" />
                      AI 生成
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      disabled={aiLoading}
                      onClick={() => handleAIAction('summarize')}
                    >
                      <FileText className="mr-1.5 h-3 w-3" />
                      AI 总结
                    </Button>
                  </div>
                </div>
              ) : availableProviders.length > 0 ? (
                <div className="rounded-lg border border-dashed p-3 bg-muted/10 space-y-2.5">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                    <Label className="text-sm font-medium">配置 AI 助手</Label>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    选择用于设定扩展、生成和总结的 AI 模型
                  </p>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label className="text-[11px] text-muted-foreground">提供商</Label>
                      <Select value={configProvider} onValueChange={(v) => { setConfigProvider(v as AIProvider); setConfigModel('') }}>
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue placeholder="选择提供商" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableProviders.map(([provider, name]) => (
                            <SelectItem key={provider} value={provider}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-[11px] text-muted-foreground">模型</Label>
                      <Select value={configModel} onValueChange={setConfigModel} disabled={!configProvider}>
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue placeholder={configProvider ? '选择模型' : '先选择提供商'} />
                        </SelectTrigger>
                        <SelectContent>
                          {modelsForSelectedProvider.map(m => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      size="sm"
                      className="h-8 text-xs shrink-0"
                      disabled={!configProvider || !configModel || configSaving}
                      onClick={handleSaveAssistantConfig}
                    >
                      {configSaving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
                      启用
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-3 bg-muted/10">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-sm font-medium text-muted-foreground">AI 助手</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    尚未配置 AI 服务。请前往「全局设置 → AI 服务」配置并启用至少一个提供商，即可使用 AI 扩展、生成和总结功能。
                  </p>
                </div>
              )}

              {/* AI 结果预览 */}
              {(aiLoading || aiResult) && (
                <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {aiLoading ? (
                        <Loader2 className="h-3.5 w-3.5 text-violet-500 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                      )}
                      <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
                        {aiLoading
                          ? `正在${aiAction === 'expand' ? '扩展' : aiAction === 'generate' ? '生成' : '总结'}...`
                          : `${aiAction === 'expand' ? '扩展' : aiAction === 'generate' ? '生成' : '总结'}完成`}
                      </span>
                    </div>
                    {aiLoading ? (
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleAICancel}>
                        <Square className="mr-1 h-3 w-3" />
                        停止
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleAIDismiss}>
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="max-h-[200px] overflow-y-auto rounded bg-background/80 p-2">
                    <pre className="whitespace-pre-wrap text-xs font-mono text-foreground">
                      {aiResult || '等待响应...'}
                    </pre>
                  </div>
                  {!aiLoading && aiResult && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="h-7 text-xs flex-1"
                        onClick={handleAIReplace}
                      >
                        <Replace className="mr-1 h-3 w-3" />
                        {aiAction === 'summarize' ? '更新摘要' : '替换内容'}
                      </Button>
                      {aiAction !== 'summarize' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs flex-1"
                          onClick={handleAIAppend}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          追加到末尾
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={handleAIDismiss}
                      >
                        忽略
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="setting-content">内容</Label>
                    <Button
                      variant={previewMode ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-6 px-2 text-xs gap-1"
                      onClick={() => setPreviewMode(!previewMode)}
                    >
                      {previewMode ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {previewMode ? '编辑' : '预览'}
                    </Button>
                  </div>
                  {/* Markdown Toolbar */}
                  {!previewMode && (
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => insertFormat('# ')} title="标题 1">
                        <Heading1 className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => insertFormat('## ')} title="标题 2">
                        <Heading2 className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => insertFormat('### ')} title="标题 3">
                        <Heading3 className="h-3 w-3" />
                      </Button>
                      <div className="mx-0.5 h-4 w-px bg-border" />
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => insertFormat('**', '**')} title="粗体">
                        <Bold className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => insertFormat('*', '*')} title="斜体">
                        <Italic className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => insertFormat('`', '`')} title="代码">
                        <Code className="h-3 w-3" />
                      </Button>
                      <div className="mx-0.5 h-4 w-px bg-border" />
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => insertFormat('- ')} title="列表">
                        <List className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => insertFormat('> ')} title="引用">
                        <Quote className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => insertFormat('---\n')} title="水平线">
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => insertFormat('[', '](url)')} title="链接">
                        <Link className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                {previewMode ? (
                  <div className="min-h-[300px] flex-1 rounded-md border bg-background p-4 prose prose-sm dark:prose-invert max-w-none overflow-y-auto">
                    {formContent ? (
                      <div
                        className="whitespace-pre-wrap text-sm"
                        dangerouslySetInnerHTML={{
                          __html: formContent
                            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
                            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
                            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/\*(.*?)\*/g, '<em>$1</em>')
                            .replace(/`(.*?)`/g, '<code class="bg-muted px-1 rounded text-xs">$1</code>')
                            .replace(/^> (.*$)/gm, '<blockquote class="border-l-2 border-muted-foreground/30 pl-3 text-muted-foreground">$1</blockquote>')
                            .replace(/^- (.*$)/gm, '<li>$1</li>')
                            .replace(/^---$/gm, '<hr class="border-border" />')
                            .replace(/\n/g, '<br />')
                        }}
                      />
                    ) : (
                      <p className="text-muted-foreground">暂无内容</p>
                    )}
                  </div>
                ) : (
                  <Textarea
                    ref={contentInputRef}
                    id="setting-content"
                    placeholder="输入详细内容... (支持 Markdown)"
                    className="min-h-[300px] flex-1 resize-none font-mono text-sm"
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Tab') {
                        e.preventDefault()
                        const ta = e.currentTarget
                        const start = ta.selectionStart
                        const end = ta.selectionEnd
                        const newVal = formContent.substring(0, start) + '  ' + formContent.substring(end)
                        setFormContent(newVal)
                        setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 2 }, 0)
                      }
                    }}
                  />
                )}
                {/* 字数统计 */}
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>{wordStats.charCount} 字符</span>
                  <span>~{wordStats.tokenEstimate} tokens</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={() => handleClose(false)}>
            取消
          </Button>
          <Button onClick={onSave} disabled={aiLoading}>
            <Save className="mr-2 h-4 w-4" />
            保存
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认退出</AlertDialogTitle>
            <AlertDialogDescription>
              当前有未保存的内容，退出后将丢失。确定要退出吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续编辑</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClose}>确认退出</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}

// 预设模板风格
const PROMPT_PRESETS = {
  concise: `{{#if has_items}}以下是{{category_name}}设定（共{{count}}条）：\n{{#each items}}\n- {{name}}: {{content}}\n{{/each}}{{/if}}`,
  detailed: `{{#if has_items}}=== {{category_name}}设定 ===\n共 {{count}} 条设定供参考：\n\n{{#each items}}\n【{{name}}】\n{{content}}\n\n---\n{{/each}}{{/if}}`,
  roleplay: `{{#if has_items}}[系统设定 - {{category_name}}]\n请严格遵循以下 {{count}} 条设定：\n{{#each items}}\n[{{name}}]\n{{content}}\n{{/each}}\n请在后续回复中始终保持以上设定的一致性。{{/if}}`,
}

// 注入提示词编辑器 Dialog（居中浮动窗）
export function PromptEditorSheet({
  open,
  onOpenChange,
  promptTemplate,
  setPromptTemplate,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  promptTemplate: string
  setPromptTemplate: (template: string) => void
  onSave: () => void
}) {
  const promptInputRef = useRef<HTMLTextAreaElement>(null)

  // 插入变量到提示词
  const insertVariable = (variable: string) => {
    if (!promptInputRef.current) return
    const input = promptInputRef.current
    const startPos = input.selectionStart
    const endPos = input.selectionEnd
    const text = promptTemplate
    const newText = text.substring(0, startPos) + variable + text.substring(endPos)
    setPromptTemplate(newText)
    setTimeout(() => {
      input.focus()
      input.setSelectionRange(startPos + variable.length, startPos + variable.length)
    }, 0)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[90vw] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>编辑注入提示词模板</DialogTitle>
          <DialogDescription>
            配置 AI 节点中引用此分类设定时的提示词格式。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-2">
            <p className="font-medium">快速插入变量：</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="xs" onClick={() => insertVariable('{{#each items}}...{{/each}}')}>
                 遍历循环
              </Button>
              <Button variant="secondary" size="xs" onClick={() => insertVariable('{{name}}')}>
                 名称
              </Button>
              <Button variant="secondary" size="xs" onClick={() => insertVariable('{{content}}')}>
                 内容
              </Button>
              <Button variant="secondary" size="xs" onClick={() => insertVariable('{{count}}')}>
                 数量
              </Button>
              <Button variant="secondary" size="xs" onClick={() => insertVariable('{{category_name}}')}>
                 分类名
              </Button>
              <Button variant="secondary" size="xs" onClick={() => insertVariable('{{#if has_items}}...{{/if}}')}>
                 条件判断
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-sm">预设模板风格：</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setPromptTemplate(PROMPT_PRESETS.concise)}>
                简洁
              </Button>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setPromptTemplate(PROMPT_PRESETS.detailed)}>
                详细
              </Button>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setPromptTemplate(PROMPT_PRESETS.roleplay)}>
                角色扮演
              </Button>
            </div>
          </div>
          <div className="space-y-2 flex-1 flex flex-col">
            <Label htmlFor="prompt-template">提示词模板</Label>
            <Textarea
              ref={promptInputRef}
              id="prompt-template"
              placeholder="输入提示词模板..."
              className="flex-1 min-h-[300px] font-mono text-sm resize-none"
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
            />
          </div>
          <div className="rounded-lg border p-3 bg-muted/10">
             <Label className="mb-2 block text-xs text-muted-foreground">预览效果 (示例)</Label>
             <div className="text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-[100px] overflow-y-auto">
                {promptTemplate
                  .replace(/{{#if has_items}}([\s\S]*?){{\/if}}/g, '$1')
                  .replace(/{{#each items}}([\s\S]*?){{\/each}}/g, '$1\n$1')
                  .replace(/{{name}}/g, '示例设定名')
                  .replace(/{{content}}/g, '示例设定内容...')
                  .replace(/{{count}}/g, '3')
                  .replace(/{{category_name}}/g, '角色')}
             </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onSave}>
            <Save className="mr-2 h-4 w-4" />
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
