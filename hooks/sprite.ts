import type { PetMood } from '../types'

// The whole drawing is in cells: viewBox 44x28, drawn at 4px per cell.
const C = {
  shell: '#EADFCF',
  shellEdge: '#C9B9A2',
  screen: '#000000',
  grid: '#151515',
  floor: '#2C2C2C',
  body: '#D77757',
  shade: '#A9533A',
  eye: '#000000',
  white: '#FFFFFF',
  blush: '#F4A6A0',
  pink: '#FF7FA8',
  yellow: '#FFD45C',
  blue: '#7CC8FF',
  green: '#7CFF9B',
  grey: '#8A8F8C',
  dark: '#3B403D',
  ink: '#0E1511',
  paper: '#F4EEDC',
  line: '#B9AE95',
  tan: '#C98B4A',
  red: '#FF5F57',
}

type Px = [x: number, y: number, w: number, h: number, fill?: string]

// Where the sprite's top-left cell sits on the screen: 17 wide with its arms,
// 10 tall with its legs, standing on the floor at row 19.
const OX = 14
const OY = 9

const rect = (x: number, y: number, w: number, h: number, fill: string, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra}/>`

const pixels = (list: Px[], dx = 0, dy = 0, fill = C.eye) =>
  list.map(([x, y, w, h, f]) => rect(x + dx, y + dy, w, h, f ?? fill)).join('')

// Rows of characters to rects, merging horizontal runs of one colour.
function map(rows: string[], palette: Record<string, string>, dx = 0, dy = 0): string {
  let out = ''
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const fill = palette[row[x] ?? '.']
      if (fill === undefined) {
        x += 1
        continue
      }
      let w = 1
      while (row[x + w] === row[x]) w += 1
      out += rect(dx + x, dy + y, w, 1, fill)
      x += w
    }
  })

  return out
}

// The body without its arms, which move on their own.
const BODY = [
  '..bbbbbbbbbbbbb..',
  '..bbbbbbbbbbbbb..',
  '..bbbbbbbbbbbbb..',
  '..bbbbbbbbbbbbb..',
  '..bbbbbbbbbbbbb..',
  '..bbbbbbbbbbbbb..',
  '..bbbbbbbbbbbbb..',
  '..bbbbbbbbbbbbb..',
  '..b.b.......b.b..',
  '..b.b.......b.b..',
]
const BODY_PALETTE = { b: C.body }

const HEART = ['.p.p.', 'ppppp', '.ppp.', '..p..']
const HEART_EYE = ['p.p', 'ppp', '.p.']
const ZED = ['wwww', '..w.', '.w..', 'wwww']
const STAR = ['.y.', 'yyy', '.y.']
const DROP = ['.u', 'uu', 'uu']
const COOKIE = ['.tt.', 'tdtt', 'ttdt', '.tt.']
const MINI = ['.bbbbb.', '.bebeb.', 'bbbbbbb', '.bbbbb.', '.b...b.']
const LENS = ['.uu.', 'u..u', 'u..u', '.uu.']
const BATTERY = ['gggggg.', 'g....gg', 'g....gg', 'gggggg.']
const FX = {
  p: C.pink,
  w: '#E8F5EC',
  y: C.yellow,
  u: C.blue,
  t: C.tan,
  d: C.eye,
  b: C.body,
  e: C.eye,
  g: C.grey,
}

type Eyes = 'open' | 'side' | 'happy' | 'closed' | 'focus' | 'sad' | 'wide' | 'heart' | 'tired'
type Mouth = 'none' | 'open' | 'chomp' | 'talk'
type Arms = 'side' | 'type' | 'wave' | 'up' | 'droop'

// Eyes are one cell wide and two tall, at body columns 4 and 12.
const EYES: Record<Eyes, () => string> = {
  open: () => pixels([[4, 2, 1, 2], [12, 2, 1, 2]], OX, OY),
  side: () => pixels([[5, 2, 1, 2], [13, 2, 1, 2]], OX, OY),
  happy: () =>
    pixels([[3, 3, 1, 1], [4, 2, 1, 1], [5, 3, 1, 1], [11, 3, 1, 1], [12, 2, 1, 1], [13, 3, 1, 1]], OX, OY),
  closed: () => pixels([[3, 3, 3, 1], [11, 3, 3, 1]], OX, OY),
  focus: () => pixels([[4, 3, 1, 1], [12, 3, 1, 1], [3, 2, 2, 1], [12, 2, 2, 1]], OX, OY),
  sad: () => pixels([[4, 2, 1, 1], [12, 2, 1, 1], [4, 3, 1, 2, C.blue], [12, 3, 1, 2, C.blue]], OX, OY),
  wide: () => pixels([[4, 1, 1, 3], [12, 1, 1, 3]], OX, OY),
  heart: () => map(HEART_EYE, FX, OX + 3, OY + 1) + map(HEART_EYE, FX, OX + 11, OY + 1),
  tired: () => pixels([[4, 3, 1, 1], [12, 3, 1, 1], [4, 2, 1, 1, C.shade], [12, 2, 1, 1, C.shade]], OX, OY),
}

// Two frames swapped on a discrete clock: the 8-bit way to animate.
const flip = (a: string, b: string, dur: string) =>
  `<g>${a}<animate attributeName="opacity" values="1;0" dur="${dur}" calcMode="discrete" repeatCount="indefinite"/></g>` +
  `<g opacity="0">${b}<animate attributeName="opacity" values="0;1" dur="${dur}" calcMode="discrete" repeatCount="indefinite"/></g>`

const MOUTH_OPEN = pixels([[8, 4, 1, 1]], OX, OY)

const MOUTHS: Record<Mouth, () => string> = {
  none: () => '',
  open: () => MOUTH_OPEN,
  chomp: () => flip(MOUTH_OPEN, '', '0.4s'),
  talk: () => flip(MOUTH_OPEN, '', '0.5s'),
}

// Arms are 2x2 at columns 0 and 15; a row says how high they are held.
const ARM_ROW = { side: 4, up: 2, down: 5 }
const leftArm = (row: number) => rect(OX, OY + row, 2, 2, C.body)
const rightArm = (row: number) => rect(OX + 15, OY + row, 2, 2, C.body)

const ARMS: Record<Arms, () => string> = {
  side: () => leftArm(ARM_ROW.side) + rightArm(ARM_ROW.side),
  up: () => leftArm(ARM_ROW.up) + rightArm(ARM_ROW.up),
  droop: () => leftArm(ARM_ROW.down) + rightArm(ARM_ROW.down),
  type: () =>
    flip(leftArm(ARM_ROW.side), leftArm(ARM_ROW.down), '0.3s') +
    flip(rightArm(ARM_ROW.down), rightArm(ARM_ROW.side), '0.3s'),
  wave: () =>
    flip(leftArm(ARM_ROW.up), leftArm(ARM_ROW.side), '0.4s') +
    flip(rightArm(ARM_ROW.side), rightArm(ARM_ROW.up), '0.4s'),
}

// Open eyes blink by losing their top cell for a moment.
const BLINK =
  `<g opacity="0">${pixels([[4, 2, 1, 1, C.body], [12, 2, 1, 1, C.body]], OX, OY)}` +
  `<animate attributeName="opacity" values="0;1;0" keyTimes="0;0.94;0.97" dur="3.7s" calcMode="discrete" repeatCount="indefinite"/></g>`

const BLUSH = pixels([[3, 4, 1, 1, C.blush], [13, 4, 1, 1, C.blush]], OX, OY)

// A translate loop over cell offsets, discrete so it moves in whole pixels.
const move = (values: string, dur: string, begin = '0s') =>
  `<animateTransform attributeName="transform" type="translate" values="${values}" dur="${dur}" begin="${begin}" calcMode="discrete" repeatCount="indefinite"/>`

const blink = (dur: string, begin = '0s') =>
  `<animate attributeName="opacity" values="1;0.15" dur="${dur}" begin="${begin}" calcMode="discrete" repeatCount="indefinite"/>`

function floatUp(art: string, x: number, y: number, dur: string, begin = '0s'): string {
  return (
    `<g transform="translate(${x} ${y})"><g opacity="0">${art}` +
    move('0 0;0 -1;0 -2;0 -3;0 -4;0 -5', dur, begin) +
    `<animate attributeName="opacity" values="1;1;1;0.6;0.3;0" dur="${dur}" begin="${begin}" calcMode="discrete" repeatCount="indefinite"/>` +
    `</g></g>`
  )
}

type Look = {
  eyes: Eyes
  mouth?: Mouth
  arms: Arms
  hasBlush?: boolean
  bob: [values: string, dur: string]
  // Drawn inside the body group, so it moves with the bob.
  held?: () => string
  // Drawn on the screen, still.
  scene?: () => string
}

const BOB_IDLE: [string, string] = ['0 0;0 -1', '1.6s']
const BOB_BUSY: [string, string] = ['0 0;0 -1', '0.5s']

const LOOKS: Record<PetMood, Look> = {
  idle: { eyes: 'open', arms: 'side', bob: BOB_IDLE },
  thinking: {
    eyes: 'focus',
    arms: 'side',
    bob: ['0 0;0 -1', '1s'],
    scene: () =>
      `<rect x="31" y="7" width="1" height="1" fill="${C.white}">${blink('1.2s')}</rect>` +
      `<rect x="33" y="5" width="1" height="1" fill="${C.white}">${blink('1.2s', '0.3s')}</rect>` +
      `<rect x="35" y="2" width="2" height="2" fill="${C.white}">${blink('1.2s', '0.6s')}</rect>`,
  },
  bash: {
    eyes: 'side',
    arms: 'type',
    bob: BOB_BUSY,
    scene: () =>
      rect(32, 12, 7, 5, C.dark) +
      rect(33, 13, 5, 3, C.ink) +
      `<rect x="33" y="13" width="1" height="1" fill="${C.green}"><animate attributeName="width" values="1;2;3;4" dur="1.6s" calcMode="discrete" repeatCount="indefinite"/></rect>` +
      `<rect x="33" y="15" width="1" height="1" fill="${C.green}">${blink('0.6s')}</rect>` +
      rect(31, 18, 9, 1, C.grey),
  },
  read: {
    eyes: 'focus',
    arms: 'side',
    bob: ['0 0;0 -1', '2s'],
    held: () =>
      rect(OX + 4, OY + 4, 4, 3, C.paper) +
      rect(OX + 8, OY + 4, 1, 3, C.line) +
      rect(OX + 9, OY + 4, 4, 3, C.paper) +
      pixels([[5, 5, 2, 1], [10, 5, 2, 1]], OX, OY, C.line) +
      `<rect x="${OX + 9}" y="${OY + 4}" width="4" height="3" fill="${C.white}" opacity="0.9">` +
      `<animate attributeName="x" values="${OX + 9};${OX + 8};${OX + 4};${OX + 9}" dur="2.4s" calcMode="discrete" repeatCount="indefinite"/>` +
      `<animate attributeName="width" values="4;1;4;0" dur="2.4s" calcMode="discrete" repeatCount="indefinite"/></rect>`,
  },
  edit: {
    eyes: 'side',
    arms: 'type',
    bob: BOB_BUSY,
    scene: () =>
      rect(32, 13, 7, 6, C.paper) +
      rect(33, 14, 5, 1, C.line) +
      rect(33, 16, 5, 1, C.line) +
      `<rect x="33" y="18" width="0" height="1" fill="${C.line}"><animate attributeName="width" values="0;1;2;3;4;5" dur="2.4s" calcMode="discrete" repeatCount="indefinite"/></rect>` +
      `<g>${pixels([[33, 10, 1, 1, C.pink], [33, 11, 1, 3, C.yellow], [33, 14, 1, 1, C.tan], [33, 15, 1, 1, C.eye]])}` +
      `${move('0 0;1 0;2 0;3 0;4 0;3 1;2 1;1 1', '1.6s')}</g>`,
  },
  web: {
    eyes: 'side',
    arms: 'side',
    bob: ['0 0;0 -1', '0.8s'],
    scene: () =>
      `<g>${map(LENS, FX, 33, 6)}${pixels([[37, 10, 1, 1, C.grey], [38, 11, 1, 1, C.grey]])}` +
      `${move('0 0;1 -1;2 0;1 1', '1.2s')}</g>`,
  },
  agent: {
    eyes: 'side',
    arms: 'wave',
    bob: BOB_IDLE,
    scene: () =>
      `<g>${map(MINI, FX, 33, 14)}${move('0 0;0 -2;0 -3;0 -2', '0.8s')}</g>` + floatUp(map(STAR, FX), 32, 10, '1.6s'),
  },
  error: {
    eyes: 'sad',
    arms: 'droop',
    bob: ['0 0;-1 0;1 0;0 0', '0.3s'],
    scene: () => `<g>${map(DROP, FX, 31, 8)}${move('0 0;0 1;0 2', '0.9s')}</g>`,
  },
  done: {
    eyes: 'happy',
    arms: 'wave',
    hasBlush: true,
    bob: ['0 0;0 -2;0 -3;0 -2;0 0', '0.8s'],
    scene: () =>
      `<g>${map(STAR, FX, 7, 6)}${blink('0.6s')}</g><g>${map(STAR, FX, 34, 4)}${blink('0.6s', '0.3s')}</g>` +
      `<g>${map(STAR, FX, 9, 14)}${blink('0.6s', '0.15s')}</g><g>${map(STAR, FX, 36, 13)}${blink('0.6s', '0.45s')}</g>`,
  },
  sleep: {
    eyes: 'closed',
    arms: 'droop',
    bob: ['0 0;0 1', '3s'],
    scene: () => floatUp(map(ZED, FX), 30, 6, '3s') + floatUp(map(ZED, FX), 33, 4, '3s', '1.5s'),
  },
  pet: {
    eyes: 'heart',
    arms: 'wave',
    hasBlush: true,
    bob: ['0 0;0 -1', '0.6s'],
    scene: () => floatUp(map(HEART, FX), 8, 8, '1.8s') + floatUp(map(HEART, FX), 32, 7, '1.8s', '0.9s'),
  },
  eat: {
    eyes: 'happy',
    mouth: 'chomp',
    arms: 'side',
    hasBlush: true,
    bob: ['0 0;0 -1', '0.4s'],
    scene: () =>
      `<g>${map(COOKIE, FX, 32, 13)}${move('0 0;-1 0;-2 0;-3 0', '1.6s')}` +
      `<animate attributeName="opacity" values="1;1;1;0" dur="1.6s" calcMode="discrete" repeatCount="indefinite"/></g>`,
  },
  poke: {
    eyes: 'wide',
    mouth: 'open',
    arms: 'up',
    bob: ['0 0;0 1;0 0;0 -1', '0.4s'],
    scene: () => `<g>${pixels([[22, 2, 1, 4, C.yellow], [22, 7, 1, 1, C.yellow]])}${blink('0.4s')}</g>`,
  },
  tired: {
    eyes: 'tired',
    arms: 'droop',
    bob: ['0 0;0 1', '2.4s'],
    scene: () => map(BATTERY, FX, 19, 3) + `<rect x="20" y="4" width="1" height="2" fill="${C.red}">${blink('0.8s')}</rect>`,
  },
  full: {
    eyes: 'happy',
    arms: 'droop',
    hasBlush: true,
    bob: ['0 0;0 1', '2s'],
    scene: () => floatUp(`<rect x="0" y="0" width="2" height="2" fill="none" stroke="${C.white}" stroke-width="0.4"/>`, 31, 8, '2s'),
  },
  chat: {
    eyes: 'open',
    mouth: 'talk',
    arms: 'side',
    hasBlush: true,
    bob: ['0 0;0 -1', '1s'],
    scene: () =>
      rect(31, 3, 8, 5, C.white) +
      rect(32, 8, 1, 1, C.white) +
      `<rect x="32" y="5" width="1" height="1" fill="${C.eye}">${blink('0.9s')}</rect>` +
      `<rect x="34" y="5" width="1" height="1" fill="${C.eye}">${blink('0.9s', '0.3s')}</rect>` +
      `<rect x="36" y="5" width="1" height="1" fill="${C.eye}">${blink('0.9s', '0.6s')}</rect>`,
  },
}

// One complete SVG document for a mood: device shell, LCD, pet, effects.
export function drawPet(mood: PetMood): string {
  const look = LOOKS[mood]
  const body =
    map(BODY, BODY_PALETTE, OX, OY) +
    ARMS[look.arms]() +
    (look.hasBlush ? BLUSH : '') +
    EYES[look.eyes]() +
    MOUTHS[look.mouth ?? 'none']() +
    (look.eyes === 'open' ? BLINK : '') +
    (look.held?.() ?? '')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 28" width="176" height="112" shape-rendering="crispEdges">` +
    `<title>摸摸我～</title>` +
    `<style>.hov{opacity:0;transition:opacity .2s}svg:hover .hov{opacity:1}</style>` +
    `<defs><pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse">` +
    `<rect width="1" height="1" fill="none" stroke="${C.grid}" stroke-width="0.1"/></pattern></defs>` +
    `<rect x="0" y="0" width="44" height="28" rx="3" fill="${C.shell}" stroke="${C.shellEdge}" stroke-width="0.5"/>` +
    `<rect x="2" y="2" width="40" height="24" rx="1" fill="${C.screen}"/>` +
    `<rect x="2" y="2" width="40" height="24" fill="url(#grid)"/>` +
    rect(4, 19, 36, 1, C.floor) +
    `<g>${body}${move(look.bob[0], look.bob[1])}</g>` +
    (look.scene?.() ?? '') +
    `<g class="hov">${map(HEART, FX, 20, 3)}</g>` +
    `<rect x="3" y="3" width="6" height="1" fill="#FFFFFF" opacity="0.06"/>` +
    `</svg>`
  )
}
