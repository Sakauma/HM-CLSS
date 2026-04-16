/**
 * 深空酒馆模块。
 * 负责把情绪文本分析为风味画像，再映射成酒单配方、结果卡片和历史酒柜视图。
 */

const MAX_MOOD_CHARS = 50;

// 输入区的示例文案，用于快速生成一条可分析的情绪样本。
const tavernSuggestionTexts = [
    '今天有点累，但其实还想再推进一点。',
    '刚把一件难事做完，整个人像终于松了一口气。',
    '我现在脑子很热，像有很多事一起扑过来。',
    '今晚想慢下来，最好连心跳都跟着轻一点。',
    '论文、代码和实验都卡住了，但我不想认输。',
    '明明有一点期待，可身体还是比脑子更想躺下。'
];

// 不同情绪家族的展示文案、舞台标签和配色方案。
const familyMeta = {
    bright: {
        label: 'Bright / 明亮',
        badge: 'Bright Signature',
        display: '明亮推进',
        stage: 'CITRUS LIFT',
        palette: ['#f7cb71', '#f79d65', '#f16d6f'],
        feel: 'Lifted / 提振'
    },
    calm: {
        label: 'Calm / 回稳',
        badge: 'Calm Signature',
        display: '静稳回落',
        stage: 'SOFT RESET',
        palette: ['#9dd5c0', '#74b4c8', '#7d8fcd'],
        feel: 'Settled / 回稳'
    },
    deep: {
        label: 'Deep / 深色',
        badge: 'Deep Signature',
        display: '深色下潜',
        stage: 'LOW TIDE',
        palette: ['#77639d', '#4d486f', '#24344f'],
        feel: 'Low Tide / 下沉'
    },
    focus: {
        label: 'Focus / 锁定',
        badge: 'Focus Signature',
        display: '专注锁定',
        stage: 'QUIET LOCK',
        palette: ['#78bbff', '#4e8cf3', '#345cba'],
        feel: 'Locked / 锁定'
    },
    storm: {
        label: 'Storm / 风暴',
        badge: 'Storm Signature',
        display: '过载风暴',
        stage: 'STATIC SPIKE',
        palette: ['#ff9a74', '#ff6a5f', '#8c4d90'],
        feel: 'Crackling / 过载'
    },
    tender: {
        label: 'Tender / 柔和',
        badge: 'Tender Signature',
        display: '柔软缓释',
        stage: 'WARM COMFORT',
        palette: ['#f4c6c1', '#ebb38a', '#d79ba4'],
        feel: 'Softened / 松软'
    },
    nocturne: {
        label: 'Nocturne / 夜航',
        badge: 'Nocturne Signature',
        display: '夜间巡航',
        stage: 'NIGHT SHIFT',
        palette: ['#8b7ab8', '#50648d', '#19263d'],
        feel: 'Night Shift / 夜航'
    },
    cosmic: {
        label: 'Cosmic / 彩蛋',
        badge: 'Easter Egg',
        display: '深空彩蛋',
        stage: 'SECRET POUR',
        palette: ['#8fd2ff', '#6e8bff', '#f4b76b'],
        feel: 'Unexpected / 意外命中'
    }
};

// 关键词词典：把自然语言线索映射到情绪家族、正负倾向和强度。
const moodLexicon = [
    { keywords: ['开心', '高兴', '轻松', '顺利', '兴奋', '期待', '放晴', '舒服', '舒服点'], family: 'bright', valence: 0.55, intensity: 0.28 },
    { keywords: ['松一口气', '平静', '安静', '稳住', '安心', '放松', '回稳', '缓一缓'], family: 'calm', valence: 0.28, intensity: 0.12 },
    { keywords: ['累', '疲惫', '低落', '空', '孤独', '难过', '压抑', '迷茫', '失落'], family: 'deep', valence: -0.52, intensity: 0.08 },
    { keywords: ['焦虑', '紧张', '烦', '爆炸', '崩', '压力', '赶', 'ddl', '截止', '慌', '头大'], family: 'storm', valence: -0.48, intensity: 0.46 },
    { keywords: ['代码', '调试', '实现', '构建', '论文', '实验', '科研', '数据', '专注', '任务'], family: 'focus', valence: 0.08, intensity: 0.3 },
    { keywords: ['温柔', '治愈', '拥抱', '陪伴', '回家', '想休息', '被接住', '想被抱'], family: 'tender', valence: 0.34, intensity: 0.1 },
    { keywords: ['夜里', '凌晨', '失眠', '睡不着', '困', '咖啡', '熬夜', '晚班'], family: 'nocturne', valence: -0.18, intensity: 0.18 },
    { keywords: ['太阳', '地球', '洛基', 'rocky', 'hm-clss', 'hail mary', '挽救计划', '噬星体', '水基'], family: 'cosmic', valence: 0.12, intensity: 0.34 }
];

