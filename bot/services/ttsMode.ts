/*
 * ttsMode.ts
 *
 * Tracks per‑guild TTS mode selection.  The mode controls how the bot
 * delivers automatic TTS responses in the message router.  A guild may
 * choose 'off' (no auto‑TTS), 'on' (speak the bot’s responses in the
 * current voice channel and also send text), 'audio-only' (speak without
 * sending text) or 'voice-call' (alias of 'on' – kept for backwards
 * compatibility and explicit voice call toggling).
 */

export type TTSMode = 'off' | 'on' | 'audio-only' | 'voice-call';

// internal map to store mode per guild.  The key "global" is used for DMs.
const state = new Map<string, TTSMode>();

/**
 * Persist the TTS mode for a given guild.  Use 'global' for direct
 * messages.  Any value outside the TTSMode union will be coerced to
 * 'off'.
 */
export function setTTSMode(guildId: string, mode: TTSMode): void {
  // normalise unsupported values
  if (!['off', 'on', 'audio-only', 'voice-call'].includes(mode)) {
    state.set(guildId, 'off');
    return;
  }
  state.set(guildId, mode);
}

/**
 * Retrieve the current TTS mode for a guild.  Defaults to 'off' when
 * unset.
 */
export function getTTSMode(guildId: string): TTSMode {
  return state.get(guildId) ?? 'off';
}