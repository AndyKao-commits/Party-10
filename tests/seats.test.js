import test from 'node:test'
import assert from 'node:assert/strict'
import { configureAreas, selectForPurchase } from '../server/seats.js'
const area = (realSeats=18,fakeSeats=18,price=700) => [{id:'a',name:'A區',price,realSeats,fakeSeats,color:'#008800'}]
const fresh = () => {const room={areas:[],maxPerOrder:4};configureAreas(room,area());return room}
test('exact true/false counts, unique numbered seats, shuffled truth', () => {
 const room=fresh();assert.equal(room.seats.filter(s => s.isReal).length,18);assert.equal(room.seats.filter(s => !s.isReal).length,18)
 assert.equal(new Set(room.seats.map(s => s.id)).size,36);assert.equal(new Set(room.seats.map(s => s.label)).size,36)
 const patterns=new Set(Array.from({length:8},() => fresh().seats.map(s => Number(s.isReal)).join('')));assert.ok(patterns.size>1)
})
test('fake or mixed selections fail atomically without changing inventory', () => {
 const room=fresh(), real=room.seats.find(s => s.isReal), fake=room.seats.find(s => !s.isReal)
 assert.throws(() => selectForPurchase(room,'a',[real.id,fake.id],2),/你是黃牛不賣你 請重新購票/)
 assert.equal(room.areas[0].remaining,18);assert.ok(room.seats.every(s => !s.sold))
})
test('duplicate, foreign, stale, over-limit seat requests rejected', () => {
 const room=fresh(),seat=room.seats.find(s => s.isReal)
 assert.throws(() => selectForPurchase(room,'a',[seat.id,seat.id],2));assert.throws(() => selectForPurchase(room,'other',[seat.id],1))
 seat.sold=true;assert.throws(() => selectForPurchase(room,'a',[seat.id],1),/已被購買/)
 assert.throws(() => selectForPurchase(room,'a',room.seats.slice(0,5).map(s => s.id),5))
})
test('price edit preserves sold identities and inventory; resizing keeps sales', () => {
 const room=fresh(), seat=room.seats.find(s => s.isReal);seat.sold=true;room.areas[0].remaining--
 const ids=room.seats.map(s => s.id);configureAreas(room,area(18,18,1200));assert.deepEqual(room.seats.map(s => s.id),ids);assert.equal(room.areas[0].remaining,17)
 configureAreas(room,area(20,10));assert.equal(room.seats.filter(s => s.isReal).length,20);assert.equal(room.seats.find(s => s.id===seat.id).sold,true);assert.equal(room.areas[0].remaining,19)
 assert.throws(() => configureAreas(room,area(0,18)),/已售/);assert.throws(() => configureAreas(room,[{...area()[0],id:'new'}]),/已售/)
})
