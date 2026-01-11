import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Game } from '../core/Game';

// Mock DOM elements
const mockCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({
        fillStyle: '',
        font: '',
        fillRect: vi.fn(),
        fillText: vi.fn(),
    })),
};

// Mock document.getElementById
vi.stubGlobal('document', {
    getElementById: vi.fn((id: string) => {
        if (id === 'gameCanvas') {
            return mockCanvas;
        }
        return null;
    }),
});

// Mock performance.now
let mockTime = 0;
vi.stubGlobal('performance', {
    now: vi.fn(() => mockTime),
});

// Mock requestAnimationFrame
vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    // Simulate one frame
    mockTime += 16.67; // ~60fps
    setTimeout(() => callback(mockTime), 0);
    return 1;
}));

describe('Phase 1: The Skeleton', () => {
    beforeEach(() => {
        mockTime = 0;
        vi.clearAllMocks();
    });

    describe('Game Class Initialization', () => {
        it('should create a Game instance with default config', () => {
            const game = new Game('gameCanvas');

            expect(game).toBeInstanceOf(Game);
            expect(game.getConfig().canvasWidth).toBe(800);
            expect(game.getConfig().canvasHeight).toBe(600);
            expect(game.getConfig().backgroundColor).toBe('#111');
        });

        it('should apply custom configuration', () => {
            const game = new Game('gameCanvas', {
                canvasWidth: 1024,
                canvasHeight: 768,
                backgroundColor: '#222',
            });

            expect(game.getConfig().canvasWidth).toBe(1024);
            expect(game.getConfig().canvasHeight).toBe(768);
            expect(game.getConfig().backgroundColor).toBe('#222');
        });

        it('should throw error if canvas element not found', () => {
            expect(() => new Game('nonexistent')).toThrow('Canvas element with id "nonexistent" not found');
        });

        it('should set canvas dimensions correctly', () => {
            new Game('gameCanvas', { canvasWidth: 800, canvasHeight: 600 });

            expect(mockCanvas.width).toBe(800);
            expect(mockCanvas.height).toBe(600);
        });
    });

    describe('Game Loop', () => {
        it('should start the game loop', () => {
            const game = new Game('gameCanvas');

            expect(game.getIsRunning()).toBe(false);

            game.start();

            expect(game.getIsRunning()).toBe(true);
            expect(requestAnimationFrame).toHaveBeenCalled();
        });

        it('should stop the game loop', () => {
            const game = new Game('gameCanvas');

            game.start();
            expect(game.getIsRunning()).toBe(true);

            game.stop();
            expect(game.getIsRunning()).toBe(false);
        });

        it('should not start twice if already running', () => {
            const consoleSpy = vi.spyOn(console, 'warn');
            const game = new Game('gameCanvas');

            game.start();
            game.start();

            expect(consoleSpy).toHaveBeenCalledWith('Game is already running');
        });
    });

    describe('Background Color', () => {
        it('should have dark background color (#111)', () => {
            const game = new Game('gameCanvas');

            expect(game.getConfig().backgroundColor).toBe('#111');
        });
    });

    describe('Canvas Context', () => {
        it('should get 2D context from canvas', () => {
            const game = new Game('gameCanvas');

            expect(mockCanvas.getContext).toHaveBeenCalledWith('2d');
            expect(game.getContext()).toBeDefined();
        });
    });
});
