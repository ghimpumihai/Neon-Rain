/**
 * Represents a 2D vector with x and y components
 */
export interface Vector2 {
    x: number;
    y: number;
}

/**
 * Interface for all game objects that can be updated and drawn
 */
export interface GameObject {
    position: Vector2;
    velocity: Vector2;
    width: number;
    height: number;
    draw(ctx: CanvasRenderingContext2D): void;
    update(deltaTime: number): void;
}

export type CubeModelType = 'core' | 'cross' | 'stripes' | 'target';
export type CubeHatType = 'none' | 'cap' | 'crown' | 'beanie';

/**
 * Configuration options for the game
 */
export interface GameConfig {
    canvasWidth: number;
    canvasHeight: number;
    backgroundColor: string;
    player1Color?: string;
    player2Color?: string;
    player1Model?: CubeModelType;
    player2Model?: CubeModelType;
    player1Hat?: CubeHatType;
    player2Hat?: CubeHatType;
}
