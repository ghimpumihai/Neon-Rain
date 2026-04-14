import { GameConfig, type CubeHatType, type CubeModelType, type PlayerSlotConfig } from './interfaces';
import { GameState, GameOverScreen } from './GameState';
import { InputHandler, PLAYER_1_KEYS, PLAYER_2_KEYS, type InputState } from '../systems/InputHandler';
import { Player, PLAYER_1_CONFIG, PLAYER_2_CONFIG } from '../entities/Player';
import { EnemyManager } from '../systems/EnemyManager';
import { checkCollisionWithArray, checkAABBCollision, getCollisionOverlap } from '../systems/Collision';
import { ParticleSystem } from '../systems/Particles';
import { PowerupManager } from '../systems/PowerupManager';
import { PowerupType } from '../entities/Powerup';
import { Bomb } from '../entities/Bomb';
import { Projectile } from '../entities/Projectile';
import { ObjectPool } from '../utils/ObjectPool';
import type {
    BombSnapshot,
    GameSnapshot,
    PlayerSnapshot,
    ProjectileSnapshot,
    SnapshotRoundState,
} from '../multiplayer/protocol';
import {
    DEFAULT_BACKGROUND_COLOR,
    DEFAULT_CANVAS_HEIGHT,
    DEFAULT_CANVAS_WIDTH,
    HEAL_POWERUP_AMOUNT,
    MAP_BORDER_COLOR,
    MAP_BORDER_THICKNESS,
} from '../constants/gameplay';

type PlayerInputResolver = (player: Player, index: number) => InputState | undefined;
type NetworkRole = 'local' | 'host' | 'client';

/**
 * The main Game class - the brain of Neon Rain
 * Supports 1v1 Competitive PvP Mode
 */
export class Game {
    private static readonly MIN_WORLD_WIDTH = 200;
    private static readonly MIN_WORLD_HEIGHT = 200;

    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private lastTime: number = 0;
    private isRunning: boolean = false;
    private config: GameConfig;

    // Game state
    private gameState: GameState = GameState.PLAYING;
    private gameOverScreen: GameOverScreen;
    private score: number = 0;
    private gameTime: number = 0;
    private winner: Player | null = null;

    // Game objects
    // Note: inputs field is defined but not directly used - players have their own InputHandler references
    private players: Player[] = [];
    private playerInputResolver?: PlayerInputResolver;
    private networkRole: NetworkRole = 'local';
    private networkPlayerOrder: string[] = [];
    private networkLocalPlayerId: string | null = null;
    private enemyManager: EnemyManager;
    private particles: ParticleSystem;
    private powerupManager: PowerupManager;

    // Projectiles and Bombs with pooling
    private projectilePool: ObjectPool<Projectile>;
    private bombs: Bomb[] = [];

    // Player trail tracking
    private lastPlayerPositions: { x: number; y: number }[] = [];
    private trailTimer: number = 0;

    // Debug info
    private frameCount: number = 0;
    private fps: number = 0;
    private fpsUpdateTime: number = 0;
    private simulationAccumulatorSeconds: number = 0;

    // Arena visuals
    private readonly mapBorderThickness: number = MAP_BORDER_THICKNESS;
    private readonly mapBorderColor: string = MAP_BORDER_COLOR;

    private readonly frameScheduler = globalThis as {
        requestAnimationFrame?: (callback: FrameRequestCallback) => number;
    };
    private readonly fpsLimit: number;
    private readonly minFrameIntervalSeconds: number;
    private readonly simulationStepSeconds: number = 1 / 120;
    private readonly maxSimulationStepsPerFrame: number = 12;
    private readonly maxElapsedSecondsPerFrame: number = 0.25;
    private readonly enableParticles: boolean;
    private readonly enableTrailParticles: boolean;
    private readonly enableMapGlow: boolean;
    private readonly showFpsHud: boolean;

    private static readonly MULTIPLAYER_FALLBACK_COLORS = ['#00ffff', '#ff00ff', '#39ff14', '#ff9100'];

    constructor(canvasId: string, config?: Partial<GameConfig>) {
        // Get the canvas element
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) {
            throw new Error(`Canvas element with id "${canvasId}" not found`);
        }
        this.canvas = canvas;

