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
    private inputs: InputHandler[] = [];
    private players: Player[] = [];
    private enemyManager: EnemyManager;
    private particles: ParticleSystem;
    private powerupManager: PowerupManager;

    // Projectiles and Bombs
    private projectiles: Projectile[] = [];
    private bombs: Bomb[] = [];

    // Player trail tracking
    private lastPlayerPositions: { x: number; y: number }[] = [];
    private trailTimer: number = 0;

    // Debug info
    private frameCount: number = 0;
    private fps: number = 0;
    private fpsUpdateTime: number = 0;

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
            canvasWidth: config?.canvasWidth ?? 800,
            canvasHeight: config?.canvasHeight ?? 600,
            backgroundColor: config?.backgroundColor ?? '#111',
        };

        // Apply canvas dimensions
        this.canvas.width = this.config.canvasWidth;
        this.canvas.height = this.config.canvasHeight;

        // Initialize input handlers for both players
        const input1 = new InputHandler(PLAYER_1_KEYS, 'P1');
        const input2 = new InputHandler(PLAYER_2_KEYS, 'P2');
        this.inputs = [input1, input2];

        // Initialize players
        const player1 = new Player(
            this.config.canvasWidth,
            this.config.canvasHeight,
            input1,
            PLAYER_1_CONFIG
        );
        const player2 = new Player(
            this.config.canvasWidth,
            this.config.canvasHeight,
            input2,
            PLAYER_2_CONFIG
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
        this.projectiles = [];
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
                    }
                });

                // Handle player-to-player collision (physics only)
                this.handlePlayercollisions();

                this.updatePlayerTrails(deltaTime);

                // Update Managers
                this.enemyManager.update(deltaTime);
                this.powerupManager.update(deltaTime);

                // Update Projectiles
                this.projectiles.forEach(p => p.update(deltaTime));
                this.projectiles = this.projectiles.filter(p => !p.getIsExpired());

                // Update Bombs
                this.bombs.forEach(b => b.update(deltaTime));
                // Keep exploded bombs a bit longer for animation, then remove
                this.bombs = this.bombs.filter(b => !b.isFinished());

                // Check detections
                this.checkPowerupCollection();
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

            case PowerupType.GUN:
                // Find opponent
                const opponent = this.players.find(p => p !== player);
                if (opponent) {
                    // Fire 3 projectiles with delay
                    for (let i = 0; i < 3; i++) {
                        setTimeout(() => {
                            if (player.getIsAlive()) {
                                const proj = new Projectile(
                                    player.position.x + player.width / 2,
                                    player.position.y + player.height / 2,
                                    player,
                                    opponent
                                );
                                this.projectiles.push(proj);
                            }
                        }, i * 400); // 400ms delay between shots
                    }
                }
                break;

            case PowerupType.BOMB:
                const bomb = new Bomb(
                    player.position.x + player.width / 2,
                    player.position.y + player.height / 2,
                    player
                );
                this.bombs.push(bomb);
                break;
        }
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
        this.projectiles.forEach(proj => {
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
        this.projectiles.forEach(p => p.draw(this.ctx));

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
