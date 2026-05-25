import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'node:path'
import ReactInspector from 'vite-plugin-react-inspector'

// React Inspector 在 pnpm 下的硬编码 /node_modules 路径会 404，改写为 Vite 可服务的绝对文件路径。
const reactInspectorInjectPath = `/@fs/${resolve('node_modules/vite-plugin-react-inspector/src/inject.jsx')}`

export default defineConfig(({ command }) => {
  if (command === 'serve' && !process.env.REACT_EDITOR) {
    process.env.REACT_EDITOR = 'code'
  }

  return {
    main: {
      plugins: [externalizeDepsPlugin()]
    },
    preload: {
      plugins: [externalizeDepsPlugin()]
    },
    renderer: {
      resolve: {
        alias: {
          '@renderer': resolve('src/renderer/src')
        }
      },
      plugins: [
        command === 'serve' && ReactInspector(),
        command === 'serve' && {
          name: 'react-inspector-pnpm-path-fix',
          transformIndexHtml: (html) =>
            html.replace('/node_modules/vite-plugin-react-inspector/src/inject.jsx', reactInspectorInjectPath)
        },
        react(),
        tailwindcss()
      ]
    }
  }
})
