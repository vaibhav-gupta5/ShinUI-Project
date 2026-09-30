"use client";

import { useEffect, useRef } from "react";

const FONT_FAMILY = "'Shippori Mincho', 'Yu Mincho', 'Hiragino Mincho ProN', serif";

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
  dark: boolean,
) {
  const width = Math.max(1, Math.floor(cssW));
  const height = Math.max(1, Math.floor(cssH));
  const ctx = scratchCanvas(canvas, width, height);
  const textCtx = scratchCanvas(scratch.text, width, height);
  const blurCtx = scratchCanvas(scratch.blur, width, height);
  if (!ctx || !textCtx || !blurCtx) return;

  const centerX = cssW / 2;
  const fontPx = Math.min(cssH * 0.62, cssW * 0.32);
  const centerY = height / 2;
  const leftX = centerX - fontPx * 0.48;
  const rightX = centerX + fontPx * 0.48;

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
}

/** Embossed 篠崎 under the hero surface. Pond code lives in `src/components/pond/`. */
export function HeroKanjiPond() {
  const rootRef = useRef<HTMLDivElement>(null);
  const fabricRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const fabric = fabricRef.current;
    if (!root || !fabric) return;

    const scratch: Scratch = {
      text: document.createElement("canvas"),
      blur: document.createElement("canvas"),
      image: null,
    };

    const paint = () => {
      const box = root.getBoundingClientRect();
      if (box.width < 8 || box.height < 8) return;
      const dark = document.documentElement.classList.contains("dark");
      drawFabric(fabric, scratch, box.width, box.height, dark);
    };

    const resize = new ResizeObserver(paint);
    resize.observe(root);

    const onFonts = () => paint();
    document.fonts.addEventListener("loadingdone", onFonts);
    void document.fonts.load(`600 64px ${FONT_FAMILY}`);

    const theme = new MutationObserver(paint);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    paint();

    return () => {
      resize.disconnect();
      document.fonts.removeEventListener("loadingdone", onFonts);
      theme.disconnect();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden
      className="relative mx-auto mt-4 h-52 w-full max-w-5xl sm:mt-6 sm:h-72"
    >
      <canvas className="pointer-events-none absolute inset-0 size-full" ref={fabricRef} />
    </div>
  );
}
