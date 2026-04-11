import { Powerup, PowerupType } from '../entities/Powerup';
import { Player } from '../entities/Player';
import { checkAABBCollision } from './Collision';
import type { PowerupSnapshot } from '../multiplayer/protocol';

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
    private simulationEnabled: boolean = true;

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
        const types = [PowerupType.BOMB, PowerupType.SHIELD, PowerupType.GUN, PowerupType.HEAL];
        return types[Math.floor(Math.random() * types.length)];
    }

    /**
     * Spawn a powerup at random position
     */
    private spawnPowerup(): void {
        // Random position (avoid edges and bottom where players are)
        const spawnRangeX = Math.max(0, this.canvasWidth - this.margin * 2);
        const spawnRangeY = Math.max(0, this.canvasHeight - this.margin * 3);
        const x = this.margin + Math.random() * spawnRangeX;
        const y = this.margin + Math.random() * spawnRangeY; // Avoid bottom

        const type = this.getRandomPowerupType();
        const powerup = new Powerup(x, y, type);
        this.powerups.push(powerup);

        console.log(`⚡ Spawned ${type} powerup at (${x.toFixed(0)}, ${y.toFixed(0)})`);
    }

    /**
     * Update powerups
     */
    public update(deltaTime: number): void {
        if (this.simulationEnabled) {
            // Spawn timer
            this.spawnTimer += deltaTime;

            if (this.spawnTimer >= this.nextSpawnTime && this.powerups.length < this.maxPowerups) {
                this.spawnPowerup();
                this.spawnTimer -= this.nextSpawnTime;
                this.nextSpawnTime = this.getRandomSpawnTime();
            }
        }

        // Update all powerups
        for (const powerup of this.powerups) {
            powerup.update(deltaTime);
        }

        if (this.simulationEnabled) {
            // Remove collected powerups
            this.powerups = this.powerups.filter(p => !p.getIsCollected());
        }
    }

    public setSimulationEnabled(enabled: boolean): void {
        this.simulationEnabled = enabled;
    }

    public resizeWorld(canvasWidth: number, canvasHeight: number, scaleX: number = 1, scaleY: number = 1): void {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;

        for (const powerup of this.powerups) {
            powerup.position.x *= scaleX;
            powerup.position.y *= scaleY;

            const maxX = Math.max(0, this.canvasWidth - powerup.width);
            const maxY = Math.max(0, this.canvasHeight - powerup.height);

            if (powerup.position.x < 0) {
                powerup.position.x = 0;
            } else if (powerup.position.x > maxX) {
                powerup.position.x = maxX;
            }

            if (powerup.position.y < 0) {
                powerup.position.y = 0;
            } else if (powerup.position.y > maxY) {
                powerup.position.y = maxY;
            }
        }
    }

    public serializePowerups(): PowerupSnapshot[] {
        return this.powerups.map((powerup, index) => ({
            powerupId: `powerup-${index}`,
            position: {
                x: powerup.position.x,
                y: powerup.position.y,
            },
            type: powerup.getType(),
            collected: powerup.getIsCollected(),
        }));
    }

    public applySnapshotPowerups(snapshots: PowerupSnapshot[]): void {
        this.powerups = snapshots
            .map(snapshot => {
                const powerupType = this.parsePowerupType(snapshot.type);
                if (!powerupType) {
                    return null;
                }

                const powerup = new Powerup(snapshot.position.x, snapshot.position.y, powerupType);
                if (snapshot.collected) {
                    powerup.collect();
                }
                return powerup;
            })
            .filter((powerup): powerup is Powerup => powerup !== null);
    }

    private parsePowerupType(type: string): PowerupType | null {
        switch (type) {
            case PowerupType.BOMB:
            case PowerupType.SHIELD:
            case PowerupType.GUN:
            case PowerupType.HEAL:
                return type;
            default:
                return null;
        }
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
