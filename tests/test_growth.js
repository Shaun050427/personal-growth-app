const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const vm=require('node:vm');
const M=require('../growth-model.js');
const C=require('../culture-model.js');
function db(){return{version:2,events:[],tasks:[],done:{},courses:[],training:[],body:[],research:[],stock:[],wisdom:[],projects:[],assets:[],weeklyReviews:[]}}
const clone=x=>JSON.parse(JSON.stringify(x));

test('old backups normalize without inventing new records; hashes ignore empty new fields and key order',()=>{
  const old=db();delete old.assets;delete old.weeklyReviews;
  assert.deepEqual(M.normalize(old).assets,[]);assert.equal(M.hash(old),M.hash(db()));
  assert.equal(M.hash(old),M.hash(Object.fromEntries(Object.entries(old).reverse())));
  assert.throws(()=>M.normalize({...old,assets:{}}));assert.throws(()=>M.normalize({...old,done:[]}));
});
test('independent records and fields merge, including checklist booleans',()=>{
  const base=db();base.projects=[{id:'p',title:'原项目',goal:'旧目标'}];base.done={'2026-10-06':{a:false,b:false}};
  const l=clone(base),r=clone(base);l.projects[0].title='本机标题';r.projects[0].goal='云端目标';l.projects[0].updatedAt='2026-10-10T01:00:00Z';r.projects[0].updatedAt='2026-10-10T02:00:00Z';
  l.assets.push({id:'a',title:'报告'});r.research.push({id:'r',output:'实验'});
  l.done['2026-10-06'].a=true;r.done['2026-10-06'].b=true;
  const result=M.mergeData(base,l,r);assert.ok(result.ok);assert.equal(result.data.projects[0].title,'本机标题');assert.equal(result.data.projects[0].goal,'云端目标');
  assert.equal(result.data.assets.length,1);assert.equal(result.data.research.length,1);assert.deepEqual(result.data.done['2026-10-06'],{a:true,b:true});
});
test('overlapping edit and delete-versus-edit demand explicit resolution',()=>{
  const base=db();base.assets=[{id:'a',title:'原报告'}];const l=clone(base),r=clone(base);l.assets[0].title='本机';r.assets[0].title='云端';
  assert.equal(M.mergeData(base,l,r).ok,false);l.assets=[];assert.equal(M.mergeData(base,l,r).ok,false);
});
test('independent deletion is preserved and concurrent incompatible reorder is not silent',()=>{
  const b=db();b.projects=['a','b','c'].map(id=>({id,title:id}));const l=clone(b),r=clone(b);l.projects.splice(1,1);r.assets.push({id:'x'});
  assert.deepEqual(M.mergeData(b,l,r).data.projects.map(p=>p.id),['a','c']);
  l.projects=[b.projects[1],b.projects[0],b.projects[2]];r.projects=[b.projects[0],b.projects[2],b.projects[1]];assert.equal(M.mergeData(b,l,r).ok,false);
});
test('Monday-based weeks cross month/year and exclude future facts while retaining planned schedule',()=>{
  assert.equal(M.weekStart('2026-10-11'),'2026-10-05');assert.equal(M.weekStart('2027-01-01'),'2026-12-28');
  const d=db();d.tasks=[{id:'t',name:'训练',freq:'daily'}];d.done={'2026-10-06':{t:false},'2026-10-07':{t:true}};
  d.research=[{date:'2026-10-04',output:'上周'},{date:'2026-10-06',output:'实际完成'},{date:'2026-10-11',output:'未来'}];
  d.events=[{title:'未来日程',repeat:'once',date:'2026-10-11',start:'09:00',end:'10:00'}];
  d.courses=[{name:'课程',weekday:2,semesterStart:'2026-09-01',weekFrom:1,weekTo:20,start:'08:00',end:'09:00'}];
  const s=M.summarize(d,'2026-10-05','2026-10-10');assert.equal(s.research.length,1);assert.equal(s.checklist.length,6);assert.equal(s.schedule.length,2);
  assert.equal(s.checklist[0].recorded,false);assert.equal(s.checklist[1].recorded,true);assert.equal(s.checklist[1].unchecked.length,1);
  const future=M.summarize(d,'2026-10-12','2026-10-10');assert.equal(future.checklist.length,0);assert.equal(future.research.length,0);
});
test('report carries evidence and decision fields, excludes health unless opted in, validates links',()=>{
  const d=db();d.projects=[{id:'p',title:'课题',expectedOutcome:'复现实验',stopCondition:'三轮不达基线即停止'}];
  d.assets=[{id:'a',title:'报告',date:'2026-10-06',projectId:'p',note:'AUC 0.8',url:'https://example.com/report'}];d.body=[{date:'2026-10-06',weight:70}];d.training=[{date:'2026-10-06',part:'肩',exercises:[]}];
  const s=M.summarize(d,'2026-10-05','2026-10-10'),md=M.markdown(d,s,{next:'验证模型'});
  assert.match(md,/三轮不达基线即停止/);assert.match(md,/AUC 0.8/);assert.match(md,/不能推断执行情况|未勾选不等于/);assert.doesNotMatch(md,/weight/);
  assert.match(M.markdown(d,s,{}, {body:true}),/weight/);assert.doesNotMatch(M.markdown(d,s,{}, {training:false}),/## 训练/);
  assert.equal(M.safeUrl('javascript:alert(1)'),null);assert.equal(M.safeUrl('file:///tmp/report'),null);
});

// Exercise the actual app sync functions with asynchronous remote responses.
function harness(initial=db()){
  const storage=new Map(),el=()=>({textContent:'',dataset:{}});
  const context={GrowthModel:M,console,Date,Math,JSON,TextEncoder,TextDecoder,URL,navigator:{},setTimeout:()=>0,clearTimeout:()=>{},
    btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    syncText:el(),syncNowBtn:el(),syncSettingsStatus:el(),conflictDetail:el(),renderAll:()=>{},openModal:()=>{},closeModal:()=>{}};
  vm.createContext(context);
  const inline=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInContext(inline.slice(0,inline.indexOf('async function loadHistory()'))+`\nglobalThis.h={DB,syncState,replaceDB,save,load,initialiseSync,syncNow,commitCurrent,updateSyncMeta,refreshSyncBaseline,dataHash,legacyDataHash,repoKey};`,context);
  context.h.replaceDB(initial);storage.set('personalGrowthGithubSync_v1',JSON.stringify({owner:'test',repo:'data',branch:'main',path:'data.json',token:'test-placeholder'}));
  return{context,h:context.h,storage};
}
test('upgrade from existing metadata is clean and canonical remote equality creates no conflict or write',async()=>{
  const{context,h,storage}=harness();h.DB.projects=[{id:'p',title:'旧项目'}];
  storage.set('personalGrowthGithubMeta_v1',JSON.stringify({repoKey:h.repoKey(),sha:'old',dataHash:h.legacyDataHash()}));
  let writes=0;context.remote={sha:'new',data:clone(h.DB)};context.remote.data=Object.fromEntries(Object.entries(context.remote.data).reverse());delete context.remote.data.assets;delete context.remote.data.weeklyReviews;
  vm.runInContext('readRemote=async()=>remote;githubRequest=async()=>{writes++;return{}};',Object.assign(context,{writes:0}));
  h.initialiseSync();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.syncState.dirty,false);assert.equal(h.syncState.conflict,null);assert.equal(context.writes,writes);
});
test('edits made while an upload is in flight remain dirty and excluded from that committed snapshot',async()=>{
  const{context,h}=harness();let release,uploaded;
  context.put=async(route,options)=>{uploaded=JSON.parse(Buffer.from(JSON.parse(options.body).content,'base64').toString());return await new Promise(r=>release=r)};
  vm.runInContext('githubRequest=put',context);
  h.DB.assets.push({id:'a',title:'已提交'});const pending=h.commitCurrent({sha:'s1'});
  h.DB.research.push({id:'r',output:'上传中新增'});h.save();release({content:{sha:'s2'}});await pending;
  assert.equal(uploaded.data.research.length,0);assert.equal(h.DB.research.length,1);assert.equal(h.syncState.baseData.research.length,0);assert.equal(h.syncState.dirty,true);
});
test('advanced baseline from another tab merges rather than erasing independent local changes',()=>{
  const{h,storage}=harness();h.updateSyncMeta('s1');const other=clone(h.DB);other.research.push({id:'r',output:'另一页成果'});
  h.DB.assets.push({id:'a',title:'当前页成果'});h.save();
  storage.set('personalGrowthGithubBase_v1',JSON.stringify({repoKey:h.repoKey(),data:other}));storage.set('personalGrowthGithubMeta_v1',JSON.stringify({repoKey:h.repoKey(),sha:'s2',dataHash:M.hash(other)}));
  assert.equal(h.refreshSyncBaseline(),true);assert.equal(h.DB.assets.length,1);assert.equal(h.DB.research.length,1);assert.equal(h.syncState.dirty,true);
});
test('new baseline overlapping current changes is preserved as a conflict without replacement',()=>{
  const d=db();d.projects=[{id:'p',title:'原项目'}];const{h,storage}=harness(d);h.updateSyncMeta('s1');const other=clone(h.DB);other.projects[0].title='另一页';h.DB.projects[0].title='当前页';h.save();
  storage.set('personalGrowthGithubBase_v1',JSON.stringify({repoKey:h.repoKey(),data:other}));storage.set('personalGrowthGithubMeta_v1',JSON.stringify({repoKey:h.repoKey(),sha:'s2',dataHash:M.hash(other)}));
  assert.equal(h.refreshSyncBaseline(),false);assert.equal(h.DB.projects[0].title,'当前页');assert.ok(h.syncState.conflict);assert.ok(storage.has('personalGrowthConflictBackup_v1'));
});
test('remote independently changed records are merged and uploaded with the expected remote SHA',async()=>{
  const{context,h}=harness();h.updateSyncMeta('s1');context.remote={sha:'s2',data:clone(h.DB)};context.remote.data.assets.push({id:'remote',title:'云端'});h.DB.research.push({id:'local',output:'本机'});h.save();let uploaded;
  context.put=async(route,options)=>{uploaded=JSON.parse(options.body);return{content:{sha:'s3'}}};vm.runInContext('readRemote=async()=>remote;githubRequest=put',context);
  await h.syncNow();const payload=JSON.parse(Buffer.from(uploaded.content,'base64').toString());assert.equal(uploaded.sha,'s2');assert.equal(payload.data.assets.length,1);assert.equal(payload.data.research.length,1);assert.equal(h.syncState.dirty,false);
});
test('old restore removes newer optional records and preserves unknown future fields',()=>{
  const{h}=harness();h.DB.assets.push({id:'new'});const older=db();delete older.assets;delete older.weeklyReviews;older.futureField={kept:true};h.replaceDB(older);
  assert.equal(h.DB.assets.length,0);assert.equal(h.DB.futureField.kept,true);
});
function uiHarness(){
  const result=harness(),{context}=result,elements=new Map();
  const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
  const element=id=>{if(!elements.has(id))elements.set(id,{id,value:'',textContent:'',innerHTML:'',checked:false,disabled:false,dataset:{},classList:{add(){},remove(){},toggle(){}},focus(){},select(){}});return elements.get(id)};
  for(const id of html.matchAll(/\bid="([A-Za-z][A-Za-z0-9]+)"/g))if(!(id[1]in context))context[id[1]]=element(id[1]);
  context.document={getElementById:element};context.alert=()=>{};context.confirm=()=>true;
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../growth-ui.js'),'utf8'),context);
  context.renderAll=()=>{};context.initGrowth();return{...result,element};
}
test('review inputs stay in a local draft until explicitly confirmed, saved reviews can be loaded and deleted',()=>{
  const{context,h,storage}=uiHarness();const before=h.dataHash();context.reviewOutput.value='完成基线验证';context.reviewOutput.oninput();
  assert.equal(h.dataHash(),before);assert.equal(h.DB.weeklyReviews.length,0);assert.ok([...storage.keys()].some(k=>k.startsWith('personalGrowthReviewDraft_v1:')));
  context.saveReviewBtn.onclick();assert.equal(h.DB.weeklyReviews.length,1);assert.equal(h.DB.weeklyReviews[0].output,'完成基线验证');assert.equal(h.syncState.dirty,true);
  context.reviewOutput.value='临时草稿';context.restoreReviewBtn.onclick();assert.equal(context.reviewOutput.value,'完成基线验证');context.deleteReviewBtn.onclick();assert.equal(h.DB.weeklyReviews.length,0);assert.equal(context.reviewOutput.value,'完成基线验证');
});
test('asset save preserves project link and safe URL, and rejects unsupported URLs',()=>{
  const{context,h}=uiHarness();context.assetTitle.value='复现实验报告';context.assetDate.value='2026-10-10';context.assetType.value='科研报告';context.assetProject.value='p';context.assetUrl.value='javascript:alert(1)';context.assetNote.value='可复用配置';
  context.saveAssetBtn.onclick();assert.equal(h.DB.assets.length,0);
  context.assetUrl.value='https://example.com/report';context.saveAssetBtn.onclick();assert.equal(h.DB.assets.length,1);assert.equal(h.DB.assets[0].projectId,'p');assert.equal(h.DB.assets[0].note,'可复用配置');
});
test('project assessment budgets accept zero, reject negative values and preserve blank as unknown',()=>{
  const{context,element}=uiHarness();context.fillProjectAssessment({budgetHours:0,stopCondition:'不达基线则停止'});
  assert.equal(Number(context.readProjectAssessment().budgetHours),0);assert.equal(context.readProjectAssessment().stopCondition,'不达基线则停止');
  element('projectBudgetHours').value='-1';assert.equal(context.readProjectAssessment(),null);element('projectBudgetHours').value='';assert.equal(context.readProjectAssessment().budgetHours,null);
});
test('all HTML scripts parse and script files exist before app initialization',()=>{
  const path=require('node:path'),root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const refs=[...html.matchAll(/<script src="\.\/([^"?]+)"/g)].map(m=>m[1]);assert.deepEqual(refs,['academic-model.js','academic-ui.js','growth-model.js','growth-ui.js','culture-model.js','culture-ui.js','yi-integration.js','japanese-transfer.js','japanese-ui.js','cs-curriculum.js','cs-transfer.js','cs-ui.js']);for(const ref of refs)new vm.Script(fs.readFileSync(path.join(root,ref),'utf8'));
  new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);assert.ok(html.includes("load();initGrowth();initCulture();initJapanese();initCS();if(typeof initAcademic==='function')initAcademic();renderAll();"));assert.ok(html.includes('initialiseSync();'));
  assert.ok(!html.includes('projectStatus.value'), 'project status select must not be shadowed by the helper function');
});
function appHarness(initial=db()){
  const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8'),elements=new Map(),storage=new Map([['personalPlanner_v2',JSON.stringify(initial)]]);
  function element(id=''){
    if(id&&elements.has(id))return elements.get(id);const query=new Map(),classes=new Set();
    const e={id,value:'',textContent:'',innerHTML:'',checked:false,disabled:false,dataset:{},children:[],style:{setProperty(){}},classList:{add(...xs){xs.forEach(x=>classes.add(x))},remove(...xs){xs.forEach(x=>classes.delete(x))},toggle(x,on){if(on)classes.add(x);else classes.delete(x)},contains(x){return classes.has(x)}},
      appendChild(x){this.children.push(x);return x},querySelector(sel){if(!query.has(sel))query.set(sel,element());return query.get(sel)},querySelectorAll(sel){
        const attr=sel.match(/^\[([a-z-]+)\]$/)?.[1];if(!attr)return[];
        const values=[...this.innerHTML.matchAll(new RegExp(attr+'="([^"]+)"','g'))].map(x=>x[1]);
        return values.map(value=>{const key=sel+value;if(!query.has(key)){const node=element();node.dataset[attr.slice(5).replace(/-([a-z])/g,(_,s)=>s.toUpperCase())]=value;query.set(key,node)}return query.get(key)});
      },addEventListener(){},focus(){},select(){}};
    if(id)elements.set(id,e);return e;
  }
  const context={GrowthModel:M,CultureModel:C,console,Date,Math,JSON,URL,TextEncoder,TextDecoder,navigator:{},location:{protocol:'https:'},setTimeout:()=>0,setInterval:()=>0,clearTimeout(){},alert(){},confirm:()=>true,
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{getElementById:element,createElement:()=>element(),querySelectorAll:()=>[],addEventListener(){}},addEventListener(){}};
  context.window=context;for(const m of html.matchAll(/\bid="([A-Za-z][A-Za-z0-9]+)"/g))context[m[1]]=element(m[1]);
  vm.createContext(context);for(const script of ['academic-model.js','academic-ui.js'])vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'..',script),'utf8'),context);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../growth-ui.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../culture-ui.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../japanese-transfer.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../japanese-ui.js'),'utf8'),context);
  for(const script of ['cs-curriculum.js','cs-transfer.js','cs-ui.js'])vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'..',script),'utf8'),context);
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1]+'\nglobalThis.db=DB;',context);
  return{context,element,storage};
}
test('complete app initialization handles an existing project and new records before first render',()=>{
  const d=db();d.projects=[{id:'p',title:'旧项目',status:'paused',reviewDate:'2026-10-01'}];d.assets=[{id:'a',title:'报告',date:'2026-10-06',projectId:'p'}];
  const{context,element}=appHarness(d);assert.equal(context.db.projects.length,1);assert.match(element('growthHomeStatus').textContent,/累计成果 1 项/);assert.match(element('reviewPreview').value,/旧项目/);
  context.editProject('p');assert.equal(element('projectStatus').value,'paused');element('projectStatus').value='stopped';element('projectStopCondition').value='预算用尽';context.saveProjectBtn.onclick();assert.equal(context.db.projects[0].status,'stopped');assert.equal(context.db.projects[0].stopCondition,'预算用尽');
});
test('competition assessment pre-fills a draft and reuses a matching project without creating duplicates',()=>{
  const{context,element}=appHarness();const item={title:'示例竞赛',url:'https://www.kaggle.com/competitions/example',reward:'cash'};
  const click=()=>context.competitionAssessmentClick({target:{closest:()=>({dataset:{assessment:JSON.stringify(item)}})}});
  click();assert.equal(context.db.projects.length,0);assert.equal(element('projectTitle').value,'示例竞赛');assert.equal(element('projectSourceUrl').value,item.url);
  context.saveProjectBtn.onclick();assert.equal(context.db.projects.length,1);click();assert.equal(context.db.projects.length,1);assert.equal(element('projectModalTitle').textContent,'编辑中长期项目');
});

