/**
 * generate-icon.mjs — Iron Wall Sky · Play Store icon (512×512)
 *
 * Design: Glowing cyan energy shield with gold lightning bolt on deep space background.
 * Uses only Node.js built-ins (zlib, fs). No canvas, no sharp, no external deps.
 *
 * Run:  node scripts/generate-icon.mjs
 * Out:  assets-src/icons/icon-512-playstore.png
 */

import { writeFileSync, mkdirSync } from 'fs';
import { deflateSync } from 'zlib';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = join(__dirname, '..', 'assets-src', 'icons');
mkdirSync(OUT_DIR, { recursive: true });

const W = 512, H = 512;

// ─── PNG encode ───────────────────────────────────────────────────────────────
const SIG = Buffer.from([137,80,78,71,13,10,26,10]);
const CRC_T = (() => {
  const t = new Uint32Array(256);
  for (let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xEDB88320^(c>>>1):c>>>1;t[n]=c;}
  return t;
})();
function crc32(buf){let c=0xFFFFFFFF;for(const b of buf)c=CRC_T[(c^b)&0xFF]^(c>>>8);return(c^0xFFFFFFFF)>>>0;}
function chunk(type,data){
  const t=Buffer.from(type,'ascii'),l=Buffer.alloc(4),crc=Buffer.alloc(4);
  l.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([t,data])));
  return Buffer.concat([l,t,data,crc]);
}
function encodeIHDR(w,h){const b=Buffer.alloc(13);b.writeUInt32BE(w,0);b.writeUInt32BE(h,4);b[8]=8;b[9]=2;return chunk('IHDR',b);}
function encodeIDAT(rgb,w,h){
  const raw=Buffer.alloc(h*(1+w*3));
  for(let y=0;y<h;y++){raw[y*(1+w*3)]=0;rgb.copy(raw,y*(1+w*3)+1,y*w*3,(y+1)*w*3);}
  return chunk('IDAT',deflateSync(raw,{level:6}));
}
function savePNG(path){
  writeFileSync(path,Buffer.concat([SIG,encodeIHDR(W,H),encodeIDAT(rgb,W,H),chunk('IEND',Buffer.alloc(0))]));
  console.log(`✓  ${path}  (${W}×${H})`);
}

// ─── Pixel buffer ─────────────────────────────────────────────────────────────
const rgb = Buffer.alloc(W * H * 3);

function clamp(v){ return Math.max(0,Math.min(255,Math.round(v))); }

function setpx(x,y,r,g,b){
  if(x<0||x>=W||y<0||y>=H)return;
  const i=(y*W+x)*3;
  rgb[i]=clamp(r); rgb[i+1]=clamp(g); rgb[i+2]=clamp(b);
}

// Alpha-blend (r,g,b) over current pixel with weight t ∈ [0,1]
function blend(x,y,r,g,b,t){
  if(x<0||x>=W||y<0||y>=H||t<=0)return;
  t=Math.min(1,t);
  const i=(y*W+x)*3;
  rgb[i]  =clamp(rgb[i]  *(1-t)+r*t);
  rgb[i+1]=clamp(rgb[i+1]*(1-t)+g*t);
  rgb[i+2]=clamp(rgb[i+2]*(1-t)+b*t);
}

