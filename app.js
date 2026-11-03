 'use strict';
const $=id=>document.getElementById(id);let matches=[],demo=false;
const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const aliases={'manchester utd':'manchester united','manchester united fc':'manchester united','manchester city fc':'manchester city','tottenham hotspur':'tottenham','tottenham hotspur fc':'tottenham','wolverhampton wanderers':'wolverhampton',"nott'm forest":'nottingham forest','nottingham forest fc':'nottingham forest','nottm forest':'nottingham forest','brighton and hove albion':'brighton','brighton hove albion':'brighton','newcastle united':'newcastle','newcastle united fc':'newcastle','west ham united':'west ham','leeds united':'leeds','leeds united fc':'leeds','ipswich town':'ipswich','afc bournemouth':'bournemouth','bournemouth afc':'bournemouth','leicester city':'leicester','hull city':'hull','coventry city':'coventry','sunderland afc':'sunderland','crystal palace fc':'crystal palace','aston villa fc':'aston villa','fulham fc':'fulham','everton fc':'everton','brentford fc':'brentford','chelsea fc':'chelsea','arsenal fc':'arsenal','liverpool fc':'liverpool','man united':'manchester united','man utd':'manchester united','man city':'manchester city','spurs':'tottenham','wolves':'wolverhampton','nottm forest':'nottingham forest','newcastle utd':'newcastle','brighton':'brighton','west ham':'west ham','leicester':'leicester','leeds':'leeds','ipswich':'ipswich','bournemouth':'bournemouth','sheffield utd':'sheffield united','west brom':'west brom','qpr':'queens park rangers'};
const canon=s=>{const key=String(s).toLowerCase().trim().replace(/\s+/g,' ');return norm(aliases[key]||key)};
function average(a,f){return a.length?a.reduce((s,x)=>s+f(x),0)/a.length:0}
async function load(){try{let r=await fetch('data/matches.json?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);let d=await r.json();if(!Array.isArray(d))throw Error('Niepoprawny JSON');matches=d.filter(x=>x&&x.home&&x.away&&Number.isInteger(x.hg)&&Number.isInteger(x.ag)&&x.hg>=0&&x.ag>=0&&/^\d{4}-\d\d-\d\d$/.test(x.date)).sort((a,b)=>a.date.localeCompare(b.date));demo=false;$('status').textContent=`Wczytano ${matches.length} zakończonych meczów. Zakres: ${matches[0]?.date||'—'} – ${matches.at(-1)?.date||'—'}.`;return true}catch(e){matches=[];$('status').textContent='Brak danych historycznych: '+e.message+'. Uruchom aktualizację GitHub Actions lub tryb demo.';return false}}
function demoLoad(){let names=['Arsenal','Chelsea','Liverpool','Manchester City','Newcastle','Tottenham','Manchester United','Brighton','Aston Villa','Everton','West Ham','Fulham'];matches=[];for(let k=0;k<3;k++)for(let i=0;i<names.length;i++)for(let j=0;j<names.length;j++){if(i===j)continue;let hg=(i*7+j*3+k*11)%5,ag=(i*3+j*5+k*7)%4;matches.push({date:`202${3+k}-05-${String(1+(i+j)%27).padStart(2,'0')}`,home:names[i],away:names[j],hg,ag})}matches.sort((a,b)=>a.date.localeCompare(b.date));demo=true;$('status').textContent='TRYB DEMO — dane syntetyczne. Wyników nie wolno traktować jako prawdziwych prognoz.';$('fixtures').value='Arsenal; Chelsea; 1.55\nLiverpool; Newcastle; 1.50\nBrighton; Tottenham; 1.60'}
function calc(home,away,rec,weight,cutoff='9999-12-31'){
 let prior=matches.filter(x=>x.date<cutoff),homeMatches=prior.filter(x=>canon(x.home)===canon(home)),awayMatches=prior.filter(x=>canon(x.away)===canon(away));
 if(homeMatches.length<4||awayMatches.length<4)return {error:`Za mało danych domowych/wyjazdowych (${homeMatches.length}/${awayMatches.length})`};
 let hbase=average(prior,x=>x.hg),abase=average(prior,x=>x.ag);if(!hbase||!abase)return {error:'Brak bramek w bazie'};
 let smooth=(sum,count,baseline)=>(sum+5*baseline)/(count+5);
 function teamRate(a,side,field,baseline){let full=smooth(a.reduce((s,x)=>s+(field==='gf'?(side==='home'?x.hg:x.ag):(side==='home'?x.ag:x.hg)),0),a.length,baseline),recent=a.slice(-rec),r=smooth(recent.reduce((s,x)=>s+(field==='gf'?(side==='home'?x.hg:x.ag):(side==='home'?x.ag:x.hg)),0),recent.length,baseline);return (1-weight)*full+weight*r}
 let hgf=teamRate(homeMatches,'home','gf',hbase),hga=teamRate(homeMatches,'home','ga',abase),agf=teamRate(awayMatches,'away','gf',abase),aga=teamRate(awayMatches,'away','ga',hbase);
 let lh=Math.max(.15,Math.min(5,hgf*aga/hbase)),la=Math.max(.15,Math.min(5,agf*hga/abase)),lambda=lh+la,p=1-Math.exp(-lambda)*(1+lambda+lambda*lambda/2);
 return {p,lh,la,lambda,homeCount:homeMatches.length,awayCount:awayMatches.length,lowSample:Math.min(homeMatches.length,awayMatches.length)<30};
}
function parseFixtures(){let errors=[],out=[];$('fixtures').value.split(/\n/).map(x=>x.trim()).filter(Boolean).forEach((line,i)=>{let a=line.split(';').map(x=>x.trim()),odd=Number((a[2]||'').replace(',','.'));if(a.length!==3||!a[0]||!a[1]||canon(a[0])===canon(a[1])||!Number.isFinite(odd)||odd<=1)errors.push(`Wiersz ${i+1}: użyj Gospodarze; Goście; kurs > 1`);else out.push({home:a[0],away:a[1],odd})});return {out,errors}}
function parseXg(){
 const map=new Map(),errors=[];
 ($('xgData')?.value||'').split(/\n/).map(s=>s.trim()).filter(Boolean).forEach((line,i)=>{
  const a=line.split(';').map(s=>s.trim());
  const vals=a.slice(2, a.length===4?4:6).map(s=>Number(s.replace(',','.')));
  if(![4,6,8].includes(a.length)||!a[0]||!a[1]||vals.some(n=>!Number.isFinite(n)||n<0||n>8)||
     (a.length===8&&(!/^\d{4}-\d{2}-\d{2}$/.test(a[6])||!a[7]||!validDate(a[6])))){
   errors.push(`xG wiersz ${i+1}: Gospodarze; Goście; xG gospodarzy; xG gości; xGA gospodarzy; xGA gości; data RRRR-MM-DD; źródło`);return;
  }
  const dated=a.length===8,age=dated?dayAge(a[6]):null;
  const verified=dated&&age>=0&&age<=30;
  map.set(canon(a[0])+'|'+canon(a[1]),{h:vals[0],v:vals[1],hga:vals[2]??null,vga:vals[3]??null,date:dated?a[6]:null,source:dated?a[7]:null,verified,reason:!dated?'brak daty i źródła':age<0?'data z przyszłości':age>30?'dane starsze niż 30 dni':null});
 });return {map,errors};
}
function validDate(s){const d=new Date(s+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s}
function dayAge(s){const now=new Date(),today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());return Math.floor((today-Date.parse(s+'T00:00:00Z'))/86400000)}
function parseReports(){
 const map=new Map(),errors=[];
 ($('teamReports')?.value||'').split(/\n/).map(s=>s.trim()).filter(Boolean).forEach((line,i)=>{
  const a=line.split(';').map(s=>s.trim());
  if(a.length!==6||!a[0]||!a[1]||!['przewidywany','potwierdzony','brak'].includes(a[2].toLowerCase())||!/^\d{4}-\d{2}-\d{2}$/.test(a[5])){
   errors.push(`Raport wiersz ${i+1}: Gospodarze; Goście; przewidywany/potwierdzony/brak; absencje; źródło; RRRR-MM-DD`);return;
  }
  map.set(canon(a[0])+'|'+canon(a[1]),{status:a[2].toLowerCase(),absences:a[3],source:a[4],date:a[5]});
 });return {map,errors};
}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function parseImpact(){
 const map=new Map(),errors=[];
 ($('impactData')?.value||'').split(/\n/).map(s=>s.trim()).filter(Boolean).forEach((line,i)=>{
  const a=line.split(';').map(s=>s.trim()),h=Number((a[2]||'').replace(',','.')),v=Number((a[3]||'').replace(',','.'));
  if(a.length!==6||!a[0]||!a[1]||!Number.isFinite(h)||!Number.isFinite(v)||Math.abs(h)>10||Math.abs(v)>10||!a[4]||!/^\d{4}-\d{2}-\d{2}$/.test(a[5])){
   errors.push(`Korekta wiersz ${i+1}: Gospodarze; Goście; korekta ataku gospodarzy %; korekta ataku gości %; źródło; data RRRR-MM-DD (od -10 do +10)`);return;
  }
  map.set(canon(a[0])+'|'+canon(a[1]),{h,v,source:a[4],date:a[5]});
 });return {map,errors};
}
function adjusted(x,xg,impact,report,blend){
 if(x.error)return x;
 let lh=x.lh,la=x.la,parts=[],flags=[];
 if(xg?.verified){
  const complete=xg.hga!==null&&xg.vga!==null;
  const targetH=complete?Math.sqrt(xg.h*xg.vga):xg.h;
  const targetA=complete?Math.sqrt(xg.v*xg.hga):xg.v;
  const w=blend*(complete?1:0.6);
  lh=(1-w)*lh+w*clamp(targetH,.15,5);
  la=(1-w)*la+w*clamp(targetA,.15,5);
  parts.push('xG'+(complete?'/xGA':' (bez xGA)'));
  if(!complete)flags.push('Brak xGA — mniejsza waga xG');
 }
 if(xg&&!xg.verified)flags.push('xG pominięte: '+xg.reason);
 if(impact){
  const today=new Date().toISOString().slice(0,10);
  const age=Math.floor((Date.parse(today+'T00:00:00Z')-Date.parse(impact.date+'T00:00:00Z'))/86400000);
  if(age>=0&&age<=7){lh*=1+impact.h/100;la*=1+impact.v/100;parts.push('ręczna korekta kadrowa');}
  else flags.push('Korekta kadrowa poza zakresem 7 dni — pominięta');
 }
 if(report){const age=Math.floor((Date.now()-Date.parse(report.date+'T00:00:00Z'))/86400000);if(age>7)flags.push('Raport o składach starszy niż 7 dni');}
 lh=clamp(lh,.15,5);la=clamp(la,.15,5);
 const lambda=lh+la,p=1-Math.exp(-lambda)*(1+lambda+lambda*lambda/2);
 return {...x,lh,la,lambda,p,parts,flags};
}
function brier(p,y){return (p-y)**2}
function loss(p,y){p=clamp(p,1e-6,1-1e-6);return -(y*Math.log(p)+(1-y)*Math.log(1-p))}
function summarize(rows,fn){let n=rows.length,b=0,l=0,p=0,y=0;for(const r of rows){let z=clamp(fn(r),1e-6,1-1e-6);b+=brier(z,r.y);l+=loss(z,r.y);p+=z;y+=r.y}return {n,b:b/n,l:l/n,p:p/n,y:y/n}}
function backtest(){
 const target=$('backtestResult');
 if(!matches.length||demo){target.textContent='Test wymaga prawdziwych danych historycznych.';return}
 target.textContent='Obliczanie prognoz chronologicznych…';
 // Walidacja służy do wyboru parametrów, test jest zamrożony i nie służy do strojenia.
 // Mecze z tego samego dnia nie są używane do przewidywania innych meczów z tego dnia.
 const pool=matches.slice(-650),rows=[];
 const settings=[5,10,15,20].flatMap(rec=>[0,.35,.7].map(weight=>({rec,weight})));
 for(const m of pool){
  const prior=matches.filter(x=>x.date<m.date);
  if(prior.length<100)continue;
  const y=Number(m.hg+m.ag>=3),q=clamp(prior.filter(x=>x.hg+x.ag>=3).length/prior.length,1e-6,1-1e-6);
  const forecasts=settings.map(s=>{const z=calc(m.home,m.away,s.rec,s.weight,m.date);return z.error?null:z.p});
  if(forecasts.some(p=>p===null))continue; // ta sama próba dla wszystkich modeli
  rows.push({date:m.date,y,q,forecasts});
 }
 if(rows.length<220){target.textContent=`Za mało kwalifikujących się spotkań (${rows.length}). Potrzeba co najmniej 220.`;return}
 // Podział według dat, aby ten sam dzień nie występował po obu stronach granicy.
 const split=Math.floor(rows.length/2),boundary=rows[split].date;
 const validation=rows.filter(r=>r.date<boundary),test=rows.filter(r=>r.date>=boundary);
 if(validation.length<100||test.length<100){target.textContent='Za mało spotkań w walidacji lub teście.';return}
 let best=null;
 for(let i=0;i<settings.length;i++)for(const alpha of [0,.25,.5,.75,1]){
  const score=summarize(validation,r=>alpha*r.forecasts[i]+(1-alpha)*r.q);
  if(!best||score.b<best.b-1e-12)best={i,alpha,b:score.b};
 }
 const baseline=summarize(test,r=>r.q);
 const originalIdx=settings.findIndex(s=>s.rec===10&&s.weight===.35);
 const original=summarize(test,r=>r.forecasts[originalIdx]);
 const tuned=summarize(test,r=>r.forecasts[best.i]);
 const blend=summarize(test,r=>best.alpha*r.forecasts[best.i]+(1-best.alpha)*r.q);
 const fmt=x=>x.toFixed(4),percent=x=>(x*100).toFixed(1).replace('.',',')+'%';
 const row=(label,s)=>`<tr><td>${esc(label)}</td><td>${fmt(s.b)}</td><td>${fmt(s.l)}</td><td>${percent(s.p)}</td></tr>`;
 const bins=[];for(let k=0;k<5;k++){const subset=test.filter(r=>{let p=best.alpha*r.forecasts[best.i]+(1-best.alpha)*r.q;return p>=k/5&&(k===4||p<(k+1)/5)});if(subset.length)bins.push({k,s:summarize(subset,r=>best.alpha*r.forecasts[best.i]+(1-best.alpha)*r.q)});}
 const config=settings[best.i],diff=blend.b-baseline.b;
 target.innerHTML=`<p><strong>Walidacja:</strong> ${validation.length} meczów (wybór parametrów). <strong>Test poza próbą:</strong> ${test.length} późniejszych meczów. Granica: ${esc(boundary)}. Wyniki danego dnia nie są dostępne w prognozie.</p>`+
 `<p>Wybrane tylko na walidacji: ostatnie <b>${config.rec}</b> meczów, waga formy <b>${Math.round(config.weight*100)}%</b>, udział Poissona <b>${Math.round(best.alpha*100)}%</b>, udział częstości historycznej <b>${Math.round((1-best.alpha)*100)}%</b>.</p>`+
 `<div class="scroll"><table><thead><tr><th>Model na teście</th><th>Brier ↓</th><th>Log Loss ↓</th><th>Śr. prognoza</th></tr></thead><tbody>`+
 row('Punkt odniesienia — częstość historyczna',baseline)+row('Poisson 1.5 (10 meczów, 35%)',original)+row('Poisson po strojeniu',tuned)+row('Mieszanka wybrana na walidacji',blend)+`</tbody></table></div>`+
 `<p>Rzeczywiste Over 2,5 na teście: <b>${percent(blend.y)}</b>. Różnica Brier mieszanki wobec punktu odniesienia: <b>${diff>0?'+':''}${fmt(diff)}</b> (${diff<0?'niżej — lepiej':diff>0?'wyżej — gorzej':'remis'}). Różnice mogą być przypadkowe.</p>`+
 `<h3>Kalibracja mieszanki na zbiorze testowym</h3><div class="scroll"><table><thead><tr><th>Przedział prognozy</th><th>Mecze</th><th>Śr. prognoza</th><th>Faktyczne Over 2,5</th></tr></thead><tbody>`+
 bins.map(z=>`<tr><td>${z.k*20}–${(z.k+1)*20}%</td><td>${z.s.n}</td><td>${percent(z.s.p)}</td><td>${percent(z.s.y)}</td></tr>`).join('')+`</tbody></table></div>`+
 `<p class="warning">Ważne: strojenie dotyczy tylko historycznego modelu bramkowego. Brak historycznych xG i absencji. To pojedynczy podział czasowy, nie dowód przewagi ani dodatniego EV. Ustawienia wybrane na walidacji są prezentowane do analizy, ale nie zmieniają automatycznie typowania meczów.</p>`;
}
function pct(v){return (100*v).toFixed(1).replace('.',',')+'%'}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function analyze(){let {out,errors}=parseFixtures(),xg=parseXg(),reports=parseReports(),impacts=parseImpact();$('errors').textContent=[...errors,...xg.errors,...reports.errors,...impacts.errors].join(' | ');if(!matches.length){$('result').textContent='Brak danych. Najpierw uruchom aktualizację.';return}let rec=Number($('recent').value),weight=Math.max(0,Math.min(1,(Number($('weight').value)||0)/100)),minP=Math.max(0,Math.min(1,(Number($('minP').value)||0)/100)),minOdds=Math.max(1.01,Number($('minOdds').value)||2);let blend=clamp((Number($('xgWeight').value)||0)/100,0,.4);let rows=out.map(x=>{const key=canon(x.home)+'|'+canon(x.away),gx=xg.map.get(key),rp=reports.map.get(key),im=impacts.map.get(key);return {...x,...adjusted(calc(x.home,x.away,rec,weight),gx,im,rp,blend),xg:gx,report:rp,impact:im}});let ok=rows.filter(x=>!x.error&&x.p>=minP&&(!$('sampleGuard')?.checked||!x.lowSample));let pairs=[];for(let i=0;i<ok.length;i++)for(let j=i+1;j<ok.length;j++){let a=ok[i],b=ok[j],odd=a.odd*b.odd,p=a.p*b.p,ev=p*odd-1;if(odd>=minOdds&&ev>0&&(a.p*a.odd-1)>0&&(b.p*b.odd-1)>0)pairs.push({a,b,odd,p,ev})}pairs.sort((x,y)=>y.ev-x.ev||y.p-x.p);let best=pairs[0];const validPairs=ok.length*(ok.length-1)/2;const note=$('lineupNotes')?.value.trim()||'';const xgLabel=x=>x.xg?`<p class="muted">xG: ${x.xg.h.toFixed(2)} / ${x.xg.v.toFixed(2)}${x.xg.hga!==null?' · xGA: '+x.xg.hga.toFixed(2)+' / '+x.xg.vga.toFixed(2):''} — ${x.xg.verified?'uwzględnione w ocenie':'bez wpływu na ocenę: '+esc(x.xg.reason)}</p>`:'';const reportLabel=x=>x.report?`<p class="muted">Skład: ${esc(x.report.status)} · Absencje: ${esc(x.report.absences||'nie podano')} · Źródło: ${esc(x.report.source||'nie podano')} (${esc(x.report.date)}) — status informacyjny</p>`:'';$('result').innerHTML=best?`<p class="pill">${demo?'DEMO — NIE OBSTAWIAJ':'Ocena końcowa: Poisson + dostępne korekty'}</p><h3>${esc(best.a.home)} – ${esc(best.a.away)} (Over 2,5)</h3><p>Końcowa ocena ${pct(best.a.p)} · kurs ${best.a.odd.toFixed(2)}</p>${best.a.lowSample?'<p class="warning">⚠ Mała próba historyczna — większa niepewność oceny.</p>':''}${xgLabel(best.a)}${reportLabel(best.a)}<h3>${esc(best.b.home)} – ${esc(best.b.away)} (Over 2,5)</h3><p>Końcowa ocena ${pct(best.b.p)} · kurs ${best.b.odd.toFixed(2)}</p>${best.b.lowSample?'<p class="warning">⚠ Mała próba historyczna — większa niepewność oceny.</p>':''}${xgLabel(best.b)}${reportLabel(best.b)}<div class="stat"><div>Kurs łączny<br><strong class="big">${best.odd.toFixed(2)}</strong></div><div>Prawdopodobieństwo modelu<br><strong class="big">${pct(best.p)}</strong></div><div>Szacowane EV<br><strong class="big">${pct(best.ev)}</strong></div></div><p class="warning">EV jest szacunkiem modelu, nie gwarantowaną przewagą. xG może zmieniać prognozę; sam opis składu nie zmienia wyniku bez ręcznej korekty. Prawdopodobieństwa mogą być źle skalibrowane.</p>${note?`<p><b>Uwagi o składach (nie uwzględnione w modelu):</b> ${esc(note)}</p>`:''}`:`<p class="warning"><strong>Brak dubla spełniającego warunki: EV każdego meczu &gt; 0% oraz EV całej pary &gt; 0%.</strong></p><p>Sprawdzono ${validPairs} kombinacji par z meczów przechodzących próg prawdopodobieństwa i filtr próby; do wyboru dopuszczamy tylko pary z dodatnim EV obu meczów. Nie wymuszamy wyboru.</p><p class="muted">Wynik zależy od jakości danych i kalibracji modelu.</p>`;
$('ranking').innerHTML='<table><thead><tr><th>Mecz</th><th>Ocena Over 2,5</th><th>Gole ocz.</th><th>xG / xGA (pomocniczo)</th><th>Składy / absencje</th><th>Kurs</th><th>EV</th><th>Próba</th><th>Wpływ danych</th><th>Wiarygodność danych</th></tr></thead><tbody>'+rows.sort((a,b)=>(b.p||0)-(a.p||0)).map(x=>`<tr><td>${esc(x.home)} – ${esc(x.away)}</td><td>${x.error?esc(x.error):pct(x.p)}</td><td>${x.error?'—':x.lambda.toFixed(2)}</td><td>${x.xg?x.xg.h.toFixed(2)+' / '+x.xg.v.toFixed(2)+(x.xg.hga!==null?' · xGA '+x.xg.hga.toFixed(2)+' / '+x.xg.vga.toFixed(2):''):'brak'}</td><td>${x.report?esc(x.report.status)+' · '+esc(x.report.absences||'brak informacji')+' · '+esc(x.report.source||'bez źródła')+' ('+esc(x.report.date)+')':'brak danych'}</td><td>${x.odd.toFixed(2)}</td><td>${x.error?'—':pct(x.p*x.odd-1)}</td><td>${x.error?'—':x.homeCount+'/'+x.awayCount}</td><td>${esc([...(x.parts||[]),...(x.flags||[])].join(' · ')||'model bramkowy')}</td><td>${x.error?'Brak wystarczających danych':x.lowSample?'⚠ Mała próba (<30)':'Standardowa próba'}</td></tr>`).join('')+'</tbody></table>';
}
function showTeams(){if(!matches.length){$('teamsInfo').textContent='Najpierw wczytaj dane historyczne.';return}const counts=new Map();for(const m of matches){for(const [name,side] of [[m.home,'home'],[m.away,'away']]){const k=canon(name);if(!counts.has(k))counts.set(k,{names:new Set(),home:0,away:0});const x=counts.get(k);x.names.add(name);x[side]++}}$('teamsInfo').innerHTML='<p>Takie nazwy i liczby meczów występują w pobranej bazie (0 może oznaczać brak danych, np. dla beniaminka):</p><div class="scroll"><table><thead><tr><th>Drużyna w bazie</th><th>Dom</th><th>Wyjazd</th></tr></thead><tbody>'+[...counts].sort((a,b)=>a[0].localeCompare(b[0])).map(([key,x])=>'<tr><td>'+esc([...x.names].join(' / '))+'</td><td>'+x.home+'</td><td>'+x.away+'</td></tr>').join('')+'</tbody></table></div>'}$('showTeams').onclick=showTeams;$('reload').onclick=async()=>{await load();$('teamsInfo').textContent='Kliknij „Pokaż drużyny w bazie”, aby odświeżyć listę.'};$('demo').onclick=demoLoad;$('analyze').onclick=analyze;load();

$('backtest').onclick=backtest;
