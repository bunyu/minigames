import Phaser from 'phaser';
import { emoji, label } from './character';

/** The control gesture a game uses, animated on the intro screen. */
export type Gesture = 'tap' | 'hold' | 'joystick' | 'joystick-button' | 'lr' | 'swipe' | 'flick' | 'drag';

type Cleanup = () => void;

/**
 * A looping animation of a finger performing the game's gesture, so kids can learn without reading.
 * `s` is the overall size. Returns a cleanup function (stops tweens, destroys objects).
 */
export function addGestureDemo(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  s: number,
  gesture: Gesture,
  color: number,
): Cleanup {
  const root = scene.add.container(x, y);
  parent.add(root);
  const finger = emoji(scene, 0, 0, '👆', s * 0.34);
  // The fingertip is near the top of the emoji: place it so the tip touches (tx, ty).
  const touch = (tx: number, ty: number, pressed: boolean) => finger.setPosition(tx + s * 0.04, ty + s * (pressed ? 0.15 : 0.22));
  const button = (bx: number, by: number, r: number, text: string) => {
    const disc = scene.add.circle(bx, by, r, color).setStrokeStyle(r * 0.12, 0xffffff);
    const t = label(scene, bx, by, text, r * 0.55);
    root.add([disc, t]);
    return disc;
  };
  const press = (o: Phaser.GameObjects.Arc, down: boolean) => o.setScale(down ? 0.88 : 1).setAlpha(down ? 0.8 : 1);

  let duration = 1200;
  let update: (t: number) => void;

  switch (gesture) {
    case 'tap':
    case 'hold': {
      const hold = gesture === 'hold';
      const b = button(0, 0, s * 0.2, hold ? 'HOLD' : 'TAP');
      duration = hold ? 2000 : 900;
      update = (t) => {
        const down = hold ? t > 0.2 && t < 0.75 : t > 0.35 && t < 0.6;
        press(b, down);
        touch(0, 0, down);
      };
      break;
    }
    case 'joystick':
    case 'joystick-button': {
      const withButton = gesture === 'joystick-button';
      const jx = withButton ? -s * 0.17 : 0;
      const base = scene.add.circle(jx, 0, s * 0.2, color, 0.3).setStrokeStyle(3, 0xffffff, 0.7);
      const knob = scene.add.circle(jx, 0, s * 0.09, color).setStrokeStyle(3, 0xffffff);
      root.add([base, knob]);
      const b = withButton ? button(s * 0.26, -s * 0.05, s * 0.12, '!') : null;
      duration = 2400;
      update = (t) => {
        const a = t * Math.PI * 2;
        const kx = jx + Math.cos(a) * s * 0.11;
        const ky = Math.sin(a) * s * 0.11;
        knob.setPosition(kx, ky);
        const tapping = !!b && t > 0.4 && t < 0.62;
        if (b) press(b, t > 0.48 && t < 0.56);
        if (tapping) touch(s * 0.26, -s * 0.05, t > 0.48 && t < 0.56);
        else touch(kx, ky, true);
      };
      break;
    }
    case 'lr': {
      const l = button(-s * 0.2, 0, s * 0.14, '◀');
      const r = button(s * 0.2, 0, s * 0.14, '▶');
      duration = 1600;
      update = (t) => {
        const right = t >= 0.5;
        const local = (t % 0.5) / 0.5;
        const down = local > 0.3 && local < 0.8;
        press(l, !right && down);
        press(r, right && down);
        touch(right ? s * 0.2 : -s * 0.2, 0, down);
      };
      break;
    }
    case 'swipe': {
      const fruit = emoji(scene, 0, 0, '🍉', s * 0.24);
      const trail = scene.add.graphics();
      root.add([fruit, trail]);
      duration = 1500;
      update = (t) => {
        const k = Phaser.Math.Clamp((t - 0.15) / 0.5, 0, 1);
        const fx = Phaser.Math.Linear(-s * 0.3, s * 0.3, k);
        const fy = Phaser.Math.Linear(s * 0.12, -s * 0.12, k);
        trail.clear();
        if (k > 0 && k < 1) trail.lineStyle(s * 0.03, 0xffffff, 0.8).lineBetween(-s * 0.3, s * 0.12, fx, fy);
        // Sliced once the finger passes the middle, then fades away.
        fruit.setScale(k > 0.5 ? 1.3 : 1).setAlpha(k > 0.5 ? Math.max(0, 1 - (t - 0.4) * 3) : 1);
        touch(fx, fy, true);
      };
      break;
    }
    case 'flick': {
      const ball = emoji(scene, 0, 0, '🏀', s * 0.18);
      const hoop = scene.add.circle(s * 0.3, -s * 0.22, s * 0.08).setStrokeStyle(s * 0.025, 0xff5400);
      root.add([hoop, ball]);
      duration = 1800;
      const start = { x: -s * 0.22, y: s * 0.15 };
      update = (t) => {
        if (t < 0.35) {
          // Finger drags from the ball toward the hoop.
          const k = t / 0.35;
          ball.setPosition(start.x, start.y).setScale(1).setAlpha(1);
          touch(start.x + k * s * 0.15, start.y - k * s * 0.11, true);
        } else if (t < 0.75) {
          const k = (t - 0.35) / 0.4;
          ball.setPosition(Phaser.Math.Linear(start.x, s * 0.3, k), Phaser.Math.Linear(start.y, -s * 0.22, k));
          ball.setScale(1 + Math.sin(k * Math.PI) * 0.6);
          touch(start.x + s * 0.15, start.y - s * 0.11, false);
        } else {
          ball.setAlpha(1 - (t - 0.75) * 4);
        }
      };
      break;
    }
    case 'drag': {
      const paddle = scene.add.rectangle(0, -s * 0.05, s * 0.3, s * 0.06, color).setStrokeStyle(3, 0xffffff);
      root.add(paddle);
      duration = 1800;
      update = (t) => {
        const px = Math.sin(t * Math.PI * 2) * s * 0.22;
        paddle.setX(px);
        touch(px, s * 0.06, true);
      };
      break;
    }
  }
  root.add(finger);

  const tween = scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration,
    repeat: -1,
    onUpdate: (tw) => update(tw.getValue() ?? 0),
  });
  update(0);
  return () => {
    tween.remove();
    root.destroy();
  };
}

/** Short picture tips (e.g. "💣 = out") shown one after another. */
export function addTips(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  tips: string[],
  size: number,
  wrap: number,
): Cleanup {
  const text = label(scene, x, y, tips[0] ?? '', size).setWordWrapWidth(wrap);
  parent.add(text);
  let shown = -1;
  const tween = scene.tweens.addCounter({
    from: 0,
    to: tips.length,
    duration: 1900 * tips.length,
    repeat: -1,
    onUpdate: (tw) => {
      const v = tw.getValue() ?? 0;
      const i = Math.min(tips.length - 1, Math.floor(v));
      if (i !== shown) {
        shown = i;
        text.setText(tips[i]);
      }
      // Fade in and out around each tip.
      const local = v - i;
      text.setAlpha(Math.min(1, local * 6, (1 - local) * 6));
    },
  });
  return () => {
    tween.remove();
    text.destroy();
  };
}
