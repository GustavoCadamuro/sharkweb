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
if(typeof module!='undefined')module.exports={makeCloneFix};
