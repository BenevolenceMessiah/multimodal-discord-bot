import { useState } from 'react';
import { Copy as CopyIcon } from 'lucide-react';

/* lucide‑react ships React‑18 typings; cast quiets React‑19’s JSX checks */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Icon = CopyIcon as any;

export default function ShareToggle(): JSX.Element {
  const [url, setUrl]   = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggle(): Promise<void> {
    setBusy(true);
    try {
      const res = await fetch('/api/tunnel', {
        method: url ? 'DELETE' : 'POST',
      }).then((r) => r.json() as Promise<{ url?: string } | { ok: true }>);

      setUrl('url' in res ? res.url ?? null : null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggle}
        disabled={busy}          /* 🟢 not “pending” */
        className="btn px-3 py-1"
      >
        {busy ? '…' : url ? 'Disable Share' : 'Share'}
      </button>

      {url && (
        <span
          onClick={() => navigator.clipboard.writeText(url)}
          title="Click to copy"
          className="flex items-center gap-1 text-xs text-cyan-300
                     hover:underline cursor-pointer"
        >
          {url}
          {/* icon is purely decorative – aria‑hidden */}
          <Icon size={12} aria-hidden="true" />
        </span>
      )}
    </div>
  );
}
