import React, { useEffect, useMemo, useState } from "react";

const CATEGORY_META = {
  user: { icon: "\u{1F5E8}", label: "User" },
  form: { icon: "\u{1F4DD}", label: "Form" },
  function: { icon: "\u2699", label: "Function" },
  fetch: { icon: "\u{1F310}", label: "Fetch" },
  state: { icon: "\u{1F504}", label: "State" },
  render: { icon: "\u{1F4A1}", label: "Render" },
  dom: { icon: "\u{1F4C4}", label: "DOM" },
  other: { icon: "\u2753", label: "Other" }
};

function formatTimestamp(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 });
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="copy-btn"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      title="Copy to clipboard"
    >
      {copied ? "\u2713 Copied" : "\u{1F4CB} Copy"}
    </button>
  );
}

export function ScreenshotViewer({ screenshot, activeEvent, selectedNode, activeCategory, error, screenshots }) {
  const [collapsed, setCollapsed] = useState({ details: false, dom: false, raw: false });
  const [manualScreenshotIdx, setManualScreenshotIdx] = useState(null);

  useEffect(() => {
    setManualScreenshotIdx(null);
  }, [activeEvent]);

  const selectedGroup = selectedNode?.data?.group || null;
  const rawEvents = selectedNode?.data?.rawEvents || (activeEvent ? [activeEvent] : []);
  const relatedEvents = selectedNode?.data?.relatedEvents || [];
  const displayEvent = rawEvents[0] || activeEvent;
  const displayCategory = selectedGroup?.category || activeCategory;

  const rawJson = useMemo(() => {
    const obj = {};
    if (selectedGroup) obj.block = selectedGroup;
    if (rawEvents.length) obj.events = rawEvents;
    if (relatedEvents.length) obj.relatedEvents = relatedEvents;
    return JSON.stringify(obj, null, 2);
  }, [selectedGroup, rawEvents, relatedEvents]);

  const activeScreenshot = useMemo(() => {
    if (manualScreenshotIdx !== null && screenshots[manualScreenshotIdx]) return screenshots[manualScreenshotIdx];
    if (screenshot) return screenshot;
    if (screenshots.length > 0) return screenshots[screenshots.length - 1];
    return null;
  }, [screenshot, screenshots, manualScreenshotIdx]);

  const categoryInfo = CATEGORY_META[displayCategory] || CATEGORY_META.other;

  return (
    <aside className="screenshot-pane" aria-label="Screenshot timeline">
      <div className="screenshot-header">
        <div className="screenshot-header-left">
          <span className={`category-dot ${displayCategory}`} />
          <div>
            <h2>{selectedGroup ? selectedGroup.title : displayEvent?.type || "Trace Details"}</h2>
            <p className="screenshot-subtitle">
              {categoryInfo.icon} {categoryInfo.label}
              {displayEvent?.timestamp ? ` \u00B7 ${formatTimestamp(displayEvent.timestamp)}` : ""}
            </p>
          </div>
        </div>
        <span className={`category-pill ${displayCategory}`}>{categoryInfo.label}</span>
      </div>

      <div className="screenshot-frame">
        {activeScreenshot ? (
          <div className="screenshot-wrapper">
            <img src={activeScreenshot.image} alt="Captured webpage state" />
            <div className="screenshot-overlay">
              <span className="screenshot-time">{activeScreenshot.timestamp ? formatTimestamp(activeScreenshot.timestamp) : ""}</span>
              {activeScreenshot.executionId && <span className="screenshot-exec">exec: {activeScreenshot.executionId}</span>}
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon">{categoryInfo.icon}</span>
            <p>No screenshot captured yet.</p>
            <p className="empty-hint">Interact with the inspected page to generate trace events.</p>
          </div>
        )}
      </div>

      {screenshots.length > 1 && (
        <div className="screenshot-strip">
          {screenshots.map((s, i) => (
            <button
              key={i}
              className={`screenshot-thumb ${activeScreenshot === s ? "active" : ""}`}
              onClick={() => setManualScreenshotIdx(i)}
              title={`Screenshot ${i + 1}${s.executionId ? ` (exec: ${s.executionId})` : ""}`}
            >
              <img src={s.image} alt={`Screenshot ${i + 1}`} />
            </button>
          ))}
        </div>
      )}

      {displayEvent && (
        <div className={`details-section ${collapsed.details ? "collapsed" : ""}`}>
          <button className="section-toggle" onClick={() => setCollapsed(p => ({ ...p, details: !p.details }))}>
            <span className="toggle-arrow">{collapsed.details ? "\u25B6" : "\u25BC"}</span>
            <span>Event Details</span>
            <span className="section-count">{selectedGroup ? `${rawEvents.length} event${rawEvents.length !== 1 ? "s" : ""}` : "1 event"}</span>
          </button>
          <div className="section-body">
            <dl className="details-grid">
              <div className="detail-card">
                <dt>Name</dt>
                <dd title={selectedGroup?.title || displayEvent.functionName || displayEvent.fetchName || displayEvent.type}>
                  {selectedGroup?.title || displayEvent.functionName || displayEvent.fetchName || displayEvent.renderName || displayEvent.type}
                </dd>
              </div>
              <div className="detail-card">
                <dt>File</dt>
                <dd title={selectedGroup?.fileName || displayEvent.fileName || "unknown"}>
                  {selectedGroup?.fileName || displayEvent.fileName || "unknown"}
                  {displayEvent.lineNumber ? `:${displayEvent.lineNumber}` : ""}
                </dd>
              </div>
              <div className="detail-card">
                <dt>Execution</dt>
                <dd title={displayEvent.executionId || "unassigned"}>{displayEvent.executionId || "unassigned"}</dd>
              </div>
              <div className="detail-card">
                <dt>Duration</dt>
                <dd>
                  {displayEvent.duration ? `${displayEvent.duration} ms` : "-"}
                </dd>
              </div>
              <div className="detail-card">
                <dt>Type</dt>
                <dd>{displayEvent.type || "-"}</dd>
              </div>
              <div className="detail-card">
                <dt>ID</dt>
                <dd title={displayEvent.id}>{displayEvent.id ? displayEvent.id.substring(0, 24) + (displayEvent.id.length > 24 ? "\u2026" : "") : "-"}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {displayEvent?.type === "DOM_MUTATION" && (
        <div className={`details-section ${collapsed.dom ? "collapsed" : ""}`}>
          <button className="section-toggle" onClick={() => setCollapsed(p => ({ ...p, dom: !p.dom }))}>
            <span className="toggle-arrow">{collapsed.dom ? "\u25B6" : "\u25BC"}</span>
            <span>DOM Changes</span>
            <span className="section-count">{selectedGroup?.domChanges || rawEvents.length} change{(selectedGroup?.domChanges || rawEvents.length) !== 1 ? "s" : ""}</span>
          </button>
          <div className="section-body">
            <div className="dom-content">
              <div className="dom-targets">
                {(selectedGroup?.targets || []).length > 0 ? (
                  (selectedGroup?.targets || []).map((target) => (
                    <span key={target} className="dom-tag">{target}</span>
                  ))
                ) : (
                  <span className="dom-tag">document</span>
                )}
              </div>
              {(selectedGroup?.domChanges || rawEvents.length) > 0 && (
                <p className="dom-count">{selectedGroup?.domChanges || rawEvents.length} mutation{(selectedGroup?.domChanges || rawEvents.length) !== 1 ? "s" : ""} observed</p>
              )}
            </div>
          </div>
        </div>
      )}

      {(selectedGroup || rawEvents.length > 0) && (
        <div className={`details-section raw-section ${collapsed.raw ? "collapsed" : ""}`}>
          <button className="section-toggle" onClick={() => setCollapsed(p => ({ ...p, raw: !p.raw }))}>
            <span className="toggle-arrow">{collapsed.raw ? "\u25B6" : "\u25BC"}</span>
            <span>Raw Trace Data</span>
            <CopyButton text={rawJson} />
          </button>
          <div className="section-body">
            <pre className="raw-json">{rawJson}</pre>
          </div>
        </div>
      )}

      {error && <div className="error-banner"><span className="error-icon">!</span> {error}</div>}
    </aside>
  );
}
