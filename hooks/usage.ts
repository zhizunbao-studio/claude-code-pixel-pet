// Pure helpers for the usage group beside the buttons.

const WINDOW_LABEL: Record<string, string> = { five_hour: '5小时', seven_day: '每周' }

export const windowLabel = (kind: string): string | undefined => WINDOW_LABEL[kind]

export const levelColor = (percent: number): string =>
  percent < 60 ? '#5BBF6A' : percent < 85 ? '#E5A82E' : '#E5534B'

/** 272600 -> `272.6k`, 1234567 -> `1.2M`. */
export const fmtTokens = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`

  return String(n)
}

/** Time left until `iso`, as `45分`, `4小时38分` or `2天4小时`; empty when unreadable. */
export const fmtReset = (iso: string | undefined, now: number): string => {
  if (iso === undefined) return ''
  const ms = Date.parse(iso) - now
  if (Number.isNaN(ms)) return ''
  if (ms <= 0) return '马上'
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${minutes}分`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时${minutes % 60}分`

  return `${Math.floor(hours / 24)}天${hours % 24}小时`
}

const METER_CELLS = 8

/** An 8-cell pixel meter, lit from the left in the level's colour. */
export function meterSvg(percent: number): string {
  const lit = Math.max(0, Math.min(METER_CELLS, Math.round((percent / 100) * METER_CELLS)))
  const color = levelColor(percent)
  let cells = ''
  for (let i = 0; i < METER_CELLS; i += 1) {
    cells += `<rect x="${i * 5}" y="0" width="4" height="8" fill="${i < lit ? color : '#3A3A37'}"/>`
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 39 8" width="39" height="8" shape-rendering="crispEdges">` +
    `${cells}</svg>`
  )
}
