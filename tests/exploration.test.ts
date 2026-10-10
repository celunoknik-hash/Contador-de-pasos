import test from 'node:test';
import assert from 'node:assert/strict';
import { cellFor, centerFor, consumeFix, Fix, parseCell } from '../src/domain/exploration';
const base:Fix={latitude:-33.45,longitude:-70.66,accuracy:5,timestamp:100000,mocked:false,steps:100};
test('real geographic cells round-trip and reject invalid coordinates',()=>{
  for(const point of [{latitude:0,longitude:0},base,{latitude:84,longitude:179}]) {const cell=cellFor(point);assert.equal(cellFor(centerFor(cell)).id,cell.id);assert.deepEqual(parseCell(cell.id),cell);}
  assert.throws(()=>cellFor({latitude:90,longitude:0}));assert.throws(()=>parseCell('9999999999:1'));assert.throws(()=>parseCell('NaN:1'));assert.throws(()=>parseCell('01:1'));assert.throws(()=>parseCell('-0:1'));
});
test('an initial GPS fix, stationary steps and GPS drift cannot unlock cells',()=>{
  const first=consumeFix({anchor:null},base,100000);assert.equal(first.cell,null);
  assert.equal(consumeFix(first.state,{...base,timestamp:110000,steps:120},110000).cell,null);
  assert.equal(consumeFix(first.state,{...base,latitude:base.latitude+0.00005,timestamp:110000,steps:120},110000).cell,null);
  assert.equal(consumeFix(first.state,{...base,latitude:base.latitude+0.0002,timestamp:120000,steps:100},120000).cell,null);
});
test('walking evidence unlocks the current sector, never a path inferred from a jump',()=>{
  const first=consumeFix({anchor:null},base,100000);
  const walking={...base,latitude:base.latitude+0.0002,timestamp:120000,steps:132};
  assert.equal(consumeFix(first.state,walking,120000).cell?.id,cellFor(walking).id);
  const jump={...walking,latitude:base.latitude+0.01};assert.equal(consumeFix(first.state,jump,120000).cell,null);
});
test('mocked, stale, inaccurate, fast, impossible and backwards fixes are rejected',()=>{
  const first={anchor:base};
  for(const patch of [{mocked:true},{timestamp:NaN},{accuracy:NaN},{accuracy:50},{timestamp:50000},{latitude:100},{steps:-1},{steps:99,timestamp:120000},{steps:500,timestamp:120000},{latitude:base.latitude+0.0008,steps:115,timestamp:130000}]) assert.equal(consumeFix(first,{...base,...patch},120000).cell,null);
  const reset=consumeFix(first,{...base,mocked:true},100000);assert.equal(reset.state.anchor,null);
});
