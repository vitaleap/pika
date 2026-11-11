<template>
  <div
    class="home relative mx-auto min-h-full w-full max-w-[1280px] bg-[var(--color-bg-1)] color-text-1"
  >
    <!-- 背景：网格 + 品牌色光晕，整体自上而下渐隐 -->
    <div
      class="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[var(--color-bg-1)]"
      aria-hidden="true"
    >
      <div
        class="absolute -top-[420px] left-1/2 h-[900px] w-[1400px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,var(--home-glow),transparent_65%)] opacity-85 blur-[24px] animate-[home-breathe_16s_ease-in-out_infinite] motion-reduce:animate-none"
      ></div>
      <div
        class="absolute -top-[8%] left-1/2 h-[460px] w-[1600px] -translate-x-1/2 rotate-[-8deg] bg-[linear-gradient(90deg,transparent,var(--home-beam),transparent)] opacity-60 blur-[72px] animate-[home-drift_20s_ease-in-out_infinite] motion-reduce:animate-none"
      ></div>
      <div
        class="absolute inset-0 bg-[linear-gradient(to_right,var(--home-grid-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--home-grid-line)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_90%_62%_at_50%_0%,#000_0%,transparent_72%)] [-webkit-mask-image:radial-gradient(ellipse_90%_62%_at_50%_0%,#000_0%,transparent_72%)]"
      ></div>
    </div>

    <!-- 顶部 Header：背景层透明度跟随滚动距离渐变，避免一滚动就整块不透明 -->
    <header class="fixed inset-x-0 top-0 z-[50]">
      <div
        class="pointer-events-none absolute inset-0 border-b-1 border-[var(--home-border)] bg-[color-mix(in_srgb,var(--color-bg-1)_78%,transparent)] backdrop-blur-[16px] backdrop-saturate-150"
        :style="{ opacity: headerOpacity }"
        aria-hidden="true"
      ></div>
      <div class="relative mx-auto flex h-14 max-w-[1280px] items-center gap-6 px-5 md:px-6">
        <a
          class="inline-flex shrink-0 items-center gap-[8px] text-[16px] font-600 tracking-[0.2px] color-text-1"
          href="/"
        >
          <img
            class="home-logo w-[26px] h-[26px] rounded-[7px]"
            :src="`/images/logo-${isDark ? 'dark' : 'light'}.png`"
            alt="Pika"
          />
          <span>Pika</span>
        </a>
        <nav class="hidden pl-4 flex-1 items-center gap-[26px] md:flex">
          <a
            v-for="item in navItems"
            :key="item.href"
            class="text-[14px] font-500 color-text-2 no-underline transition-colors duration-200 hover:color-[var(--n-primary-color)]"
            :href="item.href"
            @click.prevent="scrollToSection(item.href)"
          >
            {{ t(item.key) }}
          </a>
        </nav>
        <div class="ml-auto flex shrink-0 items-center gap-[6px]">
          <theme-switch />
          <locale-switch />
          <a
            class="inline-flex size-[28px] items-center justify-center rounded-[7px] text-[18px] color-text-2 transition-colors duration-200 hover:bg-[var(--color-hover)] hover:color-[var(--n-primary-color)]"
            :href="githubUrl"
            target="_blank"
            rel="noopener"
            :aria-label="t('navGithub')"
          >
            <span class="i-mdi-github" aria-hidden="true"></span>
          </a>
        </div>
      </div>
    </header>

    <main class="relative z-1">
      <!-- Hero -->
      <section
        class="mx-auto flex min-h-[min(720px,calc(100vh-56px))] max-w-[1280px] flex-col items-center px-5 pt-[120px] pb-[72px] text-center md:px-6 md:pt-[240px] md:pb-[240px]"
      >
        <span
          class="inline-flex items-center gap-[8px] rounded-full border-1 border-[var(--home-border)] bg-[var(--home-surface)] px-[12px] py-[6px] font-mono text-[12px] tracking-[0.4px] color-text-2"
        >
          <span
            class="size-[6px] rounded-full bg-[var(--n-primary-color)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--n-primary-color)_18%,transparent)]"
          ></span>
          {{ t('heroEyebrow') }}
        </span>
        <h1
          class="mt-[28px] max-w-[900px] bg-[linear-gradient(180deg,var(--color-text-1)_32%,color-mix(in_srgb,var(--color-text-1)_62%,transparent))] bg-clip-text text-[clamp(36px,6vw,60px)] font-500 leading-[1.16] tracking-[-0.02em] text-transparent"
        >
          {{ t('heroTitle') }}
        </h1>
        <p class="mt-[24px] max-w-[660px] text-[17px] leading-[1.75] color-text-2">
          {{ t('heroDesc') }}
        </p>
        <div class="actions mt-[36px]">
          <n-button
            type="primary"
            size="large"
            tag="a"
            href="#quickstart"
            @click.prevent="scrollToSection('#quickstart')"
          >
            {{ t('heroPrimary') }}
            <template #icon>
              <span class="i-mdi-arrow-down" aria-hidden="true"></span>
            </template>
          </n-button>
          <n-button size="large" tag="a" :href="githubUrl" target="_blank" rel="noopener">
            {{ t('heroSecondary') }}
          </n-button>
        </div>
        <dl class="mt-[64px] flex flex-wrap justify-center gap-[28px]">
          <div v-for="item in heroMeta" :key="item.value" class="flex items-baseline gap-[8px]">
            <dt class="text-[12px] tracking-[0.6px] color-text-2">{{ t(item.labelKey) }}</dt>
            <dd class="font-mono text-[14px] font-600 color-text-1">{{ item.value }}</dd>
          </div>
        </dl>
      </section>

      <!-- 产品介绍 -->
      <section id="product" class="section">
        <p class="section-label">{{ t('productLabel') }}</p>
        <h2 class="section-title">{{ t('productTitle') }}</h2>
        <p class="section-desc">{{ t('productDesc') }}</p>
        <div class="card-grid grid-cols-1 md:grid-cols-3">
          <article
            v-for="item in products"
            :key="item.key"
            class="card items-center p-[32px_28px] text-center"
          >
            <span class="card-icon">
              <span :class="item.icon" aria-hidden="true"></span>
            </span>
            <p class="font-mono text-[11px] tracking-[0.55px] color-text-2">
              {{ t(`${item.key}.label`) }}
            </p>
            <h3 class="card-title">{{ t(`${item.key}.title`) }}</h3>
            <p class="card-desc">{{ t(`${item.key}.desc`) }}</p>
          </article>
        </div>
      </section>

      <!-- 内置能力 -->
      <section id="features" class="section">
        <p class="section-label">{{ t('featureLabel') }}</p>
        <h2 class="section-title">{{ t('featureTitle') }}</h2>
        <p class="section-desc">{{ t('featureDesc') }}</p>
        <div class="card-grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <article
            v-for="item in features"
            :key="item.key"
            class="card items-center p-[26px_22px] text-center"
          >
            <span class="card-icon">
              <span :class="item.icon" aria-hidden="true"></span>
            </span>
            <h3 class="card-title">{{ t(`${item.key}.title`) }}</h3>
            <p class="card-desc">{{ t(`${item.key}.desc`) }}</p>
          </article>
        </div>
      </section>

      <!-- 技术栈 -->
      <section id="stack" class="section">
        <p class="section-label">{{ t('stackLabel') }}</p>
        <h2 class="section-title">{{ t('stackTitle') }}</h2>
        <ul class="mt-[40px] grid grid-cols-1 gap-[12px] sm:grid-cols-2 lg:grid-cols-4">
          <li
            v-for="item in stacks"
            :key="item.name"
            class="flex items-center gap-[12px] rounded-[10px] border-1 border-[var(--home-border)] bg-[var(--home-surface)] p-[16px]"
          >
            <span class="text-[20px] color-text-2">
              <span :class="item.icon" aria-hidden="true"></span>
            </span>
            <span class="flex min-w-0 flex-col gap-[2px]">
              <span class="text-[14px] font-500 color-text-1">{{ item.name }}</span>
              <span class="text-[12px] color-text-2">{{ t(item.descKey) }}</span>
            </span>
          </li>
        </ul>
      </section>

      <!-- AI 协作 -->
      <section id="ai" class="section">
        <p class="section-label">{{ t('aiLabel') }}</p>
        <h2 class="section-title">{{ t('aiTitle') }}</h2>
        <p class="section-desc">{{ t('aiDesc') }}</p>
        <div
          class="mt-[48px] grid grid-cols-1 items-start gap-[28px] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-[40px]"
        >
          <ol class="m-0 flex list-none flex-col gap-[26px] p-0">
            <li v-for="(item, index) in aiPoints" :key="item.key" class="flex gap-[14px]">
              <span
                class="pt-[3px] font-mono text-[12px] text-[var(--n-primary-color)] select-none"
              >
                {{ String(index + 1).padStart(2, '0') }}
              </span>
              <div>
                <h3 class="text-[16px] font-500 leading-[1.5] color-text-1">
                  {{ t(`${item.key}.title`) }}
                </h3>
                <p class="mt-[6px] text-[14px] leading-[1.7] color-text-2">
                  {{ t(`${item.key}.desc`) }}
                </p>
              </div>
            </li>
          </ol>
          <div
            class="overflow-hidden rounded-[10px] border-1 border-[var(--home-border)] bg-[var(--home-surface)] backdrop-blur-[12px]"
          >
            <p
              class="border-b-1 border-[var(--home-border)] px-[18px] py-[12px] font-mono text-[12px] color-text-2"
            >
              {{ t('aiTreeBar') }}
            </p>
            <ul class="m-0 list-none p-[16px_18px]">
              <li
                v-for="line in aiTree"
                :key="line.path"
                class="flex items-baseline justify-between gap-[16px] font-mono text-[12.5px] leading-[2]"
              >
                <span class="truncate color-text-1">{{ line.path }}</span>
                <span class="shrink-0 color-text-2">{{ t(line.commentKey) }}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- 快速开始 -->
      <section id="quickstart" class="section">
        <p class="section-label">{{ t('startLabel') }}</p>
        <h2 class="section-title">{{ t('startTitle') }}</h2>
        <p class="section-desc">{{ t('startDesc') }}</p>
        <div class="card-grid grid-cols-1 md:grid-cols-2">
          <article
            v-for="item in startCards"
            :key="item.key"
            class="card items-start p-[32px_28px] text-left"
          >
            <h3 class="card-title">{{ t(`${item.key}.title`) }}</h3>
            <p class="card-desc">{{ t(`${item.key}.desc`) }}</p>
            <div
              class="mt-[14px] w-full rounded-[8px] border-1 border-[var(--home-border)] bg-[var(--home-code-bg)] px-[18px] py-[16px] font-mono text-[13px]"
            >
              <p v-for="line in item.lines" :key="line" class="flex gap-[8px] leading-[1.9]">
                <span class="select-none text-[var(--n-primary-color)]">$</span>
                <span class="color-text-1">{{ line }}</span>
              </p>
            </div>
          </article>
        </div>
      </section>

      <!-- 底部 CTA -->
      <section
        class="mx-auto flex max-w-[1280px] flex-col items-center px-5 pt-[64px] pb-[88px] text-center md:px-6 md:pt-[88px] md:pb-[112px]"
      >
        <h2 class="section-title">{{ t('ctaTitle') }}</h2>
        <p class="mt-[16px] max-w-[560px] text-[16px] leading-[1.7] color-text-2">
          {{ t('ctaDesc') }}
        </p>
        <div class="actions mt-[36px]">
          <n-button type="primary" size="large" tag="a" href="/dashboard">
            {{ t('ctaPrimary') }}
          </n-button>
          <n-button size="large" tag="a" :href="githubUrl" target="_blank" rel="noopener">
            {{ t('ctaSecondary') }}
          </n-button>
        </div>
      </section>
    </main>

    <footer class="relative z-1 border-t-1 border-[var(--home-border)]">
      <div
        class="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-[12px] px-5 py-[28px] text-[13px] color-text-2 md:px-6"
      >
        <span class="inline-flex items-center gap-[10px] font-600 color-text-2">
          <img
            class="home-logo w-[20px] h-[20px] rounded-[6px]"
            :src="`/images/logo-${isDark ? 'dark' : 'light'}.png`"
            alt="Pika"
          />
          Pika
          <span class="font-400 color-text-2">{{ t('footerTagline') }}</span>
        </span>
        <span class="inline-flex items-center gap-[10px]">
          {{ t('footerCopyright', { year }) }}
          <span class="size-[3px] rounded-full bg-[var(--color-text-2)]"></span>
          <a
            class="color-text-2 no-underline hover:color-[var(--n-primary-color)]"
            :href="githubUrl"
            target="_blank"
            rel="noopener"
          >
            {{ t('footerGithub') }}
          </a>
        </span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

