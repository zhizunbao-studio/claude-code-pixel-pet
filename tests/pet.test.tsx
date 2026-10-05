import type { On } from 'claude-code'
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

const SURFACES = ['desktop', 'terminal'] as const

const runPet = (args: string) => ({
  command: 'pet',
  args,
  origin: { kind: 'composer' as const },
  presentation: { isFullscreen: false, columns: 100 },
})

function fakeUsage(on: On) {
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
}

test('the pet draws and reacts in English and, after /pet lang zh, in Chinese', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  const steps = [
    // Four pokes inside ten seconds make it grumpy, which shows as Oops.
    { lang: 'en', petted: /Petted/, eating: /Eating/, poked: /Poked|Oops/ },
    { lang: 'zh', petted: /被摸摸/, eating: /吃饭饭/, poked: /被戳了|出错了/ },
  ]
  for (const step of steps) {
    await $.command.run(runPet(`lang ${step.lang}`))
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ plugin: 'pixel-pet', surface, ...BAND })
      const has = async (name: string, query: Parameters<typeof ui.find>[0]) =>
        expect(`${step.lang}/${surface}/${name}:${(await ui.find(query)) ? 'ok' : 'missing'}`).toBe(
          `${step.lang}/${surface}/${name}:ok`,
        )

      if (surface === 'desktop') await has('svg', { type: 'Svg' })
      await ui.press({ key: 'pet' })
      await has('pet', { text: step.petted })
      await ui.press({ key: 'feed' })
      await has('feed', { text: step.eating })
      await ui.press({ key: 'poke' })
      await has('poke', { text: step.poked })
      await ui.press({ key: 'chat' })
      await has('chat', { key: 'say' })
      await ui.press({ key: 'chat' })
      await ui.press({ key: 'collapse' })
      await has('collapse', { key: 'expand' })
      await ui.press({ key: 'expand' })
      await has('expand', { key: 'pet' })
      await ui.unmount()
    }
  }
})

test('the usage group speaks the chosen language, expanded and collapsed', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  fakeUsage(on)
  await $.session.measure({ context: { window: 1_000_000 }, rateLimits: [], changed: [] })

  const steps = [
    { lang: 'en', texts: [/5h/, /Week/, /74%/, /4h 38m/, /Session/, /272\.6k/, /\$5\.70/] },
    { lang: 'zh', texts: [/5小时/, /每周/, /74%/, /4小时38分/, /本次会话/, /272\.6k/, /\$5\.70/] },
  ]
  for (const step of steps) {
    await $.command.run(runPet(`lang ${step.lang}`))
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ plugin: 'pixel-pet', surface, ...BAND })
      for (const text of step.texts) {
        const found = (await ui.find({ text })) ? 'ok' : 'missing'
        expect(`${step.lang}/${surface} ${text}:${found}`).toBe(`${step.lang}/${surface} ${text}:ok`)
      }
      if (surface === 'desktop') {
        await ui.press({ key: 'collapse' })
        for (const text of step.texts) {
          const found = (await ui.find({ text })) ? 'ok' : 'missing'
          expect(`${step.lang}/collapsed ${text}:${found}`).toBe(`${step.lang}/collapsed ${text}:ok`)
        }
        await ui.press({ key: 'expand' })
      }
      await ui.unmount()
    }
  }
})

test('/pet stats and /pet name answer in the chosen language', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  await $.command.run(runPet('lang en'))
  expect((await $.command.run(runPet('stats'))).text).toMatch(/^Bit Lv\.1 \| XP 0/)
  await $.command.run(runPet('lang zh'))
  expect((await $.command.run(runPet('stats'))).text).toMatch(/^小克 Lv\.1｜经验 0/)
  expect((await $.command.run(runPet('name 豆豆'))).text).toBe('宠物改名为「豆豆」')
  await $.command.run(runPet('lang en'))
  expect((await $.command.run(runPet('stats'))).text).toMatch(/^豆豆 Lv\.1/)
})

test('/pet lang auto follows a Chinese locale', async ($, on) => {
  mock.store(on)
  mock.env(on, { LANG: 'zh_CN.UTF-8' })
  expect((await $.command.run(runPet('lang auto'))).text).toBe('宠物语言：auto (zh)')
})

test('/pet lang auto falls back to English for other locales', async ($, on) => {
  mock.store(on)
  mock.env(on, { LANG: 'en_US.UTF-8' })
  expect((await $.command.run(runPet('lang auto'))).text).toBe('Pet language: auto (en)')
})
