// Network protocol shared by client and server.
// Every message is JSON: { t: <type>, ...fields }.
//
// client -> server
//   create   { name }                 create a room and join it
//   join     { name, code }           join a room by its 4-letter code
//   team     { team }                 switch team (0 = A, 1 = B), lobby only
//   settings { map, len }             host only, lobby only
//   start    {}                       host only, lobby only
//   state    { s:[x,y,z,yaw,pitch,weapon,alive] }   ~20 times per second while playing
//   shot     { look, o:[x,y,z], e:[[x,y,z],...] }   tracer relay (visual only in v0.1)
//   leave    {}
//
// server -> client
//   welcome  { id }
//   room     { code, host, phase, settings, players:[{id,name,team}], endAt }
//   start    { settings, endAt, now, players:[{id,name,team,slot}] }
//   snap     { now, p:[[id,x,y,z,yaw,pitch,weapon,alive],...] }
//   shot     { id, look, o, e }
//   gone     { id }
//   end      {}
//   error    { msg }
export const TICK_HZ = 20;
export const SEND_HZ = 20;
export const INTERP_MS = 100;
export const MAX_NAME = 12;
export const MATCH_LENGTHS = [180, 300, 600];
export const ROOM_MAX = 10;
