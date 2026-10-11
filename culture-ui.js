'use strict';
let cultureReady=false,editingCultureId=null,cultureLines=[],cultureWisdomSourceId=null;
const ce=id=>document.getElementById(id);
function culturePane(id){
  document.querySelectorAll('[data-culture-pane]').forEach(b=>{b.classList.toggle('active',b.dataset.culturePane===id);b.setAttribute('aria-pressed',String(b.dataset.culturePane===id))});
  document.querySelectorAll('.culture-pane').forEach(p=>p.classList.toggle('hide',p.id!=='culture-'+id));
}
function connectCultureProject(){
  const chosen=DB.projects.find(p=>p.id===ce('cultureProjectChoice').value);
  if(chosen){DB.projects.forEach(p=>{if(p.learningKey==='traditional-culture'&&p.id!==chosen.id)delete p.learningKey});chosen.learningKey='traditional-culture';chosen.updatedAt=new Date().toISOString()}
  const p=chosen||CultureModel.ensureProject(DB,uid(),fmtDate(addDays(new Date(),7)),new Date().toISOString());
  DB.cultureRecords.forEach(r=>{r.projectId=p.id});
  DB.assets.filter(a=>a.sourceCultureRecordId&&DB.cultureRecords.some(r=>r.id===a.sourceCultureRecordId)).forEach(a=>{a.projectId=p.id});
  save();renderAll();ce('cultureStatus').textContent='已关联长期项目，可编辑目标或安排学习时间。';return p;
}
function renderCulture(){
  if(!cultureReady)return;
  const p=CultureModel.project(DB),completed=DB.cultureProgress.filter(x=>x.completed&&CultureModel.weeks.some(w=>w.id===x.id)).length;
  const next=CultureModel.weeks.find(w=>!DB.cultureProgress.some(x=>x.id===w.id&&x.completed));
  ce('cultureProgressText').textContent=`已验收 ${completed}/12 周 · 学习记录 ${DB.cultureRecords.length} 条 · ${next?'下一步：第'+next.week+'周 '+next.title:'基础路线已验收，可整理专题成果'}`;
  ce('cultureProgressBar').style.width=(completed/12*100)+'%';
  ce('cultureProjectChoice').innerHTML='<option value="">建立预设长期项目</option>'+DB.projects.map(x=>`<option value="${esc(x.id)}">${esc(x.title)}</option>`).join('');ce('cultureProjectChoice').value=p?.id||'';
  ce('cultureProjectLabel').textContent=p?'关联项目：'+p.title+' · '+projectStatuses[projectStatus(p)]:'尚未关联长期项目；路线和笔记可先独立使用。';
  ce('cultureEditProject').disabled=!p;ce('culturePlanTime').disabled=!p;ce('cultureShowAssets').disabled=!p;
  ce('cultureWeeks').innerHTML=CultureModel.weeks.map(w=>{
    const done=DB.cultureProgress.some(x=>x.id===w.id&&x.completed);
    return `<article class="stat"><div class="row" style="justify-content:space-between"><h3>第${w.week}周 · ${esc(w.title)}</h3><label><input type="checkbox" data-culture-week="${w.id}" ${done?'checked':''}> 已验收</label></div><p>${esc(w.study)}</p><div class="note-box">实践：${esc(w.practice)}\n验收：${esc(w.output)}</div><button class="btn" data-culture-write="${w.week}" style="margin-top:10px">记录本周学习</button></article>`;
  }).join('');
  ce('cultureWeeks').querySelectorAll('[data-culture-week]').forEach(box=>box.onchange=()=>{
    const old=DB.cultureProgress.find(x=>x.id===box.dataset.cultureWeek),stamp=new Date().toISOString();
    if(old){old.completed=box.checked;old.updatedAt=stamp}else DB.cultureProgress.push({id:box.dataset.cultureWeek,completed:box.checked,createdAt:stamp,updatedAt:stamp});save();renderAll();
  });
  ce('cultureWeeks').querySelectorAll('[data-culture-write]').forEach(b=>b.onclick=()=>openCultureRecord(null,'概念卡',Number(b.dataset.cultureWrite)));
  renderCultureKnowledge();renderCultureRecords();renderCultureLines();
}
function renderCultureKnowledge(){
  const q=ce('cultureTopicSearch').value.trim().toLowerCase();
  ce('cultureKnowledge').innerHTML=CultureModel.topics.filter(t=>[t.name,t.layer,t.detail,t.boundary].join(' ').toLowerCase().includes(q)).map(t=>`<details class="culture-detail"><summary>${esc(t.name)} <span class="pill">${esc(t.layer)}</span></summary><p>${esc(t.detail)}</p><div class="note-box">${esc(t.boundary)}</div><button class="btn" data-culture-topic="${t.id}" style="margin-top:10px">写一张概念卡</button></details>`).join('')||'<p class="small">没有匹配的概念。</p>';
  ce('cultureKnowledge').querySelectorAll('[data-culture-topic]').forEach(b=>b.onclick=()=>{
    const t=CultureModel.topics.find(x=>x.id===b.dataset.cultureTopic);openCultureRecord(null,'概念卡');ce('cultureRecordTitle').value=t.name;ce('cultureRecordTopic').value=t.id;
  });
}
function fillCultureTemplate(type){
  const t=CultureModel.templates[type];ce('cultureRecordText').value=t.text;ce('cultureRecordEvidence').value='';ce('cultureRecordEvidence').placeholder=t.evidence;
}
function openCultureRecord(id=null,type='概念卡',week=null){
  const r=DB.cultureRecords.find(x=>x.id===id);editingCultureId=r?.id||null;
  ce('cultureRecordModalTitle').textContent=r?'编辑学习记录':'新增学习记录';
  ce('cultureRecordType').value=r?.type||type;ce('cultureRecordTitle').value=r?.title||'';ce('cultureRecordDate').value=r?.date||fmtDate(new Date());
  ce('cultureRecordTopic').innerHTML='<option value="">综合 / 未分类</option>'+CultureModel.topics.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');ce('cultureRecordTopic').value=r?.topic||'';
  ce('cultureRecordWeek').innerHTML='<option value="">不指定周</option>'+CultureModel.weeks.map(w=>`<option value="${w.week}">第${w.week}周 · ${esc(w.title)}</option>`).join('');ce('cultureRecordWeek').value=String(r?.week||week||'');
  fillCultureTemplate(r?.type||type);if(r){ce('cultureRecordText').value=r.text;ce('cultureRecordEvidence').value=r.evidence||''}
  ce('cultureRecordSource').value=r?.sourceUrl||'';openModal('cultureRecordModal');
}
function saveCultureRecord(){
  const title=ce('cultureRecordTitle').value.trim(),text=ce('cultureRecordText').value.trim(),date=ce('cultureRecordDate').value;
  if(!title||!text||!date)return alert('请填写标题、日期与学习内容');
  const sourceUrl=GrowthModel.safeUrl(ce('cultureRecordSource').value.trim());if(sourceUrl===null)return alert('来源链接需为有效的 HTTP / HTTPS 地址');
  const old=DB.cultureRecords.find(x=>x.id===editingCultureId),stamp=new Date().toISOString();if(editingCultureId&&!old)return alert('记录已被删除，请关闭后重新新增');
  const record={id:old?.id||uid(),title,text,date,type:ce('cultureRecordType').value,topic:ce('cultureRecordTopic').value,week:Number(ce('cultureRecordWeek').value)||null,evidence:ce('cultureRecordEvidence').value.trim(),sourceUrl,projectId:CultureModel.project(DB)?.id||null,createdAt:old?.createdAt||stamp,updatedAt:stamp};
  if(old)Object.assign(old,record);else DB.cultureRecords.push(record);save();closeModal('cultureRecordModal');renderAll();
}
function promoteCultureRecord(id,target){
  const r=DB.cultureRecords.find(x=>x.id===id);if(!r)return;
  if(target==='asset'&&!CultureModel.project(DB))return alert('请先在上方关联长期项目，再收录成果');
  const item=CultureModel.promote(DB,r,target,uid(),new Date().toISOString());save();renderAll();
  if(target==='asset'){showProjectAssets(item.projectId)}else switchTab('wisdom');
}
function renderCultureRecords(){
  const q=ce('cultureRecordSearch').value.trim().toLowerCase(),type=ce('cultureRecordFilter').value;
  const records=DB.cultureRecords.filter(r=>(!type||r.type===type)&&[r.title,r.text,r.evidence].join(' ').toLowerCase().includes(q)).sort((a,b)=>b.date.localeCompare(a.date)||String(b.createdAt).localeCompare(String(a.createdAt)));
  ce('cultureRecords').innerHTML=records.map(r=>{
    const source=GrowthModel.safeUrl(r.sourceUrl),asset=DB.assets.some(a=>a.sourceCultureRecordId===r.id),wisdom=DB.wisdom.some(a=>a.sourceCultureRecordId===r.id);
    return `<article class="stat"><b>${esc(r.title)}</b><div class="kpi-row" style="margin:8px 0"><span class="pill">${esc(r.type)}</span><span class="pill">${esc(r.date)}</span>${r.week?`<span class="pill">第${esc(r.week)}周</span>`:''}<span class="pill">${esc(CultureModel.topics.find(x=>x.id===r.topic)?.name||'综合')}</span></div><div class="note-box">${esc(r.text)}</div><p class="small">依据与边界：${esc(r.evidence||'未填写')}</p>${source?`<p><a href="${esc(source)}" target="_blank" rel="noopener noreferrer">查看来源</a></p>`:''}<div class="toolbar"><button class="btn" data-culture-edit="${esc(r.id)}">编辑</button><button class="btn" data-culture-asset="${esc(r.id)}">${asset?'查看成果':'收录成果'}</button><button class="btn" data-culture-wisdom="${esc(r.id)}">${wisdom?'查看心法':'提炼为心法'}</button><button class="btn danger" data-culture-delete="${esc(r.id)}">删除</button></div></article>`;
  }).join('')||'<p class="small">暂无匹配记录。可从知识地图、每周路线或实践模板开始。</p>';
  ce('cultureRecords').querySelectorAll('[data-culture-edit]').forEach(b=>b.onclick=()=>openCultureRecord(b.dataset.cultureEdit));
  ce('cultureRecords').querySelectorAll('[data-culture-asset]').forEach(b=>b.onclick=()=>promoteCultureRecord(b.dataset.cultureAsset,'asset'));
  ce('cultureRecords').querySelectorAll('[data-culture-wisdom]').forEach(b=>b.onclick=()=>{
    const id=b.dataset.cultureWisdom,old=DB.wisdom.find(w=>w.sourceCultureRecordId===id);
    if(old){switchTab('wisdom');return}
    // Open an editable wisdom draft so the user can distill the record in their own words.
    const r=DB.cultureRecords.find(x=>x.id===id);openNewWisdom();cultureWisdomSourceId=id;ce('wisdomText').value=r.title+'\n'+r.text;
    ce('cultureStatus').textContent='已打开心法草稿，请精炼后保存。';
  });
  ce('cultureRecords').querySelectorAll('[data-culture-delete]').forEach(b=>b.onclick=()=>{
    if(!confirm('删除这条学习记录？已收录的成果或心法会保留。'))return;DB.cultureRecords=DB.cultureRecords.filter(x=>x.id!==b.dataset.cultureDelete);save();renderAll();
  });
}
function renderCultureLines(){
  const lines=CultureModel.hexagram(cultureLines);
  const draw=changed=>Array.from({length:6},(_,i)=>6-i).map(position=>{
    const x=lines.find(l=>l.position===position),yang=x&&(changed?x.changedYang:x.yang);
    return `<div class="culture-yao"><span class="small">${position===1?'初':position}爻</span>${x?`<span class="yao-line ${yang?'yang':'yin'}"><i></i><i></i></span><span class="small">${changed?'':x.value+(x.moving?' · 动':'')}</span>`:'<span class="small">待记录</span>'}</div>`;
  }).join('');
  ce('cultureOriginalLines').innerHTML=draw(false);ce('cultureChangedLines').innerHTML=draw(true);
  ce('cultureLineStatus').textContent=`已记录 ${lines.length}/6 爻 · 第一次是最下方初爻`;ce('cultureAddLine').disabled=lines.length===6;ce('cultureSaveLines').disabled=lines.length!==6;ce('cultureUndoLine').disabled=!lines.length;
}
function initCulture(){
  cultureReady=true;
  document.querySelectorAll('[data-culture-pane]').forEach(b=>b.onclick=()=>culturePane(b.dataset.culturePane));
  ce('cultureConnectProject').onclick=connectCultureProject;
  ce('cultureEditProject').onclick=()=>{const p=CultureModel.project(DB);if(p)editProject(p.id)};
  ce('culturePlanTime').onclick=()=>{const p=CultureModel.project(DB);if(p)planProject(p.id)};
  ce('cultureShowAssets').onclick=()=>{const p=CultureModel.project(DB);if(p)showProjectAssets(p.id)};
  ce('cultureToWeekly').onclick=()=>switchTab('weekly');
  ce('cultureTopicSearch').oninput=renderCultureKnowledge;ce('cultureRecordSearch').oninput=renderCultureRecords;ce('cultureRecordFilter').onchange=renderCultureRecords;
  ce('cultureAddRecord').onclick=()=>openCultureRecord();ce('cultureRecordSave').onclick=saveCultureRecord;
  ce('cultureUseTemplate').onclick=()=>{if(confirm('用当前卡片类型的模板替换编辑框内容？'))fillCultureTemplate(ce('cultureRecordType').value)};
  document.querySelectorAll('[data-culture-practice]').forEach(b=>b.onclick=()=>{
    const kind=b.dataset.culturePractice;openCultureRecord(null,kind==='fifteen'?'辨析卡':'实践卡',kind==='fifteen'?1:null);
    const templates={
      seasons:['节气与阴阳观察','terms','观察地点：\n日期与节气（查历表）：\n天气、日照与植物：\n亲眼观察到的事实：\n我的解释或体悟：\n地区差异与疑问：'],
      decision:['一次真实决策与《易》对读','tai-pi','待权衡事项：\n已知事实与证据：\n有利 / 不利条件：\n上升 / 衰退因素：\n支持 / 制约关系：\n什么条件改变后需调整选择：\n所读卦辞与出处：\n启发与局限：'],
      compass:['一次窗户方位测量','compass','地点与窗户：\n仪器和测量方式：\n方位或角度读数：\n地理北 / 磁北的约定：\n金属、电器等干扰：\n误差与复测：'],
      fifteen:['洛书、河图与节气的“十五”','luoshu','洛书：1至9之和45；3行等和，所以45÷3=15。\n河图：五组和7、9、11、13、15；并非全为15。\n节气：定气每15°黄经，平均约15.22天。\n二十四山：每个方位扇区15°。\n我已验证的计算：\n仍待考证的传统解释：']
    };const t=templates[kind];ce('cultureRecordTitle').value=t[0];ce('cultureRecordTopic').value=t[1];ce('cultureRecordText').value=t[2];
  });
  ce('cultureAddLine').onclick=()=>{if(cultureLines.length<6)cultureLines.push(Number(ce('cultureLineValue').value));renderCultureLines()};
  ce('cultureUndoLine').onclick=()=>{cultureLines.pop();renderCultureLines()};ce('cultureResetLines').onclick=()=>{cultureLines=[];renderCultureLines()};
  ce('cultureSaveLines').onclick=()=>{
    if(cultureLines.length!==6)return;openCultureRecord(null,'实践卡',11);ce('cultureRecordTitle').value='三钱法本卦与变卦构图';ce('cultureRecordTopic').value='six-lines';
    const lines=CultureModel.hexagram(cultureLines);ce('cultureRecordText').value='面值约定：字面3、背面2（实际投掷前固定）\n自初爻至上爻：'+cultureLines.join('、')+'\n本卦自下而上：'+lines.map(x=>x.yang?'阳':'阴').join('、')+'\n变卦自下而上：'+lines.map(x=>x.changedYang?'阳':'阴').join('、')+'\n动爻：'+(lines.filter(x=>x.moving).map(x=>x.position+'爻').join('、')||'无')+'\n实际操作或手动输入：\n我对符号结构的理解：';
  };
  ce('cultureReadings').innerHTML=CultureModel.readings.map(([name,use,url])=>`<div class="stat">${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(name)}</a>`:`<b>${esc(name)}</b>`}<p class="small">${esc(use)}</p></div>`).join('');
}
