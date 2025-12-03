// Tabs 组件测试
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../tabs'

// 基础 Tabs 测试组件
function BasicTabs({
  defaultValue = 'tab1',
  onValueChange,
}: {
  defaultValue?: string
  onValueChange?: (value: string) => void
}) {
  return (
    <Tabs defaultValue={defaultValue} onValueChange={onValueChange}>
      <TabsList>
        <TabsTrigger value="tab1">标签一</TabsTrigger>
        <TabsTrigger value="tab2">标签二</TabsTrigger>
        <TabsTrigger value="tab3">标签三</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">第一个标签页的内容</TabsContent>
      <TabsContent value="tab2">第二个标签页的内容</TabsContent>
      <TabsContent value="tab3">第三个标签页的内容</TabsContent>
    </Tabs>
  )
}

// 受控 Tabs 组件
function ControlledTabs() {
  const [value, setValue] = useState('tab1')
  return (
    <div>
      <span data-testid="current-tab">{value}</span>
      <Tabs value={value} onValueChange={setValue}>
        <TabsList>
          <TabsTrigger value="tab1">标签一</TabsTrigger>
          <TabsTrigger value="tab2">标签二</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">内容一</TabsContent>
        <TabsContent value="tab2">内容二</TabsContent>
      </Tabs>
    </div>
  )
}

// 带禁用标签的 Tabs
function TabsWithDisabled() {
  return (
    <Tabs defaultValue="tab1">
      <TabsList>
        <TabsTrigger value="tab1">可用标签</TabsTrigger>
        <TabsTrigger value="tab2" disabled>禁用标签</TabsTrigger>
        <TabsTrigger value="tab3">另一个可用标签</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">可用内容</TabsContent>
      <TabsContent value="tab2">禁用内容</TabsContent>
      <TabsContent value="tab3">另一个可用内容</TabsContent>
    </Tabs>
  )
}

