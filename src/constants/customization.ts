import type { CubeHatType, CubeModelType } from '../core/interfaces';

export interface NeonColorOption {
    name: string;
    value: string;
}

export interface CubeModelOption {
    id: CubeModelType;
    name: string;
    preview: string;
}

export interface CubeHatOption {
    id: CubeHatType;
    name: string;
    preview: string;
}

export type PlayerSlot = 'p1' | 'p2';

export const NEON_COLORS: NeonColorOption[] = [
    { name: 'red', value: '#ff1744' },
    { name: 'orange', value: '#ff9100' },
    { name: 'yellow', value: '#ffee00' },
    { name: 'green', value: '#39ff14' },
    { name: 'blue', value: '#00b7ff' },
    { name: 'purple', value: '#b026ff' },
    { name: 'pink', value: '#ff4fd8' },
    { name: 'grey', value: '#98a2b3' },
    { name: 'brown', value: '#b06a3c' },
];

export const CUBE_MODELS: CubeModelOption[] = [
    { id: 'core', name: 'core', preview: '[]' },
    { id: 'cross', name: 'cross', preview: '++' },
    { id: 'stripes', name: 'stripes', preview: '|||' },
    { id: 'target', name: 'target', preview: '[ ]' },
];

export const CUBE_HATS: CubeHatOption[] = [
    { id: 'none', name: 'none', preview: '-' },
    { id: 'cap', name: 'cap', preview: '__' },
    { id: 'crown', name: 'crown', preview: 'M' },
    { id: 'beanie', name: 'beanie', preview: 'o' },
];

export const CUSTOMIZATION_STORAGE_KEYS = {
    p1Color: 'neon-rain.player1-color',
    p2Color: 'neon-rain.player2-color',
    p1Model: 'neon-rain.player1-model',
    p2Model: 'neon-rain.player2-model',
    p1Hat: 'neon-rain.player1-hat',
    p2Hat: 'neon-rain.player2-hat',
} as const;

export const DEFAULT_PLAYER_CUSTOMIZATION = {
    p1: {
        color: 'blue',
        model: 'core' as CubeModelType,
        hat: 'none' as CubeHatType,
    },
    p2: {
        color: 'red',
        model: 'core' as CubeModelType,
        hat: 'none' as CubeHatType,
    },
} as const;
