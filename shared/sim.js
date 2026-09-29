// Pure world simulation shared by the browser client and the Node server:
// map collision, navigation grid + A*, ray casting and movement physics. No DOM, no THREE.
import { B, MAPS, mapSolids, rects, inRect } from './game-data.js';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const PI = Math.PI;
export function angDiff(a, b) { let d = b - a; while (d > PI) d -= 2 * PI; while (d < -PI) d += 2 * PI; return d; }
export function turnTo(a, b, max) { const d = angDiff(a, b); return a + clamp(d, -max, max); }

/* ---------------- world ---------------- */
export function createWorld(mapId) {
  const def = MAPS[mapId];
  const w = { id: mapId, def, solids: mapSolids(def), waters: rects(def.water), bridges: rects(def.bridge), blocked: new Uint8Array(N), watC: new Uint8Array(N) };
  buildNav(w);
  return w;
}
export function inWater(w, x, z) { return w.waters.length > 0 && inRect(w.waters, x, z) && !inRect(w.bridges, x, z); }

/* ---------------- navigation ---------------- */
export const NX = B.maxX - B.minX, NZ = B.maxZ - B.minZ, N = NX * NZ;
const idx = (ix, iz) => iz * NX + ix;
export function cellX(x) { return clamp(Math.floor(x - B.minX), 0, NX - 1); }
export function cellZ(z) { return clamp(Math.floor(z - B.minZ), 0, NZ - 1); }
function buildNav(w) {
  const pad = 0.45;
  for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) {
    const x = B.minX + ix + 0.5, z = B.minZ + iz + 0.5;
    let bl = 0;
    for (const s of w.solids) if (x > s.minX - pad && x < s.maxX + pad && z > s.minZ - pad && z < s.maxZ + pad) { bl = 1; break; }
    w.blocked[idx(ix, iz)] = bl;
    w.watC[idx(ix, iz)] = inWater(w, x, z) ? 1 : 0;
  }
}
export function blockedAt(w, x, z) { return w.blocked[idx(cellX(x), cellZ(z))]; }
export function nearestOpen(w, ix, iz) {
  if (!w.blocked[idx(ix, iz)]) return idx(ix, iz);
  for (let r = 1; r < 10; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
    const x = ix + dx, z = iz + dz;
    if (x < 0 || z < 0 || x >= NX || z >= NZ) continue;
    if (!w.blocked[idx(x, z)]) return idx(x, z);
  }
  return -1;
}
// A* scratch buffers (single-threaded, reused between calls)
const gS = new Float32Array(N), came = new Int32Array(N), stamp = new Uint32Array(N), closed = new Uint32Array(N);
let gen = 0;
const hN = [], hF = [];
function hPush(n, f) { hN.push(n); hF.push(f); let i = hN.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (hF[p] <= hF[i]) break; [hN[p], hN[i]] = [hN[i], hN[p]]; [hF[p], hF[i]] = [hF[i], hF[p]]; i = p; } }
function hPop() {
  const top = hN[0]; const ln = hN.pop(), lf = hF.pop();
  if (hN.length) { hN[0] = ln; hF[0] = lf; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < hN.length && hF[l] < hF[m]) m = l; if (r < hN.length && hF[r] < hF[m]) m = r; if (m === i) break; [hN[m], hN[i]] = [hN[i], hN[m]]; [hF[m], hF[i]] = [hF[i], hF[m]]; i = m; } }
  return top;
}
function heur(a, b) { const dx = Math.abs(a % NX - b % NX), dz = Math.abs(((a / NX) | 0) - ((b / NX) | 0)); return dx + dz + (1.414 - 2) * Math.min(dx, dz); }
export function astar(w, s, g) {
  const blocked = w.blocked, watC = w.watC;
  gen++; hN.length = 0; hF.length = 0; gS[s] = 0; stamp[s] = gen; came[s] = -1; hPush(s, heur(s, g));
  let it = 0;
  while (hN.length && it++ < 14000) {
    const c = hPop(); if (c === g) break; if (closed[c] === gen) continue; closed[c] = gen;
    const cx = c % NX, cz = (c / NX) | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = cx + dx, nz = cz + dz; if (nx < 0 || nz < 0 || nx >= NX || nz >= NZ) continue;
      const ni = idx(nx, nz); if (blocked[ni]) continue;
      if (dx && dz && (blocked[idx(cx + dx, cz)] || blocked[idx(cx, cz + dz)])) continue;
      const ng = gS[c] + (dx && dz ? 1.414 : 1) + (watC[ni] ? 1.6 : 0);
      if (stamp[ni] !== gen || ng < gS[ni]) { stamp[ni] = gen; gS[ni] = ng; came[ni] = c; hPush(ni, ng + heur(ni, g)); }
    }
  }
  if (stamp[g] !== gen) return null;
  const out = []; let c = g; while (c !== -1 && c !== s) { out.push(c); c = came[c]; }
  return out.reverse();
}
export function lineWalkable(w, ax, az, bx, bz) {
  const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.3);
  for (let i = 1; i <= n; i++) { const t = i / n; if (blockedAt(w, ax + (bx - ax) * t, az + (bz - az) * t)) return false; }
  return true;
}
export function findPath(w, from, to) {
  const s = nearestOpen(w, cellX(from.x), cellZ(from.z)), g = nearestOpen(w, cellX(to.x), cellZ(to.z));
  if (s < 0 || g < 0) return null;
  const cells = astar(w, s, g); if (!cells) return null;
  const pts = cells.map((c) => ({ x: B.minX + (c % NX) + 0.5, z: B.minZ + ((c / NX) | 0) + 0.5 }));
  const out = []; let ax = from.x, az = from.z, i = 0;
  while (i < pts.length) {
    let j = i; while (j + 1 < pts.length && lineWalkable(w, ax, az, pts[j + 1].x, pts[j + 1].z)) j++;
    out.push(pts[j]); ax = pts[j].x; az = pts[j].z; i = j + 1;
  }
  return out;
}

