import type { InputFrameState } from '../multiplayer/protocol.js';

export const SERVER_TICK_RATE = 60;
export const SERVER_FIXED_DELTA_SECONDS = 1 / SERVER_TICK_RATE;

export const SERVER_WORLD_WIDTH = 800;
export const SERVER_WORLD_HEIGHT = 600;

export const PLAYER_SIZE = 30;
export const PLAYER_BASE_SPEED = 400;
export const PLAYER_DASH_MULTIPLIER = 2;
export const POWERUP_SIZE = 25;
export const POWERUP_SPAWN_INTERVAL_SECONDS = 8;

export const OBSTACLE_SPEED = 220;
export const OBSTACLE_SPAWN_INTERVAL_SECONDS = 0.95;
export const OBSTACLE_EDGE_BAND_WIDTH = 100;

const NORMAL_OBSTACLE_MIN_WIDTH = 28;
const NORMAL_OBSTACLE_MAX_WIDTH = 64;
const NORMAL_OBSTACLE_MIN_HEIGHT = 14;

const WIDE_OBSTACLE_MIN_WIDTH = 90;
const WIDE_OBSTACLE_MAX_WIDTH = 170;
const WIDE_OBSTACLE_HEIGHT = 12;

const EDGE_OBSTACLE_MIN_SIZE = 30;
const EDGE_OBSTACLE_MAX_SIZE = 52;

const OBSTACLE_COLOR_PALETTE = [
    '#ff00ff',
    '#ff0066',
    '#ff3300',
    '#ffff00',
    '#ff6600',
    '#cc00ff',
    '#00ff00',
];

const POWERUP_TYPES = ['bomb', 'shield', 'gun', 'heal'] as const;
const POWERUP_MARGIN = 60;

type PowerupCollectionResult = {
    playerId: string;
    powerupId: string;
};

export interface SimPlayerState {
    playerId: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    alive: boolean;
    score: number;
    lastProcessedSeq: number;
}

export interface SimObstacleState {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    vx: number;
    vy: number;
    color: string;
}

export type SimPowerupType = typeof POWERUP_TYPES[number];

export interface SimPowerupState {
    id: string;
    x: number;
    y: number;
    type: SimPowerupType;
    collected: boolean;
}

export function createNeutralInputState(): InputFrameState {
    return {
        left: false,
        right: false,
        up: false,
        down: false,
        dash: false,
        deployBomb: false,
    };
}

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
}

export function createSpawnPosition(
    slotIndex: number,
    totalSlots: number,
    worldWidth: number = SERVER_WORLD_WIDTH,
    worldHeight: number = SERVER_WORLD_HEIGHT,
    playerSize: number = PLAYER_SIZE
): { x: number; y: number } {
    const safeSlots = Math.max(2, Math.floor(totalSlots));
    const safeSlotIndex = clamp(Math.floor(slotIndex), 0, safeSlots - 1);

    if (safeSlots <= 2) {
        const x = safeSlotIndex === 0
            ? worldWidth / 4 - playerSize / 2
            : (worldWidth * 3) / 4 - playerSize / 2;

        return {
            x,
            y: worldHeight - playerSize - 50,
        };
    }

    return {
        x: ((safeSlotIndex + 1) / (safeSlots + 1)) * worldWidth - playerSize / 2,
        y: worldHeight - playerSize - 50,
    };
}

export function applyInputToPlayer(
    player: SimPlayerState,
    input: InputFrameState,
    deltaSeconds: number,
    worldWidth: number = SERVER_WORLD_WIDTH,
    worldHeight: number = SERVER_WORLD_HEIGHT,
    playerSize: number = PLAYER_SIZE
): void {
    if (!player.alive || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
        player.vx = 0;
        player.vy = 0;
        return;
    }

    const axisX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const axisY = (input.down ? 1 : 0) - (input.up ? 1 : 0);

    const speedMultiplier = input.dash ? PLAYER_DASH_MULTIPLIER : 1;
    const movementSpeed = PLAYER_BASE_SPEED * speedMultiplier;

    player.vx = axisX * movementSpeed;
    player.vy = axisY * movementSpeed;

    player.x += player.vx * deltaSeconds;
    player.y += player.vy * deltaSeconds;

    player.x = clamp(player.x, 0, worldWidth - playerSize);
    player.y = clamp(player.y, 0, worldHeight - playerSize);
}

export function advancePlayerWithVelocity(
    player: SimPlayerState,
    deltaSeconds: number,
    worldWidth: number = SERVER_WORLD_WIDTH,
    worldHeight: number = SERVER_WORLD_HEIGHT,
    playerSize: number = PLAYER_SIZE
): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0 || !player.alive) {
        return;
    }

    player.x += player.vx * deltaSeconds;
    player.y += player.vy * deltaSeconds;
    player.x = clamp(player.x, 0, worldWidth - playerSize);
    player.y = clamp(player.y, 0, worldHeight - playerSize);
}

