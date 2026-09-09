import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/game.js';
import { tableBounds, stationApproach, keepOutsideTable, nextWalkingPoint } from '../src/movement.js';

for (const upgrades of [[], ['cord']]) {
  test(`walking routes around the table and reaches its station: ${upgrades}`, () => {
    const game = { ...createGame(), upgrades }, bounds = tableBounds(game);
    const inside = p => p.x > bounds.left && p.x < bounds.right && p.z > bounds.back && p.z < bounds.front;
    for (const [start, target] of [
      [{ x: bounds.left - 1, z: bounds.back - 1 }, stationApproach(game)],
      [{ x: bounds.left - 1, z: bounds.back + 1 }, { x: Math.min(2.5, bounds.right + 1), z: bounds.front + 1 }],
      [stationApproach(game), { x: bounds.left - 1, z: bounds.back - 1 }],
    ]) {
      const position = { ...start };
      for (let i = 0; i < 500; i++) {
        const next = nextWalkingPoint(position, target, bounds);
        const dx = next.x - position.x, dz = next.z - position.z, length = Math.hypot(dx, dz);
        if (length < .001) break;
        const distance = Math.min(length, .115);
        position.x += dx / length * distance; position.z += dz / length * distance;
        assert.equal(inside(position), false, 'route must stay outside table before collision correction');
        keepOutsideTable(position, bounds);
      }
      assert.ok(Math.hypot(position.x - target.x, position.z - target.z) < .01, 'reaches destination');
    }
    const position = stationApproach(game);
    for (let i = 0; i < 100; i++) { position.z -= .115; keepOutsideTable(position, bounds); assert.equal(inside(position), false); }
    assert.equal(position.z, bounds.front, 'keyboard walking stops at front edge');
  });
}

test('all six kettles have reachable approaches on their own side of the table',async()=>{
 const {kettleApproach}=await import('../src/movement.js');
 const game={...createGame(),upgrades:['cord','second','strip']},bounds=tableBounds(game);
 for(let index=0;index<6;index++){
  const target=kettleApproach(game,index),position=stationApproach(game);
  assert.ok(index<3?target.z>bounds.front:target.z<bounds.back);
  for(let step=0;step<600;step++){
   const next=nextWalkingPoint(position,target,bounds),dx=next.x-position.x,dz=next.z-position.z,length=Math.hypot(dx,dz);
   if(length<.001)break;
   const distance=Math.min(.115,length);position.x+=dx/length*distance;position.z+=dz/length*distance;
   assert.ok(position.x<=2.5);keepOutsideTable(position,bounds);
  }
  assert.ok(Math.hypot(position.x-target.x,position.z-target.z)<.01);
 }
});

test('station catches approaches across its perimeter without stealing shoreline actions',async()=>{
 const {isAtStation}=await import('../src/movement.js');
 const game={...createGame(),upgrades:['cord','second','strip']};
 for(const position of [{x:.1,z:2.9},{x:1.3,z:3.1},{x:-.5,z:1.4},{x:1.3,z:0}])assert.equal(isAtStation(game,position),true);
 assert.equal(isAtStation(game,{x:2.3,z:4.3}),false);
 assert.equal(isAtStation(game,{x:2.3,z:3.1}),false);
});

test('approaching the back selects a back-row kettle instead of the active front kettle',async()=>{
 const {nearestAvailableKettle,kettleApproach}=await import('../src/movement.js');
 const game={...createGame(),upgrades:['cord','second','strip','filler'],activeKettle:1,kettles:Array.from({length:6},()=>({phase:'ready',progress:0}))};
 for(let index=0;index<6;index++)assert.equal(nearestAvailableKettle(game,kettleApproach(game,index)),index);
 game.kettles[5].phase='boiling';assert.equal(nearestAvailableKettle(game,kettleApproach(game,5)),4);
});
