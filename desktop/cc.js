'use strict';
/* v63.74: chat com o Claude Code do próprio PC (sem API). Roda "claude -p" dentro da pasta da página,
   só com ferramentas de arquivo (ler/editar). Guarda cópia antes de cada alteração para o botão Desfazer. */
const{spawn,execFile}=require('child_process');const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto');

const TEXT=/\.(html?|css|js|mjs|json|svg|txt|xml|map)$/i,SKIP=/^(_sl|node_modules$|\.git$)/i,MAXT=3e6;
const SYS=`Você edita a página de vendas do usuário dentro do app Shark Lab. A sua pasta de trabalho é a pasta da página (o arquivo principal é index.html ou o HTML indicado na mensagem). O usuário não é técnico.
Regras:
- Responda em português do Brasil, bem curto (1 a 3 frases), dizendo o que mudou, sem jargão.
- Leia o arquivo antes de editar: ele pode ter mudado desde a última mensagem. Faça só o que foi pedido, com a menor edição possível, e preserve o resto exatamente como está (scripts, pixels, links de checkout, ids, classes).
- Se vier uma lista de imagens anexadas, olhe cada uma com Read e use só como referência visual (nunca copie para a página). Se vier um bloco <selecionado>, o pedido é sobre esse elemento.
- Não apague nem renomeie arquivos, não crie arquivos sem necessidade e não mexa em arquivos que começam com _sl.
- Mantenha a página responsiva (celular primeiro). Use valores de CSS concretos (cores hex, px/rem).
- Se faltar informação para fazer certo, pergunte em vez de adivinhar. Nunca invente links, preços, depoimentos ou imagens: use só o que já existe na pasta ou o que o usuário indicar.
- Reduzir o peso (KB) das imagens é feito pelo próprio app, antes de você. Nunca diga que isso não é possível: se vier uma informação do app sobre isso, comente em uma frase.
- Antes de dizer que mudou algo, releia o trecho editado e confirme que a mudança está lá. Use o MAPA DA PÁGINA da mensagem como ponto de partida, mas confirme lendo os arquivos. Procure TODOS os lugares que controlam aquilo (CSS, estilos inline, scripts inline, arquivos .js e .css da pasta, opções de bibliotecas como Swiper/Splide/Slick). Ex.: a velocidade de um carrossel pode estar em animation-duration, em setInterval/autoplay ou em transition: mude onde realmente vale.
- O usuário também faz edições visuais no editor; elas ficam guardadas à parte e valem por cima do HTML. Se uma mudança sua pode não aparecer por isso, avise em vez de afirmar que mudou.
- Cuidado máximo para não quebrar a página: nunca deixe tag, aspas, chaves, <script>, <style> ou comentário sem fechar; não apague scripts que você não entendeu. A página não pode ficar em branco nem travar (nada de laços infinitos, timers de poucos milissegundos ou animações pesadas).
Especialista em páginas que vendem: quando o usuário pedir para criar, melhorar, reescrever ou "deixar mais vendedor/bonito", trabalhe como um redator e designer de resposta direta de altíssimo nível para infoprodutos no Brasil (front, upsell, downsell, obrigado). Num pedido pontual (trocar cor, tamanho, velocidade...), faça só o ajuste, sem redesenhar nada.
- Antes de escrever, entenda produto, público, maior dor e promessa; se faltar isso e for decisivo, pergunte uma vez, curto.
- Copy: título com produto + resultado concreto; uma ideia por seção; frases curtas; dores específicas do dia a dia e benefícios (não recursos); quebra de objeções (preço, medo de não conseguir, tempo); prova concreta (o que a pessoa recebe, como funciona em 3 passos); garantia e perguntas frequentes; preço com âncora ("De R$ X por R$ Y"), pagamento único e conta por unidade quando ajudar; urgência só se for real. Botões com verbo, curtos, que caibam no celular. Nunca invente depoimentos, números, resultados, preços ou links.
- Cada tipo tem sua abordagem: FRONT (promessa, mostrar o produto por dentro logo no começo, dores, como funciona, bônus, pacotes, garantia, perguntas, chamada final); UPSELL (continuação natural do que ele acabou de comprar, um benefício central, lista do que entra no pedido, aceitar em destaque e recusar discreto e respeitoso); DOWNSELL (oferta menor ou desconto visual, curta, sem repetir o upsell); OBRIGADO (confirmar, próximos passos claros, acesso, suporte, sem distrair).
- Design: celular primeiro; muito espaço entre seções (cerca de 80px) e cartões com cantos arredondados; poucas cores harmônicas (uma cor de marca, uma de ação, neutros) com contraste forte para leitura; hierarquia clara (título grande, subtítulo menor, texto confortável com 16px ou mais); botão principal grande, repetido ao longo da página, com a mesma cor de ação; alinhamentos e espaçamentos consistentes; ícones em SVG de linha; animações leves e sem travar; respeite o estilo e as cores que a página já tem, a não ser que ele peça outro.
- Onde faltar imagem real, deixe um quadro claro para o usuário colocar a dele em vez de inventar. Checkout: mantenha os links e códigos de compra que já existem, intactos; links novos ficam com href="#".
- Você não executa comandos e não acessa a internet.
- Memória: se o usuário disser uma preferência que deve valer sempre daqui para frente (ex.: "sempre", "nunca", "de agora em diante", "lembre que", "eu prefiro"), termine a resposta com uma última linha exatamente assim: MEMORIA: <regra curta em português>. Só faça isso quando ele disser claramente; nunca para pedidos pontuais e nunca invente preferências.`;

