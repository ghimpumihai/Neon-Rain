import { describe, it, expect, vi } from 'vitest';
import { Game } from '../core/Game';
import { Player } from '../entities/Player';
import { PowerupType } from '../entities/Powerup';

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

describe('Game heal powerup', () => {
    it('should heal player when HEAL powerup is activated', () => {
        const game = new Game('gameCanvas');
        const p1 = (game as any).players[0] as Player;

        p1.takeDamage(40);
        expect(p1.getHealth()).toBe(60);

        (game as any).activatePowerup(p1, PowerupType.HEAL);
        expect(p1.getHealth()).toBe(90);

        (game as any).activatePowerup(p1, PowerupType.HEAL);
        expect(p1.getHealth()).toBe(100);
    });
});
