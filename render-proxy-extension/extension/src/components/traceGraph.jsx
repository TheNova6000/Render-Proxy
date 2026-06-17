const TYPE_CATEGORY = {
  CLICK: "user",
  EVENT_CLICK: "user",
  EVENT_START: "user",
  USER_ACTION: "user",
  FORM_SUBMIT: "form",
  FORM_CHANGE: "form",
  FUNCTION_START: "function",
  FUNCTION_END: "function",
  FETCH_START: "fetch",
  FETCH_END: "fetch",
  FETCH_ERROR: "error",
  STATE_UPDATE: "state",
  SET_STATE: "state",
  RENDER_START: "render",
  RENDER_END: "render",
  DOM_MUTATION: "dom",
  ERROR: "error",
  UNHANDLED_REJECTION: "error"
};

const CATEGORY_COLORS = {
  user: { border: "#38bdf8", background: "#082f49", text: "#e0f2fe" },
  form: { border: "#2dd4bf", background: "#134e4a", text: "#ccfbf1" },
  function: { border: "#818cf8", background: "#24245f", text: "#e0e7ff" },
  fetch: { border: "#fb923c", background: "#431407", text: "#ffedd5" },
  state: { border: "#4ade80", background: "#14532d", text: "#dcfce7" },
  render: { border: "#c084fc", background: "#3b0764", text: "#f3e8ff" },
  dom: { border: "#94a3b8", background: "#1e293b", text: "#e2e8f0" },
  error: { border: "#f87171", background: "#2d0a0a", text: "#fecaca" },
  file: { border: "#475569", background: "#111827", text: "#cbd5e1" },
  other: { border: "#64748b", background: "#172033", text: "#e2e8f0" }
};

export function getEventCategory(event) {
  if (!event || !event.type) return "other";
  if (event.category && event.category !== "function") return event.category;
  return TYPE_CATEGORY[event.type] || inferCategory(event);
}

export function isVisibleByFilters(event, filters) {
  return Boolean(filters[getEventCategory(event)]);
}

export function buildTraceGraph(allEvents, activeEvents, activeEvent) {
  const eventById = new Map(allEvents.map((event) => [event.id, event]));
  const endByParent = new Map();
  allEvents.forEach((event) => {
    if (isEndEvent(event) && event.parentId) {
      if (!endByParent.has(event.parentId)) endByParent.set(event.parentId, []);
      endByParent.get(event.parentId).push(event);
    }
  });

  const groups = stackEvents(activeEvents, eventById, endByParent);
  const fileNames = collectFileNames(groups);
  const fileLane = new Map(fileNames.map((fileName, index) => [fileName, index]));
  const laneCounts = new Map();
  const eventIdToGroupId = new Map();

  groups.forEach((group) => {
    group.events.forEach((event) => eventIdToGroupId.set(event.id, group.id));
    group.relatedEvents.forEach((event) => eventIdToGroupId.set(event.id, group.id));
  });

  const fileNodes = fileNames.map((fileName, index) => createFileNode(fileName, index));
  const eventNodes = groups.map((group) => {
    const lane = getLaneForGroup(group, fileLane);
    const laneIndex = laneCounts.get(lane) || 0;
    laneCounts.set(lane, laneIndex + 1);

    return groupToNode({
      group,
      lane,
      laneIndex,
      isActive: Boolean(activeEvent && group.events.some((event) => event.id === activeEvent.id))
    });
  });

  const edges = [];
  const edgeIds = new Set();
  groups.forEach((group) => {
    const parentGroupId = findParentGroup(group, eventById, eventIdToGroupId);
    if (parentGroupId && parentGroupId !== group.id) {
      addEdge(edges, edgeIds, createEdge(parentGroupId, group.id, activeEvent && group.events.some((event) => event.id === activeEvent.id)));
    }

    if (group.fileName && fileLane.has(group.fileName)) {
      addEdge(edges, edgeIds, {
        id: `file:${group.fileName}-${group.id}`,
        source: `file:${group.fileName}`,
        target: group.id,
        type: "smoothstep",
        style: {
          stroke: "#334155",
          strokeDasharray: "4 6",
          strokeWidth: 1
        }
      });
    }
  });

  return {
    nodes: [...fileNodes, ...eventNodes],
    edges
  };
}