definePage({
  meta: {
    authRequired: false,
    layout: 'empty',
  },
})

const { isDark } = storeToRefs(useThemeStore())

// 脚手架仓库地址，可按需替换
const githubUrl = 'https://github.com/vitaleap/pika'
const year = new Date().getFullYear()

// 顶栏背景在滚过 HEADER_FADE_DISTANCE 距离内由透明渐变到实色
const HEADER_FADE_DISTANCE = 180
const headerOpacity = ref(0)
const handleScroll = () => {
  headerOpacity.value = Math.min(1, window.scrollY / HEADER_FADE_DISTANCE)
}
onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  handleScroll()
})
onUnmounted(() => window.removeEventListener('scroll', handleScroll))

// 锚点跳转改为平滑滚动，偏移量由 .section 的 scroll-margin-top 提供
const scrollToSection = (hash: string) => {
  const target = document.querySelector(hash)
  if (!target) return
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  // 保留 vue-router 写入的 history state，仅替换 hash
  history.replaceState(history.state, '', hash)
}

const navItems = [
  { key: 'navProduct', href: '#product' },
  { key: 'navFeatures', href: '#features' },
  { key: 'navStack', href: '#stack' },
  { key: 'navAi', href: '#ai' },
  { key: 'navStart', href: '#quickstart' },
] as const

