'use strict';
let academicReady=false,academicPrepared=null,academicSelected='',academicEditingRecord=null;
const ae=id=>document.getElementById(id);
const academicKinds={assignment:'作业',exam:'考试',practice:'练习',recitation:'RC',optional_event:'可选活动',optional_registration:'可选报名',optional_administrative:'条件性事项'};
const academicProgress={not_started:'未开始',in_progress:'进行中',done:'个人标记做完'};
function academicUrl(value){try{return AcademicModel.safeUrl(value)}catch{return ''}}
function academicCourse(id){return (DB.academicCourses||[]).find(c=>c.id===id)}
function academicLink(url,label){const safe=academicUrl(url);return safe?`<a href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`:''}
function academicItemHTML(item,compact=false){
 const course=academicCourse(item.courseId),time=AcademicModel.when(item),status=AcademicModel.submissionLabel(item),caution=AcademicModel.certaintyLabel(item.certainty);
 const mismatch=item.kind==='assignment'&&!AcademicModel.isSubmitted(item)&&(item.plannerComplete||item.localProgress==='done');
 const whenLabel=item.kind==='assignment'||item.kind==='optional_registration'?'截止':'日期';
 return `<article class="stat academic-item"><div class="kpi-row"><span class="pill">${esc(course?.code||course?.name||'学院信息')}</span><span class="pill">${esc(academicKinds[item.kind])}</span><span class="pill">${esc(caution)}</span></div><h3>${esc(item.title)}</h3><div><b>${whenLabel}：${esc(time?AcademicModel.dateTime(time):item.dateText||'未公布')}</b>${item.closesAt?`<div class="small">上传窗口关闭：${esc(AcademicModel.dateTime(item.closesAt))}</div>`:''}</div><p class="small">${esc(status)}${item.submittedAt?' · '+esc(AcademicModel.dateTime(item.submittedAt)):''}${item.kind==='exam'&&item.weightPercent!=null?' · 总评占比 '+item.weightPercent+'%':''}${item.score!=null?' · 已公布 '+item.score+' 分':''}</p>${mismatch?'<p class="academic-alert">做完／待办勾选不等于平台已收到提交，请核对提交凭证。</p>':''}${item.location?`<p class="small">地点：${esc(item.location)}</p>`:''}${compact?'':`<details><summary>要求与个人准备</summary><div class="note-box">${esc(item.requirements||'暂无补充要求')}</div><div class="field"><label>个人准备进度</label><select data-academic-progress="${esc(item.id)}">${Object.entries(academicProgress).map(([k,v])=>`<option value="${k}" ${item.localProgress===k?'selected':''}>${esc(v)}</option>`).join('')}</select></div><div class="field"><label>个人备注</label><textarea data-academic-note="${esc(item.id)}" maxlength="6000" placeholder="准备进度、卡点或待核对的问题">${esc(item.personalNote||'')}</textarea></div></details>`}<div class="toolbar">${academicLink(item.sourceUrl,'查看 Canvas 原页')}<button class="btn" data-academic-plan="${esc(item.id)}">安排准备时间</button>${compact?'':`<button class="btn" data-academic-log="${esc(item.id)}">记录实际学习</button>`}</div></article>`;
}
function renderAcademicSchedule(){
 if(!academicReady)return;const start=fmtDate(startOfWeek(currentDate)),end=fmtDate(addDays(startOfWeek(currentDate),6));
 ae('academicScheduleItems').innerHTML=DB.academicItems.filter(x=>['assignment','exam'].includes(x.kind)&&AcademicModel.day(AcademicModel.when(x))>=start&&AcademicModel.day(AcademicModel.when(x))<=end).map(x=>academicItemHTML(x,true)).join('')||'<p class="small">本周暂无已记录的截止或考试。</p>';bindAcademicItems(ae('academicScheduleItems'));
}
function academicEventLabel(ev){const c=academicCourse(ev.academicCourseId),item=DB.academicItems.find(x=>x.id===ev.academicItemId);return c?[c.code||c.name,item?.title].filter(Boolean).join(' · '):''}
function bindAcademicItems(container){
 container.querySelectorAll('[data-academic-plan]').forEach(b=>b.onclick=()=>planAcademic(b.dataset.academicPlan));
 container.querySelectorAll('[data-academic-log]').forEach(b=>b.onclick=()=>openAcademicRecord(null,b.dataset.academicLog));
 container.querySelectorAll('[data-academic-progress]').forEach(b=>b.onchange=()=>{const item=DB.academicItems.find(x=>x.id===b.dataset.academicProgress);if(!Object.hasOwn(academicProgress,b.value))return;item.localProgress=b.value;item.personalUpdatedAt=new Date().toISOString();save();renderAll()});
 container.querySelectorAll('[data-academic-note]').forEach(b=>b.onchange=()=>{const item=DB.academicItems.find(x=>x.id===b.dataset.academicNote);item.personalNote=b.value.slice(0,6000);item.personalUpdatedAt=new Date().toISOString();save()});
}
function renderAcademic(){
 if(!academicReady)return;const last=DB.academicImports.find(x=>x.id==='canvas-sjtu'),dash=AcademicModel.dashboard(DB),courseIds=DB.academicCourses.map(x=>x.id);
 if(academicSelected&&!courseIds.includes(academicSelected))academicSelected='';
 ae('academicFreshness').textContent=last?`课程快照：${AcademicModel.dateTime(last.capturedAt)}（北京时间） · ${DB.academicCourses.filter(x=>x.canvasId).length} 门课程 · ${DB.academicResources.filter(x=>x.status==='downloaded').length} 份已归档资料。不是实时状态。`:'尚未导入课程快照；原有课程表继续使用。';
 ae('academicCourseFilter').innerHTML='<option value="">全部课程与学院事项</option>'+DB.academicCourses.map(c=>`<option value="${esc(c.id)}">${esc(c.code+' '+c.name)}</option>`).join('');ae('academicCourseFilter').value=academicSelected;
 ae('academicCards').innerHTML=DB.academicCourses.map(c=>`<button class="stat academic-course-card ${academicSelected===c.id?'academic-selected':''}" data-academic-course="${esc(c.id)}"><div class="k">${esc(c.code||'学院信息')}</div><h3>${esc(c.name)}</h3><div class="small">${esc(c.teacher||'教师待核实')}</div><div class="small">${DB.academicItems.filter(x=>x.courseId===c.id&&x.kind==='assignment'&&AcademicModel.needsAction(x)).length} 项待交 · ${DB.academicResources.filter(x=>x.courseId===c.id).length} 条资料</div></button>`).join('');
 ae('academicCards').querySelectorAll('[data-academic-course]').forEach(b=>b.onclick=()=>{academicSelected=b.dataset.academicCourse;renderAcademic();ae('academicDetail').scrollIntoView?.({block:'start',behavior:'smooth'})});
 const c=academicCourse(academicSelected);ae('academicDetail').classList.toggle('hide',!c);
 if(c){
  const resources=DB.academicResources.filter(r=>r.courseId===c.id),logs=DB.academicRecords.filter(r=>r.courseId===c.id);
  ae('academicDetailTitle').textContent=c.code+' '+c.name;
  ae('academicDetailBody').innerHTML=`<p>${esc(c.term)} · ${esc(c.teacher||'教师待核实')} · ${academicLink(c.sourceUrl,'打开课程')}</p><div class="grid g2"><div><h4>考核与考试规则</h4><div class="note-box">${esc(c.grading||'尚未核实')}\n${esc(c.examPolicy||'')}</div></div><div><h4>知识与复习重点</h4><div class="note-box">${esc(c.knowledge||c.summary||'尚未整理')}</div><p class="small">${esc(c.studyAdvice||'')}</p></div></div><p class="small">已有 ${logs.length} 条学习记录；资料下载不表示已经掌握。原始文件可从本次对话的资料包取得，或按下列名称查找 Canvas。</p><details><summary>资料索引（${resources.length} 条）</summary><div class="table-wrap"><table><thead><tr><th>资料</th><th>归档状态</th><th>位置／入口</th></tr></thead><tbody>${resources.map(r=>`<tr><td>${esc(r.title)}${r.pages?`<div class="small">${r.pages} 页</div>`:''}</td><td>${({downloaded:'已归档',not_downloaded:'未下载',index_only:'仅索引'})[r.status]}</td><td><div class="small">${esc(r.path||r.folder||'')}</div>${academicLink(r.sourceUrl,'Canvas 入口')}</td></tr>`).join('')}</tbody></table></div></details>`;
  ae('academicProjectChoice').innerHTML='<option value="">不关联目标</option>'+DB.projects.map(p=>`<option value="${esc(p.id)}">${esc(p.title)}</option>`).join('');ae('academicProjectChoice').value=c.projectId||'';
 }
 const q=ae('academicSearch').value.trim().toLowerCase(),kind=ae('academicKindFilter').value,view=ae('academicView').value||'upcoming';
 let list=view==='all'?[...DB.academicItems]:view==='undated'?dash.undated:[...dash.overdue,...dash.upcoming];
 list=list.filter(x=>(!academicSelected||x.courseId===academicSelected)&&(!kind||x.kind===kind)&&[x.title,x.requirements,x.personalNote].join(' ').toLowerCase().includes(q)).sort((a,b)=>AcademicModel.when(a).localeCompare(AcademicModel.when(b)));
 ae('academicTasks').innerHTML=list.map(x=>academicItemHTML(x)).join('')||'<p class="small">暂无匹配事项；可切换“全部任务”查看已提交及远期考试。</p>';bindAcademicItems(ae('academicTasks'));
 ae('academicWindow').textContent=`${dash.date} — ${dash.end}（北京时间） · 另显示仍待交的已过期作业`;
 const home=[...dash.overdue,...dash.upcoming].filter(x=>['assignment','exam'].includes(x.kind)).slice(0,5);
 ae('academicHomeList').innerHTML=home.map(x=>academicItemHTML(x,true)).join('')||'<p class="small">未来两周暂无待交作业或考试。</p>';bindAcademicItems(ae('academicHomeList'));
 ae('academicHomeNext').textContent=dash.nextExam?`下一场考试：${academicCourse(dash.nextExam.courseId)?.code||''} ${AcademicModel.dateTime(AcademicModel.when(dash.nextExam))} · ${AcademicModel.certaintyLabel(dash.nextExam.certainty)}`:'考试日期待发布';
 renderAcademicSchedule();
 const recs=[...DB.academicRecords].filter(r=>(!academicSelected||r.courseId===academicSelected)&&[r.title,r.text,r.blockers].join(' ').toLowerCase().includes(q)).sort((a,b)=>b.date.localeCompare(a.date));
 ae('academicRecords').innerHTML=recs.map(r=>`<article class="stat"><div class="kpi-row"><span class="pill">${esc(r.date)}</span><span class="pill">${esc(r.type)}</span><span class="pill">${r.minutes||0} 分钟</span></div><h3>${esc(r.title)}</h3><p class="small">${esc(academicCourse(r.courseId)?.name||'课程未关联')}</p><div class="note-box">${esc(r.text)}</div><p class="small">证据：${esc(r.evidence||'未填')}<br>卡点：${esc(r.blockers||'未填')}<br>下一步：${esc(r.next||'未填')}</p>${academicLink(r.url,'查看学习输出')}<div class="toolbar"><button class="btn" data-academic-edit="${esc(r.id)}">编辑</button><button class="btn" data-academic-asset="${esc(r.id)}">${DB.assets.some(a=>a.sourceAcademicRecordId===r.id)?'查看已收录成果':'收录成果快照'}</button><button class="btn danger" data-academic-delete="${esc(r.id)}">删除记录</button></div></article>`).join('')||'<p class="small">先安排学习，再记录真实输出、证据和卡点。计划不会自动变成学习成果。</p>';
 ae('academicRecords').querySelectorAll('[data-academic-edit]').forEach(b=>b.onclick=()=>openAcademicRecord(b.dataset.academicEdit));
 ae('academicRecords').querySelectorAll('[data-academic-asset]').forEach(b=>b.onclick=()=>promoteAcademicRecord(b.dataset.academicAsset));
 ae('academicRecords').querySelectorAll('[data-academic-delete]').forEach(b=>b.onclick=()=>{if(confirm('删除这条学习记录？已收录成果和日程保留。')){DB.academicRecords=DB.academicRecords.filter(r=>r.id!==b.dataset.academicDelete);save();renderAll()}});
}
function refreshAcademicEventOptions(courseId='',itemId=''){
 if(!academicReady)return;const course=courseId||ae('evAcademicCourse').value;
 ae('evAcademicCourse').innerHTML='<option value="">不关联课程</option>'+DB.academicCourses.map(c=>`<option value="${esc(c.id)}">${esc(c.code+' '+c.name)}</option>`).join('');ae('evAcademicCourse').value=course;
 ae('evAcademicItem').innerHTML='<option value="">不关联作业／考试</option>'+DB.academicItems.filter(i=>i.courseId===course).map(i=>`<option value="${esc(i.id)}">${esc(i.title)}</option>`).join('');ae('evAcademicItem').value=itemId;
}
function planAcademic(itemId=null){
 const item=DB.academicItems.find(x=>x.id===itemId),c=academicCourse(item?.courseId||academicSelected);if(!c)return alert('请先选择课程');
 openNewEvent();evCategory.value='study';evTitle.value=item?'准备：'+item.title:c.name+' 自习';evNote.value=item?item.requirements:'';refreshAcademicEventOptions(c.id,item?.id||'');toggleEventProject();
}
function openAcademicRecord(recordId=null,itemId=null){
 if(!DB.academicCourses.length)return alert('请先导入课程信息');const r=DB.academicRecords.find(x=>x.id===recordId),item=DB.academicItems.find(x=>x.id===itemId);academicEditingRecord=r?.id||null;
 ae('academicRecordModalTitle').textContent=r?'编辑课程学习记录':'记录实际学习';ae('academicRecordCourse').innerHTML=DB.academicCourses.map(c=>`<option value="${esc(c.id)}">${esc(c.code+' '+c.name)}</option>`).join('');ae('academicRecordCourse').value=r?.courseId||item?.courseId||academicSelected||DB.academicCourses[0].id;
 refreshAcademicRecordItems(r?.itemId||item?.id||'');ae('academicRecordDate').value=r?.date||AcademicModel.today();ae('academicRecordType').value=r?.type||'学习';ae('academicRecordTitle').value=r?.title||item?.title||'';
 for(const [key,id]of [['text','academicRecordText'],['evidence','academicRecordEvidence'],['blockers','academicRecordBlockers'],['next','academicRecordNext'],['url','academicRecordUrl']])ae(id).value=r?.[key]||'';
 ae('academicRecordMinutes').value=r?.minutes||'';openModal('academicRecordModal');
}
function refreshAcademicRecordItems(itemId=''){ae('academicRecordItem').innerHTML='<option value="">不关联具体任务</option>'+DB.academicItems.filter(x=>x.courseId===ae('academicRecordCourse').value).map(x=>`<option value="${esc(x.id)}">${esc(x.title)}</option>`).join('');ae('academicRecordItem').value=itemId;}
function saveAcademicRecord(){
 try{
  const c=academicCourse(ae('academicRecordCourse').value);if(!c)throw Error('请选择课程');const itemId=ae('academicRecordItem').value;if(itemId&&!DB.academicItems.some(x=>x.id===itemId&&x.courseId===c.id))throw Error('任务与课程不匹配');
  const old=DB.academicRecords.find(x=>x.id===academicEditingRecord),r=AcademicModel.record({id:old?.id||uid(),courseId:c.id,itemId,date:ae('academicRecordDate').value,type:ae('academicRecordType').value,title:ae('academicRecordTitle').value,text:ae('academicRecordText').value,minutes:Number(ae('academicRecordMinutes').value||0),evidence:ae('academicRecordEvidence').value,blockers:ae('academicRecordBlockers').value,next:ae('academicRecordNext').value,url:ae('academicRecordUrl').value},old,new Date().toISOString());
  if(old)Object.assign(old,r);else DB.academicRecords.push(r);save();closeModal('academicRecordModal');renderAll();
 }catch(e){alert(e.message)}
}
function promoteAcademicRecord(id){
 const r=DB.academicRecords.find(x=>x.id===id);if(!r)return;const old=DB.assets.find(x=>x.sourceAcademicRecordId===id);if(old){showProjectAssets(old.projectId);return}if(r.date>AcademicModel.today())return alert('未来日期的记录暂不收录为已完成成果');
 const c=academicCourse(r.courseId),now=new Date().toISOString();DB.assets.push({id:uid(),sourceAcademicRecordId:r.id,academicCourseId:r.courseId,title:r.title,date:r.date,type:'课程学习成果',projectId:c?.projectId||null,url:r.url||'',note:r.text+'\n\n证据：'+(r.evidence||'未填')+'\n复用与待改进：'+(r.next||''),createdAt:now,updatedAt:now});save();renderAll();
}
function prepareAcademicImport(payload){
 academicPrepared=AcademicModel.preview(DB,payload,{includeMeetings:ae('academicIncludeMeetings').checked});ae('academicPreview').classList.remove('hide');
 ae('academicPreviewText').textContent=`快照 ${AcademicModel.dateTime(academicPrepared.state.capturedAt)} · 新增 ${academicPrepared.added} 条，更新 ${academicPrepared.changed} 条，相同 ${academicPrepared.same} 条。已有个人准备、学习记录、成果及未出现在本包的记录会保留。`;
 const fields={dueAt:'截止日期',closesAt:'关闭日期',submissionStatus:'平台提交状态',certainty:'确认程度',requirements:'要求',date:'日期',grading:'评分规则',status:'下载状态'};
 ae('academicPreviewRows').innerHTML=academicPrepared.changes.map(x=>`<tr><td>${esc(x.title)}</td><td>${({added:'新增',changed:'更新',same:'相同'})[x.status]}</td><td>${x.changedFields.map(k=>{const name=fields[k]||k;const before=x.before?.[k],after=x.after[k];return esc(name)+(k==='dueAt'||k==='date'||k==='submissionStatus'?`：${esc(before||'空')} → ${esc(after||'空')}`:'')}).join('、')||'—'}</td></tr>`).join('');
 ae('academicImportStatus').textContent='预览已就绪，尚未写入个人数据。';
}
function cancelAcademicImport(){academicPrepared=null;ae('academicPreview').classList.add('hide');ae('academicImportStatus').textContent='已取消导入，数据未改变。';}
async function loadPrivateAcademicSnapshot(){
 ae('academicImportStatus').textContent='正在读取私有课程快照…';
 try{if(!isSyncConfigured())throw Error('请先配置当前设备的私有数据同步，或选择本地课程快照文件');const c=getSyncConfig(),file=await githubRequest(`contents/data/canvas-sjtu-snapshot.json?ref=${encodeURIComponent(c.branch)}`);const payload=JSON.parse(base64ToUtf8(file.content));prepareAcademicImport(payload);}catch(e){academicPrepared=null;ae('academicPreview').classList.add('hide');ae('academicImportStatus').textContent='读取失败：'+e.message;}
}
function initAcademic(){
 academicReady=true;ae('academicLoadPrivate').onclick=loadPrivateAcademicSnapshot;ae('academicImportFile').onchange=async e=>{try{const f=e.target.files?.[0];if(!f)return;if(f.size>12*1024*1024)throw Error('课程快照超过12MB');prepareAcademicImport(JSON.parse(await f.text()));}catch(error){academicPrepared=null;ae('academicPreview').classList.add('hide');ae('academicImportStatus').textContent='导入失败：'+error.message;}e.target.value='';};
 ae('academicIncludeMeetings').onchange=()=>{if(academicPrepared)prepareAcademicImport(academicPrepared.state)};
 ae('academicConfirmImport').onclick=()=>{if(!academicPrepared)return;try{const p=AcademicModel.apply(DB,academicPrepared,new Date().toISOString());academicPrepared=null;ae('academicPreview').classList.add('hide');save();renderAll();ae('academicImportStatus').textContent=`已合并课程快照，新增 ${p.added} 条、更新 ${p.changed} 条。`;}catch(e){ae('academicImportStatus').textContent='导入失败：'+e.message;}};
 ae('academicCancelImport').onclick=cancelAcademicImport;ae('academicCourseFilter').onchange=()=>{academicSelected=ae('academicCourseFilter').value;renderAcademic()};
 for(const id of ['academicKindFilter','academicView'])ae(id).onchange=renderAcademic;ae('academicSearch').oninput=renderAcademic;
 ae('academicNewRecord').onclick=()=>openAcademicRecord();ae('academicPlanCourse').onclick=()=>planAcademic();ae('academicWeekly').onclick=()=>switchTab('weekly');ae('academicRecordSave').onclick=saveAcademicRecord;ae('academicRecordCourse').onchange=()=>refreshAcademicRecordItems();
 ae('academicProjectChoice').onchange=()=>{const c=academicCourse(academicSelected);if(c){c.projectId=DB.projects.some(p=>p.id===ae('academicProjectChoice').value)?ae('academicProjectChoice').value:null;save();renderAll()}};
 ae('evAcademicCourse').onchange=()=>refreshAcademicEventOptions(ae('evAcademicCourse').value);
}
