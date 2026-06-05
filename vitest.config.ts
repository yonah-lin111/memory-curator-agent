import { configDefaults, defineConfig } from 'vitest/config'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@\/(.*)$/,
        replacement: '$1',
        customResolver(source, importer) {
          let res = ''
          if (importer && (importer.includes('/src/main/') || importer.includes('/test/main/'))) {
            res = resolve(process.cwd(), 'src/main', source)
          } else {
            res = resolve(process.cwd(), 'src/renderer/src', source)
          }
          
          for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.json']) {
            if (existsSync(res + ext)) {
              return res + ext
            }
          }
          for (const ext of ['/index.ts', '/index.tsx', '/index.js', '/index.jsx']) {
            if (existsSync(res + ext)) {
              return res + ext
            }
          }
          return res
        }
      }
    ]
  },
  test: {
    exclude: [...configDefaults.exclude, '.worktrees/**']
  }
})
