export type PetMood =
  | 'idle'
  | 'thinking'
  | 'bash'
  | 'read'
  | 'edit'
  | 'web'
  | 'agent'
  | 'error'
  | 'done'
  | 'sleep'
  | 'pet'
  | 'eat'
  | 'poke'
  | 'tired'
  | 'full'
  | 'chat'

export type PetView = { mood: PetMood; line: string; seq: number }

export type PetStats = {
  name: string
  xp: number
  affection: number
  fed: number
  pets: number
  pokes: number
  turns: number
  fullness: number
  lastFedAt: number
}

export type PetUi = { isCollapsed: boolean; isChatOpen: boolean; isBusy: boolean }

export type PetChatLine = { from: 'me' | 'pet'; text: string }

export type PetUsageWindow = { kind: string; percent: number; resetsAt?: string }

export type PetUsage = { windows: PetUsageWindow[]; tokens?: number; usd?: number; at: number }

declare module 'claude-code' {
  interface PluginState {
    'pixel-pet': {
      view: PetView
      stats: PetStats
      ui: PetUi
      chat: PetChatLine[]
      usage: PetUsage | null
    }
  }
}
