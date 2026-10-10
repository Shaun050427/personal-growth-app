const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const vm=require('node:vm');
const M=require('../growth-model.js');
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
  const refs=[...html.matchAll(/<script src="\.\/([^"?]+)"/g)].map(m=>m[1]);assert.deepEqual(refs,['growth-model.js','growth-ui.js']);for(const ref of refs)new vm.Script(fs.readFileSync(path.join(root,ref),'utf8'));
  new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);assert.ok(html.includes('load();initGrowth();renderAll();initialiseSync();'));
  assert.ok(!html.includes('projectStatus.value'), 'project status select must not be shadowed by the helper function');
});
function appHarness(initial=db()){
  const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8'),elements=new Map(),storage=new Map([['personalPlanner_v2',JSON.stringify(initial)]]);
  function element(id=''){
    if(id&&elements.has(id))return elements.get(id);const query=new Map(),classes=new Set();
    const e={id,value:'',textContent:'',innerHTML:'',checked:false,disabled:false,dataset:{},children:[],style:{setProperty(){}},classList:{add(...xs){xs.forEach(x=>classes.add(x))},remove(...xs){xs.forEach(x=>classes.delete(x))},toggle(x,on){if(on)classes.add(x);else classes.delete(x)},contains(x){return classes.has(x)}},
      appendChild(x){this.children.push(x);return x},querySelector(sel){if(!query.has(sel))query.set(sel,element());return query.get(sel)},querySelectorAll(){return[]},addEventListener(){},focus(){},select(){}};
    if(id)elements.set(id,e);return e;
  }
  const context={GrowthModel:M,console,Date,Math,JSON,URL,TextEncoder,TextDecoder,navigator:{},location:{protocol:'https:'},setTimeout:()=>0,setInterval:()=>0,clearTimeout(){},alert(){},confirm:()=>true,
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{getElementById:element,createElement:()=>element(),querySelectorAll:()=>[],addEventListener(){}},addEventListener(){}};
  context.window=context;for(const m of html.matchAll(/\bid="([A-Za-z][A-Za-z0-9]+)"/g))context[m[1]]=element(m[1]);
  vm.createContext(context);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../growth-ui.js'),'utf8'),context);
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
