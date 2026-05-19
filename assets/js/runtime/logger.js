const appLogger = (() => {
    let silent = false;

    function normalizeArg(arg) {
        if (arg instanceof Error) {
            return arg.stack || arg.message;
        }
        return arg;
    }

    function emit(method, args) {
        if (silent || typeof console === 'undefined') return;
        const writer = console[method] || console.log;
        if (typeof writer === 'function') {
            writer.apply(console, args.map(normalizeArg));
        }
    }

    return {
        info(...args) {
            emit('log', args);
        },
        warn(...args) {
            emit('warn', args);
        },
        error(...args) {
            emit('error', args);
        },
        setSilent(value) {
            silent = !!value;
        }
    };
})();
