import type * as BabelCore from '@babel/core'
import * as t from '@babel/types'

const TRACE_START = 'traceStart'
const TRACE_END = 'traceEnd'
const PACKAGE_NAME = 'render-proxy-tracer'

// JSX event handler names that represent user interactions worth tracing
const TRACED_JSX_EVENTS = new Set([
  'onClick',
  'onDoubleClick',
  'onSubmit',
  'onChange',
  'onBlur',
  'onFocus',
  'onKeyDown',
  'onKeyUp',
  'onKeyPress',
  'onMouseDown',
  'onMouseUp',
  'onPointerDown',
  'onPointerUp',
  'onDrop',
  'onDragStart',
  'onDragEnd',
  'onContextMenu'
])

function makeTraceStartNode(
  functionName: string,
  fileName: string | null,
  lineNumber: number | null,
  extra: Record<string, t.Expression> = {}
): t.ExpressionStatement {
  const props: t.ObjectProperty[] = [
    t.objectProperty(t.identifier('functionName'), t.stringLiteral(functionName || 'anonymous')),
    t.objectProperty(t.identifier('fileName'), fileName ? t.stringLiteral(fileName) : t.nullLiteral()),
    t.objectProperty(t.identifier('lineNumber'), lineNumber != null ? t.numericLiteral(lineNumber) : t.nullLiteral())
  ]
  for (const [key, value] of Object.entries(extra)) {
    props.push(t.objectProperty(t.identifier(key), value))
  }
  return t.expressionStatement(
    t.callExpression(t.identifier(TRACE_START), [t.objectExpression(props)])
  )
}

function makeEventTraceStartNode(eventName: string): t.ExpressionStatement {
  return t.expressionStatement(
    t.callExpression(t.identifier(TRACE_START), [
      t.objectExpression([
        t.objectProperty(t.identifier('type'), t.stringLiteral('EVENT_START')),
        t.objectProperty(t.identifier('eventName'), t.stringLiteral(eventName))
      ])
    ])
  )
}

function makeTraceEndNode(): t.ExpressionStatement {
  return t.expressionStatement(t.callExpression(t.identifier(TRACE_END), []))
}

function wrapBodyWithTrace(
  body: t.BlockStatement,
  startNode: t.ExpressionStatement,
  endNode: t.ExpressionStatement
): t.BlockStatement {
  const original = body.body.slice()
  return t.blockStatement([
    startNode,
    t.tryStatement(t.blockStatement(original), null, t.blockStatement([endNode]))
  ])
}

function ensureImport(programPath: babel.NodePath<t.Program>, pluginState: { tracerImported?: boolean }): void {
  if (pluginState.tracerImported) return
  const body = programPath.node.body
  const existing = body.find(
    (n): n is t.ImportDeclaration =>
      t.isImportDeclaration(n) && n.source.value === PACKAGE_NAME
  )
  if (existing) {
    const hasStart = existing.specifiers.some(
      (s): s is t.ImportSpecifier => t.isImportSpecifier(s) && (s.imported as t.Identifier).name === TRACE_START
    )
    const hasEnd = existing.specifiers.some(
      (s): s is t.ImportSpecifier => t.isImportSpecifier(s) && (s.imported as t.Identifier).name === TRACE_END
    )
    if (!hasStart) existing.specifiers.push(t.importSpecifier(t.identifier(TRACE_START), t.identifier(TRACE_START)))
    if (!hasEnd) existing.specifiers.push(t.importSpecifier(t.identifier(TRACE_END), t.identifier(TRACE_END)))
  } else {
    const imp = t.importDeclaration(
      [
        t.importSpecifier(t.identifier(TRACE_START), t.identifier(TRACE_START)),
        t.importSpecifier(t.identifier(TRACE_END), t.identifier(TRACE_END))
      ],
      t.stringLiteral(PACKAGE_NAME)
    )
    programPath.unshiftContainer('body', imp)
  }
  pluginState.tracerImported = true
}

function shouldSkipFile(state: babel.PluginPass): boolean {
  let filename = state?.file?.opts?.filename
  if (!filename) return false
  filename = filename.split('?')[0]
  return (
    filename.includes('node_modules') ||
    filename.includes('render-proxy-tracer') ||
    filename.includes('render-proxy-package') ||
    filename.includes('render-proxyV1') ||
    /[/\\]dist[/\\]/.test(filename) ||
    /react-dom/.test(filename) ||
    /vite[/\\]dist/.test(filename)
  )
}

function isPascalCase(name: string): boolean {
  // React components are PascalCase — skip them, they add noise not signal
  return /^[A-Z][a-zA-Z0-9]*$/.test(name)
}

function getFileName(state: babel.PluginPass): string | null {
  return state?.file?.opts?.filename || null
}

// babel.NodePath type shorthand
type NodePath<T> = babel.NodePath<T>
type PluginPass = babel.PluginPass & { tracerImported?: boolean }

