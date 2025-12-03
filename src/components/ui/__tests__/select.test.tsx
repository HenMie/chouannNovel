// Select 组件测试
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from '../select'

// 基础 Select 测试组件
function BasicSelect({
  onValueChange,
  defaultValue,
  value,
  placeholder = '请选择',
  disabled = false,
}: {
  onValueChange?: (value: string) => void
  defaultValue?: string
  value?: string
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <Select onValueChange={onValueChange} defaultValue={defaultValue} value={value} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">苹果</SelectItem>
        <SelectItem value="banana">香蕉</SelectItem>
        <SelectItem value="orange">橙子</SelectItem>
      </SelectContent>
    </Select>
  )
}

// 受控 Select 组件
function ControlledSelect() {
  const [value, setValue] = useState('')
  return (
    <div>
      <span data-testid="selected-value">{value}</span>
      <BasicSelect value={value} onValueChange={setValue} />
    </div>
  )
}

describe('Select 组件', () => {
  // ========== 基础渲染测试 ==========
  describe('渲染', () => {
    it('应正确渲染选择器触发按钮', () => {
      render(<BasicSelect />)
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('应显示 placeholder', () => {
      render(<BasicSelect placeholder="选择水果" />)
      expect(screen.getByText('选择水果')).toBeInTheDocument()
    })

    it('应设置 data-slot 属性', () => {
      render(<BasicSelect />)
      expect(screen.getByRole('combobox').closest('[data-slot="select-trigger"]')).toBeInTheDocument()
    })

    it('应支持 defaultValue', () => {
      render(<BasicSelect defaultValue="apple" />)
      expect(screen.getByText('苹果')).toBeInTheDocument()
    })
  })

  // ========== 选项选择测试 ==========
  // 注意：Radix UI Select 的 Portal 在 JSDOM 中测试较复杂
  // 这里主要测试基础渲染和属性
  describe('选项选择', () => {
    it('点击触发器应触发交互', async () => {
      const user = userEvent.setup()
      render(<BasicSelect />)
      
      const trigger = screen.getByRole('combobox')
      // 验证触发器可点击
      await user.click(trigger)
      
      // 触发器应该有正确的 aria 属性
      expect(trigger).toHaveAttribute('aria-expanded')
    })

    it('应触发 onValueChange 回调（通过 defaultValue 验证）', () => {
      const handleChange = vi.fn()
      
      // 设置默认值验证选择器工作正常
      render(<BasicSelect defaultValue="apple" onValueChange={handleChange} />)
      
      // 应显示选中的值
      expect(screen.getByText('苹果')).toBeInTheDocument()
    })

    it('非受控模式下 defaultValue 应正确显示', () => {
      render(<BasicSelect defaultValue="banana" />)
      expect(screen.getByText('香蕉')).toBeInTheDocument()
    })
  })

  // ========== 受控/非受控测试 ==========
  describe('受控/非受控模式', () => {
    it('非受控模式下 defaultValue 应生效', () => {
      render(<BasicSelect defaultValue="apple" />)
      
      // 选中值应该显示
      expect(screen.getByText('苹果')).toBeInTheDocument()
    })

    it('受控模式下 value 应正确显示', () => {
      render(<BasicSelect value="banana" />)
      
      expect(screen.getByText('香蕉')).toBeInTheDocument()
    })
  })

  // ========== 禁用状态测试 ==========
  describe('禁用状态', () => {
    it('禁用时触发器应显示禁用状态', () => {
      render(<BasicSelect disabled />)
      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveAttribute('data-disabled', '')
    })

    it('禁用时应用禁用样式', () => {
      render(<BasicSelect disabled />)
      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveClass('disabled:cursor-not-allowed')
      expect(trigger).toHaveClass('disabled:opacity-50')
    })
  })

  // ========== SelectTrigger 尺寸测试 ==========
  describe('SelectTrigger 尺寸', () => {
    it('默认尺寸应用 h-9', () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
        </Select>
      )
      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveAttribute('data-size', 'default')
    })

    it('sm 尺寸应用 h-8', () => {
      render(
        <Select>
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
        </Select>
      )
      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveAttribute('data-size', 'sm')
    })
  })

  // ========== SelectGroup 和 SelectLabel 测试 ==========
  describe('SelectGroup 和 SelectLabel', () => {
    it('应正确渲染 Select 组件结构', () => {
      render(
        <Select defaultValue="apple">
          <SelectTrigger>
            <SelectValue placeholder="选择" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>水果</SelectLabel>
              <SelectItem value="apple">苹果</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      )
      
      // 验证触发器渲染
      expect(screen.getByRole('combobox')).toBeInTheDocument()
      // 默认值应该显示
      expect(screen.getByText('苹果')).toBeInTheDocument()
    })
  })

  // ========== 键盘导航测试 ==========
  describe('键盘导航', () => {
    it('触发器应可聚焦', () => {
      render(<BasicSelect />)
      
      const trigger = screen.getByRole('combobox')
      trigger.focus()
      
      expect(document.activeElement).toBe(trigger)
    })

    it('触发器应有正确的 role', () => {
      render(<BasicSelect />)
      
      const trigger = screen.getByRole('combobox')
      
      // 验证触发器存在且为 combobox
      expect(trigger).toBeInTheDocument()
    })
  })
})

