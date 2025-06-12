import fetch from 'node-fetch';
import { config } from '../src/config.js';
import { logger } from '../src/utils/logger.js';
import { AttachmentBuilder } from "discord.js";

export async function generateImage(prompt: string): Promise<AttachmentBuilder> {
  if (config.imagegenProvider !== 'stablediffusion') {
    throw new Error('Only Stable Diffusion provider implemented.');
  }

  /* ───── Forge / FLUX path ───── */
  if (config.flux?.enabled) {
    const body: any = {
      prompt,
      steps: config.flux.steps,
      //sampler_name: capitalize(config.flux.sampler),
      sampler_name: config.flux.sampler,
      sd_model_checkpoint: config.flux.modelName,
      //model_checkpoint: config.flux.modelName,
      sd_vae: config.flux.modules[2],
      flux_schedule_type: config.flux.schedule,
      //flux_schedule_type: config.flux.schedule.toLowerCase(), // Ensure this is top-level for the API
      flux_distilled_cfg_scale: config.flux.distilledCfg,
      cfg_scale: config.flux.cfgScale,
      width: config.flux.width,
      height: config.flux.height,
      seed: config.flux.seed,
      override_settings: {
        sd_vae: config.flux.modules[2],
        sd_model_checkpoint: config.flux.modelName,
        forge_additional_modules: config.flux.modules,
      },
    };

    logger.info(`Forge payload → ${JSON.stringify(body).slice(0, 200)}…`);

    const res = await fetch(
      `${config.endpoints.stablediffusion}/sdapi/v1/txt2img`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    );
    if (!res.ok) throw new Error(`Forge API ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { images: string[] };
    
    return new AttachmentBuilder(Buffer.from(data.images[0], 'base64'), {
      name: "image.png"
    });
  }

  function capitalize(s: string) {
    return s.length ? s[0].toUpperCase() + s.slice(1) : s;
  }

  /* ───── regular SD path ───── */
  // This path would be taken if config.flux.enabled is false
  // Ensure it has a valid payload if you intend to use non-FLUX SD
  const regularSdBody = { 
    prompt, 
    steps: 20,
    sampler_name: 'Euler',
  };
  
  logger.info(`Regular SD payload → ${JSON.stringify(regularSdBody).slice(0, 200)}…`);

  const res = await fetch(
    `${config.endpoints.stablediffusion}/sdapi/v1/txt2img`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(regularSdBody) },
  );
  
  if (!res.ok) {
    const errorBodyText = await res.text();
    logger.error(`SD API error ${res.status}: ${errorBodyText}`);
    throw new Error(`SD API status ${res.status}: ${errorBodyText}`);
  }
  
  const data = (await res.json()) as { images: string[] };
  return new AttachmentBuilder(Buffer.from(data.images[0], 'base64'), {
    name: "image.png"
  });
}