import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

// Electron + React 渲染层。主进程/preload 走 vite-plugin-electron 单独打包。
export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // 主进程
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              // active-win / electron-store 走外部依赖,不打进 bundle
              external: ['active-win', 'electron-store', 'electron']
            }
          }
        }
      },
      {
        // preload
        entry: 'electron/preload.ts',
        onstart(args) {
          args.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: { external: ['electron'] },
            // package.json 是 "type": "module",插件默认把 preload 输出成 ESM。
            // Electron 渲染进程默认 sandbox,只能加载 CommonJS preload(ESM 会报
            // "Cannot use import statement outside a module",window.money 为 undefined),
            // 所以强制输出 CJS,并用 .cjs 后缀避免被 "type": "module" 当成 ESM。
            lib: { entry: 'electron/preload.ts', formats: ['cjs'], fileName: () => 'preload.cjs' }
          }
        }
      }
    ]),
    renderer()
  ],
  build: { outDir: 'dist' }
})
