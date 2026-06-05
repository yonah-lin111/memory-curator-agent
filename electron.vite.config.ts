import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { codeInspectorPlugin } from 'code-inspector-plugin'
import { resolve } from 'node:path'

export default defineConfig(() => {
  return {
    main: {
      resolve: {
        alias: {
          '@': resolve('src/main')
        }
      },
      plugins: [externalizeDepsPlugin()]
    },
    preload: {
      resolve: {
        alias: {
          '@': resolve('src/preload')
        }
      },
      plugins: [externalizeDepsPlugin()]
    },
    renderer: {
      resolve: {
        alias: {
          '@': resolve('src/renderer/src')
        }
      },
      plugins: [
        react(),
        tailwindcss(),
        codeInspectorPlugin({
          bundler: 'vite'
        })
      ]
    }
  }
})