function stackEvents(events, eventById, endByParent) {
  const groups = [];
  const groupBySignature = new Map();

  events.forEach((event) => {
    const signature = getStackSignature(event, eventById);
    const existing = groupBySignature.get(signature);

    if (existing) {
      existing.events.push(event);
      existing.relatedEvents.push(...getRelatedEvents(event, endByParent));
      existing.lastTimestamp = event.timestamp || existing.lastTimestamp;
      existing.domChanges += event.mutationCount || (event.type === "DOM_MUTATION" ? 1 : 0);
      existing.targets = mergeUnique(existing.targets, event.targets || [event.target].filter(Boolean));
      return;
    }

    const group = {
      id: `group:${signature}`,
      signature,
      category: getEventCategory(event),
      title: getTitle(event, eventById),
      fileName: event.fileName || event.sourceFile || getSyntheticFile(event),
      firstTimestamp: event.timestamp || 0,
      lastTimestamp: event.timestamp || 0,
      events: [event],
      relatedEvents: getRelatedEvents(event, endByParent),
      domChanges: event.mutationCount || (event.type === "DOM_MUTATION" ? 1 : 0),
      targets: event.targets || [event.target].filter(Boolean)
    };

    groups.push(group);
    groupBySignature.set(signature, group);
  });

  return groups;
}

function groupToNode({ group, lane, laneIndex, isActive }) {
  const colors = CATEGORY_COLORS[group.category] || CATEGORY_COLORS.other;
  const hasError = group.events.some((e) => e.type === "ERROR" || e.type === "UNHANDLED_REJECTION" || e.type === "FETCH_ERROR");

  return {
    id: group.id,
    type: "default",
    position: {
      x: 40 + lane * 310,
      y: 112 + laneIndex * 136
    },
    data: {
      group,
      rawEvents: group.events,
      relatedEvents: group.relatedEvents,
      label: buildLabel(group)
    },
    className: `trace-node ${group.category}${isActive ? " active" : ""}${hasError ? " has-error" : ""}`,
    style: {
      borderColor: isActive ? "#facc15" : hasError ? "#f87171" : colors.border,
      background: colors.background,
      color: colors.text,
      boxShadow: isActive
        ? "0 0 0 4px rgba(250, 204, 21, 0.18)"
        : hasError
          ? "0 0 0 3px rgba(248, 113, 113, 0.35), 0 14px 28px rgba(0, 0, 0, 0.28)"
          : "0 14px 28px rgba(0, 0, 0, 0.28)"
    }
  };
}

function createFileNode(fileName, index) {
  return {
    id: `file:${fileName}`,
    type: "input",
    position: {
      x: 40 + index * 310,
      y: 24
    },
    data: {
      group: {
        category: "file",
        title: shortFileName(fileName),
        fileName,
        events: [],
        relatedEvents: []
      },
      label: (
        <div className="node-label file-label">
          <strong>{shortFileName(fileName)}</strong>
          <span>{fileName}</span>
        </div>
      )
    },
    className: "trace-node file",
    style: {
      borderColor: CATEGORY_COLORS.file.border,
      background: CATEGORY_COLORS.file.background,
      color: CATEGORY_COLORS.file.text,
      boxShadow: "0 14px 28px rgba(0, 0, 0, 0.25)"
    }
  };
}

function createEdge(source, target, isActive) {
  return {
    id: `${source}-${target}`,
    source,
    target,
    animated: Boolean(isActive),
    type: "smoothstep",
    style: {
      stroke: isActive ? "#facc15" : "#64748b",
      strokeWidth: isActive ? 2.6 : 1.6
    }
  };
}

function buildLabel(group) {
  const count = group.events.length;
  const duration = getGroupDuration(group);
  const subtitle = group.fileName
    ? `${shortFileName(group.fileName)}${getLineNumber(group) ? `:${getLineNumber(group)}` : ""}`
    : "runtime";
  const meta = getGroupMeta(group, duration);
  const hasError = group.events.some((e) => e.type === "ERROR" || e.type === "UNHANDLED_REJECTION" || e.type === "FETCH_ERROR");

  return (
    <div className="node-label">
      <span className={`node-kind ${group.category}`}>{group.category}</span>
      <strong>{group.title}</strong>
      <span>{subtitle}</span>
      {meta && <em>{meta}</em>}
      {count > 1 && <b className="stack-badge">ran {count} times</b>}
      {hasError && <b className="error-badge">ERROR</b>}
    </div>
  );
}

