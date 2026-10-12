"use strict";
/* app.js - DOM + engine wiring. chess.js (above) holds the rules. */
const GLYPH = { k: "\u265A", q: "\u265B", r: "\u265C", b: "\u265D", n: "\u265E", p: "\u265F" };
const $ = id => document.getElementById(id);
const boardEl = $("board"), movesEl = $("moves"),
      statusEl = $("status"), fenEl = $("fen"), sideEl = $("side"), depthEl = $("depth"),
      goBtn = $("go"), stopBtn = $("stop");

let B = parsePlacement(START_PLACEMENT);
let side = "w", flipped = false, sel = null, legalCache = [];
let castling = "KQkq", ep = "-";
let hist = [];
const pushHist = () => { hist.push({ B: B.slice(), side, castling }); if (hist.length > 50) hist.shift(); };
const dirty = () => { results = []; movesEl.innerHTML = ""; markBest(); };
let engine = null, engineReady = false, thinking = false, results = [];

const fen = () => fenOf(B, side, castling, ep);
const setStatus = t => { statusEl.innerHTML = t; };

function render() {
  boardEl.innerHTML = "";
  for (let R = 0; R < 8; R++) for (let F = 0; F < 8; F++) {
    const f = flipped ? 7 - F : F, r = flipped ? R : 7 - R, i = idx(f, r);
    const d = document.createElement("div");
    d.className = "sq " + (((f + r) % 2) ? "l" : "d");
    d.dataset.i = i;
    d.setAttribute("role", "gridcell");
    const c = B[i];
    if (c) {
      d.classList.add(colOf(c));
      const s = document.createElement("span");
      s.className = "pc"; s.textContent = GLYPH[c.toLowerCase()];
      d.appendChild(s);
    }
    if (F === 0) { const cr = document.createElement("span"); cr.className = "coord rank"; cr.textContent = r + 1; d.appendChild(cr); }
    if (R === 7) { const cf = document.createElement("span"); cf.className = "coord file"; cf.textContent = "abcdefgh"[f]; d.appendChild(cf); }
    if (sel === i) d.classList.add("sel");
    if (legalCache.includes(i)) d.classList.add("hl");
    boardEl.appendChild(d);
  }
  fenEl.textContent = "FEN: " + fen();
  sideEl.value = side;
  markBest();
}

function normCastle() {
  castling = ["K", "Q", "k", "q"].filter(k => (castling || "").includes(k)).join("") || "-";
}

function doMove(from, to) {
  if (!B[from]) return;
  pushHist();
  let p = B[from];
  if (p.toLowerCase() === "p" && (((to / 8) | 0) === (isW(p) ? 7 : 0))) p = isW(p) ? "Q" : "q"; // ponytail: auto-queen; upgrade = promotion picker
  B[to] = p; B[from] = "";
  if (p.toLowerCase() === "k") castling = castling.replace(isW(p) ? /KQ/g : /kq/g, "");
  if (p.toLowerCase() === "r") {
    const sq = sqName(from);
    if (sq === "a1") castling = castling.replace("Q", "");
    if (sq === "h1") castling = castling.replace("K", "");
    if (sq === "a8") castling = castling.replace("q", "");
    if (sq === "h8") castling = castling.replace("k", "");
  }
  normCastle();
  side = isW(p) ? "b" : "w";
  sel = null; legalCache = [];
  dirty(); render();
}

function placeTray(i) {
  let p = trayPiece;
  if (p.toLowerCase() === "p" && (((i / 8) | 0) === (p === p.toUpperCase() ? 7 : 0))) p = p === p.toUpperCase() ? "Q" : "q";
  pushHist();
  B[i] = p; trayPiece = null;
  document.querySelectorAll("#tray .pc").forEach(e => e.style.outline = "");
  sel = null; legalCache = [];
  dirty(); render();
}

function tap(i) {
  if (trayPiece) { placeTray(i); return; }
  if (sel === null) {
    if (!B[i]) return;
    sel = i; legalCache = pseudo(B, i);
    render(); return;
  }
  if (sel === i) { sel = null; legalCache = []; render(); return; }
  doMove(sel, i); // ponytail: free setup, any tap-target moves; upgrade = legal-only mode
}

let drag = null, trayPiece = null;
const boardSq = ev => { const t = ev.target.closest(".sq"); return t ? +t.dataset.i : null; };

