'use strict';
const assert = require('node:assert/strict');
const {createGameModel, POINTS} = require('../game.js');
const m=createGameModel();
function moveTo(x,y) {
  for(let i=0;i<1200;i++) {
    const p=m.getState().player, dx=x-p.x,dy=y-p.y;
    if(Math.hypot(dx,dy)<5)return;
    m.tick(0.02,{x:dx,y:dy});
  }
  assert.fail(`Unreachable waypoint (${x},${y}): ${JSON.stringify(m.getState().player)}`);
}
function act(id) { assert.equal(m.getState().interactionId,id);assert(m.interact());if(m.getState().dialogue)m.acknowledgeDialogue(); }
m.start();assert.equal(m.getState().paused,true);m.tick(.1);assert.equal(m.getState().timeRemaining,240);m.acknowledgeDialogue();
// Follow the actual walkable polygons without teleporting or modifying state.
moveTo(330,500);moveTo(400,300);act('key');
moveTo(470,465);act('parcel');assert.equal(m.getState().cargoWeight,3);
moveTo(590,520);act('boat');assert.equal(m.getState().parcel,'stored');assert.equal(m.getState().cargoWeight,1);act('boat');
for(let i=0;i<80;i++)m.tick(.05);
assert.equal(m.getState().crossed,true);
moveTo(1100,500);moveTo(1165,480);act('crates');act('crates');act('crates');
moveTo(1250,450);moveTo(1380,300);act('gate');
assert.equal(m.getState().status,'won');assert(m.getState().progress.every(x=>x.done));
assert(m.getState().timeRemaining>180,'Natural route takes unexpectedly long');
console.log('PASS Natural walkable route: key, capacity, crossing, crates and gate (no teleport)');