export default function babelTracePlugin(): BabelCore.PluginObj {
  return {
    name: 'babel-plugin-render-proxy-tracer',
    visitor: {
      Program: {
        enter(_path: NodePath<t.Program>, state: PluginPass) {
          state.tracerImported = false
        }
      },

      FunctionDeclaration(path: NodePath<t.FunctionDeclaration>, state: PluginPass) {
        if (shouldSkipFile(state)) return
        const { node } = path
        if (!node.id) return
        const name = node.id.name
        if (isPascalCase(name)) return
        if (!t.isBlockStatement(node.body)) return

        const programPath = path.findParent((p) => p.isProgram()) as NodePath<t.Program>
        ensureImport(programPath, state)

        const loc = node.loc?.start
        const file = getFileName(state)
        const startNode = makeTraceStartNode(name, file, loc?.line ?? null)
        node.body = wrapBodyWithTrace(node.body, startNode, makeTraceEndNode())
      },

      FunctionExpression(path: NodePath<t.FunctionExpression>, state: PluginPass) {
        if (shouldSkipFile(state)) return
        const parent = path.parent
        if (
          !t.isVariableDeclarator(parent) &&
          !t.isAssignmentExpression(parent) &&
          !t.isObjectProperty(parent)
        ) return

        const name =
          (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id) ? parent.id.name : null) ||
          (t.isAssignmentExpression(parent) && t.isIdentifier(parent.left) ? parent.left.name : null) ||
          (t.isObjectProperty(parent) && t.isIdentifier(parent.key) ? parent.key.name : null) ||
          'anonymous'

        if (isPascalCase(name)) return
        const { node } = path
        if (!t.isBlockStatement(node.body)) return

        const programPath = path.findParent((p) => p.isProgram()) as NodePath<t.Program>
        ensureImport(programPath, state)

        const loc = node.loc?.start
        const file = getFileName(state)
        const startNode = makeTraceStartNode(name, file, loc?.line ?? null)
        node.body = wrapBodyWithTrace(node.body, startNode, makeTraceEndNode())
      },

      ArrowFunctionExpression(path: NodePath<t.ArrowFunctionExpression>, state: PluginPass) {
        if (shouldSkipFile(state)) return
        const parent = path.parent
        if (
          !t.isVariableDeclarator(parent) &&
          !t.isAssignmentExpression(parent) &&
          !t.isObjectProperty(parent) &&
          !t.isClassProperty(parent)
        ) return

        const name =
          (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id) ? parent.id.name : null) ||
          (t.isAssignmentExpression(parent) && t.isIdentifier(parent.left) ? parent.left.name : null) ||
          (t.isObjectProperty(parent) && t.isIdentifier(parent.key) ? parent.key.name : null) ||
          'anonymous'

        if (isPascalCase(name)) return
        const { node } = path

        const programPath = path.findParent((p) => p.isProgram()) as NodePath<t.Program>
        ensureImport(programPath, state)

        const loc = node.loc?.start
        const file = getFileName(state)
        const startNode = makeTraceStartNode(name, file, loc?.line ?? null)
        const endNode = makeTraceEndNode()

        if (t.isBlockStatement(node.body)) {
          node.body = wrapBodyWithTrace(node.body, startNode, endNode)
        } else {
          // Expression body → convert to block
          const original = node.body
          node.body = t.blockStatement([
            startNode,
            t.tryStatement(
              t.blockStatement([t.returnStatement(original as t.Expression)]),
              null,
              t.blockStatement([endNode])
            )
          ])
        }
      },

      JSXAttribute(path: NodePath<t.JSXAttribute>, state: PluginPass) {
        if (shouldSkipFile(state)) return
        const attrName = (path.node.name as t.JSXIdentifier).name
        if (!TRACED_JSX_EVENTS.has(attrName)) return

        const value = path.node.value
        if (!value || !t.isJSXExpressionContainer(value)) return
        const expr = value.expression
        if (t.isJSXEmptyExpression(expr)) return
        if (!t.isIdentifier(expr) && !t.isArrowFunctionExpression(expr)) return

        const programPath = path.findParent((p) => p.isProgram()) as NodePath<t.Program>
        ensureImport(programPath, state)

        const startNode = makeEventTraceStartNode(attrName)
        const endNode = makeTraceEndNode()

        if (t.isIdentifier(expr)) {
          // onClick={handleClick}  →  onClick={(...args) => { traceStart(); try { handleClick(...args) } finally { traceEnd() } }}
          const rest = t.restElement(t.identifier('_args'))
          const spread = t.spreadElement(t.identifier('_args'))
          const callExpr = t.callExpression(expr, [spread])
          const tryStmt = t.tryStatement(
            t.blockStatement([t.returnStatement(callExpr)]),
            null,
            t.blockStatement([endNode])
          )
          const wrapper = t.arrowFunctionExpression([rest], t.blockStatement([startNode, tryStmt]))
          path.node.value = t.jsxExpressionContainer(wrapper)
          return
        }

        if (t.isArrowFunctionExpression(expr)) {
          // Preserve original params; wrap body with trace
          const params = expr.params.length > 0 ? expr.params : [t.identifier('_e')]
          const bodyBlock = t.isBlockStatement(expr.body)
            ? expr.body
            : t.blockStatement([t.returnStatement(expr.body as t.Expression)])
          const tryStmt = t.tryStatement(bodyBlock, null, t.blockStatement([endNode]))
          const wrapper = t.arrowFunctionExpression(
            params,
            t.blockStatement([startNode, tryStmt]),
            expr.async
          )
          path.node.value = t.jsxExpressionContainer(wrapper)
        }
      }
    }
  }
}
