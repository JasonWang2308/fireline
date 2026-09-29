// 火線交鋒 FIRELINE — browser client
import {W,WDESC,GEAR,magCap,headMul,PRICE_MUL,START_MONEY,KILL_REWARD,STREAK_BONUS,MONEY_CAP,RESPAWN,SPAWN_PROT,HP_MAX,TEAM_SIZE,SHOP,DIFF,NAMES,STYLES,PREFS,
  B,BZ,mir,mirOf,SPAWNS,SPAWN_WALLS,MAPS,MAP_ORDER,mapSolids,rects,inRect,inBuyZone} from '../shared/game-data.js';
import {Net} from './net.js';
import * as S from '../shared/sim.js';
import {SEND_HZ,INTERP_MS,MAX_NAME,MATCH_LENGTHS} from '../shared/protocol.js';
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>a+Math.random()*(b-a);
const PI=Math.PI;
const isTouch=('ontouchstart' in window)&&matchMedia('(pointer:coarse)').matches;

/* ================= MAP (client state) ================= */
let solids=[],waters=[],bridges=[],MAP=null,mapId='desert',world=null;
function inWater(x,z){return world?S.inWater(world,x,z):false;}

/* ================= NAV + RAYCAST (shared/sim.js, bound to the current map) ================= */
function buildNav(){/* built by S.createWorld in buildMap */}
const cellX=S.cellX,cellZ=S.cellZ;
const blockedAt=(x,z)=>S.blockedAt(world,x,z);
const nearestOpen=(ix,iz)=>S.nearestOpen(world,ix,iz);
const astar=(a,b)=>S.astar(world,a,b);
const findPath=(from,to)=>S.findPath(world,from,to);
const rayWorld=(o,d,maxT)=>S.rayWorld(world,o,d,maxT);
const los=(a,b)=>S.los(world,a,b);
const raySphere=S.raySphere,rayCapsule=S.rayCapsule;
const _a=new THREE.Vector3(),_b=new THREE.Vector3(),_d=new THREE.Vector3();

/* ================= THREE SETUP ================= */
let renderer,scene,camera,vmScene,vmCam,vmGun=null,vmFlash,hemi,sun,mapGroup=null,snowPts=null;
const canvas=$('view');
function canvasTex(size,draw){const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');draw(g,size);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t;}
function speckle(g,s,n,cols,maxSz){for(let i=0;i<n;i++){g.fillStyle=cols[(Math.random()*cols.length)|0];const z=Math.random()*maxSz+1;g.fillRect(Math.random()*s,Math.random()*s,z,z);}}
function boxGeo(w,h,d,tile){
  const g=new THREE.BoxGeometry(w,h,d);
  if(tile){const uv=g.attributes.uv;const dims=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
    for(let f=0;f<6;f++){const [su,sv]=dims[f];for(let i=0;i<4;i++){const k=f*4+i;uv.setXY(k,uv.getX(k)*su/tile,uv.getY(k)*sv/tile);}}uv.needsUpdate=true;}
  return g;
}
function mat(tex,extra){return new THREE.MeshLambertMaterial(Object.assign({map:tex},extra||{}));}
function flat(c){return new THREE.MeshLambertMaterial({color:c});}

// ---- themed textures ----
const THEMES={
  desert:{sky:['#6fa2d6','#b7d0e3','#e8e1d0'],fog:[0xdcdcd0,55,150],hemi:[0xdfeaff,0x8b7a5c,.72],sun:[0xfff0d4,.95],outerGround:0xbba77f,skyline:'town',skyCol:0xc9bb9c},
  indoor:{sky:['#161b22','#1d242d','#262e38'],fog:[0x1f262e,28,95],hemi:[0xc9d8ea,0x3a3a36,.62],sun:[0xe6eeff,.55],outerGround:0x2a2e33,skyline:null,ceiling:true},
  jungle:{sky:['#5f9ccf','#a9cfe0','#dfe8d6'],fog:[0xb9ccb0,40,125],hemi:[0xe0f0ff,0x4d5a2c,.7],sun:[0xfff3d6,.9],outerGround:0x4f6b2e,skyline:'hills',skyCol:0x5d7f45},
  snow:{sky:['#8fb4d6','#c9dbe9','#eef3f7'],fog:[0xe3ebf1,45,140],hemi:[0xeaf3ff,0x9aa6b2,.78],sun:[0xffffff,.85],outerGround:0xe4ebf0,skyline:'mountains',skyCol:0xb8c6d2,snow:true},
  port:{sky:['#4f86c2','#9cc3e2','#e4ecef'],fog:[0xcfdde6,50,150],hemi:[0xe6f0ff,0x6b7178,.74],sun:[0xfff4e0,.95],outerGround:0x3d6f86,skyline:'port',skyCol:0x7d8893},
};
function texGround(id){
  return canvasTex(256,(g,s)=>{
    if(id==='desert'){g.fillStyle='#c8b38c';g.fillRect(0,0,s,s);speckle(g,s,2600,['#bfa983','#d2bd97','#b59f7a','#cdb994'],3);
      g.strokeStyle='rgba(90,70,40,.35)';g.lineWidth=2;for(let i=0;i<=2;i++){g.beginPath();g.moveTo(i*s/2,0);g.lineTo(i*s/2,s);g.stroke();g.beginPath();g.moveTo(0,i*s/2);g.lineTo(s,i*s/2);g.stroke();}}
    else if(id==='indoor'){g.fillStyle='#5b6168';g.fillRect(0,0,s,s);speckle(g,s,2200,['#555b62','#62686f','#4f555c'],2);
      g.strokeStyle='rgba(20,24,28,.5)';g.lineWidth=2;g.strokeRect(1,1,s-2,s-2);g.fillStyle='rgba(0,0,0,.12)';g.beginPath();g.ellipse(80,150,50,26,.4,0,PI*2);g.fill();
      g.fillStyle='rgba(235,180,40,.55)';g.fillRect(0,s-10,s,5);}
    else if(id==='jungle'){g.fillStyle='#5b7c37';g.fillRect(0,0,s,s);speckle(g,s,3000,['#4f6f2f','#678a40','#577a33','#6f8f45'],3);
      g.fillStyle='rgba(120,95,60,.35)';for(let i=0;i<4;i++){g.beginPath();g.ellipse(Math.random()*s,Math.random()*s,rand(20,50),rand(10,24),Math.random()*3,0,PI*2);g.fill();}}
    else if(id==='port'){g.fillStyle='#5a5f63';g.fillRect(0,0,s,s);speckle(g,s,2600,['#53585c','#61666a','#4d5155','#686d70'],2);
      g.fillStyle='rgba(235,185,40,.8)';g.fillRect(0,s*.49,s*.35,s*.03);g.fillRect(s*.62,s*.49,s*.38,s*.03);
      g.strokeStyle='rgba(240,240,240,.35)';g.lineWidth=3;g.strokeRect(2,2,s-4,s-4);g.fillStyle='rgba(0,0,0,.12)';g.beginPath();g.ellipse(170,70,40,18,.3,0,PI*2);g.fill();}
    else{g.fillStyle='#e7edf2';g.fillRect(0,0,s,s);speckle(g,s,1800,['#dde5ec','#f3f6f9','#d2dce6'],3);
      g.strokeStyle='rgba(120,140,160,.18)';g.lineWidth=2;for(let i=0;i<5;i++){g.beginPath();g.moveTo(0,rand(0,s));g.bezierCurveTo(s*.3,rand(0,s),s*.6,rand(0,s),s,rand(0,s));g.stroke();}}
  });
}
function texBldg(id){
  return canvasTex(256,(g,s)=>{
    if(id==='desert'){g.fillStyle='#d8c6a2';g.fillRect(0,0,s,s);speckle(g,s,1400,['#cfbc97','#e0cfad','#c6b28c'],3);
      g.fillStyle='#a88f66';g.fillRect(0,s*.9,s,s*.1);g.fillStyle='#8f7652';g.fillRect(s*.26,s*.18,s*.48,s*.36);g.fillStyle='#34414d';g.fillRect(s*.29,s*.21,s*.42,s*.3);
      g.fillStyle='#5a6b78';g.fillRect(s*.29,s*.21,s*.42,s*.04);g.fillStyle='#bca57d';g.fillRect(s*.24,s*.54,s*.52,s*.03);}
    else if(id==='indoor'){g.fillStyle='#6c7885';g.fillRect(0,0,s,s);for(let x=0;x<s;x+=16){g.fillStyle=x%32?'#65717e':'#74808c';g.fillRect(x,0,8,s);}
      g.fillStyle='#e0a92a';g.fillRect(0,s*.86,s,s*.05);g.fillStyle='#262c33';for(let x=0;x<s;x+=32)g.fillRect(x,s*.86,14,s*.05);g.fillStyle='rgba(0,0,0,.25)';g.fillRect(0,s*.91,s,s*.09);}
    else if(id==='jungle'){g.fillStyle='#8a6a44';g.fillRect(0,0,s,s);for(let y=0;y<s;y+=22){g.fillStyle=y%44?'#7f613d':'#94744c';g.fillRect(0,y,s,20);g.fillStyle='rgba(40,25,10,.4)';g.fillRect(0,y+20,s,2);}
      g.fillStyle='#3c2c1a';g.fillRect(s*.38,s*.28,s*.24,s*.26);}
    else if(id==='port'){g.fillStyle='#4f6f86';g.fillRect(0,0,s,s);for(let x=0;x<s;x+=12){g.fillStyle=x%24?'#48667c':'#587a92';g.fillRect(x,0,6,s);}
      g.fillStyle='#39434c';g.fillRect(s*.28,s*.42,s*.44,s*.58);for(let y=s*.42;y<s;y+=10){g.fillStyle='rgba(255,255,255,.08)';g.fillRect(s*.28,y,s*.44,3);}
      g.fillStyle='#e8b923';g.fillRect(0,s*.36,s,s*.03);g.fillStyle='#f2f4f5';g.font='bold 22px monospace';g.fillText('WH-7',s*.06,s*.28);}
    else{g.fillStyle='#8d99a4';g.fillRect(0,0,s,s);for(let x=0;x<s;x+=16){g.fillStyle=x%32?'#86929d':'#95a1ab';g.fillRect(x,0,8,s);}
      g.fillStyle='#e9eef2';g.fillRect(0,0,s,s*.06);g.fillStyle='#2f3a45';g.fillRect(s*.3,s*.3,s*.4,s*.18);g.fillStyle='#9fd0f0';g.fillRect(s*.32,s*.32,s*.36,s*.03);
      g.fillStyle='#c0392b';g.fillRect(0,s*.88,s,s*.04);}
  });
}
function texWall(id){ // outer + spawn base
  const base={desert:'#b3aa98',indoor:'#4c5660',jungle:'#8b8a7e',snow:'#9aa6b0',port:'#8b9197'}[id];
  return canvasTex(256,(g,s)=>{g.fillStyle=base;g.fillRect(0,0,s,s);speckle(g,s,1600,['rgba(0,0,0,.08)','rgba(255,255,255,.08)'],3);
    g.strokeStyle='rgba(30,25,20,.3)';g.lineWidth=2;for(let x=0;x<=s;x+=s/4){g.beginPath();g.moveTo(x,0);g.lineTo(x,s);g.stroke();}
    if(id==='snow'){g.fillStyle='#f2f6f9';g.fillRect(0,0,s,14);}else{g.fillStyle='rgba(30,25,20,.3)';g.fillRect(0,0,s,10);}});
}
function texSpawn(id,t){
  const base={desert:'#b8b0a0',indoor:'#56616c',jungle:'#8f8c7c',snow:'#a4afb8',port:'#8e979e'}[id];
  return canvasTex(256,(g,s)=>{g.fillStyle=base;g.fillRect(0,0,s,s);speckle(g,s,1200,['rgba(0,0,0,.07)','rgba(255,255,255,.08)'],3);
    g.fillStyle=t?'#e2553a':'#3a7fe8';g.fillRect(0,s*.52,s,s*.12);g.fillStyle='rgba(255,255,255,.7)';g.fillRect(0,s*.5,s,s*.02);});
}
const TEX={};
function sharedTextures(){
  TEX.roof=canvasTex(128,(g,s)=>{g.fillStyle='#8c8577';g.fillRect(0,0,s,s);speckle(g,s,700,['#7e786b','#999283'],2);});
  TEX.snowroof=canvasTex(128,(g,s)=>{g.fillStyle='#f1f5f8';g.fillRect(0,0,s,s);speckle(g,s,500,['#e3eaf0','#fbfdfe'],2);});
  TEX.crate=canvasTex(128,(g,s)=>{g.fillStyle='#a8763d';g.fillRect(0,0,s,s);g.strokeStyle='rgba(60,35,10,.35)';for(let y=0;y<s;y+=16){g.beginPath();g.moveTo(0,y);g.lineTo(s,y);g.stroke();}
    g.strokeStyle='#6f4a22';g.lineWidth=12;g.strokeRect(6,6,s-12,s-12);g.lineWidth=11;g.beginPath();g.moveTo(10,10);g.lineTo(s-10,s-10);g.stroke();});
  TEX.mil=canvasTex(128,(g,s)=>{g.fillStyle='#5d6a48';g.fillRect(0,0,s,s);g.fillStyle='#4e5a3c';for(let x=8;x<s;x+=24)g.fillRect(x,0,6,s);g.fillStyle='#e8d9a0';g.font='bold 18px monospace';g.fillText('X-17',40,70);g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=3;g.strokeRect(2,2,s-4,s-4);});
  TEX.low=canvasTex(128,(g,s)=>{g.fillStyle='#a8a298';g.fillRect(0,0,s,s);speckle(g,s,500,['#9d978c','#b4aea4'],2);for(let x=0;x<s;x+=32){g.fillStyle='#e8b923';g.fillRect(x,0,16,s*.16);g.fillStyle='#222';g.fillRect(x+16,0,16,s*.16);}});
  TEX.log=canvasTex(128,(g,s)=>{g.fillStyle='#6b4a2b';g.fillRect(0,0,s,s);for(let y=0;y<s;y+=6){g.fillStyle=`rgba(40,25,12,${Math.random()*.4})`;g.fillRect(0,y,s,2);}});
  TEX.rack=canvasTex(128,(g,s)=>{g.fillStyle='#2e3740';g.fillRect(0,0,s,s);const cols=['#b88a4a','#8a6a3a','#4f7fb5','#c0c6cc'];
    for(let y=0;y<s;y+=42){g.fillStyle='#e07b24';g.fillRect(0,y+36,s,6);for(let x=4;x<s-10;x+=rand(22,34)){g.fillStyle=cols[(Math.random()*4)|0];g.fillRect(x,y+8+rand(0,8),rand(16,26),28-rand(0,8));}}
    g.fillStyle='#e07b24';g.fillRect(0,0,6,s);g.fillRect(s-6,0,6,s);});
  TEX.machine=canvasTex(128,(g,s)=>{g.fillStyle='#55665a';g.fillRect(0,0,s,s);g.fillStyle='#3f4d43';g.fillRect(12,12,s-24,s-40);g.fillStyle='#9fe07a';g.fillRect(20,20,14,8);g.fillStyle='#e0a92a';g.fillRect(0,s-18,s,8);});
  TEX.grate=canvasTex(64,(g,s)=>{g.fillStyle='#4b545c';g.fillRect(0,0,s,s);g.strokeStyle='#6d7780';g.lineWidth=2;for(let x=0;x<=s;x+=8){g.beginPath();g.moveTo(x,0);g.lineTo(x,s);g.stroke();}for(let y=0;y<=s;y+=16){g.beginPath();g.moveTo(0,y);g.lineTo(s,y);g.stroke();}});
  for(const [k,c] of [['c0','#b23a2b'],['c1','#2e5f9e'],['c2','#3e7a4a'],['c3','#d07a28']]){
    TEX[k]=canvasTex(128,(g,s)=>{g.fillStyle=c;g.fillRect(0,0,s,s);for(let x=0;x<s;x+=10){g.fillStyle='rgba(0,0,0,.18)';g.fillRect(x,0,3,s);g.fillStyle='rgba(255,255,255,.08)';g.fillRect(x+4,0,2,s);}g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=5;g.strokeRect(2,2,s-4,s-4);});
  }
}
let skyTexCache={};
function skyTex(cols){const c=document.createElement('canvas');c.width=2;c.height=256;const g=c.getContext('2d');const gr=g.createLinearGradient(0,0,0,256);gr.addColorStop(0,cols[0]);gr.addColorStop(.55,cols[1]);gr.addColorStop(1,cols[2]);g.fillStyle=gr;g.fillRect(0,0,2,256);return new THREE.CanvasTexture(c);}
function setupScene(){
  sharedTextures();
  hemi=new THREE.HemisphereLight(0xdfeaff,0x8b7a5c,.72);scene.add(hemi);
  sun=new THREE.DirectionalLight(0xfff0d4,.95);sun.position.set(-30,48,22);scene.add(sun);scene.add(sun.target);
  if(!isTouch){sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);const sc=sun.shadow.camera;sc.left=-54;sc.right=54;sc.top=42;sc.bottom=-42;sc.near=5;sc.far=140;sun.shadow.bias=-.0008;}
}
function buildMap(id){
  const def=MAPS[id],th=THEMES[id];MAP=def;mapId=id;
  world=S.createWorld(id);solids=world.solids;waters=world.waters;bridges=world.bridges;
  if(mapGroup){scene.remove(mapGroup);mapGroup.traverse(o=>{if(o.geometry)o.geometry.dispose();});}
  if(snowPts){scene.remove(snowPts);snowPts=null;}
  const G=new THREE.Group();mapGroup=G;scene.add(G);
  scene.background=skyTexCache[id]||(skyTexCache[id]=skyTex(th.sky));scene.fog=new THREE.Fog(...th.fog);
  hemi.color.setHex(th.hemi[0]);hemi.groundColor.setHex(th.hemi[1]);hemi.intensity=th.hemi[2];sun.color.setHex(th.sun[0]);sun.intensity=th.sun[1];
  const ground=texGround(id);ground.repeat.set(20.5,14.5);
  const gm=new THREE.Mesh(new THREE.PlaneGeometry(82,58),mat(ground));gm.rotation.x=-PI/2;gm.receiveShadow=true;G.add(gm);
  const og=new THREE.Mesh(new THREE.PlaneGeometry(420,420),new THREE.MeshLambertMaterial({color:th.outerGround}));og.rotation.x=-PI/2;og.position.y=-.02;G.add(og);
  // buy zones + team letters
  for(const t of [0,1]){
    const tx=canvasTex(256,(g,s)=>{g.fillStyle=t?'rgba(255,90,58,.2)':'rgba(61,139,255,.22)';g.fillRect(0,0,s,s);g.strokeStyle=t?'rgba(255,90,58,.9)':'rgba(61,139,255,.95)';g.lineWidth=8;g.setLineDash([22,14]);g.strokeRect(6,6,s-12,s-12);
      g.setLineDash([]);g.fillStyle=t?'rgba(255,120,95,.9)':'rgba(120,175,255,.95)';g.font='bold 30px "Chakra Petch",sans-serif';g.textAlign='center';g.fillText('BUY ZONE',s/2,s/2+10);});
    tx.wrapS=tx.wrapT=THREE.ClampToEdgeWrapping;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(16.4,10.7),new THREE.MeshBasicMaterial({map:tx,transparent:true,depthWrite:false}));
    m.rotation.x=-PI/2;m.rotation.z=t?-PI/2:PI/2;m.position.set(t?35.65:-35.65,.02,0);G.add(m);
    const lt=canvasTex(256,(g,s)=>{g.clearRect(0,0,s,s);g.fillStyle=t?'#e2553a':'#3a7fe8';g.beginPath();g.arc(s/2,s/2,s*.46,0,PI*2);g.fill();g.fillStyle='#fff';g.font='bold 170px "Chakra Petch",sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(t?'B':'A',s/2,s/2+8);});
    const lp=new THREE.Mesh(new THREE.PlaneGeometry(3,3),new THREE.MeshLambertMaterial({map:lt,transparent:true}));lp.position.set(t?40.95:-40.95,3.6,0);lp.rotation.y=t?-PI/2:PI/2;G.add(lp);
  }
  // water + bridge
  for(const w of waters){
    const wm=new THREE.Mesh(new THREE.PlaneGeometry(w.maxX-w.minX,w.maxZ-w.minZ),new THREE.MeshLambertMaterial({color:0x3f8fa8,transparent:true,opacity:.88}));
    wm.rotation.x=-PI/2;wm.position.set((w.minX+w.maxX)/2,.03,(w.minZ+w.maxZ)/2);G.add(wm);
    for(const sgn of [-1,1]){const bank=new THREE.Mesh(new THREE.PlaneGeometry(1,w.maxZ-w.minZ),new THREE.MeshLambertMaterial({color:0x9a8a62}));bank.rotation.x=-PI/2;bank.position.set(sgn>0?w.maxX+.4:w.minX-.4,.025,(w.minZ+w.maxZ)/2);G.add(bank);}
  }
  const plank=new THREE.MeshLambertMaterial({map:TEX.log});
  for(const b of bridges){const bm=new THREE.Mesh(new THREE.BoxGeometry(b.maxX-b.minX+1.6,.18,b.maxZ-b.minZ),plank);bm.position.set((b.minX+b.maxX)/2,.09,(b.minZ+b.maxZ)/2);bm.receiveShadow=true;G.add(bm);}
  if(def.pad){for(const p of [def.pad,mir(def.pad)]){const pt=canvasTex(256,(g,s)=>{g.clearRect(0,0,s,s);g.strokeStyle='rgba(230,190,40,.95)';g.lineWidth=14;g.beginPath();g.arc(s/2,s/2,s*.42,0,PI*2);g.stroke();g.fillStyle='rgba(230,190,40,.95)';g.font='bold 150px "Chakra Petch",sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('H',s/2,s/2+6);});
    const pm=new THREE.Mesh(new THREE.PlaneGeometry(6,6),new THREE.MeshBasicMaterial({map:pt,transparent:true,depthWrite:false}));pm.rotation.x=-PI/2;pm.position.set(p[0],.03,p[1]);G.add(pm);}}
  // solids
  const bT=texBldg(id),wT=texWall(id),roof=th.snow?TEX.snowroof:TEX.roof;
  const M={bldg:[mat(bT),mat(bT),mat(roof),mat(roof),mat(bT),mat(bT)],outer:[mat(wT),mat(wT),mat(roof),mat(roof),mat(wT),mat(wT)],
    spawn0:(()=>{const s=mat(texSpawn(id,0)),r=mat(roof);return [s,s,r,r,s,s];})(),spawn1:(()=>{const s=mat(texSpawn(id,1)),r=mat(roof);return [s,s,r,r,s,s];})(),
    crate:mat(TEX.crate),tall:mat(TEX.mil),low:[mat(TEX.low),mat(TEX.low),mat(TEX.roof),mat(TEX.roof),mat(TEX.low),mat(TEX.low)],log:mat(TEX.log),rail:mat(TEX.log),
    rack:mat(TEX.rack),machine:mat(TEX.machine),hut:[mat(bT),mat(bT),mat(TEX.log),mat(TEX.log),mat(bT),mat(bT)]};
  const cmats=['c0','c1','c2','c3'].map(k=>mat(TEX[k]));
  const rockM=flat(0x8a8a82),moundM=flat(0xf2f6f9),trunkM=flat(0x5b4028),leafM=[flat(0x2f6b2a),flat(0x3d7d30),flat(0x275a24)],metalM=flat(0x59636d),redM=flat(0xc0392b);
  let ci=0;
  for(const s of solids){
    let k=s.kind,mesh=null;
    const put=(geo,m,y)=>{const o=new THREE.Mesh(geo,m);o.position.set(s.cx,y===undefined?s.h/2:y,s.cz);o.castShadow=true;o.receiveShadow=true;G.add(o);return o;};
    if(k==='spawn')put(boxGeo(s.w,s.h,s.d,4),s.cx<0?M.spawn0:M.spawn1);
    else if(k==='bldg'){put(boxGeo(s.w,s.h,s.d,4),M.bldg);
      if(id==='desert'){const cap=new THREE.Mesh(new THREE.BoxGeometry(s.w+.3,.25,s.d+.3),flat(0x9c8a6a));cap.position.set(s.cx,s.h+.12,s.cz);G.add(cap);}
      if(th.snow){const cap=new THREE.Mesh(new THREE.BoxGeometry(s.w+.4,.35,s.d+.4),moundM);cap.position.set(s.cx,s.h+.17,s.cz);cap.castShadow=true;G.add(cap);}}
    else if(k==='outer')put(boxGeo(s.w,s.h,s.d,4),M.outer);
    else if(k==='crate')put(new THREE.BoxGeometry(s.w,s.h,s.d),M.crate);
    else if(k==='tall')put(boxGeo(s.w,s.h,s.d,1.2),M.tall);
    else if(k==='low')put(boxGeo(s.w,s.h,s.d,2),M.low);
    else if(k==='log'||k==='rail')put(boxGeo(s.w,s.h,s.d,1),M.log);
    else if(k==='rack')put(boxGeo(s.w,s.h,s.d,1.7),M.rack);
    else if(k==='machine')put(new THREE.BoxGeometry(s.w,s.h,s.d),M.machine);
    else if(k==='container'){const m=cmats[(ci++)%4];put(boxGeo(s.w,s.h,s.d,2.7),m);if(th.snow){const cap=new THREE.Mesh(new THREE.BoxGeometry(s.w,.2,s.d),moundM);cap.position.set(s.cx,s.h+.1,s.cz);G.add(cap);}}
    else if(k==='hut'){put(boxGeo(s.w,s.h,s.d,3),M.hut);const r=new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(s.w,s.d)*.62,2,4),flat(0x6b5a3a));r.rotation.y=PI/4;r.scale.set(s.w/Math.hypot(s.w,s.d)*1.41,1,s.d/Math.hypot(s.w,s.d)*1.41);r.position.set(s.cx,s.h+1,s.cz);r.castShadow=true;G.add(r);}
    else if(k==='rock'||k==='mound'){const o=new THREE.Mesh(new THREE.DodecahedronGeometry(.5,0),k==='rock'?rockM:moundM);o.scale.set(s.w*1.05,s.h*1.6,s.d*1.05);o.position.set(s.cx,s.h*.45,s.cz);o.rotation.y=s.cx;o.castShadow=true;o.receiveShadow=true;G.add(o);}
    else if(k==='tree'){const tr=new THREE.Mesh(new THREE.CylinderGeometry(.28,.4,4.2,7),trunkM);tr.position.set(s.cx,2.1,s.cz);tr.castShadow=true;G.add(tr);
      for(let i=0;i<3;i++){const f=new THREE.Mesh(new THREE.DodecahedronGeometry(1.4-i*.25,0),leafM[i]);f.position.set(s.cx+rand(-.5,.5),4.2+i*.9,s.cz+rand(-.5,.5));f.castShadow=true;G.add(f);}}
    else if(k==='tower'){const wood=flat(0x6e5234);for(const dx of [-1,1])for(const dz of [-1,1]){const l=new THREE.Mesh(new THREE.BoxGeometry(.25,s.h,.25),wood);l.position.set(s.cx+dx*(s.w/2-.2),s.h/2,s.cz+dz*(s.d/2-.2));l.castShadow=true;G.add(l);}
      const pl=new THREE.Mesh(new THREE.BoxGeometry(s.w+.8,.3,s.d+.8),wood);pl.position.set(s.cx,s.h-1.6,s.cz);pl.castShadow=true;G.add(pl);
      const rf=new THREE.Mesh(new THREE.ConeGeometry(s.w,1.4,4),flat(0x5a4a30));rf.rotation.y=PI/4;rf.position.set(s.cx,s.h+.5,s.cz);rf.castShadow=true;G.add(rf);
      const base=new THREE.Mesh(new THREE.BoxGeometry(s.w-.4,1.4,s.d-.4),M.crate);base.position.set(s.cx,.7,s.cz);base.castShadow=true;G.add(base);}
    else if(k==='sea'){const wm=new THREE.Mesh(new THREE.PlaneGeometry(s.w,s.d),new THREE.MeshLambertMaterial({color:0x2f7fa3,transparent:true,opacity:.92}));wm.rotation.x=-PI/2;wm.position.set(s.cx,.04,s.cz);G.add(wm);
      const edge=new THREE.Mesh(new THREE.BoxGeometry(s.w,.3,.5),flat(0xe0b52a));edge.position.set(s.cx,.15,s.maxZ-.25);edge.receiveShadow=true;G.add(edge);}
    else if(k==='bollard'){const o=put(new THREE.CylinderGeometry(s.w*.42,s.w*.5,s.h,10),flat(0x2c3136));const cap=new THREE.Mesh(new THREE.CylinderGeometry(s.w*.55,s.w*.55,.12,10),flat(0x2c3136));cap.position.set(s.cx,s.h,s.cz);G.add(cap);}
    else if(k==='pillar')put(new THREE.BoxGeometry(s.w,s.h,s.d),flat(0xe0a92a));
    else if(k==='stair'||k==='deck'){put(new THREE.BoxGeometry(s.w,s.h,s.d),[flat(0x59636d),flat(0x59636d),mat(TEX.grate),flat(0x59636d),flat(0x59636d),flat(0x59636d)]);
      const stripe=new THREE.Mesh(new THREE.BoxGeometry(s.w,.06,.12),flat(0xe8b923));stripe.position.set(s.cx,s.h+.03,s.minZ+.06);G.add(stripe);const st2=stripe.clone();st2.position.z=s.maxZ-.06;G.add(st2);
      if(k==='deck')for(const z of [s.minZ+.05,s.maxZ-.05]){const rail=new THREE.Mesh(new THREE.BoxGeometry(s.w,.06,.06),flat(0xe8b923));rail.position.set(s.cx,s.h+1.05,z);G.add(rail);
        for(let x=s.minX+.1;x<=s.maxX;x+=1.5){const post=new THREE.Mesh(new THREE.BoxGeometry(.06,1.05,.06),flat(0xe8b923));post.position.set(x,s.h+.52,z);G.add(post);}}}
    else if(k==='parapet')put(boxGeo(s.w,s.h,s.d,1.2),flat(0x6a747d));
    else if(k==='radio'){for(const dx of [-1,1])for(const dz of [-1,1]){const l=new THREE.Mesh(new THREE.BoxGeometry(.18,s.h,.18),metalM);l.position.set(s.cx+dx*(s.w/2-.1),s.h/2,s.cz+dz*(s.d/2-.1));l.castShadow=true;G.add(l);}
      for(let y=1.5;y<s.h;y+=2){const r=new THREE.Mesh(new THREE.BoxGeometry(s.w,.12,s.d),metalM);r.position.set(s.cx,y,s.cz);G.add(r);}
      const cab=new THREE.Mesh(new THREE.BoxGeometry(s.w-.2,2.2,s.d-.2),mat(TEX.c0));cab.position.set(s.cx,1.1,s.cz);cab.castShadow=true;G.add(cab);
      const top=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.5),redM);top.position.set(s.cx,s.h+.3,s.cz);G.add(top);}
  }
  // gantry crane beams over the quay (legs are 'pillar' solids)
  if(def.cranes){const mm=mirOf(def),yel=flat(0xe0a92a);for(const c of def.cranes)for(const x of [c[0],mm([c[0],0])[0]]){
    const len=Math.abs(c[2]-c[1])+1,cz=(c[1]+c[2])/2;const beam=new THREE.Mesh(new THREE.BoxGeometry(1.1,.8,len+6),yel);beam.position.set(x,7.3,cz-2.5);beam.castShadow=true;G.add(beam);
    const cab=new THREE.Mesh(new THREE.BoxGeometry(1.6,1.3,1.8),flat(0x3a4550));cab.position.set(x,6.4,cz);G.add(cab);const cable=new THREE.Mesh(new THREE.BoxGeometry(.05,4,.05),flat(0x222222));cable.position.set(x,3.9,cz);G.add(cable);}}
  // skyline / surroundings
  if(th.skyline){const m=new THREE.MeshLambertMaterial({color:th.skyCol});
    for(let i=0;i<36;i++){const a=i/36*PI*2,r=rand(78,100);let o;
      if(th.skyline==='town'){const w=rand(6,14),h=rand(6,18),d=rand(6,14);o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.y=h/2;}
      else if(th.skyline==='port'){if(Math.sin(a)<-.2){o=new THREE.Group();const lg=new THREE.MeshLambertMaterial({color:0xc98a3a});for(const dx of [-3,3]){const l=new THREE.Mesh(new THREE.BoxGeometry(1,24,1),lg);l.position.set(dx,12,0);o.add(l);}const bm=new THREE.Mesh(new THREE.BoxGeometry(1.2,1.2,26),lg);bm.position.set(0,24,-6);o.add(bm);}
        else{const w=rand(8,16),h=rand(4,12),d=rand(8,16);o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.y=h/2;}}
      else if(th.skyline==='hills'){const h=rand(14,30);o=new THREE.Mesh(new THREE.ConeGeometry(rand(14,24),h,7),m);o.position.y=h/2-2;}
      else{const h=rand(22,44);o=new THREE.Mesh(new THREE.ConeGeometry(rand(16,26),h,5),m);o.position.y=h/2-2;const cap=new THREE.Mesh(new THREE.ConeGeometry(o.geometry.parameters.radius*.35,h*.35,5),moundM);cap.position.y=h*.325;o.add(cap);}
      o.position.x=Math.cos(a)*r*1.1;o.position.z=Math.sin(a)*r*.8;G.add(o);}}
  if(th.ceiling){const ct=canvasTex(256,(g,s)=>{g.fillStyle='#20262d';g.fillRect(0,0,s,s);g.fillStyle='#2b323a';for(let x=0;x<s;x+=32)g.fillRect(x,0,4,s);g.fillStyle='#fff6d8';g.fillRect(s*.3,s*.44,s*.4,s*.12);});
    ct.repeat.set(10,7);const c=new THREE.Mesh(new THREE.PlaneGeometry(82,58),new THREE.MeshBasicMaterial({map:ct}));c.rotation.x=PI/2;c.position.y=7.5;G.add(c);}
  if(th.snow){const n=1400,pos=new Float32Array(n*3);for(let i=0;i<n;i++){pos[i*3]=rand(-45,45);pos[i*3+1]=rand(0,24);pos[i*3+2]=rand(-32,32);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
    snowPts=new THREE.Points(g,new THREE.PointsMaterial({color:0xffffff,size:.12,transparent:true,opacity:.85,depthWrite:false}));snowPts.frustumCulled=false;scene.add(snowPts);}
}
function updateSnow(dt){if(!snowPts)return;const p=snowPts.geometry.attributes.position.array;for(let i=0;i<p.length;i+=3){p[i+1]-=dt*1.6;p[i]+=Math.sin(p[i+1]*.8+i)*dt*.3;if(p[i+1]<0)p[i+1]=24;}snowPts.geometry.attributes.position.needsUpdate=true;}

