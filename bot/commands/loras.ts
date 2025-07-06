import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  AttachmentBuilder,
} from "discord.js";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  listLoras,
  loraIconPath,
  fetchRemoteIcon,
} from "../services/lora.js";

/* ─── Constants ──────────────────────────────────────────────────── */
const PAGE_SIZE = 10;                  // items per embed page
const IDLE_MS   = 120_000;             // 2-min collector timeout
const LIMIT_B   = 256 * 1024;          // 256 KB thumbnail cap
const VIEW_MAX  = 10  * 1024 * 1024;   // 10 MB full-image cap

/* ─── Slash-command definition ───────────────────────────────────── */
export const data = new SlashCommandBuilder()
  .setName("loras")
  .setDescription("Browse LoRAs or view a full thumbnail")
  .addIntegerOption(o =>
    o.setName("page")
      .setDescription("Start page (1-based)")
      .setMinValue(1),
  )
  .addIntegerOption(o =>
    o.setName("view")
      .setDescription("Absolute LoRA index to show full preview")
      .setMinValue(1),
  );

/* ─── Utility helpers ────────────────────────────────────────────── */
async function resizeToAttachment(buf: Buffer, fileName: string): Promise<AttachmentBuilder | null> {
  try {
    let out = buf;
    if (buf.length > LIMIT_B) {
      out = await sharp(buf, { animated: true })
        .resize({ width: 128 })
        .jpeg({ quality: 80 })
        .toBuffer();
    }
    if (out.length > LIMIT_B) return null;
    return new AttachmentBuilder(out).setName(fileName);
  } catch { return null; }
}

async function makeThumbnail(name: string): Promise<AttachmentBuilder | null> {
  /* 1️⃣ Local icon? */
  const local = loraIconPath(name);
  if (local) {
    const stat = fs.statSync(local);
    if (stat.size <= LIMIT_B)
      return new AttachmentBuilder(local).setName(path.basename(local));

    const buf = await sharp(local, { animated: true })
      .resize({ width: 128 })
      .jpeg({ quality: 80 })
      .toBuffer();
    return buf.length <= LIMIT_B
      ? new AttachmentBuilder(buf).setName(`${name}.jpg`)
      : null;
  }

  /* 2️⃣ Remote icon from Forge */
  const remote = await fetchRemoteIcon(name);
  if (remote) return resizeToAttachment(remote, `${name}.jpg`);

  return null;
}

async function getFullPreview(name: string): Promise<AttachmentBuilder | null> {
  const local = loraIconPath(name);
  if (local && fs.statSync(local).size <= VIEW_MAX)
    return new AttachmentBuilder(local).setName(path.basename(local));

  const remote = await fetchRemoteIcon(name);
  if (remote && remote.length <= VIEW_MAX)
    return new AttachmentBuilder(remote).setName(`${name}.jpg`);

  return null;
}

/* ─── Embed builder ──────────────────────────────────────────────── */
async function buildEmbed(
  page: number,
  all: string[],
): Promise<{ embed: EmbedBuilder; files: AttachmentBuilder[] }> {
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const slice = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setTitle(`LoRAs — page ${page}/${pages}`)
    .setDescription(
      slice
        .map((n, i) => `**${(page - 1) * PAGE_SIZE + i + 1}.** \`${n}\``)
        .join("\n") || "_No LoRAs found_",
    )
    .setColor(0x9b59b6);

  for (const n of slice) {
    const file = await makeThumbnail(n);
    if (file) {
      embed.setThumbnail(`attachment://${file.name}`);
      return { embed, files: [file] };
    }
  }
  return { embed, files: [] };
}

/* ─── Button row factory ─────────────────────────────────────────── */
const rows = (disabled = false) =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("prev").setEmoji("◀️").setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId("refresh").setEmoji("🔄").setStyle(ButtonStyle.Secondary).setDisabled(disabled),
    new ButtonBuilder().setCustomId("next").setEmoji("▶️").setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId("stop").setEmoji("⏹️").setStyle(ButtonStyle.Danger).setDisabled(disabled),
  );

/* ─── Command handler ────────────────────────────────────────────── */
export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const all   = await listLoras();
  const view  = interaction.options.getInteger("view");
  const pageOpt = interaction.options.getInteger("page");

  /* -- Full-preview branch ---------------------------------------- */
  if (view !== null) {
    if (view < 1 || view > all.length) {
      return interaction.editReply(`❌ View index **${view}** out of range (1-${all.length}).`);
    }
    const name = all[view - 1];
    const full = await getFullPreview(name);
    if (!full)
      return interaction.editReply(`❌ Preview image for **${name}** exceeds 10 MB or is missing.`);
    await interaction.editReply({ files: [full] });

    // If no page requested, we're done
    if (pageOpt === null) return;
  }

  /* -- Paginated list --------------------------------------------- */
  let page  = Math.max(1, pageOpt ?? 1);
  let pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  page      = Math.min(page, pages);

  const first = await buildEmbed(page, all);
  const msg   = await interaction.followUp({
    embeds: [first.embed],
    files : first.files,
    components: [rows()],
  });

  const coll = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    idle: IDLE_MS,
  });

  coll.on("collect", async btn => {
    if (btn.user.id !== interaction.user.id)
      return btn.reply({ content: "Only the command author can paginate.", ephemeral: true });

    switch (btn.customId) {
      case "prev":    if (page > 1)   page--; break;
      case "next":    if (page < pages) page++; break;
      case "refresh":
        all.splice(0, all.length, ...(await listLoras()));
        page  = 1;
        pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
        break;
      case "stop":
        coll.stop("user");
        await btn.deferUpdate();
        return;
    }

    const upd = await buildEmbed(page, all);
    await btn.update({ embeds: [upd.embed], files: upd.files, components: [rows()] });
  });

  coll.on("end", () => msg.edit({ components: [rows(true)] }).catch(() => null));
}
