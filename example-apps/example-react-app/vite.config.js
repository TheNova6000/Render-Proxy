import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import vitePlugin from 'render-proxy-tracer/dist/plugin/vite-plugin.js'

const tracerPlugin = vitePlugin.default

export default defineConfig({
  plugins: [react(), tracerPlugin()],
})
