'use strict';
/* v63.80: secao Criativos (copy com o Claude do PC + edicao de audio/video) e analise da Biblioteca de Anuncios.
   Nada de API: usa o Claude Code ja instalado e o ffmpeg/whisper baixados uma vez. */
const{spawn}=require('child_process');const fs=require('fs'),path=require('path'),os=require('os'),zlib=require('zlib'),crypto=require('crypto');

const SYS=`Você é o diretor de criativos do usuário dentro do app Shark Lab: um redator e estrategista de resposta direta de altíssimo nível, especialista em anúncios de tráfego direto (Meta Ads/Facebook e Instagram, Reels, TikTok) que levam para página de vendas ou checkout, em qualquer nicho de infoprodutos e produtos digitais no Brasil. O usuário não é técnico e é expert em tráfego: quer resultado, não explicação.
Como trabalhar:
- Responda em português do Brasil, organizado e direto. Nada de textão: blocos curtos, títulos em negrito e listas só quando ajudam.
- Pense fundo antes de responder (público, nível de consciência, dor, desejo, objeções, prova, oferta). Entregue o melhor, não o primeiro que veio.
- Quando criar ou melhorar um criativo, use sempre estes blocos: **GANCHO** (primeiros 3 segundos, interrompe o scroll), **CORPO** (problema → mecanismo/solução → prova → benefício), **CHAMADA** (fechamento e ação). Em vídeo, indique o que aparece e o que é falado quando fizer diferença. Coloque o tempo aproximado de cada bloco.
- Ganchos fortes: promessa específica, curiosidade com lacuna, padrão que quebra expectativa, dor reconhecível, prova ou número concreto, desafio de crença, "pare de fazer X". Evite clichês e frases genéricas.
- Copy: frases curtas, linguagem falada, uma ideia por frase, benefício antes de recurso, especificidade (números, situações, nomes de coisas reais), quebra de objeções, prova e garantia quando existirem. Chamada com verbo e próximo passo claro (página de vendas ou checkout, conforme o destino indicado).
- Texto do anúncio (legenda): texto principal curto, título e descrição, no limite de cada campo.
- Respeite as políticas de anúncios da Meta: nada de promessa garantida de ganhos, antes/depois enganoso, atributos pessoais ("você está endividado?"), saúde/dinheiro exagerados. Se algo for arriscado, avise e dê a versão segura.
- Nunca invente depoimentos, números, resultados, preços, nomes ou links. Se faltar dado importante, pergunte uma vez, curto. Use só o que está nos arquivos de apoio ou o que o usuário disser.
- Na pasta há arquivos de apoio: brief.md (produto, público, oferta e destino), atual.md (o criativo em que o usuário está trabalhando), validadas.md (copies que já venderam: estude o padrão e use como referência de estilo e estrutura, sem copiar frases) e ganchos.md (ganchos que funcionaram). Leia o que precisar antes de criar.
- Ao pedir variações, entregue numeradas e realmente diferentes entre si (ângulo, emoção, formato), não só trocas de palavras.
- Estudo de mercado: use WebSearch e WebFetch para pesquisar concorrentes, ofertas, ângulos que estão rodando, linguagem do público (fóruns, comentários, avaliações) e tendências. Entregue: panorama curto, 3 a 5 ângulos com potencial (cada um com a dor/desejo que explora), o que os concorrentes fazem igual (saturado) e as oportunidades. No final, liste as fontes usadas como links. Marque o que for suposição.
- Na internet só pesquise quando o pedido for sobre mercado, concorrentes, tendências, análise de oferta/anúncio, ou quando o usuário pedir. Para criar copy comum, use apenas os arquivos de apoio.
- Modelar um concorrente: extraia o ângulo, a estrutura e o mecanismo do anúncio e crie um novo, com ideias e palavras diferentes. Nunca copie texto.
- Dar nota: avalie gancho, clareza, prova, oferta, chamada e risco de reprovação, de 0 a 10, aponte o ponto mais fraco e reescreva esse ponto.
- Não execute comandos e não altere arquivos.`;

const uuid=()=>crypto.randomUUID();
const EFF={low:1,medium:1,high:1,xhigh:1,max:1};

