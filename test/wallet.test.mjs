import test from 'node:test';import assert from 'node:assert/strict';
import {createRechargeController} from '../src/wallet.js';
import {WhaleWallet,FLASH_GAME} from '../../../packages/dsh-gamecenter/staging/storage/whale-wallet.js';
const snapshot=()=>({coins:0,stats:{allkilled:0,manhp:100,'武器槽1':'无','武器槽1_弹夹内子弹':0,'武器槽1_子弹数':0,'武器槽2':'无','武器槽2_弹夹内子弹':0,'武器槽2_子弹数':0,'武器槽4':'grenade','武器槽4_弹夹内子弹':1,'武器槽4_子弹数':2,'刀种':1,'刀威力':25,nickname:'小屁孩','主线任务解锁':1}});
test('a committed debit with a lost response retries the identical operation exactly once',async()=>{
 const wallet=new WhaleWallet();wallet.observeUsage('fixture',{totalTokens:1_000_000});let lose=true,applied;const sent=[];
 const client=createRechargeController({command:async p=>{sent.push(structuredClone(p));const r=wallet.command(p,FLASH_GAME);if(p.action==='exchange'&&lose){lose=false;throw Error('response lost');}return r;},apply:s=>applied=s,makeId:(()=>{let n=0;return()=>`flash-${++n}`;})()});
 await client.load();await assert.rejects(client.exchange(2,snapshot()),/lost/);assert.equal(wallet.status().balance,8);assert.equal(client.pending.action,'exchange');await assert.rejects(client.save(snapshot()),/先确认/);await client.retry();assert.deepEqual(sent.at(-1),sent.at(-2));assert.equal(wallet.status().balance,8);assert.equal(applied.coins,20);assert.equal(client.pending,null);wallet.close();
});
test('Flash progress is isolated from the car game, malformed saves roll back, and operation ids cannot cross games',()=>{
 const wallet=new WhaleWallet();wallet.observeUsage('fixture',{totalTokens:1_000_000});wallet.command({action:'saveGame',operationId:'car',expectedRevision:0,state:{coins:160}});
 wallet.command({action:'saveGame',operationId:'flash',expectedRevision:0,state:snapshot()},FLASH_GAME);
 const paid=wallet.command({action:'exchange',operationId:'charge',expectedRevision:1,amount:1},FLASH_GAME);assert.equal(paid.state.coins,10);assert.equal(wallet.command({action:'status'}).state.coins,160);
 assert.throws(()=>wallet.command({action:'exchange',operationId:'charge',expectedRevision:1,amount:1}),/更改参数/);
 assert.throws(()=>wallet.command({action:'saveGame',operationId:'bad',expectedRevision:2,state:{coins:0,stats:{}}},FLASH_GAME),/格式/);
 assert.equal(wallet.command({action:'status'},FLASH_GAME).revision,2);assert.equal(wallet.status().balance,9);
 assert.throws(()=>wallet.command({action:'exchange',operationId:'no-funds',expectedRevision:2,amount:10},FLASH_GAME),/余额不足/);assert.equal(wallet.status().balance,9);
 assert.throws(()=>wallet.command({action:'status'},'foreign.game'),/未开通/);wallet.close();
});
test('save confirmation loss retries a frozen snapshot and never proceeds to debit automatically',async()=>{
 const w=new WhaleWallet();let lose=true;const c=createRechargeController({command:async p=>{const r=w.command(p,FLASH_GAME);if(p.action==='saveGame'&&lose){lose=false;throw Error('lost');}return r;},apply:()=>{}});await c.load();const state=snapshot();await assert.rejects(c.exchange(1,state));state.coins=999;assert.equal(c.pending.state.coins,0);assert.equal(c.pending.action,'saveGame');await c.retry();assert.equal(c.state.coins,0);assert.equal(w.status().balance,0);w.close();
});
test('a permanently lost response times out and can be retried without another debit',async()=>{
 const w=new WhaleWallet();w.observeUsage('fixture',{totalTokens:1_000_000});let lose=true;
 const c=createRechargeController({requestTimeoutMs:25,command:async p=>{const r=w.command(p,FLASH_GAME);if(p.action==='exchange'&&lose){lose=false;return new Promise(()=>{});}return r;},apply:()=>{}});
 await c.load();await assert.rejects(c.exchange(1,snapshot()),/超时/);assert.equal(c.pending.action,'exchange');assert.equal(w.status().balance,9);await c.retry();assert.equal(w.status().balance,9);assert.equal(c.state.coins,10);w.close();
});
