/**
 * 深空酒馆配方选择层。
 * 负责在分析结果和酒谱目录之间做映射。
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
