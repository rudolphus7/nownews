/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./*.{html,js}",
        "./components/*.{html,js}",
        "./api/_handlers/*.js",
    ],
    safelist: [
        // ── Responsive display (md:flex, md:hidden, lg:flex etc.) ──
        { pattern: /^(block|flex|grid|hidden|inline|inline-flex|inline-block)$/, variants: ['sm', 'md', 'lg'] },
        { pattern: /^flex-(row|col|wrap|1|shrink|shrink-0)$/ },
        { pattern: /^(shrink|shrink-0|grow|grow-0)$/ },

        // ── Responsive width ──
        { pattern: /^w-(full|screen|auto|px|1\/2|1\/3|2\/3|1\/4|3\/4|\d+)$/, variants: ['md', 'lg'] },
        { pattern: /^(min|max)-w-(full|screen|0|none|xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)$/ },

        // ── Align & Justify ──
        { pattern: /^(items|justify|self)-(start|end|center|between|around|evenly|stretch)$/ },

        // ── Gap & Spacing ──
        { pattern: /^gap-(\d+|px)$/ },
        { pattern: /^(space-x|space-y)-(\d+)$/ },
        { pattern: /^(p|px|py|pt|pb|pl|pr)-(\d+(\.\d+)?)$/, variants: ['sm', 'md'] },
        { pattern: /^(m|mx|my|mt|mb|ml|mr)-(\d+|auto)$/ },

        // ── Typography ──
        { pattern: /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/, variants: ['sm', 'md', 'lg'] },
        { pattern: /^font-(thin|light|normal|medium|semibold|bold|extrabold|black)$/ },
        { pattern: /^tracking-(tighter|tight|normal|wide|wider|widest)$/ },
        { pattern: /^leading-(none|tight|snug|normal|relaxed|loose|\d)$/ },
        { pattern: /^(uppercase|lowercase|capitalize|italic|not-italic)$/ },
        { pattern: /^(line-clamp|truncate)(-\d+)?$/ },

        // ── Text colors ──
        { pattern: /^text-(slate|orange|red|indigo|white|gray|green|blue|amber|zinc)-(50|100|200|300|400|500|600|700|800|900|950)$/ },
        { pattern: /^text-(white|black|transparent|current)$/ },

        // ── Background colors ──
        { pattern: /^bg-(slate|orange|red|indigo|green|gray|amber|zinc|yellow|white|black)-(50|100|200|300|400|500|600|700|800|900|950)$/ },
        { pattern: /^bg-(white|black|transparent)$/ },
        // opacity-modified backgrounds like bg-white/95
        { pattern: /^bg-\w+\/(5|10|20|30|40|50|60|70|80|90|95)$/ },

        // ── Border ──
        { pattern: /^(border|border-t|border-b|border-l|border-r|border-x|border-y)(-\d+)?$/ },
        { pattern: /^border-(slate|orange|red|white|indigo)-(50|100|200|300|400|500|600|700|800|900)$/ },
        { pattern: /^border-\w+\/(5|10|20)$/ },
        { pattern: /^rounded(-none|-sm|-md|-lg|-xl|-2xl|-3xl|-full)?$/ },

        // ── Shadows ──
        { pattern: /^shadow(-sm|-md|-lg|-xl|-2xl|-inner|-none)?$/ },
        { pattern: /^shadow-(slate|orange|indigo|red)-\d+(\/\d+)?$/ },

        // ── Position + Z-index ──
        { pattern: /^(static|fixed|absolute|relative|sticky)$/ },
        { pattern: /^(top|bottom|left|right|inset)-(\d+|auto|full|px)$/ },
        { pattern: /^z-(\d+)$/ },
        // arbitrary z-index values
        'z-[100]', 'z-[200]',

        // ── Overflow ──
        { pattern: /^overflow(-x|-y)?-(auto|hidden|scroll|visible)$/ },
        'overflow-x-auto', 'whitespace-nowrap',

        // ── Transition & Animation ──
        { pattern: /^transition(-all|-colors|-transform|-opacity|-shadow)?$/ },
        { pattern: /^duration-(\d+)$/ },
        { pattern: /^ease-(linear|in|out|in-out)$/ },
        { pattern: /^animate-(ping|pulse|spin|bounce|none)$/ },
        { pattern: /^translate-(x|y)-(0|full|px|\d+)$/ },
        '-translate-x-full', 'translate-x-full',
        { pattern: /^(scale|rotate)-(\d+)$/ },
        { pattern: /^delay-(\d+)$/ },

        // ── Opacity ──
        { pattern: /^opacity-(0|5|10|20|30|40|50|60|70|75|80|90|95|100)$/ },

        // ── Backdrop ──
        { pattern: /^backdrop-blur(-sm|-md|-lg|-xl|-2xl|-3xl|-none)?$/ },

        // ── Cursor ──
        'cursor-pointer', 'cursor-default', 'cursor-not-allowed',

        // ── Object & Aspect ──
        { pattern: /^object-(cover|contain|fill|none|scale-down)$/ },
        { pattern: /^aspect-(auto|square|video)$/ },

        // ── Grid ──
        { pattern: /^grid-cols-(\d+)$/ },
        { pattern: /^col-span-(\d+|full)$/ },

        // ── Display misc ──
        'no-scrollbar',
        { pattern: /^(pointer-events)-(none|auto)$/ },

        // ── Indigo-950 (not in Tailwind default palette for older versions) ──
        'bg-indigo-950',

        // ── Specific animated classes in ticker/header ──
        'ticker-mask', 'ticker-animate',

        // ── Hover variants of common classes ──
        { pattern: /^(text|bg|border)-(slate|orange|red|indigo|white)-(100|200|300|400|500|600|700|800|900)$/, variants: ['hover', 'active', 'focus', 'group-hover'] },
        { pattern: /^(scale|rotate|translate-x|translate-y)-(\d+|full)$/, variants: ['hover', 'group-hover'] },
        { pattern: /^(opacity)-(0|100)$/, variants: ['hover', 'group-hover'] },
    ],
    theme: {
        extend: {},
    },
    plugins: [
        require('@tailwindcss/typography'),
    ],
}