/* ================= MODELS ================= */
const GM={};
function gunMats(){
  const L=c=>new THREE.MeshLambertMaterial({color:c});
  Object.assign(GM,{metal:L(0x3b424c),poly:L(0x4b525b),tan:L(0x9a8458),wood:L(0x7a4a28),glass:new THREE.MeshBasicMaterial({color:0x7cc4ff}),blade:L(0xc9d3dc),glove:L(0x1e1f22),sleeve:L(0x6b7a4a)});
}
function makeGun(look){
  const g=new THREE.Group();
  const add=(w,h,d,x,y,z,m,rx)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);b.position.set(x,y,z);if(rx)b.rotation.x=rx;g.add(b);return b;};
  let tip=-.3,fore=-.25;
  switch(look){
    case 'pistol':add(.055,.07,.24,0,0,-.06,GM.metal);add(.05,.13,.07,0,-.085,.03,GM.poly,-.25);tip=-.19;fore=0;break;
    case 'magnum':add(.065,.085,.3,0,0,-.08,GM.metal);add(.055,.14,.08,0,-.1,.04,GM.poly,-.25);tip=-.24;fore=0;break;
    case 'revolver':add(.04,.045,.3,0,.01,-.2,GM.metal);add(.02,.03,.28,0,-.025,-.19,GM.metal);add(.09,.09,.1,0,-.005,0,GM.metal);add(.05,.14,.07,0,-.1,.07,GM.wood,-.35);add(.012,.03,.02,0,.045,-.34,GM.metal);tip=-.36;fore=0;break;
    case 'smg':add(.07,.1,.36,0,0,-.08,GM.poly);add(.03,.03,.12,0,.01,-.32,GM.metal);add(.04,.17,.05,0,-.12,-.1,GM.metal);add(.045,.11,.06,0,-.08,.06,GM.poly,-.2);add(.04,.05,.2,0,0,.2,GM.metal);tip=-.39;fore=-.2;break;
    case 'shotgun':add(.045,.045,.62,0,.03,-.36,GM.metal);add(.04,.04,.46,0,-.02,-.3,GM.metal);add(.075,.065,.18,0,-.02,-.38,GM.wood);add(.07,.1,.26,0,0,-.02,GM.metal);add(.06,.1,.3,0,-.03,.25,GM.wood);add(.045,.1,.06,0,-.08,.06,GM.wood,-.25);tip=-.68;fore=-.38;break;
    case 'rifle':add(.07,.1,.44,0,0,-.08,GM.poly);add(.075,.08,.26,0,0,-.4,GM.tan);add(.03,.03,.2,0,.01,-.62,GM.metal);add(.05,.18,.08,0,-.13,-.13,GM.metal,.25);add(.045,.11,.06,0,-.08,.08,GM.poly,-.2);add(.06,.1,.26,0,-.02,.3,GM.tan);add(.03,.025,.32,0,.065,-.12,GM.metal);tip=-.72;fore=-.4;break;
    case 'sniper':add(.07,.09,.5,0,0,-.05,GM.metal);add(.035,.035,.55,0,.01,-.56,GM.metal);add(.055,.055,.3,0,.1,-.08,GM.metal);add(.05,.05,.01,0,.1,-.235,GM.glass);add(.07,.12,.34,0,-.02,.36,GM.tan);add(.05,.08,.08,0,-.09,-.05,GM.metal);add(.045,.1,.06,0,-.08,.1,GM.tan,-.2);tip=-.84;fore=-.35;break;
    case 'dual':{const l=makeGun('pistol'),r=makeGun('pistol');l.position.x=-.2;r.position.x=.2;g.add(l,r);tip=-.19;fore=0;break;}
    case 'katana':add(.034,.038,.24,0,-.01,.14,GM.glove);add(.075,.075,.016,0,0,.01,GM.tan);add(.012,.036,.64,0,.012,-.32,GM.blade);add(.014,.01,.64,0,.032,-.32,GM.metal);tip=-.66;fore=0;break;
    case 'axe':add(.036,.036,.56,0,-.03,.02,GM.wood);add(.024,.15,.12,0,.05,-.24,GM.metal);add(.012,.19,.03,0,.05,-.31,GM.blade);add(.04,.05,.05,0,-.04,-.22,GM.metal);tip=-.32;fore=0;break;
    case 'knife':add(.032,.034,.12,0,-.01,.04,GM.poly);add(.06,.018,.02,0,0,-.03,GM.metal);add(.012,.038,.2,0,.004,-.14,GM.blade);tip=-.24;fore=0;break;
    case 'h9':add(.07,.09,.3,0,0,-.08,GM.metal);add(.06,.15,.08,0,-.1,.04,GM.tan,-.25);add(.02,.03,.08,0,.06,-.18,GM.metal);tip=-.24;fore=0;break;
    case 'rapid':add(.06,.1,.3,0,0,-.05,GM.poly);add(.03,.03,.1,0,.01,-.25,GM.metal);add(.04,.26,.05,0,-.16,-.06,GM.metal);add(.045,.11,.06,0,-.08,.07,GM.poly,-.2);add(.03,.05,.16,0,-.02,.18,GM.metal);tip=-.31;fore=-.18;break;
    case 'autoshot':add(.08,.12,.4,0,0,-.08,GM.metal);add(.045,.045,.4,0,.03,-.45,GM.metal);add(.06,.16,.1,0,-.14,-.1,GM.poly);add(.08,.07,.18,0,-.02,-.35,GM.poly);add(.06,.1,.28,0,-.03,.28,GM.poly);add(.045,.1,.06,0,-.08,.08,GM.poly,-.25);tip=-.66;fore=-.35;break;
    case 'carbine':add(.07,.1,.36,0,0,-.06,GM.poly);add(.075,.08,.16,0,0,-.3,GM.metal);add(.03,.03,.12,0,.01,-.44,GM.metal);add(.05,.17,.07,0,-.12,-.1,GM.metal,.2);add(.045,.11,.06,0,-.08,.07,GM.poly,-.2);add(.05,.09,.2,0,-.02,.24,GM.poly);add(.04,.05,.06,0,.08,-.08,GM.metal);tip=-.51;fore=-.3;break;
    case 'burst':add(.075,.11,.46,0,0,-.08,GM.tan);add(.08,.085,.22,0,0,-.4,GM.poly);add(.03,.03,.18,0,.01,-.6,GM.metal);add(.05,.16,.08,0,-.12,-.08,GM.metal,.15);add(.045,.11,.06,0,-.08,.08,GM.poly,-.2);add(.07,.11,.24,0,-.02,.3,GM.tan);add(.03,.05,.2,0,.08,-.1,GM.metal);tip=-.7;fore=-.4;break;
    case 'tactical':add(.07,.1,.48,0,0,-.08,GM.metal);add(.032,.032,.32,0,.01,-.6,GM.metal);add(.05,.1,.07,0,-.09,-.08,GM.metal);add(.045,.045,.18,0,.09,-.1,GM.metal);add(.04,.04,.01,0,.09,-.195,GM.glass);add(.06,.11,.28,0,-.02,.32,GM.poly);add(.045,.1,.06,0,-.08,.1,GM.poly,-.2);tip=-.77;fore=-.38;break;
    case 'dmr':add(.075,.1,.52,0,0,-.06,GM.poly);add(.035,.035,.38,0,.01,-.68,GM.metal);add(.05,.05,.24,0,.1,-.1,GM.metal);add(.045,.045,.01,0,.1,-.225,GM.glass);add(.05,.12,.08,0,-.1,-.08,GM.metal);add(.07,.12,.3,0,-.02,.36,GM.tan);add(.045,.1,.06,0,-.08,.1,GM.poly,-.2);tip=-.88;fore=-.4;break;
    case 'scout':add(.06,.08,.46,0,0,-.05,GM.poly);add(.028,.028,.46,0,.01,-.5,GM.metal);add(.045,.045,.22,0,.085,-.08,GM.metal);add(.04,.04,.01,0,.085,-.195,GM.glass);add(.07,.02,.02,.05,.02,.08,GM.metal);add(.06,.11,.3,0,-.02,.34,GM.wood);add(.04,.06,.06,0,-.07,-.05,GM.metal);tip=-.74;fore=-.3;break;
    case 'mp7':add(.06,.09,.28,0,0,-.05,GM.poly);add(.028,.028,.1,0,.01,-.24,GM.metal);add(.045,.16,.055,0,-.11,0,GM.metal,-.15);add(.04,.1,.05,0,-.08,-.16,GM.poly,.3);add(.035,.04,.16,0,-.01,.16,GM.metal);add(.03,.03,.08,0,.065,-.06,GM.metal);tip=-.3;fore=-.16;break;
    case 'battle':add(.07,.1,.5,0,0,-.08,GM.tan);add(.075,.075,.16,0,0,-.38,GM.poly);add(.032,.032,.24,0,.01,-.56,GM.metal);add(.05,.15,.07,0,-.12,-.12,GM.metal);add(.045,.045,.2,0,.09,-.1,GM.metal);add(.04,.04,.01,0,.09,-.205,GM.glass);add(.065,.11,.26,0,-.02,.32,GM.tan);add(.045,.1,.06,0,-.08,.1,GM.poly,-.2);tip=-.7;fore=-.38;break;
    case 'lmg':add(.1,.12,.5,0,0,-.06,GM.poly);add(.035,.035,.42,0,.01,-.5,GM.metal);add(.06,.06,.24,0,.02,-.4,GM.metal);add(.1,.12,.12,-.03,-.12,-.08,GM.tan);add(.015,.13,.015,.03,-.07,-.62,GM.metal);add(.015,.13,.015,-.03,-.07,-.62,GM.metal);add(.03,.04,.12,0,.09,-.2,GM.metal);add(.045,.11,.06,0,-.08,.1,GM.poly,-.2);add(.07,.1,.24,0,-.02,.3,GM.poly);tip=-.72;fore=-.36;break;
    case 'heavy':add(.12,.14,.5,0,0,-.05,GM.poly);add(.075,.075,.4,0,.01,-.48,GM.metal);add(.045,.045,.18,0,.01,-.76,GM.metal);add(.12,.13,.13,-.02,-.13,-.06,GM.tan);add(.03,.06,.14,0,.11,-.14,GM.metal);add(.08,.11,.24,0,-.02,.3,GM.poly);add(.05,.11,.06,0,-.1,.1,GM.poly,-.2);tip=-.86;fore=-.42;break;
  }
  g.userData={tip,fore};
  return g;
}
function teamColors(t){return t?{main:0xd24a2c,dark:0x7e2a1a,helm:0x5a2418}:{main:0x2f6fe0,dark:0x1a3f80,helm:0x1b2f55};}
function tagName(e){return e.name+(e.bot?' [AI]':'');}
function makeSoldier(e){
  const c=teamColors(e.team),L=x=>new THREE.MeshLambertMaterial({color:x});
  const g=new THREE.Group();g.rotation.order='YXZ';
  const pants=L(0x2f3640),boot=L(0x1c1f24),skin=L(0xd9ae86);
  const mkLeg=x=>{const p=new THREE.Group();p.position.set(x,.86,0);const l=new THREE.Mesh(new THREE.BoxGeometry(.22,.72,.24),pants);l.position.y=-.36;const b=new THREE.Mesh(new THREE.BoxGeometry(.24,.14,.32),boot);b.position.set(0,-.79,-.04);p.add(l,b);g.add(p);return p;};
  const legL=mkLeg(-.14),legR=mkLeg(.14);
  const torso=new THREE.Mesh(new THREE.BoxGeometry(.56,.62,.32),L(c.main));torso.position.y=1.18;
  const vest=new THREE.Mesh(new THREE.BoxGeometry(.6,.4,.38),L(c.dark));vest.position.y=1.22;
  const head=new THREE.Mesh(new THREE.SphereGeometry(.19,12,10),skin);head.position.y=1.66;
  const helm=new THREE.Mesh(new THREE.SphereGeometry(.215,12,8,0,PI*2,0,PI/2),L(c.helm));helm.position.y=1.68;
  const band=new THREE.Mesh(new THREE.BoxGeometry(.44,.06,.44),L(c.main));band.position.y=1.66;
  const armR=new THREE.Mesh(new THREE.BoxGeometry(.14,.14,.5),L(c.main));armR.position.set(.24,1.3,-.2);
  const armL=new THREE.Mesh(new THREE.BoxGeometry(.14,.14,.52),L(c.main));armL.position.set(-.12,1.3,-.28);armL.rotation.y=-.35;
  const gunH=new THREE.Group();gunH.position.set(.12,1.32,-.34);gunH.scale.setScalar(1.25);
  const flash=new THREE.Sprite(flashMat.clone());flash.scale.set(.5,.5,.5);flash.visible=false;
  g.add(torso,vest,head,helm,band,armR,armL,gunH);scene.add(flash);
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  if(e.team===(P?P.team:0)&&!e.isPlayer){
    const tx=canvasTex(256,(q,s)=>{q.clearRect(0,0,s,s);q.fillStyle='#3d8bff';q.beginPath();q.moveTo(s/2-18,20);q.lineTo(s/2+18,20);q.lineTo(s/2,44);q.fill();q.font='bold 34px "Noto Sans TC",sans-serif';q.textAlign='center';q.fillStyle='#fff';q.strokeStyle='rgba(0,0,0,.6)';q.lineWidth=5;const label=tagName(e);q.strokeText(label,s/2,s-80);q.fillText(label,s/2,s-80);});
    tx.wrapS=tx.wrapT=THREE.ClampToEdgeWrapping;
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tx,depthTest:false,transparent:true}));sp.scale.set(1.3,1.3,1);sp.position.y=2.35;sp.renderOrder=10;g.add(sp);
  }
  scene.add(g);
  return {root:g,legL,legR,gunH,flash};
}
function setSoldierGun(e){
  const h=e.mesh.gunH;while(h.children.length)h.remove(h.children[0]);
  const gun=makeGun(W[curW(e)].look);gun.traverse(o=>{if(o.isMesh)o.castShadow=true;});h.add(gun);e.mesh.tip=gun.userData.tip;
}
let vmFlash2=null,dualSide=false,vmHeal=0;
function buildViewmodel(){
  if(vmGun)vmScene.remove(vmGun);
  const look=W[curW(P)].look;
  const gun=makeGun(look);
  const hold=new THREE.Group();hold.add(gun);
  const arm=(x,y,z,rx,ry,len)=>{const a=new THREE.Mesh(new THREE.BoxGeometry(.08,.08,len||.3),GM.sleeve);a.position.set(x,y,z);a.rotation.set(rx,ry,0);hold.add(a);};
  const hand=(x,y,z)=>{const h=new THREE.Mesh(new THREE.BoxGeometry(.07,.08,.1),GM.glove);h.position.set(x,y,z);hold.add(h);};
  const flash=(x,z)=>{const f=new THREE.Sprite(flashMat);f.scale.setScalar(.26);f.position.set(x,.015,z);f.visible=false;hold.add(f);return f;};
  const f=gun.userData.fore;vmFlash2=null;
  if(look==='dual'){
    hand(.2,-.08,.06);arm(.26,-.24,.17,.95,-.3,.26);hand(-.2,-.08,.06);arm(-.26,-.24,.17,.95,.3,.26);
    vmFlash=flash(.2,-.25);vmFlash2=flash(-.2,-.25);
  }else{
    hand(0,-.08,.06);arm(.08,-.24,.16,.95,-.3,.26);
    if(look!=='knife'){hand(-.02,-.06,f);arm(-.15,-.17,f+.2,.55,.75,.34);}
    vmFlash=flash(0,gun.userData.tip-.06);
  }
  const base={katana:[.24,-.26,-.34],axe:[.22,-.24,-.34],revolver:[.15,-.16,-.44],h9:[.15,-.16,-.42],rapid:[.2,-.2,-.36],autoshot:[.2,-.22,-.28],carbine:[.2,-.21,-.32],burst:[.2,-.21,-.3],tactical:[.2,-.21,-.3],dmr:[.2,-.21,-.28],scout:[.2,-.21,-.3],pistol:[.15,-.16,-.4],magnum:[.15,-.16,-.42],dual:[0,-.17,-.4],knife:[.2,-.19,-.34],smg:[.2,-.21,-.36],shotgun:[.2,-.22,-.28],rifle:[.2,-.21,-.3],sniper:[.2,-.21,-.3],heavy:[.22,-.25,-.28],mp7:[.2,-.2,-.38],battle:[.2,-.21,-.3],lmg:[.22,-.24,-.28]}[look];
  hold.userData.base=base;hold.userData.look=look;hold.position.set(...base);
  vmGun=hold;vmScene.add(hold);
}
let flashMat;
function makeFlashMat(){
  const t=canvasTex(64,(g,s)=>{const gr=g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);gr.addColorStop(0,'rgba(255,255,230,1)');gr.addColorStop(.3,'rgba(255,200,90,.9)');gr.addColorStop(1,'rgba(255,120,20,0)');g.fillStyle=gr;g.fillRect(0,0,s,s);});
  flashMat=new THREE.SpriteMaterial({map:t,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true});
}

