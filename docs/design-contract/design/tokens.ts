export const primitive = {
  color: { navy:"#102A56", blue:"#1769E0", purple:"#6757E8", cyan:"#20B7D9",
    green:"#168B5B", amber:"#C87B12", red:"#C9364A", canvas:"#F4F7FB",
    ink:"#14213D", muted:"#5F6B7A", white:"#FFFFFF" },
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
