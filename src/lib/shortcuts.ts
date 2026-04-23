import type { WindowOpenShortcutSetting } from './types'

type ShortcutModifier = 'Command' | 'Control' | 'Option' | 'Shift'

type ShortcutKey = {
  display: string
  spoken: string
  stored: string
}

export type ShortcutDefinition = {
  displayParts: string[]
  modifiers: ShortcutModifier[]
  shortcut: WindowOpenShortcutSetting
  spokenLabel: string
}

export const DEFAULT_WINDOW_OPEN_SHORTCUT: WindowOpenShortcutSetting = 'Command+Option+D'
export const WINDOW_OPEN_SHORTCUT_DISABLED: WindowOpenShortcutSetting = 'off'

const MODIFIER_ORDER: ShortcutModifier[] = ['Command', 'Control', 'Option', 'Shift']
const MODIFIER_KEYS = new Set([
  'Alt',
  'Control',
  'Meta',
  'Shift',
  'AltGraph',
  'CapsLock',
])

const MODIFIER_DISPLAY: Record<ShortcutModifier, string> = {
  Command: '⌘',
  Control: '⌃',
  Option: '⌥',
  Shift: '⇧',
}

const MODIFIER_ALIASES = new Map<string, ShortcutModifier>([
  ['ALT', 'Option'],
  ['COMMAND', 'Command'],
  ['COMMANDORCONTROL', 'Command'],
  ['COMMANDORCTRL', 'Command'],
  ['CMD', 'Command'],
  ['CMDORCONTROL', 'Command'],
  ['CMDORCTRL', 'Command'],
  ['CONTROL', 'Control'],
  ['CTRL', 'Control'],
  ['OPTION', 'Option'],
  ['SHIFT', 'Shift'],
  ['SUPER', 'Command'],
])

const SPECIAL_KEYS = new Map<string, ShortcutKey>([
  ['ARROWDOWN', { stored: 'ArrowDown', display: '↓', spoken: 'Down Arrow' }],
  ['ARROWLEFT', { stored: 'ArrowLeft', display: '←', spoken: 'Left Arrow' }],
  ['ARROWRIGHT', { stored: 'ArrowRight', display: '→', spoken: 'Right Arrow' }],
  ['ARROWUP', { stored: 'ArrowUp', display: '↑', spoken: 'Up Arrow' }],
  ['BACKQUOTE', { stored: 'Backquote', display: '`', spoken: 'Backquote' }],
  ['BACKSLASH', { stored: 'Backslash', display: '\\', spoken: 'Backslash' }],
  ['BACKSPACE', { stored: 'Backspace', display: '⌫', spoken: 'Backspace' }],
  ['BRACKETLEFT', { stored: 'BracketLeft', display: '[', spoken: 'Left Bracket' }],
  ['BRACKETRIGHT', { stored: 'BracketRight', display: ']', spoken: 'Right Bracket' }],
  ['COMMA', { stored: 'Comma', display: ',', spoken: 'Comma' }],
  ['DELETE', { stored: 'Delete', display: '⌦', spoken: 'Delete' }],
  ['END', { stored: 'End', display: 'End', spoken: 'End' }],
  ['ENTER', { stored: 'Enter', display: '↩', spoken: 'Enter' }],
  ['EQUAL', { stored: 'Equal', display: '=', spoken: 'Equals' }],
  ['ESC', { stored: 'Escape', display: 'Esc', spoken: 'Escape' }],
  ['ESCAPE', { stored: 'Escape', display: 'Esc', spoken: 'Escape' }],
  ['HOME', { stored: 'Home', display: 'Home', spoken: 'Home' }],
  ['LEFT', { stored: 'ArrowLeft', display: '←', spoken: 'Left Arrow' }],
  ['MINUS', { stored: 'Minus', display: '-', spoken: 'Minus' }],
  ['PAGEDOWN', { stored: 'PageDown', display: 'PgDn', spoken: 'Page Down' }],
  ['PAGEUP', { stored: 'PageUp', display: 'PgUp', spoken: 'Page Up' }],
  ['PERIOD', { stored: 'Period', display: '.', spoken: 'Period' }],
  ['QUOTE', { stored: 'Quote', display: '\'', spoken: 'Quote' }],
  ['RETURN', { stored: 'Enter', display: '↩', spoken: 'Enter' }],
  ['RIGHT', { stored: 'ArrowRight', display: '→', spoken: 'Right Arrow' }],
  ['SEMICOLON', { stored: 'Semicolon', display: ';', spoken: 'Semicolon' }],
  ['SLASH', { stored: 'Slash', display: '/', spoken: 'Slash' }],
  ['SPACE', { stored: 'Space', display: 'Space', spoken: 'Space' }],
  ['SPACEBAR', { stored: 'Space', display: 'Space', spoken: 'Space' }],
  ['TAB', { stored: 'Tab', display: '⇥', spoken: 'Tab' }],
  ['UP', { stored: 'ArrowUp', display: '↑', spoken: 'Up Arrow' }],
])

const KEY_ALIASES = new Map<string, ShortcutKey>([
  ['`', { stored: 'Backquote', display: '`', spoken: 'Backquote' }],
  ['\\', { stored: 'Backslash', display: '\\', spoken: 'Backslash' }],
  ['[', { stored: 'BracketLeft', display: '[', spoken: 'Left Bracket' }],
  [']', { stored: 'BracketRight', display: ']', spoken: 'Right Bracket' }],
  [',', { stored: 'Comma', display: ',', spoken: 'Comma' }],
  ['=', { stored: 'Equal', display: '=', spoken: 'Equals' }],
  ['-', { stored: 'Minus', display: '-', spoken: 'Minus' }],
  ['.', { stored: 'Period', display: '.', spoken: 'Period' }],
  ['\'', { stored: 'Quote', display: '\'', spoken: 'Quote' }],
  [';', { stored: 'Semicolon', display: ';', spoken: 'Semicolon' }],
  ['/', { stored: 'Slash', display: '/', spoken: 'Slash' }],
])

