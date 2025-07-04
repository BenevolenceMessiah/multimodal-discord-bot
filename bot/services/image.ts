import fetch from 'node-fetch';
import { config } from '../src/config.js';
import { logger } from '../src/utils/logger.js';
import { AttachmentBuilder } from 'discord.js';

export async function generateImage(prompt: string): Promise<AttachmentBuilder> {
  if (config.imagegenProvider !== 'stablediffusion') {
    throw new Error('Only Stable Diffusion provider implemented.');
  }

  /* ───── Forge / FLUX path ───── */
  if (config.flux?.enabled) {
    /* 1 Normalise & validate parameters */
    const sampler   = titleCase(config.flux.sampler);   // “euler” → “Euler”
    const scheduler = config.flux.scheduler;            // Simple, Karras, …
    const minSteps  = scheduler === 'Simple' ? 20 : 1;  // Flux preset
    const steps     = Math.max(config.flux.steps, minSteps);

    /* 2 Build API payload */
    const body: any = {
      prompt,
      steps,
      sampler_name: sampler,
      scheduler,                                        // ← NEW official key
      sd_model_checkpoint: config.flux.modelName,
      sd_vae: config.flux.modules[2],
      flux_distilled_cfg_scale: config.flux.distilledCfg,
      cfg_scale: config.flux.cfgScale,
      width: config.flux.width,
      height: config.flux.height,
      seed: config.flux.seed,
      override_settings: {
        sd_model_checkpoint: config.flux.modelName,
        sd_vae: config.flux.modules[2],
        forge_additional_modules: config.flux.modules,
      },
    };

    logger.info(`Forge payload → ${JSON.stringify(body).slice(0, 200)}…`);

    const res = await fetch(
      `${config.endpoints.stablediffusion}/sdapi/v1/txt2img`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    );
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Forge API ${res.status}: ${errText}`);
    }
    const data = (await res.json()) as { images: string[] };

    return new AttachmentBuilder(Buffer.from(data.images[0], 'base64'), {
      name: 'image.png',
    });
  }

  /* ───── regular SD path ───── */
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
    name: 'image.png',
  });
}

/* ───── helpers ───── */
function titleCase(s: string) {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}
