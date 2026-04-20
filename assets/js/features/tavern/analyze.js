/**
 * 深空酒馆情绪分析层。
 * 负责文本哈希、情绪压缩和家族倾向判定。
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
