/**
 * commit-and-tag-version 配置
 * @see https://github.com/conventional-changelog/conventional-changelog-config-spec/
 */

/**
 * 单个 commit type 在 CHANGELOG 中的呈现方式
 * @typedef {object} CommitType
 * @property {string} type 匹配 conventional commits 的 type
 * @property {string} [section] 在 CHANGELOG 中的分组标题
 * @property {boolean} [hidden] 为 true 时不写入 CHANGELOG
 */

/**
 * 生命周期钩子, 命令返回非 0 退出码即中止发版, `--dry-run` 下不会执行
 * @typedef {object} VersionScripts
 * @property {string} [prerelease] bump 流程最开始执行
 * @property {string} [prebump] 计算新版本号之前执行, 此时尚未修改任何文件, 适合做发版前置校验；stdout 为合法 semver 时会被当作 releaseAs
 * @property {string} [postbump] 版本号写入 bumpFiles 之后、生成 CHANGELOG 之前执行, 适合刷新 lock 等派生文件
 * @property {string} [prechangelog] 生成 CHANGELOG 之前执行
 * @property {string} [postchangelog] 生成 CHANGELOG 之后执行
 * @property {string} [precommit] release commit 之前执行, stdout 可作为 commit message 模板
 * @property {string} [postcommit] release commit 之后执行
 * @property {string} [pretag] 打 tag 之前执行
 * @property {string} [posttag] 打 tag 之后执行
 * @property {string} [prepublish] 发布到 npm 之前执行
 * @property {string} [postpublish] 发布到 npm 之后执行
 */

/**
 * @typedef {object} VersionConfig
 * @property {CommitType[]} types 显式支持的 commit type, 未列出的 type 会被直接丢弃
 * @property {VersionScripts} [scripts] 生命周期钩子
 */

/** @type {VersionConfig} */
export default {
  types: [
    { type: 'feat', section: '🎉 Features' },
    { type: 'fix', section: '🐛 Fixes' },
    { type: 'perf', section: '🚀 Performance' },
    { type: 'refactor', section: '♻️ Refactors' },
    { type: 'build', section: '📦 Build' },
    { type: 'revert', section: '⏪ Reverts' },
    { type: 'chore', hidden: true },
    { type: 'docs', hidden: true },
    { type: 'style', hidden: true },
    { type: 'test', hidden: true },
    { type: 'ci', hidden: true },
  ],
  scripts: {
    // 确保工作区干净, 否则中止发版, 避免 release commit 混入无关改动
    prebump: `bun -e "process.exit(Bun.spawnSync(['git','status','--porcelain']).stdout.byteLength ? 1 : 0)"`,
  },
}
