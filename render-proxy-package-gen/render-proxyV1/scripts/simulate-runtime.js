const tracer = require('../dist/index.cjs.js')
const { initTracer, traceStart, traceEnd, getTraceEvents } = tracer

initTracer({ debug: true })

console.log('--- simulate: start ---')
const appId = traceStart({ functionName: 'App' })

// synchronous nested call
const childId = traceStart({ functionName: 'keysearchWeather' })
traceEnd() // end keysearchWeather

// async via Promise.then: should inherit App as parent
Promise.resolve().then(() => {
  const thenId = traceStart({ functionName: 'thenHandler' })
  traceEnd()
})

// async via setTimeout: should inherit App as parent
setTimeout(() => {
  const tId = traceStart({ functionName: 'timeoutHandler' })
  // simulate nested async inside timeout
  Promise.resolve().then(() => {
    const nested = traceStart({ functionName: 'nestedAfterPromise' })
    traceEnd()
  })
  traceEnd()
}, 20)

// finish App after some delay
setTimeout(() => {
  traceEnd() // end App
  console.log('--- events ---')
  console.log(JSON.stringify(getTraceEvents(), null, 2))
}, 100)
