import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Particle, ParticleSystem, ParticleConfig } from '../systems/Particles';

// Create a mock canvas context
const createMockContext = () => {
    return {
        save: vi.fn(),
        restore: vi.fn(),
        fillRect: vi.fn(),
        fillStyle: '',
        globalAlpha: 1,
        shadowBlur: 0,
        shadowColor: '',
    } as unknown as CanvasRenderingContext2D;
};

describe('Phase 5: Particles', () => {
    describe('Particle', () => {
        let particle: Particle;
        const defaultConfig: ParticleConfig = {
            x: 100,
            y: 100,
            velocityX: 10,
            velocityY: 10,
            size: 5,
            color: '#00ffff',
            lifetime: 1,
            fadeRate: 1,
        };

        beforeEach(() => {
            particle = new Particle(defaultConfig);
        });

        it('should create a particle with correct initial position', () => {
            expect(particle.position.x).toBe(100);
            expect(particle.position.y).toBe(100);
        });

        it('should have full alpha initially', () => {
            expect(particle.alpha).toBe(1);
        });

        it('should not be dead initially', () => {
            expect(particle.isDead).toBe(false);
        });

        it('should move when updated', () => {
            const startX = particle.position.x;
            const startY = particle.position.y;

            particle.update(0.1);

            expect(particle.position.x).toBeGreaterThan(startX);
            expect(particle.position.y).toBeGreaterThan(startY);
        });

        it('should fade over time', () => {
            particle.update(0.5);
            expect(particle.alpha).toBeLessThan(1);
        });

        it('should die when lifetime expires', () => {
            particle.update(1.5); // Exceed lifetime
            expect(particle.isDead).toBe(true);
        });

        it('should draw without errors', () => {
            const mockCtx = createMockContext();
            expect(() => particle.draw(mockCtx)).not.toThrow();
            expect(mockCtx.save).toHaveBeenCalled();
            expect(mockCtx.restore).toHaveBeenCalled();
        });

        it('should not draw when dead', () => {
            const mockCtx = createMockContext();
            particle.isDead = true;
            particle.draw(mockCtx);
            expect(mockCtx.fillRect).not.toHaveBeenCalled();
        });
    });

    describe('ParticleSystem', () => {
        let system: ParticleSystem;

        beforeEach(() => {
            system = new ParticleSystem(100);
        });

        it('should start with no particles', () => {
            expect(system.getParticleCount()).toBe(0);
        });

        it('should spawn a particle', () => {
            system.spawn({
                x: 100,
                y: 100,
                velocityX: 0,
                velocityY: 0,
                size: 5,
                color: '#fff',
                lifetime: 1,
                fadeRate: 1,
            });

            expect(system.getParticleCount()).toBe(1);
        });

        it('should spawn trail particles', () => {
            system.spawnTrail(100, 100, '#00ffff', 10, 10, 5);
            expect(system.getParticleCount()).toBe(5);
        });

        it('should spawn explosion particles', () => {
            system.spawnExplosion(100, 100, ['#ff0000', '#00ff00'], 20);
            expect(system.getParticleCount()).toBe(20);
        });

        it('should spawn sparkle particles', () => {
            system.spawnSparkles(100, 100, '#ffffff', 10);
            expect(system.getParticleCount()).toBe(10);
        });

        it('should remove dead particles on update', () => {
            // Spawn particles with short lifetime
            system.spawn({
                x: 100,
                y: 100,
                velocityX: 0,
                velocityY: 0,
                size: 5,
                color: '#fff',
                lifetime: 0.1,
                fadeRate: 1,
            });

            expect(system.getParticleCount()).toBe(1);

            // Update past lifetime
            system.update(0.5);

            expect(system.getParticleCount()).toBe(0);
        });

        it('should respect max particle limit', () => {
            const smallSystem = new ParticleSystem(5);

            // Try to spawn more than max
            for (let i = 0; i < 10; i++) {
                smallSystem.spawn({
                    x: 100,
                    y: 100,
                    velocityX: 0,
                    velocityY: 0,
                    size: 5,
                    color: '#fff',
                    lifetime: 10,
                    fadeRate: 1,
                });
            }

            expect(smallSystem.getParticleCount()).toBe(5);
        });

        it('should clear all particles', () => {
            system.spawnExplosion(100, 100, ['#fff'], 30);
            expect(system.getParticleCount()).toBe(30);

            system.clear();
            expect(system.getParticleCount()).toBe(0);
        });

        it('should draw all particles without errors', () => {
            const mockCtx = createMockContext();
            system.spawnTrail(100, 100, '#fff', 0, 0, 5);

            expect(() => system.draw(mockCtx)).not.toThrow();
        });
    });
});
