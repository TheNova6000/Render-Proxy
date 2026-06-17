import html2canvas from "html2canvas";

const SOURCE = "render-proxy";
const EVENT_TYPE = "TRACE_EVENT";
const SCREENSHOT_TYPE = "SCREENSHOT_CAPTURED";
const DOM_MUTATION_TYPE = "DOM_MUTATION";

// Maximum retries when waiting for DOM to be ready
const MAX_INJECT_RETRIES = 80;
let injectRetries = 0;
let contextInvalidated = false;

function injectPageBridge() {
  if (contextInvalidated) return;
  const parent = document.documentElement || document.head || document.body;
  if (!parent) {
    if (++injectRetries > MAX_INJECT_RETRIES) return;
    window.setTimeout(injectPageBridge, 25);
    return;
  }
  const injectedScript = document.createElement("script");
  try {
    injectedScript.src = chrome.runtime.getURL("inject.js");
  } catch {
    contextInvalidated = true;
    return;
  }
  injectedScript.onload = () => injectedScript.remove();
  parent.appendChild(injectedScript);
}

let latestExecutionId = null;
let latestTraceEventId = null;
let lastScreenshotAt = 0;
let screenshotCounter = 0;
let pendingScreenshot = false;
let pendingMutations = [];
let mutationFlushTimer = null;
// Track whether a meaningful trace event recently occurred so we only
// take screenshots when something actually happened in the app
let shouldCaptureNext = false;

try {
  chrome.runtime.getManifest();
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg === "ping") sendResponse("pong");
  });
} catch {
  contextInvalidated = true;
}

function sendToBackground(message) {
  if (contextInvalidated) return;
  try {
    chrome.runtime.sendMessage(message).catch(() => {
      contextInvalidated = true;
    });
  } catch {
    contextInvalidated = true;
  }
}

function describeNode(node) {
  if (!node) return "";
  if (node instanceof Element) {
    const id = node.id ? `#${node.id}` : "";
    const cls =
      typeof node.className === "string"
        ? `.${node.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".")}`
        : "";
    return `${node.tagName.toLowerCase()}${id}${cls}`;
  }
  if (node.nodeType === Node.TEXT_NODE) return "#text";
  return node.nodeName ? node.nodeName.toLowerCase() : "node";
}

function normalizeMutation(mutation) {
  const addedNodes = Array.from(mutation.addedNodes || [])
    .slice(0, 10)
    .map(describeNode)
    .filter(Boolean);
  const removedNodes = Array.from(mutation.removedNodes || [])
    .slice(0, 10)
    .map(describeNode)
    .filter(Boolean);
  return {
    type: DOM_MUTATION_TYPE,
    id: `dom_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    executionId: latestExecutionId,
    parentId: latestTraceEventId,
    mutationType: mutation.type,
    target: describeNode(mutation.target),
    attributeName: mutation.attributeName || null,
    oldValue: mutation.oldValue || null,
    addedNodes,
    removedNodes,
    addedCount: addedNodes.length,
    removedCount: removedNodes.length,
    timestamp: performance.now()
  };
}

function summarizeMutations(mutations) {
  const targets = new Set();
  const types = new Set();
  mutations.forEach((m) => {
    types.add(m.mutationType);
    if (m.target) targets.add(m.target);
  });
  return {
    type: DOM_MUTATION_TYPE,
    id: `dom_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    executionId: latestExecutionId,
    parentId: latestTraceEventId,
    mutationType: Array.from(types).join(", "),
    mutationCount: mutations.length,
    targets: Array.from(targets).slice(0, 5),
    timestamp: performance.now()
  };
}

function flushMutations() {
  if (!pendingMutations.length) return;
  const summary = summarizeMutations(pendingMutations);
  pendingMutations = [];
  mutationFlushTimer = null;
  sendToBackground({ source: SOURCE, type: EVENT_TYPE, payload: summary });

  // Take a screenshot once after flushing DOM mutations if a trace event triggered it
  if (shouldCaptureNext) {
    shouldCaptureNext = false;
    captureScreenshot().catch(() => {});
  }
}

async function captureScreenshot() {
  if (pendingScreenshot) return;
  const now = Date.now();
  if (now - lastScreenshotAt < 700) return;

  pendingScreenshot = true;
  lastScreenshotAt = now;

  try {
    const canvas = await html2canvas(document.documentElement, {
      backgroundColor: null,
      logging: false,
      scale: Math.min(window.devicePixelRatio || 1, 1.5),
      useCORS: true,
      // Clip to viewport instead of full scroll height to limit image size
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      x: window.scrollX,
      y: window.scrollY,
      width: window.innerWidth,
      height: window.innerHeight
    });

    sendToBackground({
      source: SOURCE,
      type: SCREENSHOT_TYPE,
      payload: {
        screenshotId: `screenshot_${++screenshotCounter}`,
        executionId: latestExecutionId,
        timestamp: performance.now(),
        image: canvas.toDataURL("image/jpeg", 0.75)
      }
    });
  } catch (error) {
    sendToBackground({
      source: SOURCE,
      type: "SCREENSHOT_ERROR",
      payload: {
        executionId: latestExecutionId,
        timestamp: performance.now(),
        message: error instanceof Error ? error.message : String(error)
      }
    });
  } finally {
    pendingScreenshot = false;
  }
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.source !== SOURCE || event.data.type !== EVENT_TYPE) return;

  const payload = event.data.payload;
  latestExecutionId = payload.executionId || latestExecutionId;
  latestTraceEventId = payload.id || latestTraceEventId;

  sendToBackground({ source: SOURCE, type: EVENT_TYPE, payload });

  // Schedule a screenshot on meaningful events (user interactions and fetch)
  const meaningfulTypes = new Set(["EVENT_START", "FETCH_END", "FETCH_ERROR", "ERROR", "UNHANDLED_REJECTION"]);
  if (meaningfulTypes.has(payload.type)) {
    shouldCaptureNext = true;
    // If there's no pending mutation flush, capture immediately
    if (!mutationFlushTimer) {
      captureScreenshot().catch(() => {});
    }
  }
});

function startDomObserver() {
  const target = document.documentElement;
  if (!target) {
    window.setTimeout(startDomObserver, 25);
    return;
  }

  const observer = new MutationObserver((mutations) => {
    // Filter out characterData mutations (keystroke noise) — only track structural DOM changes
    const structural = mutations.filter((m) => m.type !== "characterData");
    if (!structural.length) return;

    pendingMutations.push(...structural.map(normalizeMutation));
    if (!mutationFlushTimer) {
      mutationFlushTimer = window.setTimeout(flushMutations, 300);
    }
  });

  observer.observe(target, {
    attributes: true,
    attributeOldValue: false,
    childList: true,
    subtree: true,
    characterData: false
  });
}

injectPageBridge();
startDomObserver();
