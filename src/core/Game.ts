import { GameConfig } from './interfaces';
import { GameState, GameOverScreen } from './GameState';
import { InputHandler, PLAYER_1_KEYS, PLAYER_2_KEYS } from '../systems/InputHandler';
import { Player, PLAYER_1_CONFIG, PLAYER_2_CONFIG } from '../entities/Player';
import { EnemyManager } from '../systems/EnemyManager';
import { checkCollisionWithArray, checkAABBCollision, getCollisionOverlap } from '../systems/Collision';
import { ParticleSystem } from '../systems/Particles';
import { PowerupManager } from '../systems/PowerupManager';
import { PowerupType } from '../entities/Powerup';
import { Bomb } from '../entities/Bomb';
import { Projectile } from '../entities/Projectile';
import { ObjectPool } from '../utils/ObjectPool';
import {
    DEFAULT_BACKGROUND_COLOR,
    DEFAULT_CANVAS_HEIGHT,
    DEFAULT_CANVAS_WIDTH,
    HEAL_POWERUP_AMOUNT,
    MAP_BORDER_COLOR,
    MAP_BORDER_THICKNESS,
} from '../constants/gameplay';

/**
 * The main Game class - the brain of Neon Rain
 * Supports 1v1 Competitive PvP Mode
 */
export class Game {
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

    // Arena visuals
    private readonly mapBorderThickness: number = MAP_BORDER_THICKNESS;
    private readonly mapBorderColor: string = MAP_BORDER_COLOR;

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

        // Set default configuration
        this.config = {
            canvasWidth: config?.canvasWidth ?? DEFAULT_CANVAS_WIDTH,
            canvasHeight: config?.canvasHeight ?? DEFAULT_CANVAS_HEIGHT,
            backgroundColor: config?.backgroundColor ?? DEFAULT_BACKGROUND_COLOR,
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

        // Initialize input handlers for both players
        const input1 = new InputHandler(PLAYER_1_KEYS, 'P1');
        const input2 = new InputHandler(PLAYER_2_KEYS, 'P2');

        const player1Color = this.config.player1Color ?? PLAYER_1_CONFIG.color ?? '#00ffff';
        const player2Color = this.config.player2Color ?? PLAYER_2_CONFIG.color ?? '#800000';
        const player1Model = this.config.player1Model ?? PLAYER_1_CONFIG.model ?? 'core';
        const player2Model = this.config.player2Model ?? PLAYER_2_CONFIG.model ?? 'core';
        const player1Hat = this.config.player1Hat ?? PLAYER_1_CONFIG.hat ?? 'none';
        const player2Hat = this.config.player2Hat ?? PLAYER_2_CONFIG.hat ?? 'none';

        // Initialize players
        const player1 = new Player(
            this.config.canvasWidth,
            this.config.canvasHeight,
            input1,
            {
                ...PLAYER_1_CONFIG,
                color: player1Color,
                glowColor: player1Color,
                model: player1Model,
                hat: player1Hat,
            }
        );
        const player2 = new Player(
            this.config.canvasWidth,
            this.config.canvasHeight,
            input2,
            {
                ...PLAYER_2_CONFIG,
                color: player2Color,
                glowColor: player2Color,
                model: player2Model,
                hat: player2Hat,
            }
        );
        this.players = [player1, player2];

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
        this.projectilePool = new ObjectPool<Projectile>(
            () => new Projectile(0, 0, this.players[0], this.players[1]),
            20, // Pre-allocate 20 projectiles
            (proj) => proj.reset()
        );

        // Listen for restart input
        window.addEventListener('keydown', (e) => this.handleGlobalInput(e));

        console.log('🎮 Neon Rain - Competitive PvP Mode initialized!');
        console.log('⚔️  Objective: Defeat the other player!');
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
        console.log('▶️ Game loop started');

        requestAnimationFrame((timestamp) => this.loop(timestamp));
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

    /**
     * The main game loop
     */
    private loop(currentTime: number): void {
        if (!this.isRunning) return;

        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // FPS counter
        this.frameCount++;
        this.fpsUpdateTime += deltaTime;
        if (this.fpsUpdateTime >= 1) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.fpsUpdateTime = 0;
        }

        this.update(deltaTime);
        this.draw();

        requestAnimationFrame((timestamp) => this.loop(timestamp));
    }

    /**
     * Update all game objects
     */
    private update(deltaTime: number): void {
        try {
            this.particles.update(deltaTime);

            if (this.gameState === GameState.PLAYING) {
                this.gameTime += deltaTime;
                this.score = Math.floor(this.gameTime * 10);

                // Update Players
                this.players.forEach(player => {
                    if (player.getIsAlive()) {
                        player.update(deltaTime);

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

    /**
     * Handle physical collision between players (knockback)
     */
    private handlePlayercollisions(): void {
        const p1 = this.players[0];
        const p2 = this.players[1];

        if (!p1.getIsAlive() || !p2.getIsAlive()) return;

        const overlap = getCollisionOverlap(p1.getBounds(), p2.getBounds());

        if (overlap) {
            console.log('🔥 Player collision detected!');
            // Determine direction of push
            const center1 = p1.getCenter();
            const center2 = p2.getCenter();
            const dx = center1.x - center2.x;
            const dy = center1.y - center2.y;

            // Normalize
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = dx / dist;
            const ny = dy / dist;

            // Push players apart (force of 300)
            p1.applyKnockback(nx, ny, 300);
            p2.applyKnockback(-nx, -ny, 300);

            // Add simple particle pop at collision point
            this.particles.spawnSparkles(
                p1.position.x + p1.width / 2 - (dx / 2),
                p1.position.y + p1.height / 2 - (dy / 2),
                '#ffffff',
                2
            );
        }
    }

    /**
     * Update player trail particles
     */
    private updatePlayerTrails(deltaTime: number): void {
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
                    this.particles.spawnSparkles(
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
                this.particles.spawnSparkles(
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
                    this.particles.spawnSparkles(
                        player.position.x + player.width / 2,
                        player.position.y + player.height / 2,
                        '#33ff99',
                        8
                    );
                }
                break;
            }

            case PowerupType.GUN:
                // Find opponent
                const opponent = this.players.find(p => p !== player);
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
                // Enemies deal 20 damage
                const died = player.takeDamage(20);

                // Visual feedback
                this.particles.spawnSparkles(
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
                    this.particles.spawnSparkles(
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

        this.particles.spawnExplosion(
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

    /**
     * Draw everything
     */
    private draw(): void {
        this.ctx.fillStyle = this.config.backgroundColor;
        this.ctx.fillRect(0, 0, this.config.canvasWidth, this.config.canvasHeight);

        // Draw game elements in layer order
        this.particles.draw(this.ctx);
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
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = this.mapBorderColor;
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
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.font = '12px monospace';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`FPS: ${this.fps}`, this.config.canvasWidth - 10, 20);
        this.ctx.restore();
    }

    public getCanvas(): HTMLCanvasElement { return this.canvas; }
    public getContext(): CanvasRenderingContext2D { return this.ctx; }
    public getGameTime(): number { return this.gameTime; }
    public getGameState(): GameState { return this.gameState; }
}