boardEl.addEventListener("pointerdown", ev => {
  const i = boardSq(ev);
  if (i === null && !trayPiece) return;
  if (!B[i] && !trayPiece && sel === null) return;
  drag = { from: trayPiece ? null : i, piece: trayPiece || B[i], x0: ev.clientX, y0: ev.clientY, moved: false };
  if (trayPiece) { trayPiece = null; document.querySelectorAll("#tray .pc").forEach(e => e.style.outline = ""); }
  ev.preventDefault();
});
window.addEventListener("pointermove", ev => {
  if (!drag) return;
  if (Math.hypot(ev.clientX - drag.x0, ev.clientY - drag.y0) > 8) drag.moved = true;
  document.querySelectorAll(".sq.drop").forEach(e => e.classList.remove("drop"));
  const hov = document.elementFromPoint(ev.clientX, ev.clientY);
  const sq = hov && hov.closest ? hov.closest(".sq") : null;
  if (sq && drag.moved) sq.classList.add("drop");
});
window.addEventListener("pointerup", ev => {
  if (!drag) return;
  const d = drag; drag = null;
  document.querySelectorAll(".sq.drop").forEach(e => e.classList.remove("drop"));
  const hov = document.elementFromPoint(ev.clientX, ev.clientY);
  const sq = hov && hov.closest ? hov.closest(".sq") : null;
  if (!sq && d.from !== null && d.moved) { pushHist(); B[d.from] = ""; sel = null; legalCache = []; dirty(); render(); return; }
  if (!d.moved) {
    if (sq) { tap(+sq.dataset.i); return; }
    if (trayPiece) { trayPiece = null; document.querySelectorAll("#tray .pc").forEach(e => e.style.outline = ""); return; }
    if (d.from !== null) { tap(d.from); return; }
    return;
  }
  if (sq && d.moved) {
    const to = +sq.dataset.i;
    if (d.from === null) {
      let p = d.piece;
      if (p.toLowerCase() === "p" && (((to / 8) | 0) === (p === p.toUpperCase() ? 7 : 0))) p = p === p.toUpperCase() ? "Q" : "q";
      pushHist();
      B[to] = p; sel = null; legalCache = []; dirty(); render(); return;
    }
    if (to !== d.from) { doMove(d.from, to); return; }
  }
});

function buildTray() {
  $("tray").innerHTML = "";
  for (const p of ["K", "Q", "R", "B", "N", "P", "k", "q", "r", "b", "n", "p"]) {
    const s = document.createElement("span");
    s.className = "pc"; s.textContent = GLYPH[p.toLowerCase()];
    s.title = (p === p.toUpperCase() ? "White " : "Black ") + p.toUpperCase();
    s.addEventListener("pointerdown", ev => {
      trayPiece = p;
      document.querySelectorAll("#tray .pc").forEach(e => e.style.outline = "");
      s.style.outline = "3px solid var(--sel)";
      ev.preventDefault();
    });
    $("tray").appendChild(s);
  }
}

function uciToSan(uci) {
  if (!uci || uci.length < 4) return uci;
  const f = sqIndex(uci.slice(0, 2)), t = sqIndex(uci.slice(2, 4));
  if (!B[f]) return uci;
  let s = sanOf(B, f, t, uci[4]);
  if (/^[a-h][1-8][a-h][1-8][qrbn]$/i.test(uci)) s = s.replace(/=[QRBN]/, "=" + uci[4].toUpperCase());
  return s;
}

function onInfo(line) {
  const m = parseInfo(line);
  if (!m.mpv || !m.pv || !m.pv[0]) return;
  if (m.depth < (+depthEl.value - 4)) return; // ignore early shallow lines
  const first = m.pv[0];
  results[m.mpv - 1] = {
    san: uciToSan(first), score: scoreText(m, side),
    pv: m.pv.slice(0, 8).map(uciToSan).join(" "),
    from: first.slice(0, 2), to: first.slice(2, 4), depth: m.depth
  };
  paint();
}

function markBest() { // ponytail: top-1 highlight only; upgrade = per-line toggle if MultiPV UI returns
  boardEl.querySelectorAll(".sq.best").forEach(e => e.classList.remove("best"));
  const top = results.filter(Boolean)[0];
  if (top) for (const sq of [top.from, top.to]) { const el = boardEl.querySelector('[data-i="' + sqIndex(sq) + '"]'); if (el) el.classList.add("best"); }
}

