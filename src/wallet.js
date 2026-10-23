/** Serialized wallet operations; retries reuse an immutable payload and operation id. */
export function createRechargeController({command,apply,makeId=()=>`cf4:${crypto.randomUUID()}`,requestTimeoutMs=15000}){
 let revision=0,state=null,wallet=null,pending=null,preparing=false;
 async function request(input){
  let timer;
  try{return await Promise.race([command(input),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('请求超时，结果尚未确认')),requestTimeoutMs);})]);}
  finally{clearTimeout(timer);}
 }
 async function accept(result){
  if(!result||result.ok!==true)throw Object.assign(Error(result?.message||'钱包未确认请求'),{code:result?.errorCode});
  revision=result.revision;state=await decodeProgress(result.state);wallet=result.wallet;return {...result,state};
 }
 async function send(){
  if(!pending)throw Error('没有需要重试的请求');
  try{const r=await accept(await request(pending));pending=null;return r;}
  catch(e){if(['PROTOCOL_INVALID','STALE_RUNTIME','CAPABILITY_UNAVAILABLE'].includes(e.code))pending=null;throw e;}
 }
 async function save(snapshot){
  if(pending||preparing)throw Error('请先确认上次请求');
  if(!snapshot)throw Error('请先开始游戏');
  preparing=true;
  try{pending=structuredClone({action:'saveGame',operationId:makeId(),expectedRevision:revision,state:await encodeProgress(snapshot)});}finally{preparing=false;}
  return send();
 }
 return {
  get state(){return state;},get wallet(){return wallet;},get revision(){return revision;},get pending(){return pending?structuredClone(pending):null;},
  async load(){if(pending)throw Error('请先确认上次请求');return accept(await request({action:'status'}));},
  save,
  async exchange(amount,snapshot){
   if(!Number.isSafeInteger(amount)||amount<1||amount>10000)throw Error('兑换数量必须为 1–10000 的整数');
   await save(snapshot);
   pending={action:'exchange',operationId:makeId(),expectedRevision:revision,amount};
   const result=await send();apply(result.state);return result;
  },
  async retry(){const result=await send();apply(result.state);return result;},
 };
}
import {encodeProgress,decodeProgress} from './scene-codec.js';
