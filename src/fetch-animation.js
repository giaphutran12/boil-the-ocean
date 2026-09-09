import * as THREE from 'three';

const ease = value => { const t=THREE.MathUtils.clamp(value,0,1); return t*t*(3-2*t); };
const up = new THREE.Vector3(0,1,0);

// A full scoop has a reach, a submerged hold, and a deliberate lift back to carrying height.
export function animateFetch(person,kettle,progress,offshore){
  const reach=ease(progress/.3)*(1-ease((progress-.65)/.35));
  person.group.rotation.y=offshore?0:Math.PI/2;
  person.body.position.y=-.17*reach;
  person.body.rotation.x=.28*reach;
  person.left.rotation.x=-.42*reach;
  person.right.rotation.x=-.42*reach;
  kettle.position.set(-.45+.3*reach,.51-.3*reach,.08+.82*reach);
  kettle.rotation.set(.62*reach,Math.PI/2*reach,0);
  if(kettle.userData.lid)kettle.userData.lid.rotation.z=-1.1*reach;
  return reach;
}

// Visible elbows and hands keep the kettle connected to its carrier throughout the scoop.
export function holdKettle(person,kettle,twoHands=false){
  person.body.updateWorldMatrix(true,true);
  const handle=kettle.localToWorld(new THREE.Vector3(.45,.43,0));
  const target=person.body.worldToLocal(handle);
  positionArm(person.arms[0],new THREE.Vector3(-.25,.8,0),target);
  const otherTarget=twoHands?target.clone().add(new THREE.Vector3(.02,-.08,.1)):new THREE.Vector3(.29,.37,.06);
  positionArm(person.arms[1],new THREE.Vector3(.25,.8,0),otherTarget);
}
function positionArm(arm,shoulder,hand){
  const elbow=shoulder.clone().lerp(hand,.5).add(new THREE.Vector3(shoulder.x<0?-.09:.09,-.12,-.05));
  positionLimb(arm.upper,shoulder,elbow);
  positionLimb(arm.lower,elbow,hand);
  arm.hand.position.copy(hand);
}
function positionLimb(limb,start,end){
  const direction=end.clone().sub(start);
  limb.position.copy(start).add(end).multiplyScalar(.5);
  limb.scale.y=direction.length();
  limb.quaternion.setFromUnitVectors(up,direction.normalize());
}
export function resetFetchPose(person,kettle){
  person.body.rotation.x=0;
  kettle.position.set(-.45,.51,.08);
  kettle.rotation.set(0,0,0);
  if(kettle.userData.lid)kettle.userData.lid.rotation.z=0;
}

