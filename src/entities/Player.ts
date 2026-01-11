import { Entity } from './Entity';
import { InputHandler } from '../systems/InputHandler';

/**
 * Player configuration
 */
export interface PlayerConfig {
    speed: number;
    dashMultiplier: number;
    size: number;
    color: string;
    glowColor: string;
    playerNumber: 1 | 2;
    label: string;
    maxHealth: number;
}

export const PLAYER_1_CONFIG: Partial<PlayerConfig> = {
    color: '#00ffff',
    glowColor: '#00ffff',
    playerNumber: 1,
    label: 'P1',
};

export const PLAYER_2_CONFIG: Partial<PlayerConfig> = {
    color: '#800000',
    glowColor: '#800000',
    playerNumber: 2,
    label: 'P2',
};

const DEFAULT_PLAYER_CONFIG: PlayerConfig = {
    speed: 400,
    dashMultiplier: 2.0,
    size: 30,
    color: '#00ffff',
    glowColor: '#00ffff',
    playerNumber: 1,
    label: 'P1',
    maxHealth: 100,
};

/**
 * Player class
 */
export class Player extends Entity {
    private input: InputHandler;
    private config: PlayerConfig;
    private canvasWidth: number;
    private canvasHeight: number;
    private isDashing: boolean = false;
    private glowIntensity: number = 0;
    private glowDirection: number = 1;
    private isAlive: boolean = true;
    private startX: number;
    private startY: number;

    // Health system
    private health: number;
    private maxHealth: number;

    // Shield system
    private isShielded: boolean = false;
    private shieldTimer: number = 0;
    private shieldDuration: number = 0;

    // Knockback
    private knockbackVelocity: { x: number; y: number } = { x: 0, y: 0 };
    private knockbackDecay: number = 0.9;
    private damageFlashTimer: number = 0;

    constructor(
        canvasWidth: number,
        canvasHeight: number,
        input: InputHandler,
        config?: Partial<PlayerConfig>
    ) {
        const finalConfig = { ...DEFAULT_PLAYER_CONFIG, ...config };
        let startX: number;
        const startY = canvasHeight - finalConfig.size - 50;

        if (finalConfig.playerNumber === 1) {
            startX = canvasWidth / 4 - finalConfig.size / 2;
        } else {
            startX = (canvasWidth * 3) / 4 - finalConfig.size / 2;
        }

        super(startX, startY, finalConfig.size, finalConfig.size, finalConfig.color);

        this.input = input;
        this.config = finalConfig;
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.startX = startX;
        this.startY = startY;
        this.maxHealth = finalConfig.maxHealth;
        this.health = this.maxHealth;
    }

    public update(deltaTime: number): void {
        if (!this.isAlive) return;

        if (this.isShielded) {
            this.shieldTimer += deltaTime;
            if (this.shieldTimer >= this.shieldDuration) {
                this.deactivateShield();
            }
        }
        if (this.damageFlashTimer > 0) this.damageFlashTimer -= deltaTime;

        // Move
        const horizontalAxis = this.input.getHorizontalAxis();
        const verticalAxis = this.input.getVerticalAxis();
        this.isDashing = this.input.isDashing();
        const speedMultiplier = this.isDashing ? this.config.dashMultiplier : 1;

        this.velocity.x = horizontalAxis * this.config.speed * speedMultiplier;
        this.velocity.y = verticalAxis * this.config.speed * speedMultiplier;

        // Knockback
        this.velocity.x += this.knockbackVelocity.x;
        this.velocity.y += this.knockbackVelocity.y;
        this.knockbackVelocity.x *= this.knockbackDecay;
        this.knockbackVelocity.y *= this.knockbackDecay;
        if (Math.abs(this.knockbackVelocity.x) < 1) this.knockbackVelocity.x = 0;
        if (Math.abs(this.knockbackVelocity.y) < 1) this.knockbackVelocity.y = 0;

        super.update(deltaTime);
        this.clampToBounds();
        this.updateGlow(deltaTime);
    }

