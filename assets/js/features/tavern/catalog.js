/**
 * Deep-space tavern catalog composition module.
 * Builds derived catalog lists from static tavern data.
 */

const cocktailCatalog = [
    ...Object.entries(familyRecipes).flatMap(([family, recipes]) => recipes.map((recipe) => ({ ...recipe, family, secret: false }))),
    ...specialRecipes
];

const familyList = Object.keys(familyMeta);
