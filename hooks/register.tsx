import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { PetChatLine, PetLang, PetMood, PetStats, PetUi, PetUsage, PetView } from '../types'
import { MOOD_FACE, TEXT, langOfLocale, levelOf, nameOf, pick, tidy } from './i18n'
import type { Text } from './i18n'
import { drawPet } from './sprite'
import { SHOWN_WINDOWS, fmtReset, levelColor, meterSvg, quotaLevel } from './usage'

type Engine = EngineInterface

const STORE_KEY = 'stats'
const LANG_KEY = 'lang'
const QUOTA_KEY = 'quota'
const MINUTE = 60_000
const SLEEP_AFTER_MS = 10 * MINUTE
const HOLD_MS = 4500
const FULL_AT = 5
const DIGEST_MS = 40 * MINUTE
const COMMENT_GAP_MS = 40_000

// An empty name means the language's default one.
const DEFAULT_STATS: PetStats = {
  name: '',
  xp: 0,
  affection: 0,
  fed: 0,
  pets: 0,
  pokes: 0,
  turns: 0,
  fullness: 0,
  lastFedAt: 0,
}

const INITIAL_VIEW: PetView = { mood: 'idle', line: '…', seq: 0 }
const INITIAL_UI: PetUi = { isCollapsed: false, isChatOpen: false, isBusy: false }
const NO_CHAT: PetChatLine[] = []
const ENGLISH: PetLang = 'en'

const viewAtom = atom({ plugin: 'pixel-pet', key: 'view' } as const, INITIAL_VIEW)
const statsAtom = atom({ plugin: 'pixel-pet', key: 'stats' } as const, DEFAULT_STATS)
const uiAtom = atom({ plugin: 'pixel-pet', key: 'ui' } as const, INITIAL_UI)
const chatAtom = atom({ plugin: 'pixel-pet', key: 'chat' } as const, NO_CHAT)
const usageAtom = atom({ plugin: 'pixel-pet', key: 'usage' } as const, null as PetUsage | null)
const langAtom = atom({ plugin: 'pixel-pet', key: 'lang' } as const, ENGLISH)

type TurnInfo = { prompt: string; tools: Record<string, number>; errors: number }

const TOOL_MOODS: [RegExp, PetMood][] = [
  [/^(Bash|BashOutput|KillShell|PowerShell)$/, 'bash'],
  [/^(Read|Glob|Grep|LS|NotebookRead)$/, 'read'],
  [/^(Edit|MultiEdit|Write|NotebookEdit)$/, 'edit'],
  [/^(WebSearch|WebFetch)$|Browser|chrome/i, 'web'],
  [/^(Agent|Task)$/, 'agent'],
]

// The module's own variables start over on a reload; what draws lives in $.state.
let seq = 0
let lastActivity = Date.now()
let lastCommentAt = 0
let lastPetAt = 0
let pokeTimes: number[] = []
let isTired = false
let isSurfaceWorking = false
let turn: TurnInfo = { prompt: '', tools: {}, errors: 0 }

const moodForTool = (tool: string): PetMood =>
  TOOL_MOODS.find(([pattern]) => pattern.test(tool))?.[1] ?? 'thinking'

async function textOf($: Engine): Promise<Text> {
  return TEXT[await read($, langAtom)]
}

// A choice made with /pet lang wins; otherwise the locale decides.
async function detectLang($: Engine): Promise<PetLang> {
  const saved = await $.store.get(LANG_KEY)
  if (saved === 'zh' || saved === 'en') return saved

  const fromEnv = [await $.env.get('LC_ALL'), await $.env.get('LC_MESSAGES'), await $.env.get('LANG')].find(
    value => value !== undefined && value !== '' && value !== 'C' && value !== 'POSIX',
  )
  if (fromEnv !== undefined) return langOfLocale(fromEnv)
  try {
    return langOfLocale(Intl.DateTimeFormat().resolvedOptions().locale)
  } catch {
    return 'en'
  }
}

function greeting(stats: PetStats, text: Text): string {
  if (stats.lastFedAt > 0 && Date.now() - stats.lastFedAt > 6 * 60 * MINUTE) {
    return pick(text.lines.hungry)
  }

  return text.greeting(new Date().getHours())
}