    private clampToBounds(): void {
        if (this.position.x < 0) this.position.x = 0;
        if (this.position.x + this.width > this.canvasWidth) this.position.x = this.canvasWidth - this.width;
        if (this.position.y < 0) this.position.y = 0;
        if (this.position.y + this.height > this.canvasHeight) this.position.y = this.canvasHeight - this.height;
    }

    private updateGlow(deltaTime: number): void {
        const glowSpeed = this.isDashing ? 8 : 3;
        this.glowIntensity += this.glowDirection * glowSpeed * deltaTime;
        if (this.glowIntensity >= 1) { this.glowIntensity = 1; this.glowDirection = -1; }
        else if (this.glowIntensity <= 0.3) { this.glowIntensity = 0.3; this.glowDirection = 1; }
    }

    public takeDamage(amount: number): boolean {
        if (!this.isAlive || this.isShielded) return false;
        this.health = Math.max(0, this.health - amount);
        this.damageFlashTimer = 0.2;
        if (this.health <= 0) {
            this.kill();
            return true;
        }
        return false;
    }

    public activateShield(duration: number): void {
        this.isShielded = true;
        this.shieldTimer = 0;
        this.shieldDuration = duration;
    }

    public deactivateShield(): void {
        this.isShielded = false;
        this.shieldTimer = 0;
    }

    public applyKnockback(dx: number, dy: number, force: number): void {
        if (this.isShielded) return;
        this.knockbackVelocity.x = dx * force;
        this.knockbackVelocity.y = dy * force;
    }

    public draw(ctx: CanvasRenderingContext2D): void {
        if (!this.isAlive) return;
        ctx.save();

        const baseGlow = this.isDashing ? 25 : 15;
        const glowSize = baseGlow * this.glowIntensity;

        let playerColor = this.config.color;
        if (this.damageFlashTimer > 0) playerColor = '#ff0000';

        ctx.shadowBlur = glowSize;
        ctx.shadowColor = this.isShielded ? '#00aaff' : this.config.glowColor;
        ctx.fillStyle = playerColor;
        ctx.fillRect(this.position.x, this.position.y, this.width, this.height);

        // Highlight
        ctx.shadowBlur = 0;
        const innerPadding = 4;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.position.x + innerPadding, this.position.y + innerPadding, this.width - innerPadding * 2, this.height - innerPadding * 2);

        // Label
        ctx.shadowBlur = 3;
        ctx.shadowColor = this.config.glowColor;
        ctx.fillStyle = this.config.color;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this.config.label, this.position.x + this.width / 2, this.position.y - 25);

        // Shield Effect Ring
        if (this.isShielded) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00aaff';
            ctx.strokeStyle = '#00aaff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.position.x + this.width / 2, this.position.y + this.height / 2, this.width * 0.8, 0, Math.PI * 2);
            ctx.stroke();
        }

        this.drawHealthBar(ctx);
        ctx.restore();
    }

    private drawHealthBar(ctx: CanvasRenderingContext2D): void {
        const barWidth = this.width + 10;
        const barHeight = 6;
        const barX = this.position.x - 5;
        const barY = this.position.y - 18;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        const healthPercent = this.health / this.maxHealth;
        let healthColor = healthPercent <= 0.3 ? '#ff0000' : (healthPercent <= 0.6 ? '#ffff00' : '#00ff00');
        ctx.fillStyle = healthColor;
        ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }

    public getConfig(): PlayerConfig { return this.config; }
    public getIsDashing(): boolean { return this.isDashing; }
    public getIsAlive(): boolean { return this.isAlive; }
    public getColor(): string { return this.config.color; }
    public getHealth(): number { return this.health; }
    public getMaxHealth(): number { return this.maxHealth; }
    public getLabel(): string { return this.config.label; }

    public kill(): void { this.isAlive = false; }
    public reset(): void {
        this.position.x = this.startX;
        this.position.y = this.startY;
        this.velocity = { x: 0, y: 0 };
        this.knockbackVelocity = { x: 0, y: 0 };
        this.health = this.maxHealth;
        this.isAlive = true;
        this.isShielded = false;
        this.shieldTimer = 0;
    }

    public getCenter(): { x: number, y: number } {
        return { x: this.position.x + this.width / 2, y: this.position.y + this.height / 2 };
    }
}
