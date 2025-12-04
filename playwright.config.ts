import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E 测试配置
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // 测试目录
  testDir: './e2e',
  
  // 每个测试的超时时间
  timeout: 60 * 1000,
  
  // 断言超时
  expect: {
    timeout: 10000
  },
  
  // 禁用并行执行以避免数据库并发问题
  // Tauri SQLite 数据库在并发写入时可能产生冲突
  fullyParallel: false,
  
  // CI 环境下失败时不重试
  forbidOnly: !!process.env.CI,
  
  // 重试次数
  retries: process.env.CI ? 2 : 1,
  
  // 串行执行测试（单线程）
  workers: 1,
  
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
    actionTimeout: 15000,
    
    // 导航超时
    navigationTimeout: 30000,
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
  // 注意：E2E 测试需要 Tauri 环境，请先启动 `npm run tauri dev`
  // 如果服务器已在运行，Playwright 会复用现有服务器
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1420',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
})

