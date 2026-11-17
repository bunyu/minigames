import Phaser from 'phaser';
import type { Look } from '../core/profiles';

export const FONT = 'Fredoka, ui-rounded, system-ui, "Segoe UI", Roboto, sans-serif';
export const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

export function emoji(scene: Phaser.Scene, x: number, y: number, value: string, size: number): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, value, { fontFamily: EMOJI_FONT, fontSize: `${Math.round(size)}px` })
    .setPadding(0, Math.round(size * 0.15), 0, Math.round(size * 0.1))
    .setOrigin(0.5);
}

export function label(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size: number,
  color = '#ffffff',
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, {
      fontFamily: FONT,
      fontSize: `${Math.round(size)}px`,
      fontStyle: 'bold',
      color,
      align: 'center',
      stroke: '#00000088',
      strokeThickness: Math.max(2, size / 10),
    })
    .setOrigin(0.5);
}

/**
 * A player's character: coloured disc + animal + optional glasses and hat.
 * `size` is the disc diameter. Rotate the returned container to face a direction.
 */
export function addCharacter(scene: Phaser.Scene, x: number, y: number, look: Look, size: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const disc = scene.add.circle(0, 0, size / 2, look.color).setStrokeStyle(Math.max(2, size * 0.06), 0xffffff);
  c.add([disc, emoji(scene, 0, 0, look.avatar, size * 0.6)]);
  if (look.glasses) c.add(emoji(scene, 0, -size * 0.04, look.glasses, size * 0.34));
  if (look.hat) c.add(emoji(scene, 0, -size * 0.48, look.hat, size * 0.45));
  return c;
}
