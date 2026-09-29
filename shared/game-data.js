// Shared by the browser client and the Node server. Pure data + pure helpers only.
/* ================= DATA ================= */
// slot 1 = primary, 2 = sidearm, 3 = melee. Every gun has a different job, not just "more damage".
const W={
  p9:      {name:'P9 標配手槍',       cls:'手槍',        slot:2,dmg:26, pellets:1,rpm:380, mag:12, reserve:48, reload:1.5,recoil:.35,range:25,speed:1.0, price:0,   auto:false,spread:.012,botAcc:.42,look:'pistol'},
  magnum:  {name:'M-44 麥格農',       cls:'手槍',        slot:2,dmg:48, pellets:1,rpm:170, mag:7,  reserve:35, reload:2.0,recoil:.9, range:35,speed:.98, price:500, auto:false,spread:.014,botAcc:.46,look:'magnum'},
  revolver:{name:'R-6 左輪手槍',      cls:'手槍',        slot:2,dmg:55, pellets:1,rpm:140, mag:6,  reserve:30, reload:2.8,recoil:1.0,range:45,speed:.98, price:600, auto:false,spread:.006,botAcc:.5, look:'revolver',tags:['六發','遠距精準','爆頭一擊']},
  h9:      {name:'H-9 重型手槍',      cls:'手槍',        slot:2,dmg:72, pellets:1,rpm:110, mag:6,  reserve:24, reload:2.2,recoil:1.25,range:30,speed:.97,price:700, auto:false,spread:.016, botAcc:.48,look:'h9',tags:['爆頭一擊']},
  dual:    {name:'D-9 雙槍',          cls:'手槍',        slot:2,dmg:24, pellets:1,rpm:520, mag:30, reserve:90, reload:3.0,recoil:.4, range:22,speed:.98, price:800, auto:false,spread:.022,botAcc:.42,look:'dual',tags:['雙持']},
  knife:   {name:'小刀',              cls:'近戰',        slot:3,dmg:50, pellets:1,rpm:130, mag:0,  reserve:0,  reload:0,  recoil:0,  range:2.1,speed:1.1,price:0,   auto:true, spread:0,   botAcc:.75,look:'knife',melee:true,tags:['背刺 110']},
  katana:  {name:'武士刀',            cls:'近戰',        slot:3,dmg:65, pellets:1,rpm:100, mag:0,  reserve:0,  reload:0,  recoil:0,  range:2.6,speed:1.05,price:1200,auto:true,spread:0,  botAcc:.75,look:'katana',melee:true,dash:{cd:5,dist:6.5,time:.22,dmg:100},tags:['右鍵 衝刺拔刀斬','冷卻 5 秒']},
  axe:     {name:'戰斧',              cls:'近戰',        slot:3,dmg:60, pellets:1,rpm:80,  mag:0,  reserve:0,  reload:0,  recoil:0,  range:2.3,speed:.96, price:900, auto:true,spread:0,  botAcc:.75,look:'axe',melee:true,charge:{time:1.5,max:130},tags:['按住右鍵蓄力','最高 130 傷害']},
  smg:     {name:'V-9 衝鋒槍',        cls:'衝鋒槍',      slot:1,dmg:22, pellets:1,rpm:850, mag:30, reserve:120,reload:2.1,recoil:.25,range:22,speed:.97, price:1500,auto:true, spread:.026,botAcc:.36,look:'smg',tags:['穩定']},
  rapid:   {name:'SM-12 速射衝鋒槍',  cls:'衝鋒槍',      slot:1,dmg:16, pellets:1,rpm:1100,mag:50, reserve:150,reload:2.4,recoil:.42,range:16,speed:.98, price:1800,auto:true, spread:.036,botAcc:.34,look:'rapid',tags:['極高射速']},
  shotgun: {name:'BR-12 泵動霰彈槍',  cls:'霰彈槍',      slot:1,dmg:17, pellets:8,rpm:70,  mag:6,  reserve:30, reload:2.6,recoil:1.1,range:10,speed:.93, price:2000,auto:false,spread:.085,botAcc:.5, look:'shotgun',tags:['一發爆發']},
  autoshot:{name:'S-12 自動霰彈槍',   cls:'霰彈槍',      slot:1,dmg:11, pellets:8,rpm:230, mag:8,  reserve:32, reload:3.0,recoil:.8, range:9, speed:.92, price:3000,auto:false,spread:.095,botAcc:.48,look:'autoshot',tags:['連續射擊']},
  carbine: {name:'K-8 卡賓槍',        cls:'突擊步槍',    slot:1,dmg:28, pellets:1,rpm:720, mag:30, reserve:90, reload:2.0,recoil:.32,range:35,speed:.96, price:2300,auto:true, spread:.018,botAcc:.43,look:'carbine',tags:['高機動']},
  burst:   {name:'Burst-4 四連發步槍',cls:'突擊步槍',    slot:1,dmg:30, pellets:1,rpm:900, burst:4,burstDelay:.38,mag:32,reserve:96,reload:2.3,recoil:.34,range:50,speed:.9,price:2400,auto:false,spread:.009,botAcc:.5,look:'burst',tags:['四連發']},
  rifle:   {name:'AR-7 突擊步槍',     cls:'突擊步槍',    slot:1,dmg:32, pellets:1,rpm:600, mag:30, reserve:90, reload:2.4,recoil:.45,range:45,speed:.9,  price:2700,auto:true, spread:.015,botAcc:.45,look:'rifle',tags:['全自動']},
  tactical:{name:'R-5 戰術步槍',      cls:'半自動步槍',  slot:1,dmg:55, pellets:1,rpm:240, mag:15, reserve:45, reload:2.4,recoil:.7, range:60,speed:.88, price:3200,auto:false,spread:.006,botAcc:.5, look:'tactical',tags:['半自動','爆頭一擊']},
  dmr:     {name:'DMR-6 精準射手步槍',cls:'精準射手步槍',slot:1,dmg:75, pellets:1,rpm:170, mag:10, reserve:30, reload:2.8,recoil:.95,range:75,speed:.85, price:3800,auto:false,spread:.012,scope:40,scopeSpread:.0025,botAcc:.55,look:'dmr',tags:['半自動','瞄準鏡 ×2']},
  scout:   {name:'SV-2 輕型栓動步槍', cls:'栓動步槍',    slot:1,dmg:88, pellets:1,rpm:48,  mag:10, reserve:30, reload:2.6,recoil:1.0,range:80,speed:.97, price:2600,auto:false,spread:.035,scope:28,scopeSpread:.0015,bolt:true,botAcc:.55,look:'scout',tags:['栓動','瞄準鏡 ×3','輕量']},
  sniper:  {name:'LX-5 栓動狙擊槍',   cls:'栓動步槍',    slot:1,dmg:115,pellets:1,rpm:42,  mag:5,  reserve:20, reload:3.4,recoil:1.6,range:90,speed:.82, price:4750,auto:false,spread:.1,  scope:18,scopeSpread:.0012,bolt:true,botAcc:.6,look:'sniper',tags:['栓動','狙擊鏡 ×4','一擊倒地']},
  heavy:   {name:'HX-60 重機槍',      cls:'重型武器',    slot:1,dmg:34, pellets:1,rpm:750, mag:100,reserve:200,reload:4.8,recoil:.55,range:45,speed:.75, price:6000,auto:true, spread:.04, botAcc:.4, look:'heavy',tags:['百發彈匣']},
};
const WDESC={
  p9:'每次重生免費配發的基本手槍',knife:'免費近戰武器，從背後攻擊一刀倒地',
  katana:'攻擊距離長的近戰武器。右鍵向前衝刺約 6.5 公尺，途中斬到的第一個敵人受到 100 傷害，冷卻 5 秒',axe:'單擊 60 傷害。按住右鍵蓄力，放開時揮出重擊，蓄滿 1.5 秒達到上限 130 傷害；蓄力時移動變慢',
  magnum:'單發傷害高的平價半自動副武器',revolver:'六發左輪，精準度極高、射程遠，中遠距離也能爆頭一槍倒地，但裝填慢',h9:'近中距離的重火力副武器，爆頭一槍倒地，主武器沒子彈時的救命槍',dual:'雙持連射，彈匣大但裝填慢',
  smg:'後座穩、好控制的近距離主力',rapid:'射速極高、火力猛，但後座偏大、射程短，適合貼身',
  shotgun:'近距離一發爆發，打不中就很危險',autoshot:'單發較弱但可連續射擊，近距離持續壓制',
  carbine:'傷害略低於 AR-7，但射速高、跑得快，適合突襲',burst:'每次扣扳機固定 4 連發，首發精準，高手中距離很強，但無法持續掃射',rifle:'全距離平衡的全自動步槍',
  tactical:'半自動、精準度高，中遠距離兩槍倒地，爆頭一槍',dmr:'附 2 倍瞄準鏡的半自動精準步槍，介於步槍和狙擊槍之間',
  scout:'輕量栓動步槍，3 倍鏡、移動快，身體 88 傷害，爆頭一擊',sniper:'重型栓動狙擊槍，4 倍鏡，一槍倒地，但拉栓慢、移動很慢',heavy:'百發彈匣壓制火力，移動最慢',
};
const GEAR={
  armor:{name:'戰術護甲',price:650,desc:'受到的所有傷害降低 30%，持續到死亡為止。'},
  boots:{name:'輕量戰術靴',price:400,desc:'移動速度提高 12%，可以彌補重型武器的機動性。死亡後消失。'},
  gloves:{name:'穩定手甲',price:450,desc:'射擊後座力與連射擴散降低 40%，自動武器更好控。死亡後消失。'},
};
// shorter matches get a cheaper shop so the full buy loop still fits
const PRICE_MUL={180:.5,300:.7,600:1};
const START_MONEY=800, KILL_REWARD=300, STREAK_BONUS=100, MONEY_CAP=16000, RESPAWN=3, SPAWN_PROT=2, HP_MAX=100, TEAM_SIZE=5;
const SHOP=[
  {group:'手槍 PISTOL',items:['magnum','revolver','h9','dual']},
  {group:'衝鋒槍 SMG',items:['smg','rapid']},
  {group:'霰彈槍 SHOTGUN',items:['shotgun','autoshot']},
  {group:'步槍 RIFLE',items:['carbine','burst','rifle','tactical']},
  {group:'精準與栓動 MARKSMAN',items:['dmr','scout','sniper']},
  {group:'重型武器 HEAVY',items:['heavy']},
  {group:'近戰 MELEE',items:['katana','axe']},
  {group:'裝備 GEAR',items:['armor','boots','gloves']},
];
const DIFF={easy:{acc:.55,react:.8},std:{acc:.8,react:.5},hard:{acc:1.05,react:.3}};
const NAMES=[['你','獵鷹','石牆','幽靈','烈風'],['毒蛇','鐵砧','野狼','雷霆','黑曜']];
const STYLES=['rifle','sniper','rusher','shotgun','marksman','heavy','scout','smg','rifle','marksman'];
const PREFS={
  rifle:['rifle','burst','carbine','smg','magnum'],sniper:['sniper','scout','dmr','rifle','smg','h9'],smg:['smg','rapid','dual'],
  shotgun:['autoshot','shotgun','smg','dual'],heavy:['heavy','rifle','smg','magnum'],marksman:['dmr','tactical','burst','carbine','h9'],
  rusher:['carbine','rapid','smg','magnum'],scout:['scout','tactical','carbine','revolver'],
};

