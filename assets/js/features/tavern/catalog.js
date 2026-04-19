/**
 * 深空酒馆目录模块。
 * 负责维护情绪词典、酒谱目录和展示元数据。
 */

const MAX_MOOD_CHARS = 50;

const tavernSuggestionTexts = [
    '今天有点累，但其实还想再推进一点。',
    '刚把一件难事做完，整个人像终于松了一口气。',
    '我现在脑子很热，像有很多事一起扑过来。',
    '今晚想慢下来，最好连心跳都跟着轻一点。',
    '论文、代码和实验都卡住了，但我不想认输。',
    '明明有一点期待，可身体还是比脑子更想躺下。'
];

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

const cocktailCatalog = [
    ...Object.entries(familyRecipes).flatMap(([family, recipes]) => recipes.map((recipe) => ({ ...recipe, family, secret: false }))),
    ...specialRecipes
];

const familyList = Object.keys(familyMeta);
