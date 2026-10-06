/* Level-aware reporting: summary first, source detail on demand. */
function reportContext(){const y=selected?.year??year;return {y,stage:selected?(selected.stage||selected.label):null,e:data.execution[`${y}-${entity}`],b:data.bridges[`${y}-${entity}`]}}
function reportRef(r,label){return r?.source?`<p class="report-source">${sourceLink(r,label||`Source · PDF p. ${r.page}`)}</p>`:''}
function reportValue(v,signed=false){return v==null?'not reported':`${amount(v,signed)} ${unit()}`}
function reportMore(title,html){return `<details class="report-group"><summary>${esc(title)}</summary>${html}</details>`}
function reportBrief(text,count=2){return text.split(/(?<=[.!?])\s+(?=[A-Z])/).slice(0,count).join(' ').trim()}
function reportComponents(items){return items?.length?'<ul class="component-list">'+items.map(i=>`<li><strong>${reportValue(i.value,true)}</strong><span>${esc(i.label)}</span></li>`).join('')+'</ul>':'<p>Individual actions are not established at this level.</p>'}
function requestText(y){
 const n=data.requestNarratives?.[`${y}-${entity}`];
 if(!n)return '<p>A request narrative is not available at this level. See the source document.</p>';
 const brief=entity==='3400'?'The request supports Air Force operations, readiness, maintenance, training, and civilian personnel.':reportBrief(n.sections[0].paragraphs[0],2);
 const full=n.sections.map(s=>s.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')+reportRef({...n,page:s.page},`J-book · PDF p. ${s.page}`)).join('');
 return `<p>${esc(brief)}</p>`+(entity==='3400'?'':reportMore('Read the J-book description',`${n.basis?`<p>${esc(n.basis)}</p>`:''}${full}`));
}
function reportDrill(y,stage){
 const ids=entity==='3400'?['BA01','BA02','BA03','BA04']:Object.keys(data.entities).filter(id=>/^0[1-4][0-9][A-Z]$/.test(id)&&parentBA(id)===entity);
 if(!ids.length)return '';
 const key={'Budget Request':'request','Congressional Action':'congress','Enacted':'enacted','Reprogramming / Adjustments':'adjustments','Updated Budget':'updated','Obligations':'obligations'}[stage];
 const items=ids.filter(id=>data.execution[`${y}-${id}`]||data.bridges[`${y}-${id}`]).map(id=>{
  const e=data.execution[`${y}-${id}`],b=data.bridges[`${y}-${id}`];
  const bridgeKey={price:'price',transfer:'transfers',increase:'program',decrease:'program',adjust:'adjustments'}[selected?.type];
  const val=view==='bridge'?(bridgeKey?b?.[bridgeKey]:selected?.type==='position'?(stage===`FY${y} request`?b?.request:b?.start):b?.request-b?.start):key?e?.[key]:null;
  const label=Number.isFinite(val)?` · ${reportValue(val,view==='bridge'||['congress','adjustments'].includes(key))}`:'';
  if(entity==='3400'){
   const missions={BA01:'Funds combat and air operations, flying hours, and the bases and support that sustain operational forces.',BA02:'Funds global mobility: moving and sustaining forces, cargo, and personnel for military and humanitarian missions.',BA03:'Funds initial and specialized skills training, flight training, and professional education throughout an Airman’s career.',BA04:'Funds logistics, servicewide support, security programs, and support to other nations.'};
   const n=data.requestNarratives?.[`${y}-${id}`];
   let detail=n?missions[id]:'A mission description is not available for this source year.';
   if(Number.isFinite(val)){
    if(view==='bridge')detail+=bridgeKey?` The J-book reports ${reportValue(val,true)} in ${bridgeKey==='program'?'net program changes':bridgeKey==='price'?'price changes':bridgeKey==='transfers'?'transfers':'baseline adjustments'}.`:selected?.type==='position'?` This BA’s source position is ${reportValue(val)}.`:` The request changed by ${reportValue(val,true)} from the prior-year baseline.`;
    else if(key==='congress')detail+=` Congressional Action ${val>=0?'added':'removed'} ${reportValue(Math.abs(val))} ${val>=0?'to':'from'} the request.`;
    else if(key==='adjustments')detail+=` Post-enactment adjustments ${val>=0?'increased':'reduced'} funding by ${reportValue(Math.abs(val))}.`;
    else if(key==='obligations')detail+=` Obligations were ${reportValue(val)}${e?.updated>0?`, or ${rateText(e)} of Updated Budget`:''}.`;
    else detail+=` ${stage} was ${reportValue(val)}.`;
   }
   return `<li class="ba-summary"><strong>${esc(data.entities[id])}</strong><p>${esc(detail)}</p></li>`;
  }
  return `<li><span>${esc(data.entities[id])}</span>${label}</li>`;
 }).join('');
 let html=`<ul class="level-links">${items}</ul>`;
 if(entity==='3400'){
  const refs=ids.map(id=>{const n=data.requestNarratives?.[`${y}-${id}`];return n?reportRef({...n,page:n.sections[0].page},`${data.entities[id]} · J-book · PDF p. ${n.sections[0].page}`):''}).join('');
  if(refs)html+=reportMore('BA summary sources',refs);
 }
 return entity==='3400'?`<h4>${view==='bridge'&&!selected?'Changes by Budget Activity':'By Budget Activity'}</h4>${html}`:reportMore('Subactivity Group summary',html);
}
function documentedDrivers(y,type=null){
 if(entity==='3400'||/^BA0[1-4]$/.test(entity))return '';
 const b=data.bridges[`${y}-${entity}`],ds=(b?.drivers||[]).filter(d=>!type||type==='increase'&&d.amount>0||type==='decrease'&&d.amount<0||type==='transfer'&&d.kind==='transfer');
 if(!ds.length)return '';
 const html=ds.map(d=>reportMore(`${d.title} · ${reportValue(d.amount,true)}`,`<p>${esc(d.description)}</p>${reportRef({source:d.source||b.source,page:d.page||b.page},`J-book · PDF p. ${d.page||b.page}`)}`)).join('');
 return reportMore(`Documented program changes (${ds.length})`,html);
}
function requestReport(y,b){return requestText(y)+(b?`<p>Proposed changes include ${reportValue(b.price,true)} for price and ${reportValue(b.program,true)} for programs${!b.summaryOnly&&b.transfers?`, plus ${reportValue(b.transfers,true)} in transfers`:''}.</p>`:'')+documentedDrivers(y)}
function congressReport(y,e){
 const c=e?.congressDetails,items=c?.items||[];
 if(!items.length)return '<p>The net change is established; individual congressional actions are not available at this level.</p>';
 const top=[...items].sort((a,b)=>Math.abs(b.value)-Math.abs(a.value))[0];
 return `<p>The largest documented action was ${esc(top.label)} (${reportValue(top.value,true)}).</p>`+reportMore(`All congressional actions (${items.length})`,reportComponents(items)+(c.note?`<p>${esc(c.note)}</p>`:'')+reportRef(c,'Congressional action detail'));
}
function adjustmentReport(e){
 const items=e?.adjustmentDetails||[];
 if(!items.length)return '<p>Detailed adjustments are not available for this selection.</p>';
 const top=[...items].sort((a,b)=>Math.abs(b.value)-Math.abs(a.value))[0];
 return `<p>The largest reported adjustment type was ${esc(top.label)} (${reportValue(top.value,true)}). Individual purposes are not established by this report.</p>`+reportMore('Reported adjustment components',reportComponents(items)+reportRef(e));
}
function stageReport(stage,y,e,b){
 if(stage==='Budget Request'||stage===`FY${y} request`)return requestReport(y,b);
 if(stage==='Congressional Action')return congressReport(y,e);
 if(stage==='Reprogramming / Adjustments')return adjustmentReport(e);
 if(stage==='Enacted')return `<p>Enacted funding reflects the Budget Request plus ${reportValue(e?.congress,true)} in Congressional Action.</p>`+reportMore('Congressional action detail',congressReport(y,e));
 if(stage==='Updated Budget')return `<p>Updated Budget reflects Enacted funding plus ${reportValue(e?.adjustments,true)} in Reprogramming / Adjustments.</p>`+reportMore('Adjustment detail',adjustmentReport(e));
 if(stage==='Obligations')return `<p>Obligations were recorded as of September 30, ${y}.${e?.updated>0?` The obligation rate was ${rateText(e)}.`:''} Individual commitments are not itemized in this report.</p>`;
 if(view==='bridge'&&b){
  const type=selected?.type;
  if(['increase','decrease'].includes(type))return '<p>These are changes to program requirements, including any removal of temporary funding.</p>'+documentedDrivers(y,b.summaryOnly?null:type);
  if(type==='price')return '<p>Price changes reflect cost factors such as inflation and pay rates, separately from program changes.</p>';
  if(type==='transfer')return '<p>Transfers move funding between activities or accounts. A transfer does not by itself establish an overall Air Force increase or reduction.</p>'+documentedDrivers(y,'transfer');
  if(type==='adjust')return `<p>These adjustments bring the source’s starting position to a normalized baseline of ${reportValue(b.baseline)} before the proposed changes.</p>`;
  if(type==='rounding')return '<p>This reconciles rounded source figures; it is not a funding action.</p>';
  return `<p>The prior-year position used when this J-book was prepared.${y===2025?' FY2024 is an estimate, not final Enacted funding.':''}</p>`;
 }
 return '<p>No additional detail is established for this selection.</p>';
}
function renderReport(){
 const {y,stage,e,b}=reportContext();$('drivers').innerHTML='';
 if(selected){
  $('narrative-title').textContent=`${selected.label} · ${reportValue(selected.value,selected.delta||selected.signed)}`;
  $('narrative').innerHTML=stageReport(stage,y,e,b)+reportDrill(y,stage);
  $('references').innerHTML=reportRef(view==='bridge'?b:e||b);
  $('show-overview').hidden=false;
 }else if(view==='bridge'&&b){
  $('narrative-title').textContent='What changed';
  $('narrative').innerHTML=`<p>The request changed by ${reportValue(b.request-b.start,true)}: ${reportValue(b.price,true)} in price and ${reportValue(b.program,true)} in net program changes${!b.summaryOnly&&b.transfers?`, with ${reportValue(b.transfers,true)} in transfers`:''}.</p>`+reportDrill(y)+documentedDrivers(y);
 }else if(view==='single'&&e){
  $('narrative-title').textContent='Funding summary';
  $('narrative').innerHTML=requestText(y)+reportDrill(y);
 }else if(view==='trend'){
  $('narrative-title').textContent='Across the selected years';
  const key=metric==='budget'?'updated':metric,values=rows.filter(r=>r.value!=null&&(metric!=='budget'||r.key==='updated')).sort((a,b)=>a.year-b.year);
  const first=values[0],last=values.at(-1),label={updated:'Updated Budget',obligations:'Obligations',congress:'Congressional Action',adjustments:'Reprogramming / Adjustments'}[key];
  $('narrative').innerHTML=values.length>1?`<p>${label} ${last.value>=first.value?'increased':'decreased'} by ${reportValue(Math.abs(last.value-first.value))} from FY${first.year} to FY${last.year}.</p>`:'<p>Select additional years to compare available figures.</p>';
 }
 if(view==='trend'&&!selected)$('narrative').innerHTML+=trendDriverHighlights();
 $('table-note').textContent='';
}

function trendDriverHighlights(){
 const entries=[],scope=id=>id===entity||(/^0[1-4][0-9][A-Z]$/.test(id)&&(entity==='3400'||parentBA(id)===entity));
 for(const y of selectedYears){
  if(metric==='budget'){
   for(const [k,b] of Object.entries(data.bridges))if(k.startsWith(`${y}-`)&&scope(k.slice(5))&&!b.summaryOnly){
    for(const d of b.drivers||[])if(d.amount)entries.push({title:d.title,value:d.amount,y,id:k.slice(5),detail:d.description,ref:{source:d.source||b.source,page:d.page||b.page}});
   }
  }else if(metric==='congress'){
   for(const [k,e] of Object.entries(data.execution))if(k.startsWith(`${y}-`)&&scope(k.slice(5))&&/^0[1-4][0-9][A-Z]$/.test(k.slice(5))){
    const c=e.congressDetails;for(const d of c?.items||[])if(d.value)entries.push({title:d.label,value:d.value,y,id:k.slice(5),detail:c.note||'This is a documented component. Its source snapshot may differ from the final net change shown in the graph.',ref:c?.source?c:e});
   }
  }else{
   const ids=entity==='3400'?['BA01','BA02','BA03','BA04']:[entity];
   for(const id of ids){const e=data.execution[`${y}-${id}`];if(!e)continue;
    if(metric==='adjustments')for(const d of e.adjustmentDetails||[])if(d.value)entries.push({title:d.label,value:d.value,y,id,detail:'The execution report identifies this adjustment type; the purpose of individual actions is not established.',ref:e});
    if(metric==='obligations'&&e.obligations!=null)entries.push({title:data.entities[id],value:e.obligations,y,id,detail:e.updated>0?`Obligation rate: ${rateText(e)} of Updated Budget.`:'Updated Budget is not available for a rate calculation.',ref:e});
   }
  }
 }
 entries.sort((a,b)=>Math.abs(b.value)-Math.abs(a.value));
 const shown=entries.slice(0,5);if(!shown.length)return '<p class="subtle">Documented drivers are not available for this selection.</p>';
 const title=metric==='budget'?'Selected drivers of request changes':metric==='congress'?'Selected congressional funding drivers':metric==='adjustments'?'Largest reported adjustment components':'Largest obligation observations';
 const note=metric==='budget'?'Up to five large J-book program changes, ranked by absolute dollars. These explain changes to requests, not the full budgets.':metric==='congress'?'Up to five large documented actions, ranked by absolute dollars. These are selected components, not a reconciliation of the yearly totals.':metric==='adjustments'?'Up to five large reported components. These identify adjustment types, not the underlying purposes.':'Up to five large funding-area observations. These show where obligations were recorded, not what caused their level.';
 return `<section class="trend-drivers"><h4>${title}</h4><p class="footnote">${note} They are not intended to add to the graph totals.</p><ol class="driver-highlights">${shown.map(d=>{
  const area=entity==='3400'?(data.entities[parentBA(d.id)]||data.entities[d.id]):data.entities[d.id];
  const summary=metric==='budget'?reportBrief(d.detail,1):metric==='congress'?`Reported Congressional Action in ${area}.`:d.detail;
  return `<li><div class="driver-highlight-heading"><strong>${esc(d.title)}</strong><span>${reportValue(d.value,metric!=='obligations')}</span></div><small>FY${d.y} · ${esc(area)}</small><p>${esc(summary)}</p>${reportMore('Source detail',`${metric==='budget'||metric==='congress'?`<p>${esc(d.detail)}</p>`:''}${reportRef(d.ref,`FY${d.y} source detail · PDF p. ${d.ref.page}`)}`)}</li>`;
 }).join('')}</ol></section>`;
}
