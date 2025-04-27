import { ChatInputCommandInteraction, SlashCommandBuilder, ChannelType } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("thread")
  .setDescription("Create a public thread from this message");

export async function execute(interaction: ChatInputCommandInteraction) {
  const channel = interaction.channel;
  if (!channel || !("threads" in channel)) return interaction.reply("Not supported here");
  const thread = await channel.threads.create({
    name: `Thread-${interaction.id}`,
    autoArchiveDuration: 60,
    type: ChannelType.PublicThread,
  });
  await interaction.reply(`Thread created: <#${thread.id}>`);
}