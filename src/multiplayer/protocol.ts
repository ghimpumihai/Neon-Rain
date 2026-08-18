export const MAX_ROOM_PLAYERS = 4;
export const ROOM_CODE_LENGTH = 6;

export type PlayerModelType = 'core' | 'cross' | 'stripes' | 'target';
export type PlayerHatType = 'none' | 'cap' | 'crown' | 'beanie';

export interface PlayerCustomization {
    color: string;
    model: PlayerModelType;
    hat: PlayerHatType;
}

export interface InputFrameState {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    dash: boolean;
    deployBomb: boolean;
}

export interface Vector2State {
    x: number;
    y: number;
}

export interface PlayerSnapshot {
    playerId: string;
    position: Vector2State;
    velocity: Vector2State;
    lastProcessedInputSequence?: number;
    health: number;
    isAlive: boolean;
    isShielded: boolean;
    storedBombs: number;
}

export interface EnemySnapshot {
    enemyId: string;
    position: Vector2State;
    velocity: Vector2State;
    width: number;
    height: number;
    color: string;
}

export interface ProjectileSnapshot {
    projectileId: string;
    position: Vector2State;
    velocity: Vector2State;
    shooterPlayerId: string;
    targetPlayerId: string;
    expiresInSeconds: number;
}

export interface BombSnapshot {
    bombId: string;
    ownerPlayerId: string;
    position: Vector2State;
    isExploding: boolean;
    elapsedSeconds: number;
}

export interface PowerupSnapshot {
    powerupId: string;
    position: Vector2State;
    type: string;
    collected: boolean;
}

export type SnapshotRoundState = 'lobby' | 'playing' | 'game_over';

export interface GameSnapshot {
    timestampMs: number;
    gameTimeSeconds: number;
    roundState: SnapshotRoundState;
    score: number;
    worldWidth?: number;
    worldHeight?: number;
    players: PlayerSnapshot[];
    enemies: EnemySnapshot[];
    projectiles: ProjectileSnapshot[];
    bombs: BombSnapshot[];
    powerups: PowerupSnapshot[];
}

export interface RoomPlayerSummary {
    playerId: string;
    displayName: string;
    ready: boolean;
    customization: PlayerCustomization;
}

export interface RoomSummary {
    code: string;
    hostPlayerId: string;
    started: boolean;
    maxPlayers: number;
    players: RoomPlayerSummary[];
}

export interface GameEventEnvelope {
    kind: string;
    emittedAtMs: number;
    payload?: Record<string, unknown>;
}

export interface TickPlayerState {
    playerId: string;
    x: number;
    y: number;
    alive: boolean;
    score: number;
    lastProcessedSeq: number;
    health: number;
    isShielded: boolean;
    storedBombs: number;
}

export interface TickObstacleState {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    vy: number;
    color: string;
}

export interface TickPowerupState {
    id: string;
    x: number;
    y: number;
    type: string;
    collected: boolean;
}

export interface TickProjectileState {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    shooterPlayerId: string;
    targetPlayerId: string;
    expiresInSeconds: number;
}

export interface TickBombState {
    id: string;
    x: number;
    y: number;
    ownerPlayerId: string;
    isExploding: boolean;
    elapsedSeconds: number;
}

export type GameEvent =
    | {
        type: 'player_died';
        tick: number;
        playerId: string;
    }
    | {
        type: 'match_ended';
        tick: number;
        winnerPlayerId?: string | null;
    };

export interface ConnectedMessage {
    type: 'connected';
    playerId: string;
}

export interface RoomJoinedMessage {
    type: 'room_joined';
    playerId: string;
    room: RoomSummary;
}

export interface RoomUpdatedMessage {
    type: 'room_updated';
    room: RoomSummary;
}

export interface PlayerLeftMessage {
    type: 'player_left';
    playerId: string;
}

export interface HostChangedMessage {
    type: 'host_changed';
    hostPlayerId: string;
}

export interface MatchStartedMessage {
    type: 'match_started';
    roomCode: string;
    hostPlayerId: string;
    startedAtMs: number;
    room: RoomSummary;
}

export interface TickUpdateMessage {
    type: 'tick_update';
    tick: number;
    serverTimeMs: number;
    players: TickPlayerState[];
    obstacles: TickObstacleState[];
    powerups: TickPowerupState[];
    projectiles: TickProjectileState[];
    bombs: TickBombState[];
    events: GameEvent[];
}

export interface PongMessage {
    type: 'pong';
    clientTimeMs: number;
    serverTimeMs: number;
}

export interface ErrorMessage {
    type: 'error';
    code: string;
    message: string;
}

export type ServerToClientMessage =
    | ConnectedMessage
    | RoomJoinedMessage
    | RoomUpdatedMessage
    | PlayerLeftMessage
    | HostChangedMessage
    | MatchStartedMessage
    | TickUpdateMessage
    | PongMessage
    | ErrorMessage;

export interface CreateRoomMessage {
    type: 'create_room';
    displayName: string;
    customization?: Partial<PlayerCustomization>;
}

export interface JoinRoomMessage {
    type: 'join_room';
    roomCode: string;
    displayName: string;
    customization?: Partial<PlayerCustomization>;
}

export interface LeaveRoomMessage {
    type: 'leave_room';
}

export interface SetReadyMessage {
    type: 'set_ready';
    ready: boolean;
}

export interface StartMatchMessage {
    type: 'start_match';
}

export interface InputFrameMessage {
    type: 'input_frame';
    sequence: number;
    input: InputFrameState;
}

export interface PingMessage {
    type: 'ping';
    clientTimeMs: number;
}