describe('Tabs 组件', () => {
  // ========== 基础渲染测试 ==========
  describe('渲染', () => {
    it('应正确渲染标签列表', () => {
      render(<BasicTabs />)
      expect(screen.getByRole('tablist')).toBeInTheDocument()
    })

    it('应正确渲染所有标签触发器', () => {
      render(<BasicTabs />)
      expect(screen.getByRole('tab', { name: '标签一' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: '标签二' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: '标签三' })).toBeInTheDocument()
    })

    it('应正确渲染默认标签内容', () => {
      render(<BasicTabs defaultValue="tab1" />)
      expect(screen.getByText('第一个标签页的内容')).toBeInTheDocument()
    })

    it('应设置正确的 data-slot 属性', () => {
      render(<BasicTabs />)
      expect(document.querySelector('[data-slot="tabs"]')).toBeInTheDocument()
      expect(document.querySelector('[data-slot="tabs-list"]')).toBeInTheDocument()
      expect(document.querySelector('[data-slot="tabs-trigger"]')).toBeInTheDocument()
      expect(document.querySelector('[data-slot="tabs-content"]')).toBeInTheDocument()
    })

    it('应支持自定义 className', () => {
      render(
        <Tabs defaultValue="tab1" className="custom-tabs">
          <TabsList className="custom-list">
            <TabsTrigger value="tab1" className="custom-trigger">标签</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1" className="custom-content">内容</TabsContent>
        </Tabs>
      )
      expect(document.querySelector('.custom-tabs')).toBeInTheDocument()
      expect(document.querySelector('.custom-list')).toBeInTheDocument()
      expect(document.querySelector('.custom-trigger')).toBeInTheDocument()
      expect(document.querySelector('.custom-content')).toBeInTheDocument()
    })
  })

  // ========== 标签切换测试 ==========
  describe('标签切换', () => {
    it('点击标签应切换内容', async () => {
      const user = userEvent.setup()
      render(<BasicTabs />)
      
      // 初始显示第一个标签内容
      expect(screen.getByText('第一个标签页的内容')).toBeInTheDocument()
      
      // 点击第二个标签
      await user.click(screen.getByRole('tab', { name: '标签二' }))
      
      // 应显示第二个标签内容
      await waitFor(() => {
        expect(screen.getByText('第二个标签页的内容')).toBeInTheDocument()
      })
    })

    it('点击标签应更新激活状态', async () => {
      const user = userEvent.setup()
      render(<BasicTabs />)
      
      const tab1 = screen.getByRole('tab', { name: '标签一' })
      const tab2 = screen.getByRole('tab', { name: '标签二' })
      
      // 初始状态第一个标签激活
      expect(tab1).toHaveAttribute('aria-selected', 'true')
      expect(tab2).toHaveAttribute('aria-selected', 'false')
      
      // 点击第二个标签
      await user.click(tab2)
      
      // 第二个标签应该激活
      await waitFor(() => {
        expect(tab1).toHaveAttribute('aria-selected', 'false')
        expect(tab2).toHaveAttribute('aria-selected', 'true')
      })
    })

    it('应触发 onValueChange 回调', async () => {
      const handleValueChange = vi.fn()
      const user = userEvent.setup()
      
      render(<BasicTabs onValueChange={handleValueChange} />)
      
      await user.click(screen.getByRole('tab', { name: '标签二' }))
      
      expect(handleValueChange).toHaveBeenCalledWith('tab2')
    })

    it('切换到第三个标签应显示对应内容', async () => {
      const user = userEvent.setup()
      render(<BasicTabs />)
      
      await user.click(screen.getByRole('tab', { name: '标签三' }))
      
      await waitFor(() => {
        expect(screen.getByText('第三个标签页的内容')).toBeInTheDocument()
      })
    })
  })

  // ========== 受控模式测试 ==========
  describe('受控模式', () => {
    it('受控模式下应正确同步状态', async () => {
      const user = userEvent.setup()
      render(<ControlledTabs />)
      
      // 初始状态
      expect(screen.getByTestId('current-tab')).toHaveTextContent('tab1')
      
      // 切换标签
      await user.click(screen.getByRole('tab', { name: '标签二' }))
      
      await waitFor(() => {
        expect(screen.getByTestId('current-tab')).toHaveTextContent('tab2')
      })
    })

    it('受控模式下内容应随状态变化', async () => {
      const user = userEvent.setup()
      render(<ControlledTabs />)
      
      expect(screen.getByText('内容一')).toBeInTheDocument()
      
      await user.click(screen.getByRole('tab', { name: '标签二' }))
      
      await waitFor(() => {
        expect(screen.getByText('内容二')).toBeInTheDocument()
      })
    })
  })

  // ========== 禁用状态测试 ==========
  describe('禁用状态', () => {
    it('禁用的标签应显示禁用状态', () => {
      render(<TabsWithDisabled />)
      const disabledTab = screen.getByRole('tab', { name: '禁用标签' })
      expect(disabledTab).toBeDisabled()
    })

    it('点击禁用标签不应切换内容', async () => {
      const user = userEvent.setup()
      render(<TabsWithDisabled />)
      
      expect(screen.getByText('可用内容')).toBeInTheDocument()
      
      // 尝试点击禁用标签
      await user.click(screen.getByRole('tab', { name: '禁用标签' }))
      
      // 内容不应改变
      expect(screen.getByText('可用内容')).toBeInTheDocument()
      expect(screen.queryByText('禁用内容')).not.toBeInTheDocument()
    })
  })

  // ========== 键盘导航测试 ==========
  describe('键盘导航', () => {
    it('右箭头键应切换到下一个标签', async () => {
      const user = userEvent.setup()
      render(<BasicTabs />)
      
      const tab1 = screen.getByRole('tab', { name: '标签一' })
      tab1.focus()
      
      await user.keyboard('{ArrowRight}')
      
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: '标签二' })).toHaveFocus()
      })
    })

    it('左箭头键应切换到上一个标签', async () => {
      const user = userEvent.setup()
      render(<BasicTabs defaultValue="tab2" />)
      
      const tab2 = screen.getByRole('tab', { name: '标签二' })
      tab2.focus()
      
      await user.keyboard('{ArrowLeft}')
      
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: '标签一' })).toHaveFocus()
      })
    })

    it('Home 键应跳转到第一个标签', async () => {
      const user = userEvent.setup()
      render(<BasicTabs defaultValue="tab3" />)
      
      const tab3 = screen.getByRole('tab', { name: '标签三' })
      tab3.focus()
      
      await user.keyboard('{Home}')
      
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: '标签一' })).toHaveFocus()
      })
    })

    it('End 键应跳转到最后一个标签', async () => {
      const user = userEvent.setup()
      render(<BasicTabs />)
      
      const tab1 = screen.getByRole('tab', { name: '标签一' })
      tab1.focus()
      
      await user.keyboard('{End}')
      
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: '标签三' })).toHaveFocus()
      })
    })
  })

  // ========== 无障碍测试 ==========
  describe('无障碍', () => {
    it('标签列表应有 tablist role', () => {
      render(<BasicTabs />)
      expect(screen.getByRole('tablist')).toBeInTheDocument()
    })

    it('标签触发器应有 tab role', () => {
      render(<BasicTabs />)
      expect(screen.getAllByRole('tab')).toHaveLength(3)
    })

    it('标签内容应有 tabpanel role', () => {
      render(<BasicTabs />)
      expect(screen.getByRole('tabpanel')).toBeInTheDocument()
    })

    it('激活的标签应有 aria-selected=true', () => {
      render(<BasicTabs defaultValue="tab2" />)
      expect(screen.getByRole('tab', { name: '标签二' })).toHaveAttribute('aria-selected', 'true')
    })
  })

  // ========== 默认值测试 ==========
  describe('默认值', () => {
    it('应尊重 defaultValue 属性', () => {
      render(<BasicTabs defaultValue="tab2" />)
      expect(screen.getByText('第二个标签页的内容')).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: '标签二' })).toHaveAttribute('aria-selected', 'true')
    })

    it('defaultValue 为 tab3 时应显示第三个内容', () => {
      render(<BasicTabs defaultValue="tab3" />)
      expect(screen.getByText('第三个标签页的内容')).toBeInTheDocument()
    })
  })
})

