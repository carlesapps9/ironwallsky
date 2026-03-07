/**
 * generate-icons.mjs — TD-002 / TD-003
 * Creates assets-src/icons/icon-1024.png (1024x1024)
 *          assets-src/icons/splash-2732.png (2732x2732)
 * Node.js built-ins only (fs, zlib). No extra npm packages.
 * Design: #1a1a2e navy bg, #48c7e8 sky-blue shield, white highlights.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { deflateSync } from 'zlib';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'assets-src', 'icons');
mkdirSync(OUT_DIR, { recursive: true });

// ── Colours (R,G,B) ──────────────────────────────────────────────────────────
const [BG_R,BG_G,BG_B] = [26,26,46];
const [AC_R,AC_G,AC_B] = [72,199,232];
const [WH_R,WH_G,WH_B] = [255,255,255];

// ── CRC-32 (ISO 3309) ────────────────────────────────────────────────────────
const CRC_T = (() => {
  const t = new Uint32Array(256);
  for (let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xEDB88320^(c>>>1):c>>>1;t[n]=c;}
  return t;
})();
function crc32(buf){let c=0xFFFFFFFF;for(const b of buf)c=CRC_T[(c^b)&0xFF]^(c>>>8);return(c^0xFFFFFFFF)>>>0;}

// ── PNG helpers ──────────────────────────────────────────────────────────────
const SIG = Buffer.from([137,80,78,71,13,10,26,10]);
function chunk(type,data){
  const t=Buffer.from(type,'ascii'),l=Buffer.alloc(4),c=Buffer.alloc(4);
  l.writeUInt32BE(data.length);c.writeUInt32BE(crc32(Buffer.concat([t,data])));
  return Buffer.concat([l,t,data,c]);
}
function IHDR(w,h){const b=Buffer.alloc(13);b.writeUInt32BE(w,0);b.writeUInt32BE(h,4);b[8]=8;b[9]=2;return chunk('IHDR',b);}
function IDAT(rgb,w,h){
  const raw=Buffer.alloc(h*(1+w*3));
  for(let y=0;y<h;y++){raw[y*(1+w*3)]=0;rgb.copy(raw,y*(1+w*3)+1,y*w*3,(y+1)*w*3);}
  return chunk('IDAT',deflateSync(raw,{level:6}));
}
function IEND(){return chunk('IEND',Buffer.alloc(0));}
function savePNG(path,rgb,w,h){
  writeFileSync(path,Buffer.concat([SIG,IHDR(w,h),IDAT(rgb,w,h),IEND()]));
  console.log(`v ${path}  (${w}x${h})`);
}

// ── Drawing on Buffer(w*h*3) ─────────────────────────────────────────────────
function px(buf,W,x,y,r,g,b){if(x<0||x>=W||y<0||y>=W)return;const i=(y*W+x)*3;buf[i]=r;buf[i+1]=g;buf[i+2]=b;}
function hline(buf,W,x0,x1,y,r,g,b){for(let x=Math.max(0,x0);x<=Math.min(W-1,x1);x++)px(buf,W,x,y,r,g,b);}
function fillRect(buf,W,x0,y0,x1,y1,r,g,b){for(let y=Math.max(0,y0);y<=Math.min(W-1,y1);y++)hline(buf,W,x0,x1,y,r,g,b);}
function fillAll(buf,W,H,r,g,b){fillRect(buf,W,0,0,W-1,H-1,r,g,b);}

// Shield: flat top, tapered point at bottom. (cx,top) = top-centre, hw = half-width, sh = total height
function shield(buf,W,cx,top,hw,sh,r,g,b){
  const mid=top+Math.round(sh*0.6),bot=top+sh;
  for(let y=top;y<=mid;y++)hline(buf,W,cx-hw,cx+hw,y,r,g,b);
  for(let y=mid+1;y<=bot;y++){const hw2=Math.round(hw*(1-(y-mid)/(bot-mid)));hline(buf,W,cx-hw2,cx+hw2,y,r,g,b);}
}

// Three horizontal "wall" bars
function wallBars(buf,W,cx,cy,bw,bh,gap,r,g,b){
  for(const dy of [-bh-gap,-(bh>>1),gap])fillRect(buf,W,cx-(bw>>1),cy+dy,cx+(bw>>1),cy+dy+bh,r,g,b);
}

// Diagonal projectile slash
function slash(buf,W,cx,cy,len,thick,r,g,b){
  for(let i=-len;i<=len;i++)for(let t=-thick;t<=thick;t++)px(buf,W,Math.round(cx+i+t),Math.round(cy-i),r,g,b);
}

// ── Render helper ────────────────────────────────────────────────────────────
function render(W,s){
  const buf=Buffer.alloc(W*W*3);
  fillAll(buf,W,W,BG_R,BG_G,BG_B);
  const cx=W>>1,top=Math.round(W*0.08);
  const hw=Math.round(330*s),sh=Math.round(720*s);
  shield(buf,W,cx,top,hw,sh,AC_R,AC_G,AC_B);
  shield(buf,W,cx,top,hw-Math.round(48*s),sh-Math.round(65*s),WH_R,WH_G,WH_B);
  shield(buf,W,cx,top,hw-Math.round(90*s),sh-Math.round(120*s),BG_R,BG_G,BG_B);
  const barCy=Math.round(W*0.52);
  wallBars(buf,W,cx,barCy,Math.round(420*s),Math.round(52*s),Math.round(34*s),AC_R,AC_G,AC_B);
  slash(buf,W,cx,barCy-Math.round(190*s),Math.round(85*s),Math.round(7*s),WH_R,WH_G,WH_B);
  return buf;
}

// ── Generate ─────────────────────────────────────────────────────────────────
savePNG(join(OUT_DIR,'icon-1024.png'),   render(1024,1),    1024, 1024);
savePNG(join(OUT_DIR,'splash-2732.png'), render(2732,2.25), 2732, 2732);
console.log('Done.');
