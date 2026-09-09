import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceGame,buyUpgrade,capacity,temperature,restoreGame,UPGRADES,selectKettle,ensureKettles,isAtWater,nearestWaterPosition} from '../src/game.js';
function runUntil(game,predicate,location,limit=20000){for(let i=0;i<limit;i++){advanceGame(game,.1,location);if(predicate())return;}assert.fail('Progression stalled: '+game.phase);}
test('the real manual loop needs water, power, then water and pays on return',()=>{const game=createGame();advanceGame(game,3);assert.equal(game.phase,'empty');runUntil(game,()=>game.phase==='full',{nearWater:true});advanceGame(game,3,{nearWater:true});assert.equal(game.phase,'full');runUntil(game,()=>game.phase==='hot',{nearPower:true});assert.equal(game.cash,0);runUntil(game,()=>game.batches===1,{nearWater:true});assert.equal(game.cash,12);assert.equal(game.litres,1);});
test('first investment is affordable after exactly three trips',()=>{const game=createGame();for(let i=0;i<3;i++){advanceGame(game,.1,{});runUntil(game,()=>game.phase==='full',{nearWater:true});runUntil(game,()=>game.phase==='hot',{nearPower:true});runUntil(game,()=>game.batches===i+1,{nearWater:true});if(i<2)assert.equal(buyUpgrade(game),null);}assert.equal(game.cash,36);assert.equal(buyUpgrade(game).id,'cord');assert.equal(game.cash,0);});
test('full progression reaches a real 100 degree ending with staff and every expansion',()=>{const game=createGame();let ticks=0;while(!game.won&&ticks<30000){buyUpgrade(game);if(game.awaitingScoop)advanceGame(game,.1,{});ensureKettles(game);if(game.phase==='boiling'&&!game.upgrades.includes('filler')){const next=game.kettles.findIndex((k,i)=>i!==game.activeKettle&&k.phase==='ready');const empty=game.kettles.findIndex((k,i)=>i!==game.activeKettle&&k.phase==='empty');if(next>=0||empty>=0)selectKettle(game,next>=0?next:empty);}const nearWater=['empty','filling','hot','pouring'].includes(game.phase);advanceGame(game,.1,{nearWater,nearPower:!nearWater});ticks++;}assert.equal(game.won,true);assert.equal(temperature(game),100);assert.deepEqual(game.upgrades,UPGRADES.map(upgrade=>upgrade.id));assert.equal(capacity(game),8000);assert.ok(game.elapsed>600&&game.elapsed<2700,`Run length ${game.elapsed}s`);console.log(`Complete supervised run: ${(game.elapsed/60).toFixed(1)} minutes, ${game.batches} batches`);});
test('staff operates the full loop with no player nearby',()=>{const game=createGame();game.upgrades=UPGRADES.slice(0,5).map(u=>u.id);runUntil(game,()=>game.batches>=12,{});assert.equal(game.cash,144);assert.equal(game.workers.length,2);});
test('save restoration tolerates invalid data and discards an interrupted batch',()=>{assert.deepEqual(restoreGame('bad'),createGame());assert.deepEqual(restoreGame('{"cash":-4,"litres":5}'),createGame());assert.deepEqual(restoreGame('{"cash":4,"litres":5,"upgrades":["mega"]}'),createGame());const game=createGame();game.cash=28;game.phase='pouring';game.progress=.5;const restored=restoreGame(JSON.stringify(game));assert.equal(restored.cash,28);assert.equal(restored.phase,'empty');});

test('placing and picking up require visiting power; hot kettles do not teleport',()=>{
 const game=createGame();runUntil(game,()=>game.phase==='full',{nearWater:true});
 advanceGame(game,1,{});assert.equal(game.phase,'full');
 advanceGame(game,.1,{nearPower:true});assert.equal(game.phase,'placing');
 runUntil(game,()=>game.phase==='ready',{});
 advanceGame(game,2,{nearWater:true});assert.equal(game.phase,'ready');assert.equal(game.cash,0);
 advanceGame(game,.1,{nearPower:true});assert.equal(game.phase,'lifting');
 runUntil(game,()=>game.phase==='hot',{});runUntil(game,()=>game.batches===1,{nearWater:true});assert.equal(game.cash,12);
});

