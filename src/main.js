import { nearestAvailableKettle, isAtStation, kettleApproach, tableBounds, stationApproach, keepOutsideTable, nextWalkingPoint } from './movement.js';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-700.css';
import './style.css';
import { OceanScene } from './scene.js';
import { OceanAudio } from './audio.js';
import { SPONSOR_DEALS,sponsorRate,renegotiate,BOIL_SECONDS,UPGRADES,createGame,restoreGame,advanceGame,buyUpgrade,capacity,temperature,powerPosition,waterPosition,kettleCapacity,isAtWater,nearestWaterPosition,selectKettle,ensureKettles,isCarrying } from './game.js';
const $=id=>document.getElementById(id);
// Development-only acceleration exercises the same movement and phase updates in small steps.
const testSpeed=import.meta.env.DEV?Math.min(40,Math.max(1,Number(new URLSearchParams(location.search).get('testSpeed'))||1)):1;
const SAVE_KEY=testSpeed>1?'boil-the-ocean-test':'boil-the-ocean-v1';
let game;try{game=restoreGame(localStorage.getItem(SAVE_KEY));}catch{game=createGame();}
let scene;
try{scene=new OceanScene($('world'));}catch(error){$('intro').innerHTML='<div class="dialog"><h2>We need a little graphics power.</h2><p>This game needs WebGL. Please enable hardware acceleration in your browser and reload.</p></div>';throw error;}
const audio=new OceanAudio();
let started=false,paused=false,destination=null,lastTime=performance.now(),saveTimer=0,bubbleTimer=0,toastTimer,payoutTimer,shopExpanded=innerWidth>650;
const keys=new Set();
let pendingKettle=null,kettleButtons=[],manualKettleChoice=false;
const dollars=value=>'$'+Math.floor(value).toLocaleString('en-US');
const compact=value=>value>=1e6?(value/1e6).toFixed(2)+'M':value>=1e4?(value/1000).toFixed(1)+'k':Math.floor(value).toLocaleString('en-US');
const labels={water:document.createElement('div'),power:document.createElement('div')};
for(const [name,label] of Object.entries(labels)){label.className='world-label';label.textContent=name==='water'?'↓  OCEAN WATER':'ϟ  HOTEL POWER';if(name==='power')$('world-labels').append(label);}
let emptyHintSince=null;
const fullHint=document.createElement('div');
fullHint.className='full-kettle-hint hidden';fullHint.setAttribute('role','status');
fullHint.innerHTML='<strong>Full kettle, boss.</strong><span>More ocean won’t fit.</span><small>Back to the station · <kbd>2</kbd> to boil</small>';
$('world-labels').append(fullHint);
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(game));}catch{showToast('Browser storage is unavailable. Keep this tab open to retain progress.');}}
function showToast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4800);}
function showPayout(){const amount=game.lastPayment;$('payout').textContent='+'+dollars(amount);$('payout').classList.remove('show');requestAnimationFrame(()=>$('payout').classList.add('show'));clearTimeout(payoutTimer);payoutTimer=setTimeout(()=>$('payout').classList.remove('show'),1500);}
function moveTo(point){destination=keepOutsideTable({x:point.x,z:point.z},tableBounds(game));scene.destination.position.set(point.x,.04,point.z);scene.destination.visible=true;}
function goToStation(name){if(!started||paused)return;moveTo(name==='water'?nearestWaterPosition(game,scene.player.group.position):stationApproach(game));}
function constrainPosition(position){
  position.x=Math.max(-13,Math.min(game.upgrades.includes('boat')?9:2.5,position.x));position.z=Math.max(-8,Math.min(11,position.z));
  // Walkable surfaces are the beach, connecting pier and offshore work platform.
  if(position.x>2.5&&game.upgrades.includes('boat'))position.z=position.x<4.5?Math.max(-.7,Math.min(.7,position.z)):Math.max(-2.8,Math.min(.8,position.z));
  keepOutsideTable(position,tableBounds(game));
  if(position.x<-4.5&&position.x>-11.3&&position.z<-1.7)position.z=-1.7;
}
function movePlayer(dt,time){
  const position=scene.player.group.position;let dx=0,dz=0;
  if(['placing','lifting'].includes(game.phase)){
    destination=null;scene.destination.visible=false;
    const target=kettleApproach(game),waypoint=nextWalkingPoint(position,target,tableBounds(game));
    const dx=waypoint.x-position.x,dz=waypoint.z-position.z,length=Math.hypot(dx,dz);
    if(length<.025)return false;
    const distance=Math.min(length,dt*4.6);position.x+=dx/length*distance;position.z+=dz/length*distance;
    constrainPosition(position);scene.player.group.rotation.y=Math.atan2(dx,dz);return true;
  }
  if(keys.has('w')||keys.has('arrowup')){dx-=.53;dz-=.85;}
  if(keys.has('s')||keys.has('arrowdown')){dx+=.53;dz+=.85;}
  if(keys.has('a')||keys.has('arrowleft')){dx-=.85;dz+=.53;}
  if(keys.has('d')||keys.has('arrowright')){dx+=.85;dz-=.53;}
  if(dx||dz){destination=null;scene.destination.visible=false;}
  else if(destination){const waypoint=nextWalkingPoint(position,destination,tableBounds(game));dx=waypoint.x-position.x;dz=waypoint.z-position.z;if(Math.hypot(destination.x-position.x,destination.z-position.z)<.15){destination=null;scene.destination.visible=false;return false;}}
  const length=Math.hypot(dx,dz);if(length===0)return false;const distance=Math.min(length,dt*4.6);position.x+=dx/length*distance;position.z+=dz/length*distance;constrainPosition(position);scene.player.group.rotation.y=Math.atan2(dx,dz);return true;
}
function updateShop(){
  const count=game.upgrades.length;$('shop-toggle').style.background=game.cash>=(UPGRADES[count]?.cost??Infinity)?'#d6e99c':'';const visible=UPGRADES.slice(count,count+3);$('upgrade-list').replaceChildren();
  if(!visible.length){const complete=document.createElement('div');complete.className='upgrade';complete.innerHTML='<small>PROCUREMENT COMPLETE</small><b>No bigger kettle exists.</b><p>Supervise the final kettle to double production. The ocean is warming.</p>';$('upgrade-list').append(complete);return;}
  visible.forEach((upgrade,index)=>{const button=document.createElement('button');button.className='upgrade'+(index?' locked':game.cash>=upgrade.cost?' affordable':'');button.disabled=index>0||game.cash<upgrade.cost||game.won;button.dataset.upgrade=upgrade.id;button.innerHTML=`<small>${index?'UP NEXT':'NEXT INVESTMENT'}</small><div class="upgrade-top"><b>${upgrade.name}</b><strong>${dollars(upgrade.cost)}</strong></div><p>${upgrade.detail}</p>`;
  button.addEventListener('click',()=>{const purchased=buyUpgrade(game);if(!purchased)return;audio.play('upgrade');showToast(purchased.receipt);if(purchased.id==='boat'){destination=null;scene.player.group.position.set(4,0,0);moveTo(stationApproach(game));}if(innerWidth<=650)setShopExpanded(false);updateShop();save();});$('upgrade-list').append(button);});
}
let shopCash=-1,shopLevel=-1;
$('renegotiate').addEventListener('click',()=>{const deal=renegotiate(game);if(!deal)return;audio.play('upgrade');showToast(deal.receipt);save();updateUI();});
function updateUI(){
  const deal=SPONSOR_DEALS[game.sponsorLevel||0],rate=sponsorRate(game);
  $('sponsor-rate').textContent='$'+rate+' per litre';
  $('sponsor-terms').textContent='Paying $'+rate+' per litre. No questions asked.';
  $('renegotiate').disabled=!deal||game.won||game.cash<deal.cost||game.litres<deal.litres;
  $('renegotiate').textContent=!deal?'Top sponsor deal ✓':game.litres<deal.litres?'At '+deal.litres+' L: $'+deal.rate+'/L · $'+deal.cost:'Renegotiate · $'+deal.cost+' → $'+deal.rate+'/L';

  const heat=temperature(game);$('temperature').textContent=heat.toFixed(2);$('heat-bar').style.width=((heat-18)/82*100)+'%';$('cash').textContent=dollars(game.cash);$('litres').textContent=compact(game.litres)+(game.litres===1?' litre responsibly boiled':' litres responsibly boiled');$('temp-trend').textContent=heat<18.1?'↑ doing our best':heat<40?'↑ measurable progress':heat<80?'↑ definitely working':'↑ almost unreasonable';
  const automated=game.upgrades.includes('filler')&&!isCarrying(game);const state={empty:['01','Take your kettle to the water.','Scoop anywhere along the ocean edge. Click the ground or use WASD.','EMPTY KETTLE'],filling:['01','A little ocean, to go.','Stay by the water to finish the scoop. Then carry it to the hotel plug.','FILLING'],full:['02','Kettle full. Ready to boil.','Water collected. Walk up to any side of the kettle table to put it on its base.','FULL KETTLE'],placing:['02','Setting the kettle on its base.','Putting it down and switching it on.','PLACING KETTLE'],lifting:['03','Picking up your kettle.','Now carry it back to the shoreline.','PICKING UP'],hot:['03','Carry the hot water back to the ocean.','Walk to any part of the ocean edge to pour and collect your sponsor payment.','100°C • CARRYING'],boiling:['02','Your kettle is boiling.','The kettle stays on its base while it boils. Come back to pick it up after the click.','BOILING'],ready:['03','Boiled. Ready to return.','Walk up to the kettle table to pick it up, then carry it back to the ocean.','100°C • READY'],pouring:['03','One litre closer.','Returning this very warm contribution to the ocean.','POURING']}[game.phase];
  $('task-icon').textContent=automated?'↗':state[0];$('task-title').textContent=game.won?'That should clear things up.':automated?'Your team has the kettle situation handled.':state[1];$('task-detail').textContent=game.won?'All work complete. Walk around, admire the steam, or start a fresh ocean in the pause menu.':automated?'Stand at KETTLES to double boiling speed. Invest in the next expansion.':automated&&['empty','filling','full','boiling'].includes(game.phase)?'Maya handles the whole loop. You can help with an available kettle.':state[2];$('task-label').textContent=automated?'MANAGEMENT, APPARENTLY':'YOUR EXTREMELY IMPORTANT TASK';$('batch-label').textContent=game.won?'JOB DONE':state[3];$('batch-progress').style.width=(['full','ready','hot'].includes(game.phase)?100:game.progress*100)+'%';$('batch-detail').textContent='Kettle '+String.fromCharCode(65+game.activeKettle)+' · '+compact(kettleCapacity(game))+' L';
  $('help-water').classList.toggle('active',['empty','filling','hot','pouring'].includes(game.phase));
  $('help-power').classList.toggle('active',['full','placing','boiling','ready','lifting'].includes(game.phase));
  const chapter=game.upgrades.includes('mega')?['04','THE FINAL DELIVERABLE','An ocean-sized point.']:game.upgrades.includes('barge')?['03','OPERATIONAL EXCELLENCE','This has escalated.']:game.upgrades.includes('boat')?['02','OFFSHORE EXPANSION','Beyond the warm bit.']:['01','THE PILOT PROGRAM','One kettle. One ocean.'];document.querySelector('.chapter-number').textContent=chapter[0];$('chapter-label').textContent=chapter[1];$('chapter-name').textContent=chapter[2];
  const station=powerPosition(game);const water=scene.project({...waterPosition(game),y:.4}),power=scene.project({x:station.x,z:station.z-.9,y:1.6});for(const [name,point] of [['water',water],['power',power]]){labels[name].style.left=point.x+'px';labels[name].style.top=(point.y+(name==='power'?-18:22))+'px';}labels.power.textContent=game.phase==='boiling'?`♨ BOILING · ${Math.round(18+82*game.progress)}°C · ${Math.ceil((1-game.progress)*BOIL_SECONDS)}s`:game.phase==='ready'?'✓ BOILED · 100°C':game.phase==='placing'?'ϟ SETTING ON BASE':'ϟ KETTLE STATION';labels.power.classList.toggle('boiling',game.phase==='boiling');labels.water.textContent=game.won?'≈  BOILING OCEAN':game.phase==='hot'?'↓ POUR ANYWHERE ON THE SHORE':'↓ SCOOP ANYWHERE ON THE SHORE';
  if(game.upgrades.includes('filler')){
    const job=game.filler;
    const names={idle:'Maya: waiting for a free kettle','hot-water':'Maya: taking hot water to the sea',pour:'Maya: pouring hot water',collect:'Maya: collecting a kettle',pickup:'Maya: picking up a kettle',water:'Maya: walking to the water',scoop:'Maya: filling your kettle',return:'Maya: returning to its base',place:'Maya: switching it on'};
    $('help-water').querySelector('small').textContent=names[job?.stage||'idle'];
  }else $('help-water').querySelector('small').textContent='Walk to any shore to scoop / pour';
  const showFullHint=started&&!paused&&!game.won&&game.phase==='full'&&isCarrying(game)&&isAtWater(game,scene.player.group.position);
  const showEmptyHint=started&&!paused&&!game.won&&['empty','filling'].includes(game.phase)&&isCarrying(game)&&isAtStation(game,scene.player.group.position);
  if(!showEmptyHint)emptyHintSince=null;
  else if(emptyHintSince===null)emptyHintSince=performance.now();
  const emptyHintReady=showEmptyHint&&performance.now()-emptyHintSince>=2000;
  const hintKind=showFullHint?'full':emptyHintReady?(game.phase==='filling'?'partial':'empty'):'';
  if(fullHint.dataset.kind!==hintKind){
    fullHint.dataset.kind=hintKind;
    fullHint.innerHTML=hintKind==='partial'?'<strong>A little more ocean, boss.</strong><span>Not full yet.</span><small>Back to the shore · <kbd>1</kbd> to finish</small>':hintKind==='empty'?'<strong>That’s just air, boss.</strong><span>Ocean first.</span><small>Walk to the shore · <kbd>1</kbd> to fetch</small>':'<strong>Full kettle, boss.</strong><span>More ocean won’t fit.</span><small>Back to the station · <kbd>2</kbd> to boil</small>';
  }
  fullHint.classList.toggle('hidden',!hintKind);
  if(hintKind){const point=scene.project({x:scene.player.group.position.x,y:1.8,z:scene.player.group.position.z});fullHint.style.left=Math.max(120,Math.min(innerWidth-120,point.x))+'px';fullHint.style.top=point.y+'px';}
  if(game.phase==='filling'&&isCarrying(game)&&!isAtWater(game,scene.player.group.position)){
    const percent=Math.min(99,Math.floor(game.progress*100));
    $('task-title').textContent='Not full yet. '+percent+'% ocean.';
    $('task-detail').textContent='Your scoop is unfinished. Return to the shore or press 1 to fill the rest.';
    $('batch-label').textContent=percent+'% FULL';
    $('help-water').querySelector('small').textContent='Finish your scoop at the shore';
    if(hintKind==='partial')fullHint.querySelector('span').textContent=percent+'% full. The rest is still in the ocean.';
  }
  updateKettleControls();
  if(shopCash!==game.cash||shopLevel!==game.upgrades.length){shopCash=game.cash;shopLevel=game.upgrades.length;updateShop();}
}
function requestKettle(index){
 if(!started||paused)return;
 if(game.workers?.some(worker=>worker.index===index)){showToast('A worker is using that kettle. Choose a free one.');return;}
 if(['filling','pouring'].includes(game.phase)){showToast('Finish the scoop or pour, then choose another kettle.');return;}
 manualKettleChoice=true;pendingKettle=index;moveTo(kettleApproach(game,['full','hot','placing','lifting'].includes(game.phase)?game.activeKettle:index));
}
function updateKettleControls(){
 ensureKettles(game);const count=game.kettles.length;
 $('kettle-controls').classList.toggle('hidden',count<2);
 if(kettleButtons.length!==count){
   $('kettle-controls').replaceChildren();kettleButtons=[];
   game.kettles.forEach((kettle,index)=>{const button=document.createElement('button');button.className='kettle-choice';button.addEventListener('click',()=>requestKettle(index));$('kettle-controls').append(button);kettleButtons.push(button);});
 }
 game.kettles.forEach((kettle,index)=>{
   const status=kettle.phase==='boiling'?Math.round(18+82*kettle.progress)+'°C':kettle.phase==='ready'?'Ready':kettle.phase==='hot'?'Hot, carrying':kettle.phase==='empty'?(index===game.activeKettle?'Carrying':'Pick up'):kettle.phase;
   kettleButtons[index].textContent='Kettle '+String.fromCharCode(65+index)+' · '+status;
   kettleButtons[index].classList.toggle('selected',index===game.activeKettle);
 });
}
function win(){save();audio.play('win');$('win-stats').textContent=`${compact(game.litres)} litres boiled. ${Math.floor(game.elapsed/60)} minutes of initiative. Zero instructions followed.`;setTimeout(()=>$('win').classList.remove('hidden'),1200);}
function setPaused(value){paused=value;$('pause-screen').classList.toggle('hidden',!value);keys.clear();if(value){save();audio.pause();}else audio.resume();}
function resetGame(){pendingKettle=null;$('reset-screen').classList.add('hidden');game=createGame();destination=null;scene.player.group.position.set(-3,0,4);scene.lastLevel=-1;$('win').classList.add('hidden');setPaused(false);save();updateShop();showToast('One kettle. A fresh misunderstanding.');}
$('start').addEventListener('click',()=>{started=true;$('intro').classList.add('hidden');audio.start();if(game.won)win();else if(game.litres>0)showToast('Welcome back. Your undertaking is exactly where you left it.');});

