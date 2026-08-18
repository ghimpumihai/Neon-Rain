import { GameObject } from '../core/interfaces';

/**
 * SpatialGrid - Grid-based spatial partitioning for collision detection
 *
 * Divides the game world into a grid of cells.
 * Objects are registered in cells based on their position.
 * Collision detection only checks objects in the same or adjacent cells,
 * reducing O(n²) complexity to approximately O(n).
 */

export class SpatialGrid<T extends GameObject> {
    private cells: Map<string, T[]> = new Map();
    private cellWidth: number;
    private cellHeight: number;
    private gridWidth: number; // Number of cells horizontally
    private gridHeight: number; // Number of cells vertically

    constructor(
        worldWidth: number,
        worldHeight: number,
        cellWidth: number = 100,
        cellHeight: number = 100
    ) {
        this.cellWidth = cellWidth;
        this.cellHeight = cellHeight;
        this.gridWidth = Math.ceil(worldWidth / cellWidth);
        this.gridHeight = Math.ceil(worldHeight / cellHeight);
    }

    /**
     * Get the cell key for a given position
     */
    private getCellKey(x: number, y: number): string {
        const cellX = Math.floor(x / this.cellWidth);
        const cellY = Math.floor(y / this.cellHeight);
        return `${cellX},${cellY}`;
    }

    /**
     * Get all cells that an object could potentially collide with
     * Returns the object's cell and all adjacent cells (9 total)
     */
    private getPotentialCollisionCells(obj: GameObject): string[] {
        const cellX = Math.floor(obj.position.x / this.cellWidth);
        const cellY = Math.floor(obj.position.y / this.cellHeight);

        const cells: string[] = [];

        // Check current cell and adjacent cells (8 neighbors)
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const checkX = cellX + dx;
                const checkY = cellY + dy;

                // Skip if out of bounds
                if (checkX < 0 || checkX >= this.gridWidth ||
                    checkY < 0 || checkY >= this.gridHeight) {
                    continue;
                }

                cells.push(`${checkX},${checkY}`);
            }
        }

        return cells;
    }

    /**
     * Register an object in the grid
     */
    public register(obj: T): void {
        const key = this.getCellKey(obj.position.x, obj.position.y);

        if (!this.cells.has(key)) {
            this.cells.set(key, []);
        }

        this.cells.get(key)!.push(obj);
    }

    /**
     * Remove an object from the grid
     */
    public unregister(obj: T): void {
        const key = this.getCellKey(obj.position.x, obj.position.y);
        const cell = this.cells.get(key);

        if (cell) {
            const index = cell.indexOf(obj);
            if (index > -1) {
                cell.splice(index, 1);

                // Remove empty cells
                if (cell.length === 0) {
                    this.cells.delete(key);
                }
            }
        }
    }

    /**
     * Update an object's position in the grid
     * Call this when an object moves
     */
    public update(obj: T, oldX: number, oldY: number): void {
        const oldKey = this.getCellKey(oldX, oldY);
        const newKey = this.getCellKey(obj.position.x, obj.position.y);

        // Only update if actually changed cells
        if (oldKey !== newKey) {
            this.unregister(obj);
            this.register(obj);
        }
    }

    /**
     * Find potential collisions for an object
     * Only checks objects in the same and adjacent cells
     */
    public query(obj: GameObject, filterFn?: (other: T) => boolean): T[] {
        const cells = this.getPotentialCollisionCells(obj);
        const candidates: T[] = [];

        // Collect all objects from potential cells
        for (const key of cells) {
            const cell = this.cells.get(key);
            if (cell) {
                for (const other of cell) {
                    if (!filterFn || filterFn(other)) {
                        candidates.push(other);
                    }
                }
            }
        }

        // Remove self from candidates
        const result = candidates.filter((c) => c !== (obj as unknown as T));

        return result;
    }

    /**
     * Clear all objects from the grid
     */
    public clear(): void {
        this.cells.clear();
    }

    /**
     * Get grid statistics
     */
    public getStats() {
        let totalObjects = 0;
        let occupiedCells = 0;

        for (const [_, cell] of this.cells) {
            totalObjects += cell.length;
            if (cell.length > 0) {
                occupiedCells++;
            }
        }

        return {
            gridWidth: this.gridWidth,
            gridHeight: this.gridHeight,
            cellWidth: this.cellWidth,
            cellHeight: this.cellHeight,
            totalObjects,
            occupiedCells,
            totalCells: this.gridWidth * this.gridHeight
        };
    }
}
