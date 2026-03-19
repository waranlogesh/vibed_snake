import { GameState, createInitialState, tick } from "./gameEngine";
import { getPusherServer } from "./pusher-server";

const rooms = new Map<string, GameState>();
const intervals = new Map<string, NodeJS.Timeout>();

export function getRoom(roomId: string): GameState | undefined {
  return rooms.get(roomId);
}

export function createRoom(roomId: string): GameState {
  const state = createInitialState(roomId);
  rooms.set(roomId, state);
  return state;
}

export function deleteRoom(roomId: string): void {
  const interval = intervals.get(roomId);
  if (interval) {
    clearInterval(interval);
    intervals.delete(roomId);
  }
  rooms.delete(roomId);
}

export function startGameLoop(roomId: string): void {
  if (intervals.has(roomId)) return;

  const interval = setInterval(() => {
    const state = rooms.get(roomId);
    if (!state) {
      clearInterval(interval);
      intervals.delete(roomId);
      return;
    }

    tick(state);

    const pusher = getPusherServer();
    pusher.trigger(`private-room-${roomId}`, "game-state", state);

    if (state.status === "finished") {
      clearInterval(interval);
      intervals.delete(roomId);
    }
  }, 120);

  intervals.set(roomId, interval);
}