// 常规酒单，按情绪家族分组。
const familyRecipes = {
    bright: [
        { id: 'solar-paloma', name: '日冕帕洛玛', en: 'Solar Paloma', style: 'Paloma', base: '日晒龙舌兰', glass: 'Highball', garnish: '葡萄柚皮与海盐', top: '葡萄柚皮', middle: '橙花', bottom: '海盐', quote: '适合在重新看见希望时，给自己一点气泡。 ', intensity: [0.32, 0.92] },
        { id: 'comet-spritz', name: '彗尾轻雾', en: 'Comet Spritz', style: 'Spritz', base: '苦橙开胃酒', glass: 'Wine Glass', garnish: '青橙轮片', top: '青橙', middle: '白葡萄', bottom: '草本苦味', quote: '像消息终于回来的那一下轻响。', intensity: [0.28, 0.8] },
        { id: 'helios-collins', name: '赫利俄斯柯林斯', en: 'Helios Collins', style: 'Collins', base: '柑橘琴酒', glass: 'Collins', garnish: '柠檬皮与百里香', top: '柠檬皮', middle: '百里香', bottom: '杜松', quote: '让心情从阴影里抬头，但不过分喧闹。', intensity: [0.25, 0.76] },
        { id: 'lime-dock-fizz', name: '青柠船坞', en: 'Lime Dock Fizz', style: 'Fizz', base: '轻型朗姆', glass: 'Fizz Glass', garnish: '青柠角', top: '青柠', middle: '糖浆泡沫', bottom: '白朗姆', quote: '像终于靠岸的那一下，既轻也稳。', intensity: [0.2, 0.72] },
        { id: 'orchard-highball', name: '果园高球', en: 'Orchard Highball', style: 'Highball', base: '苹果威士忌', glass: 'Highball', garnish: '青苹果薄片', top: '青苹果', middle: '苏打', bottom: '淡麦芽', quote: '高球该有的清爽，适合还想继续推进的时候。', intensity: [0.22, 0.7] },
        { id: 'apricot-swizzle', name: '杏光回旋', en: 'Apricot Swizzle', style: 'Swizzle', base: '杏桃白兰地', glass: 'Swizzle', garnish: '碎冰与橙花', top: '杏桃', middle: '橙花', bottom: '香草糖', quote: '当快乐还没彻底站稳时，它给你一层柔光。', intensity: [0.38, 0.88] },
        { id: 'aurora-smash', name: '极光罗勒', en: 'Aurora Basil Smash', style: 'Smash', base: '新鲜金酒', glass: 'Old Fashioned', garnish: '罗勒叶', top: '罗勒', middle: '黄柠檬', bottom: '杜松', quote: '很适合那种想把疲惫一把揉碎的瞬间。', intensity: [0.36, 0.84] }
    ],
    calm: [
        { id: 'sea-glass-martini', name: '海玻璃马天尼', en: 'Sea Glass Martini', style: 'Martini', base: '海盐琴酒', glass: 'Martini', garnish: '海盐雾', top: '海盐', middle: '黄瓜皮', bottom: '杜松', quote: '一口就能听见噪音慢下来的那种酒。', intensity: [0.12, 0.58] },
        { id: 'moon-bamboo', name: '月影竹调', en: 'Moon Bamboo', style: 'Bamboo', base: '干型雪莉', glass: 'Nick & Nora', garnish: '柚皮油', top: '柚皮', middle: '草本酒', bottom: '雪莉', quote: '更像一盏夜灯，不像一束探照灯。', intensity: [0.08, 0.42] },
        { id: 'jasmine-cobbler', name: '茉白冰卵石', en: 'Jasmine Cobbler', style: 'Cobbler', base: '茉莉清酒', glass: 'Cobbler', garnish: '茉莉花', top: '茉莉', middle: '白桃', bottom: '清酒', quote: '适合把心绪往下放，而不是往外甩。', intensity: [0.1, 0.44] },
        { id: 'quiet-rickey', name: '静潮瑞奇', en: 'Quiet Tidal Rickey', style: 'Rickey', base: '青柠金酒', glass: 'Rickey', garnish: '青柠皮', top: '青柠', middle: '苏打', bottom: '薄荷', quote: '把混乱降噪到还能听见自己的程度。', intensity: [0.18, 0.52] },
        { id: 'alpine-cooler', name: '高山冷泡', en: 'Alpine Tea Cooler', style: 'Cooler', base: '乌龙茶酒', glass: 'Highball', garnish: '冷泡茶冰块', top: '乌龙茶', middle: '梨汁', bottom: '蜂蜜', quote: '像给过热的大脑一口冷空气。', intensity: [0.08, 0.48] },
        { id: 'silk-vesper', name: '丝雾维斯帕', en: 'Silk Vesper', style: 'Vesper', base: '丝绒伏特加', glass: 'Coupe', garnish: '柠檬皮喷香', top: '柠檬皮', middle: '白葡萄', bottom: '伏特加', quote: '平静不是软弱，是让自己重新握住方向盘。', intensity: [0.22, 0.58] },
        { id: 'drift-fizz', name: '漂流梨雾', en: 'Drifting Pear Fizz', style: 'Fizz', base: '梨白兰地', glass: 'Fizz Glass', garnish: '梨片', top: '梨香', middle: '苏打泡沫', bottom: '白兰地', quote: '像漂过夜里的小光，不急但很稳。', intensity: [0.18, 0.54] }
    ],
    deep: [
        { id: 'midnight-cacao', name: '午夜可可', en: 'Midnight Cacao', style: 'Espresso', base: '咖啡利口酒', glass: 'Coupe', garnish: '可可粉', top: '可可', middle: '浓缩咖啡', bottom: '黑糖', quote: '适合那些还想坚持，但身体已经开始熄火的夜晚。', intensity: [0.2, 0.76] },
        { id: 'black-signal-manhattan', name: '黑讯曼哈顿', en: 'Black Signal Manhattan', style: 'Manhattan', base: '黑麦威士忌', glass: 'Nick & Nora', garnish: '黑樱桃', top: '黑樱桃', middle: '甜苦艾', bottom: '黑麦', quote: '它不会哄你开心，只会陪你把情绪放整齐。', intensity: [0.22, 0.82] },
        { id: 'ash-negroni', name: '灰烬尼格罗尼', en: 'Ash Negroni', style: 'Negroni', base: '烟熏金酒', glass: 'Old Fashioned', garnish: '焦糖橙皮', top: '橙皮', middle: '苦味药草', bottom: '烟熏杜松', quote: '适合承认今天确实有点苦，但还不想躲开。', intensity: [0.38, 0.92] },
        { id: 'orbit-old-fashioned', name: '轨道古典', en: 'Orbit Old Fashioned', style: 'Old Fashioned', base: '波本威士忌', glass: 'Old Fashioned', garnish: '橙皮火焰', top: '橙油', middle: '苦精', bottom: '波本', quote: '稳重得像把一天的重量压成一个冰块。', intensity: [0.32, 0.88] },
        { id: 'velvet-smoke-smash', name: '绒烟碎调', en: 'Velvet Smoke Smash', style: 'Smash', base: '烟熏威士忌', glass: 'Rocks', garnish: '迷迭香烟熏', top: '迷迭香', middle: '蜂蜜', bottom: '烟熏麦芽', quote: '给那些“我其实只是太累了”的瞬间一条出口。', intensity: [0.28, 0.78] },
        { id: 'afterglow-sazerac', name: '余烬萨泽拉克', en: 'Afterglow Sazerac', style: 'Sazerac', base: '黑麦与艾碧斯', glass: 'Rocks', garnish: '柠檬皮', top: '柠檬油', middle: '苦精', bottom: '艾碧斯', quote: '不热闹，但会把你残余的力气收拢起来。', intensity: [0.42, 0.96] },
        { id: 'coal-boulevardier', name: '炭夜大道', en: 'Coal Boulevardier', style: 'Boulevardier', base: '波本与苦味酒', glass: 'Rocks', garnish: '橙皮', top: '橙皮', middle: '红色苦酒', bottom: '波本', quote: '像夜班下楼时那阵又冷又清醒的风。', intensity: [0.36, 0.9] }
    ],
    focus: [
        { id: 'graphite-gibson', name: '石墨吉布森', en: 'Graphite Gibson', style: 'Gibson', base: '干型金酒', glass: 'Martini', garnish: '腌洋葱', top: '洋葱香气', middle: '白胡椒', bottom: '杜松', quote: '很适合那些脑子开始变窄、注意力却更锋利的时候。', intensity: [0.18, 0.68] },
        { id: 'blueprint-martini', name: '蓝图马天尼', en: 'Blueprint Martini', style: 'Martini', base: '伏特加', glass: 'Martini', garnish: '柠檬皮', top: '柠檬皮', middle: '白花椒', bottom: '伏特加', quote: '像白板上突然出现可执行方案的那一刻。', intensity: [0.16, 0.62] },
        { id: 'terminal-gimlet', name: '终端吉姆雷特', en: 'Terminal Gimlet', style: 'Gimlet', base: '金酒', glass: 'Coupe', garnish: '青柠皮', top: '青柠', middle: '糖浆', bottom: '杜松', quote: '清爽、直接，没有多余情绪拖拽。', intensity: [0.22, 0.66] },
        { id: 'quiet-current-highball', name: '静流高球', en: 'Quiet Current Highball', style: 'Highball', base: '苏格兰调和威士忌', glass: 'Highball', garnish: '柠檬皮', top: '柠檬皮', middle: '苏打', bottom: '淡麦芽', quote: '适合长时间推进，而不是瞬间爆发。', intensity: [0.18, 0.58] },
        { id: 'compiler-sour', name: '编译酸酒', en: 'Compiler Sour', style: 'Sour', base: '波本', glass: 'Coupe', garnish: '蛋白泡沫', top: '柠檬', middle: '蛋白泡沫', bottom: '波本', quote: '每次报错之后，都值得一层更稳定的泡沫。', intensity: [0.32, 0.74] },
        { id: 'relay-penicillin', name: '中继佩尼西林', en: 'Relay Penicillin', style: 'Penicillin', base: '苏格兰威士忌', glass: 'Rocks', garnish: '姜片', top: '姜', middle: '蜂蜜', bottom: '烟熏威士忌', quote: '既能提神，也能把过度紧绷往下压一点。', intensity: [0.3, 0.78] },
        { id: 'lab-collins', name: '实验室柯林斯', en: 'Lab Collins', style: 'Collins', base: '柠檬伏特加', glass: 'Collins', garnish: '香蜂草', top: '柠檬皮', middle: '香蜂草', bottom: '伏特加', quote: '像一份终于排好队的实验流程。', intensity: [0.2, 0.64] }
    ],
    storm: [
        { id: 'thunder-swizzle', name: '雷暴回旋', en: 'Thunder Swizzle', style: 'Swizzle', base: '黑朗姆', glass: 'Swizzle', garnish: '碎冰与苦精', top: '苦精', middle: '菠萝叶', bottom: '黑朗姆', quote: '适合那些情绪正在上电、脑子快要冒火的时刻。', intensity: [0.5, 1] },
        { id: 'pressure-daiquiri', name: '压力代基里', en: 'Pressure Daiquiri', style: 'Daiquiri', base: '白朗姆', glass: 'Coupe', garnish: '青柠皮', top: '青柠', middle: '糖浆', bottom: '白朗姆', quote: '酸度够快，适合直接切开那团糊住的烦躁。', intensity: [0.42, 0.88] },
        { id: 'static-mule', name: '静电骡子', en: 'Static Mule', style: 'Mule', base: '伏特加', glass: 'Copper Mug', garnish: '姜片与青柠', top: '姜', middle: '青柠', bottom: '伏特加', quote: '像把闷雷和凉意同时灌下去。', intensity: [0.36, 0.84] },
        { id: 'crosswind-julep', name: '侧风朱丽普', en: 'Crosswind Julep', style: 'Julep', base: '波本', glass: 'Julep Cup', garnish: '大束薄荷', top: '薄荷', middle: '碎冰', bottom: '波本', quote: '有点乱，但它至少让风从一个方向吹。', intensity: [0.36, 0.82] },
        { id: 'red-alert-smash', name: '红色警报', en: 'Red Alert Smash', style: 'Smash', base: '龙舌兰', glass: 'Rocks', garnish: '辣椒盐边', top: '辣椒', middle: '西柚', bottom: '龙舌兰', quote: '适合那种“今天别惹我”的情绪电压。', intensity: [0.54, 1] },
        { id: 'breakwater-sour', name: '防波堤酸酒', en: 'Breakwater Sour', style: 'Sour', base: '黑麦威士忌', glass: 'Coupe', garnish: '蛋白泡沫', top: '柠檬', middle: '海盐泡沫', bottom: '黑麦', quote: '把快冲出来的情绪拦在杯口里。', intensity: [0.44, 0.92] },
        { id: 'black-rain-fizz', name: '黑雨气泡', en: 'Black Rain Fizz', style: 'Fizz', base: '黑醋栗利口酒', glass: 'Fizz Glass', garnish: '黑莓', top: '黑莓', middle: '苏打泡沫', bottom: '黑醋栗', quote: '酸甜都很高，像风暴边缘的一层亮边。', intensity: [0.5, 0.94] }
    ],
    tender: [
        { id: 'rose-cabin-fizz', name: '蔷薇舱轻雾', en: 'Rose Cabin Fizz', style: 'Fizz', base: '玫瑰琴酒', glass: 'Fizz Glass', garnish: '可食用花瓣', top: '玫瑰', middle: '柚子', bottom: '杜松', quote: '像给自己留一点没那么硬的余地。', intensity: [0.1, 0.54] },
        { id: 'warm-linen-collins', name: '亚麻柯林斯', en: 'Warm Linen Collins', style: 'Collins', base: '白兰地', glass: 'Collins', garnish: '柠檬与蜂蜜边', top: '蜂蜜', middle: '柠檬', bottom: '白兰地', quote: '柔和不是退让，是给身体一个台阶。', intensity: [0.16, 0.52] },
        { id: 'peach-drift-bellini', name: '桃雾贝里尼', en: 'Peach Drift Bellini', style: 'Bellini', base: '桃子气泡酒', glass: 'Flute', garnish: '桃片', top: '白桃', middle: '气泡', bottom: '桃酒', quote: '适合想被轻一点地抱住的时候。', intensity: [0.08, 0.44] },
        { id: 'honey-comfort-sour', name: '蜜安酸酒', en: 'Honey Comfort Sour', style: 'Sour', base: '波本', glass: 'Coupe', garnish: '蜂蜜薄片', top: '蜂蜜', middle: '柠檬', bottom: '波本', quote: '给那些想继续硬扛，但又有点想软下来的晚上。', intensity: [0.18, 0.6] },
        { id: 'clover-whisper', name: '三叶低语', en: 'Clover Whisper', style: 'Clover Club', base: '树莓金酒', glass: 'Coupe', garnish: '树莓粉', top: '树莓', middle: '蛋白泡沫', bottom: '金酒', quote: '很适合一边温柔，一边保留边界。', intensity: [0.18, 0.56] },
        { id: 'pearl-milk-punch', name: '珍珠奶洗', en: 'Pearl Milk Punch', style: 'Milk Punch', base: '白兰地', glass: 'Rocks', garnish: '肉豆蔻粉', top: '肉豆蔻', middle: '奶洗茶香', bottom: '白兰地', quote: '像所有硬边都被磨圆了一点。', intensity: [0.14, 0.48] },
        { id: 'apricot-homecoming', name: '杏子回港', en: 'Apricot Homecoming', style: 'Sour', base: '杏桃白兰地', glass: 'Coupe', garnish: '杏肉片', top: '杏桃', middle: '蜂蜜', bottom: '白兰地', quote: '适合那些想回到安全区的时刻。', intensity: [0.14, 0.54] }
    ],
    nocturne: [
        { id: 'starrail-highball', name: '星轨高球', en: 'Starrail Highball', style: 'Highball', base: '苏格兰威士忌', glass: 'Highball', garnish: '柠檬皮', top: '柠檬皮', middle: '苏打', bottom: '麦芽', quote: '夜越深，越需要一杯不吵但清醒的东西。', intensity: [0.16, 0.56] },
        { id: 'lunar-espresso', name: '月背浓缩', en: 'Lunar Espresso', style: 'Espresso Martini', base: '咖啡伏特加', glass: 'Martini', garnish: '咖啡豆', top: '咖啡豆', middle: '浓缩咖啡', bottom: '伏特加', quote: '适合已经很困，但还不想交班的脑子。', intensity: [0.22, 0.74] },
        { id: 'night-transit-manhattan', name: '夜航曼哈顿', en: 'Night Transit Manhattan', style: 'Manhattan', base: '黑麦威士忌', glass: 'Nick & Nora', garnish: '黑樱桃', top: '黑樱桃', middle: '苦艾', bottom: '黑麦', quote: '像凌晨最后一趟列车，慢但不偏航。', intensity: [0.2, 0.72] },
        { id: 'velvet-nocturne', name: '绒夜夜曲', en: 'Velvet Nocturne', style: 'Nocturne', base: '可可朗姆', glass: 'Coupe', garnish: '可可边', top: '可可', middle: '香草', bottom: '深色朗姆', quote: '适合想在黑里留一点温度。', intensity: [0.16, 0.62] },
        { id: 'blackout-flip', name: '断电翻杯', en: 'Blackout Flip', style: 'Flip', base: '香料朗姆', glass: 'Coupe', garnish: '肉桂粉', top: '肉桂', middle: '蛋奶泡沫', bottom: '香料朗姆', quote: '像终于肯让自己停下来一下。', intensity: [0.18, 0.68] },
        { id: 'harbor-last-word', name: '港湾最后一句', en: 'Harbor Last Word', style: 'Last Word', base: '草本金酒', glass: 'Coupe', garnish: '青樱桃', top: '青樱桃', middle: '绿草本', bottom: '青柠', quote: '不是结束，是给今天一个能放下去的句号。', intensity: [0.24, 0.7] },
        { id: 'insomnia-rickey', name: '失眠瑞奇', en: 'Insomnia Rickey', style: 'Rickey', base: '黑加仑金酒', glass: 'Rickey', garnish: '青柠与黑莓', top: '黑莓', middle: '青柠', bottom: '黑加仑', quote: '给那些醒着也不想再更醒的时刻。', intensity: [0.24, 0.66] }
    ]
};

