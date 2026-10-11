"use strict";
/* chess.js - pure chess logic, zero DOM. Used by app.js; tested via `node test.js`. */
const START_PLACEMENT = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
const idx = (f, r) => r * 8 + f;
const inB = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;
const isW = c => c >= "A" && c <= "Z";
const colOf = c => (!c ? null : (isW(c) ? "w" : "b"));
const sqName = i => "abcdefgh"[i % 8] + (((i / 8) | 0) + 1);
const sqIndex = s => "abcdefgh".indexOf(s[0]) + (parseInt(s[1], 10) - 1) * 8;

function parsePlacement(s) {
  const b = new Array(64).fill("");
  let r = 7, f = 0;
  for (const ch of s) {
    if (ch === "/") { r--; f = 0; }
    else if (ch >= "0" && ch <= "9") { f += +ch; }
    else { b[idx(f++, r)] = ch; }
  }
  return b;
}

function placement(B) {
  const rows = [];
  for (let r = 7; r >= 0; r--) {
    let s = "", e = 0;
    for (let f = 0; f < 8; f++) {
      const c = B[idx(f, r)];
      if (!c) { e++; continue; }
      if (e) { s += e; e = 0; }
      s += c;
    }
    rows.push(s + (e ? e : ""));
  }
  return rows.join("/");
}

function attacks(B, sq, byW) {
  const f = sq % 8, r = (sq / 8) | 0;
  for (const [df, dr] of [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]]) {
    const F = f + df, R = r + dr;
    if (inB(F, R)) { const c = B[idx(F, R)]; if (c && isW(c) === byW && c.toLowerCase() === "n") return true; }
  }
  for (const df of [-1, 1]) {
    const R = byW ? r - 1 : r + 1, F = f + df;
    if (inB(F, R)) { const c = B[idx(F, R)]; if (c && isW(c) === byW && c.toLowerCase() === "p") return true; }
  }
  for (const [df, dr] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
    let F = f + df, R = r + dr, dist = 1;
    while (inB(F, R)) {
      const c = B[idx(F, R)];
      if (c) {
        if (isW(c) === byW) {
          const t = c.toLowerCase();
          if (t === "q") return true;
          if (t === "r" && (df === 0 || dr === 0)) return true;
          if (t === "b" && df !== 0 && dr !== 0) return true;
          if (t === "k" && dist === 1) return true;
        }
        break;
      }
      F += df; R += dr; dist++;
    }
  }
  return false;
}

function pseudo(B, sq, moves) {
  const c = B[sq];
  moves = moves || [];
  if (!c) return moves;
  const w = isW(c), f = sq % 8, r = (sq / 8) | 0, t = c.toLowerCase();
  const slide = dirs => {
    for (const [df, dr] of dirs) {
      let F = f + df, R = r + dr;
      while (inB(F, R)) {
        const d = B[idx(F, R)];
        if (!d) { moves.push(idx(F, R)); }
        else { if (colOf(d) !== colOf(c)) moves.push(idx(F, R)); break; }
        F += df; R += dr;
      }
    }
  };
  if (t === "n") {
    for (const [df, dr] of [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]])
      if (inB(f + df, r + dr) && colOf(B[idx(f + df, r + dr)]) !== colOf(c)) moves.push(idx(f + df, r + dr));
  } else if (t === "b") slide([[1,1],[1,-1],[-1,1],[-1,-1]]);
  else if (t === "r") slide([[1,0],[-1,0],[0,1],[0,-1]]);
  else if (t === "q") slide([[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]);
  else if (t === "k") {
    for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
      if (!df && !dr) continue;
      if (inB(f + df, r + dr) && colOf(B[idx(f + df, r + dr)]) !== colOf(c)) moves.push(idx(f + df, r + dr));
    }
  } else {
    const dir = w ? 1 : -1, start = w ? 1 : 6;
    if (inB(f, r + dir) && !B[idx(f, r + dir)]) {
      moves.push(idx(f, r + dir));
      if (r === start && !B[idx(f, r + 2 * dir)]) moves.push(idx(f, r + 2 * dir));
    }
    for (const df of [-1, 1])
      if (inB(f + df, r + dir) && B[idx(f + df, r + dir)] && colOf(B[idx(f + df, r + dir)]) !== colOf(c))
        moves.push(idx(f + df, r + dir));
  }
  return moves;
}

function kingSq(B, w) { return B.indexOf(w ? "K" : "k"); }

function legalMoves(B, sq, side) {
  const c = B[sq];
  if (!c || colOf(c) !== side) return [];
  const w = isW(c), out = [];
  for (const to of pseudo(B, sq)) {
    const fc = B[sq], tc = B[to];
    B[to] = fc; B[sq] = "";
    let k = kingSq(B, w);
    if (k < 0) k = to; // kingless setup board: no check possible
    const ok = !attacks(B, k, !w);
    B[sq] = fc; B[to] = tc;
    if (ok) out.push(to);
  }
  return out;
}

function fenOf(B, side, castling, ep) {
  return placement(B) + " " + side + " " + (castling || "-") + " " + (ep || "-") + " 0 1";
}

// Minimal SAN for display (castle suffix omitted for kingless setups; engine gives exact PV).
function sanOf(B, from, to, promo) {
  const c = B[from];
  if (!c) return "?";
  const t = c.toLowerCase(), cap = !!B[to];
  let s;
  if (t === "p") {
    s = (cap ? "abcdefgh"[from % 8] + "x" : "") + "abcdefgh"[to % 8] + (((to / 8) | 0) + 1);
    if ((to / 8 | 0) === (isW(c) ? 7 : 0)) s += "=" + (promo || "Q").toUpperCase();
  } else {
    s = t.toUpperCase() + (cap ? "x" : "") + "abcdefgh"[to % 8] + (((to / 8) | 0) + 1);
  }
  return s;
}

function scoreText(m, side) {
  const turn = side === "w" ? 1 : -1;
  if (m.mate !== null && m.mate !== undefined) {
    const v = m.mate * turn;
    return v > 0 ? "M" + v : "-M" + Math.abs(v);
  }
  const p = m.cp / 100 * turn;
  return (p > 0 ? "+" : "") + p.toFixed(2);
}

function parseInfo(line) {
  const m = {};
  let mm = line.match(/\bmultipv (\d+)/); if (mm) m.mpv = +mm[1];
  mm = line.match(/\bdepth (\d+)/); if (mm) m.depth = +mm[1];
  mm = line.match(/\bscore (mate (-?\d+)|cp (-?\d+))/);
  if (mm) { m.mate = mm[2] ? +mm[2] : null; m.cp = mm[3] ? +mm[3] : null; }
  mm = line.match(/\bpv (.+)$/); if (mm) m.pv = mm[1].trim().split(/\s+/);
  if (typeof module !== "undefined") m.raw = line;
  return m;
}

if (typeof module !== "undefined")
  module.exports = { START_PLACEMENT, idx, inB, isW, colOf, sqName, sqIndex, parsePlacement, placement, attacks, pseudo, kingSq, legalMoves, fenOf, sanOf, scoreText, parseInfo };