/* ================= MAP ================= */
const B={minX:-41,maxX:41,minZ:-29,maxZ:29};
const BZ={x:30.3,z:8.2};
const mir=p=>[-p[0],-p[1]];
export function inBuyZone(e){return e.team===0?(e.pos.x<-BZ.x&&Math.abs(e.pos.z)<BZ.z):(e.pos.x>BZ.x&&Math.abs(e.pos.z)<BZ.z);}
const SPAWNS=[[[-37.5,-5.4],[-37.5,-1.8],[-37.5,1.8],[-37.5,5.4],[-39.8,-3.6],[-39.8,3.6]],null];
SPAWNS[1]=SPAWNS[0].map(mir);
const SPAWN_WALLS=[[-37.2,-8.4,7.4,.6,3.4,'spawn'],[-37.2,8.4,7.4,.6,3.4,'spawn'],[-30,-5.65,.6,5.5,3.4,'spawn'],[-30,5.65,.6,5.5,3.4,'spawn'],[-34,0,.6,7.2,3.4,'spawn']];
const S12=1.2,sc12=o=>{const keep=o[5]==='crate'||o[5]==='tall';return [o[0]*S12,o[1]*S12,keep||o[2]<1?o[2]:o[2]*S12,keep||o[3]<1?o[3]:o[3]*S12,o[4],o[5]];};
// Each map: west half [cx,cz,w,d,h,kind]; the east half is its point reflection so neither side has an edge.
const MAPS={
  desert:{name:'沙漠遺跡',en:'DESERT',accent:'#e9a93b',desc:'開闊的中型地圖，適合中遠距離交戰，並有多條進攻路線。',
    west:[[-31,-18,6,12,6,'bldg'],[-17,-21,10,6,5,'bldg'],[-16,-9.5,12,5,4.2,'bldg'],[-5.5,-21.5,5,5,5,'bldg'],
      [-31,18,6,12,6,'bldg'],[-18.5,19.5,7,9,5,'bldg'],[-17,9.5,8,5,4.2,'bldg'],[-8,16,6,8,5,'bldg'],
      [-19,-15,1.4,1.4,1.1,'crate'],[-13,-16.3,1.4,1.4,1.1,'crate'],[-6,-13,2.2,1.4,1.1,'crate'],[-2.6,-10.5,1.6,1.6,2.3,'tall'],
      [-17,0,.6,5,1.2,'low'],[-20.5,4,1.5,1.5,1.1,'crate'],[-13.5,-4,1.5,1.5,1.1,'crate'],[-6,3.2,1.5,1.5,1.1,'crate'],[-7.5,-4.8,1.4,1.4,1.1,'crate'],
      [-3,14.5,1.5,1.5,1.1,'crate'],[-9.5,9.3,1.4,1.4,1.1,'crate'],[-2.5,21.5,1.5,1.5,1.1,'crate'],[-25.5,18,1.3,1.3,1.1,'crate'],[-1.2,18.6,1.4,1.4,2.2,'tall']].map(sc12),
    center:[[0,0,2.4,2.4,2.4,'tall'],[0,-6.6,4.8,.6,1.2,'low'],[0,6.6,4.8,.6,1.2,'low']],
    poi:[[-31.8,-12],[-21.6,-17.4],[-9.6,-18],[-31.8,12],[-22.8,16.2],[-15.6,20.4],[-9.6,26.4],[-5,20],[-13.2,1.2]],cpoi:[[0,-18],[0,18],[-4.8,-2.4]],
    areas:[{n:1,name:'中央廣場',sub:'開放區域',x:0,z:0},{n:2,name:'夾道',sub:'近距離戰鬥',x:-22.8,z:16.2},{n:3,name:'高台長街',sub:'狙擊點',x:21.6,z:17.4},{n:4,name:'倉庫區',sub:'掩體多',x:4,z:-21}]},
  indoor:{name:'室內工廠',en:'INDOOR',accent:'#9fb3c8',desc:'封閉的室內結構，適合近距離戰鬥，節奏快速。',
    west:[[-37.5,-21,7,14,7.5,'bldg'],[-37.5,21,7,14,7.5,'bldg'],
      [-22,-23,10,8,5.2,'bldg'],[-8,-24,8,7,5.2,'bldg'],[-20,-12,9,4.4,5.2,'bldg'],[-22,15,9,5,5.2,'bldg'],[-9,20,7,10,5.2,'bldg'],[-23,25,8,6,5.2,'bldg'],
      [-11,-14,8,1.2,3.4,'rack'],[-4,-13,1.2,6,3.4,'rack'],[-15,8,1.2,6,3.4,'rack'],[-2.5,13,1.2,6,3.4,'rack'],
      [-17,1,3,3,2.4,'machine'],[-9,-4,2.6,2.6,2.4,'machine'],
      [-22,4,5.5,2.4,2.7,'container'],[-10,6,2.4,5.5,2.7,'container'],
      [-13,-9,1.4,1.4,1.1,'crate'],[-19,-5,1.4,1.4,1.1,'crate'],[-3,26,1.4,1.4,1.1,'crate'],[-14,26,1.5,1.5,1.1,'crate'],[-26,-16,1.4,1.4,1.1,'crate']],
    center:[[0,-5.5,6,2.4,2.7,'container'],[0,5.5,6,2.4,2.7,'container'],[0,0,1.8,1.8,2.2,'tall']],
    poi:[[-20,-17],[-8,-17],[-12,-11],[-22,-1],[-14,4],[-22,19.8],[-15,20],[-3,20]],cpoi:[[0,-12],[0,12],[-5,0]],
    areas:[{n:1,name:'中央倉庫',sub:'開放區域',x:0,z:0},{n:2,name:'走廊',sub:'近距離戰鬥',x:-12,z:-17},{n:3,name:'機房',sub:'掩體多',x:-14,z:3.5},{n:4,name:'貨架夾層',sub:'高台',x:3,z:-20}]},
  jungle:{name:'叢林山谷',en:'JUNGLE',accent:'#8ccf5a',desc:'地形變化多，包含樹林、石頭與河流，適合多樣化的戰術。',
    west:[[-22,-20,7,6,3.6,'hut'],[-20,18,6,7,3.6,'hut'],[-10,12,5,5,3.6,'hut'],[-11,-18,3.2,3.2,7,'tower'],
      [-17,-7,3,2.4,1.7,'rock'],[-8,-7,2.4,2.4,1.5,'rock'],[-19,5,2.6,2.2,1.6,'rock'],[-7,4,2.2,2.6,1.6,'rock'],[-26,-14,2.4,2,1.4,'rock'],[-6,22,2.8,2.4,1.8,'rock'],[-15,24,2.4,2.4,1.6,'rock'],
      [-14,-1,.9,5,1.1,'log'],
      ...[[-33,-14],[-36,-20],[-28,-25],[-16,-26],[-6,-26],[-4.4,-15],[-15,-13],[-24,-9],[-26,11],[-33,15],[-37,24],[-28,24],[-14,17],[-5,16],[-9,27],[-22,27],[-37,-26]].map(p=>[p[0],p[1],.9,.9,6,'tree'])],
    center:[[0,-2.5,7.2,.25,.9,'rail'],[0,2.5,7.2,.25,.9,'rail']],
    water:[[-3,3,-29,29]],bridge:[[-3.6,3.6,-2.3,2.3]],
    poi:[[-24,-12],[-15,-17],[-6,-12],[-14,6],[-26,19],[-12,20],[-5,9]],cpoi:[[0,-18],[0,18],[-5,0]],
    areas:[{n:1,name:'木橋',sub:'中距離交戰',x:0,z:0},{n:2,name:'瞭望台',sub:'狙擊點',x:-11,z:-18},{n:3,name:'河道',sub:'側翼路線',x:0,z:18},{n:4,name:'叢林小徑',sub:'掩體多',x:-26,z:19}]},
  snow:{name:'雪地基地',en:'SNOW',accent:'#7cc8ff',desc:'開放與室內混合的地圖，視野清晰，適合中遠距離與狙擊戰。',
    west:[[-37.5,-21,7,14,6,'bldg'],[-37.5,21,7,14,6,'bldg'],
      [-21,-22,10,8,5.5,'bldg'],[-8,-21,6,7,5,'bldg'],[-21,20,9,8,5,'bldg'],[-9,19,7,8,6,'bldg'],
      [-20,-9,6,2.4,2.7,'container'],[-12,8,2.4,6,2.7,'container'],[-24,6,2.4,5,2.7,'container'],[-3,26,5,2.4,2.7,'container'],
      [-10,-3,.6,4.5,1.2,'low'],[-19,2.8,4,.6,1.2,'low'],
      [-6,-10,2.6,2.2,1.4,'mound'],[-27,-12,2.4,2.2,1.3,'mound'],[-5,6,2.2,2.2,1.3,'mound'],[-27,12,2.2,2.2,1.3,'mound']],
    center:[[0,0,2.2,2.2,12,'radio'],[0,-7,4.8,.6,1.2,'low'],[0,7,4.8,.6,1.2,'low']],
    pad:[-16,-2],
    poi:[[-21,-14],[-8,-14],[-16,-2],[-20,12],[-8,12],[-14.5,20],[-3,20]],cpoi:[[0,-15],[0,15],[-5,-3]],
    areas:[{n:1,name:'中央廣場',sub:'開放區域',x:0,z:0},{n:2,name:'研究所',sub:'室內',x:-21,z:-15},{n:3,name:'停機坪',sub:'狙擊點',x:-16,z:-2},{n:4,name:'倉庫',sub:'掩體多',x:-8,z:12.5}]},
};
const MAP_ORDER=['desert','indoor','jungle','snow'];
function mapSolids(def){
  const out=[];const add=(cx,cz,w,d,h,kind)=>out.push({minX:cx-w/2,maxX:cx+w/2,minZ:cz-d/2,maxZ:cz+d/2,minY:0,maxY:h,cx,cz,w,d,h,kind});
  [...SPAWN_WALLS,...def.west].forEach(o=>{add(...o);add(-o[0],-o[1],o[2],o[3],o[4],o[5]);});
  def.center.forEach(o=>add(...o));
  const oh=def===MAPS.indoor?7.5:6;
  add(0,B.minZ-.5,84,1,oh,'outer');add(0,B.maxZ+.5,84,1,oh,'outer');add(B.minX-.5,0,1,60,oh,'outer');add(B.maxX+.5,0,1,60,oh,'outer');
  return out;
}
function rects(list){const out=[];(list||[]).forEach(r=>{out.push({minX:r[0],maxX:r[1],minZ:r[2],maxZ:r[3]});});return out;}
function inRect(list,x,z){for(const r of list)if(x>r.minX&&x<r.maxX&&z>r.minZ&&z<r.maxZ)return true;return false;}


export {W,WDESC,GEAR,PRICE_MUL,START_MONEY,KILL_REWARD,STREAK_BONUS,MONEY_CAP,RESPAWN,SPAWN_PROT,HP_MAX,TEAM_SIZE,SHOP,DIFF,NAMES,STYLES,PREFS,
  B,BZ,mir,SPAWNS,SPAWN_WALLS,MAPS,MAP_ORDER,mapSolids,rects,inRect};
