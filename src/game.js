import { advanceFiller } from './filler.js';
// The progression model is independent of rendering so a complete run can be verified.
export const UPGRADES = [
  { id:'cord', name:'Extension cord', cost:36, detail:'Power at the shoreline. Less walking, more boiling.', receipt:'Facilities approved 12 metres of ambition.' },
  { id:'second', name:'A second kettle', cost:72, detail:'A separate kettle. Fill one while the other boils.', receipt:'Two kettles. A pattern is emerging.' },
  { id:'strip', name:'Six-way power strip', cost:108, detail:'Six independent kettles. Keep every base busy.', receipt:'Please do not tell Facilities.' },
  { id:'filler', name:'Hire a worker', cost:144, detail:'Maya fetches, boils and pours. The whole loop.', receipt:'Maya has read the brief. Maya has questions.' },
  { id:'pourer', name:'Hire another worker', cost:216, detail:'Theo joins Maya. Two workers, more kettles in motion.', receipt:'You are now managing the situation.' },
  { id:'big', name:'Family-size kettles', cost:1008, detail:'24 litres per batch. Same charming silhouette.', receipt:'Economies of kettle.' },
  { id:'boat', name:'Offshore pilot boat', cost:2304, detail:'80 litres per batch. Move beyond the warm bit.', receipt:'The shoreline is steaming. Take this offshore.' },
  { id:'generator', name:'Marine generator', cost:6912, detail:'240 litres per batch. More watts, fewer doubts.', receipt:'The hum of measurable progress.' },
  { id:'barge', name:'Dedicated kettle barge', cost:17280, detail:'800 litres per batch. Technically still an appliance.', receipt:'Procurement has stopped returning calls.' },
  { id:'station', name:'Offshore power station', cost:57600, detail:'2,400 litres per batch. Domestic design, industrial scale.', receipt:'A power station. For a kettle.' },
  { id:'mega', name:'The final kettle', cost:172800, detail:'8,000 litres per batch. Finish what you started.', receipt:'It still makes the tiny click.' },
];
export const SPONSOR_DEALS=[
 {rate:18,cost:180,litres:20,receipt:'Warm Regards™ would like a larger logo on the kettle.'},
 {rate:27,cost:720,litres:100,receipt:'Warm Regards™ now considers this a brand activation.'},
];
export function sponsorRate(game){return game.sponsorLevel?SPONSOR_DEALS[game.sponsorLevel-1].rate:12;}
export function renegotiate(game){
 const deal=SPONSOR_DEALS[game.sponsorLevel||0];
 if(!deal||game.won||game.cash<deal.cost||game.litres<deal.litres)return null;
 game.cash-=deal.cost;game.sponsorLevel=(game.sponsorLevel||0)+1;return deal;
}
export const BOIL_SECONDS=8;
export const HEAT_TARGET = 800000;
export function createGame(){return {cash:0,litres:0,upgrades:[],phase:'empty',progress:0,batches:0,elapsed:0,won:false,activeKettle:0,kettles:[{phase:'empty',progress:0,waterLitres:0,pickupKind:'hot'}]};}
export function capacity(game){return game.upgrades.includes('mega')?8000:game.upgrades.includes('station')?2400:game.upgrades.includes('barge')?800:game.upgrades.includes('generator')?240:game.upgrades.includes('boat')?80:game.upgrades.includes('big')?24:game.upgrades.includes('strip')?6:game.upgrades.includes('second')?2:1;}
export function temperature(game){return 18+82*Math.min(1,game.litres/HEAT_TARGET);}
export function nextUpgrade(game){return UPGRADES[game.upgrades.length];}
export function buyUpgrade(game){const upgrade=nextUpgrade(game);if(!upgrade||game.cash<upgrade.cost||game.won)return null;game.cash-=upgrade.cost;game.upgrades.push(upgrade.id);return upgrade;}
export function powerPosition(game){return game.upgrades.includes('boat')?{x:6,z:0}:game.upgrades.includes('cord')?{x:1.3,z:2.4}:{x:-4,z:1};}
export function waterPosition(game){return game.upgrades.includes('boat')?{x:8,z:.75}:{x:2.3,z:4.3};}
export function kettleCount(game){return game.upgrades.includes('barge')?1:game.upgrades.includes('boat')?2:game.upgrades.includes('strip')?6:game.upgrades.includes('second')?2:1;}
export function kettleCapacity(game){return capacity(game)/kettleCount(game);}
export function isAtWater(game,position){
  const beach=position.x>=1.9&&position.x<=2.85&&position.z>=-8&&position.z<=11;
  if(!game.upgrades.includes('boat'))return beach;
  return (beach&&Math.abs(position.z)>.9)||(position.x>=4.5&&position.x<=9.3&&position.z>=.5&&position.z<=1.1);
}
export function nearestWaterPosition(game,position){
  if(game.upgrades.includes('boat')&&position.x>3)return {x:Math.max(4.6,Math.min(9,position.x)),z:.75};
  return {x:2.3,z:Math.max(-8,Math.min(11,Math.abs(position.z)<1&&game.upgrades.includes('boat')?1.2:position.z))};
}
const kettleState=()=>({phase:'empty',progress:0,waterLitres:0,pickupKind:'hot'});
const carriedPhases=['empty','filling','full','placing','lifting','hot','pouring'];
export function isCarrying(game){return carriedPhases.includes(game.phase)&&!game.workers?.some(worker=>worker.index===game.activeKettle);}
export function ensureKettles(game){
  const count=kettleCount(game);
  if(!Array.isArray(game.kettles))game.kettles=[];
  if(!Number.isInteger(game.activeKettle)||game.activeKettle>=count)game.activeKettle=0;
  game.kettles.length=Math.min(game.kettles.length,count);
  while(game.kettles.length<count)game.kettles.push(kettleState());
  syncActiveKettle(game);
}
function syncActiveKettle(game){game.kettles[game.activeKettle]={phase:game.phase,progress:game.progress,waterLitres:game.waterLitres||0,pickupKind:game.pickupKind||'hot'};}
// A queued switch waits until the held kettle has been set down at the table.
export function selectKettle(game,index){
  ensureKettles(game);
  if(game.workers?.some(worker=>worker.index===index))return false;
  if(!game.kettles[index]||!['empty','boiling','ready'].includes(game.phase))return false;
  if(index===game.activeKettle)return true;
  syncActiveKettle(game);game.activeKettle=index;Object.assign(game,game.kettles[index]);
  if(game.phase==='empty'){game.phase='lifting';game.progress=0;game.pickupKind='empty';}
  syncActiveKettle(game);return true;
}
export function advanceGame(game,seconds,{nearWater=false,nearPower=false,autoSelectSpare=false,actionReady=true}={}){
  if(game.won)return [];
  ensureKettles(game);game.elapsed+=seconds;game.lastPayment=0;
  if(autoSelectSpare&&nearPower&&!game.upgrades.includes('filler')&&['empty','boiling'].includes(game.phase)){
    const ready=game.kettles.findIndex((kettle,index)=>index!==game.activeKettle&&kettle.phase==='ready');
    const empty=game.phase==='boiling'?game.kettles.findIndex((kettle,index)=>index!==game.activeKettle&&kettle.phase==='empty'):-1;
    if(ready>=0||empty>=0)selectKettle(game,ready>=0?ready:empty);
  }
  const events=[],hasFiller=game.upgrades.includes('filler'),hasPourer=game.upgrades.includes('pourer');
  const process=(kettle,selected)=>{
    const atWater=selected&&nearWater,atPower=selected&&nearPower;
    if(game.workers?.some(worker=>worker.index===game.kettles.indexOf(kettle)||selected&&worker.index===game.activeKettle))return;
    if(hasFiller&&!selected&&['empty','filling','full'].includes(kettle.phase))return;
    if(kettle.phase==='empty'&&(atWater)){kettle.phase='filling';kettle.progress=0;if(selected)events.push('fill');}
    if(kettle.phase==='filling'){
      if(atWater)kettle.progress+=seconds/2.4;
      if(kettle.progress>=1){kettle.phase='full';kettle.progress=0;kettle.waterLitres=kettleCapacity(game);}
    }else if(kettle.phase==='full'&&(atPower)){
      kettle.phase='placing';kettle.progress=0;events.push('place');
    }else if(kettle.phase==='placing'){
      if(!selected||actionReady)kettle.progress+=seconds/1.2;
      if(kettle.progress>=1){kettle.phase=kettle.pickupKind==='returnHot'?'ready':'boiling';kettle.pickupKind='hot';kettle.progress=0;if(kettle.phase==='boiling')events.push('boil');}
    }else if(kettle.phase==='boiling'){
      kettle.progress+=seconds*(nearPower&&hasPourer?2:1)/BOIL_SECONDS;
      if(kettle.progress>=1){kettle.phase='ready';kettle.progress=0;events.push('click');}
    }else if(kettle.phase==='ready'&&atPower){
      kettle.phase='lifting';kettle.progress=0;kettle.pickupKind='hot';
    }else if(kettle.phase==='lifting'){
      if(!selected||actionReady)kettle.progress+=seconds;
      if(kettle.progress>=1){kettle.phase=kettle.pickupKind==='empty'?'empty':'hot';kettle.progress=0;}
    }else if((kettle.phase==='hot'&&atWater)){
      kettle.phase='pouring';kettle.progress=0;if(selected)events.push('pour');
    }else if(kettle.phase==='pouring'){
      if(selected&&!atWater){kettle.phase='hot';kettle.progress=0;return;}
      if(atWater)kettle.progress+=seconds/1.7;
      if(kettle.progress>=1){
        const litres=kettle.waterLitres||kettleCapacity(game),payment=litres*sponsorRate(game);
        game.cash+=payment;game.lastPayment+=payment;game.litres+=litres;game.batches++;
        kettle.phase='empty';kettle.progress=0;kettle.waterLitres=0;events.push('paid');
      }
    }
  };
  process(game,true);syncActiveKettle(game);
  game.kettles.forEach((kettle,index)=>{if(index!==game.activeKettle)process(kettle,false);});
  if(hasFiller){advanceFiller(game,seconds);if(game.lastPayment>0)events.push('paid');}
  if(game.litres>=HEAT_TARGET){game.won=true;events.push('win');}
  return [...new Set(events)];
}
export function restoreGame(serialized){
  try{const saved=JSON.parse(serialized);if(!saved||!Number.isFinite(saved.cash)||!Number.isFinite(saved.litres)||saved.cash<0||saved.litres<0)return createGame();
    if(!Array.isArray(saved.upgrades)||saved.upgrades.some((id,index)=>id!==UPGRADES[index]?.id))return createGame();
    const game={...createGame(),cash:saved.cash,litres:saved.litres,sponsorLevel:Number.isInteger(saved.sponsorLevel)&&saved.sponsorLevel>=0&&saved.sponsorLevel<=2?saved.sponsorLevel:0,upgrades:saved.upgrades,elapsed:Math.max(0,Number(saved.elapsed)||0),batches:Math.max(0,Number(saved.batches)||0),won:saved.litres>=HEAT_TARGET};
    const valid=state=>state&&['empty','filling','full','placing','boiling','ready','lifting','hot','pouring'].includes(state.phase)&&Number.isFinite(state.progress)&&state.progress>=0&&state.progress<=1;
    if(Array.isArray(saved.kettles)&&saved.kettles.length===kettleCount(game)&&saved.kettles.every(valid)){
      game.kettles=saved.kettles.map(state=>({...kettleState(),phase:state.phase,progress:state.progress,waterLitres:Number.isFinite(state.waterLitres)&&state.waterLitres>=0?state.waterLitres:0,pickupKind:['empty','returnHot'].includes(state.pickupKind)?state.pickupKind:'hot'}));
      game.activeKettle=Number.isInteger(saved.activeKettle)&&saved.activeKettle>=0&&saved.activeKettle<game.kettles.length?saved.activeKettle:0;
      Object.assign(game,game.kettles[game.activeKettle]);
    }
    ensureKettles(game);return game;
  }catch{return createGame();}
}

