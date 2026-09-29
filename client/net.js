// Thin WebSocket client. Keeps a smoothed estimate of the server clock for interpolation.
export class Net {
  constructor() { this.ws = null; this.id = 0; this.handlers = {}; this.offset = null; }
  get ready() { return !!this.ws && this.ws.readyState === 1 && this.id > 0; }
  connect() {
    return new Promise((resolve, reject) => {
      if (location.protocol === 'file:') { reject(new Error('請用 npm start 啟動伺服器後，從 http://localhost:3000 開啟遊戲')); return; }
      const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
      this.ws = ws;
      let opened = false;
      // a firewall that silently drops packets would otherwise leave "connecting…" on screen for a long time
      const timer = setTimeout(() => { if (!opened) { ws.close(); reject(new Error('連線逾時：8 秒內連不上遊戲伺服器。請確認伺服器視窗還開著、網址正確，且防火牆已允許 Node.js。')); } }, 8000);
      ws.onmessage = (ev) => {
        let m;
        try { m = JSON.parse(ev.data); } catch { return; }
        if (m.t === 'welcome') { this.id = m.id; opened = true; clearTimeout(timer); resolve(); }
        if (typeof m.now === 'number') {
          const off = m.now - performance.now();
          this.offset = this.offset === null ? off : this.offset + (off - this.offset) * 0.05;
        }
        (this.handlers[m.t] || []).forEach((f) => f(m));
      };
      ws.onerror = () => { if (!opened) { clearTimeout(timer); reject(new Error('連不上遊戲伺服器，請確認伺服器視窗還開著、網址正確。')); } };
      ws.onclose = () => { this.id = 0; (this.handlers.close || []).forEach((f) => f()); };
    });
  }
  on(t, f) { (this.handlers[t] || (this.handlers[t] = [])).push(f); }
  send(t, data) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ t, ...data })); }
  serverNow() { return performance.now() + (this.offset || 0); }
  close() { if (this.ws) this.ws.close(); }
}
