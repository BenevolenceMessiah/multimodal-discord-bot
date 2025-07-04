/*──────────────────────────────  Global configuration shape  ──────────────────────────────*/

export type FluxScheduler =
  /* Classic three */
  | 'Simple'
  | 'Karras'
  | 'Exponential'

  /* Modern variants */
  | 'Polyexponential'
  | 'Normal'
  | 'Uniform'
  | 'SGM Uniform'
  | 'SGM Karras'
  | 'DDIM'
  | 'DDIM Uniform'
  | 'DPM2'
  | 'DEIS'
  | 'DEIS Karras'
  | 'Turbo'
  | 'Beta'
  | 'KL'
  | 'KL Optimal'
  | 'AYS 11'
  | 'AYS 32'
  | 'AlignYourSteps'   // UI alias for AYS-11/32
  ;

/*───────────────  Top-level bot settings interface  ───────────────*/

export interface BotConfig {
  /* === Providers ================================================== */
  textgenProvider: 'ollama' | 'openrouter';
  voicegenProvider: 'alltalk' | 'elevenlabs';
  imagegenProvider: 'stablediffusion';
  search: { provider: 'tavily'; tavilyKey?: string };

  /* === Model names / IDs ========================================= */
  modelOllama?: string;
  modelOpenrouter?: string;
  modelAlltalk?: string;

  /* === Forge / FLUX block ======================================== */
  flux?: {
    enabled: boolean;

    /* model & run-time */
    modelName: string;          // e.g. “EVERFLUX_x1”
    steps: number;              // sampling steps
    sampler: string;            // keep free-form → supports all current & future samplers
    scheduler: FluxScheduler;   // exhaustive literal-union (compile-time safety)

    /* guidance */
    cfgScale: number;           // keep = 1 for Flux
    distilledCfg: number;       // usually 3-4

    /* seeds & dims */
    seed: number;               // –1 = random
    width: number;
    height: number;

    /* extra Forge modules */
    modules: string[];          // [clip, t5, vae]
  };

  /* === Prompting / generation ==================================== */
  systemMessage: string;
  maxTokens: number;
  keepAlive?: string | number;
  contextLength: number;
  temperature: number;
  stream: boolean;

  /* === Behaviour ================================================== */
  wakeWords: string[];
  maxLines: number;

  /* === Endpoints & API keys ====================================== */
  endpoints: Record<string, string>;
  openrouterKey?: string;
  elevenlabsKey?: string;

  /* Redis */
  redis: { enabled: boolean; url: string; ttl: number };

  /* Postgres */
  postgres: { enabled: boolean; url: string };
}
