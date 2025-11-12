import type WebSocket from 'ws';

export type HeartbeatWebSocket = WebSocket & { isAlive?: boolean };