/* ---------------- ray casting ---------------- */
export function rayBox(ox, oy, oz, dx, dy, dz, b, maxT) {
  let tmin = 0, tmax = maxT;
  const ax = [[ox, dx, b.minX, b.maxX], [oy, dy, b.minY, b.maxY], [oz, dz, b.minZ, b.maxZ]];
  for (const [o, d, mn, mx] of ax) {
    if (Math.abs(d) < 1e-9) { if (o < mn || o > mx) return Infinity; }
    else { let t1 = (mn - o) / d, t2 = (mx - o) / d; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return Infinity; }
  }
  return tmin;
}
export function rayWorld(w, o, d, maxT) {
  let best = maxT;
  if (d.y < -1e-6) { const t = -o.y / d.y; if (t < best) best = t; }
  for (const s of w.solids) { const t = rayBox(o.x, o.y, o.z, d.x, d.y, d.z, s, best); if (t < best) best = t; }
  return best;
}
export function los(w, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz) || 1e-6;
  return rayWorld(w, a, { x: dx / L, y: dy / L, z: dz / L }, L) >= L - 0.05;
}
export function raySphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const bq = ox * d.x + oy * d.y + oz * d.z, cq = ox * ox + oy * oy + oz * oz - r * r, h = bq * bq - cq;
  if (h < 0) return Infinity;
  const t = -bq - Math.sqrt(h);
  return t > 0 ? t : Infinity;
}
// vertical capsule: segment (ax,ay0,az)-(ax,ay1,az)
export function rayCapsule(o, d, ax, ay0, ay1, az, r) {
  const wx = o.x - ax, wy = o.y - ay0, wz = o.z - az, L = ay1 - ay0;
  const bq = d.y * L, c = L * L, dq = d.x * wx + d.y * wy + d.z * wz, e = L * wy, den = c - bq * bq;
  let s = den > 1e-6 ? (e - bq * dq) / den : 0; s = clamp(s, 0, 1);
  let t = bq * s - dq; if (t < 0) t = 0;
  const px = o.x + d.x * t - ax, py = o.y + d.y * t - (ay0 + L * s), pz = o.z + d.z * t - az;
  if (px * px + py * py + pz * pz > r * r) return Infinity;
  return Math.max(0, t - r * 0.5);
}
// hit volumes, shared so client and server agree on what a hit is
export const HEAD_Y = 1.66, HEAD_R = 0.22, BODY_Y0 = 0.25, BODY_Y1 = 1.38, BODY_R = 0.33, EYE_Y = 1.58, CHEST_Y = 1.2;
export function rayEntity(o, d, p) {
  const th = raySphere(o, d, { x: p.x, y: p.y + HEAD_Y, z: p.z }, HEAD_R);
  const tb = rayCapsule(o, d, p.x, p.y + BODY_Y0, p.y + BODY_Y1, p.z, BODY_R);
  return th < tb ? { t: th, head: true } : { t: tb, head: false };
}

/* ---------------- movement physics ---------------- */
export const R_ENT = 0.38;
export function resolveWalls(w, e) {
  for (const b of w.solids) {
    if (e.pos.y >= b.maxY - 0.05) continue;
    const nx = clamp(e.pos.x, b.minX, b.maxX), nz = clamp(e.pos.z, b.minZ, b.maxZ);
    const dx = e.pos.x - nx, dz = e.pos.z - nz, d2 = dx * dx + dz * dz;
    if (d2 >= R_ENT * R_ENT) continue;
    if (d2 > 1e-8) { const d = Math.sqrt(d2); e.pos.x = nx + (dx / d) * R_ENT; e.pos.z = nz + (dz / d) * R_ENT; }
    else {
      const pl = e.pos.x - b.minX, pr = b.maxX - e.pos.x, pb = e.pos.z - b.minZ, pf = b.maxZ - e.pos.z, m = Math.min(pl, pr, pb, pf);
      if (m === pl) e.pos.x = b.minX - R_ENT; else if (m === pr) e.pos.x = b.maxX + R_ENT; else if (m === pb) e.pos.z = b.minZ - R_ENT; else e.pos.z = b.maxZ + R_ENT;
    }
  }
  e.pos.x = clamp(e.pos.x, B.minX + R_ENT, B.maxX - R_ENT);
  e.pos.z = clamp(e.pos.z, B.minZ + R_ENT, B.maxZ - R_ENT);
}
export function groundAt(w, x, z, y) {
  let g = 0; const r = 0.25;
  for (const b of w.solids) { if (b.maxY > y + 0.06) continue; if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ && b.maxY > g) g = b.maxY; }
  return g;
}
export function physics(w, e, dt) {
  e.pos.x += e.vel.x * dt; resolveWalls(w, e);
  e.pos.z += e.vel.z * dt; resolveWalls(w, e);
  e.vy -= 20 * dt; e.pos.y += e.vy * dt;
  const g = groundAt(w, e.pos.x, e.pos.z, e.pos.y + Math.max(0, -e.vy * dt));
  if (e.pos.y <= g) { e.pos.y = g; e.vy = 0; e.onGround = true; } else e.onGround = false;
}
