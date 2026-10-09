// Pure helpers for the usage group beside the buttons.

import type { Durations } from './i18n'

/** The rate-limit windows the band shows, in order. */
export const SHOWN_WINDOWS = ['five_hour', 'seven_day']

export const levelColor = (percent: number): string =>
  percent < 60 ? '#5BBF6A' : percent < 85 ? '#E5A82E' : '#E5534B'

/** Quota levels that warn, highest first. */
const QUOTA_LEVELS = [95, 80] as const

/** The highest warning level `percent` has reached, 0 below them all. */
export const quotaLevel = (percent: number): number => QUOTA_LEVELS.find(level => percent >= level) ?? 0

/** Time left until `iso` in the language's units (`4h 38m`, `4小时38分`); empty when unreadable. */
export const fmtReset = (iso: string | undefined, now: number, units: Durations): string => {
  if (iso === undefined) return ''
  const ms = Date.parse(iso) - now
  if (Number.isNaN(ms)) return ''
  if (ms <= 0) return units.now
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return units.minutes(minutes)
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return units.hours(hours, minutes % 60)

  return units.days(Math.floor(hours / 24), hours % 24)
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
