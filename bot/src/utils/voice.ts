/*
 * utils/voice.ts
 *
 * Helper routines for joining a Discord voice channel and playing an audio
 * file.  This logic wraps the @discordjs/voice helpers used in the
 * `/speak` command, allowing other parts of the bot (such as the
 * automatic TTS system) to reuse the same functionality.  After
 * playback finishes, the connection is destroyed and the file is not
 * removed; callers are responsible for cleaning up temporary files.
 */

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

export async function playAudioInVoiceChannel(
  voiceChannel: any,
  filePath: string,
): Promise<void> {
  const connection = joinVoiceChannel({
    guildId: voiceChannel.guild.id,
    channelId: voiceChannel.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false,
  });
  await entersState(connection, VoiceConnectionStatus.Ready, 5_000);
  const player = createAudioPlayer();
  const resource = createAudioResource(fs.createReadStream(filePath), { inputType: StreamType.Arbitrary });
  connection.subscribe(player);
  player.play(resource);
  await entersState(player, AudioPlayerStatus.Idle, 30_000);
  connection.destroy();
}