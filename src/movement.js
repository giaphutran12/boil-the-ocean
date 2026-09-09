import { powerPosition,isAtWater } from './game.js';

// Table footprint plus room for the character's body, shared by walking and routing.
export function tableBounds(game) {
  if (game.upgrades.includes('boat')) return null;
  const power = powerPosition(game);
  return { left: power.x - 1.45, right: power.x + 1.45, back: power.z - 2.05, front: power.z + .15 };
}
export function stationApproach(game) {
  const power = powerPosition(game);
  return { x: power.x, z: power.z + (game.upgrades.includes('boat') ? 0 : .35) };
}
export function keepOutsideTable(point, bounds) {
  if (!bounds || point.x <= bounds.left || point.x >= bounds.right || point.z <= bounds.back || point.z >= bounds.front) return point;
  const edges = [
    [point.x - bounds.left, 'x', bounds.left], [bounds.right - point.x, 'x', bounds.right],
    [point.z - bounds.back, 'z', bounds.back], [bounds.front - point.z, 'z', bounds.front],
  ];
  edges.sort((a, b) => a[0] - b[0]);
  point[edges[0][1]] = edges[0][2];
  return point;
}
function crossesTable(a, b, bounds) {
  let enter = 0, leave = 1;
  for (const [axis, min, max] of [['x', bounds.left, bounds.right], ['z', bounds.back, bounds.front]]) {
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < 1e-9) { if (a[axis] <= min || a[axis] >= max) return false; }
    else {
      const first = (min - a[axis]) / delta, last = (max - a[axis]) / delta;
      enter = Math.max(enter, Math.min(first, last)); leave = Math.min(leave, Math.max(first, last));
    }
  }
  return enter < leave && leave > 0 && enter < 1;
}
export function nextWalkingPoint(start, destination, bounds) {
  if (!bounds || !crossesTable(start, destination, bounds)) return destination;
  const margin = .06;
  const nodes = [start, destination, ...[bounds.left - margin, bounds.right + margin].flatMap(x =>
    [bounds.back - margin, bounds.front + margin].map(z => ({ x, z }))).filter(point => point.x <= 2.5)];
  const distances = nodes.map(() => Infinity), previous = [], visited = new Set();
  distances[0] = 0;
  for (let step = 0; step < nodes.length; step++) {
    let current = -1;
    nodes.forEach((_, i) => { if (!visited.has(i) && (current < 0 || distances[i] < distances[current])) current = i; });
    if (current === 1 || !Number.isFinite(distances[current])) break;
    visited.add(current);
    nodes.forEach((node, i) => {
      if (visited.has(i) || crossesTable(nodes[current], node, bounds)) return;
      const distance = distances[current] + Math.hypot(node.x - nodes[current].x, node.z - nodes[current].z);
      if (distance < distances[i]) { distances[i] = distance; previous[i] = current; }
    });
  }
  let next = 1;
  while (previous[next] !== undefined && previous[next] !== 0) next = previous[next];
  return nodes[next];
}

export function kettlePosition(game,index=game.activeKettle||0){
  const power=powerPosition(game);
  if(game.upgrades.includes('boat'))return {x:6.7+(index?1.8:0),y:.48,z:-1.3};
  return {x:power.x+(index%3-.7)*.58,y:.55,z:power.z-(index<3?.35:1.55)};
}
export function kettleApproach(game,index=game.activeKettle||0){
  const kettle=kettlePosition(game,index),bounds=tableBounds(game);
  if(!bounds)return {x:kettle.x,z:kettle.z+.7};
  return {x:Math.min(2.45,kettle.x+.2),z:index<3?bounds.front+.02:bounds.back-.02};
}

// Catch approaches along the whole table edge, not just a small central marker.
export function isAtStation(game,position){
  const approach=kettleApproach(game);
  if(Math.hypot(position.x-approach.x,position.z-approach.z)<.25)return true;
  if(isAtWater(game,position))return false;
  const bounds=tableBounds(game);
  if(!bounds){const power=powerPosition(game);return Math.hypot(position.x-power.x,position.z-power.z)<1.1;}
  const dx=Math.max(bounds.left-position.x,0,position.x-bounds.right);
  const dz=Math.max(bounds.back-position.z,0,position.z-bounds.front);
  return Math.hypot(dx,dz)<.65;
}

export function nearestAvailableKettle(game,position){
  const available=game.kettles.map((kettle,index)=>({kettle,index}))
    .filter(({kettle,index})=>!game.workers?.some(worker=>worker.index===index)&&(kettle.phase==='ready'||(!game.upgrades.includes('filler')&&kettle.phase==='empty')));
  available.sort((a,b)=>{
    const first=kettleApproach(game,a.index),second=kettleApproach(game,b.index);
    return Math.hypot(first.x-position.x,first.z-position.z)-Math.hypot(second.x-position.x,second.z-position.z);
  });
  return available[0]?.index??null;
}