const heroMeta = [
  { labelKey: 'heroMetaRuntime', value: 'Bun' },
  { labelKey: 'heroMetaServer', value: 'Elysia' },
  { labelKey: 'heroMetaClient', value: 'Vue 3' },
  { labelKey: 'heroMetaDatabase', value: 'PostgreSQL / PGlite' },
] as const

const products = [
  { key: 'productRuntime', icon: 'i-mdi-flash-outline' },
  { key: 'productModule', icon: 'i-mdi-package-variant-closed' },
  { key: 'productTypes', icon: 'i-mdi-code-braces' },
] as const

const features = [
  { key: 'featureAuth', icon: 'i-mdi-shield-key-outline' },
  { key: 'featureRateLimit', icon: 'i-mdi-speedometer' },
  { key: 'featureOpenapi', icon: 'i-mdi-file-document-outline' },
  { key: 'featureTheme', icon: 'i-mdi-translate' },
] as const

const stacks = [
  { name: 'Bun', icon: 'i-mdi-lambda', descKey: 'stackBun' },
  { name: 'Elysia', icon: 'i-mdi-server-network', descKey: 'stackElysia' },
  { name: 'Vue 3', icon: 'i-mdi-vuejs', descKey: 'stackVue' },
  { name: 'Naive UI', icon: 'i-mdi-palette-swatch-outline', descKey: 'stackNaive' },
  { name: 'UnoCSS', icon: 'i-mdi-language-css3', descKey: 'stackUno' },
  { name: 'Drizzle', icon: 'i-mdi-table-large', descKey: 'stackDrizzle' },
  { name: 'PostgreSQL', icon: 'i-mdi-database-outline', descKey: 'stackPostgres' },
  { name: 'OpenAPI', icon: 'i-mdi-api', descKey: 'stackOpenapi' },
] as const

