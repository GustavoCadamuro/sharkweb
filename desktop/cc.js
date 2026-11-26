'use strict';
/* v63.74: chat com o Claude Code do próprio PC (sem API). Roda "claude -p" dentro da pasta da página,
   só com ferramentas de arquivo (ler/editar). Guarda cópia antes de cada alteração para o botão Desfazer. */
const{spawn,execFile}=require('child_process');const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto');

const TEXT=/\.(html?|css|js|mjs|json|svg|txt|xml|map)$/i,SKIP=/^(_sl|node_modules$|\.git$)/i,MAXT=3e6;
const SYS=`Você edita a página de vendas do usuário dentro do app Shark Lab. A sua pasta de trabalho é a pasta da página (o arquivo principal é index.html ou o HTML indicado na mensagem). O usuário não é técnico.
Regras:
- Responda em português do Brasil, bem curto (1 a 3 frases), dizendo o que mudou, sem jargão.
- Leia o arquivo antes de editar: ele pode ter mudado desde a última mensagem. Faça só o que foi pedido, com a menor edição possível, e preserve o resto exatamente como está (scripts, pixels, links de checkout, ids, classes).
- Se vier um bloco <selecionado>, o pedido é sobre esse elemento.
- Não apague nem renomeie arquivos, não crie arquivos sem necessidade e não mexa em arquivos que começam com _sl.
- Mantenha a página responsiva (celular primeiro). Use valores de CSS concretos (cores hex, px/rem).
- Se faltar informação para fazer certo, pergunte em vez de adivinhar. Nunca invente links, preços, depoimentos ou imagens: use só o que já existe na pasta ou o que o usuário indicar.
- Você não executa comandos e não acessa a internet.`;

const uuid=()=>crypto.randomUUID();
const cleanEnv=()=>{const e=Object.assign({},process.env);for(const k of['ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','CLAUDE_CODE_USE_BEDROCK','CLAUDE_CODE_USE_VERTEX','CLAUDE_CODE_USE_FOUNDRY','ELECTRON_RUN_AS_NODE'])delete e[k];e.NO_COLOR='1';return e};

