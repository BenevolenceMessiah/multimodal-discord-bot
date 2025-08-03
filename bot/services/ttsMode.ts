// bot/services/ttsMode.ts
export type TTSMode = 'off' | 'on' | 'audio-only';
const state = new Map<string, TTSMode>();          // per-guild

export function setTTSMode(guildId: string, mode: TTSMode) {
  state.set(guildId, mode);
}

export function getTTSMode(guildId: string): TTSMode {
  return state.get(guildId) ?? 'off';
}