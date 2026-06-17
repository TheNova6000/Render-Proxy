import React, { useRef, useEffect } from "react";

const TYPE_META = {
  FUNCTION_START: { icon: "▶", color: "#818cf8" },
  FUNCTION_END: { icon: "◼", color: "#6366f1" },
  FETCH_START: { icon: "↓", color: "#fb923c" },
  FETCH_END: { icon: "✓", color: "#34d399" },
  FETCH_ERROR: { icon: "✗", color: "#f87171" },
  EVENT_START: { icon: "◎", color: "#38bdf8" },
  DOM_MUTATION: { icon: "⟳", color: "#94a3b8" },
  ERROR: { icon: "⚠", color: "#f87171" },
  UNHANDLED_REJECTION: { icon: "⚠", color: "#f87171" },
  TIMEOUT_CALLBACK: { icon: "⏱", color: "#c084fc" },
  CLEAR: { icon: "✕", color: "#64748b" }
};

function getMeta(type) {
  return TYPE_META[type] || { icon: "•", color: "#64748b" };
}

function fmtTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtDur(ms) {
  if (ms == null) return "";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function EventLog({ events, activeStep, onStep, search, visibleEvents }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (!listRef.current || !visibleEvents[activeStep]) return;
    const el = listRef.current.querySelector(`[data-idx="${activeStep}"]`);
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeStep, visibleEvents]);

  if (!events.length) {
    return (
      <div className="event-log-empty">
        <span className="empty-icon">☰</span>
        <p>No events yet</p>
        <p className="empty-hint">Interact with the page to generate trace events.</p>
      </div>
    );
  }

  return (
    <div className="event-log" ref={listRef}>
      {visibleEvents.map((event, idx) => {
        const meta = getMeta(event.type);
        const isActive = idx === activeStep;
        const isError = event.type === "ERROR" || event.type === "UNHANDLED_REJECTION" || event.type === "FETCH_ERROR";
        const name = event.functionName || event.eventName || event.fetchName || event.type;

        return (
          <button
            key={event.id || idx}
            data-idx={idx}
            className={`event-row${isActive ? " active" : ""}${isError ? " error" : ""}`}
            onClick={() => onStep(idx)}
          >
            <span className="event-icon" style={{ color: meta.color }}>{meta.icon}</span>
            <span className="event-name">{name}</span>
            <span className="event-time">{fmtTime(event.timestamp)}</span>
            {event.duration != null && <span className="event-dur">{fmtDur(event.duration)}</span>}
          </button>
        );
      })}
    </div>
  );
}