/* ================= FX ================= */
const tracers=[],puffs=[];
let puffMat,sparkMat;
function initFx(){
  const tm=new THREE.LineBasicMaterial({color:0xffe4a0,transparent:true,opacity:.85});
  for(let i=0;i<48;i++){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));const l=new THREE.Line(g,tm.clone());l.visible=false;l.frustumCulled=false;scene.add(l);tracers.push({l,life:0});}
  const pt=canvasTex(64,(g,s)=>{const gr=g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);gr.addColorStop(0,'rgba(120,105,85,.9)');gr.addColorStop(1,'rgba(120,105,85,0)');g.fillStyle=gr;g.fillRect(0,0,s,s);});
  puffMat=new THREE.SpriteMaterial({map:pt,transparent:true,depthWrite:false});
  sparkMat=flashMat;
  for(let i=0;i<40;i++){const pm=puffMat.clone();const s=new THREE.Sprite(pm);s.visible=false;scene.add(s);puffs.push({s,pm,life:0,max:.3});}
}
let trI=0,puI=0;
function addTracer(a,b){const t=tracers[trI++%tracers.length];const p=t.l.geometry.attributes.position.array;p[0]=a.x;p[1]=a.y;p[2]=a.z;p[3]=b.x;p[4]=b.y;p[5]=b.z;t.l.geometry.attributes.position.needsUpdate=true;t.l.visible=true;t.life=.07;t.l.material.opacity=.85;}
function addPuff(p,spark){const u=puffs[puI++%puffs.length];u.s.material=spark?sparkMat:u.pm;u.s.position.copy(p);u.s.visible=true;u.life=u.max=spark?.12:.35;u.s.scale.setScalar(spark?.35:.25);u.spark=spark;}
function updateFx(dt){
  for(const t of tracers)if(t.l.visible){t.life-=dt;t.l.material.opacity=Math.max(0,t.life/.07*.85);if(t.life<=0)t.l.visible=false;}
  for(const u of puffs)if(u.s.visible){u.life-=dt;const k=1-u.life/u.max;if(!u.spark){u.s.scale.setScalar(.25+k*.5);u.s.material.opacity=1-k;}if(u.life<=0)u.s.visible=false;}
}

/* ================= AUDIO ================= */
let AC=null,master=null,noiseBuf=null,muted=false;
function initAudio(){
  if(AC)return;try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){return;}
  master=AC.createGain();master.gain.value=.55;master.connect(AC.destination);
  noiseBuf=AC.createBuffer(1,AC.sampleRate*.6,AC.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2);
}
function sfxShot(look,vol){
  if(!AC||muted||vol<.02)return;const t=AC.currentTime;
  const src=AC.createBufferSource();src.buffer=noiseBuf;const f=AC.createBiquadFilter();f.type='lowpass';
  f.frequency.value={pistol:3000,revolver:1500,h9:1700,magnum:2000,dual:2900,smg:2600,rapid:2800,shotgun:1300,autoshot:1400,carbine:2400,burst:2300,rifle:2200,tactical:1900,dmr:1700,scout:1800,sniper:1500,heavy:1200,mp7:2700,battle:1800,lmg:1500}[look]||2400;
  const g=AC.createGain();const dur=(look==='sniper'||look==='scout')?.5:(look==='shotgun'||look==='autoshot'||look==='dmr')?.35:look==='revolver'?.3:.16;g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);
  src.connect(f);f.connect(g);g.connect(master);src.start(t);src.stop(t+dur+.02);
  const o=AC.createOscillator(),og=AC.createGain();o.frequency.setValueAtTime(look==='sniper'||look==='scout'||look==='shotgun'||look==='autoshot'?90:140,t);o.frequency.exponentialRampToValueAtTime(40,t+.12);og.gain.setValueAtTime(vol*.8,t);og.gain.exponentialRampToValueAtTime(.001,t+.14);o.connect(og);og.connect(master);o.start(t);o.stop(t+.15);
}
function sfxSwish(vol){if(!AC||muted||vol<.02)return;const t=AC.currentTime,src=AC.createBufferSource();src.buffer=noiseBuf;const f=AC.createBiquadFilter();f.type='bandpass';f.frequency.setValueAtTime(900,t);f.frequency.exponentialRampToValueAtTime(3200,t+.15);const g=AC.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+.18);src.connect(f);f.connect(g);g.connect(master);src.start(t);src.stop(t+.2);}
function sfxTone(freqs,dur,vol,type){if(!AC||muted)return;const t=AC.currentTime;freqs.forEach((fq,i)=>{const o=AC.createOscillator(),g=AC.createGain();o.type=type||'sine';o.frequency.value=fq;const s=t+i*.07;g.gain.setValueAtTime(0,s);g.gain.linearRampToValueAtTime(vol,s+.01);g.gain.exponentialRampToValueAtTime(.001,s+dur);o.connect(g);g.connect(master);o.start(s);o.stop(s+dur+.02);});}