test('culture upgrade preserves sync fingerprints, merges independent records and restores older backups cleanly',()=>{
  const old=db(),normalized=M.normalize(old);assert.equal(M.hash(old),M.hash(normalized));assert.deepEqual(normalized.cultureRecords,[]);assert.deepEqual(normalized.cultureProgress,[]);
  const l=clone(normalized),r=clone(normalized);l.cultureRecords.push({id:'left',title:'本机观察'});r.cultureRecords.push({id:'right',title:'云端原文'});r.cultureProgress.push({id:'culture-week-1',completed:true});
  const merged=M.mergeData(old,l,r);assert.equal(merged.ok,true);assert.equal(merged.data.cultureRecords.length,2);assert.equal(merged.data.cultureProgress.length,1);
  const{h}=harness(merged.data);h.replaceDB(old);assert.equal(h.DB.cultureRecords.length,0);assert.equal(h.DB.cultureProgress.length,0);
  assert.throws(()=>M.normalize({...old,cultureRecords:{}}));
});
test('culture weekly report excludes future records, carries evidence and distinguishes self-confirmed progress',()=>{
  const d=M.normalize(db());d.cultureRecords=[{id:'a',date:'2026-10-06',type:'辨析卡',title:'洛书十五',text:'45÷3=15',evidence:'核对8条线',sourceUrl:'https://example.com/source'},{id:'b',date:'2026-10-11',type:'概念卡',title:'未来记录'}];
  d.cultureProgress=[{id:'culture-week-1',completed:true,updatedAt:'2026-10-06T01:00:00Z'},{id:'culture-week-2',completed:false,updatedAt:'2026-10-06T01:00:00Z'}];
  const s=M.summarize(d,'2026-10-05','2026-10-10'),md=M.markdown(d,s);assert.equal(s.cultureRecords.length,1);assert.equal(s.cultureProgress.length,1);assert.match(md,/45÷3=15/);assert.match(md,/核对8条线/);assert.match(md,/不等于独立能力评测/);assert.doesNotMatch(md,/未来记录/);
});
test('opening culture does not create personal achievements; linking projects and planning time reuse the same ID',()=>{
  const{context,element}=appHarness();assert.equal(context.db.projects.length,0);assert.equal(context.db.cultureRecords.length,0);assert.equal(context.db.cultureProgress.length,0);
  context.cultureConnectProject.onclick();const p=context.db.projects[0];assert.equal(p.learningKey,'traditional-culture');assert.equal(context.db.projects.length,1);
  context.cultureConnectProject.onclick();assert.equal(context.db.projects.length,1);context.culturePlanTime.onclick();assert.equal(element('evProject').value,p.id);assert.equal(element('evCategory').value,'project');
  const existing={id:'existing',title:'已有文化学习',status:'active'};context.db.projects.push(existing);element('cultureProjectChoice').value='existing';context.cultureConnectProject.onclick();assert.equal(C.project(context.db).id,'existing');assert.equal(p.learningKey,undefined);
});
test('culture cards validate URLs, edit in place, escape user content and promote once to linked asset',()=>{
  const{context,element}=appHarness();context.cultureConnectProject.onclick();context.openCultureRecord();
  element('cultureRecordTitle').value='<img src=x onerror=alert(1)>';element('cultureRecordText').value='观察事实与解释';element('cultureRecordDate').value='2026-10-06';element('cultureRecordEvidence').value='自己的读数';element('cultureRecordSource').value='javascript:alert(1)';
  context.cultureRecordSave.onclick();assert.equal(context.db.cultureRecords.length,0);element('cultureRecordSource').value='https://example.com/source';context.cultureRecordSave.onclick();
  const r=context.db.cultureRecords[0];assert.equal(r.projectId,context.db.projects[0].id);assert.match(element('cultureRecords').innerHTML,/&lt;img/);assert.ok(!element('cultureRecords').innerHTML.includes('<img'));
  context.openCultureRecord(r.id);element('cultureRecordTitle').value='节气观察';context.cultureRecordSave.onclick();assert.equal(context.db.cultureRecords.length,1);assert.equal(r.title,'节气观察');
  context.promoteCultureRecord(r.id,'asset');context.promoteCultureRecord(r.id,'asset');assert.equal(context.db.assets.length,1);assert.equal(context.db.assets[0].projectId,r.projectId);assert.equal(context.db.assets[0].sourceCultureRecordId,r.id);
  const box=element('cultureRecords').querySelectorAll('[data-culture-delete]')[0];box.onclick();assert.equal(context.db.cultureRecords.length,0);assert.equal(context.db.assets.length,1);
});
test('culture learning progress is explicitly reversible, source notes require refined wisdom confirmation',()=>{
  const{context,element}=appHarness();const checkbox=element('cultureWeeks').querySelectorAll('[data-culture-week]')[0];checkbox.checked=true;checkbox.onchange();assert.equal(context.db.cultureProgress[0].completed,true);checkbox.checked=false;checkbox.onchange();assert.equal(context.db.cultureProgress.length,1);assert.equal(context.db.cultureProgress[0].completed,false);
  context.openCultureRecord();element('cultureRecordTitle').value='阴阳体悟';element('cultureRecordText').value='一段需要精炼的学习记录';context.cultureRecordSave.onclick();
  element('cultureRecords').querySelectorAll('[data-culture-wisdom]')[0].onclick();assert.equal(context.db.wisdom.length,0);element('wisdomText').value='看见变化，也辨别联系的边界。';context.saveWisdomBtn.onclick();assert.equal(context.db.wisdom.length,1);assert.equal(context.db.wisdom[0].sourceCultureRecordId,context.db.cultureRecords[0].id);
  element('cultureRecords').querySelectorAll('[data-culture-wisdom]')[0].onclick();assert.equal(context.db.wisdom.length,1);
});
test('six-line construction follows bottom-to-top order, flips only moving lines and saves only after confirmation',()=>{
  const values=[6,7,8,9,7,8],lines=C.hexagram(values);assert.deepEqual(lines.map(x=>x.yang),[false,true,false,true,true,false]);assert.deepEqual(lines.map(x=>x.changedYang),[true,true,false,false,true,false]);assert.throws(()=>C.hexagram([5]));assert.throws(()=>C.hexagram([...values,6]));
  const{context,element}=appHarness();for(const n of values){element('cultureLineValue').value=String(n);context.cultureAddLine.onclick()}
  assert.equal(element('cultureAddLine').disabled,true);assert.equal(element('cultureSaveLines').disabled,false);context.cultureSaveLines.onclick();assert.equal(context.db.cultureRecords.length,0);assert.match(element('cultureRecordText').value,/6、7、8、9、7、8/);
  context.cultureRecordSave.onclick();assert.equal(context.db.cultureRecords.length,1);assert.equal(context.db.cultureRecords[0].type,'实践卡');context.cultureUndoLine.onclick();assert.equal(element('cultureSaveLines').disabled,true);
});


