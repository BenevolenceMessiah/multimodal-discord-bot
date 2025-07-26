import React, { useEffect, useState } from 'react';
import * as Cmdk from 'cmdk';

/**
 * cmdk still exposes its sub‑components via an object; a light cast to `any`
 * calms React‑19’s stricter JSX signature without impacting run‑time safety.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const C: any = Cmdk;

export default function CommandPalette(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [cmds, setCmds] = useState<string[]>([]);

  /* ⌘/Ctrl + K to open -------------------------------------------------- */
  useEffect(() => {
    const on = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', on, { capture: true });
    return () => window.removeEventListener('keydown', on, { capture: true });
  }, []);

  /* fetch slash‑command list lazily ------------------------------------ */
  useEffect(() => {
    if (open && cmds.length === 0) {
      fetch('/api/commands')
        .then((r) => r.json() as Promise<string[]>)
        .then(setCmds)
        .catch(console.error);
    }
  }, [open, cmds.length]);

  /* -------------------------------------------------------------------- */
  return (
    <C.Command
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      loop
      className="fixed inset-0 z-[10000] flex items-start justify-center p-4"
    >
      <div className="bg-slate-800/95 border border-cyan-500/30 rounded-xl
                      w-full max-w-md shadow-xl backdrop-blur">
        <C.CommandInput
          placeholder="Type a command or search…"
          className="w-full p-3 bg-transparent outline-none text-cyan-100"
        />

        <C.CommandGroup heading="Commands">
          {cmds.map((c) => (
            <C.CommandItem
              key={c}
              value={c}
              onSelect={() => {
                dispatchEvent(new CustomEvent('exec-cmd', { detail: c }));
                setOpen(false);
              }}
            >
              /{c}
            </C.CommandItem>
          ))}
        </C.CommandGroup>
      </div>
    </C.Command>
  );
}
