import {createRechargeController} from './wallet.js';
import {encodeProgress} from './scene-codec.js';
globalThis.CF4Bytes=key=>{
 globalThis.CF4Decoded??={};if(!globalThis.CF4Decoded[key]){const raw=atob(globalThis.CF4Assets[key].join(''));globalThis.CF4Decoded[key]=Uint8Array.from(raw,c=>c.charCodeAt(0));delete globalThis.CF4Assets[key];}return globalThis.CF4Decoded[key];
};
globalThis.RufflePlayer={config:{autoplay:'on',splashScreen:false,polyfills:false,publicPath:'https://offline.invalid/',allowScriptAccess:true,allowNetworking:'all',openUrlMode:'deny',showSwfDownload:false,contextMenu:'off',logLevel:'error',preferredRenderer:'canvas',letterbox:'on',backgroundColor:'#05070a'}};
const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
const initial=()=>({coins:0,stats:{allkilled:0,manhp:100,'武器槽1':'无','武器槽1_弹夹内子弹':0,'武器槽1_子弹数':0,'武器槽2':'无','武器槽2_弹夹内子弹':0,'武器槽2_子弹数':0,'武器槽4':'grenade','武器槽4_弹夹内子弹':1,'武器槽4_子弹数':2,'刀种':1,'刀威力':25,nickname:'小屁孩','主线任务解锁':1}});
let player,api,controller,sdk,started=false,paused=false,suspended=false,ready=false,loaded=false,walletReady=false,working=false,restored=false,lastSave=Date.now();
const message=s=>{$('status').textContent=s;};
function status(){try{return api?.callExternalInterface('cf4Status');}catch{return null;}}
function read(){const snapshot=api.callExternalInterface('cf4Read');if(!snapshot||snapshot.error)throw Error(snapshot?.error||'请先开始原版游戏');return snapshot;}
function sync(){
 const blocked=working||suspended||Boolean(controller?.pending);
 $('pause').disabled=!loaded||working||suspended;$('pause').textContent=paused?'继续':'暂停';$('sound').disabled=!loaded;
 $('continue').disabled=!ready||blocked||started;$('continue').textContent=controller?.state?'继续存档':'开始游戏';
 $('save').disabled=!started||!walletReady||blocked;$('recharge').disabled=!started||!walletReady||blocked;
 $('retry').hidden=walletReady&&!controller?.pending||!loaded;$('retry').disabled=working||suspended;$('retry').textContent=controller?.pending?'重试未确认请求':'重新连接钱包';
 if(controller?.wallet)$('balance').textContent=String(controller.wallet.balance);
 const s=status();if(s?.started)$('money').textContent=`游戏金钱 ${s.coins}`;
}
function halt(){api?.suspend();}
function resume(){if(!paused&&!suspended&&!working&&!controller?.pending&&!$('exchange').open)api?.resume();}
function apply(state){if(api.callExternalInterface('cf4Apply',state)!==true)throw Error('游戏未确认到账，请重新打开以恢复已保存进度');}
async function restore(state){
 working=true;halt();sync();
 try{
  if(api.callExternalInterface('cf4Restore',state)!==true)throw Error('存档恢复失败');
  api.resume();await wait(160);halt();
  if(api.callExternalInterface('cf4RestorePrepare')!==true)throw Error('场景重建失败');
  api.resume();await wait(160);halt();
  if(api.callExternalInterface('cf4RestoreFinish')!==true)throw Error('场景恢复失败');
  started=true;restored=true;paused=Boolean(state.world);
  message(state.world?'已恢复保存时的关卡、位置、生命和装备；当前已暂停，点击继续。':'已进入游戏，可在原版画面操作或使用上方按钮。');
 }finally{working=false;sync();resume();}
}
async function save({quiet=false}={}){
 if(!started||!walletReady||working||suspended||controller.pending)return false;
 working=true;halt();sync();
 try{await controller.save(read());lastSave=Date.now();if(!quiet)message(paused?'已暂停，当前场景进度已保存。':'当前关卡、位置、生命、装备与金钱已保存。');return true;}
 catch(e){message(`保存失败：${e.message}${controller.pending?'；请重试未确认请求。':''}`);return false;}
 finally{lastSave=Date.now();working=false;sync();resume();}
}
async function connect(){
 try{await sdk.lifecycle.ready();await controller.load();walletReady=true;$('balance').textContent=String(controller.wallet.balance);message('钱包已连接；请先在原版画面完成进入确认。');}
 catch(e){walletReady=false;message(`钱包连接失败：${e.message}。请重载游戏中心后重试。`);}sync();
}
async function boot(){
 try{
  player=globalThis.RufflePlayer.newest().createPlayer();player.id='flash-player';$('stage').append(player);api=player.ruffle(1);
  await api.load({data:globalThis.CF4Bytes('swf'),swfFileName:'crazy-flasher4.swf',...globalThis.RufflePlayer.config});loaded=true;sync();
  sdk=globalThis.__DSH_GAMECENTER_SDK__;if(!sdk?.wallet?.command)throw Error('需要从支持鲸鲸币的游戏中心启动');
  controller=createRechargeController({command:input=>sdk.wallet.command(input),apply});
  sdk.lifecycle.register({pause:async()=>{suspended=true;halt();while(working)await wait(20);sync();return {walletRevision:controller.revision,progress:started?await encodeProgress(read()):null,pending:Boolean(controller.pending)};},resume:()=>{suspended=false;sync();resume();}});
  const theme=t=>document.body.classList.toggle('light',(typeof t==='string'?t:t?.mode)==='light');theme(sdk.theme?.get?.());sdk.theme?.subscribe?.(theme);
  await connect();
  setInterval(async()=>{
   if(working)return;
   const s=status();if(s?.ready&&!ready){ready=true;$('loading')?.remove();if(walletReady&&controller.state&&!restored){try{await restore(controller.state);}catch(e){message(e.message);}return;}message('原版游戏已就绪，可直接使用画面里的开始游戏，也可点击上方开始游戏。');}
   if(s?.started&&!started){started=true;message('已识别原版游戏进度，充值、暂停和保存已启用。');}
   sync();if(started&&walletReady&&!paused&&!suspended&&!controller.pending&&Date.now()-lastSave>=5000)void save({quiet:true});
  },250);
 }catch(e){message(`启动失败：${e.message}`);sync();}
}
$('continue').onclick=()=>void restore(controller?.state??initial()).catch(e=>message(e.message));
$('pause').onclick=async()=>{paused=!paused;if(paused){halt();sync();if(started&&walletReady)await save();else message('游戏已暂停。');}else{resume();sync();message('继续游戏。');}};
$('save').onclick=()=>void save();$('sound').onclick=()=>{api.volume=api.volume>0?0:1;$('sound').textContent=api.volume>0?'声音：开':'声音：关';};
function openExchange(){halt();$('exchange-status').textContent=controller.pending?'上次请求尚未确认，请重试确认结果。':'';$('confirm').textContent=controller.pending?'重试确认':'确认兑换';$('exchange').showModal();}
$('recharge').onclick=openExchange;$('retry').onclick=()=>controller.pending?openExchange():void connect();
$('amount').oninput=()=>{$('quote').textContent=`消耗 ${$('amount').value} 鲸鲸币，获得 ${Number($('amount').value)*10} 游戏金钱`;};
$('exchange').addEventListener('cancel',e=>{if(working||controller?.pending)e.preventDefault();});$('exchange').addEventListener('close',resume);
$('cancel').onclick=()=>{if(!working&&!controller.pending)$('exchange').close();};
$('confirm').onclick=async()=>{
 if(working)return;const amount=Number($('amount').value);if(!controller.pending&&(!Number.isSafeInteger(amount)||amount<1||amount>10000)){$('exchange-status').textContent='请输入 1–10000 的整数';return;}
 working=true;sync();$('confirm').disabled=true;$('cancel').disabled=true;$('amount').disabled=true;
 try{if(controller.pending){await controller.retry();$('exchange-status').textContent='上次请求已确认。';}else{await controller.exchange(amount,read());$('exchange-status').textContent=`兑换成功，游戏金钱 ${controller.state.coins}`;}lastSave=Date.now();message('鲸鲸币扣款、游戏金钱与当前场景已保存。');}
 catch(e){$('exchange-status').textContent=e.message+(controller.pending?'；结果待确认，请重试同一请求。':'');}
 finally{working=false;$('confirm').disabled=false;$('cancel').disabled=Boolean(controller.pending);$('amount').disabled=Boolean(controller.pending);$('confirm').textContent=controller.pending?'重试确认':'确认兑换';sync();}
};
window.addEventListener('load',()=>void boot());
