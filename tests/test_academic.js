const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../academic-model.js');
const G=require('../growth-model.js');
const clone=x=>JSON.parse(JSON.stringify(x));
function db(){return G.normalize({version:2,events:[],tasks:[],done:{},courses:[],training:[],body:[],research:[],stock:[],wisdom:[],projects:[],assets:[],weeklyReviews:[]});}
function snapshot(){return{schema:A.SCHEMA,source:'canvas-sjtu',timezone:'Asia/Shanghai',capturedAt:'2026-10-12T12:00:00+08:00',term:'示例学期',courses:[{id:'course-1',canvasId:'1',code:'DEMO',name:'示例课程',sourceUrl:'https://oc.sjtu.edu.cn/courses/1',meetings:[{id:'meeting-1',name:'双周课',weekday:5,start:'16:10',end:'17:40',semesterStart:'2026-09-14',weekFrom:1,weekTo:13,weekParity:'even',excludeDates:['2026-10-01']}]}],items:[{id:'assignment-1',courseId:'course-1',title:'示例作业',kind:'assignment',dueAt:'2026-10-13T23:59:00+08:00',closesAt:'2026-10-16T23:59:00+08:00',submissionStatus:'not_submitted',certainty:'confirmed_assignment',plannerComplete:true},{id:'exam-1',courseId:'course-1',title:'暂定期中',kind:'exam',date:'2026-10-26',certainty:'tentative_syllabus',submissionStatus:'not_applicable'}],resources:[{id:'file-1',courseId:'course-1',title:'未下载资料.pdf',status:'not_downloaded',sourceUrl:'https://oc.sjtu.edu.cn/courses/1/files'}]};}
test('snapshot rejects incomplete references, duplicate IDs, unsafe URLs, invalid times and non-snapshots',()=>{
 const s=snapshot();assert.equal(A.parse(s).items[0].score,null);
 for(const mutate of [s=>s.items.push(clone(s.items[0])),s=>s.items[0].courseId='missing',s=>s.courses[0].sourceUrl='https://evil.example/courses/1',s=>s.items[0].dueAt='2026-02-30T12:00:00+08:00',s=>s.items[0].dueAt='2026-10-13T12:00:00',s=>s.resources[0].path='../secret',s=>s.courses[0].meetings[0].weekParity='sometimes',s=>s.items[0].score=-1]){const x=clone(s);mutate(x);assert.throws(()=>A.parse(x));}
 assert.throws(()=>A.parse({tasks:[]}));assert.throws(()=>A.safeUrl('javascript:alert(1)'));assert.throws(()=>A.safeUrl('https://name:secret@example.com'));assert.equal(A.validDate('2026-02-30'),false);
});
test('preview does not write, repeats update stable source IDs while preserving personal progress and unrelated data',()=>{
 const d=db();d.projects=[{id:'existing',title:'既有目标'}];d.events=[{id:'event',title:'个人日程'}];const before=clone(d),s=snapshot(),p=A.preview(d,s);assert.deepEqual(d,before);assert.equal(p.added,4);
 A.apply(d,p,'2026-10-12T05:00:00Z');assert.equal(d.courses.length,0);d.academicItems[0].localProgress='done';d.academicItems[0].personalNote='个人卡点';d.academicCourses[0].projectId='existing';d.academicRecords.push({id:'record',text:'真实学习'});
 const changed=clone(s);changed.capturedAt='2026-10-13T12:00:00+08:00';changed.items[0].dueAt='2026-10-15T23:59:00+08:00';changed.resources[0].status='downloaded';
 const p2=A.preview(d,changed);assert.equal(p2.changed,2);A.apply(d,p2,'2026-10-13T05:00:00Z');assert.equal(d.academicItems.length,2);assert.equal(d.academicResources.length,1);assert.equal(d.academicItems[0].localProgress,'done');assert.equal(d.academicItems[0].personalNote,'个人卡点');assert.equal(d.academicCourses[0].projectId,'existing');assert.equal(d.academicRecords.length,1);assert.deepEqual(d.events,before.events);assert.deepEqual(d.projects,before.projects);
 const repeat=A.preview(d,changed);assert.equal(repeat.changed,0);assert.equal(repeat.added,0);assert.throws(()=>A.apply(d,{state:s},'2026-10-13T06:00:00Z'),/早于/);
});
test('partial snapshots keep missing records; rejected imports are atomic; confirmed timetable merges once',()=>{
 const d=db(),s=snapshot();A.apply(d,A.preview(d,s,{includeMeetings:true}),'2026-10-12T05:00:00Z');assert.equal(d.courses[0].weekParity,'even');A.apply(d,A.preview(d,s,{includeMeetings:true}),'2026-10-12T06:00:00Z');assert.equal(d.courses.length,1);
 const partial=clone(s);partial.items=[];partial.resources=[];partial.capturedAt='2026-10-14T12:00:00+08:00';A.apply(d,A.preview(d,partial),'2026-10-14T05:00:00Z');assert.equal(d.academicItems.length,2);assert.equal(d.academicResources.length,1);
 const before=clone(d),invalid=clone(partial);invalid.items=[{id:'bad',courseId:'missing',kind:'assignment'}];assert.throws(()=>A.apply(d,{state:invalid},'2026-10-14T06:00:00Z'));assert.deepEqual(d,before);
});
test('Beijing two-week horizon excludes the boundary day, retains pending submission despite local completion',()=>{
 assert.equal(A.day('2026-10-12T16:00:00Z'),'2026-10-13');const d=db();A.apply(d,A.preview(d,snapshot()),'2026-10-12T05:00:00Z');d.academicItems[0].localProgress='done';
 const dash=A.dashboard(d,'2026-10-12');assert.equal(dash.end,'2026-10-25');assert.equal(dash.upcoming.length,1);assert.equal(dash.nextExam.id,'exam-1');assert.equal(A.needsAction(d.academicItems[0]),true);
 d.academicItems[0].submissionStatus='submitted_ungraded';assert.equal(A.dashboard(d,'2026-10-14').overdue.length,0);
 d.academicItems[0].submissionStatus='not_submitted';assert.equal(A.dashboard(d,'2026-10-14').overdue.length,1);
 assert.equal(A.certaintyLabel('tentative_syllabus'),'暂定');
});
test('old fingerprints and recovery stay compatible; independent course edits merge, overlapping edits conflict',()=>{
 const old=db();for(const key of A.KEYS)delete old[key];const upgraded=G.normalize(old);assert.equal(G.hash(old),G.hash(upgraded));const l=clone(upgraded),r=clone(upgraded);l.academicRecords=[{id:'a',text:'本机'}];r.academicResources=[{id:'b',title:'远端'}];const m=G.mergeData(old,l,r);assert.equal(m.ok,true);assert.equal(m.data.academicRecords.length,1);assert.equal(m.data.academicResources.length,1);
 const base=clone(upgraded);base.academicItems=[{id:'i',dueAt:'old'}];const x=clone(base),y=clone(base);x.academicItems[0].dueAt='left';y.academicItems[0].dueAt='right';assert.equal(G.mergeData(base,x,y).ok,false);assert.equal(G.normalize(old).academicItems.length,0);
});
test('weekly facts use actual dates and submission timestamps; tentative dates and planned classes are not accomplishments',()=>{
 const d=db(),s=snapshot();A.apply(d,A.preview(d,s,{includeMeetings:true}),'2026-10-12T05:00:00Z');d.academicRecords=[{id:'a',date:'2026-10-12',title:'实际错题',type:'错题',text:'独立重做',evidence:'自测通过',blockers:'符号',next:'检查单位',minutes:40},{id:'future',date:'2026-10-18',title:'未来记录',text:'不能计入'}];d.academicItems[0].submissionStatus='submitted_ungraded';d.academicItems[0].submittedAt='2026-10-12T16:30:00Z';
 const before=G.summarize(d,'2026-10-12','2026-10-12');assert.equal(before.academicSubmitted.length,0);assert.equal(before.academicRecords.length,1);
 const report=G.markdown(d,G.summarize(d,'2026-10-12','2026-10-13'));assert.match(report,/独立重做/);assert.match(report,/自测通过/);assert.match(report,/待评分/);assert.doesNotMatch(report,/未来记录/);assert.match(report,/非学习成果/);
 const odd=G.summarize(d,'2026-10-12','2026-10-18');assert.equal(odd.schedule.length,0);const even=G.summarize(d,'2026-10-19','2026-10-25');assert.equal(even.schedule.length,1);
});
test('learning records validate real dates, effort and output links without manufacturing platform submissions',()=>{
 const data={id:'record',courseId:'course-1',date:'2026-10-12',type:'错题',title:'题目',text:'独立过程',minutes:0,url:'https://example.com/output'};const r=A.record(data,null,'2026-10-12T05:00:00Z');assert.equal(r.minutes,0);assert.equal(r.submissionStatus,undefined);assert.throws(()=>A.record({...data,minutes:1500},null,'2026-10-12T05:00:00Z'));assert.throws(()=>A.record({...data,date:'2026-02-30'},null,'2026-10-12T05:00:00Z'));
});
