import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import { normalizePath } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import path from 'path' 

const pdfjsDistPath = path.resolve('node_modules/react-pdf/node_modules/pdfjs-dist')

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [
      react(),
      viteStaticCopy({
        targets: [
          {
            src: normalizePath(path.join(pdfjsDistPath, 'build/pdf.worker.min.mjs')),
            dest: ''
          }
        ]
      })
    ]
  }
})