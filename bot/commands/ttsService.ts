import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { setTTSMode, getTTSMode, TTSMode } from '../services/ttsMode.js';

export const data = new SlashCommandBuilder()
  .setName('tts-service')
  .setDescription('Toggle automatic TTS on/off/audio-only')
  .addStringOption(o =>
    o.setName('mode')
      .setDescription('Desired mode')
      .setRequired(true)
      .addChoices(
        { name: 'on', value: 'on' },
        { name: 'off', value: 'off' },
        { name: 'audio-only', value: 'audio-only' },
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const mode = interaction.options.getString('mode', true) as TTSMode;
  setTTSMode(interaction.guildId ?? 'global', mode);
  await interaction.reply(`🔊 TTS service is now **${mode}**`);
}
