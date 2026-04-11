import './style.css';
import { Game } from './core/Game';
import { GameState } from './core/GameState';
import type { CubeHatType, CubeModelType } from './core/interfaces';
import { NetworkClient } from './multiplayer/NetworkClient';
import {
    MAX_ROOM_PLAYERS,
    createDefaultCustomization,
    type RoomSummary,
    type ServerToClientMessage,
} from './multiplayer/protocol';
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
import { InputHandler, type InputState, type KeyBindings } from './systems/InputHandler';
import { MobileControls } from './systems/MobileControls';

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

function isMobileDevice(): boolean {
    const coarsePointer = typeof window.matchMedia === 'function'
        ? window.matchMedia('(pointer: coarse)').matches
        : false;

    const touchPoints = typeof navigator.maxTouchPoints === 'number'
        ? navigator.maxTouchPoints
        : 0;

    const userAgent = navigator.userAgent.toLowerCase();
    const mobileUserAgent = /android|iphone|ipad|ipod|mobile/.test(userAgent);

    return coarsePointer || touchPoints > 0 || mobileUserAgent;
}

const FPS_LIMIT_OPTIONS = [0, 30, 60, 90, 120, 144] as const;
type FpsLimitOption = typeof FPS_LIMIT_OPTIONS[number];
const FPS_LIMIT_STORAGE_KEY = 'neon-rain.fps-limit';
const GRAPHICS_SETTINGS_STORAGE_KEY = 'neon-rain.graphics-settings-v1';

type GraphicsSettings = {
    particles: boolean;
    trails: boolean;
    mapGlow: boolean;
    fpsHud: boolean;
    reduceClientEffects: boolean;
};

const DEFAULT_GRAPHICS_SETTINGS: GraphicsSettings = {
    particles: true,
    trails: true,
    mapGlow: true,
    fpsHud: true,
    reduceClientEffects: true,
};

const MULTIPLAYER_SHARED_KEYS: KeyBindings = {
    left: ['KeyA'],
    right: ['KeyD'],
    up: ['KeyW'],
    down: ['KeyS'],
    dash: ['ShiftLeft'],
    deployBomb: ['KeyQ'],
};

function isValidFpsLimit(value: number): value is FpsLimitOption {
    return (FPS_LIMIT_OPTIONS as readonly number[]).includes(value);
}

function loadPersistedFpsLimit(fallback: FpsLimitOption = 0): FpsLimitOption {
    try {
        const stored = window.localStorage.getItem(FPS_LIMIT_STORAGE_KEY);
        if (!stored) {
            return fallback;
        }

        const parsed = Number(stored);
        if (Number.isFinite(parsed) && isValidFpsLimit(parsed)) {
            return parsed;
        }
    } catch {
        // Ignore storage failures and keep defaults.
    }

    return fallback;
}

function persistFpsLimitSelection(value: FpsLimitOption): void {
    try {
        window.localStorage.setItem(FPS_LIMIT_STORAGE_KEY, String(value));
    } catch {
        // Ignore storage failures and continue gameplay.
    }
}

function getFpsLimitLabel(limit: FpsLimitOption): string {
    return limit === 0 ? 'Display Refresh (Uncapped)' : `${limit} FPS`;
}

function loadPersistedGraphicsSettings(): GraphicsSettings {
    try {
        const raw = window.localStorage.getItem(GRAPHICS_SETTINGS_STORAGE_KEY);
        if (!raw) {
            return { ...DEFAULT_GRAPHICS_SETTINGS };
        }

        const parsed = JSON.parse(raw) as Partial<GraphicsSettings>;
        return {
            particles: typeof parsed.particles === 'boolean' ? parsed.particles : DEFAULT_GRAPHICS_SETTINGS.particles,
            trails: typeof parsed.trails === 'boolean' ? parsed.trails : DEFAULT_GRAPHICS_SETTINGS.trails,
            mapGlow: typeof parsed.mapGlow === 'boolean' ? parsed.mapGlow : DEFAULT_GRAPHICS_SETTINGS.mapGlow,
            fpsHud: typeof parsed.fpsHud === 'boolean' ? parsed.fpsHud : DEFAULT_GRAPHICS_SETTINGS.fpsHud,
            reduceClientEffects:
                typeof parsed.reduceClientEffects === 'boolean'
                    ? parsed.reduceClientEffects
                    : DEFAULT_GRAPHICS_SETTINGS.reduceClientEffects,
        };
    } catch {
        return { ...DEFAULT_GRAPHICS_SETTINGS };
    }
}

