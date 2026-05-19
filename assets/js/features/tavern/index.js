/**
 * 深空酒馆入口模块。
 * 负责在 DOM 就绪后挂载酒馆交互。
 */

registerAppModule({
    id: 'tavern',
    order: 25,
    dependsOn: [
        'module-registry',
        'tavern/catalog',
        'tavern/analyze',
        'tavern/records',
        'tavern/logic',
        'tavern/stage',
        'tavern/result',
        'tavern/history',
        'tavern/ui'
    ],
    init: initTavernModule
});
