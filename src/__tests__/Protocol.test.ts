import { describe, expect, it } from 'vitest';
import {
    decodeWireMessage,
    encodeWireMessage,
    isClientToServerMessage,
    isServerToClientMessage,
} from '../multiplayer/protocol';

describe('Multiplayer protocol guards', () => {
    it('accepts valid client-to-server input frame messages', () => {
        const message = {
            type: 'input_frame',
            sequence: 14,
            input: {
                left: true,
                right: false,
                up: false,
                down: true,
                dash: false,
                deployBomb: false,
            },
        };

        expect(isClientToServerMessage(message)).toBe(true);
    });

    it('rejects malformed client-to-server messages', () => {
        const malformed = {
            type: 'input_frame',
            sequence: '14',
            input: {
                left: true,
                right: false,
                up: false,
                down: true,
                dash: false,
                deployBomb: false,
            },
        };

        expect(isClientToServerMessage(malformed)).toBe(false);
    });

    it('accepts valid server-to-client tick update messages', () => {
        const message = {
            type: 'tick_update',
            tick: 5,
            serverTimeMs: Date.now(),
            players: [
                {
                    playerId: 'host-id',
                    x: 220,
                    y: 440,
                    alive: true,
                    score: 8,
                    lastProcessedSeq: 18,
                    health: 100,
                    isShielded: false,
                    storedBombs: 0,
                },
            ],
            obstacles: [
                {
                    id: 'obs-1',
                    x: 120,
                    y: 140,
                    w: 42,
                    h: 18,
                    vy: 260,
                    color: '#ff0066',
                },
            ],
            powerups: [
                {
                    id: 'powerup-1',
                    x: 320,
                    y: 180,
                    type: 'heal',
                    collected: false,
                },
            ],
            projectiles: [
                {
                    id: 'projectile-2',
                    x: 250,
                    y: 340,
                    vx: 120,
                    vy: -80,
                    shooterPlayerId: 'host-id',
                    targetPlayerId: 'peer-id',
                    expiresInSeconds: 2.4,
                },
            ],
            bombs: [
                {
                    id: 'bomb-9',
                    x: 150,
                    y: 500,
                    ownerPlayerId: 'peer-id',
                    isExploding: false,
                    elapsedSeconds: 0.8,
                },
            ],
            events: [
                {
                    type: 'player_died',
                    tick: 5,
                    playerId: 'peer-id',
                },
            ],
        };

        expect(isServerToClientMessage(message)).toBe(true);
    });

    it('rejects removed client snapshot and game event messages', () => {
        expect(
            isClientToServerMessage({
                type: 'state_snapshot',
                tick: 1,
                snapshot: {
                    timestampMs: Date.now(),
                    gameTimeSeconds: 0,
                    roundState: 'playing',
                    score: 0,
                    players: [],
                    enemies: [],
                    projectiles: [],
                    bombs: [],
                    powerups: [],
                },
            })
        ).toBe(false);

        expect(
            isClientToServerMessage({
                type: 'game_event',
                event: {
                    kind: 'test',
                    emittedAtMs: Date.now(),
                },
            })
        ).toBe(false);
    });

    it('accepts valid match_started messages with room summary', () => {
        const message = {
            type: 'match_started',
            roomCode: 'ABC123',
            hostPlayerId: 'host-id',
            startedAtMs: Date.now(),
            room: {
                code: 'ABC123',
                hostPlayerId: 'host-id',
                started: true,
                maxPlayers: 4,
                players: [
                    {
                        playerId: 'host-id',
                        displayName: 'Host',
                        ready: true,
                        customization: { color: '#00ffff', model: 'core', hat: 'none' },
                    },
                    {
                        playerId: 'peer-id',
                        displayName: 'Peer',
                        ready: true,
                        customization: { color: '#ff00ff', model: 'cross', hat: 'cap' },
                    },
                ],
            },
        };

        expect(isServerToClientMessage(message)).toBe(true);
    });

    it('encodes and decodes wire payloads consistently', () => {
        const original = {
            type: 'ping' as const,
            clientTimeMs: Date.now(),
        };

        const encoded = encodeWireMessage(original);
        const decoded = decodeWireMessage(encoded);

        expect(decoded).toEqual(original);
    });
});
