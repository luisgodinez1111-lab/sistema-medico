// Auditoría 2026-09-19 (K-09): cian, verde y ámbar se oscurecieron para cumplir WCAG AA (≥4.5:1) sobre blanco y sobre el
// lienzo; antes 2.38:1, 4.30:1 y 3.33:1. `packages/design-system/src/tokens.ts` debe declarar exactamente estos valores
// (tests/v22/design-system-contrast.test.ts).
export const primitive = {
  color: { navy:"#102A56", blue:"#1769E0", purple:"#6757E8", cyan:"#0B7A93",
    green:"#137A50", amber:"#9E5F0A", red:"#C9364A", canvas:"#F4F7FB",
    ink:"#14213D", muted:"#5F6B7A", white:"#FFFFFF",
    // Auditoría R05b-27/R05b-08: texto sobre las superficies PÁLIDAS de los chips de estado. Los tonos de arriba cumplen AA
    // sobre blanco y sobre el lienzo, pero sobre el fondo pálido propio de cada chip volvían a fallar (azul 4.48:1, púrpura
    // 4.37:1, rojo 4.48:1). Estos cinco son el tono más claro de cada color que alcanza 4.7:1 sobre su chip, sobre blanco y
    // sobre el lienzo — margen sobre el 4.5 de AA para que un retoque del fondo no lo rompa.
    greenOnPale:"#137A50", purpleOnPale:"#6253DC", blueOnPale:"#1665D7", redOnPale:"#C33448", amberOnPale:"#995C0A",
    greenPale:"#E6F6EE", amberPale:"#FBF0DC", bluePale:"#EAF1FD", purplePale:"#EEEBFD", redPale:"#FDECEE" },
  space: { 0:0, 1:4, 2:8, 3:12, 4:16, 5:20, 6:24, 8:32, 10:40, 12:48 },
  radius: { sm:6, md:10, lg:14, xl:18 },
  motionMs: { instant:0, fast:120, normal:180, slow:240 },
} as const;

export const semantic = {
  surface:{canvas:primitive.color.canvas, raised:primitive.color.white},
  text:{primary:primitive.color.ink, muted:primitive.color.muted},
  state:{success:primitive.color.green, attention:primitive.color.amber, critical:primitive.color.red},
  brand:{primary:primitive.color.blue, intelligence:primitive.color.purple},
} as const;