// AI 协作相关的说明与文档结构（路径均来自仓库真实文件）
const aiPoints = [
  { key: 'aiPointAgents' },
  { key: 'aiPointDocs' },
  { key: 'aiPointSkills' },
  { key: 'aiPointVerify' },
] as const

const aiTree = [
  { path: 'AGENTS.md', commentKey: 'aiTreeRoot' },
  { path: 'apps/server/AGENTS.md', commentKey: 'aiTreeServer' },
  { path: 'apps/web/AGENTS.md', commentKey: 'aiTreeWeb' },
  { path: 'packages/AGENTS.md', commentKey: 'aiTreePackages' },
  { path: '.agents/docs/server/modules.md', commentKey: 'aiTreeDocs' },
  { path: '.agents/docs/web/i18n.md', commentKey: 'aiTreeDocs' },
  { path: '.agents/skills/karpathy-guidelines', commentKey: 'aiTreeSkills' },
] as const

const startCards = [
  { key: 'startDev', lines: ['bun install', 'bun run dev'] },
  { key: 'startBuild', lines: ['bun run check', 'bun run build'] },
] as const
</script>

<!-- UnoCSS 的动画工具类只引用关键帧名称，关键帧需要在非 scoped 样式中定义才能被引用到 -->
<style>
@keyframes home-breathe {
  0%,
  100% {
    opacity: 0.85;
    translate: -50% 0;
    scale: 1;
  }
  50% {
    opacity: 1;
    translate: -50% 0;
    scale: 1.06;
  }
}
@keyframes home-drift {
  0%,
  100% {
    opacity: 0.5;
    translate: -50% 0;
  }
  50% {
    opacity: 0.8;
    translate: -50% 48px;
  }
}
</style>