/* ================= ENTITIES ================= */
const ents=[];let P=null;
function curW(e){return e.slot===3?(e.melee||'knife'):(e.slot===1&&e.primary)?e.primary:e.secondary;}
function priceOf(k){const base=GEAR[k]?GEAR[k].price:W[k].price;return Math.round(base*(PRICE_MUL[matchLen]||1)/50)*50;}
function makeEnt(name,team,isPlayer,style,bot){
  const e={name,team,isPlayer,bot:bot===undefined?!isPlayer:bot,pos:new THREE.Vector3(),vel:new THREE.Vector3(),vy:0,onGround:true,yaw:0,pitch:0,hp:HP_MAX,armor:false,medkit:false,healT:0,alive:false,respawnT:0,spawnProt:0,
    money:START_MONEY,kills:0,deaths:0,streak:0,primary:null,secondary:'p9',slot:2,ammo:{},reloadT:0,fireCd:0,swapT:0,bloom:0,spottedT:-99,lastShotT:-99,deadT:0,walk:0,
    ai:isPlayer?null:{style,path:null,pathGoal:null,goal:null,route:[],repathT:0,scanT:0,target:null,seeT:0,react:.5,lastSeen:null,lastSeenT:-99,alertBy:null,alertT:-99,strafeDir:1,strafeT:0,burst:0,burstLen:4,burstPause:0,stuckT:0,lastX:0,lastZ:0}};
  if(!isPlayer)e.mesh=makeSoldier(e);
  return e;
}
function giveWeapon(e,k){const w=W[k];if(w.slot===3){e.melee=k;e.slot=3;}else{e.ammo[k]={mag:magCap(e,k),reserve:w.reserve};if(w.slot===1){e.primary=k;e.slot=1;}else{e.secondary=k;e.slot=2;}}e.reloadT=0;e.swapT=.35;
  if(e.isPlayer)buildViewmodel();else setSoldierGun(e);}
function buy(e,key){
  if(!inBuyZone(e)||!e.alive)return false;
  if(online&&e===P){online.net.send('buy',{key});return false;}
  const pr=priceOf(key);
  if(GEAR[key]){if(e[key]||e.money<pr)return false;e.money-=pr;e[key]=true;if(GEAR[key].mag)for(const k in e.ammo)e.ammo[k].mag=Math.max(e.ammo[k].mag,magCap(e,k));return true;}
  if(e.money<pr)return false;if(e.primary===key||e.secondary===key)return false;
  if(e.melee===key)return false;
  e.money-=pr;giveWeapon(e,key);return true;
}
function botBuy(e){
  for(const k of PREFS[e.ai.style]){const side=W[k].slot===2;if(e.money>=priceOf(k)*(side?3:1)){buy(e,k);break;}}
  if(e.money>=priceOf('armor')&&Math.random()<.7)buy(e,'armor');
  if(e.money>=priceOf('gloves')&&Math.random()<.45)buy(e,'gloves');
  if(e.money>=priceOf('boots')&&(e.ai.style==='heavy'||Math.random()<.35))buy(e,'boots');
  if(e.money>=priceOf('helmet')&&Math.random()<.45)buy(e,'helmet');
  if(e.money>=priceOf('medkit')&&Math.random()<.35)buy(e,'medkit');
  const mc=e.primary&&W[e.primary].magc;if(mc&&e.money>=priceOf('mag_'+mc)&&Math.random()<.35)buy(e,'mag_'+mc);
}
// field medkit: heals GEAR.medkit.heal over GEAR.medkit.time seconds; damage or firing cuts it short
function startHeal(e){
  if(!e.alive||!e.medkit||e.healT>0||e.hp>=HP_MAX)return false;
  if(online&&e===P)online.net.send('heal',{});
  e.medkit=false;e.healT=GEAR.medkit.time;e.burstLeft=0;e.chargeT=0;
  if(e===P){trigger=false;sfxTone([520,780],.12,.1,'sine');}
  return true;
}
function spawn(e){
  const pts=SPAWNS[e.team];let best=pts[0],bs=-1;
  if(online&&e.isPlayer){const q=pts[online.slot%pts.length];best=q;bs=1e9;}
  if(bs<1e9)for(const p of pts){let md=1e9;for(const o of ents)if(o.team!==e.team&&o.alive)md=Math.min(md,Math.hypot(o.pos.x-p[0],o.pos.z-p[1]));
    let occ=0;for(const o of ents)if(o!==e&&o.alive&&Math.hypot(o.pos.x-p[0],o.pos.z-p[1])<1.2)occ=1;
    const sc=md+Math.random()*4-(occ?50:0);if(sc>bs){bs=sc;best=p;}}
  e.pos.set(best[0]+rand(-.3,.3),0,best[1]+rand(-.3,.3));e.vel.set(0,0,0);e.vy=0;e.yaw=e.team===0?-PI/2:PI/2;e.pitch=0;
  for(const g in GEAR)e[g]=false;e.hp=HP_MAX;e.alive=true;e.healT=0;e.lastSlot=1;e.primary=null;e.secondary='p9';e.melee='knife';e.dashCd=0;e.dashT=0;e.chargeT=0;e.slot=2;e.ammo={p9:{mag:W.p9.mag,reserve:W.p9.reserve}};
  e.reloadT=0;e.fireCd=0;e.swapT=0;e.bloom=0;e.spawnProt=SPAWN_PROT;e.deadT=0;
  if(e.isPlayer){buildViewmodel();}
  else{const a=e.ai;a.path=null;a.goal=null;a.route=[];a.target=null;a.lastSeen=null;a.stuckT=0;a.lastX=e.pos.x;a.lastZ=e.pos.z;
    e.mesh.root.visible=true;e.mesh.root.rotation.x=0;setSoldierGun(e);botBuy(e);}
}

/* ================= PHYSICS ================= */
const resolveWalls=e=>S.resolveWalls(world,e);
const groundAt=(x,z,y)=>S.groundAt(world,x,z,y);
const physics=(e,dt)=>S.physics(world,e,dt);
function separate(){
  for(let i=0;i<ents.length;i++){const a=ents[i];if(!a.alive)continue;for(let j=i+1;j<ents.length;j++){const b=ents[j];if(!b.alive)continue;
    const dx=b.pos.x-a.pos.x,dz=b.pos.z-a.pos.z,d=Math.hypot(dx,dz);if(d<.72&&d>1e-4){const push=(.72-d)/2;const ux=dx/d,uz=dz/d;a.pos.x-=ux*push;a.pos.z-=uz*push;b.pos.x+=ux*push;b.pos.z+=uz*push;resolveWalls(a);resolveWalls(b);}}}
}

/* ================= COMBAT ================= */
const eyeOf=(e,v)=>(v||new THREE.Vector3()).set(e.pos.x,e.pos.y+1.58,e.pos.z);
const chestOf=(e,v)=>(v||new THREE.Vector3()).set(e.pos.x,e.pos.y+1.2,e.pos.z);
const headOf=(e,v)=>(v||new THREE.Vector3()).set(e.pos.x,e.pos.y+1.66,e.pos.z);
function startReload(e){const k=curW(e),w=W[k],a=e.ammo[k];if(!a||e.reloadT>0||a.mag>=magCap(e,k)||a.reserve<=0)return false;e.reloadT=w.reload;e.reloadKey=k;if(online&&e===P)online.net.send('reload',{wk:k});return true;}
function switchSlot(e,s){if(s===1&&!e.primary)return;if(e.slot===s)return;e.burstLeft=0;e.lastSlot=e.slot;e.slot=s;e.reloadT=0;e.swapT=.35;if(e.isPlayer){buildViewmodel();}else setSoldierGun(e);}
function cycleSlot(e,dir){const order=[1,2,3].filter(s=>s!==1||e.primary);let i=order.indexOf(e.slot);if(i<0)i=0;switchSlot(e,order[(i+dir+order.length)%order.length]);}
function hasAmmo(e,slot){const k=slot===1?e.primary:e.secondary;const a=k&&e.ammo[k];return !!a&&(a.mag>0||a.reserve>0);}
function isBehind(a,v){const fx=-Math.sin(v.yaw),fz=-Math.cos(v.yaw),dx=v.pos.x-a.pos.x,dz=v.pos.z-a.pos.z,d=Math.hypot(dx,dz)||1;return (dx*fx+dz*fz)/d>.5;}
function weaponTimers(e,dt){
  if(e.healT>0){const step=Math.min(dt,e.healT);e.healT-=dt;e.hp=Math.min(HP_MAX,e.hp+GEAR.medkit.heal*step/GEAR.medkit.time);if(e.healT<=0||e.hp>=HP_MAX)e.healT=0;}
  e.fireCd-=dt;e.swapT-=dt;e.bloom=Math.max(0,e.bloom-dt*.12);
  if(e.reloadT>0){e.reloadT-=dt;if(e.reloadT<=0){const k=e.reloadKey,a=e.ammo[k];if(a){const need=magCap(e,k)-a.mag,take=Math.min(need,a.reserve);a.mag+=take;a.reserve-=take;}}}
}
let gameTime=0;
function alertNearby(shooter,rad){rad=rad||32;
  for(const o of ents){if(o.isPlayer||!o.alive||o.team===shooter.team)continue;const d=o.pos.distanceTo(shooter.pos);if(d<rad&&!o.ai.target){o.ai.lastSeen=shooter.pos.clone();o.ai.lastSeenT=gameTime;}}
}
function falloff(w,d){return d<=w.range?1:Math.max(.45,1-(d-w.range)/(w.range*1.5));}
function damage(v,a,amt,wk,hs){
  if(!v.alive||v.spawnProt>0)return false;
  if(v.armor)amt*=.7;
  if(hs&&v.helmet&&v.hp>=HP_MAX&&amt>=v.hp)amt=v.hp-1;  // helmet: no one-hit headshot kill from full health
  v.hp-=amt;v.healT=0;
  if(!v.isPlayer){v.ai.lastSeen=a.pos.clone();v.ai.lastSeenT=gameTime;v.ai.alertBy=a;v.ai.alertT=gameTime;}
  else{hurtFx(a);}
  if(v.hp<=0){kill(v,a,wk,hs);return true;}
  return false;
}
function kill(v,a,wk,hs){
  v.alive=false;v.hp=0;v.deaths++;v.streak=0;v.respawnT=RESPAWN;v.deadT=0;v.killer=a;v.killerW=wk;v.reloadT=0;
  a.kills++;a.streak++;teamKills[a.team]++;
  const bonus=a.streak>=3?STREAK_BONUS:0;const reward=KILL_REWARD+bonus;a.money=Math.min(MONEY_CAP,a.money+reward);
  addFeed(a,v,wk,hs);
  if(a.isPlayer){killNote(v,hs,a.streak);moneyPop(reward,bonus?`連殺 ×${a.streak}`:'擊殺獎勵');hitMark(true);sfxTone([880,1320],.18,.18,'triangle');setTimeout(()=>sfxTone([1568,2093],.12,.1),90);}
  if(v.isPlayer){showDeath();}
  if(!v.isPlayer&&v.mesh){v.mesh.flash.visible=false;}
}
function botFire(e,tg,dist){
  if(e.healT>0)return;
  const k=curW(e),w=W[k],a=e.ammo[k],ai=e.ai,D=DIFF[difficulty];
  a.mag--;e.fireCd=60/w.rpm;if(!w.silent)e.lastShotT=gameTime;e.spawnProt=0;
  let p=w.botAcc*D.acc*(dist<=w.range?1:Math.max(.1,1-(dist-w.range)/(w.range*1.2)));
  if(Math.hypot(tg.vel.x,tg.vel.z)>2)p*=.78;if(Math.hypot(e.vel.x,e.vel.z)>1)p*=.82;p*=Math.min(1,.5+ai.seeT*.6);
  if(!tg.onGround)p*=.7;if(e.gloves)p*=1.12;
  let total=0,hs=false;
  for(let i=0;i<w.pellets;i++){if(Math.random()<clamp(p,.03,.92)){const h=Math.random()<.12*D.acc;hs=hs||h;total+=w.dmg*(h?headMul(tg):1)*falloff(w,dist);}}
  const fwd=new THREE.Vector3(-Math.sin(e.yaw),0,-Math.cos(e.yaw)),rt=new THREE.Vector3(Math.cos(e.yaw),0,-Math.sin(e.yaw));
  const m=new THREE.Vector3(e.pos.x,e.pos.y+1.34,e.pos.z).addScaledVector(fwd,.4+(-e.mesh.tip||.3)*1.25).addScaledVector(rt,.15);
  const end=chestOf(tg);if(total<=0){end.x+=rand(-1.2,1.2);end.y+=rand(-.4,.9);end.z+=rand(-1.2,1.2);}
  addTracer(m,end);e.mesh.flash.position.copy(m);e.mesh.flash.visible=true;e.mesh.flashT=.05;
  const pd=P.pos.distanceTo(e.pos);sfxShot(w.look,clamp(1-pd/70,0,1)*(w.silent?.14:.32));
  alertNearby(e,w.silent?8:32);
  if(total>0)damage(tg,e,total,k,hs);
}
const _fw=new THREE.Vector3(),_rt=new THREE.Vector3(),_up=new THREE.Vector3(),_dir=new THREE.Vector3(),_eye=new THREE.Vector3();
function playerFire(){
  const e=P,k=curW(e),w=W[k],a=e.ammo[k];
  a.mag--;e.fireCd=60/w.rpm;if(!w.silent)e.lastShotT=gameTime;e.spawnProt=0;
  camera.getWorldDirection(_fw);_rt.set(1,0,0).applyQuaternion(camera.quaternion);_up.set(0,1,0).applyQuaternion(camera.quaternion);
  _eye.copy(camera.position);
  const moving=Math.hypot(e.vel.x,e.vel.z)/5.6;
  let sp;
  if(w.scope)sp=scoped?(w.scopeSpread+moving*.03):w.spread+moving*.05;else sp=w.spread+moving*.02;
  sp+=e.bloom+(e.onGround?0:.05);
  const hits=new Map();let hsAny=false;const netDirs=[];
  for(let i=0;i<w.pellets;i++){
    const ang=Math.random()*PI*2,r=Math.sqrt(Math.random())*sp;
    _dir.copy(_fw).addScaledVector(_rt,Math.cos(ang)*r).addScaledVector(_up,Math.sin(ang)*r).normalize();netDirs.push([_dir.x,_dir.y,_dir.z]);
    const wallT=rayWorld(_eye,_dir,200);
    let bestT=wallT,bestE=null,bestH=false;
    for(const o of ents){if(o.team===e.team||!o.alive)continue;
      const th=raySphere(_eye,_dir,headOf(o,_a),.22);if(th<bestT){bestT=th;bestE=o;bestH=true;}
      const tb=rayCapsule(_eye,_dir,o.pos.x,o.pos.y+.25,o.pos.y+1.38,o.pos.z,.33);if(tb<bestT){bestT=tb;bestE=o;bestH=false;}}
    const end=_b.copy(_eye).addScaledVector(_dir,Math.min(bestT,200));
    if(i<3){const m=new THREE.Vector3().copy(_eye).addScaledVector(_rt,.18).addScaledVector(_up,-.14).addScaledVector(_fw,.55);addTracer(m,end.clone());}
    if(bestE){const d=bestT;const dmg=w.dmg*(bestH?headMul(bestE):1)*falloff(w,d);const h=hits.get(bestE)||{d:0,hs:false};h.d+=dmg;h.hs=h.hs||bestH;hits.set(bestE,h);addPuff(end.clone(),true);}
    else if(wallT<200&&i<4)addPuff(end.clone(),false);
  }
  let killed=false;
  if(online){online.net.send('fire',{wk:k,ts:Math.round(online.net.serverNow()-INTERP_MS),o:[_eye.x,_eye.y,_eye.z],d:netDirs});}
  else{hits.forEach((h,o)=>{hsAny=hsAny||h.hs;if(damage(o,e,h.d,k,h.hs))killed=true;});
  if(hits.size&&!killed){hitMark(false);sfxTone([1400],.05,.08,'square');}}
  // recoil
  const gl=e.gloves?.6:1,rk=(scoped?.5:1)*gl;e.pitch=Math.min(1.45,e.pitch+w.recoil*.012*rk);e.yaw+=rand(-1,1)*w.recoil*.004*rk;e.bloom=Math.min(.06,e.bloom+w.recoil*.01*gl);
  vmKick=Math.min(.12,vmKick+.02+w.recoil*.03);if(vmFlash){const fl=(vmFlash2&&(dualSide=!dualSide))?vmFlash2:vmFlash;fl.visible=true;fl.material.rotation=Math.random()*PI;flashT=.045;}
  sfxShot(w.look,w.silent?.16:.42);alertNearby(e,w.silent?8:32);
  if(w.bolt){setTimeout(()=>sfxTone([360,290],.05,.1,'square'),380);setTimeout(()=>sfxTone([520,430],.05,.1,'square'),760);}
}

function meleeHit(e,w,dmg,wk){
  const fx=-Math.sin(e.yaw),fz=-Math.cos(e.yaw);let best=null,bd=1e9;eyeOf(e,_e1);
  for(const o of ents){if(o.team===e.team||!o.alive||o.remote)continue;const dx=o.pos.x-e.pos.x,dz=o.pos.z-e.pos.z,d=Math.hypot(dx,dz);
    if(d>w.range||Math.abs(o.pos.y-e.pos.y)>1.2)continue;if((dx*fx+dz*fz)/Math.max(d,.01)<(w.arc||.6))continue;if(!los(_e1,chestOf(o,_c1)))continue;if(d<bd){bd=d;best=o;}}
  if(best){const back=isBehind(e,best);const killed=damage(best,e,back?Math.max(110,dmg*1.5):dmg,wk,false);if(!killed){hitMark(false);sfxTone([520],.06,.1,'square');}
    addPuff(chestOf(best),true);}
}
function playerMelee(kind,charge){
  const e=P,wk=curW(e),w=W[wk];kind=kind||'swing';
  let dmg=w.dmg;if(kind==='heavy'&&w.charge)dmg=w.dmg+(w.charge.max-w.dmg)*clamp(charge/w.charge.time,0,1);
  e.fireCd=60/w.rpm*(kind==='heavy'?1.2:1);e.spawnProt=0;e.lastShotT=gameTime;vmKick=kind==='heavy'?.16:.12;sfxSwish(kind==='heavy'?.5:.35);
  if(online){online.net.send('melee',{ts:Math.round(online.net.serverNow()-INTERP_MS),kind,charge:charge||0});return;}
  meleeHit(e,w,dmg,wk);
}
// katana right click: short dash that cuts the first enemy in its path
function startDash(){
  const e=P,w=W[curW(e)];e.dashT=w.dash.time;e.dashCd=w.dash.cd;e.dashHit=false;e.dashDir={x:-Math.sin(e.yaw),z:-Math.cos(e.yaw)};e.spawnProt=0;vmKick=.2;sfxSwish(.55);
  if(online)online.net.send('melee',{ts:Math.round(online.net.serverNow()-INTERP_MS),kind:'dash',yaw:e.yaw});
}
function dashStep(e,dt){
  const w=W[curW(e)];e.dashT-=dt;const sp=w.dash.dist/w.dash.time;e.vel.x=e.dashDir.x*sp;e.vel.z=e.dashDir.z*sp;
  if(online||e.dashHit)return;
  for(const o of ents){if(o.team===e.team||!o.alive)continue;const dx=o.pos.x-e.pos.x,dz=o.pos.z-e.pos.z,d=Math.hypot(dx,dz);
    if(d<1.3&&(dx*e.dashDir.x+dz*e.dashDir.z)>-.2){e.dashHit=true;e.dashT=0;const killed=damage(o,e,w.dash.dmg,curW(e),false);if(!killed){hitMark(false);sfxTone([520],.06,.1,'square');}addPuff(chestOf(o),true);break;}}
}
function botMelee(e,tg){
  if(e.healT>0)return;
  const w=W.knife,D=DIFF[difficulty];e.fireCd=60/w.rpm+rand(.05,.2);e.lastShotT=gameTime;e.spawnProt=0;
  sfxSwish(clamp(1-P.pos.distanceTo(e.pos)/25,0,1)*.3);
  if(Math.random()<.75*D.acc)damage(tg,e,isBehind(e,tg)?110:w.dmg,'knife',false);
}

