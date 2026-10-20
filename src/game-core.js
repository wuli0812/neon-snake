(function attachSnakeCore(globalScope) {
  "use strict";

  const DIRECTIONS = Object.freeze({
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  });

  class SnakeGame {
    constructor({ cols = 24, rows = 24, random = Math.random } = {}) {
      if (!Number.isInteger(cols) || cols < 5) {
        throw new RangeError("cols must be an integer greater than or equal to 5");
      }
      if (!Number.isInteger(rows) || rows < 5) {
        throw new RangeError("rows must be an integer greater than or equal to 5");
      }
      if (typeof random !== "function") {
        throw new TypeError("random must be a function");
      }

      this.cols = cols;
      this.rows = rows;
      this.random = random;
      this.reset();
    }

    reset() {
      const headX = Math.floor(this.cols / 2);
      const headY = Math.floor(this.rows / 2);
      const initialLength = Math.min(4, headX + 1);

      this.snake = Array.from({ length: initialLength }, (_, index) => ({
        x: headX - index,
        y: headY,
      }));
      this.direction = { ...DIRECTIONS.right };
      this.directionQueue = [];
      this.score = 0;
      this.state = "ready";
      this.food = this.spawnFood();
      this.steps = 0;
      return this.getSnapshot();
    }

    start() {
      if (this.state === "ready") {
        this.state = "running";
      }
      return this.getSnapshot();
    }

    pause() {
      if (this.state === "running") {
        this.state = "paused";
      }
      return this.getSnapshot();
    }

    resume() {
      if (this.state === "paused") {
        this.state = "running";
      }
      return this.getSnapshot();
    }

    setDirection(x, y) {
      if (!Number.isInteger(x) || !Number.isInteger(y) || Math.abs(x) + Math.abs(y) !== 1) {
        return false;
      }
      if (this.state === "over" || this.state === "won") {
        return false;
      }

      const reference =
        this.directionQueue.length > 0
          ? this.directionQueue[this.directionQueue.length - 1]
          : this.direction;

      if (x === reference.x && y === reference.y) {
        return false;
      }
      if (x === -reference.x && y === -reference.y) {
        return false;
      }
      if (this.directionQueue.length >= 2) {
        return false;
      }

      this.directionQueue.push({ x, y });
      return true;
    }

    setDirectionByName(name) {
      const direction = DIRECTIONS[name];
      return direction ? this.setDirection(direction.x, direction.y) : false;
    }

    step() {
      if (this.state !== "running") {
        return { type: "idle", snapshot: this.getSnapshot() };
      }

      if (this.directionQueue.length > 0) {
        this.direction = this.directionQueue.shift();
      }

      const head = this.snake[0];
      const nextHead = {
        x: head.x + this.direction.x,
        y: head.y + this.direction.y,
      };

      if (this.isOutsideBoard(nextHead)) {
        this.state = "over";
        return {
          type: "gameover",
          reason: "wall",
          snapshot: this.getSnapshot(),
        };
      }

      const willEat = this.isSamePosition(nextHead, this.food);
      const collisionBody = willEat ? this.snake : this.snake.slice(0, -1);

      if (collisionBody.some((segment) => this.isSamePosition(segment, nextHead))) {
        this.state = "over";
        return {
          type: "gameover",
          reason: "self",
          snapshot: this.getSnapshot(),
        };
      }

      this.snake.unshift(nextHead);
      this.steps += 1;

      if (!willEat) {
        this.snake.pop();
        return { type: "move", snapshot: this.getSnapshot() };
      }

      this.score += 10;

      if (this.snake.length === this.cols * this.rows) {
        this.state = "won";
        this.food = null;
        return { type: "won", snapshot: this.getSnapshot() };
      }

      this.food = this.spawnFood();
      return {
        type: "eat",
        food: { ...this.food },
        snapshot: this.getSnapshot(),
      };
    }

    spawnFood() {
      const occupied = new Set(this.snake.map(({ x, y }) => `${x},${y}`));
      const available = [];

      for (let y = 0; y < this.rows; y += 1) {
        for (let x = 0; x < this.cols; x += 1) {
          if (!occupied.has(`${x},${y}`)) {
            available.push({ x, y });
          }
        }
      }

      if (available.length === 0) {
        return null;
      }

      const randomIndex = Math.min(
        available.length - 1,
        Math.floor(this.random() * available.length),
      );
      return available[Math.max(0, randomIndex)];
    }

    getSnapshot() {
      return {
        snake: this.snake.map((segment) => ({ ...segment })),
        food: this.food ? { ...this.food } : null,
        direction: { ...this.direction },
        score: this.score,
        state: this.state,
        steps: this.steps,
        cols: this.cols,
        rows: this.rows,
      };
    }

    isOutsideBoard(position) {
      return (
        position.x < 0 ||
        position.y < 0 ||
        position.x >= this.cols ||
        position.y >= this.rows
      );
    }

    isSamePosition(first, second) {
      return Boolean(second) && first.x === second.x && first.y === second.y;
    }
  }

  const api = { SnakeGame, DIRECTIONS };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  globalScope.SnakeCore = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
