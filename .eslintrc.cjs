// https://docs.expo.dev/guides/using-eslint/
//
// Discipline Loop Non-Negotiables enforced via ESLint:
//   NN #11 AI Studio Lane   -> no-console (except warn/error)
//   NN #18 Error Handling   -> no-empty (no empty catch {})
//   NN #21 TypeScript Strict -> no-explicit-any (error), ban-ts-comment (requires description)
//   NN #24 Accessibility    -> react-native-a11y/* (static, prescribed by SOP 64; RN equivalent of jsx-a11y)
// Rules start as <warn> to calibrate false positives during Wave 3.1.
// When PROFILE=LAUNCH/PROD, the gate must run these rules as 'error'.
//
// Mobile uses legacy ESLint (.eslintrc.cjs) because eslint-config-expo 55 does not
// support flat config yet. Same rules as web/desktop, legacy syntax.
module.exports = {
  extends: ['expo', 'plugin:react-native-a11y/all'],
  plugins: ['react-native-a11y'],
  ignorePatterns: ['/dist/*', '/tools/*'],
  rules: {
    // Optional dependencies (firebase, supabase, async-storage, llm providers)
    // are installed only when the user configures their backend/providers.
    // tsc --noEmit catches truly broken imports; lint should not block on optional SDKs.
    'import/no-unresolved': 'off',
    // Discipline Loop NN #18 Error Handling Discipline
    'no-empty': ['error', { allowEmptyCatch: false }],
    // Discipline Loop NN #11 AI Studio Lane / logging discipline
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    // Discipline Loop NN #21 TypeScript Strictness
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/ban-ts-comment': [
      'error',
      {
        'ts-expect-error': { descriptionFormat: '^: .+$' },
        'ts-ignore': true,
        'ts-nocheck': true,
        'ts-check': false,
        minimumDescriptionLength: 10,
      },
    ],
    // NN #24 Accessibility (SOP 64), critical RN rules
    'react-native-a11y/has-accessibility-hint': 'off', // hint is optional
    'react-native-a11y/has-accessibility-props': 'error',
    'react-native-a11y/has-valid-accessibility-role': 'error',
    'react-native-a11y/has-valid-accessibility-state': 'error',
    'react-native-a11y/no-nested-touchables': 'error',
  },
  overrides: [
    {
      // tests/ may use console freely (tools/ is already in ignorePatterns)
      files: ['tests/**/*.{js,ts,tsx}'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};
