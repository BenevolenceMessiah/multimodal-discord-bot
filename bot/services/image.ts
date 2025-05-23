import fetch from 'node-fetch';
import { config } from '../src/config.js';
import { logger } from '../src/utils/logger.js';

export async function generateImage(prompt: string): Promise<Buffer> {
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
      flux_schedule_type: config.flux.schedule.toLowerCase(), // Ensure this is top-level for the API
      flux_distilled_cfg_scale: config.flux.distilledCfg,
      cfg_scale: config.flux.cfgScale,          // keep 1 for FLUX
      width: config.flux.width,
      height: config.flux.height,
      seed: config.flux.seed,
      override_settings: {
        //sampler_name: capitalize(config.flux.sampler),
        //sd_vae: config.flux.modules[2],
        //model_checkpoint: config.flux.modelName,
        //sd_model_checkpoint: config.flux.modelName,
        //flux_schedule_type: config.flux.schedule, // Kept here as per your structure, might be redundant or specific to FLUX override
        //flux_distilled_cfg_scale: config.flux.distilledCfg,
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
  return Buffer.from(data.images[0], 'base64');
}

function capitalize(s: string) {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

  /* ───── regular SD path ───── */
  // This path would be taken if config.flux.enabled is false
  // Ensure it has a valid payload if you intend to use non-FLUX SD
  const regularSdBody = { 
    prompt, 
    steps: 20, // Default or from a generic SD config section
    sampler_name: 'Euler', // Default or from a generic SD config section
    // Add other necessary parameters for non-FLUX SD
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
  return Buffer.from(data.images[0], 'base64');
}