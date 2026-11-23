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
    /* PNG animado (APNG) nao pode virar WebP parado: fica o original */
    const isApng=u=>{try{if(!(u[0]==0x89&&u[1]==0x50))return false;let i=8;while(i+8<=u.length){const n=((u[i]<<24)|(u[i+1]<<16)|(u[i+2]<<8)|u[i+3])>>>0,t=String.fromCharCode(u[i+4],u[i+5],u[i+6],u[i+7]);if(t=='acTL')return true;if(t=='IDAT'||t=='IEND')return false;i+=12+n}}catch{}return false};
    const cands=[...used].filter(p=>KEEP_EXT.test(p)&&info[p]&&info[p].size>=6000&&!/\/_o\//.test(p)&&!isApng(F[p]));
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
      /* v63.35: trocas de imagem feitas no editor (Qualidade / Imagens pesadas) entram direto no HTML: o navegador nao baixa a versao pesada para depois trocar. So vale quando a troca cobre todas as imagens com aquele endereco */
      const bake={};try{const om=/window\.__SL_OPS=(\[[\s\S]*?\])<\/script>/.exec(h);if(om)for(const q of JSON.parse(om[1])){if(q&&q.op=='attr'&&q.k=='data-sl-o'){if(q.v){if(q.all)bake[q.v]=q.all;else delete bake[q.v]}else if(q.rv)delete bake[q.rv]}}}catch(e){}
      h=h.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,(m,a,b,c2)=>a+cssProc(b,p,p+'#s'+(sb++))+c2);
      /* trechos que nao podem ser tocados: scripts, noscript, comentarios e picture */
      const frozen=[];const hold=re=>{h=h.replace(re,m=>{frozen.push(m);return '\u0000'+(frozen.length-1)+'\u0001'})};
      hold(/<!--[\s\S]*?-->/g);hold(/<script\b[\s\S]*?<\/script>/gi);hold(/<noscript\b[\s\S]*?<\/noscript>/gi);
      const pics=[];h.replace(/<picture\b[\s\S]*?<\/picture>/gi,(m,i)=>{pics.push([i,i+m.length]);return m});
      let seen=0,first=null;
      h=h.replace(TAG_IMG,(tag,pos)=>{
        const t=parseTag(tag);if(!t)return tag;
        let src=getA(t,'src');if(src==null)return tag;
        const inPic=pics.some(x=>pos>=x[0]&&pos<x[1]);
        if(!inPic&&bake[src]){const nb=bake[src];setA(t,'src',nb);t.a=t.a.filter(x=>!/^(srcset|sizes)$/i.test(x[0]));src=nb}
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
if(typeof module!='undefined')module.exports={makeSpeed,speedCanvasEnc,fixCharset,asciiJs,prettyJs};
