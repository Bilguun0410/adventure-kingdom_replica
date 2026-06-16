/**
 * Isometric 2:1 projection helpers.
 * tileWidth  = 64 px
 * tileHeight = 32 px
 */

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const MAP_SIZE = 50;

export function cartToIso(x, y) {
  return {
    x: (x - y) * (TILE_WIDTH / 2),
    y: (x + y) * (TILE_HEIGHT / 2),
  };
}

export function isoToCart(screenX, screenY) {
  return {
    x: Math.floor(
      (screenX / (TILE_WIDTH / 2) + screenY / (TILE_HEIGHT / 2)) / 2
    ),
    y: Math.floor(
      (screenY / (TILE_HEIGHT / 2) - screenX / (TILE_WIDTH / 2)) / 2
    ),
  };
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