// 彩蛋酒单：当文本命中特定主题词时优先使用。
const specialRecipes = [
    { id: 'astrophage-tonic', family: 'cosmic', name: '噬星体汤力', en: 'Astrophage Tonic', style: 'Tonic', base: '深空汤力金酒', glass: 'Highball', garnish: '萤光青柠', top: '柠檬皮', middle: '奎宁', bottom: '深空金酒', quote: '像在黑暗里发现一种新燃料。', keywords: ['噬星体', 'astrophage', '太阳', '地球'], intensity: [0.18, 0.82], secret: true },
    { id: 'rocky-signal', family: 'cosmic', name: '洛基信号', en: 'Rocky Signal', style: 'Martini', base: '低温伏特加', glass: 'Martini', garnish: '蓝盐晶片', top: '海盐', middle: '干型苦艾', bottom: '伏特加', quote: '有些回应很慢，但一旦收到就再也忘不掉。', keywords: ['洛基', 'rocky', '外星', 'eridian', '厄立德'], intensity: [0.16, 0.74], secret: true },
    { id: 'eridian-velvet', family: 'cosmic', name: '水基绒夜', en: 'Eridian Velvet', style: 'Velvet Sour', base: '矿盐白兰地', glass: 'Coupe', garnish: '海盐雾', top: '海盐', middle: '白葡萄', bottom: '白兰地', quote: '当你知道对面不是人类，但依然决定靠近。', keywords: ['水基', '厄立德', 'eridian', '氨'], intensity: [0.14, 0.7], secret: true },
    { id: 'hail-mary-75', family: 'cosmic', name: '万福玛丽 75', en: 'Hail Mary 75', style: '75', base: '香槟琴酒', glass: 'Flute', garnish: '柠檬皮', top: '柠檬皮', middle: '气泡酒', bottom: '琴酒', quote: '不是轻快，是那种明知道很难还是要上的亮。', keywords: ['hail mary', '万福玛丽', '挽救计划', 'hm-clss'], intensity: [0.26, 0.86], secret: true },
    { id: 'lab-overdrive', family: 'cosmic', name: '科研超载', en: 'Lab Overdrive', style: 'Boulevardier', base: '实验波本', glass: 'Rocks', garnish: '橙皮', top: '橙皮', middle: '苦味药草', bottom: '波本', quote: '论文和实验都不肯让路时，该有一杯认真的重酒。', keywords: ['论文', '实验', '数据', '科研'], intensity: [0.34, 0.94], secret: true },
    { id: 'bugfix-boulevardier', family: 'cosmic', name: '修虫大道', en: 'Bugfix Boulevardier', style: 'Boulevardier', base: '黑麦波本', glass: 'Rocks', garnish: '焦糖橙皮', top: '橙皮', middle: '苦味酒', bottom: '黑麦', quote: '像把一整晚的报错都熬成可入口的东西。', keywords: ['bug', '报错', '调试', '代码', 'debug'], intensity: [0.4, 0.94], secret: true },
    { id: 'deadline-negroni', family: 'cosmic', name: '截止线尼格罗尼', en: 'Deadline Negroni', style: 'Negroni', base: '高压金酒', glass: 'Rocks', garnish: '炙烤橙皮', top: '橙皮', middle: '苦味红酒', bottom: '金酒', quote: 'DDL 不是钟声，是杯口那一点又苦又亮的反光。', keywords: ['ddl', '截止', '赶工', '加班'], intensity: [0.5, 1], secret: true },
    { id: 'deep-space-latte', family: 'cosmic', name: '深空拿铁马丁尼', en: 'Deep Space Latte Martini', style: 'Espresso Martini', base: '咖啡伏特加', glass: 'Martini', garnish: '咖啡豆与可可粉', top: '咖啡豆', middle: '牛奶泡沫', bottom: '伏特加', quote: '困意和责任感一起上来的时候，总得让其中一个先坐下。', keywords: ['咖啡', '困', '失眠', '熬夜'], intensity: [0.22, 0.82], secret: true },
    { id: 'weekend-escape-spritz', family: 'cosmic', name: '周末逃逸喷泉', en: 'Weekend Escape Spritz', style: 'Spritz', base: '白葡萄开胃酒', glass: 'Wine Glass', garnish: '橙片', top: '橙片', middle: '气泡酒', bottom: '草本开胃酒', quote: '适合那种“我今晚想暂时从主线任务里逃逸一下”的心情。', keywords: ['周末', '放假', '出去玩', '旅行'], intensity: [0.12, 0.58], secret: true }
];

