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
function backtest(){
 if(!matches.length||demo){$('backtestResult').textContent='Backtest wymaga prawdziwych danych historycznych.';return}
 const rec=Number($('recent').value),weight=clamp((Number($('weight').value)||0)/100,0,1);
 const candidates=matches.slice(-300);let n=0,brier=0,actual=0,pred=0,baselineBrier=0,logLoss=0,baselineLogLoss=0;
 for(const m of candidates){
  const r=calc(m.home,m.away,rec,weight,m.date);if(r.error)continue;
  const prior=matches.filter(x=>x.date<m.date);
  if(prior.length<100)continue;
  const base=prior.filter(x=>x.hg+x.ag>=3).length/prior.length;
  const y=m.hg+m.ag>=3?1:0,p=clamp(r.p,0.000001,0.999999),q=clamp(base,0.000001,0.999999);
  n++;brier+=(p-y)**2;baselineBrier+=(q-y)**2;actual+=y;pred+=p;
  logLoss-=y*Math.log(p)+(1-y)*Math.log(1-p);
  baselineLogLoss-=y*Math.log(q)+(1-y)*Math.log(1-q);
 }
 $('backtestResult').textContent=n?`Backtest chronologiczny: ${n} z ostatnich 300 meczów (bez wyników z dnia typowanego). Brier modelu ${(brier/n).toFixed(4)}; Brier punktu odniesienia ${(baselineBrier/n).toFixed(4)}. Log Loss modelu ${(logLoss/n).toFixed(4)}; Log Loss odniesienia ${(baselineLogLoss/n).toFixed(4)}. Mniej = lepiej. Średnia prognoza ${pct(pred/n)}, faktyczne Over 2,5 ${pct(actual/n)}. Punkt odniesienia: historyczny udział Over 2,5 przed każdym meczem. UWAGA: test wyłącznie modelu bramkowego, bez historycznych xG i absencji; nie dowodzi skuteczności dodatniego EV.`:'Za mało danych do testu historycznego.';
}
function pct(v){return (100*v).toFixed(1).replace('.',',')+'%'}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function analyze(){let {out,errors}=parseFixtures(),xg=parseXg(),reports=parseReports(),impacts=parseImpact();$('errors').textContent=[...errors,...xg.errors,...reports.errors,...impacts.errors].join(' | ');if(!matches.length){$('result').textContent='Brak danych. Najpierw uruchom aktualizację.';return}let rec=Number($('recent').value),weight=Math.max(0,Math.min(1,(Number($('weight').value)||0)/100)),minP=Math.max(0,Math.min(1,(Number($('minP').value)||0)/100)),minOdds=Math.max(1.01,Number($('minOdds').value)||2);let blend=clamp((Number($('xgWeight').value)||0)/100,0,.4);let rows=out.map(x=>{const key=canon(x.home)+'|'+canon(x.away),gx=xg.map.get(key),rp=reports.map.get(key),im=impacts.map.get(key);return {...x,...adjusted(calc(x.home,x.away,rec,weight),gx,im,rp,blend),xg:gx,report:rp,impact:im}});let ok=rows.filter(x=>!x.error&&x.p>=minP&&(!$('sampleGuard')?.checked||!x.lowSample));let pairs=[];for(let i=0;i<ok.length;i++)for(let j=i+1;j<ok.length;j++){let a=ok[i],b=ok[j],odd=a.odd*b.odd,p=a.p*b.p,ev=p*odd-1;if(odd>=minOdds&&ev>0)pairs.push({a,b,odd,p,ev})}pairs.sort((x,y)=>y.ev-x.ev||y.p-x.p);let best=pairs[0];const validPairs=ok.length*(ok.length-1)/2;const note=$('lineupNotes')?.value.trim()||'';const xgLabel=x=>x.xg?`<p class="muted">xG: ${x.xg.h.toFixed(2)} / ${x.xg.v.toFixed(2)}${x.xg.hga!==null?' · xGA: '+x.xg.hga.toFixed(2)+' / '+x.xg.vga.toFixed(2):''} — ${x.xg.verified?'uwzględnione w ocenie':'bez wpływu na ocenę: '+esc(x.xg.reason)}</p>`:'';const reportLabel=x=>x.report?`<p class="muted">Skład: ${esc(x.report.status)} · Absencje: ${esc(x.report.absences||'nie podano')} · Źródło: ${esc(x.report.source||'nie podano')} (${esc(x.report.date)}) — status informacyjny</p>`:'';$('result').innerHTML=best?`<p class="pill">${demo?'DEMO — NIE OBSTAWIAJ':'Ocena końcowa: Poisson + dostępne korekty'}</p><h3>${esc(best.a.home)} – ${esc(best.a.away)} (Over 2,5)</h3><p>Końcowa ocena ${pct(best.a.p)} · kurs ${best.a.odd.toFixed(2)}</p>${best.a.lowSample?'<p class="warning">⚠ Mała próba historyczna — większa niepewność oceny.</p>':''}${xgLabel(best.a)}${reportLabel(best.a)}<h3>${esc(best.b.home)} – ${esc(best.b.away)} (Over 2,5)</h3><p>Końcowa ocena ${pct(best.b.p)} · kurs ${best.b.odd.toFixed(2)}</p>${best.b.lowSample?'<p class="warning">⚠ Mała próba historyczna — większa niepewność oceny.</p>':''}${xgLabel(best.b)}${reportLabel(best.b)}<div class="stat"><div>Kurs łączny<br><strong class="big">${best.odd.toFixed(2)}</strong></div><div>Prawdopodobieństwo modelu<br><strong class="big">${pct(best.p)}</strong></div><div>Szacowane EV<br><strong class="big">${pct(best.ev)}</strong></div></div><p class="warning">EV jest szacunkiem modelu, nie gwarantowaną przewagą. xG może zmieniać prognozę; sam opis składu nie zmienia wyniku bez ręcznej korekty. Prawdopodobieństwa mogą być źle skalibrowane.</p>${note?`<p><b>Uwagi o składach (nie uwzględnione w modelu):</b> ${esc(note)}</p>`:''}`:`<p class="warning"><strong>Brak dubla z dodatnią wartością oczekiwaną (EV &gt; 0) spełniającego warunki.</strong></p><p>Sprawdzono ${validPairs} kombinacji par z meczów przechodzących próg prawdopodobieństwa. Nie wymuszamy wyboru.</p><p class="muted">Wynik zależy od jakości danych i kalibracji modelu.</p>`;
$('ranking').innerHTML='<table><thead><tr><th>Mecz</th><th>Ocena Over 2,5</th><th>Gole ocz.</th><th>xG / xGA (pomocniczo)</th><th>Składy / absencje</th><th>Kurs</th><th>EV</th><th>Próba</th><th>Wpływ danych</th><th>Wiarygodność danych</th></tr></thead><tbody>'+rows.sort((a,b)=>(b.p||0)-(a.p||0)).map(x=>`<tr><td>${esc(x.home)} – ${esc(x.away)}</td><td>${x.error?esc(x.error):pct(x.p)}</td><td>${x.error?'—':x.lambda.toFixed(2)}</td><td>${x.xg?x.xg.h.toFixed(2)+' / '+x.xg.v.toFixed(2)+(x.xg.hga!==null?' · xGA '+x.xg.hga.toFixed(2)+' / '+x.xg.vga.toFixed(2):''):'brak'}</td><td>${x.report?esc(x.report.status)+' · '+esc(x.report.absences||'brak informacji')+' · '+esc(x.report.source||'bez źródła')+' ('+esc(x.report.date)+')':'brak danych'}</td><td>${x.odd.toFixed(2)}</td><td>${x.error?'—':pct(x.p*x.odd-1)}</td><td>${x.error?'—':x.homeCount+'/'+x.awayCount}</td><td>${esc([...(x.parts||[]),...(x.flags||[])].join(' · ')||'model bramkowy')}</td><td>${x.error?'Brak wystarczających danych':x.lowSample?'⚠ Mała próba (<30)':'Standardowa próba'}</td></tr>`).join('')+'</tbody></table>';
}
function showTeams(){if(!matches.length){$('teamsInfo').textContent='Najpierw wczytaj dane historyczne.';return}const counts=new Map();for(const m of matches){for(const [name,side] of [[m.home,'home'],[m.away,'away']]){const k=canon(name);if(!counts.has(k))counts.set(k,{names:new Set(),home:0,away:0});const x=counts.get(k);x.names.add(name);x[side]++}}$('teamsInfo').innerHTML='<p>Takie nazwy i liczby meczów występują w pobranej bazie (0 może oznaczać brak danych, np. dla beniaminka):</p><div class="scroll"><table><thead><tr><th>Drużyna w bazie</th><th>Dom</th><th>Wyjazd</th></tr></thead><tbody>'+[...counts].sort((a,b)=>a[0].localeCompare(b[0])).map(([key,x])=>'<tr><td>'+esc([...x.names].join(' / '))+'</td><td>'+x.home+'</td><td>'+x.away+'</td></tr>').join('')+'</tbody></table></div>'}$('showTeams').onclick=showTeams;$('reload').onclick=async()=>{await load();$('teamsInfo').textContent='Kliknij „Pokaż drużyny w bazie”, aby odświeżyć listę.'};$('demo').onclick=demoLoad;$('analyze').onclick=analyze;load();

$('backtest').onclick=backtest;
