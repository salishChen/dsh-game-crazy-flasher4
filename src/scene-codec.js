const MAX_SCENE_BYTES=1024*1024;
async function transform(bytes,stream){
 const reader=new Blob([bytes]).stream().pipeThrough(stream).getReader(),chunks=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_SCENE_BYTES){await reader.cancel();throw Error('当前场景超过保存上限');}chunks.push(value);}
 const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result;
}
export async function encodeProgress(state){
 if(!state?.world||state.world.encoding)return structuredClone(state);
 const bytes=new TextEncoder().encode(JSON.stringify(state.world));if(bytes.length>MAX_SCENE_BYTES)throw Error('当前场景超过保存上限');
 const compressed=await transform(bytes,new CompressionStream('deflate'));if(compressed.length>90000)throw Error('当前场景超过保存传输上限');let binary='';for(const byte of compressed)binary+=String.fromCharCode(byte);
 return {...state,world:{encoding:'deflate-json-v1',data:btoa(binary)}};
}
export async function decodeProgress(state){
 if(state?.world?.encoding!=='deflate-json-v1')return state;
 const bytes=Uint8Array.from(atob(state.world.data),c=>c.charCodeAt(0));const raw=await transform(bytes,new DecompressionStream('deflate'));
 return {...state,world:JSON.parse(new TextDecoder().decode(raw))};
}