module.exports=function setup(ipcMain,H){
  const D=()=>path.join(H.userData(),'crea'),W=()=>path.join(D(),'work'),STATE=()=>path.join(D(),'estado.json'),OUT=()=>path.join(D(),'saida');
  const send=(wc,ch,o)=>{try{if(!wc.isDestroyed())wc.send(ch,o)}catch{}};
  const cc=H.cc||{};

  /* ---------- estado (copies, ganchos, resumo do produto, conversa) ---------- */
  ipcMain.handle('cr:load',()=>{try{return fs.readFileSync(STATE(),'utf8')}catch{return''}});
  ipcMain.handle('cr:save',(_,{json})=>{try{if(typeof json!='string'||json.length>20e6)return{ok:false};fs.mkdirSync(D(),{recursive:true});const f=STATE();fs.writeFileSync(f+'.tmp',json);fs.renameSync(f+'.tmp',f);return{ok:true}}catch(e){return{ok:false,error:String(e.message||e)}}});

  /* ---------- Claude ---------- */
  const RUN=new Map();
  const kill=p=>{try{if(process.platform=='win32')spawn('taskkill',['/pid',String(p.pid),'/T','/F'],{windowsHide:true});else p.kill('SIGTERM')}catch{}};
  ipcMain.handle('cr:cancel',(_,{rid})=>{const r=RUN.get(String(rid||''));if(r){r.canceled=1;kill(r.p)}return{ok:true}});
  const wfile=(n,t)=>{try{fs.writeFileSync(path.join(W(),n),String(t||'').trim()||'(vazio)\n')}catch{}};
  ipcMain.handle('cr:run',async(e,{prompt,sid,ctx,rid,effort,web,imgs})=>{
    rid=String(rid||Date.now());if(RUN.has(rid))return{ok:false,error:'Já estou trabalhando nisso.'};
    const b=cc.findBin?await cc.findBin():null;if(!b)return{ok:false,needInstall:1};
    const wc=e.sender;ctx=ctx&&typeof ctx=='object'?ctx:{};
    try{fs.mkdirSync(W(),{recursive:true})}catch(er){return{ok:false,error:String(er.message||er)}}
    const br=ctx.brief||{};
    wfile('brief.md',['produto','nicho','publico','oferta','destino','tom'].map(k=>br[k]?'- '+({produto:'Produto',nicho:'Nicho',publico:'Público',oferta:'Oferta (preço, bônus, garantia)',destino:'Destino do anúncio',tom:'Tom'}[k])+': '+String(br[k]).slice(0,600):'').filter(Boolean).join('\n'));
    wfile('atual.md',String(ctx.atual||'').slice(0,12000));
    wfile('validadas.md',(Array.isArray(ctx.validadas)?ctx.validadas:[]).slice(0,25).map(x=>'## '+String(x.title||'Copy').slice(0,80)+(x.nicho?' ('+String(x.nicho).slice(0,40)+')':'')+(x.res?'\nResultado: '+String(x.res).slice(0,200):'')+'\n'+String(x.txt||'').slice(0,3500)).join('\n\n'));
    wfile('ganchos.md',(Array.isArray(ctx.ganchos)?ctx.ganchos:[]).slice(0,60).map(x=>'- '+String(x.txt||x).slice(0,300)).join('\n'));
    const sysF=path.join(D(),'sys.txt');try{fs.writeFileSync(sysF,SYS)}catch{}
    const imgDir=path.join(D(),'img-'+rid),imgP=[];
    try{if(Array.isArray(imgs)&&imgs.length){fs.mkdirSync(imgDir,{recursive:true});imgs.slice(0,4).forEach((x,i)=>{const m=/^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/i.exec(String(x&&x.data||''));if(!m)return;const f=path.join(imgDir,'imagem'+(i+1)+'.'+(m[1].toLowerCase()=='jpeg'?'jpg':m[1].toLowerCase()));fs.writeFileSync(f,Buffer.from(m[2],'base64'));imgP.push(f)})}}catch{}
    const useWeb=!!web||/mercado|concorr|tend[êe]ncia|pesquis|estud|bibliotec|an[úu]ncio d[eo]s?\s|oferta d[eo]/i.test(String(prompt||''));
    const msg=(imgP.length?`[O usuário anexou ${imgP.length} imagem(ns): ${imgP.join(' ; ')}. Olhe com Read.]\n\n`:'')+String(prompt||'');
    let sessionId=sid&&/^[0-9a-f-]{36}$/i.test(sid)?sid:uuid(),resume=!!(sid&&/^[0-9a-f-]{36}$/i.test(sid));
    const tools='Read,Glob,Grep'+(useWeb?',WebSearch,WebFetch':'');
    const once=useResume=>new Promise(res=>{
      const args=['-p','--input-format','stream-json','--output-format','stream-json','--verbose','--include-partial-messages','--permission-mode','acceptEdits','--tools',tools,'--allowedTools','Read','Glob','Grep'].concat(useWeb?['WebSearch','WebFetch']:[]).concat(['--strict-mcp-config','--disable-slash-commands','--max-turns','40','--append-system-prompt-file',sysF]).concat(imgP.length?['--add-dir',imgDir]:[]).concat(EFF[effort]?['--effort',effort]:[]).concat(useResume?['--resume',sessionId]:['--session-id',sessionId]);
      let p;try{p=spawn(b.bin,args,{cwd:W(),env:cc.cleanEnv?cc.cleanEnv():process.env,windowsHide:true,shell:cc.needShell?cc.needShell(b.bin):false,stdio:['pipe','pipe','pipe']})}catch(er){return res({err:String(er.message||er)})}
      const st={p,canceled:0};RUN.set(rid,st);let buf='',err='',final=null,text='',lim=null;const tm=setTimeout(()=>{st.timeout=1;kill(p)},20*60*1000);
      const line=l=>{if(!l.trim())return;let o;try{o=JSON.parse(l)}catch{return}
        if(o.type=='stream_event'&&o.event&&o.event.type=='content_block_delta'&&o.event.delta&&o.event.delta.type=='text_delta'){text+=o.event.delta.text;send(wc,'cr:evt',{rid,k:'delta',t:o.event.delta.text})}
        else if(o.type=='stream_event'&&o.event&&o.event.type=='message_start'){if(text&&!/\n$/.test(text)){text+='\n\n';send(wc,'cr:evt',{rid,k:'delta',t:'\n\n'})}}
        else if(o.type=='assistant'&&o.message&&Array.isArray(o.message.content)){for(const c of o.message.content)if(c.type=='tool_use')send(wc,'cr:evt',{rid,k:'tool',n:c.name})}
        else if(o.type=='rate_limit_event'&&o.rate_limit_info&&/reject|exceed|limit_reached/i.test(String(o.rate_limit_info.status||'')))lim=o.rate_limit_info;
        else if(o.type=='result')final=o};
      p.stdout.on('data',d=>{buf+=d;let i;while((i=buf.indexOf('\n'))>=0){line(buf.slice(0,i));buf=buf.slice(i+1)}});
      p.stderr.on('data',d=>{err+=d});
      p.on('error',er=>{clearTimeout(tm);RUN.delete(rid);res({err:String(er.code=='ENOENT'?'não encontrei o claude':er.message),needInstall:er.code=='ENOENT'})});
      p.on('close',code=>{clearTimeout(tm);if(buf.trim())line(buf);RUN.delete(rid);res({code,final,err,text,lim,canceled:st.canceled,timeout:st.timeout})});
      try{p.stdin.on('error',()=>{});p.stdin.end(cc.sendIn(msg))}catch{}});
    let r=await once(resume);
    if(resume&&r&&!r.canceled&&r.final&&r.final.is_error&&/no conversation found|session/i.test(String(r.final.result||r.err||''))&&!(r.text||'').trim()){sessionId=uuid();resume=false;r=await once(false)}
    try{fs.rmSync(imgDir,{recursive:true,force:true})}catch{}
    const out={ok:true,sid:sessionId,web:useWeb};
    if(r.err&&!r.final&&r.needInstall){out.ok=false;out.needInstall=1;return out}
    if(r.canceled){out.canceled=1;out.text=(r.text||'').trim();return out}
    if(r.timeout){out.ok=false;out.error='Demorou demais e eu parei.';out.text=(r.text||'').trim();return out}
    const fin=r.final,errTxt=String((fin&&fin.result)||'')+' '+String(r.err||'');
    if(!fin){if(/not logged|\/login|log in/i.test(errTxt))out.needLogin=1;else{out.ok=false;out.error=String(r.err||'').trim().split('\n').slice(-2).join(' ').slice(0,220)||'O Claude não respondeu.'}return out}
    if(fin.is_error){if(/not logged|\/login|invalid api key|authentication|credentials/i.test(errTxt))out.needLogin=1;else if(r.lim||/limit|usage|quota|overload|rate/i.test(errTxt))out.limit=1;else{out.ok=false;out.error=String(fin.result||'Erro do Claude').slice(0,220)}out.text=(r.text||'').trim();return out}
    out.text=String(fin.result||r.text||'').trim();return out});

  /* ---------- ffmpeg (baixado uma vez, ~30 MB) ---------- */
  const FFDIR=()=>path.join(H.userData(),'ffmpeg');
  const ffExe=()=>process.env.SL_FFMPEG_BIN||path.join(FFDIR(),process.platform=='win32'?'ffmpeg.exe':'ffmpeg');
  const ffOk=()=>{try{return fs.statSync(ffExe()).size>(process.env.SL_FFMPEG_BIN?1e4:1e6)}catch{return false}};
  const FFURLS=()=>process.env.SL_FF_URL?[process.env.SL_FF_URL]:['https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/ffmpeg-win32-x64.gz'];
  ipcMain.handle('av:status',()=>({ffmpeg:ffOk(),voz:!!(H.vz&&H.vz.ready()),win:process.platform=='win32'||!!process.env.SL_FFMPEG_BIN}));
  let ffBusy=0;
  ipcMain.handle('av:install',async e=>{if(ffOk())return{ok:true};if(ffBusy)return{ok:false,error:'Já estou baixando.'};ffBusy=1;const wc=e.sender;let er='';
    try{fs.mkdirSync(FFDIR(),{recursive:true});
      for(const u of FFURLS()){try{const x=await H.net.fetch(u);if(!x.ok)throw new Error('HTTP '+x.status);const tot=+x.headers.get('content-length')||0;let got=0,last=0;const dest=ffExe(),part=dest+'.part',out=fs.createWriteStream(part);
          const gz=/\.gz$/i.test(u)?zlib.createGunzip():null;if(gz)gz.pipe(out);const sink=gz||out;const rd=x.body.getReader();
          while(true){const{done,value}=await rd.read();if(done)break;got+=value.length;if(!sink.write(Buffer.from(value)))await new Promise(r=>sink.once('drain',r));const now=Date.now();if(now-last>400){last=now;send(wc,'av:evt',{k:'ff',pct:tot?Math.min(99,Math.round(got/tot*100)):0})}}
          await new Promise(r=>{out.once('close',r);sink.end()});fs.renameSync(part,dest);try{fs.chmodSync(dest,0o755)}catch{}
          if(ffOk()){ffBusy=0;return{ok:true}}er='arquivo inválido'}catch(x){er=String(x.message||x)}}
      ffBusy=0;return{ok:false,error:'Não consegui baixar o programa de edição ('+er+'). Veja a internet e tente de novo.'}}
    catch(x){ffBusy=0;return{ok:false,error:String(x.message||x)}}});

  /* ---------- arquivos ---------- */
  const MEDIA=/\.(mp4|mov|mkv|webm|avi|m4v|mp3|wav|m4a|aac|ogg|flac|wma|opus)$/i,VID=/\.(mp4|mov|mkv|webm|avi|m4v)$/i;
  ipcMain.handle('av:pick',async()=>{try{const r=await H.dialog.showOpenDialog(H.win(),{title:'Escolha vídeos ou áudios',properties:['openFile','multiSelections'],filters:[{name:'Vídeo e áudio',extensions:['mp4','mov','mkv','webm','avi','m4v','mp3','wav','m4a','aac','ogg','flac','wma','opus']}]});return r.canceled?[]:r.filePaths.filter(p=>MEDIA.test(p)).map(p=>({path:p,name:path.basename(p)}))}catch{return[]}});
  ipcMain.handle('av:chk',(_,{paths})=>(Array.isArray(paths)?paths:[]).filter(p=>typeof p=='string'&&MEDIA.test(p)&&fs.existsSync(p)).slice(0,60).map(p=>({path:p,name:path.basename(p)})));

  /* nome no padrao do usuario: "Cv 21 Som Pro editado" */
  function outName(nm){const base=nm.replace(/\.[^.]+$/,'');const m=/cv[\s_\-]*(\d+)[\s_\-]+(?:som[\s_\-]+)?([^\s_\-]+)[\s_\-]+som/i.exec(base)||/cv[\s_\-]*(\d+)[\s_\-]+som[\s_\-]+([^\s_\-]+)/i.exec(base);
    if(m)return'Cv '+m[1]+' Som '+m[2].charAt(0).toUpperCase()+m[2].slice(1).toLowerCase()+' editado';return base.replace(/[_]+/g,' ').trim()+' editado'}
  const J=new Map();
  function ff(args,o){o=o||{};return new Promise(res=>{let er='',p;try{p=spawn(ffExe(),args,{windowsHide:true})}catch(x){return res({ok:false,err:String(x.message||x)})}
    if(o.reg)o.reg(p);p.stderr.on('data',d=>{er+=d;if(er.length>200000)er=er.slice(-100000);if(o.onTime){const m=String(d).match(/time=(\d+):(\d+):(\d+\.?\d*)/g);if(m){const t=m[m.length-1].match(/(\d+):(\d+):(\d+\.?\d*)/);o.onTime(+t[1]*3600+ +t[2]*60+ +t[3])}}});
    p.on('error',x=>res({ok:false,err:String(x.message||x)}));p.on('close',c=>res({ok:c===0,err:er,code:c}))})}
  const probe=async f=>{const r=await ff(['-hide_banner','-i',f]);const m=/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/.exec(r.err||'');return{dur:m?+m[1]*3600+ +m[2]*60+ +m[3]:0,video:/Stream #\d+:\d+.*Video:/.test(r.err||'')&&!/Video:\s*(mjpeg|png)/.test(r.err||''),audio:/Stream #\d+:\d+.*Audio:/.test(r.err||'')}};

  const AC=require('./acut.js');
  /* le o wav de 16 kHz mono (16 bits) como numeros de -1 a 1 */
  function readWav(f){const b=fs.readFileSync(f);let p=12,off=-1,len=0;while(p+8<=b.length){const id=b.toString('ascii',p,p+4),sz=b.readUInt32LE(p+4);if(id=='data'){off=p+8;len=Math.min(sz,b.length-off);break}p+=8+sz+(sz&1)}if(off<0)return null;const n=len>>1,x=new Float32Array(n);for(let i=0;i<n;i++)x[i]=b.readInt16LE(off+i*2)/32768;return x}
  const cleanTxt=t=>String(t||'').replace(/\[[^\]]*\]/g,' ').replace(/\s+/g,' ').trim();
  ipcMain.handle('av:cancel',(_,{id})=>{const j=J.get(String(id));if(j){j.canceled=1;for(const p of j.ps)kill(p)}return{ok:true}});
  ipcMain.handle('av:job',async(e,{id,kind,file,norm})=>{
    id=String(id||Date.now());const wc=e.sender;const j={ps:[],canceled:0};J.set(id,j);const reg=p=>j.ps.push(p);
    const ev=(pct,txt)=>send(wc,'av:evt',{k:'job',id,pct:Math.max(0,Math.min(100,Math.round(pct))),txt});
    const fail=m=>{J.delete(id);return{ok:false,error:m,canceled:j.canceled}};
    try{
      if(typeof file!='string'||!MEDIA.test(file)||!fs.existsSync(file))return fail('Não achei o arquivo.');
      if(!ffOk())return fail('O programa de edição ainda não está instalado.');
      const needV=kind=='clean'||kind=='text'||kind=='srt';if(needV&&!(H.vz&&H.vz.ready()))return fail('O reconhecimento de voz ainda não está instalado.');
      const name=path.basename(file),base=outName(name),jd=path.join(OUT(),id);fs.mkdirSync(jd,{recursive:true});
      const pr=await probe(file);if(!pr.audio)return fail('Este arquivo não tem áudio.');
      const wav=path.join(H.vz?H.vz.tmp():os.tmpdir(),'sl-av-'+id+'.wav');
      const toWav=async()=>{ev(3,'Extraindo o áudio…');const r=await ff(['-y','-i',file,'-vn','-ac','1','-ar','16000','-c:a','pcm_s16le',wav],{reg,onTime:t=>ev(3+Math.min(12,t/(pr.dur||1)*12),'Extraindo o áudio…')});if(!r.ok)throw new Error('Não consegui ler o áudio deste arquivo.')};
      const rmWav=()=>{try{fs.rmSync(wav,{force:true})}catch{}};
      if(kind=='norm'){ev(5,'Padronizando o volume…');const ext=pr.video?'.mp4':'.mp3';const out=path.join(jd,base.replace(/ editado$/,' padronizado')+ext);
        const a=pr.video?['-y','-i',file,'-af','loudnorm=I=-14:TP=-1.5:LRA=11','-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart',out]:['-y','-i',file,'-af','loudnorm=I=-14:TP=-1.5:LRA=11','-c:a','libmp3lame','-q:a','2',out];
        const r=await ff(a,{reg,onTime:t=>ev(5+t/(pr.dur||1)*93,'Padronizando o volume…')});if(j.canceled)return fail('Parado.');if(!r.ok)return fail('Não consegui padronizar o volume.');J.delete(id);ev(100,'Pronto');return{ok:true,id,name:path.basename(out),out,dur0:pr.dur}}
      if(kind=='text'){await toWav();ev(15,'Transcrevendo…');const r=await H.vz.run(['-f',wav,'-nt','-np','-pp','--prompt','Certo. Chat, upsell, downsell, front, hook, copy, criativo, checkout, pixel, Shark Lab, Cakto, Facebook.'],{reg,onPct:p=>ev(15+p*.84,'Transcrevendo…')});rmWav();if(j.canceled)return fail('Parado.');if(!r.ok)return fail(r.error||'Não consegui transcrever.');
        let t=H.vz.fixTerms(String(r.out||'').replace(/\r/g,'').split('\n').map(x=>x.trim()).filter(Boolean).join(' ').replace(/\s+/g,' ').trim());
        if(!t)return fail('Não ouvi fala neste arquivo.');const ss=t.split(/(?<=[.!?…])\s+/),pa=[];for(let i=0;i<ss.length;i+=3)pa.push(ss.slice(i,i+3).join(' '));J.delete(id);ev(100,'Pronto');return{ok:true,id,text:pa.join('\n\n'),dur0:pr.dur}}
      if(kind=='srt'){await toWav();ev(15,'Criando as legendas…');const of=path.join(jd,'leg');const r=await H.vz.run(['-f',wav,'-osrt','-of',of,'-ml','42','-sow','-np','-pp','--prompt','Certo. Chat, upsell, downsell, front, hook, copy, criativo, checkout, pixel, Shark Lab, Cakto, Facebook.'],{reg,onPct:p=>ev(15+p*.84,'Criando as legendas…')});rmWav();if(j.canceled)return fail('Parado.');if(!r.ok||!fs.existsSync(of+'.srt'))return fail(r.error||'Não consegui criar as legendas.');
        let s=fs.readFileSync(of+'.srt','utf8');s=H.vz.fixTerms(s);const out=path.join(jd,base.replace(/ editado$/,'')+'.srt');fs.writeFileSync(out,s);try{fs.rmSync(of+'.srt',{force:true})}catch{}J.delete(id);ev(100,'Pronto');return{ok:true,id,name:path.basename(out),out,dur0:pr.dur}}
      if(kind=='clean'){await toWav();ev(16,'Ouvindo a fala…');const of=path.join(jd,'pal');
        const r=await H.vz.run(['-f',wav,'-oj','-of',of,'-ml','1','-sow','-np','-pp','--prompt','Certo. Chat, upsell, downsell, front, hook, copy, criativo, checkout, pixel, Shark Lab, Cakto, Facebook.'],{reg,onPct:p=>ev(16+p*.5,'Ouvindo a fala…')});if(j.canceled){rmWav();return fail('Parado.')}
        let words=[];try{const jj=JSON.parse(fs.readFileSync(of+'.json','utf8'));words=(jj.transcription||[]).map(x=>({t:String(x.text||'').trim(),a:(x.offsets&&x.offsets.from||0)/1000,b:(x.offsets&&x.offsets.to||0)/1000})).filter(x=>x.t&&!/^\[.*\]$/.test(x.t))}catch{}
        try{fs.rmSync(of+'.json',{force:true})}catch{}
        ev(68,'Medindo cada pausa…');const sam=readWav(wav);rmWav();
        if(!sam||sam.length<1600)return fail('Não consegui ler o áudio.');
        const an=AC.analyze(sam,16000),P=AC.plan(an,words);if(!P.keep.length)return fail(P.warn&&P.warn[0]||'Não sobrou fala depois da limpeza.');
        const segs=P.keep,N=segs.length,f=n=>n.toFixed(3);let fc='';
        for(let k=0;k<N;k++){const[a,b]=segs[k],d=b-a,fi=k==0?.005:.012,fo=k==N-1?.03:.012;fc+=`[0:a]atrim=start=${f(a)}:end=${f(b)},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=${fi},afade=t=out:st=${f(Math.max(0,d-fo))}:d=${fo}[a${k}];`;if(pr.video)fc+=`[0:v]trim=start=${f(a)}:end=${f(b)},setpts=PTS-STARTPTS[v${k}];`}
        fc+=pr.video?segs.map((_,k)=>`[v${k}][a${k}]`).join('')+`concat=n=${N}:v=1:a=1[vo][ao0];`:segs.map((_,k)=>`[a${k}]`).join('')+`concat=n=${N}:v=0:a=1[ao0];`;
        fc+=norm?`[ao0]loudnorm=I=-14:TP=-1.5:LRA=11[ao]`:`[ao0]anull[ao]`;
        const sf=path.join(jd,'f.txt');fs.writeFileSync(sf,fc);const iext=path.extname(file).toLowerCase(),AEXT=iext=='.wav'?'.wav':(iext=='.m4a'||iext=='.aac')?'.m4a':'.mp3',ext=pr.video?'.mp4':AEXT;const out=path.join(jd,base+ext);
        const a=['-y','-i',file,'-filter_complex_script',sf].concat(pr.video?['-map','[vo]','-map','[ao]','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart']:['-map','[ao]'].concat(ext=='.wav'?['-c:a','pcm_s16le']:ext=='.m4a'?['-c:a','aac','-b:a','192k']:['-c:a','libmp3lame','-b:a','192k']),[out]);
        const tot=segs.reduce((s,x)=>s+x[1]-x[0],0);ev(72,'Cortando e montando…');
        const r2=await ff(a,{reg,onTime:t=>ev(68+Math.min(1,t/(tot||1))*31,'Cortando e montando…')});try{fs.rmSync(sf,{force:true})}catch{}
        if(j.canceled)return fail('Parado.');if(!r2.ok)return fail('Não consegui montar o arquivo editado.');
        J.delete(id);ev(100,'Pronto');return{ok:true,id,name:path.basename(out),out,dur0:pr.dur,dur1:tot,cuts:P.stats.cuts,fill:P.stats.fill,rep:P.stats.rep,noise:P.stats.noise,tails:P.stats.tails,warn:P.warn||[]}}
      return fail('Ação inválida.');
    }catch(x){try{J.delete(id)}catch{}return{ok:false,error:String(x&&x.message||x),canceled:j.canceled}}});

  /* "Baixar": o usuario escolhe onde salvar */
  ipcMain.handle('av:save',async(_,{out,name})=>{try{if(typeof out!='string'||path.resolve(out).indexOf(path.resolve(OUT()))!==0||!fs.existsSync(out))return{ok:false,error:'Arquivo não encontrado.'};
    const r=await H.dialog.showSaveDialog(H.win(),{title:'Salvar',defaultPath:String(name||path.basename(out)).replace(/[\\/:*?"<>|]/g,' ')});if(r.canceled||!r.filePath)return{ok:false,canceled:1};
    fs.copyFileSync(out,r.filePath);return{ok:true,path:r.filePath}}catch(e){return{ok:false,error:String(e.message||e)}}});
  ipcMain.handle('av:saveText',async(_,{text,name})=>{try{const r=await H.dialog.showSaveDialog(H.win(),{title:'Salvar',defaultPath:String(name||'texto.txt').replace(/[\\/:*?"<>|]/g,' ')});if(r.canceled||!r.filePath)return{ok:false,canceled:1};fs.writeFileSync(r.filePath,String(text||''),'utf8');return{ok:true}}catch(e){return{ok:false,error:String(e.message||e)}}});
  // limpa saidas antigas (mais de 3 dias)
  setTimeout(()=>{try{const d=OUT();for(const n of fs.readdirSync(d)){const p=path.join(d,n);if(Date.now()-fs.statSync(p).mtimeMs>3*864e5)fs.rmSync(p,{recursive:true,force:true})}}catch{}},8000);
  return{outName,plan:AC.plan};
};
