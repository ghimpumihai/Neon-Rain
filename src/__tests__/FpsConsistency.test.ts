import { describe, expect, it, vi } from 'vitest';
import { EnemyManager } from '../systems/EnemyManager';
import { PowerupManager } from '../systems/PowerupManager';

function withDeterministicRandom<T>(value: number, run: () => T): T {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(value);
    try {
        return run();
    } finally {
        randomSpy.mockRestore();
    }
}

describe('FPS consistency checks', () => {
    it('spawns enemies consistently at 30fps and 120fps over equal simulated time', () => {
        withDeterministicRandom(0.5, () => {
            const lowFpsManager = new EnemyManager({
                canvasWidth: 800,
                canvasHeight: 600,
                baseSpawnInterval: 1,
                baseEnemySpeed: 200,
                minSpawnInterval: 0.3,
                maxEnemySpeed: 600,
                difficultyIncreaseInterval: 999,
            });
            const highFpsManager = new EnemyManager({
                canvasWidth: 800,
                canvasHeight: 600,
                baseSpawnInterval: 1,
                baseEnemySpeed: 200,
                minSpawnInterval: 0.3,
                maxEnemySpeed: 600,
                difficultyIncreaseInterval: 999,
            });

            const simulateSeconds = 3;
            const lowDelta = 1 / 30;
            const highDelta = 1 / 120;

            for (let t = 0; t < simulateSeconds; t += lowDelta) {
                lowFpsManager.update(lowDelta);
            }

            for (let t = 0; t < simulateSeconds; t += highDelta) {
                highFpsManager.update(highDelta);
            }

            expect(lowFpsManager.getEnemyCount()).toBe(highFpsManager.getEnemyCount());
            expect(lowFpsManager.getDifficultyLevel()).toBe(highFpsManager.getDifficultyLevel());
        });
    });

    it('spawns powerups consistently at 30fps and 120fps over equal simulated time', () => {
        withDeterministicRandom(0.5, () => {
            const lowFpsManager = new PowerupManager(800, 600);
            const highFpsManager = new PowerupManager(800, 600);

            (lowFpsManager as unknown as { minSpawnInterval: number; maxSpawnInterval: number; nextSpawnTime: number }).minSpawnInterval = 1;
            (lowFpsManager as unknown as { minSpawnInterval: number; maxSpawnInterval: number; nextSpawnTime: number }).maxSpawnInterval = 1;
            (lowFpsManager as unknown as { minSpawnInterval: number; maxSpawnInterval: number; nextSpawnTime: number }).nextSpawnTime = 1;

            (highFpsManager as unknown as { minSpawnInterval: number; maxSpawnInterval: number; nextSpawnTime: number }).minSpawnInterval = 1;
            (highFpsManager as unknown as { minSpawnInterval: number; maxSpawnInterval: number; nextSpawnTime: number }).maxSpawnInterval = 1;
            (highFpsManager as unknown as { minSpawnInterval: number; maxSpawnInterval: number; nextSpawnTime: number }).nextSpawnTime = 1;

            const simulateSeconds = 3;
            const lowDelta = 1 / 30;
            const highDelta = 1 / 120;

            for (let t = 0; t < simulateSeconds; t += lowDelta) {
                lowFpsManager.update(lowDelta);
            }

            for (let t = 0; t < simulateSeconds; t += highDelta) {
                highFpsManager.update(highDelta);
            }

            expect(lowFpsManager.getPowerupCount()).toBe(highFpsManager.getPowerupCount());
        });
    });
});
