import './style.css';
import { Game } from './core/Game';

/**
 * Neon Rain - Main Entry Point
 * A 2D infinite dodger game with neon visuals
 */

// Create and start the game
const game = new Game('gameCanvas', {
    canvasWidth: 800,
    canvasHeight: 600,
    backgroundColor: '#111',
});

// Start the game loop
game.start();

// Expose game instance for debugging in console
(window as unknown as { game: Game }).game = game;

console.log('🌧️ Welcome to Neon Rain!');
console.log('💡 Tip: Access the game instance via window.game in the console');
