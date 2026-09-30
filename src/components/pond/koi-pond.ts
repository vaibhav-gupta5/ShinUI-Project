/**
 * Narrow top-down koi pond.
 *
 * Movement follows the public Nagomi pipeline: each fish keeps its own
 * state, steers from a few small intentions, and a spine lags behind the
 * head so the body bends. Drawing is original — naturalistic koi from
 * above, in a shorter pond than the full-bleed reference.
 */

type SwimState = "glide" | "coast" | "hover" | "burst" | "pivot";

type Spot = { t: number; side: number; rx: number; ry: number; color: string };

type Fish = {
  x: number;
  y: number;
  angle: number;
  speed: number;
  size: number;
  depth: number;
  homeDepth: number;
  phase: number;
  wander: number;
  wanderFreq: number;
  speedMul: number;
  turnMul: number;
  react: number;
  state: SwimState;
  stateTime: number;
  target: { x: number; y: number } | null;
  targetDelay: number;
  targetTime: number;
  spine: { x: number; y: number }[];
  base: [string, string];
  spots: Spot[];
  metallic: boolean;
};

type Fry = {
  x: number;
  y: number;
  angle: number;
  speed: number;
  size: number;
  phase: number;
  flee: number;
  fleeX: number;
  fleeY: number;
};

type Ripple = { x: number; y: number; age: number; life: number };

const SPINE = 14;

const STATE_SPEED: Record<SwimState, number> = {
  glide: 1,
  coast: 0.42,
  hover: 0.1,
  burst: 1.9,
  pivot: 0.5,
};

