// Лист сверки: N кандидатов карты → контакт-лист с номерами + sheet JSON для ответа V4DYA
// node scripts/registry-sheet.cjs <map> <sheetNo> [size=24]
const fs=require("fs");const sharp=require("C:/cta-project/node_modules/sharp");
const [,, MAP="woods", NO="1", SIZE="24"]=process.argv;
const R="C:/cta-project/docs/registry", OUT=`C:/cta-project/map-exports/OBJECTS-MAPS/registry-sheets`; fs.mkdirSync(OUT,{recursive:true});
const man=JSON.parse(fs.readFileSync(`D:/Games/raster/${MAP}/manifest.json`,"utf8"));
const [[x0,y0],[x1,y1]]=man.boundsFromConfig; const pxPerM=[man.crop.width/Math.abs(x1-x0), man.crop.height/Math.abs(y1-y0)];
const objects=JSON.parse(fs.readFileSync(`${R}/objects.json`,"utf8"));
const seen=new Set(objects.objects.map(o=>o.id));
// кандидаты: из .tmp-<map>/objects, не oob, ещё не в реестре; priority 1 первыми
let cands=[];for(const f of fs.readdirSync(`C:/cta-project/.tmp-${MAP}/objects`).filter(f=>/^r\dc\d\.json$/.test(f)))for(const o of JSON.parse(fs.readFileSync(`C:/cta-project/.tmp-${MAP}/objects/${f}`,"utf8")))if(!o.outOfBounds&&!seen.has(`${MAP}:main:${o.slug}`))cands.push(o);
cands.sort((a,b)=>a.priority-b.priority||b.z6[2]*b.z6[3]-a.z6[2]*a.z6[3]);
const batch=cands.slice(0,+SIZE);
(async()=>{
 const T=300,COLS=6,tiles=[],sheet=[];
 for(let i=0;i<batch.length;i++){const o=batch[i];const n=i+1;const wm=(o.z6[2]/pxPerM[0]).toFixed(0),hm=(o.z6[3]/pxPerM[1]).toFixed(0);
  const x=(i%COLS)*(T+12),y=Math.floor(i/COLS)*(T+46);
  tiles.push({input:await sharp(o.path).resize(T,T).png().toBuffer(),left:x,top:y});
  tiles.push({input:Buffer.from(`<svg width="${T}" height="44"><rect width="${T}" height="44" fill="#141416"/><text x="4" y="16" font-size="15" font-weight="bold" fill="#fff" font-family="Arial">#${n}  ${o.slug.replace(/^r\dc\d-/,"")}</text><text x="4" y="34" font-size="12" fill="#aaa" font-family="Arial">${o.category} · ${wm}×${hm} м · ${o.z6[2]}×${o.z6[3]} px</text></svg>`),left:x,top:y+T});
  tiles.push({input:Buffer.from(`<svg width="44" height="26"><rect width="44" height="26" rx="4" fill="#E6A23C"/><text x="22" y="18" font-size="15" font-weight="bold" fill="#000" text-anchor="middle" font-family="Arial">${n}</text></svg>`),left:x+4,top:y+4});
  sheet.push({n,id:`${MAP}:main:${o.slug}`,slug:o.slug,category:o.category,bboxZ6:o.z6,sizeM:[+wm,+hm],crop:o.path,subject:o.subject});
 }
 const rows=Math.ceil(batch.length/COLS);
 await sharp({create:{width:COLS*(T+12),height:rows*(T+46),channels:4,background:"#0d0d0e"}}).composite(tiles).png().toFile(`${OUT}/${MAP}-sheet-${NO}.png`);
 fs.writeFileSync(`${OUT}/${MAP}-sheet-${NO}.json`,JSON.stringify({map:MAP,sheet:+NO,pxPerM,items:sheet},null,2));
 console.log(`sheet ${NO}: ${batch.length} кандидатов из ${cands.length} → ${OUT}/${MAP}-sheet-${NO}.png`);
})();