/* ================= AI ================= */
function angDiff(a,b){let d=b-a;while(d>PI)d-=2*PI;while(d<-PI)d+=2*PI;return d;}
function turnTo(a,b,max){const d=angDiff(a,b);return a+clamp(d,-max,max);}
const _e1=new THREE.Vector3(),_c1=new THREE.Vector3();
function findTarget(e){
  let best=null,bd=1e9;eyeOf(e,_e1);
  for(const o of ents){
    if(o.team===e.team||!o.alive||o.spawnProt>0)continue;
    const dx=o.pos.x-e.pos.x,dz=o.pos.z-e.pos.z,d=Math.hypot(dx,dz);if(d>90)continue;
    const want=Math.atan2(-dx,-dz);
    const fov=Math.abs(angDiff(e.yaw,want))<1.15||d<7||(e.ai.alertBy===o&&gameTime-e.ai.alertT<2.5)||e.ai.target===o;
    if(!fov)continue;
    if(!los(_e1,chestOf(o,_c1))&&!los(_e1,headOf(o,_c1)))continue;
    if(d<bd){bd=d;best=o;}
  }
  if(best&&e.team===P.team)best.spottedT=gameTime;
  return best;
}
function nextGoal(e){
  const ai=e.ai;
  if(!ai.route.length){
    const pk=a=>a[(Math.random()*a.length)|0];
    const mm=mirOf(MAP);let pts=MAP.lanes?[...pk(MAP.lanes),pk(MAP.cpoi)]:[pk(MAP.poi),pk(MAP.cpoi),mm(pk(MAP.poi))];if(e.team===1)pts=pts.map(mm);
    ai.route=pts.map(p=>({x:p[0]+rand(-1,1),z:p[1]+rand(-1,1)}));
  }
  return ai.route.shift();
}
function updateBot(e,dt){
  const ai=e.ai,D=DIFF[difficulty];
  if(e.burstLeft>0&&e.fireCd<=0&&e.reloadT<=0&&e.swapT<=0){const bw=W[curW(e)],tg=e.burstTarget,a=e.ammo[curW(e)];
    if(bw.burst&&tg&&tg.alive&&a&&a.mag>0){botFire(e,tg,Math.hypot(tg.pos.x-e.pos.x,tg.pos.z-e.pos.z));e.burstLeft--;if(!e.burstLeft)e.fireCd+=bw.burstDelay*rand(1,1.7);}else e.burstLeft=0;}
  if(ai.target&&(!ai.target.alive||ai.target.spawnProt>0))ai.target=null;
  ai.scanT-=dt;
  if(ai.scanT<=0){ai.scanT=rand(.1,.18);const t=findTarget(e);if(t!==ai.target){if(t&&!ai.target){ai.seeT=0;ai.react=D.react*rand(.8,1.3);}ai.target=t;}}
  if(e.medkit&&e.healT<=0&&!ai.target&&e.hp<55)startHeal(e);
  let wk=curW(e),w=W[wk];
  let mx=0,mz=0;
  if(ai.target){
    const tg=ai.target;ai.seeT+=dt;ai.lastSeen=tg.pos.clone();ai.lastSeenT=gameTime;
    const dx=tg.pos.x-e.pos.x,dz=tg.pos.z-e.pos.z,dist=Math.hypot(dx,dz)||.01;
    const want=Math.atan2(-dx,-dz);e.yaw=turnTo(e.yaw,want,8*dt);
    if(dist<1.9&&e.slot!==3&&!(e.ammo[wk]&&e.ammo[wk].mag>0))switchSlot(e,3);
    else if(e.slot===3&&dist>4&&(hasAmmo(e,1)||hasAmmo(e,2)))switchSlot(e,hasAmmo(e,1)?1:2);
    wk=curW(e);w=W[wk];
    ai.strafeT-=dt;if(ai.strafeT<=0){ai.strafeT=rand(.4,1.1);const r=Math.random();ai.strafeDir=r<.4?-1:r<.8?1:0;}
    let adv=0;if(w.range<=25&&dist>w.range*.7)adv=1;if(dist<3)adv=-.5;if(w.melee)adv=dist>1.2?1:0;
    let sd=w.scope?0:ai.strafeDir;
    const sp=2.8*w.speed*(e.boots?1.12:1)*(inWater(e.pos.x,e.pos.z)?.6:1)*(e.healT>0?.6:1);mx=(-dz/dist*sd+dx/dist*adv)*sp;mz=(dx/dist*sd+dz/dist*adv)*sp;
    const ang=Math.abs(angDiff(e.yaw,want));ai.burstPause-=dt;
    if(ai.seeT>=ai.react&&ang<.2&&e.fireCd<=0&&e.reloadT<=0&&e.swapT<=0&&ai.burstPause<=0&&!(e.burstLeft>0)){
      if(w.melee){if(dist<=W[e.melee||'knife'].range)botMelee(e,tg);}
      else{const a=e.ammo[wk];
      if(a.mag<=0){if(!startReload(e)&&e.slot===1)switchSlot(e,2);}
      else if(w.burst){e.burstLeft=w.burst;e.burstTarget=tg;}
      else{botFire(e,tg,dist);
        if(w.auto){ai.burst++;if(ai.burst>=ai.burstLen){ai.burst=0;ai.burstLen=3+((Math.random()*5)|0);ai.burstPause=rand(.12,.32)/D.acc;}}
        else e.fireCd+=rand(.08,.3)*(1.3-D.acc*.5);}}
    }
  }else{
    ai.seeT=0;
    const a=e.ammo[wk];if(a&&a.mag<magCap(e,wk)*.35)startReload(e);
    if(e.slot===3)switchSlot(e,e.primary?1:2);else if(e.slot===2&&e.primary&&e.reloadT<=0)switchSlot(e,1);
    const hunting=ai.lastSeen&&gameTime-ai.lastSeenT<6;
    let goal;
    if(hunting){goal=ai.lastSeen;if(Math.hypot(goal.x-e.pos.x,goal.z-e.pos.z)<1.5){ai.lastSeen=null;goal=null;}}
    if(!goal){if(!ai.goal||Math.hypot(ai.goal.x-e.pos.x,ai.goal.z-e.pos.z)<1.6){ai.goal=nextGoal(e);}goal=ai.goal;}
    ai.repathT-=dt;
    if(!ai.path||ai.repathT<=0||ai.pathGoal!==goal){ai.path=findPath(e.pos,goal);ai.pathGoal=goal;ai.repathT=rand(1.2,2.2);if(!ai.path){ai.goal=null;ai.lastSeen=null;}}
    if(ai.path){
      while(ai.path.length&&Math.hypot(ai.path[0].x-e.pos.x,ai.path[0].z-e.pos.z)<.55)ai.path.shift();
      if(ai.path.length){const n=ai.path[0];const dx=n.x-e.pos.x,dz=n.z-e.pos.z,d=Math.hypot(dx,dz)||1;const sp=5.2*W[curW(e)].speed*(e.boots?1.12:1)*(inWater(e.pos.x,e.pos.z)?.6:1)*(hunting?.85:1)*(e.healT>0?.6:1);
        mx=dx/d*sp;mz=dz/d*sp;e.yaw=turnTo(e.yaw,Math.atan2(-dx,-dz),6*dt);}
      else if(goal===ai.goal)ai.goal=null;
    }
    // stuck check
    ai.stuckT+=dt;if(ai.stuckT>1.2){const moved=Math.hypot(e.pos.x-ai.lastX,e.pos.z-ai.lastZ);if(moved<.4&&(mx||mz)){ai.path=null;ai.goal=null;ai.lastSeen=null;ai.route=[];}ai.stuckT=0;ai.lastX=e.pos.x;ai.lastZ=e.pos.z;}
  }
  const k=1-Math.exp(-10*dt);e.vel.x+=(mx-e.vel.x)*k;e.vel.z+=(mz-e.vel.z)*k;
  physics(e,dt);
}
function syncBotMesh(e,dt){
  const m=e.mesh;m.root.position.copy(e.pos);m.root.rotation.y=e.yaw;
  if(!e.alive){e.deadT+=dt;const t=Math.min(1,e.deadT/.35);m.root.rotation.x=t*1.45;m.root.position.y=e.pos.y+Math.sin(t*PI)*.1;m.legL.rotation.x=m.legR.rotation.x=0;return;}
  m.root.rotation.x=0;
  const sp=Math.hypot(e.vel.x,e.vel.z);e.walk+=sp*dt*2.2;const sw=Math.sin(e.walk)*Math.min(1,sp/3)*.6;m.legL.rotation.x=sw;m.legR.rotation.x=-sw;
  if(m.flashT>0){m.flashT-=dt;if(m.flashT<=0)m.flash.visible=false;}
}

/* ================= STATE / INPUT ================= */
let state='menu',paused=false,matchLen=600,timeLeft=600,teamKills=[0,0],difficulty='std',sensMul=1.4;
const keys={};let trigger=false,shotLatch=false,rightHeld=false,scoped=false,locked=false,noLock=false,boardOpen=false,buyOpen=false;
let prevRight=false,vmKick=0,vmBob=0,flashT=0,touchJump=false;
const joy={id:null,x0:0,y0:0,dx:0,dy:0},look={id:null,x:0,y:0};

function requestLock(){if(isTouch||noLock)return;try{const r=canvas.requestPointerLock();if(r&&r.catch)r.catch(lockFailed);}catch(err){lockFailed();}}
let everLocked=false;
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===canvas;if(locked)everLocked=true;
  if(!locked&&state==='play'&&!buyOpen&&!noLock&&!isTouch){setPause(true);}});
function lockFailed(){if(!everLocked)noLock=true;else if(state==='play'&&!buyOpen&&!locked)setPause(true);}
document.addEventListener('pointerlockerror',lockFailed);
function setPause(p,mode){paused=p;$('pause').hidden=!p;$('quitBtn').textContent=online?'離開房間並回到主選單':'結束並回到主選單';
  const start=mode==='start';$('pauseEyebrow').textContent=start?'MATCH START':'PAUSED';$('pauseTitle').textContent=start?'對戰開始':'暫停中';
  $('pauseText').textContent=start?'點「進入對戰」鎖定滑鼠就能開始移動和射擊。對戰時間已經在跑了。':'點擊繼續後會鎖定滑鼠。按 Esc 可隨時暫停。';$('resumeBtn').textContent=start?'進入對戰':'繼續';if(p){trigger=false;for(const k in keys)keys[k]=false;}}
canvas.addEventListener('mousedown',ev=>{
  if(state!=='play'||paused||buyOpen)return;
  if(!locked&&!noLock&&!isTouch){requestLock();return;}
  if(ev.button===0)trigger=true;if(ev.button===2)rightHeld=true;
});
window.addEventListener('mouseup',ev=>{if(ev.button===0){trigger=false;}if(ev.button===2)rightHeld=false;});
canvas.addEventListener('contextmenu',ev=>ev.preventDefault());
window.addEventListener('mousemove',ev=>{
  if(state!=='play'||paused||buyOpen||!P||!P.alive)return;
  if(!locked&&!noLock)return;
  const s=.0016*sensMul*(scoped?camera.fov/75:1);P.yaw-=ev.movementX*s;P.pitch=clamp(P.pitch-ev.movementY*s,-1.45,1.45);
});
window.addEventListener('keydown',ev=>{
  if(state!=='play')return;
  if(ev.code==='Tab'){ev.preventDefault();showBoard(true);return;}
  if(ev.code==='Space')ev.preventDefault();
  if(ev.repeat)return;
  keys[ev.code]=true;
  if(paused)return;
  if(ev.code==='KeyB'){toggleBuy();return;}
  if(buyOpen){if(ev.code==='Escape')toggleBuy(false);return;}
  if(ev.code==='KeyM'){muted=!muted;return;}
  if(!P.alive)return;
  if(ev.code==='KeyR')startReload(P);
  if(ev.code==='KeyH')startHeal(P);
  if(ev.code==='Digit1')switchSlot(P,1);
  if(ev.code==='Digit2')switchSlot(P,2);
  if(ev.code==='Digit3')switchSlot(P,3);
  if(ev.code==='KeyQ')switchSlot(P,(P.lastSlot===1&&!P.primary)?2:(P.lastSlot||2));
});
window.addEventListener('keyup',ev=>{keys[ev.code]=false;if(ev.code==='Tab')showBoard(false);});
window.addEventListener('blur',()=>{for(const k in keys)keys[k]=false;trigger=false;});
window.addEventListener('wheel',ev=>{if(state==='play'&&!paused&&!buyOpen&&P&&P.alive)cycleSlot(P,ev.deltaY>0?1:-1);},{passive:true});

// touch
if(isTouch){
  $('touch').classList.add('on');$('keysHelp').textContent='左側拖曳移動 · 右側拖曳轉視角 · 右下按鈕射擊、換彈、切換武器 · 在購買區點「購買」';
  const tl=$('touch');
  tl.addEventListener('touchstart',ev=>{if(state!=='play'||paused)return;for(const t of ev.changedTouches){
    if(t.target.closest('.tbtn'))continue;
    if(t.clientX<innerWidth*.45&&joy.id===null){joy.id=t.identifier;joy.x0=t.clientX;joy.y0=t.clientY;joy.dx=joy.dy=0;const jb=$('joyBase');jb.style.display='block';jb.style.left=(t.clientX-60)+'px';jb.style.top=(t.clientY-60)+'px';$('joyKnob').style.transform='';}
    else if(look.id===null){look.id=t.identifier;look.x=t.clientX;look.y=t.clientY;}
  }ev.preventDefault();},{passive:false});
  tl.addEventListener('touchmove',ev=>{for(const t of ev.changedTouches){
    if(t.identifier===joy.id){let dx=t.clientX-joy.x0,dy=t.clientY-joy.y0;const d=Math.hypot(dx,dy),m=48;if(d>m){dx*=m/d;dy*=m/d;}joy.dx=dx/m;joy.dy=dy/m;$('joyKnob').style.transform=`translate(${dx}px,${dy}px)`;}
    else if(t.identifier===look.id&&P&&P.alive){const s=.0048*(sensMul/1.4)*(scoped?camera.fov/75:1);P.yaw-=(t.clientX-look.x)*s;P.pitch=clamp(P.pitch-(t.clientY-look.y)*s,-1.45,1.45);look.x=t.clientX;look.y=t.clientY;}
  }ev.preventDefault();},{passive:false});
  const endT=ev=>{for(const t of ev.changedTouches){if(t.identifier===joy.id){joy.id=null;joy.dx=joy.dy=0;$('joyBase').style.display='none';}if(t.identifier===look.id)look.id=null;}};
  tl.addEventListener('touchend',endT);tl.addEventListener('touchcancel',endT);
  const hold=(id,on,off)=>{const b=$(id);b.addEventListener('touchstart',ev=>{ev.preventDefault();ev.stopPropagation();on();},{passive:false});b.addEventListener('touchend',ev=>{ev.preventDefault();off&&off();});b.addEventListener('touchcancel',()=>{off&&off();});};
  hold('tFire',()=>{trigger=true;},()=>{trigger=false;});
  hold('tReload',()=>{if(P.alive)startReload(P);});
  hold('tSwap',()=>{if(P.alive)cycleSlot(P,1);});
  hold('tScope',()=>{if(W[curW(P)].melee)rightHeld=true;else rightHeld=!rightHeld;},()=>{if(W[curW(P)].melee)rightHeld=false;});
  hold('tBuy',()=>{toggleBuy();});
  hold('tHeal',()=>{startHeal(P);});
  hold('tBoard',()=>{showBoard(!boardOpen);});
}