export function spawnObstacle(
    obstacleIndex: number,
    worldWidth: number = SERVER_WORLD_WIDTH,
    randomValue: () => number = Math.random
): SimObstacleState {
    const variantRoll = randomValue();

    let width = NORMAL_OBSTACLE_MIN_WIDTH + randomValue() * (NORMAL_OBSTACLE_MAX_WIDTH - NORMAL_OBSTACLE_MIN_WIDTH);
    let height = Math.max(NORMAL_OBSTACLE_MIN_HEIGHT, width * 0.35);
    let x = 0;

    if (variantRoll < 0.2) {
        width = WIDE_OBSTACLE_MIN_WIDTH + randomValue() * (WIDE_OBSTACLE_MAX_WIDTH - WIDE_OBSTACLE_MIN_WIDTH);
        height = WIDE_OBSTACLE_HEIGHT;
        const maxSpawnX = Math.max(0, worldWidth - width);
        x = randomValue() * maxSpawnX;
    } else if (variantRoll < 0.35) {
        const edgeSize = EDGE_OBSTACLE_MIN_SIZE + randomValue() * (EDGE_OBSTACLE_MAX_SIZE - EDGE_OBSTACLE_MIN_SIZE);
        width = edgeSize;
        height = edgeSize;

        const maxSpawnX = Math.max(0, worldWidth - width);
        const bandWidth = Math.min(OBSTACLE_EDGE_BAND_WIDTH, maxSpawnX);
        const spawnOnLeft = randomValue() < 0.5;

        if (spawnOnLeft) {
            x = randomValue() * bandWidth;
        } else {
            x = Math.max(0, maxSpawnX - randomValue() * bandWidth);
        }
    } else {
        const maxSpawnX = Math.max(0, worldWidth - width);
        x = randomValue() * maxSpawnX;
    }

    const colorIndex = Math.floor(randomValue() * OBSTACLE_COLOR_PALETTE.length);
    const clampedColorIndex = clamp(colorIndex, 0, OBSTACLE_COLOR_PALETTE.length - 1);
    const speedMultiplier = 0.65 + randomValue();

    return {
        id: `obstacle-${obstacleIndex}`,
        x,
        y: -height,
        w: width,
        h: height,
        vx: 0,
        vy: OBSTACLE_SPEED * speedMultiplier,
        color: OBSTACLE_COLOR_PALETTE[clampedColorIndex],
    };
}

export function spawnPowerup(
    powerupIndex: number,
    worldWidth: number = SERVER_WORLD_WIDTH,
    worldHeight: number = SERVER_WORLD_HEIGHT,
    randomValue: () => number = Math.random
): SimPowerupState {
    const spawnRangeX = Math.max(0, worldWidth - POWERUP_MARGIN * 2);
    const spawnRangeY = Math.max(0, worldHeight - POWERUP_MARGIN * 3);

    const x = POWERUP_MARGIN + randomValue() * spawnRangeX;
    const y = POWERUP_MARGIN + randomValue() * spawnRangeY;

    const typeIndex = Math.floor(randomValue() * POWERUP_TYPES.length);
    const clampedTypeIndex = clamp(typeIndex, 0, POWERUP_TYPES.length - 1);

    return {
        id: `powerup-${powerupIndex}`,
        x,
        y,
        type: POWERUP_TYPES[clampedTypeIndex],
        collected: false,
    };
}

export function updateObstacles(
    obstacles: SimObstacleState[],
    deltaSeconds: number,
    worldHeight: number = SERVER_WORLD_HEIGHT
): SimObstacleState[] {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
        return obstacles;
    }

    return obstacles
        .map(obstacle => ({
            ...obstacle,
            x: obstacle.x + obstacle.vx * deltaSeconds,
            y: obstacle.y + obstacle.vy * deltaSeconds,
        }))
        .filter(obstacle => obstacle.y <= worldHeight + obstacle.h);
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

export function detectObstacleCollisions(
    players: Iterable<SimPlayerState>,
    obstacles: SimObstacleState[],
    playerSize: number = PLAYER_SIZE
): string[] {
    const collisions = new Set<string>();

    for (const player of players) {
        if (!player.alive) {
            continue;
        }

        const playerRect = {
            x: player.x,
            y: player.y,
            w: playerSize,
            h: playerSize,
        };

        for (const obstacle of obstacles) {
            if (!intersectsAabb(playerRect, obstacle)) {
                continue;
            }

            collisions.add(player.playerId);
            break;
        }
    }

    return Array.from(collisions);
}

export function detectPowerupCollections(
    players: Iterable<SimPlayerState>,
    powerups: SimPowerupState[],
    playerSize: number = PLAYER_SIZE,
    powerupSize: number = POWERUP_SIZE
): PowerupCollectionResult[] {
    const collections: PowerupCollectionResult[] = [];
    const claimedPowerupIds = new Set<string>();

    for (const player of players) {
        if (!player.alive) {
            continue;
        }

        const playerRect = {
            x: player.x,
            y: player.y,
            w: playerSize,
            h: playerSize,
        };

        for (const powerup of powerups) {
            if (powerup.collected || claimedPowerupIds.has(powerup.id)) {
                continue;
            }

            const powerupRect = {
                x: powerup.x,
                y: powerup.y,
                w: powerupSize,
                h: powerupSize,
            };

            if (!intersectsAabb(playerRect, powerupRect)) {
                continue;
            }

            claimedPowerupIds.add(powerup.id);
            collections.push({
                playerId: player.playerId,
                powerupId: powerup.id,
            });
            break;
        }
    }

    return collections;
}

export function lerp(start: number, end: number, alpha: number): number {
    const normalizedAlpha = clamp(alpha, 0, 1);
    return start + (end - start) * normalizedAlpha;
}