// 统一酒谱目录，便于后续按条件筛选。
const cocktailCatalog = [
    ...Object.entries(familyRecipes).flatMap(([family, recipes]) => recipes.map((recipe) => ({ ...recipe, family, secret: false }))),
    ...specialRecipes
];

const familyList = Object.keys(familyMeta);
let analysisTimeouts = [];

/**
 * 将文本稳定地映射为整数种子，保证同样输入能得到可复现的结果。
 * @param {string} str
 * @returns {number}
 */
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return Math.abs(hash);
}

/**
 * 把数值约束在指定区间内。
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * 清空分析阶段排队中的定时器，避免状态切换后旧动画继续执行。
 */
function clearAnalysisTimers() {
    analysisTimeouts.forEach((timerId) => clearTimeout(timerId));
    analysisTimeouts = [];
}

/**
 * 记录一个分析阶段动画步骤，便于统一取消。
 * @param {Function} callback
 * @param {number} delay
 */
function queueAnalysisStep(callback, delay) {
    const timerId = setTimeout(callback, delay);
    analysisTimeouts.push(timerId);
}

/**
 * 获取某个配方的展示色板，若配方未自定义则回退到家族默认色。
 * @param {object} recipe
 * @returns {string[]}
 */
function getRecipePalette(recipe) {
    return recipe.palette || familyMeta[recipe.family].palette;
}

/**
 * 根据强度区间返回标签与酒精系数，供成品卡文案和 ABV 估算复用。
 * @param {number} intensity
 * @returns {{ cn: string, en: string, label: string, abvFactor: number }}
 */
function getIntensityMeta(intensity) {
    if (intensity < 0.34) {
        return { cn: '轻酿版', en: 'Mild', label: 'LIGHT POUR', abvFactor: 0.82 };
    }
    if (intensity < 0.68) {
        return { cn: '标准版', en: 'Balanced', label: 'BALANCED POUR', abvFactor: 1 };
    }
    return { cn: '烈性版', en: 'Bold', label: 'BOLD POUR', abvFactor: 1.18 };
}

/**
 * 给不同酒款风格一个基础 ABV 参考值。
 * @param {string} style
 * @returns {number}
 */
function getStyleBaseAbv(style) {
    const map = {
        Paloma: 12,
        Spritz: 11,
        Collins: 13,
        Fizz: 11,
        Highball: 12,
        Swizzle: 16,
        Smash: 17,
        Martini: 24,
        Bamboo: 16,
        Cobbler: 13,
        Rickey: 12,
        Cooler: 11,
        Vesper: 26,
        Daiquiri: 16,
        Espresso: 19,
        'Espresso Martini': 20,
        Manhattan: 25,
        Negroni: 26,
        'Old Fashioned': 28,
        Sazerac: 29,
        Boulevardier: 27,
        Gibson: 24,
        Gimlet: 18,
        Sour: 17,
        Penicillin: 18,
        Mule: 13,
        Julep: 17,
        Bellini: 10,
        'Clover Club': 15,
        'Milk Punch': 15,
        Flip: 17,
        'Last Word': 21,
        Tonic: 11,
        '75': 14,
        'Velvet Sour': 15,
        Nocturne: 18
    };

    return map[style] || 16;
}

/**
 * 选出次级情绪家族，用于主家族候选不足时做补充筛选。
 * @param {{ family: string, score: number }[]} sortedFamilies
 * @param {string} primaryFamily
 * @returns {string}
 */
function getSecondaryFamily(sortedFamilies, primaryFamily) {
    const secondary = sortedFamilies.find((item) => item.family !== primaryFamily && item.score > 0.2);
    return secondary ? secondary.family : primaryFamily;
}

/**
 * 解析输入文本，输出情绪正负向、强度和主次情绪家族。
 * 当未命中词典时，会用文本种子生成一个稳定的回退结果，避免完全随机。
 * @param {string} text
 * @returns {{ seed: number, text: string, valence: number, intensity: number, primaryFamily: string, secondaryFamily: string, matchedKeywords: string[] }}
 */
