import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useEdgesState,
  useNodesState
} from "reactflow";
import {
  ChevronLeft,
  ChevronRight,
  CirclePause,
  CirclePlay,
  Filter,
  RotateCcw,
  Trash2,
  List
} from "lucide-react";
import { PlaybackControls } from "./components/PlaybackControls.jsx";
import { ScreenshotViewer } from "./components/ScreenshotViewer.jsx";
import { FilterBar } from "./components/FilterBar.jsx";
import { EventLog } from "./components/EventLog.jsx";
import { buildTraceGraph, getEventCategory, isVisibleByFilters } from "./components/traceGraph.jsx";

const INITIAL_FILTERS = {
  fetch: true,
  function: true,
  render: true,
  state: true,
  dom: true,
  user: true,
  form: true,
  error: true,
  other: true
};

const PLAYBACK_ICONS = {
  play: <CirclePlay size={18} />,
  pause: <CirclePause size={18} />,
  previous: <ChevronLeft size={18} />,
  next: <ChevronRight size={18} />
};

function useDevtoolsPort(onMessage) {
  const portRef = useRef(null);

  useEffect(() => {
    const port = chrome.runtime.connect({ name: "render-proxy-panel" });
    portRef.current = port;

    port.postMessage({
      type: "PANEL_INIT",
      tabId: chrome.devtools.inspectedWindow.tabId
    });

    port.onMessage.addListener(onMessage);

    return () => {
      portRef.current = null;
      port.disconnect();
    };
    // onMessage is stable (useCallback in App), no need to list it as dep here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return portRef;
}

function App() {
  const [events, setEvents] = useState([]);
  const [screenshots, setScreenshots] = useState([]);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState("");
  const [selectedNode, setSelectedNode] = useState(null);
  const [search, setSearch] = useState("");
  const [showLog, setShowLog] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const handlePortMessage = useCallback((message) => {
    if (!message || !message.type) return;
    if (message.type === "TRACE_SNAPSHOT") {
      setEvents(message.payload.events || []);
      setScreenshots(message.payload.screenshots || []);
    } else if (message.type === "TRACE_EVENT") {
      setEvents((current) => [...current, message.payload]);
    } else if (message.type === "SCREENSHOT_CAPTURED") {
      setScreenshots((current) => [...current, message.payload]);
    } else if (message.type === "SCREENSHOT_ERROR") {
      setError(message.payload?.message || "Screenshot failed");
    }
  }, []);

  const portRef = useDevtoolsPort(handlePortMessage);

  const searchFiltered = useMemo(() => {
    if (!search) return events;
    const q = search.toLowerCase();
    return events.filter(
      (e) =>
        (e.functionName || "").toLowerCase().includes(q) ||
        (e.eventName || "").toLowerCase().includes(q) ||
        (e.fetchName || "").toLowerCase().includes(q) ||
        (e.type || "").toLowerCase().includes(q) ||
        (e.id || "").toLowerCase().includes(q)
    );
  }, [events, search]);

  const visibleEvents = useMemo(
    () => searchFiltered.filter((event) => isVisibleByFilters(event, filters)),
    [searchFiltered, filters]
  );

  const activeEvents = useMemo(
    () => visibleEvents.slice(0, Math.min(step + 1, visibleEvents.length)),
    [visibleEvents, step]
  );

  const activeEvent = activeEvents[activeEvents.length - 1] || null;

  const activeScreenshot = useMemo(() => {
    if (screenshots.length === 0) return null;
    if (!activeEvent) return screenshots[screenshots.length - 1];
    const byExecution = screenshots.filter(
      (s) => s.executionId === activeEvent.executionId
    );
    if (!byExecution.length) return screenshots[screenshots.length - 1];
    return byExecution.reduce((closest, s) =>
      Math.abs(s.timestamp - activeEvent.timestamp) < Math.abs(closest.timestamp - activeEvent.timestamp)
        ? s
        : closest
    );
  }, [activeEvent, screenshots]);

  // Rebuild graph when active step or events change
  useEffect(() => {
    const { nodes: nextNodes, edges: nextEdges } = buildTraceGraph(events, activeEvents, activeEvent);
    setNodes(nextNodes);
    setEdges(nextEdges);
  }, [activeEvent, activeEvents, events, setEdges, setNodes]);

  // Sync selectedNode reference when graph rebuilds
  useEffect(() => {
    if (!selectedNode) return;
    const refreshed = nodes.find((n) => n.id === selectedNode.id);
    if (refreshed) setSelectedNode(refreshed);
  }, [nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-play interval
  useEffect(() => {
    if (!isPlaying || visibleEvents.length === 0) return;
    const id = window.setInterval(() => {
      setStep((current) => {
        if (current >= visibleEvents.length - 1) {
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 700);
    return () => window.clearInterval(id);
  }, [isPlaying, visibleEvents.length]);

  // Clamp step when filtered events shrink
  useEffect(() => {
    setStep((current) => Math.min(current, Math.max(visibleEvents.length - 1, 0)));
  }, [visibleEvents.length]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e) {
      const target = e.target;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          if (visibleEvents.length > 0) setIsPlaying((p) => !p);
          break;
        case "ArrowRight":
          e.preventDefault();
          setStep((s) => Math.min(s + 1, Math.max(visibleEvents.length - 1, 0)));
          break;
        case "ArrowLeft":
          e.preventDefault();
          setStep((s) => Math.max(s - 1, 0));
          break;
        case "r":
        case "R":
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            setStep(0);
            setIsPlaying(false);
          }
          break;
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [visibleEvents.length]);

  const clearTraces = useCallback(() => {
    portRef.current?.postMessage({ type: "CLEAR_TRACES" });
    setEvents([]);
    setScreenshots([]);
    setSelectedNode(null);
    setStep(0);
    setIsPlaying(false);
    setError("");
  }, [portRef]);

  const activeCategory = activeEvent ? getEventCategory(activeEvent) : "other";

  return (
    <ReactFlowProvider>
      <main className="app-shell">
        <header className="topbar">
          <div className="topbar-left">
            <h1>Render-proxy</h1>
            <div className="topbar-stats">
              <span><span className="stat-num">{events.length}</span> events</span>
              <span><span className="stat-num">{visibleEvents.length}</span> steps</span>
              <span><span className="stat-num">{screenshots.length}</span> screenshots</span>
            </div>
          </div>
          <div className="topbar-actions">
            <button
              className={`icon-button${showLog ? " active" : ""}`}
              title="Toggle event log (L)"
              onClick={() => setShowLog((s) => !s)}
              aria-pressed={showLog}
            >
              <List size={16} />
            </button>
            <button
              className="icon-button"
              title="Reset replay (R)"
              onClick={() => { setStep(0); setIsPlaying(false); }}
            >
              <RotateCcw size={16} />
            </button>
            <button
              className="icon-button danger"
              title="Clear all traces"
              onClick={clearTraces}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </header>

        <section className="workspace">
          <section className="graph-pane" aria-label="Execution graph">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={(_, node) => setSelectedNode(node)}
              fitView
              minZoom={0.2}
              maxZoom={2}
            >
              <Background color="#263449" gap={18} />
              <MiniMap nodeStrokeWidth={3} zoomable pannable />
              <Controls />
            </ReactFlow>

            <FilterBar
              filters={filters}
              onChange={setFilters}
              icon={<Filter size={15} />}
              search={search}
              onSearchChange={setSearch}
              total={events.length}
              filtered={visibleEvents.length}
            />

            <div className={`event-log-drawer${showLog ? " open" : ""}`}>
              <div className="event-log-header">
                <span>Event Log</span>
                <span className="event-log-count">{visibleEvents.length} events</span>
              </div>
              <EventLog
                events={events}
                activeStep={step}
                onStep={setStep}
                search={search}
                visibleEvents={visibleEvents}
              />
            </div>
          </section>

          <ScreenshotViewer
            screenshot={activeScreenshot}
            activeEvent={activeEvent}
            selectedNode={selectedNode}
            activeCategory={activeCategory}
            error={error}
            screenshots={screenshots}
          />
        </section>

        <PlaybackControls
          step={step}
          total={visibleEvents.length}
          isPlaying={isPlaying}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onNext={() => setStep((s) => Math.min(s + 1, visibleEvents.length - 1))}
          onPrevious={() => setStep((s) => Math.max(s - 1, 0))}
          onSliderChange={setStep}
          icons={PLAYBACK_ICONS}
        />
      </main>
    </ReactFlowProvider>
  );
}

export default App;
