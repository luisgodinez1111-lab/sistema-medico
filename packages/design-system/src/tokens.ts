// Design System v3.2 — tokens. Valores del AI Design Implementation Contract (docs/design-contract/design/tokens.ts);
// un test exige que ambos ficheros declaren exactamente los mismos valores. Subordinado al Design System v3.2.
//
// Auditoría 2026-09-19 (K-09): 4 de los 14 pares texto/fondo incumplían WCAG AA (4.5:1): verde #168B5B (4.30:1 con
// blanco), ámbar #C87B12 (3.33:1) y cian #20B7D9 (2.38:1). Los tres se oscurecieron al valor más claro de su tono que
// cumple AA tanto sobre blanco como sobre el lienzo (#F4F7FB); `tests/v22/design-system-contrast.test.ts` recalcula
// los 14 pares con la fórmula de luminancia relativa de WCAG 2.x y falla si alguno baja de 4.5:1.
export const primitive={
 color:{navy:"#102A56",blue:"#1769E0",purple:"#6757E8",cyan:"#0B7A93",
  green:"#137A50",amber:"#9E5F0A",red:"#C9364A",canvas:"#F4F7FB",ink:"#14213D",muted:"#5F6B7A",white:"#FFFFFF"},
 space:{0:0,1:4,2:8,3:12,4:16,5:20,6:24,8:32,10:40,12:48},
 radius:{sm:6,md:10,lg:14,xl:18},
 motionMs:{instant:0,fast:120,normal:180,slow:240},
} as const;
export const semantic={
 surface:{canvas:primitive.color.canvas,raised:primitive.color.white},
 text:{primary:primitive.color.ink,muted:primitive.color.muted},
 state:{success:primitive.color.green,attention:primitive.color.amber,critical:primitive.color.red},
 brand:{primary:primitive.color.blue,intelligence:primitive.color.purple},
} as const;
export const typography={
 family:{ui:"Inter, Aptos, system-ui, sans-serif",mono:"ui-monospace, SFMono-Regular, monospace"},
 size:{xs:12,sm:13,base:14,md:16,lg:18,xl:22,xxl:28},
 lineHeight:{tight:1.2,normal:1.45,relaxed:1.6},
} as const;