function getGroupMeta(group, duration) {
  if (group.category === "error") {
    const err = group.events.find((e) => e.error || e.reason);
    return err ? (err.error || err.reason || "").substring(0, 60) : duration;
  }
  if (group.category === "dom") {
    const targetText = group.targets.length ? group.targets.join(", ") : "DOM";
    return `${group.domChanges || group.events.length} changes | ${targetText}`;
  }
  if (group.category === "fetch") {
    return group.events[0].fetchName || group.events[0].url || duration;
  }
  return duration;
}

function getGroupDuration(group) {
  const timestamps = [...group.events, ...group.relatedEvents]
    .map((event) => event.timestamp)
    .filter((timestamp) => typeof timestamp === "number");

  if (timestamps.length < 2) return "";
  return `${Math.max(0, Math.round(Math.max(...timestamps) - Math.min(...timestamps)))} ms`;
}

function getLineNumber(group) {
  return group.events.find((event) => event.lineNumber)?.lineNumber;
}

function getStackSignature(event, eventById) {
  const category = getEventCategory(event);
  const title = getTitle(event, eventById);
  const fileName = event.fileName || event.sourceFile || getSyntheticFile(event);
  const parent = event.parentId ? eventById.get(event.parentId) : null;
  const parentTitle = parent ? getTitle(parent, eventById) : "root";
  const endpoint = event.fetchName || event.url || "";

  return [category, event.type, title, fileName, parentTitle, endpoint].join("|");
}

function getTitle(event, eventById) {
  if (event.type === "EVENT_START") return event.eventName || event.handlerName || event.id.replace(/^event_/, "");
  if (event.type === "FUNCTION_END") {
    const parent = event.parentId ? eventById.get(event.parentId) : null;
    return parent ? `${getTitle(parent, eventById)} finished` : "function finished";
  }
  if (event.type === "FETCH_END") {
    const parent = event.parentId ? eventById.get(event.parentId) : null;
    return parent ? `${getTitle(parent, eventById)} finished` : "fetch finished";
  }
  if (event.type === "DOM_MUTATION") return "DOM mutation";
  return event.functionName || event.fetchName || event.stateName || event.renderName || event.componentName || event.type;
}

function getSyntheticFile(event) {
  if (event.type === "DOM_MUTATION") return "Browser / DOM";
  if (getEventCategory(event) === "fetch") return "Network";
  return "Runtime";
}

function getRelatedEvents(event, endByParent) {
  if (isEndEvent(event)) return [];
  return endByParent.get(event.id) || [];
}

function isEndEvent(event) {
  return Boolean(event?.type?.endsWith("_END") || event?.id?.startsWith("end_"));
}

function collectFileNames(groups) {
  const fileNames = [];
  groups.forEach((group) => {
    if (group.fileName && !fileNames.includes(group.fileName)) {
      fileNames.push(group.fileName);
    }
  });
  if (!fileNames.length) fileNames.push("Runtime");
  if (!fileNames.includes("Browser / DOM")) fileNames.push("Browser / DOM");
  return fileNames;
}

function getLaneForGroup(group, fileLane) {
  return fileLane.has(group.fileName) ? fileLane.get(group.fileName) : 0;
}

function findParentGroup(group, eventById, eventIdToGroupId) {
  for (const event of group.events) {
    let parentId = event.parentId;
    while (parentId) {
      const parentGroupId = eventIdToGroupId.get(parentId);
      if (parentGroupId) return parentGroupId;
      parentId = eventById.get(parentId)?.parentId;
    }
  }
  return null;
}

function addEdge(edges, edgeIds, edge) {
  if (edgeIds.has(edge.id)) return;
  edgeIds.add(edge.id);
  edges.push(edge);
}

function mergeUnique(first, second) {
  return Array.from(new Set([...first, ...second].filter(Boolean))).slice(0, 8);
}

function shortFileName(fileName) {
  return String(fileName).split(/[\\/]/).filter(Boolean).pop() || fileName;
}

function inferCategory(event) {
  const type = event.type.toLowerCase();
  if (type.includes("error") || type.includes("rejection")) return "error";
  if (type.includes("fetch") || type.includes("api")) return "fetch";
  if (type.includes("function") || event.functionName) return "function";
  if (type.includes("render")) return "render";
  if (type.includes("state")) return "state";
  if (type.includes("dom") || type.includes("mutation")) return "dom";
  if (type.includes("form")) return "form";
  if (type.includes("event") || type.includes("click") || type.includes("user")) return "user";
  return "other";
}
