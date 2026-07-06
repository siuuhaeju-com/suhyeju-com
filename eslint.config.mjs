// ESLint 9 Flat Config
// 팀이 작성하는 JS/TS 코드에 적용된다. (프레임워크 도입 시 여기에 플러그인 추가)
import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  // 검사 제외 경로
  {
    ignores: [
      'node_modules/',
      '.venv/',
      'dist/',
      'build/',
      'coverage/',
      '**/.next/**',
      '**/out/**',
      '**/next-env.d.ts',
    ],
  },
  // 권장 규칙
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
  // Prettier와 충돌하는 포맷 규칙 비활성화 (반드시 마지막)
  prettier,
];
