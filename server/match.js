// Server-authoritative match: bots, hit detection (with lag compensation), damage, economy, respawns.
// Humans report their own movement (validated here); everything that decides who lives is decided here.
import { W, GEAR, magCap, headMul, PRICE_MUL, START_MONEY, KILL_REWARD, STREAK_BONUS, MONEY_CAP, RESPAWN, SPAWN_PROT, HP_MAX, DIFF, STYLES, PREFS, SPAWNS, mir, mirOf, inBuyZone } from '../shared/game-data.js';
import { createWorld, inWater, findPath, los, rayWorld, rayEntity, resolveWalls, physics, angDiff, turnTo, clamp, EYE_Y, CHEST_Y, HEAD_Y, PI } from '../shared/sim.js';

const rand = (a, b) => a + Math.random() * (b - a);
const BOT_NAMES = [['獵鷹', '石牆', '幽靈', '烈風', '疾風'], ['毒蛇', '鐵砧', '野狼', '雷霆', '黑曜']];
const HISTORY_MS = 1000;
const MAX_REWIND_MS = 300;
const r2 = (v) => Math.round(v * 100) / 100;

export class Match {
  /**
   * @param {{mapId:string,len:number,diff:string,humans:{id:number,name:string,team:number}[],bots:number[]}} opts
   * @param {(type:string,payload:object,to?:number,except?:number)=>void} emit
   */
  constructor(opts, emit) {
    this.world = createWorld(opts.mapId);
    this.def = this.world.def;
    this.len = opts.len;
    this.diff = DIFF[opts.diff] ? opts.diff : 'std';
    this.emit = emit;
    this.t = 0;
    this.teamKills = [0, 0];
    this.ents = [];
    this.byId = new Map();
    for (const h of opts.humans) this.add(this.makeEnt(h.id, h.name, h.team, false));
    let botId = 100000, style = 0;
    for (const team of [0, 1]) for (let i = 0; i < opts.bots[team]; i++) {
      this.add(this.makeEnt(botId++, BOT_NAMES[team][i % 5], team, true, STYLES[style++ % STYLES.length]));
    }
  }

  // called after every client has received the roster, so the first 'spawn' events land in a running match
  begin() { for (const e of this.ents) this.spawn(e); }

  roster() { return this.ents.map((e) => ({ id: e.id, name: e.name, team: e.team, bot: e.bot })); }
  add(e) { this.ents.push(e); this.byId.set(e.id, e); }
  remove(id) { const e = this.byId.get(id); if (!e) return; this.byId.delete(id); this.ents.splice(this.ents.indexOf(e), 1); for (const o of this.ents) if (o.ai && o.ai.target === e) o.ai.target = null; }

