import test from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
const port=3379, url=`http://127.0.0.1:${port}`
const app=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port)},stdio:'pipe'})
const request=async (path,body,method='POST') => {const r=await fetch(url+path,{method,headers:{'Content-Type':'application/json'},...(body ? {body:JSON.stringify(body)} : {})});return {status:r.status,data:await r.json()}}
const ready=new Promise((resolve,reject) => {app.stdout.on('data',s=>{if(s.toString().includes('本機:'))resolve()});app.on('error',reject);app.on('exit',code=>reject(new Error(`Server exited ${code}`)))})
test('HTTP seat purchase, concurrency, edit, delete and no recreation',{timeout:15000},async () => {
 try {
  await ready
  const create=async (realSeats,fakeSeats) => (await request('/api/rooms',{title:'測試活動',failChance:0,maxPerOrder:2,areas:[{id:'a',name:'A區',price:700,realSeats,fakeSeats,color:'#00aa00'}]})).data
  const fake=await create(0,2),c=fake.room.code
  const join=(await request(`/api/rooms/${c}/join`,{nickname:'測試'})).data
  await request(`/api/rooms/${c}/open`,{hostId:fake.hostId})
  const bad=await request(`/api/rooms/${c}/purchase`,{playerId:join.playerId,areaId:'a',qty:1,seatIds:[fake.room.seats[0].id]})
  assert.equal(bad.data.code,'FAKE_SEAT');assert.equal(typeof bad.data.error,'string')
  let r=(await request(`/api/rooms/${c}`,null,'GET')).data.room;assert.equal(r.orders.length,0);assert.equal(r.seats.filter(s=>s.sold).length,1);assert.ok(r.seats.every(s=>!('isReal' in s)))
  const good=await create(2,0),g=good.room.code,p=(await request(`/api/rooms/${g}/join`,{nickname:'買家'})).data.playerId
  await request(`/api/rooms/${g}/open`,{hostId:good.hostId})
  const body={playerId:p,areaId:'a',qty:1,nickname:'買家',seatIds:[good.room.seats[0].id]}
  const results=await Promise.all([request(`/api/rooms/${g}/purchase`,body),request(`/api/rooms/${g}/purchase`,body)])
  assert.equal(results.filter(x=>x.status===200).length,1)
  const edited=await request(`/api/rooms/${g}`,{hostId:good.hostId,title:'修改',areas:[{id:'a',name:'A區',price:950,realSeats:2,fakeSeats:0,color:'#00aa00'}]},'PATCH')
  assert.equal(edited.data.room.areas[0].price,950);assert.equal(edited.data.room.areas[0].remaining,1);assert.equal(edited.data.room.orders.length,1)
  const records=(await request('/api/admin/orders',null,'GET')).data.orders
  assert.equal(records.length,1);assert.equal(records[0].nickname,'買家');assert.equal(records[0].eventTitle,'修改');assert.equal(records[0].areaName,'A區');assert.equal(records[0].unitPrice,700);assert.deepEqual(records[0].seats,[good.room.seats[0].label])
  assert.equal((await request(`/api/admin/orders/${records[0].id}`,{hostId:'wrong'},'DELETE')).status,403)
  assert.equal((await request(`/api/admin/orders/${records[0].id}`,{hostId:good.hostId},'DELETE')).status,200)
  const afterCancel=(await request(`/api/rooms/${g}`,null,'GET')).data.room
  assert.equal(afterCancel.orders.length,0);assert.equal(afterCancel.areas[0].remaining,2);assert.ok(afterCancel.seats.every(s=>!s.sold))
  const repurchase=await request(`/api/rooms/${g}/purchase`,body);assert.equal(repurchase.status,200)
  const cleared=await request('/api/admin/orders/clear',{code:g,hostId:good.hostId});assert.equal(cleared.data.removed,1)
  const afterClear=(await request(`/api/rooms/${g}`,null,'GET')).data.room
  assert.equal(afterClear.orders.length,0);assert.equal(afterClear.areas[0].remaining,2);assert.ok(afterClear.seats.every(s=>!s.sold))
  assert.equal((await request(`/api/rooms/${g}`,{hostId:'wrong'},'DELETE')).status,403)
  assert.equal((await request(`/api/rooms/${g}`,{hostId:good.hostId},'DELETE')).status,200)
  assert.equal((await request(`/api/rooms/${g}`,null,'GET')).status,404)
  assert.ok(!(await request('/api/events',null,'GET')).data.events.some(e=>e.code===g))
 } finally {app.kill()}
})
