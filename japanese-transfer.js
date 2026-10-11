/* Versioned import contract for the independent private learning app. No credentials. */
(function(root){'use strict';
const schema='finance-japanese-lab/v1';
const keys=['sessions','works','assessments'];
function text(v,max=12000){if(v==null)return '';if(typeof v!=='string'||v.length>max)throw Error('日语记录文本格式不正确');return v}
function validDate(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v}
function url(v){if(!v)return '';try{const u=new URL(v);if(['https:','http:'].includes(u.protocol)&&!u.username&&!u.password)return u.href}catch{}throw Error('日语成果链接无效')}
function parse(payload){
 const s=payload?.state||payload;if(s?.schema!==schema)throw Error('请选择金融日语研习室导出的 JSON 文件');
 if(!Number.isInteger(s.profile?.stage)||s.profile.stage<1||s.profile.stage>5)throw Error('日语阶段无效');
 const snapshot={schema,updatedAt:text(s.updatedAt,100),profile:{stage:s.profile.stage,minutes:s.profile.minutes,track:text(s.profile.track,100)}};
 if(Number.isNaN(Date.parse(snapshot.updatedAt))||![30,75,90,120].includes(snapshot.profile.minutes))throw Error('日语设置或时间无效');
 const records=[];
 for(const key of [...keys,'progress','srs']){
  if(!Array.isArray(s[key])||s[key].length>10000)throw Error('日语备份数组格式不正确');const ids=new Set();
  snapshot[key]=s[key].map(r=>{
   if(!r||typeof r.id!=='string'||!r.id||r.id.length>150||ids.has(r.id))throw Error('日语记录 ID 缺失或重复');ids.add(r.id);const value={id:r.id};
   if(key==='progress')return {...value,completed:r.completed===true};
   if(key==='srs'){if(!validDate(r.due)||!Number.isInteger(r.interval)||r.interval<1||r.interval>180||!Number.isInteger(r.reps)||r.reps<0)throw Error('日语复习记录无效');return {...value,due:r.due,interval:r.interval,reps:r.reps}}
   if(!validDate(r.date)||!Number.isInteger(r.stage)||r.stage<1||r.stage>5)throw Error('日语记录日期或阶段无效');
   Object.assign(value,{date:r.date,stage:r.stage,title:text(r.title,200),text:text(r.text),evidence:text(r.evidence,6000),url:url(text(r.url,2000))});
   if(key==='sessions'){if(!Number.isFinite(r.minutes)||r.minutes<0||r.minutes>1440)throw Error('学习分钟数无效');value.minutes=r.minutes;value.skill=text(r.skill,80)}
   if(key==='works'){value.kind=text(r.kind,80);if(!['草稿','已完成','已获反馈'].includes(r.status))throw Error('作品状态无效');value.status=r.status}
   if(key==='assessments'){value.feedback=text(r.feedback,6000);value.scores={};for(const k of ['听力','口语','阅读','写作','数字表达']){const n=r.scores?.[k];if(!Number.isInteger(n)||n<1||n>5)throw Error('日语自评分无效');value.scores[k]=n}}
   records.push({...value,id:'japanese-'+key+'-'+value.id,sourceId:value.id,type:({sessions:'训练日志',works:'作品',assessments:'能力验收'})[key]});return value;
  });
 }
 return {state:snapshot,records};
}
function preview(db,payload){const imported=parse(payload),existing=new Map((db.japaneseRecords||[]).map(x=>[x.id,x]));let added=0,changed=0,same=0;for(const r of imported.records){const old=existing.get(r.id);if(!old)added++;else if(JSON.stringify(strip(old))===JSON.stringify(strip(r)))same++;else changed++}return {...imported,added,changed,same}}
function strip(r){const {projectId,importedAt,...rest}=r;return rest}
function apply(db,prepared,projectId,stamp){
 // Validate again at the mutation boundary and recompute derived records.
 const validated=parse(prepared.state),rows=new Map((db.japaneseRecords||[]).map(x=>[x.id,x]));
 for(const r of validated.records)rows.set(r.id,{...r,projectId,importedAt:stamp});
 db.japaneseRecords=[...rows.values()];db.japaneseBackups=(db.japaneseBackups||[]).filter(x=>x.id!=='finance-japanese-lab');db.japaneseBackups.push({id:'finance-japanese-lab',state:validated.state,updatedAt:stamp});
 return validated.records.length;
}
const api={parse,preview,apply};if(typeof module==='object'&&module.exports)module.exports=api;else root.JapaneseTransfer=api;
})(globalThis);
