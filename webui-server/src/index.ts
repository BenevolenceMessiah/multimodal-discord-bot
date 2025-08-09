import express, { Request, Response } from 'express';
import path  from 'node:path';
import fs    from 'node:fs';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

import multer from 'multer';
import { executeCommand }     from '@multimodal/core';
import { openTunnel, closeTunnel } from './tunnel.js';
import { pool, ensureSchema }      from './db.js';

/* ---------- Paths -------------------------------------------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const staticDir  = path.join(__dirname, 'public');
const assetsDir  = path.join(staticDir, 'assets');
const uploadsDir = path.join(staticDir, 'uploads');

/** OUTPUT_DIR default: a writable path outside build artifacts.
 *  You can override with env OUTPUT_DIR=/some/host/volume */
const OUTPUT_DIR = path.resolve(process.env.OUTPUT_DIR ?? path.join(process.cwd(), 'outputs'));
try { fs.mkdirSync(OUTPUT_DIR, { recursive: true }); } catch { /* ignore */ }

/* ---------- One-off DB schema -------------------------------------- */
await ensureSchema();

/* ---------- Express ------------------------------------------------ */
const app  = express();
const PORT = Number(process.env.PORT ?? 3000);

app.use(express.json({ limit: '25mb' }));

// Serve immutable assets (Vite hashed)
app.use('/assets', express.static(assetsDir, {
  immutable: true,
  maxAge: '1y',
  fallthrough: false
}));

// Serve uploaded images
app.use('/uploads', express.static(uploadsDir));

// Serve archived outputs (disable caching so new files appear immediately)
if (fs.existsSync(OUTPUT_DIR)) {
  app.use('/outputs', express.static(OUTPUT_DIR, {
    etag: true,
    cacheControl: true,
    maxAge: 0
  }));
}

// Multer storage
const upload = multer({ dest: uploadsDir });

/* ---------- In-memory fallback (no DB) ----------------------------- */
type Session = { id: string; title: string; created_at: string; updated_at: string; };
type MessageRow = { session_id: string; role: string; type: string; content: any; created_at: string; };

const mem = {
  sessions: [] as Session[],
  messages: [] as MessageRow[],
};
function memNewSession(title: string): Session {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const row: Session = { id, title, created_at: now, updated_at: now };
  mem.sessions.unshift(row);
  return row;
}

/* ---------- tiny query wrapper w/ fallback ------------------------- */
async function q<T = any>(sql: string, params: any[], fallback: () => T): Promise<T> {
  try {
    const r = await pool.query(sql, params);
    return r as unknown as T;
  } catch {
    return fallback();
  }
}

/* ---------- Sessions & messages ----------------------------------- */
app.get('/api/sessions', async (_req, res) => {
  const r = await q<{ rows: Session[] }>(
    'SELECT * FROM sessions ORDER BY updated_at DESC',
    [],
    () => ({ rows: mem.sessions })
  );
  res.json(r.rows);
});

app.post('/api/sessions', async (req, res) => {
  const title = req.body?.title ?? 'New chat';

  const r = await q<{ rows: Session[] }>(
    'INSERT INTO sessions(id,title) VALUES ($1,$2) RETURNING *',
    [crypto.randomUUID(), title],
    () => ({ rows: [memNewSession(title)] })
  );
  res.json(r.rows[0]);
});

app.get('/api/sessions/:id/messages', async (req, res) => {
  const id = req.params.id;

  const r = await q<{ rows: MessageRow[] }>(
    'SELECT * FROM messages WHERE session_id=$1 ORDER BY created_at',
    [id],
    () => ({ rows: mem.messages.filter(m => m.session_id === id).sort((a,b) => a.created_at.localeCompare(b.created_at)) })
  );
  res.json(r.rows);
});

/* ---------- Commands list ----------------------------------------- */
const DEFAULT_CMDS = ['say','draw','help'];
app.get('/api/commands', (_req, res) => {
  const anyExec: any = executeCommand;
  if (anyExec && typeof anyExec.list === 'function') {
    try { return res.json(anyExec.list()); } catch {}
  }
  return res.json(DEFAULT_CMDS);
});

/* ---------- Execute command & persist ----------------------------- */
app.post('/api/execute', async (req: Request, res: Response) => {
  const { sessionId, name, args } = req.body as {
    sessionId: string; name: string; args: Record<string,unknown>;
  };

  const result = await executeCommand({ name, args });

  await q(
    `INSERT INTO messages(session_id,role,content,type) VALUES
     ($1,'user',      $2,'json'),
     ($1,'assistant', $3,'json')`,
    [ sessionId, JSON.stringify({ name,args }), JSON.stringify(result) ],
    () => {
      const now = new Date().toISOString();
      mem.messages.push({ session_id: sessionId, role: 'user',      type: 'json', content: { name,args }, created_at: now });
      mem.messages.push({ session_id: sessionId, role: 'assistant', type: 'json', content: result,        created_at: now });
      return { rows: [] };
    }
  );

  await q(
    'UPDATE sessions SET updated_at = NOW() WHERE id=$1',
    [sessionId],
    () => { const s = mem.sessions.find(s => s.id === sessionId); if (s) s.updated_at = new Date().toISOString(); return { rows: [] }; }
  );

  res.json(result);
});

/* ---------- Image upload ------------------------------------------ */
app.post('/api/upload', upload.single('file'), (req, res) => {
  const file = (req as unknown as { file?: Express.Multer.File }).file;
  if (!file) return res.status(400).json({ error:'missing file' });
  res.json({ url: `/uploads/${file.filename}` });
});

/* ---------- Tunnel helpers ---------------------------------------- */
app.post('/api/tunnel', async (_req,res) => res.json({ url: await openTunnel(PORT) }));
app.delete('/api/tunnel', (_req,res) => { closeTunnel(); res.json({ ok:true }); });

/* ---------- Misc static ------------------------------------------- */
app.get('/favicon.ico', (_req,res) => {
  const fav = path.join(staticDir,'favicon.ico');
  fs.existsSync(fav) ? res.sendFile(fav) : res.status(204).end();
});

/* ---------- SPA fallback (disable caching) ------------------------ */
app.use((_req,res) => {
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(staticDir,'index.html'));
});

app.listen(PORT, () => {
  console.log(`WebUI listening on http://localhost:${PORT}`);
});
