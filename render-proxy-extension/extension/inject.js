(function injectRenderProxyBridge() {
  const SOURCE = "render-proxy";
  const EVENT_TYPE = "TRACE_EVENT";
  // Cap the dedup set to avoid unbounded memory growth on long-running sessions
  const MAX_SEEN = 5000;
  const seen = new Set();
  let seenCounter = 0;

  function postTraceEvent(event) {
    if (!event || typeof event !== "object") return;
    const id =
      event.id ||
      `${event.type || "event"}_${event.timestamp || Date.now()}_${++seenCounter}`;
    if (seen.has(id)) return;
    seen.add(id);
    if (seen.size > MAX_SEEN) {
      // Evict oldest entries by rebuilding the set from the tail
      const entries = Array.from(seen);
      seen.clear();
      entries.slice(-Math.floor(MAX_SEEN / 2)).forEach((e) => seen.add(e));
    }
    window.postMessage(
      { source: SOURCE, type: EVENT_TYPE, payload: { ...event, id } },
      "*"
    );
  }

  function attachToTracer(tracer) {
    if (!tracer || tracer.__renderProxyDevToolsAttached) return false;

    if (typeof tracer.subscribeToEvents === "function") {
      tracer.subscribeToEvents(postTraceEvent);
      tracer.__renderProxyDevToolsAttached = true;
      return true;
    }

    if (typeof tracer.subscribe === "function") {
      tracer.subscribe(postTraceEvent);
      tracer.__renderProxyDevToolsAttached = true;
      return true;
    }

    // Fallback: poll tracer.events array if subscribeToEvents is unavailable
    if (Array.isArray(tracer.events)) {
      tracer.events.forEach(postTraceEvent);
      const originalPush = tracer.events.push.bind(tracer.events);
      tracer.events.push = (...events) => {
        events.forEach(postTraceEvent);
        return originalPush(...events);
      };
      tracer.__renderProxyDevToolsAttached = true;
      return true;
    }

    return false;
  }

  let pollCount = 0;
  const MAX_POLLS = 60; // 60 × 500ms = 30s

  function tryAttach() {
    const tracer = window.__RENDER_PROXY_TRACER__;
    if (tracer) attachToTracer(tracer);

    if (typeof window.subscribeToEvents === "function" && !window.__renderProxyDevToolsGlobalSubscriber) {
      window.subscribeToEvents(postTraceEvent);
      window.__renderProxyDevToolsGlobalSubscriber = true;
    }
  }

  tryAttach();

  const intervalId = window.setInterval(() => {
    tryAttach();
    if (++pollCount >= MAX_POLLS) window.clearInterval(intervalId);
  }, 500);

  // Also attach if the tracer fires a custom event after the polling window ends
  window.addEventListener("render-proxy-trace", (event) => {
    postTraceEvent(event.detail);
  });

  // Re-attach when the tracer is initialized after our polling window
  window.addEventListener("render-proxy-init", () => {
    tryAttach();
  });
})();
