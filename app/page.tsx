"use client";
import { useEffect, useRef, useState } from "react";
import SendingSequence from "./sending-sequence";
import HomeMail from "./home-mail";
import WishGallery from "./wish-gallery";
import { ArrowLeft, ArrowRight, Check, Pause, Play, Send, X } from "lucide-react";

type Kind = "task" | "wish";
type Screen = "home" | "write" | "flight" | "timer" | "find" | "archive";
type Status = "running" | "paused" | "awaiting" | "completed" | "unfinished" | "sent";
type Letter = { id: string; kind: Kind; body: string; date: number; status: Status; end?: number; left?: number; duration?: number; visibility?: "private" | "public"; serverId?: string; token?: string; publicStatus?: string };
const key = "dear-birdie-v1";
const Bird = ({ className = "" }: { className?: string }) => <svg className={className} viewBox="0 0 120 55" fill="none" aria-hidden="true"><path d="M3 31C21 32 35 28 51 19C43 24 37 29 36 34C55 34 67 31 83 17C79 25 77 31 76 35C91 36 103 33 117 29C100 42 83 44 67 40C57 46 45 49 32 47C42 42 49 38 52 34C34 40 17 40 3 31Z" fill="currentColor"/></svg>;
const time = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2,"0")}:${String(s % 60).padStart(2,"0")}`; };

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home"), [kind, setKind] = useState<Kind>("task"), [body, setBody] = useState(""), [minutes, setMinutes] = useState(25);
  const [visibility, setVisibility] = useState<"private" | "public">("private"), [letters, setLetters] = useState<Letter[]>([]), [activeId, setActiveId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now()), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [galleryVisit, setGalleryVisit] = useState(0), [arrival, setArrival] = useState("");
  const sending = useRef(false);
  const widget = useRef<string | null>(null);
  const [siteKey, setSiteKey] = useState<string | null>(null), [publicReady, setPublicReady] = useState(false), [turnstileToken, setTurnstileToken] = useState("");
  useEffect(() => { fetch("/api/config").then(r => r.json()).then((value: unknown) => { const data = value as { siteKey?: string; publicReady?: boolean }; setSiteKey(data.siteKey ?? null); setPublicReady(Boolean(data.publicReady)); }).catch(() => {}); }, []);
  useEffect(() => {
    if (screen !== "write" || kind !== "wish" || visibility !== "public" || !siteKey) return;
    const scope = window as typeof window & { turnstile?: {
      render: (target: string, options: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void }) => string;
      remove: (id: string) => void;
    } };
    let disposed = false;
    setTurnstileToken("");
    const render = () => {
      if (!disposed && widget.current === null && document.querySelector("#turnstile-widget")) {
        widget.current = scope.turnstile?.render("#turnstile-widget", {
          sitekey: siteKey,
          callback: setTurnstileToken,
          "expired-callback": () => setTurnstileToken(""),
          "error-callback": () => setTurnstileToken(""),
        }) ?? null;
      }
    };
    let script = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
    if (scope.turnstile) render();
    else {
      if (!script) {
        script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.dataset.turnstile = "true";
        document.head.appendChild(script);
      }
      script.addEventListener("load", render);
    }
    return () => {
      disposed = true;
      script?.removeEventListener("load", render);
      if (widget.current !== null) scope.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [screen, kind, visibility, siteKey]);
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem(key) ?? "[]") as Letter[]; if (Array.isArray(saved)) { const recovered = saved.map(l => l.status === "running" && (l.end ?? 0) <= Date.now() ? {...l,status:"awaiting" as Status,left:0} : l); setLetters(recovered); setActiveId(recovered.find(l => ["running","paused","awaiting"].includes(l.status))?.id ?? null); } } catch {} setHydrated(true); }, []);
  useEffect(() => { if (hydrated) localStorage.setItem(key, JSON.stringify(letters)); }, [letters, hydrated]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(id); }, []);
  useEffect(() => { if (letters.some(l => l.status === "running" && (l.end ?? Infinity) <= now)) setLetters(prev => prev.map(l => l.status === "running" && (l.end ?? Infinity) <= now ? {...l,status:"awaiting",left:0} : l)); }, [now, letters]);
  const active = letters.find(l => l.id === activeId), left = active?.status === "running" ? Math.max(0,(active.end ?? now)-now) : active?.left ?? 0;
  const update = (id: string, change: Partial<Letter>) => setLetters(prev => prev.map(l => l.id === id ? {...l,...change} : l));
  const write = (k: Kind) => { setKind(k); setBody(""); setVisibility("private"); setTurnstileToken(""); setError(""); setScreen("write"); };
  const send = async () => {
    if (sending.current) return;
    const content = body.trim(); if (content.length < (kind === "wish" ? 10 : 2)) { setError(kind === "wish" ? "Write at least 10 characters." : "Write a little more about your task."); return; }
    if (kind === "task" && letters.some(l => ["running","paused","awaiting"].includes(l.status))) { setError("Finish your current focus letter first."); return; }
    if (kind === "wish" && visibility === "public" && publicReady && !turnstileToken) { setError("Complete the verification before sending."); return; }
    sending.current = true; setBusy(true); setError(""); const date = Date.now(); const letter: Letter = {id:crypto.randomUUID(),kind,body:content,date,status:kind === "task" ? "running" : "sent"};
    if (kind === "task") { letter.duration = minutes*60000; letter.left = letter.duration; letter.end = date+letter.duration; }
    else { letter.visibility = visibility; if (visibility === "public") { letter.token = crypto.randomUUID()+crypto.randomUUID(); try { const r = await fetch("/api/wishes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({body:content,token:letter.token,turnstile:turnstileToken})}); const data = await r.json() as {id?:string;status?:string;error?:string}; if (!r.ok) throw Error(data.error ?? "Your letter could not be sent. Please try again."); letter.serverId=data.id; letter.publicStatus=data.status; } catch(e) { setError(e instanceof Error ? e.message : "Your letter could not be sent. Please try again."); setBusy(false); sending.current = false; return; } } }
    setLetters(prev => [letter,...prev]); if (kind === "task") setActiveId(letter.id); setScreen("flight");
  };
  const finish = (status: "completed" | "unfinished") => { if (!active) return; update(active.id,{status,left,end:undefined}); setActiveId(null); setScreen("archive"); };
  const find = () => { setArrival(""); setGalleryVisit(value => value + 1); setScreen("find"); };
  const remove = async (l:Letter) => {if(l.serverId&&l.token) { try { const r=await fetch("/api/wishes/action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:l.serverId,token:l.token,action:"delete"})}); if(!r.ok) throw Error(); } catch { setError("Your shared letter could not be withdrawn. Please try again."); return; } } setLetters(prev=>prev.filter(item=>item.id!==l.id));};
  return <main className={`site-shell screen-${screen}`}><div className="sky"/><div className="sky-wash"/><div className="grain"/>
    {screen !== "home" && screen !== "flight" && (
      <header className="topbar">
        <button className="brand wordmark" onClick={() => setScreen("home")}>Dear Birdie</button>
        <nav aria-label="Letters">
          <button onClick={find}>Find a letter</button>
          <button onClick={() => setScreen("archive")}>My letters</button>
        </nav>
      </header>
    )}
    {screen === "home" && (
      <HomeMail
        onFocus={() => write("task")}
        onWish={() => write("wish")}
        onFind={find}
        onArchive={() => setScreen("archive")}
      />
    )}
    {screen==="write"&&<section className="content-stage write-stage"><div className="section-intro"><button className="back-link" onClick={()=>setScreen("home")}><ArrowLeft size={16}/> Back</button><h2>{kind === "task" ? "Focus" : "Make a wish"}</h2></div><div className="letter-wrap"><div className="paper"><div className="paper-top"><span>DEAR BIRDIE</span><span>NO. {String(letters.length+1).padStart(4,"0")}</span></div><label htmlFor="letter-body">{kind==="task"?"Dear tomorrow,":"Dear somewhere,"}</label><textarea id="letter-body" value={body} onChange={e=>{setBody(e.target.value);setError("");}} maxLength={kind==="wish"?500:300} placeholder={kind==="task"?"The one thing I want to do today…":"Someday, I hope…"}/><div className="paper-signoff">With hope,<br/><em>me</em></div><div className="paper-line"/></div><div className="letter-options">{kind==="task"?<><span className="option-label">Duration</span><div className="option-pills">{[15,25,45,60].map(n=><button key={n} className={minutes===n?"selected":""} onClick={()=>setMinutes(n)}>{n} min</button>)}</div></>:<><span className="option-label">Visibility</span><div className="visibility-options"><button className={visibility==="private"?"selected":""} onClick={()=>setVisibility("private")}><strong>Keep it private</strong><small>Saved in this browser</small></button><button className={visibility==="public"?"selected":""} onClick={()=>setVisibility("public")}><strong>Share anonymously</strong><small>Shared after review</small></button></div>{visibility==="public"&&<p className="option-hint">Visible as soon as approved.</p>}{visibility==="public"&&siteKey&&<div id="turnstile-widget" className="turnstile-widget"/>}</>}<div className="send-row"><span>{kind==="wish"?`${body.length} / 500`:"Saved on this device."}</span><button className="ink-button" disabled={busy} onClick={send}>{busy?"Sending…":"Send"}<Send size={16}/></button></div>{error&&<p className="error" role="alert">{error}</p>}</div></div></section>}
    {screen === "flight" && <SendingSequence onComplete={() => {
      setBusy(false);
      sending.current = false;
      if (kind === "task") setScreen("timer");
      else {
        setArrival(visibility === "private" ? "Sent. Saved privately on this device." : letters[0]?.publicStatus === "approved" ? "Sent. Your wish is now shared." : "Sent. Your wish is awaiting review.");
        setGalleryVisit(value => value + 1);
        setScreen("find");
      }
    }} />}
    {screen==="timer"&&active&&<section className="timer-stage"><div className="time-display">{time(left)}</div><div className="timer-letter">“{active.body}”</div>{active.status==="awaiting"?<div className="timer-complete"><p>Finished?</p><div><button className="primary-button" onClick={()=>finish("completed")}><Check size={18}/> All done</button><button className="outline-button" onClick={()=>finish("unfinished")}>Another time</button></div></div>:<div className="timer-controls"><button onClick={()=>active.status==="paused"?update(active.id,{status:"running",end:Date.now()+left}):update(active.id,{status:"paused",left,end:undefined})}>{active.status==="paused"?<Play size={17}/>:<Pause size={17}/>} {active.status==="paused"?"Resume":"Pause"}</button><button onClick={()=>finish("unfinished")}><X size={17}/> End focus</button></div>}</section>}
    {screen === "find" && <WishGallery key={galleryVisit} arrival={arrival} onBack={() => setScreen("home")} onWrite={() => write("wish")} />}
    {screen==="archive"&&<section className="archive-stage"><div className="archive-heading"><button className="back-link" onClick={()=>setScreen("home")}><ArrowLeft size={16}/> Back</button><h2>My <em>letters</em><b>.</b></h2></div><div className="archive-list">{letters.length===0?<div className="archive-empty"><p>No letters yet.</p><button onClick={()=>write("task")}>Write a letter <ArrowRight size={16}/></button></div>:letters.map(l=><article className="archive-card" key={l.id}><div className="archive-card-top"><span>{l.kind==="task"?"FOCUS LETTER":"WISH LETTER"}</span><span>{new Date(l.date).toLocaleDateString("en-GB")}</span></div><p>{l.body}</p><div className="archive-card-bottom"><span>{l.kind==="task"?({running:"In flight",paused:"Paused",awaiting:"Ready to record",completed:"DELIVERED",unfinished:"Another time",sent:"Sent"}[l.status]):l.visibility==="public"?(l.publicStatus==="approved"?"Shared":"Awaiting review"):"A private letter"}</span>{["running","paused","awaiting"].includes(l.status)&&<button onClick={()=>{setActiveId(l.id);setScreen("timer");}}>Return to focus <ArrowRight size={14}/></button>}{l.kind==="wish"&&<button onClick={()=>remove(l)}>Delete letter</button>}</div></article>)}</div><p className="storage-note">Saved in this browser. Clearing browser data removes your archive.</p></section>}

  </main>;
}
