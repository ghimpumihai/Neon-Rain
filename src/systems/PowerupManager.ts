import { Powerup, PowerupType } from '../entities/Powerup';
import { Player } from '../entities/Player';
import { checkAABBCollision } from './Collision';

/**
 * PowerupManager - handles spawning and collecting powerups
 */
export class PowerupManager {
    private powerups: Powerup[] = [];
    private canvasWidth: number;
    private canvasHeight: number;

    // Spawn settings (rare powerups)
    private spawnTimer: number = 0;
    private minSpawnInterval: number = 8;
    private maxSpawnInterval: number = 12;
    private nextSpawnTime: number;
    private maxPowerups: number = 1; // Only 1 at a time

    // Margin from edges
    private margin: number = 60;

    constructor(canvasWidth: number, canvasHeight: number) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.nextSpawnTime = this.getRandomSpawnTime();

        console.log('⚡ PowerupManager initialized');
    }

    /**
     * Get random spawn interval
     */
    private getRandomSpawnTime(): number {
        return this.minSpawnInterval + Math.random() * (this.maxSpawnInterval - this.minSpawnInterval);
    }

    /**
     * Get random powerup type
     */
    private getRandomPowerupType(): PowerupType {
        const types = [PowerupType.BOMB, PowerupType.SHIELD, PowerupType.GUN];
        return types[Math.floor(Math.random() * types.length)];
    }

    /**
     * Spawn a powerup at random position
     */
    private spawnPowerup(): void {
        // Random position (avoid edges and bottom where players are)
        const x = this.margin + Math.random() * (this.canvasWidth - this.margin * 2);
        const y = this.margin + Math.random() * (this.canvasHeight - this.margin * 3); // Avoid bottom

        const type = this.getRandomPowerupType();
        const powerup = new Powerup(x, y, type);
        this.powerups.push(powerup);

        console.log(`⚡ Spawned ${type} powerup at (${x.toFixed(0)}, ${y.toFixed(0)})`);
    }

    /**
     * Update powerups
     */
    public update(deltaTime: number): void {
        // Spawn timer
        this.spawnTimer += deltaTime;

        if (this.spawnTimer >= this.nextSpawnTime && this.powerups.length < this.maxPowerups) {
            this.spawnPowerup();
            this.spawnTimer = 0;
            this.nextSpawnTime = this.getRandomSpawnTime();
        }

        // Update all powerups
        for (const powerup of this.powerups) {
            powerup.update(deltaTime);
        }

        // Remove collected powerups
        this.powerups = this.powerups.filter(p => !p.getIsCollected());
    }

    /**
     * Check if a player collects a powerup
     */
    public checkCollection(player: Player): PowerupType | null {
        if (!player.getIsAlive()) return null;

        for (const powerup of this.powerups) {
            if (powerup.getIsCollected()) continue;

            const playerBounds = {
                x: player.position.x,
                y: player.position.y,
                width: player.width,
                height: player.height,
            };

            const powerupBounds = {
                x: powerup.position.x,
                y: powerup.position.y,
                width: powerup.width,
                height: powerup.height,
            };

            if (checkAABBCollision(playerBounds, powerupBounds)) {
                powerup.collect();
                console.log(`✨ ${player.getLabel()} collected ${powerup.getType()}!`);
                return powerup.getType();
            }
        }

        return null;
    }

    /**
     * Draw all powerups
     */
    public draw(ctx: CanvasRenderingContext2D): void {
        for (const powerup of this.powerups) {
            powerup.draw(ctx);
        }
    }

    /**
     * Reset manager
     */
    public reset(): void {
        this.powerups = [];
        this.spawnTimer = 0;
        this.nextSpawnTime = this.getRandomSpawnTime();
    }

    /**
     * Get powerup count
     */
    public getPowerupCount(): number {
        return this.powerups.length;
    }
}
