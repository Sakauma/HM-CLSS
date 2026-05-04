/**
 * Tailwind 运行时配置。
 * 统一维护主题色、阴影和字体令牌，需在 Tailwind CDN 脚本之后加载。
 */

tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: 'rgb(var(--color-primary) / <alpha-value>)',
                primaryHover: 'rgb(var(--color-primary-hover) / <alpha-value>)',
                accent: 'rgb(var(--color-accent) / <alpha-value>)',
                success: 'rgb(var(--color-success) / <alpha-value>)',
                warning: 'rgb(var(--color-warning) / <alpha-value>)',
                danger: 'rgb(var(--color-danger) / <alpha-value>)',
                bgLight: 'rgb(var(--color-bg-light) / <alpha-value>)',
                bgDark: 'rgb(var(--color-bg-dark) / <alpha-value>)',
                cardLight: 'rgb(var(--color-card-light) / <alpha-value>)',
                cardDark: 'rgb(var(--color-card-dark) / <alpha-value>)'
            },
            boxShadow: {
                soft: '0 24px 60px rgba(15, 23, 42, 0.08)',
                'soft-dark': '0 24px 60px rgba(2, 12, 27, 0.45)'
            },
            fontFamily: {
                sans: ['IBM Plex Sans', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'system-ui', 'sans-serif'],
                serif: ['IBM Plex Sans', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'system-ui', 'sans-serif'],
                mono: ['IBM Plex Mono', 'Noto Sans SC', 'ui-monospace', 'monospace'],
                display: ['IBM Plex Sans', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'system-ui', 'sans-serif'],
                label: ['IBM Plex Sans Condensed', 'IBM Plex Sans', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'system-ui', 'sans-serif']
            }
        }
    }
};
