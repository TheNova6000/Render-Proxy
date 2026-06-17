const SOURCE = "render-proxy";
const MAX_EVENTS = 2000;
const MAX_SCREENSHOTS = 100;

const tabState = new Map();
const panelPorts = new Map();

function getState(tabId) {
  if (!tabState.has(tabId)) {
    tabState.set(tabId, { events: [], screenshots: [] });
  }
  return tabState.get(tabId);
}

function trimList(list, max) {
  if (list.length > max) {
    list.splice(0, list.length - max);
  }
}

function postToPanel(tabId, message) {
  const port = panelPorts.get(tabId);
  if (!port) return;
  try {
    port.postMessage(message);
  } catch {
    // Port was disconnected — clean up
    panelPorts.delete(tabId);
  }
}

// Clean up per-tab state when the tab closes to prevent memory leaks
chrome.tabs.onRemoved.addListener((tabId) => {
  tabState.delete(tabId);
  panelPorts.delete(tabId);
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "render-proxy-panel") return;

  let inspectedTabId = null;

  port.onMessage.addListener((message) => {
    if (!message || !message.type) return;

    if (message.type === "PANEL_INIT") {
      inspectedTabId = message.tabId;
      panelPorts.set(inspectedTabId, port);
      port.postMessage({
        type: "TRACE_SNAPSHOT",
        payload: getState(inspectedTabId)
      });
    }

    if (message.type === "CLEAR_TRACES" && inspectedTabId !== null) {
      tabState.set(inspectedTabId, { events: [], screenshots: [] });
      postToPanel(inspectedTabId, {
        type: "TRACE_SNAPSHOT",
        payload: getState(inspectedTabId)
      });
    }
  });

  port.onDisconnect.addListener(() => {
    if (inspectedTabId !== null) {
      panelPorts.delete(inspectedTabId);
    }
    inspectedTabId = null;
  });
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || message.source !== SOURCE || !sender.tab) return;

  const tabId = sender.tab.id;
  if (tabId == null) return;

  const state = getState(tabId);

  if (message.type === "TRACE_EVENT" && message.payload) {
    state.events.push(message.payload);
    trimList(state.events, MAX_EVENTS);
    postToPanel(tabId, { type: "TRACE_EVENT", payload: message.payload });
  }

  if (message.type === "SCREENSHOT_CAPTURED" && message.payload) {
    state.screenshots.push(message.payload);
    trimList(state.screenshots, MAX_SCREENSHOTS);
    postToPanel(tabId, { type: "SCREENSHOT_CAPTURED", payload: message.payload });
  }

  if (message.type === "SCREENSHOT_ERROR" && message.payload) {
    postToPanel(tabId, { type: "SCREENSHOT_ERROR", payload: message.payload });
  }
});
