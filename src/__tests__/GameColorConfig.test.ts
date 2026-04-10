import { describe, it, expect, vi } from 'vitest';
import { Game } from '../core/Game';

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

describe('Game color configuration', () => {
    it('should apply configured colors to both players', () => {
        const game = new Game('gameCanvas', {
            canvasWidth: 800,
            canvasHeight: 600,
            backgroundColor: '#111',
            player1Color: '#39ff14',
            player2Color: '#ff4fd8',
        });

        const players = (game as any).players;

        expect(players[0].getColor()).toBe('#39ff14');
        expect(players[1].getColor()).toBe('#ff4fd8');
    });
});