test('a second kettle fills while the first keeps boiling, with payment per kettle',()=>{
 const game=createGame();game.upgrades=['cord','second'];ensureKettles(game);
 runUntil(game,()=>game.phase==='full',{nearWater:true});runUntil(game,()=>game.phase==='boiling',{nearPower:true});
 assert.equal(selectKettle(game,1),true);runUntil(game,()=>game.phase==='empty',{nearPower:true});
 runUntil(game,()=>game.phase==='full',{nearWater:true});assert.equal(game.kettles[0].phase,'boiling');assert.ok(game.kettles[0].progress>.3);assert.equal(game.kettles[1].phase,'full');
 assert.equal(selectKettle(game,0),false);runUntil(game,()=>game.phase==='boiling',{nearPower:true});
 runUntil(game,()=>game.kettles[0].phase==='ready',{});assert.equal(selectKettle(game,0),true);
 runUntil(game,()=>game.phase==='hot',{nearPower:true});runUntil(game,()=>game.batches===1,{nearWater:true});assert.equal(game.cash,12);
 assert.ok(['boiling','ready'].includes(game.kettles[1].phase));
 const restored=restoreGame(JSON.stringify(game));assert.deepEqual(restored.kettles,game.kettles);
});
test('water interaction follows the shore at different points, including after moving offshore',()=>{
 const game=createGame();for(const z of [-8,-3,0,4.3,10.5]){assert.equal(isAtWater(game,{x:2.3,z}),true);assert.equal(nearestWaterPosition(game,{x:-2,z}).z,z);}
 assert.equal(isAtWater(game,{x:1,z:4.3}),false);assert.equal(isAtWater(game,{x:-4,z:1}),false);
 game.upgrades=UPGRADES.slice(0,7).map(u=>u.id);assert.equal(isAtWater(game,{x:2.3,z:5}),true);assert.equal(isAtWater(game,{x:7,z:.75}),true);assert.equal(isAtWater(game,{x:2.3,z:0}),false);
});

test('a hot kettle can be placed back and another picked up without losing water or heat',()=>{
 const game=createGame();game.upgrades=['cord','second'];ensureKettles(game);
 runUntil(game,()=>game.phase==='full',{nearWater:true});runUntil(game,()=>game.phase==='hot',{nearPower:true});
 // The controller starts this placement only after arriving at the table.
 game.phase='placing';game.progress=0;game.pickupKind='returnHot';
 runUntil(game,()=>game.phase==='ready',{nearPower:true});
 assert.equal(game.waterLitres,1);assert.equal(game.cash,0);
 assert.equal(selectKettle(game,1),true);runUntil(game,()=>game.phase==='empty',{nearPower:true});
 assert.equal(game.kettles[0].phase,'ready');
 runUntil(game,()=>game.phase==='full',{nearWater:true});runUntil(game,()=>game.phase==='boiling',{nearPower:true});
 assert.equal(selectKettle(game,0),true);runUntil(game,()=>game.phase==='hot',{nearPower:true});
 assert.equal(game.kettles[1].phase,'boiling');
 runUntil(game,()=>game.batches===1,{nearWater:true});assert.equal(game.cash,12);
});

test('walking between shore and station handles spare kettles without selection clicks',()=>{
 const game=createGame();game.upgrades=['cord','second'];ensureKettles(game);
 const shore={nearWater:true,autoSelectSpare:true},station={nearPower:true,autoSelectSpare:true};
 runUntil(game,()=>game.phase==='full',shore);
 runUntil(game,()=>game.activeKettle===1&&game.phase==='empty',station);
 assert.equal(game.kettles[0].phase,'boiling');
 runUntil(game,()=>game.phase==='full',shore);
 runUntil(game,()=>game.activeKettle===0&&game.phase==='hot',station);
 assert.equal(game.kettles[1].phase,'boiling');
 runUntil(game,()=>game.batches===1,shore);
 advanceGame(game,.1,shore);assert.equal(game.phase,'filling');
 assert.equal(game.cash,12);
});


