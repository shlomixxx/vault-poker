let _ctx = null;

function ctx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

export function playDeal() {
  try {
    const c = ctx(), t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(1400, t);
    o.frequency.exponentialRampToValueAtTime(700, t + 0.04);
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    o.start(t); o.stop(t + 0.07);
  } catch {}
}

export function playChip() {
  try {
    const c = ctx(), t = c.currentTime;
    const len = Math.floor(c.sampleRate * 0.07);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.18));
    }
    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = buf; g.gain.value = 0.22;
    src.connect(g); g.connect(c.destination);
    src.start(t);
  } catch {}
}

export function playWin() {
  try {
    const c = ctx(), t = c.currentTime;
    [[440, 0], [554, 0.12], [659, 0.24], [880, 0.36]].forEach(([freq, d]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0, t + d);
      g.gain.linearRampToValueAtTime(0.16, t + d + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.38);
      o.start(t + d); o.stop(t + d + 0.39);
    });
  } catch {}
}
