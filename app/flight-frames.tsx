"use client";

import { useEffect, useRef } from "react";

type Frame = { sx: number; sy: number; x: number; y: number; width: number; height: number };
type Flight = { width: number; height: number; fps: number; frames: Array<Frame | null> };

export default function FlightFrames({ onComplete }: { onComplete: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const completion = useRef(onComplete);
  completion.current = onComplete;

  useEffect(() => {
    const controller = new AbortController();
    const atlas = new Image();
    let disposed = false;
    let animation = 0;

    async function play() {
      try {
        atlas.src = "/flight/approved-flight.webp";
        const [response] = await Promise.all([
          fetch("/flight/approved-flight.json", { signal: controller.signal }),
          atlas.decode(),
        ]);
        if (!response.ok) throw new Error("Flight frames unavailable");
        const flight = await response.json() as Flight;
        if (disposed) return;
        const context = canvas.current?.getContext("2d");
        if (!context || !canvas.current) throw new Error("Canvas unavailable");
        canvas.current.width = flight.width;
        canvas.current.height = flight.height;
        const start = performance.now();
        let lastFrame = -1;

        function draw(now: number) {
          if (disposed) return;
          const index = Math.floor((now - start) * flight.fps / 1000);
          if (index >= flight.frames.length) {
            completion.current();
            return;
          }
          if (index !== lastFrame) {
            context!.clearRect(0, 0, flight.width, flight.height);
            const frame = flight.frames[index];
            if (frame) {
              context!.drawImage(atlas, frame.sx, frame.sy, frame.width, frame.height,
                frame.x, frame.y, frame.width, frame.height);
            }
            lastFrame = index;
          }
          animation = requestAnimationFrame(draw);
        }
        draw(start);
      } catch {
        if (!disposed) completion.current();
      }
    }

    void play();
    return () => {
      disposed = true;
      controller.abort();
      cancelAnimationFrame(animation);
    };
  }, []);

  return <canvas ref={canvas} className="approved-flight" role="img" aria-label="A paper dove carries your letter away" />;
}
