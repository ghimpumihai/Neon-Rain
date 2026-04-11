/**
 * Game state enumeration
 */
export enum GameState {
    MENU = 'menu',
    PLAYING = 'playing',
    GAME_OVER = 'game_over',
    PAUSED = 'paused',
}

/**
 * GameOverScreen class
 * Renders the game over screen with score and restart option
 */
export class GameOverScreen {
    private canvasWidth: number;
    private canvasHeight: number;
    private score: number = 0;
    private highScore: number = 0;
    private animationProgress: number = 0;

    constructor(canvasWidth: number, canvasHeight: number) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;

        // Load high score from localStorage
        const savedHighScore = localStorage.getItem('neonRain_highScore');
        if (savedHighScore) {
            this.highScore = parseInt(savedHighScore, 10);
        }
    }

    /**
     * Set the final score
     */
    public setScore(score: number): void {
        this.score = score;

        // Update high score if needed
        if (score > this.highScore) {
            this.highScore = score;
            localStorage.setItem('neonRain_highScore', score.toString());
        }
    }

    /**
     * Reset animation for new game over
     */
    public reset(): void {
        this.animationProgress = 0;
    }

    /**
     * Update animation
     */
    public update(deltaTime: number): void {
        this.animationProgress = Math.min(1, this.animationProgress + deltaTime * 2);
    }

    public resize(canvasWidth: number, canvasHeight: number): void {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
    }

    /**
     * Draw the game over screen
     */
    public draw(ctx: CanvasRenderingContext2D): void {
        const centerX = this.canvasWidth / 2;
        const centerY = this.canvasHeight / 2;

        // Semi-transparent overlay
        ctx.fillStyle = `rgba(0, 0, 0, ${0.7 * this.animationProgress})`;
        ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

        // Only draw text after initial fade
        if (this.animationProgress < 0.3) return;

        const textAlpha = Math.min(1, (this.animationProgress - 0.3) / 0.7);

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Game Over title with glow
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ff0066';
        ctx.fillStyle = `rgba(255, 0, 102, ${textAlpha})`;
        ctx.font = 'bold 64px monospace';
        ctx.fillText('GAME OVER', centerX, centerY - 80);

        // Score
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ffff';
        ctx.fillStyle = `rgba(0, 255, 255, ${textAlpha})`;
        ctx.font = '32px monospace';
        ctx.fillText(`Score: ${this.score}`, centerX, centerY);

        // High score
        ctx.shadowColor = '#00ff66';
        ctx.fillStyle = `rgba(0, 255, 102, ${textAlpha})`;
        ctx.font = '24px monospace';
        ctx.fillText(`High Score: ${this.highScore}`, centerX, centerY + 50);

        // New high score indicator
        if (this.score >= this.highScore && this.score > 0) {
            const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ffff00';
            ctx.fillStyle = `rgba(255, 255, 0, ${textAlpha * pulse})`;
            ctx.font = 'bold 20px monospace';
            ctx.fillText('★ NEW HIGH SCORE! ★', centerX, centerY + 90);
        }

        // Restart instruction
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#ffffff';
        ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha * 0.8})`;
        ctx.font = '20px monospace';
        ctx.fillText('Press SPACE or ENTER to restart', centerX, centerY + 140);

        ctx.restore();
    }

    /**
     * Get current score
     */
    public getScore(): number {
        return this.score;
    }

    /**
     * Get high score
     */
    public getHighScore(): number {
        return this.highScore;
    }
}