// Shows a mood; with `holdMs` it falls back to the resting mood afterwards.
async function setMood($: Engine, mood: PetMood, line?: string, holdMs?: number) {
  const now = await read($, viewAtom)
  if (now.mood === mood && line === undefined && holdMs === undefined) return

  const text = await textOf($)
  seq += 1
  const mine = seq
  await update($, viewAtom, () => ({ mood, line: line ?? pick(text.lines[mood]), seq: mine }))
  if (holdMs !== undefined) {
    $.clock.after(holdMs, () => {
      if (seq === mine) void settle($)
    })
  }
}

// Back to the resting mood, keeping whatever was last said.
async function settle($: Engine) {
  const ui = await read($, uiAtom)
  const mood: PetMood = ui.isBusy ? 'thinking' : isTired ? 'tired' : 'idle'
  seq += 1
  const mine = seq
  await update($, viewAtom, view => ({ mood, line: view.line, seq: mine }))
}

async function say($: Engine, line: string) {
  await update($, viewAtom, view => ({ ...view, line }))
}

async function bumpStats($: Engine, change: (stats: PetStats) => PetStats) {
  const before = await read($, statsAtom)
  const after = await update($, statsAtom, change)
  await $.store.set(STORE_KEY, after)
  const level = levelOf(after.xp)
  if (level > levelOf(before.xp)) {
    const lang = await read($, langAtom)
    $.ui.toast(TEXT[lang].levelUp(nameOf(after, lang), level))
  }
}

async function ask($: Engine, prompt: string): Promise<string | null> {
  const stats = await read($, statsAtom)
  const lang = await read($, langAtom)
  const text = TEXT[lang]
  const reply = await $.model.complete({
    model: 'haiku',
    system: text.persona(nameOf(stats, lang), levelOf(stats.xp), stats.affection),
    prompt,
    maxTokens: 120,
    timeoutMs: 15_000,
  })

  return reply.isAnswered ? tidy(reply.text, text.maxLine) || null : null
}

async function commentOnTurn($: Engine, info: TurnInfo, durationMs: number) {
  const text = await textOf($)
  const tools =
    Object.entries(info.tools)
      .map(([tool, count]) => `${tool}×${count}`)
      .join(text.toolJoiner) || text.noTools
  const line = await ask($, text.turnPrompt(info.prompt, Math.round(durationMs / 1000), tools, info.errors))
  if (line !== null) await say($, line)
}

async function chat($: Engine, raw: string) {
  const message = raw.trim().slice(0, 200)
  if (message === '') return

  lastActivity = Date.now()
  const history = await update($, chatAtom, lines => [...lines, { from: 'me' as const, text: message }].slice(-8))
  await setMood($, 'chat', '…')
  const stats = await read($, statsAtom)
  const lang = await read($, langAtom)
  const text = TEXT[lang]
  const ui = await read($, uiAtom)
  const name = nameOf(stats, lang)
  const transcript = history.map(line => `${line.from === 'me' ? text.owner : name}: ${line.text}`).join('\n')
  const reply = (await ask($, text.chatPrompt(ui.isBusy, transcript))) ?? text.lostThought
  await update($, chatAtom, lines => [...lines, { from: 'pet' as const, text: reply }].slice(-8))
  await setMood($, 'chat', reply, 6000)
}

async function pet($: Engine) {
  const now = Date.now()
  lastActivity = now
  const view = await read($, viewAtom)
  const text = await textOf($)
  if (now - lastPetAt > 2000) {
    await bumpStats($, s => ({ ...s, pets: s.pets + 1, affection: s.affection + 1, xp: s.xp + 1 }))
  }
  lastPetAt = now
  await setMood($, 'pet', view.mood === 'sleep' ? pick(text.lines.wake) : undefined, HOLD_MS)
}

async function feed($: Engine) {
  const now = Date.now()
  lastActivity = now
  const stats = await read($, statsAtom)
  const fullness = Math.max(0, stats.fullness - Math.floor((now - stats.lastFedAt) / DIGEST_MS))
  if (fullness >= FULL_AT) {
    await setMood($, 'full', undefined, HOLD_MS)
    return
  }
  await bumpStats($, s => ({
    ...s,
    fullness: fullness + 1,
    lastFedAt: now,
    fed: s.fed + 1,
    affection: s.affection + 1,
    xp: s.xp + 2,
  }))
  await setMood($, 'eat', undefined, HOLD_MS)
}

