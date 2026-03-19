"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Lobby() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim()) {
      setError("Enter your name");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", playerName: name.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }
      sessionStorage.setItem("playerName", name.trim());
      sessionStorage.setItem("playerIndex", "0");
      router.push(`/game/${data.roomId}`);
    } catch {
      setError("Failed to create room");
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!name.trim()) {
      setError("Enter your name");
      return;
    }
    if (!joinCode.trim() || joinCode.trim().length !== 4) {
      setError("Enter a 4-letter room code");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "join",
          roomId: joinCode.trim().toUpperCase(),
          playerName: name.trim(),
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }
      sessionStorage.setItem("playerName", name.trim());
      sessionStorage.setItem("playerIndex", String(data.playerIndex));
      router.push(`/game/${joinCode.trim().toUpperCase()}`);
    } catch {
      setError("Failed to join room");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="bg-gray-900 p-8 rounded-2xl shadow-2xl w-full max-w-md space-y-6">
        <h1 className="text-4xl font-bold text-center text-white">
          Vibed Snake
        </h1>
        <p className="text-gray-400 text-center text-sm">
          Real-time multiplayer Snake. Create a room or join with a code.
        </p>

        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={16}
          className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-green-500 focus:outline-none"
        />

        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg transition disabled:opacity-50"
        >
          Create Room
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-700" />
          <span className="text-gray-500 text-sm">or join</span>
          <div className="flex-1 h-px bg-gray-700" />
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Room code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={4}
            className="flex-1 px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none uppercase tracking-widest text-center font-mono"
          />
          <button
            onClick={handleJoin}
            disabled={loading}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition disabled:opacity-50"
          >
            Join
          </button>
        </div>

        {error && <p className="text-red-400 text-center text-sm">{error}</p>}
      </div>
    </main>
  );
}
