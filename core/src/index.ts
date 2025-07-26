/**
 * Shared command dispatcher – imports concrete command implementations from the
 * Discord bot's existing services at runtime, so new commands appear automatically.
 */
import path from 'node:path';
import { pathToFileURL } from 'url';

export interface CommandRequest {
  name: string;
  args: Record<string, unknown>;
  userId?: string;
}

export type CommandResult =
  | { type: 'text'; content: string }
  | { type: 'image'; buffer: Buffer; mime: string }
  | { type: 'audio'; buffer: Buffer; mime: string }
  | { type: 'error'; content: string };

export async function executeCommand(
  req: CommandRequest
): Promise<CommandResult> {
  let result: CommandResult;
  try {
    // Resolve the path to the compiled command module in bot/commands
    const modulePath = path.resolve(
      process.cwd(),
      'bot',
      'commands',
      `${req.name}.js`
    );
    const mod = await import(pathToFileURL(modulePath).href);

    if (typeof mod.executeCore !== 'function') {
      throw new Error(
        `Command "${req.name}" is missing an export executeCore()`
      );
    }

    // Invoke the core implementation
    result = await mod.executeCore(req.args);
  } catch (e: any) {
    // On any error, return a standardized error result
    result = {
      type: 'error',
      content: e?.message ?? String(e)
    };
  }

  return result;
}