function analyzeMoodText(text) {
    const normalizedText = text.trim();
    const lowerText = normalizedText.toLowerCase();
    const seed = hashString(normalizedText);
    const familyScores = familyList.reduce((acc, family) => ({ ...acc, [family]: 0 }), {});
    const matchedKeywords = [];
    let valenceAccumulator = 0;
    let intensityAccumulator = 0;
    let weight = 0;

    moodLexicon.forEach((rule) => {
        const hits = rule.keywords.filter((keyword) => lowerText.includes(keyword.toLowerCase()));
        if (!hits.length) return;

        const hitWeight = hits.length;
        familyScores[rule.family] += hitWeight;
        valenceAccumulator += rule.valence * hitWeight;
        intensityAccumulator += rule.intensity * hitWeight;
        weight += hitWeight;
        matchedKeywords.push(...hits);
    });

    emotionDictionary.forEach((emotion) => {
        if (!normalizedText.includes(emotion.label)) return;

        const familyMap = {
            焦躁: 'storm',
            平静: 'calm',
            疲惫: 'deep',
            雀跃: 'bright',
            紧绷: 'storm',
            灵感迸发: 'focus',
            孤独: 'nocturne',
            充满希望: 'bright',
            迷茫: 'deep',
            专注: 'focus',
            压抑: 'deep',
            成就感: 'bright'
        };

        const family = familyMap[emotion.label] || 'calm';
        familyScores[family] += 0.9;
        valenceAccumulator += emotion.efi * 0.9;
        intensityAccumulator += emotion.eii * 0.7;
        weight += 0.9;
        matchedKeywords.push(emotion.label);
    });

    // 标点、重复字符和文本长度会轻微放大情绪强度，让“语气”也参与结果。
    const punctuationBoost = (normalizedText.match(/[!！?？]/g) || []).length * 0.04;
    const stretchBoost = (normalizedText.match(/(.)\1{2,}/g) || []).length * 0.06;
    const lengthBoost = Math.min(normalizedText.length / MAX_MOOD_CHARS, 1) * 0.1;
    const seededValence = ((seed % 100) / 100) * 0.8 - 0.4;
    const seededIntensity = 0.28 + (((seed * 7) % 100) / 100) * 0.26;

    let valence = weight > 0 ? valenceAccumulator / weight : seededValence;
    let intensity = weight > 0 ? 0.42 + (intensityAccumulator / weight) : seededIntensity;

    valence = clamp(valence, -1, 1);
    intensity = clamp(intensity + punctuationBoost + stretchBoost + lengthBoost, 0.05, 1);

    if (Object.values(familyScores).every((score) => score === 0)) {
        if (valence > 0.26 && intensity > 0.42) {
            familyScores.bright += 1;
        } else if (valence > 0.16) {
            familyScores.calm += 1;
        } else if (valence < -0.2 && intensity > 0.5) {
            familyScores.storm += 1;
        } else if (valence < -0.14) {
            familyScores.deep += 1;
        } else {
            familyScores.focus += 0.8;
            familyScores.calm += 0.6;
        }
    }

    const sortedFamilies = Object.entries(familyScores)
        .map(([family, score]) => ({ family, score }))
        .sort((a, b) => b.score - a.score);

    const primaryFamily = sortedFamilies[0].family;
    const secondaryFamily = getSecondaryFamily(sortedFamilies, primaryFamily);

    return {
        seed,
        text: normalizedText,
        valence,
        intensity,
        primaryFamily,
        secondaryFamily,
        matchedKeywords: Array.from(new Set(matchedKeywords)).slice(0, 5)
    };
}

/**
 * 根据情绪画像挑选最合适的配方。
 * 优先命中彩蛋酒，其次匹配主家族和强度，最后再用次级家族兜底。
 * @param {object} profile
 * @returns {object}
 */
function pickRecipe(profile) {
    const lowerText = profile.text.toLowerCase();
    const specialMatches = specialRecipes.filter((recipe) => recipe.keywords.some((keyword) => lowerText.includes(keyword.toLowerCase())));
    if (specialMatches.length) {
        return specialMatches[profile.seed % specialMatches.length];
    }

    let candidates = cocktailCatalog.filter((recipe) => !recipe.secret && recipe.family === profile.primaryFamily);
    const intensityMatches = candidates.filter((recipe) => profile.intensity >= recipe.intensity[0] && profile.intensity <= recipe.intensity[1]);
    if (intensityMatches.length) {
        candidates = intensityMatches;
    }

    if (candidates.length < 3 && profile.secondaryFamily !== profile.primaryFamily) {
        candidates = candidates.concat(
            cocktailCatalog.filter((recipe) => !recipe.secret && recipe.family === profile.secondaryFamily)
        );
    }

    return candidates[profile.seed % candidates.length];
}

/**
 * 生成一段“为什么是这杯酒”的解释文本。
 * @param {object} profile
 * @param {object} recipe
 * @returns {string}
 */
function getReasonText(profile, recipe) {
    const keywordText = profile.matchedKeywords.length ? profile.matchedKeywords.join('、') : '整体语气';
    const familyReason = {
        bright: '把它调成更偏气泡和柑橘的提振型结构',
        calm: '把它调成回稳、降噪、不抢戏的冷静结构',
        deep: '把它留在深色基酒和可可、苦味的下沉结构里',
        focus: '把它压成更利落、边界更清楚的专注型结构',
        storm: '把它放进更高电压、更明显酸苦对冲的风暴型结构',
        tender: '把它调成更柔和、带一点包裹感的舒缓结构',
        nocturne: '把它放进夜航类基酒和咖啡、黑莓、麦芽的夜间结构里',
        cosmic: '把它判定为一杯应该触发彩蛋的深空结构'
    };

    return `系统从你文字里的 ${keywordText} 取样，最后决定用 ${recipe.base} 做基酒，${familyReason[recipe.family]}。`;
}

/**
 * 把分析结果和配方合并成一条完整的展示记录。
 * @param {object} profile
 * @param {object} recipe
 * @returns {object}
 */
function buildDrinkRecord(profile, recipe) {
    const intensityMeta = getIntensityMeta(profile.intensity);
    const family = familyMeta[recipe.family];
    const abv = Math.round(getStyleBaseAbv(recipe.style) * intensityMeta.abvFactor);
    const name = recipe.secret ? recipe.name : `${recipe.name}·${intensityMeta.cn}`;
    const enName = recipe.secret ? recipe.en : `${recipe.en} ${intensityMeta.en}`;
    const serial = `CELLAR-${String(profile.seed % 10000).padStart(4, '0')}`;
    const concentration = profile.intensity.toFixed(2);

    return {
        id: `drink_${Date.now()}`,
        seed: profile.seed,
        date: getTodayString(),
        time: getCurrentTimeString(),
        name,
        enName,
        style: recipe.style,
        base: recipe.base,
        glass: recipe.glass,
        garnish: recipe.garnish,
        top: recipe.top,
        middle: recipe.middle,
        bottom: recipe.bottom,
        params: `${concentration} · ${intensityMeta.cn}`,
        intensityLabel: intensityMeta.label,
        feel: recipe.secret ? family.feel : family.feel,
        family: family.label,
        familyKey: recipe.family,
        badge: recipe.secret ? 'Easter Egg / 彩蛋款' : family.badge,
        quote: recipe.quote,
        story: `这杯 ${name} 更像一张可回看的情绪切片。它不会替你解释今天，但会把“当时到底是什么味道”留下来。`,
        reason: getReasonText(profile, recipe),
        abv: `${abv}% ABV`,
        serial,
        secret: recipe.secret,
        valence: profile.valence,
        intensity: profile.intensity,
        palette: getRecipePalette(recipe),
        text: profile.text,
        matchedKeywords: profile.matchedKeywords
    };
}

/**
 * 根据情绪正负向和强度驱动酒液倾斜、波浪和发光动画参数。
 * @param {HTMLElement} container
 * @param {{ valence?: number, intensity?: number, phase?: number }} config
 */
