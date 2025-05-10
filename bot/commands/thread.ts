import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ChannelType,
  TextChannel
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('thread')
  .setDescription('Create a public thread')
  .addStringOption((o) =>
    o.setName('name').setDescription('Thread title').setRequired(true)
  );

export async function execute(inter: ChatInputCommandInteraction) {
  const name = inter.options.getString('name', true);
  if (!(inter.channel instanceof TextChannel)) return;
  const thread = await inter.channel.threads.create({
    name,
    type: ChannelType.PublicThread
  });
  await inter.reply(`Created thread <#${thread?.id}>`);
}