/* ================= HUD ================= */
const fmtMoney=n=>'$'+n.toLocaleString('en-US');
const fmtTime=t=>{t=Math.max(0,Math.ceil(t));return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');};
function addFeed(a,v,wk,hs){
  const el=document.createElement('div');el.className='kf'+(a.isPlayer||v.isPlayer?' me':'');
  el.innerHTML=`<span class="n t${a.team}"></span><span class="w">${W[wk].name.split(' ')[0]}</span>${hs?'<span class="hs">HS</span>':''}<span class="n t${v.team}"></span>`;
  el.children[0].textContent=a.name;el.lastElementChild.textContent=v.name;
  const f=$('feed');f.prepend(el);while(f.children.length>6)f.lastChild.remove();setTimeout(()=>el.remove(),6000);
}
function killNote(v,hs,streak){
  const el=document.createElement('div');el.className='kn';
  el.innerHTML=`<span class="tag">ELIMINATED</span><span class="nm"></span>${hs?'<span class="hs">爆頭</span>':''}${streak>=3?`<span class="tag" style="color:var(--coin)">×${streak} 連殺</span>`:''}`;
  el.querySelector('.nm').textContent='擊殺 '+v.name;
  const k=$('killNote');k.prepend(el);while(k.children.length>3)k.lastChild.remove();setTimeout(()=>el.remove(),2200);
}
function moneyPop(n,label){const el=document.createElement('div');el.className='pop';el.innerHTML=`<span class="coin"></span>+$${n}<small></small>`;el.querySelector('small').textContent=label;$('popups').appendChild(el);setTimeout(()=>el.remove(),1250);sfxTone([1318,1760],.12,.12);}
let hitTO;function hitMark(k){const h=$('hit');h.classList.toggle('kill',!!k);h.classList.add('show');clearTimeout(hitTO);hitTO=setTimeout(()=>h.classList.remove('show'),k?260:110);}
let hurtTO;function hurtFx(a){
  const dx=a.pos.x-P.pos.x,dz=a.pos.z-P.pos.z;const ya=Math.atan2(-dx,-dz);const rel=angDiff(P.yaw,ya);
  const hd=$('hurtDir');hd.style.transform=`rotate(${-rel*180/PI}deg)`;hd.classList.add('show');$('vignette').style.opacity=clamp(1-P.hp/HP_MAX,.25,.8);
  clearTimeout(hurtTO);hurtTO=setTimeout(()=>{hd.classList.remove('show');$('vignette').style.opacity=0;},350);
  sfxTone([180],.08,.12,'sawtooth');
}
function showDeath(){$('deathScr').hidden=false;const k=P.killer;$('deathBy').innerHTML=`你被 <b></b> 以 ${W[P.killerW].name} 擊殺`;$('deathBy').querySelector('b').textContent=k.name;scoped=false;rightHeld=false;}
let lastHud={};
function setText(id,v){if(lastHud[id]!==v){lastHud[id]=v;$(id).textContent=v;}}
function updateHud(){
  const e=P,k=curW(e),w=W[k],a=e.ammo[k]||{mag:0,reserve:0};
  setText('hpNum',String(Math.max(0,Math.ceil(e.hp))));
  const f=$('hpFill');f.style.transform=`scaleX(${Math.max(0,e.hp)/HP_MAX})`;f.classList.toggle('low',e.hp<35);
  $('armorChip').hidden=!e.armor||!e.alive;$('bootsChip').hidden=!e.boots||!e.alive;$('glovesChip').hidden=!e.gloves||!e.alive;$('medkitChip').hidden=!e.medkit||!e.alive;$('helmetChip').hidden=!e.helmet||!e.alive;
  {const mg=Object.keys(GEAR).filter(g=>GEAR[g].mag&&e[g]).map(g=>GEAR[g].name.replace('擴充彈匣',''));setText('magChip','擴充彈匣：'+mg.join('、'));$('magChip').hidden=!mg.length||!e.alive;}$('protChip').hidden=!(e.spawnProt>0&&e.alive);
  setText('moneyNum',fmtMoney(e.money));
  let area='';if(e.alive)for(const a of MAP.areas){const q=mirOf(MAP)([a.x,a.z]);if(Math.hypot(e.pos.x-a.x,e.pos.z-a.z)<7.5||Math.hypot(e.pos.x-q[0],e.pos.z-q[1])<7.5){area=a.n+' '+a.name+'（'+a.sub+'）';break;}}
  setText('areaTag',area||MAP.name);
  setText('killsA',String(teamKills[0]));setText('killsB',String(teamKills[1]));
  setText('timeNum',fmtTime(timeLeft));$('clock').classList.toggle('warn',timeLeft<=30);
  setText('wName',w.name);
  let skill='';if(e.healT>0)skill=`注射醫療針 ${e.healT.toFixed(1)} 秒 · 被擊中會中斷`;else if(w.dash)skill=e.dashCd>0?`拔刀斬 冷卻 ${e.dashCd.toFixed(1)} 秒`:'右鍵 衝刺拔刀斬 · 就緒';else if(w.charge)skill=e.chargeT>0?`蓄力中 ${Math.round(w.dmg+(w.charge.max-w.dmg)*Math.min(1,e.chargeT/w.charge.time))} 傷害${e.chargeT>=w.charge.time?' · 已達上限':''}`:'按住右鍵蓄力 · 放開重擊';
  setText('skillTag',skill);$('skillTag').hidden=!skill;$('skillTag').classList.toggle('cool',!!(w.dash&&e.dashCd>0));setText('magNum',w.melee?'—':String(a.mag));setText('resNum',w.melee?'近戰':String(a.reserve));
  $('ammoBox').classList.toggle('empty',!w.melee&&a.mag===0);
  setText('slot1','1 '+(e.primary?W[e.primary].name.split(' ')[0]:'主武器 —'));setText('slot2','2 '+W[e.secondary].name.split(' ')[0]);setText('slot3','3 '+W[e.melee||'knife'].name);
  $('slot1').classList.toggle('on',e.slot===1&&!!e.primary);$('slot2').classList.toggle('on',e.slot===2||(e.slot===1&&!e.primary));$('slot3').classList.toggle('on',e.slot===3);
  const rb=$('reloadBar');if(e.reloadT>0){rb.style.visibility='visible';$('reloadFill').style.transform=`scaleX(${1-e.reloadT/W[e.reloadKey].reload})`;}else rb.style.visibility='hidden';
  const zone=e.alive&&inBuyZone(e);$('zoneChip').hidden=!zone||buyOpen;if(isTouch){$('tBuy').hidden=!zone;$('tHeal').hidden=!(e.medkit&&e.alive);$('tScope').hidden=!(w.scope||w.dash||w.charge);$('tScope').textContent=w.dash?'拔刀':w.charge?'蓄力':'開鏡';}
  if(buyOpen&&!zone)toggleBuy(false,true);
  const moving=Math.hypot(e.vel.x,e.vel.z)/5.6;
  let sp=w.scope?(scoped?w.scopeSpread:w.spread):w.spread;sp+=e.bloom+moving*(w.scope&&!scoped?.05:.02)+(e.onGround?0:.05);
  $('cross').style.setProperty('--gap',(CH.gap+(CH.dynamic&&!w.melee?sp*innerHeight*.9:0)).toFixed(1)+'px');
  $('cross').style.visibility=(scoped||!e.alive)?'hidden':'visible';
  $('scope').hidden=!scoped;
  if(buyOpen)setText('buyMoney',fmtMoney(e.money));
}
// minimap
const mini=$('mini'),mctx=mini.getContext('2d');let miniBase=null,miniT=0;
const KIND_COL={bldg:'#5f6d78',spawn:'#7b8791',low:'#a88f3a',log:'#7a5a36',rail:'#7a5a36',crate:'#8a6f45',tall:'#6b7550',rack:'#6a5a44',machine:'#56705e',container:'#9a4a3c',hut:'#8a6a44',tower:'#a07a4a',rock:'#8a8a82',mound:'#c9d3dc',tree:'#3f7a34',radio:'#b0bac4',sea:'#2f6f8a',bollard:'#3a4046',pillar:'#e0a92a',stair:'#9aa39a',deck:'#7c8e9e',parapet:'#6a747d'};
function drawMapTo(g,sol,def,s,withAreas){
  g.fillStyle='#1b2833';g.fillRect(0,0,82*s,58*s);
  for(const w of rects(def.water)){g.fillStyle='#2f6f8a';g.fillRect((w.minX-B.minX)*s,(w.minZ-B.minZ)*s,(w.maxX-w.minX)*s,(w.maxZ-w.minZ)*s);}
  for(const b of rects(def.bridge)){g.fillStyle='#8a6a44';g.fillRect((b.minX-B.minX)*s,(b.minZ-B.minZ)*s,(b.maxX-b.minX)*s,(b.maxZ-b.minZ)*s);}
  g.fillStyle='rgba(61,139,255,.3)';g.fillRect(0,(29-BZ.z)*s,(41-BZ.x)*s,BZ.z*2*s);g.fillStyle='rgba(255,90,58,.3)';g.fillRect((41+BZ.x)*s,(29-BZ.z)*s,(41-BZ.x)*s,BZ.z*2*s);
  for(const b of sol){if(b.kind==='outer')continue;g.fillStyle=KIND_COL[b.kind]||'#777';
    if(b.kind==='tree'){g.beginPath();g.arc((b.cx-B.minX)*s,(b.cz-B.minZ)*s,1.6*s,0,PI*2);g.fill();continue;}
    g.fillRect((b.minX-B.minX)*s,(b.minZ-B.minZ)*s,(b.maxX-b.minX)*s,(b.maxZ-b.minZ)*s);}
  if(withAreas)for(const a of def.areas){const x=(a.x-B.minX)*s,y=(a.z-B.minZ)*s;g.fillStyle='rgba(10,16,22,.85)';g.beginPath();g.arc(x,y,6,0,PI*2);g.fill();g.strokeStyle=def.accent;g.lineWidth=1.5;g.stroke();
    g.fillStyle='#fff';g.font='bold 9px "Chakra Petch",sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(String(a.n),x,y+.5);}
}
function drawMiniBase(){miniBase=document.createElement('canvas');miniBase.width=205;miniBase.height=145;drawMapTo(miniBase.getContext('2d'),solids,MAP,2.5,true);}
function drawMini(){
  const s=2.5;mctx.drawImage(miniBase,0,0);
  for(const o of ents){if(!o.alive||o.isPlayer)continue;
    if(o.team!==P.team&&gameTime-o.spottedT>1.5&&gameTime-o.lastShotT>1.2)continue;
    mctx.fillStyle=o.team?'#ff5a3a':'#6aa6ff';mctx.beginPath();mctx.arc((o.pos.x-B.minX)*s,(o.pos.z-B.minZ)*s,3.2,0,PI*2);mctx.fill();}
  if(P.alive){const x=(P.pos.x-B.minX)*s,y=(P.pos.z-B.minZ)*s,a=Math.atan2(-Math.cos(P.yaw),-Math.sin(P.yaw));
    mctx.save();mctx.translate(x,y);mctx.rotate(a);mctx.fillStyle='#fff';mctx.beginPath();mctx.moveTo(7,0);mctx.lineTo(-4,-4.5);mctx.lineTo(-2,0);mctx.lineTo(-4,4.5);mctx.closePath();mctx.fill();mctx.restore();}
}
// scoreboard
function boardHTML(){
  const rows=t=>ents.filter(e=>e.team===t).sort((a,b)=>b.kills-a.kills||a.deaths-b.deaths).map(e=>`<tr class="${e.isPlayer?'me':''} ${e.alive?'':'dead'}"><td>${esc(tagName(e))}</td><td>${e.kills}</td><td>${e.deaths}</td><td>${fmtMoney(e.money)}</td></tr>`).join('');
  return [0,1].map(t=>`<table class="team-t t${t}"><caption>TEAM ${t?'B':'A'} · ${teamKills[t]} KILLS</caption><thead><tr><th>玩家</th><th>擊殺</th><th>死亡</th><th>金幣</th></tr></thead><tbody>${rows(t)}</tbody></table>`).join('');
}
function esc(s){return s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function showBoard(on){boardOpen=on;$('board').hidden=!on;if(on)$('boardGrid').innerHTML=boardHTML();}

/* ================= BUY MENU ================= */
const SIL={
  pistol:[[28,12,44,9],[32,20,11,16],[43,20,8,4]],
  magnum:[[22,10,52,11],[26,21,12,16],[40,21,8,4]],
  smg:[[26,12,44,11],[70,15,14,4],[46,23,7,14],[36,23,7,9],[12,14,14,5]],
  shotgun:[[4,14,30,8],[34,12,32,10],[66,12,30,5],[60,19,24,6],[40,22,7,8]],
  rifle:[[6,14,24,9],[30,11,40,12],[70,13,24,4],[52,23,8,14],[38,23,7,9],[36,7,26,3]],
  sniper:[[2,14,28,10],[30,12,34,10],[64,15,34,3],[34,4,28,6],[44,22,7,8]],
  revolver:[[40,12,48,6],[42,18,44,3],[30,10,14,12],[22,20,12,16],[84,8,3,4]],h9:[[22,9,52,11],[26,20,13,17],[40,20,8,4]],
  rapid:[[30,12,36,11],[66,15,12,4],[46,23,7,17],[36,23,7,9],[16,14,14,4]],autoshot:[[6,14,26,9],[32,11,34,12],[66,12,30,5],[60,18,20,6],[44,23,10,12]],
  carbine:[[14,14,20,8],[34,11,32,11],[66,13,16,4],[50,22,7,13],[38,22,7,9],[42,6,10,5]],burst:[[6,14,24,9],[30,10,40,13],[70,13,22,4],[52,23,8,12],[38,23,7,9],[40,5,22,5]],
  tactical:[[4,14,26,9],[30,11,36,11],[66,14,30,3],[36,5,20,5],[48,22,7,8],[40,22,6,8]],dmr:[[2,13,28,11],[30,11,38,12],[68,14,30,3],[36,4,24,6],[50,23,8,9],[40,23,6,8]],
  scout:[[4,14,26,8],[30,13,32,8],[62,15,34,2],[36,6,22,5],[58,11,6,3],[42,21,6,7]],
  katana:[[4,18,20,5],[24,14,3,12],[27,18,68,3],[27,17,66,1]],axe:[[8,19,70,4],[70,7,14,26],[66,15,6,8]],
  knife:[[14,17,26,7],[40,13,5,15],[45,17,44,5],[45,17,50,2]],
  dual:[[8,6,40,8],[12,13,10,14],[50,18,40,8],[54,25,10,14]],
  mp7:[[30,12,34,10],[64,15,12,4],[40,22,7,14],[56,22,5,8],[16,14,14,4],[40,8,10,4]],
  battle:[[4,14,26,9],[30,11,38,12],[68,14,26,3],[36,5,22,5],[50,22,7,12],[40,22,6,8]],
  lmg:[[6,13,22,10],[28,10,40,13],[68,14,28,4],[38,23,14,11],[82,18,2,10],[86,18,2,10],[44,6,14,4]],
  heavy:[[6,12,22,11],[28,9,46,15],[74,14,24,5],[40,24,16,12],[80,19,4,9]],
};
const GEAR_SVG={armor:'M36 4h8l6 6 6-6h8l6 8v24H30V12z',boots:'M34 4h16v18l18 5c4 1 6 4 6 8v2H34z',gloves:'M36 37V17l3-11 4 1-1 10 3-13 4 1-2 13 4-12 4 1-3 13 4-8 4 2-6 16v7z',medkit:'M30 16h34v8H30zM64 18h10v4H64zM74 19.3h14v1.4H74zM22 12h4v16h-4zM26 18h4v4h-4zM38 12h3v4h-3zM48 12h3v4h-3z'};
GEAR_SVG.helmet='M30 30c0-14 9-24 20-24s20 10 20 24h6v5H24v-5z';
const MAG_SVG='M42 4h16l-2 32H44zM46 9h8v3h-8zM46 15h8v3h-8zM46 21h8v3h-8z';
function silSVG(look){if(/^mag_/.test(look))return `<svg viewBox="0 0 100 40" aria-hidden="true"><path fill-rule="evenodd" d="${MAG_SVG}"/></svg>`;if(GEAR_SVG[look])return `<svg viewBox="0 0 100 40" aria-hidden="true"><path d="${GEAR_SVG[look]}"/></svg>`;return `<svg viewBox="0 0 100 40" aria-hidden="true">${SIL[look].map(r=>`<rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}"/>`).join('')}</svg>`;}
let buySel='rifle';
function itemInfo(k){if(GEAR[k])return{name:GEAR[k].name,cls:'裝備',price:priceOf(k),look:k};return Object.assign({},W[k],{price:priceOf(k)});}
function owned(k){return GEAR[k]?!!P[k]:(P.primary===k||P.secondary===k||P.melee===k);}
function statsHTML(k){
  if(GEAR[k])return `<p>${GEAR[k].desc}</p>`;
  const w=W[k];let rows;
  if(w.melee)rows=[['傷害',w.dmg/130,w.dmg+'（背刺 110）'],['攻擊速度',w.rpm/900,w.rpm+' 次/分'],['攻擊距離',w.range/3.5,w.range+' m'],['移動速度',(w.speed-.6)/.4,Math.round(w.speed*100)+'%']];
  else rows=[['傷害',w.dmg*w.pellets/130,w.pellets>1?`${w.dmg}×${w.pellets}`:w.dmg],['射速',Math.min(1,w.rpm/900),w.burst?`${w.burst} 連發`:w.rpm+' rpm'],['彈匣',w.mag/100,(P&&magCap(P,k)>w.mag?`${w.mag}（擴充 ${magCap(P,k)}）`:w.mag)+' / '+w.reserve],['裝填速度',(5.2-w.reload)/4.5,w.reload+' s'],['後座力',w.recoil/1.6,w.recoil.toFixed(2)],['射程',w.range/90,w.range+' m'],['精準度',1-(w.scope?w.scopeSpread:w.spread)/.1,Math.round((1-(w.scope?w.scopeSpread:w.spread)/.1)*100)+(w.scope?'（開鏡）':'')],['移動速度',(w.speed-.6)/.4,Math.round(w.speed*100)+'%']];
  const tags=w.tags?`<div class="tags">${w.tags.map(t=>`<span>${t}</span>`).join('')}</div>`:'';
  return tags+`<div class="stats">${rows.map(r=>`<span>${r[0]}</span><i style="--v:${Math.round(clamp(r[1],.04,1)*100)}%"></i><em>${r[2]}</em>`).join('')}</div>`;
}
const ARMORY=[{sec:'預設配備 DEFAULT',items:['p9','knife']},...SHOP.map(g=>({sec:g.group+((g.group.startsWith('裝備')||g.group.startsWith('擴充'))?' · 死亡後消失':''),items:g.items}))];
function renderArmory(){
  const slotName={1:'主武器 · 按 1',2:'手槍 · 按 2',3:'近戰 · 按 3'};
  $('armNote').textContent=priceLabel();
  $('armBody').innerHTML=ARMORY.map(g=>`<div class="arm-sec">${g.sec}</div><div class="arm-grid">${g.items.map(k=>{
    const gear=!!GEAR[k],it=gear?{name:GEAR[k].name,look:k}:W[k],pr=priceOf(k);
    return `<div class="arm-it"><div class="slot">${gear?'裝備':slotName[W[k].slot]}</div>${silSVG(it.look)}<div class="arm-top"><b>${esc(it.name)}</b>${pr?`<span class="pr">${fmtMoney(pr)}</span>`:'<span class="pr free">免費配發</span>'}</div>${gear?'':`<p>${WDESC[k]}</p>`}${statsHTML(k)}</div>`;}).join('')}</div>`).join('');
}
$('armoryBtn').addEventListener('click',()=>{renderArmory();$('armory').hidden=false;});
$('armClose').addEventListener('click',()=>{$('armory').hidden=true;});
function renderBuy(){
  const list=$('buyList');list.innerHTML='';
  SHOP.forEach(sec=>{const h=document.createElement('div');h.className='bgroup';h.textContent=sec.group;list.appendChild(h);
    sec.items.forEach(k=>{const it=itemInfo(k);const b=document.createElement('button');b.type='button';b.className='bitem'+(P.money<it.price&&!owned(k)?' poor':'');b.setAttribute('aria-selected',String(buySel===k));
      b.innerHTML=`${silSVG(it.look)}<span class="nm"></span>${owned(k)?'<span class="own">已持有</span>':`<span class="pr">${fmtMoney(it.price)}</span>`}`;
      b.querySelector('.nm').innerHTML=`${esc(it.name)}<small>${it.cls}</small>`;
      b.addEventListener('click',()=>{buySel=k;renderBuy();});b.addEventListener('dblclick',()=>{doBuy(k);});list.appendChild(b);});});
  const k=buySel,it=itemInfo(k),d=$('buyDetail');
  const stats=statsHTML(k);
  const can=!owned(k)&&P.money>=it.price&&inBuyZone(P);
  const label=owned(k)?'已持有':P.money<it.price?`金幣不足（差 ${fmtMoney(it.price-P.money)}）`:`購買 ${fmtMoney(it.price)}`;
  d.innerHTML=`${silSVG(it.look)}<h3>${esc(it.name)}<small>${it.cls}${!GEAR[k]?' · '+WDESC[k]:''}</small></h3>${stats}<button class="buybtn" id="buyBtn" type="button" ${can?'':'disabled'}>${label}</button>`;
  $('buyBtn').addEventListener('click',()=>doBuy(k));
  $('buyMoney').textContent=fmtMoney(P.money);
  $('buyMul').textContent=priceLabel();
}
function priceLabel(){const m=PRICE_MUL[matchLen]||1;return m===1?'商店原價':`${matchLen/60} 分鐘賽制 · 全品項 ${Math.round(m*100)}% 價格`;}
function doBuy(k){if(buy(P,k)){sfxTone([660,990],.1,.12,'triangle');renderBuy();}}
function toggleBuy(force,noRelock){
  const want=force===undefined?!buyOpen:force;
  if(want&&(!P.alive||!inBuyZone(P)))return;
  buyOpen=want;$('buy').hidden=!want;trigger=false;
  if(want){renderBuy();if(locked)document.exitPointerLock();}
  else if(!noRelock){requestLock();}
}
$('buyClose').addEventListener('click',()=>toggleBuy(false));

/* ================= LOOP ================= */
function updatePlayer(dt){
  const e=P;
  if(!e.alive){
    e.respawnT-=dt;$('deathCd').textContent=Math.max(1,Math.ceil(e.respawnT));
    camera.position.set(e.pos.x,e.pos.y+.5,e.pos.z);camera.rotation.set(-.2,e.yaw,.35);
    if(e.respawnT<=0&&!online){spawn(e);$('deathScr').hidden=true;if(!locked&&!noLock&&!isTouch&&everLocked)setPause(true);}
    return;
  }
  let f=0,s=0;
  if(!buyOpen){if(keys.KeyW||keys.ArrowUp)f+=1;if(keys.KeyS||keys.ArrowDown)f-=1;if(keys.KeyD||keys.ArrowRight)s+=1;if(keys.KeyA||keys.ArrowLeft)s-=1;}
  if(joy.id!==null){f-=joy.dy;s+=joy.dx;}
  const len=Math.hypot(f,s);if(len>1){f/=len;s/=len;}
  const k=curW(e),w=W[k];
  const rPress=rightHeld&&!prevRight;prevRight=rightHeld;e.dashCd=Math.max(0,(e.dashCd||0)-dt);
  const healing=e.healT>0;
  if(w.dash&&rPress&&e.dashCd<=0&&e.swapT<=0&&!buyOpen&&!healing)startDash();
  const charging=!!w.charge&&rightHeld&&!buyOpen&&e.swapT<=0&&!healing;
  if(w.charge){if(charging){if(e.fireCd<=0)e.chargeT=Math.min(w.charge.time,(e.chargeT||0)+dt);}else{if(e.chargeT>.12)playerMelee('heavy',e.chargeT);e.chargeT=0;}}else e.chargeT=0;
  scoped=rightHeld&&!!w.scope&&e.reloadT<=0&&e.swapT<=0&&!healing&&!(w.bolt&&e.fireCd>.12);
  const spd=5.6*w.speed*(e.boots?1.12:1)*(inWater(e.pos.x,e.pos.z)?.6:1)*(scoped?.55:1)*(charging?.7:1)*(healing?.6:1);
  const fx=-Math.sin(e.yaw),fz=-Math.cos(e.yaw),rx=Math.cos(e.yaw),rz=-Math.sin(e.yaw);
  const tvx=(fx*f+rx*s)*spd,tvz=(fz*f+rz*s)*spd;const kk=1-Math.exp(-(e.onGround?14:2.5)*dt);
  e.vel.x+=(tvx-e.vel.x)*kk;e.vel.z+=(tvz-e.vel.z)*kk;
  if(e.dashT>0)dashStep(e,dt);
  physics(e,dt);
  // fire
  if(healing){}
  else if(trigger&&!buyOpen&&w.melee){if(e.fireCd<=0&&e.swapT<=0&&!charging)playerMelee('swing');}
  else if(trigger&&!buyOpen){const a=e.ammo[k];
    if(e.fireCd<=0&&e.reloadT<=0&&e.swapT<=0){
      if(a.mag>0){if(w.burst){if(!shotLatch&&!(e.burstLeft>0)){e.burstLeft=w.burst;shotLatch=true;}}else if(w.auto||!shotLatch){playerFire();shotLatch=true;}}
      else if(!shotLatch){if(!startReload(e)&&e.slot===1)switchSlot(e,2);shotLatch=true;sfxTone([300],.04,.06,'square');}
    }}
  if(e.burstLeft>0&&e.fireCd<=0&&e.reloadT<=0&&e.swapT<=0&&!healing){const a=e.ammo[k];if(w.burst&&a&&a.mag>0){playerFire();e.burstLeft--;if(!e.burstLeft)e.fireCd+=w.burstDelay;}else e.burstLeft=0;}
  if(!trigger)shotLatch=false;
  if(e.ammo[k]&&e.ammo[k].mag===0&&e.reloadT<=0&&e.ammo[k].reserve>0&&!trigger)startReload(e);
  // buy zone: refill reserve
  if(inBuyZone(e))for(const kk2 in e.ammo){e.ammo[kk2].reserve=W[kk2].reserve;}
  // spotted check
  camera.position.set(e.pos.x,e.pos.y+1.6,e.pos.z);camera.rotation.set(e.pitch,e.yaw,0);
  const tf=scoped?w.scope:75;if(Math.abs(camera.fov-tf)>.1){camera.fov+=(tf-camera.fov)*Math.min(1,dt*18);camera.updateProjectionMatrix();}
  // viewmodel anim
  if(vmGun){const b=vmGun.userData.base,sp=Math.hypot(e.vel.x,e.vel.z)/5.6;vmBob+=dt*9*sp;vmKick=Math.max(0,vmKick-dt*.6);
    const rel=e.reloadT>0?Math.sin(clamp(1-e.reloadT/W[e.reloadKey].reload,0,1)*PI):0,sw=e.swapT>0?e.swapT/.35:0,cw=W[curW(e)],bp=(cw.bolt&&e.fireCd>0)?Math.sin(clamp((1-e.fireCd/(60/cw.rpm)-.15)/.7,0,1)*PI):0;
    vmHeal+=((e.healT>0?1:0)-vmHeal)*Math.min(1,dt*10);
    vmGun.position.set(b[0]+Math.sin(vmBob)*.012*sp,b[1]+Math.abs(Math.cos(vmBob))*.012*sp-rel*.18-sw*.25-bp*.05-vmHeal*.3,b[2]+vmKick);
    if(W[curW(e)].melee){const cf=e.chargeT&&W[curW(e)].charge?e.chargeT/W[curW(e)].charge.time:0;vmGun.rotation.set(-vmKick*4+cf*.9,vmKick*7-cf*.3,-vmKick*3+cf*.4);vmGun.position.z+=cf*.08;}else vmGun.rotation.set(vmKick*2.2+rel*.6+bp*.15,bp*.2,rel*.3+bp*.45);vmGun.visible=!scoped;
    if(flashT>0){flashT-=dt;if(flashT<=0){vmFlash.visible=false;if(vmFlash2)vmFlash2.visible=false;}}}
}
let spotT=0,aimT=0;
// enemy name under the crosshair, only with line of sight (no wallhack)
function updateAimName(){
  const el=$('aimName');if(!P.alive||state!=='play'){el.hidden=true;return;}
  camera.getWorldDirection(_fw);const o=camera.position;const wallT=rayWorld(o,_fw,90);let best=null,bt=wallT;
  for(const e of ents){if(e===P||e.team===P.team||!e.alive)continue;const r=S.rayEntity(o,_fw,e.pos);if(r.t<bt){bt=r.t;best=e;}}
  if(best){if(el.textContent!==tagName(best))el.textContent=tagName(best);el.hidden=false;}else el.hidden=true;
}
function update(dt){
  gameTime+=dt;
  if(online)timeLeft=Math.max(0,(online.endAt-online.net.serverNow())/1000);
  else{timeLeft-=dt;if(timeLeft<=0){timeLeft=0;endMatch();return;}}
  for(const e of ents){if(e.alive){weaponTimers(e,dt);e.spawnProt=Math.max(0,e.spawnProt-dt);}}
  updatePlayer(dt);
  aimT-=dt;if(aimT<=0){aimT=.1;updateAimName();}
  for(const e of ents){if(e.isPlayer)continue;
    if(e.remote){updateRemote(e,dt);syncBotMesh(e,dt);continue;}
    if(e.alive)updateBot(e,dt);else{e.respawnT-=dt;if(e.respawnT<=0)spawn(e);}
    syncBotMesh(e,dt);}
  separate();
  spotT-=dt;if(spotT<=0&&P.alive){spotT=.2;eyeOf(P,_e1);camera.getWorldDirection(_fw);
    for(const o of ents){if(o.team===P.team||!o.alive)continue;_d.subVectors(chestOf(o,_c1),_e1);const L=_d.length();if(L>80)continue;if(_d.dot(_fw)/L<.64)continue;if(los(_e1,_c1))o.spottedT=gameTime;}}
  updateFx(dt);updateSnow(dt);
  if(online){online.sendT-=dt;if(online.sendT<=0){online.sendT=1/SEND_HZ;const r=v=>Math.round(v*100)/100;online.net.send('state',{s:[r(P.pos.x),r(P.pos.y),r(P.pos.z),Math.round(P.yaw*1000)/1000,Math.round(P.pitch*1000)/1000,curW(P),P.alive?1:0]});}}
  updateHud();
  miniT-=dt;if(miniT<=0){miniT=.08;drawMini();}
  if(boardOpen)$('boardGrid').innerHTML=boardHTML();
}
let orbit=0;
function menuCam(dt){orbit+=dt*.05;camera.position.set(Math.cos(orbit)*38,mapId==='indoor'?6.5:21,Math.sin(orbit)*27);updateSnow(dt);camera.lookAt(0,0,0);if(camera.fov!==60){camera.fov=60;camera.updateProjectionMatrix();}
  for(const e of ents)if(!e.isPlayer)syncBotMesh(e,0);}
function render(){
  renderer.clear();renderer.render(scene,camera);
  if(state==='play'&&P.alive&&vmGun){renderer.clearDepth();vmCam.fov=60;renderer.render(vmScene,vmCam);}
}
let last=performance.now();
function frame(now){
  requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000);last=now;
  if(state==='play'&&!paused)update(dt);else if(state==='menu'||state==='end')menuCam(dt);
  render();
}
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();vmCam.aspect=w/h;vmCam.updateProjectionMatrix();}

/* ================= MATCH FLOW ================= */
function startMatch(){
  let rolled=null;if(!online&&mapChoice==='random'){rolled=randomMap();loadMap(rolled,true);}
  initAudio();if(AC&&AC.state==='suspended')AC.resume();
  state='play';paused=false;gameTime=0;timeLeft=matchLen;teamKills=[0,0];lastHud={};
  $('menu').hidden=true;$('endScr').hidden=true;$('hud').hidden=false;$('deathScr').hidden=true;$('feed').innerHTML='';$('killNote').innerHTML='';
  for(const e of ents){e.money=START_MONEY;e.kills=0;e.deaths=0;e.streak=0;e.alive=false;e.pos.set(9999,0,9999);}
  for(const e of ents)spawn(e);
  if(online){if(!isTouch&&!noLock)setPause(true,'start');}else requestLock();
  if(rolled)mapToast(rolled);
  document.querySelectorAll('#score .plate').forEach((el,i)=>el.classList.toggle('mine',i===P.team));
}
function endMatch(){
  state='end';trigger=false;scoped=false;buyOpen=false;$('buy').hidden=true;$('board').hidden=true;$('deathScr').hidden=true;$('pause').hidden=true;
  if(locked)document.exitPointerLock();
  $('hud').hidden=true;const [a,b]=teamKills;const mine=teamKills[P.team],theirs=teamKills[1-P.team];const r=$('resultTxt');
  if(mine>theirs){r.textContent='勝利 VICTORY';r.className='result win';}else if(mine<theirs){r.textContent='落敗 DEFEAT';r.className='result lose';}else{r.textContent='平手 DRAW';r.className='result draw';}
  $('finA').textContent=a;$('finB').textContent=b;$('endGrid').innerHTML=boardHTML();$('endScr').hidden=false;
  // online: the room stays open, so the natural next step is back to the lobby (auto after a short countdown)
  clearInterval(endTimer);
  if(online){let n=15;$('menuBtn').textContent='離開房間';const tick=()=>{$('againBtn').textContent=`回到房間（${n}）`;if(n--<=0){clearInterval(endTimer);backToRoom();}};tick();endTimer=setInterval(tick,1000);}
  else{$('againBtn').textContent='再來一場';$('menuBtn').textContent='主選單';}
  sfxTone(mine>=theirs?[523,659,784]:[392,330,262],.35,.15,'triangle');
}
let endTimer=0;
function backToRoom(){clearInterval(endTimer);if(!online||state!=='end')return;$('endScr').hidden=true;openOnline();}
function toMenu(){clearInterval(endTimer);if(!online&&ents.some(e=>e.remote))offlineRoster();state='menu';$('endScr').hidden=true;$('pause').hidden=true;$('hud').hidden=true;$('deathScr').hidden=true;$('menu').hidden=false;paused=false;if(locked)document.exitPointerLock();}
$('startBtn').addEventListener('click',startMatch);
$('againBtn').addEventListener('click',()=>{if(online)backToRoom();else startMatch();});
$('menuBtn').addEventListener('click',()=>{if(online)leaveOnline();toMenu();});
$('resumeBtn').addEventListener('click',()=>{setPause(false);requestLock();});
$('quitBtn').addEventListener('click',()=>{setPause(false);if(online){leaveOnline();toMenu();}else endMatch();});
function seg(id,cb){const s=$(id);s.addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b)return;s.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));cb(b.dataset.v);});}
seg('segTime',v=>{matchLen=+v;$('priceNote').textContent=priceLabel();});seg('segDiff',v=>{difficulty=v;});
$('sens').addEventListener('input',ev=>{sensMul=+ev.target.value;});

