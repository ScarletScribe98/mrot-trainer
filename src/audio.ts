let context: AudioContext | undefined;
let musicNodes: OscillatorNode[] = [];
let musicGain: GainNode | undefined;
function audio() { context ??= new AudioContext(); if (context.state === 'suspended') void context.resume().catch(() => {}); return context; }
export function effect(type: 'click' | 'paper' | 'stamp', enabled: boolean) {
  if (!enabled) return;
  try { const ctx = audio(), osc = ctx.createOscillator(), gain = ctx.createGain(), now = ctx.currentTime;
    osc.type = type === 'stamp' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(type === 'stamp' ? 125 : type === 'paper' ? 480 : 720, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.10);
    gain.gain.setValueAtTime(type === 'stamp' ? 0.065 : 0.025, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain).connect(ctx.destination); osc.start(now); osc.stop(now + 0.14);
  } catch { /* Optional audio device. */ }
}
export function setMusic(enabled: boolean) {
  if (!enabled) { musicNodes.forEach(node => node.stop()); musicNodes = []; musicGain?.disconnect(); musicGain = undefined; return; }
  if (musicNodes.length) return;
  try { const ctx = audio(); musicGain = ctx.createGain(); musicGain.gain.value = 0.008; musicGain.connect(ctx.destination);
    musicNodes = [130.81, 196, 261.63].map((frequency) => { const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = frequency; osc.connect(musicGain!); osc.start(); return osc; });
  } catch { /* User gesture may be unavailable. */ }
}
