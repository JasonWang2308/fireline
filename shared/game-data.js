// Shared by the browser client and the Node server. Pure data + pure helpers only.
/* ================= DATA ================= */
// slot 1 = primary, 2 = sidearm, 3 = melee. Every gun has a different job, not just "more damage".
const W={
  p9:      {name:'P9 標配手槍',       cls:'手槍',        slot:2,dmg:26, pellets:1,rpm:380, mag:12, reserve:48, reload:1.5,recoil:.35,range:25,speed:1.0, price:0,   auto:false,spread:.012,botAcc:.42,look:'pistol'},
  magnum:  {name:'M-44 麥格農',       cls:'手槍',        slot:2,dmg:48, pellets:1,rpm:170, mag:7,  reserve:35, reload:2.0,recoil:.9, range:35,speed:.98, price:500, auto:false,spread:.014,botAcc:.46,look:'magnum'},
  revolver:{name:'R-6 左輪手槍',      cls:'手槍',        slot:2,dmg:55, pellets:1,rpm:150, mag:6,  reserve:30, reload:2.8,recoil:.8, range:50,speed:.98, price:600, auto:false,spread:.005,botAcc:.52,look:'revolver',tags:['六發','50 m 不衰減','遠距爆頭一擊']},
  h9:      {name:'H-9 重型手槍',      cls:'手槍',        slot:2,dmg:72, pellets:1,rpm:110, mag:6,  reserve:24, reload:2.2,recoil:1.35,range:16,speed:.97,price:700, auto:false,spread:.02,  botAcc:.48,look:'h9',tags:['近距兩槍倒地','射程短']},
  dual:    {name:'D-9 雙槍',          cls:'手槍',        slot:2,dmg:24, pellets:1,rpm:520, mag:30, reserve:90, reload:3.0,recoil:.4, range:22,speed:.98, price:800, auto:false,spread:.022,botAcc:.42,look:'dual',tags:['雙持']},
  knife:   {name:'小刀',              cls:'近戰',        slot:3,dmg:50, pellets:1,rpm:130, mag:0,  reserve:0,  reload:0,  recoil:0,  range:2.1,arc:.6, speed:1.1,price:0,   auto:true, spread:0,   botAcc:.75,look:'knife',melee:true,tags:['背刺 110']},
  katana:  {name:'武士刀',            cls:'近戰',        slot:3,dmg:65, pellets:1,rpm:100, mag:0,  reserve:0,  reload:0,  recoil:0,  range:3.3,arc:.45,speed:1.05,price:1200,auto:true,spread:0,  botAcc:.75,look:'katana',melee:true,dash:{cd:5,dist:6.5,time:.22,dmg:100},tags:['攻擊距離 3.3 m','揮砍範圍大','右鍵 衝刺拔刀斬','冷卻 5 秒']},
  axe:     {name:'戰斧',              cls:'近戰',        slot:3,dmg:60, pellets:1,rpm:80,  mag:0,  reserve:0,  reload:0,  recoil:0,  range:2.8,arc:.55,speed:.96, price:900, auto:true,spread:0,  botAcc:.75,look:'axe',melee:true,charge:{time:1.5,max:130},tags:['攻擊距離 2.8 m','按住右鍵蓄力','最高 130 傷害']},
  smg:     {name:'V-9 衝鋒槍',        cls:'衝鋒槍',      slot:1,dmg:22, pellets:1,rpm:850, mag:30, reserve:120,reload:2.1,recoil:.25,range:22,speed:.97, price:1500,auto:true, spread:.026,botAcc:.36,look:'smg',tags:['穩定']},
  rapid:   {name:'SM-12 速射衝鋒槍',  cls:'衝鋒槍',      slot:1,dmg:16, pellets:1,rpm:1100,mag:50, reserve:150,reload:2.4,recoil:.42,range:16,speed:.98, price:1800,auto:true, spread:.036,botAcc:.34,look:'rapid',tags:['極高射速']},
  mp7:     {name:'MP-7 高機動衝鋒槍', cls:'衝鋒槍',      slot:1,dmg:19, pellets:1,rpm:800, mag:40, reserve:160,reload:2.0,recoil:.3, range:20,speed:1.05,price:2000,auto:true, spread:.024,botAcc:.37,look:'mp7',tags:['高機動','40 發']},
  shotgun: {name:'BR-12 泵動霰彈槍',  cls:'霰彈槍',      slot:1,dmg:17, pellets:8,rpm:70,  mag:6,  reserve:30, reload:2.6,recoil:1.1,range:10,speed:.93, price:2000,auto:false,spread:.085,botAcc:.5, look:'shotgun',tags:['一發爆發']},
  autoshot:{name:'S-12 自動霰彈槍',   cls:'霰彈槍',      slot:1,dmg:11, pellets:8,rpm:230, mag:8,  reserve:32, reload:3.0,recoil:.8, range:9, speed:.92, price:3000,auto:false,spread:.095,botAcc:.48,look:'autoshot',tags:['連續射擊']},
  carbine: {name:'K-8 卡賓槍',        cls:'突擊步槍',    slot:1,dmg:28, pellets:1,rpm:720, mag:30, reserve:90, reload:2.0,recoil:.32,range:35,speed:.96, price:2300,auto:true, spread:.018,botAcc:.43,look:'carbine',tags:['高機動']},
  burst:   {name:'Burst-4 四連發步槍',cls:'突擊步槍',    slot:1,dmg:30, pellets:1,rpm:900, burst:4,burstDelay:.38,mag:32,reserve:96,reload:2.3,recoil:.34,range:50,speed:.9,price:2400,auto:false,spread:.009,botAcc:.5,look:'burst',tags:['四連發']},
  rifle:   {name:'AR-7 突擊步槍',     cls:'突擊步槍',    slot:1,dmg:32, pellets:1,rpm:600, mag:30, reserve:90, reload:2.4,recoil:.45,range:45,speed:.9,  price:2700,auto:true, spread:.015,botAcc:.45,look:'rifle',tags:['全自動']},
  tactical:{name:'R-5 戰術步槍',      cls:'半自動步槍',  slot:1,dmg:55, pellets:1,rpm:240, mag:15, reserve:45, reload:2.4,recoil:.7, range:60,speed:.88, price:3200,auto:false,spread:.006,botAcc:.5, look:'tactical',tags:['半自動','爆頭一擊']},
  battle:  {name:'MR-8 戰鬥步槍',     cls:'戰鬥步槍',    slot:1,dmg:42, pellets:1,rpm:300, mag:20, reserve:60, reload:2.5,recoil:.4, range:55,speed:.9,  price:3000,auto:false,spread:.01, scope:40,scopeSpread:.004,botAcc:.5,look:'battle',tags:['半自動','瞄準鏡 ×2','低後座']},
  dmr:     {name:'DMR-6 精準射手步槍',cls:'精準射手步槍',slot:1,dmg:75, pellets:1,rpm:170, mag:10, reserve:30, reload:2.8,recoil:.95,range:75,speed:.85, price:3800,auto:false,spread:.012,scope:40,scopeSpread:.0025,botAcc:.55,look:'dmr',tags:['半自動','瞄準鏡 ×2']},
  scout:   {name:'SV-2 輕型栓動步槍', cls:'栓動步槍',    slot:1,dmg:88, pellets:1,rpm:48,  mag:10, reserve:30, reload:2.6,recoil:1.0,range:80,speed:.97, price:2600,auto:false,spread:.035,scope:28,scopeSpread:.0015,bolt:true,botAcc:.55,look:'scout',tags:['栓動','瞄準鏡 ×3','輕量']},
  sniper:  {name:'LX-5 栓動狙擊槍',   cls:'栓動步槍',    slot:1,dmg:115,pellets:1,rpm:42,  mag:5,  reserve:20, reload:3.4,recoil:1.6,range:90,speed:.82, price:4750,auto:false,spread:.1,  scope:18,scopeSpread:.0012,bolt:true,botAcc:.6,look:'sniper',tags:['栓動','狙擊鏡 ×4','一擊倒地']},
  lmg:     {name:'L-7 輕機槍',        cls:'輕機槍',      slot:1,dmg:29, pellets:1,rpm:650, mag:60, reserve:180,reload:3.5,recoil:.5, range:40,speed:.85, price:4100,auto:true, spread:.03, botAcc:.42,look:'lmg',tags:['60 發','火力壓制']},
  heavy:   {name:'HX-60 重機槍',      cls:'重型武器',    slot:1,dmg:34, pellets:1,rpm:750, mag:100,reserve:200,reload:4.8,recoil:.55,range:45,speed:.75, price:6000,auto:true, spread:.04, botAcc:.4, look:'heavy',tags:['百發彈匣']},
};
const WDESC={
  p9:'每次重生免費配發的基本手槍',knife:'免費近戰武器，攻擊距離 2.1 m，從背後攻擊一刀倒地',
  katana:'攻擊距離長的近戰武器。右鍵向前衝刺約 6.5 公尺，途中斬到的第一個敵人受到 100 傷害，冷卻 5 秒',axe:'單擊 60 傷害。按住右鍵蓄力，放開時揮出重擊，蓄滿 1.5 秒達到上限 130 傷害；蓄力時移動變慢',
  magnum:'單發傷害高的平價半自動副武器',revolver:'六發左輪，手槍中最準，50 公尺內傷害不衰減，中遠距離也能爆頭一槍倒地；裝填慢',h9:'近距離手炮：16 公尺內兩槍倒地（對方有護甲也一樣），爆頭一槍；距離一拉開傷害就大幅下降',dual:'雙持連射，彈匣大但裝填慢',
  smg:'後座穩、好控制的近距離主力',rapid:'射速極高、火力猛，但後座偏大、射程短，適合貼身',mp7:'40 發彈匣、拿著跑得比其他槍都快的衝鋒槍。單發傷害和射程比 V-9 低，用機動性換火力',
  shotgun:'近距離一發爆發，打不中就很危險',autoshot:'單發較弱但可連續射擊，近距離持續壓制',
  carbine:'傷害略低於 AR-7，但射速高、跑得快，適合突襲',burst:'每次扣扳機固定 4 連發，首發精準，高手中距離很強，但無法持續掃射',rifle:'全距離平衡的全自動步槍',
  tactical:'半自動、精準度高，中遠距離兩槍倒地，爆頭一槍',battle:'附 2 倍鏡的半自動戰鬥步槍。單發不致命（爆頭 84），但後座低、20 發彈匣，中距離連續點射容錯高',dmr:'附 2 倍瞄準鏡的半自動精準步槍，介於步槍和狙擊槍之間',
  scout:'輕量栓動步槍，3 倍鏡、移動快，身體 88 傷害，爆頭一擊',sniper:'重型栓動狙擊槍，4 倍鏡，一槍倒地，但拉栓慢、移動很慢',lmg:'60 發彈匣的輕機槍，能長時間壓制；換彈 3.5 秒、移動偏慢。介於 AR-7 和 HX-60 之間',heavy:'百發彈匣壓制火力，移動最慢',
};
const GEAR={
  armor:{name:'戰術護甲',price:650,desc:'受到的所有傷害降低 30%，持續到死亡為止。'},
  helmet:{name:'戰術頭盔',price:400,desc:'被爆頭的傷害倍率從 ×2 降為 ×1.3；滿血時被爆頭不會一槍倒地（至少留 1 HP）。身體中彈照常計算。死亡後消失。'},
  boots:{name:'輕量戰術靴',price:400,desc:'移動速度提高 12%，可以彌補重型武器的機動性。死亡後消失。'},
  gloves:{name:'穩定手甲',price:450,desc:'射擊後座力與連射擴散降低 40%，自動武器更好控。死亡後消失。'},
  medkit:{name:'戰地醫療針',price:500,heal:35,time:4,desc:'按 H 使用：4 秒內恢復 35 HP。注射時不能射擊、移動變慢，被擊中會中斷（已恢復的保留）。一次帶一支，死亡後消失。'},
};
// shorter matches get a cheaper shop so the full buy loop still fits
// extended magazines: one per weapon class, bought once per life like the other gear
const MAG_CLASS={
  pistol:{name:'手槍擴充彈匣',price:200,mul:1.5},smg:{name:'衝鋒槍擴充彈匣',price:300,mul:1.5},shotgun:{name:'霰彈槍擴充彈匣',price:300,mul:1.5},
  rifle:{name:'步槍擴充彈匣',price:350,mul:4/3},marksman:{name:'精準步槍擴充彈匣',price:400,mul:1.5},heavy:{name:'機槍擴充彈匣',price:500,mul:1.5},
};
const HELMET_HEAD=1.3;
const PRICE_MUL={180:.5,300:.7,600:1};
const START_MONEY=800, KILL_REWARD=300, STREAK_BONUS=100, MONEY_CAP=16000, RESPAWN=3, SPAWN_PROT=2, HP_MAX=100, TEAM_SIZE=5;
const SHOP=[
  {group:'手槍 PISTOL',mc:'pistol',items:['magnum','revolver','h9','dual']},
  {group:'衝鋒槍 SMG',mc:'smg',items:['smg','rapid','mp7']},
  {group:'霰彈槍 SHOTGUN',mc:'shotgun',items:['shotgun','autoshot']},
  {group:'步槍 RIFLE',mc:'rifle',items:['carbine','burst','rifle','tactical']},
  {group:'精準與栓動 MARKSMAN',mc:'marksman',items:['scout','battle','dmr','sniper']},
  {group:'重型武器 HEAVY',mc:'heavy',items:['lmg','heavy']},
  {group:'近戰 MELEE',items:['katana','axe']},
  {group:'裝備 GEAR',items:['armor','helmet','boots','gloves','medkit']},
  {group:'擴充彈匣 MAGAZINE',items:Object.keys(MAG_CLASS).map(c=>'mag_'+c)},
];
W.p9.magc='pistol';
const bigMag=(w,mul)=>{const b=w.burst||1;return Math.round(w.mag*mul/b)*b;};
for(const g of SHOP)if(g.mc)for(const k of g.items)W[k].magc=g.mc;
for(const c in MAG_CLASS){
  const m=MAG_CLASS[c],ex=Object.keys(W).filter(k=>W[k].magc===c).slice(0,3).map(k=>`${W[k].name.split(' ')[0]} ${W[k].mag}→${bigMag(W[k],m.mul)}`).join('、');
  GEAR['mag_'+c]={name:m.name,price:m.price,mag:c,mul:m.mul,stack:true,desc:`${m.name.replace('擴充彈匣','')}類武器彈匣容量每買一個 +${Math.round((m.mul-1)*100)}%（${ex}），可以重複購買、沒有上限。買了之後再買同類的槍也有效。死亡後消失。`};
}
// magazine capacity for entity e holding weapon k (extended magazine applies per weapon class)
// each extended magazine bought adds another (mul-1) of the base capacity; e['mag_x'] is how many were bought (true counts as 1)
function magCap(e,k){const w=W[k];if(!w||!w.mag)return 0;const n=w.magc&&e?+(e['mag_'+w.magc]||0):0;return n?bigMag(w,1+(GEAR['mag_'+w.magc].mul-1)*n):w.mag;}
function headMul(v){return v&&v.helmet?HELMET_HEAD:2;}
const DIFF={easy:{acc:.55,react:.8},std:{acc:.8,react:.5},hard:{acc:1.05,react:.3}};
const NAMES=[['你','獵鷹','石牆','幽靈','烈風'],['毒蛇','鐵砧','野狼','雷霆','黑曜']];
const STYLES=['rifle','sniper','rusher','shotgun','marksman','heavy','scout','smg','rifle','marksman'];
const PREFS={
  rifle:['rifle','burst','carbine','smg','magnum'],sniper:['sniper','scout','dmr','rifle','smg','revolver'],smg:['mp7','smg','rapid','dual'],
  shotgun:['autoshot','shotgun','smg','h9'],heavy:['heavy','lmg','rifle','smg','magnum'],marksman:['dmr','battle','tactical','burst','carbine','revolver'],
  rusher:['carbine','mp7','rapid','smg','h9'],scout:['scout','battle','tactical','carbine','revolver'],
};