function buildShortcutDefinition(
  modifiers: ShortcutModifier[],
  key: ShortcutKey,
): ShortcutDefinition {
  const orderedModifiers = MODIFIER_ORDER.filter((modifier) => modifiers.includes(modifier))
  const shortcut = [...orderedModifiers, key.stored].join('+') as WindowOpenShortcutSetting

  return {
    displayParts: [...orderedModifiers.map((modifier) => MODIFIER_DISPLAY[modifier]), key.display],
    modifiers: orderedModifiers,
    shortcut,
    spokenLabel: [...orderedModifiers, key.spoken].join(' + '),
  }
}

function normalizeKeyToken(token: string): ShortcutKey | null {
  const trimmed = token.trim()

  if (!trimmed) {
    return null
  }

  const upper = trimmed.toUpperCase()

  if (/^KEY[A-Z]$/.test(upper)) {
    const letter = upper.slice(3)
    return { stored: letter, display: letter, spoken: letter }
  }

  if (/^[A-Z]$/.test(upper)) {
    return { stored: upper, display: upper, spoken: upper }
  }

  if (/^DIGIT[0-9]$/.test(upper)) {
    const digit = upper.slice(5)
    return { stored: digit, display: digit, spoken: digit }
  }

  if (/^[0-9]$/.test(upper)) {
    return { stored: upper, display: upper, spoken: upper }
  }

  if (/^F[0-9]{1,2}$/.test(upper)) {
    return { stored: upper, display: upper, spoken: upper }
  }

  return SPECIAL_KEYS.get(upper) ?? KEY_ALIASES.get(trimmed) ?? null
}

function normalizeModifierToken(token: string): ShortcutModifier | null {
  return MODIFIER_ALIASES.get(token.trim().toUpperCase()) ?? null
}

function keyFromEvent(event: KeyboardEvent): ShortcutKey | null {
  if (MODIFIER_KEYS.has(event.key)) {
    return null
  }

  if (/^Key[A-Z]$/.test(event.code)) {
    const letter = event.code.slice(3)
    return { stored: letter, display: letter, spoken: letter }
  }

  if (/^Digit[0-9]$/.test(event.code)) {
    const digit = event.code.slice(5)
    return { stored: digit, display: digit, spoken: digit }
  }

  if (/^F[0-9]{1,2}$/.test(event.code)) {
    return {
      stored: event.code.toUpperCase(),
      display: event.code.toUpperCase(),
      spoken: event.code.toUpperCase(),
    }
  }

  const mappedCode = normalizeKeyToken(event.code)

  if (mappedCode) {
    return mappedCode
  }

  return normalizeKeyToken(event.key)
}

export function parseShortcutSetting(
  shortcut: string | null | undefined,
): ShortcutDefinition | null {
  if (typeof shortcut !== 'string') {
    return null
  }

  const tokens = shortcut.split('+').map((token) => token.trim()).filter(Boolean)

  if (tokens.length === 0) {
    return null
  }

  const modifiers: ShortcutModifier[] = []
  let key: ShortcutKey | null = null

  for (const token of tokens) {
    const modifier = normalizeModifierToken(token)

    if (modifier) {
      if (key) {
        return null
      }

      if (!modifiers.includes(modifier)) {
        modifiers.push(modifier)
      }

      continue
    }

    if (key) {
      return null
    }

    key = normalizeKeyToken(token)

    if (!key) {
      return null
    }
  }

  if (!key || modifiers.length === 0) {
    return null
  }

  return buildShortcutDefinition(modifiers, key)
}

export function getShortcutDefinition(
  shortcut: WindowOpenShortcutSetting | null | undefined,
): ShortcutDefinition {
  return parseShortcutSetting(shortcut)
    ?? parseShortcutSetting(DEFAULT_WINDOW_OPEN_SHORTCUT)!
}

export function isWindowOpenShortcutDisabled(
  shortcut: WindowOpenShortcutSetting | null | undefined,
) {
  return typeof shortcut === 'string' && shortcut.trim().toLowerCase() === WINDOW_OPEN_SHORTCUT_DISABLED
}

export function normalizeWindowOpenShortcutSetting(
  shortcut: string | null | undefined,
): WindowOpenShortcutSetting | null {
  if (isWindowOpenShortcutDisabled(shortcut)) {
    return WINDOW_OPEN_SHORTCUT_DISABLED
  }

  return parseShortcutSetting(shortcut)?.shortcut ?? null
}

export function shortcutFromKeyboardEvent(event: KeyboardEvent): ShortcutDefinition | null {
  const modifiers: ShortcutModifier[] = []

  if (event.metaKey) {
    modifiers.push('Command')
  }

  if (event.ctrlKey) {
    modifiers.push('Control')
  }

  if (event.altKey) {
    modifiers.push('Option')
  }

  if (event.shiftKey) {
    modifiers.push('Shift')
  }

  if (modifiers.length === 0) {
    return null
  }

  const key = keyFromEvent(event)

  if (!key) {
    return null
  }

  return buildShortcutDefinition(modifiers, key)
}