function applyTavernMotion(container, { valence = 0, intensity = 0.3, phase = 0 } = {}) {
    if (!container) return;

    const safeIntensity = clamp(intensity, 0.05, 1);
    const lean = clamp(Math.abs(valence), 0, 1);
    const tilt = clamp((valence * 3.2) + phase, -4.8, 4.8);
    const slosh = clamp(0.48 + safeIntensity * 0.9 + Math.abs(phase) * 0.06, 0.45, 1.55);
    const glow = clamp(0.18 + safeIntensity * 0.56, 0.18, 0.82);
    const foam = clamp(0.16 + safeIntensity * 0.38, 0.16, 0.72);
    const waveShift = 0.18 + lean * 0.38 + safeIntensity * 0.06;
    const waveLift = 0.05 + lean * 0.13 + safeIntensity * 0.03;
    const waveBias = clamp(valence * 0.08, -0.12, 0.12);
    const frontTilt = 1.85 + lean * 2.8 + safeIntensity * 0.35;
    const backTilt = 1.05 + lean * 1.95 + safeIntensity * 0.22;
    const frontLeft = -waveShift + waveBias;
    const frontRight = waveShift + waveBias;
    const backLeft = (-waveShift * 0.72) - waveBias;
    const backRight = (waveShift * 0.82) - waveBias;
    const frontDown = waveLift;
    const frontUp = -waveLift;
    const backDown = waveLift * 1.45;
    const backUp = waveLift * -0.6;

    container.style.setProperty('--tavern-tilt', tilt.toFixed(2));
    container.style.setProperty('--tavern-slosh', slosh.toFixed(2));
    container.style.setProperty('--tavern-glow', glow.toFixed(2));
    container.style.setProperty('--tavern-foam', foam.toFixed(2));
    container.style.setProperty('--tavern-wave-shift', `${waveShift.toFixed(2)}rem`);
    container.style.setProperty('--tavern-wave-lift', `${waveLift.toFixed(2)}rem`);
    container.style.setProperty('--tavern-wave-bias', `${waveBias.toFixed(2)}rem`);
    container.style.setProperty('--tavern-wave-front-tilt', `${frontTilt.toFixed(2)}deg`);
    container.style.setProperty('--tavern-wave-back-tilt', `${backTilt.toFixed(2)}deg`);
    container.style.setProperty('--tavern-wave-front-left', `${frontLeft.toFixed(2)}rem`);
    container.style.setProperty('--tavern-wave-front-right', `${frontRight.toFixed(2)}rem`);
    container.style.setProperty('--tavern-wave-front-down', `${frontDown.toFixed(2)}rem`);
    container.style.setProperty('--tavern-wave-front-up', `${frontUp.toFixed(2)}rem`);
    container.style.setProperty('--tavern-wave-back-left', `${backLeft.toFixed(2)}rem`);
    container.style.setProperty('--tavern-wave-back-right', `${backRight.toFixed(2)}rem`);
    container.style.setProperty('--tavern-wave-back-down', `${backDown.toFixed(2)}rem`);
    container.style.setProperty('--tavern-wave-back-up', `${backUp.toFixed(2)}rem`);
}

/**
 * 将当前配方的色板和浓度映射到酒杯视觉变量。
 * @param {object} record
 */
function applyPaletteToTavern(record) {
    const container = document.getElementById('view-tavern-container');
    const [a, b, c] = record.palette;
    const concentration = parseFloat(record.params) || record.intensity || 0.5;
    const fill = `${Math.round(22 + record.matchedKeywords.length * 2 + concentration * 40)}%`;
    const position = Math.round(((record.seed % 1000) / 1000) * 10 + ((concentration * 100) / 2) + 20);

    container.style.setProperty('--tavern-a', a);
    container.style.setProperty('--tavern-b', b);
    container.style.setProperty('--tavern-c', c);
    container.style.setProperty('--tavern-fill', fill);
    container.style.setProperty('--tavern-pos', `${clamp(position, 6, 94)}`);
    container.style.setProperty('--tavern-wave', `${(8 - concentration * 4).toFixed(2)}s`);
    container.style.setProperty('--tavern-bubble', `${clamp(0.16 + concentration * 0.7, 0.18, 0.78)}`);
    applyTavernMotion(container, { valence: record.valence || 0, intensity: record.intensity || concentration });
    document.getElementById('res-bar').style.width = `${Math.round(parseFloat(record.params) * 100)}%`;
    document.getElementById('res-bar').style.background = `linear-gradient(90deg, ${a}, ${b}, ${c})`;
}

/**
 * 在正式分析前，先根据输入文本做一层即时预览反馈。
 * @param {string} text
 */
function updateInputPreview(text) {
    const labelEl = document.getElementById('tavern-stage-label');
    const statusEl = document.getElementById('tavern-stage-status');
    const captionEl = document.getElementById('tavern-stage-caption');
    const scaleCopyEl = document.getElementById('emotion-scale-copy');
    const container = document.getElementById('view-tavern-container');

    if (!text.trim()) {
        container.style.setProperty('--tavern-fill', '24%');
        container.style.setProperty('--tavern-pos', '50');
        container.style.setProperty('--tavern-wave', '7s');
        container.style.setProperty('--tavern-bubble', '0.28');
        container.style.setProperty('--tavern-a', familyMeta.calm.palette[0]);
        container.style.setProperty('--tavern-b', familyMeta.calm.palette[1]);
        container.style.setProperty('--tavern-c', familyMeta.calm.palette[2]);
        labelEl.textContent = 'Idle Pour';
        statusEl.textContent = 'WAITING FOR INPUT';
        captionEl.textContent = '写下一句此刻的感受，吧台会把它翻译成可见的颜色、液面和配方结构。';
        scaleCopyEl.textContent = '目前处于待命状态，尚未开始读取情绪样本。';
        applyTavernMotion(container, { valence: 0, intensity: 0.22, phase: 0 });
        return;
    }

    const profile = analyzeMoodText(text);
    const family = familyMeta[profile.primaryFamily];
    container.style.setProperty('--tavern-a', family.palette[0]);
    container.style.setProperty('--tavern-b', family.palette[1]);
    container.style.setProperty('--tavern-c', family.palette[2]);
    container.style.setProperty('--tavern-fill', `${Math.round(18 + profile.intensity * 36)}%`);
    container.style.setProperty('--tavern-pos', `${Math.round(((profile.valence + 1) / 2) * 100)}`);
    container.style.setProperty('--tavern-wave', `${(8 - profile.intensity * 4).toFixed(2)}s`);
    container.style.setProperty('--tavern-bubble', `${clamp(0.12 + profile.intensity * 0.7, 0.16, 0.74)}`);
    applyTavernMotion(container, { valence: profile.valence, intensity: profile.intensity });

    labelEl.textContent = family.stage;
    statusEl.textContent = `${family.display} 预读中`;
    captionEl.textContent = `系统预判这段文字会落在 ${family.label}，适合用 ${family.display} 的基酒结构来承接。`;
    scaleCopyEl.textContent = `情绪指针已经开始移动，说明这段输入不是空白，它已经带有明确方向。`;
}

/**
 * 让酒馆容器高度跟随当前激活状态页自适应，避免切页时突然跳动。
 * @param {string} targetId
 */
function syncTavernContainerHeight(targetId) {
    const container = document.getElementById('view-tavern-container');
    const activeState = document.getElementById(targetId);
    const activeFrame = activeState?.firstElementChild;

    if (!container || !activeState || !activeFrame) return;

    requestAnimationFrame(() => {
        const nextHeight = Math.max(activeFrame.scrollHeight, 640);
        container.style.height = `${nextHeight}px`;
    });
}

/**
 * 切换酒馆内部四种主状态：输入、分析、结果、历史。
 * @param {'state-input'|'state-analyzing'|'state-result'|'state-history'} targetId
 */
function switchTavernState(targetId) {
    ['state-input', 'state-analyzing', 'state-result', 'state-history'].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;

        if (id === targetId) {
            el.style.zIndex = '10';
            el.style.pointerEvents = 'auto';
            el.setAttribute('aria-hidden', 'false');
            el.classList.remove('opacity-0');
            el.classList.add('opacity-100');
        } else {
            el.style.zIndex = '0';
            el.style.pointerEvents = 'none';
            el.setAttribute('aria-hidden', 'true');
            el.classList.remove('opacity-100');
            el.classList.add('opacity-0');
        }
    });

    syncTavernContainerHeight(targetId);
}

/**
 * 把一条酒单记录渲染到结果卡视图。
 * @param {object} record
 * @param {boolean} fromHistory
 */
