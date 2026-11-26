'use strict';
/* v63.77: reconhecimento de voz no proprio PC (whisper.cpp), com pontuacao. Baixa uma vez (programa + modelo) e depois funciona offline, sem API e sem custo. */
const{spawn}=require('child_process');const fs=require('fs'),path=require('path'),os=require('os');
const ZIPS=()=>process.env.SL_VZ_ZIP_URL?[process.env.SL_VZ_ZIP_URL]:['https://github.com/ggml-org/whisper.cpp/releases/download/b5907/whisper-bin-x64.zip','https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-bin-x64.zip'];
const MODEL=()=>process.env.SL_VZ_MODEL_URL||'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin';
const PROMPT='Olá! Vamos mudar a página: troque o título, aumente o botão, deixe a cor mais escura. Transcreva com pontuação correta.';
const GHOST=/^\s*[\[(].*[\])]\s*$|legendas? pela comunidade|obrigado por assistir|inscreva-se no canal/i;

module.exports=function setup(ipcMain,H,net){
  const D=()=>path.join(H.userData(),'voz'),BIN_DIR=()=>path.join(D(),'bin'),MODEL_F=()=>path.join(D(),'modelo.bin');
  let busy=0,run=0;
  const findExe=(dir)=>{try{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){const r=findExe(p);if(r)return r}else if(/^whisper-cli(\.exe)?$/i.test(e.name))return p}}catch{}return null};
  const exe=()=>process.env.SL_WHISPER_BIN||findExe(BIN_DIR());
  const model=()=>process.env.SL_WHISPER_MODEL||MODEL_F();
  const ready=()=>{const e=exe(),m=model();let ok=false;try{ok=!!e&&fs.existsSync(e)&&fs.statSync(m).size>1e6}catch{}return ok};
  const send=(wc,o)=>{try{if(!wc.isDestroyed())wc.send('vz:evt',o)}catch{}};
  ipcMain.handle('vz:status',()=>({ready:ready(),win:process.platform=='win32'||!!process.env.SL_WHISPER_BIN||!!process.env.SL_VZ_ZIP_URL,busy:!!busy}));

  async function dl(url,dest,wc,label,part){
    const x=await net.fetch(url);if(!x.ok)throw new Error('HTTP '+x.status);
    const tot=+x.headers.get('content-length')||0;let got=0,last=0;const out=fs.createWriteStream(dest+'.part');
    const rd=x.body.getReader();
    try{while(true){const{done,value}=await rd.read();if(done)break;got+=value.length;if(!out.write(Buffer.from(value)))await new Promise(r=>out.once('drain',r));const now=Date.now();if(now-last>400){last=now;send(wc,{k:'p',what:label,pct:tot?Math.min(99,Math.round(got/tot*100)):0,part})}}}
    finally{await new Promise(r=>out.end(r))}
    fs.renameSync(dest+'.part',dest)}
  function unzip(zip,dir){return new Promise((res,rej)=>{fs.mkdirSync(dir,{recursive:true});const p=process.platform=='win32'?spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command','Expand-Archive -LiteralPath \''+zip.replace(/'/g,"''")+'\' -DestinationPath \''+dir.replace(/'/g,"''")+'\' -Force'],{windowsHide:true}):spawn('unzip',['-o','-q',zip,'-d',dir]);let er='';p.stderr&&p.stderr.on('data',d=>er+=d);p.on('error',rej);p.on('close',c=>c===0?res():rej(new Error('não consegui abrir o arquivo baixado '+er.slice(0,120))))})}

  ipcMain.handle('vz:install',async e=>{
    if(busy)return{ok:false,error:'Já estou baixando.'};
    if(ready())return{ok:true};
    const wc=e.sender;busy=1;
    try{fs.mkdirSync(D(),{recursive:true});
      if(!exe()){let ok=false,er='';const zf=path.join(D(),'whisper.zip');
        for(const u of ZIPS()){try{await dl(u,zf,wc,'Baixando o programa de voz',1);ok=true;break}catch(x){er=String(x.message||x)}}
        if(!ok)throw new Error('Não consegui baixar o programa de voz ('+er+'). Veja a internet e tente de novo.');
        send(wc,{k:'p',what:'Instalando',pct:99,part:1});
        try{fs.rmSync(BIN_DIR(),{recursive:true,force:true})}catch{}
        await unzip(zf,BIN_DIR());try{fs.rmSync(zf,{force:true})}catch{}
        if(!exe())throw new Error('O programa de voz baixado veio diferente do esperado.')}
      if(!(fs.existsSync(model())&&fs.statSync(model()).size>1e6)){
        try{await dl(MODEL(),MODEL_F(),wc,'Baixando o modelo de voz',2)}catch(x){throw new Error('Não consegui baixar o modelo de voz ('+String(x.message||x)+'). Veja a internet e tente de novo.')}}
      busy=0;return{ok:true}}
    catch(x){busy=0;return{ok:false,error:String(x.message||x)}}});

  ipcMain.handle('vz:run',(_,{wav})=>new Promise(res=>{
    if(!ready())return res({ok:false,error:'O reconhecimento de voz ainda não está instalado.'});if(run)return res({ok:false,error:'Já estou transcrevendo.'});
    let buf;try{buf=Buffer.from(wav)}catch{return res({ok:false,error:'áudio inválido'})}if(buf.length<2000||buf.length>60e6)return res({ok:false,error:'áudio inválido'});
    const f=path.join(os.tmpdir(),'sl-voz-'+Date.now()+'.wav');try{fs.writeFileSync(f,buf)}catch(x){return res({ok:false,error:String(x.message||x)})}
    const bin=exe(),th=Math.max(2,Math.min(8,(os.cpus()||[]).length-1||4));run=1;let out='',er='',done=0;
    const fin=r=>{if(done)return;done=1;run=0;clearTimeout(tm);try{fs.rmSync(f,{force:true})}catch{}res(r)};
    let p;try{p=spawn(bin,['-m',model(),'-f',f,'-l','pt','-nt','-np','-t',String(th),'--prompt',PROMPT],{cwd:path.dirname(bin),windowsHide:true})}catch(x){return fin({ok:false,error:String(x.message||x)})}
    const tm=setTimeout(()=>{try{p.kill()}catch{}fin({ok:false,error:'Demorou demais para transcrever.'})},150000);
    p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>er+=d);p.on('error',x=>fin({ok:false,error:String(x.message||x)}));
    p.on('close',c=>{let t=out.replace(/\r/g,'').split('\n').map(x=>x.trim()).filter(Boolean).join(' ').replace(/\s+/g,' ').trim();if(GHOST.test(t))t='';if(c!==0&&!t)return fin({ok:false,error:'Não consegui transcrever.'+(er?' '+er.trim().split('\n').slice(-1)[0].slice(0,100):'')});fin({ok:true,text:t})})}));
};
