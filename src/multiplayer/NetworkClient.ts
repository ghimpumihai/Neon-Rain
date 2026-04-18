import {
    type ClientToServerMessage,
    type GameEventEnvelope,
    type GameSnapshot,
    type InputFrameState,
    type PlayerCustomization,
    type ServerToClientMessage,
    decodeWireMessage,
    encodeWireMessage,
    isServerToClientMessage,
} from './protocol';

export interface NetworkClientOptions {
    url?: string;
    reconnectOnDrop?: boolean;
    reconnectDelayMs?: number;
}

type MessageListener = (message: ServerToClientMessage) => void;
type ConnectionListener = (connected: boolean) => void;

const DEFAULT_RECONNECT_DELAY_MS = 2000;

export class NetworkClient {
    private socket: WebSocket | null = null;
    private readonly options: NetworkClientOptions;
    private readonly messageListeners = new Set<MessageListener>();
    private readonly connectionListeners = new Set<ConnectionListener>();
    private reconnectTimerId: number | null = null;
    private intentionallyDisconnected = false;

    constructor(options?: NetworkClientOptions) {
        this.options = options ?? {};
    }

    public async connectAsync(): Promise<void> {
        if (this.socket?.readyState === WebSocket.OPEN) {
            return;
        }

        if (this.socket?.readyState === WebSocket.CONNECTING) {
            return new Promise((resolve, reject) => {
                const socket = this.socket;
                if (!socket) {
                    reject(new Error('Socket was unexpectedly cleared before connecting'));
                    return;
                }

                const openHandler = (): void => {
                    socket.removeEventListener('error', errorHandler);
                    resolve();
                };

                const errorHandler = (): void => {
                    socket.removeEventListener('open', openHandler);
                    reject(new Error('WebSocket connection failed'));
                };

                socket.addEventListener('open', openHandler, { once: true });
                socket.addEventListener('error', errorHandler, { once: true });
            });
        }

        this.intentionallyDisconnected = false;
        const wsUrl = this.resolveWsUrl();
        this.socket = new WebSocket(wsUrl);

        this.socket.addEventListener('open', () => {
            this.emitConnectionStatus(true);
        });

        this.socket.addEventListener('message', (event) => {
            if (typeof event.data !== 'string') {
                return;
            }

            const payload = decodeWireMessage(event.data);
            if (!payload || !isServerToClientMessage(payload)) {
                return;
            }

            this.messageListeners.forEach(listener => listener(payload));
        });

        this.socket.addEventListener('close', () => {
            this.emitConnectionStatus(false);
            this.socket = null;
            this.scheduleReconnect();
        });

        this.socket.addEventListener('error', () => {
            this.emitConnectionStatus(false);
        });

        return new Promise((resolve, reject) => {
            const socket = this.socket;
            if (!socket) {
                reject(new Error('WebSocket was not initialized'));
                return;
            }

            const openHandler = (): void => {
                socket.removeEventListener('error', errorHandler);
                resolve();
            };

            const errorHandler = (): void => {
                socket.removeEventListener('open', openHandler);
                reject(new Error('WebSocket failed to connect'));
            };

            socket.addEventListener('open', openHandler, { once: true });
            socket.addEventListener('error', errorHandler, { once: true });
        });
    }

    public disconnect(): void {
        this.intentionallyDisconnected = true;

        if (this.reconnectTimerId !== null) {
            window.clearTimeout(this.reconnectTimerId);
            this.reconnectTimerId = null;
        }

        if (this.socket && this.socket.readyState <= WebSocket.OPEN) {
            this.socket.close();
        }

        this.socket = null;
        this.emitConnectionStatus(false);
    }

    public onMessage(listener: MessageListener): () => void {
        this.messageListeners.add(listener);
        return () => {
            this.messageListeners.delete(listener);
        };
    }

    public onConnectionChange(listener: ConnectionListener): () => void {
        this.connectionListeners.add(listener);
        return () => {
            this.connectionListeners.delete(listener);
        };
    }

    public getIsConnected(): boolean {
        return this.socket?.readyState === WebSocket.OPEN;
    }

    public sendClientMessage(message: ClientToServerMessage): boolean {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return false;
        }

        this.socket.send(encodeWireMessage(message));
        return true;
    }

    public createRoom(displayName: string, customization: PlayerCustomization): boolean {
        return this.sendClientMessage({
            type: 'create_room',
            displayName,
            customization,
        });
    }

    public joinRoom(roomCode: string, displayName: string, customization: PlayerCustomization): boolean {
        return this.sendClientMessage({
            type: 'join_room',
            roomCode,
            displayName,
            customization,
        });
    }

    public leaveRoom(): boolean {
        return this.sendClientMessage({ type: 'leave_room' });
    }

    public setReady(ready: boolean): boolean {
        return this.sendClientMessage({ type: 'set_ready', ready });
    }

    public startMatch(): boolean {
        return this.sendClientMessage({ type: 'start_match' });
    }

    public sendInputFrame(sequence: number, input: InputFrameState): boolean {
        return this.sendClientMessage({
            type: 'input_frame',
            sequence,
            input,
        });
    }

    public sendSnapshot(tick: number, snapshot: GameSnapshot): boolean {
        return this.sendClientMessage({
            type: 'state_snapshot',
            tick,
            snapshot,
        });
    }

    public sendGameEvent(event: GameEventEnvelope): boolean {
        return this.sendClientMessage({
            type: 'game_event',
            event,
        });
    }

    public sendPing(): boolean {
        return this.sendClientMessage({
            type: 'ping',
            clientTimeMs: Date.now(),
        });
    }

    private resolveWsUrl(): string {
        const configuredUrl = this.options.url ?? this.readViteConfiguredUrl();
        if (configuredUrl && configuredUrl.length > 0) {
            return configuredUrl;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

        if (this.shouldUseDevelopmentBackendFallback()) {
            const hostName = this.formatHostNameForUrl(window.location.hostname);
            return `${protocol}//${hostName}:3000/ws`;
        }

        return `${protocol}//${window.location.host}/ws`;
    }

    private readViteConfiguredUrl(): string | undefined {
        const maybeEnv = import.meta.env as ImportMetaEnv & { VITE_WS_URL?: string };
        const configured = maybeEnv.VITE_WS_URL?.trim();
        return configured && configured.length > 0 ? configured : undefined;
    }

    private shouldUseDevelopmentBackendFallback(): boolean {
        const maybeEnv = import.meta.env as ImportMetaEnv & { DEV?: boolean };
        if (maybeEnv.DEV !== true) {
            return false;
        }

        const currentPort = window.location.port.trim();
        return currentPort.length > 0 && currentPort !== '3000';
    }

    private formatHostNameForUrl(hostName: string): string {
        const normalizedHostName = hostName.trim();

        // IPv6 hosts need square brackets when used with explicit ports.
        if (normalizedHostName.includes(':')) {
            return `[${normalizedHostName}]`;
        }

        return normalizedHostName;
    }

    private emitConnectionStatus(connected: boolean): void {
        this.connectionListeners.forEach(listener => listener(connected));
    }

    private scheduleReconnect(): void {
        const shouldReconnect = this.options.reconnectOnDrop ?? true;
        if (!shouldReconnect || this.intentionallyDisconnected) {
            return;
        }

        if (this.reconnectTimerId !== null) {
            return;
        }

        const reconnectDelayMs = this.options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
        this.reconnectTimerId = window.setTimeout(() => {
            this.reconnectTimerId = null;
            this.connectAsync().catch(() => {
                this.scheduleReconnect();
            });
        }, reconnectDelayMs);
    }
}