<style scoped lang="scss">
// 页面主题 token：亮色与暗色的取值集中在这里定义，元素上通过 UnoCSS 原子类引用
.home {
  --home-border: rgba(15, 23, 42, 0.08);
  --home-surface: rgba(255, 255, 255, 0.72);
  --home-code-bg: rgba(15, 23, 42, 0.04);
  --home-grid-line: rgba(15, 23, 42, 0.05);
  --home-glow: color-mix(in srgb, var(--n-primary-color) 14%, transparent);
  --home-beam: color-mix(in srgb, var(--n-primary-color) 20%, transparent);
}
html[theme-mode='dark'] .home {
  --home-border: rgba(255, 255, 255, 0.08);
  --home-surface: rgba(255, 255, 255, 0.02);
  --home-code-bg: rgba(255, 255, 255, 0.04);
  --home-grid-line: rgba(255, 255, 255, 0.045);
  --home-glow: color-mix(in srgb, var(--n-primary-color) 26%, transparent);
  --home-beam: color-mix(in srgb, var(--n-primary-color) 30%, transparent);
}

// 以下为重复出现的原子类组合，用 @apply 抽成语义类
.section {
  @apply mx-auto max-w-[1280px] px-5 py-[56px] md:px-6 md:py-[72px];
  // 锚点滚动时给固定顶栏留出空间
  scroll-margin-top: 72px;
}
.section-label {
  @apply font-mono text-[12px] font-600 tracking-[0.9px] text-[var(--n-primary-color)] uppercase;
}
.section-title {
  @apply mt-[16px] max-w-[820px] text-[clamp(26px,3.4vw,40px)] font-500 leading-[1.28] tracking-[-0.02em] color-text-1;
}
.section-desc {
  @apply mt-[16px] max-w-[820px] text-[16px] leading-[1.7] color-text-2;
}
// 抽离时只放不会被元素覆盖的属性：列数、对齐等由元素上的原子类给出，
// 否则 scoped 会给 @apply 类额外加上属性选择器，优先级高于元素上的原子类
.card-grid {
  @apply mt-[48px] grid gap-[20px];
}
.card {
  @apply flex flex-col gap-[10px] rounded-[10px] border-1 border-[var(--home-border)] bg-[var(--home-surface)] backdrop-blur-[12px] transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--n-primary-color)_42%,var(--home-border))];
}
.card-icon {
  @apply mb-[6px] inline-flex size-[40px] items-center justify-center rounded-[10px] border-1 border-[var(--home-border)] text-[20px] text-[var(--n-primary-color)];
}
.card-title {
  @apply text-[18px] font-500 leading-[1.5] color-text-1;
}
.card-desc {
  @apply text-[14px] leading-[1.7] color-text-2;
}
.actions {
  @apply flex flex-wrap justify-center gap-[12px];
}
</style>