export type ClientToServerMessage =
    | CreateRoomMessage
    | JoinRoomMessage
    | LeaveRoomMessage
    | SetReadyMessage
    | StartMatchMessage
    | InputFrameMessage
    | PingMessage;

export function createDefaultCustomization(): PlayerCustomization {
    return {
        color: '#00ffff',
        model: 'core',
        hat: 'none',
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
}

function isString(value: unknown): value is string {
    return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isInputFrameState(value: unknown): value is InputFrameState {
    if (!isRecord(value)) {
        return false;
    }

    return (
        isBoolean(value.left) &&
        isBoolean(value.right) &&
        isBoolean(value.up) &&
        isBoolean(value.down) &&
        isBoolean(value.dash) &&
        isBoolean(value.deployBomb)
    );
}

function isTickPlayerState(value: unknown): value is TickPlayerState {
    if (!isRecord(value)) {
        return false;
    }

    return (
        isString(value.playerId)
        && isNumber(value.x)
        && isNumber(value.y)
        && isBoolean(value.alive)
        && isNumber(value.score)
        && isNumber(value.lastProcessedSeq)
        && isNumber(value.health)
        && isBoolean(value.isShielded)
        && isNumber(value.storedBombs)
    );
}

function isTickObstacleState(value: unknown): value is TickObstacleState {
    if (!isRecord(value)) {
        return false;
    }

    return (
        isString(value.id)
        && isNumber(value.x)
        && isNumber(value.y)
        && isNumber(value.w)
        && isNumber(value.h)
        && isNumber(value.vy)
        && isString(value.color)
    );
}

function isTickPowerupState(value: unknown): value is TickPowerupState {
    if (!isRecord(value)) {
        return false;
    }

    return (
        isString(value.id)
        && isNumber(value.x)
        && isNumber(value.y)
        && isString(value.type)
        && isBoolean(value.collected)
    );
}

function isTickProjectileState(value: unknown): value is TickProjectileState {
    if (!isRecord(value)) {
        return false;
    }

    return (
        isString(value.id)
        && isNumber(value.x)
        && isNumber(value.y)
        && isNumber(value.vx)
        && isNumber(value.vy)
        && isString(value.shooterPlayerId)
        && isString(value.targetPlayerId)
        && isNumber(value.expiresInSeconds)
    );
}

function isTickBombState(value: unknown): value is TickBombState {
    if (!isRecord(value)) {
        return false;
    }

    return (
        isString(value.id)
        && isNumber(value.x)
        && isNumber(value.y)
        && isString(value.ownerPlayerId)
        && isBoolean(value.isExploding)
        && isNumber(value.elapsedSeconds)
    );
}

function isGameEvent(value: unknown): value is GameEvent {
    if (!isRecord(value) || !isString(value.type) || !isNumber(value.tick)) {
        return false;
    }

    switch (value.type) {
        case 'player_died':
            return isString(value.playerId);
        case 'match_ended':
            return (
                value.winnerPlayerId === undefined
                || value.winnerPlayerId === null
                || isString(value.winnerPlayerId)
            );
        default:
            return false;
    }
}

export function isClientToServerMessage(value: unknown): value is ClientToServerMessage {
    if (!isRecord(value) || !isString(value.type)) {
        return false;
    }

    switch (value.type) {
        case 'create_room':
            return isString(value.displayName);
        case 'join_room':
            return isString(value.roomCode) && isString(value.displayName);
        case 'leave_room':
            return true;
        case 'set_ready':
            return isBoolean(value.ready);
        case 'start_match':
            return true;
        case 'input_frame':
            return isNumber(value.sequence) && isInputFrameState(value.input);
        case 'ping':
            return isNumber(value.clientTimeMs);
        default:
            return false;
    }
}

export function isServerToClientMessage(value: unknown): value is ServerToClientMessage {
    if (!isRecord(value) || !isString(value.type)) {
        return false;
    }

    switch (value.type) {
        case 'connected':
            return isString(value.playerId);
        case 'room_joined':
            return isString(value.playerId) && isRecord(value.room);
        case 'room_updated':
            return isRecord(value.room);
        case 'player_left':
            return isString(value.playerId);
        case 'host_changed':
            return isString(value.hostPlayerId);
        case 'match_started':
            return (
                isString(value.roomCode)
                && isString(value.hostPlayerId)
                && isNumber(value.startedAtMs)
                && isRecord(value.room)
            );
        case 'tick_update':
            return (
                isNumber(value.tick)
                && isNumber(value.serverTimeMs)
                && Array.isArray(value.players)
                && value.players.every(isTickPlayerState)
                && Array.isArray(value.obstacles)
                && value.obstacles.every(isTickObstacleState)
                && Array.isArray(value.powerups)
                && value.powerups.every(isTickPowerupState)
                && Array.isArray(value.projectiles)
                && value.projectiles.every(isTickProjectileState)
                && Array.isArray(value.bombs)
                && value.bombs.every(isTickBombState)
                && Array.isArray(value.events)
                && value.events.every(isGameEvent)
            );
        case 'pong':
            return isNumber(value.clientTimeMs) && isNumber(value.serverTimeMs);
        case 'error':
            return isString(value.code) && isString(value.message);
        default:
            return false;
    }
}

export function decodeWireMessage(rawMessage: string): unknown | null {
    try {
        return JSON.parse(rawMessage) as unknown;
    } catch {
        return null;
    }
}

export function encodeWireMessage(message: ClientToServerMessage | ServerToClientMessage): string {
    return JSON.stringify(message);
}
