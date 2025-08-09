import React from 'react';
import * as Cmdk from 'cmdk';

const C: any = Cmdk; // keep JSX simple across React 18/19 type drift

export default function CommandPalette(): JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [cmds, setCmds] = React.useState<string[]>([]);

  React.useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o: boolean) => !o);
      }
    };
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  }, []);

  React.useEffect(() => {
    if (open && cmds.length === 0) {
      fetch('/api/commands')
        .then(r => r.json())
        .then((arr: string[]) => setCmds(arr))
        .catch(() => setCmds(['say','draw','help']));
    }
  }, [open, cmds.length]);

  return (
    <C.Command
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      loop
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4"
    >
      <div className="bg-slate-800/95 border border-cyan-500/30 rounded-xl w-full max-w-md shadow-xl backdrop-blur">
        <C.CommandInput
          autoFocus
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
