const{app,BrowserWindow,ipcMain,shell,protocol,Menu,dialog,nativeImage,session,net}=require('electron'),crypto=require('crypto'),fs=require('fs'),path=require('path');
app.commandLine.appendSwitch('disable-features','Translate,MediaRouter,OptimizationHints,AutofillServerCommunication,CalculateNativeWinOcclusion');app.commandLine.appendSwitch('disable-background-networking');
const LOCK=app.requestSingleInstanceLock();if(!LOCK)app.quit();
protocol.registerSchemesAsPrivileged([{scheme:'mirror',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
const MD=()=>path.join(app.getPath('userData'),'mirrors'),PF=()=>path.join(app.getPath('userData'),'pages.json'),sl=t=>new Promise(r=>setTimeout(r,t));
const TX=/\.(html|js|mjs|css|json|svg|txt|xml)$/i,MT={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.mp4':'video/mp4','.ico':'image/x-icon'};
const walk=(d,b='')=>fs.existsSync(d)?fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name),b+'/'+e.name):[b+'/'+e.name]):[];
const wr=p=>{const f=PF(),t=f+'.tmp';fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(t,JSON.stringify(p));fs.renameSync(t,f)};
const rd=f=>fs.readFileSync(path.join(__dirname,f),'utf8');
const opsOf=id=>{try{return fs.readFileSync(path.join(MD(),id,'_sl_ops.json'),'utf8')}catch{return'[]'}};
const SL_NT='<meta name="google" content="notranslate">';
function injectHead(html,id,edit,inline,ov){if(inline){if(!/<meta[^>]+name=["']google["'][^>]*notranslate/i.test(html)&&!/<meta[^>]+notranslate[^>]*name=["']google["']/i.test(html))html=/<head[^>]*>/i.test(html)?html.replace(/<head[^>]*>/i,m=>m+SL_NT):SL_NT+html;html=html.replace(/<html\b([^>]*)>/i,(m,a)=>/\btranslate\s*=/i.test(a)?m:'<html'+a+' translate="no">')}const x=(inline?'':'<style>html{scrollbar-width:none}::-webkit-scrollbar{display:none}</style>')+`<script>${edit?'window.__SL_EDIT=1;':''}window.__SL_OPS=${asciiJs((ov||opsOf(id)).replace(/</g,'\\u003c'))}<\/script>`+(inline?`<script>${rd('patch.js')}<\/script>`:'<script src="/__sl/patch.js"><\/script>')+(edit?'<script src="/__sl/agent.js"><\/script>':'');return /<head[^>]*>/i.test(html)?html.replace(/<head[^>]*>/i,m=>m+x):x+html}
const mh=req=>{try{const u=new URL(req.url),root=path.join(MD(),u.hostname);let p=decodeURIComponent(u.pathname);if(p.startsWith('/__sl/')){const n=p.slice(6);if(n=='patch.js'||n=='agent.js')return new Response(rd(n),{headers:{'content-type':'text/javascript','cache-control':'no-store'}});return new Response('',{status:404})}
if(p.endsWith('/'))p+='index.html';let f=path.join(root,p);if(!f.startsWith(root))return new Response('',{status:403});if(!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(root,'index.html');
let body=fs.readFileSync(f);if(f==path.join(root,'index.html'))body=Buffer.from(injectHead(body.toString('utf8'),u.hostname,u.searchParams.has('edit'),false,u.searchParams.has('orig')?'[]':null));
return new Response(body,{headers:{'content-type':MT[path.extname(f).toLowerCase()]||'application/octet-stream','cache-control':'no-store'}})}catch{return new Response('',{status:404})}};
const BK=()=>path.join(app.getPath('userData'),'bake');
const bakeK=(raw,os)=>crypto.createHash('sha1').update(raw).update('\0').update(os).digest('hex');
function bakeGet(id,os,raw){try{if(os=='[]')return null;const j=JSON.parse(fs.readFileSync(path.join(BK(),id+'.json'),'utf8'));return j.k==bakeK(raw,os)?j.bake:null}catch{return null}}
function applyPoster(h,B){try{if(!B||typeof B.b!='string')return h;const lb=h.toLowerCase().lastIndexOf('</body>');if(lb<0||!/<head[^>]*>/i.test(h)||!/<\/head>/i.test(h))return h;
const AR=/([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g,eq=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
const mt=(tag,add)=>{const re=new RegExp('<'+tag+'\\b([^>]*)>','i');if(!re.test(h))return;h=h.replace(re,(m,a)=>{const o={};let x;AR.lastIndex=0;while((x=AR.exec(a)))o[x[1].toLowerCase()]=x[2]!=null?x[2]:x[3]!=null?x[3]:x[4]!=null?x[4]:'';for(const k in add){if(/^(id|translate)$/i.test(k)&&o[k]!=null)continue;const v=add[k];if(k=='class'){const s=new Set((o.class||'').split(/\s+/).filter(Boolean));String(v).split(/\s+/).filter(Boolean).forEach(c=>s.add(c));o.class=[...s].join(' ')}else if(k=='style'){o.style=((o.style||'').replace(/;?\s*$/,';')+v).replace(/^;/,'')}else if(o[k]==null)o[k]=v}return'<'+tag+Object.keys(o).map(k=>' '+k+'="'+eq(o[k])+'"').join('')+'>'})};
mt('html',Object.assign({},B.ha||{},{class:((B.ha&&B.ha.class)||'')+' slp'}));mt('body',B.ba||{});
const css='html.slp body>*:not(#__slp):not(#__slpm):not(script):not(style):not(link):not(noscript):not(template){position:absolute!important;left:0!important;top:0!important;width:100%!important;visibility:hidden!important;pointer-events:none!important}#__slp,#__slpm{display:contents}'+(B.mb?'@media(max-width:767px){#__slp{display:none!important}}@media(min-width:768px){#__slpm{display:none!important}}':'#__slpm{display:none!important}');
const add=(B.ln||[]).map(u=>'<link rel="stylesheet" href="'+eq(u)+'">').join('')+(B.st||[]).map(s=>'<style data-slp>'+String(s).replace(/<\/style/gi,'<\\/style')+'</style>').join('');
h=h.replace(/<head[^>]*>/i,m=>m+'<script>window.__SL_POSTER=1<\/script><style id="__slps">'+css+'</style>');
h=h.replace(/<\/head>/i,()=>add+'</head>');const lb2=h.toLowerCase().lastIndexOf('</body>');
return h.slice(0,lb2)+'<div id="__slp">'+B.b+'</div>'+(B.mb?'<div id="__slpm">'+B.mb+'</div>':'')+h.slice(lb2)}catch(e){return h}}
function siteFiles(id,inject,ops){const F={},dir=path.join(MD(),id);for(const p of walk(dir)){if(p.startsWith('/_sl'))continue;let b=fs.readFileSync(dir+p);if(p=='/index.html'){const os=ops?JSON.stringify(ops):opsOf(id);let h=injectHead(b.toString('utf8'),id,false,true,os);const bk=bakeGet(id,os,b);if(bk)h=applyPoster(h,bk);if(inject)h=h.replace(/<\/head>/i,()=>inject+'</head>');h=fixCharset(h);b=Buffer.from(h)}F[p]=b}if(!F['/_redirects'])F['/_redirects']=Buffer.from('/*  /index.html  200\n');return F}
app.whenReady().then(()=>{if(!LOCK)return;Menu.setApplicationMenu(null);protocol.handle('mirror',mh);const w=new BrowserWindow({width:1440,height:900,backgroundColor:'#0b0c11',autoHideMenuBar:true,title:'Shark Lab',icon:__dirname+'/icon.png',webPreferences:{preload:__dirname+'/preload.js',spellcheck:false}});
w.webContents.on('before-input-event',(e,i)=>{if(i.type=='keyDown'&&i.key=='F11'){e.preventDefault();w.setFullScreen(!w.isFullScreen())}});w.webContents.on('will-prevent-unload',e=>{const c=dialog.showMessageBoxSync(w,{type:'warning',buttons:['Sair mesmo assim','Voltar ao editor'],defaultId:1,cancelId:1,title:'Shark Lab',message:'Há alterações que ainda não foram publicadas.',detail:'Elas ficam salvas no editor, mas o site no ar continua como estava.'});if(c==0)e.preventDefault()});w.loadFile(__dirname+'/index.html');app.on('second-instance',()=>{if(w.isMinimized())w.restore();w.focus()});w.webContents.setWindowOpenHandler(({url})=>{shell.openExternal(url);return{action:'deny'}})});
app.on('window-all-closed',()=>app.quit());
const loadPages=()=>{try{const raw=fs.readFileSync(PF(),'utf8');let l;try{l=JSON.parse(raw)}catch{try{fs.copyFileSync(PF(),PF()+'.corrupt')}catch{}return null}
if(!Array.isArray(l))return null;let ch=false;
for(const p of l){if(!/^p[a-z0-9]+$/.test(p.id)){const o=path.join(MD(),p.id);p.id='p'+String(p.id).toLowerCase().replace(/[^a-z0-9]/g,'');try{if(fs.existsSync(o))fs.renameSync(o,path.join(MD(),p.id))}catch{}ch=true}
const dir=path.join(MD(),p.id),idx=path.join(dir,'index.html');
if(typeof p.html=='string'){if(p.html){let e=0;try{e=fs.statSync(idx).size}catch{}if(!e){fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(idx,p.html)}}delete p.html;ch=true}
if(typeof p.thumb=='string'&&p.thumb.length>8){try{fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'_sl_thumb.jpg'),Buffer.from(p.thumb,'base64'));p.thumb=1}catch{}ch=true}
if(!p.mirror){p.mirror=true;ch=true}
let ok=false;try{ok=fs.statSync(idx).size>0}catch{}
if(ok){if(p.broken){delete p.broken;ch=true}}else if(!p.broken){p.broken=true;ch=true}}
try{fs.copyFileSync(PF(),PF()+'.bak')}catch{}
if(ch)wr(l);return l}catch{return null}};
const CF=()=>path.join(app.getPath('userData'),'config.json');
ipcMain.on('cfgLoad',e=>{try{const j=JSON.parse(fs.readFileSync(CF(),'utf8'));if(j.enc){const{safeStorage}=require('electron');e.returnValue=safeStorage.decryptString(Buffer.from(j.enc,'base64'))}else e.returnValue=j.plain||null}catch{e.returnValue=null}});
ipcMain.handle('cfgSave',(_,txt)=>{try{const{safeStorage}=require('electron');let o;try{o=safeStorage.isEncryptionAvailable()?{enc:safeStorage.encryptString(String(txt)).toString('base64')}:{plain:String(txt)}}catch{o={plain:String(txt)}}fs.mkdirSync(path.dirname(CF()),{recursive:true});fs.writeFileSync(CF()+'.tmp',JSON.stringify(o));fs.renameSync(CF()+'.tmp',CF());return{ok:true}}catch(e){return{ok:false,error:String(e.message)}}});
ipcMain.on('loadSync',e=>{e.returnValue=loadPages()});
ipcMain.handle('fs',e=>{const w=BrowserWindow.fromWebContents(e.sender);if(w)w.setFullScreen(!w.isFullScreen())});
ipcMain.handle('save',(_,p)=>{try{wr(p);return{ok:true}}catch(e){return{ok:false,error:String(e.message)}}});
ipcMain.on('saveSync',(e,p)=>{try{wr(p);e.returnValue=1}catch{e.returnValue=0}});
ipcMain.handle('mirror',async(_,{id,url})=>{const w=new BrowserWindow({show:false,width:1280,height:900,webPreferences:{backgroundThrottling:false,offscreen:true}}),d=w.webContents.debugger,R={},P=[];let pend=0,last=Date.now();
const idle=async(ms,max)=>{const t=Date.now();while(Date.now()-t<max&&(pend>0||Date.now()-last<ms))await sl(40)};
try{await w.loadURL('about:blank');d.attach('1.3');await d.sendCommand('Network.enable');await d.sendCommand('Network.setCacheDisabled',{cacheDisabled:true});
d.on('message',(e,m,p)=>{if(m=='Network.requestWillBeSent'){pend++;last=Date.now()}if(m=='Network.loadingFailed'){pend=Math.max(0,pend-1);last=Date.now()}if(m=='Network.responseReceived'&&p.response.status<300)R[p.requestId]={u:p.response.url,t:p.type};if(m=='Network.loadingFinished'){pend=Math.max(0,pend-1);last=Date.now();if(R[p.requestId]){const q=R[p.requestId];P.push(d.sendCommand('Network.getResponseBody',{requestId:p.requestId}).then(b=>({...q,b})).catch(()=>null))}}});
await Promise.race([w.loadURL(url).catch(e=>{if(e.code!='ERR_ABORTED'&&!/ERR_ABORTED/.test(String(e)))throw e}),sl(25000).then(()=>{throw new Error('O site demorou demais para responder.')})]);
await idle(400,5000);
let th='';try{th=(await w.webContents.capturePage()).resize({width:640}).toJPEG(70).toString('base64')}catch{}
await w.webContents.executeJavaScript('(async()=>{document.querySelectorAll("img[loading=lazy],iframe[loading=lazy]").forEach(i=>{i.loading="eager"});document.querySelectorAll("*").forEach(e=>{if(e.scrollWidth>e.clientWidth+40&&/(auto|scroll)/.test(getComputedStyle(e).overflowX)){try{e.scrollTo(e.scrollWidth,0);e.scrollTo(0,0)}catch{}}});const h=document.documentElement.scrollHeight;for(let y=0;y<h;y+=900){scrollTo(0,y);await new Promise(r=>setTimeout(r,70))}scrollTo(0,0)})()');await idle(350,4000);
let extra=[];try{extra=await w.webContents.executeJavaScript(`(()=>{const S=new Set(),add=u=>{if(u)try{S.add(new URL(u,document.baseURI).href)}catch{}};document.querySelectorAll('img,source,video,audio,image,input[type=image]').forEach(e=>{for(const a of e.attributes){if(/^(src|poster|data-)/.test(a.name)&&!/srcset/.test(a.name))add(a.value);if(/srcset/.test(a.name))a.value.split(',').forEach(x=>add(x.trim().split(/\\s+/)[0]))}});document.querySelectorAll('link[rel*=icon],link[rel=preload][as=image],meta[property="og:image"],meta[name="twitter:image"]').forEach(e=>add(e.href||e.content));document.querySelectorAll('*').forEach(e=>{for(const ps of [null,'::before','::after']){const v=getComputedStyle(e,ps).backgroundImage;if(v&&v.indexOf('url(')>=0)(v.match(/url\\(["']?[^"')]+/g)||[]).forEach(x=>add(x.replace(/^url\\(["']?/,'')))}});return[...S]})()`)}catch{}
const res=(await Promise.all(P)).filter(Boolean),fin=new URL(w.webContents.getURL()),origin=fin.origin,dir=path.join(MD(),id);fs.rmSync(dir,{recursive:true,force:true});let n=0,doc=false;const OUT={};
for(const f of res){let u;try{u=new URL(f.u)}catch{continue}if(u.origin!=origin)continue;let p=decodeURIComponent(u.pathname);if(f.t=='Document'){if(doc||(p.includes('.')&&!p.endsWith('.html')))continue;doc=true;p='/index.html'}else if(p.endsWith('/'))continue;
let b=Buffer.from(f.b.body,f.b.base64Encoded?'base64':'utf8');if(p=='/index.html'){let h=b.toString('utf8').split(origin).join('');if(fin.pathname!='/'&&!fin.pathname.includes('.'))h=/<head[^>]*>/i.test(h)?h.replace(/<head[^>]*>/i,m=>m+`<script>history.replaceState(null,'','${fin.pathname}')<\/script>`):`<script>history.replaceState(null,'','${fin.pathname}')<\/script>`+h;b=Buffer.from(h)}
OUT[p]=b}
if(!doc)return{ok:false,error:'Não consegui capturar a página. Confira o endereço.'};
let cfr=null;try{const U8={};for(const p in OUT)U8[p]=new Uint8Array(OUT[p]);cfr=await makeCloneFix({get:async u=>{try{const r=await net.fetch(u,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',Referer:origin+'/'},signal:AbortSignal.timeout(25000)});return{status:r.status,u8:new Uint8Array(await r.arrayBuffer()),type:r.headers.get('content-type')}}catch{return null}}}).complete(U8,fin.href,{extra});for(const p in U8)OUT[p]=Buffer.from(U8[p])}catch(e){cfr={error:String(e&&e.message||e)}}
for(const p in OUT){const fp=path.join(dir,p);fs.mkdirSync(path.dirname(fp),{recursive:true});fs.writeFileSync(fp,OUT[p]);n++}
if(th)fs.writeFileSync(path.join(dir,'_sl_thumb.jpg'),Buffer.from(th,'base64'));return{ok:true,count:n,thumb:th?1:0,more:cfr}}catch(e){return{ok:false,error:String(e.message||e)}}finally{try{d.detach()}catch{}w.destroy()}});
ipcMain.handle('mrep',(_,{id,a,b,apply})=>{try{const dir=path.join(MD(),id);let n=0,f=0;for(const p of walk(dir)){if(!TX.test(p)||p.startsWith('/_sl'))continue;const fp=dir+p,t=fs.readFileSync(fp,'utf8'),c=t.split(a).length-1;if(c){n+=c;f++;if(apply)fs.writeFileSync(fp,t.split(a).join(b))}}return{ok:true,n,f}}catch(e){return{ok:false,error:String(e.message)}}});
const mainHtml=dir=>{const l=walk(dir).filter(p=>/\.html?$/i.test(p)&&!p.startsWith('/_sl'));if(l.includes('/index.html'))return'/index.html';l.sort((a,b)=>a.split('/').length-b.split('/').length||a.length-b.length);return l[0]||null};
const CB=()=>path.join(app.getPath('userData'),'codebak');
ipcMain.handle('mhtml',(_,{id})=>{try{const dir=path.join(MD(),id),p=mainHtml(dir);if(!p)return{ok:false,error:'Página sem HTML'};return{ok:true,path:p,html:fs.readFileSync(dir+p,'utf8')}}catch(e){return{ok:false,error:String(e.message)}}});
ipcMain.handle('mwrite',(_,{id,pth,html})=>{try{if(!pth||/\.\./.test(pth)||pth.startsWith('/_sl')||typeof html!='string')return{ok:false,error:'caminho inválido'};const fp=path.join(MD(),id)+pth;fs.mkdirSync(CB(),{recursive:true});fs.writeFileSync(path.join(CB(),id+'.json'),JSON.stringify({pth,html:fs.readFileSync(fp,'utf8')}));fs.writeFileSync(fp,html);return{ok:true}}catch(e){return{ok:false,error:String(e.message)}}});
ipcMain.handle('mundo',(_,{id,peek})=>{try{const f=path.join(CB(),id+'.json');if(!fs.existsSync(f))return{ok:true,has:false};if(peek)return{ok:true,has:true};const b=JSON.parse(fs.readFileSync(f,'utf8'));fs.writeFileSync(path.join(MD(),id)+b.pth,b.html);fs.rmSync(f,{force:true});return{ok:true,has:false}}catch(e){return{ok:false,error:String(e.message)}}});
ipcMain.handle('mput',(_,{id,name,data})=>{try{const dir=path.join(MD(),id,'uploads');fs.mkdirSync(dir,{recursive:true});const n=Date.now()+'-'+name.replace(/[^\w.-]/g,'_');fs.writeFileSync(path.join(dir,n),Buffer.from(data.split(',')[1],'base64'));return{ok:true,path:'/uploads/'+n}}catch(e){return{ok:false,error:String(e.message)}}});
ipcMain.handle('fsize',(_,{id,files})=>{const r={},root=path.join(MD(),id);for(const f of files||[]){try{const rel=decodeURIComponent(String(f).split('?')[0].replace(/^https?:\/\/[^/]+/,'').replace(/^mirror:\/\/[^/]+/,'')),p=path.join(root,rel);if(p.startsWith(root)&&fs.existsSync(p))r[f]=fs.statSync(p).size}catch{}}return r});
ipcMain.handle('imgopt',(_,{id})=>{const root=path.join(MD(),id);let n=0,saved=0;const w=d=>{for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory()){if(!f.name.startsWith('_sl'))w(p)}else if(/\.(jpe?g|png)$/i.test(f.name)&&!f.name.startsWith('_sl')){try{const sz=fs.statSync(p).size;let im=nativeImage.createFromPath(p);if(im.isEmpty())continue;const s=im.getSize();if(sz<250000&&s.width<=1600)continue;if(s.width>1600)im=im.resize({width:1600,quality:'best'});const out=/\.png$/i.test(f.name)?im.toPNG():im.toJPEG(82);if(out.length<sz*0.92){const bk=path.join(root,'_sl_bak',path.relative(root,p));if(!fs.existsSync(bk)){fs.mkdirSync(path.dirname(bk),{recursive:true});fs.copyFileSync(p,bk)}fs.writeFileSync(p,out);n++;saved+=sz-out.length}}catch{}}}};try{w(root);return{ok:true,n,saved}}catch(e){return{ok:false,error:String(e.message)}}});
ipcMain.handle('himp',(_,{id,html})=>{try{let h=String(html||'');if(!h.trim())return{ok:false,error:'O arquivo está vazio.'};if(!/<html/i.test(h))h='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+h+'</body></html>';else if(!/<head[\s>]/i.test(h))h=h.replace(/<html[^>]*>/i,m=>m+'<head><meta charset="utf-8"></head>');if(!/^\s*<!doctype/i.test(h))h='<!doctype html>'+h;const dir=path.join(MD(),id);fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'index.html'),h);return{ok:true}}catch(e){return{ok:false,error:String(e.message)}}});

/* ---- prévia do checkout sem rastreadores ---- */
const TRK_H=['facebook.com','facebook.net','fb.com','fb.me','google-analytics.com','analytics.google.com','googletagmanager.com','googleadservices.com','googlesyndication.com','doubleclick.net','analytics.tiktok.com','business-api.tiktok.com','ads.tiktok.com','byteoversea.com','tr.snapchat.com','sc-static.net','ct.pinterest.com','px.ads.linkedin.com','snap.licdn.com','ads-twitter.com','analytics.twitter.com','t.co','bat.bing.com','clarity.ms','hotjar.com','hotjar.io','mouseflow.com','fullstory.com','taboola.com','outbrain.com','kwai.net','adsnebula.com','utmify.com.br','utmify.com','segment.io','segment.com','mixpanel.com','amplitude.com','criteo.com','hubspot.com','hs-analytics.net','clickcease.com','tiktokw.com'];
const TRK_P=/fbevents|\/tr\/?\?[^#]*\b(id|ev)=|\/gtm\.js|\/gtag\/js|\/g\/collect|\/j\/collect|\/collect\?v=|analytics\.js|\/pixel[^\/]*\.js|\/events\.js|\/ttq|\/snippet\.js\?id=/i;
const trkBlock=u=>{try{const x=new URL(u);if(!/^https?:|^wss?:/.test(x.protocol))return false;const h=x.hostname.toLowerCase();return TRK_H.some(d=>h===d||h.endsWith('.'+d))||TRK_P.test(x.pathname+x.search)}catch(e){return false}};
ipcMain.handle('ckview',(ev,{url,title})=>{try{const u=new URL(String(url||''));if(!/^https?:$/.test(u.protocol))return{ok:false,error:'Link inválido.'};
 const part='ckprev-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),ses=session.fromPartition(part);let n=0;const nm=String(title||'Checkout').slice(0,60);
 const w=new BrowserWindow({width:1120,height:840,title:'Prévia sem rastreio',parent:BrowserWindow.fromWebContents(ev.sender)||undefined,autoHideMenuBar:true,webPreferences:{partition:part,sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true}});
 const ttl=()=>{if(!w.isDestroyed())w.setTitle('Prévia sem rastreio · '+nm+' · '+n+' rastreador'+(n==1?'':'es')+' bloqueado'+(n==1?'':'s'))};
 ses.webRequest.onBeforeRequest((d,cb)=>{if(trkBlock(d.url)){n++;ttl();return cb({cancel:true})}cb({})});
 ses.setPermissionRequestHandler((_,__,cb)=>cb(false));ses.setPermissionCheckHandler(()=>false);
 w.webContents.setWindowOpenHandler(()=>({action:'deny'}));w.on('page-title-updated',e=>{e.preventDefault();ttl()});
 w.on('closed',()=>{ses.clearStorageData().catch(()=>{})});ttl();w.loadURL(u.href);return{ok:true}}catch(e){return{ok:false,error:String(e.message||e)}}});
ipcMain.handle('mdup',(_,{from,to})=>{try{fs.cpSync(path.join(MD(),from),path.join(MD(),to),{recursive:true,filter:s=>!/_sl_bak/.test(s)});return{ok:true}}catch(e){return{ok:false,error:String(e.message)}}});
ipcMain.handle('mdel',(_,id)=>{try{fs.rmSync(path.join(MD(),id),{recursive:true,force:true})}catch{}});
const AISYS=`Você é o assistente de edição do Shark Lab, dentro de um editor visual de páginas de vendas. A página já está clonada e é renderizada em JavaScript. Você a modifica pelas ferramentas, que agem em elementos identificados por "caminho": lista de índices de filhos a partir de <body> (ex.: [0,2,1]).
Você recebe o mapa da página (linhas "[caminho] tag.classes "texto" LarguraxAltura") e, quando houver, o elemento que o usuário selecionou.
Regras:
- Use somente caminhos que existam no mapa. Se faltar informação (qual elemento, qual texto), pergunte antes de agir.
- Com várias mudanças estruturais (remover, inserir, duplicar, mover), aplique do FIM da página para o INÍCIO, para os caminhos anteriores continuarem válidos.
- Estilos: CSS concreto (cores hex, px/rem). Eles são aplicados com !important.
- HTML inserido: autocontido, estilos inline, responsivo (mobile primeiro, flex-wrap, max-width), visual profissional: espaçamento generoso, tipografia limpa, bom contraste, botões com cantos arredondados. Sem scripts. Imagens só com URLs dadas pelo usuário; senão use blocos de cor/gradiente.
- Texto puro: set_text. Texto com formatação: set_html.
- Responda sempre em português do Brasil, em 1 a 3 frases, dizendo o que mudou.`;
const PATH={type:'array',items:{type:'integer'},description:'caminho do elemento'};
const AITOOLS=[
{name:'set_text',description:'Troca o texto do elemento (texto puro).',input_schema:{type:'object',properties:{path:PATH,text:{type:'string'}},required:['path','text']}},
{name:'set_html',description:'Troca o HTML interno do elemento.',input_schema:{type:'object',properties:{path:PATH,html:{type:'string'}},required:['path','html']}},
{name:'set_style',description:'Aplica estilos CSS ao elemento.',input_schema:{type:'object',properties:{path:PATH,props:{type:'object',description:'propriedade CSS -> valor, ex.: {"color":"#fff","font-size":"28px"}',additionalProperties:{type:'string'}}},required:['path','props']}},
{name:'set_attr',description:'Define um atributo (href, src, alt...).',input_schema:{type:'object',properties:{path:PATH,name:{type:'string'},value:{type:'string'}},required:['path','name','value']}},
{name:'remove',description:'Remove o elemento.',input_schema:{type:'object',properties:{path:PATH},required:['path']}},
{name:'duplicate',description:'Duplica o elemento logo abaixo dele.',input_schema:{type:'object',properties:{path:PATH},required:['path']}},
{name:'move',description:'Move o elemento uma posição para cima (-1) ou para baixo (1) entre os irmãos.',input_schema:{type:'object',properties:{path:PATH,dir:{type:'integer',enum:[-1,1]}},required:['path','dir']}},
{name:'insert_html',description:'Insere HTML novo antes/depois de um elemento, ou no fim da página (position "end", path []).',input_schema:{type:'object',properties:{path:PATH,position:{type:'string',enum:['before','after','end']},html:{type:'string'}},required:['position','html']}}];
const okPath=p=>Array.isArray(p)&&p.length<40&&p.every(n=>Number.isInteger(n)&&n>=0);
const escH=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
const safeH=h=>String(h).replace(/<script[\s\S]*?<\/script\s*>/gi,'').replace(/<script[^>]*>/gi,'').replace(/javascript:/gi,'');
function toOps(n,i){i=i||{};const p=i.path;
if(n=='insert_html'){const e=i.position=='end'||!p||!p.length;if(!e&&!okPath(p))return[];return[{op:'ins',path:e?[]:p,pos:e?'end':(i.position=='before'?'before':'after'),html:safeH(i.html)}]}
if(!okPath(p))return[];
switch(n){case'set_text':return[{op:'text',path:p,html:escH(i.text)}];case'set_html':return[{op:'text',path:p,html:safeH(i.html)}];
case'set_style':{const pr={};for(const k in(i.props||{}))if(/^[a-z-]+$/i.test(k))pr[k]=String(i.props[k]);return Object.keys(pr).length?[{op:'style',path:p,props:pr}]:[]}
case'set_attr':return/^on/i.test(i.name)||!/^[a-z-]+$/i.test(i.name)?[]:[{op:'attr',path:p,k:i.name,v:/^javascript:/i.test(i.value)?'':String(i.value)}];
case'remove':return[{op:'rm',path:p}];case'duplicate':return[{op:'dup',path:p}];case'move':return[{op:'mv',path:p,dir:i.dir<0?-1:1}]}return[]}
ipcMain.handle('ai',async(_,{key,model,messages,ping})=>{try{if(!key)return{ok:false,error:'nokey'};
const body={model:model||'claude-sonnet-5-5',max_tokens:ping?16:8000,messages};if(!ping){body.system=AISYS;body.tools=AITOOLS}
const r=await fetch(process.env.SL_AI_URL||'https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},body:JSON.stringify(body)});
const j=await r.json().catch(()=>({}));if(!r.ok)return{ok:false,status:r.status,error:(j.error&&j.error.message)||('Erro '+r.status)};
let text='',ops=[];for(const b of j.content||[]){if(b.type=='text')text+=b.text;else if(b.type=='tool_use')ops.push(...toOps(b.name,b.input))}
return{ok:true,text:text.trim(),ops,cut:j.stop_reason=='max_tokens'}}catch(e){return{ok:false,error:String(e.message||e)}}});
const CKU=()=>process.env.SL_CAKTO_URL||'https://api.cakto.com.br',FBU=()=>process.env.SL_META_URL||'https://graph.facebook.com';
async function jf(url,opt){const r=await fetch(url,opt),t=await r.text();let j=null;try{j=JSON.parse(t)}catch{}if(!r.ok){const e=new Error((j&&((j.error&&(j.error.message||j.error))||j.detail||j.message))||t.slice(0,160)||('Erro '+r.status));e.status=r.status;throw e}return j}
let ckTok=null;
async function ckToken(id,sec){const k=id+'|'+sec;if(ckTok&&ckTok.k==k&&ckTok.exp>Date.now()+60000)return ckTok.t;const j=await jf(CKU()+'/public_api/token/',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:id,client_secret:sec}).toString()});ckTok={k,t:j.access_token,exp:Date.now()+(j.expires_in||36000)*1000};return ckTok.t}
const spDay=s=>s?new Date(s).toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'}):'';
const addDay=(d,n)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
async function ckOrders(id,sec,from){const tok=await ckToken(id,sec),H={Authorization:'Bearer '+tok},stop=addDay(from,-6),out=[];let url=CKU()+'/public_api/orders/?limit=100&ordering=-createdAt',pages=0,done=false;
while(url&&!done&&pages++<400){const j=await jf(url,{headers:H});for(const o of j.results||[]){if(spDay(o.createdAt)<stop){done=true;break}out.push({id:o.id,ref:o.refId,st:String(o.status||'').toLowerCase(),amount:+o.amount||0,fees:+o.fees||0,created:o.createdAt,paid:o.paidAt||null,refunded:o.refundedAt||null,cb:o.chargedbackAt||null,pm:o.paymentMethod||'',type:o.type||'',offer:o.offer_type||'',prod:(o.product&&o.product.name)||'',camp:o.utm_campaign||'',src:o.utm_source||'',med:o.utm_medium||'',cont:o.utm_content||'',sck:o.sck||''})}url=j.next||null}
return out}
async function mtRows(token,acct,from,to,ver){const id=String(acct).replace(/\D/g,''),q=new URLSearchParams({level:'campaign',fields:'campaign_id,campaign_name,spend,impressions,clicks,inline_link_clicks,account_currency',time_range:JSON.stringify({since:from,until:to}),time_increment:'1',limit:'500',access_token:token});let url=FBU()+'/'+(ver?ver+'/':'')+'act_'+id+'/insights?'+q,pages=0;const out=[];
while(url&&pages++<100){const j=await jf(url);for(const r of j.data||[])out.push({date:r.date_start,cid:r.campaign_id,name:r.campaign_name,spend:+r.spend||0,imps:+r.impressions||0,clicks:+(r.inline_link_clicks||r.clicks)||0,cur:r.account_currency||''});url=(j.paging&&j.paging.next)||null}return out}
ipcMain.handle('dash',async(_,{ck,mt,from,to})=>{const R={ok:true,orders:null,ads:null,err:{}};
if(ck&&ck.id&&ck.sec){try{R.orders=await ckOrders(ck.id.trim(),ck.sec.trim(),from)}catch(e){R.err.ck=e.status==401||e.status==400?'A Cakto recusou as credenciais ('+(e.message||e.status)+'). Confira o client_id e o client_secret.':String(e.message||e)}}
if(mt&&mt.tok&&mt.acct){try{R.ads=[];for(const a of String(mt.acct).split(/[,;\s]+/).filter(Boolean))R.ads.push(...await mtRows(mt.tok.trim(),a,from,to,(mt.ver||'').trim()))}catch(e){R.ads=null;R.err.mt=/token|OAuth|session|expired/i.test(e.message||'')?'O token da Meta expirou ou é inválido. Gere outro. ('+e.message+')':String(e.message||e)}}
return R});
ipcMain.handle('dtest',async(_,{kind,ck,mt})=>{try{if(kind=='ck'){const t=await ckToken((ck.id||'').trim(),(ck.sec||'').trim());const j=await jf(CKU()+'/public_api/orders/?limit=1',{headers:{Authorization:'Bearer '+t}});return{ok:true,info:'Conectado. Total de pedidos: '+(j.count!=null?j.count:'?')}}
const id=String(mt.acct||'').split(/[,;\s]+/)[0].replace(/\D/g,'');const j=await jf(FBU()+'/'+((mt.ver||'').trim()?(mt.ver.trim()+'/'):'')+'act_'+id+'?fields=name,currency,account_status&access_token='+encodeURIComponent((mt.tok||'').trim()));return{ok:true,info:'Conectado: '+j.name+' ('+j.currency+')',cur:j.currency}}catch(e){return{ok:false,error:String(e.message||e)}}});
ipcMain.handle('test',async(_,{v})=>{try{const r=await fetch('https://api.netlify.com/api/v1/user',{headers:{Authorization:'Bearer '+v}});return{ok:r.ok,status:r.status}}catch{return{ok:false}}});
ipcMain.handle('deploy',async(_,{token,siteId,mirror,inject,domain,ops,steps,speed})=>{try{const B='https://api.netlify.com/api/v1/',H={Authorization:'Bearer '+token},J={...H,'Content-Type':'application/json'};
const ck=async r=>{if(!r.ok)throw new Error('Netlify '+r.status+': '+(await r.text()).slice(0,200));return r.json()};
if(!siteId)siteId=(await ck(await fetch(B+'sites',{method:'POST',headers:J,body:'{}'}))).id;
const F=steps?funnelFiles(steps):siteFiles(mirror,inject,ops);let spr=null;if(speed&&speed.on){spr=await speedRun(F,{slug:'',trk:!!speed.trk,htaccess:false});if(spr&&spr.imgs)F['/_headers']=Buffer.from('/_o/*\n  Cache-Control: public, max-age=31536000, immutable\n')}
const dg={};for(const p in F)dg[p]=crypto.createHash('sha1').update(F[p]).digest('hex');
const d=await ck(await fetch(B+`sites/${siteId}/deploys`,{method:'POST',headers:J,body:JSON.stringify({files:dg})}));
const todo=Object.keys(F).filter(p=>!d.required||d.required.includes(dg[p]));
for(let i=0;i<todo.length;i+=8)await Promise.all(todo.slice(i,i+8).map(p=>fetch(B+`deploys/${d.id}/files${p.split('/').map(encodeURIComponent).join('/')}`,{method:'PUT',headers:{...H,'Content-Type':'application/octet-stream'},body:F[p]}).then(r=>{if(!r.ok)throw new Error('Upload '+r.status+' '+p)})));
if(domain){const ap=domain.replace(/^www\./i,''),apex=/^[^.]+(\.(com|net|org)\.br|\.[a-z]{2,})$/i.test(ap);await ck(await fetch(B+'sites/'+siteId,{method:'PATCH',headers:J,body:JSON.stringify({custom_domain:ap,domain_aliases:apex?['www.'+ap]:[]})}))}
const s=await ck(await fetch(B+'sites/'+siteId,{headers:H}));return{ok:true,siteId,url:(domain&&s.custom_domain)?'https://'+s.custom_domain:(s.ssl_url||s.url),host:s.name+'.netlify.app',speed:spr}}catch(e){return{ok:false,error:String(e.message||e)}}});
ipcMain.handle('domain',async(_,{token,siteId,domain})=>{try{const dns=require('dns').promises,H={Authorization:'Bearer '+token},B='https://api.netlify.com/api/v1/sites/'+siteId,ap=domain.replace(/^www\./i,''),apex=/^[^.]+(\.(com|net|org)\.br|\.[a-z]{2,})$/i.test(ap);
let s=await(await fetch(B,{headers:H})).json();if(s.custom_domain!==ap){const pr=await fetch(B,{method:'PATCH',headers:{...H,'Content-Type':'application/json'},body:JSON.stringify({custom_domain:ap,domain_aliases:apex?['www.'+ap]:[]})});if(!pr.ok)throw new Error('Netlify '+pr.status+': '+(await pr.text()).slice(0,200));s=await(await fetch(B,{headers:H})).json()}const host=s.name+'.netlify.app',tr=c=>c.replace(/\.$/,'');
const ips=await dns.resolve4(ap).catch(()=>[]),cn=await dns.resolveCname(apex?'www.'+ap:ap).catch(()=>[]);
const a=apex?ips.includes('75.2.60.5'):cn.some(c=>tr(c)==host),w=apex?cn.some(c=>tr(c)==host):true;
if(a&&!s.ssl)await fetch(B+'/ssl',{method:'POST',headers:H});s=await(await fetch(B,{headers:H})).json();
return{ok:true,cd:s.custom_domain||'',a,w,ssl:!!s.ssl,ips:ips.join(', ')||'nenhum',cn:cn.join(', ')||'nenhum'}}catch(e){return{ok:false,error:String(e.message||e)}}});

ipcMain.handle('mbk',(_,{id})=>{try{const os=opsOf(id);if(os=='[]')return{ok:true,none:true};const raw=fs.readFileSync(path.join(MD(),id,'index.html'));return{ok:true,has:!!bakeGet(id,os,raw),n:JSON.parse(os).length}}catch(e){return{ok:false,error:String(e.message)}}});
ipcMain.handle('mbake',(_,{id,bake})=>{try{const os=opsOf(id),raw=fs.readFileSync(path.join(MD(),id,'index.html'));fs.mkdirSync(BK(),{recursive:true});fs.writeFileSync(path.join(BK(),id+'.json'),JSON.stringify({k:bakeK(raw,os),bake}));return{ok:true}}catch(e){return{ok:false,error:String(e.message)}}});
ipcMain.handle('mops',(_,{id,ops})=>{try{const dir=path.join(MD(),id);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'_sl_ops.json'),JSON.stringify(ops||[]));return{ok:true}}catch(e){return{ok:false,error:String(e.message)}}});
const crcT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
const crc32=b=>{let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=crcT[(c^b[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0};
function zipBuf(F){const parts=[],cd=[];let off=0,cnt=0;for(const p in F){const name=Buffer.from(p.replace(/^\/+/,'')),raw=Buffer.from(F[p]),def=require('zlib').deflateRawSync(raw),crc=crc32(raw);const lh=Buffer.alloc(30);lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(20,4);lh.writeUInt16LE(0x0800,6);lh.writeUInt16LE(8,8);lh.writeUInt16LE(0,10);lh.writeUInt16LE(0x21,12);lh.writeUInt32LE(crc,14);lh.writeUInt32LE(def.length,18);lh.writeUInt32LE(raw.length,22);lh.writeUInt16LE(name.length,26);parts.push(lh,name,def);const ch=Buffer.alloc(46);ch.writeUInt32LE(0x02014b50,0);ch.writeUInt16LE(20,4);ch.writeUInt16LE(20,6);ch.writeUInt16LE(0x0800,8);ch.writeUInt16LE(8,10);ch.writeUInt16LE(0x21,14);ch.writeUInt32LE(crc,16);ch.writeUInt32LE(def.length,20);ch.writeUInt32LE(raw.length,24);ch.writeUInt16LE(name.length,28);ch.writeUInt32LE(off,42);cd.push(ch,name);off+=30+name.length+def.length;cnt++}const cdb=Buffer.concat(cd),eo=Buffer.alloc(22);eo.writeUInt32LE(0x06054b50,0);eo.writeUInt16LE(cnt,8);eo.writeUInt16LE(cnt,10);eo.writeUInt32LE(cdb.length,12);eo.writeUInt32LE(off,16);return Buffer.concat([...parts,cdb,eo])}
const SPA_RE=/<div\s+id=["']root["']\s*>\s*<\/div>/i,KEEP1=/^\/(favicon[^/]*|robots\.txt|placeholder\.svg|sitemap\.xml|manifest[^/]*|apple-touch-icon[^/]*|og[^/]*\.(png|jpg|webp))$/i;
function isSpaHtml(h){const mod=/<script\b[^>]*\btype=["']module["'][^>]*\bsrc=|<script\b[^>]*\bsrc=[^>]*\btype=["']module["']/i.test(h)||/<script\b[^>]*\btype=["']module["'][^>]*>[^<]*import\(\s*["']\/[^"']+\.m?js/i.test(h),abs=/["'(]\/(assets|_next|build)\/[^"')\s]+\.m?js/i.test(h);return SPA_RE.test(h)||(/<div\s+id=["']root["'][^>]*>/i.test(h)&&mod)||(mod&&abs)||/\$_TSR|__TSR__|__remixContext|__NEXT_DATA__/.test(h)}
function funnelFiles(steps){const out={};let spa=false;
for(const s of steps){const F=siteFiles(s.pid,s.inject,s.ops||null),slug=String(s.slug||'').replace(/^\/+|\/+$/g,'');let h=(F['/index.html']||Buffer.from('')).toString('utf8');delete F['/index.html'];delete F['/_redirects'];delete F['/.htaccess'];const isSpa=isSpaHtml(h);
if(slug){if(isSpa){spa=true;h=h.replace(/<head[^>]*>/i,m=>m+'<script>(function(){try{var p=location.pathname.replace(/\\/+$/,"");if(p){var q=location.search;history.replaceState(history.state,"","/?sl='+slug+'"+(q?"&"+q.slice(1):"")+location.hash)}}catch(e){}})()<\/script>')}out['/'+slug+'/index.html']=Buffer.from(h)}else out['/index.html']=Buffer.from(h);
for(const p in F){const b=F[p];if(out[p]){if(!out[p].equals(b)&&!KEEP1.test(p))throw new Error('As páginas do funil usam o mesmo arquivo '+p+' com conteúdos diferentes (etapa "'+(s.name||slug||'Front')+'"). Use páginas feitas do mesmo modelo ou me peça ajuda para separar.')}else out[p]=b;if(slug&&!isSpa){const q='/'+slug+p;if(!out[q])out[q]=b}}}
if(spa&&out['/index.html']){out['/index.html']=Buffer.from(out['/index.html'].toString('utf8').replace(/<head[^>]*>/i,m=>m+'<script>(function(){try{var m=/[?&]sl=([\\w-]+)/.exec(location.search);if(m){var r=location.search.replace(/([?&])sl=[\\w-]+&?/,"$1").replace(/[?&]$/,"");location.replace("/"+m[1]+"/"+r+location.hash)}}catch(e){}})()<\/script>'))}
if(!out['/index.html']){const f=steps.find(x=>x.slug)||{};out['/index.html']=Buffer.from('<!doctype html><meta charset=utf-8><meta http-equiv=refresh content="0;url=/'+(f.slug||'')+'/">')}
if(!out['/_redirects'])out['/_redirects']=Buffer.from('/*  /index.html  200\n');return out}
const HTA='RewriteEngine On\nRewriteBase /\nRewriteCond %{REQUEST_FILENAME} !-f\nRewriteCond %{REQUEST_FILENAME} !-d\nRewriteRule . /index.html [L]\n';
const HTC='\n# Shark Lab: o navegador e o CDN sempre confirmam se ha versao mais nova das paginas\n<IfModule mod_headers.c>\n<FilesMatch "\\.(html?|php)$">\nHeader set Cache-Control "no-cache, must-revalidate"\n</FilesMatch>\n</IfModule>\n';
function filesStatic(mirror,inject,ops,steps){const F=steps?funnelFiles(steps):siteFiles(mirror,inject,ops);delete F['/_redirects'];if(!F['/.htaccess'])F['/.htaccess']=Buffer.from(HTA+HTC);else if(!/Cache-Control/i.test(F['/.htaccess'].toString('utf8')))F['/.htaccess']=Buffer.concat([Buffer.from(F['/.htaccess']),Buffer.from(HTC)]);return F}
function pathFiles(mirror,inject,ops,slug,nr){const out=funnelFiles([{pid:mirror,slug,name:slug,inject,ops}]);delete out['/index.html'];delete out['/_redirects'];delete out['/.htaccess'];const k='/'+slug+'/index.html';if(out[k]){let h0=out[k].toString('utf8');const _a='history.replaceState(history.state,"","/?sl='+slug+'"+(q?"&"+q.slice(1):"")+location.hash)',_b='history.replaceState(history.state,"","/"+q+location.hash)';if(h0.indexOf(_a)>=0){h0=h0.replace(_a,_b);out[k]=Buffer.from(h0)}if(!nr&&h0.indexOf(_b)>=0)out[k]=Buffer.from(h0.replace(/<head[^>]*>/i,m=>m+'<script>'+prettyJs(slug)+'<\/script>'))}out['/'+slug+'/.htaccess']=Buffer.from(HTC.replace(/^\n/,''));return out}
function httpGet(u,ms,hops){return new Promise(res=>{try{const U=new URL(u),M=require(U.protocol=='http:'?'http':'https');const rq=M.get(U,{headers:{'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36','accept':'text/html,*/*','accept-encoding':'identity'},timeout:ms||12000},r=>{if(r.statusCode>=300&&r.statusCode<400&&r.headers.location&&(hops||0)<4){r.resume();return res(httpGet(new URL(r.headers.location,U).href,ms,(hops||0)+1))}const ch=[];let n=0;r.on('data',b=>{n+=b.length;if(n<6e6)ch.push(b)});r.on('end',()=>res({status:r.statusCode,server:String(r.headers.server||''),via:String(r.headers.via||'')+' '+String(r.headers['x-served-by']||''),body:Buffer.concat(ch).toString('utf8')}));r.on('error',e=>res({err:String(e.message||e)}))});rq.on('timeout',()=>{rq.destroy();res({err:'tempo esgotado'})});rq.on('error',e=>res({err:String(e.code||e.message||e)}))}catch(e){res({err:String(e.message||e)})}})}
async function liveCheck(domain,tok,gap){const d=String(domain||'').trim().replace(/\/+$/,''),B=/^https?:\/\//i.test(d)?d:'https://'+d,out={state:'net',status:0,srv:'',err:''};for(let i=0;i<4;i++){if(i)await sl(gap||3000);const a=await httpGet(B+'/_sl_pub.json?r='+Date.now()+'x'+i);if(a.err){out.state='net';out.err=a.err;continue}out.err='';out.status=a.status;out.srv=a.server;let srv=false;try{srv=JSON.parse(a.body).token===tok}catch{}if(!srv){out.state=/netlify/i.test(a.server)?'netlify':'outro';continue}const p=await httpGet(B+'/');if(p.err){out.state='net';out.err=p.err;continue}if(p.body.indexOf('sl-pub:'+tok)>=0){out.state='ok';return out}out.state='cache'}return out}
const ftpErr=e=>{const m=String(e&&e.message||e);if(/530|Login|auth/i.test(m)&&!/ENOTFOUND/.test(m))return'Usuário ou senha do FTP incorretos. Confira em hPanel > Arquivos > Contas FTP.';if(/ENOTFOUND|EAI_AGAIN/.test(m))return'Servidor FTP não encontrado. Confira o endereço do servidor.';if(/ETIMEDOUT|timeout|Timeout/i.test(m))return'O servidor FTP demorou demais para responder. Confira o servidor e a internet.';if(/ECONNREFUSED/.test(m))return'O servidor FTP recusou a conexão. Confira o servidor.';if(/SSL|TLS|certificate|handshake/i.test(m))return'Falha na conexão criptografada. Se o servidor não aceitar, desmarque "Conexão criptografada" nas configurações. Detalhe: '+m;return m};
const ftpOpts=h=>{const m=String(h.host||'').trim().match(/^(.*?)(?::(\d+))?$/);return{host:m[1],port:+m[2]||21,user:String(h.user||'').trim(),password:String(h.pass||''),secure:h.tls===0?false:true,secureOptions:{rejectUnauthorized:false}}};
ipcMain.handle('hftest',async(_,{h})=>{const ftp=require('basic-ftp'),c=new ftp.Client(30000);try{await c.access(ftpOpts(h));const dir=String(h.dir||'').trim();let ex=true;if(dir&&dir!='/'){try{await c.cd(dir)}catch{ex=false}}return{ok:true,exists:ex}}catch(e){return{ok:false,error:ftpErr(e)}}finally{c.close()}});
const ftpRetry=m=>/ECONNRESET|EPIPE|ECONNABORTED|socket|closed|ETIMEDOUT|timeout|Timeout|421|426|425/i.test(m)&&!/530|Login|auth|ENOTFOUND|ECONNREFUSED/i.test(m);
ipcMain.handle('hftp',async(_,a)=>{const st={done:new Set(),tok:crypto.randomBytes(8).toString('hex')};let last=null;for(let t=0;t<4;t++){const r=await hftpRun(a,st);if(!(r&&r.retry))return r;last=r;await new Promise(z=>setTimeout(z,1500*(t+1)))}return{ok:false,error:'A conexão com a Hostinger caiu 4 vezes seguidas ('+String(last.err&&last.err.message||last.err)+'). Os arquivos já enviados ficam no servidor; clique em Publicar de novo em alguns minutos. Se repetir, confira em hPanel > Arquivos > Contas FTP se não há limite de conexões.'}});
async function hftpRun({h,mirror,inject,ops,steps,owner,domain,force,liveGap,path:sp,mk,nr,speed},st){const ftp=require('basic-ftp'),{Readable,Writable}=require('stream'),c=new ftp.Client(60000);try{const dir=String(h.dir||'').trim().replace(/\\/g,'/');if(!dir||dir=='/')return{ok:false,error:'Informe a pasta do site no servidor (a pasta do subdomínio), nas configurações.'};const slug=String(sp||'').replace(/^\/+|\/+$/g,'');await c.access(ftpOpts(h));
if(!mk){try{await c.cd(dir)}catch{return{ok:false,noDir:dir}}}
const F=slug&&!steps?pathFiles(mirror,inject,ops,slug,nr):filesStatic(mirror,inject,ops,steps),tok=st.tok;let spr=null;if(speed&&speed.on)spr=await speedRun(F,{slug,trk:!!speed.trk});await c.ensureDir(dir);const base=(await c.pwd()).replace(/\/+$/,''),mdir=base+(slug?'/'+slug:'');
let prev=null;try{const ch=[];await c.downloadTo(new Writable({write(b,_e,cb){ch.push(b);cb()}}),mdir+'/_sl_pub.json');prev=JSON.parse(Buffer.concat(ch).toString('utf8'))}catch{}
if(!force&&prev&&prev.owner&&owner&&prev.owner!==owner.id)return{ok:false,conflict:{name:prev.name||'outro projeto',at:prev.at||0}};
if(slug){const bad=[],L={};for(const p of Object.keys(F)){if(p.startsWith('/'+slug+'/'))continue;const d=p.slice(0,p.lastIndexOf('/')),nm=p.slice(p.lastIndexOf('/')+1);if(!(d in L)){L[d]={};try{for(const e of await c.list(base+d))if(e.isFile)L[d][e.name]=e.size}catch{}}const sz=L[d][nm]===undefined?-1:L[d][nm];if(sz>=0){if(sz!==F[p].length&&!KEEP1.test(p))bad.push(p);else delete F[p]}}if(bad.length)return{ok:false,error:'Estes arquivos já existem neste domínio com conteúdo diferente (de outra página): '+bad.slice(0,4).join(', ')+(bad.length>4?' e mais '+(bad.length-4):'')+'. Publicar aqui poderia quebrar a página que já está no ar. Use uma página feita do mesmo modelo ou outro domínio.'}}
for(const p in F)if(/(^|\/)index\.html$/.test(p))F[p]=Buffer.concat([Buffer.from(F[p]),Buffer.from('\n<!--sl-pub:'+tok+'-->')]);
const ks=Object.keys(F).sort();let cur='',n=0;for(const p of ks){const rel=p.replace(/^\/+/,'').split('/'),name=rel.pop(),sub=rel.join('/');if(sub!==cur){await c.ensureDir(base+(sub?'/'+sub:''));cur=sub}if(!st.done.has(p)){await c.uploadFrom(Readable.from([Buffer.from(F[p])]),name);st.done.add(p)}n++}
await c.ensureDir(mdir);await c.uploadFrom(Readable.from([Buffer.from(JSON.stringify({token:tok,at:Date.now(),owner:owner&&owner.id||'',name:owner&&owner.name||''}))]),'_sl_pub.json');c.close();
const live=domain?await liveCheck(domain,tok,liveGap):null;return{ok:true,n,live,speed:spr}}catch(e){const m=String(e&&e.message||e);if(ftpRetry(m))return{retry:1,err:e};return{ok:false,error:ftpErr(e)}}finally{c.close()}}


// ===== Clonagem completa (v49) =====
/* Shark Lab - completa a clonagem: baixa tudo o que a pagina usa e a captura nao pegou
   (fotos de carrossel que so carregam depois, imagens que ficam dentro do JavaScript, fundos do CSS,
   imagens hospedadas em outro endereco). Igual no computador e no celular.
   E = { get(url) -> {status,u8,type}|null }  (sem limite de CORS)
   F = { '/caminho': Uint8Array }  (arquivos ja capturados do mesmo endereço) */
function makeCloneFix(E){
  const te=new TextEncoder(),td=new TextDecoder();
  const MEDIA='png|jpe?g|gif|webp|avif|svg|ico|bmp|mp4|webm|mov|m4v|woff2?|ttf|otf|eot|mp3|ogg|wav';
  const TXT=/\.(html?|css|m?js|json|svg|webmanifest|xml)$/i;
  const MIMEX={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif','image/svg+xml':'svg','image/x-icon':'ico','image/vnd.microsoft.icon':'ico','video/mp4':'mp4','video/webm':'webm','font/woff2':'woff2','font/woff':'woff','audio/mpeg':'mp3'};
  const sha8=async s=>{const d=await crypto.subtle.digest('SHA-1',te.encode(s));return [...new Uint8Array(d)].slice(0,4).map(x=>x.toString(16).padStart(2,'0')).join('')};
  const dec=s=>{try{return decodeURIComponent(s)}catch{return s}};
  async function complete(F,origin,opt){
    opt=opt||{};const rep={added:0,bytes:0,failed:[],ext:0};
    const O=new URL(origin).origin,cap=opt.maxBytes||250*1048576;let total=0;
    const textFiles=()=>Object.keys(F).filter(p=>TXT.test(p));
    const texts={};for(const p of textFiles())texts[p]=td.decode(F[p]);
    const cand=new Map(); /* url absoluta -> {kind:'same'|'ext'|'dyn'} */
    const add=(u,base,force)=>{
      u=String(u||'').trim().replace(/&amp;/g,'&').replace(/\\\//g,'/');
      if(!u||/^(data:|blob:|javascript:|#|about:|mailto:|tel:)/i.test(u))return;
      let a;try{a=new URL(u,base)}catch{return}if(!/^https?:$/.test(a.protocol))return;a.hash='';
      const isDyn=/\/_next\/image$/i.test(a.pathname)&&a.search;
      if(!isDyn&&!new RegExp('\\.('+MEDIA+')$','i').test(dec(a.pathname))&&!(force&&a.origin!=O))return;
      if(/(^|\.)(facebook\.com|facebook\.net|google-analytics\.com|googletagmanager\.com|doubleclick\.net|clarity\.ms|hotjar\.com|tiktok\.com)$/i.test(a.hostname))return;
      cand.set(a.href,a.origin==O?(isDyn?'dyn':'same'):'ext');
    };
    const base=O+'/';
    const scan=()=>{
      for(const p in texts){
        const t=texts[p],pageUrl=O+p;
        if(/\.html?$/i.test(p)){
          const re=/\b(?:src|poster|data-[\w-]*(?:src|bg|background|image|poster)[\w-]*|href|content)\s*=\s*("([^"]*)"|'([^']*)')/gi;let m;
          while((m=re.exec(t)))add(m[2]!==undefined?m[2]:m[3],pageUrl);
          const rs=/\b(?:srcset|data-[\w-]*srcset)\s*=\s*("([^"]*)"|'([^']*)')/gi;
          while((m=rs.exec(t)))for(const part of String(m[2]!==undefined?m[2]:m[3]).split(','))add(part.trim().split(/\s+/)[0],pageUrl);
          const us=/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;while((m=us.exec(t)))add(m[2],pageUrl,true);
          const tg=/<(?:img|source|video|audio|input|image)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;let mt;
          while((mt=tg.exec(t))){const ar=/\b(?:src|poster|data-[\w-]+)\s*=\s*("([^"]*)"|'([^']*)')/gi;let ma;while((ma=ar.exec(mt[0])))add(ma[2]!==undefined?ma[2]:ma[3],pageUrl,true);
            const sr=/\b(?:srcset|data-[\w-]*srcset)\s*=\s*("([^"]*)"|'([^']*)')/gi;while((ma=sr.exec(mt[0])))for(const part of String(ma[2]!==undefined?ma[2]:ma[3]).split(','))add(part.trim().split(/\s+/)[0],pageUrl,true)}
        }else if(/\.css$/i.test(p)){
          const us=/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;let m;while((m=us.exec(t)))add(m[2],pageUrl,true);
        }
        /* textos dentro de JS/JSON/HTML: enderecos completos e caminhos que comecam com / */
        const tt=t.replace(/\\\//g,'/');
        const ab=new RegExp('(?:https?:)?//[^\\s"\'`()<>\\\\,;]+?\\.(?:'+MEDIA+')(?:\\?[^\\s"\'`()<>\\\\,;]*)?(?=["\'`()<>\\\\,;\\s]|$)','gi');let m2;
        while((m2=ab.exec(tt))){let u=m2[0];if(u.startsWith('//'))u='https:'+u;add(u,pageUrl)}
        const rl=new RegExp('["\'`(=]((?:/(?!/)[^\\s"\'`()<>\\\\,;]*?)\\.(?:'+MEDIA+')(?:\\?[^\\s"\'`()<>\\\\,;]*)?)(?=["\'`)])','gi');
        while((m2=rl.exec(tt)))add(m2[1],O+'/');
        if(/\.(m?js|json|html?)$/i.test(p)){const di=/[\\"'`(]((?:\/_next\/image)\?[^\s"'`()<>\\]+)/g;while((m2=di.exec(tt)))add(m2[1],O+'/')}
      }
      for(const u of(opt.extra||[]))add(u,base);
    };
    scan();
    const done=new Set(),fixes=[];/* [textoOriginal, caminhoLocal] */
    for(let pass=0;pass<2;pass++){
      const todo=[...cand.entries()].filter(([u])=>!done.has(u));if(!todo.length)break;
      let i=0;
      const work=async([u,kind])=>{
        done.add(u);const a=new URL(u);let lp=null;
        if(kind=='same'){lp=dec(a.pathname);if(F[lp])return}
        else{
          const nm=(dec(a.pathname).split('/').pop()||'arq').replace(/[^A-Za-z0-9._-]+/g,'-').slice(-60);lp='/_x/'+(kind=='dyn'?'d':'')+await sha8(u)+(kind=='dyn'?'':'-'+nm);
        }
        if(total>=cap){rep.failed.push(u);return}
        let r=null;try{r=await E.get(u)}catch{}
        if(!r||r.status<200||r.status>=300||!r.u8||!r.u8.length){rep.failed.push(u);return}
        if(r.u8.length>(/\.(mp4|webm|mov|m4v)$/i.test(a.pathname)?60:25)*1048576){rep.failed.push(u);return}
        if(kind!='same'){const t=String(r.type||'').split(';')[0].trim().toLowerCase();if(!/\.[a-z0-9]{2,5}$/i.test(lp)){const ex=MIMEX[t];if(!ex){rep.failed.push(u);return}lp+='.'+ex}if(kind=='dyn'&&!/^image\//.test(t)){rep.failed.push(u);return}}
        total+=r.u8.length;F[lp]=r.u8;rep.added++;rep.bytes+=r.u8.length;if(kind!='same'){rep.ext++;fixes.push([u,lp])}
      };
      const pool=async()=>{while(i<todo.length){const it=todo[i++];try{await work(it)}catch(e){rep.failed.push(it[0])}}};
      await Promise.all([pool(),pool(),pool(),pool(),pool(),pool()]);
      /* arquivos novos (CSS/JS) podem citar mais coisas */
      let more=false;for(const p of Object.keys(F)){if(TXT.test(p)&&texts[p]===undefined){texts[p]=td.decode(F[p]);more=true}}
      if(!more)break;scan();
    }
    /* troca os enderecos de fora (e /_next/image) pelos arquivos locais */
    if(fixes.length){
      const forms=(u)=>{const a=new URL(u),out=new Set([u,u.replace(/&/g,'&amp;'),u.replace(/\//g,'\\/'),u.replace(/^https?:/,''),u.replace(/^https?:/,'').replace(/\//g,'\\/')]);
        if(a.origin==O){const rel=a.pathname+a.search;out.add(rel);out.add(rel.replace(/&/g,'&amp;'));out.add(rel.replace(/\//g,'\\/'))}return [...out]};
      const all=[];for(const [u,lp] of fixes)for(const f of forms(u))all.push([f,lp]);
      all.sort((x,y)=>y[0].length-x[0].length);
      for(const p of Object.keys(texts)){
        let t=texts[p],n=t;
        for(const [f,lp] of all){if(n.indexOf(f)>=0)n=n.split(f).join(f.indexOf('\\/')>=0?lp.replace(/\//g,'\\/'):lp)}
        if(n!==t){F[p]=te.encode(n);texts[p]=n}
      }
    }
    rep.failed=rep.failed.slice(0,30);
    return rep;
  }
  return{complete};
}


// ===== Velocidade (v49) =====
/* Shark Lab - otimizador de velocidade das paginas publicadas (igual no computador e no celular).
   Trabalha sobre o conjunto de arquivos que vai ser publicado (F = {caminho: bytes}); nunca mexe nos originais.
   E = { enc(u8,mime,maxW,q) -> {u8,w,h}|null, sha1(u8) -> hex, cacheGet(key), cachePut(key,u8) } */
function makeSpeed(E){
  const te=new TextEncoder(),td=new TextDecoder();
  const hex8=s=>String(s).slice(0,8);
  const BIGW=1600,Q=0.8;
  /* ---------- tamanho das imagens pelo cabecalho ---------- */
  function dims(u,p){
    try{
      if(/\.png$/i.test(p)&&u.length>24&&u[0]==0x89&&u[1]==0x50)return{w:(u[16]<<24|u[17]<<16|u[18]<<8|u[19])>>>0,h:(u[20]<<24|u[21]<<16|u[22]<<8|u[23])>>>0};
      if(/\.jpe?g$/i.test(p)&&u[0]==0xFF&&u[1]==0xD8){let i=2;while(i<u.length-9){if(u[i]!=0xFF){i++;continue}const m=u[i+1];if(m==0xFF){i++;continue}if(m>=0xC0&&m<=0xCF&&m!=0xC4&&m!=0xC8&&m!=0xCC)return{h:u[i+5]<<8|u[i+6],w:u[i+7]<<8|u[i+8]};if(m==0xD8||m==0x01||(m>=0xD0&&m<=0xD7)){i+=2;continue}i+=2+(u[i+2]<<8|u[i+3])}}
      if(/\.gif$/i.test(p)&&u[0]==0x47)return{w:u[6]|u[7]<<8,h:u[8]|u[9]<<8};
      if(/\.webp$/i.test(p)&&u[0]==0x52&&u[8]==0x57){const t=String.fromCharCode(u[12],u[13],u[14],u[15]);if(t=='VP8X')return{w:1+(u[24]|u[25]<<8|u[26]<<16),h:1+(u[27]|u[28]<<8|u[29]<<16)};if(t=='VP8 ')return{w:(u[26]|u[27]<<8)&0x3fff,h:(u[28]|u[29]<<8)&0x3fff};if(t=='VP8L'){const b=u[21]|u[22]<<8|u[23]<<16|u[24]<<24;return{w:1+(b&0x3fff),h:1+((b>>14)&0x3fff)}}}
    }catch{}
    return null;
  }
  /* ---------- etiquetas HTML ---------- */
  const TAG_IMG=/<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
  const ATTR=/([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`=]+)))?/g;
  function parseTag(t){
    const m=/^<([A-Za-z][A-Za-z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>$/.exec(t);if(!m)return null;
    const a=[];ATTR.lastIndex=0;let r;const s=m[2];while((r=ATTR.exec(s))){a.push([r[1],r[2]!==undefined?r[2]:r[3]!==undefined?r[3]:r[4]!==undefined?r[4]:null])}
    return{n:m[1],a,sc:m[3]};
  }
  const ser=t=>'<'+t.n+t.a.map(x=>' '+x[0]+(x[1]===null?'':'="'+String(x[1]).replace(/"/g,'&quot;')+'"')).join('')+(t.sc?' /':'')+'>';
  const getA=(t,k)=>{k=k.toLowerCase();for(const x of t.a)if(x[0].toLowerCase()==k)return x[1];return undefined};
  const hasA=(t,k)=>getA(t,k)!==undefined;
  const setA=(t,k,v)=>{const l=k.toLowerCase();for(const x of t.a)if(x[0].toLowerCase()==l){x[1]=v;return}t.a.push([k,v])};
  /* ---------- caminhos ---------- */
  const dirOf=p=>p.slice(0,p.lastIndexOf('/')+1);
  function norm(p){const out=[];for(const s of p.split('/')){if(s==''||s=='.')continue;if(s=='..'){out.pop();continue}out.push(s)}return '/'+out.join('/')}
  function resolve(from,ref){
    ref=String(ref||'').trim();if(!ref||/^(data:|blob:|https?:|\/\/|#|mailto:|tel:|javascript:)/i.test(ref))return null;
    ref=ref.split('#')[0].split('?')[0];let p=ref[0]=='/'?norm(ref):norm(dirOf(from)+ref);
    return p;
  }
  function relPath(fromFile,to){
    const a=dirOf(fromFile).split('/').filter(Boolean),b=to.split('/').filter(Boolean),f=b.pop();let i=0;while(i<a.length&&i<b.length&&a[i]==b[i])i++;
    return '../'.repeat(a.length-i)+b.slice(i).concat([f]).join('/');
  }
  const KEEP_EXT=/\.(jpe?g|png)$/i;
  /* ---------- a funcao principal ---------- */
  async function apply(F,o){
    o=o||{};const rep={imgs:0,from:0,to:0,files:0,notes:[]};
    const slug=String(o.slug||'').replace(/^\/+|\/+$/g,''),base=slug?'/'+slug:'';
    const keys=Object.keys(F),isHtml=p=>/\.html?$/i.test(p),isCss=p=>/\.css$/i.test(p),isJs=p=>/\.m?js$/i.test(p);
    const inScope=p=>!base||p.startsWith(base+'/');
    const T={};for(const p of keys)if(inScope(p)&&(isHtml(p)||isCss(p)||isJs(p)))T[p]=td.decode(F[p]);const changed=new Set();
    const info={};
    for(const p of keys){if(/\.(jpe?g|png|gif|webp)$/i.test(p)){const d=dims(F[p],p);if(d)info[p]=Object.assign(d,{size:F[p].length})}}
    /* 1) quais imagens sao usadas e como */
    const used=new Set();
    const URLRE=/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
    const scan=(text,from,kind)=>{
      if(kind=='js'){const re=/["'](\/[^"'\s?#\\]+\.(?:jpe?g|png))["']/gi;let m;while((m=re.exec(text))){const r=resolve(from,m[1]);if(r&&info[r])used.add(r)}return}
      let m;URLRE.lastIndex=0;while((m=URLRE.exec(text))){const r=resolve(from,m[2]);if(r&&info[r])used.add(r)}
      if(kind=='html'){const re=/\b(?:src|poster|data-src|data-lazy-src)\s*=\s*("([^"]*)"|'([^']*)')/gi;while((m=re.exec(text))){const r=resolve(from,m[2]!==undefined?m[2]:m[3]);if(r&&info[r])used.add(r)}
        const rs=/\bsrcset\s*=\s*("([^"]*)"|'([^']*)')/gi;while((m=rs.exec(text))){for(const part of String(m[2]!==undefined?m[2]:m[3]).split(',')){const r=resolve(from,part.trim().split(/\s+/)[0]);if(r&&info[r])used.add(r)}}}
    };
    for(const p in T)scan(T[p],p,isHtml(p)?'html':isCss(p)?'css':'js');
    /* 2) gera as versoes leves */
    const conv={};
    const cands=[...used].filter(p=>KEEP_EXT.test(p)&&info[p]&&info[p].size>=6000&&!/\/_o\//.test(p));
    let cursor=0;
    const work=async p=>{
      const u=F[p],d=info[p],mime=/\.png$/i.test(p)?'image/png':'image/jpeg',sh=hex8(await E.sha1(u));
      const W=Math.min(d.w||BIGW,BIGW),ws=[];[480,960].forEach(x=>{if(x<W*0.85)ws.push(x)});ws.push(W);
      const stem=(p.split('/').pop().replace(/\.[^.]+$/,'').replace(/[^A-Za-z0-9_-]+/g,'-').slice(0,40)||'img');
      const vs=[];
      for(const w of ws){
        const q=mime=='image/png'?0.85:Q,key='sp1-'+sh+'-'+w+'-'+Math.round(q*100);let out=E.cacheGet?await E.cacheGet(key):null,ow=null,oh=null;
        if(out){const dd=dims(out,'x.webp');if(dd){ow=dd.w;oh=dd.h}}
        if(!out){const r=await E.enc(u,mime,w,q);if(!r)return;out=r.u8;ow=r.w;oh=r.h;if(E.cachePut)await E.cachePut(key,out)}
        vs.push({w:ow||w,h:oh,u8:out,name:stem+'.'+sh+'-'+w+'.webp'});
      }
      const big=vs[vs.length-1];
      if(!(big.u8.length<u.length*0.9))return; /* nao compensa: fica o original */
      conv[p]={vs:vs.filter(v=>v===big||v.u8.length<big.u8.length*0.95),big,w0:d.w,h0:d.h};
    };
    const pool=async()=>{while(cursor<cands.length){const p=cands[cursor++];try{await work(p)}catch(e){rep.notes.push('imagem '+p+': '+String(e&&e.message||e).slice(0,80))}}};
    await Promise.all([pool(),pool()]);
    const outDir=(base||'')+'/_o/';
    for(const p in conv){const c=conv[p];c.vs.forEach(v=>{v.path=outDir+v.name;F[v.path]=v.u8});c.big.path=outDir+c.big.name;F[c.big.path]=c.big.u8;rep.imgs++;rep.from+=F[p].length;rep.to+=c.big.u8.length}
    if(rep.imgs){const hta=outDir+'.htaccess';F[hta]=te.encode('# Shark Lab: arquivos otimizados nunca mudam de conteudo, entao podem ficar em cache por 1 ano\n<IfModule mod_headers.c>\nHeader set Cache-Control "public, max-age=31536000, immutable"\n</IfModule>\n<IfModule mod_mime.c>\nAddType image/webp .webp\n</IfModule>\n')}
    const toRef=(from,orig,newAbs)=>orig[0]=='/'?newAbs:relPath(from,newAbs);
    /* 3) reescreve CSS e JS */
    const BGR={}; /* regras de fundo por arquivo/bloco: [{sel,c}] */
    const cssProc=(text,from,key)=>{
      let t=text.replace(URLRE,(m,q,r)=>{const a=resolve(from,r);const c=a&&conv[a];if(!c)return m;return 'url('+q+toRef(from,r.trim(),c.big.path)+q+')'});
      t=t.replace(/@font-face\s*\{[^}]*\}/gi,b=>/font-display\s*:/i.test(b)?b:b.replace(/\}$/,';font-display:swap}'));
      /* fundos de tela cheia: no celular carrega a versao menor (so regras de nivel zero, uma imagem so, sem gradiente) */
      const rules=[],ov=[];let depth=0,st=0,selStart=0,i=0;
      const mk=(sel,body)=>{
        sel=sel.trim();if(!sel||sel[0]=='@')return;
        if(/gradient|image-set/i.test(body)||(body.match(/url\(/gi)||[]).length!=1)return;
        const dm=/(?:^|;)\s*(background(?:-image)?)\s*:([^;]*)/i.exec(body);if(!dm)return;
        const um=/url\(\s*(['"]?)([^'")]+)\1\s*\)/i.exec(dm[2]);if(!um)return;
        const bigAbs=resolve(from,um[2]);if(!bigAbs)return;
        let c=null;for(const k in conv)if(conv[k].big.path==bigAbs){c=conv[k];break}
        if(!c)return;rules.push({sel,c});
        const imp=/!important/i.test(dm[2])?' !important':'';
        const v9=c.vs.find(v=>v.w>=900&&v!==c.big),v4=c.vs.find(v=>v.w>=400&&v.w<900);
        if(v9)ov.push('@media(max-width:900px){'+sel+'{background-image:url('+toRef(from,um[2].trim(),v9.path)+')'+imp+'}}');
        if(v4)ov.push('@media(max-width:480px){'+sel+'{background-image:url('+toRef(from,um[2].trim(),v4.path)+')'+imp+'}}');
      };
      for(i=0;i<t.length;i++){const ch=t[i];if(ch=='{'){if(depth==0)st=i;depth++}else if(ch=='}'){depth--;if(depth==0)mk(t.slice(selStart,st),t.slice(st+1,i));if(depth<=0){depth=0;selStart=i+1}}}
      BGR[key]=rules;
      if(ov.length)t+='\n/* Shark Lab */\n'+ov.join('\n')+'\n';
      return t;
    };
    for(const p in T){
      if(!isCss(p)&&!isJs(p))continue;let t=T[p],n=t;
      if(isCss(p))n=cssProc(t,p,p);
      else if(rep.imgs){n=t.replace(/(["'])(\/[^"'\s?#\\]+\.(?:jpe?g|png))\1/gi,(m,q,r)=>{const c=conv[norm(r)];return c?q+c.big.path+q:m})}
      if(n!==t){F[p]=te.encode(n);T[p]=n;rep.files++;changed.add(p)}
    }
    /* 4) reescreve as paginas HTML */
    let hasAuto=false;for(const p in T){if(isCss(p)&&/\b(img|video)\b[^{}]*\{[^}]*height\s*:\s*auto/i.test(T[p]))hasAuto=true;if(isHtml(p)&&/<style[^>]*>[^<]*\bimg\b[^{}]*\{[^}]*height\s*:\s*auto/i.test(T[p]))hasAuto=true}
    for(const p of Object.keys(T)){
      if(!isHtml(p))continue;let h=T[p];const o0=h;let sb=0;
      h=h.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,(m,a,b,c2)=>a+cssProc(b,p,p+'#s'+(sb++))+c2);
      /* trechos que nao podem ser tocados: scripts, noscript, comentarios e picture */
      const frozen=[];const hold=re=>{h=h.replace(re,m=>{frozen.push(m);return '\u0000'+(frozen.length-1)+'\u0001'})};
      hold(/<!--[\s\S]*?-->/g);hold(/<script\b[\s\S]*?<\/script>/gi);hold(/<noscript\b[\s\S]*?<\/noscript>/gi);
      const pics=[];h.replace(/<picture\b[\s\S]*?<\/picture>/gi,(m,i)=>{pics.push([i,i+m.length]);return m});
      let seen=0,first=null;
      h=h.replace(TAG_IMG,(tag,pos)=>{
        const t=parseTag(tag);if(!t)return tag;
        const src=getA(t,'src');if(src==null)return tag;
        const inPic=pics.some(x=>pos>=x[0]&&pos<x[1]);
        const a=resolve(p,src),c=a&&conv[a],inf=a&&info[a];
        const isData=/^data:/i.test(src)||/\.svg(\?|#|$)/i.test(src);
        if(c&&!inPic&&!hasA(t,'srcset')){
          const w=parseInt(getA(t,'width'),10);
          setA(t,'srcset',c.vs.map(v=>toRef(p,src,v.path)+' '+v.w+'w').join(', '));
          setA(t,'sizes',w>0&&w<1600?'(max-width: '+w+'px) 100vw, '+w+'px':'100vw');
          setA(t,'src',toRef(p,src,c.big.path));
        }else if(c){setA(t,'src',toRef(p,src,c.big.path))}
        else if(hasA(t,'srcset')){
          const ss=getA(t,'srcset').split(',').map(x=>{const q=x.trim().split(/\s+/),r=resolve(p,q[0]),cc=r&&conv[r];if(!cc)return x.trim();const dw=/^(\d+)w$/.exec(q[1]||'');let v=cc.big;if(dw){const need=+dw[1];v=cc.vs.find(z=>z.w>=need)||cc.big}return toRef(p,q[0],v.path)+(q[1]?' '+q[1]:'')});
          setA(t,'srcset',ss.join(', '));
        }
        const nat=c?{w:c.w0,h:c.h0}:inf;
        if(hasAuto&&!inPic&&nat&&nat.w>0&&nat.h>0&&!hasA(t,'width')&&!hasA(t,'height')&&!/(^|;)\s*(width|height)\s*:/i.test(getA(t,'style')||'')){setA(t,'width',String(nat.w));setA(t,'height',String(nat.h))}
        if(!isData){
          seen++;
          const tiny=nat&&nat.w<=120&&nat.h<=120;
          if(seen<=3){
            if(!hasA(t,'loading'))setA(t,'loading','eager');
            if(!first&&!tiny){first=t;if(!hasA(t,'fetchpriority'))setA(t,'fetchpriority','high')}
          }else if(!hasA(t,'loading'))setA(t,'loading','lazy');
          if(!hasA(t,'decoding'))setA(t,'decoding','async');
        }
        if(t===first)first={t,pos};
        return ser(t);
      });
      /* fundo de tela cheia que aparece antes de qualquer <img>: tambem entra antes na fila */
      let bgPre='';
      {
        const links=[];h.replace(/<link\b[^>]*rel=["']?stylesheet[^>]*>/gi,m=>{const mh=/href=["']([^"']+)["']/i.exec(m);if(mh){const r=resolve(p,mh[1]);if(r)links.push(r)}return m});
        const cand=[];for(const k of links)for(const r of(BGR[k]||[]))cand.push(r);for(let q=0;q<sb;q++)for(const r of(BGR[p+'#s'+q]||[]))cand.push(r);
        let best=null,bi=1e9;
        for(const r of cand){const m=/^([.#])([A-Za-z0-9_-]+)$/.exec(r.sel);if(!m)continue;const re=m[1]=='.'?new RegExp('class=["\'][^"\']*\\b'+m[2]+'\\b'):new RegExp('id=["\']'+m[2]+'["\']');const bd=h.search(/<body/i),ix=h.slice(Math.max(bd,0)).search(re);if(ix>=0&&ix<bi){bi=ix;best=r}}
        const fi=h.slice(Math.max(h.search(/<body/i),0)).search(/<img\b/i);
        if(best&&(fi<0||bi<fi)){const c=best.c,v9=c.vs.find(v=>v.w>=900&&v!==c.big),v4=c.vs.find(v=>v.w>=400&&v.w<900);
          const L=(u,md)=>'<link rel="preload" as="image" href="'+u+'" media="'+md+'" fetchpriority="high">';
          const bp=best.c.big.path;
          bgPre=(v4?L(toRef(p,'x',v4.path),'(max-width:480px)'):'')+(v9?L(toRef(p,'x',v9.path),v4?'(min-width:481px) and (max-width:900px)':'(max-width:900px)'):'')+L(toRef(p,'x',bp),(v9||v4)?'(min-width:901px)':'all');
        }
      }
      /* preload da primeira imagem grande */
      let pre='';
      if(first&&first.t){const t=first.t,sr=getA(t,'srcset'),sz=getA(t,'sizes'),sc=getA(t,'src');if(sc&&!/^data:/i.test(sc))pre='<link rel="preload" as="image" href="'+sc+'"'+(sr?' imagesrcset="'+sr.replace(/"/g,'&quot;')+'"'+(sz?' imagesizes="'+sz.replace(/"/g,'&quot;')+'"':''):'')+' fetchpriority="high">'}
      /* imagens citadas em style="" e poster */
      h=h.replace(URLRE,(m,q,r)=>{const a=resolve(p,r),c=a&&conv[a];return c?'url('+q+toRef(p,r.trim(),c.big.path)+q+')':m});
      h=h.replace(/(\bposter\s*=\s*)("([^"]*)"|'([^']*)')/gi,(m,k,v,d1,d2)=>{const r=d1!==undefined?d1:d2,a=resolve(p,r),c=a&&conv[a];return c?k+'"'+toRef(p,r,c.big.path)+'"':m});
      /* iframes (menos o primeiro) so carregam quando chegam perto */
      let ifr=0;h=h.replace(/<iframe\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi,tag=>{ifr++;if(ifr==1)return tag;const t=parseTag(tag);if(!t||hasA(t,'loading'))return tag;setA(t,'loading','lazy');return ser(t)});
      /* css do Google Fonts nao trava mais a pagina */
      const gf=[];
      h=h.replace(/<link\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi,tag=>{
        const t=parseTag(tag);if(!t)return tag;const href=getA(t,'href')||'',rel=(getA(t,'rel')||'').toLowerCase();
        if(rel=='stylesheet'&&/^https:\/\/fonts\.googleapis\.com\//i.test(href)&&!hasA(t,'media')){
          let u=href;if(!/[?&]display=/.test(u))u+=(u.indexOf('?')>=0?'&':'?')+'display=swap';setA(t,'href',u);setA(t,'media','print');setA(t,'onload',"this.media='all'");
          gf.push('<noscript><link rel="stylesheet" href="'+u+'"></noscript>');return ser(t)+gf[gf.length-1]}
        return tag});
      /* conexoes antecipadas */
      const hosts=[];const addH=(u,cors)=>{try{const x=new URL(u);if(x.protocol!='https:')return;if(!hosts.some(z=>z[0]==x.origin))hosts.push([x.origin,cors])}catch{}};
      if(/fonts\.googleapis\.com/i.test(h)){addH('https://fonts.googleapis.com',false);addH('https://fonts.gstatic.com',true)}
      const ex=/<(?:img|video|source)\b[^>]*\b(?:src|poster)\s*=\s*["'](https:\/\/[^"']+)["']/gi;let em,nn=0;while((em=ex.exec(h))&&nn<2){addH(em[1],false);nn++}
      let head='';
      if(hosts.length&&!/rel=["']preconnect["']/i.test(h))head+=hosts.slice(0,4).map(x=>'<link rel="preconnect" href="'+x[0]+'"'+(x[1]?' crossorigin':'')+'>').join('');
      head+=bgPre+pre;
      /* editor invisivel: sem edicoes nao precisa carregar o motor de edicao */
      let strip=false;
      for(const k in frozen){}
      h=h.replace(/\u0000(\d+)\u0001/g,(m,i)=>frozen[+i]);
      const mp=/<script>window\.__SL_OPS=\[\]<\/script><script>\(function\(\)\{if\(window\.__SL_P\)return;[\s\S]*?<\/script>/;
      if(mp.test(h)){h=h.replace(mp,'');strip=true}
      /* atrasa rastreadores (so se o usuario ligou) */
      if(o.trk){
        const TRK=/connect\.facebook\.net|fbevents|googletagmanager\.com|google-analytics\.com|\bgtag\(|clarity\.ms|hotjar|analytics\.tiktok|snap\.licdn|utmify|static\.ads-twitter|pinimg\.com\/ct/i;let any=false;
        h=h.replace(/<script\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/script>/gi,(m,at,body)=>{if(/\btype\s*=\s*["']?(?!text\/javascript|module)[^"'\s>]*/i.test(at)&&!/\btype\s*=\s*["']?text\/javascript/i.test(at))return m;if(!TRK.test(at)&&!TRK.test(body))return m;any=true;return '<script'+at.replace(/\btype\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i,'')+' type="sl/delay">'+body+'</script>'});
        if(any)head+='<script>(function(){var d=0;function go(){if(d)return;d=1;var l=document.querySelectorAll(\'script[type="sl/delay"]\');for(var i=0;i<l.length;i++){var o=l[i],n=document.createElement("script");for(var j=0;j<o.attributes.length;j++){var a=o.attributes[j];if(a.name!="type")n.setAttribute(a.name,a.value)}n.text=o.text;o.parentNode.replaceChild(n,o)}}["scroll","mousemove","touchstart","click","keydown"].forEach(function(e){addEventListener(e,go,{once:true,passive:true})});addEventListener("load",function(){setTimeout(go,12000)})})()<\/script>';
      }
      if(head){
        /* depois do <meta charset> (precisa ficar nos 1024 primeiros bytes) e do <meta viewport> (o navegador so conhece a largura da tela depois dele) */
        const hd=/<head[^>]*>/i.exec(h),hi=hd?hd.index+hd[0].length:0,hend=(()=>{const e=h.search(/<\/head>/i);return e<0?h.length:e})();
        let at=hi;
        const mc=/<meta\b[^>]*charset[^>]*>/i.exec(h),mv=/<meta\b[^>]*name\s*=\s*["']?viewport[^>]*>/i.exec(h);
        if(mc&&mc.index>=hi&&mc.index<hend)at=Math.max(at,mc.index+mc[0].length);
        if(mv&&mv.index>=hi&&mv.index<hend)at=Math.max(at,mv.index+mv[0].length);
        h=h.slice(0,at)+head+h.slice(at)}
      if(changed.size)h=h.replace(/<(?:script|link)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi,tag=>{if(!/\bintegrity\s*=/i.test(tag))return tag;const t=parseTag(tag);if(!t)return tag;const u=getA(t,'src')||getA(t,'href'),r=u&&resolve(p,u);if(!r||!changed.has(r))return tag;t.a=t.a.filter(x=>x[0].toLowerCase()!='integrity');return ser(t)});
      if(h!==o0){F[p]=te.encode(h);T[p]=h;rep.files++}
    }
    /* 5) compressao e cache (Hostinger / Apache / LiteSpeed) */
    const ha=(base||'')+'/.htaccess';
    if(o.htaccess!==false&&F[ha]){
      const cur=td.decode(F[ha]);
      if(!/Shark Lab: velocidade/.test(cur))F[ha]=te.encode(cur+'\n# Shark Lab: velocidade\n<IfModule mod_deflate.c>\nAddOutputFilterByType DEFLATE text/html text/plain text/css text/javascript application/javascript application/x-javascript application/json application/xml image/svg+xml font/ttf font/otf application/vnd.ms-fontobject\n</IfModule>\n<IfModule mod_brotli.c>\nAddOutputFilterByType BROTLI_COMPRESS text/html text/plain text/css text/javascript application/javascript application/json application/xml image/svg+xml\n</IfModule>\n<IfModule mod_headers.c>\n<FilesMatch "\\.(woff2?|ttf|otf|eot)$">\nHeader set Cache-Control "public, max-age=2592000"\n</FilesMatch>\n<FilesMatch "\\.(webp|avif|jpe?g|png|gif|svg|ico)$">\nHeader set Cache-Control "public, max-age=604800"\n</FilesMatch>\n<FilesMatch "\\.(js|css)$">\nHeader set Cache-Control "public, max-age=14400"\n</FilesMatch>\n<FilesMatch "[-.][0-9a-f]{8,}\\.(js|css|woff2?|webp|avif|jpe?g|png|svg)$">\nHeader set Cache-Control "public, max-age=31536000, immutable"\n</FilesMatch>\n</IfModule>\n')}
    return rep;
  }
  return{apply,dims,_parseTag:parseTag};
}
/* Garante que o navegador leia os acentos certo, em qualquer servidor: declara UTF-8 como a primeira coisa da pagina */
function fixCharset(h){
  if(h.indexOf('\uFFFD')>=0)return h;
  let other=false;
  const h2=h.replace(/<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi,m=>{
    if(!/charset\s*=|http-equiv\s*=\s*["']?content-type/i.test(m))return m;
    const cs=/charset\s*=\s*["']?\s*([\w-]+)/i.exec(m);
    if(cs&&!/^utf-?8$/i.test(cs[1])){other=true;return m}
    return '';
  });
  if(other)return h;
  const meta='<meta charset="utf-8">';
  if(/<head[^>]*>/i.test(h2))return h2.replace(/<head[^>]*>/i,m=>m+meta);
  if(/<html[^>]*>/i.test(h2))return h2.replace(/<html[^>]*>/i,m=>m+'<head>'+meta+'</head>');
  const dt=/^\s*<!doctype[^>]*>/i.exec(h2);if(dt)return h2.slice(0,dt[0].length)+meta+h2.slice(dt[0].length);
  return meta+h2;
}
/* texto de edicao com acento vira \uXXXX, assim nao depende de como o navegador adivinha a codificacao */
const asciiJs=s=>String(s).replace(/[\u0080-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
/* Endereco bonito (/pagina/) sem quebrar os botoes: links de ancora (#secao) rolam ate a secao sem acordar o roteador do site (que daria 404) */
function prettyJs(slug){
  return '(function(){var SP='+JSON.stringify('/'+slug+'/')+',P=History.prototype.replaceState;function bs(){return location.pathname+location.search}var last=bs();'
  +'function pretty(){try{if(location.pathname!=SP){P.call(history,history.state,"",SP+location.search.replace(/([?&])sl=[^&]*&?/,"$1").replace(/[?&]$/,"")+location.hash);last=bs()}}catch(e){}}'
  +'addEventListener("load",function(){setTimeout(pretty,400)});'
  +'function go(h){var id="";try{id=decodeURIComponent(h)}catch(e){id=h}var t=id?(document.getElementById(id)||document.getElementsByName(id)[0]):null;if(id&&!t)return false;try{if(t)t.scrollIntoView({behavior:"smooth",block:"start"});else scrollTo({top:0,behavior:"smooth"})}catch(e){}try{P.call(history,history.state,"",location.pathname+location.search+(id?"#"+h:""))}catch(e){}return true}'
  +'document.addEventListener("click",function(e){if(e.defaultPrevented||e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;var a=e.target&&e.target.closest&&e.target.closest("a[href]");if(!a||(a.target&&a.target!="_self")||a.hasAttribute("download"))return;var raw=a.getAttribute("href")||"";if(raw.indexOf("#")<0)return;var u;try{u=new URL(raw,location.href)}catch(x){return}if(u.origin!=location.origin)return;if(!(u.pathname==location.pathname||u.pathname=="/"||u.pathname==SP))return;if(u.search&&u.search!=location.search)return;if(go(u.hash.slice(1))){e.preventDefault();e.stopPropagation()}},true);'
  +'addEventListener("hashchange",function(e){if(location.pathname==SP)e.stopImmediatePropagation()},true);'
  +'addEventListener("popstate",function(e){var b=bs();if(b==last&&location.pathname==SP)e.stopImmediatePropagation();else last=b},true)'
  +'})()';
}
/* codigo que roda numa pagina "de trabalho" (computador: janela escondida; celular: a propria tela) para gerar WebP */
async function speedCanvasEnc(b64,mime,maxW,q){
  const bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
  const bmp=await createImageBitmap(new Blob([u],{type:mime}));let w=bmp.width,h=bmp.height;const s=Math.min(1,maxW/w);w=Math.max(1,Math.round(w*s));h=Math.max(1,Math.round(h*s));
  const c=new OffscreenCanvas(w,h),g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(bmp,0,0,w,h);bmp.close&&bmp.close();
  const o=await c.convertToBlob({type:'image/webp',quality:q}),ab=new Uint8Array(await o.arrayBuffer());let s2='';const k=0x8000;for(let i=0;i<ab.length;i+=k)s2+=String.fromCharCode.apply(null,ab.subarray(i,i+k));
  return{w,h,b64:btoa(s2)};
}


const SPCACHE=()=>path.join(app.getPath('userData'),'speedcache');
async function speedRun(F,o){
  let w=null;const G=Object.assign({},F);
  try{
    w=new BrowserWindow({show:false,width:400,height:300,webPreferences:{backgroundThrottling:false,partition:'spd'+Date.now()}});
    await w.loadURL('about:blank');await w.webContents.executeJavaScript('window.__f='+speedCanvasEnc.toString().replace(/^async function speedCanvasEnc/,'async function')+';1');
    try{fs.mkdirSync(SPCACHE(),{recursive:true})}catch{}
    const E={sha1:async u=>crypto.createHash('sha1').update(u).digest('hex'),
      enc:async(u,mime,wd,q)=>{const r=await w.webContents.executeJavaScript('window.__f('+JSON.stringify(Buffer.from(u).toString('base64'))+','+JSON.stringify(mime)+','+(+wd)+','+(+q)+')');if(!r||!r.b64)return null;return{u8:new Uint8Array(Buffer.from(r.b64,'base64')),w:r.w,h:r.h}},
      cacheGet:async k=>{try{return new Uint8Array(fs.readFileSync(path.join(SPCACHE(),k.replace(/[^\w-]/g,'_')+'.webp')))}catch{return null}},
      cachePut:async(k,v)=>{try{fs.writeFileSync(path.join(SPCACHE(),k.replace(/[^\w-]/g,'_')+'.webp'),Buffer.from(v))}catch{}}};
    const rep=await makeSpeed(E).apply(G,o);
    for(const p in G)F[p]=Buffer.isBuffer(G[p])?G[p]:Buffer.from(G[p]);
    return rep;
  }catch(e){return{imgs:0,from:0,to:0,files:0,notes:['falhou: '+String(e&&e.message||e).slice(0,120)],failed:1}}
  finally{try{w&&!w.isDestroyed()&&w.destroy()}catch{}}
}

// ===== Sincronização (v46) =====
const HUBPHP=Buffer.from('PD9waHAKLy8gU2hhcmsgTGFiIC0gcG9udG8gZGUgZW5jb250cm8gZGEgc2luY3Jvbml6YWNhbyBlbnRyZSBjb21wdXRhZG9yIGUgY2VsdWxhci4KLy8gTmFvIGFwYWd1ZSBhIHBhc3RhIGRlIGRhZG9zIChkXy4uLik6IGVsYSBndWFyZGEgYXMgcGFnaW5hcyBzaW5jcm9uaXphZGFzLgplcnJvcl9yZXBvcnRpbmcoMCk7CmhlYWRlcignQ2FjaGUtQ29udHJvbDogbm8tc3RvcmUnKTsKJEQgPSBfX0RJUl9fOwokY2ZnID0gQGluY2x1ZGUgJEQgLiAnL2NvbmZpZy5waHAnOwpmdW5jdGlvbiBvdXQoJGMsICRhKSB7IGh0dHBfcmVzcG9uc2VfY29kZSgkYyk7IGhlYWRlcignQ29udGVudC1UeXBlOiBhcHBsaWNhdGlvbi9qc29uOyBjaGFyc2V0PXV0Zi04Jyk7IGVjaG8ganNvbl9lbmNvZGUoJGEsIEpTT05fVU5FU0NBUEVEX1VOSUNPREUgfCBKU09OX1VORVNDQVBFRF9TTEFTSEVTKTsgZXhpdDsgfQppZiAoIWlzX2FycmF5KCRjZmcpIHx8IGVtcHR5KCRjZmdbJ2toJ10pKSBvdXQoNTAwLCBbJ29rJyA9PiAwLCAnZXJyb3InID0+ICdjb25maWcnXSk7CiRrID0gaXNzZXQoJF9TRVJWRVJbJ0hUVFBfWF9TTF9LRVknXSkgPyAkX1NFUlZFUlsnSFRUUF9YX1NMX0tFWSddIDogKGlzc2V0KCRfR0VUWydrJ10pID8gJF9HRVRbJ2snXSA6ICcnKTsKaWYgKCFpc19zdHJpbmcoJGspIHx8ICFoYXNoX2VxdWFscygkY2ZnWydraCddLCBoYXNoKCdzaGEyNTYnLCAkaykpKSB7IHVzbGVlcCg4MDAwMDApOyBvdXQoNDAxLCBbJ29rJyA9PiAwLCAnZXJyb3InID0+ICdjaGF2ZSddKTsgfQokREFUQSA9ICREIC4gJy8nIC4gKChpc3NldCgkY2ZnWydkaXInXSkgJiYgcHJlZ19tYXRjaCgnL15kX1thLWYwLTldezEyfSQvJywgJGNmZ1snZGlyJ10pKSA/ICRjZmdbJ2RpciddIDogJ2RhdGEnKTsKaWYgKCFpc19kaXIoJERBVEEpKSB7IEBta2RpcigkREFUQSwgMDc1NSwgdHJ1ZSk7IH0KaWYgKCFpc19maWxlKCREQVRBIC4gJy8uaHRhY2Nlc3MnKSkgeyBAZmlsZV9wdXRfY29udGVudHMoJERBVEEgLiAnLy5odGFjY2VzcycsICJSZXF1aXJlIGFsbCBkZW5pZWRcbkRlbnkgZnJvbSBhbGxcbiIpOyBAZmlsZV9wdXRfY29udGVudHMoJERBVEEgLiAnL2luZGV4Lmh0bWwnLCAnJyk7IH0KQG1rZGlyKCREQVRBIC4gJy90bXAnLCAwNzU1LCB0cnVlKTsgQG1rZGlyKCREQVRBIC4gJy9iJywgMDc1NSwgdHJ1ZSk7IEBta2RpcigkREFUQSAuICcvcCcsIDA3NTUsIHRydWUpOwpmdW5jdGlvbiBva2lkKCRzKSB7IHJldHVybiBpc19zdHJpbmcoJHMpICYmIHByZWdfbWF0Y2goJy9eW0EtWmEtejAtOV8tXXsxLDY0fSQvJywgJHMpOyB9CmZ1bmN0aW9uIG9raCgkcykgeyByZXR1cm4gaXNfc3RyaW5nKCRzKSAmJiBwcmVnX21hdGNoKCcvXlthLWYwLTldezQwfSQvJywgJHMpOyB9CmZ1bmN0aW9uIGJsb2IoJGgpIHsgZ2xvYmFsICREQVRBOyByZXR1cm4gJERBVEEgLiAnL2IvJyAuIHN1YnN0cigkaCwgMCwgMikgLiAnLycgLiAkaDsgfQpmdW5jdGlvbiBib2R5X2pzb24oKSB7ICRqID0ganNvbl9kZWNvZGUoZmlsZV9nZXRfY29udGVudHMoJ3BocDovL2lucHV0JyksIHRydWUpOyByZXR1cm4gaXNfYXJyYXkoJGopID8gJGogOiBbXTsgfQpmdW5jdGlvbiBpbmlfYnl0ZXMoJHYpIHsgJHYgPSB0cmltKChzdHJpbmcpJHYpOyAkbiA9IChmbG9hdCkkdjsgJHUgPSBzdHJ0b2xvd2VyKHN1YnN0cigkdiwgLTEpKTsgaWYgKCR1ID09ICdnJykgJG4gKj0gMTA3Mzc0MTgyNDsgZWxzZWlmICgkdSA9PSAnbScpICRuICo9IDEwNDg1NzY7IGVsc2VpZiAoJHUgPT0gJ2snKSAkbiAqPSAxMDI0OyByZXR1cm4gKGludCkkbjsgfQpmdW5jdGlvbiBpbmRleF9vcGVuKCkgeyBnbG9iYWwgJERBVEE7ICRmcCA9IGZvcGVuKCREQVRBIC4gJy9pbmRleC5qc29uJywgJ2MrJyk7IGZsb2NrKCRmcCwgTE9DS19FWCk7ICR0ID0gc3RyZWFtX2dldF9jb250ZW50cygkZnApOyAkaiA9IGpzb25fZGVjb2RlKCR0LCB0cnVlKTsgaWYgKCFpc19hcnJheSgkaikgfHwgIWlzc2V0KCRqWydwYWdlcyddKSkgJGogPSBbJ3JldicgPT4gMCwgJ3BhZ2VzJyA9PiBbXV07IHJldHVybiBbJGZwLCAkal07IH0KZnVuY3Rpb24gaW5kZXhfc2F2ZSgkZnAsICRqKSB7IGZ0cnVuY2F0ZSgkZnAsIDApOyByZXdpbmQoJGZwKTsgZndyaXRlKCRmcCwganNvbl9lbmNvZGUoJGosIEpTT05fVU5FU0NBUEVEX1VOSUNPREUpKTsgZmZsdXNoKCRmcCk7IGZsb2NrKCRmcCwgTE9DS19VTik7IGZjbG9zZSgkZnApOyB9CmZ1bmN0aW9uIGluZGV4X2Nsb3NlKCRmcCkgeyBmbG9jaygkZnAsIExPQ0tfVU4pOyBmY2xvc2UoJGZwKTsgfQoKZnVuY3Rpb24gaG9tZV9kaXIoKSB7ICRkID0gc3RyX3JlcGxhY2UoJ1xcJywgJy8nLCBfX0RJUl9fKTsgaWYgKCgkcCA9IHN0cnBvcygkZCwgJy9kb21haW5zLycpKSAhPT0gZmFsc2UpIHJldHVybiBzdWJzdHIoJGQsIDAsICRwKTsgaWYgKCgkcCA9IHN0cnBvcygkZCwgJy9wdWJsaWNfaHRtbCcpKSAhPT0gZmFsc2UpIHJldHVybiBzdWJzdHIoJGQsIDAsICRwKTsgcmV0dXJuIG51bGw7IH0KZnVuY3Rpb24gb2tkaXIoJGQpIHsgcmV0dXJuIGlzX3N0cmluZygkZCkgJiYgcHJlZ19tYXRjaCgnI14vKGRvbWFpbnMvW0EtWmEtejAtOS4tXSsvKT9wdWJsaWNfaHRtbCQjJywgJGQpICYmIHN0cnBvcygkZCwgJy4uJykgPT09IGZhbHNlOyB9CmZ1bmN0aW9uIGRvY3Jvb3QoJGQpIHsgJGggPSBob21lX2RpcigpOyByZXR1cm4gJGggPT09IG51bGwgPyBudWxsIDogJGggLiAkZDsgfQokYSA9IGlzc2V0KCRfR0VUWydhJ10pID8gJF9HRVRbJ2EnXSA6ICcnOwoKaWYgKCRhID09ICdwaW5nJykgewogIG91dCgyMDAsIFsnb2snID0+IDEsICd2JyA9PiAzLCAncHViJyA9PiAoaG9tZV9kaXIoKSAhPT0gbnVsbCkgPyAxIDogMCwgJ3QnID0+IHJvdW5kKG1pY3JvdGltZSh0cnVlKSAqIDEwMDApLCAncG9zdCcgPT4gaW5pX2J5dGVzKGluaV9nZXQoJ3Bvc3RfbWF4X3NpemUnKSksICdmcmVlJyA9PiBAZGlza19mcmVlX3NwYWNlKCREQVRBKV0pOwp9CmlmICgkYSA9PSAnaW5kZXgnKSB7CiAgJHQgPSBAZmlsZV9nZXRfY29udGVudHMoJERBVEEgLiAnL2luZGV4Lmpzb24nKTsgJGogPSBqc29uX2RlY29kZSgkdCwgdHJ1ZSk7CiAgaWYgKCFpc19hcnJheSgkaikgfHwgIWlzc2V0KCRqWydwYWdlcyddKSkgJGogPSBbJ3JldicgPT4gMCwgJ3BhZ2VzJyA9PiBbXV07CiAgb3V0KDIwMCwgWydvaycgPT4gMSwgJ3JldicgPT4gJGpbJ3JldiddLCAncGFnZXMnID0+IChvYmplY3QpJGpbJ3BhZ2VzJ11dKTsKfQppZiAoJGEgPT0gJ25lZWQnKSB7CiAgJGIgPSBib2R5X2pzb24oKTsgJG5lZWQgPSBbXTsKICBmb3JlYWNoICgoaXNzZXQoJGJbJ2hhc2hlcyddKSAmJiBpc19hcnJheSgkYlsnaGFzaGVzJ10pID8gJGJbJ2hhc2hlcyddIDogW10pIGFzICRoKSB7IGlmIChva2goJGgpICYmICFpc19maWxlKGJsb2IoJGgpKSkgJG5lZWRbJGhdID0gMTsgfQogIG91dCgyMDAsIFsnb2snID0+IDEsICduZWVkJyA9PiBhcnJheV9rZXlzKCRuZWVkKV0pOwp9CmlmICgkYSA9PSAncHV0JykgewogICRoID0gaXNzZXQoJF9HRVRbJ2gnXSkgPyAkX0dFVFsnaCddIDogJyc7ICRvZmYgPSAoaW50KShpc3NldCgkX0dFVFsnb2ZmJ10pID8gJF9HRVRbJ29mZiddIDogMCk7ICR0b3QgPSAoaW50KShpc3NldCgkX0dFVFsndG90YWwnXSkgPyAkX0dFVFsndG90YWwnXSA6IDApOwogIGlmICghb2toKCRoKSB8fCAkb2ZmIDwgMCB8fCAkdG90IDwgMCkgb3V0KDQwMCwgWydvaycgPT4gMCwgJ2Vycm9yJyA9PiAncGFyYW1ldHJvcyddKTsKICBpZiAoaXNfZmlsZShibG9iKCRoKSkpIHsgb3V0KDIwMCwgWydvaycgPT4gMSwgJ2RvbmUnID0+IDFdKTsgfQogICRwYXJ0ID0gJERBVEEgLiAnL3RtcC8nIC4gJGggLiAnLnBhcnQnOwogIGlmICgkb2ZmID09PSAwKSB7IEB1bmxpbmsoJHBhcnQpOyB9CiAgY2xlYXJzdGF0Y2FjaGUoKTsgJGN1ciA9IGlzX2ZpbGUoJHBhcnQpID8gZmlsZXNpemUoJHBhcnQpIDogMDsKICBpZiAoJGN1ciAhPT0gJG9mZikgb3V0KDQwOSwgWydvaycgPT4gMCwgJ2Vycm9yJyA9PiAnb2Zmc2V0JywgJ2hhdmUnID0+ICRjdXJdKTsKICAkZnAgPSBmb3BlbigkcGFydCwgJ2FiJyk7IGlmIChpc3NldCgkX0dFVFsnZW5jJ10pICYmICRfR0VUWydlbmMnXSA9PSAnYjY0JykgeyBmd3JpdGUoJGZwLCAoc3RyaW5nKWJhc2U2NF9kZWNvZGUoKHN0cmluZylmaWxlX2dldF9jb250ZW50cygncGhwOi8vaW5wdXQnKSkpOyB9IGVsc2UgeyAkaW4gPSBmb3BlbigncGhwOi8vaW5wdXQnLCAncmInKTsgc3RyZWFtX2NvcHlfdG9fc3RyZWFtKCRpbiwgJGZwKTsgZmNsb3NlKCRpbik7IH0gZmNsb3NlKCRmcCk7CiAgY2xlYXJzdGF0Y2FjaGUoKTsgJHN6ID0gaXNfZmlsZSgkcGFydCkgPyBmaWxlc2l6ZSgkcGFydCkgOiAwOwogIGlmICgkc3ogPiAkdG90KSB7IEB1bmxpbmsoJHBhcnQpOyBvdXQoNDIyLCBbJ29rJyA9PiAwLCAnZXJyb3InID0+ICd0YW1hbmhvJ10pOyB9CiAgaWYgKCRzeiA9PSAkdG90KSB7CiAgICBpZiAoc2hhMV9maWxlKCRwYXJ0KSAhPT0gJGgpIHsgQHVubGluaygkcGFydCk7IG91dCg0MjIsIFsnb2snID0+IDAsICdlcnJvcicgPT4gJ2hhc2gnXSk7IH0KICAgICRkc3QgPSBibG9iKCRoKTsgQG1rZGlyKGRpcm5hbWUoJGRzdCksIDA3NTUsIHRydWUpOwogICAgaWYgKCFAcmVuYW1lKCRwYXJ0LCAkZHN0KSkgeyBAY29weSgkcGFydCwgJGRzdCk7IEB1bmxpbmsoJHBhcnQpOyB9CiAgICBvdXQoMjAwLCBbJ29rJyA9PiAxLCAnZG9uZScgPT4gMV0pOwogIH0KICBvdXQoMjAwLCBbJ29rJyA9PiAxLCAnaGF2ZScgPT4gJHN6XSk7Cn0KaWYgKCRhID09ICdnZXQnKSB7CiAgJGggPSBpc3NldCgkX0dFVFsnaCddKSA/ICRfR0VUWydoJ10gOiAnJzsgaWYgKCFva2goJGgpIHx8ICFpc19maWxlKGJsb2IoJGgpKSkgb3V0KDQwNCwgWydvaycgPT4gMCwgJ2Vycm9yJyA9PiAnbmFvIGV4aXN0ZSddKTsKICAkb2ZmID0gKGludCkoaXNzZXQoJF9HRVRbJ29mZiddKSA/ICRfR0VUWydvZmYnXSA6IDApOyAkbGVuID0gKGludCkoaXNzZXQoJF9HRVRbJ2xlbiddKSA/ICRfR0VUWydsZW4nXSA6IDApOyAkZiA9IGJsb2IoJGgpOyAkc2l6ZSA9IGZpbGVzaXplKCRmKTsKICBpZiAoJGxlbiA8PSAwIHx8ICRvZmYgKyAkbGVuID4gJHNpemUpICRsZW4gPSBtYXgoMCwgJHNpemUgLSAkb2ZmKTsKICBoZWFkZXIoJ0NvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtJyk7IGhlYWRlcignQ29udGVudC1MZW5ndGg6ICcgLiAkbGVuKTsgaGVhZGVyKCdYLVNMLVNpemU6ICcgLiAkc2l6ZSk7CiAgJGZwID0gZm9wZW4oJGYsICdyYicpOyBmc2VlaygkZnAsICRvZmYpOyAkbGVmdCA9ICRsZW47IHdoaWxlICgkbGVmdCA+IDAgJiYgIWZlb2YoJGZwKSkgeyAkciA9IGZyZWFkKCRmcCwgbWluKDY1NTM2LCAkbGVmdCkpOyBpZiAoJHIgPT09IGZhbHNlIHx8ICRyID09PSAnJykgYnJlYWs7IGVjaG8gJHI7ICRsZWZ0IC09IHN0cmxlbigkcik7IH0gZmNsb3NlKCRmcCk7IGV4aXQ7Cn0KaWYgKCRhID09ICdtZXRhJyB8fCAkYSA9PSAnZmlsZXMnKSB7CiAgJGlkID0gaXNzZXQoJF9HRVRbJ2lkJ10pID8gJF9HRVRbJ2lkJ10gOiAnJzsgaWYgKCFva2lkKCRpZCkpIG91dCg0MDAsIFsnb2snID0+IDAsICdlcnJvcicgPT4gJ2lkJ10pOwogICRmID0gJERBVEEgLiAnL3AvJyAuICRpZCAuICcvJyAuICgkYSA9PSAnbWV0YScgPyAnbWV0YS5qc29uJyA6ICdmaWxlcy5qc29uJyk7IGlmICghaXNfZmlsZSgkZikpIG91dCg0MDQsIFsnb2snID0+IDAsICdlcnJvcicgPT4gJ25hbyBleGlzdGUnXSk7CiAgaGVhZGVyKCdDb250ZW50LVR5cGU6IGFwcGxpY2F0aW9uL2pzb247IGNoYXJzZXQ9dXRmLTgnKTsgcmVhZGZpbGUoJGYpOyBleGl0Owp9CmlmICgkYSA9PSAnY29tbWl0JyB8fCAkYSA9PSAnZGVsJykgewogICRiID0gYm9keV9qc29uKCk7ICRpZCA9IGlzc2V0KCRiWydpZCddKSA/ICRiWydpZCddIDogJyc7IGlmICghb2tpZCgkaWQpKSBvdXQoNDAwLCBbJ29rJyA9PiAwLCAnZXJyb3InID0+ICdpZCddKTsKICAkaWZtID0gaXNzZXQoJGJbJ2lmbSddKSA/IChzdHJpbmcpJGJbJ2lmbSddIDogJyc7ICRpZmYgPSBpc3NldCgkYlsnaWZmJ10pID8gKHN0cmluZykkYlsnaWZmJ10gOiAnJzsKICBpZiAoJGEgPT0gJ2NvbW1pdCcpIHsKICAgICRtID0gaXNzZXQoJGJbJ20nXSkgPyAkYlsnbSddIDogJyc7ICRmID0gaXNzZXQoJGJbJ2YnXSkgPyAkYlsnZiddIDogJyc7ICRmaWxlcyA9IGlzc2V0KCRiWydmaWxlcyddKSAmJiBpc19hcnJheSgkYlsnZmlsZXMnXSkgPyAkYlsnZmlsZXMnXSA6IG51bGw7ICRtZXRhID0gaXNzZXQoJGJbJ21ldGEnXSkgPyAkYlsnbWV0YSddIDogbnVsbDsKICAgIGlmICghb2toKCRtKSB8fCAhb2toKCRmKSB8fCAkZmlsZXMgPT09IG51bGwgfHwgIWlzX2FycmF5KCRtZXRhKSkgb3V0KDQwMCwgWydvaycgPT4gMCwgJ2Vycm9yJyA9PiAnY29ycG8nXSk7CiAgICAkbWlzcyA9IFtdOyBmb3JlYWNoICgkZmlsZXMgYXMgJHAgPT4gJGUpIHsgaWYgKCFpc19hcnJheSgkZSkgfHwgIWlzc2V0KCRlWzFdKSB8fCAhb2toKCRlWzFdKSkgb3V0KDQwMCwgWydvaycgPT4gMCwgJ2Vycm9yJyA9PiAnYXJxdWl2byddKTsgaWYgKCFpc19maWxlKGJsb2IoJGVbMV0pKSkgJG1pc3NbXSA9ICRlWzFdOyB9CiAgICBpZiAoJG1pc3MpIG91dCg0MjIsIFsnb2snID0+IDAsICdlcnJvcicgPT4gJ2ZhbHRhbScsICdtaXNzaW5nJyA9PiBhcnJheV92YWx1ZXMoYXJyYXlfdW5pcXVlKCRtaXNzKSldKTsKICB9CiAgbGlzdCgkZnAsICRqKSA9IGluZGV4X29wZW4oKTsKICAkY3VyID0gaXNzZXQoJGpbJ3BhZ2VzJ11bJGlkXSkgJiYgZW1wdHkoJGpbJ3BhZ2VzJ11bJGlkXVsnZGVsJ10pID8gJGpbJ3BhZ2VzJ11bJGlkXSA6IG51bGw7CiAgJGhhdmUgPSAkY3VyID8gKCRjdXJbJ20nXSAuICd8JyAuICRjdXJbJ2YnXSkgOiAnfCc7CiAgaWYgKCRoYXZlICE9PSAoJGlmbSAuICd8JyAuICRpZmYpKSB7IGluZGV4X2Nsb3NlKCRmcCk7IG91dCg0MDksIFsnb2snID0+IDAsICdlcnJvcicgPT4gJ211ZG91JywgJ2N1cicgPT4gaXNzZXQoJGpbJ3BhZ2VzJ11bJGlkXSkgPyAkalsncGFnZXMnXVskaWRdIDogbnVsbF0pOyB9CiAgJHBkID0gJERBVEEgLiAnL3AvJyAuICRpZDsgQG1rZGlyKCRwZCwgMDc1NSwgdHJ1ZSk7CiAgaWYgKCRhID09ICdjb21taXQnKSB7CiAgICBmaWxlX3B1dF9jb250ZW50cygkcGQgLiAnL21ldGEuanNvbicsIGpzb25fZW5jb2RlKCRtZXRhLCBKU09OX1VORVNDQVBFRF9VTklDT0RFKSk7IGZpbGVfcHV0X2NvbnRlbnRzKCRwZCAuICcvZmlsZXMuanNvbicsIGpzb25fZW5jb2RlKChvYmplY3QpJGZpbGVzLCBKU09OX1VORVNDQVBFRF9VTklDT0RFKSk7CiAgICAkalsncGFnZXMnXVskaWRdID0gWydtJyA9PiAkbSwgJ2YnID0+ICRmLCAnYXQnID0+IHJvdW5kKG1pY3JvdGltZSh0cnVlKSAqIDEwMDApLCAnZGVsJyA9PiAwXTsKICB9IGVsc2UgewogICAgJGpbJ3BhZ2VzJ11bJGlkXSA9IFsnbScgPT4gJycsICdmJyA9PiAnJywgJ2F0JyA9PiByb3VuZChtaWNyb3RpbWUodHJ1ZSkgKiAxMDAwKSwgJ2RlbCcgPT4gMV07CiAgfQogICRqWydyZXYnXSA9IChpbnQpJGpbJ3JldiddICsgMTsgJGUgPSAkalsncGFnZXMnXVskaWRdOyAkcmV2ID0gJGpbJ3JldiddOyBpbmRleF9zYXZlKCRmcCwgJGopOwogIG91dCgyMDAsIFsnb2snID0+IDEsICdyZXYnID0+ICRyZXYsICdlbnRyeScgPT4gJGVdKTsKfQoKaWYgKCRhID09ICdzZXR0aW5ncycpIHsKICAkZiA9ICREQVRBIC4gJy9zZXR0aW5ncy5qc29uJzsKICBpZiAoJF9TRVJWRVJbJ1JFUVVFU1RfTUVUSE9EJ10gPT0gJ1BPU1QnKSB7CiAgICAkYiA9IGJvZHlfanNvbigpOyBpZiAoIWlzc2V0KCRiWydkYXRhJ10pIHx8ICFpc19hcnJheSgkYlsnZGF0YSddKSkgb3V0KDQwMCwgWydvaycgPT4gMCwgJ2Vycm9yJyA9PiAnY29ycG8nXSk7CiAgICAkb2xkID0ganNvbl9kZWNvZGUoQGZpbGVfZ2V0X2NvbnRlbnRzKCRmKSwgdHJ1ZSk7ICRyZXYgPSBpc19hcnJheSgkb2xkKSAmJiBpc3NldCgkb2xkWydyZXYnXSkgPyAoaW50KSRvbGRbJ3JldiddICsgMSA6IDE7CiAgICBmaWxlX3B1dF9jb250ZW50cygkZiwganNvbl9lbmNvZGUoWydyZXYnID0+ICRyZXYsICdkYXRhJyA9PiAkYlsnZGF0YSddXSwgSlNPTl9VTkVTQ0FQRURfVU5JQ09ERSkpOyBvdXQoMjAwLCBbJ29rJyA9PiAxLCAncmV2JyA9PiAkcmV2XSk7CiAgfQogICRqID0ganNvbl9kZWNvZGUoQGZpbGVfZ2V0X2NvbnRlbnRzKCRmKSwgdHJ1ZSk7IGlmICghaXNfYXJyYXkoJGopKSAkaiA9IFsncmV2JyA9PiAwLCAnZGF0YScgPT4gKG9iamVjdClbXV07CiAgb3V0KDIwMCwgWydvaycgPT4gMSwgJ3JldicgPT4gJGpbJ3JldiddLCAnZGF0YScgPT4gJGpbJ2RhdGEnXV0pOwp9CmlmICgkYSA9PSAnY2hlY2snKSB7CiAgJGIgPSBib2R5X2pzb24oKTsgJGRpciA9IGlzc2V0KCRiWydkaXInXSkgPyAkYlsnZGlyJ10gOiAnJzsgaWYgKCFva2RpcigkZGlyKSkgb3V0KDQwMCwgWydvaycgPT4gMCwgJ2Vycm9yJyA9PiAncGFzdGEnXSk7CiAgJHIgPSBkb2Nyb290KCRkaXIpOyBvdXQoMjAwLCBbJ29rJyA9PiAxLCAnZXhpc3RzJyA9PiAoJHIgIT09IG51bGwgJiYgaXNfZGlyKCRyKSldKTsKfQppZiAoJGEgPT0gJ3B1Ymxpc2gnKSB7CiAgQHNldF90aW1lX2xpbWl0KDE4MCk7CiAgJGIgPSBib2R5X2pzb24oKTsgJGRpciA9IGlzc2V0KCRiWydkaXInXSkgPyAkYlsnZGlyJ10gOiAnJzsgJHNsdWcgPSB0cmltKChzdHJpbmcpKGlzc2V0KCRiWydzbHVnJ10pID8gJGJbJ3NsdWcnXSA6ICcnKSwgJy8nKTsgJGZpbGVzID0gaXNzZXQoJGJbJ2ZpbGVzJ10pICYmIGlzX2FycmF5KCRiWydmaWxlcyddKSA/ICRiWydmaWxlcyddIDogbnVsbDsKICAkdG9rID0gaXNzZXQoJGJbJ3RvayddKSA/ICRiWyd0b2snXSA6ICcnOyAkb3duZXIgPSBpc3NldCgkYlsnb3duZXInXSkgJiYgaXNfYXJyYXkoJGJbJ293bmVyJ10pID8gJGJbJ293bmVyJ10gOiBbXTsgJGZvcmNlID0gIWVtcHR5KCRiWydmb3JjZSddKTsgJG1rID0gIWVtcHR5KCRiWydtayddKTsKICBpZiAoIW9rZGlyKCRkaXIpIHx8ICgkc2x1ZyAhPT0gJycgJiYgIXByZWdfbWF0Y2goJyNeW0EtWmEtejAtOV8tXSsoL1tBLVphLXowLTlfLV0rKXswLDN9JCMnLCAkc2x1ZykpIHx8ICFpc19zdHJpbmcoJHRvaykgfHwgIXByZWdfbWF0Y2goJy9eW2EtZjAtOV17MTZ9JC8nLCAkdG9rKSB8fCAhJGZpbGVzIHx8IGNvdW50KCRmaWxlcykgPiA4MDAwKSBvdXQoNDAwLCBbJ29rJyA9PiAwLCAnZXJyb3InID0+ICdjb3JwbyddKTsKICAkcm9vdCA9IGRvY3Jvb3QoJGRpcik7IGlmICgkcm9vdCA9PT0gbnVsbCkgb3V0KDIwMCwgWydvaycgPT4gMCwgJ2Vycm9yJyA9PiAnTyBwb250byBkZSBlbmNvbnRybyBuw6NvIGVzdMOhIGRlbnRybyBkYSBwYXN0YSBkbyBzaXRlLiBSZWluc3RhbGUgYSBzaW5jcm9uaXphw6fDo28uJ10pOwogIGlmICghaXNfZGlyKCRyb290KSkgeyBpZiAoISRtaykgb3V0KDIwMCwgWydvaycgPT4gMCwgJ25vRGlyJyA9PiAkZGlyXSk7IGlmICghQG1rZGlyKCRyb290LCAwNzU1LCB0cnVlKSkgb3V0KDIwMCwgWydvaycgPT4gMCwgJ2Vycm9yJyA9PiAnTsOjbyBjb25zZWd1aSBjcmlhciBhIHBhc3RhIGRvIGRvbcOtbmlvIG5vIHNlcnZpZG9yLiddKTsgfQogICRyb290ID0gcnRyaW0oc3RyX3JlcGxhY2UoJ1xcJywgJy8nLCByZWFscGF0aCgkcm9vdCkpLCAnLycpOwogICRtZGlyID0gJHJvb3QgLiAoJHNsdWcgIT09ICcnID8gJy8nIC4gJHNsdWcgOiAnJyk7CiAgJHByZXYgPSBpc19maWxlKCRtZGlyIC4gJy9fc2xfcHViLmpzb24nKSA/IGpzb25fZGVjb2RlKEBmaWxlX2dldF9jb250ZW50cygkbWRpciAuICcvX3NsX3B1Yi5qc29uJyksIHRydWUpIDogbnVsbDsKICAkb2lkID0gaXNzZXQoJG93bmVyWydpZCddKSA/IChzdHJpbmcpJG93bmVyWydpZCddIDogJyc7ICRvbm0gPSBpc3NldCgkb3duZXJbJ25hbWUnXSkgPyAoc3RyaW5nKSRvd25lclsnbmFtZSddIDogJyc7CiAgaWYgKCEkZm9yY2UgJiYgaXNfYXJyYXkoJHByZXYpICYmICFlbXB0eSgkcHJldlsnb3duZXInXSkgJiYgJG9pZCAhPT0gJycgJiYgJHByZXZbJ293bmVyJ10gIT09ICRvaWQpIG91dCgyMDAsIFsnb2snID0+IDAsICdjb25mbGljdCcgPT4gWyduYW1lJyA9PiBpc3NldCgkcHJldlsnbmFtZSddKSAmJiAkcHJldlsnbmFtZSddICE9PSAnJyA/ICRwcmV2WyduYW1lJ10gOiAnb3V0cm8gcHJvamV0bycsICdhdCcgPT4gaXNzZXQoJHByZXZbJ2F0J10pID8gJHByZXZbJ2F0J10gOiAwXV0pOwogICRtaXNzID0gW107CiAgZm9yZWFjaCAoJGZpbGVzIGFzICRwID0+ICRlKSB7CiAgICBpZiAoIWlzX3N0cmluZygkcCkgfHwgJHBbMF0gIT09ICcvJyB8fCBzdHJsZW4oJHApID4gNDAwIHx8IHByZWdfbWF0Y2goJy9bXHgwMC1ceDFmXFxcXF0vJywgJHApKSBvdXQoNDAwLCBbJ29rJyA9PiAwLCAnZXJyb3InID0+ICdjYW1pbmhvIGludsOhbGlkbzogJyAuICRwXSk7CiAgICBmb3JlYWNoIChleHBsb2RlKCcvJywgc3Vic3RyKCRwLCAxKSkgYXMgJHNnKSB7IGlmICgkc2cgPT09ICcnIHx8ICRzZyA9PT0gJy4nIHx8ICRzZyA9PT0gJy4uJykgb3V0KDQwMCwgWydvaycgPT4gMCwgJ2Vycm9yJyA9PiAnY2FtaW5obyBpbnbDoWxpZG86ICcgLiAkcF0pOyB9CiAgICBpZiAocHJlZ19tYXRjaCgnL1wuKHBocFswLTldP3xwaHRtbHxwaGFyfHBodHxwaHBzKSQvaScsICRwKSB8fCBwcmVnX21hdGNoKCcjLyhcLnVzZXJcLmluaXxwaHBcLmluaSkkI2knLCAkcCkgfHwgc3RycG9zKCRwLCAnL19zbF8nKSA9PT0gMCAmJiAkcCAhPT0gJy9fc2xfcHViLmpzb24nKSBvdXQoMjAwLCBbJ29rJyA9PiAwLCAnZXJyb3InID0+ICdBcnF1aXZvIG7Do28gcGVybWl0aWRvIG5hIHB1YmxpY2HDp8OjbzogJyAuICRwXSk7CiAgICBpZiAoIWlzX2FycmF5KCRlKSB8fCAhaXNzZXQoJGVbMF0pIHx8ICFpc3NldCgkZVsxXSkgfHwgIW9raCgkZVsxXSkpIG91dCg0MDAsIFsnb2snID0+IDAsICdlcnJvcicgPT4gJ2FycXVpdm8nXSk7CiAgICBpZiAoIWlzX2ZpbGUoYmxvYigkZVsxXSkpKSAkbWlzc1tdID0gJGVbMV07CiAgfQogIGlmICgkbWlzcykgb3V0KDQyMiwgWydvaycgPT4gMCwgJ2Vycm9yJyA9PiAnZmFsdGFtJywgJ21pc3NpbmcnID0+IGFycmF5X3ZhbHVlcyhhcnJheV91bmlxdWUoJG1pc3MpKV0pOwogIGlmICgkc2x1ZyAhPT0gJycpIHsKICAgICRiYWQgPSBbXTsgJGtlZXAgPSAnI14vKGZhdmljb25bXi9dKnxyb2JvdHNcLnR4dHxwbGFjZWhvbGRlclwuc3ZnfHNpdGVtYXBcLnhtbHxtYW5pZmVzdFteL10qfGFwcGxlLXRvdWNoLWljb25bXi9dKnxvZ1teL10qXC4ocG5nfGpwZ3x3ZWJwKSkkI2knOwogICAgZm9yZWFjaCAoJGZpbGVzIGFzICRwID0+ICRlKSB7CiAgICAgIGlmIChzdHJwb3MoJHAsICcvJyAuICRzbHVnIC4gJy8nKSA9PT0gMCkgY29udGludWU7CiAgICAgICRmID0gJHJvb3QgLiAkcDsKICAgICAgaWYgKGlzX2ZpbGUoJGYpKSB7IGlmIChmaWxlc2l6ZSgkZikgIT09IChpbnQpJGVbMF0gJiYgIXByZWdfbWF0Y2goJGtlZXAsICRwKSkgJGJhZFtdID0gJHA7IGVsc2UgdW5zZXQoJGZpbGVzWyRwXSk7IH0KICAgIH0KICAgIGlmICgkYmFkKSBvdXQoMjAwLCBbJ29rJyA9PiAwLCAnZXJyb3InID0+ICdFc3RlcyBhcnF1aXZvcyBqw6EgZXhpc3RlbSBuZXN0ZSBkb23DrW5pbyBjb20gY29udGXDumRvIGRpZmVyZW50ZSAoZGUgb3V0cmEgcMOhZ2luYSk6ICcgLiBpbXBsb2RlKCcsICcsIGFycmF5X3NsaWNlKCRiYWQsIDAsIDQpKSAuIChjb3VudCgkYmFkKSA+IDQgPyAnIGUgbWFpcyAnIC4gKGNvdW50KCRiYWQpIC0gNCkgOiAnJykgLiAnLiBQdWJsaWNhciBhcXVpIHBvZGVyaWEgcXVlYnJhciBhIHDDoWdpbmEgcXVlIGrDoSBlc3TDoSBubyBhci4gVXNlIHVtYSBww6FnaW5hIGZlaXRhIGRvIG1lc21vIG1vZGVsbyBvdSBvdXRybyBkb23DrW5pby4nXSk7CiAgfQogICRuID0gMDsga3NvcnQoJGZpbGVzKTsKICBmb3JlYWNoICgkZmlsZXMgYXMgJHAgPT4gJGUpIHsKICAgICRkc3QgPSAkcm9vdCAuICRwOyAkZGQgPSBkaXJuYW1lKCRkc3QpOwogICAgaWYgKCFpc19kaXIoJGRkKSAmJiAhQG1rZGlyKCRkZCwgMDc1NSwgdHJ1ZSkpIG91dCgyMDAsIFsnb2snID0+IDAsICdlcnJvcicgPT4gJ07Do28gY29uc2VndWkgY3JpYXIgYSBwYXN0YSAnIC4gZGlybmFtZSgkcCkgLiAnIG5vIHNlcnZpZG9yLiddKTsKICAgICR0bXAgPSAkZHN0IC4gJy5zbHRtcCc7CiAgICBpZiAoIUBjb3B5KGJsb2IoJGVbMV0pLCAkdG1wKSB8fCAoaW50KWZpbGVzaXplKCR0bXApICE9PSAoaW50KSRlWzBdKSB7IEB1bmxpbmsoJHRtcCk7IG91dCgyMDAsIFsnb2snID0+IDAsICdlcnJvcicgPT4gJ0ZhbGhhIGFvIGdyYXZhciAnIC4gJHAgLiAnIG5vIHNlcnZpZG9yIChzZW0gZXNwYcOnbyBvdSBzZW0gcGVybWlzc8OjbykuJ10pOyB9CiAgICBpZiAoIUByZW5hbWUoJHRtcCwgJGRzdCkpIHsgQHVubGluaygkZHN0KTsgaWYgKCFAcmVuYW1lKCR0bXAsICRkc3QpKSB7IEB1bmxpbmsoJHRtcCk7IG91dCgyMDAsIFsnb2snID0+IDAsICdlcnJvcicgPT4gJ0ZhbGhhIGFvIGdyYXZhciAnIC4gJHAgLiAnIG5vIHNlcnZpZG9yLiddKTsgfSB9CiAgICAkbisrOwogIH0KICBpZiAoIWlzX2RpcigkbWRpcikpIEBta2RpcigkbWRpciwgMDc1NSwgdHJ1ZSk7CiAgZmlsZV9wdXRfY29udGVudHMoJG1kaXIgLiAnL19zbF9wdWIuanNvbicsIGpzb25fZW5jb2RlKFsndG9rZW4nID0+ICR0b2ssICdhdCcgPT4gcm91bmQobWljcm90aW1lKHRydWUpICogMTAwMCksICdvd25lcicgPT4gJG9pZCwgJ25hbWUnID0+ICRvbm1dLCBKU09OX1VORVNDQVBFRF9VTklDT0RFKSk7CiAgb3V0KDIwMCwgWydvaycgPT4gMSwgJ24nID0+ICRuXSk7Cn0Kb3V0KDQwNCwgWydvaycgPT4gMCwgJ2Vycm9yJyA9PiAnYWNhbyddKTsK','base64').toString('utf8');
ipcMain.handle('shttp',(_,{url,method,headers,b64,timeout})=>new Promise((res,rej)=>{try{const U=new URL(url),M=require(U.protocol=='http:'?'http':'https');const body=b64?Buffer.from(b64,'base64'):null;const h=Object.assign({'User-Agent':'Mozilla/5.0 SharkLab-Sync','Accept':'*/*'},headers||{});if(body)h['Content-Length']=body.length;const rq=M.request(U,{method:method||'GET',headers:h,timeout:timeout||60000},r=>{const ch=[];r.on('data',c=>ch.push(c));r.on('end',()=>res({status:r.statusCode,headers:r.headers,b64:Buffer.concat(ch).toString('base64')}));r.on('error',e=>rej(new Error(String(e.code||e.message))))});rq.on('timeout',()=>{rq.destroy(new Error('tempo esgotado'))});rq.on('error',e=>rej(new Error(e.code=='ENOTFOUND'?'não achei o endereço do servidor':e.code=='ECONNREFUSED'?'o servidor recusou a conexão':e.code=='CERT_HAS_EXPIRED'||/certificate/i.test(e.message||'')?'certificado do site inválido ou ainda não ativo':String(e.code&&e.code!='ECONNRESET'?e.code:e.message||e))));if(body)rq.write(body);rq.end()}catch(e){rej(e)}}));
const SFH=new Map();
const sfDir=id=>{const d=path.resolve(MD(),String(id));if(!/^[A-Za-z0-9_-]{1,64}$/.test(String(id))||path.dirname(d)!==path.resolve(MD()))throw new Error('id inválido');return d};
const sfFile=(id,p)=>{const d=sfDir(id),f=path.resolve(d,'.'+String(p).replace(/\\/g,'/'));if(!f.startsWith(d+path.sep))throw new Error('caminho inválido');return f};
const sfHash=f=>new Promise((res,rej)=>{const h=crypto.createHash('sha1'),s=fs.createReadStream(f);s.on('data',c=>h.update(c));s.on('end',()=>res(h.digest('hex')));s.on('error',rej)});
ipcMain.handle('sfList',async(_,id)=>{const d=sfDir(id),out=[];if(!fs.existsSync(d))return out;const walk=async rel=>{let ls;try{ls=fs.readdirSync(path.join(d,rel),{withFileTypes:true})}catch{return}for(const e of ls){const r=rel+'/'+e.name;if(/^\/_sl_bak/.test(r)||/\.sltmp$/.test(r))continue;if(e.isDirectory())await walk(r);else if(e.isFile()){const f=path.join(d,r),st=fs.statSync(f),k=f+'|'+st.size+'|'+st.mtimeMs;let h=SFH.get(k);if(!h){h=await sfHash(f);SFH.set(k,h);if(SFH.size>20000)SFH.clear()}out.push({p:r,s:st.size,h})}}};await walk('');out.sort((a,b)=>a.p<b.p?-1:1);return out});
ipcMain.handle('sfRead',async(_,{id,p,off,len})=>{const f=sfFile(id,p),fd=fs.openSync(f,'r');try{const b=Buffer.alloc(len),n=fs.readSync(fd,b,0,len,off);return{b64:b.subarray(0,n).toString('base64')}}finally{fs.closeSync(fd)}});
ipcMain.handle('sfWrite',async(_,{id,p,b64,off,total,h})=>{try{const f=sfFile(id,p),t=f+'.sltmp',buf=Buffer.from(b64||'','base64');fs.mkdirSync(path.dirname(f),{recursive:true});if(!off)fs.writeFileSync(t,buf);else fs.appendFileSync(t,buf);if((off||0)+buf.length>=total){if(h&&await sfHash(t)!==h){try{fs.unlinkSync(t)}catch{}return{ok:false,error:'arquivo corrompido na transferência'}}fs.renameSync(t,f);return{ok:true,done:true}}return{ok:true}}catch(e){return{ok:false,error:String(e.message)}}});
ipcMain.handle('sfRm',async(_,{id,p})=>{try{const f=sfFile(id,p);fs.rmSync(f,{force:true});const d=sfDir(id);let q=path.dirname(f);while(q.startsWith(d+path.sep)){try{fs.rmdirSync(q)}catch{break}q=path.dirname(q)}return{ok:true}}catch(e){return{ok:false,error:String(e.message)}}});
ipcMain.handle('sfInstall',async(_,{h,dir,folder,key})=>{const ftp=require('basic-ftp'),{Readable}=require('stream');if(!/^_sl_[a-f0-9]{8}$/.test(String(folder||''))||String(key||'').length<20)return{ok:false,error:'dados inválidos'};const base=String(dir||'').trim().replace(/\\/g,'/').replace(/\/+$/,'');if(!base||base=='/')return{ok:false,error:'pasta do domínio inválida'};const kh=crypto.createHash('sha256').update(String(key)).digest('hex'),dd='d_'+crypto.createHash('sha256').update(String(key)+'dir').digest('hex').slice(0,12);const F={'api.php':HUBPHP,'config.php':"<?php return ['kh'=>'"+kh+"','dir'=>'"+dd+"'];\n",'.htaccess':"Options -Indexes\n",'index.html':''};
for(let t=1;t<=3;t++){const c=new ftp.Client(60000);try{await c.access(ftpOpts(h));await c.ensureDir(base+'/'+folder);for(const n in F)await c.uploadFrom(Readable.from([Buffer.from(F[n])]),n);return{ok:true}}catch(e){if(t==3)return{ok:false,error:ftpErr(e)};await sl(1200*t)}finally{c.close()}}});
ipcMain.handle('probe',async(_,{url,wait})=>{const w=new BrowserWindow({show:false,width:1280,height:900,webPreferences:{offscreen:true,backgroundThrottling:false,partition:'probe'+Date.now()}}),logs=[],bad=[],S=[];
const snap=async()=>{try{return await w.webContents.executeJavaScript("({u:location.href,t:((document.body&&document.body.innerText)||'').replace(/\\s+/g,' ').trim().slice(0,240),n:document.getElementsByTagName('*').length})")}catch(e){return{u:'',t:'',n:0,e:String(e.message||e)}}};
try{w.webContents.on('console-message',(e,l,m)=>{if(l>=2||/404|not found/i.test(m))logs.push(String(m).slice(0,200))});w.webContents.session.webRequest.onCompleted(d=>{if(d.statusCode>=400)bad.push(d.statusCode+' '+String(d.url).slice(0,140))});
let loadErr='';try{await Promise.race([w.loadURL(url),sl(20000).then(()=>{throw new Error('tempo esgotado')})])}catch(e){loadErr=String(e.message||e)}
await sl(600);S.push(await snap());await sl(Math.max(1500,(wait||4500)-600));const last=await snap();const raw=await httpGet(url);
return{ok:!loadErr||S[0].n>0,loadErr,first:S[0],last,logs:logs.slice(0,6),bad:bad.slice(0,8),html:raw&&raw.body?raw.body.slice(0,1400):'',status:raw&&raw.status||0}}catch(e){return{ok:false,loadErr:String(e.message||e)}}finally{try{w.destroy()}catch{}}});
ipcMain.handle('hzip',async(_,{mirror,inject,ops,name,steps})=>{try{const F=filesStatic(mirror,inject,ops,steps),w=BrowserWindow.getFocusedWindow()||BrowserWindow.getAllWindows()[0];const r=await dialog.showSaveDialog(w,{title:'Salvar o site',defaultPath:(name||'site')+'.zip',filters:[{name:'Zip',extensions:['zip']}]});if(r.canceled||!r.filePath)return{ok:true,cancel:true};fs.writeFileSync(r.filePath,zipBuf(F));return{ok:true,path:r.filePath}}catch(e){return{ok:false,error:String(e.message||e)}}});
module.exports={siteFiles,zipBuf,funnelFiles,speedRun,filesStatic,pathFiles};
app.on('web-contents-created',(_,wc)=>{wc.on('context-menu',(e,p)=>{try{if(wc.getType()=='offscreen')return;const f=p.editFlags||{},ed=!!p.isEditable,sel=!!String(p.selectionText||'').trim();if(!ed&&!sel)return;const T=ed?[{label:'Desfazer',role:'undo',enabled:!!f.canUndo},{label:'Refazer',role:'redo',enabled:!!f.canRedo},{type:'separator'},{label:'Recortar',role:'cut',enabled:!!f.canCut},{label:'Copiar',role:'copy',enabled:!!f.canCopy},{label:'Colar',role:'paste',enabled:!!f.canPaste},{label:'Colar sem formatação',role:'pasteAndMatchStyle',enabled:!!f.canPaste},{type:'separator'},{label:'Selecionar tudo',role:'selectAll',enabled:!!f.canSelectAll}]:[{label:'Copiar',role:'copy',enabled:!!f.canCopy},{type:'separator'},{label:'Selecionar tudo',role:'selectAll'}];Menu.buildFromTemplate(T).popup({window:BrowserWindow.fromWebContents(wc)||undefined})}catch{}})});