$('help-water').addEventListener('click',()=>goToStation('water'));$('help-power').addEventListener('click',()=>goToStation('power'));
$('quick-help-toggle').addEventListener('click',()=>{const collapsed=$('quick-help').classList.toggle('is-collapsed');$('quick-help-content').classList.toggle('hidden',collapsed);$('quick-help-toggle').textContent=collapsed?'+':'−';$('quick-help-toggle').setAttribute('aria-expanded',String(!collapsed));$('quick-help-toggle').setAttribute('aria-label',collapsed?'Expand quick help':'Collapse quick help');});
$('go-water').addEventListener('click',()=>goToStation('water'));$('go-power').addEventListener('click',()=>goToStation('power'));
$('world').addEventListener('pointerdown',event=>{if(!started||paused)return;const kettle=scene.kettleAtScreen(event.clientX,event.clientY);if(kettle!==null){requestKettle(kettle);return;}const point=scene.pointFromScreen(event.clientX,event.clientY);constrainPosition(point);moveTo(point);});
window.addEventListener('keydown',event=>{const key=event.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))event.preventDefault();if(key==='escape'&&started)setPaused(!paused);if(key==='1')goToStation('water');if(key==='2')goToStation('power');keys.add(key);});window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));window.addEventListener('blur',()=>keys.clear());document.addEventListener('visibilitychange',()=>{if(document.hidden&&started&&!game.won)setPaused(true);});window.addEventListener('pagehide',save);
$('sound').addEventListener('click',()=>{const muted=audio.toggle();$('sound').textContent=muted?'♪̸':'♫';$('sound').setAttribute('aria-label',muted?'Unmute audio':'Mute audio');});$('volume').addEventListener('input',event=>audio.setVolume(Number(event.target.value)));$('pause').addEventListener('click',()=>{if(started)setPaused(!paused);});$('resume').addEventListener('click',()=>setPaused(false));$('help').addEventListener('click',()=>{if(started)setPaused(true);});$('reset').addEventListener('click',()=>$('reset-screen').classList.remove('hidden'));$('win-reset').addEventListener('click',()=>{$('win').classList.add('hidden');setPaused(true);$('reset-screen').classList.remove('hidden');});$('confirm-reset').addEventListener('click',resetGame);$('cancel-reset').addEventListener('click',()=>$('reset-screen').classList.add('hidden'));$('admire').addEventListener('click',()=>$('win').classList.add('hidden'));function setShopExpanded(value){shopExpanded=value;$('shop-content').classList.toggle('hidden',!value);$('shop').classList.toggle('is-collapsed',!value);$('shop-toggle').textContent=value?'−':'+';$('shop-toggle').setAttribute('aria-label',value?'Collapse upgrades':'Expand upgrades');}
$('shop-toggle').addEventListener('click',()=>setShopExpanded(!shopExpanded));
window.addEventListener('resize',()=>setShopExpanded(innerWidth>650));
setShopExpanded(shopExpanded);

