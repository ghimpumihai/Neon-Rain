import { Enemy, EnemyConfig } from '../entities/Enemy';

/**
 * EnemyManager configuration
 */
export interface EnemyManagerConfig {
    canvasWidth: number;
    canvasHeight: number;
    baseSpawnInterval: number; // seconds between spawns
    baseEnemySpeed: number;
    minSpawnInterval: number; // minimum spawn interval (for difficulty scaling)
    maxEnemySpeed: number;
    difficultyIncreaseInterval: number; // seconds between difficulty increases
}

const DEFAULT_MANAGER_CONFIG: EnemyManagerConfig = {
    canvasWidth: 800,
    canvasHeight: 600,
    baseSpawnInterval: 1.0, // 1 second between spawns
    baseEnemySpeed: 200,
    minSpawnInterval: 0.3,
    maxEnemySpeed: 600,
    difficultyIncreaseInterval: 10, // Increase difficulty every 10 seconds
};

/**
 * EnemyManager class
 * Handles spawning, updating, and removing enemies
 */
export class EnemyManager {
    private enemies: Enemy[] = [];
    private config: EnemyManagerConfig;
    private spawnTimer: number = 0;
    private currentSpawnInterval: number;
    private currentEnemySpeed: number;
    private difficultyTimer: number = 0;
    private difficultyLevel: number = 1;

    // Enemy visual variants
    private enemyColors: { color: string; glowColor: string }[] = [
        { color: '#ff00ff', glowColor: '#ff00ff' }, // Magenta
        { color: '#ff0066', glowColor: '#ff0066' }, // Pink
        { color: '#ff3300', glowColor: '#ff3300' }, // Orange-Red
        { color: '#ffff00', glowColor: '#ffff00' }, // Yellow
    ];

    constructor(config?: Partial<EnemyManagerConfig>) {
        this.config = { ...DEFAULT_MANAGER_CONFIG, ...config };
        this.currentSpawnInterval = this.config.baseSpawnInterval;
        this.currentEnemySpeed = this.config.baseEnemySpeed;

        console.log('👾 EnemyManager initialized');
    }

    /**
     * Update all enemies and handle spawning
     */
    public update(deltaTime: number): void {
        // Update spawn timer
        this.spawnTimer += deltaTime;

        // Update difficulty timer
        this.difficultyTimer += deltaTime;
        if (this.difficultyTimer >= this.config.difficultyIncreaseInterval) {
            this.increaseDifficulty();
            this.difficultyTimer = 0;
        }

        // Spawn new enemy if timer exceeded
        if (this.spawnTimer >= this.currentSpawnInterval) {
            this.spawnEnemy();
            this.spawnTimer = 0;
        }

        // Update all enemies
        for (const enemy of this.enemies) {
            enemy.update(deltaTime);
        }

        // Remove off-screen enemies
        this.removeOffScreenEnemies();
    }

    /**
     * Draw all enemies
     */
    public draw(ctx: CanvasRenderingContext2D): void {
        for (const enemy of this.enemies) {
            enemy.draw(ctx);
        }
    }

    /**
     * Spawn a new enemy at a random X position
     */
    private spawnEnemy(): void {
        // Determine spawn type based on random chance
        const spawnType = Math.random();

        if (spawnType < 0.15) {
            // 15% chance: Wide enemy that covers more area
            this.spawnWideEnemy();
        } else if (spawnType < 0.30) {
            // 15% chance: Edge enemy (targets corners)
            this.spawnEdgeEnemy();
        } else {
            // 70% chance: Normal random spawn
            this.spawnNormalEnemy();
        }
    }

    /**
     * Spawn a normal enemy at any X position (full width coverage)
     */
    private spawnNormalEnemy(): void {
        // Random size variation first
        const widthVariation = 0.7 + Math.random() * 0.6;
        const width = 40 * widthVariation;

        // Spawn anywhere on screen (only account for enemy width to stay on screen)
        const x = Math.random() * (this.config.canvasWidth - width);

        // Randomize speed slightly
        const speedVariation = 0.7 + Math.random() * 0.6;
        const speed = this.currentEnemySpeed * speedVariation;

        // Random color variant
        const colorVariant = this.enemyColors[Math.floor(Math.random() * this.enemyColors.length)];

        const enemyConfig: Partial<EnemyConfig> = {
            ...colorVariant,
            width: width,
        };

        const enemy = new Enemy(x, this.config.canvasHeight, speed, enemyConfig);
        this.enemies.push(enemy);
    }

