/* Independent Yi Learning Lab bridge. No token or private database leaves this page. */
(function(root){
  'use strict';
  const APP_URL='https://shaun050427.github.io/yi-learning-lab/';
  const APP_ORIGIN=new URL(APP_URL).origin;
  const TYPES={schema:'yi-learning-summary/v1'};
  function validDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;}
  function validateSummary(value){
    if(!value||typeof value!=='object'||value.schema!==TYPES.schema||!validDate(value.start)||!validDate(value.end)||value.start>value.end||typeof value.text!=='string'||!value.text.trim()||value.text.length>16000)throw Error('学习摘要格式不正确');
    const keys=['attempts','correct','readings','notes','practice'];
    if(!value.counts||keys.some(k=>!Number.isSafeInteger(value.counts[k])||value.counts[k]<0||value.counts[k]>1000000)||value.counts.correct>value.counts.attempts)throw Error('学习摘要统计无效');
    return {schema:TYPES.schema,start:value.start,end:value.end,text:value.text,counts:Object.fromEntries(keys.map(k=>[k,value.counts[k]]))};
  }
  function recordId(summary){let h=2166136261;const s=JSON.stringify(summary);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return `yi-summary-${summary.start}-${summary.end}-${(h>>>0).toString(16)}`;}
  const api={validateSummary,recordId,APP_URL,APP_ORIGIN};
  if(typeof module==='object'&&module.exports){module.exports=api;return;}root.YiIntegration=api;
  window.addEventListener('DOMContentLoaded',()=>{
    const el=id=>document.getElementById(id),frame=el('yiLabFrame');if(!frame)return;
    let pending=null;
    const status=s=>{el('yiLabStatus').textContent=s;};
    function preview(raw){try{pending=validateSummary(raw);el('yiSummaryPreview').textContent=pending.text;el('yiSummaryPanel').classList.remove('hide');status('学习摘要已收到，请预览后保存。');}catch(e){status(e.message);}}
    el('yiLabFull').href=APP_URL;
    el('yiLabOpen').onclick=()=>{if(!frame.getAttribute('src'))frame.src=APP_URL+'?embed=1#home';frame.classList.remove('hide');el('yiLabClose').classList.remove('hide');status('已打开独立研习室。若内嵌无法显示，可使用全屏入口。');};
    el('yiLabClose').onclick=()=>{frame.classList.add('hide');el('yiLabClose').classList.add('hide');};
    window.addEventListener('message',event=>{
      if(event.origin!==APP_ORIGIN||event.source!==frame.contentWindow||event.data?.type!=='yi-learning:summary')return;
      preview(event.data.payload);
    });
    el('yiSummaryImport').onclick=()=>el('yiSummaryFile').click();
    el('yiSummaryFile').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>100000)throw Error('摘要文件过大，请导入研习室导出的摘要JSON。');preview(JSON.parse(await file.text()));}catch(e){status('摘要导入未完成：'+e.message);}finally{event.target.value='';}};
    el('yiSummaryCancel').onclick=()=>{pending=null;el('yiSummaryPanel').classList.add('hide');status('预览已关闭，未写入学习记录。');};
    el('yiSummarySave').onclick=()=>{
      if(!pending)return;const value=validateSummary(pending),rid=recordId(value);
      if(DB.cultureRecords.some(r=>r.id===rid)){status('这份摘要已保存，不会重复加入。');return;}
      const now=new Date().toISOString();
      const record={id:rid,title:`易学研习室学习摘要 · ${value.start}—${value.end}`,text:value.text,type:'实践卡',topic:'six-lines',week:null,date:fmtDate(new Date()),sourcePeriodStart:value.start,sourcePeriodEnd:value.end,projectId:CultureModel.project(DB)?.id||null,sourceUrl:APP_URL,evidence:'由独立研习室的实际学习记录汇总；统计不是独立能力认证。摘要保存日期归入成长系统复盘，原学习区间保留在内容中。',createdAt:now,updatedAt:now};
      DB.cultureRecords.push(record);
      try{save();}catch(e){DB.cultureRecords=DB.cultureRecords.filter(r=>r.id!==rid);status('保存未完成：'+e.message);return;}
      pending=null;el('yiSummaryPanel').classList.add('hide');renderAll();status('摘要已加入传统文化学习记录，保存日期所属周的复盘会汇总它。');
    };
  });
})(globalThis);