const STATE_TURN: Record<SwimState, number> = {
  glide: 1,
  coast: 0.75,
  hover: 1.15,
  burst: 1.15,
  pivot: 2.4,
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function wrapAngle(delta: number) {
  let d = delta;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function pickState(rand: () => number, current: SwimState): SwimState {
  const roll = rand();
  if (roll < 0.46) return "glide";
  if (roll < 0.66) return "coast";
  if (roll < 0.8) return "hover";
  if (roll < 0.9) return current === "burst" ? "glide" : "burst";
  return "pivot";
}

function stateDuration(rand: () => number, state: SwimState) {
  if (state === "glide") return 1.8 + rand() * 2;
  if (state === "coast") return 0.55 + rand() * 0.7;
  if (state === "hover") return 0.35 + rand() * 0.5;
  if (state === "burst") return 0.28 + rand() * 0.3;
  return 0.22 + rand() * 0.28;
}

const VARIANTS: { base: [string, string]; colors: string[]; count: number; metallic?: boolean; head?: boolean }[] = [
  { base: ["#f6f1e7", "#fffdf8"], colors: ["#d6453d", "#e15a45"], count: 3 },
  { base: ["#f3ecdf", "#fffaf4"], colors: ["#c73730"], count: 2 },
  { base: ["#e8a428", "#ffe3a4"], colors: ["#f6d27a"], count: 1, metallic: true },
  { base: ["#f4efe6", "#fff"], colors: ["#d23c32", "#2c2c2c"], count: 3 },
  { base: ["#6d8b99", "#d5e3e6"], colors: ["#d25a48"], count: 2 },
];

function makeSpots(rand: () => number, variant: (typeof VARIANTS)[number]): Spot[] {
  const spots: Spot[] = [];
  for (let i = 0; i < variant.count; i++) {
    spots.push({
      t: 0.18 + rand() * 0.55,
      side: (rand() - 0.5) * 0.7,
      rx: 0.07 + rand() * 0.08,
      ry: 0.045 + rand() * 0.05,
      color: variant.colors[i % variant.colors.length],
    });
  }
  return spots;
}

type Pose = {
  x: number;
  y: number;
  nx: number;
  ny: number;
  tx: number;
  ty: number;
};

function bodyRadius(t: number) {
  if (t < 0.14) return Math.sin((t / 0.14) * Math.PI * 0.5) * 0.62;
  if (t < 0.48) return 0.62 + 0.38 * Math.sin(((t - 0.14) / 0.34) * Math.PI);
  return Math.cos(((t - 0.48) / 0.52) * Math.PI * 0.5) * 0.92;
}

export class KoiPond {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private rand = mulberry32(0x5e1a);
  private fish: Fish[] = [];
  private fry: Fry[] = [];
  private ripples: Ripple[] = [];
  private cssW = 0;
  private cssH = 0;
  private bufW = 0;
  private bufH = 0;
  private time = 0;
  private rippleIn = 2.4;
  private pads: { x: number; y: number; r: number; rot: number; flower: boolean }[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is unavailable");
    this.ctx = ctx;
  }

  resize(cssW: number, cssH: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bufW = Math.max(1, Math.floor(cssW * dpr));
    const bufH = Math.max(1, Math.floor(cssH * dpr));
    if (bufW === this.bufW && bufH === this.bufH) return;

    const prevW = this.bufW;
    const prevH = this.bufH;
    this.cssW = cssW;
    this.cssH = cssH;
    this.bufW = bufW;
    this.bufH = bufH;
    this.canvas.width = bufW;
    this.canvas.height = bufH;

    if (cssW < 24 || cssH < 24) return;

    if (!this.fish.length || prevW < 24) {
      this.spawn();
      return;
    }

    const sx = bufW / prevW;
    const sy = bufH / prevH;
    for (const fish of this.fish) {
      fish.x *= sx;
      fish.y *= sy;
      fish.size *= (sx + sy) / 2;
      for (const point of fish.spine) {
        point.x *= sx;
        point.y *= sy;
      }
    }
    for (const fry of this.fry) {
      fry.x *= sx;
      fry.y *= sy;
      fry.size *= (sx + sy) / 2;
    }
    this.placePads();
  }

  callTo(cssX: number, cssY: number) {
    if (this.cssW < 24 || this.cssH < 24) return;
    const x = (cssX / this.cssW) * this.bufW;
    const y = (cssY / this.cssH) * this.bufH;
    this.ripples.push({ x, y, age: 0, life: 1.4 });
    for (const fish of this.fish) {
      const distance = Math.hypot(fish.x - x, fish.y - y);
      fish.target = { x, y };
      fish.targetDelay = (distance / Math.max(this.bufW, this.bufH)) * 0.85 * fish.react;
      fish.targetTime = 5.2;
      fish.state = "burst";
      fish.stateTime = 0.5;
    }
    for (const fry of this.fry) {
      fry.flee = 0.85;
      fry.fleeX = fry.x - x;
      fry.fleeY = fry.y - y;
    }
  }

  update(dt: number) {
    if (this.bufW < 24 || this.bufH < 24) return;
    this.time += dt;
    for (const fish of this.fish) this.updateFish(fish, dt);
    for (const fry of this.fry) this.updateFry(fry, dt);
    this.ripples = this.ripples.filter((ripple) => {
      ripple.age += dt;
      return ripple.age < ripple.life;
    });
    this.rippleIn -= dt;
    if (this.rippleIn <= 0) {
      this.rippleIn = 3.2 + this.rand() * 2.4;
      this.ripples.push({
        x: this.bufW * (0.2 + this.rand() * 0.6),
        y: this.bufH * (0.25 + this.rand() * 0.5),
        age: 0,
        life: 1.1,
      });
    }
  }

  draw() {
    const { ctx, bufW: w, bufH: h } = this;
    if (w < 24 || h < 24) return;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    this.clipPond();

    const bed = ctx.createRadialGradient(w * 0.55, h * 0.42, h * 0.1, w * 0.5, h * 0.55, w * 0.72);
    bed.addColorStop(0, "#d7f3ea");
    bed.addColorStop(0.35, "#7ecdb8");
    bed.addColorStop(0.72, "#3e9e8d");
    bed.addColorStop(1, "#1f6d62");
    ctx.fillStyle = bed;
    ctx.fillRect(0, 0, w, h);

    const shaft = ctx.createLinearGradient(w, 0, w * 0.15, h);
    shaft.addColorStop(0, "rgba(244, 255, 250, 0.72)");
    shaft.addColorStop(0.38, "rgba(190, 236, 220, 0.18)");
    shaft.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = shaft;
    ctx.fillRect(0, 0, w, h);

    this.drawCaustics(0.07);
    this.drawShadows();

    const ordered = [...this.fish].sort((a, b) => b.depth - a.depth);
    for (const fish of ordered) this.drawFish(fish);

    for (const fry of this.fry) this.drawFry(fry);

    ctx.fillStyle = "rgba(64, 150, 136, 0.16)";
    ctx.fillRect(0, 0, w, h);
    this.drawCaustics(0.1);

    for (const pad of this.pads) {
      this.drawPad(pad.x * w, pad.y * h, pad.r * Math.min(w, h), pad.rot);
      if (pad.flower) this.drawLotus(pad.x * w, pad.y * h - pad.r * Math.min(w, h) * 0.15, pad.r * Math.min(w, h) * 0.42);
    }
    this.drawDuckweed();
    this.drawRipples();

    const rim = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.62);
    rim.addColorStop(0, "rgba(0, 0, 0, 0)");
    rim.addColorStop(1, "rgba(8, 48, 42, 0.28)");
    ctx.fillStyle = rim;
    ctx.fillRect(0, 0, w, h);

    ctx.restore();
  }

  destroy() {
    this.fish = [];
    this.fry = [];
    this.ripples = [];
  }

  private spawn() {
    const { bufW: w, bufH: h } = this;
    const rand = this.rand;
    this.fish = VARIANTS.map((variant, index) => {
      const size = Math.min(w, h) * (0.15 + rand() * 0.025);
      const angle = rand() * Math.PI * 2;
      const fish: Fish = {
        x: w * (0.22 + rand() * 0.56),
        y: h * (0.22 + rand() * 0.56),
        angle,
        speed: Math.min(w, h) * 0.11,
        size,
        depth: 0.15 + rand() * 0.7,
        homeDepth: 0.2 + (index % 3) * 0.22,
        phase: rand() * Math.PI * 2,
        wander: rand() * Math.PI * 2,
        wanderFreq: 0.35 + rand() * 0.55,
        speedMul: 0.78 + rand() * 0.46,
        turnMul: 0.85 + rand() * 0.4,
        react: 0.35 + rand() * 0.9,
        state: "glide",
        stateTime: 1 + rand() * 2,
        target: null,
        targetDelay: 0,
        targetTime: 0,
        spine: Array.from({ length: SPINE }, () => ({ x: 0, y: 0 })),
        base: variant.base,
        spots: makeSpots(rand, variant),
        metallic: Boolean(variant.metallic),
      };
      this.placeSpine(fish);
      return fish;
    });

    this.fry = Array.from({ length: 5 }, () => ({
      x: w * (0.15 + rand() * 0.7),
      y: h * (0.2 + rand() * 0.6),
      angle: rand() * Math.PI * 2,
      speed: Math.min(w, h) * 0.16,
      size: Math.min(w, h) * 0.028,
      phase: rand() * Math.PI * 2,
      flee: 0,
      fleeX: 0,
      fleeY: 0,
    }));
    this.placePads();
  }

  private placePads() {
    this.pads = [
      { x: 0.02, y: 0.08, r: 0.34, rot: 0.4, flower: true },
      { x: 0.96, y: 0.78, r: 0.3, rot: -0.6, flower: false },
      { x: -0.02, y: 0.86, r: 0.22, rot: 1.1, flower: false },
    ];
  }

  private placeSpine(fish: Fish) {
    const seg = fish.size * 0.11;
    const ax = Math.cos(fish.angle);
    const ay = Math.sin(fish.angle);
    for (let i = 0; i < SPINE; i++) {
      fish.spine[i].x = fish.x - ax * seg * i;
      fish.spine[i].y = fish.y - ay * seg * i;
    }
  }

  private updateFish(fish: Fish, dt: number) {
    const w = this.bufW;
    const h = this.bufH;
    fish.wander += dt * fish.wanderFreq;
    fish.phase += dt * (2.4 + fish.speed * 0.02);
    fish.stateTime -= dt;
    if (fish.target) {
      fish.targetDelay -= dt;
      fish.targetTime -= dt;
      if (fish.targetTime <= 0) fish.target = null;
    }
    if (fish.stateTime <= 0 && !(fish.target && fish.targetDelay <= 0)) {
      fish.state = pickState(this.rand, fish.state);
      fish.stateTime = stateDuration(this.rand, fish.state);
    }

    let dx = Math.cos(fish.angle);
    let dy = Math.sin(fish.angle);
    const wanderTurn = Math.sin(fish.wander) * 0.55;
    dx += Math.cos(fish.angle + wanderTurn) * 0.45;
    dy += Math.sin(fish.angle + wanderTurn) * 0.45;

    let neighbors = 0;
    let cx = 0;
    let cy = 0;
    let ax = 0;
    let ay = 0;
    let sepX = 0;
    let sepY = 0;
    let separations = 0;
    const neighborDist = fish.size * 3.1;
    for (const other of this.fish) {
      if (other === fish) continue;
      const ox = other.x - fish.x;
      const oy = other.y - fish.y;
      const dist = Math.hypot(ox, oy);
      if (dist < neighborDist && dist > 0.001) {
        cx += other.x;
        cy += other.y;
        ax += Math.cos(other.angle);
        ay += Math.sin(other.angle);
        neighbors++;
        if (dist < fish.size * 1.35) {
          sepX -= ox / dist;
          sepY -= oy / dist;
          separations++;
        }
      }
    }
    if (neighbors) {
      dx += ((cx / neighbors - fish.x) / neighborDist) * 0.55;
      dy += ((cy / neighbors - fish.y) / neighborDist) * 0.55;
      dx += (ax / neighbors) * 0.35;
      dy += (ay / neighbors) * 0.35;
    }
    if (separations) {
      dx += sepX * 1.15;
      dy += sepY * 1.15;
    }

    const margin = fish.size * 0.9;
    if (fish.x < margin) dx += (margin - fish.x) / margin;
    if (fish.x > w - margin) dx -= (fish.x - (w - margin)) / margin;
    if (fish.y < margin) dy += (margin - fish.y) / margin;
    if (fish.y > h - margin) dy -= (fish.y - (h - margin)) / margin;

    if (fish.target && fish.targetDelay <= 0) {
      const tx = fish.target.x - fish.x;
      const ty = fish.target.y - fish.y;
      const dist = Math.hypot(tx, ty) || 1;
      dx += (tx / dist) * 1.7;
      dy += (ty / dist) * 1.7;
      if (dist < fish.size * 1.4) {
        dx += (-ty / dist) * 1.1;
        dy += (tx / dist) * 1.1;
        fish.depth += (0.12 - fish.depth) * Math.min(1, dt * 2);
      } else {
        fish.depth += (0.18 - fish.depth) * Math.min(1, dt * 1.4);
      }
      fish.state = "burst";
    } else {
      fish.depth += (fish.homeDepth - fish.depth) * Math.min(1, dt * 0.35);
    }

    const desired = Math.atan2(dy, dx);
    const maxTurn = STATE_TURN[fish.state] * fish.turnMul * (fish.state === "pivot" ? 3.2 : 1.7);
    fish.angle += clamp(wrapAngle(desired - fish.angle), -maxTurn * dt, maxTurn * dt);

    const targetSpeed = Math.min(w, h) * 0.13 * STATE_SPEED[fish.state] * fish.speedMul;
    fish.speed += (targetSpeed - fish.speed) * Math.min(1, dt * 2.2);
    fish.x += Math.cos(fish.angle) * fish.speed * dt;
    fish.y += Math.sin(fish.angle) * fish.speed * dt;
    fish.x = clamp(fish.x, 4, w - 4);
    fish.y = clamp(fish.y, 4, h - 4);
    this.followSpine(fish);
  }

  private followSpine(fish: Fish) {
    const seg = fish.size * 0.105;
    fish.spine[0].x = fish.x;
    fish.spine[0].y = fish.y;
    for (let i = 1; i < SPINE; i++) {
      const prev = fish.spine[i - 1];
      const point = fish.spine[i];
      const vx = point.x - prev.x;
      const vy = point.y - prev.y;
      const len = Math.hypot(vx, vy) || 0.0001;
      const loosen = i > 9 ? 0.55 : 1;
      const desiredX = prev.x + (vx / len) * seg;
      const desiredY = prev.y + (vy / len) * seg;
      point.x += (desiredX - point.x) * loosen;
      point.y += (desiredY - point.y) * loosen;
    }
  }

  private updateFry(fry: Fry, dt: number) {
    fry.phase += dt * 6;
    fry.flee = Math.max(0, fry.flee - dt);
    let dx = Math.cos(fry.angle);
    let dy = Math.sin(fry.angle);
    if (fry.flee > 0) {
      const len = Math.hypot(fry.fleeX, fry.fleeY) || 1;
      dx += (fry.fleeX / len) * 2;
      dy += (fry.fleeY / len) * 2;
    } else {
      let cx = 0;
      let cy = 0;
      let n = 0;
      for (const other of this.fry) {
        if (other === fry) continue;
        const dist = Math.hypot(other.x - fry.x, other.y - fry.y);
        if (dist < fry.size * 14) {
          cx += other.x;
          cy += other.y;
          n++;
        }
      }
      if (n) {
        dx += (cx / n - fry.x) * 0.02;
        dy += (cy / n - fry.y) * 0.02;
      }
      dx += Math.sin(fry.phase) * 0.4;
      dy += Math.cos(fry.phase * 0.8) * 0.4;
    }
    const margin = 10;
    if (fry.x < margin) dx += 1;
    if (fry.x > this.bufW - margin) dx -= 1;
    if (fry.y < margin) dy += 1;
    if (fry.y > this.bufH - margin) dy -= 1;
    fry.angle += clamp(wrapAngle(Math.atan2(dy, dx) - fry.angle), -3 * dt, 3 * dt);
    const boost = fry.flee > 0 ? 1.8 : 1;
    fry.x += Math.cos(fry.angle) * fry.speed * boost * dt;
    fry.y += Math.sin(fry.angle) * fry.speed * boost * dt;
  }

  private pose(fish: Fish): Pose[] {
    const count = 12;
    const tail = fish.spine[SPINE - 1];
    const bodyAngle = Math.atan2(tail.y - fish.y, tail.x - fish.x);
    const bend = clamp(wrapAngle(bodyAngle - (fish.angle + Math.PI)), -0.85, 0.85);
    const pts: Pose[] = [];
    let x = fish.x;
    let y = fish.y;
    const seg = fish.size * 0.17;
    const waveAmp = fish.state === "burst" ? 0.42 : 0.22;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const wave = Math.sin(fish.phase - i * 0.58) * waveAmp * t;
      const angle = fish.angle + wave + bend * t * t;
      const tx = Math.cos(angle);
      const ty = Math.sin(angle);
      pts.push({ x, y, nx: -ty, ny: tx, tx, ty });
      x -= tx * seg;
      y -= ty * seg;
    }
    return pts;
  }

  private drawShadows() {
    const { ctx } = this;
    ctx.save();
    ctx.filter = "blur(8px)";
    ctx.fillStyle = "rgba(12, 48, 40, 0.28)";
    for (const pad of this.pads) {
      ctx.beginPath();
      ctx.ellipse(pad.x * this.bufW + 6, pad.y * this.bufH + 8, pad.r * Math.min(this.bufW, this.bufH), pad.r * Math.min(this.bufW, this.bufH) * 0.86, pad.rot, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const fish of this.fish) {
      const pose = this.pose(fish);
      const drop = 5 + fish.depth * 10;
      ctx.beginPath();
      this.traceBody(pose, fish.size * 0.92, drop, drop * 0.6);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawFish(fish: Fish) {
    const pose = this.pose(fish);
    const { ctx } = this;
    const depthTint = fish.depth;

    this.drawFins(pose, fish);

    ctx.save();
    ctx.beginPath();
    this.traceBody(pose, fish.size, 0, 0);
    ctx.clip();

    const head = pose[0];
    const tail = pose[pose.length - 1];
    const gradient = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
    gradient.addColorStop(0, fish.base[1]);
    gradient.addColorStop(0.45, fish.base[0]);
    gradient.addColorStop(1, fish.base[0]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.bufW, this.bufH);

    if (fish.metallic) {
      const sheen = ctx.createLinearGradient(head.x + head.nx * fish.size, head.y, tail.x, tail.y);
      sheen.addColorStop(0, "rgba(255, 255, 255, 0.55)");
      sheen.addColorStop(0.4, "rgba(255, 236, 190, 0.05)");
      sheen.addColorStop(1, "rgba(180, 110, 20, 0.18)");
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, this.bufW, this.bufH);
    }

    for (const spot of fish.spots) {
      const index = clamp(Math.round(spot.t * (pose.length - 1)), 0, pose.length - 1);
      const point = pose[index];
      ctx.save();
      ctx.translate(point.x + point.nx * spot.side * fish.size * 0.32, point.y + point.ny * spot.side * fish.size * 0.32);
      ctx.rotate(Math.atan2(point.ty, point.tx));
      ctx.beginPath();
      ctx.ellipse(0, 0, spot.rx * fish.size, spot.ry * fish.size, 0, 0, Math.PI * 2);
      ctx.fillStyle = spot.color;
      ctx.globalAlpha = 0.92;
      ctx.fill();
      ctx.restore();
    }

    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = fish.metallic ? "rgba(120, 70, 10, 0.45)" : "rgba(70, 60, 50, 0.35)";
    ctx.lineWidth = Math.max(0.6, fish.size * 0.012);
    for (let i = 2; i < pose.length - 2; i += 2) {
      const point = pose[i];
      const radius = bodyRadius(i / (pose.length - 1)) * fish.size * 0.42;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, Math.atan2(point.ny, point.nx) - 1.1, Math.atan2(point.ny, point.nx) + 1.1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const shine = ctx.createLinearGradient(
      head.x + head.nx * fish.size * 0.2,
      head.y + head.ny * fish.size * 0.2,
      head.x - head.nx * fish.size * 0.2,
      head.y - head.ny * fish.size * 0.2,
    );
    shine.addColorStop(0, "rgba(255,255,255,0.42)");
    shine.addColorStop(0.55, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    ctx.fillRect(0, 0, this.bufW, this.bufH);

    ctx.fillStyle = `rgba(28, 110, 102, ${0.08 + depthTint * 0.38})`;
    ctx.fillRect(0, 0, this.bufW, this.bufH);
    ctx.restore();

    ctx.beginPath();
    this.traceBody(pose, fish.size, 0, 0);
    ctx.strokeStyle = "rgba(36, 42, 38, 0.22)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const eyeAt = pose[1];
    for (const side of [-1, 1]) {
      const ex = eyeAt.x + eyeAt.nx * side * fish.size * 0.16;
      const ey = eyeAt.y + eyeAt.ny * side * fish.size * 0.16;
      ctx.beginPath();
      ctx.arc(ex, ey, Math.max(1.2, fish.size * 0.035), 0, Math.PI * 2);
      ctx.fillStyle = "#1c1a17";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex - fish.size * 0.01, ey - fish.size * 0.01, Math.max(0.5, fish.size * 0.012), 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fill();
    }
  }

  private drawFins(pose: Pose[], fish: Fish) {
    const { ctx } = this;
    const pectoral = pose[3];
    const pelvic = pose[6];
    ctx.save();
    ctx.globalAlpha = 0.72;
    for (const side of [-1, 1]) {
      this.drawFin(
        pectoral.x,
        pectoral.y,
        pectoral.tx,
        pectoral.ty,
        pectoral.nx * side,
        pectoral.ny * side,
        fish.size * 0.22,
        fish.base[0],
      );
      this.drawFin(
        pelvic.x,
        pelvic.y,
        pelvic.tx,
        pelvic.ty,
        pelvic.nx * side,
        pelvic.ny * side,
        fish.size * 0.13,
        fish.base[0],
      );
    }
    const tail = pose[pose.length - 1];
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(tail.x, tail.y);
    ctx.quadraticCurveTo(
      tail.x - tail.tx * fish.size * 0.2 + tail.nx * fish.size * 0.22,
      tail.y - tail.ty * fish.size * 0.2 + tail.ny * fish.size * 0.22,
      tail.x - tail.tx * fish.size * 0.42 + tail.nx * fish.size * 0.26,
      tail.y - tail.ty * fish.size * 0.42 + tail.ny * fish.size * 0.26,
    );
    ctx.quadraticCurveTo(
      tail.x - tail.tx * fish.size * 0.28 + tail.nx * fish.size * 0.04,
      tail.y - tail.ty * fish.size * 0.28 + tail.ny * fish.size * 0.04,
      tail.x - tail.tx * fish.size * 0.08,
      tail.y - tail.ty * fish.size * 0.08,
    );
    ctx.quadraticCurveTo(
      tail.x - tail.tx * fish.size * 0.28 - tail.nx * fish.size * 0.04,
      tail.y - tail.ty * fish.size * 0.28 - tail.ny * fish.size * 0.04,
      tail.x - tail.tx * fish.size * 0.42 - tail.nx * fish.size * 0.26,
      tail.y - tail.ty * fish.size * 0.42 - tail.ny * fish.size * 0.26,
    );
    ctx.quadraticCurveTo(
      tail.x - tail.tx * fish.size * 0.2 - tail.nx * fish.size * 0.22,
      tail.y - tail.ty * fish.size * 0.2 - tail.ny * fish.size * 0.22,
      tail.x,
      tail.y,
    );
    ctx.fillStyle = fish.metallic ? "rgba(255, 214, 130, 0.85)" : "rgba(255, 250, 244, 0.82)";
    ctx.fill();
    ctx.restore();
  }

  private drawFin(
    x: number,
    y: number,
    tx: number,
    ty: number,
    nx: number,
    ny: number,
    length: number,
    color: string,
  ) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.ellipse(
      x + nx * length * 0.55,
      y + ny * length * 0.55,
      length * 0.62,
      length * 0.16,
      Math.atan2(ny, nx) - Math.atan2(ty, tx) * 0.25,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.42;
    ctx.fill();
  }

  private drawFry(fry: Fry) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(fry.x, fry.y);
    ctx.rotate(fry.angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, fry.size * 1.5, fry.size * 0.48, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(244, 248, 246, 0.92)";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-fry.size, 0);
    ctx.lineTo(-fry.size * 2.1, fry.size * 0.45);
    ctx.lineTo(-fry.size * 2.1, -fry.size * 0.45);
    ctx.closePath();
    ctx.fillStyle = "rgba(230, 240, 236, 0.8)";
    ctx.fill();
    ctx.restore();
  }

  private traceBody(pose: Pose[], size: number, ox: number, oy: number) {
    const ctx = this.ctx;
    const left: { x: number; y: number }[] = [];
    const right: { x: number; y: number }[] = [];
    for (let i = 0; i < pose.length; i++) {
      const point = pose[i];
      const radius = bodyRadius(i / (pose.length - 1)) * size * 0.2;
      left.push({ x: point.x + point.nx * radius + ox, y: point.y + point.ny * radius + oy });
      right.push({ x: point.x - point.nx * radius + ox, y: point.y - point.ny * radius + oy });
    }
    const nose = pose[0];
    ctx.moveTo(nose.x + nose.tx * size * 0.16 + ox, nose.y + nose.ty * size * 0.16 + oy);
    this.curveThrough(left);
    const tail = pose[pose.length - 1];
    ctx.lineTo(tail.x - tail.tx * size * 0.08 + ox, tail.y - tail.ty * size * 0.08 + oy);
    this.curveThrough([...right].reverse());
    ctx.closePath();
  }

  private curveThrough(points: { x: number; y: number }[]) {
    const ctx = this.ctx;
    if (!points.length) return;
    for (let i = 0; i < points.length - 1; i++) {
      const next = points[i + 1];
      const midX = (points[i].x + next.x) / 2;
      const midY = (points[i].y + next.y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
  }

  private drawPad(x: number, y: number, radius: number, rot: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, 0.42, Math.PI * 2 - 0.08);
    ctx.closePath();
    const fill = ctx.createRadialGradient(-radius * 0.25, -radius * 0.3, radius * 0.1, 0, 0, radius);
    fill.addColorStop(0, "#3d7a52");
    fill.addColorStop(0.55, "#1d5236");
    fill.addColorStop(1, "#0e3322");
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = "rgba(186, 214, 176, 0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(radius * 0.15, 0);
    ctx.lineTo(radius * 0.92, 0);
    ctx.moveTo(0, 0);
    ctx.lineTo(radius * 0.55, radius * 0.38);
    ctx.moveTo(0, 0);
    ctx.lineTo(radius * 0.5, -radius * 0.36);
    ctx.stroke();
    ctx.restore();
  }

  private drawLotus(x: number, y: number, size: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(this.time * 0.6) * 0.08);
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.rotate((i / 8) * Math.PI * 2);
      ctx.beginPath();
      ctx.ellipse(0, size * 0.55, size * 0.22, size * 0.48, 0, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0 ? "#f4a3b4" : "#ee8ea3";
      ctx.fill();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = "#f3c94a";
    ctx.fill();
    ctx.restore();
  }

  private drawDuckweed() {
    const ctx = this.ctx;
    const specks = [
      [0.78, 0.16],
      [0.84, 0.2],
      [0.8, 0.24],
      [0.88, 0.14],
      [0.74, 0.22],
      [0.18, 0.72],
      [0.22, 0.76],
    ];
    for (const [fx, fy] of specks) {
      ctx.beginPath();
      ctx.ellipse(fx * this.bufW, fy * this.bufH, this.bufH * 0.018, this.bufH * 0.012, 0.4, 0, Math.PI * 2);
      ctx.fillStyle = "#8fce4a";
      ctx.fill();
    }
  }

  private drawRipples() {
    const ctx = this.ctx;
    for (const ripple of this.ripples) {
      const t = ripple.age / ripple.life;
      ctx.beginPath();
      ctx.ellipse(ripple.x, ripple.y, (8 + t * this.bufW * 0.28), (6 + t * this.bufH * 0.22), 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(236, 255, 250, ${((1 - t) * 0.55).toFixed(3)})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }

  private drawCaustics(alpha: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 1.25;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      for (let x = 0; x <= this.bufW; x += 10) {
        const y =
          this.bufH * (0.18 + i * 0.2) +
          Math.sin(x * 0.012 + this.time * 0.8 + i) * this.bufH * 0.035 +
          Math.sin(x * 0.005 - this.time * 0.45 + i * 1.7) * this.bufH * 0.05;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  private clipPond() {
    const radius = Math.min(this.bufW, this.bufH) * 0.12;
    this.ctx.beginPath();
    this.ctx.roundRect(1, 1, this.bufW - 2, this.bufH - 2, radius);
    this.ctx.clip();
  }
}

export function pondLayout(cssW: number, cssH: number, openT: number) {
  const span = clamp(openT, 0, 1);
  const maxW = Math.min(cssW * 0.34, 268);
  const maxH = Math.min(cssH * 0.9, 220);
  const w = maxW * span;
  const h = maxH * Math.min(1, span * 1.2);
  return {
    w,
    h,
    x: (cssW - w) / 2,
    y: (cssH - h) / 2,
    maxW,
  };
}
