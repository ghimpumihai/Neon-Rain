import type { InputState } from './InputHandler';

const JOYSTICK_DEAD_ZONE = 0.22;

const NEUTRAL_INPUT_STATE: InputState = {
    left: false,
    right: false,
    up: false,
    down: false,
    dash: false,
    deployBomb: false,
};

export class MobileControls {
    private readonly overlay: HTMLDivElement;
    private readonly joystickBase: HTMLDivElement;
    private readonly joystickKnob: HTMLDivElement;
    private readonly boostButton: HTMLButtonElement;

    private joystickPointerId: number | null = null;
    private boostPointerId: number | null = null;

    private readonly state: InputState = { ...NEUTRAL_INPUT_STATE };

    constructor() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'mobile-controls-overlay';

        this.joystickBase = document.createElement('div');
        this.joystickBase.className = 'mobile-joystick-base';

        this.joystickKnob = document.createElement('div');
        this.joystickKnob.className = 'mobile-joystick-knob';

        this.boostButton = document.createElement('button');
        this.boostButton.className = 'mobile-boost-button';
        this.boostButton.type = 'button';
        this.boostButton.textContent = 'BOOST';

        this.joystickBase.appendChild(this.joystickKnob);
        this.overlay.appendChild(this.joystickBase);
        this.overlay.appendChild(this.boostButton);

        this.bindEvents();
    }

    public attach(container: HTMLElement): void {
        if (!this.overlay.isConnected) {
            container.appendChild(this.overlay);
        }
    }

    public detach(): void {
        this.reset();
        this.overlay.remove();
    }

    public setVisible(visible: boolean): void {
        this.overlay.style.display = visible ? 'block' : 'none';
        if (!visible) {
            this.reset();
        }
    }

    public reset(): void {
        this.state.left = false;
        this.state.right = false;
        this.state.up = false;
        this.state.down = false;
        this.state.dash = false;
        this.state.deployBomb = false;

        this.joystickPointerId = null;
        this.boostPointerId = null;
        this.joystickKnob.style.transform = 'translate(0px, 0px)';
    }

    public getState(): InputState {
        return {
            left: this.state.left,
            right: this.state.right,
            up: this.state.up,
            down: this.state.down,
            dash: this.state.dash,
            deployBomb: this.state.deployBomb,
        };
    }

    private bindEvents(): void {
        this.joystickBase.addEventListener('pointerdown', (event) => {
            if (this.joystickPointerId !== null) {
                return;
            }

            this.joystickPointerId = event.pointerId;
            this.joystickBase.setPointerCapture(event.pointerId);
            this.updateJoystick(event.clientX, event.clientY);
            event.preventDefault();
        });

        this.joystickBase.addEventListener('pointermove', (event) => {
            if (event.pointerId !== this.joystickPointerId) {
                return;
            }

            this.updateJoystick(event.clientX, event.clientY);
            event.preventDefault();
        });

        const releaseJoystick = (event: PointerEvent): void => {
            if (event.pointerId !== this.joystickPointerId) {
                return;
            }

            this.joystickPointerId = null;
            this.resetJoystickAxes();
            this.joystickKnob.style.transform = 'translate(0px, 0px)';

            if (this.joystickBase.hasPointerCapture(event.pointerId)) {
                this.joystickBase.releasePointerCapture(event.pointerId);
            }

            event.preventDefault();
        };

        this.joystickBase.addEventListener('pointerup', releaseJoystick);
        this.joystickBase.addEventListener('pointercancel', releaseJoystick);

        this.boostButton.addEventListener('pointerdown', (event) => {
            if (this.boostPointerId !== null) {
                return;
            }

            this.boostPointerId = event.pointerId;
            this.boostButton.setPointerCapture(event.pointerId);
            this.state.dash = true;
            event.preventDefault();
        });

        const releaseBoost = (event: PointerEvent): void => {
            if (event.pointerId !== this.boostPointerId) {
                return;
            }

            this.boostPointerId = null;
            this.state.dash = false;

            if (this.boostButton.hasPointerCapture(event.pointerId)) {
                this.boostButton.releasePointerCapture(event.pointerId);
            }

            event.preventDefault();
        };

        this.boostButton.addEventListener('pointerup', releaseBoost);
        this.boostButton.addEventListener('pointercancel', releaseBoost);
    }

    private updateJoystick(clientX: number, clientY: number): void {
        const rect = this.joystickBase.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const radius = Math.min(rect.width, rect.height) * 0.36;

        const deltaX = clientX - centerX;
        const deltaY = clientY - centerY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        const clampRatio = distance > radius ? radius / distance : 1;
        const clampedX = deltaX * clampRatio;
        const clampedY = deltaY * clampRatio;

        this.joystickKnob.style.transform = `translate(${clampedX}px, ${clampedY}px)`;

        const normalizedX = clampedX / radius;
        const normalizedY = clampedY / radius;

        this.state.left = normalizedX < -JOYSTICK_DEAD_ZONE;
        this.state.right = normalizedX > JOYSTICK_DEAD_ZONE;
        this.state.up = normalizedY < -JOYSTICK_DEAD_ZONE;
        this.state.down = normalizedY > JOYSTICK_DEAD_ZONE;
    }

    private resetJoystickAxes(): void {
        this.state.left = false;
        this.state.right = false;
        this.state.up = false;
        this.state.down = false;
    }
}