/* ================= CROSSHAIR SETTINGS ================= */
const CH_DEF={style:'cross',color:'#ffffff',len:8,th:2,gap:4,dot:false,outline:true,dynamic:true,scStyle:'mil',scColor:'#07090b',scDot:true};
let CH=Object.assign({},CH_DEF);
try{const sv=JSON.parse(localStorage.getItem('dustline-crosshair')||'null');if(sv&&typeof sv==='object')Object.assign(CH,sv);}catch(err){}
function saveCH(){try{localStorage.setItem('dustline-crosshair',JSON.stringify(CH));}catch(err){}}
function styleCross(el,gap){
  if(!el.children.length)el.innerHTML='<i class="l t"></i><i class="l b"></i><i class="l lf"></i><i class="l r"></i><i class="ring"></i><i class="d"></i>';
  el.className='xh s-'+CH.style+(CH.outline?' ol':'')+((CH.dot||CH.style==='dot')?' dot':'');
  el.style.setProperty('--col',CH.color);el.style.setProperty('--len',CH.len+'px');el.style.setProperty('--th',CH.th+'px');
  if(gap!==undefined)el.style.setProperty('--gap',gap+'px');
}
// scope reticle drawn as SVG in a 200x200 box centred on 0,0 (radius 100 = edge of the scope)
const SC_COLORS=['#07090b','#e0332b','#35d16a','#f2f5f8'];
function scopeSVG(st,col,dot){
  const dark=col==='#07090b',halo=dark?'rgba(255,255,255,.28)':'rgba(0,0,0,.35)',HOUSING='#07090b';
  const ticks=[30,40,50,60].map(d=>`M${d} -2.2V2.2M${-d} -2.2V2.2M-2.2 ${d}H2.2M-2.2 ${-d}H2.2`).join('');
  const parts=[];   // [path or cRADIUS, stroke width]; the two rings are the scope housing and stay dark
  if(st==='duplex')parts.push(['M-100 0H-28M28 0H100M0 -100V-28M0 28V100',3.4],['M-28 0H28M0 -28V28',.7]);
  else if(st==='german')parts.push(['M-100 0H-9M9 0H100M0 100V9',4.6],['M0 -100V0',.8]);
  else if(st==='dot')parts.push(['M-90 0H-40M40 0H90M0 -90V-40M0 40V90',.8],['c5',.8]);
  else parts.push(['M-100 0H-86M86 0H100M0 -100V-86M0 86V100',4],['M-90 0H-70M70 0H90M0 -90V-70M0 70V90',1.1],['M-24 0H-9M9 0H24M0 -24V-9M0 9V24'+ticks,.7],['c7',.7]);
  const el=(p,w,stroke)=>p[0]==='c'?`<circle r="${p.slice(1)}" fill="none" stroke="${stroke}" stroke-width="${w}"/>`:`<path d="${p}" fill="none" stroke="${stroke}" stroke-width="${w}"/>`;
  const dotCol=dark?'#d8342a':col;
  return `<svg viewBox="-100 -100 200 200" aria-hidden="true">${el('c90',2.5,'rgba(255,255,255,.28)')}${el('c98',6,HOUSING)}${el('c90',1.1,HOUSING)}${parts.filter(p=>p[1]<3).map(p=>el(p[0],p[1]+(dark?1.4:1),halo)).join('')}${parts.map(p=>el(p[0],p[1],col)).join('')}${dot?`<circle r="${st==='dot'?1.6:1}" fill="${dotCol}"/>`:''}</svg>`;
}
function applyScope(){const svg=scopeSVG(CH.scStyle,CH.scColor,CH.scDot);$('scope').innerHTML=svg;$('scDemo').innerHTML=svg;}
const XH_COLORS=['#ffffff','#3dff6e','#ffe03d','#3de8ff','#ff4dd2','#ff3b30'];
function syncXhUI(){
  $('xhStyle').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===CH.style)));
  $('xhColors').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===CH.color.toLowerCase())));
  $('xhCustom').value=CH.color;
  [['xhLen','len'],['xhTh','th'],['xhGap','gap']].forEach(([id,k])=>{$(id).value=CH[k];$(id+'V').textContent=CH[k]+' px';});
  $('xhDot').checked=CH.dot;$('xhOutline').checked=CH.outline;$('xhDyn').checked=CH.dynamic;
  styleCross($('xhDemo'),CH.gap);styleCross($('cross'),CH.gap);
  $('scStyle').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===CH.scStyle)));
  $('scColors').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===CH.scColor)));
  $('scDot').checked=CH.scDot;applyScope();
}
function initXhUI(){
  const changed=()=>{saveCH();syncXhUI();};
  $('xhColors').innerHTML=XH_COLORS.map(c=>`<button type="button" data-v="${c}" style="background:${c}" aria-label="顏色 ${c}"></button>`).join('');
  $('xhStyle').addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b)return;CH.style=b.dataset.v;changed();});
  $('xhColors').addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b)return;CH.color=b.dataset.v;changed();});
  $('xhCustom').addEventListener('input',ev=>{CH.color=ev.target.value;changed();});
  [['xhLen','len'],['xhTh','th'],['xhGap','gap']].forEach(([id,k])=>$(id).addEventListener('input',ev=>{CH[k]=+ev.target.value;changed();}));
  $('xhDot').addEventListener('change',ev=>{CH.dot=ev.target.checked;changed();});
  $('xhOutline').addEventListener('change',ev=>{CH.outline=ev.target.checked;changed();});
  $('xhDyn').addEventListener('change',ev=>{CH.dynamic=ev.target.checked;changed();});
  $('scColors').innerHTML=SC_COLORS.map(c=>`<button type="button" data-v="${c}" style="background:${c}" aria-label="鏡內顏色 ${c}"></button>`).join('');
  $('scStyle').addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b)return;CH.scStyle=b.dataset.v;changed();});
  $('scColors').addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b)return;CH.scColor=b.dataset.v;changed();});
  $('scDot').addEventListener('change',ev=>{CH.scDot=ev.target.checked;changed();});
  $('xhReset').addEventListener('click',()=>{CH=Object.assign({},CH_DEF);changed();});
  $('xhDone').addEventListener('click',()=>{$('xhScr').hidden=true;});
  const open=()=>{syncXhUI();$('xhScr').hidden=false;};
  $('xhBtn').addEventListener('click',open);$('xhBtn2').addEventListener('click',open);
  syncXhUI();
}

