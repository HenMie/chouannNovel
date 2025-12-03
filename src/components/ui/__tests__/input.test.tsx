// Input 组件测试
import * as React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '../input'

describe('Input 组件', () => {
  // ========== 基础渲染测试 ==========
  describe('渲染', () => {
    it('应正确渲染输入框', () => {
      render(<Input />)
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('应设置 data-slot 属性', () => {
      render(<Input />)
      expect(screen.getByRole('textbox')).toHaveAttribute('data-slot', 'input')
    })

    it('应支持自定义 className', () => {
      render(<Input className="custom-class" />)
      expect(screen.getByRole('textbox')).toHaveClass('custom-class')
    })

    it('应支持自定义 id', () => {
      render(<Input id="my-input" />)
      expect(screen.getByRole('textbox')).toHaveAttribute('id', 'my-input')
    })
  })

  // ========== type 属性测试 ==========
  describe('type 属性', () => {
    it('默认渲染为 textbox', () => {
      render(<Input />)
      // HTML input 默认类型为 text，但浏览器可能不设置 type 属性
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('应支持 password 类型', () => {
      render(<Input type="password" />)
      // password 类型没有 role="textbox"
      const input = document.querySelector('input[type="password"]')
      expect(input).toBeInTheDocument()
    })

    it('应支持 email 类型', () => {
      render(<Input type="email" />)
      expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email')
    })

    it('应支持 number 类型', () => {
      render(<Input type="number" />)
      expect(screen.getByRole('spinbutton')).toHaveAttribute('type', 'number')
    })
  })

  // ========== 输入变化测试 ==========
  describe('输入变化', () => {
    it('应触发 onChange 事件', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup()
      
      render(<Input onChange={handleChange} />)
      const input = screen.getByRole('textbox')
      
      await user.type(input, 'hello')
      expect(handleChange).toHaveBeenCalled()
    })

    it('应更新输入值', async () => {
      const user = userEvent.setup()
      
      render(<Input />)
      const input = screen.getByRole('textbox')
      
      await user.type(input, 'test value')
      expect(input).toHaveValue('test value')
    })

    it('受控模式下应正确更新值', () => {
      // 使用函数组件测试受控模式
      const { result } = { result: { current: '' } }
      
      const ControlledInput = () => {
        const [value, setValue] = React.useState('')
        result.current = value
        return (
          <Input 
            value={value} 
            onChange={(e) => setValue(e.target.value)} 
          />
        )
      }
      
      render(<ControlledInput />)
      const input = screen.getByRole('textbox')
      
      fireEvent.change(input, { target: { value: '新值' } })
      expect(input).toHaveValue('新值')
    })

    it('应触发 onFocus 事件', () => {
      const handleFocus = vi.fn()
      render(<Input onFocus={handleFocus} />)
      
      fireEvent.focus(screen.getByRole('textbox'))
      expect(handleFocus).toHaveBeenCalledTimes(1)
    })

    it('应触发 onBlur 事件', () => {
      const handleBlur = vi.fn()
      render(<Input onBlur={handleBlur} />)
      
      const input = screen.getByRole('textbox')
      fireEvent.focus(input)
      fireEvent.blur(input)
      expect(handleBlur).toHaveBeenCalledTimes(1)
    })
  })

  // ========== placeholder 测试 ==========
  describe('placeholder', () => {
    it('应正确显示 placeholder', () => {
      render(<Input placeholder="请输入内容" />)
      expect(screen.getByPlaceholderText('请输入内容')).toBeInTheDocument()
    })

    it('应支持中文 placeholder', () => {
      render(<Input placeholder="请输入用户名" />)
      expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', '请输入用户名')
    })
  })

  // ========== 禁用状态测试 ==========
  describe('禁用状态', () => {
    it('应正确设置 disabled 属性', () => {
      render(<Input disabled />)
      expect(screen.getByRole('textbox')).toBeDisabled()
    })

    it('禁用时应应用禁用样式', () => {
      render(<Input disabled />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('disabled:pointer-events-none')
      expect(input).toHaveClass('disabled:cursor-not-allowed')
      expect(input).toHaveClass('disabled:opacity-50')
    })

    it('禁用状态下不应触发输入事件', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup()
      
      render(<Input disabled onChange={handleChange} />)
      const input = screen.getByRole('textbox')
      
      await user.type(input, 'test')
      expect(handleChange).not.toHaveBeenCalled()
    })
  })

  // ========== 其他属性测试 ==========
  describe('其他属性', () => {
    it('应支持 name 属性', () => {
      render(<Input name="username" />)
      expect(screen.getByRole('textbox')).toHaveAttribute('name', 'username')
    })

    it('应支持 required 属性', () => {
      render(<Input required />)
      expect(screen.getByRole('textbox')).toBeRequired()
    })

    it('应支持 readOnly 属性', () => {
      render(<Input readOnly />)
      expect(screen.getByRole('textbox')).toHaveAttribute('readonly')
    })

    it('应支持 maxLength 属性', () => {
      render(<Input maxLength={10} />)
      expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '10')
    })

    it('应支持 aria-invalid 属性', () => {
      render(<Input aria-invalid="true" />)
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
    })

    it('应支持 autoComplete 属性', () => {
      render(<Input autoComplete="email" />)
      expect(screen.getByRole('textbox')).toHaveAttribute('autocomplete', 'email')
    })

    it('应支持 defaultValue', () => {
      render(<Input defaultValue="默认值" />)
      expect(screen.getByRole('textbox')).toHaveValue('默认值')
    })
  })

  // ========== 样式测试 ==========
  describe('样式', () => {
    it('应包含基础输入框样式', () => {
      render(<Input />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('border')
      expect(input).toHaveClass('rounded-md')
      expect(input).toHaveClass('h-9')
    })

    it('应包含聚焦样式类', () => {
      render(<Input />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('focus-visible:border-ring')
    })
  })
})

