import { useEffect, useRef, useState } from "react";

interface Point {
  x: number;
  y: number;
}

// A chain of nodes: the head eases toward the raw cursor position, and each
// trailing node eases toward the node ahead of it. While the pointer moves,
// this naturally stretches (trailing nodes lag proportionally to speed).
// When the pointer stops, the head stops moving and each node in turn
// catches up to the one ahead — the whole chain smoothly collapses onto a
// single point near the cursor instead of freezing as a stretched line.
const NODE_COUNT = 7;
const HEAD_EASE = 0.22;
const CHAIN_EASE = 0.32;
const SETTLE_EPSILON = 0.4; // px of remaining movement below which the chain is considered fully settled
const RADII = [4, 3.4, 2.8, 2.3, 1.8, 1.4, 1.1];

function matchesDesktopPointer() {
  return (
    window.innerWidth >= 1024 &&
    !("ontouchstart" in window) &&
    window.matchMedia("(pointer: fine)").matches
  );
}

function matchesReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const CursorTrailLine = () => {
  const [enabled, setEnabled] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const glowRef = useRef<SVGCircleElement>(null);
  const dotRefs = useRef<(SVGCircleElement | null)[]>([]);

  // Checks whether this effect should run at all — recomputed on resize and
  // on a live prefers-reduced-motion change, same as the original component.
  useEffect(() => {
    const update = () => setEnabled(matchesDesktopPointer() && !matchesReducedMotion());
    update();

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    window.addEventListener("resize", update);
    reducedMotionQuery.addEventListener("change", update);
    return () => {
      window.removeEventListener("resize", update);
      reducedMotionQuery.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    const target: Point = { x: -100, y: -100 };
    const nodes: Point[] = Array.from({ length: NODE_COUNT }, () => ({ x: -100, y: -100 }));
    let rafId: number | null = null;

    function render() {
      if (pathRef.current) {
        let d = `M ${nodes[0].x.toFixed(1)} ${nodes[0].y.toFixed(1)}`;
        for (let i = 1; i < nodes.length; i++) {
          d += ` L ${nodes[i].x.toFixed(1)} ${nodes[i].y.toFixed(1)}`;
        }
        pathRef.current.setAttribute("d", d);
      }
      dotRefs.current.forEach((el, i) => {
        el?.setAttribute("cx", nodes[i].x.toFixed(1));
        el?.setAttribute("cy", nodes[i].y.toFixed(1));
      });
      if (glowRef.current) {
        glowRef.current.setAttribute("cx", nodes[0].x.toFixed(1));
        glowRef.current.setAttribute("cy", nodes[0].y.toFixed(1));
      }
    }

    function tick() {
      let maxDelta = 0;

      const head = nodes[0];
      const dx0 = target.x - head.x;
      const dy0 = target.y - head.y;
      head.x += dx0 * HEAD_EASE;
      head.y += dy0 * HEAD_EASE;
      maxDelta = Math.max(maxDelta, Math.abs(dx0), Math.abs(dy0));

      for (let i = 1; i < nodes.length; i++) {
        const prev = nodes[i - 1];
        const node = nodes[i];
        const dx = prev.x - node.x;
        const dy = prev.y - node.y;
        node.x += dx * CHAIN_EASE;
        node.y += dy * CHAIN_EASE;
        maxDelta = Math.max(maxDelta, Math.abs(dx), Math.abs(dy));
      }

      render();

      // Stop the loop once everything has converged — it restarts instantly
      // on the next pointer move. Keeps this idle at 0 CPU rather than
      // looping forever once the cursor is still.
      if (maxDelta < SETTLE_EPSILON) {
        rafId = null;
        return;
      }
      rafId = requestAnimationFrame(tick);
    }

    function startLoop() {
      if (rafId === null) {
        rafId = requestAnimationFrame(tick);
      }
    }

    function stopLoop() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    function show() {
      container.style.opacity = "1";
    }

    function hide() {
      container.style.opacity = "0";
    }

    function handlePointerMove(e: PointerEvent) {
      if (e.pointerType !== "mouse") return; // ignore touch/pen drags on hybrid devices
      target.x = e.clientX;
      target.y = e.clientY;
      show();
      startLoop();
    }

    function handleLeave() {
      hide();
    }

    function handleEnter() {
      show();
    }

    function handleBlur() {
      hide();
    }

    function handleVisibilityChange() {
      if (document.hidden) stopLoop();
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("mouseleave", handleLeave);
    document.addEventListener("mouseenter", handleEnter);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("mouseleave", handleLeave);
      document.removeEventListener("mouseenter", handleEnter);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopLoop();
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden transition-opacity duration-300"
      style={{ opacity: 1 }}
    >
      <svg className="w-full h-full">
        <path
          ref={pathRef}
          fill="none"
          stroke="hsl(var(--cursor-trail))"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.7}
          style={{ filter: "drop-shadow(0 0 2px hsl(var(--cursor-trail) / 0.5))" }}
        />
        {RADII.map((r, i) => (
          <circle
            key={i}
            ref={(el) => {
              dotRefs.current[i] = el;
            }}
            r={r}
            fill="hsl(var(--cursor-trail))"
            opacity={1 - i * 0.1}
          />
        ))}
        <circle
          ref={glowRef}
          r={8}
          fill="none"
          stroke="hsl(var(--cursor-trail) / 0.3)"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
};

export default CursorTrailLine;
