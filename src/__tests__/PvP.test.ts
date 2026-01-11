import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Powerup, PowerupType } from '../entities/Powerup';
import { Bomb } from '../entities/Bomb';
import { Player, PLAYER_1_CONFIG } from '../entities/Player';
import { InputHandler } from '../systems/InputHandler';

describe('PvP Phase: Powerups & Combat', () => {

    // Mock Player
    const createMockPlayer = () => {
        return new Player(800, 600, new InputHandler(), PLAYER_1_CONFIG);
    };

    describe('Powerups', () => {
        it('should create a powerup with correct type', () => {
            const p = new Powerup(100, 100, PowerupType.BOMB);
            expect(p.getType()).toBe(PowerupType.BOMB);
        });

        it('should be collectable', () => {
            const p = new Powerup(100, 100, PowerupType.GUN);
            p.collect();
            expect(p.getIsCollected()).toBe(true);
        });
    });

    describe('Bomb Logic', () => {
        let owner: Player;
        let bomb: Bomb;

        beforeEach(() => {
            owner = createMockPlayer();
            bomb = new Bomb(100, 100, owner);
        });

        it('should count down and explode', () => {
            // Fuse is 2 seconds
            bomb.update(1.0);
            expect(bomb.getIsExploded()).toBe(false);

            bomb.update(1.1);
            expect(bomb.getIsExploded()).toBe(true);
        });

        it('should damage opponents nearby when exploding', () => {
            const opponent = createMockPlayer();
            // Place opponent near bomb
            opponent.position.x = 105;
            opponent.position.y = 105;

            // Trigger explosion
            bomb.update(2.1);

            // Check damage
            const hit = bomb.checkDamage(opponent);

            expect(hit).toBe(true);
        });

        it('should NOT damage the owner', () => {
            // Owner is also near the bomb
            owner.position.x = 105;
            owner.position.y = 105;

            bomb.update(2.1);
            const hit = bomb.checkDamage(owner);

            expect(hit).toBe(false);
        });
    });

    describe('Player Health', () => {
        let player: Player;

        beforeEach(() => {
            player = createMockPlayer();
        });

        it('should take damage', () => {
            const max = player.getMaxHealth();
            player.takeDamage(20);
            expect(player.getHealth()).toBe(max - 20);
        });

        it('should die at 0 health', () => {
            player.takeDamage(player.getMaxHealth());
            expect(player.getHealth()).toBe(0);
            expect(player.getIsAlive()).toBe(false);
        });
    });
});
