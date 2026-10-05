import type { PetLang, PetMood, PetStats } from '../types'

type LineSet = PetMood | 'wake' | 'grumpy' | 'hungry'

export type Durations = {
  now: string
  minutes: (m: number) => string
  hours: (h: number, m: number) => string
  days: (d: number, h: number) => string
}

// Every word the pet shows or sends, per language.
export type Text = {
  defaultName: string
  quote: (line: string) => string
  moodLabel: Record<PetMood, string>
  lines: Record<LineSet, string[]>
  greeting: (hour: number) => string
  stopped: string
  levelUp: (name: string, level: number) => string
  nearLimit: (name: string, percent: number) => string
  persona: (name: string, level: number, affection: number) => string
  maxLine: number
  toolJoiner: string
  noTools: string
  turnPrompt: (prompt: string, seconds: number, tools: string, errors: number) => string
  owner: string
  chatPrompt: (isBusy: boolean, transcript: string) => string
  lostThought: string
  buttons: {
    pet: string
    feed: string
    poke: string
    chat: string
    stopChat: string
    collapse: string
    expand: string
    send: string
  }
  placeholder: (name: string) => string
  petMe: string
  windows: Record<string, string>
  resetIn: (left: string) => string
  durations: Durations
  session: string
  used: (percent: number) => string
  command: {
    description: string
    hint: string
    renamed: (name: string) => string
    renameLine: (name: string) => string
    stats: (s: PetStats, name: string, level: number) => string
    collapsed: string
    expanded: string
    lang: (choice: string) => string
  }
}

const ZH: Text = {
  defaultName: '小克',
  quote: line => `「${line}」`,
  moodLabel: {
    idle: '发呆中',
    thinking: '思考中',
    bash: '敲命令',
    read: '翻资料',
    edit: '改代码',
    web: '上网冲浪',
    agent: '叫帮手',
    error: '出错了',
    done: '搞定！',
    sleep: '睡着了',
    pet: '被摸摸',
    eat: '吃饭饭',
    poke: '被戳了',
    tired: '有点累',
    full: '吃撑了',
    chat: '聊天中',
  },
  lines: {
    idle: ['有活儿叫我～', '在这儿陪着你', '发会儿呆…', '今天也要顺顺利利', '我在输入框上面哦'],
    thinking: ['让我想想…', '嗯…有点意思', '脑子转起来了', '在琢磨了'],
    bash: ['噼里啪啦敲命令', '终端启动！', '跑一下看看'],
    read: ['翻翻资料…', '让我看看这段', '原来是这样'],
    edit: ['开始动笔了', '改改改…', '这里要调一下'],
    web: ['上网查查', '冲浪中～', '搜一下资料'],
    agent: ['叫个帮手来', '分身术！', '兵分两路'],
    error: ['呜…出错了', '没事，再来一次', '这个有点难搞'],
    done: ['搞定啦！', '完成～夸我', '收工！'],
    sleep: ['Zzz…', '呼…呼…'],
    pet: ['嘿嘿好舒服', '再摸一下嘛', '最喜欢你了'],
    eat: ['好吃！', '吧唧吧唧', '谢谢投喂～'],
    poke: ['哎呀！', '干嘛戳我', '吓我一跳'],
    tired: ['额度快见底了…', '有点累了，悠着点'],
    full: ['吃不下啦…', '肚子圆滚滚'],
    chat: ['…'],
    wake: ['被吵醒了…', '唔…几点了'],
    grumpy: ['别戳啦！', '再戳我要生气了'],
    hungry: ['肚子咕咕叫…', '有点饿了'],
  },
  greeting: hour =>
    hour < 6
      ? '这么晚还在忙呀…'
      : hour < 11
        ? '早上好！今天做点啥？'
        : hour < 14
          ? '中午好～吃饭了吗'
          : hour < 19
            ? '下午好，继续加油'
            : '晚上好，我陪着你',
  stopped: '好的，停下啦',
  levelUp: (name, level) => `${name} 升到 Lv.${level} 啦！`,
  nearLimit: (name, percent) => `${name}：额度已用 ${percent}%，悠着点～`,
  persona: (name, level, affection) =>
    [
      `你是「${name}」，一只住在 Claude Code 输入框上方的 8-bit 像素电子宠物，长得像一只橙色的小 Claude。`,
      `你陪着主人写代码。你等级 Lv.${level}，和主人的亲密度是 ${affection}。`,
      '说话规则：只用中文，口语、俏皮、温暖，像电子宠物；一次只说一句，不超过 25 个字；',
      '不用 emoji、不加引号、不加动作描写、不自称 AI 或助手、不给技术建议。',
    ].join('\n'),
  maxLine: 40,
  toolJoiner: '、',
  noTools: '没用工具',
  turnPrompt: (prompt, seconds, tools, errors) =>
    `主人刚让 Claude 做了这件事：「${prompt || '（没写具体内容）'}」\n` +
    `Claude 用了 ${seconds} 秒，工具：${tools}，出错 ${errors} 次。\n` +
    '请你对这一轮说一句感想或鼓励。',
  owner: '主人',
  chatPrompt: (isBusy, transcript) =>
    `${isBusy ? '（Claude 正在干活）\n' : ''}最近的对话：\n${transcript}\n\n请回复主人最后一句话。`,
  lostThought: '唔…刚才走神了，再说一遍？',
  buttons: {
    pet: '摸摸',
    feed: '喂食',
    poke: '戳一下',
    chat: '聊天',
    stopChat: '不聊了',
    collapse: '收起',
    expand: '展开',
    send: '发送',
  },
  placeholder: name => `跟${name}说点什么…`,
  petMe: '摸摸我～',
  windows: { five_hour: '5小时', seven_day: '每周' },
  resetIn: left => `${left}后重置`,
  durations: {
    now: '马上',
    minutes: m => `${m}分`,
    hours: (h, m) => `${h}小时${m}分`,
    days: (d, h) => `${d}天${h}小时`,
  },
  session: '本次会话',
  used: percent => `已用 ${percent}%`,
  command: {
    description: '像素宠物：/pet 收起或展开，/pet name 新名字，/pet stats 看数据，/pet lang zh|en|auto 切换语言',
    hint: '[name <名字> | stats | lang zh|en|auto]',
    renamed: name => `宠物改名为「${name}」`,
    renameLine: name => `以后就叫我「${name}」啦！`,
    stats: (s, name, level) =>
      `${name} Lv.${level}｜经验 ${s.xp}｜亲密度 ${s.affection}｜` +
      `被摸 ${s.pets} 次｜被喂 ${s.fed} 次｜被戳 ${s.pokes} 次｜陪你完成 ${s.turns} 轮`,
    collapsed: '宠物已收起',
    expanded: '宠物已展开',
    lang: choice => `宠物语言：${choice}`,
  },
}