function persistGraphicsSettings(settings: GraphicsSettings): void {
    try {
        window.localStorage.setItem(GRAPHICS_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
        // Ignore storage failures and continue gameplay.
    }
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
let selectedFpsLimit: FpsLimitOption = loadPersistedFpsLimit();
let graphicsSettings: GraphicsSettings = loadPersistedGraphicsSettings();

let game: Game | null = null;
const networkClient = new NetworkClient();
let networkInitialized = false;
let multiplayerConnected = false;
let multiplayerSelfPlayerId: string | null = null;
let multiplayerRoom: RoomSummary | null = null;
let multiplayerStatus = 'Connect to create or join a room.';
let multiplayerDisplayName = `Player-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
let multiplayerJoinRoomCode = '';
const NEUTRAL_INPUT_STATE: InputState = {
    left: false,
    right: false,
    up: false,
    down: false,
    dash: false,
    deployBomb: false,
};
const multiplayerLocalInputHandler = new InputHandler(MULTIPLAYER_SHARED_KEYS, 'Net Local');
const multiplayerRemoteInputByPlayerId = new Map<string, InputState>();
let multiplayerMatchPlayerOrder: string[] = [];
let multiplayerLocalPlayerIndex: number | null = null;
let multiplayerInputSequence = 0;
let multiplayerInputSyncIntervalId: number | null = null;
let multiplayerSnapshotTick = 0;
let multiplayerSnapshotSyncIntervalId: number | null = null;
let multiplayerIsHost = false;
let multiplayerMatchStartPending = false;

const appElement = document.getElementById('app');
const canvasElement = document.getElementById('gameCanvas');

if (!(appElement instanceof HTMLElement) || !(canvasElement instanceof HTMLCanvasElement)) {
    throw new Error('Missing required app elements');
}

const app = appElement;
const canvas = canvasElement;
const mobileControls = isMobileDevice() ? new MobileControls() : null;

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

function getLobbyCustomization(): ReturnType<typeof createDefaultCustomization> {
    return {
        color: getSelectedColor('p1').value,
        model: selectedModelByPlayer.p1,
        hat: selectedHatByPlayer.p1,
    };
}

function getSelfRoomPlayer(): RoomSummary['players'][number] | undefined {
    if (!multiplayerRoom || !multiplayerSelfPlayerId) {
        return undefined;
    }

    return multiplayerRoom.players.find(player => player.playerId === multiplayerSelfPlayerId);
}

function cloneInputState(inputState: InputState): InputState {
    return {
        left: inputState.left,
        right: inputState.right,
        up: inputState.up,
        down: inputState.down,
        dash: inputState.dash,
        deployBomb: inputState.deployBomb,
    };
}

function stopMultiplayerInputSync(): void {
    if (multiplayerInputSyncIntervalId !== null) {
        window.clearInterval(multiplayerInputSyncIntervalId);
        multiplayerInputSyncIntervalId = null;
    }

    if (multiplayerSnapshotSyncIntervalId !== null) {
        window.clearInterval(multiplayerSnapshotSyncIntervalId);
        multiplayerSnapshotSyncIntervalId = null;
    }

    multiplayerRemoteInputByPlayerId.clear();
    multiplayerMatchPlayerOrder = [];
    multiplayerLocalPlayerIndex = null;
    multiplayerInputSequence = 0;
    multiplayerSnapshotTick = 0;
    multiplayerIsHost = false;
    multiplayerMatchStartPending = false;

    mobileControls?.reset();

    if (game) {
        game.setNetworkSyncContext({ role: 'local' });
        game.setPlayerInputResolver(undefined);
    }
}

function startMatchTransportLoops(): void {
    if (multiplayerInputSyncIntervalId !== null) {
        window.clearInterval(multiplayerInputSyncIntervalId);
        multiplayerInputSyncIntervalId = null;
    }

    if (multiplayerSnapshotSyncIntervalId !== null) {
        window.clearInterval(multiplayerSnapshotSyncIntervalId);
        multiplayerSnapshotSyncIntervalId = null;
    }

    if (!game) {
        return;
    }

    if (multiplayerIsHost) {
        multiplayerSnapshotSyncIntervalId = window.setInterval(() => {
            if (!game) {
                return;
            }

            const snapshot = game.serializeSnapshot(multiplayerMatchPlayerOrder);
            const sent = networkClient.sendSnapshot(multiplayerSnapshotTick, snapshot);
            if (sent) {
                multiplayerSnapshotTick++;
            }
        }, 66);

        return;
    }

    multiplayerInputSyncIntervalId = window.setInterval(() => {
        if (multiplayerLocalPlayerIndex === null) {
            return;
        }

        const localInput = getLocalControlInputState();

        const sent = networkClient.sendInputFrame(multiplayerInputSequence, localInput);
        if (sent) {
            multiplayerInputSequence++;
        }
    }, 50);
}

function refreshHostRoleForActiveMatch(): void {
    if (!multiplayerRoom || !multiplayerSelfPlayerId) {
        return;
    }

    multiplayerIsHost = multiplayerRoom.hostPlayerId === multiplayerSelfPlayerId;

    if (!game || multiplayerMatchPlayerOrder.length === 0) {
        return;
    }

    game.setNetworkSyncContext({
        role: multiplayerIsHost ? 'host' : 'client',
        playerOrder: multiplayerMatchPlayerOrder,
        localPlayerId: multiplayerSelfPlayerId,
    });

    startMatchTransportLoops();
}

function startMultiplayerMatchFromRoom(roomOverride?: RoomSummary): boolean {
    const activeRoom = roomOverride ?? multiplayerRoom;
    if (!activeRoom || !multiplayerSelfPlayerId) {
        multiplayerStatus = 'Cannot start multiplayer match without room context.';
        rerenderMultiplayerIfVisible();
        return false;
    }

    multiplayerRoom = activeRoom;

    const activePlayers = activeRoom.players;
    if (activePlayers.length < 2) {
        multiplayerStatus = 'Need at least 2 players in room to sync match inputs.';
        rerenderMultiplayerIfVisible();
        return false;
    }

    const playerOrder = activePlayers.map(player => player.playerId);
    const localPlayerIndex = playerOrder.findIndex(playerId => playerId === multiplayerSelfPlayerId);

    if (localPlayerIndex < 0) {
        multiplayerStatus = 'Syncing room roster before match start...';
        rerenderMultiplayerIfVisible();
        return false;
    }

    stopMultiplayerInputSync();

    multiplayerMatchPlayerOrder = playerOrder;
    multiplayerLocalPlayerIndex = localPlayerIndex;
    multiplayerInputSequence = 0;
    multiplayerSnapshotTick = 0;
    multiplayerIsHost = activeRoom.hostPlayerId === multiplayerSelfPlayerId;

    if (game) {
        returnToMainMenu();
    }

    startGame({
        multiplayerSlots: activePlayers.map((player) => ({
            color: player.customization.color,
            model: player.customization.model,
            hat: player.customization.hat,
            label: player.displayName,
        })),
        multiplayerRole: multiplayerIsHost ? 'host' : 'client',
    });
    if (!game) {
        multiplayerStatus = 'Failed to initialize game instance for multiplayer input sync.';
        rerenderMultiplayerIfVisible();
        return false;
    }

    game.setNetworkSyncContext({
        role: multiplayerIsHost ? 'host' : 'client',
        playerOrder: multiplayerMatchPlayerOrder,
        localPlayerId: multiplayerSelfPlayerId,
    });

    game.setPlayerInputResolver((_player, playerIndex) => {
        const mappedPlayerId = multiplayerMatchPlayerOrder[playerIndex];
        if (!mappedPlayerId) {
            return NEUTRAL_INPUT_STATE;
        }

        if (mappedPlayerId === multiplayerSelfPlayerId) {
            return getLocalControlInputState();
        }

        return multiplayerRemoteInputByPlayerId.get(mappedPlayerId) ?? NEUTRAL_INPUT_STATE;
    });

    startMatchTransportLoops();

    multiplayerStatus = multiplayerIsHost
        ? 'You are host: authoritative snapshots broadcasting.'
        : `Client sync active in slot ${multiplayerLocalPlayerIndex + 1}.`;

    multiplayerMatchStartPending = false;
    return true;
}

function rerenderMultiplayerIfVisible(): void {
    if (!menuOverlay.isConnected) {
        return;
    }

    if (menuOverlay.querySelector('.multiplayer-panel')) {
        showMultiplayerMenu();
    }
}

function handleMultiplayerMessage(message: ServerToClientMessage): void {
    switch (message.type) {
        case 'connected':
            multiplayerSelfPlayerId = message.playerId;
            multiplayerStatus = 'Connected. Create a room or join with a code.';
            break;
        case 'room_joined':
            multiplayerSelfPlayerId = message.playerId;
            multiplayerRoom = message.room;
            stopMultiplayerInputSync();
            multiplayerMatchStartPending = false;
            multiplayerStatus = `Joined room ${message.room.code}.`;
            break;
        case 'room_updated':
            multiplayerRoom = message.room;
            refreshHostRoleForActiveMatch();

            if (multiplayerMatchStartPending && message.room.started) {
                startMultiplayerMatchFromRoom(message.room);
            }
            break;
        case 'player_left':
            multiplayerRemoteInputByPlayerId.delete(message.playerId);
            multiplayerStatus = `Player ${message.playerId.slice(0, 6)} left the room.`;
            break;
        case 'host_changed':
            multiplayerStatus = `Host migrated to ${message.hostPlayerId.slice(0, 6)}.`;
            if (multiplayerRoom) {
                multiplayerRoom = {
                    ...multiplayerRoom,
                    hostPlayerId: message.hostPlayerId,
                };
            }
            refreshHostRoleForActiveMatch();
            break;
        case 'match_started':
            multiplayerStatus = `Match started for room ${message.roomCode}. Input sync engaged.`;
            multiplayerRoom = message.room;
            multiplayerMatchStartPending = true;
            startMultiplayerMatchFromRoom(message.room);
            break;
        case 'error':
            multiplayerStatus = message.message;
            break;
        case 'pong':
            break;
        case 'input_frame':
            if (message.fromPlayerId !== multiplayerSelfPlayerId) {
                multiplayerRemoteInputByPlayerId.set(message.fromPlayerId, cloneInputState(message.input));
            }
            break;
        case 'state_snapshot':
            if (!multiplayerIsHost && game && multiplayerRoom && message.fromPlayerId === multiplayerRoom.hostPlayerId) {
                game.applySnapshot(message.snapshot, multiplayerMatchPlayerOrder, multiplayerSelfPlayerId);
            }
            break;
        case 'game_event':
            break;
    }

    rerenderMultiplayerIfVisible();
}

function initializeNetworkIfNeeded(): void {
    if (networkInitialized) {
        return;
    }

    networkInitialized = true;

    networkClient.onConnectionChange((connected) => {
        multiplayerConnected = connected;

        if (!connected) {
            stopMultiplayerInputSync();
            multiplayerStatus = 'Disconnected from server. Reconnecting...';
        }

        rerenderMultiplayerIfVisible();
    });

    networkClient.onMessage(handleMultiplayerMessage);
}

function connectToMultiplayerAsync(): Promise<void> {
    initializeNetworkIfNeeded();

    if (networkClient.getIsConnected()) {
        multiplayerConnected = true;
        return Promise.resolve();
    }

    multiplayerStatus = 'Connecting to multiplayer service...';
    rerenderMultiplayerIfVisible();

    return networkClient.connectAsync()
        .then(() => {
            multiplayerConnected = true;
        })
        .catch(error => {
            multiplayerConnected = false;
            multiplayerStatus = `Connection failed: ${String(error)}`;
            throw error;
        });
}

function showMultiplayerMenu(): void {
    if (!menuOverlay.isConnected) {
        app.appendChild(menuOverlay);
    }

    const selfPlayer = getSelfRoomPlayer();
    const hasRoom = Boolean(multiplayerRoom);
    const isHost = Boolean(multiplayerRoom && multiplayerSelfPlayerId && multiplayerRoom.hostPlayerId === multiplayerSelfPlayerId);
    const roomPlayers = multiplayerRoom?.players ?? [];

    const rosterMarkup = roomPlayers.map(player => {
        const role = multiplayerRoom?.hostPlayerId === player.playerId ? 'Host' : 'Peer';
        const youLabel = player.playerId === multiplayerSelfPlayerId ? ' (You)' : '';
        const readyLabel = player.ready ? 'Ready' : 'Not Ready';
        return `
            <li class="lobby-player-row">
                <span>${player.displayName}${youLabel}</span>
                <span class="lobby-player-meta">${role} - ${readyLabel}</span>
            </li>
        `;
    }).join('');

    menuOverlay.innerHTML = `
        <div class="menu-panel multiplayer-panel">
            <h2 class="menu-title">Online Lobby</h2>
            <p class="menu-subtitle">Client-hosted multiplayer (WASD + Left Shift + Q)</p>

            <div class="multiplayer-status ${multiplayerConnected ? 'connected' : 'disconnected'}">${multiplayerStatus}</div>

            ${hasRoom ? `
                <div class="lobby-room-card">
                    <div class="lobby-room-header">
                        <strong>Room Code: ${multiplayerRoom?.code}</strong>
                        <span>${roomPlayers.length}/${MAX_ROOM_PLAYERS} players</span>
                    </div>
                    <ul class="lobby-player-list">${rosterMarkup}</ul>
                </div>

                <div class="menu-actions multiplayer-actions">
                    <button id="toggleReadyBtn" class="menu-btn primary">${selfPlayer?.ready ? 'Set Not Ready' : 'Set Ready'}</button>
                    <button id="startMatchBtn" class="menu-btn secondary" ${isHost ? '' : 'disabled'}>Start Match</button>
                    <button id="leaveRoomBtn" class="menu-btn secondary">Leave Room</button>
                    <button id="backToMainMenuBtn" class="menu-btn secondary">Back</button>
                </div>
            ` : `
                <div class="multiplayer-form">
                    <label for="displayNameInput">Display Name</label>
                    <input id="displayNameInput" maxlength="20" value="${multiplayerDisplayName}" />

                    <label for="roomCodeInput">Room Code</label>
                    <input id="roomCodeInput" maxlength="6" placeholder="ABC123" value="${multiplayerJoinRoomCode}" />
                </div>

                <div class="menu-actions multiplayer-actions">
                    <button id="createRoomBtn" class="menu-btn primary">Create Room</button>
                    <button id="joinRoomBtn" class="menu-btn secondary">Join Room</button>
                    <button id="backToMainMenuBtn" class="menu-btn secondary">Back</button>
                </div>
            `}
        </div>
    `;

    const backToMainMenuBtn = document.getElementById('backToMainMenuBtn');
    backToMainMenuBtn?.addEventListener('click', showStartMenu);

    if (!hasRoom) {
        const displayNameInput = document.getElementById('displayNameInput') as HTMLInputElement | null;
        const roomCodeInput = document.getElementById('roomCodeInput') as HTMLInputElement | null;

        displayNameInput?.addEventListener('input', () => {
            multiplayerDisplayName = displayNameInput.value;
        });

        roomCodeInput?.addEventListener('input', () => {
            multiplayerJoinRoomCode = roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
            roomCodeInput.value = multiplayerJoinRoomCode;
        });

        const createRoomBtn = document.getElementById('createRoomBtn');
        const joinRoomBtn = document.getElementById('joinRoomBtn');

        createRoomBtn?.addEventListener('click', () => {
            multiplayerDisplayName = (displayNameInput?.value ?? multiplayerDisplayName).trim() || multiplayerDisplayName;

            connectToMultiplayerAsync()
                .then(() => {
                    const sent = networkClient.createRoom(multiplayerDisplayName, getLobbyCustomization());
                    if (!sent) {
                        multiplayerStatus = 'Could not create room. Socket is not open yet.';
                        showMultiplayerMenu();
                    }
                })
                .catch(() => {
                    showMultiplayerMenu();
                });
        });

        joinRoomBtn?.addEventListener('click', () => {
            multiplayerDisplayName = (displayNameInput?.value ?? multiplayerDisplayName).trim() || multiplayerDisplayName;
            multiplayerJoinRoomCode = (roomCodeInput?.value ?? multiplayerJoinRoomCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

            if (multiplayerJoinRoomCode.length < 4) {
                multiplayerStatus = 'Enter a valid room code.';
                showMultiplayerMenu();
                return;
            }

            connectToMultiplayerAsync()
                .then(() => {
                    const sent = networkClient.joinRoom(
                        multiplayerJoinRoomCode,
                        multiplayerDisplayName,
                        getLobbyCustomization()
                    );

                    if (!sent) {
                        multiplayerStatus = 'Could not join room. Socket is not open yet.';
                        showMultiplayerMenu();
                    }
                })
                .catch(() => {
                    showMultiplayerMenu();
                });
        });

        return;
    }

    const toggleReadyBtn = document.getElementById('toggleReadyBtn');
    const startMatchBtn = document.getElementById('startMatchBtn');
    const leaveRoomBtn = document.getElementById('leaveRoomBtn');

    toggleReadyBtn?.addEventListener('click', () => {
        const nextReadyValue = !(selfPlayer?.ready ?? false);
        const sent = networkClient.setReady(nextReadyValue);
        if (!sent) {
            multiplayerStatus = 'Failed to send ready state.';
            showMultiplayerMenu();
        }
    });

    startMatchBtn?.addEventListener('click', () => {
        const sent = networkClient.startMatch();
        if (!sent) {
            multiplayerStatus = 'Failed to send start signal.';
            showMultiplayerMenu();
        }
    });

    leaveRoomBtn?.addEventListener('click', () => {
        stopMultiplayerInputSync();

        if (game) {
            returnToMainMenu();
        }

        networkClient.leaveRoom();
        multiplayerRoom = null;
        multiplayerStatus = 'Left room.';
        showMultiplayerMenu();
    });
}

function showStartMenu(): void {
    mobileControls?.setVisible(false);

    if (!menuOverlay.isConnected) {
        app.appendChild(menuOverlay);
    }

    const fpsOptionsMarkup = FPS_LIMIT_OPTIONS.map(limit => {
        const selected = selectedFpsLimit === limit ? 'selected' : '';
        return `<option value="${limit}" ${selected}>${getFpsLimitLabel(limit)}</option>`;
    }).join('');

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

            <div class="menu-setting-row">
                <label for="fpsLimitSelect">FPS Limit</label>
                <select id="fpsLimitSelect">${fpsOptionsMarkup}</select>
            </div>

            <div class="graphics-settings-grid">
                <label class="graphics-toggle"><input id="graphicsParticlesToggle" type="checkbox" ${graphicsSettings.particles ? 'checked' : ''} /> Particles</label>
                <label class="graphics-toggle"><input id="graphicsTrailsToggle" type="checkbox" ${graphicsSettings.trails ? 'checked' : ''} /> Trails</label>
                <label class="graphics-toggle"><input id="graphicsMapGlowToggle" type="checkbox" ${graphicsSettings.mapGlow ? 'checked' : ''} /> Map Glow</label>
                <label class="graphics-toggle"><input id="graphicsFpsHudToggle" type="checkbox" ${graphicsSettings.fpsHud ? 'checked' : ''} /> FPS HUD</label>
                <label class="graphics-toggle wide"><input id="graphicsClientReductionToggle" type="checkbox" ${graphicsSettings.reduceClientEffects ? 'checked' : ''} /> Multiplayer Client Low FX</label>
            </div>

            <div class="menu-actions">
                <button id="startGameBtn" class="menu-btn primary">Start Game</button>
                <button id="openMultiplayerBtn" class="menu-btn primary">Multiplayer Lobby</button>
                <button id="openCustomizeBtn" class="menu-btn secondary">Customize</button>
            </div>
        </div>
    `;

    const startGameBtn = document.getElementById('startGameBtn');
    const openMultiplayerBtn = document.getElementById('openMultiplayerBtn');
    const openCustomizeBtn = document.getElementById('openCustomizeBtn');
    const fpsLimitSelect = document.getElementById('fpsLimitSelect') as HTMLSelectElement | null;
    const graphicsParticlesToggle = document.getElementById('graphicsParticlesToggle') as HTMLInputElement | null;
    const graphicsTrailsToggle = document.getElementById('graphicsTrailsToggle') as HTMLInputElement | null;
    const graphicsMapGlowToggle = document.getElementById('graphicsMapGlowToggle') as HTMLInputElement | null;
    const graphicsFpsHudToggle = document.getElementById('graphicsFpsHudToggle') as HTMLInputElement | null;
    const graphicsClientReductionToggle = document.getElementById('graphicsClientReductionToggle') as HTMLInputElement | null;

    fpsLimitSelect?.addEventListener('change', () => {
        const parsed = Number(fpsLimitSelect.value);
        if (!Number.isFinite(parsed) || !isValidFpsLimit(parsed)) {
            return;
        }

        selectedFpsLimit = parsed;
        persistFpsLimitSelection(selectedFpsLimit);
    });

    graphicsParticlesToggle?.addEventListener('change', () => {
        graphicsSettings = { ...graphicsSettings, particles: graphicsParticlesToggle.checked };
        persistGraphicsSettings(graphicsSettings);
    });

    graphicsTrailsToggle?.addEventListener('change', () => {
        graphicsSettings = { ...graphicsSettings, trails: graphicsTrailsToggle.checked };
        persistGraphicsSettings(graphicsSettings);
    });

    graphicsMapGlowToggle?.addEventListener('change', () => {
        graphicsSettings = { ...graphicsSettings, mapGlow: graphicsMapGlowToggle.checked };
        persistGraphicsSettings(graphicsSettings);
    });

    graphicsFpsHudToggle?.addEventListener('change', () => {
        graphicsSettings = { ...graphicsSettings, fpsHud: graphicsFpsHudToggle.checked };
        persistGraphicsSettings(graphicsSettings);
    });

    graphicsClientReductionToggle?.addEventListener('change', () => {
        graphicsSettings = { ...graphicsSettings, reduceClientEffects: graphicsClientReductionToggle.checked };
        persistGraphicsSettings(graphicsSettings);
    });

    startGameBtn?.addEventListener('click', () => startGame());
    openMultiplayerBtn?.addEventListener('click', () => {
        connectToMultiplayerAsync()
            .catch(() => {
                // Keep menu open and status visible on failure.
            })
            .finally(() => {
                showMultiplayerMenu();
            });
    });
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
    stopMultiplayerInputSync();
    mobileControls?.setVisible(false);

    if (!game) {
        showStartMenu();
        return;
    }

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

function startGame(options?: {
    multiplayerSlots?: Array<{
        color: string;
        model: CubeModelType;
        hat: CubeHatType;
        label: string;
    }>;
    multiplayerRole?: 'host' | 'client';
}): void {
    if (game) return;

    const applyClientReduction = options?.multiplayerRole === 'client' && graphicsSettings.reduceClientEffects;
    const enableParticles = applyClientReduction ? false : graphicsSettings.particles;
    const enableTrailParticles = applyClientReduction ? false : graphicsSettings.trails;
    const enableMapGlow = applyClientReduction ? false : graphicsSettings.mapGlow;
    const showFpsHud = graphicsSettings.fpsHud;

    canvas.style.display = 'block';
    menuOverlay.remove();

    if (mobileControls) {
        mobileControls.attach(app);
        mobileControls.setVisible(true);
    }

    game = new Game('gameCanvas', {
        canvasWidth: DEFAULT_CANVAS_WIDTH,
        canvasHeight: DEFAULT_CANVAS_HEIGHT,
        backgroundColor: DEFAULT_BACKGROUND_COLOR,
        fpsLimit: selectedFpsLimit === 0 ? undefined : selectedFpsLimit,
        enableParticles,
        enableTrailParticles,
        enableMapGlow,
        showFpsHud,
        player1Color: getSelectedColor('p1').value,
        player2Color: getSelectedColor('p2').value,
        player1Model: selectedModelByPlayer.p1,
        player2Model: selectedModelByPlayer.p2,
        player1Hat: selectedHatByPlayer.p1,
        player2Hat: selectedHatByPlayer.p2,
        playerSlots: options?.multiplayerSlots,
    });

    game.start();

    if (mobileControls && !options?.multiplayerSlots) {
        // On mobile local mode, drive player one from joystick + boost overlay.
        game.setPlayerInputResolver((_player, playerIndex) => {
            if (playerIndex === 0) {
                return getLocalControlInputState();
            }

            return undefined;
        });
    }

    (window as unknown as { game: Game }).game = game;

    console.log('Welcome to Neon Rain!');
    console.log('Tip: Access the game instance via window.game in the console');
}

window.addEventListener('keydown', handleMainMenuReturnInput);

showStartMenu();

function getLocalControlInputState(): InputState {
    const keyboardState = multiplayerLocalInputHandler.getState();
    const mobileState = mobileControls?.getState();

    if (!mobileState) {
        return cloneInputState(keyboardState);
    }

    return {
        left: keyboardState.left || mobileState.left,
        right: keyboardState.right || mobileState.right,
        up: keyboardState.up || mobileState.up,
        down: keyboardState.down || mobileState.down,
        dash: keyboardState.dash || mobileState.dash,
        deployBomb: keyboardState.deployBomb || mobileState.deployBomb,
    };
}