async function poke($: Engine) {
  const now = Date.now()
  lastActivity = now
  pokeTimes = [...pokeTimes.filter(at => now - at < 10_000), now]
  const view = await read($, viewAtom)
  const text = await textOf($)
  await bumpStats($, s => ({ ...s, pokes: s.pokes + 1 }))
  if (view.mood === 'sleep') {
    await setMood($, 'poke', pick(text.lines.wake), 3000)
  } else if (pokeTimes.length >= 4) {
    await setMood($, 'error', pick(text.lines.grumpy), HOLD_MS)
  } else {
    await setMood($, 'poke', undefined, 2500)
  }
}

async function toggleCollapsed($: Engine) {
  await update($, uiAtom, u => ({ ...u, isCollapsed: !u.isCollapsed }))
}

async function toggleChat($: Engine) {
  await update($, uiAtom, u => ({ ...u, isChatOpen: !u.isChatOpen }))
}

// /pet lang: a fixed language is remembered across sessions, auto forgets it.
async function chooseLang($: Engine, choice: string): Promise<string> {
  if (choice === 'zh' || choice === 'en') {
    await $.store.set(LANG_KEY, choice)
  } else {
    await $.store.delete(LANG_KEY)
  }
  const lang = await detectLang($)
  await update($, langAtom, () => lang)
  const text = TEXT[lang]
  await say($, pick(text.lines[(await read($, viewAtom)).mood]))

  return text.command.lang(choice === 'zh' || choice === 'en' ? choice : `auto (${lang})`)
}

// A fresh snapshot each time also moves the reset countdowns on.
async function refreshUsage($: Engine) {
  const usage = await $.session.usage()
  const snapshot: PetUsage = {
    windows: usage.rateLimits
      .filter(limit => SHOWN_WINDOWS.includes(limit.kind))
      .map(limit => ({ kind: limit.kind, percent: limit.percentUsed, resetsAt: limit.resetsAt })),
    at: Date.now(),
  }
  await update($, usageAtom, () => snapshot)
}

// Each quota window's warning already given, for the window's current cycle.
type QuotaMemo = Record<string, { cycle: string; level: number }>

// Warns once per window and cycle at each level: 80%, then 95%.
async function warnQuota($: Engine, limits: readonly { kind: string; percentUsed: number; resetsAt?: string }[]) {
  const saved = await $.store.get(QUOTA_KEY)
  const memo: QuotaMemo = saved !== null && typeof saved === 'object' ? (saved as QuotaMemo) : {}
  const lang = await read($, langAtom)
  const text = TEXT[lang]
  let worst = 0
  let warning: string | undefined
  for (const limit of limits) {
    if (!SHOWN_WINDOWS.includes(limit.kind)) continue
    const level = quotaLevel(limit.percentUsed)
    worst = Math.max(worst, level)
    const cycle = (limit.resetsAt ?? '').slice(0, 16)
    const seen = memo[limit.kind]
    const warned = seen?.cycle === cycle ? seen.level : 0
    if (level > warned) {
      const stats = await read($, statsAtom)
      const reset = fmtReset(limit.resetsAt, Date.now(), text.durations)
      const window = text.windows[limit.kind] ?? limit.kind
      warning = text.nearLimit(nameOf(stats, lang), window, Math.round(limit.percentUsed), reset)
    }
    memo[limit.kind] = { cycle, level: Math.max(level, warned) }
  }
  await $.store.set(QUOTA_KEY, memo)

  const wasTired = isTired
  isTired = worst > 0
  const view = await read($, viewAtom)
  if (warning !== undefined) {
    $.ui.toast(warning)
    if (view.mood === 'idle') await setMood($, 'tired')
  } else if (isTired !== wasTired && view.mood === 'tired') {
    await settle($)
  }
}

