"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPusherClient } from "@/lib/pusher-client";
import {
  createInitialState,
  tick,
  changeDirection,
  type GameState,
  type Direction,
} from "@/lib/gameEngine";

const CELL_SIZE = 16;
const GRID = 30;

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const animFrameRef = useRef<number>(0);
  const tickIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<
    ReturnType<typeof getPusherClient>["subscribe"]
  > | null>(null);
  const [displayState, setDisplayState] = useState<GameState | null>(null);
  const [playerIndex, setPlayerIndex] = useState<number>(0);
  const [playerName, setPlayerName] = useState<string>("");
  const foodPulseRef = useRef(0);
  const isHostRef = useRef(false);

  useEffect(() => {
    const idx = parseInt(sessionStorage.getItem("playerIndex") || "0");
    const name = sessionStorage.getItem("playerName") || "Player";
    setPlayerIndex(idx);
    setPlayerName(name);
    isHostRef.current = idx === 0;

    // Host (Player 1) creates initial state
    if (idx === 0) {
      const state = createInitialState(roomId);
      state.players[0] = name;
      gameStateRef.current = state;
      setDisplayState(state);
    }
  }, [roomId]);

  const broadcastState = useCallback(() => {
    const channel = channelRef.current;
    const state = gameStateRef.current;
    if (channel && state) {
      channel.trigger("client-game-state", state);
    }
  }, []);

  const startGameLoop = useCallback(() => {
    if (tickIntervalRef.current) return;
    tickIntervalRef.current = setInterval(() => {
      const state = gameStateRef.current;
      if (!state || state.status !== "playing") {
        if (state?.status === "finished" && tickIntervalRef.current) {
          clearInterval(tickIntervalRef.current);
          tickIntervalRef.current = null;
          broadcastState();
          setDisplayState({ ...state });
        }
        return;
      }
      tick(state);
      setDisplayState({ ...state });
      broadcastState();
    }, 120);
  }, [broadcastState]);

  const startCountdown = useCallback(() => {
    const state = gameStateRef.current;
    if (!state) return;
    state.status = "countdown";
    setDisplayState({ ...state });
    broadcastState();

    setTimeout(() => {
      const s = gameStateRef.current;
      if (s && s.status === "countdown") {
        s.status = "playing";
        setDisplayState({ ...s });
        broadcastState();
        startGameLoop();
      }
    }, 3000);
  }, [broadcastState, startGameLoop]);

  // Send direction change
  const sendMove = useCallback(
    (direction: string) => {
      const idx = parseInt(sessionStorage.getItem("playerIndex") || "0");
      if (isHostRef.current) {
        // Host applies direction locally
        const state = gameStateRef.current;
        if (state) {
          changeDirection(state, idx, direction as Direction);
        }
      } else {
        // Guest sends direction via Pusher client event
        const channel = channelRef.current;
        if (channel) {
          channel.trigger("client-move", {
            playerIndex: idx,
            direction,
          });
        }
      }
    },
    []
  );

  // Keyboard controls
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const keyMap: Record<string, string> = {
        ArrowUp: "UP",
        ArrowDown: "DOWN",
        ArrowLeft: "LEFT",
        ArrowRight: "RIGHT",
        w: "UP",
        W: "UP",
        s: "DOWN",
        S: "DOWN",
        a: "LEFT",
        A: "LEFT",
        d: "RIGHT",
        D: "RIGHT",
      };
      const dir = keyMap[e.key];
      if (dir) {
        e.preventDefault();
        sendMove(dir);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [sendMove]);

  // Pusher subscription
  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe(`private-room-${roomId}`);
    channelRef.current = channel;

    if (isHostRef.current) {
      // Host listens for player join
      channel.bind(
        "player-joined",
        (data: { playerName: string; playerIndex: number }) => {
          const state = gameStateRef.current;
          if (state) {
            state.players[1] = data.playerName;
            setDisplayState({ ...state });
            startCountdown();
          }
        }
      );

      // Host listens for guest direction changes
      channel.bind(
        "client-move",
        (data: { playerIndex: number; direction: string }) => {
          const state = gameStateRef.current;
          if (state) {
            changeDirection(state, data.playerIndex, data.direction as Direction);
          }
        }
      );

      // Host listens for rematch requests
      channel.bind("rematch-requested", () => {
        if (tickIntervalRef.current) {
          clearInterval(tickIntervalRef.current);
          tickIntervalRef.current = null;
        }
        const oldPlayers = gameStateRef.current?.players;
        const state = createInitialState(roomId);
        state.players[0] = oldPlayers?.[0] || null;
        state.players[1] = oldPlayers?.[1] || null;
        gameStateRef.current = state;
        setDisplayState({ ...state });
        startCountdown();
      });
    } else {
      // Guest receives game state from host
      channel.bind("client-game-state", (state: GameState) => {
        gameStateRef.current = state;
        setDisplayState(state);
      });

      // Guest also listens for rematch (to reset local display)
      channel.bind("rematch-requested", () => {
        // Host will send new state via client-game-state
      });
    }

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`private-room-${roomId}`);
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };
  }, [roomId, startCountdown]);

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    function draw() {
      const state = gameStateRef.current;
      foodPulseRef.current += 0.05;
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, canvas!.width, canvas!.height);

      ctx.strokeStyle = "#1a1a2e";
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= GRID; i++) {
        ctx.beginPath();
        ctx.moveTo(i * CELL_SIZE, 0);
        ctx.lineTo(i * CELL_SIZE, GRID * CELL_SIZE);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * CELL_SIZE);
        ctx.lineTo(GRID * CELL_SIZE, i * CELL_SIZE);
        ctx.stroke();
      }

      if (!state) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      // Food (pulsing circle)
      const pulse = Math.sin(foodPulseRef.current) * 2 + 5;
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(
        state.food.x * CELL_SIZE + CELL_SIZE / 2,
        state.food.y * CELL_SIZE + CELL_SIZE / 2,
        pulse,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Snakes
      const colors = ["#22c55e", "#a855f7"];
      const headColors = ["#16a34a", "#9333ea"];
      state.snakes.forEach((snake, i) => {
        snake.body.forEach((seg, j) => {
          const x = seg.x * CELL_SIZE + 1;
          const y = seg.y * CELL_SIZE + 1;
          const size = CELL_SIZE - 2;
          const radius = 3;
          ctx.fillStyle = j === 0 ? headColors[i] : colors[i];
          if (!snake.alive) ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.moveTo(x + radius, y);
          ctx.lineTo(x + size - radius, y);
          ctx.quadraticCurveTo(x + size, y, x + size, y + radius);
          ctx.lineTo(x + size, y + size - radius);
          ctx.quadraticCurveTo(
            x + size,
            y + size,
            x + size - radius,
            y + size
          );
          ctx.lineTo(x + radius, y + size);
          ctx.quadraticCurveTo(x, y + size, x, y + size - radius);
          ctx.lineTo(x, y + radius);
          ctx.quadraticCurveTo(x, y, x + radius, y);
          ctx.fill();
          ctx.globalAlpha = 1;
        });
      });

      animFrameRef.current = requestAnimationFrame(draw);
    }

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  async function handleRematch() {
    if (isHostRef.current) {
      // Host resets locally
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
      const oldPlayers = gameStateRef.current?.players;
      const state = createInitialState(roomId);
      state.players[0] = oldPlayers?.[0] || null;
      state.players[1] = oldPlayers?.[1] || null;
      gameStateRef.current = state;
      setDisplayState({ ...state });
      startCountdown();
    } else {
      // Guest asks server to notify host
      await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rematch", roomId }),
      });
    }
  }

  const isWaiting = !displayState || displayState.status === "waiting";
  const isCountdown = displayState?.status === "countdown";
  const isFinished = displayState?.status === "finished";

  let resultText = "";
  if (isFinished && displayState) {
    if (displayState.winner === null) resultText = "It's a draw!";
    else if (displayState.winner === playerIndex) resultText = "You win!";
    else resultText = "You lose!";
  }

  return (
    <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 p-4">
      <div className="flex gap-8 text-lg font-mono">
        <div className="text-green-400">
          {displayState?.players[0] || "Player 1"}:{" "}
          {displayState?.snakes[0].score ?? 0}
        </div>
        <div className="text-gray-600 text-sm self-center">Room: {roomId}</div>
        <div className="text-purple-400">
          {displayState?.players[1] || "Player 2"}:{" "}
          {displayState?.snakes[1].score ?? 0}
        </div>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={GRID * CELL_SIZE}
          height={GRID * CELL_SIZE}
          className="border border-gray-800 rounded-lg"
        />

        {isWaiting && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center rounded-lg">
            <p className="text-white text-xl mb-2">Waiting for opponent...</p>
            <p className="text-gray-400 text-sm">
              Share code:{" "}
              <span className="text-yellow-400 font-mono text-2xl">
                {roomId}
              </span>
            </p>
          </div>
        )}

        {isCountdown && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-lg">
            <p className="text-white text-5xl font-bold animate-pulse">
              Get Ready!
            </p>
          </div>
        )}

        {isFinished && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center rounded-lg gap-4">
            <p
              className={`text-4xl font-bold ${
                displayState?.winner === playerIndex
                  ? "text-green-400"
                  : displayState?.winner === null
                  ? "text-yellow-400"
                  : "text-red-400"
              }`}
            >
              {resultText}
            </p>
            <p className="text-gray-400">
              {displayState?.snakes[0].score} -{" "}
              {displayState?.snakes[1].score}
            </p>
            <button
              onClick={handleRematch}
              className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg transition"
            >
              Rematch
            </button>
            <button
              onClick={() => router.push("/")}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition"
            >
              Back to Lobby
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1 w-36 md:hidden">
        <div />
        <button
          onClick={() => sendMove("UP")}
          className="bg-gray-800 text-white rounded-lg p-3 text-center active:bg-gray-700"
        >
          ▲
        </button>
        <div />
        <button
          onClick={() => sendMove("LEFT")}
          className="bg-gray-800 text-white rounded-lg p-3 text-center active:bg-gray-700"
        >
          ◀
        </button>
        <div />
        <button
          onClick={() => sendMove("RIGHT")}
          className="bg-gray-800 text-white rounded-lg p-3 text-center active:bg-gray-700"
        >
          ▶
        </button>
        <div />
        <button
          onClick={() => sendMove("DOWN")}
          className="bg-gray-800 text-white rounded-lg p-3 text-center active:bg-gray-700"
        >
          ▼
        </button>
        <div />
      </div>

      <p className="text-gray-600 text-xs">
        P1: WASD | P2: Arrow Keys | Mobile: D-pad
      </p>
    </main>
  );
}
