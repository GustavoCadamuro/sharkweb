'use strict';
/* Corte de fala natural: segue as regras da skill "audio".
   So corta (nunca mexe na voz). Mede a pausa pelo que o ouvido escuta (energia), nao pelo tempo do Whisper. */
const CAT={J:{t:.10,lo:.08,hi:.13},R:{t:.16,lo:.14,hi:.19}};
const pct=(a,p)=>{const b=Float32Array.from(a).sort();return b.length?b[Math.min(b.length-1,Math.max(0,Math.floor(b.length*p)))]:0};
const nw=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]/g,'');
const FILL=/^(e+h+|a+h+|h+u+m+|h+m+|ã+h+|ahn|uhm|hã|hum|ér|éé+|eee+|hmm+|ééé*|ãh+|éh+)$/i;
const KEEPREP=/^(muito|sempre|nunca|bem|nao|sim|tchau|ta|la|ha|ah)$/;

/* x: Float32Array (-1..1), mono. Janelas de 10 ms (janela de 20 ms). */
function analyze(x,sr){
  const hop=Math.max(1,Math.round(sr*.01)),win=hop*2,n=Math.max(0,Math.floor((x.length-win)/hop)+1);
  const db=new Float32Array(n),hf=new Float32Array(n);
  for(let i=0;i<n;i++){let s=0,h=0;const o=i*hop;for(let j=0;j<win;j++){const v=x[o+j];s+=v*v;if(j>=2){const d=v-2*x[o+j-1]+x[o+j-2];h+=d*d}}db[i]=10*Math.log10(s/win+1e-12);hf[i]=10*Math.log10(h/win+1e-12)}
  // suaviza 3 janelas
  const sm=a=>{const b=new Float32Array(a.length);for(let i=0;i<a.length;i++){b[i]=(a[Math.max(0,i-1)]+a[i]+a[Math.min(a.length-1,i+1)])/3}return b};
  const dbs=sm(db),floor=pct(db,.05),loud=[];for(let i=0;i<n;i++)if(db[i]>floor+15)loud.push(db[i]);
  const typ=loud.length?pct(loud,.75):floor+30,thr=Math.max(floor+10,typ-30);
  const hfF=pct(hf,.05),loudH=[];for(let i=0;i<n;i++)if(hf[i]>hfF+15)loudH.push(hf[i]);
  const hfTyp=loudH.length?pct(loudH,.75):hfF+30,hfThr=Math.max(hfF+10,hfTyp-30);
  const m=new Uint8Array(n);for(let i=0;i<n;i++)m[i]=(db[i]>thr||hf[i]>hfThr)?1:0;
  // fecha buracos < 100 ms dentro da fala (fechamento antes de p, t, k)
  for(let i=0;i<n;){if(m[i]){i++;continue}let j=i;while(j<n&&!m[j])j++;if(i>0&&j<n&&j-i<10)for(let k=i;k<j;k++)m[k]=1;i=j}
  const segs=[];for(let i=0;i<n;){if(!m[i]){i++;continue}let j=i;while(j<n&&m[j])j++;if(j-i>=2)segs.push({a:i,b:j});i=j}
  return{db,dbs,hf,hop,n,sr,thr,hfThr,floor,typ,segs,dur:x.length/sr,T:i=>i*hop/sr}
}

