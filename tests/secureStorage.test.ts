import test from 'node:test';
import assert from 'node:assert/strict';
import { createSecureStorage } from '../src/domain/secureStorage';
function setup() {
 const values=new Map<string,string>();let generation=0;let fail:string|undefined;
 const store=createSecureStorage({getItemAsync:async key=>values.get(key)??null,setItemAsync:async(key,value)=>{if(key===fail)throw new Error('Storage full');values.set(key,value);},deleteItemAsync:async key=>{values.delete(key);}},()=>`a-${++generation}`);
 return {values,store,setFailure:(key?:string)=>{fail=key;}};
}
test('encrypted storage adapter fragments long sessions, deletes old generations and removes every chunk',async()=>{
 const {values,store}=setup();const token='x'.repeat(7000);
 await store.setItem('auth',token);assert.equal(await store.getItem('auth'),token);
 assert.equal(values.size,6);await store.setItem('auth','replacement');assert.equal(values.size,2);
 await store.removeItem('auth');assert.equal(await store.getItem('auth'),null);assert.equal(values.size,0);
});
test('failure before publishing a session pointer preserves the complete old session',async()=>{
 const {values,store,setFailure}=setup();await store.setItem('auth','original');
 setFailure('auth.a-2.1');await assert.rejects(store.setItem('auth','x'.repeat(4000)));
 assert.equal(await store.getItem('auth'),'original');assert.equal(values.size,2);
 setFailure('auth');await assert.rejects(store.setItem('auth','another'));assert.equal(await store.getItem('auth'),'original');assert.equal(values.size,2);
});
test('concurrent refresh, read and signout are serialized so old credentials cannot reappear',async()=>{
 const {values,store}=setup();
 const set=store.setItem('auth','x'.repeat(4000));const read=store.getItem('auth');const remove=store.removeItem('auth');
 await set;assert.equal(await read,'x'.repeat(4000));await remove;assert.equal(values.size,0);
 values.set('auth','{"generation":"a","count":33}');await assert.rejects(store.getItem('auth'));
});
