/**
 * Saved hero integration: fabric 篠崎 + click-to-open koi pond.
 * Not mounted — re-export from page when you want the pond back.
 * Fish simulation: ../koi-pond.ts
 */
"use client";

import { useEffect, useRef, useState } from "react";

import { KoiPond, pondLayout } from "@/components/pond/koi-pond";

const FONT_FAMILY = "'Shippori Mincho', 'Yu Mincho', 'Hiragino Mincho ProN', serif";

function damp(current: number, target: number, dt: number) {
  return current + (target - current) * (1 - Math.exp(-dt / 0.38));
}

type Scratch = {
  text: HTMLCanvasElement;
  blur: HTMLCanvasElement;
  image: ImageData | null;
};

function scratchCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return canvas.getContext("2d", { willReadFrequently: true });
}

function drawFabric(
  canvas: HTMLCanvasElement,
  scratch: Scratch,
  cssW: number,
  cssH: number,
  openT: number,
  dark: boolean,
) {
  const width = Math.max(1, Math.floor(cssW));
  const height = Math.max(1, Math.floor(cssH));
  const ctx = scratchCanvas(canvas, width, height);
  const textCtx = scratchCanvas(scratch.text, width, height);
  const blurCtx = scratchCanvas(scratch.blur, width, height);
  if (!ctx || !textCtx || !blurCtx) return;

  const layout = pondLayout(cssW, cssH, openT);
  const fontPx = Math.min(cssH * 0.62, (cssW - layout.maxW) * 0.42, cssW * 0.28);
  const centerY = height / 2;
  const leftX = layout.x - fontPx * 0.48;
  const rightX = layout.x + layout.w + fontPx * 0.48;

  textCtx.clearRect(0, 0, width, height);
  textCtx.fillStyle = "#fff";
  textCtx.font = `600 ${fontPx}px ${FONT_FAMILY}`;
  textCtx.textAlign = "center";
  textCtx.textBaseline = "middle";
  textCtx.fillText("篠", leftX, centerY);
  textCtx.fillText("崎", rightX, centerY);

  blurCtx.clearRect(0, 0, width, height);
  blurCtx.filter = `blur(${Math.max(5, fontPx * 0.05)}px)`;
  blurCtx.drawImage(scratch.text, 0, 0);
  const broad = blurCtx.getImageData(0, 0, width, height);

  blurCtx.clearRect(0, 0, width, height);
  blurCtx.filter = `blur(${Math.max(1, fontPx * 0.012)}px)`;
  blurCtx.drawImage(scratch.text, 0, 0);
  const fine = blurCtx.getImageData(0, 0, width, height);

  if (!scratch.image || scratch.image.width !== width || scratch.image.height !== height) {
    scratch.image = ctx.createImageData(width, height);
  }
  const out = scratch.image;
  out.data.fill(0);
  const data = out.data;

  const heightMap = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    heightMap[i] = (broad.data[i * 4 + 3] * 0.32 + fine.data[i * 4 + 3] * 0.68) / 255;
  }

  const nz = 0.32;
  const heightAt = (x: number, y: number) => {
    const xx = Math.max(0, Math.min(width - 1, x));
    const yy = Math.max(0, Math.min(height - 1, y));
    return heightMap[yy * width + xx];
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const relief = heightMap[y * width + x];
      if (relief < 0.035) continue;
      const nx = heightAt(x - 1, y) - heightAt(x + 1, y);
      const ny = heightAt(x, y - 1) - heightAt(x, y + 1);
      const len = Math.hypot(nx, ny, nz) || 1;
      const light = Math.hypot(-0.4, -0.78, 0.7);
      const diffuse = Math.max(0, (-0.4 * nx + -0.78 * ny + 0.7 * nz) / (len * light));
      const cast = Math.max(0, heightAt(x - 5, y - 4) - relief);
      const form = Math.min(1, relief * 1.4);
      const index = (y * width + x) * 4;
      const shadow = (1 - diffuse) * form * 0.9 + cast * 0.55;
      const highlight = Math.max(0, diffuse - 0.58) * form;

      if (dark) {
        const lit = highlight > shadow;
        data[index] = lit ? 255 : 0;
        data[index + 1] = lit ? 255 : 0;
        data[index + 2] = lit ? 255 : 0;
        data[index + 3] = Math.min(255, (lit ? highlight : shadow) * 240);
      } else {
        const lit = highlight > shadow * 1.4;
        data[index] = lit ? 255 : 32;
        data[index + 1] = lit ? 255 : 30;
        data[index + 2] = lit ? 255 : 26;
        data[index + 3] = Math.min(220, (lit ? highlight * 0.45 : shadow) * 255);
      }
    }
  }

  ctx.clearRect(0, 0, width, height);
  ctx.putImageData(out, 0, 0);

  if (openT > 0.05 && layout.w > 8) {
    ctx.save();
    ctx.strokeStyle = dark ? "rgba(0,0,0,0.5)" : "rgba(36, 32, 28, 0.18)";
    ctx.lineWidth = 8 * openT;
    ctx.shadowColor = dark ? "rgba(0,0,0,0.55)" : "rgba(36, 32, 28, 0.22)";
    ctx.shadowBlur = 16;
    const radius = Math.min(layout.w, layout.h) * 0.12;
    ctx.beginPath();
    ctx.roundRect(layout.x, layout.y, layout.w, layout.h, radius);
    ctx.stroke();
    ctx.restore();
  }
}

