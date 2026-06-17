const fs = require('fs')
const path = require('path')
const babel = require('@babel/core')

const samplePath = path.resolve(__dirname, '../examples/Sample.jsx')
const code = fs.readFileSync(samplePath, 'utf8')

const pluginPath = path.resolve(__dirname, '../dist/plugin/babel-trace-plugin.js')
console.log('[transform-sample] USING PLUGIN:', pluginPath)
console.log('[transform-sample] TRANSFORMING FILE:', samplePath)

babel.transformAsync(code, {
  filename: samplePath,
  plugins: [pluginPath],
  parserOpts: { sourceType: 'module', plugins: ['jsx', 'typescript'] },
  sourceMaps: false
})
  .then((res) => {
    console.log('\n--- TRANSFORMED OUTPUT ---\n')
    console.log(res.code)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
