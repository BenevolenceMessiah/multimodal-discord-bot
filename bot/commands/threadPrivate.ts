import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ChannelType,
  TextChannel
} from 'discord.js';
declare module "discord.js";

export const data = new SlashCommandBuilder()
  .setName('thread-private')
  .setDescription('Create a private thread')
  .addStringOption(o =>
    o.setName('name').setDescription('Thread title').setRequired(true),
  );

  export async function execute(inter: ChatInputCommandInteraction) {
    const name = inter.options.getString('name', true);
    
    if (!inter.channel?.isTextBased()) return;
    if (!(inter.channel instanceof TextChannel)) return;
  
    const channel = inter.channel as TextChannel; 

    const thread = await channel.threads.create({
      name,
      type: ChannelType.PrivateThread,
      invitable: true,
    });
    
    await inter.reply(`Created private thread <#${thread?.id}>`);
  }