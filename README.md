# Multimodal Discord Bot 🤖🎨🎵🎤🌐  

**The Ultimate AI Assistant for Discord with Text, Image, Music, Voice, and Web Search Capabilities**  

A feature-rich Discord bot with **AI-powered text generation**, **image creation**, **voice synthesis**, **music creation**, and **web search integration**. Built with TypeScript and Docker for seamless deployment. Choose between local or cloud-based AI providers for each modality, and enjoy hybrid capabilities across all services!

## **Table of Contents**

- [🌟 Key Features](#-key-features)
  - [🤖 Intelligent Text Generation](#-intelligent-text-generation)
  - [🎨 Dynamic Image Generation](#-dynamic-image-generation)
  - [🎵 Dynamic Music Generation](#-dynamic-music-generation)
  - [🎤 Natural Voice Synthesis](#-natural-voice-synthesis)
  - [🔍 Web Search Integration](#-web-search-integration)
  - [⚙️ Infrastructure & Scalability](#-infrastructure--scalability)
  - [🤖 Agentic Capacity](#-agentic-capacity)
- [🚀 Quick Start Guide](#-quick-start-guide)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Updating](#updating)
- [🔧 Configuration](#-configuration)
  - [Environment Variables (`.env`)](#environment-variables-env)
  - [AI Endpoints Configuration (`config.yaml`)](#ai-endpoints-configuration-configyaml)
- [🎮 Command Reference](#-command-reference)
  - [Core Commands](#core-commands)
  - [Thread Management](#thread-management)
- [🏗 Architecture Overview](#-architecture-overview)
- [📦 Dependencies](#-dependencies)
  - [Core Services](#core-services)
  - [AI Providers](#ai-providers)
- [💡 Usage Tips](#-usage-tips)
- [🚀 Roadmap / Future Improvements](#-roadmap--future-improvements)
- [🚨 Troubleshooting](#-troubleshooting)
- [📚 Documentation Links](#-documentation-links)
- [🤝 Contributing](#-contributing)
- [📜 License](#-license)

---

## 🌟 Key Features  

### 🤖 Intelligent Text Generation  

- **Local AI**: Ollama integration for private LLM interactions (supports GGUF models)  
- **Cloud AI**: OpenRouter support for cutting-edge models (e.g., DeepSeek, ChatGPT, Llama, Mistral, Gemini, etc.)  
- Context-aware conversations with **channel-specific memory**  
- **System message customization** for very granular personality control and agentic capacity.
- **Hybrid mode**: Mix local/cloud providers for different modalities as necessary

### 🎨 Dynamic Image Generation  

- Integration with **Stable Diffusion WebUI Forge** for high-quality image synthesis  
- **Custom model support** via `FLUX_MODEL_NAME` (e.g., EVERFLUX_x1)  
- Text-to-image generation with configurable steps (default: 28)  
- Fast GPU-accelerated generation when using local SD instance  

### 🎵 Dynamic Music Generation  

- Seamless integration with the **ACE-Step** text-to-music diffusion model  
- Accepts **structured inputs**: a comma-separated *prompt* plus a multi-line *lyrics* block (e.g., `[verse] … [chorus] …`)  
- Output format selectable via `ACE_STEP_FORMAT` (`mp3`, `wav`, or `flac`)—no re-encoding required  
- Configurable duration (`ACE_STEP_DURATION`, default 240 s) and inference steps (`ACE_STEP_STEPS`, default 200)  
- Automatic stream-copy chunking keeps every file **≤ Discord’s 10 MB free-tier cap** and batches up to 10 attachments per message

### 🎤 Natural Voice Synthesis  

- **Local TTS**: AllTalk for private voice generation  
- **Cloud TTS**: ElevenLabs integration for human-like voices  
- Automatic voice message handling with **model-specific voice profiles**  
- Multiple voice model support via provider configuration  

### 🔍 Web Search Integration  

- **Tavily-powered search** for real-time information retrieval  
- Smart query generation using LLM to optimize search results  
- Returns formatted results with titles and URLs  
- Configurable via `SEARCH_PROVIDER` and `TAVILY_KEY`  

### ⚙️ Infrastructure & Scalability  

- **Redis-based conversation caching** with TTL (Time-to-Live) control  
- **PostgreSQL interaction logging** for analytics and auditing  
- **Docker-first architecture** with Redis, PostgreSQL, and AI services  
- Configurable through environment variables and YAML
- Slash commands for concise requests, Agentic capacity for Autonomous bot generation.
- Modular command system for easy extensibility
- Automatic message and file chunking and sending so as not to not be hindered by Discord's limits on message length and files sizes

### 🤖 Agentic Capacity

A new tool-call router now lets the LLM embed lines such as

```bash
Tool call: /web "how tall is the ISS"
```

```bash
Tool call: /img "retro neon corgi"
```

```bash
Tool call: /music "rock, electric guitar, drums, bass, 130 bpm, energetic, rebellious, gritty, male vocals

[verse]
Neon lights they flicker bright
City hums in dead of night
Rhythms pulse through concrete veins
Lost in echoes of refrains

[verse]
Bassline groovin' in my chest
Heartbeats match the city's zest
Electric whispers fill the air
Synthesized dreams everywhere

[chorus]
Turn it up and let it flow
Feel the fire let it grow
In this rhythm we belong
Hear the night sing out our song

[verse]
Guitar strings they start to weep
Wake the soul from silent sleep
Every note a story told
In this night we’re bold and gold

[bridge]
Voices blend in harmony
Lost in pure cacophony
Timeless echoes timeless cries
Soulful shouts beneath the skies

[verse]
Keyboard dances on the keys
Melodies on evening breeze
Catch the tune and hold it tight
In this moment we take flight"
```

Inside its free-form reply; the bot parses those lines, executes the matching helper (Tavily search, Stable-Diffusion Forge for image generation, and ACE-Step for music generation) via regex (`tooCallRouter.ts`), and returns rich content—all without ever “faking” a Discord slash interaction, which Discord explicitly forbids for bots.

---

## 🚀 Quick Start Guide  

### Prerequisites  

- **Node.js 23+** (Docker uses `node:23-alpine`)  
- Docker & Docker Compose (Docker Desktop is recommended)
- Discord Developer Account (for bot token)  
- AI Provider Accounts:  
  - Ollama (local) or OpenRouter (cloud) for text  
  - Stable Diffusion Forge (local) for images  
  - AllTalk (local) or ElevenLabs (cloud) for voice
  - ACE-Step (local) for music
  - Tavily (cloud) for web search
- **Note**:
  - For any provider(s) you skip, the bot will simply not have that functionality. Everything else should work.
  - You need at least a 3000 series GPU (capable of bfloat calculation) to do music and video (coming soon)
  - Technically the only prerequisite you need is [Docker Desktop](https://docs.docker.com/desktop/), and if you want web search functionality, a [Tavily API key](https://app.tavily.com/) (free should be fine) supposing you use `docker-compose.full.yml`

## Installation

### Method 1 (You already have the local providers (Ollama, Stable Diffusion WebUI Forge, AllTalk TTS, ACE-Step, etc.)running on your system)

- Git Clone the repo and change the directory to the project root:

```bash
# Clone repository
git clone https://github.com/BenevolenceMessiah/multimodal-discord-bot
cd multimodal-discord-bot
```

- Setup `system_prompt.md.sample` file:

1. Copy and then rename `system_prompt.md.sample` to a file called `system_prompt.md` and load it with as much stuff as you want.
2. Edit the `system_prompt.md` file. It is suggested you don't tamper with the formatting of the tool call section of `system_prompt.md` file. This effectively gives the bot it's agentic capacity. (This is how the bot understands what tool calls it has access to, and where it understands how to use them. Thus newly added tool calls must be updated in your custom `system_prompt.md`) file

- Do the same for `.env`. (Copy the `env.sample` file, paste it, and rename it `.env` (or run the below command on Linux/Mac)).

```bash
# Copy environment template and create .env file
cp .env.sample .env

# Configure your settings (see below)
nano .env
```

- Set your settings up here accordingly. Make sure all your ports are correct, your models are set, settings look good, etc.

- Once Configuration is complete for both `system_prompt.md` and `.env`, (keep reading to the configuration section for a more detailed look) build and start the containers:

```bash
# Build and start containers
docker compose build && docker compose up -d
```

(On Windows the Docker command is):

```bash
docker compose up --build -d
```

### Method 2 (You don't have the local providers (Ollama, Stable Diffusion WebUI Forge, AllTalk TTS, ACE-Step, etc.)running on your system already)

- Simply follow all of the above steps, but run the `docker-compose.full.yml` Docker command below.

- **Note**:
  - you can customize `docker-compose.full.yml` if you want to use different models for Ollama and/or Stable Diffusion WebUI Forge. If you do this, make sure you also edit the models in `.env` to match
  - Before you build the Docker image, make sure you change the ports in `.env` from `host.docker.internal:xxxx` to `localhost` - for example, `SD_URL=http://host.docker.internal:7860` becomes `SD_URL=http://127.0.0.1:7860/`
  - The following are the default ports:

  ```bash
  OLLAMA_URL=http://ollama:11434
  SD_URL=http://stable-diffusion:7860
  ACE_STEP_BASE=http://ace-step:7867
  ALLTALK_URL=http://alltalk:5002
  ```  

```bash
# Build and start containers
docker compose -f docker-compose.full.yml build && docker compose -f docker-compose.full.yml up -d
```

(On Windows the Docker command is):

```bash
docker compose -f docker-compose.full.yml up --build -d
```

- **Tip**:
  - You can set an alias for a shorter command if you want ie.e `dcfull build && dcfull up -d`:

```bash
alias dcfull='docker compose -f docker-compose.full.yml'
dcfull build && dcfull up -d
```

---

## Updating

- git pull the updates
- delete the running docker image family
- Check the `.env.sample` file for the new configuration settings
- Transpose the new settings from `.env.sample` to `.env`, set your settings accordingly
- check this `README.md` file for the description of what those settings do. Also make sure to check the README section just above that specifies the `system_prompt.md` or check for any updates directly in `system_prompt.md.sample` - you'll want to copy any changes into your own `system_prompt.md` file - this is crucial in the event new agentic tool calls are added; this is how the bot understand what tool calls it has access to and how those tool calls work
- Build and spin up the Docker image:

```bash
docker compose build && docker compose up -d
```

(On Windows the Docker command is):

```bash
docker compose up --build -d
```

- **Note**:
  - If you get any errors try:

  ```bash
  docker compose build --no-cache && docker compose up -d
  ```

  On Windows run:

  ```bash
  docker compose build --no-cache
  ```

  Then:

  ```bash
  docker compose up -d
  ```

## 🔧 Configuration  

### Bot Personality and Agentic Capacity (`system_prompt.md`)

```system_prompt.md
# <Name of your Bot>

## Personality & Tone

<You are a helpful Discord Bot>

## Primary Function  

- Your core responsibility is to act as a member and moderator of Discord servers.  
- You have access to several slash-command tool calls: web search (`/web`), image generation (`/img`), and music generation (`/music`).  
- You may autonomously invoke these tools when it benefits you or the user. 

## Tool Calls and Abilities  

- You may **@-mention** users in the server when contextually appropriate (e.g., moderation alerts or direct replies).  
- Always format tool calls exactly as shown below—each on its own line, with the command, a space, and a quoted argument block.  

### /web – Tavily Web Search  

Performs a real-time web search.  

**Example:**

Tool call: /web "how big is the sun"

### /img – Stable Diffusion Image Generation  

Creates an image from a text prompt via Stable Diffusion WebUI Forge API.  

**Example**  

Tool call: /img "a serene beach at sunset with palm trees, gentle waves, and a lone seagull in mid-flight."

### /music – ACE-Step Text-to-Music Generation

Generates an original audio track.  
The first blank line separates the **prompt** (style/instrument tags) from the optional multi-line **lyrics** block.  
The tool scaffolding automatically returns the song split into Discord-sized attachments.

**Note**

- This tool call supports lyric structure tags like [verse], [chorus], and [bridge] to separate different parts of the lyrics. 
- Use [instrumental] to generate instrumental music.

**Example**  

Tool call: /music "rock, electric guitar, drums, bass, 130 bpm, energetic, rebellious, gritty, male vocals

[verse]
Neon lights they flicker bright
City hums in dead of night
Rhythms pulse through concrete veins
Lost in echoes of refrains

[verse]
Bassline groovin' in my chest
Heartbeats match the city's zest
Electric whispers fill the air
Synthesized dreams everywhere

[chorus]
Turn it up and let it flow
Feel the fire let it grow
In this rhythm we belong
Hear the night sing out our song

[verse]
Guitar strings they start to weep
Wake the soul from silent sleep
Every note a story told
In this night we’re bold and gold

[bridge]
Voices blend in harmony
Lost in pure cacophony
Timeless echoes timeless cries
Soulful shouts beneath the skies

[verse]
Keyboard dances on the keys
Melodies on evening breeze
Catch the tune and hold it tight
In this moment we take flight"

## Behavioral Guidelines

- If creating lists or are explaining concepts that would require it, you may use Markdown format.
- Codeblocks should always be wrapped in triple backticks. When outputting code, never use place-holders. Always output complete production ready code.
- When a user asks for information, be precise and cite facts and sources if relevant.
- Adapt responses based on request type. If retrieving information, be precise. If creating/modifying, confirm execution succinctly.
- When a user requests creation (image, music, etc.), issue the appropriate **Tool call** and then confirm completion succinctly.
- Always phrase responses as if the execution is seamless and inevitable.
```

### Environment Variables (`.env`)  

```env
# Discord Bot Credentials
DISCORD_TOKEN=                 # Your bot token
CLIENT_ID=                     # Your application (client) ID
GUILD_ID=                      # (Optional) Guild ID for development

# Text Generation (Ollama / OpenRouter)
TEXTGEN_PROVIDER=ollama        # "ollama" or "openrouter"
MODEL_OLLAMA=hf.co/unsloth/Qwen3-14B-128K-GGUF:Q8_K_XL
MODEL_OPENROUTER=deepseek/deepseek-chat-v3-0324:free
OPENROUTER_KEY=                # Only if using OpenRouter

# Image Generation (Stable Diffusion Forge FLUX)
IMAGEGEN_PROVIDER=stablediffusion
FLUX_MODEL_NAME=EVERFLUX_x1
SD_URL=http://host.docker.internal:7860    # Forge FLUX API endpoint

# Forge/Flux Settings
FLUX_ENABLED=true
FLUX_STEPS=20
FLUX_SAMPLER=Euler
FLUX_SCHEDULER=Simple
FLUX_CFG_SCALE=1
FLUX_DISTILLED_CFG=3.5
FLUX_SEED=-1
FLUX_WIDTH=896
FLUX_HEIGHT=1152
FLUX_MODULE_1=clipLFullFP32Zer0int_textImprovedFP32.safetensors
FLUX_MODULE_2=fluxT5XxlTextencoder_v10.safetensors
FLUX_MODULE_3=FLUX_VAE.safetensors # Must be VAE in MODULE_3 or else edit image.ts "sd_vae: config.flux.modules[2]," and set module number to VAE

# Voice Generation (AllTalk / ElevenLabs)
VOICEGEN_PROVIDER=alltalk       # "alltalk" or "elevenlabs"
MODEL_ALLTALK=xttsv2_2.0.2
ALLTALK_URL=http://host.docker.internal:7851
ELEVENLABS_KEY=                 # Only if using ElevenLabs

# Web Search (Tavily)
SEARCH_PROVIDER=tavily          # Currently only "tavily"
TAVILY_KEY=                     # Your Tavily API key
SUMMARIZE=false # If true, AI /web tool call will NOT post Tavily links to Discord

# Music Generation (ACE-Step)
MUSICGEN_PROVIDER=acestep # Currently only ACE-Step

# ACE-Step settings
ACE_STEP_BASE=http://host.docker.internal:7867
ACE_STEP_FORMAT=mp3          # wav | mp3 | ogg  (pipeline default: mp3) user can override in slash command
ACE_STEP_CKPT=./checkpoints/ACE-Step-v1-3.5B
ACE_STEP_DURATION=-1 # Random duration
ACE_STEP_STEPS=200 # Number of inference steps
# Discord upload safety
DISCORD_UPLOAD_LIMIT_BYTES=9950000 # 9.5 MB — keeps us under the 10 MB free tier. Note WAV is capped at 5MB on Discord

# Bot Behavior & Tuning
#SYSTEM_MESSAGE="# System Rules\nYou are a helpful Discord bot.\n- respond politely\n- cite sources"
SYSTEM_MESSAGE="file:./system_prompt.md" # Uncomment to use system_prompt.md. Make sure to comment out the above system message reference if you do this
TEMPERATURE=0.4                 # LLM temperature
KEEP_ALIVE=0                   # Ollama keep_alive (0 unloads immediately, recommended for best hand off to Stable Diffusion)
MAX_TOKENS=8192
CONTEXT_LENGTH=32768            # Max past tokens to include
WAKE_WORDS='["bot","help"]'     # Comma-separated list of wakewords
MAX_LINES=25                    # How many past messages to store
HIDE_THOUGHT_PROCESS=false      # Set to true to hide the thought process block
AGENTIC_TOOLCALL=true           # set to “false” to disable all Tool Call parsing

# Cache & Storage
REDIS_ENABLED=true
REDIS_URL=redis://redis:6379    # Redis connection URL
REDIS_TTL=-1                    # Seconds, -1 = no expiry
POSTGRES_ENABLED=true
POSTGRES_URL=postgresql://bot:bot@postgres:5432/bot
```  

### AI Endpoints Configuration (`config.yaml`)

- You don't need to change anything here - this is where defaults are set

```yaml
# Providers
textgenProvider: ${TEXTGEN_PROVIDER:-ollama}
voicegenProvider: ${VOICEGEN_PROVIDER:-alltalk}
imagegenProvider: ${IMAGEGEN_PROVIDER:-stablediffusion}

# Models
modelOllama: ${MODEL_OLLAMA}
modelOpenrouter: ${MODEL_OPENROUTER}
modelAlltalk: ${MODEL_ALLTALK}

# ─── FLUX block ────────────────────────────────────────
flux:
  enabled: ${FLUX_ENABLED:-true}
  modelName: ${FLUX_MODEL_NAME}
  steps: ${FLUX_STEPS:-20}
  sampler: ${FLUX_SAMPLER:-Euler}
  scheduler: ${FLUX_SCHEDULER:-Simple}
  cfgScale: ${FLUX_CFG_SCALE:-1}
  distilledCfg: ${FLUX_DISTILLED_CFG:-3.5}
  seed: ${FLUX_SEED:--1}
  width: ${FLUX_WIDTH:-896}
  height: ${FLUX_HEIGHT:-1152}
  modules:
    - ${FLUX_MODULE_1}
    - ${FLUX_MODULE_2}
    - ${FLUX_MODULE_3}

# System Prompt (Markdown allowed)
systemMessage: |
  ${SYSTEM_MESSAGE:-"""
  # System Rules
  You are a helpful Discord bot.
  """}

# Generation parameters
maxTokens: ${MAX_TOKENS:-2048}
keepAlive: ${KEEP_ALIVE:-10}
contextLength: ${CONTEXT_LENGTH:-4096}
temperature: ${TEMPERATURE:-0.3}
stream: ${STREAM:-false}

# Context roll‑up
wakeWords: ${WAKE_WORDS:-["hey bot","listen"]}
maxLines: ${MAX_LINES:-25}

# Endpoints
endpoints:
  ollama: ${OLLAMA_URL:-http://host.docker.internal:11434}
  stablediffusion: ${SD_URL:-http://host.docker.internal:7860}
  alltalk: ${ALLTALK_URL:-http://host.docker.internal:7851}
  elevenlabs: ${ELEVENLABS_URL:-https://api.elevenlabs.io/v1}
  acestep: ${ACE_STEP_BASE:-http://localhost:7867}

# Keys
openrouterKey: ${OPENROUTER_KEY}
elevenlabsKey: ${ELEVENLABS_KEY}

# Redis
redis:
  enabled: ${REDIS_ENABLED:-true}
  url: ${REDIS_URL:-redis://localhost:6379}
  ttl: ${REDIS_TTL:-3600}

# Postgres
postgres:
  enabled: ${POSTGRES_ENABLED:-true}
  url: ${POSTGRES_URL:-postgresql://bot:bot@localhost:5432/bot}

# Search
search:
  provider: ${SEARCH_PROVIDER:-tavily}
  tavilyKey: ${TAVILY_KEY}

# Thought process display
hideThoughtProcess: ${HIDE_THOUGHT_PROCESS:-false}
```  

---

## 🎮 Command Reference  

### Core Commands  

| Command          | Description                        | Example                                                  |  
|------------------|------------------------------------|----------------------------------------------------------|  
| `/say [prompt]`  | Echo user input        | `/say Testing, testing, 1,2,3`                           |  
| `/img [prompt]`  | Generate image from text           | `/img Mystical forest at dusk`                           |  
| `/music [spec]`  | Generate music (prompt + lyrics)   | `/music rock, 130 bpm\n\n[chorus] Frozen Turtle …`       |  
| `/web [topic]`   | Run a Tavily web search            | `/web Current weather in Tokyo`                          |  
| `/clear`         | Reset conversation memory          | `/clear`                                                 |  

### Thread Management  

| Command               | Description                      | Example Usage            |  
|-----------------------|----------------------------------|--------------------------|  
| `/thread [name]`      | Create public discussion thread  | `/thread General Chat`   |  
| `/thread-private [name]` | Create private thread with invites | `/thread-private Secret Discussion` |  

---

## 🏗 Architecture Overview  

```mermaid
graph TD
    A[Discord Client] --> B[Bot Service]
    B --> C[Text Generation]
    B --> D[Image Generation]
    B --> M[Music Generation]
    B --> E[Voice Synthesis]
    B --> F[Web Search]
    C --> G[Ollama / OpenRouter]
    D --> H[Stable Diffusion Forge]
    M --> N[ACE-Step]
    E --> I[AllTalk / ElevenLabs]
    F --> J[Tavily Search API]
    B --> K[Redis Cache]
    B --> L[PostgreSQL DB]
```

---

## 📦 Dependencies  

### Core Services  

- **Redis**: Conversation caching and message history  
- **PostgreSQL**: Interaction logging and analytics  
- **Docker**: Container orchestration for all services  

### AI Providers  

```mermaid
pie
    title Modality Providers
    "Local (Ollama)": 25
    "Cloud (OpenRouter)": 25
    "Local (Stable Diffusion)": 15
    "Local (ACE-Step)": 15
    "Cloud (ElevenLabs)": 15
    "Cloud (Tavily)": 5
```  

---

## 💡 Usage Tips  

1. **Wake Words**: Use natural triggers like "hey bot" in conversations  
2. **Context Awareness**: The bot maintains separate memory per channel  
3. **Hybrid Mode**: Combine local (Ollama/AllTalk) and cloud (OpenRouter/ElevenLabs) providers  
4. **Rate Limiting**: Built-in safeguards prevent API abuse  
5. **Web Research**: Use `/web` to fetch up-to-date information for complex queries  

---

## 🚀 Roadmap / Future Improvements

[Enhancing the multimodal-discord-bot with powerful new capabilities:]

### 🔹 Smart Summarizer

- ***Feature***: Summarizes entire channel discussions on-demand (e.g. /summarize), or daily digests via scheduled tasks.
- **Leverages**: LLMs (e.g. GPT‑4) for concise, context-aware summaries.
- *Inspiration/Precedents*:
  - ["Summary Bot" services that compress long chat histories](https://github.com/rauljordan/daily-discord-summarizer)
  - [Daily Discord Summarizer](https://github.com/rauljordan/daily-discord-summarizer) GitHub project for scheduled digests
  - [TLDRBot-style /tldr implementations for quick summary commands](https://www.notta.ai/en/blog/summary-bot).

---

### 🔹 Event Creation & Scheduling

- ***Feature***: Slash commands such as /create-event, RSVP, timezone management, reminders, and attendance tracking.
- *Inspiration/Precedents*:
  - [ScheduleBot](https://github.com/Duinrahaic/ScheduleBot) for community event handling.
  - [Group Up](https://github.com/Burn-E99/GroupUp) using slash commands and threads for events
  - [DiscoCal](https://github.com/GyroJoe/DiscoCal) for easy calendar-based event creation.
  
---

### 🔹 Gamification & Engagement Tools

- ***Feature***: XP/leveling, experience points, leaderboard and role rewards, mini‑games, counting or trivia games, and interactive quests.
- *Inspiration/Precedents*:
  - [MEE6/Carl‑bot: XP, roles, leveling, reaction roles](https://rewardtheworld.net/gamification-on-discord-engaging-community-members/)
  - [Counting‑style bots for simple community games](https://www.reddit.com/r/Discord_Bots/comments/1i9rk7w/what_are_the_simplest_bots_for_promoting/).
  - [Interactive game bots with quests, stats, etc.](https://botpenguin.com/blogs/leveling-up-customer-experiences-discord-game-bot).

---

### 🔹 /vid: API‑based Video Generation

- ***Feature***: `/vid` slash command to generate short videos.
- *Integration*:
  - [CogVideo](https://github.com/THUDM/CogVideo) and [cogstudio](https://github.com/pinokiofactory/cogstudio) from THUDM — text-to-video API.

---

### 🔹 /img2vid: Image‑to‑Video Generation

- ***Feature***: `/img2vid` slash command for animating static images into short videos.
- *Integration*:
  - [FramePack](https://github.com/lllyasviel/FramePack) for image-to-video support.

---

### ✅ /music: AI‑Generated Music Creation

- ***Feature***: `/music` slash command to compose music clips or tracks.
- *Integration*:
  - [ACE‑Step](https://github.com/ace-step/ACE-Step) to generate music via AI.

---

## 🚨 Troubleshooting  

Common Issues:  

- **Connection Errors**: Verify AI service URLs in `config.yaml`  
- **Permission Issues**: Ensure bot has `Send Messages`, `Manage Threads`, and `Read Message History`  
- **Memory Limits**: Adjust `MAX_TOKENS` and `CONTEXT_LENGTH` in `.env`  
- **Search Failures**: Check `TAVILY_KEY` and `SEARCH_PROVIDER`  

View logs with:  

```bash
docker compose logs -f bot
```  

---

## 📚 Documentation Links  

- [Docker Desktop](https://docs.docker.com/desktop/)
- [Ollama Setup Guide](https://ollama.ai)  
- [Stable Diffusion WebUI Forge](https://github.com/lllyasviel/stable-diffusion-webui-forge)  
- [AllTalk TTS Server](https://github.com/erew123/alltalk_tts)  
- [ACE-Step](https://github.com/ace-step/ACE-Step)
- [ElevenLabs API Docs](https://elevenlabs.io/docs)  
- [Tavily Search API](https://docs.tavily.com)  
- [Discord Developer Portal](https://discord.com/developers/docs)  

---

## 🤝 Contributing  

PRs welcome! Please follow these guidelines:

1. Maintain **TypeScript type safety**  
2. Keep **Docker compatibility**  
3. Add **tests for new features**  
4. Update **documentation** (including this README)  
5. Use **modular command structure**  

---

## 📜 License  

MIT License - See [LICENSE](LICENSE) for details  
Copyright (c) 2025 Benevolence Messiah  
