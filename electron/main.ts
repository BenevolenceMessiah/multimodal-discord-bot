import { app, BrowserWindow } from 'electron';
import * as path from 'node:path';
import { spawn, ChildProcess } from 'node:child_process';

let win: BrowserWindow | null = null;
let server: ChildProcess | null = null;

function createWin(): void {
  win = new BrowserWindow({
    width: 1_200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  void win.loadURL('http://localhost:3000');
}

app.whenReady().then(() => {
  // Launch the WebUI server in a detached child process
  const serverEntry = path.resolve(
    __dirname,
    '../../webui-server/dist/index.js'
  );

  server = spawn(process.execPath, [serverEntry], {
    env: { ...process.env, PORT: '3000' },
    stdio: 'inherit',
    detached: true
  });

  createWin();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
  if (server) {
    server.kill();
    server = null;
  }
});