/* ================= MAP ================= */
const B={minX:-41,maxX:41,minZ:-29,maxZ:29};
const BZ={x:30.3,z:8.2};
const mir=p=>[-p[0],-p[1]];
// w is the world (sim.createWorld) so every map can have its own size
export function inBuyZone(e,w){const bz=w.bz;return e.team===0?(e.pos.x<-bz.x&&Math.abs(e.pos.z)<bz.z):(e.pos.x>bz.x&&Math.abs(e.pos.z)<bz.z);}
const SPAWNS=[[[-37.5,-5.4],[-37.5,-1.8],[-37.5,1.8],[-37.5,5.4],[-39.8,-3.6],[-39.8,3.6]],null];
SPAWNS[1]=SPAWNS[0].map(mir);
const SPAWN_WALLS=[[-37.2,-8.4,7.4,.6,3.4,'spawn'],[-37.2,8.4,7.4,.6,3.4,'spawn'],[-30,-5.65,.6,5.5,3.4,'spawn'],[-30,5.65,.6,5.5,3.4,'spawn'],[-34,0,.6,7.2,3.4,'spawn']];
const S12=1.2,sc12=o=>{const keep=o[5]==='crate'||o[5]==='tall';return [o[0]*S12,o[1]*S12,keep||o[2]<1?o[2]:o[2]*S12,keep||o[3]<1?o[3]:o[3]*S12,o[4],o[5]];};
// Each map: west half [cx,cz,w,d,h,kind]; the east half is its point reflection so neither side has an edge.
const MAPS={
  desert:{name:'沙漠遺跡',en:'DESERT',accent:'#e9a93b',desc:'緊湊的小型地圖，建築之間多條短路線，一出門就會接敵。',
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
// PORT uses left-right mirror symmetry (x -> -x) instead of point symmetry, so every lane is the same kind of lane for both teams:
// north = long quay, middle = container yard, south = close-quarters warehouse aisles.
MAPS.port={name:'貨櫃港口',en:'PORT',accent:'#ff8a3d',sym:'x',desc:'北側長碼頭、中央貨櫃場、南側倉庫走道，三種距離各一條路，另有兩條側翼與高台。',
  west:[
    // sea along the north edge (blocks movement, not shots)
    [-20.5,-27.3,41,3.4,.6,'sea'],
    // Route A: quay (long range) with bollards, crates and gantry crane legs
    [-27,-24.9,.7,.7,.8,'bollard'],[-19,-24.9,.7,.7,.8,'bollard'],[-11,-24.9,.7,.7,.8,'bollard'],[-3,-24.9,.7,.7,.8,'bollard'],
    [-23,-21,1.4,1.4,1.1,'crate'],[-14.5,-23,2.4,1.4,1.1,'crate'],[-6.5,-20.4,1.5,1.5,1.1,'crate'],
    [-9,-24.6,1,1,7,'pillar'],[-9,-19.2,1,1,7,'pillar'],
    // quay / service-road divider: container, unloading deck with stairs, container
    [-27,-17,6,2.4,2.7,'container'],
    [-21.4,-17,1.2,3,.45,'stair'],[-20.2,-17,1.2,3,.9,'stair'],[-19,-17,1.2,3,1.35,'stair'],[-15.1,-17,6.6,3,1.8,'deck'],[-11.6,-17,.4,3,2.8,'parapet'],
    [-5,-17,5,2.4,2.7,'container'],
    // Flank A: service road
    [-25,-12.8,2.2,1.4,1.6,'machine'],[-17,-11.3,1.4,1.4,1.1,'crate'],[-9,-12.8,.6,3,1.2,'low'],
    // north-west corner by the spawn
    [-36,-14,2.4,5,2.7,'container'],[-33,-21,1.4,1.4,1.1,'crate'],[-38.5,-22.5,2.4,1.4,1.1,'crate'],
    // Route B: container yard lane (mid range)
    [-26,-3.5,1.4,1.4,1.1,'crate'],[-23,2.8,2.4,3.6,2.7,'container'],[-26.5,5.5,.6,2.4,1.2,'low'],[-19,-6.5,2.4,5,2.7,'container'],[-14.5,1.8,5,2.4,2.7,'container'],[-11,-2.6,1.4,1.4,1.1,'crate'],
    // central yard (west half)
    [-6,-6.5,5,2.4,2.7,'container'],[-4.6,3.2,1.4,1.4,1.1,'crate'],
    [-4.2,7.5,1.2,3,.45,'stair'],[-3,7.5,1.2,3,.9,'stair'],
    // Route C: warehouse aisles (close range) between two warehouses
    [-20,12.6,16,3,5,'bldg'],[-20,23.2,16,4.4,5,'bldg'],
    [-24,17.8,5,1,3.4,'rack'],[-16,16,1,3.8,3.4,'rack'],[-13.6,19.6,2.4,1.4,1.1,'crate'],
    // south-west corner and south yard
    [-36,15,2.4,5,2.7,'container'],[-34,24,5,2.4,2.7,'container'],[-38.5,20,1.4,1.4,1.1,'crate'],
    [-7,14,2.4,5,2.7,'container'],[-3,18.4,1.4,1.4,1.1,'crate'],[-9.5,24,1.4,1.4,1.1,'crate'],
  ],
  center:[[0,0,2.4,6,5.4,'container'],[0,7.5,4.8,3,1.35,'deck'],[0,-22,3,1.2,1.2,'low'],[0,24,6,6,4,'bldg']],
  cranes:[[-9,-24.6,-19.2]],
  poi:[[-24,-22],[-12,-22],[-24,-12.8],[-13,-13.5],[-15,-17],[-22,0],[-12,-1],[-24,15.6],[-24,20],[-13,17],[-20,27.3],[-9,20],[-35,-19],[-35,19]],
  cpoi:[[0,-4.8],[0,4.5],[0,7.5],[0,-12.5],[0,-21],[0,18.5]],
  // bots pick one route per life (west-half waypoints, walked in order) and then head for the centre
  lanes:[[[-30,-21],[-18,-22],[-6,-22]],[[-23,-17],[-15,-17]],[[-26,-13],[-14,-13],[-4,-12.5]],[[-24,-1],[-12,-1]],[[-27,17.6],[-20,15.6],[-13,17]],[[-26,27.3],[-14,27.3],[-4,28]]],
  areas:[{n:1,name:'中央貨櫃場',sub:'主戰區',x:0,z:0},{n:2,name:'碼頭岸壁',sub:'長距離',x:-24,z:-22},{n:3,name:'卸貨平台',sub:'高台',x:-15,z:-16},{n:4,name:'倉庫走道',sub:'近距離',x:-20,z:17.5}]};
// map sizes: each size comes with its own match length (the map decides the length)
const SIZES={small:{hx:33,hz:23,len:180,name:'小型',en:'SMALL'},std:{hx:41,hz:29,len:300,name:'標準',en:'STANDARD'},large:{hx:50,hz:35,len:600,name:'大型',en:'LARGE'}};
// scale a map drawn for the 82 x 58 standard field; stairs and parapets keep their offset to the nearest deck
const KEEP_SIZE={crate:1,tall:1,machine:1,rock:1,tree:1,mound:1,container:1,bollard:1,pillar:1,stair:1,deck:1,parapet:1,radio:1,tower:1,hut:1,log:1};
function rescaleMap(def,sx,sz){
  const decks=[...def.west,...def.center].filter(o=>o[5]==='deck'),P=(x,z)=>[x*sx,z*sz];
  const one=o=>{let [x,z]=P(o[0],o[1]);
    if(o[5]==='stair'||o[5]==='parapet'){let best=null,bd=1e9;for(const d of decks){const dd=Math.hypot(d[0]-o[0],d[1]-o[1]);if(dd<bd){bd=dd;best=d;}}
      if(best){const q=P(best[0],best[1]);x=q[0]+(o[0]-best[0]);z=q[1]+(o[1]-best[1]);}}
    const keep=KEEP_SIZE[o[5]];return [x,z,keep||o[2]<1?o[2]:o[2]*sx,keep||o[3]<1?o[3]:o[3]*sz,o[4],o[5]];};
  def.west=def.west.map(one);def.center=def.center.map(one);
  def.poi=def.poi.map(p=>P(...p));def.cpoi=def.cpoi.map(p=>P(...p));
  if(def.lanes)def.lanes=def.lanes.map(l=>l.map(p=>P(...p)));
  def.areas=def.areas.map(a=>({...a,x:a.x*sx,z:a.z*sz}));
  if(def.pad)def.pad=P(...def.pad);
  if(def.cranes)def.cranes=def.cranes.map(c=>[c[0]*sx,c[1]*sz,c[2]*sz]);
}
MAPS.desert.size='small';MAPS.indoor.size='small';MAPS.jungle.size='std';MAPS.snow.size='std';MAPS.port.size='large';
for(const id in MAPS){const d=MAPS[id],z=SIZES[d.size];d.len=z.len;if(z.hx!==41)rescaleMap(d,z.hx/41,z.hz/29);}
const MAP_ORDER=['desert','indoor','jungle','snow','port'];
function mapBounds(def){const z=SIZES[def.size||'std'];return {minX:-z.hx,maxX:z.hx,minZ:-z.hz,maxZ:z.hz};}
// the spawn rooms are drawn for the standard field; slide them in so they stay against the end walls
function spawnShift(def){return 41-SIZES[def.size||'std'].hx;}
function spawnsFor(def){const d=spawnShift(def),west=SPAWNS[0].map(p=>[p[0]+d,p[1]]);return [west,west.map(mirOf(def))];}
function buyZoneFor(def){return {x:BZ.x-spawnShift(def),z:BZ.z};}
// mirror a west-half point to the east half for this map
function mirOf(def){return def&&def.sym==='x'?(p=>[-p[0],p[1]]):mir;}
function mapSolids(def){
  const bb=mapBounds(def),sh=spawnShift(def);
  const out=[];const add=(cx,cz,w,d,h,kind)=>out.push({minX:cx-w/2,maxX:cx+w/2,minZ:cz-d/2,maxZ:cz+d/2,minY:0,maxY:h,cx,cz,w,d,h,kind});
  const m=mirOf(def);
  [...SPAWN_WALLS.map(o=>[o[0]+sh,...o.slice(1)]),...def.west].forEach(o=>{add(...o);const q=m([o[0],o[1]]);add(q[0],q[1],o[2],o[3],o[4],o[5]);});
  def.center.forEach(o=>add(...o));
  const oh=def===MAPS.indoor?7.5:6;
  const W2=bb.maxX*2+2,D2=bb.maxZ*2+2;add(0,bb.minZ-.5,W2,1,oh,'outer');add(0,bb.maxZ+.5,W2,1,oh,'outer');add(bb.minX-.5,0,1,D2,oh,'outer');add(bb.maxX+.5,0,1,D2,oh,'outer');
  return out;
}
function rects(list){const out=[];(list||[]).forEach(r=>{out.push({minX:r[0],maxX:r[1],minZ:r[2],maxZ:r[3]});});return out;}
function inRect(list,x,z){for(const r of list)if(x>r.minX&&x<r.maxX&&z>r.minZ&&z<r.maxZ)return true;return false;}


export {W,WDESC,GEAR,MAG_CLASS,HELMET_HEAD,magCap,headMul,PRICE_MUL,START_MONEY,KILL_REWARD,STREAK_BONUS,MONEY_CAP,RESPAWN,SPAWN_PROT,HP_MAX,TEAM_SIZE,SHOP,DIFF,NAMES,STYLES,PREFS,
  B,BZ,mir,mirOf,SIZES,mapBounds,spawnsFor,buyZoneFor,SPAWNS,SPAWN_WALLS,MAPS,MAP_ORDER,mapSolids,rects,inRect};
