/* A deterministic guided conversation; all results use the dashboard's source data. */
let guideYear=null,guideRouting=false;
const guideTopics={sources:'Why do the documents show different figures?',terms:'What do the terms mean?',trend:'How has funding changed over time?',adjustments:'How did funding change after enactment?',changes:'What changed most?',congress:'Where did Congress add or reduce funding?',attention:'What deserves a closer look?',patterns:'What patterns repeat?',explore:'Help me explore a budget area'};
function guideMoney(n){return `${n>0?'+':''}${(n/1000).toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1})} $M`}
function guideHref(o={}){return '#dashboard?'+new URLSearchParams({view:o.view||'single',year:String(o.year||guideYear||2025),entity:o.entity||'3400',metric:o.metric||'budget',...(o.stage?{stage:o.stage}:{}),...(o.years?{years:o.years.join(',')}:{}),...(o.figureYear?{figureYear:String(o.figureYear)}:{})}).toString()}
function guideLink(o,label='Explore in dashboard'){return `<a class="guide-detail" href="${esc(guideHref(o))}">${esc(label)}</a>`}
function guideSource(r){return r?.source?`<a class="guide-source" href="${esc(r.source)}#page=${r.page}" target="_blank" rel="noopener">Source · PDF p. ${r.page}</a>`:''}
function guideResult(title,text,route,ref,extra=''){const brief=reportBrief(text,2),rest=text.slice(brief.length).trim();return `<article class="guide-result"><h3>${esc(title)}</h3><p>${esc(brief)}</p>${rest?reportMore('More context',`<p>${esc(rest)}</p>`):''}<div class="guide-result-actions">${guideLink(route)}${guideSource(ref)}${extra}</div></article>`}

