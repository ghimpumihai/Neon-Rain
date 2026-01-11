/**
 * Key bindings configuration for a player
 */
export interface KeyBindings {
    left: string[];
    right: string[];
    up: string[];
    down: string[];
    dash: string[];
}

/**
 * Preset key bindings for Player 1 (WASD + Shift)
 */
export const PLAYER_1_KEYS: KeyBindings = {
    left: ['KeyA'],
    right: ['KeyD'],
    up: ['KeyW'],
    down: ['KeyS'],
    dash: ['ShiftLeft', 'ShiftRight'],
};

/**
 * Preset key bindings for Player 2 (Arrow Keys + Space)
 */
export const PLAYER_2_KEYS: KeyBindings = {
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    up: ['ArrowUp'],
    down: ['ArrowDown'],
    dash: ['Space'],
};

/**
 * Default key bindings
 */
export const DEFAULT_KEYS: KeyBindings = {
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    up: ['KeyW', 'ArrowUp'],
    down: ['KeyS', 'ArrowDown'],
    dash: ['Space', 'ShiftLeft', 'ShiftRight'],
};

/**
 * Represents the state of all input keys
 */
export interface InputState {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    dash: boolean;
}

/**
 * InputHandler class
 */
export class InputHandler {
    private keys: InputState;
    private keyBindings: KeyBindings;
    private playerLabel: string;

    constructor(keyBindings: KeyBindings = DEFAULT_KEYS, playerLabel: string = 'Player') {
        this.keyBindings = keyBindings;
        this.playerLabel = playerLabel;

        this.keys = {
            left: false,
            right: false,
            up: false,
            down: false,
            dash: false,
        };

        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));

        console.log(`🎮 InputHandler initialized for ${playerLabel}`);
    }

    private handleKeyDown(event: KeyboardEvent): void {
        this.updateKey(event.code, true);
    }

    private handleKeyUp(event: KeyboardEvent): void {
        this.updateKey(event.code, false);
    }

    private updateKey(code: string, isPressed: boolean): void {
        if (this.keyBindings.left.includes(code)) this.keys.left = isPressed;
        if (this.keyBindings.right.includes(code)) this.keys.right = isPressed;
        if (this.keyBindings.up.includes(code)) this.keys.up = isPressed;
        if (this.keyBindings.down.includes(code)) this.keys.down = isPressed;
        if (this.keyBindings.dash.includes(code)) this.keys.dash = isPressed;
    }

    public getState(): InputState { return { ...this.keys }; }
    public isLeft(): boolean { return this.keys.left; }
    public isRight(): boolean { return this.keys.right; }
    public isUp(): boolean { return this.keys.up; }
    public isDown(): boolean { return this.keys.down; }
    public isDashing(): boolean { return this.keys.dash; }

    public getHorizontalAxis(): number {
        let axis = 0;
        if (this.keys.left) axis -= 1;
        if (this.keys.right) axis += 1;
        return axis;
    }

    public getVerticalAxis(): number {
        let axis = 0;
        if (this.keys.up) axis -= 1;
        if (this.keys.down) axis += 1;
        return axis;
    }

    public getPlayerLabel(): string { return this.playerLabel; }
}
