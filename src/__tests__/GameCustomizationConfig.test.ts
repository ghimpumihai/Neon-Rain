import { describe, it, expect, vi } from 'vitest';
import { Game } from '../core/Game';
import { Player } from '../entities/Player';

const mockCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({
        fillStyle: '',
        strokeStyle: '',
        font: '',
        textAlign: '',
        lineWidth: 0,
        shadowBlur: 0,
        shadowColor: '',
        globalAlpha: 1,
        save: vi.fn(),
        restore: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        fillText: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
    })),
};

vi.stubGlobal('document', {
    getElementById: vi.fn((id: string) => {
        if (id === 'gameCanvas') {
            return mockCanvas;
        }
        return null;
    }),
});

describe('Game customization config', () => {
    it('should apply selected model and hat from game config to players', () => {
        const game = new Game('gameCanvas', {
            player1Model: 'cross',
            player1Hat: 'crown',
            player2Model: 'target',
            player2Hat: 'beanie',
        });

        const p1 = (game as any).players[0] as Player;
        const p2 = (game as any).players[1] as Player;

        expect(p1.getConfig().model).toBe('cross');
        expect(p1.getConfig().hat).toBe('crown');
        expect(p2.getConfig().model).toBe('target');
        expect(p2.getConfig().hat).toBe('beanie');
    });
});
