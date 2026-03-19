export type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

export type Position = { x: number; y: number };

export type Snake = {
  body: Position[];
  direction: Direction;
  nextDirection: Direction;
  alive: boolean;
  score: number;
};

export type GameState = {
  roomId: string;
  gridSize: number;
  snakes: [Snake, Snake];
  food: Position;
  status: "waiting" | "countdown" | "playing" | "finished";
  winner: number | null;
  players: [string | null, string | null];
  tickRate: number;
};

const GRID_SIZE = 30;

export function createInitialState(roomId: string): GameState {
  return {
    roomId,
    gridSize: GRID_SIZE,
    snakes: [
      {
        body: [
          { x: 5, y: 15 },
          { x: 4, y: 15 },
          { x: 3, y: 15 },
        ],
        direction: "RIGHT",
        nextDirection: "RIGHT",
        alive: true,
        score: 3,
      },
      {
        body: [
          { x: 24, y: 15 },
          { x: 25, y: 15 },
          { x: 26, y: 15 },
        ],
        direction: "LEFT",
        nextDirection: "LEFT",
        alive: true,
        score: 3,
      },
    ],
    food: { x: 15, y: 15 },
    status: "waiting",
    winner: null,
    players: [null, null],
    tickRate: 120,
  };
}

function isOccupied(pos: Position, state: GameState): boolean {
  return state.snakes.some((snake) =>
    snake.body.some((seg) => seg.x === pos.x && seg.y === pos.y)
  );
}

export function spawnFood(state: GameState): Position {
  let pos: Position;
  do {
    pos = {
      x: Math.floor(Math.random() * state.gridSize),
      y: Math.floor(Math.random() * state.gridSize),
    };
  } while (isOccupied(pos, state));
  return pos;
}

const OPPOSITE: Record<Direction, Direction> = {
  UP: "DOWN",
  DOWN: "UP",
  LEFT: "RIGHT",
  RIGHT: "LEFT",
};

export function changeDirection(
  state: GameState,
  playerIndex: number,
  direction: Direction
): void {
  const snake = state.snakes[playerIndex];
  if (!snake || !snake.alive) return;
  if (OPPOSITE[direction] === snake.direction) return;
  snake.nextDirection = direction;
}

export function tick(state: GameState): GameState {
  if (state.status !== "playing") return state;

  for (const snake of state.snakes) {
    if (snake.alive) {
      snake.direction = snake.nextDirection;
    }
  }

  for (const snake of state.snakes) {
    if (!snake.alive) continue;
    const head = { ...snake.body[0] };
    switch (snake.direction) {
      case "UP":
        head.y -= 1;
        break;
      case "DOWN":
        head.y += 1;
        break;
      case "LEFT":
        head.x -= 1;
        break;
      case "RIGHT":
        head.x += 1;
        break;
    }
    snake.body.unshift(head);

    if (head.x === state.food.x && head.y === state.food.y) {
      snake.score += 1;
      state.food = spawnFood(state);
    } else {
      snake.body.pop();
    }
  }

  for (let i = 0; i < 2; i++) {
    const snake = state.snakes[i];
    if (!snake.alive) continue;
    const head = snake.body[0];

    if (
      head.x < 0 ||
      head.x >= state.gridSize ||
      head.y < 0 ||
      head.y >= state.gridSize
    ) {
      snake.alive = false;
      continue;
    }

    for (let j = 1; j < snake.body.length; j++) {
      if (head.x === snake.body[j].x && head.y === snake.body[j].y) {
        snake.alive = false;
        break;
      }
    }

    if (!snake.alive) continue;

    const other = state.snakes[1 - i];
    for (const seg of other.body) {
      if (head.x === seg.x && head.y === seg.y) {
        snake.alive = false;
        break;
      }
    }
  }

  const alive0 = state.snakes[0].alive;
  const alive1 = state.snakes[1].alive;
  if (!alive0 || !alive1) {
    state.status = "finished";
    if (!alive0 && !alive1) {
      state.winner = null;
    } else if (alive0) {
      state.winner = 0;
    } else {
      state.winner = 1;
    }
  }

  return state;
}