function paint() {
  movesEl.innerHTML = "";
  results.filter(Boolean).forEach((r, k) => {
    const li = document.createElement("li");
    const mv = document.createElement("span"); mv.className = "mv"; mv.textContent = (k + 1) + ". " + r.san;
    const sc = document.createElement("span"); sc.className = "sc"; sc.textContent = r.score;
    const pv = document.createElement("span"); pv.className = "pv"; pv.textContent = "depth " + r.depth + " \u00B7 " + r.pv;
    li.appendChild(mv); li.appendChild(sc); li.appendChild(pv);
    li.title = "Click to play this move";
    li.onclick = () => {
      const f = sqIndex(r.from), t = sqIndex(r.to);
      if (B[f]) doMove(f, t);
    };
    movesEl.appendChild(li);
  });
  markBest();
}

function onDone() {
  thinking = false; goBtn.disabled = false; stopBtn.disabled = true;
  if (!results.filter(Boolean).length) { setStatus("No legal moves \u2014 checkmate or stalemate."); return; }
  setStatus("Done \u2014 best move highlighted in blue; click a move to play it.");
  paint();
}

function boot() {
  try { engine = new Worker("stockfish-19-lite-single.js"); }
  catch (e) { setStatus("Could not start engine: " + e.message); return; }
  engine.onmessage = ev => {
    const line = String(ev.data !== undefined ? ev.data : ev);
    if (/^uciok/.test(line)) {
      engineReady = true;
      setStatus("Engine ready (Stockfish 19). Set up a position and press Calculate.");
      engine.postMessage("setoption name MultiPV value 3");
      return;
    }
    if (/^info .* multipv /i.test(line)) { onInfo(line); return; }
    if (/^bestmove/.test(line)) { onDone(); return; }
    if (/^Stockfish 19/.test(line)) setStatus("Engine: " + line);
  };
  engine.onerror = e => setStatus("Engine error \u2014 reload the page. (" + ((e && e.message) || "worker error") + ")");
  engine.postMessage("uci");
}

goBtn.onclick = () => {
  if (!engineReady) { setStatus("Engine still loading \u2014 try again in a moment."); return; }
  dirty();
  thinking = true; goBtn.disabled = true; stopBtn.disabled = false;
  setStatus("Thinking\u2026 (depth " + depthEl.value + ", top 3 moves)");
  engine.postMessage("setoption name MultiPV value 3");
  engine.postMessage("position fen " + fen());
  engine.postMessage("go depth " + depthEl.value);
};
stopBtn.onclick = () => { if (engine && thinking) engine.postMessage("stop"); };
sideEl.onchange = e => { pushHist(); side = e.target.value; sel = null; legalCache = []; dirty(); render(); };
$("flip").onclick = () => { flipped = !flipped; render(); paint(); };
$("reset").onclick = () => {
  pushHist();
  B = parsePlacement(START_PLACEMENT); side = "w"; castling = "KQkq"; ep = "-";
  sel = null; legalCache = []; dirty();
  setStatus(engineReady ? "Board reset. Press Calculate." : "Engine loading\u2026");
  render();
};
$("clear").onclick = () => { pushHist(); B = new Array(64).fill(""); sel = null; legalCache = []; dirty(); render(); };
window.addEventListener("resize", () => { render(); paint(); });
window.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  sel = null; legalCache = [];
  if (trayPiece) { trayPiece = null; document.querySelectorAll("#tray .pc").forEach(x => x.style.outline = ""); }
  render();
});
boardEl.addEventListener("contextmenu", e => { e.preventDefault(); sel = null; legalCache = []; render(); });
$("undo").onclick = () => {
  const h = hist.pop();
  if (!h) return;
  B = h.B; side = h.side; castling = h.castling;
  sel = null; legalCache = []; dirty(); render();
};
function loadFen(str) {
  const m = str.match(/^\s*([prnbqkPRNBQK1-8\/]+)\s+([wb])\b(?:\s+([KQkq-]{1,4}))?/);
  if (!m) return false;
  try {
    const nb = parsePlacement(m[1]);
    if (nb.every(c => !c)) return false;
    pushHist();
    B = nb; side = m[2]; if (m[3]) castling = m[3] === "-" ? "-" : m[3];
    sel = null; legalCache = [];
    return true;
  } catch (e) { return false; }
}
fenEl.title = "Click to copy FEN";
fenEl.onclick = () => { navigator.clipboard.writeText(fen()); setStatus("FEN copied."); };
$("fenGo").onclick = () => {
  if (loadFen($("fenIn").value)) { dirty(); render(); setStatus("Position loaded. Press Calculate."); }
  else setStatus("Invalid FEN \u2014 need placement + side, e.g. \u201Crnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq\u201D.");
};

buildTray(); render(); boot();
