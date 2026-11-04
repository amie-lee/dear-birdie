"use client";

import { useEffect, useRef, useState } from "react";
import FlightFrames from "./flight-frames";

export default function SendingSequence({ onComplete }: { onComplete: () => void }) {
  const [stage, setStage] = useState<"fold" | "flight">("fold");
  const finished = useRef(false);
  const completion = useRef(onComplete);
  completion.current = onComplete;

  function finish() {
    if (finished.current) return;
    finished.current = true;
    completion.current();
  }

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => {
      if (reducedMotion) {
        if (!finished.current) {
          finished.current = true;
          completion.current();
        }
      } else {
        setStage("flight");
      }
    }, reducedMotion ? 150 : 1500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (stage !== "flight") return;
    // An asset download failure must not trap a sent letter.
    const fallback = window.setTimeout(() => {
      if (!finished.current) {
        finished.current = true;
        completion.current();
      }
    }, 8000);
    return () => window.clearTimeout(fallback);
  }, [stage]);

  return (
    <section className="dispatch approved-sequence" aria-label="Sending your letter">
      {stage === "fold" ? (
        <div className="parcel-trip"><div className="fold-sheet"><i /><b /><em /></div></div>
      ) : (
        <FlightFrames onComplete={finish} />
      )}
      <button className="skip-flight" onClick={finish}>Skip</button>
    </section>
  );
}