test('japanese optional fields preserve old sync fingerprints and merge independent imported records',()=>{
  const old=db(),n=M.normalize(old);assert.equal(M.hash(n),M.hash(old));assert.deepEqual(n.japaneseRecords,[]);assert.deepEqual(n.japaneseBackups,[]);
  const l=clone(n),r=clone(n);l.japaneseRecords.push({id:'left',title:'本机日语'});r.japaneseRecords.push({id:'right',title:'云端日语'});const merged=M.mergeData(old,l,r);assert.equal(merged.ok,true);assert.equal(merged.data.japaneseRecords.length,2);
  const h=appHarness(merged.data);h.context.replaceDB(old);assert.equal(h.context.db.japaneseRecords.length,0);
});
test('japanese import stays a draft until confirmed and repeat imports do not duplicate records',async()=>{
  const {context:c,element:e}=appHarness();assert.equal(c.db.projects.length,0);const s={schema:'finance-japanese-lab/v1',updatedAt:'2026-10-11T09:00:00Z',profile:{stage:1,minutes:75,track:'股票研究'},srs:[],progress:[],works:[],assessments:[],sessions:[{id:'a',date:'2026-10-11',stage:1,title:'实际介绍',minutes:10,skill:'听说',text:'完成一句自我介绍',evidence:'真人反馈',url:''}]};
  const select=()=>e('japaneseFile').onchange({target:{files:[{size:300,text:async()=>JSON.stringify(s)}]}});
  await select();assert.equal(c.db.japaneseRecords.length,0);assert.match(e('japanesePreviewText').textContent,/新增 1 条/);e('japaneseCancel').onclick();assert.equal(c.db.japaneseRecords.length,0);
  await select();e('japaneseConfirm').onclick();assert.equal(c.db.japaneseRecords.length,1);assert.equal(c.db.japaneseBackups.length,1);assert.equal(c.db.projects.length,0);
  await select();assert.match(e('japanesePreviewText').textContent,/相同 1 条/);e('japaneseConfirm').onclick();assert.equal(c.db.japaneseRecords.length,1);
  c.connectJapanese();const p=c.db.projects[0];c.connectJapanese();assert.equal(c.db.projects.length,1);assert.equal(c.db.japaneseRecords[0].projectId,p.id);c.renderJapanese();const b=e('japaneseRecords').querySelectorAll('[data-japanese-asset]')[0];b.onclick();b.onclick();assert.equal(c.db.assets.length,1);assert.equal(c.db.assets[0].sourceJapaneseRecordId,'japanese-sessions-a');
});
test('japanese outputs enter dated weekly reports, future records and backups are not treated as achievements',()=>{
  const d=M.normalize(db());d.japaneseRecords=[{id:'a',date:'2026-10-06',title:'数字汇报',type:'能力验收',stage:3,text:'分清百分比与百分点',evidence:'核对原始数字',feedback:'教师反馈',scores:{口语:2}},{id:'b',date:'2026-10-11',title:'未来日语'}];d.japaneseBackups=[{id:'finance-japanese-lab',state:{secret:'不是成果'}}];
  const s=M.summarize(d,'2026-10-05','2026-10-10'),md=M.markdown(d,s);assert.equal(s.japaneseRecords.length,1);assert.match(md,/核对原始数字/);assert.match(md,/教师反馈/);assert.match(md,/非标准化等级/);assert.doesNotMatch(md,/未来日语|不是成果/);
});


