/**
 * Isometric 2:1 projection helpers.
 * tileWidth  = 64 px
 * tileHeight = 32 px
 */

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const MAP_SIZE = 161;

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

/** True if the coordinate is inside the 0..MAP_SIZE-1 grid. */
export function isInBounds(x, y) {
  return x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE;
}

/** Iterate every grid tile covered by a building footprint. */
export function forFootprint(tx, ty, width, height, fn) {
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      fn(tx + dx, ty + dy);
    }
  }
}

/**
 * Iso screen position for the centre of a building footprint.
 * Useful for origin-bottom-center sprites.
 */
export function footprintCenterIso(tx, ty, width, height) {
  return cartToIso(tx + (width - 1) / 2, ty + (height - 1) / 2);
}
