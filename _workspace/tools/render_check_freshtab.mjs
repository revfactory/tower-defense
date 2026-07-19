// 새 CDP 탭을 내 게임(8901)으로 열어 렌더 — 확실히 새 알파컷 타일 사용.
import { writeFileSync } from 'node:fs';
const GAME = 'http://127.0.0.1:8901/';
const WSDIR = '/Users/robin/Downloads/tower-defense/_workspace';

const ver = await (await fetch('http://localhost:9222/json/version')).json();
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}, sessionId) => new Promise((res) => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params, sessionId })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const { result: { targetId } } = await send('Target.createTarget', { url: GAME });
const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
const evalp = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId); if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails)); return r.result?.result?.value; };

await send('Runtime.enable', {}, sessionId);
await send('Network.enable', {}, sessionId);
await send('Network.setCacheDisabled', { cacheDisabled: true }, sessionId);
console.log('탭 생성:', GAME, '— 부팅·에셋 로드 대기');

let ready = false;
for (let i = 0; i < 50; i++) {
  await sleep(500);
  try { ready = await evalp(`(async()=>{try{const a=await import('/src/core/assets.js');const im=a.get('tile_path_h');return !!(im&&im.tagName==='IMG'&&im.naturalWidth>0&&im.complete);}catch(e){return false;}})()`); } catch { ready = false; }
  if (ready) { console.log(`에셋 준비 (${(i + 1) * 0.5}s)`); break; }
}
if (!ready) { console.error('타임아웃'); await send('Target.closeTarget', { targetId }); process.exit(1); }

const alphaProbe = await evalp(`(async()=>{const a=await import('/src/core/assets.js');const im=a.get('tile_path_h');const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const x=c.getContext('2d');x.drawImage(im,0,0);const d=x.getImageData(0,0,c.width,c.height).data;let t=0;for(let i=3;i<d.length;i+=4)if(d[i]<20)t++;return Math.round(100*t/(c.width*c.height));})()`);
console.log(`tile_path_h 투명(알파<20): ${alphaProbe}%  (알파컷 반영이면 ~30%, stale/미반영이면 0%)`);

const harness = `(async () => {
  const grid = await import('/src/map/grid.js');
  const tm = await import('/src/map/tilemap.js');
  const lv = await import('/src/data/levels.js');
  const out = [];
  for (const level of lv.LEVELS) {
    tm.buildBackground(level);
    const c = document.createElement('canvas');
    c.width = grid.COLS * grid.TILE_SIZE; c.height = grid.ROWS * grid.TILE_SIZE;
    tm.drawBackground(c.getContext('2d'));
    out.push({ name: level.nameKo || level.name, url: c.toDataURL('image/png') });
  }
  return JSON.stringify(out);
})()`;
const data = JSON.parse(await evalp(harness));
data.forEach((L, i) => { writeFileSync(`${WSDIR}/03_render_stage${i + 1}.png`, Buffer.from(L.url.replace(/^data:image\/png;base64,/, ''), 'base64')); console.log(`stage${i + 1} "${L.name}" 저장`); });
await send('Target.closeTarget', { targetId });
ws.close();
