import { Entity } from './Entity';
import { Player } from './Player';

/**
 * Bomb class - placed by players, explodes after delay
 */
export class Bomb extends Entity {
    private owner: Player;
    private fuseTime: number = 2; // seconds until explosion
    private timer: number = 0;
    private isExploded: boolean = false;
    private explosionRadius: number = 80;
    private damage: number = 30;
    private pulseTimer: number = 0;

    // Explosion animation
    private explosionTimer: number = 0;
    private explosionDuration: number = 0.5;
    private isExploding: boolean = false;

    constructor(x: number, y: number, owner: Player) {
        super(x - 15, y - 15, 30, 30, '#ff6600');
        this.owner = owner;
    }

    /**
     * Update bomb timer
     */
    public update(deltaTime: number): void {
        if (this.isExploded) {
            // Update explosion animation
            this.explosionTimer += deltaTime;
            if (this.explosionTimer >= this.explosionDuration) {
                this.isExploding = false;
            }
            return;
        }

        this.timer += deltaTime;
        this.pulseTimer += deltaTime * (2 + this.timer * 3); // Pulse faster as timer approaches

        if (this.timer >= this.fuseTime) {
            this.explode();
        }
    }

    /**
     * Trigger explosion
     */
    private explode(): void {
        this.isExploded = true;
        this.isExploding = true;
        this.explosionTimer = 0;
        console.log(`💥 Bomb exploded at (${this.position.x}, ${this.position.y})!`);
    }

    /**
     * Check if bomb damages a player
     */
    public checkDamage(player: Player): boolean {
        if (!this.isExploded || !this.isExploding) return false;
        if (this.explosionTimer > 0.1) return false; // Only damage on first frame

        // Check if player is owner (bombs don't hurt owner)
        if (player === this.owner) return false;

        // Check distance to player
        const playerCenter = player.getCenter();
        const bombCenter = {
            x: this.position.x + this.width / 2,
            y: this.position.y + this.height / 2,
        };

        const dx = playerCenter.x - bombCenter.x;
        const dy = playerCenter.y - bombCenter.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= this.explosionRadius) {
            // Apply knockback away from bomb
            const knockbackForce = 400;
            const dirX = dx / distance;
            const dirY = dy / distance;
            player.applyKnockback(dirX, dirY, knockbackForce);

            return true;
        }

        return false;
    }

    /**
     * Draw bomb
     */
    public draw(ctx: CanvasRenderingContext2D): void {
        ctx.save();

        const centerX = this.position.x + this.width / 2;
        const centerY = this.position.y + this.height / 2;

        if (this.isExploding) {
            // Draw explosion
            const progress = this.explosionTimer / this.explosionDuration;
            const currentRadius = this.explosionRadius * (0.5 + progress * 0.5);
            const alpha = 1 - progress;

            // Outer explosion
            ctx.globalAlpha = alpha * 0.3;
            ctx.fillStyle = '#ff6600';
            ctx.shadowBlur = 50;
            ctx.shadowColor = '#ff6600';
            ctx.beginPath();
            ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
            ctx.fill();

            // Inner explosion
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.arc(centerX, centerY, currentRadius * 0.5, 0, Math.PI * 2);
            ctx.fill();

            // Core
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(centerX, centerY, currentRadius * 0.2, 0, Math.PI * 2);
            ctx.fill();

        } else if (!this.isExploded) {
            // Draw bomb
            const pulse = Math.sin(this.pulseTimer) * 0.3 + 0.7;
            const timeLeft = this.fuseTime - this.timer;
            const urgency = 1 - (timeLeft / this.fuseTime);

            // Glow based on urgency
            ctx.shadowBlur = 15 + urgency * 20;
            ctx.shadowColor = urgency > 0.7 ? '#ff0000' : '#ff6600';

            // Bomb body
            ctx.fillStyle = urgency > 0.7 ? '#ff0000' : '#ff6600';
            ctx.beginPath();
            ctx.arc(centerX, centerY, this.width / 2 * pulse, 0, Math.PI * 2);
            ctx.fill();

            // Fuse spark
            ctx.fillStyle = '#ffff00';
            ctx.shadowColor = '#ffff00';
            ctx.shadowBlur = 10;
            const sparkSize = 4 + Math.sin(this.pulseTimer * 5) * 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY - this.height / 2 - 5, sparkSize, 0, Math.PI * 2);
            ctx.fill();

            // Timer text
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(timeLeft.toFixed(1), centerX, centerY + 4);
        }

        ctx.restore();
    }

    // Getters
    public getIsExploded(): boolean { return this.isExploded; }
    public getIsExploding(): boolean { return this.isExploding; }
    public isFinished(): boolean { return this.isExploded && !this.isExploding; }
    public getDamage(): number { return this.damage; }
    public getOwner(): Player { return this.owner; }
}
