// Network protocol shared by client and server.
// Every message is JSON: { t: <type>, ...fields }.
// The server is authoritative for hits, damage, kills, money, purchases and respawns.
// Clients report their own movement (validated for speed and walls) and their shots.
//
// client -> server
//   create   { name }                          create a room and join it
//   join     { name, code }                    join a room by its 4-letter code
//   team     { team }                          switch team (0 = A, 1 = B), lobby only
//   settings { map?, len?, diff? }             host only, lobby only; map may be 'random'
//   bots     { team, delta } | {fill} | {clear} host only: AI seats per team
//   start    {}                                host only, lobby only
//   state    { s:[x,y,z,yaw,pitch,weapon,alive] }        ~20/s while playing
//   fire     { wk, ts, o:[x,y,z], d:[[dx,dy,dz],...] }   one entry per pellet; ts = server time the shooter was seeing
//   melee    { ts, kind:'swing'|'heavy'|'dash', charge?, yaw? }  heavy = axe charge (s), dash = katana
//   reload   { wk }
//   buy      { key }
//   heal     {}                       use the field medkit (server checks ownership and HP)
//   leave    {}
//
// server -> client
//   welcome  { id }
//   room     { code, host, phase, settings, bots:[a,b], players:[{id,name,team}], endAt }
//   start    { settings, random, endAt, now, players:[{id,name,team,bot}] }  settings.map is the rolled map
//   snap     { now, p:[[id,x,y,z,yaw,pitch,weapon,alive],...] }  includes bots
//   shot     { id, look, o, e:[[x,y,z],...] }  tracer for everyone except the shooter
//   hit      { kill, hs }                  to the shooter: the server confirmed a hit
//   hurt     { x, z, hp }                  to the victim
//   kill     { k, v, wk, hs, tk:[a,b], kk, vd, reward, streak }
//   spawn    { x, y, z, yaw }              to the player who (re)spawns
//   you      { hp, money, armor, boots, gloves, medkit, healT, primary, secondary, kills, deaths }  private state
//   bought   { key }
//   gone     { id }
//   end      { tk, sc:[[id,kills,deaths],...] }
//   error    { msg }
export const TICK_HZ = 20;
export const SEND_HZ = 20;
export const INTERP_MS = 100;
export const MAX_NAME = 12;
export const MATCH_LENGTHS = [180, 300, 600];
export const ROOM_MAX = 10;
