import { GameObject } from '../core/interfaces';

/**
 * Collision detection utilities
 * Uses AABB (Axis-Aligned Bounding Box) collision detection
 */

/**
 * Check if two rectangles overlap using AABB collision
 * 
 * Formula:
 * x1 < x2 + w2 AND x1 + w1 > x2 AND y1 < y2 + h2 AND y1 + h1 > y2
 */
export function checkAABBCollision(
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number }
): boolean {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

/**
 * Check collision between two GameObjects
 */
export function checkGameObjectCollision(a: GameObject, b: GameObject): boolean {
    return checkAABBCollision(
        { x: a.position.x, y: a.position.y, width: a.width, height: a.height },
        { x: b.position.x, y: b.position.y, width: b.width, height: b.height }
    );
}

/**
 * Check if a GameObject collides with any object in an array
 * Returns the first colliding object or null
 */
export function checkCollisionWithArray<T extends GameObject>(
    object: GameObject,
    array: T[]
): T | null {
    for (const item of array) {
        if (checkGameObjectCollision(object, item)) {
            return item;
        }
    }
    return null;
}

/**
 * Get the overlap between two rectangles (for penetration depth)
 */
export function getCollisionOverlap(
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number }
): { x: number; y: number } | null {
    if (!checkAABBCollision(a, b)) {
        return null;
    }

    const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);

    return { x: overlapX, y: overlapY };
}