const EN: Text = {
  defaultName: 'Bit',
  quote: line => `“${line}”`,
  moodLabel: {
    idle: 'Idle',
    thinking: 'Thinking',
    bash: 'Running',
    read: 'Reading',
    edit: 'Editing',
    web: 'Browsing',
    agent: 'Delegating',
    error: 'Oops',
    done: 'Done!',
    sleep: 'Asleep',
    pet: 'Petted',
    eat: 'Eating',
    poke: 'Poked',
    tired: 'Tired',
    full: 'Full',
    chat: 'Chatting',
  },
  lines: {
    idle: ['Call me if you need me~', 'Right here with you', 'Just zoning out…', 'Hope today goes smoothly', 'I live above your prompt!'],
    thinking: ['Let me think…', 'Hmm, interesting', 'Gears turning', 'Mulling it over'],
    bash: ['Clack clack, running it', 'Terminal, go!', 'Let’s run it and see'],
    read: ['Reading up…', 'Let me look at this', 'Oh, I see'],
    edit: ['Time to write', 'Edit, edit, edit…', 'This bit needs a tweak'],
    web: ['Looking it up', 'Surfing the web~', 'Searching…'],
    agent: ['Calling in a helper', 'Clone jutsu!', 'Splitting up the work'],
    error: ['Oops… that failed', 'It’s fine, try again', 'This one’s tricky'],
    done: ['Done!', 'Finished~ praise me', 'That’s a wrap!'],
    sleep: ['Zzz…', 'Snore… snore…'],
    pet: ['Hehe, that’s nice', 'One more pat?', 'You’re my favorite'],
    eat: ['Yummy!', 'Nom nom nom', 'Thanks for the snack~'],
    poke: ['Eek!', 'Hey, why the poke?', 'You startled me'],
    tired: ['Usage is running low…', 'Getting tired, go easy'],
    full: ['Can’t eat another bite…', 'My tummy is so round'],
    chat: ['…'],
    wake: ['You woke me up…', 'Mm… what time is it?'],
    grumpy: ['Stop poking!', 'Poke me again and I’ll get mad'],
    hungry: ['My tummy is rumbling…', 'Kinda hungry'],
  },
  greeting: hour =>
    hour < 6
      ? 'Up this late?…'
      : hour < 11
        ? 'Morning! What are we building?'
        : hour < 14
          ? 'Hi! Had lunch yet?'
          : hour < 19
            ? 'Afternoon, keep it up'
            : 'Evening, I’m here with you',
  stopped: 'Okay, stopping',
  levelUp: (name, level) => `${name} reached Lv.${level}!`,
  nearLimit: (name, percent) => `${name}: ${percent}% of your limit used, go easy~`,
  persona: (name, level, affection) =>
    [
      `You are "${name}", an 8-bit pixel pet living above the Claude Code prompt, shaped like a little orange Claude.`,
      `You keep your owner company while they code. You are level ${level}, and your affection with your owner is ${affection}.`,
      'Rules: reply in English only, casual, playful and warm like a virtual pet; one sentence, at most 20 words;',
      'no emoji, no quotes, no stage directions, never call yourself an AI or assistant, no technical advice.',
    ].join('\n'),
  maxLine: 120,
  toolJoiner: ', ',
  noTools: 'no tools',
  turnPrompt: (prompt, seconds, tools, errors) =>
    `Your owner just asked Claude to: "${prompt || '(nothing specific)'}"\n` +
    `Claude took ${seconds}s, tools: ${tools}, errors: ${errors}.\n` +
    'Say one line reacting to or cheering on this turn.',
  owner: 'Owner',
  chatPrompt: (isBusy, transcript) =>
    `${isBusy ? '(Claude is working right now)\n' : ''}Recent conversation:\n${transcript}\n\nReply to your owner’s last message.`,
  lostThought: 'Oops, I zoned out. Say that again?',
  buttons: {
    pet: 'Pet',
    feed: 'Feed',
    poke: 'Poke',
    chat: 'Chat',
    stopChat: 'Stop chat',
    collapse: 'Collapse',
    expand: 'Expand',
    send: 'Send',
  },
  placeholder: name => `Say something to ${name}…`,
  petMe: 'Pet me!',
  windows: { five_hour: '5h', seven_day: 'Week' },
  resetIn: left => `resets in ${left}`,
  durations: {
    now: 'now',
    minutes: m => `${m}m`,
    hours: (h, m) => `${h}h ${m}m`,
    days: (d, h) => `${d}d ${h}h`,
  },
  session: 'Session',
  used: percent => `${percent}% used`,
  command: {
    description: 'Pixel pet: /pet to collapse or expand, /pet name <name>, /pet stats, /pet lang en|zh|auto',
    hint: '[name <name> | stats | lang en|zh|auto]',
    renamed: name => `Pet renamed to "${name}"`,
    renameLine: name => `Call me ${name} from now on!`,
    stats: (s, name, level) =>
      `${name} Lv.${level} | XP ${s.xp} | Affection ${s.affection} | ` +
      `Petted ${s.pets} | Fed ${s.fed} | Poked ${s.pokes} | Turns together ${s.turns}`,
    collapsed: 'Pet collapsed',
    expanded: 'Pet expanded',
    lang: choice => `Pet language: ${choice}`,
  },
}

