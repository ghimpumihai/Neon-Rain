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

describe('Game map border rendering', () => {
    it('should draw a border around the map', () => {
        const game = new Game('gameCanvas');
        const ctx = game.getContext() as any;

        (game as any).draw();

        expect(ctx.strokeRect).toHaveBeenCalledWith(3, 3, 794, 594);
    });
});
