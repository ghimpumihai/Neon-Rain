/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { attachGameServer } from './server/index';

export default defineConfig({
    plugins: [
        {
            name: 'neon-rain-game-server',
            configureServer(server) {
                if (server.httpServer) {
                    attachGameServer(server.httpServer);
                    console.log('🎮 Neon Rain multiplayer WebSocket server active on Vite server');
                }
            },
            configurePreviewServer(server) {
                if (server.httpServer) {
                    attachGameServer(server.httpServer);
                    console.log('🎮 Neon Rain multiplayer WebSocket server active on Vite preview server');
                }
            },
        },
    ],
    server: {
        host: true,
    },
    test: {
        environment: 'jsdom',
        globals: true,
    },
});
