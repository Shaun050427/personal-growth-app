(function(root){
'use strict';
function str(x,max=12000){if(typeof x!=='string'||x.length>max)throw Error('文本格式或长度不合法');return x}
function validate(payload){
 if(!payload||payload.schema!=='cs-foundations-lab/v1'||!payload.state||!Array.isArray(payload.state.records)||!Array.isArray(payload.state.progress))throw Error('不是有效的计算机实验室备份');
 const s=payload.state;if(s.records.length>2000||s.progress.length>100)throw Error('记录数量过多');const ids=new Set();
 const records=s.records.map(r=>{const id=str(r.id,100);if(!id||ids.has(id))throw Error('记录ID重复或为空');ids.add(id);const date=str(r.date,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('日期无效');const url=str(r.url||'',2000);if(url){const u=new URL(url);if(!['https:','http:'].includes(u.protocol))throw Error('成果链接必须为HTTP或HTTPS')}
 return{id,date,title:str(r.title,200),lesson:str(r.lesson||'',100),minutes:Number.isFinite(r.minutes)&&r.minutes>=0&&r.minutes<=1440?r.minutes:0,text:str(r.text),evidence:str(r.evidence),next:str(r.next||''),url,updatedAt:str(r.updatedAt||'',100)};});
 const progress=s.progress.map(p=>({id:str(p.id,100),evidence:str(p.evidence),updatedAt:str(p.updatedAt||'',100)}));if(new Set(progress.map(p=>p.id)).size!==progress.length)throw Error('验收ID重复');
 const weeklyHours=Number(s.weeklyHours);if(!Number.isFinite(weeklyHours)||weeklyHours<1||weeklyHours>40)throw Error('每周投入需为1至40小时');return{records,progress,weeklyHours};
}
function preview(db,payload){const state=validate(payload);let added=0,changed=0,same=0;for(const r of state.records){const old=(db.assets||[]).find(a=>a.id==='cs-lab-'+r.id);if(!old)added++;else if(old.note===note(r)&&old.title===r.title&&old.date===r.date&&old.url===r.url)same++;else changed++}return{state,added,changed,same}}
function note(r){return`学习主题：${r.lesson}\n投入：${r.minutes}分钟（本人记录）\n\n输出：${r.text}\n\n证据：${r.evidence}\n\n下一步：${r.next}`}
function apply(db,draft,projectId,now){for(const r of draft.state.records){const id='cs-lab-'+r.id,old=db.assets.find(a=>a.id===id),asset={id,title:r.title,date:r.date,type:'计算机科学学习成果',projectId,url:r.url,note:note(r),updatedAt:now};if(old)Object.assign(old,asset);else db.assets.push({...asset,createdAt:now})}return db}
const api={validate,preview,apply,note};if(typeof module==='object'&&module.exports)module.exports=api;else root.CSTransfer=api;
})(globalThis);
