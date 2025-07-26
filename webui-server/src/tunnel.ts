import localtunnel, { Tunnel } from 'localtunnel';

let tunnel: Tunnel | undefined;

/** Open or return an existing LocalTunnel for the given port. */
export async function openTunnel(port: number): Promise<string> {
  if (tunnel) return tunnel.url;
  tunnel = await localtunnel({ port });
  tunnel.on('close', () => {
    tunnel = undefined;
  });
  return tunnel.url;
}

/** Gracefully close the active tunnel, if any. */
export function closeTunnel(): void {
  tunnel?.close();
  tunnel = undefined;
}
