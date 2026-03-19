import { NextRequest, NextResponse } from "next/server";
import { getPusherServer } from "@/lib/pusher-server";

export async function POST(req: NextRequest) {
  const data = await req.formData();
  const socketId = data.get("socket_id") as string;
  const channel = data.get("channel_name") as string;

  const pusher = getPusherServer();
  const auth = pusher.authorizeChannel(socketId, channel);

  return NextResponse.json(auth);
}
