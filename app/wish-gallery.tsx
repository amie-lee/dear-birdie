"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, Heart, RotateCcw, X } from "lucide-react";

type SharedWish = { id: string; body: string; createdAt: number };
type WishPage = { letters: SharedWish[]; nextCursor: string | null };

export default function WishGallery({ arrival, onBack, onWrite }: {
  arrival: string;
  onBack: () => void;
  onWrite: () => void;
}) {
  const [letters, setLetters] = useState<SharedWish[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<SharedWish | null>(null);
  const [cheered, setCheered] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const fetching = useRef(false);
  const actionLock = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    fetch("/api/wishes", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<WishPage>;
      })
      .then(page => { setLetters(page.letters); setCursor(page.nextCursor); })
      .catch(() => { if (!controller.signal.aborted) setError("The post is unavailable. Please try again."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { mounted.current = false; controller.abort(); };
  }, []);

  async function loadMore(retry = false) {
    if (fetching.current) return;
    fetching.current = true;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/wishes${!retry && cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const page = await response.json() as WishPage;
      if (!mounted.current) return;
      setLetters(previous => retry ? page.letters : [...previous, ...page.letters.filter(letter => !previous.some(item => item.id === letter.id))]);
      setCursor(page.nextCursor);
    } catch {
      if (mounted.current) setError("The post is unavailable. Please try again.");
    } finally {
      fetching.current = false;
      if (mounted.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal();
  }, [selected]);

  function close() { dialog.current?.close(); }
  function open(letter: SharedWish, button: HTMLButtonElement) {
    opener.current = button;
    setActionError("");
    setSelected(letter);
  }
  async function act(action: "cheer" | "report") {
    if (!selected || actionLock.current) return;
    actionLock.current = true;
    setActing(true);
    setActionError("");
    const id = selected.id;
    try {
      const response = await fetch("/api/wishes/action", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }),
      });
      if (!response.ok) throw new Error();
      if (!mounted.current) return;
      if (action === "cheer") setCheered(previous => new Set(previous).add(id));
      else {
        setLetters(previous => previous.filter(letter => letter.id !== id));
        setAnnouncement("Letter reported and removed from the exhibition.");
        close();
      }
    } catch {
      if (mounted.current) setActionError("That did not reach us. Please try again.");
    } finally {
      actionLock.current = false;
      if (mounted.current) setActing(false);
    }
  }

  return (
    <section className="exhibition-stage">
      <div className="exhibition-heading">
        <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back</button>
        <h2>Find a letter</h2>
        <button className="text-button" onClick={onWrite}>Leave a wish <ArrowRight size={14} /></button>
      </div>
      {arrival && <p className="exhibition-notice" role="status">{arrival}</p>}
      <p className="sr-only" role="status">{announcement}</p>
      {letters.length > 0 && (
        <div className="wish-field" aria-label="Shared wishes">
          {letters.map((letter, index) => (
            <div className="wish-drift" key={letter.id} style={{ "--turn": `${[-7, 5, -3, 8, -5, 3][index % 6]}deg`, "--delay": `${-(index % 7) * 1.7}s` } as CSSProperties}>
              <button className="wish-object" aria-label={`Open letter ${index + 1}: ${letter.body.slice(0, 45)}`} onClick={event => open(letter, event.currentTarget)}>
                <img src="/cool-postcard.webp" alt="" loading={index < 6 ? "eager" : "lazy"} width="640" height="460" />
                <span className="wish-number">DEAR SOMEWHERE · {String(index + 1).padStart(3, "0")}</span>
                <span className="wish-excerpt">{letter.body}</span>
                <span className="wish-signature">With hope, someone</span>
              </button>
            </div>
          ))}
        </div>
      )}
      {loading && letters.length === 0 && <div className="exhibition-empty" role="status"><span className="wordmark">Finding your way…</span></div>}
      {!loading && !error && letters.length === 0 && <div className="exhibition-empty"><p>The first wish could be yours.</p><button className="text-button" onClick={onWrite}>Make a wish <ArrowRight size={16} /></button></div>}
      {error && <div className="exhibition-feedback"><p className="error" role="alert">{error}</p><button className="text-button" disabled={loading} onClick={() => loadMore(letters.length === 0)}><RotateCcw size={14} /> Try again</button></div>}
      {cursor && !error && <div className="exhibition-more"><button className="text-button" disabled={loading} onClick={() => loadMore()}>{loading ? "Finding more…" : "A little further"} <ArrowRight size={15} /></button></div>}
      <dialog ref={dialog} className="wish-dialog" aria-labelledby="opened-wish-title" onClose={() => {
        setSelected(null);
        setActionError("");
        if (opener.current?.isConnected) opener.current.focus();
      }} onClick={event => { if (event.target === dialog.current) close(); }}>
        {selected && <div className="opened-wish">
          <div className="wish-dialog-toolbar"><button className="text-button" onClick={close} aria-label="Close letter"><X size={18} /> Close</button></div>
          <article className="paper opened-paper">
            <div className="paper-top"><span>FROM SOMEWHERE</span><span>DEAR BIRDIE</span></div>
            <h3 id="opened-wish-title" className="found-dear">Dear stranger,</h3>
            <blockquote>{selected.body}</blockquote>
            <p className="paper-signoff">With hope,<br /><em>someone</em></p>
          </article>
          <div className="found-actions">
            <button className="ink-button" disabled={acting || cheered.has(selected.id)} onClick={() => act("cheer")}><Heart size={17} fill={cheered.has(selected.id) ? "currentColor" : "none"} />{cheered.has(selected.id) ? "Kindness sent" : "Send kindness"}</button>
            <button className="report-button" disabled={acting} onClick={() => act("report")}>Report this letter</button>
          </div>
          {actionError && <p className="error" role="alert">{actionError}</p>}
        </div>}
      </dialog>
    </section>
  );
}
