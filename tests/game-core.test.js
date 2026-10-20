"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { SnakeGame } = require("../src/game-core.js");

function createGame() {
  const game = new SnakeGame({ cols: 12, rows: 12, random: () => 0 });
  game.food = { x: 11, y: 6 };
  game.start();
  return game;
}

test("the snake starts in the center with four segments", () => {
  const game = new SnakeGame({ cols: 12, rows: 12, random: () => 0 });

  assert.equal(game.snake.length, 4);
  assert.deepEqual(game.snake[0], { x: 6, y: 6 });
  assert.equal(game.state, "ready");
  assert.equal(game.score, 0);
});

test("a running game moves one cell in the current direction", () => {
  const game = createGame();
  const result = game.step();

  assert.equal(result.type, "move");
  assert.deepEqual(game.snake[0], { x: 7, y: 6 });
  assert.equal(game.snake.length, 4);
  assert.equal(game.steps, 1);
});

test("immediate reversal and duplicate directions are rejected", () => {
  const game = createGame();

  assert.equal(game.setDirectionByName("left"), false);
  assert.equal(game.setDirectionByName("right"), false);
  assert.equal(game.setDirectionByName("up"), true);
  assert.equal(game.setDirectionByName("down"), false);
});

test("eating food grows the snake and awards ten points", () => {
  const game = createGame();
  game.food = { x: 7, y: 6 };

  const result = game.step();

  assert.equal(result.type, "eat");
  assert.equal(game.score, 10);
  assert.equal(game.snake.length, 5);
  assert.notDeepEqual(game.food, { x: 7, y: 6 });
  assert.equal(
    game.snake.some((segment) => segment.x === game.food.x && segment.y === game.food.y),
    false,
  );
});

test("hitting a wall ends the game", () => {
  const game = createGame();
  game.snake = [{ x: 11, y: 6 }];

  const result = game.step();

  assert.equal(result.type, "gameover");
  assert.equal(result.reason, "wall");
  assert.equal(game.state, "over");
});

test("hitting the snake body ends the game", () => {
  const game = createGame();
  game.snake = [
    { x: 5, y: 5 },
    { x: 5, y: 6 },
    { x: 4, y: 6 },
    { x: 4, y: 5 },
    { x: 5, y: 5 },
  ];
  game.direction = { x: 0, y: 1 };
  game.directionQueue = [];

  const result = game.step();

  assert.equal(result.type, "gameover");
  assert.equal(result.reason, "self");
  assert.equal(game.state, "over");
});

test("moving into the vacated tail cell is allowed", () => {
  const game = createGame();
  game.snake = [
    { x: 5, y: 5 },
    { x: 4, y: 5 },
    { x: 4, y: 6 },
    { x: 5, y: 6 },
  ];
  game.direction = { x: 0, y: 1 };
  game.directionQueue = [];

  const result = game.step();

  assert.equal(result.type, "move");
  assert.deepEqual(game.snake[0], { x: 5, y: 6 });
});

test("the game ignores ticks while paused", () => {
  const game = createGame();
  game.pause();
  const result = game.step();

  assert.equal(result.type, "idle");
  assert.deepEqual(game.snake[0], { x: 6, y: 6 });
});
