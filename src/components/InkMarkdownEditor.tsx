import {
  Compartment,
  EditorState,
  type Extension,
} from '@codemirror/state'
import {
  defaultKeymap,
  history,
  historyKeymap,
} from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import {
  HighlightStyle,
  syntaxHighlighting,
} from '@codemirror/language'
import { tags } from '@lezer/highlight'
import {
  EditorView,
  keymap,
  placeholder as placeholderExtension,
} from '@codemirror/view'
import { useEffect, useEffectEvent, useRef } from 'react'

import { markdownPresentationExtension } from '../lib/editor-plugins'
import type { ResolvedTheme } from '../lib/types'

type InkMarkdownEditorProps = {
  className?: string
  documentKey: string
  isLoading: boolean
  onBlur: () => void
  onChange: (value: string) => void
  theme: ResolvedTheme
  value: string
}

const editableCompartment = new Compartment()
const placeholderCompartment = new Compartment()
const themeCompartment = new Compartment()

const markdownHighlightStyle = HighlightStyle.define([
  {
    tag: tags.heading,
    color: 'var(--ink)',
    fontFamily: 'var(--display)',
    fontWeight: '520',
  },
  {
    tag: tags.heading1,
    color: 'var(--ink)',
    fontFamily: 'var(--display)',
    fontSize: '1.42em',
    fontWeight: '520',
  },
  {
    tag: tags.heading2,
    color: 'var(--ink)',
    fontFamily: 'var(--display)',
    fontSize: '1.24em',
    fontWeight: '520',
  },
  {
    tag: tags.heading3,
    color: 'var(--ink)',
    fontFamily: 'var(--display)',
    fontSize: '1.14em',
    fontWeight: '520',
  },
  {
    tag: tags.strong,
    fontWeight: '600',
  },
  {
    tag: tags.emphasis,
    fontStyle: 'italic',
  },
  {
    tag: [tags.link, tags.url],
    color: 'var(--ink)',
    textDecoration: 'underline',
    textDecorationColor: 'var(--editor-link-underline)',
    textUnderlineOffset: '0.16em',
  },
  {
    tag: tags.monospace,
    fontFamily: 'var(--mono)',
    fontSize: '0.94em',
  },
  {
    tag: tags.quote,
    color: 'color-mix(in srgb, var(--ink) 72%, var(--muted))',
  },
  {
    tag: tags.processingInstruction,
    color: 'var(--muted)',
  },
])

function createEditorTheme(theme: ResolvedTheme) {
  return EditorView.theme(
    {
      '&': {
        height: '100%',
        backgroundColor: 'transparent',
        color: 'var(--ink)',
        fontFamily: 'var(--sans)',
        fontSize: '12.75px',
      },
      '.cm-scroller': {
        overflow: 'auto',
        padding: '8px 12px 18px',
      },
      '.cm-content': {
        minHeight: '100%',
        padding: '0',
        whiteSpace: 'pre-wrap',
        caretColor: 'var(--ink)',
      },
      '.cm-line': {
        padding: '0',
        lineHeight: '1.68',
      },
      '.cm-focused': {
        outline: 'none',
      },
      '.cm-editor': {
        height: '100%',
      },
      '.cm-placeholder': {
        color: 'var(--muted)',
        whiteSpace: 'pre-wrap',
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: 'var(--ink)',
      },
      '.cm-selectionBackground, ::selection': {
        backgroundColor: 'var(--editor-selection)',
      },
    },
    { dark: theme === 'dark' },
  )
}

function createPlaceholder(loading: boolean) {
  const placeholder = document.createElement('div')
  placeholder.className = 'daily-editor-placeholder'

  if (loading) {
    placeholder.textContent = 'Loading note…'
    return placeholder
  }

  placeholder.textContent = 'whatsup?'
  return placeholder
}

function buildExtensions(
  isLoading: boolean,
  onChange: (value: string) => void,
  onBlur: () => void,
  theme: ResolvedTheme,
): Extension[] {
  return [
    keymap.of([...defaultKeymap, ...historyKeymap]),
    history(),
    markdown({ base: markdownLanguage }),
    EditorView.lineWrapping,
    syntaxHighlighting(markdownHighlightStyle),
    themeCompartment.of(createEditorTheme(theme)),
    markdownPresentationExtension,
    EditorView.contentAttributes.of({
      spellcheck: 'true',
      autocapitalize: 'sentences',
    }),
    EditorView.domEventHandlers({
      blur: () => {
        onBlur()
        return false
      },
    }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString())
      }
    }),
    editableCompartment.of(EditorView.editable.of(!isLoading)),
    placeholderCompartment.of(placeholderExtension(createPlaceholder(isLoading))),
  ]
}

export function InkMarkdownEditor({
  className,
  documentKey,
  isLoading,
  onBlur,
  onChange,
  theme,
  value,
}: InkMarkdownEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const editorViewRef = useRef<EditorView | null>(null)
  const initialLoadingRef = useRef(isLoading)
  const initialThemeRef = useRef(theme)
  const latestValueRef = useRef(value)

  const handleChange = useEffectEvent((nextValue: string) => {
    latestValueRef.current = nextValue
    onChange(nextValue)
  })

  const handleBlur = useEffectEvent(() => {
    onBlur()
  })

  useEffect(() => {
    latestValueRef.current = value
  }, [value])

  useEffect(() => {
    const host = hostRef.current

    if (!host || editorViewRef.current) {
      return
    }

    const state = EditorState.create({
      doc: latestValueRef.current,
      extensions: buildExtensions(
        initialLoadingRef.current,
        handleChange,
        handleBlur,
        initialThemeRef.current,
      ),
    })

    const view = new EditorView({
      parent: host,
      state,
    })

    editorViewRef.current = view

    return () => {
      view.destroy()
      editorViewRef.current = null
    }
  }, [])

  useEffect(() => {
    const view = editorViewRef.current

    if (!view) {
      return
    }

    view.dispatch({
      effects: [
        editableCompartment.reconfigure(EditorView.editable.of(!isLoading)),
        placeholderCompartment.reconfigure(
          placeholderExtension(createPlaceholder(isLoading)),
        ),
      ],
    })
  }, [isLoading])

  useEffect(() => {
    const view = editorViewRef.current

    if (!view) {
      return
    }

    view.dispatch({
      effects: themeCompartment.reconfigure(createEditorTheme(theme)),
    })
  }, [theme])

  useEffect(() => {
    const view = editorViewRef.current

    if (!view) {
      return
    }

    const currentValue = view.state.doc.toString()

    if (currentValue === value) {
      return
    }

    view.dispatch({
      changes: {
        from: 0,
        to: currentValue.length,
        insert: value,
      },
    })
  }, [documentKey, value])

  return <div className={className} ref={hostRef} />
}