function renderResult(record, fromHistory = false) {
    currentDrinkInfo = { ...record, saved: !!fromHistory || record.saved };
    applyPaletteToTavern(currentDrinkInfo);

    document.getElementById('res-title').textContent = currentDrinkInfo.name;
    document.getElementById('res-subtitle').textContent = currentDrinkInfo.enName;
    document.getElementById('res-style').textContent = currentDrinkInfo.style;
    document.getElementById('res-badge').textContent = currentDrinkInfo.badge;
    document.getElementById('res-base').textContent = currentDrinkInfo.base;
    document.getElementById('res-glass').textContent = currentDrinkInfo.glass;
    document.getElementById('res-top').textContent = currentDrinkInfo.top;
    document.getElementById('res-mid').textContent = currentDrinkInfo.middle;
    document.getElementById('res-bot').textContent = currentDrinkInfo.bottom;
    document.getElementById('res-feel').textContent = currentDrinkInfo.feel;
    document.getElementById('res-garnish').textContent = currentDrinkInfo.garnish;
    document.getElementById('res-params').textContent = currentDrinkInfo.params;
    document.getElementById('res-family').textContent = currentDrinkInfo.family;
    document.getElementById('res-abv').textContent = currentDrinkInfo.abv;
    document.getElementById('res-left-family').textContent = currentDrinkInfo.family;
    document.getElementById('res-left-base').textContent = currentDrinkInfo.base;
    document.getElementById('res-left-abv').textContent = currentDrinkInfo.abv;
    document.getElementById('res-left-glass').textContent = currentDrinkInfo.glass;
    document.getElementById('res-left-feel').textContent = currentDrinkInfo.feel;
    document.getElementById('res-left-garnish').textContent = currentDrinkInfo.garnish;
    document.getElementById('res-serial').textContent = currentDrinkInfo.serial;
    document.getElementById('res-story').textContent = currentDrinkInfo.story;
    document.getElementById('res-reason').textContent = currentDrinkInfo.reason;
    document.getElementById('res-quote').textContent = currentDrinkInfo.quote;
    document.getElementById('res-intensity-label').textContent = currentDrinkInfo.intensityLabel;
    document.getElementById('res-left-service').textContent = `以${currentDrinkInfo.glass}承接 ${currentDrinkInfo.base}，入口先给出 ${currentDrinkInfo.top}，尾段让 ${currentDrinkInfo.garnish} 把整杯酒慢慢收住。`;

    const saveBtn = document.getElementById('btn-save-drink');
    if (saveBtn) {
        saveBtn.innerHTML = currentDrinkInfo.saved
            ? '<i data-lucide="archive-check" class="w-4 h-4"></i> 已封存'
            : '<i data-lucide="archive" class="w-4 h-4"></i> 保存到酒单';
        saveBtn.disabled = !!currentDrinkInfo.saved;
        saveBtn.classList.toggle('opacity-60', !!currentDrinkInfo.saved);
        saveBtn.classList.toggle('cursor-not-allowed', !!currentDrinkInfo.saved);
    }

    switchTavernState('state-result');
    lucide.createIcons();
}

/**
 * 生成便于分享的纯文本卡片，并复制到剪贴板。
 * @param {object} record
 * @returns {Promise<void>}
 */
