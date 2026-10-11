/* Curriculum content is public; personal learning records live in DB only. */
(function(root){
'use strict';
const title='中华传统文化 · 12周入门';
const weeks=[
  ['认识知识地图','分清哲学、历法、象数与占筮；区分原文、诠释、可验证知识。','画出概念关系图，独立解释洛书与节气的“十五”。','概念地图 + 一张十五辨析卡'],
  ['太极与阴阳','读《系辞》太极、两仪段；理解相对、依存、消长、转化。','观察清晨、正午、傍晚的光照，区分事实与类比。','一张阴阳概念卡 + 一次观察'],
  ['五行与关系','记木火土金水及相生相克；理解不同历史语境中的解释。','画两条关系环，用一个生活例子说明促进与制约。','五行关系图 + 模型边界辨析'],
  ['天干地支与六十甲子','记十干十二支、阴阳配对、十二时辰及60步循环。','手写前12个配对，解释为何是60而非120。','干支速查卡 + 配对练习'],
  ['节气与物候','理解太阳黄经、节与中气、定气的角度划分。','选择当地两周持续观察，记录地点、光照与植物。','至少3条观察 + 地区差异说明'],
  ['八卦与卦画','记八卦的三爻结构、自然象征；从下往上读卦。','独立画八卦，并用上下卦组合解释64。','八卦速查图 + 结构说明'],
  ['读乾与坤','区分卦辞、爻辞、《易传》与后世解释。','选一条爻辞，记录原文、出处、自己的解释和疑问。','两张原文卡'],
  ['读泰与否','比较地天泰与天地否，体会传统的交通与阻隔解释。','分析一次真实沟通或决策，先写事实，再对读经典。','一张实践卡 + 一张辨析卡'],
  ['河图洛书与九宫','记河图五组数字；验证洛书幻方；区分传说与图式历史。','检查洛书8条直线与4组对宫，核对河图各组和。','河洛图 + 数学与象征辨析'],
  ['方位与罗盘','认识八方、二十四山及地理北和磁北的差异。','测一个窗户的朝向，记录仪器、环境和误差来源。','一次方位观察记录'],
  ['卜筮、六爻与三式','区分龟骨卜、蓍筮、六爻结构与纳甲；认识太乙、奇门、六壬。','用三钱法构本卦、变卦；仅比较三式变量，不求精通。','六爻构卦记录 + 三式比较卡'],
  ['总结与选方向','复述整套知识地图；检查哪些是原文、解释或观察。','整理专题笔记，选择易学义理、历法或一种术数规则深入。','一篇专题笔记 + 下一季度方向']
].map((x,i)=>({id:'culture-week-'+(i+1),week:i+1,title:x[0],study:x[1],practice:x[2],output:x[3]}));
const topics=[
  ['taiji','太极','变化观','《系辞》以“易有太极”说明两仪、四象、八卦的生成；哲学解释与卦画组合是不同层面。常见阴阳鱼图有后世演变过程。','统一与分化的思想资源；不能直接当成现代宇宙起源理论。'],
  ['yinyang','阴阳','变化观','阴阳表达相对的关系，可从对立、依存、消长、转化理解；白昼与夜晚、正午与清晨的比较尺度不同。','不是固定的善恶标签。观察光照时先记录事实，再说明自己的类比。'],
  ['wuxing','五行','变化观','木火土金水既有自然材料意象，也在后世成为分类与变化关系模型。相生：木→火→土→金→水→木；相克：木→土→水→火→金→木。','春木、夏火、秋金、冬水，土配长夏或四季过渡；不同体系有差异。'],
  ['stems','天干','时间','甲乙丙丁戊己庚辛壬癸。传统对应：甲乙木、丙丁火、戊己土、庚辛金、壬癸水；各组前阳后阴。','先掌握循环符号与纪日，再学习后世对应规则。'],
  ['branches','地支与时辰','时间','子丑寅卯辰巳午未申酉戌亥。常见现代对照：子23–01、丑01–03、寅03–05、卯05–07、辰07–09、巳09–11、午11–13、未13–15、申15–17、酉17–19、戌19–21、亥21–23。','这些是入门钟表对照；历史计时、地方太阳时与换日规则还需分开研究。'],
  ['cycle','六十甲子','时间','十干、十二支同时各前进一位，60步回到起点。甲子、乙丑、丙寅……癸亥；奇偶相配，最小公倍数lcm(10,12)=60。','不是从120种任意配对中随意取60种。纪年、纪月、纪日、纪时有各自规则。'],
  ['terms','二十四节气','时间','现代定气按太阳视黄经每15°划一节气，平均约15.22天；实际间隔不恒定。12个节与12个中气交替。','节月不等于农历初一划分的月份；当地物候也不必与名称同步。'],
  ['yi','《周易》与易学','经典与符号','以64卦卦辞、爻辞为核心的《周易》，与解释发挥它的《易传》需要区分；易学还包括义理、象数、训诂、占筮等传统。','“变易、不易、简易”是传统解释框架，应注明其历史层次。'],
  ['trigrams','八卦','经典与符号','三爻从下往上：乾☰天健、兑☱泽悦、离☲火丽明、震☳雷动、巽☴风入、坎☵水陷、艮☶山止、坤☷地顺。','两卦上下相重成64卦，每卦6爻，共384个爻位。'],
  ['tai-pi','乾坤泰否','经典与符号','先读乾、坤，再比较泰、否。泰是坤上乾下，否是乾上坤下；传统借卦象讨论交通与阻隔。','卦名、上下卦结构与解释分开记录；先写真实决策的事实，再与经典对读。'],
  ['hetu','河图','数与方位','常见图式：北1/6水、南2/7火、东3/8木、西4/9金、中5/10土；1至5称生数、6至10称成数。全部数字之和55。','五组和是7、9、11、13、15，不是每组15。古籍名称、传说与宋以后数字图式分层研究。'],
  ['luoshu','洛书与九宫','数与方位','常见九宫南上北下：4 9 2 / 3 5 7 / 8 1 6。横、竖、对角共8条直线的和都是15；对宫数和10。','1至9之和45，三行各等和，所以幻方常数45÷3=15。数学性质与传统象征解释分开。'],
  ['compass','罗盘与二十四山','数与方位','堪舆罗盘常有指南针和多层刻度。二十四山由12地支、8天干（不含戊己）、乾坤艮巽组成，每山15°。','罗盘15°是方位角；节气15°是黄经差；两者都不是“15天”。先练习测量与误差。'],
  ['divination','卜与筮','占筮传统','卜广义为占卜，狭义常指龟甲兽骨占卜；筮以蓍草等方法形成卦象。两者在方法、器物与文本传统上有区别。','先了解历史与程序，再讨论解释方式。'],
  ['six-lines','六爻与三钱法','占筮传统','六爻既指六个爻位，也常指纳甲等占法。三钱法每次三枚钱合计：6老阴变阳、7少阳不变、8少阴不变、9老阳变阴。连续6次，自下而上构卦。','硬币两面的2/3约定要事先固定；不同传承可能不同。构卦不等于已掌握纳甲断法。'],
  ['qimen','奇门遁甲','三式','将干支、节令、九宫与门、星、神等规则组织为局式；常见概念有三奇六仪、阴阳遁、九宫盘。','流派排局规则有差异，先固定教材与规则版本。'],
  ['liuren','大六壬','三式','以干支、月将、天地盘、四课三传及神将等组织推演程序。','有自己的取课取传规则，不是六爻占法的另一名称。'],
  ['taiyi','太乙','三式','以历数、宫位、神将等构建局式，历史上有军国、年运等占测用途。与奇门、大六壬合称三式。','本轮只认识模型与历史背景；进阶时选择一条主线。']
].map(x=>({id:x[0],name:x[1],layer:x[2],detail:x[3],boundary:x[4]}));
const readings=[
  ['王力《中国古代文化常识》','补历法、时间与文化制度背景',''],
  ['黄寿祺、张善文《周易译注》','卦辞、爻辞的主要对读材料',''],
  ['刘大钧《周易概论》','基础之后建立易学框架',''],
  ['朱伯崑《易学哲学史》','一年深化阶段研究思想史',''],
  ['《周易·系辞》《说卦》','原文与现代注释对读','https://ctext.org/book-of-changes/xi-ci-shang/zh'],
  ['香港天文台：二十四节气','核对黄经与历法定义','https://www.hko.gov.hk/sc/gts/time/24solarterms.htm'],
  ['山东大学：刘牧河图洛书研究','区分早期名称与后世图式','https://zhouyi.sdu.edu.cn/info/1034/1725.htm'],
  ['UNESCO：二十四节气','农业、物候与文化实践','https://ich.unesco.org/en/RL/the-twenty-four-solar-terms-knowledge-of-time-and-practices-developed-in-china-through-observation-of-the-suns-annual-motion-00647']
];
const templates={
  '概念卡':{title:'',text:'定义：\n与哪些概念有关：\n我能举出的例子：\n仍不理解的地方：',evidence:'原文、教材页码或资料链接；区分原始含义与后世解释。'},
  '原文卡':{title:'',text:'原文短句：\n出处与篇章：\n注释或译意：\n我的理解：\n问题：',evidence:'所用版本、页码与注释者；自己的解释不能冒充原文。'},
  '实践卡':{title:'',text:'时间与地点：\n方法或器材：\n亲眼观察到的事实：\n我的解释或体悟：\n误差与下一次观察：',evidence:'照片、测量读数或操作过程；分开观察事实与象征类比。'},
  '辨析卡':{title:'',text:'待辨析的说法：\n数学或观测依据：\n传统解释及出处：\n结论与边界：',evidence:'哪些可验证、哪些是传统诠释、哪些仍待考证？'}
};
function project(db){return db.projects.find(p=>p.learningKey==='traditional-culture')||db.projects.find(p=>p.title===title)}
function ensureProject(db,id,date,stamp){
  const old=project(db);if(old){if(old.learningKey!=='traditional-culture')old.learningKey='traditional-culture';return old}
  const p={id,title,learningKey:'traditional-culture',status:'active',goal:'以经典阅读、图式练习与自然观察理解中华传统文化，区分原文、后世诠释与可验证知识。',expectedOutcome:'12周完成知识地图、四类学习卡片、一篇专题笔记；一年持续积累节气观察并选一条方向深化。',budgetHours:54,budgetCost:'先使用已有书籍与公开资料',reviewDate:date,continueCondition:'能用自己的话解释概念，每周形成少量有证据的输出。',stopCondition:'若影响课程、科研与休息，减少频次或暂缓；第12周再选进阶主线。',note:'每天30–45分钟，加每周60分钟实践，12周约54–75小时；预设预算取54小时，可调整。学习单元可延长，不自动生成每日打卡。',createdAt:stamp,updatedAt:stamp};
  db.projects.push(p);return p;
}
function promote(db,record,target,id,stamp){
  const list=target==='asset'?db.assets:db.wisdom,old=list.find(x=>x.sourceCultureRecordId===record.id);if(old)return old;
  const p=project(db),link=p?.id||null;
  const value=target==='asset'?{id,title:record.title,date:record.date,type:'学习笔记',projectId:link,url:record.sourceUrl||'',note:record.text+'\n\n依据与边界：'+(record.evidence||'未填写'),sourceCultureRecordId:record.id,createdAt:stamp,updatedAt:stamp}:{id,text:record.title+'\n'+record.text,sourceCultureRecordId:record.id,createdAt:stamp,updatedAt:stamp};
  list.push(value);return value;
}
function hexagram(values){
  if(values.length>6||values.some(x=>![6,7,8,9].includes(x)))throw Error('爻值须为6、7、8或9，最多六爻');
  return values.map((value,i)=>({position:i+1,value,yang:value%2===1,moving:value===6||value===9,changedYang:value===6||value===7}));
}
const api={title,weeks,topics,readings,templates,project,ensureProject,promote,hexagram};
if(typeof module==='object'&&module.exports)module.exports=api;else root.CultureModel=api;
})(globalThis);
