/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./*.{html,js}",
        "./components/*.{html,js}",
        "./api/_handlers/*.js",
    ],
    safelist: [
        // Responsive nav classes used in dynamically generated HTML
        'hidden', 'md:flex', 'md:hidden',
        'lg:flex', 'lg:hidden', 'lg:w-2/3', 'lg:w-1/3', 'lg:flex-row',
        'sm:block',
        // Animation & transition
        'animate-ping', 'animate-pulse',
        'translate-x-full', 'transition-transform', 'duration-500',
        // Layout
        'flex-1', 'items-center', 'justify-between', 'space-x-3',
        'gap-6', 'gap-3', 'gap-2',
        // Colors dynamically applied
        'text-orange-600', 'font-black',
        'bg-white/95', 'backdrop-blur-xl',
        'overflow-x-auto', 'no-scrollbar', 'whitespace-nowrap',
        // Live button
        'bg-indigo-950', 'shadow-indigo-100',
        // Mobile menu
        'fixed', 'inset-0', 'z-[200]', 'overflow-y-auto',
        // Ticker
        'overflow-hidden', 'ticker-mask', 'ticker-animate',
        // Grid
        'grid-cols-2', 'col-span-full',
    ],
    theme: {
        extend: {},
    },
    plugins: [
        require('@tailwindcss/typography'),
    ],
}