    /**
     * Spawn a wide enemy that covers more horizontal space
     */
    private spawnWideEnemy(): void {
        // Wide enemies are 2-4x normal width
        const width = 80 + Math.random() * 120; // 80-200px wide

        // Can spawn anywhere
        const x = Math.random() * (this.config.canvasWidth - width);

        // Wide enemies are slightly slower
        const speed = this.currentEnemySpeed * (0.5 + Math.random() * 0.3);

        // Use a distinct color for wide enemies
        const wideColors = [
            { color: '#ff6600', glowColor: '#ff6600' }, // Orange
            { color: '#cc00ff', glowColor: '#cc00ff' }, // Purple
        ];
        const colorVariant = wideColors[Math.floor(Math.random() * wideColors.length)];

        const enemyConfig: Partial<EnemyConfig> = {
            ...colorVariant,
            width: width,
            height: 12, // Slightly thinner
        };

        const enemy = new Enemy(x, this.config.canvasHeight, speed, enemyConfig);
        this.enemies.push(enemy);
    }

    /**
     * Spawn an enemy specifically targeting edge areas (corners)
     */
    private spawnEdgeEnemy(): void {
        const width = 30 + Math.random() * 20; // Smaller, faster edge enemies

        // Decide which edge to target
        const targetLeftEdge = Math.random() < 0.5;

        let x: number;
        if (targetLeftEdge) {
            // Spawn in left corner zone (0-100px)
            x = Math.random() * 100;
        } else {
            // Spawn in right corner zone
            x = this.config.canvasWidth - 100 + Math.random() * (100 - width);
        }

        // Edge enemies are faster
        const speed = this.currentEnemySpeed * (1.2 + Math.random() * 0.4);

        // Use lime green for edge enemies (distinctive)
        const enemyConfig: Partial<EnemyConfig> = {
            color: '#00ff00',
            glowColor: '#00ff00',
            width: width,
        };

        const enemy = new Enemy(x, this.config.canvasHeight, speed, enemyConfig);
        this.enemies.push(enemy);
    }

    /**
     * Remove enemies that have gone off-screen
     */
    private removeOffScreenEnemies(): void {
        const beforeCount = this.enemies.length;
        this.enemies = this.enemies.filter((enemy) => !enemy.getIsOffScreen());
        const removed = beforeCount - this.enemies.length;

        if (removed > 0) {
            // Silently remove - no console spam
        }
    }

    /**
     * Increase difficulty (called every X seconds)
     */
    private increaseDifficulty(): void {
        this.difficultyLevel++;

        // Decrease spawn interval (more enemies)
        this.currentSpawnInterval = Math.max(
            this.config.minSpawnInterval,
            this.currentSpawnInterval * 0.85
        );

        // Increase enemy speed
        this.currentEnemySpeed = Math.min(
            this.config.maxEnemySpeed,
            this.currentEnemySpeed * 1.15
        );

        console.log(
            `⚡ Difficulty increased to level ${this.difficultyLevel}! ` +
            `Spawn interval: ${this.currentSpawnInterval.toFixed(2)}s, ` +
            `Speed: ${this.currentEnemySpeed.toFixed(0)}px/s`
        );
    }

    /**
     * Get all active enemies (for collision detection)
     */
    public getEnemies(): Enemy[] {
        return this.enemies;
    }

    /**
     * Get the current difficulty level
     */
    public getDifficultyLevel(): number {
        return this.difficultyLevel;
    }

    /**
     * Get the current enemy count
     */
    public getEnemyCount(): number {
        return this.enemies.length;
    }

    /**
     * Reset the manager (for game restart)
     */
    public reset(): void {
        this.enemies = [];
        this.spawnTimer = 0;
        this.difficultyTimer = 0;
        this.difficultyLevel = 1;
        this.currentSpawnInterval = this.config.baseSpawnInterval;
        this.currentEnemySpeed = this.config.baseEnemySpeed;
        console.log('👾 EnemyManager reset');
    }

    /**
     * Clear all enemies (without resetting difficulty)
     */
    public clearEnemies(): void {
        this.enemies = [];
    }
}
