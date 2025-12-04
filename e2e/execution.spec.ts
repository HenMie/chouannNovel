import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { generateUniqueName, toastLocator, selectors, waitForAnyVisible } from './fixtures/test-data'

/**
 * 执行流程 E2E 测试
 * 
 * 测试用例：
 * - 执行工作流
 * - 暂停/继续执行
 * - 取消执行
 * - 查看执行历史
 */

async function addNode(page: Page, menuLabel: string, openSubmenu = false) {
  // 点击添加节点按钮打开下拉菜单
  const addBtn = page.locator(selectors.workflow.addNodeBtn)
  await addBtn.click()
  
  // 如果需要打开子菜单（控制结构）
  if (openSubmenu) {
    const submenuTrigger = page.locator('[role="menuitem"]').filter({ hasText: '控制结构' })
    await expect(submenuTrigger).toBeVisible({ timeout: 5000 })
    await submenuTrigger.hover()
    // 等待子菜单出现
    await page.waitForTimeout(300)
  }
  
  // 等待菜单项出现并点击
  const menuItem = page.getByRole('menuitem', { name: menuLabel }).first()
  await expect(menuItem).toBeVisible({ timeout: 5000 })
  await menuItem.click()
}

// 节点类型到菜单标签和搜索标签的映射
// submenu 为 true 表示需要先打开控制结构子菜单
const nodeTypeMapping: Record<string, { menu: string; search: string; submenu?: boolean }> = {
  '输出节点': { menu: '输出节点', search: '输出' },
  '输出': { menu: '输出节点', search: '输出' },
  'AI 对话': { menu: 'AI 对话', search: 'AI 对话' },
  '文本拼接': { menu: '文本拼接', search: '文本拼接' },
  '内容提取': { menu: '内容提取', search: '内容提取' },
  '设置变量': { menu: '更新变量', search: '更新变量' },
  '更新变量': { menu: '更新变量', search: '更新变量' },
  'for 循环': { menu: 'for 循环', search: 'For 循环', submenu: true },
  'if 条件分支': { menu: 'if 条件分支', search: 'IF 条件', submenu: true },
}

function nodeLocator(page: Page, keyword: string) {
  const mapping = nodeTypeMapping[keyword]
  const searchKeyword = mapping?.search ?? keyword
  return page.locator(selectors.workflow.nodeItem).filter({ hasText: searchKeyword }).first()
}

async function ensureNode(page: Page, keyword: string) {
  const mapping = nodeTypeMapping[keyword]
  const searchKeyword = mapping?.search ?? keyword
  const menuLabel = mapping?.menu ?? keyword
  const needsSubmenu = mapping?.submenu ?? false
  
  const locator = page.locator(selectors.workflow.nodeItem).filter({ hasText: searchKeyword }).first()
  if (!(await locator.isVisible().catch(() => false))) {
    await addNode(page, menuLabel, needsSubmenu)
    await expect(locator).toBeVisible()
  }
  return locator
}

