/**
 * generate-store-assets.mjs — TH-003 prep
 * Produces:
 *   assets-src/icons/icon-512-playstore.png   (512x512  — Play Store app icon)
 *   assets-src/icons/feature-1024x500.png     (1024x500 — Play Store feature graphic)
 * Node.js built-ins only.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { deflateSync } from 'zlib';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'assets-src', 'icons');
mkdirSync(OUT_DIR, { recursive: true });

// Colours
const [BG_R,BG_G,BG_B] = [26,26,46];
const [AC_R,AC_G,AC_B] = [72,199,232];
const [WH_R,WH_G,WH_B] = [255,255,255];
const [DK_R,DK_G,DK_B] = [12,12,30];   // darker navy for feature bg gradient

// CRC-32
const CRC_T = (() => {
  const t = new Uint32Array(256);
  for (let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xEDB88320^(c>>>1):c>>>1;t[n]=c;}
  return t;
})();
function crc32(buf){let c=0xFFFFFFFF;for(const b of buf)c=CRC_T[(c^b)&0xFF]^(c>>>8);return(c^0xFFFFFFFF)>>>0;}

// PNG helpers
const SIG = Buffer.from([137,80,78,71,13,10,26,10]);
function chunk(type,data){const t=Buffer.from(type,'ascii'),l=Buffer.alloc(4),c=Buffer.alloc(4);l.writeUInt32BE(data.length);c.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([l,t,data,c]);}
function IHDR(w,h){const b=Buffer.alloc(13);b.writeUInt32BE(w,0);b.writeUInt32BE(h,4);b[8]=8;b[9]=2;return chunk('IHDR',b);}
function IDAT(rgb,w,h){const raw=Buffer.alloc(h*(1+w*3));for(let y=0;y<h;y++){raw[y*(1+w*3)]=0;rgb.copy(raw,y*(1+w*3)+1,y*w*3,(y+1)*w*3);}return chunk('IDAT',deflateSync(raw,{level:6}));}
function IEND(){return chunk('IEND',Buffer.alloc(0));}
function savePNG(path,rgb,w,h){writeFileSync(path,Buffer.concat([SIG,IHDR(w,h),IDAT(rgb,w,h),IEND()]));console.log(`v ${path}  (${w}x${h})`);}

// Drawing
function px(buf,W,x,y,r,g,b){if(x<0||x>=W||y<0||y>=W)return;const i=(y*W+x)*3;buf[i]=r;buf[i+1]=g;buf[i+2]=b;}
function hline(buf,W,x0,x1,y,r,g,b){for(let x=Math.max(0,Math.round(x0));x<=Math.min(W-1,Math.round(x1));x++)px(buf,W,x,y,r,g,b);}
function fillRect(buf,W,H,x0,y0,x1,y1,r,g,b){for(let y=Math.max(0,y0);y<=Math.min(H-1,y1);y++)hline(buf,W,x0,x1,y,r,g,b);}
function shield(buf,W,H,cx,top,hw,sh,r,g,b){const mid=top+Math.round(sh*0.6),bot=top+sh;for(let y=top;y<=mid;y++)hline(buf,W,cx-hw,cx+hw,y,r,g,b);for(let y=mid+1;y<=bot;y++){const hw2=hw*(1-(y-mid)/(bot-mid));hline(buf,W,cx-hw2,cx+hw2,y,r,g,b);}}
function wallBars(buf,W,H,cx,cy,bw,bh,gap,r,g,b){for(const dy of [-bh-gap,-(bh>>1),gap])fillRect(buf,W,H,cx-(bw>>1),cy+dy,cx+(bw>>1),cy+dy+bh,r,g,b);}
function slash(buf,W,H,cx,cy,len,thick,r,g,b){for(let i=-len;i<=len;i++)for(let t=-thick;t<=thick;t++)px(buf,W,Math.round(cx+i+t),Math.round(cy-i),r,g,b);}

function renderSquare(W, s) {
  const rgb = Buffer.alloc(W*W*3);
  fillRect(rgb,W,W,0,0,W-1,W-1,BG_R,BG_G,BG_B);
  const cx=W>>1, top=Math.round(W*0.08), hw=Math.round(330*s), sh=Math.round(720*s);
  shield(rgb,W,W,cx,top,hw,sh,AC_R,AC_G,AC_B);
  shield(rgb,W,W,cx,top,hw-Math.round(48*s),sh-Math.round(65*s),WH_R,WH_G,WH_B);
  shield(rgb,W,W,cx,top,hw-Math.round(90*s),sh-Math.round(120*s),BG_R,BG_G,BG_B);
  const barCy=Math.round(W*0.52);
  wallBars(rgb,W,W,cx,barCy,Math.round(420*s),Math.round(52*s),Math.round(34*s),AC_R,AC_G,AC_B);
  slash(rgb,W,W,cx,barCy-Math.round(190*s),Math.round(85*s),Math.round(7*s),WH_R,WH_G,WH_B);
  return rgb;
}

function renderFeature(W, H) {
  const rgb = Buffer.alloc(W*H*3);
  // Background: dark navy
  for (let y=0;y<H;y++) for (let x=0;x<W;x++) {
    // subtle left-to-right gradient: DK → BG
    const t = x/W;
    const i=(y*W+x)*3;
    rgb[i]  =Math.round(DK_R+(BG_R-DK_R)*t);
    rgb[i+1]=Math.round(DK_G+(BG_G-DK_G)*t);
    rgb[i+2]=Math.round(DK_B+(BG_B-DK_B)*t);
  }

  // Shield centred, scaled to fit height
  const s = H/1024 * 0.85;
  const cx = Math.round(W*0.36), top=Math.round(H*0.06);
  const hw=Math.round(330*s), sh=Math.round(720*s);

  // Custom shield for rectangular canvas — uses W,H-aware draw
  function shieldF(cx,top,hw,sh,r,g,b){const mid=top+Math.round(sh*0.6),bot=top+sh;for(let y=top;y<=mid;y++)hline(rgb,W,cx-hw,cx+hw,y,r,g,b);for(let y=mid+1;y<=bot;y++){const hw2=hw*(1-(y-mid)/(bot-mid));hline(rgb,W,cx-hw2,cx+hw2,y,r,g,b);}}
  shieldF(cx,top,hw,sh,AC_R,AC_G,AC_B);
  shieldF(cx,top,hw-Math.round(48*s),sh-Math.round(65*s),WH_R,WH_G,WH_B);
  shieldF(cx,top,hw-Math.round(90*s),sh-Math.round(120*s),DK_R,DK_G,DK_B);
  const barCy=Math.round(H*0.52);
  wallBars(rgb,W,H,cx,barCy,Math.round(420*s),Math.round(52*s),Math.round(34*s),AC_R,AC_G,AC_B);
  slash(rgb,W,H,cx,barCy-Math.round(190*s),Math.round(85*s),Math.round(7*s),WH_R,WH_G,WH_B);

  // Right side: game title bars (text placeholder — three accent bars stacked)
  const tx = Math.round(W*0.60), titleY = Math.round(H*0.30);
  const barW=[380,260,310], barHt=28, gap=18;
  for(let i=0;i<barW.length;i++) fillRect(rgb,W,H,tx,titleY+i*(barHt+gap),tx+barW[i],titleY+i*(barHt+gap)+barHt,AC_R,AC_G,AC_B);
  // Subtitle bar (white, narrower)
  fillRect(rgb,W,H,tx,titleY+3*(barHt+gap)+10,tx+180,titleY+3*(barHt+gap)+10+18,WH_R,WH_G,WH_B);

  return rgb;
}

// Generate
savePNG(join(OUT_DIR,'icon-512-playstore.png'), renderSquare(512,0.5), 512, 512);

{
  const W=1024,H=500;
  const rgb = renderFeature(W,H);
  writeFileSync(join(OUT_DIR,'feature-1024x500.png'),Buffer.concat([SIG,IHDR(W,H),IDAT(rgb,W,H),IEND()]));
  console.log(`v ${join(OUT_DIR,'feature-1024x500.png')}  (${W}x${H})`);
}

console.log('Done. Upload these to Play Console for TH-003.');
