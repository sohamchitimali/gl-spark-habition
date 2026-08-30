import { useEffect, useRef } from 'react';

// The 11 heatmap colors (including 0% empty block color)
const COLORS = [
  '#2C2C2A', '#333E2B', '#39512C', '#40642E', '#46772F',
  '#4D8A31', '#539D32', '#5AB034', '#61C335', '#67D637', '#6EE938'
];

// Block properties
const BLOCK_SIZE = 12;
const GAP = 4;
const COLUMN_WIDTH = BLOCK_SIZE + GAP;

// How long to wait after the last resize event before doing a full
// re-layout of the (permanent) stacked blocks. Cheap per-frame updates
// don't need this; only the "floor moved, everything needs to shift"
// full redraw does.
const RESIZE_SETTLE_MS = 120;

// Global state to survive any React re-renders or unmounts during resize.
// Sized to the FULL SCREEN, not just the current window — see the
// architecture note below.
type Drop = { y: number; speed: number; color: string } | null;
let globalAllocatedWidth = 0;
let globalAllocatedHeight = 0;
let globalColumns = 0;
let globalMaxStackSize = 0;
let globalActiveDrops: Drop[] = [];
let globalStacks: string[][] = [];

/**
 * ARCHITECTURE
 *
 * 1. Full-screen grid, always: the canvas is allocated once at the
 *    screen's resolution (a window can never exceed its screen), and
 *    every column simulates continuously whether currently visible or
 *    not. A wrapper div with overflow: hidden acts as a pure-CSS
 *    clipping mask sized to the viewport, so resizing the window just
 *    reveals/covers already-running content — nothing is created or
 *    destroyed at reveal time.
 *
 * 2. Two-layer rendering, for performance: placed blocks are permanent
 *    once they land, so they're drawn ONCE onto a background canvas and
 *    never touched again (no per-frame cost, no matter how tall a tower
 *    gets). Only the single falling block per column is redrawn each
 *    frame, on a separate, cheap drop-layer canvas stacked on top.
 *    Without this split, cost per frame grows with total blocks ever
 *    placed; with it, cost per frame only depends on how many columns
 *    currently have something falling.
 *
 * 3. Full columns simply stop, they don't reset: once a column reaches
 *    its max height, it just idles — no random clear-and-restart.
 */
