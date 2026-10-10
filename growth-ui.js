'use strict';
const assessmentFields={expectedOutcome:'projectExpectedOutcome',budgetHours:'projectBudgetHours',budgetCost:'projectBudgetCost',reviewDate:'projectReviewDate',rewardEligibility:'projectRewardEligibility',baselineGap:'projectBaselineGap',advantage:'projectAdvantage',transferValue:'projectTransferValue',continueCondition:'projectContinueCondition',stopCondition:'projectStopCondition',decisionNote:'projectDecisionNote'};
const reviewFields={output:'reviewOutput',unfinished:'reviewUnfinished',blockers:'reviewBlockers',next:'reviewPlan'};
let editingAssetId=null,growthReady=false;
function fillProjectAssessment(p={}){for(const[k,id]of Object.entries(assessmentFields))document.getElementById(id).value=String(p[k]??'')}
function readProjectAssessment(){
  const o={};for(const[k,id]of Object.entries(assessmentFields))o[k]=document.getElementById(id).value.trim();
  if(o.budgetHours!==''&&(!Number.isFinite(Number(o.budgetHours))||Number(o.budgetHours)<0)){alert('预计工时需为非负数');return null}
  o.budgetHours=o.budgetHours===''?null:Number(o.budgetHours);return o;
}
function projectAssessmentHTML(p){
  const due=p.reviewDate&&p.reviewDate<=fmtDate(new Date())&&['active','paused'].includes(projectStatus(p));
  const count=DB.assets.filter(a=>a.projectId===p.id).length;
  return `<div class="project-meta">${p.reviewDate?`<span class="pill" style="${due?'color:var(--orange)':''}">${due?'待审查':'审查'} ${esc(p.reviewDate)}</span>`:''}<button class="btn" data-project-assets="${esc(p.id)}">成果 ${count}</button></div>${p.expectedOutcome?`<div class="small project-goal">预期成果：${esc(p.expectedOutcome)}</div>`:''}${p.budgetHours!=null||p.budgetCost?`<div class="small">预算：${p.budgetHours!=null?esc(p.budgetHours)+' h':''} ${esc(p.budgetCost||'')}</div>`:''}${p.stopCondition?`<div class="small project-goal" style="margin-top:6px">停止条件：${esc(p.stopCondition)}</div>`:''}`;
}
function showProjectAssets(id){assetFilter.value=id;switchTab('assets')}
function reviewStart(){return GrowthModel.weekStart(reviewDate.value||fmtDate(new Date()))}
function draftKey(){return 'personalGrowthReviewDraft_v1:'+repoKey()+':'+reviewStart()}
function reviewNotes(){return Object.fromEntries(Object.entries(reviewFields).map(([k,id])=>[k,document.getElementById(id).value.trim()]))}
function fillReview(notes){for(const[k,id]of Object.entries(reviewFields))document.getElementById(id).value=notes?.[k]||''}
function saveReviewDraft(){
  try{localStorage.setItem(draftKey(),JSON.stringify({...reviewNotes(),updatedAt:new Date().toISOString()}));reviewDraftStatus.textContent='草稿已保存在当前浏览器'}catch{reviewDraftStatus.textContent='无法保存草稿，请复制内容留存'}
}
function loadReviewDraft(){
  const saved=DB.weeklyReviews.find(r=>r.start===reviewStart());let draft=null;
  try{draft=JSON.parse(localStorage.getItem(draftKey())||'null')}catch{}
  fillReview(draft||saved||{});reviewDraftStatus.textContent=draft?'已载入本机草稿':saved?'已载入已保存复盘':'尚未填写复盘';
}
function updateReviewPreview(){
  reviewPreview.value=GrowthModel.markdown(DB,GrowthModel.summarize(DB,reviewStart()),reviewNotes(),{training:reviewIncludeTraining.checked,body:reviewIncludeBody.checked});
}
function renderWeekly(){
  const s=GrowthModel.summarize(DB,reviewStart()),completed=s.checklist.reduce((n,d)=>n+d.done.length,0);
  reviewRange.textContent=`${s.start} — ${s.end}`;
  reviewStats.innerHTML=[['科研实际记录',s.research.length+' 天'],['科研投入',s.research.reduce((n,x)=>n+(Number(x.hours)||0),0)+' h'],['训练记录',s.training.length+' 次'],['新增成果',s.assets.length+' 项']].map(([k,v])=>`<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
  const due=DB.projects.filter(p=>['active','paused'].includes(projectStatus(p))&&p.reviewDate&&p.reviewDate<=s.end);
  reviewFacts.innerHTML=`<div class="grid g2"><div><b>已记录的推进</b><div class="note-box" style="margin-top:8px">${esc(s.research.map(x=>`${x.date}：${x.output||'未填写实际推进'}`).join('\n')||'本周暂无科研记录')}</div><p class="small">日程计划 ${s.schedule.length} 项 · 清单已勾选 ${completed} 项 · 未记录清单 ${s.checklist.filter(x=>!x.recorded).length} 天</p></div><div><b>科研卡点</b><div class="note-box" style="margin-top:8px">${esc(s.research.filter(x=>x.block).map(x=>`${x.date}：${x.block}`).join('\n')||'尚未记录卡点')}</div></div></div><h4>审查日期不晚于本周结束的项目（当前状态）</h4>${due.map(p=>`<div class="row" style="margin:8px 0"><button class="btn" data-review-project="${esc(p.id)}">${esc(p.title)}</button><span class="small">${esc(p.reviewDate)} · ${esc(p.stopCondition||'尚未设置停止条件')}</span></div>`).join('')||'<div class="small">暂无待审查项目。可在中长期项目中设置审查日期。</div>'}`;
  reviewFacts.querySelectorAll('[data-review-project]').forEach(b=>b.onclick=()=>editProject(b.dataset.reviewProject));
  deleteReviewBtn.disabled=!DB.weeklyReviews.some(r=>r.start===s.start);updateReviewPreview();
}
function setReviewWeek(value){reviewDate.value=value;loadReviewDraft();renderWeekly()}
function refreshAssetOptions(){
  const options=DB.projects.map(p=>`<option value="${esc(p.id)}">${esc(p.title)} · ${projectStatuses[projectStatus(p)]}</option>`).join(''),filter=assetFilter.value;
  assetFilter.innerHTML='<option value="">全部项目</option><option value="__unlinked">未关联项目</option>'+options;assetFilter.value=filter;
  if(assetFilter.selectedIndex<0)assetFilter.value='';
}
function openAsset(id=null){
  const a=DB.assets.find(x=>x.id===id);editingAssetId=a?.id||null;assetModalTitle.textContent=a?'编辑成果资产':'新增成果资产';
  assetTitle.value=a?.title||'';assetType.value=a?.type||'科研报告';assetDate.value=a?.date||fmtDate(new Date());
  assetProject.innerHTML='<option value="">不关联项目</option>'+DB.projects.map(p=>`<option value="${esc(p.id)}">${esc(p.title)}</option>`).join('');
  assetProject.value=a?.projectId||(['','__unlinked'].includes(assetFilter.value)?'':assetFilter.value);assetUrl.value=a?.url||'';assetNote.value=a?.note||'';openModal('assetModal');
}
function renderAssets(){
  refreshAssetOptions();const q=assetSearch.value.trim().toLowerCase(),filter=assetFilter.value;
  const entries=DB.assets.filter(a=>(!filter||(filter==='__unlinked'?!a.projectId:a.projectId===filter))&&[a.title,a.type,a.note].join(' ').toLowerCase().includes(q)).sort((a,b)=>b.date.localeCompare(a.date));
  assetList.innerHTML='';
  if(!entries.length){assetList.innerHTML='<div class="small">暂无符合条件的成果。点击“新增成果”记录第一个可复用输出。</div>';return}
  for(const a of entries){
    const card=document.createElement('article');card.className='stat';const url=GrowthModel.safeUrl(a.url);
    card.innerHTML=`<b>${esc(a.title)}</b><div class="kpi-row" style="margin:8px 0"><span class="pill">${esc(a.type)}</span><span class="pill">${esc(a.date)}</span></div><div class="small">关联项目：${esc(DB.projects.find(p=>p.id===a.projectId)?.title||'未关联')}</div>${url?`<p><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">打开成果</a></p>`:''}<div class="note-box" style="margin-top:8px">${esc(a.note||'尚未填写成果证据与复用方式')}</div><div class="toolbar" style="margin-top:10px"><button class="btn edit">编辑</button><button class="btn danger del">删除</button></div>`;
    card.querySelector('.edit').onclick=()=>openAsset(a.id);card.querySelector('.del').onclick=()=>{if(confirm('删除此成果记录？外部链接的内容不会被删除。')){DB.assets=DB.assets.filter(x=>x.id!==a.id);save();renderAll()}};assetList.appendChild(card);
  }
}
function renderGrowth(){
  if(!growthReady)return;renderAssets();renderWeekly();
  const due=DB.projects.filter(p=>['active','paused'].includes(projectStatus(p))&&p.reviewDate&&p.reviewDate<=fmtDate(new Date())).length;
  growthHomeStatus.textContent=`累计成果 ${DB.assets.length} 项 · 待审查项目 ${due} 项 · 本周${DB.weeklyReviews.some(r=>r.start===GrowthModel.weekStart(fmtDate(new Date())))?'已保存复盘':'尚未保存复盘'}`;
}
function competitionAssessmentClick(event){
  const button=event.target.closest('[data-assessment]');if(!button)return;
  const item=JSON.parse(button.dataset.assessment),url=GrowthModel.safeUrl(item.url);if(!url)return;
  const existing=DB.projects.find(p=>p.sourceUrl===url);
  if(existing){editProject(existing.id);return}
  openNewProject();projectTitle.value=item.title;projectSourceUrl.value=url;
  projectRewardEligibility.value=`日报标注：${item.reward}。参赛前请核对官网奖励规则、资格和截止时间。`;
}
function initGrowth(){
  growthReady=true;reviewDate.value=fmtDate(new Date());loadReviewDraft();
  reviewDate.onchange=()=>setReviewWeek(reviewDate.value||fmtDate(new Date()));
  reviewPrev.onclick=()=>setReviewWeek(fmtDate(addDays(parseDate(reviewStart()),-7)));reviewNext.onclick=()=>setReviewWeek(fmtDate(addDays(parseDate(reviewStart()),7)));reviewCurrent.onclick=()=>setReviewWeek(fmtDate(new Date()));
  for(const id of Object.values(reviewFields))document.getElementById(id).oninput=()=>{saveReviewDraft();updateReviewPreview()};
  saveReviewBtn.onclick=()=>{
    const notes=reviewNotes();if(!Object.values(notes).some(Boolean))return alert('请先填写复盘内容');
    const start=reviewStart(),old=DB.weeklyReviews.find(r=>r.start===start),now=new Date().toISOString();
    const record={...old,id:old?.id||uid(),start,end:fmtDate(addDays(parseDate(start),6)),...notes,createdAt:old?.createdAt||now,updatedAt:now};
    if(old)Object.assign(old,record);else DB.weeklyReviews.push(record);
    save();saveReviewDraft();renderAll();reviewDraftStatus.textContent='复盘已确认保存，将随个人数据同步';
  };
  restoreReviewBtn.onclick=()=>{const saved=DB.weeklyReviews.find(r=>r.start===reviewStart());if(!saved)return alert('本周还没有已保存复盘');if(confirm('载入已保存复盘会替换当前草稿，是否继续？')){fillReview(saved);saveReviewDraft();updateReviewPreview()}};
  deleteReviewBtn.onclick=()=>{if(confirm('删除本周已保存复盘？当前本机草稿会保留。')){DB.weeklyReviews=DB.weeklyReviews.filter(r=>r.start!==reviewStart());save();renderAll();reviewDraftStatus.textContent='已删除保存记录，草稿保留'}};
  previewReviewBtn.onclick=updateReviewPreview;reviewIncludeTraining.onchange=updateReviewPreview;reviewIncludeBody.onchange=updateReviewPreview;
  copyReviewBtn.onclick=async()=>{updateReviewPreview();try{await navigator.clipboard.writeText(reviewPreview.value);reviewExportStatus.textContent='已复制，可以粘贴到 ChatGPT'}catch{reviewPreview.focus();reviewPreview.select();reviewExportStatus.textContent='自动复制不可用，报告已选中，请按 Ctrl/Cmd+C'}};
  downloadReviewBtn.onclick=()=>{updateReviewPreview();const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([reviewPreview.value],{type:'text/markdown;charset=utf-8'}));a.download=`每周成长复盘_${reviewStart()}.md`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);reviewExportStatus.textContent='Markdown 报告已生成'};
  addAssetBtn.onclick=()=>openAsset();assetFilter.onchange=renderAssets;assetSearch.oninput=renderAssets;
  saveAssetBtn.onclick=()=>{
    const title=assetTitle.value.trim(),date=assetDate.value;if(!title||!date)return alert('请填写成果名称和日期');
    const url=GrowthModel.safeUrl(assetUrl.value.trim());if(url===null)return alert('成果链接需为有效的 HTTP / HTTPS 地址');
    const old=DB.assets.find(a=>a.id===editingAssetId),now=new Date().toISOString();
    const record={id:old?.id||uid(),title,date,type:assetType.value,projectId:assetProject.value||null,url,note:assetNote.value.trim(),createdAt:old?.createdAt||now,updatedAt:now};
    if(old)Object.assign(old,record);else DB.assets.push(record);save();closeModal('assetModal');renderAll();
  };
}
