import{defineConfig}from"vitest/config";
// Config mínima de vitest. Solo fija el transform JSX al runtime AUTOMÁTICO (react/jsx-runtime), como Next,
// para las pruebas de render de componentes (.tsx). No cambia el entorno (node por defecto; jsdom se activa
// por docblock // @vitest-environment jsdom en los tests que lo requieren) ni la discovery de tests.
export default defineConfig({
 esbuild:{jsx:"automatic",jsxImportSource:"react"},
});