function guideEntries(kind,ba){return Object.entries(data[kind]).filter(([k])=>(!guideYear||k.startsWith(`${guideYear}-`))&&(ba?parentBA(k.slice(5))===ba&&/^0[1-4][0-9][A-Z]$/.test(k.slice(5)):/^BA0[1-4]$/.test(k.slice(5)))).map(([k,r])=>({id:k.slice(5),y:Number(k.slice(0,4)),r}))}
function guideAnswer(topic,ba){
 const y=guideYear||2025,name=id=>/^0[1-4][0-9][A-Z]$/.test(id)?`SAG ${id} · ${data.entities[id]||id}`:data.entities[id]||id;
 const sagButton=(id)=>`<button class="guide-follow" data-guide-topic="${topic}" data-guide-ba="${id}">Look inside this BA</button>`;
 if(topic==='sources')return '<p>The documents capture different stages and dates. The <strong>J-book</strong> explains the Budget Request, <strong>DD 1414</strong> reports the funding base after congressional action, and the <strong>execution report</strong> shows later adjustments and Obligations.</p><p>Compare figures with the same scope and reporting basis. A difference between snapshots is not automatically an error.</p>'+guideLink({view:'single',year:guideYear||2025},'Follow one year’s funding');
 if(topic==='terms')return '<dl class="guide-terms"><dt>Budget Activity (BA)</dt><dd>A broad grouping of related activities.</dd><dt>Subactivity Group (SAG)</dt><dd>A more detailed budget area within a BA.</dd><dt>J-book exhibits</dt><dd>PBA-19 summarizes the appropriation and BAs. OP-5 gives SAG detail; it is an exhibit within the J-book.</dd><dt>Price, program, and transfers</dt><dd>Price reflects cost factors; program changes reflect requirements; transfers move funding between activities or accounts.</dd></dl>'+guideLink({view:'bridge',year:guideYear&&guideYear>=2022?guideYear:2025},'Explore a comparison');
 if(topic==='trend'){
  const years=[2021,2022,2023,2024,2025,2026,2027].filter(fy=>!guideYear||fy<=guideYear);
  const id=ba||'3400';
  return `<p>Follow the Budget Request, Enacted funding, and Updated Budget across available years for ${esc(name(id))}. Comparing these positions shows whether a movement began in the request, in congressional decisions, or after enactment.</p><p>Start with the overall trend, then select a bar for its documented explanation. Missing positions are not treated as zero; amounts are nominal dollars.</p>${guideLink({view:'trend',entity:id,metric:'budget',years,year:years.at(-1)},'Explore funding over time')}<p class="guide-disclosure">Requested funding is available through FY2027; year-end execution through FY2025. Each series keeps its own reporting basis.</p>`;
 }
 if(topic==='adjustments'){
  const entries=guideEntries('execution',ba).filter(x=>x.r.adjustments!=null).sort((a,b)=>Math.abs(b.r.adjustments)-Math.abs(a.r.adjustments)).slice(0,3);
  return `<p>These are the largest net movements from Enacted funding to Updated Budget ${guideYear?'in FY'+guideYear:'across the loaded years'}, ${ba?'within '+esc(name(ba)):'at Budget Activity level'}. Adjustment types are documented separately from their purposes; the net amount alone does not explain the cause.</p>`+(entries.length?entries.map(({id,r,y})=>guideResult(`${name(id)} · FY${y}`,`${guideMoney(r.adjustments)} after enactment. Open the figure to see the reported components and any reconciliation notes.`,{year:y,entity:id,stage:'Reprogramming / Adjustments'},r,ba?'':sagButton(id))).join(''):'<p>No matched post-enactment records are available for this period.</p>');
 }
 if(topic==='changes'){
  const entries=guideEntries('bridges',ba).sort((a,b)=>Math.abs(b.r.request-b.r.start)-Math.abs(a.r.request-a.r.start)).slice(0,3);
  if(!entries.length)return '<p>A comparable J-book bridge is not loaded for this selection. Choose FY2022 or later, or explore the available one-year funding picture.</p>'+guideLink({year:y});
  return `<p>Here are the largest dollar changes ${ba?'within '+esc(name(ba)):'among the four Budget Activities'} ${guideYear?`from the FY${y-1} J-book baseline to the FY${y} request`:'across the loaded J-book comparisons'}.${guideYear===2025?' The FY2024 baseline is an estimate.':''} These are starting points for review, not a ranking of importance.</p>`+entries.map(({id,r,y})=>guideResult(`${name(id)} · FY${y}`,`${guideMoney(r.request-r.start)} overall; price changes account for ${guideMoney(r.price)} and net program changes for ${guideMoney(r.program)}.${r.summaryOnly?' This summary does not separately identify transfers.':` Net transfers: ${guideMoney(r.transfers)}.`} ${y===2025?'This comparison uses an estimated FY2024 baseline. ':''}Open the request to read what the J-book says the funding supports.`,{view:'bridge',year:y,entity:id,stage:`FY${y} request`},r,ba?'':sagButton(id))).join('');
 }
 if(topic==='congress'){
  const entries=guideEntries('execution',ba).filter(x=>x.r.congress!=null).sort((a,b)=>Math.abs(b.r.congress)-Math.abs(a.r.congress)).slice(0,3);
  if(!entries.length)return `<p>Congressional Action is not established for this year and level. No amount has been substituted. You can still review the Budget Request.</p>${guideLink({year:y,entity:ba||'3400',stage:'Budget Request'})}`;
  return `<p>The largest net congressional changes ${ba?'within '+esc(name(ba)):'by Budget Activity'} ${guideYear?'in FY'+y:'across available years'} are below. The net difference identifies where to look; the documented components explain the actions.</p>`+entries.map(({id,r,y})=>guideResult(`${name(id)} · FY${y}`,`${guideMoney(r.congress)} between Budget Request and Enacted funding. ${r.congressDetails?.items?.length?`${r.congressDetails.items.length} action components are available in Behind the Numbers.`:'Open the reporting panel for available source detail and coverage limits.'}`,{year:y,entity:id,stage:'Congressional Action'},r,ba?'':sagButton(id))).join('');
 }
 if(topic==='attention'){
  const findings=[];
  for(const [k,e] of Object.entries(data.execution)){
   if((guideYear&&!k.startsWith(`${guideYear}-`))||!/^0[1-4][0-9][A-Z]$/.test(k.slice(5)))continue;
   const id=k.slice(5),fy=Number(k.slice(0,4));
   if(e.adjustments!=null&&e.reportedAdjustments!=null&&Math.abs(e.adjustments-e.reportedAdjustments)>.001)findings.push({id,e,fy,stage:'Reprogramming / Adjustments',priority:2,score:Math.abs(e.adjustments-e.reportedAdjustments),text:`Listed adjustment components differ from Updated Budget minus Enacted by ${guideMoney(e.adjustments-e.reportedAdjustments)}. The cause is not established; review the reconciliation before attributing the change to a program decision.`});
   if(e.updated>0&&e.obligations!=null&&(e.obligations/e.updated>1||e.obligations/e.updated<.9))findings.push({id,e,fy,stage:'Obligations',priority:1,score:Math.abs(e.obligations/e.updated-1),text:`The obligation rate was ${(100*e.obligations/e.updated).toFixed(1)}%, outside this prototype’s 90–100% review range. Check the reporting basis and adjustments. Without a spending plan, this is not a performance assessment.`});
  }
  findings.sort((a,b)=>b.priority-a.priority||b.score-a.score);
  return findings.length?'<p>These are review leads from the available annual execution records. Component mismatches appear first, followed by unusual obligation rates.</p>'+findings.slice(0,3).map(f=>guideResult(`${name(f.id)} · FY${f.fy}`,f.text,{year:f.fy,entity:f.id,stage:f.stage},f.e)).join(''):`<p>No review lead was identified by these checks for FY${y}. ${y>2025?'Year-end execution is not loaded for this year.':'That does not establish that the data has no issues.'}</p>${guideLink({year:y})}`;
 }
 if(topic==='patterns'){
  const years=[2021,2022,2023,2024,2025].filter(v=>!guideYear||v<=guideYear),findings=[];
  if(years.length<3)return '<p>This check needs at least three year-end observations. Choose FY2023 or later to explore repeated patterns.</p>';
  for(const id of Object.keys(data.entities).filter(id=>/^0[1-4][0-9][A-Z]$/.test(id))){
   for(const key of ['congress','adjustments']){
    const values=years.map(fy=>data.execution[`${fy}-${id}`]);
    if(values.some(e=>!e||e[key]==null))continue;
    if(values.every(e=>e[key]>0)||values.every(e=>e[key]<0))findings.push({id,key,values,total:values.reduce((n,e)=>n+Math.abs(e[key]),0)});
   }
  }
  findings.sort((a,b)=>b.total-a.total);
  return `<p>Checking FY${years[0]}–FY${years.at(-1)} for the same net direction in every year, using only SAGs with complete observations. Results are ranked by cumulative absolute change. A repeated direction does not establish a repeated cause.</p>`+(findings.length?findings.slice(0,3).map(f=>guideResult(name(f.id),`${f.key==='congress'?'Congressional Action':'Reprogramming / Adjustments'} was ${f.values[0][f.key]>0?'positive':'negative'} in all ${years.length} years. Compare the individual actions before deciding whether the underlying requirement recurs.`,{view:'trend',year:years.at(-1),years,entity:f.id,metric:f.key},f.values.at(-1))).join(''):'<p>No pattern met that definition.</p>');
 }
 if(ba){
  const children=Object.keys(data.entities).filter(id=>/^0[1-4][0-9][A-Z]$/.test(id)&&parentBA(id)===ba&&(guideYear?data.execution[`${y}-${id}`]:Object.keys(data.execution).some(k=>k.endsWith('-'+id))));
  return `<p>${esc(name(ba))} groups related activities. Start with its summary, or select a Subactivity Group (SAG) for detail.</p>${guideLink({year:y,entity:ba,...(!guideYear?{view:'trend',years:[2021,2022,2023,2024,2025,2026,2027]}:{})},'Open BA summary')}<div class="guide-area-list">${children.map(id=>guideLink({year:y,entity:id,...(!guideYear?{view:'trend',years:[2021,2022,2023,2024,2025,2026,2027]}:{})},`${id} · ${name(id)}`)).join('')}</div>`;
 }
 return '<p>Start with an Air Force summary, or choose a Budget Activity to see its Subactivity Groups. The dashboard keeps breadcrumbs so you can return to the BA or Air Force total.</p>'+guideLink({year:y,...(!guideYear?{view:'trend',years:[2021,2022,2023,2024,2025,2026,2027]}:{})},'Open AF O&M overall')+'<div class="guide-options">'+['BA01','BA02','BA03','BA04'].map(id=>`<button data-guide-topic="explore" data-guide-ba="${id}">${esc(name(id))}</button>`).join('')+'</div>';
}
function guideAsk(topic,ba){
 const text=(ba?`${guideTopics[topic]} · ${data.entities[ba]}`:guideTopics[topic])+(['sources','terms'].includes(topic)?'':guideYear?` · ${['trend','patterns'].includes(topic)?'Through ':''}FY${guideYear}`:' · Across available years');
 const turn=document.createElement('section');turn.className='guide-turn';turn.innerHTML=`<h3 class="example-question">${esc(text)}</h3><div class="guide-reply">${guideAnswer(topic,ba)}</div>`;
 $('guide-thread').innerHTML='';$('guide-thread').append(turn);turn.scrollIntoView({behavior:'smooth',block:'start'});
}
function guideRoute(){
 if(!data)return;
 const isDashboard=location.hash.startsWith('#dashboard');
 document.querySelectorAll('nav button').forEach(b=>{b.classList.toggle('active',!isDashboard&&b.dataset.view==='guide');b.setAttribute('aria-current',!isDashboard&&b.dataset.view==='guide'?'page':'false')});
 $('guided-start').hidden=isDashboard;$('dashboard').hidden=!isDashboard;$('back-to-guide').hidden=!isDashboard;
 if(!isDashboard){if($('guide-thread').lastElementChild)$('guide-thread').lastElementChild.scrollIntoView({block:'start'});else window.scrollTo?.({top:0});return;}
 guideRouting=true;
 const p=new URLSearchParams(location.hash.split('?')[1]||'');
 view=['single','bridge','trend'].includes(p.get('view'))?p.get('view'):'single';
 year=Math.max(view==='bridge'?2022:2021,Math.min(2027,Number(p.get('year'))||2025));
 entity=data.entities[p.get('entity')]?p.get('entity'):'3400';
 metric=['budget','obligations','congress','adjustments'].includes(p.get('metric'))?p.get('metric'):'budget';
 selectedYears=[...new Set((p.get('years')||'2021,2022,2023,2024,2025').split(',').map(Number).filter(y=>Number.isInteger(y)&&y>=2021&&y<=2027))];
 if(!selectedYears.length)selectedYears=[year];
 document.querySelectorAll('nav button').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-current',b.dataset.view===view?'page':'false')});
 yearControls();render();
 const index=rows.findIndex(r=>(r.stage||r.label)===p.get('stage')&&(view!=='trend'||r.year===(Number(p.get('figureYear'))||year)));
 if(index>=0&&rows[index].value!=null){selected=rows[index];explainFigure();document.querySelectorAll('#chart rect[data-index]').forEach(b=>{const on=+b.dataset.index===index;b.classList.toggle('selected-bar',on);b.setAttribute('aria-pressed',String(on))});}
 guideRouting=false;
 $('funding-graph').scrollIntoView({block:'start'});
}
function guideSync(){if(guideRouting||$('dashboard').hidden||!data)return;history.replaceState(null,'',guideHref({view,year,entity,metric,years:selectedYears,stage:selected?.stage||selected?.label,figureYear:selected?.year}));}
function initGuide(){
 $('jbook-dates').innerHTML=[[2021,'February 2020'],[2022,'May 2021'],[2023,'April 2022'],[2024,'March 2023'],[2025,'February 2024'],[2026,'June 2025'],[2027,'April 2026']].map(([fy,date])=>{const source=data.sources.find(s=>/jbook/i.test(s.source)&&s.source.includes(String(fy).slice(2)));return `<tr><th scope="row">FY${fy}</th><td>${source?sourceLink({...source,page:1},date):date}</td></tr>`}).join('');
 $('guide-status').hidden=true;$('guide-controls').disabled=false;
 $('guide-year').onchange=e=>{guideYear=e.target.value==='all'?null:Number(e.target.value)};
 $('guided-start').addEventListener('click',e=>{const b=e.target.closest('[data-guide-topic]');if(b)guideAsk(b.dataset.guideTopic,b.dataset.guideBa)});
 $('guide-reset').onclick=()=>{$('guide-thread').innerHTML='';guideYear=null;$('guide-year').value='all';$('guide-welcome').scrollIntoView({behavior:'smooth'})};
 const oldRender=render;render=function(){oldRender();guideSync()};
 const oldExplain=explainFigure;explainFigure=function(){oldExplain();guideSync()};
 // The reset button was bound before render was wrapped.
 $('show-overview').onclick=()=>render();
 document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{if(b.dataset.view==='guide'){location.hash='#guide';return;}location.hash=guideHref({view:b.dataset.view,year:b.dataset.view==='bridge'?Math.max(2022,year):year,entity,metric,years:selectedYears});});
 window.addEventListener('hashchange',guideRoute);guideRoute();
}
