// Shared by ribbon edges, silhouette hulls and the depth contour pass.
export const inkStyle={value:1};
export function cleanInkWidth(value){const width=Number(value);return Number.isFinite(width)?Math.max(.5,Math.min(2.5,width)):1.15;}
export const inkWidth={value:1.15};
