import { Entity } from './Entity';

/**
 * Powerup types
 */
export enum PowerupType {
    BOMB = 'bomb',
    SHIELD = 'shield',
    GUN = 'gun',
}

/**
 * Powerup configuration
 */
export interface PowerupConfig {
    type: PowerupType;
    color: string;
    glowColor: string;
    size: number;
}

const POWERUP_CONFIGS: Record<PowerupType, PowerupConfig> = {
    [PowerupType.BOMB]: {
        type: PowerupType.BOMB,
        color: '#ff6600',
        glowColor: '#ff6600',
        size: 25,
    },
    [PowerupType.SHIELD]: {
        type: PowerupType.SHIELD,
        color: '#00aaff',
        glowColor: '#00aaff',
        size: 25,
    },
    [PowerupType.GUN]: {
        type: PowerupType.GUN,
        color: '#ff0066',
        glowColor: '#ff0066',
        size: 25,
    },
};

/**
 * Powerup class - collectible items on the field
 */
export class Powerup extends Entity {
    private type: PowerupType;
    private config: PowerupConfig;
    private pulseTimer: number = 0;
    private isCollected: boolean = false;
    private floatOffset: number = 0;

    constructor(x: number, y: number, type: PowerupType) {
        const config = POWERUP_CONFIGS[type];
        super(x, y, config.size, config.size, config.color);

        this.type = type;
        this.config = config;
    }

    /**
     * Update powerup animation
     */
    public update(deltaTime: number): void {
        this.pulseTimer += deltaTime * 3;
        this.floatOffset = Math.sin(this.pulseTimer) * 5;
    }

    /**
     * Draw the powerup
     */
    public draw(ctx: CanvasRenderingContext2D): void {
        if (this.isCollected) return;

        ctx.save();

        const pulse = 0.7 + Math.sin(this.pulseTimer) * 0.3;
        const drawY = this.position.y + this.floatOffset;

        // Outer glow
        ctx.shadowBlur = 20 * pulse;
        ctx.shadowColor = this.config.glowColor;

        // Draw based on type
        ctx.fillStyle = this.config.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;

        const centerX = this.position.x + this.width / 2;
        const centerY = drawY + this.height / 2;
        const radius = this.width / 2;

        // Draw shape based on type
        if (this.type === PowerupType.BOMB) {
            // Bomb: Circle with fuse
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Fuse
            ctx.strokeStyle = this.config.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY - radius);
            ctx.lineTo(centerX + 5, centerY - radius - 8);
            ctx.stroke();

            // Spark
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.arc(centerX + 5, centerY - radius - 10, 3 * pulse, 0, Math.PI * 2);
            ctx.fill();

            // Label
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('💣', centerX, centerY + 5);

        } else if (this.type === PowerupType.SHIELD) {
            // Shield: Hexagon shape
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i - Math.PI / 2;
                const x = centerX + radius * Math.cos(angle);
                const y = centerY + radius * Math.sin(angle);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Label
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('🛡️', centerX, centerY + 5);

        } else if (this.type === PowerupType.GUN) {
            // Gun: Diamond shape
            ctx.beginPath();
            ctx.moveTo(centerX, centerY - radius);
            ctx.lineTo(centerX + radius, centerY);
            ctx.lineTo(centerX, centerY + radius);
            ctx.lineTo(centerX - radius, centerY);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Label
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('🔫', centerX, centerY + 5);
        }

        ctx.restore();
    }

    /**
     * Mark as collected
     */
    public collect(): void {
        this.isCollected = true;
    }

    // Getters
    public getType(): PowerupType { return this.type; }
    public getIsCollected(): boolean { return this.isCollected; }
}
