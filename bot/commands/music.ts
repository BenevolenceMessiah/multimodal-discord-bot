import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  SlashCommandBuilder
} from "discord.js";
import { generateMusic } from "../services/ace.js";
import { chunkAudio } from "../src/utils/audio.js";

function splitInline(input: string) {
  const [first, ...rest] = input.split(/\n\s*\n/); // blank line = delimiter
  return { prompt: first.trim(), lyrics: rest.join("\n").trim() };
}

export const data = new SlashCommandBuilder()
  .setName("music")
  .setDescription("Generate music with ACE-Step")
  .addStringOption(o =>
    o.setName("prompt").setDescription("Style / tags").setRequired(true)
  )
  .addStringOption(o =>
    o.setName("lyrics").setDescription("Multi-line lyrics (optional)")
  )
  .addStringOption(o =>
    o.setName("format")
      .setDescription("mp3 (default) | wav | flac")
      .addChoices(
        { name: "mp3 (compressed)", value: "mp3" },
        { name: "wav (lossless)",  value: "wav" },
        { name: "flac (lossless)", value: "flac" }
      )
  );

export async function execute(i: ChatInputCommandInteraction) {
  await i.deferReply({ ephemeral: false });

  let prompt = i.options.getString("prompt", true);
  let lyrics = i.options.getString("lyrics") ?? "";
  // If lyrics omitted but prompt contains blank-line separator => split
  if (!lyrics && /\n\s*\n/.test(prompt)) {
    ({ prompt, lyrics } = splitInline(prompt));
  }

  const format = (i.options.getString("format") as "mp3" | "wav" | "flac") ?? "mp3";

  const audio = await generateMusic({ prompt, lyrics, format });
  const parts = await chunkAudio(audio);

  // Discord attachment limit = 10 per message
  for (let idx = 0; idx < parts.length; idx += 10) {
    const slice = parts.slice(idx, idx + 10);
    await i.followUp({
      content: `🎶 Track segment ${idx / 10 + 1}/${Math.ceil(parts.length / 10)}`,
      files: slice.map(p => new AttachmentBuilder(p))
    });
  }
}
