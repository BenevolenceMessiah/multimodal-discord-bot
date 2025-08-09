// webui-server/scripts/build-client.mjs
/* Build the WebUI client by PATH, copy assets into the server, and stamp HTML. */
import { execSync } from 'node:child_process';
import fs   from 'node:fs';
import fsp  from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT        = path.resolve(process.cwd());            // webui-server/
const CLIENT_DIR  = path.resolve(ROOT, '..', 'webui-client');
const DIST_DIR    = path.join(CLIENT_DIR, 'dist');
const SERVER_PUB  = path.join(ROOT, 'public');
const SERVER_ASSETS = path.join(SERVER_PUB, 'assets');
const SERVER_UPLOADS = path.join(SERVER_PUB, 'uploads');

// 1) Build by directory (pnpm -C == --dir)
console.log('[webui] building client from', CLIENT_DIR);
execSync('pnpm -C "' + CLIENT_DIR + '" run build', { stdio: 'inherit' }); // pnpm validates CLI & supports --dir/-C :contentReference[oaicite:6]{index=6}

// 2) Ensure server public dirs
fs.mkdirSync(SERVER_PUB, { recursive: true });
fs.mkdirSync(SERVER_ASSETS, { recursive: true });
fs.mkdirSync(SERVER_UPLOADS, { recursive: true }); // for multer

// 3) Copy assets
console.log('[webui] copying assets …');
await copyDir(path.join(DIST_DIR, 'assets'), SERVER_ASSETS);

// 4) Read & rewrite index.html, inject build stamp
const srcHtml = await fsp.readFile(path.join(DIST_DIR, 'index.html'), 'utf8');
const stamped = injectStamp(rewriteAssetUrls(srcHtml));
await fsp.writeFile(path.join(SERVER_PUB, 'index.html'), stamped, 'utf8');

console.log('[webui] done. Public dir:', SERVER_PUB);

function injectStamp(html) {
  const short = (process.env.GIT_SHA || '').slice(0, 8);
  const iso   = new Date().toISOString();
  const stamp = `<!-- build: ${iso}${short ? ' ' + short : ''} -->`;
  // insert before </head> if possible; otherwise append
  return html.includes('</head>')
    ? html.replace('</head>', `${stamp}\n</head>`)
    : html + `\n${stamp}\n`;
}

function rewriteAssetUrls(html) {
  // Ensure assets are absolute so the SPA works behind subpaths/reverse proxies
  return html
    .replace(/(href|src)=\"\/?assets\//g, '$1="/assets/')
    .replace(/\(\/?assets\//g, '(/assets/'); // CSS url()
}

async function copyDir(src, dest) {
  await fsp.mkdir(dest, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  await Promise.all(entries.map(async (e) => {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) return copyDir(s, d);
    await fsp.copyFile(s, d);
  }));
}
