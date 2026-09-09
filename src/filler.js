import { kettleApproach, nextWalkingPoint, tableBounds } from './movement.js';
import { sponsorRate, kettleCapacity, nearestWaterPosition } from './game.js';

export function advanceFiller(game,seconds){
 const count=game.upgrades.includes('pourer')?2:1;
 game.workers ||= Array.from({length:count},(_,i)=>({x:i?-.5:0,z:3,index:null,stage:'idle',progress:0}));
 while(game.workers.length<count)game.workers.push({x:-.5,z:3,index:null,stage:'idle',progress:0});
 for(const worker of game.workers)advanceWorker(game,seconds,worker);
 game.filler=game.workers[0];
 Object.assign(game,game.kettles[game.activeKettle]);
}
function advanceWorker(game,seconds,worker){
 if(worker.index===null){
  const eligible=(k,i)=>!game.workers.some(w=>w.index===i)&&!(i===game.activeKettle&&['empty','filling','full','hot','pouring','lifting','placing'].includes(game.phase))&&['empty','filling','full','ready'].includes(k.phase);
  let index=game.kettles.findIndex((k,i)=>k.phase==='ready'&&eligible(k,i));
  if(index<0)index=game.kettles.findIndex(eligible);
  if(index<0){worker.stage='idle';return;}
  worker.index=index;worker.stage='collect';worker.progress=0;
 }
 const kettle=game.kettles[worker.index];
 if(!kettle||!['empty','filling','full','ready','hot','pouring'].includes(kettle.phase)){worker.index=null;worker.stage='idle';return;}
 const table=kettleApproach(game,worker.index);
 const shore=nearestWaterPosition(game,{x:table.x,z:table.z+3});
 const target=worker.stage==='collect'||worker.stage==='return'?table:shore;
 if(['collect','water','hot-water','return'].includes(worker.stage)){
  const point=nextWalkingPoint(worker,target,tableBounds(game));
  const dx=point.x-worker.x,dz=point.z-worker.z,length=Math.hypot(dx,dz),step=Math.min(length,seconds*3);
  if(length>.001){worker.x+=dx/length*step;worker.z+=dz/length*step;worker.facing=Math.atan2(dx,dz);}
  if(Math.hypot(worker.x-target.x,worker.z-target.z)<.04){
   worker.stage=worker.stage==='collect'?'pickup':worker.stage==='water'?'scoop':worker.stage==='hot-water'?'pour':'place';worker.progress=0;
  }
 }else if(worker.stage==='pickup'){
  worker.progress=Math.min(1,worker.progress+seconds);
  if(worker.progress===1){worker.stage=kettle.phase==='full'?'return':kettle.phase==='ready'?'hot-water':'water';worker.progress=0;}
 }else if(worker.stage==='pour'){
  worker.progress=Math.min(1,worker.progress+seconds/1.7);
  if(worker.progress===1){const litres=kettle.waterLitres||kettleCapacity(game);game.cash+=litres*sponsorRate(game);game.lastPayment+=litres*sponsorRate(game);game.litres+=litres;game.batches++;kettle.phase='empty';kettle.waterLitres=0;kettle.progress=0;worker.stage='scoop';worker.progress=0;}
 }else if(worker.stage==='scoop'){
  worker.progress=Math.min(1,worker.progress+seconds/2.4);kettle.phase='filling';kettle.progress=worker.progress;
  if(worker.progress===1){kettle.phase='full';kettle.progress=0;kettle.waterLitres=kettleCapacity(game);worker.stage='return';}
 }else if(worker.stage==='place'){
  worker.progress=Math.min(1,worker.progress+seconds/1.2);
  if(worker.progress===1){kettle.phase='boiling';kettle.progress=0;worker.index=null;worker.stage='idle';}
 }
 if(worker.index===game.activeKettle)Object.assign(game,kettle);
 else if(worker.index===null)Object.assign(game,game.kettles[game.activeKettle]);
}