test('CS entry leaves records untouched until association and retains original scheduled links',()=>{
 const d=db();d.projects=[{id:'cs-old',title:'计算机深入底层机理',status:'active',goal:'结合CS 234去做'}];d.events=[{id:'session',projectId:'cs-old',category:'project',title:'学习',date:'2026-10-11',repeat:'once',start:'10:00',end:'11:00'}];
 const {context,element}=appHarness(d);assert.equal(context.db.projects[0].learningKey,undefined);assert.equal(context.db.assets.length,0);element('csProjectChoice').value='cs-old';context.connectCS();context.connectCS();assert.equal(context.db.projects.length,1);assert.equal(context.db.projects[0].id,'cs-old');assert.equal(context.db.projects[0].goal,'结合CS 234去做');assert.equal(context.db.events[0].projectId,'cs-old');assert.equal(context.db.projects[0].learningKey,'cs-foundations');
});
test('CS JSON transfer previews, confirms once, updates in place and enters weekly evidence',async()=>{
 const {context,element}=appHarness();const payload={schema:'cs-foundations-lab/v1',state:{weeklyHours:4,progress:[{id:'bytes',evidence:'独立解释',updatedAt:''}],records:[{id:'result-1',date:'2026-10-06',title:'布局对照',lesson:'cache',minutes:30,text:'相同工作量的模型结果',evidence:'16次未命中，非CPU实测',next:'本机验证',url:'https://example.com/report',updatedAt:''}]}};
 const read=()=>element('csFile').onchange({target:{files:[{size:1000,text:async()=>JSON.stringify(payload)}],value:'file'}});
 await read();assert.equal(context.db.assets.length,0);assert.equal(context.db.projects.length,0);assert.equal(element('csPreview').hidden,false);element('csConfirm').onclick();assert.equal(context.db.assets.length,1);assert.equal(context.db.projects.length,1);assert.equal(context.db.assets[0].projectId,context.db.projects[0].id);assert.equal(context.db.projects[0].learningSummary.nextMilestone,'增长率与工作量');await read();element('csConfirm').onclick();assert.equal(context.db.assets.length,1);payload.state.records[0].text='更新后的结果';await read();element('csConfirm').onclick();assert.equal(context.db.assets.length,1);assert.match(context.db.assets[0].note,/更新后的结果/);const report=M.markdown(context.db,M.summarize(context.db,'2026-10-05','2026-10-11'));assert.match(report,/布局对照/);assert.match(report,/非CPU实测/);
});

