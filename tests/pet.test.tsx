import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt' as const,
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 19 },
    view: {},
  },
}

test('the pet draws and reacts on desktop and terminal', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ plugin: 'pixel-pet', surface, ...BAND })
    const has = async (step: string, query: Parameters<typeof ui.find>[0]) =>
      expect(`${surface}/${step}:${(await ui.find(query)) ? 'ok' : 'missing'}`).toBe(`${surface}/${step}:ok`)

    if (surface === 'desktop') await has('svg', { type: 'Svg' })
    await ui.press({ key: 'pet' })
    await has('pet', { text: /被摸摸/ })
    await ui.press({ key: 'feed' })
    await has('feed', { text: /吃饭饭/ })
    await ui.press({ key: 'poke' })
    await has('poke', { text: /被戳了/ })
    await ui.press({ key: 'chat' })
    await has('chat', { key: 'say' })
    await ui.press({ key: 'chat' })
    await ui.press({ key: 'collapse' })
    await has('collapse', { key: 'expand' })
    await ui.press({ key: 'expand' })
    await has('expand', { key: 'pet' })
    await ui.unmount()
  }
})

test('the usage group shows the windows, resets and session cost', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  const inFourHours = new Date(Date.now() + (4 * 60 + 38) * 60_000 + 30_000).toISOString()
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('session.usage', () => ({
    value: {
    startedAt: 0,
    context: { tokens: 272_600, window: 1_000_000, percent: 27 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 10, resetsAt: inFourHours },
      { kind: 'seven_day', percentUsed: 74, resetsAt: inFourHours },
    ],
    cost: { usd: 5.7 },
    },
  }))
  await $.session.measure({ context: { window: 1_000_000 }, rateLimits: [], changed: [] })

  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ plugin: 'pixel-pet', surface, ...BAND })
    for (const text of [/5小时/, /每周/, /74%/, /4小时38分/, /272\.6k/, /\$5\.70/]) {
      expect(`${surface} ${text}:${(await ui.find({ text })) ? 'ok' : 'missing'}`).toBe(`${surface} ${text}:ok`)
    }
    if (surface === 'desktop') {
      await ui.press({ key: 'collapse' })
      for (const text of [/5小时/, /74%/, /\$5\.70/]) {
        expect(`collapsed ${text}:${(await ui.find({ text })) ? 'ok' : 'missing'}`).toBe(`collapsed ${text}:ok`)
      }
      await ui.press({ key: 'expand' })
    }
    await ui.unmount()
  }
})
