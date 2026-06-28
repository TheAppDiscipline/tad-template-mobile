// https://docs.expo.dev/guides/using-eslint/
//
// Discipline Loop Non-Negotiables enforced via ESLint:
//   NN #11 AI Studio Lane   -> no-console (salvo warn/error)
//   NN #18 Error Handling   -> no-empty (no catch {} vacios)
//   NN #21 TypeScript Strict -> no-explicit-any (error), ban-ts-comment (require descripcion)
//   NN #24 Accessibility    -> react-native-a11y/* (estatico, prescrito por SOP 64; equivalente RN de jsx-a11y)
// Cambios <warn>-first permiten calibrar falsos positivos durante Wave 3.1.
// Cuando PROFILE=LAUNCH/PROD, el gate debe correr con estas reglas en 'error'.
//
// Mobile usa ESLint legacy (.eslintrc.cjs) porque eslint-config-expo 55 aun
// no soporta flat config. Mismas reglas que web/desktop, sintaxis legacy.
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
    // NN #24 Accessibility (SOP 64), reglas criticas RN
    'react-native-a11y/has-accessibility-hint': 'off', // hint es opcional
    'react-native-a11y/has-accessibility-props': 'error',
    'react-native-a11y/has-valid-accessibility-role': 'error',
    'react-native-a11y/has-valid-accessibility-state': 'error',
    'react-native-a11y/no-nested-touchables': 'error',
  },
  overrides: [
    {
      // tests/ puede usar console libremente (tools/ ya esta en ignorePatterns)
      files: ['tests/**/*.{js,ts,tsx}'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};
