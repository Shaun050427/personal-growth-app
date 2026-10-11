(function(root){const data={
  "stages": [
    {
      "id": 1,
      "name": "表示与推理",
      "subtitle": "把代码、数字和机器连接起来",
      "output": "一份字节解释笔记 + 一个经过边界测试的查找程序"
    },
    {
      "id": 2,
      "name": "算法与结构",
      "subtitle": "先证明正确，再分析代价",
      "output": "带不变量、复杂度和自动测试的算法实现"
    },
    {
      "id": 3,
      "name": "执行与内存",
      "subtitle": "解释真实程序为何快或慢",
      "output": "同一工作负载的布局对照实验与实测报告"
    },
    {
      "id": 4,
      "name": "系统与存储",
      "subtitle": "理解程序如何共享资源、读写数据",
      "output": "并发正确性、故障恢复与索引实验记录"
    },
    {
      "id": 5,
      "name": "工程与迁移",
      "subtitle": "用已有项目验证学习价值",
      "output": "一件可复用作品 + 回归测试 + 有证据的复盘"
    }
  ],
  "lessons": [
    {
      "id": "bytes",
      "stage": 1,
      "title": "同一字节，两个解释",
      "algorithm": "位运算、整数范围",
      "system": "二进制、补码、字节序",
      "explain": "8位模式本身没有正负；无符号按0至255解释，补码有符号按−128至127解释。多字节数的字节序影响字节排列，不改变单个字节中的位权。Python整数与固定宽度C整数的行为不同。",
      "exercise": "用字节实验解释127、128、255；再用Python int.to_bytes和from_bytes比较大小端。",
      "question": "11111111按8位补码解释是多少？为何不是255？",
      "answer": "−1。无符号为255；按8位补码，最高位权为−128，其余位合计127。",
      "prerequisites": [],
      "lab": "bits",
      "estimated": "2–4次专注学习",
      "acceptance": "独立解释 + 完成练习 + 保存代码/结果/反馈证据"
    },
    {
      "id": "complexity",
      "stage": 1,
      "title": "增长率与工作量",
      "algorithm": "O、Ω、Θ、输入规模",
      "system": "指令、解释器开销",
      "explain": "渐近复杂度描述规模增长；常数、语言实现和数据分布仍影响实测。最坏、平均与摊还分析必须说明前提。一次快的运行不能证明复杂度。",
      "exercise": "对n=100/200/400重复排序；记录比较次数与耗时，分别观察增长。",
      "question": "为什么同为O(n log n)不代表耗时相同？",
      "answer": "O描述渐近上界；常数、访存、分配和实现层次不同，且宽松上界未必紧。",
      "prerequisites": [
        "bytes"
      ],
      "lab": "sort",
      "estimated": "2–4次专注学习",
      "acceptance": "独立解释 + 完成练习 + 保存代码/结果/反馈证据"
    },
    {
      "id": "invariants",
      "stage": 1,
      "title": "把正确性说清楚",
      "algorithm": "循环不变量、边界测试",
      "system": "断言、测试运行",
      "explain": "不变量必须在初始化、保持、终止三个环节成立。测试覆盖有限输入；证明与测试提供不同证据。先写行为规格再写代码，避免只有顺利样例。",
      "exercise": "给插入排序写不变量：每轮开始时前缀已排序；测试空数组、重复值、负数和逆序。",
      "question": "有100个测试通过，能否证明程序对所有输入正确？",
      "answer": "不能；测试只覆盖有限输入。可用性质测试补充覆盖，并用不变量论证一般情况。",
      "prerequisites": [
        "complexity"
      ],
      "lab": "sort",
      "estimated": "2–4次专注学习",
      "acceptance": "独立解释 + 完成练习 + 保存代码/结果/反馈证据"
    },
    {
      "id": "search",
      "stage": 1,
      "title": "二分查找与区间",
      "algorithm": "二分、lower_bound",
      "system": "连续数组与索引",
      "explain": "采用左闭右开区间[lo,hi)，目标是第一个不小于目标值的位置；每次严格缩短区间。随机访问是算法所依赖的模型，链表不提供相同索引成本。",
      "exercise": "独立实现lower_bound，用Python bisect_left作为测试判定器，覆盖不存在、重复和两端。",
      "question": "对链表用二分思想能否直接得到O(log n)查找？",
      "answer": "不能直接得到；定位中点要遍历，索引访问不是O(1)。",
      "prerequisites": [
        "invariants"
      ],
      "lab": "",
      "estimated": "2–4次专注学习",
      "acceptance": "独立解释 + 完成练习 + 保存代码/结果/反馈证据"
    },
    {
      "id": "arrays",
      "stage": 2,
      "title": "数组、链表与局部性",
      "algorithm": "访问、插入、删除",
      "system": "布局、指针、缓存行",
      "explain": "数组提供连续存储；链表通过指针连接，节点可能分散。链表在已知节点位置的插入可为O(1)，但寻找位置通常O(n)。Python list保存对象引用，不能等同于紧凑C整数数组。",
      "exercise": "画出引用与值的区别；对比顺序访问、列式访问和随机访问的模拟命中率。",
      "question": "链表插入O(1)的前提是什么？",
      "answer": "已知插入位置及所需节点引用；不包括寻找位置的成本。",
      "prerequisites": [
        "search"
      ],
      "lab": "cache",
      "estimated": "2–4次专注学习",
      "acceptance": "独立解释 + 完成练习 + 保存代码/结果/反馈证据"
    },
    {
      "id": "sort",
      "stage": 2,
      "title": "排序：时间、空间与稳定性",
      "algorithm": "插入、归并、分治",
      "system": "写入、分配、访问模式",
      "explain": "插入排序通常为O(n²)，近乎有序输入可更省比较；归并排序为O(n log n)，一般需要额外空间。稳定性意味着相同键保留原顺序。浏览器计数按本实验实现定义。",
      "exercise": "对同一输入逐步运行插入和归并；预测比较与写入，再观察结果。",
      "question": "归并时相等元素先取左边，和稳定性有什么关系？",
      "answer": "保留左子序列原先较早元素的位置；配合子序列稳定性使整体稳定。",
      "prerequisites": [
        "arrays"
      ],
      "lab": "sort",
      "estimated": "2–4次专注学习",
      "acceptance": "独立解释 + 完成练习 + 保存代码/结果/反馈证据"
    },
    {
      "id": "hash",
      "stage": 2,
      "title": "哈希表：均摊不等于保证",
      "algorithm": "哈希、冲突、扩容",
      "system": "容量、对象开销",
      "explain": "哈希表常见期望O(1)依赖分布与负载；严重冲突可能退化。扩容一次很贵，均摊分析把成本分配给一系列操作。不要把哈希命中当作无成本内存操作。",
      "exercise": "用链式冲突实现教学哈希表，故意选择常量哈希，记录碰撞数。",
      "question": "为什么不能把一次扩容称为O(1)？",
      "answer": "搬迁现有元素通常为O(n)；O(1)均摊描述整个操作序列的平均代价。",
      "prerequisites": [
        "sort"
      ],
      "lab": "",
      "estimated": "2–4次专注学习",
      "acceptance": "独立解释 + 完成练习 + 保存代码/结果/反馈证据"
    },
    {
      "id": "graphs",
      "stage": 2,
      "title": "图遍历与工作队列",
      "algorithm": "BFS、DFS、邻接表",
      "system": "栈、队列、存储规模",
      "explain": "邻接表下BFS和DFS为O(V+E)。BFS按层遍历，适合无权图最短路径；DFS更适合结构探索。发现时标记可避免重复入队。本实验DFS使用显式栈。",
      "exercise": "在固定图上预测BFS与DFS顺序；解释待访问容器与已发现节点的差异。",
      "question": "BFS首次发现能保证最短路需要什么前提？",
      "answer": "每条边权相同的无权图（或单位权重图），按FIFO队列逐层展开。",
      "prerequisites": [
        "hash"
      ],
      "lab": "graph",
      "estimated": "2–4次专注学习",
      "acceptance": "独立解释 + 完成练习 + 保存代码/结果/反馈证据"
    },
    {
      "id": "stack",
      "stage": 3,
      "title": "函数调用不是魔法",
      "algorithm": "递归、迭代、调用树",
      "system": "栈帧、栈深度",
      "explain": "递归会保留调用上下文；尾递归优化不能假设所有语言都提供。C与Python的调用开销不同。递归深度与算法时间复杂度是两个维度。",
      "exercise": "画归并排序n=8调用树；把DFS改成显式栈；说明额外空间。",
      "question": "递归层数O(log n)是否代表总时间O(log n)？",
      "answer": "不代表；每一层可能处理O(n)数据，例如归并排序总计O(n log n)。",
      "prerequisites": [
        "graphs"
      ],
      "lab": "",
      "estimated": "2–4次专注学习",
      "acceptance": "独立解释 + 完成练习 + 保存代码/结果/反馈证据"
    },
    {
      "id": "cache",
      "stage": 3,
      "title": "缓存：把地址变成命中率",
      "algorithm": "循环重排、分块",
      "system": "缓存行、冲突、局部性",
      "explain": "教学模拟器采用直接映射，按元素地址分块，忽略预取、多级缓存和TLB。容量与行大小共同决定驻留内容。命中率是模型结果，不能当作真实CPU计数器。",
      "exercise": "用64个元素相同集合对比行式、列式与固定种子乱序；改变行数与块大小。",
      "question": "为何容量没用满也可能反复未命中？",
      "answer": "直接映射中不同块可竞争同一槽位，造成冲突未命中。",
      "prerequisites": [
        "stack"
      ],
      "lab": "cache",
      "estimated": "2–4次专注学习",
      "acceptance": "独立解释 + 完成练习 + 保存代码/结果/反馈证据"
    },
    {
      "id": "layout",
      "stage": 3,
      "title": "真实布局的测量",
      "algorithm": "扫描、指针追逐",
      "system": "编译器、CPU、内存",
      "explain": "要隔离布局影响，保持元素集合、求和结果与访问次数相同。随机排列使后继地址难预测；真实时长还受编译器、频率和缓存状态影响。checksum用于发现错误与避免无效优化。",
      "exercise": "运行experiments/locality.c，至少5次，每次记录环境、规模、顺序；报告原始值和中位数。",
      "question": "只拿最慢顺序扫描与最快随机扫描比较是否可靠？",
      "answer": "不可靠；应统一配置、交替顺序、重复测量，并保留离散程度与异常信息。",
      "prerequisites": [
        "cache"
      ],
      "lab": "cache",
      "estimated": "2–4次专注学习",
      "acceptance": "独立解释 + 完成练习 + 保存代码/结果/反馈证据"
    },
    {
      "id": "profile",
      "stage": 3,
      "title": "先找瓶颈再优化",
      "algorithm": "基线、A/B对照",
      "system": "计时器、采样、热点",
      "explain": "总运行时间由多个阶段构成；优化非瓶颈收效有限。测量要把数据构造与核心算法分开，预热并记录多次。改变语言、数据或线程数时必须说明比较边界。",
      "exercise": "用Python cProfile检查一个Kaggle数据预处理函数；记录读取/转换/模型各自占比。",
      "question": "核心算法快一倍，为何整体可能只快一点？",
      "answer": "整体仍包含没有变化的部分；加速受被优化部分原先占比限制。",
      "prerequisites": [
        "layout"
      ],
      "lab": "",
      "estimated": "2–4次专注学习",
      "acceptance": "独立解释 + 完成练习 + 保存代码/结果/反馈证据"
    },
    {
      "id": "process",
      "stage": 4,
      "title": "进程、线程与任务",
      "algorithm": "并发、工作划分",
      "system": "地址空间、调度、GIL",
      "explain": "进程有独立地址空间；线程共享所在进程的内存。并发不保证并行。Python运行时版本、扩展是否释放GIL与工作负载会改变并行选择。",
      "exercise": "对CPU计算和文件读取分别设计线程/进程实验；先预测开销与共享方式。",
      "question": "为什么多个线程不一定加速CPU工作？",
      "answer": "受运行时锁、调度开销、核数与内存带宽限制；需明确执行环境和负载。",
      "prerequisites": [
        "profile"
      ],
      "lab": "",
      "estimated": "2–4次专注学习",
      "acceptance": "独立解释 + 完成练习 + 保存代码/结果/反馈证据"
    },
    {
      "id": "locks",
      "stage": 4,
      "title": "竞争条件与原子性",
      "algorithm": "临界区、生产消费",
      "system": "锁、原子操作、死锁",
      "explain": "读取、修改、写回是多步操作；多个执行流可交错。锁保护共享不变量，必须讨论获取顺序与异常释放。不要用Python单次运行结果推断所有系统的原子性。",
      "exercise": "用C线程或明确分步的模拟器演示丢失更新；加锁后重复验证总数。",
      "question": "两个线程同时执行x=x+1为什么可能只增加1？",
      "answer": "两个执行流可能读到相同旧值并各自写回同一个新值。",
      "prerequisites": [
        "process"
      ],
      "lab": "",
      "estimated": "2–4次专注学习",
      "acceptance": "独立解释 + 完成练习 + 保存代码/结果/反馈证据"
    },
    {
      "id": "storage",
      "stage": 4,
      "title": "虚拟内存与磁盘I/O",
      "algorithm": "分块、外部排序",
      "system": "页、文件、工作集",
      "explain": "虚拟地址由系统映射到物理资源。页错误不一定代表磁盘访问；文件缓存也会改变读写测量。外部排序先生成有序段再多路归并，以适应有限内存。",
      "exercise": "设计无法整体放入内存的排序方案；标注段大小、归并路数与I/O次数。",
      "question": "为何第二次读相同文件通常更快，但不能保证？",
      "answer": "可能命中文件缓存；也受工作集、系统负载、存储设备和缓存淘汰影响。",
      "prerequisites": [
        "locks"
      ],
      "lab": "",
      "estimated": "2–4次专注学习",
      "acceptance": "独立解释 + 完成练习 + 保存代码/结果/反馈证据"
    },
    {
      "id": "index",
      "stage": 4,
      "title": "索引与查询的代价",
      "algorithm": "二叉树、B+树、选择率",
      "system": "磁盘页、数据库计划",
      "explain": "索引在查找与更新之间折中。B+树以页为节点降低树高；低选择率查询未必用索引更快。SQLite EXPLAIN QUERY PLAN展示选择的计划，耗时还需要单独测量。",
      "exercise": "用SQLite生成数据；在相同查询上建立索引前后查看计划并重复计时。",
      "question": "为每列都建索引一定好吗？",
      "answer": "否；索引占存储、增加写入维护成本，是否有收益取决于实际查询。",
      "prerequisites": [
        "storage"
      ],
      "lab": "",
      "estimated": "2–4次专注学习",
      "acceptance": "独立解释 + 完成练习 + 保存代码/结果/反馈证据"
    },
    {
      "id": "kaggle",
      "stage": 5,
      "title": "作品一：竞赛数据流水线",
      "algorithm": "批处理、缓存键、去重",
      "system": "文件读取、内存峰值",
      "explain": "先固定数据子集、输出规格和现有基线，再优化。速度提升必须同时保证标签、顺序和训练分组没有变化。不能用提速推断预测精度或榜单得分。",
      "exercise": "选择一段实际竞赛读取流程，交付输出一致性测试、耗时分布和峰值内存报告。",
      "question": "为什么换缓存格式后仍要核对输出？",
      "answer": "格式、精度、顺序或标签映射可能改变；必须验证语义一致。",
      "prerequisites": [
        "index"
      ],
      "lab": "",
      "estimated": "2–4次专注学习",
      "acceptance": "独立解释 + 完成练习 + 保存代码/结果/反馈证据"
    },
    {
      "id": "growth",
      "stage": 5,
      "title": "作品二：成长系统数据安全",
      "algorithm": "三方合并、幂等导入",
      "system": "版本、持久化、并发",
      "explain": "同步与导入需要明确记录身份；重试不能重复创建。三方合并用共同基线区别双方变化，对重叠修改返回冲突。测试应覆盖真实数据分支与恢复流程。",
      "exercise": "给成果导入加入重复导入与修改同一ID的测试；画本地、基线、远端关系。",
      "question": "幂等导入的验收例子是什么？",
      "answer": "相同文件导入两次，记录数量与内容不增加不变化；相同ID新版本按规定更新。",
      "prerequisites": [
        "kaggle"
      ],
      "lab": "",
      "estimated": "2–4次专注学习",
      "acceptance": "独立解释 + 完成练习 + 保存代码/结果/反馈证据"
    },
    {
      "id": "market",
      "stage": 5,
      "title": "作品三：行情复盘数据工具",
      "algorithm": "滚动窗口、聚合、索引",
      "system": "时序存储、计算预算",
      "explain": "明确交易日、时间区间与字段含义，再设计聚合。只用公开或获授权数据。系统实验验证数据处理正确性与效率，不宣称收益提升。",
      "exercise": "用合成行情实现窗口统计；覆盖停牌/缺失/非交易日与输入乱序。",
      "question": "滚动窗口中缺失一天能否直接当作零收益？",
      "answer": "不能；先定义缺失的业务含义，再决定排除、补齐或单独标记。",
      "prerequisites": [
        "growth"
      ],
      "lab": "",
      "estimated": "2–4次专注学习",
      "acceptance": "独立解释 + 完成练习 + 保存代码/结果/反馈证据"
    },
    {
      "id": "review",
      "stage": 5,
      "title": "毕业作品与独立复盘",
      "algorithm": "回归、复现、技术说明",
      "system": "环境、版本、可维护性",
      "explain": "可复用资产应包含动机、规格、复现指令、真实结果和局限。AI适合检查推理与提出反例；最终能力用自己解释、修改与独立实现来验证。",
      "exercise": "交付一件上述作品，别人按README可运行；独立讲解10分钟并记录质疑与改进。",
      "question": "AI生成代码通过测试是否等于自己掌握？",
      "answer": "不等于；还应独立解释不变量、修改需求、定位错误并复现实验。",
      "prerequisites": [
        "market"
      ],
      "lab": "",
      "estimated": "2–4次专注学习",
      "acceptance": "独立解释 + 完成练习 + 保存代码/结果/反馈证据"
    }
  ],
  "references": [
    {
      "name": "MIT 6.006 · 算法课程",
      "url": "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/",
      "use": "先补Python与离散数学基础，再选对应数据结构、证明与算法章节。"
    },
    {
      "name": "CMU 15-213 · 计算机系统",
      "url": "https://www.cs.cmu.edu/~213/index.html",
      "use": "C基础扎实后学习表示、机器代码、内存与系统章节；遵守课程作业政策。"
    },
    {
      "name": "Python timeit · 测量方法",
      "url": "https://docs.python.org/3/library/timeit.html",
      "use": "核对计时、重复测量和测量开销；不要仅报一个最快值。"
    },
    {
      "name": "SQLite · 查询计划",
      "url": "https://www.sqlite.org/eqp.html",
      "use": "在索引实验中观察实际查询计划。"
    }
  ]
};if(typeof module==="object"&&module.exports)module.exports=data;else root.CSCurriculum=data;})(globalThis);
