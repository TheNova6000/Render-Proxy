import { createApp } from 'vue'
import App from './App.vue'
import { initTracer, subscribeToEvents } from 'render-proxy-tracer'

initTracer({ debug: true })

subscribeToEvents((events) => {
  const last = events[events.length - 1]
  console.log('[TRACER]', last.type, last.functionName || last.eventName || '', last.duration ? `${last.duration}ms` : '')
})

createApp(App).mount('#app')
