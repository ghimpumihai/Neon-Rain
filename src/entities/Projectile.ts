import { Entity } from './Entity';
import { Player } from './Player';

export class Projectile extends Entity {
    private target: Player;
    private shooter: Player;
    private speed: number = 500;
    private damage: number = 15;
    private lifetime: number = 3; // seconds
    private age: number = 0;
    private isExpired: boolean = false;
    private trailPositions: { x: number; y: number }[] = [];

    constructor(x: number, y: number, shooter: Player, target: Player) {
        super(x, y, 8, 8, shooter.getColor());
        this.shooter = shooter;
        this.target = target;
        this.updateDirection();
    }

    private updateDirection(): void {
        const targetCenter = this.target.getCenter();
        const myCenter = { x: this.position.x + this.width / 2, y: this.position.y + this.height / 2 };

        const dx = targetCenter.x - myCenter.x;
        const dy = targetCenter.y - myCenter.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
            this.velocity.x = (dx / distance) * this.speed;
            this.velocity.y = (dy / distance) * this.speed;
        }
    }

    public update(deltaTime: number): void {
        this.age += deltaTime;
        if (this.age >= this.lifetime) {
            this.isExpired = true;
            return;
        }

        // Homing behavior: Update direction towards target if alive
        if (this.target.getIsAlive()) {
            this.updateDirection();
        }

        this.trailPositions.push({ x: this.position.x, y: this.position.y });
        if (this.trailPositions.length > 10) {
            this.trailPositions.shift();
        }

        super.update(deltaTime);
    }

    public draw(ctx: CanvasRenderingContext2D): void {
        if (this.isExpired) return;

        ctx.save();

        // Trail
        for (let i = 0; i < this.trailPositions.length; i++) {
            const pos = this.trailPositions[i];
            const alpha = (i / this.trailPositions.length) * 0.5;
            const size = (i / this.trailPositions.length) * this.width;

            ctx.globalAlpha = alpha;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(pos.x + this.width / 2, pos.y + this.height / 2, size / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Projectile core
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.position.x + this.width / 2, this.position.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
        ctx.fill();

        // Glow ring
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.position.x + this.width / 2, this.position.y + this.height / 2, this.width / 2 + 2, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }

    public getIsExpired(): boolean { return this.isExpired; }
    public getDamage(): number { return this.damage; }
    public getShooter(): Player { return this.shooter; }
    public getTarget(): Player { return this.target; }
    public expire(): void { this.isExpired = true; }
}