        // Get the 2D rendering context
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get 2D context from canvas');
        }
        this.ctx = ctx;

        const rawFpsLimit = config?.fpsLimit;
        const normalizedFpsLimit =
            typeof rawFpsLimit === 'number' && Number.isFinite(rawFpsLimit) && rawFpsLimit > 0
                ? Math.floor(rawFpsLimit)
                : 0;
        this.fpsLimit = normalizedFpsLimit;
        this.minFrameIntervalSeconds = normalizedFpsLimit > 0 ? 1 / normalizedFpsLimit : 0;
        this.enableParticles = config?.enableParticles ?? true;
        this.enableTrailParticles = config?.enableTrailParticles ?? true;
        this.enableMapGlow = config?.enableMapGlow ?? true;
        this.showFpsHud = config?.showFpsHud ?? true;

        // Set default configuration
        this.config = {
            canvasWidth: config?.canvasWidth ?? DEFAULT_CANVAS_WIDTH,
            canvasHeight: config?.canvasHeight ?? DEFAULT_CANVAS_HEIGHT,
            backgroundColor: config?.backgroundColor ?? DEFAULT_BACKGROUND_COLOR,
            fpsLimit: normalizedFpsLimit > 0 ? normalizedFpsLimit : undefined,
            enableParticles: this.enableParticles,
            enableTrailParticles: this.enableTrailParticles,
            enableMapGlow: this.enableMapGlow,
            showFpsHud: this.showFpsHud,
            player1Color: config?.player1Color,
            player2Color: config?.player2Color,
            player1Model: config?.player1Model,
            player2Model: config?.player2Model,
            player1Hat: config?.player1Hat,
            player2Hat: config?.player2Hat,
        };

        // Apply canvas dimensions
        this.canvas.width = this.config.canvasWidth;
        this.canvas.height = this.config.canvasHeight;

        const player1Color = this.config.player1Color ?? PLAYER_1_CONFIG.color ?? '#00ffff';
        const player2Color = this.config.player2Color ?? PLAYER_2_CONFIG.color ?? '#ff00ff';
        const player1Model = this.config.player1Model ?? PLAYER_1_CONFIG.model ?? 'core';
        const player2Model = this.config.player2Model ?? PLAYER_2_CONFIG.model ?? 'core';
        const player1Hat = this.config.player1Hat ?? PLAYER_1_CONFIG.hat ?? 'none';
        const player2Hat = this.config.player2Hat ?? PLAYER_2_CONFIG.hat ?? 'none';

        this.players = this.createPlayers(config?.playerSlots, {
            player1Color,
            player2Color,
            player1Model,
            player2Model,
            player1Hat,
            player2Hat,
        });

        // Initialize last positions for trail tracking
        this.lastPlayerPositions = this.players.map(p => ({ x: p.position.x, y: p.position.y }));

        // Initialize managers
        this.enemyManager = new EnemyManager({
            canvasWidth: this.config.canvasWidth,
            canvasHeight: this.config.canvasHeight,
        });

        this.powerupManager = new PowerupManager(
            this.config.canvasWidth,
            this.config.canvasHeight
        );

        // Initialize game over screen
        this.gameOverScreen = new GameOverScreen(
            this.config.canvasWidth,
            this.config.canvasHeight
        );

        // Initialize particle system
        this.particles = new ParticleSystem(800);

        // Initialize projectile pool
        const defaultShooter = this.players[0];
        const defaultTarget = this.players[1] ?? this.players[0];
        this.projectilePool = new ObjectPool<Projectile>(
            () => new Projectile(0, 0, defaultShooter, defaultTarget),
            20, // Pre-allocate 20 projectiles
            (proj) => proj.reset()
        );

        // Listen for restart input
        window.addEventListener('keydown', (e) => this.handleGlobalInput(e));

        console.log('🎮 Neon Rain - Competitive PvP Mode initialized!');
        console.log('⚔️  Objective: Defeat the other player!');
    }

    private createPlayers(
        playerSlots: PlayerSlotConfig[] | undefined,
        defaults: {
            player1Color: string;
            player2Color: string;
            player1Model: CubeModelType;
            player2Model: CubeModelType;
            player1Hat: CubeHatType;
            player2Hat: CubeHatType;
        }
    ): Player[] {
        const sanitizedSlots = playerSlots?.filter(Boolean) ?? [];

        if (sanitizedSlots.length >= 2) {
            const totalSlots = sanitizedSlots.length;

            return sanitizedSlots.map((slot, index) => {
                const fallbackColor = Game.MULTIPLAYER_FALLBACK_COLORS[index % Game.MULTIPLAYER_FALLBACK_COLORS.length];
                const fallbackModel = index === 0 ? defaults.player1Model : index === 1 ? defaults.player2Model : 'core';
                const fallbackHat = index === 0 ? defaults.player1Hat : index === 1 ? defaults.player2Hat : 'none';
                const resolvedColor = slot.color ?? fallbackColor;

                return new Player(
                    this.config.canvasWidth,
                    this.config.canvasHeight,
                    null,
                    {
                        ...PLAYER_1_CONFIG,
                        color: resolvedColor,
                        glowColor: resolvedColor,
                        model: slot.model ?? fallbackModel,
                        hat: slot.hat ?? fallbackHat,
                        playerNumber: index + 1,
                        label: slot.label ?? `P${index + 1}`,
                        spawnSlotIndex: index,
                        spawnSlots: totalSlots,
                    }
                );
            });
        }

        // Local/offline mode keeps two keyboard-controlled players.
        const input1 = new InputHandler(PLAYER_1_KEYS, 'P1');
        const input2 = new InputHandler(PLAYER_2_KEYS, 'P2');

        const player1 = new Player(
            this.config.canvasWidth,
            this.config.canvasHeight,
            input1,
            {
                ...PLAYER_1_CONFIG,
                color: defaults.player1Color,
                glowColor: defaults.player1Color,
                model: defaults.player1Model,
                hat: defaults.player1Hat,
                spawnSlotIndex: 0,
                spawnSlots: 2,
            }
        );
        const player2 = new Player(
            this.config.canvasWidth,
            this.config.canvasHeight,
            input2,
            {
                ...PLAYER_2_CONFIG,
                color: defaults.player2Color,
                glowColor: defaults.player2Color,
                model: defaults.player2Model,
                hat: defaults.player2Hat,
                spawnSlotIndex: 1,
                spawnSlots: 2,
            }
        );

        return [player1, player2];
    }

    /**
     * Handle global input (for restart, etc.)
     */
    private handleGlobalInput(event: KeyboardEvent): void {
        if (this.gameState === GameState.GAME_OVER) {
            if (event.code === 'Space' || event.code === 'Enter') {
                this.restart();
            }
        }
    }

    /**
     * Start the game loop
     */
    public start(): void {
        if (this.isRunning) {
            console.warn('Game is already running');
            return;
        }

        this.isRunning = true;
        this.lastTime = performance.now();
        console.log(
            this.fpsLimit > 0
                ? `▶️ Game loop started (capped at ${this.fpsLimit} FPS)`
                : '▶️ Game loop started'
        );

        this.scheduleNextFrame();
    }

    /**
     * Stop the game loop
     */
    public stop(): void {
        this.isRunning = false;
        console.log('⏹️ Game loop stopped');
    }

    /**
     * Restart the game
     */
    public restart(): void {
        console.log('🔄 Restarting game...');

        this.gameState = GameState.PLAYING;
        this.score = 0;
        this.gameTime = 0;
        this.simulationAccumulatorSeconds = 0;
        this.winner = null;

        this.players.forEach(player => player.reset());
        this.lastPlayerPositions = this.players.map(p => ({ x: p.position.x, y: p.position.y }));

        this.enemyManager.reset();
        this.powerupManager.reset();
        this.particles.clear();
        this.projectilePool.clear();
        this.bombs = [];

        this.gameOverScreen.reset();
    }

    private normalizeWorldWidth(width: number): number {
        if (!Number.isFinite(width)) {
            return this.config.canvasWidth;
        }

        return Math.max(Game.MIN_WORLD_WIDTH, Math.floor(width));
    }

    private normalizeWorldHeight(height: number): number {
        if (!Number.isFinite(height)) {
            return this.config.canvasHeight;
        }

        return Math.max(Game.MIN_WORLD_HEIGHT, Math.floor(height));
    }

    private clampEntityToWorld(entity: { position: { x: number; y: number }; width: number; height: number }): void {
        const maxX = Math.max(0, this.config.canvasWidth - entity.width);
        const maxY = Math.max(0, this.config.canvasHeight - entity.height);

        if (entity.position.x < 0) {
            entity.position.x = 0;
        } else if (entity.position.x > maxX) {
            entity.position.x = maxX;
        }

        if (entity.position.y < 0) {
            entity.position.y = 0;
        } else if (entity.position.y > maxY) {
            entity.position.y = maxY;
        }
    }

    public resizeWorld(
        canvasWidth: number,
        canvasHeight: number,
        options?: { preserveEntityPositions?: boolean }
    ): void {
        const normalizedWidth = this.normalizeWorldWidth(canvasWidth);
        const normalizedHeight = this.normalizeWorldHeight(canvasHeight);

        if (normalizedWidth === this.config.canvasWidth && normalizedHeight === this.config.canvasHeight) {
            return;
        }

        const previousWidth = this.config.canvasWidth;
        const previousHeight = this.config.canvasHeight;
        const scaleX = previousWidth > 0 ? normalizedWidth / previousWidth : 1;
        const scaleY = previousHeight > 0 ? normalizedHeight / previousHeight : 1;
        const preserveEntityPositions = options?.preserveEntityPositions ?? true;
        const entityScaleX = preserveEntityPositions ? scaleX : 1;
        const entityScaleY = preserveEntityPositions ? scaleY : 1;

        this.config.canvasWidth = normalizedWidth;
        this.config.canvasHeight = normalizedHeight;

        this.canvas.width = normalizedWidth;
        this.canvas.height = normalizedHeight;

        this.players.forEach(player => {
            player.resizeWorld(normalizedWidth, normalizedHeight, {
                scaleX: entityScaleX,
                scaleY: entityScaleY,
                preservePosition: preserveEntityPositions,
            });
        });

        this.enemyManager.resizeWorld(normalizedWidth, normalizedHeight, entityScaleX, entityScaleY);
        this.powerupManager.resizeWorld(normalizedWidth, normalizedHeight, entityScaleX, entityScaleY);

        this.projectilePool.getActiveObjects().forEach(projectile => {
            projectile.position.x *= entityScaleX;
            projectile.position.y *= entityScaleY;
            this.clampEntityToWorld(projectile);
        });

        this.bombs.forEach(bomb => {
            bomb.position.x *= entityScaleX;
            bomb.position.y *= entityScaleY;
            this.clampEntityToWorld(bomb);
        });

        this.lastPlayerPositions = this.players.map(player => ({
            x: player.position.x,
            y: player.position.y,
        }));

        this.gameOverScreen.resize(normalizedWidth, normalizedHeight);
    }

    /**
     * The main game loop
     */
    private loop(currentTime: number): void {
        if (!this.isRunning) return;

        const elapsedSeconds = (currentTime - this.lastTime) / 1000;

        if (this.minFrameIntervalSeconds > 0 && elapsedSeconds < this.minFrameIntervalSeconds) {
            this.scheduleNextFrame();
            return;
        }

        const deltaTime = elapsedSeconds;
        this.lastTime = currentTime;

        const clampedElapsedSeconds = Math.min(deltaTime, this.maxElapsedSecondsPerFrame);
        this.simulationAccumulatorSeconds += clampedElapsedSeconds;

        let simulationSteps = 0;
        while (
            this.simulationAccumulatorSeconds >= this.simulationStepSeconds
            && simulationSteps < this.maxSimulationStepsPerFrame
        ) {
            this.update(this.simulationStepSeconds);
            this.simulationAccumulatorSeconds -= this.simulationStepSeconds;
            simulationSteps++;
        }

        // Prevent runaway catch-up under heavy stalls.
        if (simulationSteps >= this.maxSimulationStepsPerFrame) {
            this.simulationAccumulatorSeconds = 0;
        }

        // FPS counter
        this.frameCount++;
        this.fpsUpdateTime += deltaTime;
        if (this.fpsUpdateTime >= 1) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.fpsUpdateTime = 0;
        }

        this.draw();

        this.scheduleNextFrame();
    }

    private scheduleNextFrame(): void {
        const requestAnimationFrameFn = this.frameScheduler.requestAnimationFrame;

        if (typeof requestAnimationFrameFn !== 'function') {
            this.isRunning = false;
            return;
        }

        requestAnimationFrameFn((timestamp) => this.loop(timestamp));
    }

    /**
     * Update all game objects
     */
    private update(deltaTime: number): void {
        try {
            if (this.enableParticles) {
                this.particles.update(deltaTime);
            }

            if (this.gameState === GameState.PLAYING) {
                if (this.networkRole === 'client') {
                    this.updateClientReplica(deltaTime);
                    return;
                }

                this.gameTime += deltaTime;
                this.score = Math.floor(this.gameTime * 10);

                // Update Players
                this.players.forEach((player, index) => {
                    if (player.getIsAlive()) {
                        const resolvedInput = this.playerInputResolver?.(player, index);
                        player.update(deltaTime, resolvedInput);

                        const heldBombExpired = player.updateStoredBombTimers(deltaTime);
                        if (heldBombExpired) {
                            player.kill();
                            console.log(`💀 ${player.getLabel()} held a bomb too long and exploded!`);
                            this.handlePlayerDeath(player);
                        }
                    }
                });

                // Handle player-to-player collision (physics only)
                this.handlePlayercollisions();

                this.updatePlayerTrails(deltaTime);

                // Update Managers
                this.enemyManager.update(deltaTime);
                this.powerupManager.update(deltaTime);

                // Update Projectiles using pool
                const projectiles = this.projectilePool.getActiveObjects();
                projectiles.forEach(p => p.update(deltaTime));
                // Release expired projectiles
                projectiles.forEach(p => {
                    if (p.getIsExpired()) {
                        this.projectilePool.release(p);
                    }
                });

                // Update Bombs
                this.bombs.forEach(b => b.update(deltaTime));
                // Keep exploded bombs a bit longer for animation, then remove
                this.bombs = this.bombs.filter(b => !b.isFinished());

                // Check detections
                this.checkPowerupCollection();
                this.handleBombDeployInput();
                this.checkCollisions();
                this.checkPvPCollisions();
                this.checkGameEnd();
            } else if (this.gameState === GameState.GAME_OVER) {
                this.gameOverScreen.update(deltaTime);
            }
        } catch (e) {
            console.error("Game Loop Error:", e);
        }
    }

    private updateClientReplica(deltaTime: number): void {
        this.gameTime += deltaTime;

        const localPlayerIndex = this.getLocalPlayerIndex();
        if (localPlayerIndex !== null) {
            const localPlayer = this.players[localPlayerIndex];
            if (localPlayer?.getIsAlive()) {
                const resolvedInput = this.playerInputResolver?.(localPlayer, localPlayerIndex);
                localPlayer.update(deltaTime, resolvedInput);
            }
        }

        this.players.forEach((player, index) => {
            const isLocalPlayer = localPlayerIndex !== null && index === localPlayerIndex;
            if (isLocalPlayer || !player.getIsAlive()) {
                return;
            }

            player.advanceFromNetworkVelocity(deltaTime);
        });

        this.updatePlayerTrails(deltaTime);
        this.enemyManager.update(deltaTime);
        this.powerupManager.update(deltaTime);

        const projectiles = this.projectilePool.getActiveObjects();
        projectiles.forEach(p => p.update(deltaTime));
        projectiles.forEach(p => {
            if (p.getIsExpired()) {
                this.projectilePool.release(p);
            }
        });

        this.bombs.forEach(b => b.update(deltaTime));
        this.bombs = this.bombs.filter(b => !b.isFinished());
    }

    private spawnSparkles(
        x: number,
        y: number,
        color: string,
        count: number
    ): void {
        if (!this.enableParticles) {
            return;
        }

        this.particles.spawnSparkles(x, y, color, count);
    }

    private spawnExplosion(
        x: number,
        y: number,
        colors: string[],
        count: number
    ): void {
        if (!this.enableParticles) {
            return;
        }

        this.particles.spawnExplosion(x, y, colors, count);
    }

    /**
     * Handle physical collision between players (knockback)
     */
    private handlePlayercollisions(): void {
        for (let firstIndex = 0; firstIndex < this.players.length; firstIndex++) {
            const firstPlayer = this.players[firstIndex];
            if (!firstPlayer.getIsAlive()) {
                continue;
            }

            for (let secondIndex = firstIndex + 1; secondIndex < this.players.length; secondIndex++) {
                const secondPlayer = this.players[secondIndex];
                if (!secondPlayer.getIsAlive()) {
                    continue;
                }

                const overlap = getCollisionOverlap(firstPlayer.getBounds(), secondPlayer.getBounds());
                if (!overlap) {
                    continue;
                }

                console.log('🔥 Player collision detected!');

                const center1 = firstPlayer.getCenter();
                const center2 = secondPlayer.getCenter();
                const dx = center1.x - center2.x;
                const dy = center1.y - center2.y;

                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const nx = dx / dist;
                const ny = dy / dist;

                firstPlayer.applyKnockback(nx, ny, 300);
                secondPlayer.applyKnockback(-nx, -ny, 300);

                this.spawnSparkles(
                    firstPlayer.position.x + firstPlayer.width / 2 - (dx / 2),
                    firstPlayer.position.y + firstPlayer.height / 2 - (dy / 2),
                    '#ffffff',
                    2
                );
            }
        }
    }

    /**
     * Update player trail particles
     */
    private updatePlayerTrails(deltaTime: number): void {
        if (!this.enableParticles || !this.enableTrailParticles) {
            this.players.forEach((player, index) => {
                this.lastPlayerPositions[index].x = player.position.x;
                this.lastPlayerPositions[index].y = player.position.y;
            });
            this.trailTimer = 0;
            return;
        }

        this.trailTimer += deltaTime;

        this.players.forEach((player, index) => {
            if (!player.getIsAlive()) return;

            const velocityX = player.position.x - this.lastPlayerPositions[index].x;
            const velocityY = player.position.y - this.lastPlayerPositions[index].y;
            const isMoving = Math.abs(velocityX) > 0.5 || Math.abs(velocityY) > 0.5;
            const isDashing = player.getIsDashing();

            if (isMoving && this.trailTimer > 0.02) {
                const trailColor = isDashing ? '#ffffff' : player.getColor();
                const count = isDashing ? 5 : 2;

                this.particles.spawnTrail(
                    player.position.x + player.width / 2,
                    player.position.y + player.height / 2,
                    trailColor,
                    velocityX * 60,
                    velocityY * 60,
                    count
                );

                if (isDashing) {
                    this.spawnSparkles(
                        player.position.x + player.width / 2,
                        player.position.y + player.height / 2,
                        player.getColor(),
                        3
                    );
                }
            }
            this.lastPlayerPositions[index].x = player.position.x;
            this.lastPlayerPositions[index].y = player.position.y;
        });

        if (this.trailTimer > 0.02) {
            this.trailTimer = 0;
        }
    }

    /**
     * Check for powerup collection
     */
    private checkPowerupCollection(): void {
        this.players.forEach(player => {
            if (!player.getIsAlive()) return;

            const collectedType = this.powerupManager.checkCollection(player);
            if (collectedType) {
                this.activatePowerup(player, collectedType);

                // Spawn collection particles
                this.spawnSparkles(
                    player.position.x + player.width / 2,
                    player.position.y + player.height / 2,
                    '#ffffff',
                    10
                );
            }
        });
    }

    /**
     * Activate a collected powerup
     */
    private activatePowerup(player: Player, type: PowerupType): void {
        switch (type) {
            case PowerupType.SHIELD:
                player.activateShield(5); // 5 seconds shield
                break;

            case PowerupType.HEAL: {
                const healedAmount = player.heal(HEAL_POWERUP_AMOUNT);
                if (healedAmount > 0) {
                    this.spawnSparkles(
                        player.position.x + player.width / 2,
                        player.position.y + player.height / 2,
                        '#33ff99',
                        8
                    );
                }
                break;
            }

            case PowerupType.GUN:
                // Find the nearest alive opponent.
                const opponents = this.players.filter(p => p !== player && p.getIsAlive());
                const opponent = opponents.length > 0
                    ? opponents.reduce((closest, current) => {
                        const shooterCenter = player.getCenter();
                        const closestCenter = closest.getCenter();
                        const currentCenter = current.getCenter();

                        const closestDistanceSquared =
                            (closestCenter.x - shooterCenter.x) * (closestCenter.x - shooterCenter.x)
                            + (closestCenter.y - shooterCenter.y) * (closestCenter.y - shooterCenter.y);
                        const currentDistanceSquared =
                            (currentCenter.x - shooterCenter.x) * (currentCenter.x - shooterCenter.x)
                            + (currentCenter.y - shooterCenter.y) * (currentCenter.y - shooterCenter.y);

                        return currentDistanceSquared < closestDistanceSquared ? current : closest;
                    })
                    : null;
                if (opponent) {
                    // Fire 3 projectiles with delay
                    for (let i = 0; i < 3; i++) {
                        setTimeout(() => {
                            if (player.getIsAlive()) {
                                const proj = this.projectilePool.get();
                                proj.initialize(
                                    player.position.x + player.width / 2,
                                    player.position.y + player.height / 2,
                                    player,
                                    opponent
                                );
                            }
                        }, i * 400); // 400ms delay between shots
                    }
                }
                break;

            case PowerupType.BOMB:
                player.addStoredBomb(1);
                console.log(`💣 ${player.getLabel()} picked up a bomb (${player.getStoredBombs()} ready)`);
                break;
        }
    }

    /**
     * Handle bomb deployment input for both players.
     */
    private handleBombDeployInput(): void {
        this.players.forEach(player => {
            if (!player.getIsAlive()) return;

            const wantsToDeployBomb = player.consumeBombDeployInput();
            if (!wantsToDeployBomb) return;

            if (player.consumeStoredBomb()) {
                this.deployBomb(player);
            }
        });
    }

    /**
     * Spawn a bomb at the player's current center position.
     */
    private deployBomb(player: Player): void {
        const bomb = new Bomb(
            player.position.x + player.width / 2,
            player.position.y + player.height / 2,
            player
        );
        this.bombs.push(bomb);
        console.log(`💥 ${player.getLabel()} deployed a bomb`);
    }

    /**
     * Check collisions with enemies (falling rain)
     */
    private checkCollisions(): void {
        const enemies = this.enemyManager.getEnemies();

        this.players.forEach(player => {
            if (!player.getIsAlive()) return;

            const collidedEnemy = checkCollisionWithArray(player, enemies);
            if (collidedEnemy) {
                // Falling enemies are one-shot to keep difficulty consistent across frame rates.
                const died = player.takeDamage(player.getMaxHealth());

                // Visual feedback
                this.spawnSparkles(
                    player.position.x + player.width / 2,
                    player.position.y + player.height / 2,
                    player.getColor(),
                    5
                );

                if (died) {
                    this.handlePlayerDeath(player);
                }
            }
        });
    }

    /**
     * Check collisions for PvP elements (bombs, projectiles)
     */
    private checkPvPCollisions(): void {
        // Projectiles
        const projectiles = this.projectilePool.getActiveObjects();
        projectiles.forEach(proj => {
            if (proj.getIsExpired()) return;

            this.players.forEach(player => {
                // Don't hit the shooter
                if (player === proj.getShooter() || !player.getIsAlive()) return;

                if (checkAABBCollision(proj.getBounds(), player.getBounds())) {
                    const died = player.takeDamage(proj.getDamage());
                    proj.expire();

                    // Impact particles
                    this.spawnSparkles(
                        proj.position.x,
                        proj.position.y,
                        proj.getShooter().getColor(),
                        5
                    );

                    if (died) this.handlePlayerDeath(player);
                }
            });
        });

        // Bombs
        this.bombs.forEach(bomb => {
            if (bomb.getIsExploding()) {
                this.players.forEach(player => {
                    if (player.getIsAlive()) {
                        const hit = bomb.checkDamage(player);
                        if (hit) {
                            const died = player.takeDamage(bomb.getDamage());
                            if (died) this.handlePlayerDeath(player);
                        }
                    }
                });
            }
        });
    }

    /**
     * Handle player death event
     */
    private handlePlayerDeath(player: Player): void {
        console.log(`💀 ${player.getLabel()} eliminated!`);

        this.spawnExplosion(
            player.position.x + player.width / 2,
            player.position.y + player.height / 2,
            [player.getColor(), '#ffffff', '#ff0066'],
            60
        );
    }

    /**
     * Check if game ended (one player left)
     */
    private checkGameEnd(): void {
        const alivePlayers = this.players.filter(p => p.getIsAlive());

        if (alivePlayers.length <= 1) {
            // If 1 player left, they win. If 0, it's a draw.
            this.winner = alivePlayers.length === 1 ? alivePlayers[0] : null;

            this.gameState = GameState.GAME_OVER;
            this.gameOverScreen.setScore(this.score);
            this.gameOverScreen.reset(); // Stop animation

            console.log(this.winner ? `🏆 ${this.winner.getLabel()} Wins!` : '🏁 Draw!');
        }
    }

    private hasRenderSupport(): boolean {
        const context = this.ctx as Partial<CanvasRenderingContext2D>;

        return (
            typeof context.save === 'function' &&
            typeof context.restore === 'function' &&
            typeof context.beginPath === 'function' &&
            typeof context.arc === 'function' &&
            typeof context.strokeRect === 'function' &&
            typeof context.fillText === 'function'
        );
    }

    /**
     * Draw everything
     */
    private draw(): void {
        this.ctx.fillStyle = this.config.backgroundColor;
        this.ctx.fillRect(0, 0, this.config.canvasWidth, this.config.canvasHeight);

        if (!this.hasRenderSupport()) {
            return;
        }

        // Draw game elements in layer order
        if (this.enableParticles) {
            this.particles.draw(this.ctx);
        }
        this.bombs.forEach(b => b.draw(this.ctx));
        this.powerupManager.draw(this.ctx);
        this.enemyManager.draw(this.ctx); // Rain is foreground-ish
        this.players.forEach(p => p.draw(this.ctx));
        this.projectilePool.getActiveObjects().forEach(p => p.draw(this.ctx));
        this.drawMapBorder();

        this.drawHUD();

        if (this.gameState === GameState.GAME_OVER) {
            this.drawGameOver();
        }
    }

    /**
     * Draw custom Game Over screen for PvP
     */
    private drawGameOver(): void {
        this.ctx.save();

        // Darken background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.config.canvasWidth, this.config.canvasHeight);

        const cx = this.config.canvasWidth / 2;
        const cy = this.config.canvasHeight / 2;

        // Victory Message
        this.ctx.font = 'bold 48px monospace';
        this.ctx.textAlign = 'center';

        if (this.winner) {
            this.ctx.fillStyle = this.winner.getColor();
            this.ctx.shadowColor = this.winner.getColor();
            this.ctx.shadowBlur = 20;
            this.ctx.fillText(`${this.winner.getLabel()} WINS!`, cx, cy - 50);
        } else {
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillText("DRAW!", cx, cy - 50);
        }

        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '20px monospace';
        this.ctx.fillText("Press SPACE to Rematch", cx, cy + 50);

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        this.ctx.font = '16px monospace';
        this.ctx.fillText("Press M for Main Menu", cx, cy + 80);

        this.ctx.restore();
    }

    /**
     * Draw a visible border around the playable map area.
     */
    private drawMapBorder(): void {
        this.ctx.save();

        const lineWidth = this.mapBorderThickness;
        const inset = lineWidth / 2 + 1;
        const width = this.config.canvasWidth - inset * 2;
        const height = this.config.canvasHeight - inset * 2;

        this.ctx.strokeStyle = this.mapBorderColor;
        this.ctx.lineWidth = lineWidth;
        this.ctx.shadowBlur = this.enableMapGlow ? 10 : 0;
        this.ctx.shadowColor = this.enableMapGlow ? this.mapBorderColor : 'transparent';
        this.ctx.strokeRect(inset, inset, width, height);

        this.ctx.restore();
    }

    /**
     * Draw HUD
     */
    private drawHUD(): void {
        this.ctx.save();

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 20px monospace';
        this.ctx.textAlign = 'center';

        // Use time as a "survival timer" or simple round timer
        // No score needed for PvP really, but keeping it for now
        // this.ctx.fillText(`TIME: ${this.gameTime.toFixed(1)}`, this.config.canvasWidth / 2, 30);

        this.ctx.restore();

        // FPS
        if (!this.showFpsHud) {
            return;
        }

        this.ctx.save();
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.font = '12px monospace';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`FPS: ${this.fps}`, this.config.canvasWidth - 10, 20);
        this.ctx.restore();
    }

    public getCanvas(): HTMLCanvasElement { return this.canvas; }
    public getContext(): CanvasRenderingContext2D { return this.ctx; }
    public getConfig(): GameConfig { return { ...this.config }; }
    public getIsRunning(): boolean { return this.isRunning; }
    public getGameTime(): number { return this.gameTime; }
    public getGameState(): GameState { return this.gameState; }

    public setNetworkSyncContext(options?: {
        role?: NetworkRole;
        playerOrder?: string[];
        localPlayerId?: string | null;
    }): void {
        this.networkRole = options?.role ?? 'local';
        this.networkPlayerOrder = [...(options?.playerOrder ?? [])];
        this.networkLocalPlayerId = options?.localPlayerId ?? null;

        if (this.networkRole !== 'local') {
            this.resizeWorld(DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT, {
                preserveEntityPositions: false,
            });
        }

        const shouldRunSimulation = this.networkRole !== 'client';
        this.enemyManager.setSimulationEnabled(shouldRunSimulation);
        this.powerupManager.setSimulationEnabled(shouldRunSimulation);
    }

    public setPlayerInputResolver(resolver?: PlayerInputResolver): void {
        this.playerInputResolver = resolver;
    }

    public getPlayerInputState(playerIndex: number): InputState | null {
        const player = this.players[playerIndex];
        if (!player) {
            return null;
        }

        return player.getCurrentInputState();
    }

    public serializeSnapshot(playerOrder?: string[]): GameSnapshot {
        const resolvedPlayerOrder = this.resolvePlayerOrder(playerOrder);

        const players: PlayerSnapshot[] = this.players.map((player, index) => ({
            playerId: resolvedPlayerOrder[index],
            position: {
                x: player.position.x,
                y: player.position.y,
            },
            velocity: {
                x: player.velocity.x,
                y: player.velocity.y,
            },
            health: player.getHealth(),
            isAlive: player.getIsAlive(),
            isShielded: player.getIsShielded(),
            storedBombs: player.getStoredBombs(),
        }));

        const projectiles: ProjectileSnapshot[] = this.projectilePool.getActiveObjects().map((projectile, index) => ({
            projectileId: `projectile-${index}`,
            position: {
                x: projectile.position.x,
                y: projectile.position.y,
            },
            velocity: {
                x: projectile.velocity.x,
                y: projectile.velocity.y,
            },
            shooterPlayerId: this.resolvePlayerIdByReference(projectile.getShooter(), resolvedPlayerOrder),
            targetPlayerId: this.resolvePlayerIdByReference(projectile.getTarget(), resolvedPlayerOrder),
            expiresInSeconds: projectile.getRemainingLifetimeSeconds(),
        }));

        const bombs: BombSnapshot[] = this.bombs.map((bomb, index) => ({
            bombId: `bomb-${index}`,
            ownerPlayerId: this.resolvePlayerIdByReference(bomb.getOwner(), resolvedPlayerOrder),
            position: {
                x: bomb.position.x,
                y: bomb.position.y,
            },
            isExploding: bomb.getIsExploding(),
            elapsedSeconds: bomb.getElapsedSeconds(),
        }));

        return {
            timestampMs: Date.now(),
            gameTimeSeconds: this.gameTime,
            roundState: this.mapGameStateToRoundState(this.gameState),
            score: this.score,
            worldWidth: this.config.canvasWidth,
            worldHeight: this.config.canvasHeight,
            players,
            enemies: this.enemyManager.serializeEnemies(),
            projectiles,
            bombs,
            powerups: this.powerupManager.serializePowerups(),
        };
    }

    public applySnapshot(
        snapshot: GameSnapshot,
        playerOrder?: string[],
        localPlayerId?: string | null
    ): void {
        if (
            this.networkRole === 'local'
            && typeof snapshot.worldWidth === 'number'
            && typeof snapshot.worldHeight === 'number'
        ) {
            this.resizeWorld(snapshot.worldWidth, snapshot.worldHeight, { preserveEntityPositions: false });
        }

        const resolvedPlayerOrder = this.resolvePlayerOrder(playerOrder);
        const resolvedLocalPlayerId = localPlayerId ?? this.networkLocalPlayerId;

        this.gameTime = snapshot.gameTimeSeconds;
        this.score = snapshot.score;
        this.gameState = this.mapRoundStateToGameState(snapshot.roundState);

        this.players.forEach((player, index) => {
            const mappedPlayerId = resolvedPlayerOrder[index];
            const playerSnapshot = snapshot.players.find(snapshotPlayer => snapshotPlayer.playerId === mappedPlayerId)
                ?? snapshot.players[index];

            if (!playerSnapshot) {
                return;
            }

            const isLocalPlayer = mappedPlayerId === resolvedLocalPlayerId;
            player.applyNetworkSnapshot(playerSnapshot, {
                interpolatePosition: this.networkRole === 'client',
                smoothingAlpha: isLocalPlayer ? 0.18 : 0.25,
                jitterDeadZone: isLocalPlayer ? 2.5 : 1.1,
                snapDistanceThreshold: isLocalPlayer ? 320 : 340,
                preserveVelocity: this.networkRole === 'client' && isLocalPlayer,
            });
        });

        this.winner = this.players.find(player => player.getIsAlive()) ?? null;

        this.enemyManager.applySnapshotEnemies(snapshot.enemies);
        this.powerupManager.applySnapshotPowerups(snapshot.powerups);
        this.applyBombSnapshots(snapshot.bombs, resolvedPlayerOrder);
        this.applyProjectileSnapshots(snapshot.projectiles, resolvedPlayerOrder);
    }

    private applyBombSnapshots(bombSnapshots: BombSnapshot[], playerOrder: string[]): void {
        this.bombs = bombSnapshots.map(bombSnapshot => {
            const owner = this.resolvePlayerById(bombSnapshot.ownerPlayerId, playerOrder) ?? this.players[0];
            const bomb = new Bomb(
                bombSnapshot.position.x + 15,
                bombSnapshot.position.y + 15,
                owner
            );
            bomb.applySnapshotState(
                bombSnapshot.position,
                bombSnapshot.isExploding,
                bombSnapshot.elapsedSeconds
            );
            return bomb;
        });
    }

    private applyProjectileSnapshots(projectileSnapshots: ProjectileSnapshot[], playerOrder: string[]): void {
        this.projectilePool.clear();

        projectileSnapshots.forEach(projectileSnapshot => {
            const shooter = this.resolvePlayerById(projectileSnapshot.shooterPlayerId, playerOrder) ?? this.players[0];
            const target = this.resolvePlayerById(projectileSnapshot.targetPlayerId, playerOrder) ?? this.players[1] ?? this.players[0];

            const projectile = this.projectilePool.get();
            projectile.initialize(
                projectileSnapshot.position.x,
                projectileSnapshot.position.y,
                shooter,
                target
            );
            projectile.applySnapshotState(
                projectileSnapshot.position,
                projectileSnapshot.velocity,
                projectileSnapshot.expiresInSeconds
            );
        });
    }

    private resolvePlayerOrder(playerOrder?: string[]): string[] {
        const sourceOrder = playerOrder && playerOrder.length > 0
            ? playerOrder
            : this.networkPlayerOrder;

        return this.players.map((_, index) => sourceOrder[index] ?? `slot-${index}`);
    }

    private resolvePlayerIdByReference(player: Player, playerOrder: string[]): string {
        const index = this.players.indexOf(player);
        if (index < 0) {
            return 'unknown-player';
        }

        return playerOrder[index] ?? `slot-${index}`;
    }

    private resolvePlayerById(playerId: string, playerOrder: string[]): Player | null {
        const index = playerOrder.findIndex(orderPlayerId => orderPlayerId === playerId);
        if (index < 0) {
            return null;
        }

        return this.players[index] ?? null;
    }

    private getLocalPlayerIndex(): number | null {
        if (!this.networkLocalPlayerId) {
            return null;
        }

        const index = this.networkPlayerOrder.findIndex(playerId => playerId === this.networkLocalPlayerId);
        return index >= 0 ? index : null;
    }

    private mapGameStateToRoundState(gameState: GameState): SnapshotRoundState {
        switch (gameState) {
            case GameState.PLAYING:
                return 'playing';
            case GameState.GAME_OVER:
                return 'game_over';
            case GameState.MENU:
            case GameState.PAUSED:
            default:
                return 'lobby';
        }
    }

    private mapRoundStateToGameState(roundState: SnapshotRoundState): GameState {
        switch (roundState) {
            case 'playing':
                return GameState.PLAYING;
            case 'game_over':
                return GameState.GAME_OVER;
            case 'lobby':
            default:
                return GameState.MENU;
        }
    }
}
