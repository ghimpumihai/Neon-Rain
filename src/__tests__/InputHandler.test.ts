import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InputHandler } from '../systems/InputHandler';

describe('Phase 2: InputHandler', () => {
    let inputHandler: InputHandler;

    beforeEach(() => {
        inputHandler = new InputHandler();
    });

    describe('Initialization', () => {
        it('should create an InputHandler instance', () => {
            expect(inputHandler).toBeInstanceOf(InputHandler);
        });

        it('should start with all keys released', () => {
            const state = inputHandler.getState();

            expect(state.left).toBe(false);
            expect(state.right).toBe(false);
            expect(state.up).toBe(false);
            expect(state.down).toBe(false);
            expect(state.dash).toBe(false);
        });
    });

    describe('Key Handling', () => {
        it('should detect A key as left', () => {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
            expect(inputHandler.isLeft()).toBe(true);

            window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));
            expect(inputHandler.isLeft()).toBe(false);
        });

        it('should detect ArrowLeft as left', () => {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }));
            expect(inputHandler.isLeft()).toBe(true);
        });

        it('should detect D key as right', () => {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
            expect(inputHandler.isRight()).toBe(true);
        });

        it('should detect ArrowRight as right', () => {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
            expect(inputHandler.isRight()).toBe(true);
        });

        it('should detect W key as up', () => {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
            expect(inputHandler.isUp()).toBe(true);
        });

        it('should detect ArrowUp as up', () => {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }));
            expect(inputHandler.isUp()).toBe(true);
        });

        it('should detect S key as down', () => {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));
            expect(inputHandler.isDown()).toBe(true);
        });

        it('should detect ArrowDown as down', () => {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown' }));
            expect(inputHandler.isDown()).toBe(true);
        });

        it('should detect Space as dash', () => {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
            expect(inputHandler.isDashing()).toBe(true);
        });

        it('should detect ShiftLeft as dash', () => {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' }));
            expect(inputHandler.isDashing()).toBe(true);
        });

        it('should detect ShiftRight as dash', () => {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftRight' }));
            expect(inputHandler.isDashing()).toBe(true);
        });
    });

    describe('Axis Methods', () => {
        it('should return -1 for horizontal axis when left is pressed', () => {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
            expect(inputHandler.getHorizontalAxis()).toBe(-1);
        });

        it('should return 1 for horizontal axis when right is pressed', () => {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
            expect(inputHandler.getHorizontalAxis()).toBe(1);
        });

        it('should return 0 for horizontal axis when both left and right are pressed', () => {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
            expect(inputHandler.getHorizontalAxis()).toBe(0);
        });

        it('should return -1 for vertical axis when up is pressed', () => {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
            expect(inputHandler.getVerticalAxis()).toBe(-1);
        });

        it('should return 1 for vertical axis when down is pressed', () => {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));
            expect(inputHandler.getVerticalAxis()).toBe(1);
        });

        it('should return 0 for vertical axis when both up and down are pressed', () => {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));
            expect(inputHandler.getVerticalAxis()).toBe(0);
        });
    });
});
