import { useMemo } from 'react'
import { Users, Globe, Palette, FileText, Zap, Clock, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Setting, SettingCategory } from '@/types'

const CATEGORY_CONFIG: Array<{ key: SettingCategory; label: string; icon: React.ElementType; color: string }> = [
  { key: 'character', label: '角色', icon: Users, color: 'bg-blue-500' },
  { key: 'worldview', label: '世界观', icon: Globe, color: 'bg-green-500' },
  { key: 'style', label: '笔触风格', icon: Palette, color: 'bg-purple-500' },
  { key: 'outline', label: '大纲', icon: FileText, color: 'bg-orange-500' },
]

interface SettingsDashboardProps {
  settings: Setting[]
  onSelectSetting?: (id: string) => void
  onSwitchTab?: (tab: SettingCategory) => void
}

export function SettingsDashboard({ settings, onSelectSetting, onSwitchTab }: SettingsDashboardProps) {
  // 分类统计
  const categoryStats = useMemo(() => {
    return CATEGORY_CONFIG.map(cat => {
      const catSettings = settings.filter(s => s.category === cat.key)
      return {
        ...cat,
        total: catSettings.length,
        enabled: catSettings.filter(s => s.enabled).length,
        autoInject: catSettings.filter(s => s.injection_mode === 'auto').length,
      }
    })
  }, [settings])

  // 最近更新的设定 Top 10
  const recentSettings = useMemo(() => {
    return [...settings]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 10)
  }, [settings])

  // 注入模式分布
  const injectionStats = useMemo(() => {
    const auto = settings.filter(s => s.injection_mode === 'auto').length
    const manual = settings.length - auto
    return { auto, manual, total: settings.length }
  }, [settings])

  // 未使用/孤立设定 (没有子项、不是子项、且未被手动选择)
  const orphanSettings = useMemo(() => {
    const hasChildren = new Set(settings.filter(s => s.parent_id).map(s => s.parent_id!))
    return settings.filter(s =>
      !s.parent_id &&
      !hasChildren.has(s.id) &&
      s.injection_mode === 'manual' &&
      !s.enabled
    )
  }, [settings])

  // 相对时间格式
  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff/60000)}分钟前`
    if (diff < 86400000) return `${Math.floor(diff/3600000)}小时前`
    return `${Math.floor(diff/86400000)}天前`
  }

  const totalSettings = settings.length
  const totalEnabled = settings.filter(s => s.enabled).length

  return (
    <div className="space-y-6">
      {/* 总览卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {categoryStats.map(stat => (
          <Card
            key={stat.key}
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => onSwitchTab?.(stat.key)}
          >
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', stat.color, 'bg-opacity-10')}>
                  <stat.icon className={cn('h-4 w-4', stat.color.replace('bg-', 'text-'))} />
                </div>
                <span className="text-2xl font-bold">{stat.total}</span>
              </div>
              <p className="text-sm font-medium">{stat.label}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-muted-foreground">{stat.enabled} 启用</span>
                {stat.autoInject > 0 && (
                  <Badge variant="secondary" className="h-4 px-1 text-[9px] gap-0.5">
                    <Zap className="h-2.5 w-2.5" />{stat.autoInject}
                  </Badge>
                )}
              </div>
              {/* 简单进度条 */}
              {stat.total > 0 && (
                <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', stat.color)}
                    style={{ width: `${(stat.enabled / stat.total) * 100}%` }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 注入模式分布 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">注入模式分布</CardTitle>
          </CardHeader>
          <CardContent>
            {injectionStats.total > 0 ? (
              <>
                <div className="flex h-4 rounded-full overflow-hidden bg-muted mb-3">
                  {injectionStats.auto > 0 && (
                    <div
                      className="bg-blue-500 transition-all"
                      style={{ width: `${(injectionStats.auto / injectionStats.total) * 100}%` }}
                      title={`自动注入: ${injectionStats.auto}`}
                    />
                  )}
                  <div
                    className="bg-gray-300 dark:bg-gray-600 transition-all"
                    style={{ width: `${(injectionStats.manual / injectionStats.total) * 100}%` }}
                    title={`手动注入: ${injectionStats.manual}`}
                  />
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    <span>自动注入 ({injectionStats.auto})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-gray-300 dark:bg-gray-600" />
                    <span>手动注入 ({injectionStats.manual})</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">暂无设定</p>
            )}
          </CardContent>
        </Card>

        {/* 总体统计 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">总体统计</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">总设定数</span>
                <span className="font-medium">{totalSettings}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">已启用</span>
                <span className="font-medium text-green-600">{totalEnabled}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">已禁用</span>
                <span className="font-medium text-muted-foreground">{totalSettings - totalEnabled}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">自动注入</span>
                <span className="font-medium text-blue-600">{injectionStats.auto}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 最近更新 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            最近更新
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentSettings.length > 0 ? (
            <div className="space-y-1">
              {recentSettings.map(setting => (
                <button
                  key={setting.id}
                  type="button"
                  className="w-full flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted transition-colors text-left"
                  onClick={() => {
                    onSwitchTab?.(setting.category)
                    setTimeout(() => onSelectSetting?.(setting.id), 100)
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn(
                      'h-1.5 w-1.5 rounded-full shrink-0',
                      setting.enabled ? 'bg-green-500' : 'bg-gray-300'
                    )} />
                    <span className="text-sm truncate">{setting.name}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0">
                      {CATEGORY_CONFIG.find(c => c.key === setting.category)?.label}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                    {formatTime(setting.updated_at)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">暂无设定</p>
          )}
        </CardContent>
      </Card>

      {/* 未使用设定提醒 */}
      {orphanSettings.length > 0 && (
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5 text-yellow-700 dark:text-yellow-400">
              <AlertCircle className="h-3.5 w-3.5" />
              可能需要关注的设定 ({orphanSettings.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">
              以下设定已禁用且未设为自动注入，可能被遗忘：
            </p>
            <div className="flex flex-wrap gap-1.5">
              {orphanSettings.slice(0, 10).map(s => (
                <Badge
                  key={s.id}
                  variant="outline"
                  className="text-xs cursor-pointer hover:bg-muted"
                  onClick={() => {
                    onSwitchTab?.(s.category)
                    setTimeout(() => onSelectSetting?.(s.id), 100)
                  }}
                >
                  {s.name}
                </Badge>
              ))}
              {orphanSettings.length > 10 && (
                <Badge variant="outline" className="text-xs">
                  +{orphanSettings.length - 10} 更多
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
