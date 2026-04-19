/**
 * 深空酒馆分析模块。
 * 负责情绪解析、配方选择、记录生成与历史记录归一化。
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

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function getRecipePalette(recipe) {
    return recipe.palette || familyMeta[recipe.family].palette;
}

function getIntensityMeta(intensity) {
    if (intensity < 0.34) {
        return { cn: '轻酿版', en: 'Mild', label: 'LIGHT POUR', abvFactor: 0.82 };
    }
    if (intensity < 0.68) {
        return { cn: '标准版', en: 'Balanced', label: 'BALANCED POUR', abvFactor: 1 };
    }
    return { cn: '烈性版', en: 'Bold', label: 'BOLD POUR', abvFactor: 1.18 };
}

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

function getSecondaryFamily(sortedFamilies, primaryFamily) {
    const secondary = sortedFamilies.find((item) => item.family !== primaryFamily && item.score > 0.2);
    return secondary ? secondary.family : primaryFamily;
}

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
        feel: family.feel,
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
