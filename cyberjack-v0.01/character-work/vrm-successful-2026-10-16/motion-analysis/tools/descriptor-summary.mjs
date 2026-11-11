// Refine the dominant region from the measured speeds, including head-only motion.
export function completeDescriptor(c){if(!c)return c;const ranked=Object.entries(c.activity).sort((a,b)=>b[1].mean-a[1].mean);const dominant=ranked[0][1].mean<.015?'quiet':ranked[0][1].mean>Math.max(.015,ranked[1][1].mean)*1.7?ranked[0][0]:'distributed';return {...c,dominantMotion:dominant}}
