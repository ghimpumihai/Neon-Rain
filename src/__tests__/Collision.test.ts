import { describe, it, expect } from 'vitest';
import {
    checkAABBCollision,
    checkGameObjectCollision,
    checkCollisionWithArray,
    getCollisionOverlap,
} from '../systems/Collision';
import { GameObject, Vector2 } from '../core/interfaces';

// Helper to create a mock GameObject
const createMockGameObject = (
    x: number,
    y: number,
    width: number,
    height: number
): GameObject => ({
    position: { x, y } as Vector2,
    velocity: { x: 0, y: 0 } as Vector2,
    width,
    height,
    draw: () => { },
    update: () => { },
});

describe('Phase 4: Collision Detection', () => {
    describe('checkAABBCollision', () => {
        it('should detect collision when rectangles overlap', () => {
            const a = { x: 0, y: 0, width: 50, height: 50 };
            const b = { x: 25, y: 25, width: 50, height: 50 };

            expect(checkAABBCollision(a, b)).toBe(true);
        });

        it('should not detect collision when rectangles are apart horizontally', () => {
            const a = { x: 0, y: 0, width: 50, height: 50 };
            const b = { x: 100, y: 0, width: 50, height: 50 };

            expect(checkAABBCollision(a, b)).toBe(false);
        });

        it('should not detect collision when rectangles are apart vertically', () => {
            const a = { x: 0, y: 0, width: 50, height: 50 };
            const b = { x: 0, y: 100, width: 50, height: 50 };

            expect(checkAABBCollision(a, b)).toBe(false);
        });

        it('should detect collision when rectangles touch edges', () => {
            const a = { x: 0, y: 0, width: 50, height: 50 };
            const b = { x: 49, y: 49, width: 50, height: 50 };

            expect(checkAABBCollision(a, b)).toBe(true);
        });

        it('should not detect collision when rectangles just miss (near miss)', () => {
            const a = { x: 0, y: 0, width: 50, height: 50 };
            const b = { x: 51, y: 0, width: 50, height: 50 };

            expect(checkAABBCollision(a, b)).toBe(false);
        });

        it('should detect collision when one rectangle contains another', () => {
            const a = { x: 0, y: 0, width: 100, height: 100 };
            const b = { x: 25, y: 25, width: 25, height: 25 };

            expect(checkAABBCollision(a, b)).toBe(true);
        });

        it('should detect collision when rectangles are identical', () => {
            const a = { x: 50, y: 50, width: 50, height: 50 };
            const b = { x: 50, y: 50, width: 50, height: 50 };

            expect(checkAABBCollision(a, b)).toBe(true);
        });
    });

    describe('checkGameObjectCollision', () => {
        it('should detect collision between two GameObjects', () => {
            const a = createMockGameObject(0, 0, 50, 50);
            const b = createMockGameObject(25, 25, 50, 50);

            expect(checkGameObjectCollision(a, b)).toBe(true);
        });

        it('should not detect collision when GameObjects are apart', () => {
            const a = createMockGameObject(0, 0, 50, 50);
            const b = createMockGameObject(100, 100, 50, 50);

            expect(checkGameObjectCollision(a, b)).toBe(false);
        });
    });

    describe('checkCollisionWithArray', () => {
        it('should return colliding object from array', () => {
            const player = createMockGameObject(50, 50, 30, 30);
            const enemies = [
                createMockGameObject(0, 0, 20, 20),
                createMockGameObject(40, 40, 30, 30), // This one overlaps
                createMockGameObject(200, 200, 20, 20),
            ];

            const result = checkCollisionWithArray(player, enemies);

            expect(result).toBe(enemies[1]);
        });

        it('should return null when no collision in array', () => {
            const player = createMockGameObject(50, 50, 30, 30);
            const enemies = [
                createMockGameObject(0, 0, 20, 20),
                createMockGameObject(200, 200, 20, 20),
            ];

            const result = checkCollisionWithArray(player, enemies);

            expect(result).toBeNull();
        });

        it('should return null for empty array', () => {
            const player = createMockGameObject(50, 50, 30, 30);
            const enemies: GameObject[] = [];

            const result = checkCollisionWithArray(player, enemies);

            expect(result).toBeNull();
        });
    });

    describe('getCollisionOverlap', () => {
        it('should return overlap dimensions when colliding', () => {
            const a = { x: 0, y: 0, width: 50, height: 50 };
            const b = { x: 25, y: 25, width: 50, height: 50 };

            const overlap = getCollisionOverlap(a, b);

            expect(overlap).not.toBeNull();
            expect(overlap?.x).toBe(25);
            expect(overlap?.y).toBe(25);
        });

        it('should return null when not colliding', () => {
            const a = { x: 0, y: 0, width: 50, height: 50 };
            const b = { x: 100, y: 100, width: 50, height: 50 };

            const overlap = getCollisionOverlap(a, b);

            expect(overlap).toBeNull();
        });
    });

    describe('Edge Cases', () => {
        it('should handle zero-size rectangles', () => {
            const a = { x: 50, y: 50, width: 0, height: 0 };
            const b = { x: 50, y: 50, width: 50, height: 50 };

            // Zero-size rectangle at same position should not collide
            expect(checkAABBCollision(a, b)).toBe(false);
        });

        it('should handle negative positions', () => {
            const a = { x: -50, y: -50, width: 100, height: 100 };
            const b = { x: 0, y: 0, width: 50, height: 50 };

            expect(checkAABBCollision(a, b)).toBe(true);
        });
    });
});
