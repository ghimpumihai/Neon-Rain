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

export interface InputForwardMessage {
    type: 'input_frame';
    fromPlayerId: string;
    sequence: number;
    input: InputFrameState;
}

export interface SnapshotForwardMessage {
    type: 'state_snapshot';
    fromPlayerId: string;
    tick: number;
    snapshot: GameSnapshot;
}

export interface EventForwardMessage {
    type: 'game_event';
    fromPlayerId: string;
    event: GameEventEnvelope;
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
    | InputForwardMessage
    | SnapshotForwardMessage
    | EventForwardMessage
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

export interface StateSnapshotMessage {
    type: 'state_snapshot';
    tick: number;
    snapshot: GameSnapshot;
}

export interface GameEventMessage {
    type: 'game_event';
    event: GameEventEnvelope;
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
    | StateSnapshotMessage
    | GameEventMessage
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

function isGameEventEnvelope(value: unknown): value is GameEventEnvelope {
    if (!isRecord(value)) {
        return false;
    }

    return isString(value.kind) && isNumber(value.emittedAtMs);
}

function isGameSnapshot(value: unknown): value is GameSnapshot {
    if (!isRecord(value)) {
        return false;
    }

    return (
        isNumber(value.timestampMs) &&
        isNumber(value.gameTimeSeconds) &&
        isString(value.roundState) &&
        isNumber(value.score) &&
        Array.isArray(value.players) &&
        Array.isArray(value.enemies) &&
        Array.isArray(value.projectiles) &&
        Array.isArray(value.bombs) &&
        Array.isArray(value.powerups)
    );
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
        case 'state_snapshot':
            return isNumber(value.tick) && isGameSnapshot(value.snapshot);
        case 'game_event':
            return isGameEventEnvelope(value.event);
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
        case 'input_frame':
            return isString(value.fromPlayerId) && isNumber(value.sequence) && isInputFrameState(value.input);
        case 'state_snapshot':
            return isString(value.fromPlayerId) && isNumber(value.tick) && isGameSnapshot(value.snapshot);
        case 'game_event':
            return isString(value.fromPlayerId) && isGameEventEnvelope(value.event);
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
