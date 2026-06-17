import { defineConfig } from 'vite'
import vitePlugin from 'render-proxy-tracer/dist/plugin/vite-plugin.js'

const tracerPlugin = vitePlugin.default

export default defineConfig({
  plugins: [tracerPlugin()]
})
