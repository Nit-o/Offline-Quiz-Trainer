/* ESLint 扁平配置（适用于 ESLint ≥ 9）。
   index.html 的 JS 是内联的，因此先运行 `npm run extract:js` 抽出到 .tmp-lint/ 再检查：
       npm run extract:js && npx eslint .tmp-lint/inline-module.mjs
   依赖未随仓库安装（离线环境无法拉到 npm registry），需要时执行：
       pnpm add -D eslint globals

   规则取向：这份代码是"单文件、无构建、以注释解释决策"的风格，故只保留能抓真实缺陷的规则
   （未定义变量、未使用变量、可疑比较等），不引入格式化类规则（交给 Prettier）。 */
export default [
    {
        files: ['.tmp-lint/**/*.mjs'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: {
                window: 'readonly', document: 'readonly', location: 'readonly',
                navigator: 'readonly', console: 'readonly', localStorage: 'readonly',
                performance: 'readonly', requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
                setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
                Blob: 'readonly', File: 'readonly', FileReader: 'readonly', URL: 'readonly',
                TextDecoder: 'readonly', Uint8Array: 'readonly', confirm: 'readonly', alert: 'readonly',
                atob: 'readonly', btoa: 'readonly', globalThis: 'readonly',
                CapacitorBridge: 'readonly',
            },
        },
        rules: {
            'no-undef': 'error',
            'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
            'no-dupe-keys': 'error',
            'no-dupe-class-members': 'error',
            'no-duplicate-case': 'error',
            'no-unreachable': 'error',
            'no-cond-assign': ['error', 'except-parens'],
            'no-constant-condition': ['error', { checkLoops: false }],
            'no-empty': ['warn', { allowEmptyCatch: true }],
            'no-fallthrough': 'error',
            'no-self-assign': 'error',
            'no-self-compare': 'error',
            'no-template-curly-in-string': 'warn',
            'require-atomic-updates': 'warn',
            eqeqeq: ['warn', 'smart'],
            'no-var': 'error',
            'prefer-const': 'warn',
        },
    },
    {
        ignores: ['node_modules/**', 'dist/**', 'android/**', '.tmp-fsrs/**', 'vendor/**', 'native-plugins/**/dist/**'],
    },
];