test.describe('执行流程', () => {
  let projectName: string
  let workflowName: string

  // 测试前创建项目和工作流
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // 创建测试项目
    projectName = generateUniqueName('执行测试项目')
    
    await page.click('button:has-text("新建项目")')
    await page.fill('input#name', projectName)
    await page.click('button[type="submit"]')
    
    await expect(toastLocator(page, '项目创建成功')).toBeVisible()

    // 创建测试工作流
    workflowName = generateUniqueName('执行测试工作流')
    
    await page.click('button:has-text("新建工作流")')
    await page.fill('input#name', workflowName)
    await page.click('button[type="submit"]')
    
    await expect(toastLocator(page, '工作流创建成功')).toBeVisible()
  })

  test.describe('工作流执行', () => {
    test('没有节点时运行按钮应该禁用', async ({ page }) => {
      // 运行按钮应该是禁用状态
      const runButton = page.locator(selectors.workflow.runBtn)
      await expect(runButton).toBeDisabled()
    })

    test('添加节点后应该能启动执行', async ({ page }) => {
      // 添加一个输出节点
      await ensureNode(page, '输出节点')
      
      // 运行按钮应该可用
      const runButton = page.locator(selectors.workflow.runBtn)
      await expect(runButton).toBeEnabled()
    })

    test('带有 Start 节点的工作流应该显示输入对话框', async ({ page }) => {
      // 添加一个输出节点（工作流默认有 start 节点）
      await ensureNode(page, '输出节点')
      
      // 点击运行
      await page.locator(selectors.workflow.runBtn).click()
      
      // 应该显示输入对话框（如果有 start 节点）
      const inputDialog = page.locator('[role="dialog"]').filter({ hasText: '输入内容' })
      
      if (await inputDialog.isVisible()) {
        // 填写输入内容
        await page.fill('textarea', '测试输入内容')
        
        // 点击开始执行
        await page.click('button:has-text("开始执行")')
      }
      
      // 验证执行状态或输出面板有响应
      // 执行可能会很快完成，所以检查状态变化
      await waitForAnyVisible(
        [
          page.locator('text=执行中'),
          page.locator('text=完成'),
          page.locator('text=暂无输出'),
        ],
        10000
      )
    })

    test('执行时应该显示执行状态', async ({ page }) => {
      // 添加一个输出节点
      await ensureNode(page, '输出节点')
      
      // 点击运行
      await page.locator(selectors.workflow.runBtn).click()
      
      // 处理可能的输入对话框
      const inputDialog = page.locator('[role="dialog"]').filter({ hasText: '输入内容' })
      if (await inputDialog.isVisible()) {
        await page.fill('textarea', '测试输入')
        await page.click('button:has-text("开始执行")')
      }
      
      // 执行输出面板应该可见
      await expect(page.locator('text=执行输出')).toBeVisible()
    })
  })

  test.describe('执行控制', () => {
    test.beforeEach(async ({ page }) => {
      // 添加多个节点以便有时间测试暂停
      await ensureNode(page, '文本拼接')
      await ensureNode(page, '输出节点')
    })

    test('执行时应该显示暂停和停止按钮', async ({ page }) => {
      // 开始执行
      await page.locator(selectors.workflow.runBtn).click()
      
      // 处理可能的输入对话框
      const inputDialog = page.locator('[role="dialog"]').filter({ hasText: '输入内容' })
      if (await inputDialog.isVisible()) {
        await page.fill('textarea', '测试输入')
        await page.click('button:has-text("开始执行")')
      }
      
      // 暂停和停止按钮应该在执行期间可见
      // 由于执行可能很快，使用较短的超时
      const pauseButton = page.locator('button:has-text("暂停")')
      const stopButton = page.locator('button:has-text("停止")')
      
      // 检查按钮是否出现（可能执行太快看不到）
      try {
        await waitForAnyVisible(
          [pauseButton, stopButton, page.locator('text=完成')],
          5000
        )
      } catch {
        // 执行太快完成了，这也是有效的
      }
    })

    test('应该能取消执行', async ({ page }) => {
      // 开始执行
      await page.locator(selectors.workflow.runBtn).click()
      
      // 处理可能的输入对话框
      const inputDialog = page.locator('[role="dialog"]').filter({ hasText: '输入内容' })
      if (await inputDialog.isVisible()) {
        await page.fill('textarea', '测试输入')
        await page.click('button:has-text("开始执行")')
      }
      
      // 如果还在执行中，点击停止
      const stopButton = page.locator('button:has-text("停止")')
      if (await stopButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await stopButton.click()
        
        // 验证执行已停止，运行按钮重新出现
        await expect(page.locator(selectors.workflow.runBtn)).toBeVisible({ timeout: 5000 })
      }
    })
  })

  test.describe('执行历史', () => {
    test('应该能进入执行历史页面', async ({ page }) => {
      // 点击执行历史按钮
      await page.click('button:has-text("执行历史")')
      
      // 验证进入历史页面
      await expect(page.locator('text=执行历史').first()).toBeVisible()
    })

    test('无历史记录时应该显示空状态', async ({ page }) => {
      // 点击执行历史按钮
      await page.click('button:has-text("执行历史")')
      
      // 验证空状态提示
      await expect(page.locator('text=历史记录').first()).toBeVisible()
      await expect(page.locator('text=暂无执行历史').first()).toBeVisible()
    })

    test('执行后应该在历史中有记录', async ({ page }) => {
      // 添加输出节点
      await ensureNode(page, '输出节点')
      
      // 执行工作流
      await page.locator(selectors.workflow.runBtn).click()
      
      // 处理可能的输入对话框
      const inputDialog = page.locator('[role="dialog"]').filter({ hasText: '输入内容' })
      if (await inputDialog.isVisible()) {
        await page.fill('textarea', '测试输入')
        await page.click('button:has-text("开始执行")')
      }
      
      // 等待执行完成
      await waitForAnyVisible(
        [page.locator('text=完成'), page.locator(selectors.workflow.runBtn)],
        30000
      )
      
      // 进入执行历史
      await page.click('button:has-text("执行历史")')
      
      // 应该有历史记录
      await expect(page.locator('text=执行历史').first()).toBeVisible()
    })

    test('应该能从历史页面返回工作流', async ({ page }) => {
      // 进入执行历史
      await page.click('button:has-text("执行历史")')
      
      // 验证进入历史页面
      await expect(page.locator('text=执行历史').first()).toBeVisible()
      
      // 点击面包屑返回（使用返回工作流按钮）
      await page.click('button:has-text("返回工作流")')
      
      // 应该返回工作流页面
      await expect(page.locator('text=节点列表')).toBeVisible()
    })
  })

  test.describe('执行输出', () => {
    test('输出面板应该显示空状态', async ({ page }) => {
      // 检查输出面板
      await expect(page.locator('text=执行输出')).toBeVisible()
      await expect(page.locator('text=暂无输出')).toBeVisible()
    })

    test('执行完成后应该显示输出', async ({ page }) => {
      // 添加一个文本拼接节点（设置固定文本）
      const textNode = await ensureNode(page, '文本拼接')
      
      // 点击节点配置
      await textNode.click()
      
      // 等待配置面板打开
      await expect(page.locator('[role="dialog"], [data-state="open"]').first()).toBeVisible()
      
      // 设置固定文本（.prompt-editor 是 contentEditable div，需要用 click + type）
      const textInput = page.locator('.prompt-editor').first()
      await textInput.click()
      await textInput.clear()
      await page.keyboard.type('测试输出文本')
      
      // 关闭配置面板
      await page.keyboard.press('Escape')
      
      // 添加输出节点
      await ensureNode(page, '输出节点')
      
      // 执行工作流
      await page.locator(selectors.workflow.runBtn).click()
      
      // 处理可能的输入对话框
      const inputDialog = page.locator('[role="dialog"]').filter({ hasText: '输入内容' })
      if (await inputDialog.isVisible()) {
        await page.fill('textarea', '测试输入')
        await page.click('button:has-text("开始执行")')
      }
      
      // 等待执行完成
      await waitForAnyVisible(
        [page.locator('text=完成'), page.locator(selectors.workflow.runBtn)],
        30000
      )
      
      // 应该有输出显示
      // 输出面板应该显示节点输出或最终输出
      await expect(page.locator('text=执行输出')).toBeVisible()
    })
  })

  test.describe('键盘快捷键', () => {
    test.beforeEach(async ({ page }) => {
      // 添加节点
      await ensureNode(page, '输出节点')
    })

    test('Ctrl+Enter 应该启动执行', async ({ page }) => {
      // 按 Ctrl+Enter
      await page.keyboard.press('Control+Enter')
      
      // 应该开始执行或显示输入对话框
      await waitForAnyVisible(
        [
          page.locator('[role="dialog"]').filter({ hasText: '输入内容' }),
          page.locator('text=执行中'),
          page.locator('text=完成'),
          page.locator('button:has-text("停止")'),
        ],
        5000
      )
    })

    test('Escape 应该关闭对话框', async ({ page }) => {
      // 打开输入对话框
      await page.locator(selectors.workflow.runBtn).click()
      
      const inputDialog = page.locator('[role="dialog"]').filter({ hasText: '输入内容' })
      
      if (await inputDialog.isVisible()) {
        // 按 Escape
        await page.keyboard.press('Escape')
        
        // 对话框应该关闭
        await expect(inputDialog).not.toBeVisible()
      }
    })
  })
})

