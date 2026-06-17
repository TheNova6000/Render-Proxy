import type { Plugin } from 'vite'
import * as babel from '@babel/core'
import babelPlugin from './babel-trace-plugin'

const JS_EXTS = ['.js', '.jsx', '.ts', '.tsx', '.mjs']

function shouldTransform(id: string): boolean {
  const cleanId = id.split('?')[0]
  if (!JS_EXTS.some((ext) => cleanId.endsWith(ext))) return false
  if (id.includes('node_modules')) return false
  if (/render-proxy[-_]?tracer/.test(id)) return false
  if (/render-proxy[-_]?package/.test(id)) return false
  return true
}

export default function viteTracePlugin(): Plugin {
  return {
    name: 'vite-plugin-render-proxy-tracer',
    enforce: 'pre',
    async transform(code, id) {
      if (!shouldTransform(id)) return null

      if ((globalThis as Record<string, unknown>).__RPT_DEBUG__) {
        console.log('[render-proxy-tracer] transforming:', id)
      }

      try {
        const res = await babel.transformAsync(code, {
          filename: id,
          plugins: [babelPlugin],
          parserOpts: { sourceType: 'module', plugins: ['jsx', 'typescript'] },
          sourceMaps: true,
          configFile: false,
          babelrc: false
        })
        if (!res || !res.code) return null
        return { code: res.code, map: res.map as babel.BabelFileResult['map'] }
      } catch (err) {
        this.warn(`[render-proxy-tracer] skipping ${id.split(/[\\/]/).pop()}: ${err}`)
        return null
      }
    }
  }
}
