// file: bot/commands/speak.ts

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  AttachmentBuilder,
} from 'discord.js';
import {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  VoiceConnectionStatus,
  StreamType,
} from '@discordjs/voice';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { synthesize } from '../services/tts.js';

// configure fluent‑ffmpeg to use the static ffmpeg binary
ffmpeg.setFfmpegPath(ffmpegPath as string);

// helper: convert a WAV file to MP3
async function convertWavToMp3(wavPath: string): Promise<string> {
  const mp3Path = wavPath.replace(/\.wav$/i, '.mp3');
  return new Promise((resolve, reject) => {
    ffmpeg(wavPath)
      .audioCodec('libmp3lame')
      .format('mp3')
      .on('end', () => resolve(mp3Path))
      .on('error', (err) => reject(err))
      .save(mp3Path);
  });
}

export const data = new SlashCommandBuilder()
  .setName('speak')
  .setDescription('Generate speech from text and play in your voice channel or upload as an audio file')
  .addStringOption((option) =>
    option.setName('text').setDescription('The text to speak aloud').setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const text = interaction.options.getString('text', true);
  await interaction.deferReply();

  let wavPath: string;
  try {
    // uses the model from .env or ALLTALK_VOICE by default
    wavPath = await synthesize(text);
  } catch (err) {
    await interaction.editReply({ content: `❌ Failed to generate speech: ${String(err)}` });
    return;
  }

  let mp3Path: string;
  try {
    mp3Path = await convertWavToMp3(wavPath);
  } catch (err) {
    await interaction.editReply({ content: `❌ Failed to convert audio: ${String(err)}` });
    try { await fs.promises.unlink(wavPath); } catch {}
    return;
  }

  const member: any = interaction.member;
  const voiceChannel = member?.voice?.channel;

  if (voiceChannel) {
    try {
      const connection = joinVoiceChannel({
        guildId: voiceChannel.guild.id,
        channelId: voiceChannel.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: false,
      });
      await entersState(connection, VoiceConnectionStatus.Ready, 5_000);
      const player = createAudioPlayer();
      const resource = createAudioResource(fs.createReadStream(mp3Path), { inputType: StreamType.Arbitrary });
      connection.subscribe(player);
      player.play(resource);
      await entersState(player, AudioPlayerStatus.Idle, 30_000);
      connection.destroy();
      await interaction.editReply({ content: '✅ Playing speech in your voice channel' });
    } catch (err) {
      await interaction.editReply({ content: `❌ Error playing audio in voice channel: ${String(err)}` });
    } finally {
      try { await fs.promises.unlink(wavPath); } catch {}
      try { await fs.promises.unlink(mp3Path); } catch {}
    }
  } else {
    const attachment = new AttachmentBuilder(mp3Path);
    await interaction.editReply({ content: '🎧 Here is your spoken audio:', files: [attachment] });
    try { await fs.promises.unlink(wavPath); } catch {}
    try { await fs.promises.unlink(mp3Path); } catch {}
  }
}
