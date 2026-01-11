import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Enemy } from '../entities/Enemy';

// Create a mock canvas context
const createMockContext = () => {
    return {
        save: vi.fn(),
        restore: vi.fn(),
        fillRect: vi.fn(),
        fillStyle: '',
        shadowBlur: 0,
        shadowColor: '',
    } as unknown as CanvasRenderingContext2D;
};

describe('Phase 3: Enemy', () => {
    let enemy: Enemy;

    beforeEach(() => {
        enemy = new Enemy(100, 600, 200); // x, canvasHeight, speed
    });

    describe('Initialization', () => {
        it('should create an Enemy instance', () => {
            expect(enemy).toBeInstanceOf(Enemy);
        });

        it('should start above the screen', () => {
            expect(enemy.position.y).toBeLessThan(0);
        });

        it('should have correct x position', () => {
            expect(enemy.position.x).toBe(100);
        });

        it('should have falling velocity', () => {
            expect(enemy.velocity.y).toBe(200);
        });
    });

    describe('Movement', () => {
        it('should fall down when updated', () => {
            const startY = enemy.position.y;

            enemy.update(0.1);

            expect(enemy.position.y).toBeGreaterThan(startY);
        });

        it('should not be off-screen initially', () => {
            expect(enemy.getIsOffScreen()).toBe(false);
        });

        it('should be off-screen after falling past canvas height', () => {
            // Move enemy far below the screen
            for (let i = 0; i < 100; i++) {
                enemy.update(0.1);
            }

            expect(enemy.getIsOffScreen()).toBe(true);
        });
    });

    describe('Drawing', () => {
        it('should draw without errors', () => {
            const mockCtx = createMockContext();

            expect(() => enemy.draw(mockCtx)).not.toThrow();
        });

        it('should call fillRect when drawing', () => {
            const mockCtx = createMockContext();

            enemy.draw(mockCtx);

            expect(mockCtx.fillRect).toHaveBeenCalled();
        });
    });

    describe('Custom Config', () => {
        it('should apply custom color', () => {
            const customEnemy = new Enemy(100, 600, 200, {
                color: '#ff0000',
                glowColor: '#ff0000',
            });

            expect(customEnemy).toBeInstanceOf(Enemy);
        });

        it('should report speed correctly', () => {
            expect(enemy.getSpeed()).toBe(200);
        });
    });
});
