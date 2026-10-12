/* Course snapshots, personal learning and read-only platform facts. */
(function(root){
'use strict';
const SCHEMA='canvas-sjtu-snapshot/v1';
const KEYS=['academicCourses','academicItems','academicResources','academicRecords','academicImports'];
const kinds=['assignment','exam','practice','recitation','optional_event','optional_registration','optional_administrative'];
const statuses=['not_submitted','submitted_ungraded','graded','not_applicable','unknown'];
const certainties=['confirmed_assignment','confirmed_announcement','confirmed_submission','tentative_syllabus','inferred_from_recurring_schedule','announcement_time_typo','unspecified'];
function text(value,max=12000){if(value==null)return '';if(typeof value!=='string'||value.length>max)throw Error('课程文本格式或长度不正确');return value;}
function id(value){const s=text(value,240);if(!s||!/^[-\w.:/]+$/.test(s))throw Error('课程记录 ID 无效');return s;}
function validDate(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;}
function stamp(v){if(v==null||v==='')return null;const s=text(v,80);const m=s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/);if(!m||!validDate(m[1])||+m[2]>23||+m[3]>59||+(m[4]||0)>59||Number.isNaN(Date.parse(s)))throw Error('课程时间必须是带时区的有效时间');return s;}
function day(value){if(!value)return '';if(validDate(value))return value;const n=Date.parse(value);return Number.isNaN(n)?'':new Date(n+8*3600000).toISOString().slice(0,10);}
function today(){return day(new Date().toISOString());}
function addDays(value,n){return new Date(Date.parse(value+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);}
function safeUrl(v,canvasOnly=false){if(!v)return '';try{const u=new URL(text(v,2000));if(!['https:','http:'].includes(u.protocol)||u.username||u.password||(canvasOnly&&u.origin!=='https://oc.sjtu.edu.cn'))throw Error();return u.href;}catch{throw Error(canvasOnly?'课程来源必须是交大 Canvas HTTPS 页面':'学习资料链接需为 HTTP / HTTPS 地址');}}
function number(v,max=100000){if(v==null)return null;if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>max)throw Error('课程数值无效');return v;}
function rows(list,name,max=20000){if(!Array.isArray(list)||list.length>max)throw Error(name+'列表无效或过大');const seen=new Set();return list.map(r=>{if(!r||typeof r!=='object'||Array.isArray(r))throw Error(name+'记录无效');const key=id(r.id);if(seen.has(key))throw Error(name+' ID 重复');seen.add(key);return r;});}
function meeting(r,courseId){
 const clock=v=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
 if(!Number.isInteger(r.weekday)||r.weekday<0||r.weekday>6||!clock(r.start)||!clock(r.end)||r.start>=r.end||!validDate(r.semesterStart)||!Number.isInteger(r.weekFrom)||!Number.isInteger(r.weekTo)||r.weekFrom<1||r.weekTo<r.weekFrom||r.weekTo>60)throw Error('课表时间或周次无效');
 const parity=r.weekParity||'all';if(!['all','odd','even'].includes(parity))throw Error('单双周无效');
 const excluded=r.excludeDates||[];if(!Array.isArray(excluded)||excluded.length>100||excluded.some(x=>!validDate(x)))throw Error('课表例外日期无效');
 return{id:id(r.id),academicCourseId:courseId,name:text(r.name,200),weekday:r.weekday,start:r.start,end:r.end,semesterStart:r.semesterStart,weekFrom:r.weekFrom,weekTo:r.weekTo,weekParity:parity,excludeDates:[...excluded],location:text(r.location,200),note:text(r.note,2000),source:'canvas-sjtu'};
}
function parse(payload){
 if(payload?.schema!==SCHEMA||payload.source!=='canvas-sjtu'||payload.timezone!=='Asia/Shanghai')throw Error('请选择交大 Canvas 课程快照，不要使用完整备份导入入口');
 const capturedAt=stamp(payload.capturedAt);if(!capturedAt)throw Error('课程快照缺少采集时间');
 const courses=rows(payload.courses,'课程',100).map(r=>({id:id(r.id),canvasId:text(r.canvasId,40),code:text(r.code,80),name:text(r.name,200),term:text(r.term,100),teacher:text(r.teacher,300),grading:text(r.grading,3000),examPolicy:text(r.examPolicy,3000),summary:text(r.summary),knowledge:text(r.knowledge),studyAdvice:text(r.studyAdvice),sourceUrl:safeUrl(r.sourceUrl,true),meetings:rows(r.meetings||[],'课表',30).map(m=>meeting(m,r.id))}));
 const courseIds=new Set(courses.map(c=>c.id));
 const courseRef=v=>{const s=id(v);if(!courseIds.has(s))throw Error('任务或资料关联的课程不存在');return s;};
 const items=rows(payload.items,'任务').map(r=>{
  if(!kinds.includes(r.kind))throw Error('课程任务类型无效');const status=r.submissionStatus||'unknown';if(!statuses.includes(status))throw Error('平台提交状态无效');const certainty=r.certainty||'unspecified';if(!certainties.includes(certainty))throw Error('确认程度无效');
  if(r.date!=null&&!validDate(r.date))throw Error('课程任务日期无效');
  return{id:id(r.id),courseId:courseRef(r.courseId),title:text(r.title,200),kind:r.kind,dueAt:stamp(r.dueAt),closesAt:stamp(r.closesAt),startsAt:stamp(r.startsAt),endsAt:stamp(r.endsAt),date:r.date||null,dateText:text(r.dateText,200),certainty,submissionStatus:status,submittedAt:stamp(r.submittedAt),gradedAt:stamp(r.gradedAt),score:number(r.score),pointsPossible:number(r.pointsPossible),weightPercent:number(r.weightPercent,100),requirements:text(r.requirements),sourceUrl:safeUrl(r.sourceUrl,true),location:text(r.location,200),plannerComplete:r.plannerComplete===true};
 });
 const resources=rows(payload.resources,'资料').map(r=>{
  if(!['downloaded','not_downloaded','index_only'].includes(r.status))throw Error('资料下载状态无效');const path=text(r.path,2000);if(path&&(path.startsWith('/')||path.split(/[\\/]/).includes('..')))throw Error('资料路径无效');
  return{id:id(r.id),courseId:courseRef(r.courseId),title:text(r.title,300),folder:text(r.folder,200),path,status:r.status,sourceUrl:safeUrl(r.sourceUrl,true),pages:number(r.pages),sizeBytes:number(r.sizeBytes,2e9),sha256:text(r.sha256,64)};
 });
 if(courses.some(x=>!x.name.trim())||items.some(x=>!x.title.trim())||resources.some(x=>!x.title.trim()))throw Error('课程、任务及资料标题不能为空');
 return{schema:SCHEMA,source:'canvas-sjtu',timezone:'Asia/Shanghai',capturedAt,term:text(payload.term,100),notes:text(payload.notes),courses,items,resources};
}
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
function equal(a,b){return JSON.stringify(canonical(a))===JSON.stringify(canonical(b));}
function preview(db,payload,{includeMeetings=false}={}){
 const state=parse(payload),last=(db.academicImports||[]).find(x=>x.id==='canvas-sjtu');if(last&&Date.parse(last.capturedAt)>Date.parse(state.capturedAt))throw Error('这份快照早于已导入版本，请使用较新的课程快照');
 const changes=[];for(const [key,values] of [['academicCourses',state.courses],['academicItems',state.items],['academicResources',state.resources]]){
  const old=new Map((db[key]||[]).map(x=>[x.id,x]));for(const r of values){const before=old.get(r.id);const changedFields=before?Object.keys(r).filter(k=>!equal(before[k],r[k])):[];changes.push({key,id:r.id,title:r.title||r.name,status:!before?'added':changedFields.length?'changed':'same',changedFields,before:before||null,after:r});}
 }
 if(includeMeetings)for(const c of state.courses)for(const r of c.meetings){const old=(db.courses||[]).find(x=>x.id===r.id);changes.push({key:'courses',id:r.id,title:r.name,status:!old?'added':equal(old,r)?'same':'changed',changedFields:old?Object.keys(r).filter(k=>!equal(old[k],r[k])):[],before:old||null,after:r});}
 return{state,includeMeetings,changes,added:changes.filter(x=>x.status==='added').length,changed:changes.filter(x=>x.status==='changed').length,same:changes.filter(x=>x.status==='same').length};
}
function apply(db,prepared,importedAt){
 const p=preview(db,prepared.state,{includeMeetings:prepared.includeMeetings});const time=stamp(importedAt);if(!time)throw Error('导入时间无效');
 const updated={};for(const key of KEYS)updated[key]=[...(db[key]||[])];updated.courses=[...(db.courses||[])];
 for(const key of ['academicCourses','academicItems','academicResources','courses']){
  const map=new Map(updated[key].map(x=>[x.id,x]));for(const c of p.changes.filter(x=>x.key===key))map.set(c.id,{...map.get(c.id),...c.after});updated[key]=[...map.values()];
 }
 const meta={id:'canvas-sjtu',capturedAt:p.state.capturedAt,importedAt:time,term:p.state.term,notes:p.state.notes};updated.academicImports=updated.academicImports.filter(x=>x.id!==meta.id).concat(meta);Object.assign(db,updated);return p;
}
function when(item){return item.dueAt||item.startsAt||item.date||'';}
function isSubmitted(item){return ['submitted_ungraded','graded'].includes(item.submissionStatus);}
function needsAction(item){if(item.kind==='assignment')return !isSubmitted(item);if(item.kind==='exam')return true;return item.localProgress!=='done';}
function dashboard(db,date=today()){
 const end=addDays(date,13),all=[...(db.academicItems||[])].sort((a,b)=>when(a).localeCompare(when(b))||a.title.localeCompare(b.title));
 return{date,end,upcoming:all.filter(x=>needsAction(x)&&day(when(x))>=date&&day(when(x))<=end),overdue:all.filter(x=>x.kind==='assignment'&&needsAction(x)&&day(x.dueAt)&&day(x.dueAt)<date),undated:all.filter(x=>needsAction(x)&&!when(x)),nextExam:all.find(x=>x.kind==='exam'&&day(when(x))>=date)||null};
}
function dateTime(value){if(!value)return '日期待确认';if(validDate(value))return value;return new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}
function certaintyLabel(v){return ({tentative_syllabus:'暂定',inferred_from_recurring_schedule:'按常规推列',announcement_time_typo:'时间待核对',unspecified:'未确认'})[v]||'已核实';}
function submissionLabel(r){return({not_submitted:'快照未见提交',submitted_ungraded:'已提交，待评分',graded:'已评分',not_applicable:'不要求平台提交',unknown:'提交情况未知'})[r.submissionStatus]||'提交情况未知';}
function record(data,existing,now){
 if(!validDate(data.date)||!text(data.title,200).trim()||!text(data.text).trim())throw Error('请填写有效的学习日期、标题与实际输出');
 if(!['学习','错题','实验','复盘','作品'].includes(data.type))throw Error('学习记录类型无效');const minutes=number(data.minutes,1440)||0;
 return{id:existing?.id||id(data.id),courseId:id(data.courseId),itemId:data.itemId?id(data.itemId):null,date:data.date,type:data.type,title:data.title.trim(),text:data.text.trim(),minutes,evidence:text(data.evidence,6000),blockers:text(data.blockers,6000),next:text(data.next,6000),url:safeUrl(data.url),createdAt:existing?.createdAt||stamp(now),updatedAt:stamp(now)};
}
const api={SCHEMA,KEYS,parse,preview,apply,day,today,addDays,when,isSubmitted,needsAction,dashboard,dateTime,certaintyLabel,submissionLabel,record,safeUrl,validDate};
if(typeof module==='object'&&module.exports)module.exports=api;else root.AcademicModel=api;
})(globalThis);
