import { defineConfig, presetIcons, presetWind4, transformerDirectives } from 'unocss'

export default defineConfig({
  transformers: [transformerDirectives()],
  extendTheme: (theme: any) => {
    return { ...theme, breakpoint: { ...theme.breakpoint, xs: '30rem' } }
  },
  presets: [
    presetWind4({
      dark: {
        dark: '[theme-mode="dark"]',
      },
    }),
    // https://yesicon.app/mdi or https://icon-sets.iconify.design/mdi/
    presetIcons({
      warn: true,
      extraProperties: {
        display: 'inline-block',
        'flex-shrink': '0',
      },
      collections: {
        // https://iconify.ayaka.io/collection/%40proj-airi/lobe-icons
        // support class="i-lobe:claude" or class="i-lobe-claude"
        lobe: () => import('@proj-airi/lobe-icons/dist/icons.json').then((i) => i.default),
      },
    }),
  ],
  shortcuts: {
    'color-text-1': 'color-[var(--color-text-1)]',
    'color-text-2': 'color-[var(--color-text-2)]',
    'color-text-3': 'color-[var(--color-text-3)]',
    'color-bg-1': 'bg-[var(--color-bg-1)]',
    'color-bg-2': 'bg-[var(--color-bg-2)]',
    'color-bg-3': 'bg-[var(--color-bg-3)]',
    'color-bg-4': 'bg-[var(--color-bg-4)]',
    'color-1': 'color-[var(--color-text-1)]',
    'color-2': 'color-[var(--color-text-2)]',
    'color-3': 'color-[var(--color-text-3)]',
    'bg-1': 'bg-[var(--color-bg-1)]',
    'bg-2': 'bg-[var(--color-bg-2)]',
    'bg-3': 'bg-[var(--color-bg-3)]',
    'bg-4': 'bg-[var(--color-bg-4)]',
    'is-hover': 'hover:bg-[var(--color-hover)]! active:bg-[var(--color-active)]!',
  },
})