<i18n lang="yaml">
zh:
  navGithub: GitHub 仓库
  navProduct: 产品能力
  navFeatures: 内置能力
  navStack: 技术栈
  navAi: AI 协作
  navStart: 快速开始
  heroEyebrow: Pika · 开发者脚手架
  heroTitle: 全栈脚手架，开箱即用
  heroDesc: 基于 Bun、Elysia 与 Vue 3 的全栈脚手架，前后端共享 TypeScript 类型，内置认证、限流、OpenAPI、主题与国际化，工程结构可直接用于生产。
  heroPrimary: 快速开始
  heroSecondary: 查看源码
  heroMetaRuntime: 运行时
  heroMetaServer: 服务端
  heroMetaClient: 前端
  heroMetaDatabase: 数据库
  productLabel: PIKA = BUN + ELYSIA + VUE
  productTitle: 团队专注业务，工程化交给脚手架
  productDesc: 目录约定、类型同步、鉴权、限流、接口文档等重复工作，均已在脚手架中配置完成。
  productRuntime:
    label: ONE RUNTIME
    title: 统一运行时
    desc: 开发、构建、测试与包管理共用一套 Bun 工具链，apps 与 packages 通过 workspace 依赖相互引用。
  productModule:
    label: MODULAR SERVER
    title: 模块化服务端
    desc: system 模块维护 routes、repositories、schemas、services 与 locales，新增业务模块只需复制既有目录。
  productTypes:
    label: SHARED TYPES
    title: 共享类型
    desc: 类型与校验集中在 {'@'}pika/shared，前后端引用同一份定义，接口字段变更可在编译期发现。
  featureLabel: CAPABILITIES
  featureTitle: 常用能力均已内置
  featureDesc: 无需为每个新项目重复实现。
  featureAuth:
    title: 认证与权限
    desc: JWT、验证码与权限校验开箱即用，登录、注册、找回密码流程均已实现。
  featureRateLimit:
    title: 多窗口限流
    desc: 支持按秒、分钟、小时组合限流，接口保护只需一行配置。
  featureOpenapi:
    title: 接口即文档
    desc: 服务端路由直接产出 OpenAPI，前端请求代码自动生成，避免手写字段带来的错误。
  featureTheme:
    title: 主题与国际化
    desc: 明暗主题与中英双语已接入，页面文案在各自文件中就近维护。
  stackLabel: TECH STACK
  stackTitle: 站在成熟的生态之上
  stackBun: 运行时与包管理
  stackElysia: 服务端框架
  stackVue: 前端框架
  stackNaive: UI 组件库
  stackUno: 原子化 CSS
  stackDrizzle: ORM
  stackPostgres: 关系型数据库
  stackOpenapi: 接口文档
  aiLabel: AI CODING
  aiTitle: 面向 AI 协作的文档体系
  aiDesc: 根目录的 AGENTS.md 给出全局约定与索引，具体规范按主题拆分在 .agents/docs 中，Agent 只读取与当前任务相关的部分。
  aiTreeBar: Agent 读取的文档结构
  aiTreeRoot: 全局约定
  aiTreeServer: 服务端
  aiTreeWeb: 前端
  aiTreePackages: 公共包
  aiTreeDocs: 按需展开
  aiTreeSkills: 工作流
  aiPointAgents:
    title: 分层 AGENTS.md
    desc: 根目录定义全局约定与常用命令，apps 与 packages 各自维护目录内的规范，Agent 按所在层级读取对应说明。
  aiPointDocs:
    title: 渐进式披露
    desc: AGENTS.md 只保留全局约定与索引，模块、路由、服务、国际化等细节以链接指向 .agents/docs，按任务需要展开，用更少的上下文换来更贴合约定的改动。
  aiPointSkills:
    title: 项目级技能
    desc: .agents/skills 内置可直接加载的 Agent Skills（karpathy-guidelines 编码准则、code-simplifier 代码简化），把改动范围、简化标准等工程习惯固化为可复用的判断。
  aiPointVerify:
    title: 可自验证闭环
    desc: bun run check（全仓类型与格式）与 bun run test（集成测试）让 Agent 改完即可自行验证。
  startLabel: QUICKSTART
  startTitle: 几条命令即可开始开发
  startDesc: 克隆后无需额外配置，Bun 自动读取 .env；数据库可连接 PostgreSQL，也可使用内置 PGlite 在本地运行。
  startDev:
    title: 本地开发
    desc: 安装依赖并同时启动 Web 与 API，默认端口 9527 与 9528。
  startBuild:
    title: 检查与构建
    desc: check 负责格式与类型检查，build 产出 Web 与服务端产物。
  ctaTitle: 从这个脚手架开始
  ctaDesc: 重复的工程化配置交给 Pika，把时间留给业务本身。
  ctaPrimary: 进入控制台
  ctaSecondary: 查看源码
  footerTagline: 全栈 TypeScript 脚手架
  footerCopyright: '© {year} Pika · MIT License'
  footerGithub: GitHub