/** @deprecated Use HeroKanjiPond on the home page; swap import to this when re-enabling the pond. */
export function HeroKanjiPondWithPond() {
  const rootRef = useRef<HTMLDivElement>(null);
  const fabricRef = useRef<HTMLCanvasElement>(null);
  const pondRef = useRef<HTMLCanvasElement>(null);
  const openRef = useRef(false);
  const kickRef = useRef<() => void>(() => {});
  const pondRefApi = useRef<KoiPond | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    const fabric = fabricRef.current;
    const pondCanvas = pondRef.current;
    if (!root || !fabric || !pondCanvas) return;

    const pond = new KoiPond(pondCanvas);
    const scratch: Scratch = {
      text: document.createElement("canvas"),
      blur: document.createElement("canvas"),
      image: null,
    };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let openT = 0;
    let raf = 0;
    let last = 0;
    let looping = false;
    let visible = true;
    let paintedOpen = -1;
    let paintedW = 0;
    let paintedH = 0;
    let paintedDark = false;

    const frame = (now: number) => {
      looping = false;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      const target = openRef.current ? 1 : 0;
      openT = reduce.matches ? target : damp(openT, target, dt);
      const box = root.getBoundingClientRect();
      const dark = document.documentElement.classList.contains("dark");
      const clothChanged =
        Math.abs(openT - paintedOpen) > 0.01 ||
        box.width !== paintedW ||
        box.height !== paintedH ||
        dark !== paintedDark;
      if (clothChanged) {
        drawFabric(fabric, scratch, box.width, box.height, openT, dark);
        paintedOpen = openT;
        paintedW = box.width;
        paintedH = box.height;
        paintedDark = dark;
      }

      const layout = pondLayout(box.width, box.height, openT);
      pondCanvas.style.width = `${layout.w}px`;
      pondCanvas.style.height = `${layout.h}px`;
      pondCanvas.style.opacity = String(Math.min(1, openT * 1.35));
      pondCanvas.style.pointerEvents = openT > 0.42 ? "auto" : "none";
      if (layout.w > 24 && layout.h > 24) {
        pond.resize(layout.w, layout.h);
        if (!reduce.matches) pond.update(dt);
        pond.draw();
      }

      const moving = Math.abs(openT - target) > 0.004;
      const swim = openT > 0.04 && !reduce.matches && visible && !document.hidden;
      if (moving || swim) {
        looping = true;
        raf = requestAnimationFrame(frame);
      }
    };

    const kick = () => {
      if (looping) return;
      last = 0;
      paintedOpen = -1;
      looping = true;
      raf = requestAnimationFrame(frame);
    };
    kickRef.current = kick;
    pondRefApi.current = pond;

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) kick();
      },
      { threshold: 0.08 },
    );
    observer.observe(root);

    const resize = new ResizeObserver(() => kick());
    resize.observe(root);

    const onFonts = () => kick();
    document.fonts.addEventListener("loadingdone", onFonts);
    void document.fonts.load(`600 64px ${FONT_FAMILY}`);

    const onVisible = () => {
      if (!document.hidden) kick();
    };
    document.addEventListener("visibilitychange", onVisible);

    const theme = new MutationObserver(() => kick());
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    kick();

    return () => {
      looping = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      resize.disconnect();
      document.fonts.removeEventListener("loadingdone", onFonts);
      document.removeEventListener("visibilitychange", onVisible);
      theme.disconnect();
      pond.destroy();
      kickRef.current = () => {};
      pondRefApi.current = null;
    };
  }, []);

  return (
    <div ref={rootRef} className="relative mx-auto mt-4 h-52 w-full max-w-5xl sm:mt-6 sm:h-72">
      <canvas ref={fabricRef} aria-hidden className="pointer-events-none absolute inset-0 size-full" />
      <button
        type="button"
        aria-pressed={open}
        aria-label={open ? "Close the pond and bring 篠崎 back together" : "Part 篠崎 and reveal the pond"}
        onClick={() => {
          openRef.current = !openRef.current;
          setOpen(openRef.current);
          kickRef.current();
        }}
        className="absolute inset-0 z-10 cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
      />
      <canvas
        ref={pondRef}
        aria-hidden
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          pondRefApi.current?.callTo(event.clientX - rect.left, event.clientY - rect.top);
          event.stopPropagation();
        }}
        className="absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
      />
    </div>
  );
}
