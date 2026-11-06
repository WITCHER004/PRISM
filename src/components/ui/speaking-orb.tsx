// @ts-nocheck
"use client";
// Speaking Orb — ported to React from the vanilla Web Component at
// https://raw.githubusercontent.com/aqualang89/shipnotes-components/main/components/speaking-orb/speaking-orb.js
// Original: Ship Notes (aqualang89/shipnotes-components), MIT. "Based on Signal Orb."
// All math/shader/caption/particle logic below is transcribed 1:1 from the original;
// only the custom-element plumbing (shadow DOM, attributes, dispatchEvent) is translated
// to React idioms (props, refs, useEffect lifecycle, useImperativeHandle, onEnd callback).

import * as React from "react";

export type OrbState =
  "listening" | "thinking" | "searching" | "speaking" | "done";

export interface OrbWord {
  w: string;
  start: number;
  end: number;
}

export interface SayOptions {
  words?: OrbWord[];
  audio?: HTMLMediaElement | AudioNode;
  voice?: SpeechSynthesisVoice;
}

export interface RenderAtOptions {
  weights?: number[];
  env?: number;
  onsets?: number[];
  words?: OrbWord[];
  lineTime?: number;
  who?: string;
}

export interface SpeakingOrbHandle {
  /** Speaks with the browser voice (or follows your own `audio`/`words`). See README for the three modes. */
  say: (text: string, options?: SayOptions) => void;
  /** Asks for the mic and drives the "listening" shape from your voice. Returns a function that stops the mic. */
  listen: (stream?: MediaStream) => Promise<() => void>;
  /** Draws an exact frame for video capture; use together with the `recording` prop. */
  renderAt: (t: number, options?: RenderAtOptions) => void;
}

export interface SpeakingOrbProps {
  /** Visual state of the orb. Defaults to "listening". */
  state?: OrbState;
  /** State to return to once a spoken line finishes. Defaults to "listening". */
  rest?: OrbState;
  /** 0..1 input level, used while "listening" without a live mic. Defaults to 0.5. */
  level?: number;
  /** Particle count override (200-20000). Auto-picked (12000 desktop / 6000 touch) and auto-reduced on slow frames when omitted. */
  particles?: number;
  /** Freezes the live animation loop so renderAt() can draw exact frames (for video export). */
  recording?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** Fires once a spoken line's captions/voice finish and the orb returns to its rest state. */
  onEnd?: () => void;
}

// ---------------------------------------------------------------------------
// module-level helpers, verbatim from the original speaking-orb.js
// ---------------------------------------------------------------------------

