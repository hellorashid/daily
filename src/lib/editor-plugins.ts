import { RangeSetBuilder } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import {
  Decoration,
  EditorView,
  type DecorationSet,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from '@codemirror/view'

const INLINE_MARK_NAMES = new Set([
  'CodeMark',
  'EmphasisMark',
  'LinkMark',
  'StrikethroughMark',
])

const lineClassCache = new Map<string, Decoration>()

function getLineClassDecoration(className: string) {
  let decoration = lineClassCache.get(className)

  if (!decoration) {
    decoration = Decoration.line({
      attributes: {
        class: className,
      },
    })
    lineClassCache.set(className, decoration)
  }

  return decoration
}

function getActiveLineNumbers(view: EditorView) {
  const activeLines = new Set<number>()

  if (!view.hasFocus) {
    return activeLines
  }

  for (const range of view.state.selection.ranges) {
    const startLine = view.state.doc.lineAt(range.from).number
    const endLine = view.state.doc.lineAt(Math.max(range.from, range.to)).number

    for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
      activeLines.add(lineNumber)
    }
  }

  return activeLines
}

class BulletMarkerWidget extends WidgetType {
  private readonly indentSpaces: number

  constructor(indentSpaces: number) {
    super()
    this.indentSpaces = indentSpaces
  }

  override eq(other: BulletMarkerWidget) {
    return other.indentSpaces === this.indentSpaces
  }

  override toDOM() {
    const marker = document.createElement('span')
    marker.className = 'cm-preview-list-marker'
    marker.style.width = `calc(${this.indentSpaces}ch + 1.1rem)`
    marker.textContent = '•'
    return marker
  }
}

class NumberMarkerWidget extends WidgetType {
  private readonly indentSpaces: number
  private readonly marker: string

  constructor(
    indentSpaces: number,
    marker: string,
  ) {
    super()
    this.indentSpaces = indentSpaces
    this.marker = marker
  }

  override eq(other: NumberMarkerWidget) {
    return (
      other.indentSpaces === this.indentSpaces &&
      other.marker === this.marker
    )
  }

  override toDOM() {
    const marker = document.createElement('span')
    marker.className = 'cm-preview-list-marker cm-preview-number-marker'
    marker.style.width = `calc(${this.indentSpaces}ch + ${Math.max(this.marker.length, 2)}ch + 0.55rem)`
    marker.textContent = this.marker
    return marker
  }
}

class TaskMarkerWidget extends WidgetType {
  private readonly indentSpaces: number
  private readonly isChecked: boolean
  private readonly togglePosition: number

  constructor(
    indentSpaces: number,
    isChecked: boolean,
    togglePosition: number,
  ) {
    super()
    this.indentSpaces = indentSpaces
    this.isChecked = isChecked
    this.togglePosition = togglePosition
  }

  override eq(other: TaskMarkerWidget) {
    return (
      other.indentSpaces === this.indentSpaces &&
      other.isChecked === this.isChecked &&
      other.togglePosition === this.togglePosition
    )
  }

  override toDOM(view: EditorView) {
    const wrapper = document.createElement('span')
    wrapper.className = 'cm-preview-task-marker'
    wrapper.style.width = `calc(${this.indentSpaces}ch + 1.45rem)`

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'cm-preview-task-toggle'
    button.setAttribute('aria-label', this.isChecked ? 'Mark task incomplete' : 'Mark task complete')
    button.setAttribute('aria-checked', String(this.isChecked))

    if (this.isChecked) {
      button.classList.add('is-checked')
    }

    button.addEventListener('mousedown', (event) => {
      event.preventDefault()
    })

    button.addEventListener('click', (event) => {
      event.preventDefault()

      view.dispatch({
        changes: {
          from: this.togglePosition,
          to: this.togglePosition + 1,
          insert: this.isChecked ? ' ' : 'x',
        },
      })

      view.focus()
    })

    wrapper.append(button)
    return wrapper
  }
}

class DividerWidget extends WidgetType {
  override eq() {
    return true
  }

  override toDOM() {
    const divider = document.createElement('span')
    divider.className = 'cm-preview-divider'
    return divider
  }
}

const hiddenStructuralMark = Decoration.replace({})
const hiddenInlineMark = Decoration.replace({})
const hiddenHtmlBreak = Decoration.replace({})

const hiddenHtmlBreakLine = getLineClassDecoration('cm-hidden-html-break-line')
const previewDividerLine = getLineClassDecoration('cm-preview-divider-line')
const previewQuoteLine = getLineClassDecoration('cm-preview-quote-line')

