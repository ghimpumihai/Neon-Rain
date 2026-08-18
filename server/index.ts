import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import {
    MAX_ROOM_PLAYERS,
    createDefaultCustomization,
    decodeWireMessage,
    encodeWireMessage,
    isClientToServerMessage,
    type ClientToServerMessage,
    type GameEvent,
    type InputFrameState,
    type PlayerCustomization,
    type RoomSummary,
    type ServerToClientMessage,
} from '../src/multiplayer/protocol.js';
import {
    OBSTACLE_SPAWN_INTERVAL_SECONDS,
    POWERUP_SPAWN_INTERVAL_SECONDS,
    SERVER_FIXED_DELTA_SECONDS,
    SERVER_TICK_RATE,
    SERVER_WORLD_HEIGHT,
    SERVER_WORLD_WIDTH,
    applyInputToPlayer,
    createNeutralInputState,
    createSpawnPosition,
    detectObstacleCollisions,
    detectPowerupCollections,
    spawnObstacle,
    spawnPowerup,
    type SimObstacleState,
    type SimPowerupState,
    type SimPlayerState,
    updateObstacles,
} from '../src/game/physics.js';

interface ClientConnection {
    playerId: string;
    socket: WebSocket;
    roomCode: string | null;
    displayName: string;
    ready: boolean;
    customization: PlayerCustomization;
}

interface RoomState {
    code: string;
    hostPlayerId: string;
    playerIds: string[];
    started: boolean;
    createdAtMs: number;
    updatedAtMs: number;
}

interface QueuedInputFrame {
    sequence: number;
    input: InputFrameState;
}

interface ServerPlayerState extends SimPlayerState {
    health: number;
    isShielded: boolean;
    shieldRemainingSeconds: number;
    storedBombs: number;
    storedBombTimers: number[];
    previousDeployBomb: boolean;
    pendingGunShots: number;
    gunShotCooldownSeconds: number;
}

interface ServerProjectileState {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    shooterPlayerId: string;
    targetPlayerId: string;
    expiresInSeconds: number;
}

interface ServerBombState {
    id: string;
    x: number;
    y: number;
    ownerPlayerId: string;
    elapsedSeconds: number;
    isExploding: boolean;
    explosionElapsedSeconds: number;
}

interface RoomGameState {
    roomCode: string;
    tick: number;
    playersById: Map<string, ServerPlayerState>;
    lastInputByPlayerId: Map<string, InputFrameState>;
    inputQueueByPlayerId: Map<string, QueuedInputFrame[]>;
    obstacles: SimObstacleState[];
    nextObstacleIndex: number;
    spawnAccumulatorSeconds: number;
    powerups: SimPowerupState[];
    nextPowerupIndex: number;
    powerupSpawnAccumulatorSeconds: number;
    projectiles: ServerProjectileState[];
    nextProjectileIndex: number;
    bombs: ServerBombState[];
    nextBombIndex: number;
    loopIntervalId: NodeJS.Timeout | null;
}

const clientsById = new Map<string, ClientConnection>();
const clientIdsBySocket = new Map<WebSocket, string>();
const roomsByCode = new Map<string, RoomState>();
const roomGameStateByCode = new Map<string, RoomGameState>();

const SERVER_TICK_INTERVAL_MS = Math.floor(1000 / SERVER_TICK_RATE);
const SERVER_PLAYER_SIZE = 30;
const SERVER_POWERUP_SIZE = 25;
const SERVER_PLAYER_MAX_HEALTH = 100;
const SERVER_HEAL_AMOUNT = 30;
const SERVER_SHIELD_DURATION_SECONDS = 5;
const SERVER_STORED_BOMB_TIMEOUT_SECONDS = 8;
const SERVER_BOMB_FUSE_SECONDS = 1.5;
const SERVER_BOMB_EXPLOSION_DURATION_SECONDS = 0.5;
const SERVER_BOMB_RADIUS = 80;
const SERVER_BOMB_DAMAGE = 30;
const SERVER_PROJECTILE_SIZE = 8;
const SERVER_PROJECTILE_SPEED = 500;
const SERVER_PROJECTILE_DAMAGE = 15;
const SERVER_PROJECTILE_LIFETIME_SECONDS = 3;
const SERVER_GUN_SHOT_COUNT = 3;
const SERVER_GUN_SHOT_INTERVAL_SECONDS = 0.4;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistDir = path.resolve(__dirname, '../..');

const mimeTypeByExtension: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.map': 'application/json; charset=utf-8',
};

function getMimeType(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase();
    return mimeTypeByExtension[extension] ?? 'application/octet-stream';
}

