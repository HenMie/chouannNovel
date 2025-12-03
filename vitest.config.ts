/// <reference types="vitest" />
import path from "path"
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  
  test: {
    // 测试环境配置
    environment: "jsdom",
    
    // 全局设置文件
    setupFiles: ["./src/test/setup.ts"],
    
    // 全局 API（无需导入 describe, it, expect 等）
    globals: true,
    
    // 文件匹配模式
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "dist", "src-tauri"],
    
    // 覆盖率配置
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/lib/**/*.ts", "src/stores/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/test/**/*",
        "src/**/*.d.ts",
      ],
      // 覆盖率阈值
      thresholds: {
        // 全局阈值暂时禁用，后续按需启用
        // lines: 60,
        // functions: 60,
        // branches: 60,
        // statements: 60,
        // 核心模块阈值
        "src/lib/engine/context.ts": {
          lines: 90,
          functions: 90,
        },
      },
    },
    
    // 测试超时
    testTimeout: 10000,
    
    // Mock 清理策略
    clearMocks: true,
    restoreMocks: true,
  },
})

