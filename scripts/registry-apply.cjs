// Применить разметку листа сверки к реестру: node scripts/registry-apply.cjs <map> <sheetNo> <spec.json>
// spec: { assign: {"T-0006":[5,11]}, new:[{slug,name,category,materials,n:[..],zone?,vector?}], skip:[6] }
const fs=require("fs");const sharp=require("C:/cta-project/node_modules/sharp");
const [,, MAP, NO, SPEC]=process.argv;const R="C:/cta-project/docs/registry";
const T=JSON.parse(fs.readFileSync(R+"/types.json","utf8")),O=JSON.parse(fs.readFileSync(R+"/objects.json","utf8"));
const sheet=JSON.parse(fs.readFileSync(`C:/cta-project/map-exports/OBJECTS-MAPS/registry-sheets/${MAP}-sheet-${NO}.json`,"utf8"));
const spec=JSON.parse(fs.readFileSync(SPEC,"utf8"));const byN=Object.fromEntries(sheet.items.map(i=>[i.n,i]));const tag=`${MAP}-${NO}`;
const add=(it,typeId,status)=>O.objects.push({id:it.id,map:MAP,layer:"main",typeId,status,crop:it.crop.replace("C:/cta-project/",""),bboxZ6:it.bboxZ6,sizeM:it.sizeM,sheet:tag,n:it.n});
for(const [typeId,ns] of Object.entries(spec.assign||{})){const t=T.types.find(t=>t.typeId===typeId);if(!t)throw new Error("нет типа "+typeId);if(!t.maps.includes(MAP))t.maps.push(MAP);for(const n of ns)add(byN[n],typeId,"confirmed");}
const created=[];let next=Math.max(...T.types.map(t=>+t.typeId.slice(2)))+1;
for(const nw of spec.new||[]){const typeId="T-"+String(next++).padStart(4,"0");
 T.types.push({typeId,slug:nw.slug,name:nw.name,category:nw.zone?"zones":nw.category,materials:nw.materials,canonical:byN[nw.n[0]].id,vector:nw.vector||{kind:"none"},maps:[...new Set([MAP,...(nw.alsoMaps||[])])],status:"confirmed",sheet:tag});
 for(const n of nw.n)add(byN[n],typeId,"confirmed");created.push({typeId,...nw,crop:byN[nw.n[0]].crop});}
for(const n of spec.skip||[])add(byN[n],null,"skip");
fs.writeFileSync(R+"/types.json",JSON.stringify(T,null,2));fs.writeFileSync(R+"/objects.json",JSON.stringify(O,null,2));
(async()=>{const dir="C:/cta-project/.tmp-woods/cards";fs.mkdirSync(dir,{recursive:true});const lines=[];
 for(const c of created){const f=`${dir}/${c.typeId}_${c.slug}.jpg`;await sharp(c.crop).resize(640,640).jpeg({quality:88}).toFile(f);
  lines.push([c.typeId,c.slug,c.name,c.zone?"ЗОНА":c.category,c.materials.join("+"),c.n.length,f,c.vector?JSON.stringify(c.vector):""].join("|"));}
 fs.writeFileSync(dir+"/list.txt",lines.join("\n"));console.log(lines.join("\n"));console.log("types:",T.types.length,"objects:",O.objects.length);})();