/* words: [{t,a,b}] do Whisper (com pontuacao). Retorna {keep:[[a,b]...], stats, pauses, warn} */
function plan(an,words,opt){
  opt=opt||{};const hp=an.hop/an.sr,dur=an.dur;
  let S=an.segs.map(s=>({a:s.a*hp,b:s.b*hp,ia:s.a,ib:s.b}));
  const W=(words||[]).filter(w=>w&&w.t&&w.b>=w.a);
  const stats={fill:0,rep:0,noise:0,tails:0,cuts:0,dup:0};
  if(!S.length)return{keep:[],stats,pauses:[],warn:['Não ouvi fala.']};
  // ---- ruidos: respiracao e estalo (som curto/baixo, sem palavra, com >= 0,12 s de silencio antes)
  const wordNear=(a,b,tol)=>W.some(w=>!/^\[.*\]$/.test(w.t)&&w.b>=a-tol&&w.a<=b+tol);
  const noises=[];
  S=S.filter((s,i)=>{const prevEnd=i?S[i-1].b:0,gapBefore=s.a-prevEnd,d=s.b-s.a;
    if(!W.length||gapBefore<.12||d>.6)return true;
    let pk=-200;for(let k=s.ia;k<s.ib;k++)if(an.db[k]>pk)pk=an.db[k];
    const quiet=pk<an.typ-12,short=d<=.2;
    if((short||quiet)&&!wordNear(s.a,s.b,.2)){noises.push({a:s.a,b:s.b});stats.noise++;return false}
    return true});
  if(!S.length)return{keep:[],stats,pauses:[],warn:['Só havia ruído.']};
  // ---- remocoes pedidas pelo texto: muletas e repeticoes (fica a ultima tentativa)
  const rem=[];
  let w2=W.filter(w=>!/^\[.*\]$/.test(w.t)&&nw(w.t));
  for(const w of w2)if(FILL.test(w.t.toLowerCase().replace(/[.,!?…]/g,''))){rem.push({a:w.a,b:w.b});stats.fill++}
  w2=w2.filter(w=>!FILL.test(w.t.toLowerCase().replace(/[.,!?…]/g,'')));
  for(let i=0;i<w2.length;i++){for(let n=Math.min(8,Math.floor((w2.length-i)/2));n>=1;n--){let eq=true;for(let k=0;k<n;k++){if(!nw(w2[i+k].t)||nw(w2[i+k].t)!==nw(w2[i+n+k].t)){eq=false;break}}
    if(eq&&(n>=2||nw(w2[i].t).length>=2)&&!KEEPREP.test(nw(w2[i].t))){rem.push({a:w2[i].a,b:w2[i+n-1].b});stats.rep++;i+=n-1;break}}}
  // ---- aplica remocoes: segmento quase todo removido sai inteiro; senao corta no ponto mais baixo
  const lowAt=(t0,t1)=>{let bi=-1,bv=1e9;const i0=Math.max(0,Math.floor(t0/hp)),i1=Math.min(an.n-1,Math.ceil(t1/hp));for(let i=i0;i<=i1;i++)if(an.dbs[i]<bv){bv=an.dbs[i];bi=i}return bi<0?t0:bi*hp+hp/2};
  let blocks=[];
  for(const s of S){let pieces=[[s.a,s.b]],dropped=false;
    for(const r of rem){if(r.b<s.a-.05||r.a>s.b+.05)continue;
      const ov=Math.min(s.b,r.b)-Math.max(s.a,r.a);if(ov<=0)continue;
      if(ov/(s.b-s.a)>.6){dropped=true;break}
      const L=lowAt(r.a-.12,r.a+.03)-.0,R=lowAt(r.b-.03,r.b+.12);
      const np=[];for(const p of pieces){if(R<=p[0]||L>=p[1]){np.push(p);continue}if(L>p[0]+.05)np.push([p[0],L+.03]);if(R<p[1]-.05)np.push([R-.03,p[1]])}pieces=np}
    if(dropped)continue;
    pieces.sort((x,y)=>x[0]-y[0]);
    pieces.forEach((p,k)=>blocks.push({a:p[0],b:p[1],orig:s,joinPrev:k>0,isEnd:k==pieces.length-1,ia:s.ia,ib:s.ib}))}
  blocks=blocks.filter(b=>b.b-b.a>.06);
  if(!blocks.length)return{keep:[],stats,pauses:[],warn:['Não sobrou fala depois da limpeza.']};
  // ---- finais arrastados: a palavra termina 0,04 s depois de a voz cair 12 dB (sem cortar s, f, x, ch)
  for(let k=0;k<blocks.length;k++){const b=blocks[k],next=blocks[k+1],gapAfter=next?next.a-b.b:dur-b.b;
    if(!b.isEnd||(next&&gapAfter<.12))continue;
    const iEnd=Math.min(an.n-1,Math.floor(b.b/hp)-1),iFrom=Math.max(0,iEnd-50);let pk=-200;for(let i=iFrom;i<=iEnd;i++)if(an.dbs[i]>pk)pk=an.dbs[i];
    let i=iEnd;while(i>iFrom&&an.dbs[i]<pk-12&&an.hf[i]<an.hfThr)i--;
    const ne=(i+1)*hp;if(b.b-ne>=.05&&b.b-ne<=.4&&i>iFrom){
      // se ha letra (som agudo) depois do ponto, nao corta
      let letter=false;for(let q=i+1;q<=iEnd;q++)if(an.hf[q]>an.hfThr){letter=true;break}
      if(!letter){b.b=ne;stats.tails++}}}
  // ---- pausas: classifica e encurta so o que passa da faixa (nunca alonga, nunca insere silencio)
  const fw=w2.length?w2:W;
  const wordEndingAt=t=>{let best=null,bd=.45;for(const w of fw){const d=Math.abs(w.b-t);if(d<bd){bd=d;best=w}}return best};
  const wordStartingAt=t=>{let best=null,bd=.45;for(const w of fw){const d=Math.abs(w.a-t);if(d<bd){bd=d;best=w}}return best};
  const catOf=(t,bk)=>{if(opt.cat)return opt.cat;const w=wordEndingAt(t);if(!w)return'J';return/[.!?…]["')\]]?$/.test(String(w.t).trim())?'R':'J'};
  const pre=t=>{const w=wordStartingAt(t);const c=w?nw(w.t)[0]:'';return /[ptkbdg]/.test(c||'')?.06:.04};
  const keep=[],pauses=[];
  const push=(a,b)=>{if(b-a<=1e-4)return;const l=keep[keep.length-1];if(l&&a<=l[1]+1e-4){l[1]=Math.max(l[1],b)}else keep.push([a,b])};
  const first=blocks[0];let cur=[Math.max(0,first.a-.04),first.b];
  const noiseIn=(a,b)=>noises.filter(n=>n.b>a&&n.a<b);
  for(let k=0;k<blocks.length-1;k++){const A=blocks[k],B=blocks[k+1];
    if(B.joinPrev&&B.orig===A.orig){ // emenda no meio da fala depois de tirar uma muleta/repeticao
      push(cur[0],A.b);cur=[B.a,B.b];stats.cuts++;pauses.push({at:A.b,L:0,out:0,cat:'x',spliced:1});continue}
    const L=B.a-A.b,cat=catOf(A.b,A),C=CAT[cat],T=C.t,top=C.hi,ns=noiseIn(A.b,B.a);
    if(L>top){let tail=.04,head=Math.max(T-.04,pre(B.a));
      for(const n of ns){if(n.a<A.b+tail)tail=Math.max(0,n.a-A.b-.01);if(n.b>B.a-head)head=Math.max(.02,Math.min(head,B.a-n.b-.01))}
      tail=Math.max(0,tail);head=Math.min(head,Math.max(0,L-tail));
      push(cur[0],A.b+tail);cur=[B.a-head,B.b];stats.cuts++;pauses.push({at:A.b,L,out:tail+head,cat})}
    else if(ns.length){ // pausa ja pequena, mas tem respiracao/estalo: tira so ele
      let a0=A.b;for(const n of ns){push(cur[0],Math.max(a0,n.a-.01));cur=[n.b+.01,B.b];a0=n.b}
      pauses.push({at:A.b,L,out:L,cat,noise:1})}
    else{cur=[cur[0],B.b];pauses.push({at:A.b,L,out:L,cat,kept:1})}}
  const last=blocks[blocks.length-1];push(cur[0],Math.min(dur,last.b+(opt.endPad==null?.15:opt.endPad)));
  // junta pedaços que ficaram colados
  const keep2=[];for(const k of keep){const l=keep2[keep2.length-1];if(l&&k[0]<=l[1]+1e-4)l[1]=Math.max(l[1],k[1]);else keep2.push(k.slice())}
  // ---- conferencia: toda pausa que mudou tem que estar dentro da faixa
  const warn=[];for(const p of pauses){if(p.spliced||p.kept||p.noise)continue;const C=CAT[p.cat];if(p.out>C.hi+.03||p.out<C.lo-.05)warn.push('pausa em '+p.at.toFixed(1)+'s ficou com '+p.out.toFixed(2)+' s')}
  return{keep:keep2,stats,pauses,warn,noises}
}

module.exports={analyze,plan,CAT,FILL,nw};
