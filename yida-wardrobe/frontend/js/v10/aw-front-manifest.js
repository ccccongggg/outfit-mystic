/* The 22 supplied card fronts, indexed by the canonical Major Arcana deck. */
window.AW_TAROT_FRONT_FILES=Object.fromEntries(
 Array.from({length:22},(_,index)=>[index,'assets/v10/tarot/fronts/tarot-front-'+String(index).padStart(2,'0')+'.webp'])
);