// Screen-blend (r,g,b) — good for additive glow
function screen(x,y,r,g,b,t){
  if(x<0||x>=W||y<0||y>=H||t<=0)return;
  t=Math.min(1,t);
  const i=(y*W+x)*3;
  const sr=255-(255-rgb[i]  )*(255-r*t)/255;
  const sg=255-(255-rgb[i+1])*(255-g*t)/255;
  const sb=255-(255-rgb[i+2])*(255-b*t)/255;
  rgb[i]=clamp(sr); rgb[i+1]=clamp(sg); rgb[i+2]=clamp(sb);
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────
function distSeg(px,py,x1,y1,x2,y2){
  const dx=x2-x1,dy=y2-y1,lenSq=dx*dx+dy*dy;
  if(lenSq===0)return Math.hypot(px-x1,py-y1);
  const t=Math.max(0,Math.min(1,((px-x1)*dx+(py-y1)*dy)/lenSq));
  return Math.hypot(px-(x1+t*dx),py-(y1+t*dy));
}

// ─── Shield geometry ──────────────────────────────────────────────────────────
const CX=256, CY=256;
const SH_TOP=60, SH_HW=170, SH_MID=318, SH_BOT=456;

function inShield(x,y){
  if(y<SH_TOP||y>SH_BOT)return false;
  if(y<=SH_MID)return Math.abs(x-CX)<=SH_HW;
  return Math.abs(x-CX)<=SH_HW*(1-(y-SH_MID)/(SH_BOT-SH_MID));
}

// Distance to the shield outline (5 segments)
function distShield(px,py){
  const d1=distSeg(px,py, CX-SH_HW,SH_TOP, CX+SH_HW,SH_TOP);  // top
  const d2=distSeg(px,py, CX-SH_HW,SH_TOP, CX-SH_HW,SH_MID);  // left rect
  const d3=distSeg(px,py, CX+SH_HW,SH_TOP, CX+SH_HW,SH_MID);  // right rect
  const d4=distSeg(px,py, CX-SH_HW,SH_MID, CX,SH_BOT);         // left diag
  const d5=distSeg(px,py, CX+SH_HW,SH_MID, CX,SH_BOT);         // right diag
  return Math.min(d1,d2,d3,d4,d5);
}

// ─── Lightning bolt helper ────────────────────────────────────────────────────
// Signed distance to a filled polygon (2D point-in-polygon + nearest edge)
const BOLT = [
  // Top-right → top-left → mid-lower-left → mid-lower-right → bottom
  // Right side bolt shape (clockwise fill)
  [CX+52, 120],
  [CX+8,  240],
  [CX+46, 240],
  [CX-10, 390],  // bottom tip right
  [CX-52, 390],  // bottom tip left
  [CX-8,  265],
  [CX-50, 265],
  [CX-8,  120],
];

function pointInBolt(px,py){
  let inside=false;
  const n=BOLT.length;
  for(let i=0,j=n-1;i<n;j=i++){
    const xi=BOLT[i][0],yi=BOLT[i][1],xj=BOLT[j][0],yj=BOLT[j][1];
    if(((yi>py)!==(yj>py))&&(px<(xj-xi)*(py-yi)/(yj-yi)+xi))inside=!inside;
  }
  return inside;
}

function distToBolt(px,py){
  let minD=Infinity;
  const n=BOLT.length;
  for(let i=0,j=n-1;i<n;j=i++){
    minD=Math.min(minD,distSeg(px,py,BOLT[i][0],BOLT[i][1],BOLT[j][0],BOLT[j][1]));
  }
  return minD;
}

// ─── Small rocket at shield base ──────────────────────────────────────────────
// Drawn as a few colored rectangles centred at (CX, SH_BOT - 24)
const RKT_CX=CX, RKT_TY=SH_BOT-22;

// ─────────────────────────────────────────────────────────────────────────────
//  RENDER
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. Radial space background ────────────────────────────────────────────────
for(let y=0;y<H;y++){
  for(let x=0;x<W;x++){
    const d=Math.hypot(x-CX,y-CY)/360;
    const t=Math.min(1,d);
    // Deep space: near-black navy, slightly lighter at centre
    setpx(x,y, 4+4*(1-t), 4+6*(1-t), 18+14*(1-t));
  }
}

// ── 2. Stars ──────────────────────────────────────────────────────────────────
const STARS=[
  [38,18,220],[92,44,180],[158,9,255],[208,33,200],[318,16,240],
  [384,40,180],[452,22,255],[494,58,200],[28,88,220],[96,112,180],
  [172,78,200],[254,48,240],[348,68,180],[424,88,255],[488,112,200],
  [18,142,180],[78,164,220],[138,132,200],[224,152,255],[292,118,240],
  [362,138,200],[432,162,180],[504,128,255],[52,194,220],[128,212,180],
  [198,178,200],[268,202,240],[338,192,200],[408,212,180],[478,186,255],
  [14,242,180],[74,262,220],[148,228,200],[218,248,255],[288,218,240],
  [358,242,200],[428,262,180],[498,242,255],[34,292,220],[108,312,180],
  [178,278,200],[248,302,240],[318,292,200],[388,312,180],[458,296,255],
  [22,342,180],[94,362,220],[168,328,200],[238,352,255],[308,342,240],
  [378,362,200],[448,344,180],[58,392,220],[132,412,180],[202,382,200],
  [272,402,240],[342,392,200],[412,412,180],[482,396,255],[42,442,220],
  [112,462,180],[184,428,200],[254,452,255],[324,442,240],[394,462,200],
  [464,444,180],[18,492,220],[88,508,180],[162,478,200],[232,500,255],
  [302,490,240],[372,508,200],[442,494,180],[500,482,220],
];
for(const [sx,sy,br] of STARS){
  if(sx>=W||sy>=H)continue;
  const big=br>220;
  if(big){
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
      const f=1-0.45*(Math.abs(dx)+Math.abs(dy));
      blend(sx+dx,sy+dy,br,br,Math.min(255,br+30),f*0.85);
    }
  } else {
    blend(sx,sy,br,br,Math.min(255,br+20),0.75);
  }
}

