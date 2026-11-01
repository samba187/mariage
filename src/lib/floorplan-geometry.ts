import type { TableType } from "@/types/database";

export interface SeatPosition {
  index: number;
  x: number;
  y: number;
}

export const ROUND_TABLE_RADIUS = 45;
export const RECT_TABLE_WIDTH = 130;
export const RECT_TABLE_HEIGHT = 60;
export const SEAT_RADIUS = 14;
export const SEAT_GAP = 22;

/** Une table rectangulaire s'allonge avec le nombre de places pour que les chaises ne se chevauchent pas. */
export function getRectTableWidth(capacity: number) {
  return Math.max(RECT_TABLE_WIDTH, Math.ceil(capacity / 2) * (SEAT_RADIUS * 2 + 8));
}

export function getTableFootprint(type: TableType, capacity: number) {
  if (type === "round") {
    return { width: (ROUND_TABLE_RADIUS + SEAT_GAP + SEAT_RADIUS) * 2, height: (ROUND_TABLE_RADIUS + SEAT_GAP + SEAT_RADIUS) * 2 };
  }
  return {
    width: getRectTableWidth(capacity) + (SEAT_GAP + SEAT_RADIUS) * 2,
    height: RECT_TABLE_HEIGHT + (SEAT_GAP + SEAT_RADIUS) * 2,
  };
}

export function getSeatPositions(type: TableType, capacity: number): SeatPosition[] {
  if (type === "round") {
    const radius = ROUND_TABLE_RADIUS + SEAT_GAP;
    return Array.from({ length: capacity }, (_, i) => {
      const angle = (i / capacity) * Math.PI * 2 - Math.PI / 2;
      return { index: i, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    });
  }

  // Rectangular: distribute seats along top and bottom edges primarily.
  const halfW = getRectTableWidth(capacity) / 2;
  const halfH = RECT_TABLE_HEIGHT / 2;
  const seatY = halfH + SEAT_GAP;
  const perSide = Math.ceil(capacity / 2);
  const positions: SeatPosition[] = [];

  for (let i = 0; i < capacity; i++) {
    const side = i < perSide ? -1 : 1; // top row then bottom row
    const sideIndex = i < perSide ? i : i - perSide;
    const sideCount = i < perSide ? perSide : capacity - perSide;
    const spacing = (halfW * 2) / (sideCount + 1);
    const x = -halfW + spacing * (sideIndex + 1);
    positions.push({ index: i, x, y: side * seatY });
  }

  return positions;
}
