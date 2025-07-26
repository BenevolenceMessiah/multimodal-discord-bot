import express, { Request, Response } from 'express';
import path  from 'node:path';
import fs    from 'node:fs';
import { fileURLToPath } from 'node:url';

import multer from 'multer';
import { executeCommand }        from '@multimodal/core';
import { openTunnel, closeTunnel } from './tunnel.js';
import { pool, ensureSchema }      from './db.js';

/* ------------------------------------------------------------------ */
/* Paths                                                              */
/* ------------------------------------------------------------------ */
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const staticDir  = path.join(__dirname, 'public');
const assetsDir  = path.join(staticDir, 'assets');
const uploadsDir = path.join(staticDir, 'uploads');

/* ------------------------------------------------------------------ */
/* One‑off DB schema check                                            */
/* ------------------------------------------------------------------ */
await ensureSchema();

/* ------------------------------------------------------------------ */
/* Express & middleware                                               */
/* ------------------------------------------------------------------ */
const app  = express();
const PORT = Number(process.env.PORT ?? 3000);

app.use(express.json({ limit: '25mb' }));
app.use('/assets',  express.static(assetsDir , { immutable:true, maxAge:'1y', fallthrough:false }));
app.use('/uploads', express.static(uploadsDir));

/* Multer (simple disk storage for now) */
const upload = multer({ dest: uploadsDir });

/* ------------------------------------------------------------------ */
/* Sessions & messages                                                */
/* ------------------------------------------------------------------ */
app.get('/api/sessions', async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM sessions ORDER BY updated_at DESC'
  );
  res.json(rows);
});

app.post('/api/sessions', async (req, res) => {
  const title = req.body?.title ?? 'New chat';
  const { rows:[row] } = await pool.query(
    'INSERT INTO sessions(title) VALUES ($1) RETURNING *',
    [title]
  );
  res.json(row);
});

app.get('/api/sessions/:id/messages', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM messages WHERE session_id=$1 ORDER BY created_at',
    [req.params.id]
  );
  res.json(rows);
});

/* ------------------------------------------------------------------ */
/* Slash‑command catalogue                                            */
/* ------------------------------------------------------------------ */
// If your @multimodal/core exposes a registry use it; else return stub.
const commandList =
  (executeCommand as unknown as { list?: () => unknown }).list?.() ?? [];
app.get('/api/commands', (_req, res) => res.json(commandList));

/* ------------------------------------------------------------------ */
/* Execute command & persist                                          */
/* ------------------------------------------------------------------ */
app.post('/api/execute', async (req: Request, res: Response) => {
  const { sessionId, name, args } = req.body as {
    sessionId: string;
    name: string;
    args: Record<string, unknown>;
  };

  const result = await executeCommand({ name, args });

  await pool.query(
    `INSERT INTO messages (session_id, role, content, type) VALUES
      ($1, 'user',      $2, 'json'),
      ($1, 'assistant', $3, 'json')`,
    [sessionId, JSON.stringify({ name, args }), JSON.stringify(result)]
  );
  await pool.query(
    'UPDATE sessions SET updated_at = NOW() WHERE id = $1',
    [sessionId]
  );

  res.json(result);
});

/* ------------------------------------------------------------------ */
/* Image upload                                                       */
/* ------------------------------------------------------------------ */
app.post(
  '/api/upload',
  upload.single('file'),
  (
    req: Request & { file?: Express.Multer.File },
    res: Response
  ) => {
    if (!req.file)
      return res.status(400).json({ error: 'missing file' });
    res.json({ url: `/uploads/${req.file.filename}` });
  }
);

/* ------------------------------------------------------------------ */
/* Tunnel helpers                                                     */
/* ------------------------------------------------------------------ */
app.post('/api/tunnel', async (_req, res) =>
  res.json({ url: await openTunnel(PORT) })
);
app.delete('/api/tunnel', (_req, res) => {
  closeTunnel();
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Misc static / SPA fallback                                         */
/* ------------------------------------------------------------------ */
app.get('/favicon.ico', (_req, res) => {
  const fav = path.join(staticDir, 'favicon.ico');
  fs.existsSync(fav) ? res.sendFile(fav) : res.status(204).end();
});

app.use((_req, res) =>
  res.sendFile(path.join(staticDir, 'index.html'))
);

app.listen(PORT, () =>
  console.log(`WebUI listening on http://localhost:${PORT}`)
);
