'use strict';
/* v63.80: Biblioteca de Anuncios do Facebook dentro do Shark Lab.
   Abre a biblioteca publica da Meta numa janela escondida, rola devagar, le o que aparece e devolve uma tabela.
   Nao usa API, nao pede login, nao baixa videos. A Meta nao mostra gasto nem vendas: a "nota de escala" e uma estimativa. */
const fs=require('fs'),path=require('path');

const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const COUNTRY=/^[A-Z]{2}$|^ALL$/;
const DEPTH={rapida:3,normal:8,profunda:20};

/* roda DENTRO da pagina: acha os cartoes de anuncio pelo texto "Identificacao da biblioteca: 123..." */
const EXTRACT=`(function(){
var RX=/(?:Identifica[çc][ãa]o da biblioteca|ID da biblioteca|Library ID)\\s*:?\\s*(\\d{8,})/i,RXG=/(?:Identifica[çc][ãa]o da biblioteca|ID da biblioteca|Library ID)\\s*:?\\s*\\d{8,}/gi;
var MP={jan:0,fev:1,mar:2,abr:3,mai:4,jun:5,jul:6,ago:7,set:8,out:9,nov:10,dez:11,feb:1,apr:3,may:4,aug:7,sep:8,oct:9,dec:11};
function pdate(s){s=String(s||'');var m=/(\\d{1,2})\\s+de\\s+([A-Za-zçÇ]+)\\.?\\s+de\\s+(\\d{4})/i.exec(s);if(m){var k=MP[m[2].slice(0,3).toLowerCase()];if(k!=null)return Date.UTC(+m[3],k,+m[1])}
m=/([A-Za-z]{3,9})\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})/.exec(s);if(m){var k2=MP[m[1].slice(0,3).toLowerCase()];if(k2!=null)return Date.UTC(+m[3],k2,+m[2])}return 0}
var out=[],seen={},all=document.querySelectorAll('span,div');
for(var i=0;i<all.length;i++){var e=all[i];if(e.children.length>2)continue;var t=e.textContent||'';if(t.length>90||t.length<12)continue;var m=RX.exec(t);if(!m||seen[m[1]])continue;
 var card=e,p=e.parentElement;while(p&&p!==document.body){var tx=p.innerText||'';if(tx.length>7000)break;var c=tx.match(RXG);if(c&&c.length>1)break;card=p;p=p.parentElement}
 seen[m[1]]=1;var tx=(card.innerText||'').trim(),lines=tx.split('\\n').map(function(x){return x.trim()}).filter(Boolean);
 var sm=/(?:Veicula[çc][ãa]o iniciada em|Started running on)\\s*:?\\s*([^\\n]+)/i.exec(tx),st=sm?pdate(sm[1]):0,vm=/(\\d+)\\s+an[úu]ncios?\\s+(?:usam|usa|utilizam)\\s+este\\s+criativo/i.exec(tx)||/(\\d+)\\s+ads?\\s+(?:use|uses)\\s+this\\s+creative/i.exec(tx);
 var sp=-1;for(var k=0;k<lines.length;k++){if(/^(Patrocinado|Sponsored)$/i.test(lines[k])){sp=k;break}}
 var adv=sp>0?lines[sp-1]:'',cp=[];if(sp>=0){for(var q=sp+1;q<lines.length&&cp.length<7;q++){var L=lines[q];if(/^(Saiba mais|Comprar agora|Learn more|Shop now|Cadastre-se|Sign up|Enviar mensagem|Send message|Ver mais|See more|Baixar|Download|Obter oferta|Get offer|Assistir|Watch more|Reservar|Book now|Fale conosco|Contact us|Ligar agora|Call now|Instalar agora|Install now|Inscreva-se|Subscribe)$/i.test(L))break;if(/^[A-Z0-9][A-Z0-9.\\-]+\\.[A-Z]{2,}(\\/.*)?$/.test(L))break;if(/^\\d{1,2}:\\d{2}\\s*\\/\\s*\\d{1,2}:\\d{2}$/.test(L))continue;cp.push(L)}}
 var link='',pid='',ps=card.querySelectorAll('a[href]');
 for(var a=0;a<ps.length;a++){var h=ps[a].getAttribute('href')||'';var pm=/view_all_page_id=(\\d+)/.exec(h);if(pm&&!pid)pid=pm[1];if(!link){var lm=/l\\.facebook\\.com\\/l\\.php\\?u=([^&]+)/.exec(h);if(lm){try{link=decodeURIComponent(lm[1])}catch(x){}}else if(/^https?:\\/\\//.test(h)&&!/facebook\\.com|fb\\.com|instagram\\.com|fbcdn/.test(h))link=h}}
 if(!adv){for(var a2=0;a2<ps.length;a2++){var h2=ps[a2].getAttribute('href')||'';if(/facebook\\.com\\/[^\\/?]+\\/?$/.test(h2)&&(ps[a2].innerText||'').trim()){adv=ps[a2].innerText.trim();break}}}
 var vid=!!card.querySelector('video'),thumb='',bs=0,im=card.querySelectorAll('img[src]');for(var b=0;b<im.length;b++){var r=im[b].getBoundingClientRect(),sz=r.width*r.height;if(sz>bs&&sz>6000){bs=sz;thumb=im[b].src}}
 out.push({id:m[1],adv:adv.slice(0,120),pid:pid,st:st,versions:vm?+vm[1]:1,copy:cp.join(' ').slice(0,700),link:link.slice(0,500),media:vid?'video':(thumb?'imagem':''),thumb:thumb.slice(0,600)})}
return JSON.stringify(out)})()`;

