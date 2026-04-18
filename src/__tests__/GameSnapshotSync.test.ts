import { describe, expect, it, vi } from 'vitest';
import { Game } from '../core/Game';
import { GameState } from '../core/GameState';
import type { InputState } from '../systems/InputHandler';

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
        snapshot.players[0].position.y = 440;
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

    it('embeds last processed input sequence metadata in snapshots', () => {
        const game = new Game('gameCanvas');

        const snapshot = game.serializeSnapshot(
            ['p-host', 'p-peer'],
            new Map<string, number>([['p-peer', 27]])
        );

        expect(snapshot.players[0].lastProcessedInputSequence).toBeUndefined();
        expect(snapshot.players[1].lastProcessedInputSequence).toBe(27);
    });

    it('keeps canonical world size in client role even when snapshot carries different dimensions', () => {
        const game = new Game('gameCanvas');
        game.setNetworkSyncContext({ role: 'client', playerOrder: ['p-host', 'p-peer'], localPlayerId: 'p-peer' });

        const snapshot = game.serializeSnapshot(['p-host', 'p-peer']);
        snapshot.worldWidth = 320;
        snapshot.worldHeight = 240;

        game.applySnapshot(snapshot, ['p-host', 'p-peer'], 'p-peer');

        expect(game.getConfig().canvasWidth).toBe(800);
        expect(game.getConfig().canvasHeight).toBe(600);
    });

    it('replays pending local inputs after client snapshot acknowledgement', () => {
        const game = new Game('gameCanvas');
        game.setNetworkSyncContext({ role: 'client', playerOrder: ['p-host', 'p-peer'], localPlayerId: 'p-peer' });

        const snapshot = game.serializeSnapshot(['p-host', 'p-peer']);
        const localPlayerSnapshot = snapshot.players[1];
        localPlayerSnapshot.position.x = 200;
        localPlayerSnapshot.position.y = 520;
        localPlayerSnapshot.velocity.x = 0;
        localPlayerSnapshot.velocity.y = 0;
        localPlayerSnapshot.lastProcessedInputSequence = 1;

        const movingRightInput: InputState = {
            left: false,
            right: true,
            up: false,
            down: false,
            dash: false,
            deployBomb: false,
        };

        game.applySnapshot(snapshot, ['p-host', 'p-peer'], 'p-peer', {
            localInputAckSequence: 1,
            localInputHistory: [
                { sequence: 1, input: movingRightInput },
                { sequence: 2, input: movingRightInput },
                { sequence: 3, input: movingRightInput },
            ],
            localReplayDeltaSeconds: 1 / 60,
        });

        const players = (game as unknown as { players: Array<{ position: { x: number; y: number } }> }).players;
        expect(players[1].position.x).toBeGreaterThan(localPlayerSnapshot.position.x);
    });
});
