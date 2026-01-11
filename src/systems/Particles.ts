import { Vector2 } from '../core/interfaces';

/**
 * Single particle configuration
 */
export interface ParticleConfig {
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
    size: number;
    color: string;
    lifetime: number;
    fadeRate: number;
}

/**
 * Single Particle class
 */
export class Particle {
    public position: Vector2;
    public velocity: Vector2;
    public size: number;
    public color: string;
    public alpha: number = 1;
    public lifetime: number;
    public maxLifetime: number;
    public fadeRate: number;
    public isDead: boolean = false;

    constructor(config: ParticleConfig) {
        this.position = { x: config.x, y: config.y };
        this.velocity = { x: config.velocityX, y: config.velocityY };
        this.size = config.size;
        this.color = config.color;
        this.lifetime = config.lifetime;
        this.maxLifetime = config.lifetime;
        this.fadeRate = config.fadeRate;
    }

    /**
     * Update the particle
     */
    public update(deltaTime: number): void {
        // Move particle
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;

        // Decrease lifetime
        this.lifetime -= deltaTime;

        // Fade out
        this.alpha = Math.max(0, this.lifetime / this.maxLifetime);

        // Shrink over time
        this.size = this.size * (0.98 + 0.02 * this.alpha);

        // Mark as dead when lifetime expires
        if (this.lifetime <= 0 || this.alpha <= 0) {
            this.isDead = true;
        }
    }

    /**
     * Draw the particle
     */
    public draw(ctx: CanvasRenderingContext2D): void {
        if (this.isDead) return;

        ctx.save();

        // Apply glow effect
        ctx.shadowBlur = 8 * this.alpha;
        ctx.shadowColor = this.color;

        // Draw particle
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.fillRect(
            this.position.x - this.size / 2,
            this.position.y - this.size / 2,
            this.size,
            this.size
        );

        ctx.restore();
    }
}

/**
 * ParticleSystem class
 * Manages all particles in the game
 */
export class ParticleSystem {
    private particles: Particle[] = [];
    private maxParticles: number = 500;

    constructor(maxParticles: number = 500) {
        this.maxParticles = maxParticles;
    }

    /**
     * Spawn a single particle
     */
    public spawn(config: ParticleConfig): void {
        if (this.particles.length >= this.maxParticles) {
            // Remove oldest particle if at max
            this.particles.shift();
        }
        this.particles.push(new Particle(config));
    }

    /**
     * Spawn a trail effect (multiple particles)
     */
    public spawnTrail(
        x: number,
        y: number,
        color: string,
        velocityX: number = 0,
        velocityY: number = 0,
        count: number = 3
    ): void {
        for (let i = 0; i < count; i++) {
            const spread = 8;
            const offsetX = (Math.random() - 0.5) * spread;
            const offsetY = (Math.random() - 0.5) * spread;

            // Particles move opposite to player movement with some randomness
            const particleVelocityX = -velocityX * 0.1 + (Math.random() - 0.5) * 30;
            const particleVelocityY = -velocityY * 0.1 + (Math.random() - 0.5) * 30;

            this.spawn({
                x: x + offsetX,
                y: y + offsetY,
                velocityX: particleVelocityX,
                velocityY: particleVelocityY,
                size: 4 + Math.random() * 6,
                color: color,
                lifetime: 0.3 + Math.random() * 0.3,
                fadeRate: 1,
            });
        }
    }

    /**
     * Spawn an explosion effect
     */
    public spawnExplosion(
        x: number,
        y: number,
        colors: string[],
        count: number = 30
    ): void {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
            const speed = 100 + Math.random() * 200;
            const color = colors[Math.floor(Math.random() * colors.length)];

            this.spawn({
                x: x,
                y: y,
                velocityX: Math.cos(angle) * speed,
                velocityY: Math.sin(angle) * speed,
                size: 5 + Math.random() * 10,
                color: color,
                lifetime: 0.5 + Math.random() * 0.5,
                fadeRate: 1,
            });
        }
    }

    /**
     * Spawn sparkle effect (for dash)
     */
    public spawnSparkles(
        x: number,
        y: number,
        color: string,
        count: number = 5
    ): void {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 50 + Math.random() * 100;

            this.spawn({
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 20,
                velocityX: Math.cos(angle) * speed,
                velocityY: Math.sin(angle) * speed,
                size: 2 + Math.random() * 4,
                color: color,
                lifetime: 0.2 + Math.random() * 0.2,
                fadeRate: 1.5,
            });
        }
    }

    /**
     * Update all particles
     */
    public update(deltaTime: number): void {
        // Update all particles
        for (const particle of this.particles) {
            particle.update(deltaTime);
        }

        // Remove dead particles
        this.particles = this.particles.filter((p) => !p.isDead);
    }

    /**
     * Draw all particles
     */
    public draw(ctx: CanvasRenderingContext2D): void {
        for (const particle of this.particles) {
            particle.draw(ctx);
        }
    }

    /**
     * Get the current particle count
     */
    public getParticleCount(): number {
        return this.particles.length;
    }

    /**
     * Clear all particles
     */
    public clear(): void {
        this.particles = [];
    }
}
