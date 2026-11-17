/**
 * Player zones on a tablet lying flat in landscape.
 * Bottom-side players read the screen normally (rotation 0),
 * top-side players sit opposite (rotation PI).
 * Seats go clockwise from bottom-left: BL, BR, TR, TL.
 */
export interface Zone {
  seat: number;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  rotation: number;
  side: 'bottom' | 'top';
  label: string;
}

function zone(seat: number, x: number, y: number, w: number, h: number, side: Zone['side'], label: string): Zone {
  return { seat, x, y, w, h, cx: x + w / 2, cy: y + h / 2, rotation: side === 'top' ? Math.PI : 0, side, label };
}

export function computeZones(width: number, height: number, players: number): Zone[] {
  const hw = width / 2;
  const hh = height / 2;
  switch (players) {
    case 2:
      return [zone(0, 0, hh, width, hh, 'bottom', 'bottom'), zone(1, 0, 0, width, hh, 'top', 'top')];
    case 3:
      return [
        zone(0, 0, hh, hw, hh, 'bottom', 'bottom-left'),
        zone(1, hw, hh, hw, hh, 'bottom', 'bottom-right'),
        zone(2, 0, 0, width, hh, 'top', 'top'),
      ];
    case 4:
      return [
        zone(0, 0, hh, hw, hh, 'bottom', 'bottom-left'),
        zone(1, hw, hh, hw, hh, 'bottom', 'bottom-right'),
        zone(2, hw, 0, hw, hh, 'top', 'top-right'),
        zone(3, 0, 0, hw, hh, 'top', 'top-left'),
      ];
    default:
      throw new Error(`Unsupported player count ${players}`);
  }
}

/** Human-readable seat positions, used by the setup screen. */
export function seatLabels(players: number): string[] {
  return computeZones(1000, 1000, players).map((z) => z.label);
}
