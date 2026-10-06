function accountLabel(){return 'Annual AF O&M · 3400'}
function rateText(e){return e.updated==null||e.obligations==null?'Not established':e.updated>0?`${(100*e.obligations/e.updated).toFixed(1)}%`:'Not established (zero denominator)'}
function setupCoverage(){
 const sagCount=new Set(Object.keys(data.bridges).map(k=>k.split('-',2)[1]).filter(k=>/^0[1-4][0-9][A-Z]$/.test(k))).size;
 $('coverage-summary').textContent=`Explore the Air Force total, its 4 Budget Activities (BAs), and ${sagCount} Subactivity Group (SAG) identifiers represented across the source years. SAG coverage varies by fiscal year; historical reporting rows are retained where applicable.`;
 $('source-list').innerHTML=data.sources.filter(s=>!/cover/i.test(s.title+' '+s.source)).map(s=>`<a href="${esc(s.source)}" target="_blank" rel="noopener">${esc(s.title.replace('1416','Budget execution report'))}</a>`).join('');
}
function renderInsights(){
 renderReport();
 const findings=[],{y,stage,e,b}=reportContext();
 const add=(title,text,ref)=>findings.push({title,text,ref});
 const requestSelected=!stage||stage==='Budget Request'||stage===`FY${y} request`;
 const programSelected=requestSelected||view==='bridge'&&['increase','decrease'].includes(selected?.type);
 const adjustmentSelected=!stage||['Reprogramming / Adjustments','Updated Budget'].includes(stage);
 const congressSelected=!stage||['Congressional Action','Enacted'].includes(stage);
 const obligationSelected=!stage||stage==='Obligations';
 const fmt=v=>reportValue(v,true);
 // Analyze only the figure selected (or the measures shown in the overview).
 if(b&&programSelected&&(view!=='trend'||selected||metric==='budget')){
  if(b.increases>0&&b.decreases<0){const gross=b.increases+Math.abs(b.decreases),net=Math.abs(b.program);
   if(gross>net*1.5)add('The net change hides larger movements',`Program additions of ${fmt(b.increases)} and reductions of ${fmt(b.decreases)} produce a net ${fmt(b.program)}. Reviewing only the net would hide ${reportValue(Math.min(b.increases,Math.abs(b.decreases)))} in changes moving in opposite directions. The documented purposes are in Behind the Numbers.`,b);
  }
  const temporary=(b.drivers||[]).filter(d=>/one.time|temporary|non.recurring/i.test(d.description+' '+d.title));
  if(temporary.length)add('Check the recurring funding baseline',`${temporary.length} documented change${temporary.length===1?' refers':'s refer'} to temporary or one-time funding. For example, “${temporary[0].title}.” Treating the entire movement as a recurring increase or reduction could misstate the ongoing requirement.`,{source:temporary[0].source||b.source,page:temporary[0].page||b.page});
 }
 const observations=view==='trend'&&!selected?selectedYears.map(y=>({y,e:data.execution[`${y}-${entity}`]})).filter(x=>x.e):e?[{y,e}]:[];
 if(view!=='bridge')for(const {y:fy,e:x} of observations){
  if(adjustmentSelected&&(view!=='trend'||selected||['budget','adjustments'].includes(metric))&&x.adjustments!=null&&x.reportedAdjustments!=null&&Math.abs(x.adjustments-x.reportedAdjustments)>.001)
   add(`FY${fy}: adjustment detail needs reconciliation`,`The component total differs from Updated Budget minus Enacted by ${fmt(x.adjustments-x.reportedAdjustments)}. ${offsetNote(fy,x)} The difference is established; its cause is not. Review the underlying actions before attributing the movement to a program decision.`,x);
  if(obligationSelected&&(view!=='trend'||selected||metric==='obligations')&&x.obligations!=null&&x.updated>0&&(x.obligations/x.updated>1||x.obligations/x.updated<.9))
   add(`FY${fy}: review the obligation rate`,`${rateText(x)} falls outside this prototype’s 90–100% review range. Check the report’s funding scope and adjustments before interpreting it as underexecution or overexecution. Without a spending plan, this is not a performance assessment.`,x);
  if(congressSelected&&(view!=='trend'||selected||['budget','congress'].includes(metric))&&x.congressDetails?.items?.length){
   const items=x.congressDetails.items,pos=items.filter(i=>i.value>0).reduce((s,i)=>s+i.value,0),neg=items.filter(i=>i.value<0).reduce((s,i)=>s+i.value,0);
   if(pos&&neg&&Math.min(pos,-neg)>Math.abs(pos+neg)*.25)add(`FY${fy}: congressional actions move in both directions`,`The loaded action detail includes ${fmt(pos)} in additions and ${fmt(neg)} in reductions. The net alone understates the scale of individual congressional decisions; review the action purposes in the reporting panel.`,x.congressDetails);
   const temp=items.find(i=>/one.time|temporary|non.recurring/i.test(i.label));
   if(temp)add(`FY${fy}: one-time funding affects the baseline`,`“${temp.label}” is identified as temporary or one-time funding. Do not assume it continues into the next request; compare the next J-book’s baseline treatment before interpreting a reduction.`,x.congressDetails);
  }
 }
 if(view==='trend'&&!selected&&observations.length>=3){
  for(const key of metric==='congress'?['congress']:metric==='adjustments'?['adjustments']:metric==='budget'?['congress','adjustments']:[]){
   const vals=observations.filter(x=>x.e[key]!=null);
   if(vals.length===observations.length&&(vals.every(x=>x.e[key]>0)||vals.every(x=>x.e[key]<0)))add(`Repeated ${vals[0].e[key]>0?'additions':'reductions'} across selected years`,`${key==='congress'?'Congressional Action':'Reprogramming / Adjustments'} has the same net direction in all ${vals.length} available selected years. This suggests a recurring pattern worth investigating, but does not establish that the same actions or causes recur.`,vals[vals.length-1].e);
  }
 }
 const cards=findings.map(f=>{const brief=reportBrief(f.text,1),rest=f.text.slice(brief.length).trim();return `<article class="insight"><h3>${esc(f.title)}</h3><p>${esc(brief)}</p>${rest?reportMore('Why it matters',`<p>${esc(rest)}</p>${reportRef(f.ref,'Review the source')}`):reportRef(f.ref,'Review the source')}</article>`});
 $('insights').innerHTML=cards.length?cards.slice(0,2).join('')+(cards.length>2?reportMore(`More observations (${cards.length-2})`,cards.slice(2).join('')):''):'<p class="no-findings">No additional finding for this selection.</p>';
 if(selected&&['Reprogramming / Adjustments','Updated Budget'].includes(stage))$('insights').innerHTML+=relatedDifferences(y,e);
 $('movers-list').innerHTML='';
}
function openFinding(f){
 const index=rows.findIndex(r=>(r.stage||r.label)===f.stage&&(view!=='trend'||r.year===f.y));
 if(index>=0){selected=rows[index];explainFigure();document.querySelectorAll('#chart rect[data-index]').forEach(b=>{const on=+b.dataset.index===index;b.classList.toggle('selected-bar',on);b.setAttribute('aria-pressed',String(on))});}
}

