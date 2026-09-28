// Room + lobby management and state relay.
// v0.1: movement is reported by each client and relayed to the room at TICK_HZ.
// Combat, economy and movement validation move onto the server in the next stage.
import { TEAM_SIZE, MAPS, B, W } from '../shared/game-data.js';
import { TICK_HZ, MAX_NAME, MATCH_LENGTHS, ROOM_MAX } from '../shared/protocol.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MSG_PER_SEC = 90; // generous: state (20/s) + shots (up to ~18/s) + lobby clicks
let nextId = 1;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
function cleanName(n) {
  const s = String(n ?? '').replace(/[\u0000-\u001f<>&"']/g, '').trim().slice(0, MAX_NAME);
  return s || '玩家';
}
function vec(a) {
  if (!Array.isArray(a) || a.length !== 3) return null;
  const v = a.map(num);
  return v.includes(null) ? null : v.map((x) => Math.round(x * 100) / 100);
}

export class Rooms {
  constructor() {
    this.rooms = new Map();
    setInterval(() => this.tick(), 1000 / TICK_HZ);
  }

  connect(ws) {
    const c = { id: nextId++, ws, name: '玩家', room: null, team: 0, slot: 0, state: null, msgs: 0, msgWindow: Date.now() };
    ws.on('message', (buf) => {
      const now = Date.now();
      if (now - c.msgWindow > 1000) { c.msgWindow = now; c.msgs = 0; }
      if (++c.msgs > MSG_PER_SEC) return;
      let m;
      try { m = JSON.parse(buf); } catch { return; }
      if (m && typeof m.t === 'string') this.handle(c, m);
    });
    ws.on('close', () => this.leave(c));
    ws.on('error', () => {});
    this.send(c, { t: 'welcome', id: c.id });
  }

  send(c, m) { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(m)); }
  broadcast(room, m, except) {
    const s = JSON.stringify(m);
    for (const p of room.players.values()) if (p !== except && p.ws.readyState === 1) p.ws.send(s);
  }

  newCode() {
    for (;;) {
      let code = '';
      for (let i = 0; i < 4; i++) code += CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0];
      if (!this.rooms.has(code)) return code;
    }
  }

  handle(c, m) {
    const room = c.room;
    switch (m.t) {
      case 'create': {
        this.leave(c);
        c.name = cleanName(m.name);
        const r = { code: this.newCode(), host: c.id, players: new Map(), settings: { map: 'desert', len: 600 }, phase: 'lobby', endAt: 0 };
        this.rooms.set(r.code, r);
        this.join(c, r);
        break;
      }
      case 'join': {
        const r = this.rooms.get(String(m.code ?? '').toUpperCase().trim());
        if (!r) return this.send(c, { t: 'error', msg: '找不到這個房間代碼，請確認後再試一次' });
        if (r === room) return;
        if (r.phase !== 'lobby') return this.send(c, { t: 'error', msg: '這個房間正在對戰中，請等這局結束再加入' });
        if (r.players.size >= ROOM_MAX) return this.send(c, { t: 'error', msg: `房間已滿（${ROOM_MAX} 人）` });
        this.leave(c);
        c.name = cleanName(m.name);
        this.join(c, r);
        break;
      }
      case 'team': {
        if (!room || room.phase !== 'lobby') return;
        const t = m.team === 1 ? 1 : 0;
        if (t === c.team) return;
        if (this.count(room, t) >= TEAM_SIZE) return this.send(c, { t: 'error', msg: '那一隊已經滿了' });
        c.team = t;
        this.sendRoom(room);
        break;
      }
      case 'settings': {
        if (!room || room.phase !== 'lobby' || room.host !== c.id) return;
        if (typeof m.map === 'string' && MAPS[m.map]) room.settings.map = m.map;
        if (MATCH_LENGTHS.includes(m.len)) room.settings.len = m.len;
        this.sendRoom(room);
        break;
      }
      case 'start': {
        if (!room || room.phase !== 'lobby' || room.host !== c.id) return;
        this.start(room);
        break;
      }
      case 'state': {
        if (!room || room.phase !== 'play' || !Array.isArray(m.s) || m.s.length !== 7) return;
        const [x, y, z, yaw, pitch] = m.s.slice(0, 5).map(num);
        if ([x, y, z, yaw, pitch].includes(null)) return;
        const wk = W[m.s[5]] ? m.s[5] : 'p9';
        c.state = [
          +clamp(x, B.minX, B.maxX).toFixed(2), +clamp(y, 0, 3).toFixed(2), +clamp(z, B.minZ, B.maxZ).toFixed(2),
          +yaw.toFixed(3), +clamp(pitch, -1.6, 1.6).toFixed(3), wk, m.s[6] ? 1 : 0,
        ];
        break;
      }
      case 'shot': {
        if (!room || room.phase !== 'play') return;
        const o = vec(m.o);
        const e = Array.isArray(m.e) ? m.e.slice(0, 3).map(vec).filter(Boolean) : [];
        if (!o || !e.length) return;
        const look = typeof m.look === 'string' ? m.look.slice(0, 12) : 'rifle';
        this.broadcast(room, { t: 'shot', id: c.id, look, o, e }, c);
        break;
      }
      case 'leave':
        this.leave(c);
        break;
    }
  }

  count(room, team) { let n = 0; for (const p of room.players.values()) if (p.team === team) n++; return n; }

  join(c, room) {
    c.room = room;
    c.team = this.count(room, 0) <= this.count(room, 1) ? 0 : 1;
    c.state = null;
    room.players.set(c.id, c);
    this.sendRoom(room);
  }

  leave(c) {
    const room = c.room;
    if (!room) return;
    room.players.delete(c.id);
    c.room = null;
    c.state = null;
    if (!room.players.size) { this.rooms.delete(room.code); return; }
    if (room.host === c.id) room.host = room.players.keys().next().value;
    this.broadcast(room, { t: 'gone', id: c.id });
    this.sendRoom(room);
  }

  sendRoom(room) {
    const players = [...room.players.values()].map((p) => ({ id: p.id, name: p.name, team: p.team }));
    this.broadcast(room, { t: 'room', code: room.code, host: room.host, phase: room.phase, settings: room.settings, players, endAt: room.endAt });
  }

  start(room) {
    const now = Date.now();
    room.phase = 'play';
    room.endAt = now + room.settings.len * 1000;
    const slots = [0, 0];
    const players = [];
    for (const p of room.players.values()) {
      p.slot = slots[p.team]++;
      p.state = null;
      players.push({ id: p.id, name: p.name, team: p.team, slot: p.slot });
    }
    this.broadcast(room, { t: 'start', settings: room.settings, endAt: room.endAt, now, players });
    this.sendRoom(room);
  }

  tick() {
    const now = Date.now();
    for (const room of this.rooms.values()) {
      if (room.phase !== 'play') continue;
      if (now >= room.endAt) {
        room.phase = 'lobby';
        room.endAt = 0;
        this.broadcast(room, { t: 'end' });
        this.sendRoom(room);
        continue;
      }
      const p = [];
      for (const pl of room.players.values()) if (pl.state) p.push([pl.id, ...pl.state]);
      this.broadcast(room, { t: 'snap', now, p });
    }
  }
}