async function tick($: Engine) {
  await refreshUsage($)
  const ui = await read($, uiAtom)
  const idleFor = Date.now() - lastActivity
  if (ui.isBusy) {
    // A turn whose completion never reached us: trust the surface.
    if (!isSurfaceWorking && idleFor > 2 * MINUTE) {
      await update($, uiAtom, u => ({ ...u, isBusy: false }))
      await settle($)
    }
    return
  }
  const view = await read($, viewAtom)
  if (idleFor > SLEEP_AFTER_MS && (view.mood === 'idle' || view.mood === 'tired')) {
    await setMood($, 'sleep')
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const lang = await detectLang($)
    await update($, langAtom, () => lang)
    const text = TEXT[lang]
    const saved = await $.store.get(STORE_KEY)
    const stats =
      saved !== null && typeof saved === 'object'
        ? { ...DEFAULT_STATS, ...(saved as Partial<PetStats>) }
        : DEFAULT_STATS
    await update($, statsAtom, () => stats)
    await update($, uiAtom, ui => ({ ...ui, isBusy: false }))
    await setMood($, 'idle', greeting(stats, text))
    await $.command.register({ name: 'pet', description: text.command.description, argumentHint: text.command.hint })
    await refreshUsage($)
    $.clock.every(30_000, () => void tick($))

    return next(e)
  })

  on('command.run', { command: 'pet' }, async ($, e) => {
    const [sub, ...rest] = e.args.trim().split(/\s+/)
    if (sub === 'lang') {
      return { text: await chooseLang($, rest[0] ?? 'auto') }
    }
    const text = await textOf($)
    if (sub === 'name' && rest.length > 0) {
      const name = rest.join(' ').slice(0, 12)
      await bumpStats($, s => ({ ...s, name }))
      await say($, text.command.renameLine(name))

      return { text: text.command.renamed(name) }
    }
    if (sub === 'stats') {
      const s = await read($, statsAtom)
      const lang = await read($, langAtom)

      return { text: text.command.stats(s, nameOf(s, lang), levelOf(s.xp)) }
    }
    await toggleCollapsed($)
    const ui = await read($, uiAtom)

    return { text: ui.isCollapsed ? text.command.collapsed : text.command.expanded }
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind !== 'task-notification') {
      turn = { prompt: e.text.trim().slice(0, 200), tools: {}, errors: 0 }
    }
    lastActivity = Date.now()
    const view = await read($, viewAtom)
    const text = await textOf($)
    await update($, uiAtom, ui => ({ ...ui, isBusy: true }))
    await setMood($, 'thinking', view.mood === 'sleep' ? pick(text.lines.wake) : undefined)

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    lastActivity = Date.now()
    turn.tools[e.tool] = (turn.tools[e.tool] ?? 0) + 1
    await setMood($, moodForTool(e.tool))
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError === true) {
      turn.errors += 1
      await setMood($, 'error', undefined, 3000)
    }

    return ran
  })

  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId !== undefined) return ran

    lastActivity = Date.now()
    await update($, uiAtom, ui => ({ ...ui, isBusy: false }))
    if (e.isAborted) {
      await setMood($, 'idle', (await textOf($)).stopped)
      return ran
    }
    await bumpStats($, s => ({ ...s, xp: s.xp + 3, turns: s.turns + 1 }))
    await setMood($, e.reason === 'error' ? 'error' : 'done', undefined, HOLD_MS)

    const toolCount = Object.values(turn.tools).reduce((sum, n) => sum + n, 0)
    const isWorthAComment = e.durationMs > 8000 || toolCount >= 2
    if (isWorthAComment && Date.now() - lastCommentAt > COMMENT_GAP_MS) {
      lastCommentAt = Date.now()
      const info = turn
      $.clock.after(1, () => void commentOnTurn($, info, e.durationMs))
    }

    return ran
  })

  on('session.measure', async ($, e, next) => {
    await refreshUsage($)
    await warnQuota($, e.rateLimits)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    isSurfaceWorking = e.props.isWorking
    if (e.props.hasSurvey) return next(e)

    const view = await read($, viewAtom)
    const stats = await read($, statsAtom)
    const ui = await read($, uiAtom)
    const usage = await read($, usageAtom)
    const lang = await read($, langAtom)
    const text = TEXT[lang]
    const name = nameOf(stats, lang)
    const label = text.moodLabel[view.mood]
    const head = `${name} Lv.${levelOf(stats.xp)} · ♥${stats.affection} · ${label}`
    const windowName = (kind: string) => text.windows[kind] ?? kind

    if (e.surface === 'desktop') {
      const { Box, Button, Input, Svg, Text } = $.ui.resolve(e)
      const svg = drawPet(view.mood, text.petMe)
      const alt = `${name}: ${label}`
      const sep = <Text dimColor>│</Text>
      const usageGroup =
        usage === null ? null : (
          <Box flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
            {usage.windows.map((w, i) => {
              const reset = fmtReset(w.resetsAt, usage.at, text.durations)

              return (
                <Box key={w.kind} flexDirection="row" gap={1} alignItems="center">
                  {i > 0 && sep}
                  <Text bold>{windowName(w.kind)}</Text>
                  <Svg source={meterSvg(w.percent)} alt={text.used(w.percent)} width={39} height={8} />
                  <Text color={levelColor(w.percent)}>{Math.round(w.percent)}%</Text>
                  {reset !== '' && <Text dimColor>{text.resetIn(reset)}</Text>}
                </Box>
              )
            })}
          </Box>
        )

      if (ui.isCollapsed) {
        return (
          // Only the picture and one column at this level, as in the expanded
          // band: a Button beside them here lays the row out off-centre.
          <Box flexDirection="row" gap={2} alignItems="stretch">
            <Svg source={svg} alt={alt} width={132} height={84} isInteractive />
            <Box flexDirection="column" gap={1} flexGrow={1} justifyContent="space-between">
              <Box flexDirection="row" gap={1} alignItems="center" justifyContent="space-between">
                <Text dimColor>{head}</Text>
                <Button key="expand" label={text.buttons.expand} plain onPress={() => void toggleCollapsed($)} />
              </Box>
              {usageGroup}
            </Box>
          </Box>
        )
      }

      return (
        // Stretched rows share the picture's height; space-between puts the first
        // line on the frame's top edge and the last on its bottom edge.
        <Box flexDirection="row" gap={2} alignItems="stretch">
          <Svg source={svg} alt={alt} width={176} height={112} isInteractive />
          <Box flexDirection="column" gap={1} flexGrow={1} justifyContent="space-between">
            <Text dimColor>{head}</Text>
            <Text bold color="#D97757">
              {text.quote(view.line)}
            </Text>
            <Box flexDirection="row" gap={2} flexWrap="wrap" alignItems="center" justifyContent="space-between">
              <Box flexDirection="row" gap={1}>
                <Button key="pet" label={text.buttons.pet} onPress={() => void pet($)} />
                <Button key="feed" label={text.buttons.feed} onPress={() => void feed($)} />
                <Button key="poke" label={text.buttons.poke} onPress={() => void poke($)} />
                <Button
                  key="chat"
                  label={ui.isChatOpen ? text.buttons.stopChat : text.buttons.chat}
                  onPress={() => void toggleChat($)}
                />
                <Button key="collapse" label={text.buttons.collapse} plain onPress={() => void toggleCollapsed($)} />
              </Box>
              {usageGroup}
            </Box>
            {ui.isChatOpen && (
              <Input
                key="say"
                placeholder={text.placeholder(name)}
                submitLabel={text.buttons.send}
                onSubmit={value => void chat($, value)}
              />
            )}
          </Box>
        </Box>
      )
    }

    if (e.surface === 'terminal') {
      const { Box, Button, Input, Text } = $.ui.resolve(e)

      if (ui.isCollapsed) {
        return (
          <Box flexDirection="row" gap={1}>
            <Text color="#D97757">{MOOD_FACE[view.mood]}</Text>
            <Button key="expand" label={text.buttons.expand} plain onPress={() => void toggleCollapsed($)} />
          </Box>
        )
      }

      return (
        <Box flexDirection="column">
          <Box flexDirection="row" gap={1}>
            <Text color="#D97757" bold>
              {MOOD_FACE[view.mood]}
            </Text>
            <Text>{text.quote(view.line)}</Text>
            <Text dimColor>{head}</Text>
          </Box>
          <Box flexDirection="row" gap={1}>
            <Button key="pet" label={text.buttons.pet} hotkey="1" onPress={() => void pet($)} />
            <Button key="feed" label={text.buttons.feed} hotkey="2" onPress={() => void feed($)} />
            <Button key="poke" label={text.buttons.poke} hotkey="3" onPress={() => void poke($)} />
            <Button
              key="chat"
              label={ui.isChatOpen ? text.buttons.stopChat : text.buttons.chat}
              hotkey="4"
              onPress={() => void toggleChat($)}
            />
            <Button key="collapse" label={text.buttons.collapse} hotkey="5" onPress={() => void toggleCollapsed($)} />
          </Box>
          {usage !== null && (
            <Text dimColor>
              {usage.windows
                .map(
                  w =>
                    `${windowName(w.kind)} ${Math.round(w.percent)}% ↻${fmtReset(w.resetsAt, usage.at, text.durations)}`,
                )
                .join(' │ ')}
            </Text>
          )}
          {ui.isChatOpen && <Input key="say" placeholder={text.placeholder(name)} onSubmit={value => void chat($, value)} />}
        </Box>
      )
    }

    return next(e)
  })
}