function offsetNote(y,e){
 if(!/^0[1-4]/.test(entity))return '';
 const diff=e.adjustments-e.reportedAdjustments;
 const peer=Object.entries(data.execution).find(([k,v])=>k.startsWith(`${y}-${entity.slice(0,2)}`)&&k!==`${y}-${entity}`&&Math.abs(v.adjustments-v.reportedAdjustments+diff)<.001);
 return peer?`An equal and opposite difference appears in ${peer[0].slice(5)} (${data.entities[peer[0].slice(5)]}); the pair offsets within the same budget activity, but that does not establish the cause.`:'';
}
function renderMovers(){
 const targetYear=view==='trend'?Math.max(...selectedYears):year;
 const entries=Object.entries(view==='bridge'?data.bridges:data.execution).filter(([k,v])=>k.startsWith(`${targetYear}-0`)&&(/^0[1-4][0-9][A-Z]$/).test(k.slice(5))&&(view==='bridge'||v.adjustments!=null));
 const movers=entries.map(([k,v])=>({id:k.slice(5),ref:v,delta:view==='bridge'?v.program:v.adjustments,base:view==='bridge'?v.baseline:v.enacted})).filter(x=>x.delta!==0).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)).slice(0,3);
 $('movers-label').textContent=`Largest ${view==='bridge'?'net program changes':'post-enactment changes'} across budget areas · FY${Number.isFinite(targetYear)?targetYear:'—'}`;
 $('movers-list').innerHTML=movers.length?movers.map((m,i)=>`<button class="mover quiet" data-mover="${i}"><strong>${esc(m.id)} · ${esc(data.entities[m.id])}</strong><span>${amount(m.delta,true)} ${unit()}${m.base?` · ${(100*m.delta/Math.abs(m.base)).toFixed(1)}% of ${view==='bridge'?'baseline':'enacted'}`:''}</span></button>`).join(''):'<p>No matched changes for this selection.</p>';
 document.querySelectorAll('[data-mover]').forEach(b=>b.onclick=()=>{const m=movers[+b.dataset.mover];entity=m.id;$('entity').value=entity;const bridge=view==='bridge';if(!bridge){view='single';year=targetYear;document.querySelectorAll('nav button').forEach(n=>n.classList.toggle('active',n.dataset.view===view));}yearControls();render();openFinding({stage:bridge?(m.delta<0?'Program decreases':'Program increases'):'Reprogramming / Adjustments',y:targetYear,ref:m.ref,title:'Largest change',text:'Review the documented components.'});});
}
function parentBA(id){return /^BA0[1-4]/.test(id)?id.slice(0,4):/^0[1-4][0-9][A-Z]$/.test(id)?'BA'+id.slice(0,2):null}
function setBudgetLevel(id){entity=data.entities[id]?id:'3400';syncBudgetLevels();render()}
function syncBudgetLevels(){
 const ba=parentBA(entity);
 $('ba').innerHTML='<option value="3400">Air Force O&M overall</option>'+['BA01','BA02','BA03','BA04'].map(k=>`<option value="${k}">${esc(data.entities[k])}</option>`).join('');
 $('ba').value=ba||'3400';$('ba').onchange=e=>setBudgetLevel(e.target.value);
 $('sag-filter').hidden=!ba;
 const children=ba?Object.entries(data.entities).filter(([k])=>/^0[1-4][0-9][A-Z]$/.test(k)&&parentBA(k)===ba):[];
 $('entity').innerHTML=ba?`<option value="${ba}">All ${esc(data.entities[ba].split(' · ')[0])} · BA summary</option>`+children.map(([k,v])=>`<option value="${k}">${k} · ${esc(v)}</option>`).join('')+Object.entries(data.entities).filter(([k])=>k.startsWith(ba+'-')).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join(''):'<option value="3400">Air Force O&M overall</option>';
 $('entity').value=entity;
 $('scope-path').innerHTML=`<button id="af-overall" ${entity==='3400'?'aria-current="location"':''}>AF O&M overall</button>${ba?`<span aria-hidden="true">›</span><button id="ba-summary" ${entity===ba?'aria-current="location"':''}>${esc(data.entities[ba])}</button>`:''}${ba&&entity!==ba?`<span aria-hidden="true">›</span><span aria-current="location">${esc(entity)} · ${esc(data.entities[entity])}</span>`:''}<span class="annual-scope">1-year appropriation 3400 only</span>`;
 $('af-overall').onclick=()=>setBudgetLevel('3400');if($('ba-summary'))$('ba-summary').onclick=()=>setBudgetLevel(ba);
}
function renderParentBridge(b){
 $('view-kicker').textContent='YEAR-TO-YEAR COMPARISON';$('chart-title').textContent=`FY${year-1} to FY${year} · ${data.entities[entity]}`;
 $('chart-subtitle').textContent='J-book summary';
 rows=[makeRow(year===2025?'FY2024 estimate':`FY${year-1} source baseline`,b.start),makeRow('Price changes',b.price,'price',true),makeRow('Net program changes',b.program,b.program<0?'decrease':'increase',true)];
 if(b.rounding)rows.push(makeRow('Source rounding',b.rounding,'rounding',true));rows.push(makeRow(`FY${year} request`,b.request));
 $('stats').innerHTML=stat('Source baseline',b.start)+stat('New request',b.request)+stat('Change',b.request-b.start,true);
 $('narrative-title').textContent='What changed, and why';$('narrative').innerHTML=`<p>The FY${year} request was ${amount(b.request)} ${unit()}, a ${amount(b.request-b.start,true)} ${unit()} change from the prior-year position in this J-book. PBA-19 reports ${amount(b.price,true)} ${unit()} in price changes and ${amount(b.program,true)} ${unit()} in program changes.</p><p>This summary does not separate transfers from program changes. Choose a ${entity==='3400'?'Budget Activity, then a ':''}SAG for its detailed OP-5 reconciliation. ${year===2025?'The FY2024 baseline is an estimate, not final enacted funding.':''}</p>`;
 $('references').innerHTML=`<p>${sourceLink(b,`FY${year} J-book · PBA-19 · ${entity} · PDF p. ${b.page}`)}</p>`;
 $('table-note').textContent='Annual appropriation 3400 only. PBA-19 amounts are reported in millions to one decimal. Any source-rounding difference is shown separately and is not a funding action.';
 if(year===2025)notice('The FY2025 J-book uses an estimated FY2024 baseline.');
 drawChart();
}