const names: OrbState[] = [
  "listening",
  "thinking",
  "searching",
  "speaking",
  "done",
];
const colors = [
  [255, 185, 105],
  [178, 151, 255],
  [97, 219, 249],
  [255, 150, 214],
  [136, 239, 194],
];
const SPK = 3;
const tau = Math.PI * 2;
const cache = new Map<number, any[]>();
const seedsFor = (count: number) => {
  // a dense Fibonacci sphere shows moire stripes, so past 1000 points each one gets a small fixed nudge
  const jitter =
    count > 1000 ? ((1 - 1000 / count) * 1.6) / Math.sqrt(count) : 0;
  const rnd = (n: number) => {
    const x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  if (!cache.has(count))
    cache.set(
      count,
      Array.from({ length: count }, (_, i) => {
        const y0 = 1 - (2 * (i + 0.5)) / count,
          a = i * 2.399963229728653 + (rnd(i) - 0.5) * jitter * 6;
        const y = Math.max(
          -1,
          Math.min(1, y0 + (rnd(i + 0.37) - 0.5) * jitter),
        );
        return {
          x: Math.cos(a) * Math.sqrt(1 - y * y),
          y,
          z: Math.sin(a) * Math.sqrt(1 - y * y),
          a,
          u: i / count,
          sa: Math.sin(a),
          ca: Math.cos(a),
        };
      }),
    );
  return cache.get(count)!;
};
const bandTilt = [
  [0.32, 0],
  [-0.72, 1.02],
  [1.08, -0.82],
].map(([tilt, rot]) => [
  Math.cos(tilt + 1),
  Math.sin(tilt + 1),
  Math.cos(rot),
  Math.sin(rot),
]);
const autoCount = () =>
  matchMedia("(pointer: coarse)").matches ? 6000 : 12000;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (p: number) => p * p * (3 - 2 * p);

// rough syllables, only to fake a voice envelope when the browser gives us no audio
const syl = (w: string) =>
  Math.max(
    1,
    (
      w
        .toLowerCase()
        .replace(/[^a-z]/g, "")
        .replace(/e$/, "")
        .match(/[aeiouy]+/g) || []
    ).length,
  );
const pulseEnv = (words: OrbWord[], t: number) => {
  let e = 0;
  for (const w of words) {
    if (t < w.start - 0.05 || t > w.end + 0.15) continue;
    const n = syl(w.w),
      len = Math.max(0.08, w.end - w.start),
      k = clamp((t - w.start) / len) * n;
    const within = k - Math.floor(k);
    e = Math.max(
      e,
      (0.55 + 0.45 * Math.sin(Math.PI * clamp(within * 1.15))) *
        clamp((t - w.start + 0.05) / 0.05) *
        clamp((w.end + 0.15 - t) / 0.15),
    );
  }
  return e;
};
// the default system voice is often the robotic one; prefer the neural/natural voices most browsers ship
const bestVoice = () => {
  const vs = (speechSynthesis.getVoices() || []).filter((v) =>
    /^en/i.test(v.lang),
  );
  const score = (v: SpeechSynthesisVoice) =>
    (/natural|neural|online/i.test(v.name) ? 4 : 0) +
    (/google/i.test(v.name) ? 3 : 0) +
    (/ava|aria|jenny|samantha|emma|sonia|libby|daniel|serena/i.test(v.name)
      ? 2
      : 0) +
    (/en-US|en-GB/i.test(v.lang) ? 1 : 0) -
    (v.localService === false ? 0 : 0.5);
  return vs.sort((a, b) => score(b) - score(a))[0] || null;
};
if (typeof window !== "undefined" && "speechSynthesis" in window)
  speechSynthesis.getVoices();
// captions: phrases split at sentence ends and every ~7 words, like real subtitles
const groupsOf = (words: OrbWord[]) => {
  const out: number[][] = [];
  let cur: number[] = [];
  words.forEach((w, i) => {
    cur.push(i);
    if (
      /[.!?]$/.test(w.w) ||
      (cur.length >= 4 && /[,;:]$/.test(w.w)) ||
      cur.length >= 8
    ) {
      out.push(cur);
      cur = [];
    }
  });
  if (cur.length) out.push(cur);
  return out;
};

const VS = `attribute vec2 p;attribute vec3 d;uniform vec2 res;varying float a;varying float s;
    void main(){float size=max(d.x,2.0);float k=min(1.0,d.x*d.x/(size*size));a=d.y*k;s=d.z*k;
    gl_Position=vec4(p/res*2.0-1.0,0.0,1.0)*vec4(1,-1,1,1);gl_PointSize=size;}`;
const FS = `precision mediump float;uniform vec3 col;varying float a;varying float s;
    void main(){float r=length(gl_PointCoord-.5)*2.0;if(r>1.0)discard;
    float dot=mix(1.0,.065,smoothstep(.17,.23,r))*(1.0-smoothstep(.9,1.0,r));
    float sp=mix(1.0,.065,smoothstep(.08,.12,r))*(1.0-smoothstep(.17,.2,r));
    gl_FragColor=vec4(col*dot*a+vec3(sp*s),min(1.0,dot*a+sp*s));}`;
const setupGL = (canvas: HTMLCanvasElement) => {
  const gl = canvas.getContext("webgl", {
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
    antialias: false,
  }) as WebGLRenderingContext | null;
  if (!gl) return null;
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  const lp = gl.getAttribLocation(prog, "p"),
    ld = gl.getAttribLocation(prog, "d");
  gl.enableVertexAttribArray(lp);
  gl.enableVertexAttribArray(ld);
  gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 20, 0);
  gl.vertexAttribPointer(ld, 3, gl.FLOAT, false, 20, 8);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  return {
    gl,
    res: gl.getUniformLocation(prog, "res"),
    col: gl.getUniformLocation(prog, "col"),
  };
};
const sprite = (rgb: string, core: number) => {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!,
    grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, `rgba(${rgb},1)`);
  grad.addColorStop(core, `rgba(${rgb},1)`);
  grad.addColorStop(core + 0.03, `rgba(${rgb},.065)`);
  grad.addColorStop(0.94, `rgba(${rgb},.065)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
};

const CSS = `.speaking-orb-root{display:block;width:100%;position:relative;contain:layout paint;--cap:#fff;--cap-dim:rgba(255,255,255,.52)}
    .speaking-orb-root .orb{position:relative;width:100%;aspect-ratio:1}
    .speaking-orb-root canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
    .speaking-orb-root .cap{position:relative;margin:-4% auto 0;width:var(--cap-w,92%);min-height:2.7em;text-align:center;font:600 var(--cap-size,24px)/1.3 var(--cap-font,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif);letter-spacing:-.01em;color:var(--cap);text-wrap:balance}
    .speaking-orb-root .cap.user{--cap:#ffd6a8;font-weight:500}
    .speaking-orb-root .cap span{display:inline-block;white-space:pre;will-change:opacity,transform}
    .speaking-orb-root canvas.fx{pointer-events:none}`;

// ---------------------------------------------------------------------------
// engine: the original class's behaviour, operating on a provided root div
// instead of a custom element's shadow DOM. Translated 1:1 method by method.
// ---------------------------------------------------------------------------
class SpeakingOrbEngine {
  root: HTMLDivElement;
  onEndCb?: () => void;
  _state: OrbState = "listening";
  _rest: OrbState | null = null;
  _level = 0.5;
  _particlesOverride: number | null = null;
  _recording = false;
  auto?: number;
  weights: number[];
  time = 0;
  last = 0;
  slow = 0;
  env = 0;
  onsets: number[] = [];
  line: any = null;
  frame = 0;
  glyphCache = new Map<string, [number, number][]>();

  canvas!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D;
  dots!: HTMLCanvasElement;
  dctx?: CanvasRenderingContext2D;
  capEl!: HTMLDivElement;
  fx!: HTMLCanvasElement;
  fctx!: CanvasRenderingContext2D;
  gl: ReturnType<typeof setupGL> = null;
  media!: MediaQueryList;
  observer!: ResizeObserver;
  resize!: () => void;
  onMotion!: () => void;
  buf?: Float32Array;
  spriteColor?: string;
  dot?: HTMLCanvasElement;
  spark?: HTMLCanvasElement;
  actx?: AudioContext;
  an?: AnalyserNode;
  fbuf?: Float32Array;
  srcEl?: any;
  micLevel: (() => number) | null = null;
  stopMic?: () => void;

  constructor(root: HTMLDivElement, onEnd?: () => void) {
    this.root = root;
    this.onEndCb = onEnd;
    this.weights = names.map((n) => (n === this._state ? 1 : 0));
  }

  mount() {
    const canvases = this.root.querySelectorAll("canvas");
    this.canvas = canvases[0] as HTMLCanvasElement;
    this.dots = canvases[1] as HTMLCanvasElement;
    this.fx = canvases[2] as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    this.capEl = this.root.querySelector(".cap") as HTMLDivElement;
    this.fctx = this.fx.getContext("2d")!;
    this.gl = setupGL(this.dots);
    if (!this.gl) this.dctx = this.dots.getContext("2d")!;

    this.media = matchMedia("(prefers-reduced-motion: reduce)");
    this.resize = () => {
      const w = this.canvas.parentElement!.getBoundingClientRect().width,
        size = Math.max(1, Math.round(w * Math.min(devicePixelRatio || 1, 2)));
      this.canvas.width =
        this.canvas.height =
        this.dots.width =
        this.dots.height =
          size;
      this.root.style.setProperty(
        "--cap-size",
        Math.round(clamp(w * 0.066, 18, 34)) + "px",
      );
      const hr = this.root.getBoundingClientRect(),
        k = Math.min(devicePixelRatio || 1, 2);
      this.fx.width = Math.round(hr.width * k);
      this.fx.height = Math.round(hr.height * k);
      this.glyphCache = new Map();
      this.draw(this.time);
    };
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(this.root);
    this.resize();
    this.onMotion = () => {
      cancelAnimationFrame(this.frame);
      this.last = 0;
      this.start();
    };
    this.media.addEventListener("change", this.onMotion);
    this.root.setAttribute("role", "img");
    this.root.setAttribute("aria-label", `Assistant ${this._state}`);
    this.start();
  }

  unmount() {
    cancelAnimationFrame(this.frame);
    this.observer?.disconnect();
    this.media?.removeEventListener("change", this.onMotion);
    this.stopMic?.();
  }

  start() {
    if (!this._recording) this.frame = requestAnimationFrame(this.tick);
  }

  get state() {
    return this._state;
  }
  setState(v: OrbState) {
    this._state = names.includes(v) ? v : "listening";
    this.root?.setAttribute("aria-label", `Assistant ${this._state}`);
  }
  get level() {
    return this._level;
  }
  setLevel(n: number | undefined) {
    this._level = Number.isFinite(n as number) ? clamp(n as number) : 0.5;
  }
  get particles() {
    if (this._particlesOverride != null) return this._particlesOverride;
    return (this.auto ??= this.gl ? autoCount() : 1000);
  }
  setParticles(n: number | undefined) {
    this._particlesOverride = Number.isFinite(n as number)
      ? clamp(n as number, 200, 20000)
      : null;
  }
  setRest(v: OrbState | null) {
    this._rest = v;
  }
  setRecording(v: boolean) {
    this._recording = v;
    if (!v) this.start();
    else cancelAnimationFrame(this.frame);
  }

  // say(text) speaks with the browser voice; say(text, {words, audio}) follows your own audio.
  // words: [{w, start, end}] in seconds from the audio start. audio: an <audio>/<video> element.
  say(text: string, { words, audio, voice }: SayOptions = {}) {
    const toks = String(text).trim().split(/\s+/).filter(Boolean);
    const line: any = {
      toks,
      words: [] as OrbWord[],
      t0: this.time,
      live: true,
    };
    if (words?.length)
      line.words = words.map((w, i) => ({
        w: toks[i] ?? w.w,
        start: w.start,
        end: w.end,
      }));
    this.line = line;
    this.setState("speaking");
    if (audio) {
      this.attachAudio(audio);
      line.audio = audio;
      (audio as any).currentTime = 0;
      (audio as any).play?.();
      return;
    }
    if (line.words.length || !("speechSynthesis" in window)) {
      if (!line.words.length) line.words = this.estimate(toks, 0);
      return;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text),
      starts: number[] = [];
    u.voice = voice || bestVoice();
    if (u.voice) u.lang = u.voice.lang;
    let pos = 0;
    toks.forEach((t) => {
      pos = text.indexOf(t, pos);
      starts.push(pos);
      pos += t.length;
    });
    line.words = this.estimate(toks, 0);
    line.synth = true;
    // captions wait for the voice to actually start; some browsers take a second to warm up
    line.t0 = this.time + 1e3;
    const go = () => {
      if (line.t0 > this.time) line.t0 = this.time;
    };
    u.onstart = go;
    setTimeout(go, 1500);
    u.onboundary = (e: any) => {
      if (e.name && e.name !== "word") return;
      const i = starts.findIndex(
        (s, k) => e.charIndex >= s && e.charIndex < s + toks[k].length,
      );
      if (i < 0) return;
      const now = this.time - line.t0,
        shift = now - line.words[i].start;
      // re-sync to the real voice, but a word already on screen never hides again
      for (let k = i; k < line.words.length; k++) {
        const w = line.words[k];
        if (shift > 0 && w.start <= now) {
          if (k === i) w.end = Math.max(w.end, now + 0.1);
          continue;
        }
        w.start += shift;
        w.end += shift;
      }
    };
    u.onend = () => {
      const now = this.time - line.t0;
      line.words.forEach((w: OrbWord) => {
        if (w.end > now) w.end = now;
      });
      line.done = now;
    };
    speechSynthesis.speak(u);
  }
  estimate(toks: string[], t: number) {
    return toks.map((w) => {
      const d = 0.09 + 0.075 * syl(w) + (/[,.!?]$/.test(w) ? 0.18 : 0),
        o = { w, start: t, end: t + d - (/[,.!?]$/.test(w) ? 0.18 : 0) };
      t += d;
      return o;
    });
  }
  attachAudio(el: HTMLMediaElement | AudioNode) {
    if (this.srcEl === el) return;
    this.actx ??= new (
      (window as any).AudioContext || (window as any).webkitAudioContext
    )();
    this.actx.resume?.();
    const an = this.actx.createAnalyser();
    an.fftSize = 1024;
    const src =
      el instanceof AudioNode
        ? el
        : this.actx.createMediaElementSource(el as HTMLMediaElement);
    src.connect(an);
    if (!(el instanceof AudioNode)) an.connect(this.actx.destination);
    this.srcEl = el;
    this.an = an;
    this.fbuf = new Float32Array(an.fftSize);
  }
  async listen(stream?: MediaStream) {
    stream ??= await navigator.mediaDevices.getUserMedia({ audio: true });
    this.actx ??= new (
      (window as any).AudioContext || (window as any).webkitAudioContext
    )();
    const an = this.actx.createAnalyser();
    an.fftSize = 1024;
    const src = this.actx.createMediaStreamSource(stream);
    src.connect(an);
    const buf = new Float32Array(an.fftSize);
    this.micLevel = () => {
      an.getFloatTimeDomainData(buf);
      let s = 0;
      for (const v of buf) s += v * v;
      return clamp(Math.sqrt(s / buf.length) * 9);
    };
    this.stopMic = () => {
      stream!.getTracks().forEach((t) => t.stop());
      this.micLevel = null;
    };
    this.setState("listening");
    return () => this.stopMic?.();
  }

  tick = (now: number) => {
    if (this._recording) return;
    // Prism patch: React detaches the DOM before effect cleanup runs; stop instead of drawing into a detached tree
    if (!this.root.isConnected) return;
    const dt = this.last ? Math.min((now - this.last) / 1000, 0.05) : 0;
    this.last = now;
    this.time += dt;
    if (this._particlesOverride == null && dt) {
      this.slow = dt > 0.025 ? this.slow + 1 : 0;
      if (this.slow > 30 && (this.auto ?? 0) > 800) {
        this.auto = Math.max(800, Math.round((this.auto ?? 1000) * 0.6));
        this.slow = 0;
      }
    }
    const k = 1 - Math.exp(-dt * 7);
    this.weights = this.weights.map(
      (w, i) => w + ((names[i] === this._state ? 1 : 0) - w) * k,
    );
    const L = this.line;
    let raw = 0,
      lt = 0;
    if (L) {
      lt = L.audio ? L.audio.currentTime : this.time - L.t0;
      if (this.an && L.audio && !L.audio.paused) {
        this.an.getFloatTimeDomainData(this.fbuf!);
        let s = 0;
        for (const v of this.fbuf!) s += v * v;
        raw = clamp(Math.sqrt(s / this.fbuf!.length) * 5);
      } else raw = pulseEnv(L.words, lt);
      const end = L.done ?? L.words.at(-1)?.end ?? 0,
        over = L.audio ? L.audio.ended : lt > end + 0.1;
      if (over && this._state === "speaking" && !L.after) {
        L.after = true;
        this.setState((this._rest || "listening") as OrbState);
        this.onEndCb?.();
      }
    }
    const prev = this.env;
    this.env += (raw - this.env) * (raw > this.env ? 0.55 : 0.18);
    // a syllable is a fast rise in the envelope; each one sends a bright ring up the sphere
    if (this.env - prev > 0.06 && this.time - (this.onsets.at(-1) ?? -1) > 0.12)
      this.onsets.push(this.time);
    this.onsets = this.onsets.filter((o) => this.time - o < 1.2);
    if (this.micLevel) this._level = Number(this.micLevel().toFixed(3));
    this.paint(this.media.matches ? 0 : this.time, this.weights, {
      env: this.media.matches ? 0 : this.env,
      onsets: this.media.matches ? [] : this.onsets,
    });
    this.caption(L ? lt : 0, L);
    this.frame = requestAnimationFrame(this.tick);
  };
  draw(t: number) {
    this.paint(
      t,
      this.weights || names.map((n) => (n === this._state ? 1 : 0)),
      {
        env: this.env || 0,
        onsets: this.onsets || [],
      },
    );
  }

  // Video: exact frame from absolute time. o = {weights, env, onsets, words, lineTime}
  renderAt(t: number, o: RenderAtOptions = {}) {
    const w = o.weights || names.map((n) => (n === this._state ? 1 : 0));
    this.paint(t, w, {
      env: o.env || 0,
      onsets: (o.onsets || []).filter((x) => x <= t && t - x < 1.2),
    });
    this.caption(
      o.lineTime ?? t,
      o.words ? { words: o.words, who: o.who } : null,
    );
  }

  caption(t: number, L: any) {
    const el = this.capEl;
    if (!el) return;
    if (!L || !L.words.length) {
      if (el.childElementCount) el.textContent = "";
      el.dataset.g = "";
      return;
    }
    const W = L.words,
      G = (L.groups ??= groupsOf(W));
    let gi = -1;
    G.forEach((g: number[], i: number) => {
      if (t >= W[g[0]].start - 0.04) gi = i;
    });
    const last = W.at(-1).end,
      fade = clamp(1 - (t - last - 1.8) / 0.4);
    if (gi < 0 || fade <= 0) {
      if (el.childElementCount) el.textContent = "";
      el.dataset.g = "";
      return;
    }
    const key = gi + ":" + W.length + ":" + (L.who || "");
    el.classList.toggle("user", L.who === "user");
    if (el.dataset.g !== key) {
      el.dataset.g = key;
      el.textContent = "";
      for (const i of G[gi]) {
        const s = document.createElement("span");
        s.textContent = W[i].w + " ";
        el.append(s);
      }
    }
    const reduce = this.media?.matches;
    [...el.children].forEach((s: any, k: number) => {
      const w = W[G[gi][k]],
        fly = !reduce && L.who !== "user";
      // AI words are built from particles first, the real text shows up as they land
      const a = reduce
        ? t >= w.start
          ? 1
          : 0
        : fly
          ? ease(clamp((t - w.start - 0.3) / 0.14))
          : ease(clamp((t - w.start + 0.04) / 0.14));
      const on = t >= w.start - 0.04 && t < w.end + 0.12;
      s.style.opacity = (a * fade * (on ? 1 : 0.6)).toFixed(3);
      s.style.transform = fly
        ? ""
        : `translateY(${((1 - a) * 0.25).toFixed(3)}em)`;
      s.style.color = on ? "var(--cap)" : "";
    });
    this.flight(
      t,
      L.who === "user" || reduce
        ? []
        : G[gi].map((i: number, k: number) => [W[i], el.children[k]]),
    );
  }

  // glyph points of one word, sampled from the caption font, relative to its span box
  glyphs(word: string, span: HTMLElement) {
    const cs = getComputedStyle(this.capEl),
      font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`,
      r = span.getBoundingClientRect();
    const key = word + "|" + font;
    if (this.glyphCache.has(key)) return this.glyphCache.get(key)!;
    // Prism patch: a detached or hidden span measures 0×0 and getImageData would throw; skip it uncached
    if (!r.width || !r.height) return [];
    const w = Math.ceil(r.width) + 4,
      h = Math.ceil(r.height),
      c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d")!;
    g.font = font;
    g.fillStyle = "#fff";
    // same baseline as the DOM span: half-leading + font ascent
    const m = g.measureText(word),
      A = (m as any).fontBoundingBoxAscent,
      D = (m as any).fontBoundingBoxDescent;
    g.fillText(word, 0, (h - (A + D)) / 2 + A);
    const d = g.getImageData(0, 0, w, h).data,
      pts: [number, number][] = [],
      fs = parseFloat(cs.fontSize),
      step = Math.max(1, fs / 22);
    for (let y = 0; y < h; y += step)
      for (let x = 0; x < w; x += step) {
        const i = ((y | 0) * w + (x | 0)) * 4 + 3;
        if (d[i] > 140) pts.push([x, y]);
      }
    this.glyphCache.set(key, pts);
    return pts;
  }
  flight(t: number, items: [OrbWord, HTMLElement][]) {
    const g = this.fctx,
      W = this.fx.width,
      H = this.fx.height;
    if (!W) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    if (!items.length) return;
    const hr = this.root.getBoundingClientRect(),
      k = W / hr.width,
      orb = this.canvas.getBoundingClientRect();
    const cx = orb.left - hr.left + orb.width / 2,
      cy = orb.top - hr.top + orb.height / 2,
      R = orb.width * 0.25;
    const rnd = (n: number) => {
      const x = Math.sin(n * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };
    g.setTransform(k, 0, 0, k, 0, 0);
    g.globalCompositeOperation = "lighter";
    const [cr, cg, cb] = colors[SPK],
      dot = Math.max(1, parseFloat(getComputedStyle(this.capEl).fontSize) / 24);
    items.forEach(([w, span], wi) => {
      const age = t - w.start + 0.06;
      if (age < 0 || age > 0.72 || !span) return;
      const pts = this.glyphs(w.w, span),
        sr = span.getBoundingClientRect(),
        ox = sr.left - hr.left,
        oy = sr.top - hr.top,
        seed = w.start * 977 + wi;
      for (let j = 0; j < pts.length; j++) {
        const r1 = rnd(seed + j * 1.7),
          r2 = rnd(seed + j * 3.1 + 0.3),
          r3 = rnd(seed + j * 5.3 + 0.7),
          del = r1 * 0.12,
          p = clamp((age - del) / 0.36);
        if (p <= 0) continue;
        const land = clamp((age - del - 0.34) / 0.1),
          al = (1 - land) * Math.min(1, p * 5);
        if (al <= 0) continue;
        const e = 1 - Math.pow(1 - p, 3),
          a0 = Math.PI / 2 + (r2 - 0.5) * 1.5;
        const sx = cx + Math.cos(a0) * R * (0.85 + 0.15 * r3),
          sy = cy + Math.sin(a0) * R * (0.92 + 0.08 * r3);
        const tx = ox + pts[j][0],
          ty = oy + pts[j][1],
          mx = (sx + tx) / 2 + (r3 - 0.5) * R * 0.9,
          my = (sy + ty) / 2 + (r2 - 0.5) * R * 0.25;
        const x = (1 - e) * (1 - e) * sx + 2 * (1 - e) * e * mx + e * e * tx,
          y = (1 - e) * (1 - e) * sy + 2 * (1 - e) * e * my + e * e * ty;
        const wm = e * e;
        g.fillStyle = `rgba(${(cr + (255 - cr) * wm) | 0},${(cg + (255 - cg) * wm) | 0},${(cb + (255 - cb) * wm) | 0},${al.toFixed(3)})`;
        const s = dot * (1.4 - 0.5 * e);
        g.fillRect(x - s / 2, y - s / 2, s, s);
      }
    });
    g.globalCompositeOperation = "source-over";
  }

  paint(
    t: number,
    w: number[],
    { env, onsets }: { env: number; onsets: number[] },
  ) {
    const ctx = this.ctx,
      size = this.canvas.width;
    if (!size) return;
    const unit = size / 720;
    ctx.setTransform(unit, 0, 0, unit, 0, 0);
    ctx.clearRect(0, 0, 720, 720);
    const rgb = [0, 1, 2].map((c) =>
        Math.round(colors.reduce((s, col, i) => s + col[c] * w[i], 0)),
      ),
      color = rgb.join(",");
    const ws = w[SPK],
      glow = 0.075 + 0.05 * env * ws;
    const halo = ctx.createRadialGradient(
      360,
      360,
      10,
      360,
      360,
      305 + 25 * env * ws,
    );
    halo.addColorStop(0, `rgba(${color},${glow})`);
    halo.addColorStop(0.57, `rgba(${color},${glow * 0.47})`);
    halo.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, 720, 720);
    const count = this.particles,
      seeds = seedsFor(count),
      ring = Math.round(count * 0.65);
    const fine = Math.max(0.5, Math.pow(1000 / count, 0.55)),
      light = Math.min(1, Math.pow(1000 / (count * fine * fine), 0.35));
    if (!this.buf || this.buf.length < count * 5)
      this.buf = new Float32Array(count * 5);
    const buf = this.buf,
      [w0, w1, w2, w3, w4] = w,
      spin = t * 0.23,
      cs = Math.cos(spin),
      sn = Math.sin(spin),
      wave = 8 + this.level * 22;
    const rings = onsets.map((o) => {
      const a = t - o;
      return { h: -1.15 + a * 2.1, g: Math.pow(1 - a / 1.2, 2) };
    });
    for (let i = 0; i < count; i++) {
      const p = seeds[i];
      let vx = 0,
        vy = 0,
        vz = 0,
        lit = 0;
      if (w0 > 0.001) {
        const x = p.x * cs + p.z * sn,
          z = p.z * cs - p.x * sn;
        const r =
          (192 +
            Math.sin(p.y * 11 - t * 3 + p.a * 0.03) * wave +
            Math.sin(p.a * 0.17 + t * 2) * 5) *
          w0;
        vx += x * r;
        vy += p.y * r;
        vz += z * r;
      }
      if (w1 > 0.001) {
        const theta = p.u * tau * 3 + t * 0.57,
          phi = p.u * tau * 8 - t * 0.48,
          rt = 137 + 41 * Math.cos(phi) + 24 * p.sa;
        const bx = rt * Math.cos(theta),
          bz = rt * Math.sin(theta),
          by = 65 * Math.sin(phi) + 17 * p.y;
        vx += bx * w1;
        vy += (by * 0.77 - bz * 0.52) * w1;
        vz += (by * 0.52 + bz * 0.77) * w1;
      }
      if (w2 > 0.001) {
        const band = i % 3,
          angle = p.u * tau * 5 + t * (0.7 + band * 0.2),
          radius = 196 + 11 * p.sa;
        const sx = Math.cos(angle) * radius,
          sy = Math.sin(angle) * radius;
        const sy2 = sy * bandTilt[band][0],
          sz = sy * bandTilt[band][1],
          cr2 = bandTilt[band][2],
          sr2 = bandTilt[band][3];
        vx += (sx * cr2 - sy2 * sr2) * w2;
        vy += (sx * sr2 + sy2 * cr2) * w2;
        vz += sz * w2;
      }
      if (w3 > 0.001) {
        // Speaking: the voice inflates a soft lobed sphere, every syllable sends a lit ring from chin to crown
        const x = p.x * cs + p.z * sn,
          z = p.z * cs - p.x * sn;
        const lobe =
          Math.sin(x * 2.3 + t * 1.4) *
          Math.sin(p.y * 2.9 - t * 1.1) *
          Math.cos(z * 2.1 + t * 0.8);
        let r =
          184 +
          16 * env +
          lobe * (5 + 19 * env) +
          Math.sin(p.y * 7 - t * 2.2) * 3 * env;
        for (const R of rings) {
          const d = (p.y - R.h) / 0.15,
            g = Math.exp(-d * d) * R.g;
          r += 7 * g;
          lit += g;
        }
        vx += x * r * w3;
        vy += p.y * r * w3;
        vz += z * r * w3;
        lit *= w3;
      }
      if (w4 > 0.001) {
        if (i < ring) {
          const q = (i / ring) * tau,
            rr = 173 + 9 * p.sa;
          vx += Math.cos(q) * rr * w4;
          vy += Math.sin(q) * rr * w4;
          vz += 8 * p.sa * w4;
        } else {
          const q = (i - ring) / (count - ring),
            first = q < 0.38,
            v = first ? q / 0.38 : (q - 0.38) / 0.62;
          vx += ((first ? -81 + 58 * v : -23 + 116 * v) + 6 * p.sa) * w4;
          vy += ((first ? 57 * v : 57 - 133 * v) + 6 * p.ca) * w4;
        }
      }
      const depth = (vz + 240) / 480,
        persp = 850 / (850 - vz),
        alpha = 0.22 + 0.72 * depth + 0.35 * env * ws;
      const r =
          (0.8 + depth * 1.35) *
          (0.75 + 0.25 * Math.sin(p.a + t * 1.6)) *
          fine *
          (1 + 0.5 * Math.min(1, lit)),
        o = i * 5;
      buf[o] = (360 + vx * persp) * unit;
      buf[o + 1] = (360 + vy * persp) * unit;
      buf[o + 2] = r * 9 * unit;
      buf[o + 3] = Math.min(1, (alpha + 1.2 * lit) * light);
      buf[o + 4] =
        vz > 75 || lit > 0.25
          ? (Math.max(alpha - 0.5, 0) + lit * 0.8) * 0.75 * light
          : 0;
    }
    if (this.gl) this.drawGL(buf, count, rgb, size);
    else this.draw2D(buf, count, color, size);
  }
  drawGL(buf: Float32Array, count: number, rgb: number[], size: number) {
    const { gl, res, col } = this.gl!;
    gl.viewport(0, 0, size, size);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(res, size, size);
    gl.uniform3f(col, rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
    gl.bufferData(gl.ARRAY_BUFFER, buf.subarray(0, count * 5), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.POINTS, 0, count);
  }
  draw2D(buf: Float32Array, count: number, color: string, size: number) {
    const ctx = this.dctx!;
    if (this.spriteColor !== color) {
      this.spriteColor = color;
      this.dot = sprite(color, 0.2);
      this.spark = sprite("255,255,255", 0.5);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < count; i++) {
      const o = i * 5,
        x = buf[o],
        y = buf[o + 1],
        s = buf[o + 2];
      ctx.globalAlpha = buf[o + 3];
      ctx.drawImage(this.dot!, x - s / 2, y - s / 2, s, s);
      if (buf[o + 4] > 0) {
        const h = s * 0.2;
        ctx.globalAlpha = buf[o + 4];
        ctx.drawImage(this.spark!, x - h / 2, y - h / 2, h, h);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
}

// ---------------------------------------------------------------------------
// React wrapper
// ---------------------------------------------------------------------------
const SpeakingOrb = React.forwardRef<SpeakingOrbHandle, SpeakingOrbProps>(
  function SpeakingOrb(
    {
      state = "listening",
      rest,
      level,
      particles,
      recording = false,
      className,
      style,
      onEnd,
    },
    ref,
  ) {
    const rootRef = React.useRef<HTMLDivElement>(null);
    const engineRef = React.useRef<SpeakingOrbEngine | null>(null);
    const onEndRef = React.useRef(onEnd);
    onEndRef.current = onEnd;

    React.useEffect(() => {
      if (!rootRef.current) return;
      const engine = new SpeakingOrbEngine(rootRef.current, () =>
        onEndRef.current?.(),
      );
      engineRef.current = engine;
      engine.setState(state);
      engine.setRest(rest ?? null);
      engine.setLevel(level);
      engine.setParticles(particles);
      engine.setRecording(recording);
      engine.mount();
      return () => {
        engine.unmount();
        engineRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    React.useEffect(() => {
      engineRef.current?.setState(state);
    }, [state]);
    React.useEffect(() => {
      engineRef.current?.setRest(rest ?? null);
    }, [rest]);
    React.useEffect(() => {
      engineRef.current?.setLevel(level);
    }, [level]);
    React.useEffect(() => {
      engineRef.current?.setParticles(particles);
    }, [particles]);
    React.useEffect(() => {
      engineRef.current?.setRecording(recording);
    }, [recording]);

    React.useImperativeHandle(
      ref,
      () => ({
        say: (text, opts) => engineRef.current?.say(text, opts),
        listen: (stream) => engineRef.current!.listen(stream),
        renderAt: (t, opts) => engineRef.current?.renderAt(t, opts),
      }),
      [],
    );

    return (
      <div
        ref={rootRef}
        className={["speaking-orb-root", className].filter(Boolean).join(" ")}
        style={style}
      >
        <style>{CSS}</style>
        <div className="orb">
          <canvas aria-hidden="true" />
          <canvas aria-hidden="true" />
        </div>
        <div className="cap" aria-live="polite" />
        <canvas className="fx" aria-hidden="true" />
      </div>
    );
  },
);

export default SpeakingOrb;
