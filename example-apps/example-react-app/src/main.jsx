import React from 'react'
import ReactDOM from 'react-dom/client'
import { initTracer } from 'render-proxy-tracer'
import App from './App'
import './index.css'

initTracer({ debug: false })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