export const TEXT: Record<PetLang, Text> = { zh: ZH, en: EN }

export const pick = (list: readonly string[]): string =>
  list[Math.floor(Math.random() * list.length)] ?? ''

export const levelOf = (xp: number): number => Math.floor(Math.sqrt(xp / 3)) + 1

/** The pet's name: the one it was given, else the language's default. */
export const nameOf = (stats: PetStats, lang: PetLang): string => stats.name || TEXT[lang].defaultName

/** A locale such as `zh_CN.UTF-8` or `zh-Hans` reads as Chinese; anything else as English. */
export const langOfLocale = (locale: string | undefined): PetLang => (/^zh/i.test(locale ?? '') ? 'zh' : 'en')

// Terminal fallback: the terminal surface has no Svg.
export const MOOD_FACE: Record<PetMood, string> = {
  idle: '(•ᴗ•)',
  thinking: '(・_・ )…',
  bash: '(•̀ᴗ•́)⌨',
  read: '(•ᴗ•)📖',
  edit: '(•̀ᴗ•́)✎',
  web: '(•ᴗ•)🔍',
  agent: '(•ᴗ•)(•ᴗ•)',
  error: '(╥﹏╥)',
  done: '\\(^ᴗ^)/',
  sleep: '(-ᴗ-)zZ',
  pet: '(♡ᴗ♡)',
  eat: '(^ч^)',
  poke: '(⊙o⊙)!',
  tired: '(=_=)',
  full: '(^-^)~',
  chat: '(•ᴗ•)💬',
}

// Haiku's reply cut to one short bubble line.
export function tidy(text: string, max: number): string {
  const line = text
    .replace(/[\r\n]+/g, ' ')
    .replace(/^["'「『“\s]+|["'」』”\s]+$/g, '')
    .trim()

  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}