function simulateStep(dt,now){
 const moving=movePlayer(dt,now/1000),position=scene.player.group.position,water=waterPosition(game),power=powerPosition(game);
 const activeApproach=kettleApproach(game);
 const nearPower=isAtStation(game,position)&&(!destination||Math.hypot(position.x-destination.x,position.z-destination.z)<.2);
 if(!nearPower&&pendingKettle===null)manualKettleChoice=false;
 if(pendingKettle!==null&&nearPower){
   if(pendingKettle===game.activeKettle)pendingKettle=null;
   else if(game.phase==='hot'){game.phase='placing';game.progress=0;game.pickupKind='returnHot';}
   else if(selectKettle(game,pendingKettle))pendingKettle=null;
 }
 if(nearPower&&pendingKettle===null&&!manualKettleChoice&&['empty','ready','boiling'].includes(game.phase)){
   const nearest=nearestAvailableKettle(game,position);
   if(nearest!==null&&nearest!==game.activeKettle)selectKettle(game,nearest);
 }
 const approach=kettleApproach(game);
 const approaching=['placing','lifting'].includes(game.phase)&&Math.hypot(position.x-approach.x,position.z-approach.z)>.04;
 const events=advanceGame(game,dt,{actionReady:!approaching,nearWater:isAtWater(game,position),nearPower,autoSelectSpare:false});
 for(const event of events){audio.play(event);if(event==='paid'){showPayout();if(game.batches===3)showToast('Three trips. One extension cord. Procurement is ready.');}if(event==='win')win();}
 bubbleTimer+=dt;if(game.phase==='boiling'&&bubbleTimer>.45){audio.play('bubble');bubbleTimer=0;}
 saveTimer+=dt;if(saveTimer>5){save();saveTimer=0;}return moving;
}
function frame(now){
 const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;let moving=false;
 if(started&&!paused){let remaining=dt*testSpeed;while(remaining>.00001){const step=Math.min(remaining,.025);moving=simulateStep(step,now)||moving;remaining-=step;}}
 scene.update(game,paused?0:dt,now/1000,moving);updateUI();requestAnimationFrame(frame);
}
updateShop();requestAnimationFrame(frame);
// Read-only diagnostics support browser verification without changing player state.
window.oceanDiagnostics=()=>({game:structuredClone(game),player:{x:scene.player.group.position.x,z:scene.player.group.position.z},started,paused,shoreline:[-5,0,8].map(z=>({z,...scene.project({x:2.3,z})})),canvas:{width:scene.renderer.domElement.width,height:scene.renderer.domElement.height},audioState:audio.context?.state,renderCalls:scene.renderer.info.render.calls});