function candidates(){
  if(process.env.SL_CLAUDE_BIN)return[process.env.SL_CLAUDE_BIN];
  const L=[],h=os.homedir();
  if(process.platform=='win32'){
    L.push(path.join(h,'.local','bin','claude.exe'));
    if(process.env.LOCALAPPDATA)L.push(path.join(process.env.LOCALAPPDATA,'Programs','claude','claude.exe'),path.join(process.env.LOCALAPPDATA,'AnthropicClaude','claude.exe'));
    if(process.env.APPDATA)L.push(path.join(process.env.APPDATA,'npm','claude.cmd'));
    L.push('claude','claude.cmd');
  }else L.push(path.join(h,'.local','bin','claude'),'/usr/local/bin/claude','/opt/homebrew/bin/claude','claude');
  return L;
}
const needShell=b=>process.platform=='win32'&&/\.(cmd|bat)$/i.test(b);
function exec1(bin,args,ms){return new Promise(res=>{let out='',err='',done=0;const fin=r=>{if(done)return;done=1;clearTimeout(t);res(r)};let p;try{p=spawn(bin,args,{env:cleanEnv(),windowsHide:true,shell:needShell(bin)})}catch(e){return res({ok:false,err:String(e.message)})}
  const t=setTimeout(()=>{try{p.kill()}catch{}fin({ok:false,err:'tempo esgotado',out,time:1})},ms||10000);
  p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',e=>fin({ok:false,err:String(e.code||e.message),out,nf:e.code=='ENOENT'}));p.on('close',c=>fin({ok:c===0,out,err,code:c}))})}

let BIN=null;
async function findBin(force){
  if(BIN&&!force)return BIN;
  for(const b of candidates()){if(path.isAbsolute(b)&&!fs.existsSync(b))continue;const r=await exec1(b,['--version'],12000);if(r.ok&&/\d+\.\d+/.test(r.out)){BIN={bin:b,version:(r.out.match(/\d+\.\d+[\w.\-]*/)||[''])[0]};return BIN}}
  return null}
async function status(){
  const b=await findBin(1);if(!b)return{installed:false};
  let logged=null;const r=await exec1(b.bin,['auth','status'],15000);
  if(r.out){try{const j=JSON.parse(r.out);logged=j.loggedIn===true?true:j.loggedIn===false?false:null}catch{if(/not logged|logged out/i.test(r.out+r.err))logged=false;else if(/logged in/i.test(r.out))logged=true}}
  if(logged==null&&!r.ok&&/not logged|login/i.test(r.err||''))logged=false;
  return{installed:true,version:b.version,loggedIn:logged}}

/* ---- cópias de segurança ---- */
function walk(dir,rel,out){let l;try{l=fs.readdirSync(path.join(dir,rel),{withFileTypes:true})}catch{return out}for(const f of l){if(SKIP.test(f.name))continue;const r=rel?rel+'/'+f.name:f.name;if(f.isDirectory())walk(dir,r,out);else if(f.isFile())out.push(r)}return out}
const hashOf=b=>crypto.createHash('sha1').update(b).digest('hex');
function snapshot(dir,bkDir){const files={};fs.mkdirSync(path.join(bkDir,'files'),{recursive:true});
  for(const r of walk(dir,'',[])){const fp=path.join(dir,r);let st;try{st=fs.statSync(fp)}catch{continue}
    if(TEXT.test(r)&&st.size<=MAXT){const b=fs.readFileSync(fp);files[r]={t:1,h:hashOf(b)};const o=path.join(bkDir,'files',r);fs.mkdirSync(path.dirname(o),{recursive:true});fs.writeFileSync(o,b)}
    else files[r]={t:0,s:st.size}}
  return files}
function diffSnap(dir,files){const now={};for(const r of walk(dir,'',[])){const fp=path.join(dir,r);let st;try{st=fs.statSync(fp)}catch{continue}now[r]=st}
  const ch=[];for(const r of Object.keys(now)){const o=files[r];if(!o){ch.push(r);continue}if(o.t){if(now[r].size>MAXT){ch.push(r);continue}let b;try{b=fs.readFileSync(path.join(dir,r))}catch{continue}if(hashOf(b)!==o.h)ch.push(r)}else if(now[r].size!==o.s)ch.push(r)}
  for(const r of Object.keys(files))if(!now[r])ch.push(r);return ch}

module.exports=function setup(ipcMain,H){
  const BK=()=>path.join(H.userData(),'ccbak'),RUN=new Map();
  const send=(wc,o)=>{try{if(!wc.isDestroyed())wc.send('cc:evt',o)}catch{}};
  const okId=id=>/^[\w-]{2,40}$/.test(String(id||''));
  ipcMain.handle('cc:status',async()=>{try{return await status()}catch(e){return{installed:false,error:String(e.message||e)}}});
  ipcMain.handle('cc:cancel',(_,{id})=>{const r=RUN.get(id);if(!r)return{ok:true};r.canceled=1;kill(r.p);return{ok:true}});
  function kill(p){if(!p)return;try{if(process.platform=='win32')spawn('taskkill',['/pid',String(p.pid),'/T','/F'],{windowsHide:true});else p.kill('SIGTERM')}catch{}}

  ipcMain.handle('cc:run',async(e,{id,prompt,sid,html,ops,keep,sel,rid})=>{
    if(!okId(id))return{ok:false,error:'página inválida'};if(RUN.has(id))return{ok:false,error:'Já estou trabalhando nesta página. Espere terminar.'};
    const dir=path.join(H.MD(),id);if(!fs.existsSync(dir))return{ok:false,error:'Página não encontrada.'};
    const b=await findBin();if(!b)return{ok:false,needInstall:1};
    const wc=e.sender,stamp=Date.now()+'-'+Math.random().toString(36).slice(2,6),bkDir=path.join(BK(),id,stamp);
    const main=H.mainHtml(dir);if(!main)return{ok:false,error:'Esta página não tem HTML.'};
    let files,FLAT=false;try{files=snapshot(dir,bkDir);const flat=typeof html=='string'&&html.length>200&&Array.isArray(ops)&&ops.length>0&&Array.isArray(keep)&&keep.length<ops.length;fs.writeFileSync(path.join(bkDir,'list.json'),JSON.stringify(Object.keys(files)));fs.writeFileSync(path.join(bkDir,'meta.json'),JSON.stringify({ops:flat?ops:null,time:Date.now(),prompt:String(prompt||'').slice(0,200)}));FLAT=flat}catch(er){try{fs.rmSync(bkDir,{recursive:true,force:true})}catch{}return{ok:false,error:'Não consegui guardar a cópia de segurança: '+String(er.message||er)}}
    const opsF=path.join(dir,'_sl_ops.json');
    /* edições visuais pendentes: a página como está na tela (com elas aplicadas) vira o arquivo principal e a lista zera */
    if(FLAT){try{fs.writeFileSync(dir+main,html);fs.writeFileSync(opsF,JSON.stringify(keep));const m=main.replace(/^\//,'');if(files[m]&&files[m].t)files[m].h=hashOf(fs.readFileSync(dir+main))}catch(er){try{fs.rmSync(bkDir,{recursive:true,force:true})}catch{}return{ok:false,error:String(er.message||er)}}}
    const sysF=path.join(H.userData(),'cc-sys.txt');try{fs.writeFileSync(sysF,SYS)}catch{}
    const msg=`[Arquivo principal: ${main.replace(/^\//,'')}]\n\n`+String(prompt||'')+(sel?`\n\n<selecionado>\n${String(sel).slice(0,6000)}\n</selecionado>`:'');
    let sessionId=sid&&/^[0-9a-f-]{36}$/i.test(sid)?sid:uuid(),resume=!!(sid&&/^[0-9a-f-]{36}$/i.test(sid));
    const once=(useResume)=>new Promise(res=>{
      const args=['-p','--output-format','stream-json','--verbose','--include-partial-messages','--permission-mode','acceptEdits','--tools','Read,Edit,Write,Glob,Grep','--strict-mcp-config','--disable-slash-commands','--max-turns','40','--append-system-prompt-file',sysF].concat(useResume?['--resume',sessionId]:['--session-id',sessionId]);
      let p;try{p=spawn(b.bin,args,{cwd:dir,env:cleanEnv(),windowsHide:true,shell:needShell(b.bin),stdio:['pipe','pipe','pipe']})}catch(er){return res({err:String(er.message||er)})}
      const st={p,canceled:0};RUN.set(id,st);let buf='',err='',final=null,text='',lim=null;const tm=setTimeout(()=>{st.timeout=1;kill(p)},12*60*1000);
      const line=l=>{if(!l.trim())return;let o;try{o=JSON.parse(l)}catch{return}
        if(o.type=='stream_event'&&o.event&&o.event.type=='content_block_delta'&&o.event.delta&&o.event.delta.type=='text_delta'){text+=o.event.delta.text;send(wc,{rid,k:'delta',t:o.event.delta.text})}
        else if(o.type=='stream_event'&&o.event&&o.event.type=='message_start'){if(text&&!/\n$/.test(text)){text+='\n\n';send(wc,{rid,k:'delta',t:'\n\n'})}}
        else if(o.type=='assistant'&&o.message&&Array.isArray(o.message.content)){for(const c of o.message.content)if(c.type=='tool_use'){const i=c.input||{};send(wc,{rid,k:'tool',n:c.name,f:path.basename(String(i.file_path||i.path||i.pattern||''))})}}
        else if(o.type=='rate_limit_event'&&o.rate_limit_info&&/reject|exceed|limit_reached/i.test(String(o.rate_limit_info.status||'')))lim=o.rate_limit_info;
        else if(o.type=='result')final=o};
      p.stdout.on('data',d=>{buf+=d;let i;while((i=buf.indexOf('\n'))>=0){line(buf.slice(0,i));buf=buf.slice(i+1)}});
      p.stderr.on('data',d=>{err+=d});
      p.on('error',er=>{clearTimeout(tm);RUN.delete(id);res({err:String(er.code=='ENOENT'?'não encontrei o claude':er.message),needInstall:er.code=='ENOENT'})});
      p.on('close',code=>{clearTimeout(tm);if(buf.trim())line(buf);RUN.delete(id);res({code,final,err,text,lim,canceled:st.canceled,timeout:st.timeout})});
      try{p.stdin.on('error',()=>{});p.stdin.end(msg)}catch{}});
    let r=await once(resume);
    if(resume&&r&&!r.canceled&&r.final&&r.final.is_error&&/no conversation found|session/i.test(String(r.final.result||r.err||''))&&!(r.text||'').trim()){sessionId=uuid();resume=false;r=await once(false)}
    /* nada de mexer nos arquivos internos do Shark Lab */
    const changed=diffSnap(dir,files),out={ok:true,sid:sessionId,changed:changed.slice(0,40),n:changed.length,bk:(changed.length||FLAT)?stamp:null,flat:FLAT,main};
    if(!changed.length&&!FLAT){try{fs.rmSync(bkDir,{recursive:true,force:true})}catch{}}
    else{try{const L=fs.readdirSync(path.join(BK(),id)).sort();while(L.length>15){fs.rmSync(path.join(BK(),id,L.shift()),{recursive:true,force:true})}}catch{}}
    if(r.err&&!r.final&&r.needInstall){out.ok=false;out.needInstall=1;return out}
    if(r.canceled){out.canceled=1;out.text=(r.text||'').trim();return out}
    if(r.timeout){out.error='Demorou demais e eu parei. O que já foi feito foi mantido; você pode desfazer.';return out}
    const fin=r.final,errTxt=String((fin&&fin.result)||'')+' '+String(r.err||'');
    if(!fin){out.error=/not logged|\/login|log in/i.test(errTxt)?'':(String(r.err||'').trim().split('\n').slice(-2).join(' ').slice(0,220)||'O Claude não respondeu.');if(/not logged|\/login|log in/i.test(errTxt))out.needLogin=1;return out}
    if(fin.is_error){if(/not logged|\/login|invalid api key|authentication|credentials/i.test(errTxt))out.needLogin=1;else if(r.lim||/limit|usage|quota|overload|rate/i.test(errTxt))out.limit=1;else out.error=String(fin.result||'Erro do Claude').slice(0,220);out.text=(r.text||'').trim();return out}
    out.text=String(fin.result||r.text||'').trim();return out});

  ipcMain.handle('cc:undo',(_,{id,bk})=>{try{if(!okId(id)||!/^[\w-]+$/.test(String(bk||'')))return{ok:false,error:'cópia inválida'};
    const bkDir=path.join(BK(),id,bk),mf=path.join(bkDir,'meta.json');if(!fs.existsSync(mf))return{ok:false,error:'Não tenho mais a cópia desta alteração.'};
    const meta=JSON.parse(fs.readFileSync(mf,'utf8')),dir=path.join(H.MD(),id);if(!fs.existsSync(dir))return{ok:false,error:'Página não encontrada.'};
    const was=walk(path.join(bkDir,'files'),'',[]),wasSet=new Set(was);
    for(const r of was){const o=path.join(dir,r);fs.mkdirSync(path.dirname(o),{recursive:true});fs.copyFileSync(path.join(bkDir,'files',r),o)}
    /* arquivos de texto criados depois da cópia saem; os que não são texto nunca foram tocados */
    let snapList=null;try{snapList=JSON.parse(fs.readFileSync(path.join(bkDir,'list.json'),'utf8'))}catch{}
    if(snapList)for(const r of walk(dir,'',[]))if(!snapList.includes(r)){try{fs.rmSync(path.join(dir,r),{force:true})}catch{}}
    if(Array.isArray(meta.ops))fs.writeFileSync(path.join(dir,'_sl_ops.json'),JSON.stringify(meta.ops));fs.rmSync(bkDir,{recursive:true,force:true});return{ok:true,ops:Array.isArray(meta.ops)?meta.ops:null}}catch(e){return{ok:false,error:String(e.message||e)}}});
};
module.exports._t={snapshot,diffSnap,walk};
