import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // 构建优化配置
  build: {
    // 启用代码分割
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        // 手动分割代码块，优化加载性能
        manualChunks: {
          // React 相关
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // UI 组件库
          'vendor-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-tabs',
            '@radix-ui/react-select',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-scroll-area',
          ],
          // 动画库
          'vendor-motion': ['framer-motion'],
          // AI SDK (较大的依赖)
          'vendor-ai': ['ai'],
          // 工具库
          'vendor-utils': ['zustand', 'clsx', 'tailwind-merge', 'sonner'],
        },
      },
    },
    // 压缩配置
    minify: 'esbuild',
    // 生成 sourcemap 便于调试(生产环境可设为 false)
    sourcemap: false,
    // 移除 console 和 debugger
    esbuild: {
      drop: ['console', 'debugger'],
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}))