en:
  navGithub: GitHub repository
  navProduct: Product
  navFeatures: Features
  navStack: Stack
  navAi: AI coding
  navStart: Quickstart
  heroEyebrow: Pika · Developer scaffold
  heroTitle: A full-stack scaffold, ready out of the box
  heroDesc: Built on Bun, Elysia and Vue 3, with TypeScript types shared end to end and auth, rate limiting, OpenAPI, theming and i18n included. The structure is ready for production.
  heroPrimary: Quickstart
  heroSecondary: View source
  heroMetaRuntime: Runtime
  heroMetaServer: Server
  heroMetaClient: Client
  heroMetaDatabase: Database
  productLabel: PIKA = BUN + ELYSIA + VUE
  productTitle: The scaffold owns the plumbing, your team owns the product
  productDesc: Directory conventions, shared types, auth, rate limiting and API documentation are already configured.
  productRuntime:
    label: ONE RUNTIME
    title: One runtime
    desc: Development, builds, tests and package management share one Bun toolchain, with apps and packages linked through workspaces.
  productModule:
    label: MODULAR SERVER
    title: Modular server
    desc: The system module keeps its own routes, repositories, schemas, services and locales; a new module starts as a copied folder.
  productTypes:
    label: SHARED TYPES
    title: Shared types
    desc: Types and validation live in {'@'}pika/shared, so both sides read one definition and field changes surface at compile time.
  featureLabel: CAPABILITIES
  featureTitle: Common capabilities, already included
  featureDesc: Nothing has to be rebuilt for each new project.
  featureAuth:
    title: Auth and permissions
    desc: JWT, captcha and permission checks are in place, with sign-in, sign-up and password recovery implemented.
  featureRateLimit:
    title: Multi-window rate limiting
    desc: Per-second, per-minute and per-hour limits combine in a single line of configuration.
  featureOpenapi:
    title: Routes as documentation
    desc: Elysia routes emit OpenAPI directly and client request code is generated, removing hand-written field errors.
  featureTheme:
    title: Theming and i18n
    desc: Light and dark themes plus Chinese and English, with copy maintained next to the code that uses it.
  stackLabel: TECH STACK
  stackTitle: Standing on proven ecosystems
  stackBun: Runtime and package manager
  stackElysia: Server framework
  stackVue: Front-end framework
  stackNaive: UI components
  stackUno: Atomic CSS
  stackDrizzle: ORM
  stackPostgres: Relational database
  stackOpenapi: API documentation
  aiLabel: AI CODING
  aiTitle: Documentation built for AI collaboration
  aiDesc: The root AGENTS.md provides global conventions and an index, while topic-specific rules are split under .agents/docs, so an agent reads only what the current task requires.
  aiTreeBar: What an agent reads
  aiTreeRoot: Global conventions
  aiTreeServer: Server
  aiTreeWeb: Web
  aiTreePackages: Packages
  aiTreeDocs: Read on demand
  aiTreeSkills: Workflows
  aiPointAgents:
    title: Layered AGENTS.md
    desc: The root file defines global conventions and commands, while apps and packages keep their own rules. An agent reads the layer it works in.
  aiPointDocs:
    title: Progressive disclosure
    desc: AGENTS.md keeps only global conventions and an index; details on modules, routes, services and i18n live behind links to .agents/docs and open only when a task needs them, trading less context for edits that fit existing conventions.
  aiPointSkills:
    title: Project-level skills
    desc: .agents/skills ships loadable Agent Skills (karpathy-guidelines for coding discipline, code-simplifier for simplification), turning habits such as change scope and simplification standards into reusable judgement.
  aiPointVerify:
    title: Self-verifiable loop
    desc: bun run check (types and formatting across the repo) and bun run test (integration tests) let an agent verify its own changes.
  startLabel: QUICKSTART
  startTitle: Up and running in a few commands
  startDesc: No extra configuration after cloning. Bun loads .env automatically; the database runs on PostgreSQL or the bundled PGlite.
  startDev:
    title: Local development
    desc: Install dependencies and start web and API together on ports 9527 and 9528.
  startBuild:
    title: Checks and build
    desc: check covers formatting and types, build emits the web and server artifacts.
  ctaTitle: Start from this scaffold
  ctaDesc: Leave the repetitive setup to Pika and spend the time on the product itself.
  ctaPrimary: Open dashboard
  ctaSecondary: View source
  footerTagline: Full-stack TypeScript scaffold
  footerCopyright: '© {year} Pika · MIT License'
  footerGithub: GitHub
</i18n>
