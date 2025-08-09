import { useEffect, useMemo, useState } from 'react';
import { Copy as CopyIcon, Link as LinkIcon } from 'lucide-react';

// Lucide ships React-18 types; casting keeps React-19 JSX happy
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const IconCopy = CopyIcon as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const IconLink = LinkIcon as any;

export default function ShareToggle(): JSX.Element {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // prevent stale “copied” badge
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);

  const canCopy = useMemo(() => !!navigator?.clipboard, []);

  async function toggle(): Promise<void> {
    setBusy(true);
    try {
      const r = await fetch('/api/tunnel', { method: url ? 'DELETE' : 'POST' });
      const j = await r.json() as { url?: string } | { ok: true };
      setUrl('url' in j ? j.url ?? null : null);
    } catch (e) {
      console.error('tunnel error', e);
    } finally {
      setBusy(false);
    }
  }

  async function copy(): Promise<void> {
    if (!url) return;
    try {
      if (canCopy) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      } else {
        // Basic fallback for very old browsers
        const ta = document.createElement('textarea');
        ta.value = url; document.body.appendChild(ta);
        ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        setCopied(true);
      }
    } catch (e) {
      console.error('copy failed', e);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        className="btn px-3 py-1"
        onClick={toggle}
        disabled={busy}
        aria-label={url ? 'Disable public share' : 'Enable public share'}
      >
        {busy ? '…' : url ? 'Disable Share' : 'Share'}
      </button>

      {url && (
        <div className="flex items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-cyan-300 hover:underline inline-flex items-center gap-1"
            title="Open public URL"
          >
            <IconLink size={14} />
            {url}
          </a>

          <button
            type="button"
            className="text-xs text-cyan-200 hover:text-cyan-100 inline-flex items-center gap-1"
            onClick={() => void copy()}
            aria-label="Copy public URL"
          >
            <IconCopy size={14} />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  );
}
