import { kettlePosition,kettleApproach } from './movement.js';
import * as THREE from 'three';
import { animatePour,PourEffects,animateFetch,holdKettle,resetFetchPose,ScoopEffects,animatePlacement,restHands } from './fetch-animation.js';
import { capacity,powerPosition,waterPosition,temperature,isAtWater,kettleCount,isCarrying } from './game.js';
const KETTLE_COLORS=[0xfff2d5,0xe79a7e,0x78aaa1,0xe3c66e,0x9a9dc2,0xb2c88a];
const COLORS={sand:0xefd9aa,water:0x62c4bd,cream:0xfff2d5,coral:0xdc816c,green:0x537857,dark:0x344c43,yellow:0xf2c765};
const materialCache=new Map();
function material(color,options={}){const key=JSON.stringify([color,options]);if(!materialCache.has(key))materialCache.set(key,new THREE.MeshStandardMaterial({color,roughness:.78,...options}));return materialCache.get(key);}
function mesh(geometry,color,parent,position=[0,0,0],options={}){const item=new THREE.Mesh(geometry,material(color,options));item.position.set(...position);item.castShadow=true;item.receiveShadow=true;parent.add(item);return item;}
function box(parent,color,x,y,z,w,h,d){return mesh(new THREE.BoxGeometry(w,h,d),color,parent,[x,y,z]);}
function cylinder(parent,color,x,y,z,top,bottom,height,segments=24){return mesh(new THREE.CylinderGeometry(top,bottom,height,segments),color,parent,[x,y,z]);}
function sphere(parent,color,x,y,z,r){return mesh(new THREE.SphereGeometry(r,16,12),color,parent,[x,y,z]);}
function tube(parent,color,points,radius=.05){return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),20,radius,7,false),color,parent);}
function textSign(parent,text,x,y,z,width=2.8,bg='#f8efce',fg='#365244'){
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=160;const ctx=canvas.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,768,160);ctx.fillStyle=fg;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 46px sans-serif';ctx.fillText(text,384,85);const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;const sign=new THREE.Mesh(new THREE.PlaneGeometry(width,width/4.8),new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide}));sign.position.set(x,y,z);parent.add(sign);return sign;
}
export function createKettle(scale=1,color=COLORS.cream){
  const group=new THREE.Group();cylinder(group,color,0,.37,0,.25,.34,.59);cylinder(group,COLORS.dark,0,.065,0,.33,.34,.07);const lid=new THREE.Group();lid.position.set(.2,.69,0);group.add(lid);cylinder(lid,color,-.2,0,0,.22,.25,.06);sphere(lid,COLORS.dark,-.2,.06,0,.06);group.userData.lid=lid;
  const spout=cylinder(group,color,-.34,.49,0,.105,.16,.34);spout.rotation.z=-.65;cylinder(group,COLORS.dark,-.44,.625,0,.082,.07,.02).rotation.z=-.65;
  tube(group,COLORS.dark,[[.23,.61,0],[.46,.62,0],[.51,.35,0],[.31,.18,0]],.052);
  box(group,0xb3d4c9,0,.38,.305,.085,.3,.018);box(group,COLORS.coral,.25,.14,0,.09,.055,.12);group.scale.setScalar(scale);return group;
}
function createPerson(color=0xf69b56,hatColor=COLORS.cream){
 const group=new THREE.Group(),body=new THREE.Group();group.add(body);cylinder(body,color,0,.66,0,.21,.24,.43,10);sphere(body,0xe5ad80,0,1,0,.2);cylinder(body,hatColor,0,1.16,0,.28,.28,.05);cylinder(body,hatColor,0,1.23,0,.17,.2,.13);const left=box(body,COLORS.dark,-.12,.25,0,.15,.36,.18),right=box(body,COLORS.dark,.12,.25,0,.15,.36,.18);const arms=[-1,1].map(side=>({upper:cylinder(body,color,side*.27,.66,0,.065,.065,1,8),lower:cylinder(body,0xe5ad80,side*.27,.45,0,.045,.045,1,8),hand:sphere(body,0xe5ad80,side*.27,.38,0,.065)}));sphere(body,0x283e36,-.07,1.02,.18,.022);sphere(body,0x283e36,.07,1.02,.18,.022);return {group,body,left,right,arms};
}
function createPalm(parent,x,z,scale=1){const palm=new THREE.Group();palm.position.set(x,0,z);palm.scale.setScalar(scale);parent.add(palm);tube(palm,0x9b8660,[[0,0,0],[.1,1.4,0],[.45,2.9,0],[.75,4,0]],.13);for(let i=0;i<7;i++){const angle=i*Math.PI*2/7;const leaf=new THREE.Group();leaf.position.set(.75,4,0);leaf.rotation.y=angle;palm.add(leaf);const shape=new THREE.Shape();shape.moveTo(0,0);shape.quadraticCurveTo(.6,.55,2,.02);shape.quadraticCurveTo(.8,-.28,0,0);const frond=new THREE.Mesh(new THREE.ShapeGeometry(shape),material(i%2?0x5b8758:0x78975c,{side:THREE.DoubleSide}));frond.rotation.x=-Math.PI/2;frond.rotation.y=.4;leaf.add(frond);}for(let i=0;i<3;i++)sphere(palm,0x8e7150,.65+i*.16,3.85,.1,.13);}
function createUmbrella(parent,x,z){const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);cylinder(g,0xd7bd84,0,1.1,0,.04,.04,2.2);for(let i=0;i<8;i++){const umbrella=mesh(new THREE.ConeGeometry(1.05,.5,1,1,true,i*Math.PI/4,Math.PI/4),i%2?COLORS.cream:0xe78b6c,g,[0,2.25,0],{side:THREE.DoubleSide});umbrella.castShadow=true;}for(let offset of [-.6,.6]){const seat=box(g,COLORS.cream,offset,.3,.9,.45,.08,.85);seat.rotation.x=-.15;const back=box(g,0xe18a71,offset,.65,.42,.45,.7,.08);back.rotation.x=-.3;for(let side of [-1,1])box(g,0xb79e72,offset+side*.17,.15,.95,.04,.3,.7);}}
export class OceanScene{
 constructor(canvas){
  this.canvas=canvas;this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.setClearColor(0xa3d9d0);this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;this.scene=new THREE.Scene();this.scene.fog=new THREE.FogExp2(0xaddbd1,.012);
  this.camera=new THREE.OrthographicCamera(-13,13,9,-9,.1,150);this.camera.position.set(17,23,27);this.camera.lookAt(0,0,0);this.scene.add(new THREE.HemisphereLight(0xfffae6,0x719788,2.0));const sun=new THREE.DirectionalLight(0xffecd0,2.5);sun.position.set(-8,19,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-24,right:24,top:24,bottom:-24,near:1,far:60});sun.shadow.bias=-.0004;sun.shadow.normalBias=.025;this.scene.add(sun);
  this.raycaster=new THREE.Raycaster();this.groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);this.player=createPerson();this.player.group.position.set(-3,0,4);this.scene.add(this.player.group);this.carried=createKettle(.66);this.carried.position.set(-.45,.51,.08);this.player.body.add(this.carried);this.workerFiller=createPerson(0x679998,0xf4cc6e);this.workerPourer=createPerson(0xbb826b,0xe9d9b5);for(const worker of [this.workerFiller,this.workerPourer]){worker.kettle=createKettle(.6);worker.kettle.position.set(-.4,.5,.1);worker.body.add(worker.kettle);}this.scene.add(this.workerFiller.group,this.workerPourer.group);
  this.buildEnvironment();this.scoopEffects=new ScoopEffects(this.scene);this.fleet=new THREE.Group();this.scene.add(this.fleet);this.boat=new THREE.Group();this.scene.add(this.boat);this.steam=[];this.buildParticles();this.lastLevel=-1;this.resize();window.addEventListener('resize',()=>this.resize());
 }
 buildEnvironment(){
  const world=this.scene;box(world,COLORS.sand,-13,-.25,0,31,.5,70);this.sea=mesh(new THREE.PlaneGeometry(85,85,90,90),COLORS.water,world,[45,-.055,0],{roughness:.32,metalness:.12});this.sea.rotation.x=-Math.PI/2;this.sea.castShadow=false;this.seaPositions=this.sea.geometry.attributes.position;this.seaBase=this.seaPositions.array.slice();
  this.foam=[];for(let i=0;i<32;i++){const f=box(world,0xd1e9d2,2.56+Math.sin(i)*.12,-.01,-22+i*1.5,.07,.015,.6+Math.random()*.5);f.rotation.y=Math.random()*.15;this.foam.push(f);}
  const hotel=new THREE.Group();world.add(hotel);box(hotel,COLORS.coral,-8,1.8,-5,6,3.6,3.7);box(hotel,0xf4ddbb,-8,3.67,-5,6.5,.16,4.2);box(hotel,0xf2d3ac,-8,.1,-2.5,7,.2,2);box(hotel,0x698d7b,-7,.9,-3.1,.8,1.8,.08);
  for(let x of [-10,-8.5,-5.8]){box(hotel,0x528979,x,2.5,-3.12,.8,.8,.07);box(hotel,0xf6e4c5,x,2.04,-3.04,1,.08,.15);box(hotel,0xf6e4c5,x,2.5,-3.02,.035,.85,.04);}
  textSign(hotel,'THE LUKEWARM HOTEL',-8,3.2,-3.07,4.9);for(let x of [-10.9,-5.1])cylinder(hotel,0xf5e1bb,x,1.25,-1.9,.065,.065,2.5);const awning=box(hotel,0xe9b97e,-8,2.5,-2.2,6.1,.09,2.1);awning.rotation.x=.09;
  for(let i=0;i<10;i++)box(hotel,i%2?COLORS.cream:0x648772,-10.7+i*.6,2.42,-1.18,.3,.23,.08);
  this.plugStation=new THREE.Group();world.add(this.plugStation);
  this.outlet=box(this.plugStation,COLORS.cream,.55,.88,-1.25,.24,.32,.1);
  for(const dx of [-.045,.045])box(this.plugStation,COLORS.dark,.55+dx,.9,-1.19,.018,.065,.015);
  box(this.plugStation,COLORS.dark,.55,.82,-1.19,.026,.035,.015);
  box(this.plugStation,0xb69b70,.55,.4,-1.25,.07,.8,.07);
  this.hotelLead=tube(world,0x414d41,[[-6,.02,-1],[-5.5,.03,.6],[-4,.03,.1]],.028);
  this.cord=tube(world,0x414d41,[[-6,.02,-1],[-4,.03,-.1],[-3,.03,2],[0,.03,2.3],[1.2,.03,2.4]],.025);
  for(const [x,z,s] of [[-12,1,1.15],[-5,-8,1.1],[-1,-6,.9],[-9,8,1],[-15,-7,1.3]])createPalm(world,x,z,s);
  createUmbrella(world,-6,6.9);createUmbrella(world,-12,4.5);for(let i=0;i<14;i++){const rock=sphere(world,i%2?0xd6c296:0xf6e5c2,-1.5-Math.random()*12,.04,-10+Math.random()*25,.08+Math.random()*.13);rock.scale.y=.4;}
  // A narrow pier joins every offshore upgrade to the same walkable beach.
  this.pier=new THREE.Group();world.add(this.pier);for(let i=0;i<18;i++)box(this.pier,0xbda57c,2+i*.36,.1,0,.33,.16,1.6);for(let x of [2.1,4,6.2,8])for(let z of [-.7,.7]){cylinder(this.pier,0x9b835e,x,-.05,z,.075,.075,1.1);cylinder(this.pier,0xf4e5c4,x,.45,z,.095,.095,.12);}this.pier.visible=false;
  this.playerAura=new THREE.Group();this.player.group.add(this.playerAura);
  const auraCore=new THREE.Mesh(new THREE.RingGeometry(.36,.41,48),new THREE.MeshBasicMaterial({color:0xffe48c,transparent:true,opacity:.95,depthWrite:false,side:THREE.DoubleSide}));
  auraCore.rotation.x=-Math.PI/2;auraCore.position.y=.045;this.playerAura.add(auraCore);
  for(let i=0;i<5;i++){
    const glow=new THREE.Mesh(new THREE.RingGeometry(.3+i*.045,.36+i*.045,48),new THREE.MeshBasicMaterial({color:0xffdf80,transparent:true,opacity:.14*(1-i/5),depthWrite:false,side:THREE.DoubleSide}));
    glow.rotation.x=-Math.PI/2;glow.position.y=.04;this.playerAura.add(glow);
  }
  this.waterRing=this.createRing(0xe8f6b2);this.waterRing.visible=false;this.powerRing=this.createRing(0xffd094);this.destination=this.createRing(0xffffff,.28);this.destination.visible=false;
  this.wavelets=[];for(let i=0;i<80;i++){const wave=box(world,0xb4e6d7,3+Math.random()*30,.018,-25+Math.random()*50,.2+Math.random()*.75,.009,.025);wave.castShadow=false;this.wavelets.push(wave);}this.gulls=[];for(let i=0;i<5;i++){const gull=new THREE.Group();tube(gull,0xfff8e7,[[-.3,0,0],[-.15,.07,0],[0,0,0],[.15,.07,0],[.3,0,0]],.025);gull.position.set(Math.random()*18-5,7+Math.random()*2,Math.random()*15-8);world.add(gull);this.gulls.push(gull);}
  this.pourEffects=new PourEffects(world);this.workerEffects=[{scoop:new ScoopEffects(world),pour:new PourEffects(world)},{scoop:new ScoopEffects(world),pour:new PourEffects(world)}];
 }
 createRing(color,radius=.65){const ring=mesh(new THREE.RingGeometry(radius,radius+.08,40),color,this.scene,[0,.035,0],{side:THREE.DoubleSide,transparent:true,opacity:.8});ring.rotation.x=-Math.PI/2;ring.castShadow=false;return ring;}
 buildParticles(){for(let i=0;i<65;i++){const puff=mesh(new THREE.SphereGeometry(.13,7,6),0xfff8e9,this.scene,[0,-20,0],{transparent:true,opacity:.25,depthWrite:false});puff.castShadow=false;this.steam.push(puff);}}
 rebuildFleet(game){
  this.lastLevel=game.upgrades.length;while(this.fleet.children.length){const child=this.fleet.children[0];child.traverse(item=>{if(item.geometry)item.geometry.dispose();});this.fleet.remove(child);}while(this.boat.children.length){const child=this.boat.children[0];child.traverse(item=>{if(item.geometry)item.geometry.dispose();});this.boat.remove(child);}
  const power=powerPosition(game),offshore=game.upgrades.includes('boat');this.cord.visible=game.upgrades.includes('cord')&&!offshore;this.hotelLead.visible=!game.upgrades.includes('cord');this.plugStation.position.set(power.x,0,power.z);this.plugStation.visible=!offshore;this.pier.visible=offshore;this.workerFiller.group.visible=game.upgrades.includes('filler');this.workerPourer.group.visible=game.upgrades.includes('pourer');
  const count=game.upgrades.includes('strip')?6:game.upgrades.includes('second')?2:1;const size=game.upgrades.includes('mega')?4.7:game.upgrades.includes('station')?3.4:game.upgrades.includes('barge')?2.4:game.upgrades.includes('generator')?1.7:offshore?1.3:game.upgrades.includes('big')?1:.68;
  this.kettleSize=size;this.kettles=[];
  if(offshore){const large=game.upgrades.includes('barge');box(this.boat,0x3d716c,7,-.05,-1.5,large?7:5,.8,large?5:4.8);box(this.boat,0xe8ce98,7,.4,-1.5,large?6.9:4.9,.12,large?4.9:4.7);box(this.boat,COLORS.cream,large?9.5:8.7,1,-2.5,1.15,1.1,1.3);box(this.boat,0x6caaa6,large?9.5:8.7,1.25,-1.84,.85,.42,.04);box(this.boat,COLORS.coral,large?9.5:8.7,1.65,-2.5,1.5,.16,1.6);for(let x of [5,7,9]){const tire=mesh(new THREE.TorusGeometry(.22,.07,8,14),0x405451,this.boat,[x,-.03,large?1.05:.43]);tire.rotation.y=0;}
    if(game.upgrades.includes('generator')){box(this.boat,0xdaad55,5.4,.86,-2.6,.8,.8,1);for(let i=0;i<4;i++)box(this.boat,0x57584c,5.4,.68+i*.1,-2.08,.6,.035,.03);cylinder(this.boat,0x48574a,5.4,1.5,-2.65,.055,.055,.6);}
    if(game.upgrades.includes('station')){box(this.boat,0x879889,10,.5,-5.3,3.6,1.2,2.7);for(let i=0;i<3;i++){cylinder(this.boat,0xd3ccb3,9+i*.8,2.2,-5.3,.23,.38,2.7);cylinder(this.boat,0xdc816c,9+i*.8,3.3,-5.3,.24,.25,.4);}textSign(this.boat,'WARM REGARDS',10,1.05,-3.92,2.6);}
  }
  const visibleCount=kettleCount(game);
  for(let i=0;i<visibleCount;i++){const kettle=createKettle(size,KETTLE_COLORS[i]);if(offshore)kettle.position.set(6.7+(i?1.8:0),.48,-1.3);else {const position=kettlePosition(game,i);kettle.position.set(position.x,position.y,position.z);}textSign(kettle,String.fromCharCode(65+i),0,.39,.33,.16,'#344c43','#fff2d5');this.fleet.add(kettle);this.kettles.push(kettle);if(!offshore)cylinder(this.fleet,COLORS.dark,kettle.position.x,.57,kettle.position.z,.25,.25,.05);}
  if(!offshore){tube(this.fleet,COLORS.dark,[[power.x-.4,.56,power.z-.65],[power.x+.3,.56,power.z-1],[power.x+.6,.65,power.z-1.3]],.022);box(this.fleet,0xc4aa7a,power.x,.49,power.z-.95,2.4,.12,1.7);for(let dx of [-.95,.95])for(let dz of [-.65,.65])box(this.fleet,0x9b886b,power.x+dx,.23,power.z-.95+dz,.075,.46,.075);}
  const water=waterPosition(game);this.waterRing.position.set(water.x,.035,water.z);this.powerRing.position.set(power.x,.036,power.z);
 }
 resize(){const width=innerWidth,height=innerHeight;this.renderer.setSize(width,height);const aspect=width/height;const halfHeight=aspect<.85?13.5:10.5;this.camera.left=-halfHeight*aspect;this.camera.right=halfHeight*aspect;this.camera.top=halfHeight;this.camera.bottom=-halfHeight;this.camera.updateProjectionMatrix();}
 kettleAtScreen(x,y){
  this.raycaster.setFromCamera(new THREE.Vector2(x/innerWidth*2-1,-y/innerHeight*2+1),this.camera);
  for(const hit of this.raycaster.intersectObjects(this.kettles.filter(kettle=>kettle.visible),true)){
    let object=hit.object;while(object&&!this.kettles.includes(object))object=object.parent;
    if(object)return this.kettles.indexOf(object);
  }
  return null;
 }
 pointFromScreen(x,y){this.raycaster.setFromCamera(new THREE.Vector2(x/innerWidth*2-1,-y/innerHeight*2+1),this.camera);const point=new THREE.Vector3();this.raycaster.ray.intersectPlane(this.groundPlane,point);return point;}
 project(position){const vector=new THREE.Vector3(position.x,position.y??.1,position.z).project(this.camera);return {x:(vector.x*.5+.5)*innerWidth,y:(-.5*vector.y+.5)*innerHeight};}
 update(game,dt,time,moving){
  if(this.lastLevel!==game.upgrades.length)this.rebuildFleet(game);
  const offshore=game.upgrades.includes('boat'),target=new THREE.Vector3(offshore?8:-1,0,offshore?-1:0);this.camera.position.lerp(new THREE.Vector3(target.x+17,23,target.z+27),dt*.6);this.camera.lookAt(target);
  const positions=this.seaPositions.array;for(let i=0;i<positions.length;i+=3)positions[i+2]=Math.sin(this.seaBase[i]*1.3+time)*.035+Math.sin(this.seaBase[i+1]*2+time*1.2)*.026;this.seaPositions.needsUpdate=true;
  this.foam.forEach((foam,i)=>{foam.position.x=2.56+Math.sin(time*.8+i*.4)*.12;foam.material.opacity=.6;});this.gulls.forEach((gull,i)=>{gull.position.x=5+Math.sin(time*.07+i*1.2)*12;gull.position.z=Math.cos(time*.07+i*1.2)*10;gull.rotation.y=-time*.07-i*1.2;});
  this.player.left.rotation.x=moving?Math.sin(time*12)*.55:0;this.player.right.rotation.x=-this.player.left.rotation.x;this.player.body.position.y=moving?Math.abs(Math.sin(time*12))*.045:0;
  const power=powerPosition(game),water=waterPosition(game);
  const approach=kettleApproach(game),approaching=['placing','lifting'].includes(game.phase)&&Math.hypot(this.player.group.position.x-approach.x,this.player.group.position.z-approach.z)>.04;
  this.carried.visible=!(approaching&&game.phase==='lifting')&&isCarrying(game);
  this.carried.children[0].material=material(KETTLE_COLORS[game.activeKettle||0]);
  this.carried.userData.lid.children[0].material=material(KETTLE_COLORS[game.activeKettle||0]);
  this.kettles.forEach((kettle,index)=>{
    const state=game.kettles?.[index]||game;
    kettle.visible=(index!==game.activeKettle||!this.carried.visible)&&!game.workers?.some(job=>job.index===index&&['pickup','water','hot-water','scoop','pour','return','place'].includes(job.stage));
    kettle.rotation.z=state.phase==='boiling'?Math.sin(time*24)*.006:state.phase==='pouring'?-.15:0;
  });
  const pouring=game.phase==='pouring'&&this.carried.visible&&isAtWater(game,this.player.group.position),filling=game.phase==='filling'&&this.carried.visible;
  resetFetchPose(this.player,this.carried);
  const fetcher=this.player,fetchingKettle=this.carried,fillProgress=game.progress;
  const atWater=isAtWater(game,fetcher.group.position);
  if(filling&&atWater)animateFetch(fetcher,fetchingKettle,fillProgress,offshore&&fetcher.group.position.x>3);
  const pourer=this.player;
  [this.workerFiller,this.workerPourer].forEach((person,i)=>{
   const job=game.workers?.[i],effects=this.workerEffects[i];
   resetFetchPose(person,person.kettle);person.body.position.y=0;
   person.kettle.visible=!!job&&['pickup','water','hot-water','scoop','pour','return','place'].includes(job.stage);
   effects.scoop.update(null,0);effects.pour.update(null,0,time);
   if(!job){restHands(person);return;}
   person.group.position.set(job.x,0,job.z);person.group.rotation.y=job.facing||0;
   const walking=['collect','water','hot-water','return'].includes(job.stage);
   person.left.rotation.x=walking?Math.sin(time*12)*.5:0;person.right.rotation.x=-person.left.rotation.x;
   if(job.index!==null){person.kettle.children[0].material=material(KETTLE_COLORS[job.index]);person.kettle.userData.lid.children[0].material=material(KETTLE_COLORS[job.index]);}
   if(job.stage==='scoop'){animateFetch(person,person.kettle,job.progress,offshore);effects.scoop.update(person.kettle,job.progress);}
   if(job.stage==='pour'){const flow=animatePour(person,person.kettle,job.progress,offshore);effects.pour.update(person.kettle,flow,time,offshore);}
   if(['pickup','place'].includes(job.stage)&&this.kettles[job.index])animatePlacement(person,person.kettle,this.kettles[job.index].position,job.progress,job.stage==='pickup');
   if(person.kettle.visible)holdKettle(person,person.kettle,['pickup','scoop','pour','place'].includes(job.stage));else restHands(person);
  });
  const pouringKettle=pourer===this.player?this.carried:pourer.kettle;
  const pouringOffshore=offshore&&pourer.group.position.x>3;
  const pourFlow=pouring?animatePour(pourer,pouringKettle,game.progress,pouringOffshore):0;
  this.pourEffects.update(pouring?pouringKettle:null,pourFlow,time,pouringOffshore);
  if(['placing','lifting'].includes(game.phase)&&!approaching)animatePlacement(this.player,this.carried,this.kettles[game.activeKettle||0].position,game.progress,game.phase==='lifting');
  if(this.carried.visible)holdKettle(this.player,this.carried,(pouring&&pourer===this.player)||(filling&&fetcher===this.player)||['placing','lifting'].includes(game.phase));else restHands(this.player);
  this.scoopEffects.update(filling&&atWater?fetchingKettle:null,fillProgress);
  const steamingKettles=this.kettles.filter((kettle,index)=>['boiling','ready'].includes(game.kettles?.[index]?.phase));const hot=steamingKettles.length>0;const heat=(temperature(game)-18)/82;this.wavelets.forEach((wave,i)=>{wave.scale.x=.6+Math.sin(time*.8+i)*.35;wave.position.y=.018+Math.sin(time+i)*.012;});
  this.steam.forEach((puff,i)=>{const global=i>25;if(global&&heat<.015&&!game.upgrades.includes('boat')||!global&&!hot){puff.visible=false;return;}puff.visible=true;const cycle=(time*(global?.22:.65)+i*.43)%3;const emitter=steamingKettles[i%Math.max(1,steamingKettles.length)]?.position||new THREE.Vector3(power.x,0,power.z-.9);const x=global?4+(i%9)*2.2:emitter.x+(i%3)*.08;const z=global?-12+Math.floor(i/9)*4:emitter.z;puff.position.set(x+Math.sin(i+time*.5)*cycle*.15,(global?.1:this.kettleSize*.8+.5)+cycle*(global?1.7:1),z);puff.scale.setScalar((.4+cycle*.7)*(global?Math.max(.6,heat*3):Math.max(1,this.kettleSize*.55)));puff.material.opacity=.16*(1-cycle/3);});
  this.waterRing.scale.setScalar(1+Math.sin(time*2)*.04);this.powerRing.scale.setScalar(1+Math.sin(time*2+1)*.04);this.renderer.render(this.scene,this.camera);
 }
}