export const ConsistencyCascade = () => {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const dropCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const bgCanvas = bgCanvasRef.current;
    const dropCanvas = dropCanvasRef.current;
    if (!bgCanvas || !dropCanvas) return;

    const bgCtx = bgCanvas.getContext('2d');
    const dropCtx = dropCanvas.getContext('2d');
    if (!bgCtx || !dropCtx) return;

    let animationFrameId: number;
    let resizeSettleTimer: ReturnType<typeof setTimeout> | null = null;

    // Current visible (CSS px) window size, updated live on every resize.
    let width = window.innerWidth;
    let height = window.innerHeight;
    // The height the background layer was last fully laid out for. When
    // `height` drifts away from this, the permanent blocks are stale
    // (they're anchored to the floor, which moved) and need one full
    // relayout — done once, after resizing settles.
    let bgLayoutHeight = height;

    const drawBlock = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, BLOCK_SIZE, BLOCK_SIZE, 3);
      ctx.fill();
    };

    // Draws every block currently in a column's stack onto the
    // background layer. Only called during a full relayout, or once
    // for a freshly-synthesized column — never on a routine frame.
    const drawColumnStackFull = (col: number) => {
      const stack = globalStacks[col];
      if (!stack) return;
      const x = col * COLUMN_WIDTH;
      for (let j = 0; j < stack.length; j++) {
        const y = height - ((j + 1) * (BLOCK_SIZE + GAP));
        if (y < -BLOCK_SIZE) continue;
        drawBlock(bgCtx, x, y, stack[j]);
      }
    };

    // Full relayout of the permanent layer: only needed after the
    // backing buffer was reallocated, or after the window's height
    // settles somewhere new (the floor moved).
    const redrawAllStacks = () => {
      bgCtx.clearRect(0, 0, globalAllocatedWidth, globalAllocatedHeight);
      for (let i = 0; i < globalColumns; i++) drawColumnStackFull(i);
      bgLayoutHeight = height;
    };

    // The cheap, steady-state path: one block just landed. Draw only
    // that block, at its position for the CURRENT (unchanged-since-last-
    // layout) height, directly onto the permanent layer. O(1), not
    // O(tower height).
    const appendLandedBlock = (col: number, color: string, stackLenAfterPush: number) => {
      const x = col * COLUMN_WIDTH;
      const y = height - (stackLenAfterPush * (BLOCK_SIZE + GAP));
      if (y < -BLOCK_SIZE) return;
      drawBlock(bgCtx, x, y, color);
    };

    // Spawn behavior differs by context:
    //  - 'initial': the very first paint. Scatter above the screen so it
    //    doesn't open with a synchronized wall of blocks.
    //  - 'steady': a column's block just landed and needs its next drop.
    type SpawnMode = 'initial' | 'steady';
    const spawnDrop = (col: number, mode: SpawnMode): Drop => {
      if (!globalStacks[col] || globalStacks[col].length >= globalMaxStackSize - 1) return null;
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const y = mode === 'initial'
        ? (Math.random() * -height) - 50
        : -(50 + Math.random() * 80);
      return {
        y,
        speed: (Math.random() * 2) + 2,
        color
      };
    };

    // Used for columns revealed later (window widened onto previously
    // unallocated space). Synthesizes a partial stack + an in-flight
    // drop so it looks already-established. The actual pixels get drawn
    // during the redrawAllStacks() call that follows in ensureCapacity.
    const synthesizeEstablishedColumn = (col: number) => {
      const seedLen = Math.floor(Math.random() * Math.min(globalMaxStackSize - 2, 14));
      const stack: string[] = [];
      for (let k = 0; k < seedLen; k++) {
        stack.push(COLORS[Math.floor(Math.random() * COLORS.length)]);
      }
      globalStacks[col] = stack;

      const floorY = height - (stack.length * (BLOCK_SIZE + GAP)) - BLOCK_SIZE;
      globalActiveDrops[col] = {
        y: Math.random() * (floorY + 40) - 40,
        speed: (Math.random() * 2) + 2,
        color: COLORS[Math.floor(Math.random() * COLORS.length)]
      };
    };

    // EXPENSIVE: reallocates the backing buffers. Only runs on first
    // mount, or if the window ends up on a bigger screen than we
    // originally allocated for.
    const ensureCapacity = (needW: number, needH: number) => {
      if (needW <= globalAllocatedWidth && needH <= globalAllocatedHeight) return;

      const isFirstAllocation = globalAllocatedWidth === 0;
      const dpr = window.devicePixelRatio || 1;
      const allocW = Math.max(needW, window.screen.width, globalAllocatedWidth);
      const allocH = Math.max(needH, window.screen.height, globalAllocatedHeight);

      for (const c of [bgCanvas, dropCanvas]) {
        c.width = allocW * dpr;
        c.height = allocH * dpr;
        c.style.width = `${allocW}px`;
        c.style.height = `${allocH}px`;
      }
      bgCtx.setTransform(1, 0, 0, 1, 0, 0);
      bgCtx.scale(dpr, dpr);
      dropCtx.setTransform(1, 0, 0, 1, 0, 0);
      dropCtx.scale(dpr, dpr);

      const newColumns = Math.floor(allocW / COLUMN_WIDTH);
      globalMaxStackSize = Math.floor(allocH / (BLOCK_SIZE + GAP));

      for (let i = 0; i < newColumns; i++) {
        if (globalStacks[i]) continue; // already exists, never touch it
        if (isFirstAllocation) {
          globalStacks[i] = [];
          globalActiveDrops[i] = spawnDrop(i, 'initial');
        } else {
          synthesizeEstablishedColumn(i);
        }
      }
      globalColumns = newColumns;
      globalAllocatedWidth = allocW;
      globalAllocatedHeight = allocH;

      // Reallocating the backing buffer always wipes its pixels, so the
      // permanent layer needs one full redraw from the data we still
      // have in memory (nothing was lost, just the pixels).
      redrawAllStacks();
    };

    // Advances the simulation by one frame: moves drops, lands blocks
    // (appending just the one new block to the permanent layer), and
    // starts new drops. Full columns simply stop — no reset.
    const advance = () => {
      for (let i = 0; i < globalColumns; i++) {
        const stack = globalStacks[i];
        if (!stack) continue;

        const drop = globalActiveDrops[i];
        if (drop) {
          drop.y += drop.speed;
          const floorY = height - (stack.length * (BLOCK_SIZE + GAP)) - BLOCK_SIZE;
          if (drop.y >= floorY) {
            stack.push(drop.color);
            appendLandedBlock(i, drop.color, stack.length);
            globalActiveDrops[i] = spawnDrop(i, 'steady');
          }
        } else if (stack.length < globalMaxStackSize - 1) {
          globalActiveDrops[i] = spawnDrop(i, 'steady');
        }
        // else: column is full — leave it standing, permanently.
      }
    };

    // Cheap per-frame draw: only the drop layer, only currently-falling
    // blocks. The permanent layer underneath is untouched.
    const renderDrops = () => {
      dropCtx.clearRect(0, 0, globalAllocatedWidth, globalAllocatedHeight);
      for (let i = 0; i < globalColumns; i++) {
        const drop = globalActiveDrops[i];
        if (!drop) continue;
        const x = i * COLUMN_WIDTH;

        dropCtx.fillStyle = drop.color;
        dropCtx.shadowBlur = 10;
        dropCtx.shadowColor = drop.color;
        dropCtx.beginPath();
        dropCtx.roundRect(x, drop.y, BLOCK_SIZE, BLOCK_SIZE, 3);
        dropCtx.fill();
        dropCtx.shadowBlur = 0;
      }
    };

    const onResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      ensureCapacity(width, height);

      if (resizeSettleTimer) clearTimeout(resizeSettleTimer);
      resizeSettleTimer = setTimeout(() => {
        if (height !== bgLayoutHeight) redrawAllStacks();
      }, RESIZE_SETTLE_MS);
    };

    window.addEventListener('resize', onResize);
    ensureCapacity(width, height); // initial allocation

    const draw = () => {
      advance();
      renderDrops();
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', onResize);
      if (resizeSettleTimer) clearTimeout(resizeSettleTimer);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
      <canvas
        ref={bgCanvasRef}
        className="absolute top-0 left-0"
        style={{ opacity: 0.6 }}
      />
      <canvas
        ref={dropCanvasRef}
        className="absolute top-0 left-0"
        style={{ opacity: 0.6 }}
      />
    </div>
  );
};