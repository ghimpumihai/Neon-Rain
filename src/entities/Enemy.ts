import { Entity } from './Entity';

/**
 * Enemy configuration
 */
export interface EnemyConfig {
    width: number;
    height: number;
    speed: number;
    color: string;
    glowColor: string;
}

const DEFAULT_ENEMY_CONFIG: EnemyConfig = {
    width: 40,
    height: 15,
    speed: 300, // pixels per second (will be varied)
    color: '#ff00ff', // Magenta
    glowColor: '#ff00ff',
};

/**
 * Enemy class
 * Falling obstacles that the player must dodge
 */
export class Enemy extends Entity {
    private config: EnemyConfig;
    private canvasHeight: number;
    private isOffScreen: boolean = false;
    private glowIntensity: number;

    constructor(
        x: number,
        canvasHeight: number,
        speed: number,
        config?: Partial<EnemyConfig>
    ) {
        // Merge default config with provided config
        const finalConfig = { ...DEFAULT_ENEMY_CONFIG, ...config };

        // Start above the screen
        const startY = -finalConfig.height;

        super(x, startY, finalConfig.width, finalConfig.height, finalConfig.color);

        this.config = finalConfig;
        this.canvasHeight = canvasHeight;
        this.velocity.y = speed; // Falling speed
        this.glowIntensity = 0.5 + Math.random() * 0.5; // Random glow intensity
    }

    /**
     * Update enemy position
     */
    public update(deltaTime: number): void {
        // Apply velocity (falling)
        super.update(deltaTime);

        // Check if off-screen (past bottom)
        if (this.position.y > this.canvasHeight) {
            this.isOffScreen = true;
        }
    }

    /**
     * Draw the enemy with neon glow effect
     */
    public draw(ctx: CanvasRenderingContext2D): void {
        ctx.save();

        // Draw outer glow
        ctx.shadowBlur = 12 * this.glowIntensity;
        ctx.shadowColor = this.config.glowColor;

        // Draw the main rectangle (rain drop shape)
        ctx.fillStyle = this.config.color;
        ctx.fillRect(this.position.x, this.position.y, this.width, this.height);

        // Add inner glow line
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillRect(
            this.position.x + 2,
            this.position.y + 2,
            this.width - 4,
            3
        );

        ctx.restore();
    }

    /**
     * Check if the enemy has gone off-screen
     */
    public getIsOffScreen(): boolean {
        return this.isOffScreen;
    }

    /**
     * Get the enemy's falling speed
     */
    public getSpeed(): number {
        return this.velocity.y;
    }
}
