"use client";

import { useEffect, useState } from "react";

type HomeMailProps = {
  onFocus: () => void;
  onWish: () => void;
  onFind: () => void;
  onArchive: () => void;
};

function LoadingBird() {
  return (
    <svg className="loading-bird" viewBox="0 0 48 36" fill="none" aria-hidden="true">
      <path d="M7 24 16 20C21 16 27 16 32 15L36 11 40 13 44 15 39 16C34 23 26 25 17 24L8 28Z" fill="currentColor" />
      <path className="loading-wing" d="M28 20C20 18 14 11 13 4 22 7 29 12 32 18Z" fill="currentColor" />
    </svg>
  );
}

export default function HomeMail({ onFocus, onWish, onFind, onArchive }: HomeMailProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const source = `/cool-envelope.webp${attempt ? `?retry=${attempt}` : ""}`;

  useEffect(() => {
    let disposed = false;
    const image = new Image();
    image.src = source;
    const fonts = [
      document.fonts.load('400 68px "Mrs Saint Delafield"'),
      document.fonts.load('400 39px "La Belle Aurore"'),
      document.fonts.load('400 11px "DM Sans"'),
    ];
    // Font errors fall back gracefully; a missing envelope needs a retry.
    Promise.all([image.decode(), Promise.allSettled(fonts)]).then(() => {
      if (!disposed) setStatus("ready");
    }).catch(() => {
      if (!disposed) setStatus("error");
    });
    return () => { disposed = true; };
  }, [source]);

  return (
    <section className="quiet-home" aria-busy={status === "loading"}>
      {status === "ready" ? (
        <div className="home-reveal">
          <div className="mail-object">
            <img src={source} alt="" fetchPriority="high" />
            <h1 className="wordmark">Dear Birdie</h1>
            <div className="mail-choices">
              <button onClick={onFocus}>Focus</button>
              <button onClick={onWish}>Make a wish</button>
            </div>
          </div>
          <nav className="home-links" aria-label="Letters">
            <button onClick={onFind}>Find a letter</button>
            <button onClick={onArchive}>My letters</button>
          </nav>
        </div>
      ) : (
        <div className={`home-loading ${status === "error" ? "load-error" : ""}`} role="status" aria-label={status === "loading" ? "Loading Dear Birdie" : "Unable to load the envelope"}>
          <LoadingBird />
          {status === "error" && <button onClick={() => { setStatus("loading"); setAttempt(value => value + 1); }}>Try again</button>}
        </div>
      )}
    </section>
  );
}
