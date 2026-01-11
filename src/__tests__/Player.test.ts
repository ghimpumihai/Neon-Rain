import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Player, PLAYER_1_CONFIG, PLAYER_2_CONFIG } from '../entities/Player';
import { InputHandler, PLAYER_1_KEYS, PLAYER_2_KEYS } from '../systems/InputHandler';

// Create a mock canvas context
const createMockContext = () => {
    return {
        save: vi.fn(),
        restore: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        fillText: vi.fn(),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        shadowBlur: 0,
        shadowColor: '',
        font: '',
        textAlign: '',
    } as unknown as CanvasRenderingContext2D;
};

describe('Phase 2: Player', () => {
    let player1: Player;
    let player2: Player;
    let inputHandler1: InputHandler;
    let inputHandler2: InputHandler;

    beforeEach(() => {
        inputHandler1 = new InputHandler(PLAYER_1_KEYS, 'P1');
        inputHandler2 = new InputHandler(PLAYER_2_KEYS, 'P2');
        player1 = new Player(800, 600, inputHandler1, PLAYER_1_CONFIG);
        player2 = new Player(800, 600, inputHandler2, PLAYER_2_CONFIG);
    });

    describe('Initialization', () => {
        it('should create a Player instance', () => {
            expect(player1).toBeInstanceOf(Player);
            expect(player2).toBeInstanceOf(Player);
        });

        it('should start Player 1 on the left side', () => {
            const config = player1.getConfig();
            const expectedX = 800 / 4 - config.size / 2;
            const expectedY = 600 - config.size - 50;

            expect(player1.position.x).toBe(expectedX);
            expect(player1.position.y).toBe(expectedY);
        });

        it('should start Player 2 on the right side', () => {
            const config = player2.getConfig();
            const expectedX = (800 * 3) / 4 - config.size / 2;
            const expectedY = 600 - config.size - 50;

            expect(player2.position.x).toBe(expectedX);
            expect(player2.position.y).toBe(expectedY);
        });

        it('should have correct player configurations', () => {
            expect(player1.getConfig().color).toBe('#00ffff');
            expect(player1.getConfig().playerNumber).toBe(1);
            expect(player2.getConfig().color).toBe('#ff00ff');
            expect(player2.getConfig().playerNumber).toBe(2);
        });
    });

    describe('Movement', () => {
        it('should move right when D key is pressed (P1)', () => {
            const startX = player1.position.x;

            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
            player1.update(0.1);

            expect(player1.position.x).toBeGreaterThan(startX);
        });

        it('should move left when A key is pressed (P1)', () => {
            const startX = player1.position.x;

            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
            player1.update(0.1);

            expect(player1.position.x).toBeLessThan(startX);
        });

        it('should move right when ArrowRight is pressed (P2)', () => {
            const startX = player2.position.x;

            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
            player2.update(0.1);

            expect(player2.position.x).toBeGreaterThan(startX);
        });

        it('should move left when ArrowLeft is pressed (P2)', () => {
            const startX = player2.position.x;

            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }));
            player2.update(0.1);

            expect(player2.position.x).toBeLessThan(startX);
        });
    });

    describe('Boundary Clamping', () => {
        it('should not go past left boundary', () => {
            player1.position.x = -50;
            player1.update(0.1);

            expect(player1.position.x).toBeGreaterThanOrEqual(0);
        });

        it('should not go past right boundary', () => {
            player1.position.x = 900;
            player1.update(0.1);

            expect(player1.position.x + player1.width).toBeLessThanOrEqual(800);
        });

        it('should not go past top boundary', () => {
            player1.position.y = -50;
            player1.update(0.1);

            expect(player1.position.y).toBeGreaterThanOrEqual(0);
        });

        it('should not go past bottom boundary', () => {
            player1.position.y = 700;
            player1.update(0.1);

            expect(player1.position.y + player1.height).toBeLessThanOrEqual(600);
        });
    });

    describe('Drawing', () => {
        it('should draw without errors', () => {
            const mockCtx = createMockContext();

            expect(() => player1.draw(mockCtx)).not.toThrow();
            expect(() => player2.draw(mockCtx)).not.toThrow();
        });

        it('should call fillRect when drawing', () => {
            const mockCtx = createMockContext();

            player1.draw(mockCtx);

            expect(mockCtx.fillRect).toHaveBeenCalled();
        });

        it('should not draw when dead', () => {
            const mockCtx = createMockContext();

            player1.kill();
            player1.draw(mockCtx);

            expect(mockCtx.fillRect).not.toHaveBeenCalled();
        });
    });

    describe('Alive State', () => {
        it('should start alive', () => {
            expect(player1.getIsAlive()).toBe(true);
        });

        it('should be dead after kill()', () => {
            player1.kill();
            expect(player1.getIsAlive()).toBe(false);
        });

        it('should not update when dead', () => {
            player1.kill();
            const startX = player1.position.x;

            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
            player1.update(0.1);

            expect(player1.position.x).toBe(startX);
        });

        it('should revive after reset', () => {
            player1.kill();
            expect(player1.getIsAlive()).toBe(false);

            player1.reset();
            expect(player1.getIsAlive()).toBe(true);
        });
    });

    describe('Reset', () => {
        it('should reset to starting position', () => {
            const config = player1.getConfig();
            const expectedX = 800 / 4 - config.size / 2;
            const expectedY = 600 - config.size - 50;

            // Move the player
            player1.position.x = 100;
            player1.position.y = 100;

            // Reset
            player1.reset();

            expect(player1.position.x).toBe(expectedX);
            expect(player1.position.y).toBe(expectedY);
        });
    });
});
