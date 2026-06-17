import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vitePlugin from 'render-proxy-tracer/dist/plugin/vite-plugin.js'

const tracerPlugin = vitePlugin.default

export default defineConfig({
  plugins: [vue(), tracerPlugin()]
})