// ── 3. Radial light burst from shield centre ──────────────────────────────────
const BURST_CY=(SH_TOP+SH_BOT)/2;
for(let y=0;y<H;y++){
  for(let x=0;x<W;x++){
    const dx=x-CX, dy=y-BURST_CY;
    const dist=Math.hypot(dx,dy);
    if(dist<1||dist>300)continue;
    const angle=Math.atan2(dy,dx);
    // 16 thin rays
    const ray=Math.pow(Math.max(0,Math.cos(angle*8)),14);
    const fade=Math.max(0,1-dist/300);
    const g=ray*fade*0.35;
    if(g>0.004) screen(x,y, 0,160,255, g);
  }
}

// ── 4. Shield outer glow ──────────────────────────────────────────────────────
const GLOW_R=58;
for(let y=Math.max(0,SH_TOP-GLOW_R);y<Math.min(H,SH_BOT+GLOW_R);y++){
  for(let x=Math.max(0,CX-SH_HW-GLOW_R);x<Math.min(W,CX+SH_HW+GLOW_R);x++){
    if(inShield(x,y))continue;
    const d=distShield(x,y);
    if(d>GLOW_R)continue;
    const t=1-d/GLOW_R;
    const i=Math.pow(t,1.8);
    screen(x,y, 20,200*i,255*i, i*0.75);
  }
}

// ── 5. Shield body ────────────────────────────────────────────────────────────
const RIM1=4, RIM2=18, RIM3=38;   // distances for rim layers

for(let y=SH_TOP;y<=SH_BOT;y++){
  const xMax=y<=SH_MID ? SH_HW : SH_HW*(1-(y-SH_MID)/(SH_BOT-SH_MID));
  for(let dx=-Math.ceil(xMax);dx<=Math.ceil(xMax);dx++){
    const x=CX+dx;
    if(!inShield(x,y))continue;
    const d=distShield(x,y);

    if(d<=RIM1){
      // Bright white-hot rim
      const t=(RIM1-d)/RIM1;
      blend(x,y, 180+75*t, 240+15*t, 255, 0.98);
    } else if(d<=RIM2){
      // Cyan glow band
      const t=(RIM2-d)/(RIM2-RIM1);
      blend(x,y, 0, 180*t, 255*t, 0.92*t + 0.05);
    } else if(d<=RIM3){
      // Very subtle inner inner tint
      const t=(RIM3-d)/(RIM3-RIM2);
      setpx(x,y, 4+6*t, 8+20*t, 25+30*t);
    } else {
      // Deep dark interior — space inside the shield
      setpx(x,y, 3, 5, 18);
    }
  }
}

// ── 6. Interior starfield (inside shield, subtler) ────────────────────────────
const INNER_STARS=[
  [224,120,140],[270,95,160],[300,140,120],[230,170,130],
  [290,200,150],[215,240,110],[310,260,140],[240,300,120],
  [280,340,130],[260,220,160],
];
for(const [sx,sy,br] of INNER_STARS){
  if(!inShield(sx,sy))continue;
  if(distShield(sx,sy)<RIM3+6)continue; // keep inside dark area
  blend(sx,sy,br,br,Math.min(255,br+50),0.5);
}

// ── 7. Lightning bolt ─────────────────────────────────────────────────────────
// Outer glow
for(let y=100;y<=410;y++){
  for(let x=CX-80;x<=CX+80;x++){
    if(!inShield(x,y))continue;
    const d=distToBolt(x,y);
    if(d>28||pointInBolt(x,y))continue;
    const t=1-d/28;
    const i=Math.pow(t,1.4);
    screen(x,y, 255*i, 200*i, 0, i*0.7);
  }
}
// Fill
for(let y=100;y<=410;y++){
  for(let x=CX-80;x<=CX+80;x++){
    if(!inShield(x,y))continue;
    if(!pointInBolt(x,y))continue;
    const d=distToBolt(x,y);
    if(d<4){
      // Hot white core of bolt
      blend(x,y, 255,248,200, 1.0);
    } else {
      // Gold body
      blend(x,y, 255,188,0, 1.0);
    }
  }
}

