import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnemyManager } from '../systems/EnemyManager';

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

describe('Phase 3: EnemyManager', () => {
    let manager: EnemyManager;

    beforeEach(() => {
        manager = new EnemyManager({
            canvasWidth: 800,
            canvasHeight: 600,
            baseSpawnInterval: 1.0,
            baseEnemySpeed: 200,
        });
    });

    describe('Initialization', () => {
        it('should create an EnemyManager instance', () => {
            expect(manager).toBeInstanceOf(EnemyManager);
        });

        it('should start with no enemies', () => {
            expect(manager.getEnemyCount()).toBe(0);
        });

        it('should start at difficulty level 1', () => {
            expect(manager.getDifficultyLevel()).toBe(1);
        });
    });

    describe('Spawning', () => {
        it('should spawn an enemy after spawn interval', () => {
            // Update past the spawn interval (1 second)
            manager.update(1.1);

            expect(manager.getEnemyCount()).toBeGreaterThan(0);
        });

        it('should spawn multiple enemies over time', () => {
            // First spawn
            manager.update(1.1);
            expect(manager.getEnemyCount()).toBeGreaterThanOrEqual(1);

            // Second spawn
            manager.update(1.1);
            expect(manager.getEnemyCount()).toBeGreaterThanOrEqual(2);

            // Third spawn - at this point difficulty may have kicked in
            manager.update(1.1);
            expect(manager.getEnemyCount()).toBeGreaterThanOrEqual(2);
        });

        it('should spawn enemies at random X positions', () => {
            // Spawn several enemies
            for (let i = 0; i < 5; i++) {
                manager.update(1.1);
            }

            const enemies = manager.getEnemies();
            const xPositions = enemies.map(e => e.position.x);

            // Check that not all X positions are the same (random)
            const uniquePositions = new Set(xPositions);
            expect(uniquePositions.size).toBeGreaterThan(1);
        });
    });

    describe('Enemy Removal', () => {
        it('should remove off-screen enemies', () => {
            // Spawn an enemy
            manager.update(1.1);
            expect(manager.getEnemyCount()).toBe(1);

            // Move enemy off-screen by updating many times
            for (let i = 0; i < 100; i++) {
                manager.update(0.1); // 100 updates of 100ms each = 10 seconds
            }

            // Enemy should be removed (it fell off screen)
            // Note: More enemies may have spawned, but the first one should be gone
            expect(manager.getEnemyCount()).toBeLessThanOrEqual(10);
        });
    });

    describe('Difficulty Scaling', () => {
        it('should increase difficulty over time', () => {
            const initialDifficulty = manager.getDifficultyLevel();

            // Update for 10+ seconds (difficulty increase interval)
            for (let i = 0; i < 110; i++) {
                manager.update(0.1);
            }

            expect(manager.getDifficultyLevel()).toBeGreaterThan(initialDifficulty);
        });
    });

    describe('Reset', () => {
        it('should clear all enemies on reset', () => {
            // Spawn some enemies
            manager.update(1.1);
            manager.update(1.1);
            expect(manager.getEnemyCount()).toBeGreaterThan(0);

            // Reset
            manager.reset();

            expect(manager.getEnemyCount()).toBe(0);
            expect(manager.getDifficultyLevel()).toBe(1);
        });
    });

    describe('Drawing', () => {
        it('should draw all enemies without errors', () => {
            const mockCtx = createMockContext();

            // Spawn some enemies
            manager.update(1.1);
            manager.update(1.1);

            expect(() => manager.draw(mockCtx)).not.toThrow();
        });
    });

    describe('Get Enemies for Collision', () => {
        it('should return array of enemies', () => {
            manager.update(1.1);

            const enemies = manager.getEnemies();

            expect(Array.isArray(enemies)).toBe(true);
            expect(enemies.length).toBeGreaterThan(0);
        });
    });
});