function normalizeDisplayName(rawName: string): string {
    const trimmed = rawName.trim();
    if (trimmed.length === 0) {
        return `Player-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    }

    return trimmed.slice(0, 20);
}

function sanitizeRoomCode(roomCode: string): string {
    return roomCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

function sanitizeCustomization(customization: Partial<PlayerCustomization> | undefined): PlayerCustomization {
    const defaults = createDefaultCustomization();
    if (!customization) {
        return defaults;
    }

    const model = customization.model;
    const hat = customization.hat;

    const safeModel = model === 'core' || model === 'cross' || model === 'stripes' || model === 'target'
        ? model
        : defaults.model;

    const safeHat = hat === 'none' || hat === 'cap' || hat === 'crown' || hat === 'beanie'
        ? hat
        : defaults.hat;

    const safeColor = typeof customization.color === 'string' && customization.color.trim().length > 0
        ? customization.color
        : defaults.color;

    return {
        color: safeColor,
        model: safeModel,
        hat: safeHat,
    };
}

function createUniqueRoomCode(): string {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

    for (let attempts = 0; attempts < 2000; attempts++) {
        let roomCode = '';
        for (let index = 0; index < 6; index++) {
            roomCode += alphabet[Math.floor(Math.random() * alphabet.length)];
        }

        if (!roomsByCode.has(roomCode)) {
            return roomCode;
        }
    }

    throw new Error('Unable to allocate a unique room code');
}

function getClientById(playerId: string): ClientConnection | undefined {
    return clientsById.get(playerId);
}

function sendToClient(playerId: string, message: ServerToClientMessage): void {
    const client = getClientById(playerId);
    if (!client || client.socket.readyState !== WebSocket.OPEN) {
        return;
    }

    client.socket.send(encodeWireMessage(message));
}

function broadcastToRoom(roomCode: string, message: ServerToClientMessage, excludePlayerId?: string): void {
    const room = roomsByCode.get(roomCode);
    if (!room) {
        return;
    }

    room.playerIds.forEach(playerId => {
        if (excludePlayerId && playerId === excludePlayerId) {
            return;
        }
        sendToClient(playerId, message);
    });
}

function roomToSummary(room: RoomState): RoomSummary {
    const players = room.playerIds
        .map(playerId => clientsById.get(playerId))
        .filter((client): client is ClientConnection => Boolean(client))
        .map(client => ({
            playerId: client.playerId,
            displayName: client.displayName,
            ready: client.ready,
            customization: client.customization,
        }));

    return {
        code: room.code,
        hostPlayerId: room.hostPlayerId,
        started: room.started,
        maxPlayers: MAX_ROOM_PLAYERS,
        players,
    };
}

function sendRoomUpdate(roomCode: string): void {
    const room = roomsByCode.get(roomCode);
    if (!room) {
        return;
    }

    broadcastToRoom(roomCode, {
        type: 'room_updated',
        room: roomToSummary(room),
    });
}

function sendError(playerId: string, code: string, message: string): void {
    sendToClient(playerId, {
        type: 'error',
        code,
        message,
    });
}

function createPlayerGameState(room: RoomState, playerId: string, playerIndex: number): ServerPlayerState {
    const spawnPosition = createSpawnPosition(
        playerIndex,
        room.playerIds.length,
        SERVER_WORLD_WIDTH,
        SERVER_WORLD_HEIGHT
    );

    return {
        playerId,
        x: spawnPosition.x,
        y: spawnPosition.y,
        vx: 0,
        vy: 0,
        alive: true,
        score: 0,
        lastProcessedSeq: -1,
        health: SERVER_PLAYER_MAX_HEALTH,
        isShielded: false,
        shieldRemainingSeconds: 0,
        storedBombs: 0,
        storedBombTimers: [],
        previousDeployBomb: false,
        pendingGunShots: 0,
        gunShotCooldownSeconds: 0,
    };
}

function createRoomGameState(room: RoomState): RoomGameState {
    const playersById = new Map<string, ServerPlayerState>();
    const lastInputByPlayerId = new Map<string, InputFrameState>();
    const inputQueueByPlayerId = new Map<string, QueuedInputFrame[]>();

    room.playerIds.forEach((playerId, playerIndex) => {
        playersById.set(playerId, createPlayerGameState(room, playerId, playerIndex));
        lastInputByPlayerId.set(playerId, createNeutralInputState());
        inputQueueByPlayerId.set(playerId, []);
    });

    return {
        roomCode: room.code,
        tick: 0,
        playersById,
        lastInputByPlayerId,
        inputQueueByPlayerId,
        obstacles: [],
        nextObstacleIndex: 0,
        spawnAccumulatorSeconds: 0,
        powerups: [],
        nextPowerupIndex: 0,
        powerupSpawnAccumulatorSeconds: 0,
        projectiles: [],
        nextProjectileIndex: 0,
        bombs: [],
        nextBombIndex: 0,
        loopIntervalId: null,
    };
}

function getPlayerBounds(player: ServerPlayerState): { x: number; y: number; w: number; h: number } {
    return {
        x: player.x,
        y: player.y,
        w: SERVER_PLAYER_SIZE,
        h: SERVER_PLAYER_SIZE,
    };
}

function getProjectileBounds(projectile: ServerProjectileState): { x: number; y: number; w: number; h: number } {
    return {
        x: projectile.x,
        y: projectile.y,
        w: SERVER_PROJECTILE_SIZE,
        h: SERVER_PROJECTILE_SIZE,
    };
}

function intersectsAabb(
    first: { x: number; y: number; w: number; h: number },
    second: { x: number; y: number; w: number; h: number }
): boolean {
    return (
        first.x < second.x + second.w
        && first.x + first.w > second.x
        && first.y < second.y + second.h
        && first.y + first.h > second.y
    );
}

function circleIntersectsPlayer(
    centerX: number,
    centerY: number,
    radius: number,
    player: ServerPlayerState
): boolean {
    const nearestX = Math.max(player.x, Math.min(centerX, player.x + SERVER_PLAYER_SIZE));
    const nearestY = Math.max(player.y, Math.min(centerY, player.y + SERVER_PLAYER_SIZE));
    const dx = centerX - nearestX;
    const dy = centerY - nearestY;
    return dx * dx + dy * dy <= radius * radius;
}

function eliminatePlayer(player: ServerPlayerState, events: GameEvent[], tick: number): void {
    if (!player.alive) {
        return;
    }

    player.alive = false;
    player.vx = 0;
    player.vy = 0;
    player.health = 0;
    player.isShielded = false;
    player.shieldRemainingSeconds = 0;
    player.storedBombs = 0;
    player.storedBombTimers = [];

    events.push({
        type: 'player_died',
        tick,
        playerId: player.playerId,
    });
}

function applyDamageToPlayer(player: ServerPlayerState, damage: number, events: GameEvent[], tick: number): void {
    if (!player.alive) {
        return;
    }

    if (player.isShielded) {
        return;
    }

    player.health = Math.max(0, player.health - Math.max(0, damage));
    if (player.health <= 0) {
        eliminatePlayer(player, events, tick);
    }
}

function findNearestAliveOpponent(
    shooter: ServerPlayerState,
    playersById: Map<string, ServerPlayerState>
): ServerPlayerState | null {
    let nearest: ServerPlayerState | null = null;
    let nearestDistanceSquared = Number.POSITIVE_INFINITY;

    playersById.forEach(candidate => {
        if (!candidate.alive || candidate.playerId === shooter.playerId) {
            return;
        }

        const dx = candidate.x - shooter.x;
        const dy = candidate.y - shooter.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < nearestDistanceSquared) {
            nearestDistanceSquared = distanceSquared;
            nearest = candidate;
        }
    });

    return nearest;
}

function spawnProjectile(
    gameState: RoomGameState,
    shooter: ServerPlayerState,
    target: ServerPlayerState
): void {
    const originX = shooter.x + SERVER_PLAYER_SIZE / 2 - SERVER_PROJECTILE_SIZE / 2;
    const originY = shooter.y + SERVER_PLAYER_SIZE / 2 - SERVER_PROJECTILE_SIZE / 2;

    const directionX = target.x - shooter.x;
    const directionY = target.y - shooter.y;
    const directionLength = Math.hypot(directionX, directionY) || 1;

    gameState.projectiles.push({
        id: `projectile-${gameState.nextProjectileIndex++}`,
        x: originX,
        y: originY,
        vx: (directionX / directionLength) * SERVER_PROJECTILE_SPEED,
        vy: (directionY / directionLength) * SERVER_PROJECTILE_SPEED,
        shooterPlayerId: shooter.playerId,
        targetPlayerId: target.playerId,
        expiresInSeconds: SERVER_PROJECTILE_LIFETIME_SECONDS,
    });
}

function spawnBomb(gameState: RoomGameState, owner: ServerPlayerState): void {
    if (!owner.alive || owner.storedBombs <= 0) {
        return;
    }

    owner.storedBombs = Math.max(0, owner.storedBombs - 1);
    if (owner.storedBombTimers.length > 0) {
        owner.storedBombTimers.shift();
    }

    gameState.bombs.push({
        id: `bomb-${gameState.nextBombIndex++}`,
        x: owner.x + SERVER_PLAYER_SIZE / 2 - 15,
        y: owner.y + SERVER_PLAYER_SIZE / 2 - 15,
        ownerPlayerId: owner.playerId,
        elapsedSeconds: 0,
        isExploding: false,
        explosionElapsedSeconds: 0,
    });
}

function applyPowerupEffect(
    player: ServerPlayerState,
    powerupType: SimPowerupState['type']
): void {
    switch (powerupType) {
        case 'bomb':
            player.storedBombs += 1;
            player.storedBombTimers.push(SERVER_STORED_BOMB_TIMEOUT_SECONDS);
            break;
        case 'shield':
            player.isShielded = true;
            player.shieldRemainingSeconds = SERVER_SHIELD_DURATION_SECONDS;
            break;
        case 'gun':
            player.pendingGunShots += SERVER_GUN_SHOT_COUNT;
            if (player.gunShotCooldownSeconds > 0) {
                player.gunShotCooldownSeconds = 0;
            }
            break;
        case 'heal':
            player.health = Math.min(SERVER_PLAYER_MAX_HEALTH, player.health + SERVER_HEAL_AMOUNT);
            break;
    }
}

function syncRoomGamePlayers(room: RoomState, gameState: RoomGameState): void {
    const livePlayerIds = new Set(room.playerIds);

    room.playerIds.forEach((playerId, playerIndex) => {
        if (!gameState.playersById.has(playerId)) {
            gameState.playersById.set(playerId, createPlayerGameState(room, playerId, playerIndex));
        }

        if (!gameState.lastInputByPlayerId.has(playerId)) {
            gameState.lastInputByPlayerId.set(playerId, createNeutralInputState());
        }

        if (!gameState.inputQueueByPlayerId.has(playerId)) {
            gameState.inputQueueByPlayerId.set(playerId, []);
        }
    });

    Array.from(gameState.playersById.keys()).forEach(playerId => {
        if (livePlayerIds.has(playerId)) {
            return;
        }

        gameState.playersById.delete(playerId);
        gameState.lastInputByPlayerId.delete(playerId);
        gameState.inputQueueByPlayerId.delete(playerId);
    });
}

function stopServerLoop(roomCode: string): void {
    const gameState = roomGameStateByCode.get(roomCode);
    if (!gameState) {
        return;
    }

    if (gameState.loopIntervalId !== null) {
        clearInterval(gameState.loopIntervalId);
        gameState.loopIntervalId = null;
    }

    roomGameStateByCode.delete(roomCode);
}

function endMatch(roomCode: string): void {
    const room = roomsByCode.get(roomCode);
    if (!room) {
        stopServerLoop(roomCode);
        return;
    }

    room.started = false;
    room.updatedAtMs = Date.now();

    room.playerIds.forEach(playerId => {
        const client = clientsById.get(playerId);
        if (client) {
            client.ready = false;
        }
    });

    stopServerLoop(roomCode);
    sendRoomUpdate(roomCode);
}

function tickRoomGameState(roomCode: string): void {
    const room = roomsByCode.get(roomCode);
    const gameState = roomGameStateByCode.get(roomCode);

    if (!room || !gameState || !room.started) {
        stopServerLoop(roomCode);
        return;
    }

    syncRoomGamePlayers(room, gameState);

    const events: GameEvent[] = [];

    room.playerIds.forEach(playerId => {
        const playerState = gameState.playersById.get(playerId);
        if (!playerState) {
            return;
        }

        const inputQueue = gameState.inputQueueByPlayerId.get(playerId) ?? [];
        inputQueue.sort((first, second) => first.sequence - second.sequence);

        let wantsDeployBomb = false;

        while (inputQueue.length > 0) {
            const inputFrame = inputQueue.shift();
            if (!inputFrame || inputFrame.sequence <= playerState.lastProcessedSeq) {
                continue;
            }

            if (inputFrame.input.deployBomb) {
                wantsDeployBomb = true;
            }

            gameState.lastInputByPlayerId.set(playerId, inputFrame.input);
            playerState.lastProcessedSeq = inputFrame.sequence;
        }

        const activeInput = gameState.lastInputByPlayerId.get(playerId) ?? createNeutralInputState();
        if (activeInput.deployBomb) {
            wantsDeployBomb = true;
        }

        if (playerState.alive) {
            applyInputToPlayer(
                playerState,
                activeInput,
                SERVER_FIXED_DELTA_SECONDS,
                SERVER_WORLD_WIDTH,
                SERVER_WORLD_HEIGHT
            );

            if (wantsDeployBomb && !playerState.previousDeployBomb) {
                spawnBomb(gameState, playerState);
            }
        }

        playerState.previousDeployBomb = wantsDeployBomb;

        if (playerState.isShielded) {
            playerState.shieldRemainingSeconds = Math.max(
                0,
                playerState.shieldRemainingSeconds - SERVER_FIXED_DELTA_SECONDS
            );
            if (playerState.shieldRemainingSeconds <= 0) {
                playerState.isShielded = false;
            }
        }

        if (playerState.storedBombTimers.length > 0 && playerState.alive) {
            playerState.storedBombTimers = playerState.storedBombTimers
                .map(timer => timer - SERVER_FIXED_DELTA_SECONDS);

            const hasExpiredBomb = playerState.storedBombTimers.some(timer => timer <= 0);
            if (hasExpiredBomb) {
                playerState.storedBombTimers = [];
                playerState.storedBombs = 0;
                eliminatePlayer(playerState, events, gameState.tick);
            }
        }

        playerState.storedBombs = playerState.storedBombTimers.length;

        if (playerState.alive && playerState.pendingGunShots > 0) {
            playerState.gunShotCooldownSeconds -= SERVER_FIXED_DELTA_SECONDS;

            while (playerState.pendingGunShots > 0 && playerState.gunShotCooldownSeconds <= 0) {
                const target = findNearestAliveOpponent(playerState, gameState.playersById);
                if (!target) {
                    playerState.pendingGunShots = 0;
                    break;
                }

                spawnProjectile(gameState, playerState, target);
                playerState.pendingGunShots -= 1;
                playerState.gunShotCooldownSeconds += SERVER_GUN_SHOT_INTERVAL_SECONDS;
            }
        }
    });

    gameState.spawnAccumulatorSeconds += SERVER_FIXED_DELTA_SECONDS;
    if (gameState.spawnAccumulatorSeconds >= OBSTACLE_SPAWN_INTERVAL_SECONDS) {
        gameState.spawnAccumulatorSeconds -= OBSTACLE_SPAWN_INTERVAL_SECONDS;
        gameState.obstacles.push(spawnObstacle(gameState.nextObstacleIndex++, SERVER_WORLD_WIDTH));
    }

    gameState.obstacles = updateObstacles(gameState.obstacles, SERVER_FIXED_DELTA_SECONDS, SERVER_WORLD_HEIGHT);

    gameState.powerupSpawnAccumulatorSeconds += SERVER_FIXED_DELTA_SECONDS;
    const hasActivePowerup = gameState.powerups.some(powerup => !powerup.collected);
    if (!hasActivePowerup && gameState.powerupSpawnAccumulatorSeconds >= POWERUP_SPAWN_INTERVAL_SECONDS) {
        gameState.powerupSpawnAccumulatorSeconds -= POWERUP_SPAWN_INTERVAL_SECONDS;
        gameState.powerups.push(
            spawnPowerup(gameState.nextPowerupIndex++, SERVER_WORLD_WIDTH, SERVER_WORLD_HEIGHT)
        );
    }

    const collidedPlayerIds = detectObstacleCollisions(gameState.playersById.values(), gameState.obstacles);
    collidedPlayerIds.forEach(playerId => {
        const playerState = gameState.playersById.get(playerId);
        if (!playerState) {
            return;
        }

        applyDamageToPlayer(playerState, SERVER_PLAYER_MAX_HEALTH, events, gameState.tick);
    });

    const powerupCollections = detectPowerupCollections(
        gameState.playersById.values(),
        gameState.powerups,
        SERVER_PLAYER_SIZE,
        SERVER_POWERUP_SIZE
    );
    if (powerupCollections.length > 0) {
        powerupCollections.forEach(collection => {
            const playerState = gameState.playersById.get(collection.playerId);
            if (!playerState || !playerState.alive) {
                return;
            }

            const collectedPowerup = gameState.powerups.find(powerup => powerup.id === collection.powerupId);
            if (!collectedPowerup || collectedPowerup.collected) {
                return;
            }

            collectedPowerup.collected = true;
            applyPowerupEffect(playerState, collectedPowerup.type);

            // Award points for authoritative powerup pickups.
            playerState.score += 25;
        });

        gameState.powerups = gameState.powerups.filter(powerup => !powerup.collected);
    }

    const nextBombs: ServerBombState[] = [];
    gameState.bombs.forEach(bomb => {
        bomb.elapsedSeconds += SERVER_FIXED_DELTA_SECONDS;

        if (!bomb.isExploding && bomb.elapsedSeconds >= SERVER_BOMB_FUSE_SECONDS) {
            bomb.isExploding = true;
            bomb.explosionElapsedSeconds = 0;

            const bombCenterX = bomb.x + 15;
            const bombCenterY = bomb.y + 15;

            gameState.playersById.forEach(player => {
                if (player.playerId === bomb.ownerPlayerId || !player.alive) {
                    return;
                }

                if (circleIntersectsPlayer(bombCenterX, bombCenterY, SERVER_BOMB_RADIUS, player)) {
                    applyDamageToPlayer(player, SERVER_BOMB_DAMAGE, events, gameState.tick);
                }
            });
        }

        if (bomb.isExploding) {
            bomb.explosionElapsedSeconds += SERVER_FIXED_DELTA_SECONDS;
            if (bomb.explosionElapsedSeconds < SERVER_BOMB_EXPLOSION_DURATION_SECONDS) {
                nextBombs.push(bomb);
            }
            return;
        }

        nextBombs.push(bomb);
    });
    gameState.bombs = nextBombs;

    const nextProjectiles: ServerProjectileState[] = [];
    gameState.projectiles.forEach(projectile => {
        projectile.expiresInSeconds -= SERVER_FIXED_DELTA_SECONDS;
        if (projectile.expiresInSeconds <= 0) {
            return;
        }

        const targetPlayer = gameState.playersById.get(projectile.targetPlayerId);
        if (targetPlayer && targetPlayer.alive) {
            const fromX = projectile.x + SERVER_PROJECTILE_SIZE / 2;
            const fromY = projectile.y + SERVER_PROJECTILE_SIZE / 2;
            const toX = targetPlayer.x + SERVER_PLAYER_SIZE / 2;
            const toY = targetPlayer.y + SERVER_PLAYER_SIZE / 2;
            const dx = toX - fromX;
            const dy = toY - fromY;
            const directionLength = Math.hypot(dx, dy) || 1;

            projectile.vx = (dx / directionLength) * SERVER_PROJECTILE_SPEED;
            projectile.vy = (dy / directionLength) * SERVER_PROJECTILE_SPEED;
        }

        projectile.x += projectile.vx * SERVER_FIXED_DELTA_SECONDS;
        projectile.y += projectile.vy * SERVER_FIXED_DELTA_SECONDS;

        const projectileBounds = getProjectileBounds(projectile);
        let didHitPlayer = false;

        gameState.playersById.forEach(player => {
            if (didHitPlayer || !player.alive || player.playerId === projectile.shooterPlayerId) {
                return;
            }

            if (!intersectsAabb(projectileBounds, getPlayerBounds(player))) {
                return;
            }

            applyDamageToPlayer(player, SERVER_PROJECTILE_DAMAGE, events, gameState.tick);
            didHitPlayer = true;
        });

        if (!didHitPlayer) {
            nextProjectiles.push(projectile);
        }
    });
    gameState.projectiles = nextProjectiles;

    const activePlayerStates = room.playerIds
        .map(playerId => gameState.playersById.get(playerId))
        .filter((player): player is ServerPlayerState => Boolean(player));

    const alivePlayers = activePlayerStates.filter(player => player.alive);

    const didMatchEnd = room.playerIds.length >= 2 && alivePlayers.length <= 1;
    if (didMatchEnd) {
        const winnerPlayerId = alivePlayers.length === 1 ? alivePlayers[0].playerId : null;
        events.push({
            type: 'match_ended',
            tick: gameState.tick,
            winnerPlayerId,
        });
    }

    broadcastToRoom(roomCode, {
        type: 'tick_update',
        tick: gameState.tick,
        serverTimeMs: Date.now(),
        players: activePlayerStates
            .map(player => ({
                playerId: player.playerId,
                x: player.x,
                y: player.y,
                alive: player.alive,
                score: player.score,
                lastProcessedSeq: player.lastProcessedSeq,
                health: player.health,
                isShielded: player.isShielded,
                storedBombs: player.storedBombs,
            })),
        obstacles: gameState.obstacles.map(obstacle => ({
            id: obstacle.id,
            x: obstacle.x,
            y: obstacle.y,
            w: obstacle.w,
            h: obstacle.h,
            vy: obstacle.vy,
            color: obstacle.color,
        })),
        powerups: gameState.powerups.map(powerup => ({
            id: powerup.id,
            x: powerup.x,
            y: powerup.y,
            type: powerup.type,
            collected: powerup.collected,
        })),
        projectiles: gameState.projectiles.map(projectile => ({
            id: projectile.id,
            x: projectile.x,
            y: projectile.y,
            vx: projectile.vx,
            vy: projectile.vy,
            shooterPlayerId: projectile.shooterPlayerId,
            targetPlayerId: projectile.targetPlayerId,
            expiresInSeconds: projectile.expiresInSeconds,
        })),
        bombs: gameState.bombs.map(bomb => ({
            id: bomb.id,
            x: bomb.x,
            y: bomb.y,
            ownerPlayerId: bomb.ownerPlayerId,
            isExploding: bomb.isExploding,
            elapsedSeconds: bomb.elapsedSeconds,
        })),
        events,
    });

    gameState.tick += 1;

    if (didMatchEnd) {
        endMatch(roomCode);
    }
}

function startServerLoop(roomCode: string): void {
    const room = roomsByCode.get(roomCode);
    if (!room) {
        return;
    }

    let gameState = roomGameStateByCode.get(roomCode);
    if (!gameState) {
        gameState = createRoomGameState(room);
        roomGameStateByCode.set(roomCode, gameState);
    }

    syncRoomGamePlayers(room, gameState);

    if (gameState.loopIntervalId !== null) {
        return;
    }

    gameState.loopIntervalId = setInterval(() => {
        tickRoomGameState(roomCode);
    }, SERVER_TICK_INTERVAL_MS);
}

function enqueueInputFrame(playerId: string, payload: Extract<ClientToServerMessage, { type: 'input_frame' }>): void {
    const client = clientsById.get(playerId);
    if (!client?.roomCode) {
        sendError(playerId, 'NOT_IN_ROOM', 'Join a room before sending inputs');
        return;
    }

    const room = roomsByCode.get(client.roomCode);
    if (!room) {
        sendError(playerId, 'ROOM_NOT_FOUND', 'Current room no longer exists');
        return;
    }

    if (!room.started) {
        return;
    }

    const gameState = roomGameStateByCode.get(room.code);
    if (!gameState) {
        sendError(playerId, 'MATCH_NOT_RUNNING', 'Match simulation is not running yet');
        return;
    }

    const inputQueue = gameState.inputQueueByPlayerId.get(playerId) ?? [];
    inputQueue.push({
        sequence: payload.sequence,
        input: payload.input,
    });

    if (inputQueue.length > 180) {
        inputQueue.splice(0, inputQueue.length - 180);
    }

    gameState.inputQueueByPlayerId.set(playerId, inputQueue);
}

function leaveCurrentRoom(playerId: string): void {
    const client = clientsById.get(playerId);
    if (!client || !client.roomCode) {
        return;
    }

    const roomCode = client.roomCode;
    const room = roomsByCode.get(roomCode);

    client.roomCode = null;
    client.ready = false;

    if (!room) {
        return;
    }

    room.playerIds = room.playerIds.filter(existingPlayerId => existingPlayerId !== playerId);
    room.updatedAtMs = Date.now();

    const roomGameState = roomGameStateByCode.get(roomCode);
    if (roomGameState) {
        roomGameState.playersById.delete(playerId);
        roomGameState.lastInputByPlayerId.delete(playerId);
        roomGameState.inputQueueByPlayerId.delete(playerId);
        roomGameState.projectiles = roomGameState.projectiles.filter(projectile => (
            projectile.shooterPlayerId !== playerId && projectile.targetPlayerId !== playerId
        ));
        roomGameState.bombs = roomGameState.bombs.filter(bomb => bomb.ownerPlayerId !== playerId);
    }

    broadcastToRoom(roomCode, {
        type: 'player_left',
        playerId,
    });

    if (room.playerIds.length === 0) {
        stopServerLoop(roomCode);
        roomsByCode.delete(roomCode);
        return;
    }

    if (room.hostPlayerId === playerId) {
        room.hostPlayerId = room.playerIds[0];
        broadcastToRoom(roomCode, {
            type: 'host_changed',
            hostPlayerId: room.hostPlayerId,
        });
    }

    sendRoomUpdate(roomCode);
}

function joinRoom(playerId: string, roomCode: string, displayName: string, customization: Partial<PlayerCustomization> | undefined): void {
    const client = clientsById.get(playerId);
    if (!client) {
        return;
    }

    const normalizedRoomCode = sanitizeRoomCode(roomCode);
    const room = roomsByCode.get(normalizedRoomCode);

    if (!room) {
        sendError(playerId, 'ROOM_NOT_FOUND', 'Room code does not exist');
        return;
    }

    if (room.started) {
        sendError(playerId, 'ROOM_ALREADY_STARTED', 'Match already started for this room');
        return;
    }

    if (room.playerIds.length >= MAX_ROOM_PLAYERS) {
        sendError(playerId, 'ROOM_FULL', 'Room is already full');
        return;
    }

    leaveCurrentRoom(playerId);

    client.displayName = normalizeDisplayName(displayName);
    client.customization = sanitizeCustomization(customization);
    client.ready = false;
    client.roomCode = normalizedRoomCode;

    room.playerIds.push(playerId);
    room.updatedAtMs = Date.now();

    sendToClient(playerId, {
        type: 'room_joined',
        playerId,
        room: roomToSummary(room),
    });

    sendRoomUpdate(normalizedRoomCode);
}

function createRoom(playerId: string, displayName: string, customization: Partial<PlayerCustomization> | undefined): void {
    const client = clientsById.get(playerId);
    if (!client) {
        return;
    }

    leaveCurrentRoom(playerId);

    const roomCode = createUniqueRoomCode();
    const nowMs = Date.now();

    const room: RoomState = {
        code: roomCode,
        hostPlayerId: playerId,
        playerIds: [playerId],
        started: false,
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
    };

    client.displayName = normalizeDisplayName(displayName);
    client.customization = sanitizeCustomization(customization);
    client.ready = false;
    client.roomCode = roomCode;

    roomsByCode.set(roomCode, room);

    sendToClient(playerId, {
        type: 'room_joined',
        playerId,
        room: roomToSummary(room),
    });
}

function setReady(playerId: string, ready: boolean): void {
    const client = clientsById.get(playerId);
    if (!client || !client.roomCode) {
        sendError(playerId, 'NOT_IN_ROOM', 'You must join a room first');
        return;
    }

    const room = roomsByCode.get(client.roomCode);
    if (!room) {
        sendError(playerId, 'ROOM_NOT_FOUND', 'Current room no longer exists');
        return;
    }

    client.ready = ready;
    room.updatedAtMs = Date.now();
    sendRoomUpdate(room.code);
}

function startMatch(playerId: string): void {
    const client = clientsById.get(playerId);
    if (!client || !client.roomCode) {
        sendError(playerId, 'NOT_IN_ROOM', 'You must join a room first');
        return;
    }

    const room = roomsByCode.get(client.roomCode);
    if (!room) {
        sendError(playerId, 'ROOM_NOT_FOUND', 'Current room no longer exists');
        return;
    }

    if (room.hostPlayerId !== playerId) {
        sendError(playerId, 'HOST_ONLY', 'Only the room host can start the match');
        return;
    }

    if (room.playerIds.length < 2) {
        sendError(playerId, 'NOT_ENOUGH_PLAYERS', 'Need at least 2 players to start');
        return;
    }

    const everyoneReady = room.playerIds.every(roomPlayerId => clientsById.get(roomPlayerId)?.ready === true);
    if (!everyoneReady) {
        sendError(playerId, 'NOT_ALL_READY', 'All players must be ready before starting');
        return;
    }

    room.started = true;
    room.updatedAtMs = Date.now();

    // Ensure clients receive the final room roster (including all active players)
    // before handling match start.
    sendRoomUpdate(room.code);

    broadcastToRoom(room.code, {
        type: 'match_started',
        roomCode: room.code,
        hostPlayerId: room.hostPlayerId,
        startedAtMs: Date.now(),
        room: roomToSummary(room),
    });

    startServerLoop(room.code);
}

function handleClientMessage(playerId: string, message: ClientToServerMessage): void {
    switch (message.type) {
        case 'create_room':
            createRoom(playerId, message.displayName, message.customization);
            return;
        case 'join_room':
            joinRoom(playerId, message.roomCode, message.displayName, message.customization);
            return;
        case 'leave_room':
            leaveCurrentRoom(playerId);
            return;
        case 'set_ready':
            setReady(playerId, message.ready);
            return;
        case 'start_match':
            startMatch(playerId);
            return;
        case 'input_frame':
            enqueueInputFrame(playerId, message);
            return;
        case 'ping':
            sendToClient(playerId, {
                type: 'pong',
                clientTimeMs: message.clientTimeMs,
                serverTimeMs: Date.now(),
            });
            return;
    }
}

async function serveStaticRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const requestPath = new URL(request.url ?? '/', 'http://localhost').pathname;

    if (requestPath === '/health') {
        const payload = {
            ok: true,
            rooms: roomsByCode.size,
            clients: clientsById.size,
        };

        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify(payload));
        return;
    }

    const normalizedPath = requestPath === '/' ? '/index.html' : requestPath;
    const candidatePath = path.resolve(clientDistDir, `.${normalizedPath}`);

    if (!candidatePath.startsWith(clientDistDir)) {
        response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Forbidden');
        return;
    }

    try {
        const fileContent = await readFile(candidatePath);
        response.writeHead(200, {
            'Content-Type': getMimeType(candidatePath),
            'Cache-Control': 'public, max-age=3600',
        });
        response.end(fileContent);
        return;
    } catch {
        // Fall through to SPA fallback.
    }

    const indexPath = path.join(clientDistDir, 'index.html');

    try {
        const indexContent = await readFile(indexPath);
        response.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
        });
        response.end(indexContent);
    } catch {
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Build output not found. Run "npm run build" before starting the server.');
    }
}


export function attachGameServer(server: import('node:http').Server): WebSocketServer {
    const wsServer = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
        if (pathname !== '/ws') {
            return;
        }

        wsServer.handleUpgrade(request, socket, head, upgradedSocket => {
            wsServer.emit('connection', upgradedSocket, request);
        });
    });

    wsServer.on('connection', socket => {
        const playerId = randomUUID();

        const client: ClientConnection = {
            playerId,
            socket,
            roomCode: null,
            displayName: `Player-${playerId.slice(0, 4).toUpperCase()}`,
            ready: false,
            customization: createDefaultCustomization(),
        };

        clientsById.set(playerId, client);
        clientIdsBySocket.set(socket, playerId);

        sendToClient(playerId, {
            type: 'connected',
            playerId,
        });

        socket.on('message', (data, isBinary) => {
            if (isBinary) {
                sendError(playerId, 'INVALID_PAYLOAD', 'Binary frames are not supported');
                return;
            }

            const payload = decodeWireMessage(data.toString());
            if (!payload || !isClientToServerMessage(payload)) {
                sendError(playerId, 'INVALID_MESSAGE', 'Message shape is not valid');
                return;
            }

            handleClientMessage(playerId, payload);
        });

        socket.on('close', () => {
            leaveCurrentRoom(playerId);
            clientIdsBySocket.delete(socket);
            clientsById.delete(playerId);
        });
    });

    return wsServer;
}

export function startStandaloneServer(port: number = Number(process.env.PORT ?? '3000')): import('node:http').Server {
    const httpServer = createServer((request, response) => {
        serveStaticRequest(request, response).catch(error => {
            console.error('Failed to serve request', error);
            response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end('Internal Server Error');
        });
    });

    attachGameServer(httpServer);

    httpServer.listen(port, () => {
        console.log(`Neon Rain server listening on port ${port}`);
        console.log(`Serving client from: ${clientDistDir}`);
    });

    return httpServer;
}

const isDirectRun = process.argv[1] && (
    process.argv[1].endsWith('server/index.ts')
    || process.argv[1].endsWith('server\\index.ts')
    || process.argv[1].endsWith('server/index.js')
    || process.argv[1].endsWith('server\\index.js')
);

if (isDirectRun) {
    startStandaloneServer();
}
