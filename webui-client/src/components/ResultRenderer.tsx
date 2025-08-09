import { Buffer } from 'buffer';

type Output =
  | { type: 'text';  content: string }
  | { type: 'image'; mime: string; buffer?: Uint8Array | number[]; url?: string }
  | { type: 'audio'; mime: string; buffer?: Uint8Array | number[]; url?: string }
  | { type: 'file';  name: string; url: string; mime?: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | Record<string, any>;

export default function ResultRenderer({ output }: { output: Output }): JSX.Element {
  if (!output) return <></>;

  // TEXT
  if ((output as any).type === 'text') {
    return <p className="whitespace-pre-wrap">{(output as any).content ?? ''}</p>;
  }

  // IMAGE
  if ((output as any).type === 'image') {
    const o = output as any;
    const src = o.url
      ? o.url
      : o.buffer
        ? `data:${o.mime ?? 'image/png'};base64,${Buffer.from(o.buffer).toString('base64')}`
        : '';
    return (
      <img
        alt="generated"
        src={src}
        className="max-w-full rounded shadow"
      />
    );
  }

  // AUDIO
  if ((output as any).type === 'audio') {
    const o = output as any;
    const src = o.url
      ? o.url
      : o.buffer
        ? `data:${o.mime ?? 'audio/mpeg'};base64,${Buffer.from(o.buffer).toString('base64')}`
        : '';
    return (
      <audio controls src={src} className="w-full">
        Your browser does not support the audio element.
      </audio>
    );
  }

  // FILE LINK
  if ((output as any).type === 'file') {
    const o = output as any;
    return (
      <a
        href={o.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-cyan-300 hover:underline"
      >
        {o.name ?? 'Download'}
      </a>
    );
  }

  // FALLBACK: RAW JSON
  return (
    <pre className="bg-black/30 border border-cyan-500/30 rounded p-2 text-xs overflow-x-auto">
      {JSON.stringify(output, null, 2)}
    </pre>
  );
}