/* ================= MAP PICK ================= */
function loadMap(id,force){
  if(id===mapId&&MAP&&!force)return;
  buildMap(id);buildNav();drawMiniBase();
  for(const e of ents){e.alive=false;e.pos.set(9999,0,9999);}for(const e of ents)spawn(e);
  document.documentElement.style.setProperty('--map',MAPS[id].accent);
}
function initMapPick(){
  const box=$('mapPick');box.innerHTML='';
  MAP_ORDER.forEach(id=>{const d=MAPS[id];const b=document.createElement('button');b.type='button';b.className='mapc';b.setAttribute('aria-pressed',String(id===mapId));b.style.setProperty('--acc',d.accent);
    const cv=document.createElement('canvas');cv.width=164;cv.height=116;drawMapTo(cv.getContext('2d'),mapSolids(d),d,2,false);
    b.appendChild(cv);const t=document.createElement('span');t.className='mt';t.innerHTML=`<b>${d.name}</b><small>${d.en}</small>`;b.appendChild(t);
    const p=document.createElement('span');p.className='md';p.textContent=d.desc;b.appendChild(p);
    b.addEventListener('click',()=>{mapChoice=id;loadMap(id);box.querySelectorAll('.mapc').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});
    box.appendChild(b);});
  // random: resolved when the match starts
  const b=document.createElement('button');b.type='button';b.className='mapc';b.setAttribute('aria-pressed','false');b.style.setProperty('--acc','#f7b928');
  const cv=document.createElement('canvas');cv.width=164;cv.height=116;drawRandomCard(cv.getContext('2d'));b.appendChild(cv);
  const t=document.createElement('span');t.className='mt';t.innerHTML='<b>隨機</b><small>RANDOM</small>';b.appendChild(t);
  const p=document.createElement('span');p.className='md';p.textContent=`每局開始時從 ${MAP_ORDER.length} 張地圖中隨機抽一張。`;b.appendChild(p);
  b.addEventListener('click',()=>{mapChoice='random';box.querySelectorAll('.mapc').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});
  box.appendChild(b);
  document.documentElement.style.setProperty('--map',MAPS[mapId].accent);
}
let mapChoice='desert';
function randomMap(){return MAP_ORDER[(Math.random()*MAP_ORDER.length)|0];}
function drawRandomCard(g){
  const w=164,h=116;g.fillStyle='#1b2833';g.fillRect(0,0,w,h);
  MAP_ORDER.forEach((id,i)=>{const x=(i%3)*w/3,y=((i/3)|0)*h/2;g.fillStyle=MAPS[id].accent;g.globalAlpha=.28;g.fillRect(x+3,y+3,w/3-6,h/2-6);});
  g.globalAlpha=1;g.fillStyle='#f7b928';g.font='bold 64px "Chakra Petch",sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('?',w/2,h/2+4);
}
function mapToast(id){const d=MAPS[id];const el=document.createElement('div');el.className='kn';el.style.borderBottomColor=d.accent;
  el.innerHTML=`<span class="tag" style="color:${d.accent}">RANDOM MAP</span><span class="nm"></span>`;el.querySelector('.nm').textContent='本局地圖：'+d.name;
  const k=$('killNote');k.prepend(el);setTimeout(()=>el.remove(),4500);}

/* ================= ONLINE ================= */
let online=null; // { net, room, endAt, slot, sendT, remotes: Map<id, ent> }
function removeEnt(e){if(e.mesh){scene.remove(e.mesh.root);scene.remove(e.mesh.flash);}const i=ents.indexOf(e);if(i>=0)ents.splice(i,1);}
function offlineRoster(){
  for(const e of ents.slice())if(e!==P)removeEnt(e);
  if(!P){P=makeEnt(NAMES[0][0],0,true,'rifle');}
  P.team=0;P.name=NAMES[0][0];ents.length=0;ents.push(P);
  let s=1;
  for(let t=0;t<2;t++)for(let i=0;i<TEAM_SIZE;i++){if(!t&&!i)continue;ents.push(makeEnt(NAMES[t][i],t,false,STYLES[(s++)%STYLES.length]));}
  for(const e of ents)spawn(e);
}
function myName(){const v=$('olName').value.replace(/[<>&"']/g,'').trim().slice(0,MAX_NAME);return v||'玩家';}
function olStatus(msg,isErr){const el=$('olStatus');el.textContent=msg||'';el.classList.toggle('err',!!isErr);$('olHint').textContent=msg||'';}
async function ensureNet(){
  if(online&&online.net.ready)return online.net;
  const net=new Net();
  olStatus(`正在連線到 ${location.host}…`);
  await net.connect();
  online={net,room:null,endAt:0,slot:0,sendT:0,remotes:new Map()};
  net.on('room',m=>{online.room=m;renderLobby();});
  net.on('error',m=>olStatus(m.msg,true));
  net.on('start',startOnlineMatch);
  net.on('snap',applySnap);
  net.on('shot',remoteShot);
  net.on('gone',m=>{const e=online&&online.remotes.get(m.id);if(e){removeEnt(e);online.remotes.delete(m.id);}});
  net.on('end',m=>{if(state!=='play')return;if(m.tk)teamKills=m.tk;if(m.sc)for(const [id,k,d] of m.sc){const e=entById(id);if(e){e.kills=k;e.deaths=d;}}endMatch();});
  net.on('spawn',m=>{if(state!=='play')return;spawn(P);P.pos.set(m.x,m.y,m.z);P.yaw=m.yaw;P.pitch=0;$('deathScr').hidden=true;
    if(!locked&&!noLock&&!isTouch&&everLocked&&!paused&&!buyOpen)setPause(true);});
  net.on('you',m=>{Object.assign(P,{hp:m.hp,money:m.money,healT:m.healT||0,kills:m.kills,deaths:m.deaths});for(const g in GEAR)P[g]=!!(m.gear&&m.gear[g]);if(buyOpen)renderBuy();});
  net.on('bought',m=>{if(GEAR[m.key]){P[m.key]=true;if(GEAR[m.key].mag)for(const k in P.ammo)P.ammo[k].mag=Math.max(P.ammo[k].mag,magCap(P,k));}else if(W[m.key])giveWeapon(P,m.key);sfxTone([660,990],.1,.12,'triangle');if(buyOpen)renderBuy();});
  net.on('hurt',m=>{if(state!=='play')return;P.hp=m.hp;P.healT=0;hurtFx({pos:{x:m.x,z:m.z}});});
  net.on('hit',m=>{hitMark(m.kill);if(!m.kill)sfxTone([1400],.05,.08,'square');});
  net.on('kill',onlineKill);
  net.on('close',()=>{if(!online||online.net!==net)return;const wasPlaying=state==='play';online=null;
    if(wasPlaying)toMenu();$('olJoin').hidden=false;$('olLobby').hidden=true;olStatus('與伺服器的連線中斷了',true);});
  return net;
}
function openOnline(){$('menu').hidden=true;$('online').hidden=false;if(online&&online.room){renderLobby();}else{$('olJoin').hidden=false;$('olLobby').hidden=true;}}
function leaveOnline(){if(!online)return;const net=online.net;online=null;net.send('leave',{});net.close();offlineRoster();loadMap(mapId,true);}
function renderLobby(){
  const r=online&&online.room;if(!r)return;
  $('olJoin').hidden=true;$('olLobby').hidden=false;$('olCodeShow').textContent=r.code;
  const me=online.net.id,isHost=r.host===me;
  $('olTeams').innerHTML=[0,1].map(t=>{const ps=r.players.filter(p=>p.team===t);
    const nb=(r.bots||[0,0])[t];
    const rows=ps.map(p=>`<tr class="${p.id===me?'me':''}"><td>${esc(p.name)}${p.id===r.host?' <small class="host">房主</small>':''}</td></tr>`).join('')
      +Array.from({length:nb},()=>`<tr class="bot"><td>AI 電腦 <small class="aitag">${DIFF_NAME[r.settings.diff]||'標準'}</small></td></tr>`).join('')
      +Array.from({length:TEAM_SIZE-ps.length-nb},()=>'<tr class="empty"><td>空位</td></tr>').join('');
    const ctl=isHost?`<div class="ai-ctl"><button class="ghost" type="button" data-team="${t}" data-d="-1" ${nb?'':'disabled'}>－ AI</button><button class="ghost" type="button" data-team="${t}" data-d="1" ${ps.length+nb<TEAM_SIZE?'':'disabled'}>＋ AI</button></div>`:'';
    return `<div><table class="team-t t${t}"><caption>TEAM ${t?'B':'A'} · ${ps.length+nb}/${TEAM_SIZE}</caption><tbody>${rows}</tbody></table>${ctl}</div>`;}).join('');
  $('olDiff').querySelectorAll('button').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.v===r.settings.diff));b.disabled=!isHost;});
  $('olAiRow').hidden=!isHost;
  $('olMap').querySelectorAll('button').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.v===r.settings.map));b.disabled=!isHost;});
  $('olLen').querySelectorAll('button').forEach(b=>{b.setAttribute('aria-pressed',String(+b.dataset.v===r.settings.len));b.disabled=!isHost;});
  $('olStart').hidden=!isHost;
  $('olHint').textContent=isHost?(r.players.length<2?'把房間代碼傳給朋友，或用「＋ AI」補上電腦玩家。一個人也可以先開始測試。':'所有人到齊後按「開始對戰」。有真人加入時，AI 會自動讓出位置。'):'等待房主開始對戰…';
  if(MAPS[r.settings.map]&&r.settings.map!==mapId&&state!=='play')loadMap(r.settings.map);
}
function entById(id){if(!online)return null;return id===online.net.id?P:online.remotes.get(id);}
function onlineKill(m){
  if(state!=='play')return;
  const a=entById(m.k)||{name:'?',team:0},v=entById(m.v)||{name:'?',team:1};
  teamKills=m.tk;a.kills=m.kk;v.deaths=m.vd;a.streak=m.streak;
  addFeed(a,v,m.wk,m.hs);
  if(a===P){killNote(v,m.hs,m.streak);moneyPop(m.reward,m.reward>KILL_REWARD?`連殺 ×${m.streak}`:'擊殺獎勵');sfxTone([880,1320],.18,.18,'triangle');setTimeout(()=>sfxTone([1568,2093],.12,.1),90);}
  if(v===P){P.alive=false;P.hp=0;P.respawnT=RESPAWN;P.deadT=0;P.killer=a;P.killerW=m.wk;P.reloadT=0;trigger=false;showDeath();}
  else if(v.remote){if(v.alive)v.deadT=0;v.alive=false;v.mesh.flash.visible=false;}
}
function startOnlineMatch(m){
  clearInterval(endTimer);
  const me=m.players.find(p=>p.id===online.net.id);if(!me)return;
  $('online').hidden=true;$('endScr').hidden=true;
  for(const e of ents.slice())if(e!==P)removeEnt(e);
  online.remotes.clear();online.slot=me.slot||0;online.endAt=m.endAt;online.sendT=0;
  P.team=me.team;P.name=me.name;
  for(const pl of m.players){if(pl.id===me.id)continue;
    const e=makeEnt(pl.name,pl.team,false,'rifle',!!pl.bot);e.remote=true;e.netId=pl.id;e.buf=[];e.netW='p9';ents.push(e);online.remotes.set(pl.id,e);}
  matchLen=m.settings.len;
  loadMap(m.settings.map,true);
  for(const e of online.remotes.values()){e.alive=true;e.spawnProt=0;e.pos.set(9999,0,9999);e.mesh.root.visible=false;}
  startMatch();
  if(m.random)mapToast(m.settings.map);
}
function applySnap(m){
  if(!online||state!=='play')return;
  for(const r of m.p){const e=online.remotes.get(r[0]);if(!e)continue;
    e.buf.push({t:m.now,x:r[1],y:r[2],z:r[3],yaw:r[4],wk:r[6],alive:r[7]});if(e.buf.length>30)e.buf.shift();}
}
function updateRemote(e,dt){
  const buf=e.buf;if(!buf.length){e.mesh.root.visible=false;return;}
  const rt=online.net.serverNow()-INTERP_MS;
  let a=buf[0],b=buf[buf.length-1];
  for(let i=buf.length-1;i>0;i--){if(buf[i-1].t<=rt){a=buf[i-1];b=buf[i];break;}}
  const k=b.t>a.t?clamp((rt-a.t)/(b.t-a.t),0,1):1;
  const px=e.pos.x,pz=e.pos.z;
  e.pos.set(a.x+(b.x-a.x)*k,a.y+(b.y-a.y)*k,a.z+(b.z-a.z)*k);e.yaw=a.yaw+angDiff(a.yaw,b.yaw)*k;
  if(dt>0){e.vel.set((e.pos.x-px)/dt,0,(e.pos.z-pz)/dt);if(e.vel.length()>12)e.vel.set(0,0,0);}
  const alive=!!b.alive;if(!alive&&e.alive)e.deadT=0;e.alive=alive;e.mesh.root.visible=true;
  if(b.wk!==e.netW&&W[b.wk]){e.netW=b.wk;const w=W[b.wk];e.slot=w.slot;if(w.slot===1)e.primary=b.wk;else if(w.slot===2)e.secondary=b.wk;else e.melee=b.wk;setSoldierGun(e);}
}
function remoteShot(m){
  if(!online||state!=='play')return;const e=online.remotes.get(m.id);
  const o=new THREE.Vector3(...m.o);for(const p of m.e)addTracer(o,new THREE.Vector3(...p));
  if(e){e.lastShotT=gameTime;e.mesh.flash.position.copy(o);e.mesh.flash.visible=true;e.mesh.flashT=.05;}
  sfxShot(m.look,clamp(1-P.pos.distanceTo(o)/70,0,1)*.32);
}
const DIFF_NAME={easy:'新手',std:'標準',hard:'老手'};
function initOnlineUI(){
  $('olMap').innerHTML=MAP_ORDER.map(id=>`<button type="button" data-v="${id}">${MAPS[id].name}</button>`).join('')+'<button type="button" data-v="random">隨機</button>';
  $('olLen').innerHTML=MATCH_LENGTHS.map(v=>`<button type="button" data-v="${v}">${v/60} 分鐘</button>`).join('');
  try{const n=localStorage.getItem('fireline-name');if(n)$('olName').value=n;}catch(err){}
  $('olName').addEventListener('change',()=>{try{localStorage.setItem('fireline-name',myName());}catch(err){}});
  if(/\.github\.io$/i.test(location.hostname)){const b=$('onlineBtn');b.disabled=true;b.textContent='線上對戰（此網址僅限單機）';b.title='線上對戰要連到開伺服器的那台電腦';}
  $('onlineBtn').addEventListener('click',openOnline);
  $('olClose').addEventListener('click',()=>{$('online').hidden=true;$('menu').hidden=false;});
  $('olCreate').addEventListener('click',async()=>{try{initAudio();const net=await ensureNet();olStatus('已連上伺服器，正在建立房間…');net.send('create',{name:myName()});}catch(err){olStatus(err.message,true);}});
  const join=async()=>{const code=$('olCode').value.trim().toUpperCase();if(code.length!==4){olStatus('房間代碼是 4 個字元',true);return;}
    try{initAudio();const net=await ensureNet();olStatus(`已連上伺服器，正在加入房間 ${code}…`);net.send('join',{name:myName(),code});}catch(err){olStatus(err.message,true);}};
  $('olJoinBtn').addEventListener('click',join);$('olCode').addEventListener('keydown',ev=>{if(ev.key==='Enter')join();});
  $('olSwap').addEventListener('click',()=>{if(!online||!online.room)return;const me=online.room.players.find(p=>p.id===online.net.id);if(me)online.net.send('team',{team:1-me.team});});
  $('olStart').addEventListener('click',()=>{initAudio();if(online)online.net.send('start',{});});
  $('olLeave').addEventListener('click',()=>{leaveOnline();$('olJoin').hidden=false;$('olLobby').hidden=true;olStatus('');});
  $('olCopy').addEventListener('click',()=>{const c=$('olCodeShow').textContent;const done=()=>{$('olCopy').textContent='已複製';setTimeout(()=>$('olCopy').textContent='複製',1200);};
    try{navigator.clipboard.writeText(c).then(done,()=>{});}catch(err){}});
  $('olMap').addEventListener('click',ev=>{const b=ev.target.closest('button');if(b&&online)online.net.send('settings',{map:b.dataset.v});});
  $('olLen').addEventListener('click',ev=>{const b=ev.target.closest('button');if(b&&online)online.net.send('settings',{len:+b.dataset.v});});
  $('olDiff').addEventListener('click',ev=>{const b=ev.target.closest('button');if(b&&online)online.net.send('settings',{diff:b.dataset.v});});
  $('olTeams').addEventListener('click',ev=>{const b=ev.target.closest('button[data-team]');if(b&&online)online.net.send('bots',{team:+b.dataset.team,delta:+b.dataset.d});});
  $('olFill').addEventListener('click',()=>{if(online)online.net.send('bots',{fill:true});});
  $('olClear').addEventListener('click',()=>{if(online)online.net.send('bots',{clear:true});});
}

// dev helper: open the game with ?debug to inspect network state from the console
if(new URLSearchParams(location.search).has('debug'))window.__fireline={get online(){return online;},get P(){return P;},get ents(){return ents;},buy,get input(){return {rightHeld,trigger,noLock,locked,paused,buyOpen,state};}};

/* ================= BOOT ================= */
function start(){
  if(typeof THREE==='undefined'){document.body.insertAdjacentHTML('beforeend','<p style="position:fixed;inset:auto 16px 16px;color:#fff">3D 引擎載入失敗，請重新整理頁面。</p>');return;}
  renderer=new THREE.WebGLRenderer({canvas,antialias:!isTouch,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,isTouch?1:1.5));renderer.autoClear=false;
  if(!isTouch){renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;}
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(75,1,.05,320);camera.rotation.order='YXZ';
  vmScene=new THREE.Scene();vmCam=new THREE.PerspectiveCamera(60,1,.01,10);
  vmScene.add(new THREE.HemisphereLight(0xeef4ff,0x6b5d45,.9));const vl=new THREE.DirectionalLight(0xfff0d8,.7);vl.position.set(1,2,1);vmScene.add(vl);
  initXhUI();gunMats();makeFlashMat();setupScene();initFx();buildMap(mapId);buildNav();drawMiniBase();initMapPick();
  offlineRoster();
  initOnlineUI();
  resize();addEventListener('resize',resize);
  requestAnimationFrame(frame);
}
start();