function copyDrinkCard(record) {
    const shareText = [
        `${record.name} | ${record.enName}`,
        `风格：${record.style} · ${record.family}`,
        `基酒：${record.base} · 杯型：${record.glass}`,
        `香调：${record.top} / ${record.middle} / ${record.bottom}`,
        `体感：${record.feel}`,
        `浓度：${record.params} · ${record.abv}`,
        `注记：${record.reason}`
    ].join('\n');

    if (navigator.clipboard?.writeText) {
        return navigator.clipboard.writeText(shareText);
    }

    return new Promise((resolve, reject) => {
        try {
            const textarea = document.createElement('textarea');
            textarea.value = shareText;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
            resolve();
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * 把旧版本酒单记录补齐到当前结构，保证历史数据仍可渲染。
 * @param {object} drink
 * @returns {object}
 */
function normalizeDrinkRecord(drink) {
    if (drink.enName && drink.style) {
        return drink;
    }

    return {
        id: drink.id,
        seed: hashString((drink.name || '') + (drink.time || '')),
        date: drink.date,
        time: drink.time,
        name: drink.name || '未命名特调',
        enName: drink.name || 'Archived Blend',
        style: drink.style || 'Signature',
        base: drink.base || '未知基酒',
        glass: drink.glass || 'Cellar Glass',
        garnish: drink.garnish || '无',
        top: drink.top || '未知',
        middle: drink.middle || drink.mid || '未知',
        bottom: drink.bottom || drink.bot || '未知',
        params: drink.params || '0.50 · 标准版',
        intensityLabel: drink.intensityLabel || 'ARCHIVE POUR',
        feel: drink.feel || 'Archived / 归档',
        family: drink.family || 'Archive',
        familyKey: drink.familyKey || 'calm',
        badge: drink.badge || 'Archive Record',
        quote: drink.quote || '这杯旧酒来自更早的一次系统版本。',
        story: drink.story || '这是旧版本酒单记录，细节字段会比新卡片少一些。',
        reason: drink.reason || '旧记录没有完整保留生成原因。',
        abv: drink.abv || '15% ABV',
        serial: drink.serial || `ARCHIVE-${String(hashString(drink.id || drink.name || '0') % 10000).padStart(4, '0')}`,
        secret: !!drink.secret,
        valence: typeof drink.valence === 'number' ? drink.valence : 0,
        intensity: typeof drink.intensity === 'number' ? drink.intensity : (parseFloat(drink.params) || 0.5),
        palette: drink.palette || familyMeta.calm.palette,
        text: drink.text || '',
        matchedKeywords: drink.matchedKeywords || []
    };
}

/**
 * 渲染历史酒柜列表，并绑定查看/删除操作。
 */
function renderTavernHistory() {
    const container = document.getElementById('tavern-history-list');
    const normalizedHistory = tavernData.map(normalizeDrinkRecord);

    document.getElementById('history-count').textContent = normalizedHistory.length;
    document.getElementById('history-secret-count').textContent = normalizedHistory.filter((drink) => drink.secret).length;
    document.getElementById('history-library-count').textContent = cocktailCatalog.length;

    if (!normalizedHistory.length) {
        container.innerHTML = `
            <div class="tavern-panel col-span-full flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
                <div class="module-eyebrow mb-4">EMPTY CELLAR</div>
                <h4 class="tavern-display text-2xl font-semibold text-slate-950 dark:text-slate-50">酒柜还是空的</h4>
                <p class="mt-4 max-w-md text-sm leading-7 text-slate-500 dark:text-slate-400">
                    第一杯酒不需要完美。你只要留下一个当下样本，吧台就能开始记住你。
                </p>
                <button id="btn-empty-start" class="tavern-action-primary mt-6">
                    <i data-lucide="glass-water" class="w-4 h-4"></i> 去调第一杯
                </button>
            </div>
        `;
        document.getElementById('btn-empty-start')?.addEventListener('click', () => switchTavernState('state-input'));
        lucide.createIcons();
        if (document.getElementById('state-history')?.classList.contains('opacity-100')) {
            syncTavernContainerHeight('state-history');
        }
        return;
    }

    container.innerHTML = normalizedHistory.map((drink) => {
        const [a, b, c] = drink.palette;
        return `
            <article class="tavern-history-card" style="--tavern-a:${a};--tavern-b:${b};--tavern-c:${c};">
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <div class="flex flex-wrap gap-2">
                            <span class="tavern-chip">${escapeHtml(drink.badge)}</span>
                            <span class="tavern-chip">${escapeHtml(drink.style)}</span>
                        </div>
                        <h4 class="tavern-display mt-4 text-2xl font-semibold text-slate-950 dark:text-slate-50">${escapeHtml(drink.name)}</h4>
                        <p class="mt-1 text-sm italic text-slate-500 dark:text-slate-400">${escapeHtml(drink.enName)}</p>
                    </div>
                    <button class="delete-drink-btn rounded-xl p-2 text-slate-400 transition-colors hover:text-danger" data-id="${escapeHtml(drink.id)}" title="删除这杯酒">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
                <div class="mt-5 grid gap-3 text-sm text-slate-600 dark:text-slate-400">
                    <div><span class="text-slate-400">基酒：</span>${escapeHtml(drink.base)}</div>
                    <div><span class="text-slate-400">香调：</span>${escapeHtml(drink.top)} / ${escapeHtml(drink.middle)} / ${escapeHtml(drink.bottom)}</div>
                    <div><span class="text-slate-400">体感：</span>${escapeHtml(drink.feel)}</div>
                    <div><span class="text-slate-400">封存时间：</span>${escapeHtml(drink.date)} ${escapeHtml(drink.time)}</div>
                </div>
                <p class="mt-4 text-sm leading-6 text-slate-500 dark:text-slate-400">${escapeHtml(drink.quote)}</p>
                <div class="mt-5 flex gap-3">
                    <button class="view-drink-btn tavern-action-secondary !min-h-[2.9rem] flex-1 !px-4" data-id="${escapeHtml(drink.id)}">
                        <i data-lucide="scan-search" class="w-4 h-4"></i> 查看配方
                    </button>
                </div>
            </article>
        `;
    }).join('');

    container.querySelectorAll('.delete-drink-btn').forEach((button) => {
        button.addEventListener('click', function() {
            if (!confirm('确定要从酒柜里移除这杯特调吗？')) return;
            const id = this.getAttribute('data-id');
            tavernData = tavernData.filter((drink) => drink.id !== id);
            saveData();
            renderTavernHistory();
            showToast('这杯特调已从酒柜移除', 'success');
        });
    });

    container.querySelectorAll('.view-drink-btn').forEach((button) => {
        button.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            const targetDrink = normalizedHistory.find((drink) => drink.id === id);
            if (!targetDrink) return;
            renderResult({ ...targetDrink, saved: true }, true);
        });
    });

    lucide.createIcons();
    if (document.getElementById('state-history')?.classList.contains('opacity-100')) {
        syncTavernContainerHeight('state-history');
    }
}

// 酒馆模块在 DOM 完成后再挂载，因为它依赖大量静态容器节点。
document.addEventListener('DOMContentLoaded', () => {
    const inputEl = document.getElementById('mood-text-input');
    const countEl = document.getElementById('mood-char-count');
    const analyzeBtn = document.getElementById('btn-start-analyze');
    const emotionBarContainer = document.getElementById('emotion-bar-container');

    document.getElementById('history-library-count').textContent = cocktailCatalog.length;

    // 输入阶段即时更新字数、按钮状态和预览色板。
    inputEl?.addEventListener('input', (event) => {
        let text = event.target.value;
        if (text.length > MAX_MOOD_CHARS) {
            text = text.slice(0, MAX_MOOD_CHARS);
            event.target.value = text;
        }
        countEl.textContent = text.length;
        analyzeBtn.disabled = text.trim().length === 0;
        updateInputPreview(text);
    });

    document.querySelectorAll('.tavern-suggestion').forEach((button) => {
        button.addEventListener('click', () => {
            inputEl.value = button.getAttribute('data-mood') || '';
            countEl.textContent = inputEl.value.length;
            analyzeBtn.disabled = inputEl.value.trim().length === 0;
            updateInputPreview(inputEl.value);
        });
    });

    document.getElementById('btn-random-mood')?.addEventListener('click', () => {
        const suggestion = tavernSuggestionTexts[Date.now() % tavernSuggestionTexts.length];
        inputEl.value = suggestion;
        countEl.textContent = suggestion.length;
        analyzeBtn.disabled = false;
        updateInputPreview(suggestion);
    });

    // 正式分析会走一段“预读 -> 调和 -> 装瓶”的阶段动画，再展示结果。
    analyzeBtn?.addEventListener('click', () => {
        const text = inputEl.value.trim();
        if (!text) return;

        clearAnalysisTimers();
        emotionBarContainer.classList.remove('opacity-0');

        const profile = analyzeMoodText(text);
        const recipe = pickRecipe(profile);
        const record = buildDrinkRecord(profile, recipe);
        const family = familyMeta[recipe.family];
        const container = document.getElementById('view-tavern-container');

        container.style.setProperty('--tavern-a', record.palette[0]);
        container.style.setProperty('--tavern-b', record.palette[1]);
        container.style.setProperty('--tavern-c', record.palette[2]);
        container.style.setProperty('--tavern-fill', '12%');
        container.style.setProperty('--tavern-pos', `${Math.round(((profile.valence + 1) / 2) * 100)}`);
        container.style.setProperty('--tavern-wave', `${(8 - profile.intensity * 4).toFixed(2)}s`);
        container.style.setProperty('--tavern-bubble', `${clamp(0.18 + profile.intensity * 0.72, 0.18, 0.8)}`);
        applyTavernMotion(container, { valence: profile.valence, intensity: profile.intensity, phase: -1.8 });

        document.getElementById('analysis-status-primary').textContent = family.stage;
        document.getElementById('analysis-status-secondary').textContent = family.display;
        document.getElementById('analysis-reading-family').textContent = family.label;
        document.getElementById('analysis-reading-efi').textContent = profile.valence.toFixed(2);
        document.getElementById('analysis-reading-eii').textContent = profile.intensity.toFixed(2);
        document.getElementById('analyze-text').textContent = '捕捉你的当下味道中...';

        switchTavernState('state-analyzing');

        queueAnalysisStep(() => {
            document.getElementById('analyze-text').textContent = '正在调和你的情绪基酒...';
            container.style.setProperty('--tavern-fill', `${Math.round(28 + profile.intensity * 16)}%`);
            applyTavernMotion(container, { valence: profile.valence, intensity: profile.intensity + 0.08, phase: -2.3 });
        }, 280);

        queueAnalysisStep(() => {
            document.getElementById('analysis-status-secondary').textContent = '酸甜配比校准中';
            document.getElementById('analyze-text').textContent = profile.intensity > 0.68 ? '检测到明显波动，正在压住边缘噪音...' : '波动处于可控范围，正在细化香调层次...';
            container.style.setProperty('--tavern-fill', `${Math.round(42 + profile.intensity * 18)}%`);
            applyTavernMotion(container, { valence: profile.valence, intensity: profile.intensity + 0.12, phase: 2.7 });
        }, 1280);

        queueAnalysisStep(() => {
            document.getElementById('analysis-status-secondary').textContent = '装瓶与标签打印中';
            document.getElementById('analyze-text').textContent = '正在为这杯酒写下最后一句调酒师注记...';
            container.style.setProperty('--tavern-fill', `${Math.round(52 + profile.intensity * 20)}%`);
            applyTavernMotion(container, { valence: profile.valence, intensity: profile.intensity + 0.06, phase: -1.2 });
        }, 2380);

        queueAnalysisStep(() => {
            emotionBarContainer.classList.add('opacity-0');
            renderResult(record, false);
        }, 3320);
    });

    document.getElementById('btn-stop-analyze')?.addEventListener('click', () => {
        clearAnalysisTimers();
        switchTavernState('state-input');
        updateInputPreview(inputEl.value);
    });

    document.getElementById('btn-remix')?.addEventListener('click', () => {
        const remixText = currentDrinkInfo?.text || inputEl.value;
        currentDrinkInfo = null;
        inputEl.value = remixText;
        countEl.textContent = String(remixText.length);
        analyzeBtn.disabled = remixText.trim().length === 0;
        switchTavernState('state-input');
        updateInputPreview(remixText);
    });

    document.getElementById('btn-back-to-input')?.addEventListener('click', () => {
        clearAnalysisTimers();
        switchTavernState('state-input');
        updateInputPreview(inputEl.value);
    });

    document.getElementById('btn-save-drink')?.addEventListener('click', () => {
        if (!currentDrinkInfo || currentDrinkInfo.saved) return;
        tavernData.unshift({ ...currentDrinkInfo, saved: true });
        currentDrinkInfo.saved = true;
        saveData();
        showToast('特调已封存入酒柜', 'success');
        renderResult(currentDrinkInfo, true);
    });

    document.getElementById('btn-share-drink')?.addEventListener('click', async () => {
        if (!currentDrinkInfo) return;

        try {
            await copyDrinkCard(currentDrinkInfo);
            showToast('分享文案已复制', 'success');
        } catch (error) {
            showToast('复制失败，请稍后重试', 'error');
        }
    });

    document.getElementById('btn-result-history')?.addEventListener('click', () => {
        switchTavernState('state-history');
        renderTavernHistory();
    });

    document.getElementById('btn-view-tavern-history')?.addEventListener('click', () => {
        switchTavernState('state-history');
        renderTavernHistory();
    });

    document.getElementById('btn-close-history')?.addEventListener('click', () => {
        switchTavernState('state-input');
        updateInputPreview(inputEl.value);
    });

    document.getElementById('btn-history-create')?.addEventListener('click', () => {
        currentDrinkInfo = null;
        switchTavernState('state-input');
        updateInputPreview(inputEl.value);
    });

    switchTavernState('state-input');
    renderTavernHistory();
    updateInputPreview('');
    // 窗口尺寸变化时同步修正当前激活状态页的容器高度。
    window.addEventListener('resize', () => {
        const activeState = document.querySelector('#view-tavern-container > [id^="state-"].opacity-100');
        if (activeState?.id) {
            syncTavernContainerHeight(activeState.id);
        }
    });
});
