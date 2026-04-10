import './style.css';
import { Game } from './core/Game';
import { GameState } from './core/GameState';
import type { CubeHatType, CubeModelType } from './core/interfaces';
import {
    CUBE_HATS,
    CUBE_MODELS,
    CUSTOMIZATION_STORAGE_KEYS,
    DEFAULT_PLAYER_CUSTOMIZATION,
    NEON_COLORS,
    type CubeHatOption,
    type CubeModelOption,
    type NeonColorOption,
    type PlayerSlot,
} from './constants/customization';
import {
    DEFAULT_BACKGROUND_COLOR,
    DEFAULT_CANVAS_HEIGHT,
    DEFAULT_CANVAS_WIDTH,
} from './constants/gameplay';

/**
 * Neon Rain - Main Entry Point
 * A 2D infinite dodger game with neon visuals
 */

function isValidColorName(name: string): boolean {
    return NEON_COLORS.some(color => color.name === name);
}

function isValidModelId(modelId: string): modelId is CubeModelType {
    return CUBE_MODELS.some(model => model.id === modelId);
}

function isValidHatId(hatId: string): hatId is CubeHatType {
    return CUBE_HATS.some(hat => hat.id === hatId);
}

function loadPersistedColor(player: PlayerSlot, fallback: string): string {
    try {
        const key = player === 'p1' ? CUSTOMIZATION_STORAGE_KEYS.p1Color : CUSTOMIZATION_STORAGE_KEYS.p2Color;
        const stored = window.localStorage.getItem(key);
        if (stored && isValidColorName(stored)) {
            return stored;
        }
    } catch {
        // Ignore storage failures and keep defaults.
    }

    return fallback;
}

function loadPersistedModel(player: PlayerSlot, fallback: CubeModelType): CubeModelType {
    try {
        const key = player === 'p1' ? CUSTOMIZATION_STORAGE_KEYS.p1Model : CUSTOMIZATION_STORAGE_KEYS.p2Model;
        const stored = window.localStorage.getItem(key);
        if (stored && isValidModelId(stored)) {
            return stored;
        }
    } catch {
        // Ignore storage failures and keep defaults.
    }

    return fallback;
}

function loadPersistedHat(player: PlayerSlot, fallback: CubeHatType): CubeHatType {
    try {
        const key = player === 'p1' ? CUSTOMIZATION_STORAGE_KEYS.p1Hat : CUSTOMIZATION_STORAGE_KEYS.p2Hat;
        const stored = window.localStorage.getItem(key);
        if (stored && isValidHatId(stored)) {
            return stored;
        }
    } catch {
        // Ignore storage failures and keep defaults.
    }

    return fallback;
}

function persistCustomizationSelections(): void {
    try {
        window.localStorage.setItem(CUSTOMIZATION_STORAGE_KEYS.p1Color, selectedColorByPlayer.p1);
        window.localStorage.setItem(CUSTOMIZATION_STORAGE_KEYS.p2Color, selectedColorByPlayer.p2);
        window.localStorage.setItem(CUSTOMIZATION_STORAGE_KEYS.p1Model, selectedModelByPlayer.p1);
        window.localStorage.setItem(CUSTOMIZATION_STORAGE_KEYS.p2Model, selectedModelByPlayer.p2);
        window.localStorage.setItem(CUSTOMIZATION_STORAGE_KEYS.p1Hat, selectedHatByPlayer.p1);
        window.localStorage.setItem(CUSTOMIZATION_STORAGE_KEYS.p2Hat, selectedHatByPlayer.p2);
    } catch {
        // Ignore storage failures and continue gameplay.
    }
}

const selectedColorByPlayer = {
    p1: loadPersistedColor('p1', DEFAULT_PLAYER_CUSTOMIZATION.p1.color),
    p2: loadPersistedColor('p2', DEFAULT_PLAYER_CUSTOMIZATION.p2.color),
};

const selectedModelByPlayer: Record<PlayerSlot, CubeModelType> = {
    p1: loadPersistedModel('p1', DEFAULT_PLAYER_CUSTOMIZATION.p1.model),
    p2: loadPersistedModel('p2', DEFAULT_PLAYER_CUSTOMIZATION.p2.model),
};

