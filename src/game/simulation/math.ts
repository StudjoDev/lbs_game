import type { Vector2 } from "../types";

export function length(vector: Vector2): number {
  return Math.hypot(vector.x, vector.y);
}

export function normalize(vector: Vector2): Vector2 {
  const size = length(vector);
  if (size <= 0.0001) {
    return { x: 0, y: 0 };
  }
  return { x: vector.x / size, y: vector.y / size };
}

export function distance(a: Vector2, b: Vector2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function scale(vector: Vector2, amount: number): Vector2 {
  return { x: vector.x * amount, y: vector.y * amount };
}

export function add(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function fromAngle(angle: number): Vector2 {
  return { x: Math.cos(angle), y: Math.sin(angle) };
}
