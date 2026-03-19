import { NextRequest, NextResponse } from "next/server";
import {
  getRoom,
  createRoom,
  deleteRoom,
  startGameLoop,
} from "@/lib/gameRooms";
import { changeDirection, Direction } from "@/lib/gameEngine";
import { getPusherServer } from "@/lib/pusher-server";

function generateRoomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, roomId, playerName, playerIndex, direction } = body;

  switch (action) {
    case "create": {
      const code = roomId || generateRoomCode();
      const state = createRoom(code);
      state.players[0] = playerName;
      return NextResponse.json({ roomId: code, playerIndex: 0, state });
    }

    case "join": {
      const state = getRoom(roomId);
      if (!state) {
        return NextResponse.json({ error: "Room not found" }, { status: 404 });
      }
      if (state.players[1] !== null) {
        return NextResponse.json({ error: "Room is full" }, { status: 400 });
      }
      state.players[1] = playerName;
      state.status = "countdown";

      const pusher = getPusherServer();
      pusher.trigger(`private-room-${roomId}`, "game-state", state);

      setTimeout(() => {
        const s = getRoom(roomId);
        if (s && s.status === "countdown") {
          s.status = "playing";
          startGameLoop(roomId);
        }
      }, 3000);

      return NextResponse.json({ playerIndex: 1, state });
    }

    case "move": {
      const state = getRoom(roomId);
      if (!state) {
        return NextResponse.json({ error: "Room not found" }, { status: 404 });
      }
      changeDirection(state, playerIndex, direction as Direction);
      return NextResponse.json({ ok: true });
    }

    case "rematch": {
      deleteRoom(roomId);
      const state = createRoom(roomId);
      if (body.player0) state.players[0] = body.player0;
      if (body.player1) state.players[1] = body.player1;
      state.status = "countdown";

      const pusher = getPusherServer();
      pusher.trigger(`private-room-${roomId}`, "game-state", state);

      setTimeout(() => {
        const s = getRoom(roomId);
        if (s && s.status === "countdown") {
          s.status = "playing";
          startGameLoop(roomId);
        }
      }, 3000);

      return NextResponse.json({ state });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