const COOKIE=`(function(){var b=document.querySelectorAll('button,div[role=button],span[role=button]');for(var i=0;i<b.length;i++){var t=(b[i].innerText||'').trim();if(/^(Permitir todos os cookies|Permitir cookies essenciais e opcionais|Allow all cookies|Aceitar tudo|Recusar cookies opcionais|Decline optional cookies|Aceitar todos os cookies)$/i.test(t)){try{b[i].click()}catch(x){}return 1}}return 0})()`;
const COUNT=`(function(){var t=document.body?document.body.innerText:'';var m=/~?\\s*([\\d.,]+)\\s*(?:resultados?|results?)/i.exec(t);return JSON.stringify({n:m?parseInt(String(m[1]).replace(/\\D/g,''),10):0,login:/Entrar no Facebook|Log in to Facebook|Fa[çc]a login/i.test(t)&&!/(Identifica[çc][ãa]o da biblioteca|Library ID)/i.test(t)})})()`;

module.exports=function setup(ipcMain,H){
  const F=()=>path.join(H.userData(),'adlib.json');
  const send=(wc,o)=>{try{if(!wc.isDestroyed())wc.send('adl:evt',o)}catch{}};
  const sl=ms=>new Promise(r=>setTimeout(r,ms));
  let cur=null;
  const urlFor=o=>{if(process.env.SL_ADL_URL)return process.env.SL_ADL_URL;
    const c=COUNTRY.test(String(o.country||''))?o.country:'BR',m=/^(all|video|image)$/.test(String(o.media||''))?o.media:'all';
    if(o.pid&&/^\d{5,25}$/.test(String(o.pid)))return'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country='+c+'&view_all_page_id='+o.pid+'&search_type=page&media_type='+m;
    return'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country='+c+'&q='+encodeURIComponent(String(o.q||'').slice(0,120))+'&search_type=keyword_unordered&media_type='+m};
  function mkWin(visible){const ses=H.session.fromPartition('persist:adl');try{ses.setUserAgent(UA,'pt-BR,pt;q=0.9,en;q=0.6')}catch{}
    ses.setPermissionRequestHandler((_w,_p,cb)=>cb(false));ses.setPermissionCheckHandler(()=>false);
    const w=new H.BrowserWindow({show:!!visible,width:1280,height:1000,title:'Biblioteca de Anúncios da Meta',webPreferences:{session:ses,backgroundThrottling:false,sandbox:true,contextIsolation:true,nodeIntegration:false}});
    w.setMenuBarVisibility(false);w.webContents.setWindowOpenHandler(()=>({action:'deny'}));w.webContents.setUserAgent(UA);
    w.webContents.on('will-navigate',(e,u)=>{if(!/^https?:\/\/([a-z0-9-]+\.)?(facebook|fb)\.com\//i.test(u)&&!/^file:/.test(u))e.preventDefault()});
    return w}
  const ex=(w,js,ms)=>Promise.race([w.webContents.executeJavaScript(js),sl(ms||15000).then(()=>null)]).catch(()=>null);

  ipcMain.handle('adl:cancel',()=>{if(cur)cur.canceled=1;return{ok:true}});
  ipcMain.handle('adl:search',async(e,o)=>{
    o=o&&typeof o=='object'?o:{};if(cur)return{ok:false,error:'Já estou buscando. Espere terminar ou toque em Parar.'};
    if(!o.pid&&!String(o.q||'').trim()&&!process.env.SL_ADL_URL)return{ok:false,error:'Digite o que buscar (palavra-chave ou nome do anunciante).'};
    const wc=e.sender,depth=DEPTH[o.depth]||DEPTH.normal,st={canceled:0};cur=st;const w=mkWin(!!o.visible);const ads=new Map();
    try{
      send(wc,{k:'p',n:0,txt:'Abrindo a Biblioteca de Anúncios…'});
      await Promise.race([w.loadURL(urlFor(o)).catch(()=>{}),sl(30000)]);
      await sl(3500);await ex(w,COOKIE,4000);await sl(1200);
      const cnt=JSON.parse(await ex(w,COUNT,6000)||'{}');
      const grab=async()=>{const j=await ex(w,EXTRACT,20000);let a=[];try{a=JSON.parse(j||'[]')}catch{}for(const x of a)if(!ads.has(x.id))ads.set(x.id,x)};
      await grab();
      if(!ads.size&&cnt.login)return{ok:false,needVisible:1,error:'A Meta pediu login ou uma verificação. Marque "Mostrar a janela" e tente de novo.'};
      let still=0,lastH=0;
      for(let i=0;i<depth&&!st.canceled;i++){
        send(wc,{k:'p',n:ads.size,txt:'Lendo anúncios… '+ads.size+' encontrados'});
        const h=await ex(w,'(function(){window.scrollTo(0,document.documentElement.scrollHeight);return document.documentElement.scrollHeight})()',5000);
        await sl(2200+Math.floor(Math.random()*900));await grab();
        if(h&&h===lastH){if(++still>=2)break}else still=0;lastH=h}
      if(st.canceled&&!ads.size)return{ok:false,canceled:1};
      const list=[...ads.values()];
      if(!list.length)return{ok:false,error:process.env.SL_ADL_URL?'Nada encontrado.':'Não encontrei anúncios. Pode ser que a busca não tenha resultados, ou que a Meta mudou o visual da página. Tente outra palavra ou marque "Mostrar a janela".',total:cnt.n||0};
      return{ok:true,ads:list,total:cnt.n||0,canceled:st.canceled?1:0}
    }catch(x){return{ok:false,error:String(x&&x.message||x)}}
    finally{cur=null;try{w.destroy()}catch{}}});

  /* total de anuncios ativos de UM anunciante (radar) */
  ipcMain.handle('adl:count',async(e,o)=>{o=o||{};if(!/^\d{5,25}$/.test(String(o.pid||''))&&!process.env.SL_ADL_URL)return{ok:false,error:'anunciante inválido'};
    const w=mkWin(false);try{await Promise.race([w.loadURL(urlFor({pid:o.pid,country:o.country,media:'all'})).catch(()=>{}),sl(30000)]);await sl(3500);await ex(w,COOKIE,4000);await sl(1500);
      const c=JSON.parse(await ex(w,COUNT,6000)||'{}');let a=[];try{a=JSON.parse(await ex(w,EXTRACT,20000)||'[]')}catch{}
      return{ok:true,n:c.n||a.length,sample:a.length,oldest:a.reduce((m,x)=>x.st&&(!m||x.st<m)?x.st:m,0)}}catch(x){return{ok:false,error:String(x&&x.message||x)}}finally{try{w.destroy()}catch{}}});

  ipcMain.handle('adl:load',()=>{try{return fs.readFileSync(F(),'utf8')}catch{return''}});
  ipcMain.handle('adl:save',(_,{json})=>{try{if(typeof json!='string'||json.length>20e6)return{ok:false};fs.mkdirSync(path.dirname(F()),{recursive:true});fs.writeFileSync(F()+'.tmp',json);fs.renameSync(F()+'.tmp',F());return{ok:true}}catch(x){return{ok:false,error:String(x.message||x)}}});
  ipcMain.handle('adl:open',(_,{url})=>{try{const u=new URL(String(url));if(!/^https?:$/.test(u.protocol))return{ok:false};H.shell.openExternal(u.href);return{ok:true}}catch{return{ok:false}}});
  ipcMain.handle('adl:export',async(_,{csv,name})=>{try{const r=await H.dialog.showSaveDialog(H.win(),{title:'Salvar lista',defaultPath:String(name||'anuncios.csv').replace(/[\\/:*?"<>|]/g,' ')});if(r.canceled||!r.filePath)return{ok:false,canceled:1};fs.writeFileSync(r.filePath,'﻿'+String(csv||''),'utf8');return{ok:true}}catch(x){return{ok:false,error:String(x.message||x)}}});
};
module.exports.EXTRACT=EXTRACT;