// ── 8. Rocket silhouette at base of shield ────────────────────────────────────
function rktPx(x,y,r,g,b){
  if(!inShield(x,y))return;
  if(distShield(x,y)<RIM3)return; // only in dark interior
  setpx(x,y,r,g,b);
}
// Rocket body  (small, centred bottom-of-shield)
const RY=RKT_TY;
for(let dy=0;dy>=-38;dy--){
  const hw=dy>=-12 ? 8 : 12-(Math.abs(dy)-12)*0.9;
  for(let dx=-Math.round(hw);dx<=Math.round(hw);dx++){
    rktPx(RKT_CX+dx, RY+dy, 110,165,215);
  }
}
// Rocket nose (triangle ~16px)
for(let dy=-38;dy>=-56;dy--){
  const hw=Math.max(0,(56+dy)*0.5);
  for(let dx=-Math.round(hw);dx<=Math.round(hw);dx++){
    rktPx(RKT_CX+dx, RY+dy, 135,195,245);
  }
}
// Rocket engine glow
for(let dy=1;dy<=12;dy++){
  const hw=Math.max(0,9-dy*0.8);
  const t=1-dy/12;
  for(let dx=-Math.round(hw);dx<=Math.round(hw);dx++){
    if(!inShield(RKT_CX+dx,RY+dy))continue;
    screen(RKT_CX+dx, RY+dy, 255*t, 130*t, 0, t*0.85);
  }
}
// Fins
for(let dy=0;dy>=-14;dy--){
  // left fin
  rktPx(RKT_CX-9+Math.round(dy*0.7), RY+dy, 200,80,40);
  rktPx(RKT_CX-10+Math.round(dy*0.7), RY+dy, 200,80,40);
  // right fin
  rktPx(RKT_CX+9-Math.round(dy*0.7), RY+dy, 200,80,40);
  rktPx(RKT_CX+10-Math.round(dy*0.7), RY+dy, 200,80,40);
}
// Cockpit window
for(let dy=-28;dy>=-36;dy--){
  for(let dx=-3;dx<=3;dx++){
    if(dx*dx+(dy+32)*(dy+32)<=12) rktPx(RKT_CX+dx,RY+dy,0,220,255);
  }
}

// ── 9. Small UFO enemies above the rocket (inside shield, upper section) ──────
function drawUFO(ux,uy,scale){
  const hw=Math.round(14*scale), dh=Math.round(5*scale), domeH=Math.round(7*scale);
  // Disc
  for(let dy=-dh;dy<=dh;dy++){
    const xw=Math.round(Math.sqrt(Math.max(0,(hw*hw)-(dy*hw/dh)*(dy*hw/dh)*1.8)));
    for(let dx=-xw;dx<=xw;dx++){
      if(!inShield(ux+dx,uy+dy))continue;
      if(distShield(ux+dx,uy+dy)<RIM3)continue;
      blend(ux+dx,uy+dy,110,120,130,0.9);
    }
  }
  // Dome
  for(let dy=-domeH;dy<0;dy++){
    const xw=Math.round((1+dy/domeH)*9*scale);
    for(let dx=-xw;dx<=xw;dx++){
      if(!inShield(ux+dx,uy+dy))continue;
      if(distShield(ux+dx,uy+dy)<RIM3)continue;
      blend(ux+dx,uy+dy,60,200,80,0.85);
    }
  }
  // Lights
  for(const [lx,ly,lr,lg,lb] of [
    [ux-7,uy,255,80,80],[ux,uy+1,255,230,0],[ux+7,uy,80,255,80]
  ]){
    if(inShield(lx,ly)&&distShield(lx,ly)>RIM3) blend(lx,ly,lr,lg,lb,1);
  }
}
drawUFO(CX-52, 130, 0.85);
drawUFO(CX+50, 115, 0.75);
drawUFO(CX-8,  105, 0.90);

// ── 10. Final screen-mode top glow pass (hotspot at top of shield) ────────────
for(let y=SH_TOP-30;y<SH_TOP+60;y++){
  for(let x=CX-SH_HW-20;x<=CX+SH_HW+20;x++){
    const d=distSeg(x,y,CX-SH_HW,SH_TOP,CX+SH_HW,SH_TOP);
    if(d>30)continue;
    const t=Math.pow(1-d/30,2)*0.45;
    screen(x,y,150,230,255,t);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
savePNG(join(OUT_DIR,'icon-512-playstore.png'));
console.log('Done.');
