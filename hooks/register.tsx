import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { PetChatLine, PetMood, PetStats, PetUi, PetUsage, PetView } from '../types'
import { LINES, MOOD_FACE, MOOD_LABEL, levelOf, persona, pick, tidy } from './lines'
import { drawPet } from './sprite'
import { fmtReset, fmtTokens, levelColor, meterSvg, windowLabel } from './usage'

type Engine = EngineInterface

const STORE_KEY = 'stats'
const MINUTE = 60_000
const SLEEP_AFTER_MS = 10 * MINUTE
const HOLD_MS = 4500
const FULL_AT = 5
const DIGEST_MS = 40 * MINUTE
const COMMENT_GAP_MS = 40_000

const DEFAULT_STATS: PetStats = {
  name: '小克',
  xp: 0,
  affection: 0,
  fed: 0,
  pets: 0,
  pokes: 0,
  turns: 0,
  fullness: 0,
  lastFedAt: 0,
}

const INITIAL_VIEW: PetView = { mood: 'idle', line: '你好呀，我是小克！', seq: 0 }
const INITIAL_UI: PetUi = { isCollapsed: false, isChatOpen: false, isBusy: false }
const NO_CHAT: PetChatLine[] = []

const viewAtom = atom({ plugin: 'pixel-pet', key: 'view' } as const, INITIAL_VIEW)
const statsAtom = atom({ plugin: 'pixel-pet', key: 'stats' } as const, DEFAULT_STATS)
const uiAtom = atom({ plugin: 'pixel-pet', key: 'ui' } as const, INITIAL_UI)
const chatAtom = atom({ plugin: 'pixel-pet', key: 'chat' } as const, NO_CHAT)
const usageAtom = atom({ plugin: 'pixel-pet', key: 'usage' } as const, null as PetUsage | null)

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

function greeting(stats: PetStats): string {
  if (stats.lastFedAt > 0 && Date.now() - stats.lastFedAt > 6 * 60 * MINUTE) {
    return pick(LINES.hungry)
  }
  const hour = new Date().getHours()
  if (hour < 6) return '这么晚还在忙呀…'
  if (hour < 11) return '早上好！今天做点啥？'
  if (hour < 14) return '中午好～吃饭了吗'
  if (hour < 19) return '下午好，继续加油'

  return '晚上好，我陪着你'
}

// Shows a mood; with `holdMs` it falls back to the resting mood afterwards.
async function setMood($: Engine, mood: PetMood, line?: string, holdMs?: number) {
  const now = await read($, viewAtom)
  if (now.mood === mood && line === undefined && holdMs === undefined) return

  seq += 1
  const mine = seq
  await update($, viewAtom, () => ({ mood, line: line ?? pick(LINES[mood]), seq: mine }))
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
    $.ui.toast(`${after.name} 升到 Lv.${level} 啦！`)
  }
}

async function ask($: Engine, prompt: string): Promise<string | null> {
  const stats = await read($, statsAtom)
  const reply = await $.model.complete({
    model: 'haiku',
    system: persona(stats),
    prompt,
    maxTokens: 120,
    timeoutMs: 15_000,
  })

  return reply.isAnswered ? tidy(reply.text) || null : null
}

async function commentOnTurn($: Engine, info: TurnInfo, durationMs: number) {
  const tools =
    Object.entries(info.tools)
      .map(([tool, count]) => `${tool}×${count}`)
      .join('、') || '没用工具'
  const text = await ask(
    $,
    `主人刚让 Claude 做了这件事：「${info.prompt || '（没写具体内容）'}」\n` +
      `Claude 用了 ${Math.round(durationMs / 1000)} 秒，工具：${tools}，出错 ${info.errors} 次。\n` +
      '请你对这一轮说一句感想或鼓励。',
  )
  if (text !== null) await say($, text)
}

async function chat($: Engine, raw: string) {
  const text = raw.trim().slice(0, 200)
  if (text === '') return

  lastActivity = Date.now()
  const history = await update($, chatAtom, lines => [...lines, { from: 'me' as const, text }].slice(-8))
  await setMood($, 'chat', '…')
  const stats = await read($, statsAtom)
  const ui = await read($, uiAtom)
  const transcript = history
    .map(line => `${line.from === 'me' ? '主人' : stats.name}：${line.text}`)
    .join('\n')
  const reply =
    (await ask(
      $,
      `${ui.isBusy ? '（Claude 正在干活）\n' : ''}最近的对话：\n${transcript}\n\n请回复主人最后一句话。`,
    )) ?? '唔…刚才走神了，再说一遍？'
  await update($, chatAtom, lines => [...lines, { from: 'pet' as const, text: reply }].slice(-8))
  await setMood($, 'chat', reply, 6000)
}

