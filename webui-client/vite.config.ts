// webui-client/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'node:path';

export default defineConfig({
  root: __dirname,                            // project root
  publicDir: path.resolve(__dirname, 'public'),
  resolve: {
    alias: { buffer: 'buffer/' }              // alias to the npm shim
  },
  optimizeDeps: {
    include: ['buffer']                       // force pre-bundling
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'public/index.html')
    }
  },
  plugins: [
    react(),
    nodePolyfills({                           // polyfill Node core modules
      globals: { Buffer: true, process: true },
      protocolImports: true
    })
  ],
  server: { port: 5173 }
});
