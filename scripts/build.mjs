import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {validateGameBundleFiles} from '../../../packages/protocol/dist/index.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'dist');
await fs.mkdir(out,{recursive:true});
for(const file of await fs.readdir(out))if(/^(asset-\d+\.js|ruffle\.js|core\.js|game\.js|style\.css|index\.html)$/.test(file))await fs.unlink(path.join(out,file));
const patch=JSON.parse(await fs.readFile(path.join(root,'assets/patch-info.json'),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const swf=await fs.readFile(path.join(root,'assets/game.swf'));
if(hash(swf)!==patch.patchedSha256||hash(await fs.readFile(path.join(root,'src/bridge.as')))!==patch.bridgeSha256)throw Error('Rebuild the SWF patch before packaging');
const vendor=path.join(root,'vendor/ruffle');
const vendorInfo=JSON.parse(await fs.readFile(path.join(vendor,'VENDOR.json'),'utf8'));
for(const [file,digest] of Object.entries(vendorInfo.filesSha256))if(hash(await fs.readFile(path.join(vendor,file)))!==digest)throw Error('Ruffle vendor digest mismatch: '+file);
const wasm=await fs.readFile(path.join(vendor,'172de42e6619eac8f371.wasm'));
let ruffle=await fs.readFile(path.join(vendor,'ruffle.js'),'utf8');
// Ruffle 0.7.1: preload chunk 110, and supply its WASM directly from memory.
// Never replace window.fetch or add data:/blob:/network permission to connect-src.
const needle='const s=n?new URL(a(797),a.b):new URL(a(124),a.b),l=await fetch(s)';
if(!ruffle.includes(needle))throw Error('Unknown Ruffle build; audit loader patch');
ruffle=ruffle.replace(needle,'const l=new Response(globalThis.CF4Bytes("wasm"),{headers:{"content-type":"application/wasm","content-length":String(globalThis.CF4Bytes("wasm").byteLength)}})');
// This distribution targets DSH Chromium, where the extension WASM is supported.
ruffle=ruffle.replace('a.b="undefined"!=typeof document&&document.baseURI||self.location.href','a.b="https://offline.invalid/"');
const tags=[];let index=0;
for(const [key,bytes] of [['wasm',wasm],['swf',swf]]){
 const encoded=bytes.toString('base64');
 for(let offset=0;offset<encoded.length;offset+=850000){const name=`asset-${index++}.js`;await fs.writeFile(path.join(out,name),`globalThis.CF4Assets??={};(globalThis.CF4Assets.${key}??=[]).push(${JSON.stringify(encoded.slice(offset,offset+850000))});`);tags.push(`<script src="${name}"></script>`);}
}
await fs.writeFile(path.join(out,'ruffle.js'),ruffle.replace(/\/\/# sourceMappingURL=[^\n]+/g,''));
await fs.copyFile(path.join(vendor,'core.ruffle.16d61072ac7fdc4d5013.js'),path.join(out,'core.js'));
await build({entryPoints:[path.join(root,'src/game.js')],outfile:path.join(out,'game.js'),bundle:true,format:'iife',target:'es2022',minify:false});
await fs.copyFile(path.join(root,'src/style.css'),path.join(out,'style.css'));
await fs.writeFile(path.join(out,'index.html'),(await fs.readFile(path.join(root,'src/index.html'),'utf8')).replace('<!--ASSETS-->',tags.join('\n')));
const files=[{path:'gamecenter.json',content:await fs.readFile(path.join(root,'gamecenter.json'),'utf8')},...await Promise.all((await fs.readdir(out)).map(async name=>({path:'dist/'+name,content:await fs.readFile(path.join(out,name),'utf8')})))];
const violations=validateGameBundleFiles(files);if(violations.length)throw Error(JSON.stringify(violations));
await fs.writeFile(path.join(root,'build-info.json'),JSON.stringify({id:'example.crazy-flasher4',files:files.length,bytes:files.reduce((n,f)=>n+Buffer.byteLength(f.content),0),sourceSha256:patch.sourceSha256,patchedSha256:hash(swf),ruffleVersion:'0.7.1',wasmSha256:hash(wasm),network:false,filesSha256:Object.fromEntries(files.map(f=>[f.path,hash(f.content)]))},null,2)+'\n');
console.log('Flash bundle ready:',files.length,'files');
