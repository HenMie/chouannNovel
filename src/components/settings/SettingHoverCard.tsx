import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { Badge } from '@/components/ui/badge'
import { Zap, Flag } from 'lucide-react'
import type { Setting } from '@/types'

interface SettingHoverCardProps {
  setting: Setting
  children: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
}

export function SettingHoverCard({ setting, children, side = 'top' }: SettingHoverCardProps) {
  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent side={side} className="w-72">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">{setting.name}</h4>
            <div className="flex items-center gap-1">
              {setting.injection_mode === 'auto' && (
                <Badge variant="secondary" className="h-4 px-1 text-[9px] gap-0.5">
                  <Zap className="h-2.5 w-2.5" />自动
                </Badge>
              )}
              {setting.priority === 'high' && (
                <Badge variant="destructive" className="h-4 px-1 text-[9px]">
                  <Flag className="h-2.5 w-2.5" />高
                </Badge>
              )}
            </div>
          </div>
          {setting.summary ? (
            <p className="text-xs text-muted-foreground">{setting.summary}</p>
          ) : (
            <p className="text-xs text-muted-foreground line-clamp-4">{setting.content}</p>
          )}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>{setting.content.length} 字</span>
            <span className={setting.enabled ? 'text-green-600' : 'text-muted-foreground'}>
              {setting.enabled ? '已启用' : '已禁用'}
            </span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
