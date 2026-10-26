// Additive field hardware bonuses share one bounded combat contract.
export function fieldHitMultiplier(p,e,kind,m){
 const melee=['melee','hammer','bladeWave'].includes(kind),proc=['chain','thorns','burn'].includes(kind);
 let bonus=m.damage||0;
 if(melee)bonus+=m.meleeDamage||0;
 else if(!proc&&kind!=='emp'&&kind!=='dash')bonus+=m.rangedDamage||0;
 if(kind==='dash')bonus+=m.dashDamage||0;
 if(kind==='emp')bonus+=m.specialPower||0;
 if(kind==='precision')bonus+=m.precisionDamage||0;
 if(kind==='burn')bonus+=m.burnDamage||0;
 if((p.altitude||0)>35)bonus+=m.airborneDamage||0;
 if(e.stun>0)bonus+=m.stunnedDamage||0;
 if(e.hp<e.max*.3)bonus+=m.executeDamage||0;
 if(p.hp<(p.field?.maxHull||1)*(1+(m.maxHull||0))*.35)bonus+=m.lowHullDamage||0;
 return Math.max(.1,Math.min(6,1+bonus))*(e.objective||e.elite||e.type==='tank'?1+Math.min(2,m.heavyDamage||0):1);
}
export const fieldRate=m=>1+Math.max(0,Math.min(1.5,m.fireRate||0));
export const fieldArea=m=>1+Math.max(0,Math.min(1,m.area||0));
export const fieldMitigation=m=>1-Math.max(0,Math.min(.65,m.damageReduction||0));
