import { ChatInputCommandInteraction, SlashCommandBuilder, ChannelType } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("thread-private")
  .setDescription("Create a private thread from this message");

export async function execute(interaction: ChatInputCommandInteraction) {
  const channel = interaction.channel;
  if (!channel || !("threads" in channel)) return interaction.reply("Not supported here");
  const thread = await channel.threads.create({
    name: `Private-${interaction.id}`,
    autoArchiveDuration: 60,
    type: ChannelType.PrivateThread,
    invitable: true,
  });
  await interaction.reply(`Private thread created: <#${thread.id}>`);
}