async function pet($: Engine) {
  const now = Date.now()
  lastActivity = now
  const view = await read($, viewAtom)
  if (now - lastPetAt > 2000) {
    await bumpStats($, s => ({ ...s, pets: s.pets + 1, affection: s.affection + 1, xp: s.xp + 1 }))
  }
  lastPetAt = now
  await setMood($, 'pet', view.mood === 'sleep' ? pick(LINES.wake) : undefined, HOLD_MS)
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
  await bumpStats($, s => ({ ...s, pokes: s.pokes + 1 }))
  if (view.mood === 'sleep') {
    await setMood($, 'poke', pick(LINES.wake), 3000)
  } else if (pokeTimes.length >= 4) {
    await setMood($, 'error', pick(LINES.grumpy), HOLD_MS)
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

// A fresh snapshot each time also moves the reset countdowns on.
async function refreshUsage($: Engine) {
  const usage = await $.session.usage()
  const snapshot: PetUsage = {
    windows: usage.rateLimits
      .filter(limit => windowLabel(limit.kind) !== undefined)
      .map(limit => ({ kind: limit.kind, percent: limit.percentUsed, resetsAt: limit.resetsAt })),
    tokens: usage.context.tokens,
    usd: usage.cost?.usd,
    at: Date.now(),
  }
  await update($, usageAtom, () => snapshot)
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
    const saved = await $.store.get(STORE_KEY)
    const stats =
      saved !== null && typeof saved === 'object'
        ? { ...DEFAULT_STATS, ...(saved as Partial<PetStats>) }
        : DEFAULT_STATS
    await update($, statsAtom, () => stats)
    await update($, uiAtom, ui => ({ ...ui, isBusy: false }))
    await setMood($, 'idle', greeting(stats))
    await $.command.register({
      name: 'pet',
      description: '像素宠物：/pet 收起或展开，/pet name 新名字，/pet stats 看数据',
      argumentHint: '[name <名字> | stats]',
    })
    await refreshUsage($)
    $.clock.every(30_000, () => void tick($))

    return next(e)
  })

  on('command.run', { command: 'pet' }, async ($, e) => {
    const [sub, ...rest] = e.args.trim().split(/\s+/)
    if (sub === 'name' && rest.length > 0) {
      const name = rest.join(' ').slice(0, 12)
      await bumpStats($, s => ({ ...s, name }))
      await say($, `以后就叫我「${name}」啦！`)

      return { text: `宠物改名为「${name}」` }
    }
    if (sub === 'stats') {
      const s = await read($, statsAtom)

      return {
        text:
          `${s.name} Lv.${levelOf(s.xp)}｜经验 ${s.xp}｜亲密度 ${s.affection}｜` +
          `被摸 ${s.pets} 次｜被喂 ${s.fed} 次｜被戳 ${s.pokes} 次｜陪你完成 ${s.turns} 轮`,
      }
    }
    await toggleCollapsed($)
    const ui = await read($, uiAtom)

    return { text: ui.isCollapsed ? '宠物已收起' : '宠物已展开' }
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind !== 'task-notification') {
      turn = { prompt: e.text.trim().slice(0, 200), tools: {}, errors: 0 }
    }
    lastActivity = Date.now()
    const view = await read($, viewAtom)
    await update($, uiAtom, ui => ({ ...ui, isBusy: true }))
    await setMood($, 'thinking', view.mood === 'sleep' ? pick(LINES.wake) : undefined)

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
      await setMood($, 'idle', '好的，停下啦')
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
    const worst = Math.max(0, ...e.rateLimits.map(limit => limit.percentUsed))
    const wasTired = isTired
    isTired = worst >= 90
    if (isTired && !wasTired) {
      const stats = await read($, statsAtom)
      $.ui.toast(`${stats.name}：额度已用 ${worst}%，悠着点～`)
      const view = await read($, viewAtom)
      if (view.mood === 'idle') await setMood($, 'tired')
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    isSurfaceWorking = e.props.isWorking
    if (e.props.hasSurvey) return next(e)

    const view = await read($, viewAtom)
    const stats = await read($, statsAtom)
    const ui = await read($, uiAtom)
    const usage = await read($, usageAtom)
    const head = `${stats.name} Lv.${levelOf(stats.xp)} · ♥${stats.affection} · ${MOOD_LABEL[view.mood]}`

    if (e.surface === 'desktop') {
      const { Box, Button, Input, Svg, Text } = $.ui.resolve(e)
      const svg = drawPet(view.mood)
      const alt = `${stats.name}：${MOOD_LABEL[view.mood]}`
      const sep = <Text dimColor>│</Text>
      const usageGroup =
        usage === null ? null : (
          <Box flexDirection="column" gap={1}>
            <Box flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
              {usage.windows.map((w, i) => {
                const reset = fmtReset(w.resetsAt, usage.at)

                return (
                  <Box key={w.kind} flexDirection="row" gap={1} alignItems="center">
                    {i > 0 && sep}
                    <Text bold>{windowLabel(w.kind) ?? w.kind}</Text>
                    <Svg source={meterSvg(w.percent)} alt={`已用 ${w.percent}%`} width={39} height={8} />
                    <Text color={levelColor(w.percent)}>{Math.round(w.percent)}%</Text>
                    {reset !== '' && <Text dimColor>{reset}后重置</Text>}
                  </Box>
                )
              })}
            </Box>
            <Box flexDirection="row" gap={1} alignItems="center">
              <Text bold>本次会话</Text>
              <Text>{usage.tokens === undefined ? '—' : `${fmtTokens(usage.tokens)} tokens`}</Text>
              {usage.usd !== undefined && <Text dimColor>· ${usage.usd.toFixed(2)}</Text>}
            </Box>
          </Box>
        )

      if (ui.isCollapsed) {
        return (
          // Only the picture and one column at this level, as in the expanded
          // band: a Button beside them here lays the row out off-centre.
          <Box flexDirection="row" gap={2} alignItems="center">
            <Svg source={svg} alt={alt} width={132} height={84} isInteractive />
            <Box flexDirection="column" gap={1} flexGrow={1}>
              <Box flexDirection="row" gap={1} alignItems="center" justifyContent="space-between">
                <Text dimColor>{head}</Text>
                <Button key="expand" label="展开" plain onPress={() => void toggleCollapsed($)} />
              </Box>
              {usageGroup}
            </Box>
          </Box>
        )
      }

      return (
        <Box flexDirection="row" gap={2} alignItems="center">
          <Svg source={svg} alt={alt} width={176} height={112} isInteractive />
          <Box flexDirection="column" gap={1} flexGrow={1}>
            <Text dimColor>{head}</Text>
            <Text bold color="#D97757">
              「{view.line}」
            </Text>
            <Box flexDirection="row" gap={2} flexWrap="wrap" alignItems="center" justifyContent="space-between">
              <Box flexDirection="row" gap={1}>
                <Button key="pet" label="摸摸" onPress={() => void pet($)} />
                <Button key="feed" label="喂食" onPress={() => void feed($)} />
                <Button key="poke" label="戳一下" onPress={() => void poke($)} />
                <Button key="chat" label={ui.isChatOpen ? '不聊了' : '聊天'} onPress={() => void toggleChat($)} />
                <Button key="collapse" label="收起" plain onPress={() => void toggleCollapsed($)} />
              </Box>
              {usageGroup}
            </Box>
            {ui.isChatOpen && (
              <Input
                key="say"
                placeholder={`跟${stats.name}说点什么…`}
                submitLabel="发送"
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
            <Button key="expand" label="展开" plain onPress={() => void toggleCollapsed($)} />
          </Box>
        )
      }

      return (
        <Box flexDirection="column">
          <Box flexDirection="row" gap={1}>
            <Text color="#D97757" bold>
              {MOOD_FACE[view.mood]}
            </Text>
            <Text>「{view.line}」</Text>
            <Text dimColor>{head}</Text>
          </Box>
          <Box flexDirection="row" gap={1}>
            <Button key="pet" label="摸摸" hotkey="1" onPress={() => void pet($)} />
            <Button key="feed" label="喂食" hotkey="2" onPress={() => void feed($)} />
            <Button key="poke" label="戳一下" hotkey="3" onPress={() => void poke($)} />
            <Button
              key="chat"
              label={ui.isChatOpen ? '不聊了' : '聊天'}
              hotkey="4"
              onPress={() => void toggleChat($)}
            />
            <Button key="collapse" label="收起" hotkey="5" onPress={() => void toggleCollapsed($)} />
          </Box>
          {usage !== null && (
            <Text dimColor>
              {usage.windows
                .map(w => `${windowLabel(w.kind) ?? w.kind} ${Math.round(w.percent)}% ↻${fmtReset(w.resetsAt, usage.at)}`)
                .concat(
                  `本次会话 ${usage.tokens === undefined ? '—' : fmtTokens(usage.tokens)}` +
                    (usage.usd === undefined ? '' : ` · $${usage.usd.toFixed(2)}`),
                )
                .join(' │ ')}
            </Text>
          )}
          {ui.isChatOpen && (
            <Input key="say" placeholder={`跟${stats.name}说点什么…`} onSubmit={value => void chat($, value)} />
          )}
        </Box>
      )
    }

    return next(e)
  })
}
