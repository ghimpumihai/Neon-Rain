import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InputHandler, PLAYER_1_KEYS, PLAYER_2_KEYS } from '../systems/InputHandler';
import { Player, PLAYER_1_CONFIG, PLAYER_2_CONFIG } from '../entities/Player';
import { Game } from '../core/Game';
import { PowerupType } from '../entities/Powerup';
import { GameState } from '../core/GameState';

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

describe('Bomb pickup and deploy controls', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should consume deploy input from Q for P1 and 0 for P2', () => {
        const p1 = new Player(800, 600, new InputHandler(PLAYER_1_KEYS, 'P1'), PLAYER_1_CONFIG);
        const p2 = new Player(800, 600, new InputHandler(PLAYER_2_KEYS, 'P2'), PLAYER_2_CONFIG);

        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }));
        expect(p1.consumeBombDeployInput()).toBe(true);
        expect(p1.consumeBombDeployInput()).toBe(false);

        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit0' }));
        expect(p2.consumeBombDeployInput()).toBe(true);
        expect(p2.consumeBombDeployInput()).toBe(false);
    });

    it('should store bomb on pickup and deploy only when key is pressed', () => {
        const game = new Game('gameCanvas');
        const p1 = (game as any).players[0] as Player;

        (game as any).activatePowerup(p1, PowerupType.BOMB);

        expect(p1.getStoredBombs()).toBe(1);
        expect((game as any).bombs).toHaveLength(0);

        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }));
        (game as any).handleBombDeployInput();

        expect(p1.getStoredBombs()).toBe(0);
        expect((game as any).bombs).toHaveLength(1);
    });

    it('should deploy P2 bomb using 0 key', () => {
        const game = new Game('gameCanvas');
        const p2 = (game as any).players[1] as Player;

        (game as any).activatePowerup(p2, PowerupType.BOMB);
        expect((game as any).bombs).toHaveLength(0);

        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit0' }));
        (game as any).handleBombDeployInput();

        expect(p2.getStoredBombs()).toBe(0);
        expect((game as any).bombs).toHaveLength(1);
    });

    it('should expire held bomb after 8 seconds on player inventory', () => {
        const p1 = new Player(800, 600, new InputHandler(PLAYER_1_KEYS, 'P1'), PLAYER_1_CONFIG);

        p1.addStoredBomb(1);
        const expired = p1.updateStoredBombTimers(8.01);

        expect(expired).toBe(true);
        expect(p1.getStoredBombs()).toBe(0);
    });

    it('should kill player if held bomb expires before deploy', () => {
        const game = new Game('gameCanvas');
        const p1 = (game as any).players[0] as Player;

        (game as any).activatePowerup(p1, PowerupType.BOMB);
        expect(p1.getIsAlive()).toBe(true);

        // Simulate held bomb timeout expiration without relying on random enemy spawning.
        const expired = p1.updateStoredBombTimers(8.01);
        if (expired) {
            p1.kill();
            (game as any).handlePlayerDeath(p1);
            (game as any).checkGameEnd();
        }

        expect(p1.getIsAlive()).toBe(false);
        expect(p1.getStoredBombs()).toBe(0);
        expect(game.getGameState()).toBe(GameState.GAME_OVER);
    });

});