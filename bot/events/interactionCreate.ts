import { Events, Interaction } from "discord.js";
import { listLoras } from "../services/lora.js";

console.log("[events] LoRA autocomplete listener loaded");

export const name = Events.InteractionCreate;
export async function execute(interaction: Interaction) {
  if (!interaction.isAutocomplete()) return;

  // Only intercept autocomplete for the "/img" command and its "lora" option
  if (
    interaction.commandName === "img" &&
    interaction.options.getFocused(true).name === "lora"
  ) {
    const focusedFull = interaction.options.getFocused().trim();
    // Split on commas or whitespace to isolate the token being typed
    const parts     = focusedFull.split(/[\s,]+/);
    const lastToken = parts.pop()?.toLowerCase() ?? "";
    const prefixRaw = parts.join(", ").replace(/,\s*$/, "");

    const allLoras = await listLoras();
    const matches = allLoras
      .filter(n => n.toLowerCase().includes(lastToken))
      .slice(0, 25) // Discord caps suggestions at 25 items
      .map(n => {
        const value = prefixRaw ? `${prefixRaw}, ${n}` : n;
        return { name: n, value };
      });

    await interaction.respond(matches);
  }
}
