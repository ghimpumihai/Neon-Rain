import { describe, expect, it, vi } from 'vitest';
import { Game } from '../core/Game';
import { GameState } from '../core/GameState';

const mockContext = {
    fillStyle: '#111',
    strokeStyle: '#fff',
    lineWidth: 1,
    shadowBlur: 0,
    shadowColor: '#fff',
    font: '12px monospace',
    textAlign: 'left',
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    strokeRect: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    stroke: vi.fn(),
} as unknown as CanvasRenderingContext2D;

const mockCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => mockContext),
};

vi.stubGlobal('document', {
    getElementById: vi.fn((id: string) => {
        if (id === 'gameCanvas') {
            return mockCanvas;
        }
        return null;
    }),
});

describe('Game multiplayer snapshot sync', () => {
    it('serializes and applies snapshots for authoritative sync', () => {
        const game = new Game('gameCanvas');
        game.setNetworkSyncContext({ role: 'local', playerOrder: ['p-host', 'p-peer'] });

        const snapshot = game.serializeSnapshot(['p-host', 'p-peer']);
        expect(snapshot.players).toHaveLength(2);
        expect(snapshot.players[0].playerId).toBe('p-host');
        expect(snapshot.players[1].playerId).toBe('p-peer');
        expect(snapshot.worldWidth).toBe(800);
        expect(snapshot.worldHeight).toBe(600);

        snapshot.gameTimeSeconds = 33;
        snapshot.score = 120;
        snapshot.roundState = 'game_over';
        snapshot.worldWidth = 640;
        snapshot.worldHeight = 480;
        snapshot.players[0].position.x += 40;
        snapshot.players[0].position.y += 25;
        snapshot.players[0].health = 55;

        game.applySnapshot(snapshot, ['p-host', 'p-peer'], null);

        const players = (game as unknown as { players: Array<{ position: { x: number; y: number }; getHealth: () => number }> }).players;
        expect(players[0].position.x).toBe(snapshot.players[0].position.x);
        expect(players[0].position.y).toBe(snapshot.players[0].position.y);
        expect(players[0].getHealth()).toBe(55);
        expect(game.getGameState()).toBe(GameState.GAME_OVER);
        expect(game.getGameTime()).toBe(33);
        expect(game.getConfig().canvasWidth).toBe(640);
        expect(game.getConfig().canvasHeight).toBe(480);
    });

    it('supports four active multiplayer slots in snapshot serialization', () => {
        const game = new Game('gameCanvas', {
            playerSlots: [
                { color: '#00ffff', model: 'core', hat: 'none', label: 'P1' },
                { color: '#ff00ff', model: 'core', hat: 'none', label: 'P2' },
                { color: '#39ff14', model: 'core', hat: 'none', label: 'P3' },
                { color: '#ff9100', model: 'core', hat: 'none', label: 'P4' },
            ],
        });

        const playerOrder = ['slot-1', 'slot-2', 'slot-3', 'slot-4'];
        const snapshot = game.serializeSnapshot(playerOrder);

        expect(snapshot.players).toHaveLength(4);
        expect(snapshot.players.map(player => player.playerId)).toEqual(playerOrder);

        const uniqueXPositions = new Set(snapshot.players.map(player => player.position.x));
        expect(uniqueXPositions.size).toBe(4);
    });
});