function academicFixture(){return{schema:'canvas-sjtu-snapshot/v1',source:'canvas-sjtu',timezone:'Asia/Shanghai',capturedAt:new Date().toISOString(),term:'测试学期',courses:[{id:'demo-course',canvasId:'1',code:'DEMO',name:'测试课程',sourceUrl:'https://oc.sjtu.edu.cn/courses/1',meetings:[]}],items:[{id:'demo-task',courseId:'demo-course',title:'测试作业',kind:'assignment',dueAt:'2026-10-13T23:59:00+08:00',certainty:'confirmed_assignment',submissionStatus:'not_submitted',plannerComplete:true,requirements:'PDF，完整过程'}],resources:[{id:'demo-file',courseId:'demo-course',title:'<img src=x onerror=alert(1)>.pdf',path:'教材.pdf',status:'downloaded',sourceUrl:'https://oc.sjtu.edu.cn/courses/1/files'}]};}
test('academic import preview and cancellation leave private data untouched; confirmation merges without duplicates',async()=>{
 const {context:c,element:e}=appHarness();const before=M.hash(c.db),s=academicFixture();c.prepareAcademicImport(s);assert.equal(M.hash(c.db),before);assert.match(e('academicPreviewText').textContent,/新增 3 条/);c.cancelAcademicImport();assert.equal(M.hash(c.db),before);
 c.prepareAcademicImport(s);e('academicConfirmImport').onclick();assert.equal(c.db.academicCourses.length,1);assert.equal(c.db.academicItems.length,1);assert.equal(c.db.academicRecords.length,0);
 c.db.academicItems[0].localProgress='done';c.db.academicItems[0].personalNote='自己的备注';c.prepareAcademicImport(s);e('academicConfirmImport').onclick();assert.equal(c.db.academicItems.length,1);assert.equal(c.db.academicItems[0].personalNote,'自己的备注');
 e('academicCourseFilter').value='demo-course';e('academicCourseFilter').onchange();assert.match(e('academicDetailBody').innerHTML,/&lt;img/);assert.doesNotMatch(e('academicDetailBody').innerHTML,/<img/);
 e('academicView').value='all';c.renderAcademic();assert.match(e('academicTasks').innerHTML,/平台已收到提交/);
});
test('academic planning pre-fills a draft; saved and edited time blocks retain course and assignment links',()=>{
 const {context:c,element:e}=appHarness();c.prepareAcademicImport(academicFixture());e('academicConfirmImport').onclick();c.planAcademic('demo-task');assert.equal(c.db.events.length,0);assert.equal(e('evTitle').value,'准备：测试作业');assert.equal(e('evAcademicCourse').value,'demo-course');assert.equal(e('evAcademicItem').value,'demo-task');
 c.saveEventBtn.onclick();assert.equal(c.db.events.length,1);assert.equal(c.db.events[0].academicItemId,'demo-task');c.editEvent(c.db.events[0].id);assert.equal(e('evAcademicItem').value,'demo-task');e('evTitle').value='继续做题';c.saveEventBtn.onclick();assert.equal(c.db.events.length,1);assert.equal(c.db.events[0].academicCourseId,'demo-course');
});
test('academic actual records enter weekly evidence and promote once; edits and deletion preserve independent assets',()=>{
 const {context:c,element:e}=appHarness();c.prepareAcademicImport(academicFixture());e('academicConfirmImport').onclick();c.openAcademicRecord(null,'demo-task');e('academicRecordTitle').value='独立练习';e('academicRecordText').value='解题后关掉答案重做';e('academicRecordEvidence').value='自测结果';e('academicRecordBlockers').value='符号易错';e('academicRecordMinutes').value='45';c.saveAcademicRecord();assert.equal(c.db.academicRecords.length,1);assert.equal(c.db.academicItems[0].submissionStatus,'not_submitted');
 const r=c.db.academicRecords[0],s=M.summarize(c.db,M.weekStart(r.date));assert.equal(s.academicRecords.length,1);assert.match(M.markdown(c.db,s),/符号易错/);c.promoteAcademicRecord(r.id);c.promoteAcademicRecord(r.id);assert.equal(c.db.assets.length,1);assert.equal(c.db.assets[0].sourceAcademicRecordId,r.id);
 c.openAcademicRecord(r.id);e('academicRecordText').value='修改后的记录';c.saveAcademicRecord();assert.equal(c.db.academicRecords.length,1);assert.notEqual(c.db.assets[0].note,c.db.academicRecords[0].text);
 e('academicRecords').querySelectorAll('[data-academic-delete]')[0].onclick();assert.equal(c.db.academicRecords.length,0);assert.equal(c.db.assets.length,1);
});
test('academic private-source request uses current data repo credentials only through existing GET helper and remains a preview',async()=>{
 const {context:c,element:e}=appHarness();const s=academicFixture();let calls=0;c.academicSource=s;c.getSyncConfig=()=>({branch:'main'});c.isSyncConfigured=()=>true;c.githubRequest=async route=>{calls++;assert.equal(route,'contents/data/canvas-sjtu-snapshot.json?ref=main');return{content:Buffer.from(JSON.stringify(s)).toString('base64')}};c.base64ToUtf8=value=>Buffer.from(value,'base64').toString('utf8');await c.loadPrivateAcademicSnapshot();assert.equal(calls,1);assert.equal(c.db.academicCourses.length,0);assert.match(e('academicImportStatus').textContent,/尚未写入/);
});
test('API freshness warns on partial and stale sync, and announcement markup remains inert',()=>{
 const {context:c,element:e}=appHarness();c.prepareAcademicImport(academicFixture());e('academicConfirmImport').onclick();
 const meta=c.db.academicImports[0];meta.syncMode='api';meta.lastSuccessAt=new Date(Date.now()-25*3600000).toISOString();meta.warningCount=1;meta.syncWarnings=['files: HTTP 403'];c.db.academicCourses[0].summary='<img src=x onerror=alert(1)>公告正文';
 e('academicCourseFilter').value='demo-course';e('academicCourseFilter').onchange();
 assert.match(e('academicFreshness').textContent,/API 最近成功同步/);assert.match(e('academicFreshness').textContent,/超过24小时/);assert.match(e('academicFreshness').textContent,/部分接口受限/);
 assert.match(e('academicDetailBody').innerHTML,/公告正文/);assert.match(e('academicDetailBody').innerHTML,/&lt;img/);assert.doesNotMatch(e('academicDetailBody').innerHTML,/<img/);assert.match(e('academicDetailBody').innerHTML,/files: HTTP 403/);
});