test('one worker completes the full loop, and two workers increase output with exclusive kettle ownership',()=>{
 const totals=[];
 for(const count of [1,2]){
  const game=createGame();game.upgrades=UPGRADES.slice(0,3+count).map(u=>u.id);ensureKettles(game);
  const stages=new Set();
  for(let step=0;step<1800;step++){
   advanceGame(game,.1,{});
   const claims=game.workers.filter(w=>w.index!==null).map(w=>w.index);
   assert.equal(new Set(claims).size,claims.length);
   for(const worker of game.workers)stages.add(worker.stage);
   assert.equal(game.kettles.length,6);
   assert.equal(game.cash,game.litres*12);
  }
  assert.ok(game.batches>5);
  for(const stage of ['collect','water','scoop','return','place','hot-water','pour'])assert.ok(stages.has(stage),stage);
  totals.push(game.batches);
 }
 assert.ok(totals[1]>totals[0],`one worker: ${totals[0]}, two: ${totals[1]}`);
});

test('workers never take the player kettle during scooping or the carry back to its base',()=>{
 const game=createGame();game.upgrades=UPGRADES.slice(0,5).map(u=>u.id);ensureKettles(game);
 runUntil(game,()=>game.phase==='full',{nearWater:true});
 for(let i=0;i<30;i++){
  advanceGame(game,.1,{});assert.equal(game.phase,'full');
  assert.ok(game.workers.every(worker=>worker.index!==game.activeKettle));
 }
 advanceGame(game,.1,{nearPower:true});assert.equal(game.phase,'placing');
 advanceGame(game,.5,{nearPower:true,actionReady:false});assert.equal(game.progress,0);
 runUntil(game,()=>game.phase==='boiling',{nearPower:true});
});

test('an empty kettle at the station never starts boiling',()=>{
 const game=createGame();
 for(let i=0;i<100;i++)advanceGame(game,.1,{nearPower:true});
 assert.equal(game.phase,'empty');assert.equal(game.progress,0);assert.equal(game.cash,0);
});

test('leaving the shoreline interrupts pouring and returning finishes exactly one payment',()=>{
 const game=createGame();
 runUntil(game,()=>game.phase==='full',{nearWater:true});
 runUntil(game,()=>game.phase==='hot',{nearPower:true});
 advanceGame(game,.1,{nearWater:true});advanceGame(game,.5,{nearWater:true});
 assert.equal(game.phase,'pouring');assert.ok(game.progress>0);
 advanceGame(game,.1,{});assert.equal(game.phase,'hot');assert.equal(game.progress,0);
 advanceGame(game,10,{});assert.equal(game.phase,'hot');assert.equal(game.cash,0);assert.equal(game.waterLitres,1);
 runUntil(game,()=>game.batches===1,{nearWater:true});assert.equal(game.cash,12);
 advanceGame(game,10,{});assert.equal(game.batches,1);
});

test('sponsor deals require milestones and cash, persist, and pay player and workers the new rate',async()=>{
 const {renegotiate,sponsorRate}=await import('../src/game.js');
 const game=createGame();game.cash=180;game.litres=19;
 assert.equal(renegotiate(game),null);game.litres=20;game.cash=179;assert.equal(renegotiate(game),null);
 game.cash=180;assert.equal(renegotiate(game).rate,18);assert.equal(game.cash,0);
 runUntil(game,()=>game.phase==='full',{nearWater:true});runUntil(game,()=>game.phase==='hot',{nearPower:true});runUntil(game,()=>game.batches===1,{nearWater:true});assert.equal(game.cash,18);
 game.cash=720;game.litres=100;assert.equal(renegotiate(game).rate,27);assert.equal(renegotiate(game),null);
 assert.equal(sponsorRate(restoreGame(JSON.stringify(game))),27);
 game.upgrades=UPGRADES.slice(0,5).map(u=>u.id);const before=game.batches;
 runUntil(game,()=>game.batches>before,{});assert.equal(game.cash,(game.batches-before)*27);
});
