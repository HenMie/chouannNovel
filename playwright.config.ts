import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E 测试配置
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // 测试目录
  testDir: './e2e',
  
  // 每个测试的超时时间
  timeout: 30 * 1000,
  
  // 断言超时
  expect: {
    timeout: 5000
  },
  
  // 完整的测试运行报告
  fullyParallel: true,
  
  // CI 环境下失败时不重试
  forbidOnly: !!process.env.CI,
  
  // 重试次数
  retries: process.env.CI ? 2 : 0,
  
  // 并发工作线程数
  workers: process.env.CI ? 1 : undefined,
  
  // 报告器配置
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],
  
  // 全局配置
  use: {
    // 基础 URL
    baseURL: 'http://localhost:1420',
    
    // 收集失败测试的 trace
    trace: 'on-first-retry',
    
    // 截图策略：仅失败时截图
    screenshot: 'only-on-failure',
    
    // 视频录制策略
    video: 'on-first-retry',
    
    // 动作超时
    actionTimeout: 10000,
    
    // 导航超时
    navigationTimeout: 15000,
  },

  // 项目配置（不同浏览器）
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // 如需要可启用其他浏览器
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // 开发服务器配置
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})

