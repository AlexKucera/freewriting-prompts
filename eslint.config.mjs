import globals from 'globals';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    // Ignore patterns (replaces .eslintignore)
    {
        ignores: [
            'node_modules/**',
            'main.js',
            'dist/**',
            '*.config.js',
            '*.config.mjs'
        ]
    },
    // Base ESLint recommended rules
    eslint.configs.recommended,
    // TypeScript ESLint recommended rules
    ...tseslint.configs.recommended,
    // Type-aware rules (requires tsconfig.json)
    ...tseslint.configs.recommendedTypeChecked,
    // Project-specific configuration
    {
        files: ['**/*.ts'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                sourceType: 'module',
                ecmaVersion: 'latest',
                project: ['./tsconfig.json']
            },
            globals: {
                ...globals.node,
                ...globals.browser
            }
        },
        plugins: {
            '@typescript-eslint': tseslint.plugin
        },
        rules: {
            // Disable base rule in favor of TypeScript version
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['error', { args: 'none' }],
            '@typescript-eslint/ban-ts-comment': 'off',
            'no-prototype-builtins': 'off',
            '@typescript-eslint/no-empty-function': 'off'
        }
    }
);