function rateStat(e){return `<div class="stat rate-wrapper"><small>Obligation rate</small><button type="button" class="rate-info" aria-label="Obligation rate: ${esc(rateText(e))}. More information" aria-describedby="rate-tooltip"><strong>${rateText(e)}</strong></button><span id="rate-tooltip" class="rate-tooltip" role="tooltip"><strong>Reading the obligation rate</strong>Obligations ÷ Updated Budget × 100. Obligations are legal commitments, not cash payments. Rates above 100% or below 90% prompt review; they do not establish a legal violation or performance against a spending plan. A rate is not established when Updated Budget is zero or unavailable.</span></div>`}

function relatedDifferences(y,e){
 if(!/^0[1-4][0-9][A-Z]$/.test(entity)||e?.adjustments==null||e?.reportedAdjustments==null)return '';
 const diff=e.adjustments-e.reportedAdjustments;if(Math.abs(diff)<.001)return '';
 const peer=Object.entries(data.execution).find(([k,v])=>k.startsWith(`${y}-${entity.slice(0,2)}`)&&/^0[1-4][0-9][A-Z]$/.test(k.slice(5))&&k!==`${y}-${entity}`&&v.adjustments!=null&&v.reportedAdjustments!=null&&Math.abs(v.adjustments-v.reportedAdjustments+diff)<.001);
 if(!peer)return '';
 return `<section class="related-differences"><h3>Related reconciliation differences · FY${y}</h3><div class="difference-pair">${[[entity,e],[peer[0].slice(5),peer[1]]].map(([id,r])=>`<div><span class="difference-label">SAG ${id} · ${esc(data.entities[id])}</span><strong>${reportValue(r.adjustments-r.reportedAdjustments,true)}</strong>${reportRef(r,'Execution source')}</div>`).join('')}</div><p class="footnote">Difference = (Updated Budget − Enacted) − listed adjustment components. These equal and opposite differences occur within the same Budget Activity; that does not establish a transfer or explain their cause.</p></section>`;
}
