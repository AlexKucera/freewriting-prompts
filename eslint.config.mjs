import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    // Ignore patterns (replaces .eslintignore)
    {
        ignores: [
            'node_modules/**',
            'main.js',
            '*.config.js',
            '*.config.mjs'
        ]
    },
    // Base ESLint recommended rules
    eslint.configs.recommended,
    // TypeScript ESLint recommended rules
    ...tseslint.configs.recommended,
    // Project-specific configuration
    {
        files: ['**/*.ts'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                sourceType: 'module',
                ecmaVersion: 2020
            },
            globals: {
                // Node.js globals
                console: 'readonly',
                process: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                Buffer: 'readonly',
                setImmediate: 'readonly',
                clearImmediate: 'readonly'
            }
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