function buildLineDecorations(
  builder: RangeSetBuilder<Decoration>,
  view: EditorView,
) {
  for (const visibleRange of view.visibleRanges) {
    let position = visibleRange.from

    while (position <= visibleRange.to) {
      const line = view.state.doc.lineAt(position)

      if (/^\s*<\/?br\s*\/?>\s*$/i.test(line.text)) {
        builder.add(line.from, line.from, hiddenHtmlBreakLine)
        builder.add(line.from, line.to, hiddenHtmlBreak)
        position = line.to + 1
        continue
      }

      if (/^\s*(?:-{3,}|\*{3,}|_{3,}|(?:-\s+){2,}-?|(?:\*\s+){2,}\*?|(?:_\s+){2,}_?)\s*$/.test(line.text)) {
        builder.add(line.from, line.from, previewDividerLine)
        builder.add(
          line.from,
          line.to,
          Decoration.replace({
            widget: new DividerWidget(),
          }),
        )
        position = line.to + 1
        continue
      }

      const headingMatch = line.text.match(/^( {0,3})(#{1,6})(\s+)/)

      if (headingMatch) {
        const markerStart = line.from + headingMatch[1].length
        const markerEnd =
          markerStart + headingMatch[2].length + headingMatch[3].length

        builder.add(
          line.from,
          line.from,
          getLineClassDecoration(
            `cm-preview-heading cm-preview-heading-${headingMatch[2].length}`,
          ),
        )
        builder.add(markerStart, markerEnd, hiddenStructuralMark)
      }

      const quoteMatch = line.text.match(/^(\s*(?:>\s*)+)/)

      if (quoteMatch) {
        builder.add(line.from, line.from, previewQuoteLine)
        builder.add(
          line.from,
          line.from + quoteMatch[1].length,
          hiddenStructuralMark,
        )
      }

      const taskMatch = line.text.match(/^(\s*)[-*]\s+\[( |x|X)\](\s+)/)

      if (taskMatch) {
        const prefixText = taskMatch[0]
        const checkboxPosition = line.from + prefixText.indexOf('[') + 1

        builder.add(
          line.from,
          line.from,
          getLineClassDecoration(
            taskMatch[2].toLowerCase() === 'x'
              ? 'cm-preview-task-line cm-preview-task-line-checked'
              : 'cm-preview-task-line',
          ),
        )
        builder.add(
          line.from,
          line.from + prefixText.length,
          Decoration.replace({
            widget: new TaskMarkerWidget(
              taskMatch[1].length,
              taskMatch[2].toLowerCase() === 'x',
              checkboxPosition,
            ),
          }),
        )
      } else {
        const bulletMatch = line.text.match(/^(\s*)[-*]\s+/)

        if (bulletMatch) {
          builder.add(
            line.from,
            line.from,
            getLineClassDecoration('cm-preview-list-line'),
          )
          builder.add(
            line.from,
            line.from + bulletMatch[0].length,
            Decoration.replace({
              widget: new BulletMarkerWidget(bulletMatch[1].length),
            }),
          )
        }

        const numberMatch = line.text.match(/^(\s*)(\d+\.)\s+/)

        if (numberMatch) {
          builder.add(
            line.from,
            line.from,
            getLineClassDecoration('cm-preview-list-line'),
          )
          builder.add(
            line.from,
            line.from + numberMatch[0].length,
            Decoration.replace({
              widget: new NumberMarkerWidget(
                numberMatch[1].length,
                numberMatch[2],
              ),
            }),
          )
        }
      }

      position = line.to + 1
    }
  }
}

function buildInlineDecorations(
  builder: RangeSetBuilder<Decoration>,
  view: EditorView,
  activeLines: Set<number>,
) {
  for (const visibleRange of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from: visibleRange.from,
      to: visibleRange.to,
      enter: (node) => {
        if (!INLINE_MARK_NAMES.has(node.name)) {
          return
        }

        const lineNumber = view.state.doc.lineAt(node.from).number

        if (activeLines.has(lineNumber)) {
          return
        }

        builder.add(node.from, node.to, hiddenInlineMark)
      },
    })
  }
}

function buildMarkdownPresentationDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const activeLines = getActiveLineNumbers(view)

  buildLineDecorations(builder, view)
  buildInlineDecorations(builder, view, activeLines)

  return builder.finish()
}

export const markdownPresentationExtension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildMarkdownPresentationDecorations(view)
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.focusChanged ||
        update.selectionSet ||
        update.viewportChanged
      ) {
        this.decorations = buildMarkdownPresentationDecorations(update.view)
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  },
)
