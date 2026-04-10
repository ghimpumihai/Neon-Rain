import './style.css';
import { Game } from './core/Game';
import { GameState } from './core/GameState';

/**
 * Neon Rain - Main Entry Point
 * A 2D infinite dodger game with neon visuals
 */

interface NeonColorOption {
    name: string;
    value: string;
}

const NEON_COLORS: NeonColorOption[] = [
    { name: 'red', value: '#ff1744' },
    { name: 'orange', value: '#ff9100' },
    { name: 'yellow', value: '#ffee00' },
    { name: 'green', value: '#39ff14' },
    { name: 'blue', value: '#00b7ff' },
    { name: 'purple', value: '#b026ff' },
    { name: 'pink', value: '#ff4fd8' },
    { name: 'grey', value: '#98a2b3' },
    { name: 'brown', value: '#b06a3c' },
];

const COLOR_STORAGE_KEYS = {
    p1: 'neon-rain.player1-color',
    p2: 'neon-rain.player2-color',
} as const;

function isValidColorName(name: string): boolean {
    return NEON_COLORS.some(color => color.name === name);
}

function loadPersistedColor(player: 'p1' | 'p2', fallback: string): string {
    try {
        const stored = window.localStorage.getItem(COLOR_STORAGE_KEYS[player]);
        if (stored && isValidColorName(stored)) {
            return stored;
        }
    } catch {
        // Ignore storage failures and keep defaults.
    }

    return fallback;
}

function persistSelectedColors(colors: { p1: string; p2: string }): void {
    try {
        window.localStorage.setItem(COLOR_STORAGE_KEYS.p1, colors.p1);
        window.localStorage.setItem(COLOR_STORAGE_KEYS.p2, colors.p2);
    } catch {
        // Ignore storage failures and continue gameplay.
    }
}

const selectedColorByPlayer = {
    p1: loadPersistedColor('p1', 'blue'),
    p2: loadPersistedColor('p2', 'red'),
};

let game: Game | null = null;

const appElement = document.getElementById('app');
const canvasElement = document.getElementById('gameCanvas');

if (!(appElement instanceof HTMLElement) || !(canvasElement instanceof HTMLCanvasElement)) {
    throw new Error('Missing required app elements');
}

const app = appElement;
const canvas = canvasElement;

canvas.style.display = 'none';

const menuOverlay = document.createElement('div');
menuOverlay.className = 'menu-overlay';
app.appendChild(menuOverlay);

function getSelectedColor(player: 'p1' | 'p2'): NeonColorOption {
    const selected = NEON_COLORS.find(c => c.name === selectedColorByPlayer[player]);
    return selected ?? NEON_COLORS[0];
}

function showStartMenu(): void {
    if (!menuOverlay.isConnected) {
        app.appendChild(menuOverlay);
    }

    menuOverlay.innerHTML = `
        <div class="menu-panel">
            <h1 class="menu-title">Neon Rain</h1>
            <p class="menu-subtitle">Competitive PvP survival</p>

            <div class="menu-preview-row">
                <div class="cube-preview">
                    <span>P1</span>
                    <div class="cube-swatch" style="background:${getSelectedColor('p1').value}"></div>
                    <small>${getSelectedColor('p1').name}</small>
                </div>
                <div class="cube-preview">
                    <span>P2</span>
                    <div class="cube-swatch" style="background:${getSelectedColor('p2').value}"></div>
                    <small>${getSelectedColor('p2').name}</small>
                </div>
            </div>

            <div class="menu-actions">
                <button id="startGameBtn" class="menu-btn primary">Start Game</button>
                <button id="openCustomizeBtn" class="menu-btn secondary">Customize</button>
            </div>
        </div>
    `;

    const startGameBtn = document.getElementById('startGameBtn');
    const openCustomizeBtn = document.getElementById('openCustomizeBtn');

    startGameBtn?.addEventListener('click', startGame);
    openCustomizeBtn?.addEventListener('click', showCustomizeMenu);
}

function createColorSection(player: 'p1' | 'p2', title: string): string {
    const selectedName = selectedColorByPlayer[player];

    const colorButtons = NEON_COLORS.map(color => {
        const isActive = color.name === selectedName;
        return `
            <button
                class="color-option ${isActive ? 'active' : ''}"
                data-player="${player}"
                data-color="${color.name}"
                title="${color.name}"
                aria-label="${title} color ${color.name}"
            >
                <span class="color-chip" style="background:${color.value}"></span>
                <span class="color-name">${color.name}</span>
            </button>
        `;
    }).join('');

    return `
        <section class="customize-section">
            <h3>${title}</h3>
            <div class="color-grid">${colorButtons}</div>
        </section>
    `;
}

function showCustomizeMenu(): void {
    menuOverlay.innerHTML = `
        <div class="menu-panel customize-panel">
            <h2 class="menu-title">Customize Cubes</h2>
            <p class="menu-subtitle">Choose from predefined neon colors</p>

            ${createColorSection('p1', 'Player 1')}
            ${createColorSection('p2', 'Player 2')}

            <div class="menu-actions">
                <button id="backToMenuBtn" class="menu-btn secondary">Back</button>
            </div>
        </div>
    `;

    const backToMenuBtn = document.getElementById('backToMenuBtn');
    backToMenuBtn?.addEventListener('click', showStartMenu);

    document.querySelectorAll<HTMLButtonElement>('.color-option').forEach(button => {
        button.addEventListener('click', () => {
            const player = button.dataset.player as 'p1' | 'p2' | undefined;
            const color = button.dataset.color;

            if (!player || !color) return;

            selectedColorByPlayer[player] = color;
            persistSelectedColors(selectedColorByPlayer);
            showCustomizeMenu();
        });
    });
}

function returnToMainMenu(): void {
    if (!game) return;

    game.stop();
    game = null;
    (window as unknown as { game?: Game }).game = undefined;

    canvas.style.display = 'none';
    showStartMenu();
}

function handleMainMenuReturnInput(event: KeyboardEvent): void {
    if (!game) return;
    if (event.code !== 'KeyM') return;
    if (game.getGameState() !== GameState.GAME_OVER) return;

    returnToMainMenu();
}

function startGame(): void {
    if (game) return;

    canvas.style.display = 'block';
    menuOverlay.remove();

    game = new Game('gameCanvas', {
        canvasWidth: 800,
        canvasHeight: 600,
        backgroundColor: '#111',
        player1Color: getSelectedColor('p1').value,
        player2Color: getSelectedColor('p2').value,
    });

    game.start();

    (window as unknown as { game: Game }).game = game;

    console.log('Welcome to Neon Rain!');
    console.log('Tip: Access the game instance via window.game in the console');
}

window.addEventListener('keydown', handleMainMenuReturnInput);

showStartMenu();
