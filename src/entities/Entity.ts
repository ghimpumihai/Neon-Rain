import { Vector2, GameObject } from '../core/interfaces';

/**
 * Base Entity class for all game objects
 * Handles basic position and velocity math
 */
export abstract class Entity implements GameObject {
    public position: Vector2;
    public velocity: Vector2;
    public width: number;
    public height: number;
    protected color: string;

    constructor(
        x: number,
        y: number,
        width: number,
        height: number,
        color: string = '#ffffff'
    ) {
        this.position = { x, y };
        this.velocity = { x: 0, y: 0 };
        this.width = width;
        this.height = height;
        this.color = color;
    }

    /**
     * Update the entity's position based on velocity and delta time
     */
    public update(deltaTime: number): void {
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
    }

    /**
     * Draw the entity - to be implemented by subclasses
     */
    public abstract draw(ctx: CanvasRenderingContext2D): void;

    /**
     * Get the bounding box for collision detection
     */
    public getBounds(): { x: number; y: number; width: number; height: number } {
        return {
            x: this.position.x,
            y: this.position.y,
            width: this.width,
            height: this.height,
        };
    }
}
