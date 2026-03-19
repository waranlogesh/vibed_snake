import { NextRequest, NextResponse } from "next/server";
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
  const { action } = body;

  switch (action) {
    case "create": {
      const code = generateRoomCode();
      return NextResponse.json({ roomId: code, playerIndex: 0 });
    }

    case "join": {
      const { roomId, playerName } = body;
      // Notify the room that a player joined via Pusher
      const pusher = getPusherServer();
      await pusher.trigger(`private-room-${roomId}`, "player-joined", {
        playerName,
        playerIndex: 1,
      });
      return NextResponse.json({ playerIndex: 1 });
    }

    case "rematch": {
      const { roomId } = body;
      const pusher = getPusherServer();
      await pusher.trigger(`private-room-${roomId}`, "rematch-requested", {});
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
