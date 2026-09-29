// Rooms, lobby and message routing. During a match the Match class is the authority.
import { TEAM_SIZE, MAPS, MAP_ORDER, B, W, DIFF, GEAR } from '../shared/game-data.js';
import { TICK_HZ, MAX_NAME, MATCH_LENGTHS, ROOM_MAX } from '../shared/protocol.js';
import { Match } from './match.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MSG_PER_SEC = 90; // state (20/s) + fire (up to ~18/s) + lobby clicks
let nextId = 1;

const log = (...a) => console.log(new Date().toLocaleTimeString('zh-TW', { hour12: false }), ...a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
function cleanName(n) {
  const s = String(n ?? '').replace(/[\u0000-\u001f<>&"']/g, '').trim().slice(0, MAX_NAME);
  return s || '玩家';
}
function vec(a) {
  if (!Array.isArray(a) || a.length !== 3) return null;
  const v = a.map(num);
  return v.includes(null) ? null : v;
}

export class Rooms {
  constructor() {
    this.rooms = new Map();
    this.lastTick = Date.now();
    setInterval(() => this.tick(), 1000 / TICK_HZ);
  }

  connect(ws, req) {
    const ip = (req && req.socket && req.socket.remoteAddress || '').replace('::ffff:', '');
    const c = { id: nextId++, ws, name: '玩家', room: null, team: 0, msgs: 0, msgWindow: Date.now() };
    ws.on('message', (buf) => {
      const now = Date.now();
      if (now - c.msgWindow > 1000) { c.msgWindow = now; c.msgs = 0; }
      if (++c.msgs > MSG_PER_SEC) return;
      let m;
      try { m = JSON.parse(buf); } catch { return; }
      if (m && typeof m.t === 'string') {
        try { this.handle(c, m); } catch (err) { console.error('message error', m.t, err); }
      }
    });
    ws.on('close', () => { if (c.room) log(`[${c.room.code}] ${c.name} 離線`); this.leave(c); });
    log(`玩家連線 #${c.id}（${ip || '未知位址'}）`);
    ws.on('error', () => {});
    this.send(c, { t: 'welcome', id: c.id });
  }

  send(c, m) { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(m)); }
  broadcast(room, m, exceptId) {
    const s = JSON.stringify(m);
    for (const p of room.players.values()) if (p.id !== exceptId && p.ws.readyState === 1) p.ws.send(s);
  }

  newCode() {
    for (;;) {
      let code = '';
      for (let i = 0; i < 4; i++) code += CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0];
      if (!this.rooms.has(code)) return code;
    }
  }

  count(room, team) { let n = 0; for (const p of room.players.values()) if (p.team === team) n++; return n; }
  // requested AI count, capped so real players always have a seat
  botsFor(room, team) { return clamp(room.bots[team], 0, TEAM_SIZE - this.count(room, team)); }

  handle(c, m) {
    const room = c.room;
    const isHost = room && room.host === c.id;
    const lobby = room && room.phase === 'lobby';
    const match = room && room.phase === 'play' ? room.match : null;
    const now = Date.now();
    switch (m.t) {
      case 'create': {
        this.leave(c);
        c.name = cleanName(m.name);
        const r = { code: this.newCode(), host: c.id, players: new Map(), settings: { map: 'desert', len: 180, diff: 'std' }, bots: [0, 0], phase: 'lobby', endAt: 0, match: null };
        this.rooms.set(r.code, r);
        log(`[${r.code}] ${c.name} 建立房間`);
        this.join(c, r);
        break;
      }
      case 'join': {
        const r = this.rooms.get(String(m.code ?? '').toUpperCase().trim());
        if (!r) { log(`#${c.id} 找不到房間 ${String(m.code ?? '').toUpperCase()}`); return this.send(c, { t: 'error', msg: '找不到這個房間代碼，請確認後再試一次' }); }
        if (r === room) return;
        if (r.phase !== 'lobby') return this.send(c, { t: 'error', msg: '這個房間正在對戰中，請等這局結束再加入' });
        if (r.players.size >= ROOM_MAX) return this.send(c, { t: 'error', msg: `房間已滿（${ROOM_MAX} 人）` });
        this.leave(c);
        c.name = cleanName(m.name);
        log(`[${r.code}] ${c.name} 加入房間`);
        this.join(c, r);
        break;
      }
      case 'team': {
        if (!lobby) return;
        const t = m.team === 1 ? 1 : 0;
        if (t === c.team) return;
        if (this.count(room, t) >= TEAM_SIZE) return this.send(c, { t: 'error', msg: '那一隊的真人玩家已經滿了' });
        c.team = t;
        this.sendRoom(room);
        break;
      }
      case 'settings': {
        if (!lobby || !isHost) return;
        // the map decides the match length (small 3 min, standard 5 min, large 10 min); 'random' rolls it at start
        if (typeof m.map === 'string' && (MAPS[m.map] || m.map === 'random')) { room.settings.map = m.map; room.settings.len = MAPS[m.map] ? MAPS[m.map].len : 0; }
        if (typeof m.diff === 'string' && DIFF[m.diff]) room.settings.diff = m.diff;
        this.sendRoom(room);
        break;
      }
      case 'bots': {
        if (!lobby || !isHost) return;
        if (m.fill) room.bots = [TEAM_SIZE, TEAM_SIZE];
        else if (m.clear) room.bots = [0, 0];
        else if (m.team === 0 || m.team === 1) {
          const cur = this.botsFor(room, m.team);
          room.bots[m.team] = clamp(cur + (m.delta > 0 ? 1 : -1), 0, TEAM_SIZE);
        }
        this.sendRoom(room);
        break;
      }
      case 'start': {
        if (!lobby || !isHost) return;
        this.start(room);
        break;
      }
      case 'state': {
        if (!match || !Array.isArray(m.s) || m.s.length !== 7) return;
        const [x, y, z, yaw, pitch] = m.s.slice(0, 5).map(num);
        if ([x, y, z, yaw, pitch].includes(null)) return;
        const wk = W[m.s[5]] ? m.s[5] : 'p9';
        const bb = match.world.B;
        match.humanState(c.id, [clamp(x, bb.minX, bb.maxX), clamp(y, 0, 3), clamp(z, bb.minZ, bb.maxZ), yaw, clamp(pitch, -1.6, 1.6), wk], now);
        break;
      }
      case 'fire': {
        if (!match || typeof m.wk !== 'string' || !W[m.wk]) return;
        const o = vec(m.o);
        const d = Array.isArray(m.d) ? m.d.slice(0, 8).map(vec).filter(Boolean) : [];
        if (!o || !d.length) return;
        match.humanFire(c.id, { wk: m.wk, o, d, ts: num(m.ts) }, now);
        break;
      }
      case 'melee': {
        if (!match) return;
        const kind = m.kind === 'dash' || m.kind === 'heavy' ? m.kind : 'swing';
        match.humanMelee(c.id, { ts: num(m.ts), kind, charge: num(m.charge) ?? 0, yaw: num(m.yaw) }, now);
        break;
      }
      case 'reload': { if (match && typeof m.wk === 'string') match.humanReload(c.id, m.wk); break; }
      case 'heal': { if (match) match.humanHeal(c.id); break; }
      case 'buy': { if (match && typeof m.key === 'string' && (W[m.key] || GEAR[m.key])) match.humanBuy(c.id, m.key); break; }
      case 'leave':
        this.leave(c);
        break;
    }
  }

  join(c, room) {
    c.room = room;
    c.team = this.count(room, 0) <= this.count(room, 1) ? 0 : 1;
    if (this.count(room, c.team) >= TEAM_SIZE) c.team = 1 - c.team;
    room.players.set(c.id, c);
    this.sendRoom(room);
  }

  leave(c) {
    const room = c.room;
    if (!room) return;
    room.players.delete(c.id);
    c.room = null;
    if (room.match) room.match.remove(c.id);
    if (!room.players.size) { this.rooms.delete(room.code); return; }
    if (room.host === c.id) room.host = room.players.keys().next().value;
    this.broadcast(room, { t: 'gone', id: c.id });
    this.sendRoom(room);
  }

  sendRoom(room) {
    const players = [...room.players.values()].map((p) => ({ id: p.id, name: p.name, team: p.team }));
    this.broadcast(room, {
      t: 'room', code: room.code, host: room.host, phase: room.phase, settings: room.settings,
      bots: [this.botsFor(room, 0), this.botsFor(room, 1)], players, endAt: room.endAt,
    });
  }

  start(room) {
    const now = Date.now();
    const humans = [...room.players.values()].map((p) => ({ id: p.id, name: p.name, team: p.team }));
    const emit = (type, payload, to, except) => {
      const msg = { t: type, ...payload };
      if (to !== undefined) { const p = room.players.get(to); if (p) this.send(p, msg); }
      else this.broadcast(room, msg, except);
    };
    // 'random' is kept in the lobby settings and rolled again every match
    const random = room.settings.map === 'random';
    const mapId = random ? MAP_ORDER[(Math.random() * MAP_ORDER.length) | 0] : room.settings.map;
    const len = MAPS[mapId].len;
    room.match = new Match({ mapId, len, diff: room.settings.diff, humans, bots: [this.botsFor(room, 0), this.botsFor(room, 1)] }, emit);
    log(`[${room.code}] 開始對戰：${mapId}，${room.players.size} 位玩家 + ${this.botsFor(room, 0) + this.botsFor(room, 1)} 個 AI`);
    room.phase = 'play';
    room.endAt = now + len * 1000;
    this.broadcast(room, { t: 'start', settings: { ...room.settings, map: mapId, len }, random, endAt: room.endAt, now, players: room.match.roster() });
    room.match.begin();
    this.sendRoom(room);
  }

  tick() {
    const now = Date.now();
    const dt = Math.min(0.1, (now - this.lastTick) / 1000);
    this.lastTick = now;
    for (const room of this.rooms.values()) {
      if (room.phase !== 'play' || !room.match) continue;
      if (now >= room.endAt) {
        log(`[${room.code}] 對戰結束 ${room.match.teamKills[0]} : ${room.match.teamKills[1]}`);
        room.phase = 'lobby';
        room.endAt = 0;
        this.broadcast(room, { t: 'end', tk: room.match.teamKills, sc: room.match.scores() });
        room.match = null;
        this.sendRoom(room);
        continue;
      }
      try { room.match.tick(dt, now); } catch (err) { console.error('match tick error', err); }
      this.broadcast(room, { t: 'snap', now, p: room.match.snapshot() });
    }
  }
}
