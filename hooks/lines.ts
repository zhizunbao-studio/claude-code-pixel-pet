import type { PetMood, PetStats } from '../types'

export const MOOD_LABEL: Record<PetMood, string> = {
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
}

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

export const LINES: Record<PetMood | 'wake' | 'grumpy' | 'hungry', string[]> = {
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
}

export const pick = (list: readonly string[]): string =>
  list[Math.floor(Math.random() * list.length)] ?? ''

export const levelOf = (xp: number): number => Math.floor(Math.sqrt(xp / 3)) + 1

export function persona(stats: PetStats): string {
  return [
    `你是「${stats.name}」，一只住在 Claude Code 输入框上方的 8-bit 像素电子宠物，长得像一只橙色的小 Claude。`,
    `你陪着主人写代码。你等级 Lv.${levelOf(stats.xp)}，和主人的亲密度是 ${stats.affection}。`,
    '说话规则：只用中文，口语、俏皮、温暖，像电子宠物；一次只说一句，不超过 25 个字；',
    '不用 emoji、不加引号、不加动作描写、不自称 AI 或助手、不给技术建议。',
  ].join('\n')
}

// Haiku's reply cut to one short bubble line.
export function tidy(text: string): string {
  const line = text
    .replace(/[\r\n]+/g, ' ')
    .replace(/^["'「『“\s]+|["'」』”\s]+$/g, '')
    .trim()

  return line.length > 40 ? `${line.slice(0, 39)}…` : line
}