const selectedHatByPlayer: Record<PlayerSlot, CubeHatType> = {
    p1: loadPersistedHat('p1', DEFAULT_PLAYER_CUSTOMIZATION.p1.hat),
    p2: loadPersistedHat('p2', DEFAULT_PLAYER_CUSTOMIZATION.p2.hat),
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

function getSelectedColor(player: PlayerSlot): NeonColorOption {
    const selected = NEON_COLORS.find(c => c.name === selectedColorByPlayer[player]);
    return selected ?? NEON_COLORS[0];
}

function getSelectedModel(player: PlayerSlot): CubeModelOption {
    const selected = CUBE_MODELS.find(model => model.id === selectedModelByPlayer[player]);
    return selected ?? CUBE_MODELS[0];
}

function getSelectedHat(player: PlayerSlot): CubeHatOption {
    const selected = CUBE_HATS.find(hat => hat.id === selectedHatByPlayer[player]);
    return selected ?? CUBE_HATS[0];
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
                    <small>color: ${getSelectedColor('p1').name}</small>
                    <small>model: ${getSelectedModel('p1').name}</small>
                    <small>hat: ${getSelectedHat('p1').name}</small>
                </div>
                <div class="cube-preview">
                    <span>P2</span>
                    <div class="cube-swatch" style="background:${getSelectedColor('p2').value}"></div>
                    <small>color: ${getSelectedColor('p2').name}</small>
                    <small>model: ${getSelectedModel('p2').name}</small>
                    <small>hat: ${getSelectedHat('p2').name}</small>
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

function createPlayerCustomizationSection(player: PlayerSlot, title: string): string {
    const selectedColorName = selectedColorByPlayer[player];
    const selectedModel = selectedModelByPlayer[player];
    const selectedHat = selectedHatByPlayer[player];

    const colorButtons = NEON_COLORS.map(color => {
        const isActive = color.name === selectedColorName;
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

    const modelButtons = CUBE_MODELS.map(model => {
        const isActive = model.id === selectedModel;
        return `
            <button
                class="variant-option ${isActive ? 'active' : ''}"
                data-player="${player}"
                data-kind="model"
                data-value="${model.id}"
                title="${model.name}"
                aria-label="${title} model ${model.name}"
            >
                <span class="variant-preview">${model.preview}</span>
                <span class="variant-name">${model.name}</span>
            </button>
        `;
    }).join('');

    const hatButtons = CUBE_HATS.map(hat => {
        const isActive = hat.id === selectedHat;
        return `
            <button
                class="variant-option ${isActive ? 'active' : ''}"
                data-player="${player}"
                data-kind="hat"
                data-value="${hat.id}"
                title="${hat.name}"
                aria-label="${title} hat ${hat.name}"
            >
                <span class="variant-preview">${hat.preview}</span>
                <span class="variant-name">${hat.name}</span>
            </button>
        `;
    }).join('');

    return `
        <section class="customize-section player-customize-card">
            <h3>${title}</h3>

            <div class="customize-group">
                <h4>Color</h4>
                <div class="color-grid">${colorButtons}</div>
            </div>

            <div class="customize-group">
                <h4>Inner Model</h4>
                <div class="variant-grid">${modelButtons}</div>
            </div>

            <div class="customize-group">
                <h4>Hat</h4>
                <div class="variant-grid">${hatButtons}</div>
            </div>
        </section>
    `;
}

function showCustomizeMenu(): void {
    menuOverlay.innerHTML = `
        <div class="menu-panel customize-panel">
            <h2 class="menu-title">Customize Cubes</h2>
            <p class="menu-subtitle">Choose a color, inner model, and hat for each player</p>

            ${createPlayerCustomizationSection('p1', 'Player 1')}
            ${createPlayerCustomizationSection('p2', 'Player 2')}

            <div class="menu-actions">
                <button id="backToMenuBtn" class="menu-btn secondary">Back</button>
            </div>
        </div>
    `;

    const backToMenuBtn = document.getElementById('backToMenuBtn');
    backToMenuBtn?.addEventListener('click', showStartMenu);

    document.querySelectorAll<HTMLButtonElement>('.color-option').forEach(button => {
        button.addEventListener('click', () => {
            const player = button.dataset.player as PlayerSlot | undefined;
            const color = button.dataset.color;

            if (!player || !color || !isValidColorName(color)) return;

            selectedColorByPlayer[player] = color;
            persistCustomizationSelections();
            showCustomizeMenu();
        });
    });

    document.querySelectorAll<HTMLButtonElement>('.variant-option').forEach(button => {
        button.addEventListener('click', () => {
            const player = button.dataset.player as PlayerSlot | undefined;
            const kind = button.dataset.kind as 'model' | 'hat' | undefined;
            const value = button.dataset.value;

            if (!player || !kind || !value) return;

            if (kind === 'model' && isValidModelId(value)) {
                selectedModelByPlayer[player] = value;
            }

            if (kind === 'hat' && isValidHatId(value)) {
                selectedHatByPlayer[player] = value;
            }

            persistCustomizationSelections();
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
        canvasWidth: DEFAULT_CANVAS_WIDTH,
        canvasHeight: DEFAULT_CANVAS_HEIGHT,
        backgroundColor: DEFAULT_BACKGROUND_COLOR,
        player1Color: getSelectedColor('p1').value,
        player2Color: getSelectedColor('p2').value,
        player1Model: selectedModelByPlayer.p1,
        player2Model: selectedModelByPlayer.p2,
        player1Hat: selectedHatByPlayer.p1,
        player2Hat: selectedHatByPlayer.p2,
    });

    game.start();

    (window as unknown as { game: Game }).game = game;

    console.log('Welcome to Neon Rain!');
    console.log('Tip: Access the game instance via window.game in the console');
}

window.addEventListener('keydown', handleMainMenuReturnInput);

showStartMenu();