export class ScoopEffects{
  constructor(scene){
    this.ripples=[];this.drops=[];
    for(let i=0;i<3;i++){
      const ripple=new THREE.Mesh(new THREE.RingGeometry(.16,.19,32),new THREE.MeshBasicMaterial({color:0xe9fff3,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
      ripple.rotation.x=-Math.PI/2;scene.add(ripple);this.ripples.push(ripple);
    }
    for(let i=0;i<12;i++){
      const drop=new THREE.Mesh(new THREE.SphereGeometry(.035,6,5),new THREE.MeshBasicMaterial({color:0xcaf8ed,transparent:true}));
      scene.add(drop);this.drops.push(drop);
    }
  }
  update(kettle,progress){
    const active=!!kettle;
    this.ripples.forEach(ripple=>ripple.visible=active&&progress>.2&&progress<.95);
    this.drops.forEach(drop=>drop.visible=active&&progress>.25&&progress<.92);
    if(!active)return;
    const point=kettle.getWorldPosition(new THREE.Vector3());
    this.ripples.forEach((ripple,index)=>{
      const age=((progress-.2)*2+index/3)%1;
      ripple.position.set(point.x,.025,point.z);ripple.scale.setScalar(1+age*3.5);ripple.material.opacity=(1-age)*.65;
    });
    this.drops.forEach((drop,index)=>{
      const age=((progress-.25)*3+index/12)%1,angle=index*2.4;
      const lifting=progress>.65;
      drop.position.set(point.x+Math.cos(angle)*age*(lifting?.12:.42),Math.max(.02,point.y)+Math.sin(age*Math.PI)*(lifting?.12:.28),point.z+Math.sin(angle)*age*.32);
      drop.scale.set(1,1.3+age,1);drop.material.opacity=1-age;
    });
  }
}

// Move the held kettle onto its actual base, or retrace that path when picking it up.
export function animatePlacement(person,kettle,basePosition,progress,pickingUp=false){
  person.group.rotation.y=basePosition.z<person.group.position.z?Math.PI:0;
  person.body.updateWorldMatrix(true,true);
  const target=person.body.worldToLocal(basePosition.clone());
  const amount=ease(pickingUp?1-progress:progress);
  kettle.position.lerpVectors(new THREE.Vector3(-.45,.51,.08),target,amount);
  kettle.position.y+=Math.sin(amount*Math.PI)*.2;
  const inverseBodyRotation=person.body.getWorldQuaternion(new THREE.Quaternion()).invert();
  kettle.quaternion.identity().slerp(inverseBodyRotation,amount);
}
export function restHands(person){
  for(let index=0;index<2;index++){
    const side=index===0?-1:1;
    positionArm(person.arms[index],new THREE.Vector3(side*.25,.8,0),new THREE.Vector3(side*.28,.39,.04));
  }
}

// Raise, tip toward the sea, then right the kettle before returning to the carry pose.
export function animatePour(person,kettle,progress,offshore){
  const reach=ease(progress/.22)*(1-ease((progress-.8)/.2));
  const tilt=ease((progress-.12)/.2)*(1-ease((progress-.75)/.18));
  person.group.rotation.y=offshore?0:Math.PI/2;
  person.body.position.y=-.06*reach;
  person.body.rotation.x=.12*reach;
  kettle.position.set(-.45+.3*reach,.51+.12*reach,.08+.6*reach);
  kettle.rotation.set(0,Math.PI/2*reach,.95*tilt);
  return ease((progress-.2)/.1)*(1-ease((progress-.72)/.13));
}

export class PourEffects extends ScoopEffects{
  constructor(scene){
    super(scene);
    this.segments=[];
    const geometry=new THREE.CylinderGeometry(1,1,1,7);
    const material=new THREE.MeshBasicMaterial({color:0xcaf8ed,transparent:true,opacity:.78,depthWrite:false});
    for(let i=0;i<18;i++){
      const segment=new THREE.Mesh(geometry,material);scene.add(segment);this.segments.push(segment);
    }
  }
  update(kettle,flow,time,offshore=false){
    const active=!!kettle&&flow>.01;
    for(const item of [...this.segments,...this.ripples,...this.drops])item.visible=active;
    if(!active)return;
    kettle.updateWorldMatrix(true,false);
    const start=kettle.localToWorld(new THREE.Vector3(-.44,.625,0));
    const direction=new THREE.Vector3(offshore?0:1,0,offshore?1:0);
    const distance=.35+.25*flow;
    const point=t=>start.clone().addScaledVector(direction,distance*t).setY(start.y+(.025-start.y)*t*t);
    this.segments.forEach((segment,index)=>{
      const a=point(index/18),b=point((index+1)/18),delta=b.clone().sub(a);
      segment.position.copy(a).add(b).multiplyScalar(.5);
      segment.quaternion.setFromUnitVectors(up,delta.clone().normalize());
      const radius=(.023+.007*Math.sin(time*24-index*.7))*Math.sqrt(flow);
      segment.scale.set(radius,delta.length()*1.12,radius);
    });
    const impact=point(1);
    this.ripples.forEach((ripple,index)=>{
      const age=(time*1.8+index/3)%1;
      ripple.position.copy(impact);ripple.scale.setScalar(.5+age*3);
      ripple.material.opacity=(1-age)*.55*flow;
    });
    this.drops.forEach((drop,index)=>{
      const age=(time*2.8+index/12)%1,angle=index*2.4;
      drop.position.set(impact.x+Math.cos(angle)*age*.35,.025+Math.sin(age*Math.PI)*.18,impact.z+Math.sin(angle)*age*.35);
      drop.scale.set(.65,1.3,.65);drop.material.opacity=(1-age)*flow;
    });
  }
}