const uuid=()=>crypto.randomUUID();
/* tira do HTML as pecinhas do editor (alca de arrastar etc.) que nunca devem ir para a pagina */
function cleanJunk(h){if(typeof h!='string'||h.indexOf('id="__mv')<0&&h.indexOf("id='__mv")<0)return h;
  const re=/<div\b[^>]*\bid=["']__mv[hgl]["'][^>]*>/gi;let m,out='',last=0;
  while((m=re.exec(h))){out+=h.slice(last,m.index);let d=1,i=m.index+m[0].length;const t=/<(\/?)div\b[^>]*>/gi;t.lastIndex=i;let x;while(d>0&&(x=t.exec(h))){d+=x[1]?-1:1;i=t.lastIndex}last=i;re.lastIndex=i}
  return out+h.slice(last)}
const EFF={low:1,medium:1,high:1,xhigh:1,max:1};
const memLoad=f=>{try{const a=JSON.parse(fs.readFileSync(f,'utf8'));return Array.isArray(a)?a.filter(x=>typeof x=='string'&&x.trim()).slice(0,40):[]}catch{return[]}};
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

function restoreBk(dir,bkDir){const was=walk(path.join(bkDir,'files'),'',[]);
  for(const r of was){const o=path.join(dir,r);fs.mkdirSync(path.dirname(o),{recursive:true});fs.copyFileSync(path.join(bkDir,'files',r),o)}
  let snapList=null;try{snapList=JSON.parse(fs.readFileSync(path.join(bkDir,'list.json'),'utf8'))}catch{}
  if(snapList)for(const r of walk(dir,'',[]))if(!snapList.includes(r)){try{fs.rmSync(path.join(dir,r),{force:true})}catch{}}}
/* a pagina "quebrou"? compara como ela carregava antes e depois da mudanca */
function brokenWhy(a,b){if(!a||!b)return'';
  if(b.load===0&&a.load!==0)return'a página não abre mais';
  const ne=(b.errs||[]).filter(x=>!(a.errs||[]).some(y=>y.slice(0,70)==x.slice(0,70))&&/Uncaught|SyntaxError|ReferenceError|TypeError|is not defined|Unexpected token|Cannot read/i.test(x));
  if(ne.length)return'erro novo no código: '+ne[0].slice(0,140);
  if(a.t>=15&&b.t===0)return'a página ficou em branco';
  if(a.vis>=2&&b.vis===0&&b.t<5)return'a página ficou em branco';
  if(a.t>80&&b.t<a.t*.35&&(b.h<a.h*.6||b.vis<a.vis*.6))return'o texto da página sumiu';
  if(a.h>400&&b.h<a.h*.35)return'a página ficou muito menor, como se tivesse sumido';
  if(a.vis>6&&b.vis<a.vis*.3)return'quase tudo ficou invisível';
  return''}

/* ---- mapa da página: onde ficam carrosséis, tempos e seções (para o Claude não procurar no escuro) ---- */
const SPEEDQ=/veloc|lent[oa]s?\b|devagar|r[áa]pid|acelera|mais calm|mais suave|tempo d[aeo]|segundos|animaç/i;
const TIMERE=[/animation(?:-duration|-delay)?\s*:[^;}{]*/gi,/transition(?:-duration|-delay)?\s*:[^;}{]*/gi,/--[\w-]*(?:speed|dur|time|delay|veloc|tempo)[\w-]*\s*:[^;}{]+/gi,/setInterval\s*\([\s\S]{0,300}?,\s*\d+\s*\)/gi,/setTimeout\s*\([\s\S]{0,300}?,\s*\d+\s*\)/gi,/\b(?:delay|speed|autoplay|duration|interval|autoplaySpeed|slidesPerView|pauseOnHover|loop)\s*:\s*(?:\{[^}]*\}|[\w.]+)/gi,/data-(?:interval|autoplay|speed|delay)\s*=\s*["'][^"']*["']/gi,/(?:scroll-behavior|animation-play-state|animation-timing-function)\s*:[^;}{]*/gi];
function textFiles(dir){const out=[];let tot=0;for(const r of walk(dir,'',[])){if(!/\.(html?|css|js|mjs)$/i.test(r))continue;let st;try{st=fs.statSync(path.join(dir,r))}catch{continue}if(st.size>1.5e6||tot>4e6)continue;tot+=st.size;try{out.push({r,t:fs.readFileSync(path.join(dir,r),'utf8')})}catch{}}return out}
function timings(files){const out=[];for(const f of files){for(const re of TIMERE){re.lastIndex=0;let m,n=0;while((m=re.exec(f.t))&&n++<200){const x=m[0].replace(/\s+/g,' ').trim();if(/\d/.test(x)||/linear|ease|infinite|loop|paused|running|smooth/i.test(x))out.push({f:f.r,x:x.slice(0,140),i:m.index})}}}return out}
function timingSig(dir){try{return hashOf(timings(textFiles(dir)).map(o=>o.f+'|'+o.x).sort().join('\n'))}catch{return''}}
function pageMap(dir,main){try{const files=textFiles(dir),mh=main.replace(/^\//,'');const L=[];
  const html=(files.find(f=>f.r==mh)||{t:''}).t,all=files.map(f=>f.t).join('\n');
  const libs=[];for(const [n,re] of [['Swiper',/swiper/i],['Splide',/splide/i],['Slick',/slick(?:-slider|\.min|\()/i],['Owl Carousel',/owl-?carousel/i],['Flickity',/flickity/i],['Glide',/glide\.js|new Glide/i],['Embla',/embla/i],['GSAP',/gsap/i],['AOS',/\baos\b/i]])if(re.test(all))libs.push(n);
  L.push('Arquivos: '+files.map(f=>f.r).slice(0,14).join(', '));
  if(libs.length)L.push('Bibliotecas: '+libs.join(', '));
  const car=new Set(),cre=/<([a-z0-9]+)\b[^>]*\b(?:id|class)=["']([^"']*(?:carousel|carrossel|slider|swiper|splide|slick|marquee|ticker|track|trk|slides?|reel|belt)[^"']*)["']/gi;let m;while((m=cre.exec(html))&&car.size<8)car.add('<'+m[1]+' '+(/id=/.test(m[0])&&m[0].match(/id=["']([^"']+)/)?'id="'+m[0].match(/id=["']([^"']+)/)[1]+'" ':'')+'class="'+m[2].slice(0,60)+'">');
  if(car.size)L.push('Carrosséis/faixas que se mexem: '+[...car].join(' ; '));
  const T=timings(files);const seen=new Set(),tl=[];for(const o of T){const k=o.f+o.x;if(seen.has(k))continue;seen.add(k);if(/^(transition|animation-timing|scroll-behavior)/i.test(o.x)&&!/\d+(\.\d+)?m?s/.test(o.x))continue;const before=files.find(f=>f.r==o.f).t.slice(Math.max(0,o.i-90),o.i);const sel=(before.match(/([^{};>]*)\{[^{}]*$/)||[])[1];tl.push('- '+o.f+(sel?' ['+sel.trim().replace(/\s+/g,' ').slice(0,50)+']':'')+': '+o.x);if(tl.length>=24)break}
  if(tl.length)L.push('Tempos, velocidades e animações encontrados (mude onde realmente vale):\n'+tl.join('\n'));
  const hs=[];const hre=/<h([12])\b[^>]*>([\s\S]*?)<\/h\1>/gi;while((m=hre.exec(html))&&hs.length<12){const t=m[2].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();if(t)hs.push(t.slice(0,60))}
  if(hs.length)L.push('Títulos da página, em ordem: '+hs.join(' | '));
  const nb=(html.match(/<(?:button|a)\b/gi)||[]).length,ni=(html.match(/<img\b/gi)||[]).length,nf=(html.match(/<form\b/gi)||[]).length;L.push('Tem '+nb+' botões/links, '+ni+' imagens, '+nf+' formulários.');
  try{const ops=JSON.parse(fs.readFileSync(path.join(dir,'_sl_ops.json'),'utf8'));if(Array.isArray(ops)&&ops.length)L.push('ATENÇÃO: o usuário fez '+ops.length+' edição(ões) visual(is) no editor, guardadas à parte (não estão no HTML) e valem por cima dele. Se o que ele pede pode ser afetado por isso, avise.')}catch{}
  return L.join('\n').slice(0,4800)}catch{return''}}
module.exports=function setup(ipcMain,H){
  const BK=()=>path.join(H.userData(),'ccbak'),RUN=new Map();
  const send=(wc,o)=>{try{if(!wc.isDestroyed())wc.send('cc:evt',o)}catch{}};
  const okId=id=>/^[\w-]{2,40}$/.test(String(id||''));
  ipcMain.handle('cc:status',async()=>{try{return await status()}catch(e){return{installed:false,error:String(e.message||e)}}});
  ipcMain.handle('cc:cancel',(_,{id})=>{const r=RUN.get(id);if(!r)return{ok:true};r.canceled=1;kill(r.p);return{ok:true}});
  function kill(p){if(!p)return;try{if(process.platform=='win32')spawn('taskkill',['/pid',String(p.pid),'/T','/F'],{windowsHide:true});else p.kill('SIGTERM')}catch{}}

  ipcMain.handle('cc:run',async(e,{id,prompt,sid,html,ops,keep,sel,rid,effort,imgs})=>{
    if(!okId(id))return{ok:false,error:'página inválida'};if(RUN.has(id))return{ok:false,error:'Já estou trabalhando nesta página. Espere terminar.'};
    const dir=path.join(H.MD(),id);if(!fs.existsSync(dir))return{ok:false,error:'Página não encontrada.'};
    const b=await findBin();if(!b)return{ok:false,needInstall:1};
    const wc=e.sender,stamp=Date.now()+'-'+Math.random().toString(36).slice(2,6),bkDir=path.join(BK(),id,stamp);
    const main=H.mainHtml(dir);if(!main)return{ok:false,error:'Esta página não tem HTML.'};
    try{const cur0=fs.readFileSync(dir+main,'utf8'),cl=cleanJunk(cur0);if(cl!==cur0)fs.writeFileSync(dir+main,cl)}catch{}
    let files,FLAT=false;try{files=snapshot(dir,bkDir);const flat=typeof html=='string'&&html.length>200&&Array.isArray(ops)&&ops.length>0&&Array.isArray(keep)&&keep.length<ops.length;fs.writeFileSync(path.join(bkDir,'list.json'),JSON.stringify(Object.keys(files)));fs.writeFileSync(path.join(bkDir,'meta.json'),JSON.stringify({ops:flat?ops:null,time:Date.now(),prompt:String(prompt||'').slice(0,200)}));FLAT=flat}catch(er){try{fs.rmSync(bkDir,{recursive:true,force:true})}catch{}return{ok:false,error:'Não consegui guardar a cópia de segurança: '+String(er.message||er)}}
    const opsF=path.join(dir,'_sl_ops.json');
    /* edições visuais pendentes: a página como está na tela (com elas aplicadas) vira o arquivo principal e a lista zera */
    if(FLAT){try{fs.writeFileSync(dir+main,cleanJunk(html));fs.writeFileSync(opsF,JSON.stringify(keep));const m=main.replace(/^\//,'');if(files[m]&&files[m].t)files[m].h=hashOf(fs.readFileSync(dir+main))}catch(er){try{fs.rmSync(bkDir,{recursive:true,force:true})}catch{}return{ok:false,error:String(er.message||er)}}}
    const memF=path.join(H.userData(),'cc-memoria.json'),mem=memLoad(memF);const sysF=path.join(H.userData(),'cc-sys.txt');try{fs.writeFileSync(sysF,SYS+(mem.length?'\n\nPreferências já combinadas com o usuário (siga sempre):\n'+mem.map(x=>'- '+x).join('\n'):''))}catch{}
    const imgDir=path.join(H.userData(),'ccimg',id+'-'+stamp),imgP=[];
    try{if(Array.isArray(imgs)&&imgs.length){fs.mkdirSync(imgDir,{recursive:true});imgs.slice(0,4).forEach((x,i)=>{const m=/^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/i.exec(String(x&&x.data||''));if(!m)return;const f=path.join(imgDir,'imagem'+(i+1)+'.'+(m[1].toLowerCase()=='jpeg'?'jpg':m[1].toLowerCase()));fs.writeFileSync(f,Buffer.from(m[2],'base64'));imgP.push(f)})}}catch{}
    const MAP=pageMap(dir,main),SIG0=timingSig(dir),speedQ=SPEEDQ.test(String(prompt||''));
    const msg=(imgP.length?`[O usuário anexou ${imgP.length} imagem(ns) para você olhar com a ferramenta Read: ${imgP.join(' ; ')}. São só referência visual: não copie para a página.]\n\n`:'')+`[Arquivo principal: ${main.replace(/^\//,'')}]\n\n`+(MAP?`<mapa_da_pagina>\n${MAP}\n</mapa_da_pagina>\n\n`:'')+String(prompt||'')+(sel?`\n\n<selecionado>\n${String(sel).slice(0,6000)}\n</selecionado>`:'');
    let sessionId=sid&&/^[0-9a-f-]{36}$/i.test(sid)?sid:uuid(),resume=!!(sid&&/^[0-9a-f-]{36}$/i.test(sid));
    const once=(useResume,m2)=>new Promise(res=>{
      const args=['-p','--output-format','stream-json','--verbose','--include-partial-messages','--permission-mode','acceptEdits','--tools','Read,Edit,Write,Glob,Grep','--strict-mcp-config','--disable-slash-commands','--max-turns','40','--append-system-prompt-file',sysF].concat(imgP.length?['--add-dir',imgDir]:[]).concat(EFF[effort]?['--effort',effort]:[]).concat(useResume?['--resume',sessionId]:['--session-id',sessionId]);
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
      try{p.stdin.on('error',()=>{});p.stdin.end(m2||msg)}catch{}});
    const rmImg=()=>{try{fs.rmSync(imgDir,{recursive:true,force:true})}catch{}};
    const baseP=H.probe?H.probe(id).catch(()=>null):Promise.resolve(null);
    let r=await once(resume);
    if(resume&&r&&!r.canceled&&r.final&&r.final.is_error&&/no conversation found|session/i.test(String(r.final.result||r.err||''))&&!(r.text||'').trim()){sessionId=uuid();resume=false;r=await once(false)}
    rmImg();
    /* nada de mexer nos arquivos internos do Shark Lab */
    const changed=diffSnap(dir,files),out={ok:true,sid:sessionId,changed:changed.slice(0,40),n:changed.length,bk:(changed.length||FLAT)?stamp:null,flat:FLAT,main};
    let reverted='',fixed=0,speedNo=0;
    if(speedQ&&!r.canceled&&!r.timeout&&r.final&&!r.final.is_error&&timingSig(dir)===SIG0){
      send(wc,{rid,k:'note',t:'Nenhum tempo mudou ainda. Procurando de novo onde a velocidade é controlada…'});
      const r3=await once(true,'ATENÇÃO: o pedido foi sobre velocidade/tempo, mas nenhum valor de tempo mudou nos arquivos da página (animation-duration, transition, setInterval, autoplay, speed, variáveis CSS...). Veja de novo o MAPA DA PÁGINA, abra os arquivos que controlam o movimento e mude de verdade, onde vale. Se for uma biblioteca, mude as opções dela. Se for impossível, explique o motivo em uma frase. Pedido do usuário: '+String(prompt||'').slice(0,400));
      if(r3&&r3.final&&!r3.final.is_error)r=r3;
      if(timingSig(dir)===SIG0)speedNo=1}
    {const c0=diffSnap(dir,files);changed.length=0;c0.forEach(x=>changed.push(x))}
    if(changed.length&&!r.canceled&&!r.timeout&&H.probe){
      send(wc,{rid,k:'note',t:'Conferindo se a página ficou certa…'});
      const base=await baseP;let post=await H.probe(id).catch(()=>null),why=brokenWhy(base,post);
      if(why){await new Promise(x=>setTimeout(x,1500));post=await H.probe(id).catch(()=>null);why=brokenWhy(base,post)}
      if(why){send(wc,{rid,k:'note',t:'Achei um problema ('+why+'). Corrigindo…'});
        const fixMsg='ATENÇÃO: depois da sua alteração a página ficou com problema ('+why+'). Corrija agora: reverta com cuidado o trecho que quebrou e refaça o pedido de forma segura, sem apagar o que já funcionava. Pedido original do usuário: '+String(prompt||'').slice(0,400);
        const r2=await once(true,fixMsg);if(r2&&r2.final&&!r2.final.is_error){r=r2}
        const ch2=diffSnap(dir,files);changed.length=0;ch2.forEach(x=>changed.push(x));
        post=await H.probe(id).catch(()=>null);why=brokenWhy(base,post);
        if(!why)fixed=1;
        else{try{restoreBk(dir,bkDir)}catch{}reverted=why;changed.length=0}}}
    out.n=changed.length;out.changed=changed.slice(0,40);out.bk=(changed.length||FLAT)?stamp:null;if(reverted)out.reverted=reverted;if(fixed)out.fixed=1;if(speedNo&&!reverted)out.speedNo=1;
    if(!changed.length&&!FLAT){try{fs.rmSync(bkDir,{recursive:true,force:true})}catch{}}
    else{try{const L=fs.readdirSync(path.join(BK(),id)).sort();while(L.length>15){fs.rmSync(path.join(BK(),id,L.shift()),{recursive:true,force:true})}}catch{}}
    if(r.err&&!r.final&&r.needInstall){out.ok=false;out.needInstall=1;return out}
    if(r.canceled){out.canceled=1;out.text=(r.text||'').trim();return out}
    if(r.timeout){out.error='Demorou demais e eu parei. O que já foi feito foi mantido; você pode desfazer.';return out}
    const learn=t=>{const L=[];t=String(t||'').replace(/^[ \t]*MEMORIA:[ \t]*(.+)$/gim,(_,x)=>{x=x.trim().slice(0,200);if(x)L.push(x);return''}).replace(/\n{3,}/g,'\n\n').trim();return{t,L}};
    const fin=r.final,errTxt=String((fin&&fin.result)||'')+' '+String(r.err||'');
    if(!fin){out.error=/not logged|\/login|log in/i.test(errTxt)?'':(String(r.err||'').trim().split('\n').slice(-2).join(' ').slice(0,220)||'O Claude não respondeu.');if(/not logged|\/login|log in/i.test(errTxt))out.needLogin=1;return out}
    if(fin.is_error){if(/not logged|\/login|invalid api key|authentication|credentials/i.test(errTxt))out.needLogin=1;else if(r.lim||/limit|usage|quota|overload|rate/i.test(errTxt))out.limit=1;else out.error=String(fin.result||'Erro do Claude').slice(0,220);out.text=(r.text||'').trim();return out}
    const lr=learn(fin.result||r.text||'');out.text=lr.t;if(lr.L.length){const cur=memLoad(memF),add=lr.L.filter(x=>!cur.some(c=>c.toLowerCase()==x.toLowerCase()));if(add.length){try{fs.writeFileSync(memF,JSON.stringify(cur.concat(add).slice(-40)));out.learned=add}catch{}}}
    return out});
  ipcMain.handle('cc:mem',()=>memLoad(path.join(H.userData(),'cc-memoria.json')));
  ipcMain.handle('cc:memdel',(_,{i})=>{const f=path.join(H.userData(),'cc-memoria.json'),a=memLoad(f);if(Number.isInteger(i)&&i>=0&&i<a.length)a.splice(i,1);try{fs.writeFileSync(f,JSON.stringify(a))}catch{}return a});
  /* ditado: abre o "Digitação por voz" do Windows (tecla Windows + H) no campo que está com o cursor */
  ipcMain.handle('cc:dictate',()=>new Promise(res=>{if(process.platform!='win32')return res({ok:false,error:'so no Windows'});
    const ps="Add-Type -Namespace W -Name K -MemberDefinition '[DllImport(\"user32.dll\")] public static extern void keybd_event(byte b, byte s, uint f, UIntPtr e);';[W.K]::keybd_event(0x5B,0,0,[UIntPtr]::Zero);[W.K]::keybd_event(0x48,0,0,[UIntPtr]::Zero);Start-Sleep -Milliseconds 60;[W.K]::keybd_event(0x48,0,2,[UIntPtr]::Zero);[W.K]::keybd_event(0x5B,0,2,[UIntPtr]::Zero)";
    try{const p=spawn('powershell.exe',['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-Command',ps],{windowsHide:true});p.on('error',()=>res({ok:false}));p.on('close',c=>res({ok:c===0}))}catch{res({ok:false})}}));

  ipcMain.handle('cc:undo',(_,{id,bk})=>{try{if(!okId(id)||!/^[\w-]+$/.test(String(bk||'')))return{ok:false,error:'cópia inválida'};
    const bkDir=path.join(BK(),id,bk),mf=path.join(bkDir,'meta.json');if(!fs.existsSync(mf))return{ok:false,error:'Não tenho mais a cópia desta alteração.'};
    const meta=JSON.parse(fs.readFileSync(mf,'utf8')),dir=path.join(H.MD(),id);if(!fs.existsSync(dir))return{ok:false,error:'Página não encontrada.'};
    restoreBk(dir,bkDir);
    if(Array.isArray(meta.ops))fs.writeFileSync(path.join(dir,'_sl_ops.json'),JSON.stringify(meta.ops));fs.rmSync(bkDir,{recursive:true,force:true});return{ok:true,ops:Array.isArray(meta.ops)?meta.ops:null}}catch(e){return{ok:false,error:String(e.message||e)}}});
};
module.exports._t={snapshot,diffSnap,walk,cleanJunk,pageMap,timingSig};module.exports.cleanJunk=cleanJunk;
