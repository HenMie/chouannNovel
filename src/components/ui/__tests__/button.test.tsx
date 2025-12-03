// Button 组件测试
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button, buttonVariants } from '../button'

describe('Button 组件', () => {
  // ========== 基础渲染测试 ==========
  describe('渲染', () => {
    it('应正确渲染按钮文本', () => {
      render(<Button>点击按钮</Button>)
      expect(screen.getByRole('button', { name: '点击按钮' })).toBeInTheDocument()
    })

    it('应渲染为 button 元素', () => {
      render(<Button>测试</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('应支持自定义 className', () => {
      render(<Button className="custom-class">测试</Button>)
      expect(screen.getByRole('button')).toHaveClass('custom-class')
    })

    it('应使用 asChild 渲染子元素', () => {
      render(
        <Button asChild>
          <a href="/test">链接按钮</a>
        </Button>
      )
      const link = screen.getByRole('link', { name: '链接按钮' })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/test')
    })
  })

  // ========== 点击事件测试 ==========
  describe('点击事件', () => {
    it('应触发点击事件', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>点击</Button>)
      
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('禁用状态下不应触发点击事件', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick} disabled>点击</Button>)
      
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  // ========== 禁用状态测试 ==========
  describe('禁用状态', () => {
    it('应正确设置 disabled 属性', () => {
      render(<Button disabled>禁用按钮</Button>)
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('禁用时应应用禁用样式', () => {
      render(<Button disabled>禁用按钮</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('disabled:pointer-events-none')
      expect(button).toHaveClass('disabled:opacity-50')
    })
  })

  // ========== variant 变体测试 ==========
  describe('variant 变体', () => {
    it('默认变体应用 default 样式', () => {
      render(<Button>默认按钮</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-primary')
    })

    it('destructive 变体应用危险样式', () => {
      render(<Button variant="destructive">删除</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-destructive')
    })

    it('outline 变体应用边框样式', () => {
      render(<Button variant="outline">边框按钮</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('border')
    })

    it('secondary 变体应用次要样式', () => {
      render(<Button variant="secondary">次要按钮</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-secondary')
    })

    it('ghost 变体应用幽灵样式', () => {
      render(<Button variant="ghost">幽灵按钮</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('hover:bg-accent')
    })

    it('link 变体应用链接样式', () => {
      render(<Button variant="link">链接按钮</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('underline-offset-4')
    })
  })

  // ========== size 尺寸测试 ==========
  describe('size 尺寸', () => {
    it('默认尺寸应用 h-9 样式', () => {
      render(<Button>默认尺寸</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('h-9')
    })

    it('xs 尺寸应用小样式', () => {
      render(<Button size="xs">超小按钮</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('h-6')
    })

    it('sm 尺寸应用小样式', () => {
      render(<Button size="sm">小按钮</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('h-8')
    })

    it('lg 尺寸应用大样式', () => {
      render(<Button size="lg">大按钮</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('h-10')
    })

    it('icon 尺寸应用图标样式', () => {
      render(<Button size="icon">🔍</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('size-9')
    })

    it('icon-sm 尺寸应用小图标样式', () => {
      render(<Button size="icon-sm">🔍</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('size-8')
    })
  })

  // ========== buttonVariants 工具函数测试 ==========
  describe('buttonVariants 工具函数', () => {
    it('应返回默认样式类名', () => {
      const classes = buttonVariants()
      expect(classes).toContain('inline-flex')
      expect(classes).toContain('items-center')
    })

    it('应返回指定 variant 的样式类名', () => {
      const classes = buttonVariants({ variant: 'destructive' })
      expect(classes).toContain('bg-destructive')
    })

    it('应返回指定 size 的样式类名', () => {
      const classes = buttonVariants({ size: 'lg' })
      expect(classes).toContain('h-10')
    })

    it('应合并自定义 className', () => {
      const classes = buttonVariants({ className: 'custom-class' })
      expect(classes).toContain('custom-class')
    })
  })

  // ========== 其他属性测试 ==========
  describe('其他属性', () => {
    it('应支持 type 属性', () => {
      render(<Button type="submit">提交</Button>)
      expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
    })

    it('应支持 aria-label 属性', () => {
      render(<Button aria-label="关闭">X</Button>)
      expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument()
    })

    it('应设置 data-slot 属性', () => {
      render(<Button>测试</Button>)
      expect(screen.getByRole('button')).toHaveAttribute('data-slot', 'button')
    })
  })
})