  makeEnt(id, name, team, bot, style) {
    return {
      id, name, team, bot, pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, z: 0 }, vy: 0, onGround: true, yaw: 0, pitch: 0,
      hp: HP_MAX, healT: 0, alive: false, respawnT: 0, spawnProt: 0,
      money: START_MONEY, kills: 0, deaths: 0, streak: 0, primary: null, secondary: 'p9', slot: 2, ammo: {},
      reloadT: 0, reloadKey: null, fireCd: 0, swapT: 0, lastSlot: 1, burstLeft: 0, burstTarget: null,
      lastFireMs: 0, lastStateMs: 0, hist: [], lastShotT: -99,
      ai: bot ? { style, path: null, pathGoal: null, goal: null, route: [], repathT: 0, scanT: 0, target: null, seeT: 0, react: 0.5, lastSeen: null, lastSeenT: -99, alertBy: null, alertT: -99, strafeDir: 1, strafeT: 0, burst: 0, burstLen: 4, burstPause: 0, stuckT: 0, lastX: 0, lastZ: 0 } : null,
    };
  }

  /* ---------------- helpers ---------------- */
  curW(e) { return e.slot === 3 ? (e.melee || 'knife') : (e.slot === 1 && e.primary) ? e.primary : e.secondary; }
  priceOf(k) { const base = GEAR[k] ? GEAR[k].price : W[k].price; return Math.round(base * (PRICE_MUL[this.len] || 1) / 50) * 50; }
  you(e) {
    if (e.bot) return;
    const gear = {}; for (const g in GEAR) gear[g] = !!e[g];
    this.emit('you', { hp: Math.max(0, Math.ceil(e.hp)), money: e.money, gear, healT: r2(Math.max(0, e.healT)), primary: e.primary, secondary: e.secondary, kills: e.kills, deaths: e.deaths }, e.id);
  }
  posAt(e, ms) {
    const h = e.hist;
    if (!h.length) return e.pos;
    if (ms >= h[h.length - 1].ms) return e.pos;
    for (let i = h.length - 1; i > 0; i--) {
      const a = h[i - 1], b = h[i];
      if (a.ms <= ms) { const k = b.ms > a.ms ? (ms - a.ms) / (b.ms - a.ms) : 1; return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k }; }
    }
    return h[0];
  }

  /* ---------------- lifecycle ---------------- */
  spawn(e, slotHint) {
    const pts = SPAWNS[e.team];
    let best = pts[0], bs = -1;
    for (const p of pts) {
      let md = 1e9; for (const o of this.ents) if (o.team !== e.team && o.alive) md = Math.min(md, Math.hypot(o.pos.x - p[0], o.pos.z - p[1]));
      let occ = 0; for (const o of this.ents) if (o !== e && o.alive && Math.hypot(o.pos.x - p[0], o.pos.z - p[1]) < 1.2) occ = 1;
      const sc = md + Math.random() * 4 - (occ ? 50 : 0);
      if (sc > bs) { bs = sc; best = p; }
    }
    Object.assign(e.pos, { x: best[0] + rand(-0.3, 0.3), y: 0, z: best[1] + rand(-0.3, 0.3) });
    e.vel.x = e.vel.z = 0; e.vy = 0; e.yaw = e.team === 0 ? -PI / 2 : PI / 2; e.pitch = 0;
    for (const g in GEAR) e[g] = false;
    Object.assign(e, { hp: HP_MAX, alive: true, healT: 0, primary: null, secondary: 'p9', melee: 'knife', dashReadyMs: 0, dashUntil: 0, slot: 2, lastSlot: 1, reloadT: 0, fireCd: 0, swapT: 0, burstLeft: 0, spawnProt: SPAWN_PROT });
    e.ammo = { p9: { mag: W.p9.mag, reserve: W.p9.reserve } };
    e.hist.length = 0;
    if (e.bot) {
      const a = e.ai; a.path = null; a.goal = null; a.route = []; a.target = null; a.lastSeen = null; a.stuckT = 0; a.lastX = e.pos.x; a.lastZ = e.pos.z;
      this.botBuy(e);
    } else {
      e.lastStateMs = 0;
      this.emit('spawn', { x: r2(e.pos.x), y: 0, z: r2(e.pos.z), yaw: e.yaw }, e.id);
      this.you(e);
    }
  }

  giveWeapon(e, k) {
    const w = W[k];
    if (w.slot === 3) { e.melee = k; e.slot = 3; e.reloadT = 0; e.swapT = 0.35; return; }
    e.ammo[k] = { mag: magCap(e, k), reserve: w.reserve };
    if (w.slot === 1) { e.primary = k; e.slot = 1; } else { e.secondary = k; e.slot = 2; }
    e.reloadT = 0; e.swapT = 0.35;
  }
  buy(e, key) {
    if (!e.alive || !inBuyZone(e) || !(W[key] || GEAR[key]) || key === 'knife' || key === 'p9') return false;
    const pr = this.priceOf(key);
    if (GEAR[key]) { if (e[key] || e.money < pr) return false; e.money -= pr; e[key] = true; if (GEAR[key].mag) for (const k in e.ammo) e.ammo[k].mag = Math.max(e.ammo[k].mag, magCap(e, k)); }
    else { if (e.money < pr || e.primary === key || e.secondary === key || e.melee === key) return false; e.money -= pr; this.giveWeapon(e, key); }
    if (!e.bot) { this.emit('bought', { key }, e.id); this.you(e); }
    return true;
  }
  botBuy(e) {
    for (const k of PREFS[e.ai.style]) { const side = W[k].slot === 2; if (e.money >= this.priceOf(k) * (side ? 3 : 1)) { this.buy(e, k); break; } }
    if (e.money >= this.priceOf('armor') && Math.random() < 0.7) this.buy(e, 'armor');
    if (e.money >= this.priceOf('gloves') && Math.random() < 0.45) this.buy(e, 'gloves');
    if (e.money >= this.priceOf('boots') && (e.ai.style === 'heavy' || Math.random() < 0.35)) this.buy(e, 'boots');
    if (e.money >= this.priceOf('helmet') && Math.random() < 0.45) this.buy(e, 'helmet');
    if (e.money >= this.priceOf('medkit') && Math.random() < 0.35) this.buy(e, 'medkit');
    const mc = e.primary && W[e.primary].magc;
    if (mc && e.money >= this.priceOf('mag_' + mc) && Math.random() < 0.35) this.buy(e, 'mag_' + mc);
  }
  // field medkit: heals GEAR.medkit.heal over GEAR.medkit.time seconds; taking damage or firing cuts it short
  startHeal(e) {
    if (!e.alive || !e.medkit || e.healT > 0 || e.hp >= HP_MAX) return false;
    e.medkit = false; e.healT = GEAR.medkit.time; e.burstLeft = 0;
    this.you(e);
    return true;
  }
  healStep(e, dt) {
    if (!(e.healT > 0)) return;
    const step = Math.min(dt, e.healT);
    e.healT -= dt; e.hp = Math.min(HP_MAX, e.hp + GEAR.medkit.heal * step / GEAR.medkit.time);
    if (e.healT <= 0 || e.hp >= HP_MAX) { e.healT = 0; this.you(e); }
  }

  /* ---------------- combat ---------------- */
  startReload(e, k) {
    k = k || this.curW(e); const w = W[k], a = e.ammo[k];
    if (!a || e.reloadT > 0 || a.mag >= magCap(e, k) || a.reserve <= 0) return false;
    e.reloadT = w.reload; e.reloadKey = k; return true;
  }
  switchSlot(e, s) { if (s === 1 && !e.primary) return; if (e.slot === s) return; e.burstLeft = 0; e.lastSlot = e.slot; e.slot = s; e.reloadT = 0; e.swapT = 0.35; }
  hasAmmo(e, slot) { const k = slot === 1 ? e.primary : e.secondary; const a = k && e.ammo[k]; return !!a && (a.mag > 0 || a.reserve > 0); }
  isBehind(a, v) { const fx = -Math.sin(v.yaw), fz = -Math.cos(v.yaw), dx = v.pos.x - a.pos.x, dz = v.pos.z - a.pos.z, d = Math.hypot(dx, dz) || 1; return (dx * fx + dz * fz) / d > 0.5; }
  falloff(w, d) { return d <= w.range ? 1 : Math.max(0.45, 1 - (d - w.range) / (w.range * 1.5)); }
  alertNearby(s, rad = 32) {
    for (const o of this.ents) {
      if (!o.bot || !o.alive || o.team === s.team || o.ai.target) continue;
      if (Math.hypot(o.pos.x - s.pos.x, o.pos.z - s.pos.z) < rad) { o.ai.lastSeen = { ...s.pos }; o.ai.lastSeenT = this.t; }
    }
  }
  damage(v, a, amt, wk, hs) {
    if (!v.alive || v.spawnProt > 0) return false;
    if (v.armor) amt *= 0.7;
    // helmet: a headshot can't take a full-health target down in one hit
    if (hs && v.helmet && v.hp >= HP_MAX && amt >= v.hp) amt = v.hp - 1;
    v.hp -= amt; v.healT = 0;
    if (v.bot) { v.ai.lastSeen = { ...a.pos }; v.ai.lastSeenT = this.t; v.ai.alertBy = a; v.ai.alertT = this.t; }
    else this.emit('hurt', { x: r2(a.pos.x), z: r2(a.pos.z), hp: Math.max(0, Math.ceil(v.hp)) }, v.id);
    if (v.hp <= 0) { this.kill(v, a, wk, hs); return true; }
    return false;
  }
  kill(v, a, wk, hs) {
    v.alive = false; v.hp = 0; v.deaths++; v.streak = 0; v.respawnT = RESPAWN; v.reloadT = 0; v.burstLeft = 0;
    a.kills++; a.streak++; this.teamKills[a.team]++;
    const bonus = a.streak >= 3 ? STREAK_BONUS : 0, reward = KILL_REWARD + bonus;
    a.money = Math.min(MONEY_CAP, a.money + reward);
    this.emit('kill', { k: a.id, v: v.id, wk, hs: !!hs, tk: this.teamKills, kk: a.kills, vd: v.deaths, reward, streak: a.streak });
    this.you(a); this.you(v);
  }

  /* human input -------------------------------------------------------- */
  humanState(id, s, nowMs) {
    const e = this.byId.get(id); if (!e || e.bot || !e.alive) return;
    const [x, y, z, yaw, pitch, wk] = s;
    // movement validation: never faster than the fastest legal speed (+slack for jitter), never through walls
    const dtMs = e.lastStateMs ? Math.min(1000, nowMs - e.lastStateMs) : 1000;
    e.lastStateMs = nowMs;
    // a katana dash moves ~6.5 m in 0.22 s; allow it only while a server-accepted dash is running
    const maxD = 7.5 * (dtMs / 1000) * 1.35 + 0.6 + (nowMs < e.dashUntil ? 8 : 0);
    let dx = x - e.pos.x, dz = z - e.pos.z; const d = Math.hypot(dx, dz);
    if (d > maxD) { dx *= maxD / d; dz *= maxD / d; }
    const px = e.pos.x, pz = e.pos.z;
    e.pos.x += dx; e.pos.z += dz; e.pos.y = clamp(y, 0, 2.5);
    resolveWalls(this.world, e);
    if (dtMs > 0) { e.vel.x = (e.pos.x - px) / (dtMs / 1000); e.vel.z = (e.pos.z - pz) / (dtMs / 1000); }
    e.onGround = e.pos.y < 0.05 || e.pos.y > 1;
    e.yaw = yaw; e.pitch = pitch;
    if (W[wk] && W[wk].melee && wk === (e.melee || 'knife')) e.slot = 3; else if (wk === e.primary) e.slot = 1; else if (wk === e.secondary) e.slot = 2;
  }
  humanReload(id, wk) { const e = this.byId.get(id); if (e && e.alive && (wk === e.primary || wk === e.secondary)) this.startReload(e, wk); }
  humanHeal(id) { const e = this.byId.get(id); if (e && !this.startHeal(e)) this.you(e); }
  humanBuy(id, key) { const e = this.byId.get(id); if (e) { if (!this.buy(e, key)) this.you(e); } }

  humanFire(id, m, nowMs) {
    const e = this.byId.get(id); if (!e || e.bot || !e.alive) return;
    const wk = m.wk, w = W[wk];
    if (!w || w.melee || (wk !== e.primary && wk !== e.secondary)) return;
    const a = e.ammo[wk];
    if (!a) return;
    if (a.mag <= 0) { if (e.reloadT <= 0 || e.reloadKey !== wk) this.startReload(e, wk); if (a.mag <= 0) return; }
    const minGap = (60000 / w.rpm) * 0.7;
    if (nowMs - e.lastFireMs < minGap) return;
    e.lastFireMs = nowMs; e.healT = 0;
    a.mag--; e.spawnProt = 0; if (!w.silent) e.lastShotT = this.t;
    // shots come from the player's eye, within reach of where the server thinks they are
    const o = { x: m.o[0], y: m.o[1], z: m.o[2] };
    if (Math.hypot(o.x - e.pos.x, o.z - e.pos.z) > 1.5 || Math.abs(o.y - (e.pos.y + EYE_Y)) > 1) { o.x = e.pos.x; o.y = e.pos.y + EYE_Y; o.z = e.pos.z; }
    const at = clamp(Number(m.ts) || nowMs, nowMs - MAX_REWIND_MS, nowMs);
    const targets = this.ents.filter((t) => t.team !== e.team && t.alive).map((t) => ({ t, p: this.posAt(t, at) }));
    const hits = new Map(); const ends = [];
    const dirs = m.d.slice(0, w.pellets);
    for (const dv of dirs) {
      const L = Math.hypot(dv[0], dv[1], dv[2]) || 1; const d = { x: dv[0] / L, y: dv[1] / L, z: dv[2] / L };
      const wallT = rayWorld(this.world, o, d, 200);
      let bestT = wallT, best = null, head = false;
      for (const { t, p } of targets) { const r = rayEntity(o, d, p); if (r.t < bestT) { bestT = r.t; best = t; head = r.head; } }
      if (ends.length < 3) ends.push([r2(o.x + d.x * Math.min(bestT, 200)), r2(o.y + d.y * Math.min(bestT, 200)), r2(o.z + d.z * Math.min(bestT, 200))]);
      if (best) { const h = hits.get(best) || { d: 0, hs: false }; h.d += w.dmg * (head ? headMul(best) : 1) * this.falloff(w, bestT); h.hs = h.hs || head; hits.set(best, h); }
    }
    this.emit('shot', { id: e.id, look: w.look, o: [r2(o.x), r2(o.y), r2(o.z)], e: ends }, undefined, e.id);
    this.alertNearby(e, w.silent ? 8 : 32);
    let dealt = 0, killed = false, hs = false;
    hits.forEach((h, t) => { if (!t.alive || t.spawnProt > 0) return; dealt += h.d; hs = hs || h.hs; if (this.damage(t, e, h.d, wk, h.hs)) killed = true; });
    if (dealt > 0) this.emit('hit', { kill: killed, hs }, e.id);
  }
  humanMelee(id, m, nowMs) {
    const e = this.byId.get(id); if (!e || e.bot || !e.alive) return;
    const wk = e.melee || 'knife', w = W[wk], kind = m.kind;
    const at = clamp(Number(m.ts) || nowMs, nowMs - MAX_REWIND_MS, nowMs);
    const eye = { x: e.pos.x, y: e.pos.y + EYE_Y, z: e.pos.z };
    if (kind === 'dash') {
      if (!w.dash || nowMs < e.dashReadyMs) return;
      e.dashReadyMs = nowMs + w.dash.cd * 1000 * 0.95; e.dashUntil = nowMs + 500; e.spawnProt = 0; e.healT = 0;
      const yaw = typeof m.yaw === 'number' ? m.yaw : e.yaw, dx = -Math.sin(yaw), dz = -Math.cos(yaw);
      let best = null, bt = 1e9;
      for (const t of this.ents) {
        if (t.team === e.team || !t.alive) continue;
        const p = this.posAt(t, at), rx = p.x - e.pos.x, rz = p.z - e.pos.z;
        const along = rx * dx + rz * dz, side = Math.abs(rx * dz - rz * dx);
        if (along < -0.3 || along > w.dash.dist + 0.8 || side > 1.2 || Math.abs(p.y - e.pos.y) > 1.2) continue;
        if (!los(this.world, eye, { x: p.x, y: p.y + CHEST_Y, z: p.z })) continue;
        if (along < bt) { bt = along; best = t; }
      }
      if (best) { const killed = this.damage(best, e, w.dash.dmg, wk, false); this.emit('hit', { kill: killed, hs: false }, e.id); }
      return;
    }
    let dmg = w.dmg, gap = (60000 / w.rpm) * 0.7;
    if (kind === 'heavy' && w.charge) {
      // the charge can't be longer than the time since the last swing
      const c = clamp(Math.min(Number(m.charge) || 0, (nowMs - e.lastFireMs) / 1000 / 0.8), 0, w.charge.time);
      dmg = w.dmg + (w.charge.max - w.dmg) * (c / w.charge.time);
    }
    if (nowMs - e.lastFireMs < gap) return;
    e.lastFireMs = nowMs; e.spawnProt = 0; e.healT = 0;
    const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw);
    let best = null, bd = 1e9;
    for (const t of this.ents) {
      if (t.team === e.team || !t.alive) continue;
      const p = this.posAt(t, at), dx = p.x - e.pos.x, dz = p.z - e.pos.z, d = Math.hypot(dx, dz);
      if (d > w.range + 0.3 || Math.abs(p.y - e.pos.y) > 1.2) continue;
      if ((dx * fx + dz * fz) / Math.max(d, 0.01) < (w.arc || 0.6) - 0.05) continue;
      if (!los(this.world, eye, { x: p.x, y: p.y + CHEST_Y, z: p.z })) continue;
      if (d < bd) { bd = d; best = t; }
    }
    if (best) { const killed = this.damage(best, e, this.isBehind(e, best) ? Math.max(110, dmg * 1.5) : dmg, wk, false); this.emit('hit', { kill: killed, hs: false }, e.id); }
  }

  /* bots ----------------------------------------------------------------- */
  botFire(e, tg, dist) {
    if (e.healT > 0) return;
    const k = this.curW(e), w = W[k], a = e.ammo[k], ai = e.ai, D = DIFF[this.diff];
    a.mag--; e.fireCd = 60 / w.rpm; if (!w.silent) e.lastShotT = this.t; e.spawnProt = 0;
    let p = w.botAcc * D.acc * (dist <= w.range ? 1 : Math.max(0.1, 1 - (dist - w.range) / (w.range * 1.2)));
    if (Math.hypot(tg.vel.x, tg.vel.z) > 2) p *= 0.78;
    if (Math.hypot(e.vel.x, e.vel.z) > 1) p *= 0.82;
    p *= Math.min(1, 0.5 + ai.seeT * 0.6);
    if (!tg.onGround) p *= 0.7;
    if (e.gloves) p *= 1.12;
    let total = 0, hs = false;
    for (let i = 0; i < w.pellets; i++) if (Math.random() < clamp(p, 0.03, 0.92)) { const h = Math.random() < 0.12 * D.acc; hs = hs || h; total += w.dmg * (h ? headMul(tg) : 1) * this.falloff(w, dist); }
    const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw), rx = Math.cos(e.yaw), rz = -Math.sin(e.yaw);
    const m = [r2(e.pos.x + fx * 1.2 + rx * 0.15), r2(e.pos.y + 1.34), r2(e.pos.z + fz * 1.2 + rz * 0.15)];
    const end = [tg.pos.x, tg.pos.y + CHEST_Y, tg.pos.z];
    if (total <= 0) { end[0] += rand(-1.2, 1.2); end[1] += rand(-0.4, 0.9); end[2] += rand(-1.2, 1.2); }
    this.emit('shot', { id: e.id, look: w.look, o: m, e: [end.map(r2)] });
    this.alertNearby(e, w.silent ? 8 : 32);
    if (total > 0) this.damage(tg, e, total, k, hs);
  }
  botMelee(e, tg) {
    if (e.healT > 0) return;
    const w = W.knife, D = DIFF[this.diff];
    e.fireCd = 60 / w.rpm + rand(0.05, 0.2); e.lastShotT = this.t; e.spawnProt = 0;
    if (Math.random() < 0.75 * D.acc) this.damage(tg, e, this.isBehind(e, tg) ? 110 : w.dmg, 'knife', false);
  }
  findTarget(e) {
    let best = null, bd = 1e9;
    const eye = { x: e.pos.x, y: e.pos.y + EYE_Y, z: e.pos.z };
    for (const o of this.ents) {
      if (o.team === e.team || !o.alive || o.spawnProt > 0) continue;
      const dx = o.pos.x - e.pos.x, dz = o.pos.z - e.pos.z, d = Math.hypot(dx, dz); if (d > 90) continue;
      const want = Math.atan2(-dx, -dz);
      const fov = Math.abs(angDiff(e.yaw, want)) < 1.15 || d < 7 || (e.ai.alertBy === o && this.t - e.ai.alertT < 2.5) || e.ai.target === o;
      if (!fov) continue;
      if (!los(this.world, eye, { x: o.pos.x, y: o.pos.y + CHEST_Y, z: o.pos.z }) && !los(this.world, eye, { x: o.pos.x, y: o.pos.y + HEAD_Y, z: o.pos.z })) continue;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  nextGoal(e) {
    const ai = e.ai;
    if (!ai.route.length) {
      const pk = (a) => a[(Math.random() * a.length) | 0];
      const mm = mirOf(this.def); let pts = this.def.lanes ? [...pk(this.def.lanes), pk(this.def.cpoi)] : [pk(this.def.poi), pk(this.def.cpoi), mm(pk(this.def.poi))];
      if (e.team === 1) pts = pts.map(mm);
      ai.route = pts.map((p) => ({ x: p[0] + rand(-1, 1), z: p[1] + rand(-1, 1) }));
    }
    return ai.route.shift();
  }
  updateBot(e, dt) {
    const ai = e.ai, D = DIFF[this.diff], wd = this.world;
    if (e.burstLeft > 0 && e.fireCd <= 0 && e.reloadT <= 0 && e.swapT <= 0) {
      const bw = W[this.curW(e)], tg = e.burstTarget, a = e.ammo[this.curW(e)];
      if (bw.burst && tg && tg.alive && a && a.mag > 0) { this.botFire(e, tg, Math.hypot(tg.pos.x - e.pos.x, tg.pos.z - e.pos.z)); e.burstLeft--; if (!e.burstLeft) e.fireCd += bw.burstDelay * rand(1, 1.7); }
      else e.burstLeft = 0;
    }
    if (ai.target && (!ai.target.alive || ai.target.spawnProt > 0 || !this.byId.has(ai.target.id))) ai.target = null;
    ai.scanT -= dt;
    if (ai.scanT <= 0) { ai.scanT = rand(0.1, 0.18); const t = this.findTarget(e); if (t !== ai.target) { if (t && !ai.target) { ai.seeT = 0; ai.react = D.react * rand(0.8, 1.3); } ai.target = t; } }
    if (e.medkit && e.healT <= 0 && !ai.target && e.hp < 55) this.startHeal(e);
    let wk = this.curW(e), w = W[wk], mx = 0, mz = 0;
    const water = inWater(wd, e.pos.x, e.pos.z) ? 0.6 : 1;
    if (ai.target) {
      const tg = ai.target; ai.seeT += dt; ai.lastSeen = { ...tg.pos }; ai.lastSeenT = this.t;
      const dx = tg.pos.x - e.pos.x, dz = tg.pos.z - e.pos.z, dist = Math.hypot(dx, dz) || 0.01;
      const want = Math.atan2(-dx, -dz); e.yaw = turnTo(e.yaw, want, 8 * dt);
      if (dist < 1.9 && e.slot !== 3 && !(e.ammo[wk] && e.ammo[wk].mag > 0)) this.switchSlot(e, 3);
      else if (e.slot === 3 && dist > 4 && (this.hasAmmo(e, 1) || this.hasAmmo(e, 2))) this.switchSlot(e, this.hasAmmo(e, 1) ? 1 : 2);
      wk = this.curW(e); w = W[wk];
      ai.strafeT -= dt; if (ai.strafeT <= 0) { ai.strafeT = rand(0.4, 1.1); const r = Math.random(); ai.strafeDir = r < 0.4 ? -1 : r < 0.8 ? 1 : 0; }
      let adv = 0; if (w.range <= 25 && dist > w.range * 0.7) adv = 1; if (dist < 3) adv = -0.5; if (w.melee) adv = dist > 1.2 ? 1 : 0;
      const sd = w.scope ? 0 : ai.strafeDir;
      const sp = 2.8 * w.speed * (e.boots ? 1.12 : 1) * water * (e.healT > 0 ? 0.6 : 1);
      mx = (-dz / dist * sd + dx / dist * adv) * sp; mz = (dx / dist * sd + dz / dist * adv) * sp;
      const ang = Math.abs(angDiff(e.yaw, want)); ai.burstPause -= dt;
      if (ai.seeT >= ai.react && ang < 0.2 && e.fireCd <= 0 && e.reloadT <= 0 && e.swapT <= 0 && ai.burstPause <= 0 && !(e.burstLeft > 0)) {
        if (w.melee) { if (dist <= W[e.melee || 'knife'].range) this.botMelee(e, tg); }
        else {
          const a = e.ammo[wk];
          if (a.mag <= 0) { if (!this.startReload(e) && e.slot === 1) this.switchSlot(e, 2); }
          else if (w.burst) { e.burstLeft = w.burst; e.burstTarget = tg; }
          else {
            this.botFire(e, tg, dist);
            if (w.auto) { ai.burst++; if (ai.burst >= ai.burstLen) { ai.burst = 0; ai.burstLen = 3 + ((Math.random() * 5) | 0); ai.burstPause = rand(0.12, 0.32) / D.acc; } }
            else e.fireCd += rand(0.08, 0.3) * (1.3 - D.acc * 0.5);
          }
        }
      }
    } else {
      ai.seeT = 0;
      const a = e.ammo[wk]; if (a && a.mag < magCap(e, wk) * 0.35) this.startReload(e);
      if (e.slot === 3) this.switchSlot(e, e.primary ? 1 : 2); else if (e.slot === 2 && e.primary && e.reloadT <= 0) this.switchSlot(e, 1);
      const hunting = ai.lastSeen && this.t - ai.lastSeenT < 6;
      let goal = null;
      if (hunting) { goal = ai.lastSeen; if (Math.hypot(goal.x - e.pos.x, goal.z - e.pos.z) < 1.5) { ai.lastSeen = null; goal = null; } }
      if (!goal) { if (!ai.goal || Math.hypot(ai.goal.x - e.pos.x, ai.goal.z - e.pos.z) < 1.6) ai.goal = this.nextGoal(e); goal = ai.goal; }
      ai.repathT -= dt;
      if (!ai.path || ai.repathT <= 0 || ai.pathGoal !== goal) { ai.path = findPath(wd, e.pos, goal); ai.pathGoal = goal; ai.repathT = rand(1.2, 2.2); if (!ai.path) { ai.goal = null; ai.lastSeen = null; } }
      if (ai.path) {
        while (ai.path.length && Math.hypot(ai.path[0].x - e.pos.x, ai.path[0].z - e.pos.z) < 0.55) ai.path.shift();
        if (ai.path.length) {
          const n = ai.path[0], dx = n.x - e.pos.x, dz = n.z - e.pos.z, d = Math.hypot(dx, dz) || 1;
          const sp = 5.2 * W[this.curW(e)].speed * (e.boots ? 1.12 : 1) * water * (hunting ? 0.85 : 1) * (e.healT > 0 ? 0.6 : 1);
          mx = dx / d * sp; mz = dz / d * sp; e.yaw = turnTo(e.yaw, Math.atan2(-dx, -dz), 6 * dt);
        } else if (goal === ai.goal) ai.goal = null;
      }
      ai.stuckT += dt;
      if (ai.stuckT > 1.2) { const moved = Math.hypot(e.pos.x - ai.lastX, e.pos.z - ai.lastZ); if (moved < 0.4 && (mx || mz)) { ai.path = null; ai.goal = null; ai.lastSeen = null; ai.route = []; } ai.stuckT = 0; ai.lastX = e.pos.x; ai.lastZ = e.pos.z; }
    }
    const k = 1 - Math.exp(-10 * dt); e.vel.x += (mx - e.vel.x) * k; e.vel.z += (mz - e.vel.z) * k;
    physics(wd, e, dt);
  }
  separateBots() {
    for (let i = 0; i < this.ents.length; i++) {
      const a = this.ents[i]; if (!a.alive) continue;
      for (let j = i + 1; j < this.ents.length; j++) {
        const b = this.ents[j]; if (!b.alive || (!a.bot && !b.bot)) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.72 && d > 1e-4) {
          const push = 0.72 - d, ux = dx / d, uz = dz / d;
          // humans own their position; only bots get pushed
          const wa = a.bot ? (b.bot ? 0.5 : 1) : 0, wb = b.bot ? (a.bot ? 0.5 : 1) : 0;
          a.pos.x -= ux * push * wa; a.pos.z -= uz * push * wa; b.pos.x += ux * push * wb; b.pos.z += uz * push * wb;
          if (a.bot) resolveWalls(this.world, a); if (b.bot) resolveWalls(this.world, b);
        }
      }
    }
  }

  /* ---------------- tick ---------------- */
  tick(dt, nowMs) {
    this.t += dt;
    for (const e of this.ents) {
      if (e.alive) {
        e.fireCd -= dt; e.swapT -= dt; e.spawnProt = Math.max(0, e.spawnProt - dt);
        this.healStep(e, dt);
        if (e.reloadT > 0) { e.reloadT -= dt; if (e.reloadT <= 0) { const a = e.ammo[e.reloadKey]; if (a) { const take = Math.min(magCap(e, e.reloadKey) - a.mag, a.reserve); a.mag += take; a.reserve -= take; } } }
        if (!e.bot && inBuyZone(e)) for (const k in e.ammo) e.ammo[k].reserve = W[k].reserve;
        if (e.bot) this.updateBot(e, dt);
      } else {
        e.respawnT -= dt;
        if (e.respawnT <= 0) this.spawn(e);
      }
    }
    this.separateBots();
    for (const e of this.ents) {
      e.hist.push({ ms: nowMs, x: e.pos.x, y: e.pos.y, z: e.pos.z });
      while (e.hist.length && nowMs - e.hist[0].ms > HISTORY_MS) e.hist.shift();
    }
  }
  snapshot() {
    return this.ents.map((e) => [e.id, r2(e.pos.x), r2(e.pos.y), r2(e.pos.z), Math.round(e.yaw * 1000) / 1000, Math.round(e.pitch * 1000) / 1000, this.curW(e), e.alive ? 1 : 0]);
  }
  scores() { return this.ents.map((e) => [e.id, e.kills, e.deaths]); }
}
