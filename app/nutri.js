/* ENTRENA YOUR LIFE · Módulo de nutrición. Motor de cálculo (mismo que el prototipo validado). */
(function(){"use strict";
/* ======================= DATOS BASE ======================= */
const FOODS={ // nombre, kcal, P, HC, G por 100 g
 bebcoco:["Bebida de coco (brick)",20,0.1,2.7,0.9], pan:["Pan (tostadas)",260,9,49,3], aceite:["Aceite de oliva",884,0,0,100],
 fiambre:["Fiambre de pechuga",105,18,2,3], platano:["Plátano",89,1.1,23,0.3], batidoveg:["Proteína vegetal (polvo)",380,80,4,6],
 frutosrojos:["Frutos rojos",50,1,12,0.3], pasta:["Pasta (cruda)",355,12,72,1.5], carne:["Carne picada",170,20,0,10],
 tomate:["Tomate frito",80,1.5,10,4], tortitas:["Tortitas de arroz",385,8,81,3], chocnegro:["Chocolate negro 70%",580,8,33,43],
 noquis:["Ñoquis",155,3.5,33,0.5], pollo:["Pechuga de pollo",110,23,0,1.5], verdura:["Verduras variadas",30,2,5,0.3],
 cremaarroz:["Crema de arroz",370,7,80,1], leche:["Leche semidesnatada",46,3.2,4.7,1.6], whey:["Proteína whey",380,78,6,5],
 macint:["Macarrones integrales (crudos)",350,13,65,2.5], mozzarella:["Mozzarella",250,18,1,19], qbatido:["Queso fresco batido 0%",46,8,3.5,0.1],
 avenachoc:["Avena con chocolate",380,12,60,7], manzana:["Fruta (manzana)",52,0.3,14,0.2], cacahuete:["Crema de cacahuete",590,25,20,50],
 atun:["Atún al natural",110,25,0,1], garbanzos:["Garbanzos de bote",140,7,19,2.5], qfresco:["Queso fresco",175,12,3,13],
 almendras:["Almendras / nueces",600,21,22,50], huevo:["Huevo",145,12.5,0.7,10], arroz:["Arroz (crudo)",355,7,79,0.6],
 patata:["Patata",77,2,17,0.1], avena:["Copos de avena",375,13,60,7], salmon:["Salmón",208,20,0,13], aguacate:["Aguacate",160,2,9,15],
 yogsoja:["Yogur de soja proteico",70,7,4,2.5], ternera:["Ternera magra",130,21,0,5], lentejas:["Lentejas cocidas",116,9,20,0.4],
 pavo:["Pechuga de pavo",105,24,0,1], boniato:["Boniato",86,1.6,20,0.1], yogurnat:["Yogur natural",61,3.5,4.7,3.3],
 skyr:["Skyr natural",63,11,4,0.2], legumbre:["Legumbres cocidas",120,8,18,1.5], quinoa:["Quinoa (cruda)",368,14,64,6], tofu:["Tofu",120,13,2,7]
};
const LACTEOS=["leche","whey","mozzarella","qbatido","qfresco","yogurnat","skyr"];
const FRUVER=["verdura","frutosrojos","manzana","platano","aguacate"];
const EQ=[["C",["pasta","macint","arroz","noquis","patata","boniato","pan","cremaarroz","avena","tortitas","lentejas"]],
          ["P",["pollo","pavo","ternera","atun","salmon","huevo","carne","fiambre"]],
          ["P",["qbatido","yogsoja","whey","batidoveg"]],
          ["F",["aceite","almendras","cacahuete","aguacate"]]];
const PERIM=[["cintura","Cintura"],["cadera","Cadera"],["pecho","Pecho"],["brazoD","Brazo dcho."],["brazoI","Brazo izq."],["musloD","Muslo dcho."],["musloI","Muslo izq."]];
const PAIRS=[["Brazo","brazoD","brazoI"],["Muslo","musloD","musloI"]];
const ANGLES=[["frente","Frente"],["perfil","Perfil"],["espalda","Espalda"]];
const WD=["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
const DAY=86400000;
const iso=d=>{const x=new Date(d);return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0")};
const TODAY=iso(Date.now());
const addD=(s,n)=>iso(new Date(s+"T12:00:00").getTime()+n*DAY);
const diffD=(a,b)=>Math.round((new Date(b+"T12:00:00")-new Date(a+"T12:00:00"))/DAY);
const fmtD=s=>new Date(s+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"});
const fmtDL=s=>new Date(s+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"});
const dow=s=>(new Date(s+"T12:00:00").getDay()+6)%7;
const weekStart=s=>addD(s,-dow(s));
const r0=n=>Math.round(n), r1=n=>Math.round(n*10)/10, r2=n=>Math.round(n*100)/100;
const sg=n=>(n>0?"+":n<0?"−":"")+Math.abs(r0(n));
const noise=i=>Math.sin(i*12.9898)*43758.5453%1;
const esc=s=>String(s??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const SRC={
 iraki:["Iraki et al. 2019","https://doi.org/10.3390/sports7070154"],
 henson:["Henson et al. 2020","https://doi.org/10.1249/MSS.0000000000002249"],
 buffey:["Buffey et al. 2022","https://doi.org/10.1007/s40279-022-01649-4"],
 lamon:["Lamon et al. 2021","https://doi.org/10.14814/phy2.14660"],
 lieberman:["Lieberman et al. 2018","https://doi.org/10.1249/MSS.0000000000001451"],
 whittaker:["Whittaker & Wu 2021","https://doi.org/10.1016/j.jsbmb.2021.105878"]};
const cite=k=>`<a href="${SRC[k][1]}" target="_blank" rel="noopener">${SRC[k][0]}</a>`;
const REGLAS0={recorte:400,actividad:"pasos",maxPasos:4000,maxCardio:30,umbralVol:300};
const MEALQ=[["Desayuno",true],["Media mañana",false],["Comida",true],["Merienda",true],["Cena",true],["Recena",false]];
let PHOTOS={};
/* ======================= MOTOR DE CÁLCULO ======================= */
function macros(meals){let k=0,P=0,C=0,F=0;meals.forEach(m=>{(m[1]||[]).forEach(([id,g])=>{const f=FOODS[id];if(!f)return;k+=f[1]*g/100;P+=f[2]*g/100;C+=f[3]*g/100;F+=f[4]*g/100});if(m[2]){k+=m[2].kcal;P+=m[2].P;C+=m[2].C;F+=m[2].F}});return{k,P,C,F}}
function weekAvg(c,key){const t=c.dayTypes.reduce((s,d)=>s+d.dias,0)||7;const a={k:0,P:0,C:0,F:0};c.dayTypes.forEach(d=>{const m=macros(d[key]);for(const x in a)a[x]+=m[x]*d.dias/t});return a}
function cycleDay(c,date){if(!c.ciclo||!c.ciclo.inicio)return null;const L=c.ciclo.len||28;return((diffD(c.ciclo.inicio,date)%L)+L)%L+1}
function cyclePhase(c,d){const L=c.ciclo.len||28;if(d<=(c.ciclo.sangrado||5))return["m","Regla"];if(d>L-7)return["pm","Premenstrual"];if(d<=12)return["fo","Folicular"];if(d<=15)return["ov","Ovulación"];return["lu","Lútea"]}
function regress(pts){const n=pts.length;if(n<2)return 0;const x0=pts[0][0];let sx=0,sy=0,sxx=0,sxy=0;pts.forEach(([d,w])=>{const x=diffD(x0,d);sx+=x;sy+=w;sxx+=x*x;sxy+=x*w});return(n*sxy-sx*sy)/(n*sxx-sx*sx||1)}
function calc(c){
 const ffm=c.grasa?c.peso*(1-c.grasa/100):null;
 const mif=10*c.peso+6.25*c.altura-5*c.edad+(c.sexo==="h"?5:-161);
 const katch=ffm?370+21.6*ffm:null;
 const bmr=katch?(mif+katch)/2:mif;
 const pasosK=c.pasos*0.00055*c.peso*0.8;
 const entK=c.peso*0.08*c.dur*c.dias/7;
 const tdee=(bmr+pasosK+entK)/0.9;
 const adv=c.exp>=4;
 const rate={volumen:adv?[0.12,0.25]:[0.25,0.5],definicion:[-1,-0.5],mantenimiento:[-0.1,0.1]}[c.fase];
 const rateKg=rate.map(x=>x*c.peso/100);
 const last=c.pesos.filter(([d])=>diffD(d,TODAY)<=28&&diffD(d,TODAY)>=0);
 const usable=c.ciclo?last.filter(([d])=>cyclePhase(c,cycleDay(c,d))[0]!=="pm"):last;
 const daysLogged=last.length;
 const slopeWk=daysLogged>=14?regress(usable)*7:null;
 const intake=weekAvg(c,"actual");
 const target=(rateKg[0]+rateKg[1])/2;
 let kcalObj,metodo;
 if(slopeWk!==null&&intake.k>0){kcalObj=intake.k+(target-slopeWk)*7700/7;metodo="real"}
 else{kcalObj=tdee*({volumen:adv?1.05:1.10,definicion:0.85,mantenimiento:1}[c.fase]);metodo="formula"}
 const implied=slopeWk!==null&&intake.k>0?intake.k-slopeWk*7700/7:null;
 const gapPct=implied?(tdee-implied)/tdee:0;
 const P=c.fase==="definicion"&&ffm?2.6*ffm:1.8*c.peso;
 const F=Math.max(0.6*c.peso,kcalObj*0.22/9);
 const C=Math.max(0,(kcalObj-P*4-F*9)/4);
 const ea=ffm?(weekAvg(c,"prop").k-entK)/ffm:null;
 const floor=c.sexo==="m"&&ffm?Math.max(bmr,30*ffm+entK):bmr;
 return{ffm,mif,katch,bmr,pasosK,entK,tdee,rate,rateKg,slopeWk,daysLogged,intake,kcalObj,metodo,implied,gapPct,P,C,F,ea,adv,floor};
}
/* ---------- semana ---------- */
function dayTypeFor(c,date){const t=c.diasEnt.includes(dow(date));if(c.dayTypes.length>1)return t?c.dayTypes[0]:c.dayTypes[1];return c.dayTypes[0]}
function mealKcal(dt,name){const m=dt.prop.find(x=>x[0].toLowerCase()===String(name).toLowerCase())||dt.prop.find(x=>x[0].toLowerCase().includes(String(name).toLowerCase()));return m?macros([m]).k:0}
function stepsDelta(c){return Math.max(0,(c.pasos-(c.pasosMin||c.pasos*0.6))*0.00055*c.peso*0.8)}
const isProt=id=>{const f=FOODS[id];return f&&f[2]*4>=0.4*f[1]};
function scaleMeals(meals,delta){
 const sc=(id,lk)=>!lk&&FOODS[id]&&!isProt(id)&&!FRUVER.includes(id);
 let ks=0;meals.forEach(m=>{if(m[2])return;m[1].forEach(([id,g,lk])=>{if(sc(id,lk))ks+=FOODS[id][1]*g/100})});
 const f=ks>0?Math.min(1.5,Math.max(0.5,1+delta/ks)):1;
 return meals.map(m=>m[2]?m:[m[0],m[1].map(([id,g,lk])=>{if(!sc(id,lk))return[id,g,lk];const step=FOODS[id][1]>500?1:5;return[id,Math.max(0,Math.round(g*f/step)*step),lk]})]);
}
/* ---------- ajuste con cambios mínimos ---------- */
function dayTarget(c,dt){const x=calc(c);const wa=weekAvg(c,"actual").k;const base=c.kcalAprobadas||x.kcalObj;const ratio=wa>0?macros(dt.actual).k/wa:1;const k=base*(isFinite(ratio)&&ratio>0?ratio:1);return{k,P:x.P,F:Math.max(0.6*c.peso,k*0.25/9)}}
function minimalAdjust(c,meals,T){
 const out=JSON.parse(JSON.stringify(meals.filter(m=>!m[2])));if(!out.length)return{meals:out,diffs:[]};
 const Ct=Math.max(0,(T.k-T.P*4-T.F*9)/4);const TT=[T.P,Ct,T.F];const a=TT.map(t=>1/Math.max(t,5)**2);
 // item interno: [id, g, fijoCliente, g0, fijoTemporal]; fruta y verdura no se escalan
 const run=()=>{const it=[];out.forEach((m,mi)=>m[1].forEach((x,ii)=>{if(FOODS[x[0]])it.push({mi,ii,id:x[0],g0:x[3]??x[1],g:x[1],lk:!!x[2]||!!x[4]||FRUVER.includes(x[0])})}));
  const cc=it.map(o=>{const f=FOODS[o.id];return[f[2]/100,f[3]/100,f[4]/100]});const b=it.map(o=>0.05/Math.max(o.g0,30)**2);
  for(let r=0;r<300;r++)for(let j=0;j<it.length;j++){if(it[j].lk)continue;const res=[0,1,2].map(m=>cc.reduce((s,ci,i)=>s+ci[m]*it[i].g,0)-TT[m]);
   let num=b[j]*(it[j].g-it[j].g0),den=b[j];for(let m=0;m<3;m++){num+=a[m]*cc[j][m]*res[m];den+=a[m]*cc[j][m]**2}
   let g=it[j].g-num/den;if(it[j].g0>0)g=Math.min(it[j].g0*1.6,Math.max(it[j].g0*0.5,g));it[j].g=Math.max(0,g)}
  it.forEach(o=>{if(o.lk)return;const step=FOODS[o.id][1]>500?1:5;out[o.mi][1][o.ii][1]=Math.round(o.g/step)*step})};
 const mk=mm=>macros([mm]);const main=out.filter(mm=>/desayuno|comida|cena/i.test(mm[0])||mk(mm).k>150);
 const has=(mm,id)=>mm[1].find(x=>x[0]===id);
 const addFixed=(mm,id,g)=>{const step=FOODS[id][1]>500?1:5;g=Math.round(g/step)*step;if(g<step)return;const ex=has(mm,id);if(ex){ex[1]+=g;ex[4]=1}else mm[1].push([id,g,0,0,1])};
 const protFor=mm=>{const ex=mm[1].find(x=>FOODS[x[0]]&&isProt(x[0])&&!LACTEOS.includes(x[0])&&!x[2]);if(ex)return ex[0];const n=mm[0].toLowerCase();const opts=/desayuno/.test(n)?["huevo","fiambre",c.lacteos?"skyr":"yogsoja"]:/merienda|media|post/.test(n)?[c.lacteos?"skyr":"yogsoja","fiambre"]:["pollo","pavo","atun","ternera"];return opts.find(o=>!has(mm,o))||opts[0]};
 const carbFor=mm=>{const ex=mm[1].find(x=>FOODS[x[0]]&&!FRUVER.includes(x[0])&&FOODS[x[0]][3]*4>0.5*FOODS[x[0]][1]);if(ex)return ex[0];const n=mm[0].toLowerCase();return/desayuno|merienda|media/.test(n)?"pan":"arroz"};
 out.forEach(m=>m[1].forEach(x=>{x[3]=x[1]}));
 let m=macros(out);
 const far=m.k<T.k*0.85||m.P<T.P*0.85;
 // 1) proteína: primero que cada comida principal llegue a su mínimo (sobre lo que come de verdad)
 const minP=0.24*c.peso;main.forEach(mm=>{const p=mk(mm).P;if(p<minP*0.8){const s=protFor(mm);addFixed(mm,s,(minP-p)/(FOODS[s][2]/100))}});
 run();
 m=macros(out);if(m.P<T.P*0.9){const tg=main.filter(mm=>/comida|cena/i.test(mm[0]));const per=(T.P-m.P)/Math.max(1,tg.length);(tg.length?tg:main).forEach(mm=>{const s=protFor(mm);addFixed(mm,s,per/(FOODS[s][2]/100))})}
 run();m=macros(out);
 // 2) grasa mínima
 if(m.F<T.F*0.85){const tg=main.filter(mm=>/comida|cena/i.test(mm[0]));const per=(T.F-m.F)/Math.max(1,tg.length);(tg.length?tg:main).forEach(mm=>addFixed(mm,"aceite",per))}
 run();m=macros(out);
 // 3) energía: si sigue lejos, hidratos de verdad en las comidas principales
 const kMin=Math.max(T.k*0.95,calc(c).floor+30);
 if(m.k<kMin){const need=(Math.max(T.k,kMin)-m.k)/4;const tg=main;const per=need/Math.max(1,tg.length);tg.forEach(mm=>{const s=carbFor(mm);addFixed(mm,s,per/(FOODS[s][3]/100))})}
 run();m=macros(out);
 if(!out.some(mm=>mm[1].some(x=>FRUVER.includes(x[0])))){const tgt=out.find(mm=>/cena|comida/i.test(mm[0]))||out[0];tgt[1].push(["verdura",150,0,0,1])}
 const diffs=[];out.forEach(mm=>mm[1].forEach(x=>{const orig=(meals.find(o=>o[0]===mm[0])||[0,[]])[1].find(o=>o[0]===x[0]);const g0=orig?orig[1]:0;
  if(!orig)diffs.push({t:`${mm[0]}: añadir ${x[1]} g de ${FOODS[x[0]][0].toLowerCase()}`,big:false});
  else if(Math.abs(x[1]-g0)>=Math.max(5,g0*0.1))diffs.push({t:`${mm[0]}: ${FOODS[x[0]][0].toLowerCase()} de ${g0} a ${x[1]} g`,big:g0>0&&Math.abs(x[1]-g0)/g0>0.4})}));
 if(far)diffs.unshift({t:"La alimentación de partida está muy lejos de lo que necesita: aquí sí hacen falta cambios grandes.",big:false});
 out.forEach(mm=>{mm[1]=mm[1].filter(x=>x[1]>0).map(x=>[x[0],x[1],x[2]||0])});
 return{meals:out,diffs};
}
/* ---------- comprobaciones de una dieta ---------- */
function checkDiet(c,meals,T){
 const x=calc(c);const m=macros(meals);const L=[];if(!m.k)return[["info","Sin alimentos todavía."]];
 const d=m.k/T.k-1;L.push([Math.abs(d)<=0.1?"ok":Math.abs(d)<=0.2?"warn":"bad",`Calorías: ${r0(m.k)} frente a ~${r0(T.k)} de objetivo (${d>=0?"+":""}${r0(d*100)} %).`]);
 if(m.k<x.floor)L.push(["bad",`Por debajo del mínimo seguro para esta persona (${r0(x.floor)} kcal).`]);
 const pk=m.P/c.peso;L.push([m.P>=T.P*0.9?"ok":m.P>=T.P*0.75?"warn":"bad",`Proteína: ${r0(m.P)} g (${r1(pk)} g/kg). Objetivo ~${r0(T.P)} g.`]);
 const fk=m.F/c.peso,fp=m.F*9/m.k;L.push([fk<0.5?"bad":fp>0.4?"warn":"ok",`Grasa: ${r0(m.F)} g (${r2(fk)} g/kg, ${r0(fp*100)} % de las kcal).${fk<0.5?" Por debajo de 0,5 g/kg.":""}`]);
 const low=meals.filter(mm=>!mm[2]&&macros([mm]).k>200&&macros([mm]).P<0.24*c.peso).map(mm=>mm[0]);
 if(low.length)L.push(["warn",`Poca proteína en: ${low.join(", ")} (menos de ${r0(0.24*c.peso)} g).`]);
 if(!c.lacteos){const lc=[];meals.forEach(mm=>mm[1].forEach(([id])=>{if(LACTEOS.includes(id))lc.push(FOODS[id][0].toLowerCase())}));if(lc.length)L.push(["bad",`Lleva lácteos y no los tolera: ${[...new Set(lc)].join(", ")}.`])}
 if(!meals.some(mm=>mm[1].some(([id])=>FRUVER.includes(id))))L.push(["warn","No lleva fruta ni verdura."]);
 if(c.ciclo&&x.ffm){const ea=(m.k-x.entK)/x.ffm;if(ea<30)L.push(["bad",`Disponibilidad energética ${r0(ea)} kcal/kg magra: riesgo para el ciclo.`])}
 const cust=[];meals.forEach(mm=>mm[1].forEach(([id])=>{if(String(id).startsWith("x_"))cust.push(FOODS[id][0])}));if(cust.length)L.push(["info",`Valores estimados por IA, revisar: ${[...new Set(cust)].join(", ")}.`]);
 return L;
}
/* ---------- estado del alta ---------- */
function altaSteps(c){
 const x=calc(c);const q=c.cuestionario||{};const de=c.dietaExt||{};
 const hasProp=c.dayTypes.some(t=>t.prop.some(m=>m[1].length));
 const S=[
  ["Entrevista inicial",!!c.entrevistaFecha,c.entrevistaFecha?`Validada el ${fmtD(c.entrevistaFecha)}.`:(c.entrevistaCli&&c.entrevistaCli.estado==="enviada")?"La ha enviado: pendiente de tu revisión.":"Aún no la ha rellenado. Le sale como primera tarea al entrar en su app."],
  ["Cuestionario de alimentación",q.estado!=="pendiente",q.estado==="pendiente"?"El cliente aún no lo ha rellenado. Le aparece como primera tarea al entrar.":q.estado==="enviado"?"Enviado. Falta convertirlo en sus comidas.":"Convertido en sus comidas habituales."],
  ["Dieta propia",de.estado==="ninguna"?(q.resp&&q.resp.dieta==="si"?false:true):de.estado==="validada",de.estado==="ninguna"?(q.resp&&q.resp.dieta==="si"?"Dice que trae dieta pero aún no la ha subido.":"No trae dieta propia."):de.estado==="revision"?"Recibida: pendiente de tu validación.":de.estado==="recibida"?"Recibida: falta transcribirla.":`Validada el ${fmtD(de.validada||TODAY)}.`],
  ["Calibración (14 días de peso)",x.daysLogged>=14,`${Math.min(x.daysLogged,14)}/14 días.`],
  ["Plan activo",hasProp&&(q.estado!=="pendiente"||de.estado==="validada"),hasProp?"Tiene propuesta de comidas.":"Aún sin propuesta de comidas."]];
 return S;
}
/* Compensación de comidas fuera: SIEMPRE en el mismo día.
   1) recortar hidratos y grasas de las otras comidas de ese día (proteína, fruta y verdura intactas; tope reglas.recorte);
   2) lo que falte, con actividad extra ese día (pasos, cardio suave o alargar el entreno; con tope);
   3) lo que quede, no se compensa. Solo si ya se comió la última comida del día, pasa al día siguiente. */
function actFor(c,kcal,date){const r=c.reglas;if(kcal<=20)return null;let tipo=r.actividad;if(tipo==="entreno"&&!c.diasEnt.includes(dow(date)))tipo="cardio";
 if(tipo==="pasos"){const kps=0.00055*c.peso*0.8;const p=Math.min(r.maxPasos,Math.ceil(kcal/kps/500)*500);return p>0?{tipo,txt:`+${p.toLocaleString("es-ES")} pasos`,det:`≈ ${Math.round(p/100)} min caminando`,kcal:p*kps}:null}
 const kpm=0.07*c.peso;const mins=Math.min(r.maxCardio,Math.ceil(kcal/kpm/5)*5);
 return mins>0?{tipo,txt:tipo==="entreno"?`+${mins} min de cardio suave al final del entreno`:`+${mins} min de cardio suave`,det:tipo==="entreno"?"bici o elíptica al terminar":"bici, elíptica o caminar rápido",kcal:mins*kpm}:null}
const scalK=m=>m?m[1].reduce((a,[id,g,lk])=>a+(!lk&&FOODS[id]&&!isProt(id)&&!FRUVER.includes(id)?FOODS[id][1]*g/100:0),0):0;
function weekPlan(c,ws){
 const x=calc(c);
 const days=Array.from({length:7},(_,i)=>{const date=addD(ws,i);const dt=dayTypeFor(c,date);const m=macros(dt.prop);
  return{date,dt,base:m.k,P:m.P,train:c.diasEnt.includes(i),why:[],evs:[],act:[],cuts:{},uni:0}});
 const sumBase=days.reduce((s,d)=>s+d.base,0);
 const budget=c.kcalAprobadas?c.kcalAprobadas*7:sumBase;
 const shift=(budget-sumBase)/7;
 if(Math.abs(shift)>=1)days.forEach(d=>{d.uni+=shift;d.why.push(`${sg(shift)} ajuste semanal aprobado`)});
 days.forEach(d=>{if(c.pasosBajos[d.date]){const s=stepsDelta(c);d.uni-=s;d.why.push(`${sg(-s)} día de pocos pasos`)}});
 c.ajustes.filter(a=>diffD(ws,a.fecha)>=0&&diffD(ws,a.fecha)<7).forEach(a=>{const d=days[diffD(ws,a.fecha)];d.uni+=a.kcal;d.why.push(`${sg(a.kcal)} ${a.motivo}`)});
 if(c.ciclo)days.forEach(d=>{d.cyc=cyclePhase(c,cycleDay(c,d.date))});
 const notes=[];
 c.eventos.filter(e=>diffD(ws,e.fecha)>=-1&&diffD(ws,e.fecha)<7).forEach(e=>{
  const inWeek=diffD(ws,e.fecha)>=0;const dE=inWeek?days[diffD(ws,e.fecha)]:null;const dtE=dayTypeFor(c,e.fecha);
  const ex=e.kcal-mealKcal(dtE,e.comida);
  if(dE){dE.evs.push(e);dE.why.push(`${sg(ex)} ${e.desc} (en lugar de ${e.comida.toLowerCase()})`)}
  if(ex<=0)return;
  if(c.fase==="volumen"&&ex<c.reglas.umbralVol){if(dE)notes.push(`"${e.desc}": ${r0(ex)} kcal de más, por debajo del umbral de volumen (${c.reglas.umbralVol}). No se compensa.`);return}
  const names=dtE.prop.map(m=>m[0]);const idx=names.findIndex(n=>n.toLowerCase()===e.comida.toLowerCase());
  let tgt=e.fecha,elig=names.filter((n,i)=>e.registrado?i>idx:i!==idx);
  if(e.registrado&&!elig.length){tgt=addD(e.fecha,1);elig=null}
  const dT=days.find(d=>d.date===tgt);
  if(!dT){if(dE)notes.push(`"${e.desc}" se compensa el ${fmtDL(tgt)} (semana siguiente).`);return}
  if(!elig)elig=dT.dt.prop.map(m=>m[0]);
  elig=elig.filter(n=>!c.eventos.some(o=>o!==e&&o.fecha===tgt&&o.comida.toLowerCase()===n.toLowerCase())&&scalK(dT.dt.prop.find(m=>m[0]===n))>=60);
  const scal=elig.reduce((s,n)=>s+scalK(dT.dt.prop.find(m=>m[0]===n)),0);
  const cut=Math.min(ex,c.reglas.recorte,scal*0.5);let rem=ex;
  if(cut>=10){elig.forEach(n=>{const sk=scalK(dT.dt.prop.find(m=>m[0]===n));if(sk>0)dT.cuts[n]=(dT.cuts[n]||0)+cut*sk/scal});
   const who=elig.filter(n=>scalK(dT.dt.prop.find(m=>m[0]===n))>0).map(n=>n.toLowerCase());
   dT.why.push(`−${r0(cut)} en ${who.join(", ")} por "${e.desc}"`);rem-=cut}
  if(rem>20){const a=actFor(c,rem,tgt);if(a){dT.act.push({...a,motivo:e.desc});dT.why.push(`${a.txt} por "${e.desc}"`);rem-=a.kcal}}
  if(rem>60)notes.push(`"${e.desc}": quedan ~${r0(rem)} kcal sin compensar. No pasa nada: una comida no cambia la semana.`);
 });
 days.forEach(d=>{
  let meals=JSON.parse(JSON.stringify(d.dt.prop));
  d.evs.forEach(ev=>{const i=meals.findIndex(m=>m[0].toLowerCase()===ev.comida.toLowerCase());const em=[ev.comida,[],{desc:ev.desc,kcal:ev.kcal,P:ev.kcal*0.15/4,C:ev.kcal*0.45/4,F:ev.kcal*0.40/9}];if(i>=0)meals[i]=em;else meals.push(em)});
  meals=scaleMeals(meals,d.uni);
  meals=meals.map(m=>!m[2]&&d.cuts[m[0]]?scaleMeals([m],-d.cuts[m[0]])[0]:m);
  d.meals=meals;d.m=macros(meals);d.actK=d.act.reduce((s,a)=>s+a.kcal,0);
 });
 return{days,budget,sumBase,notes,x,planned:days.reduce((s,d)=>s+d.m.k-d.actK,0)};
}
function describeComp(c,ev){const out=[];[weekStart(ev.fecha),weekStart(addD(ev.fecha,1))].filter((v,i,a)=>a.indexOf(v)===i).forEach(ws=>{const W=weekPlan(c,ws);
 W.days.forEach(d=>d.why.filter(w=>w.includes(`"${ev.desc}"`)).forEach(w=>out.push(`${fmtDL(d.date)}: ${w}`)));W.notes.filter(n=>n.includes(`"${ev.desc}"`)).forEach(n=>out.push(n))});
 return [...new Set(out)].join(" ")||"No hace falta compensar nada."}
function equivs(c,id,g){
 const grp=EQ.find(([,ids])=>ids.includes(id));if(!grp)return[];const [k,ids]=grp;const ki={P:2,C:3,F:4}[k];
 const amt=FOODS[id][ki]*g/100;
 return ids.filter(o=>o!==id&&(c.lacteos||!LACTEOS.includes(o))).map(o=>{const step=FOODS[o][1]>500?1:5;return[o,Math.max(step,Math.round(amt/FOODS[o][ki]*100/step)*step)]}).slice(0,6);
}
/* ---------- hábitos ---------- */
function habitos(c){
 const t=c.trabajo||{},H=[];const sent=+t.horasSentado||0;
 if(sent>=5||["oficina","teletrabajo","mixto"].includes(t.modalidad))H.push(["⏱","Pausas activas cada 30 minutos",`Pasa ~${sent||"muchas"} h sentado. Levantarse y caminar 3–5 min cada 30 min reduce la glucosa y la insulina tras las comidas frente a estar sentado seguido (${cite("henson")}); caminar funciona mejor que solo ponerse de pie (${cite("buffey")}). Una alarma en el móvil o el reloj ayuda.`]);
 if(c.pasos<8000)H.push(["🚶","Paseo después de comer y cenar",`Hoy ronda los ${c.pasos.toLocaleString("es-ES")} pasos. 10–15 min caminando tras las comidas principales, y subir 1.000–2.000 pasos cada 2 semanas hasta 8.000–10.000.`]);
 if(t.desplazamiento==="coche"||t.desplazamiento==="transporte")H.push(["🅿","Suma pasos en los trayectos",t.desplazamiento==="coche"?"Aparcar 5–10 min más lejos del trabajo o del súper.":"Bajarse una parada antes y terminar andando."]);
 if(t.modalidad==="teletrabajo"||t.modalidad==="mixto")H.push(["📞","Llamadas de pie o caminando","En casa no hay paseos al café ni a la sala de reuniones: aprovecha llamadas para moverte. Si es posible, alterna con una mesa elevable."]);
 if(t.pausas==="no")H.push(["🪑","Sin pausas en el trabajo","Si no puede levantarse, compensar fuera: paseo al llegar a casa y algún bloque de 10 min de movilidad."]);
 if(t.modalidad==="pie"||t.modalidad==="fisico")H.push(["🔋","Su trabajo ya suma actividad","Priorizar la recuperación: hidratos alrededor del turno, buena hidratación y descanso. No hace falta añadir más pasos."]);
 if(c.sueno<7)H.push(["🌙","Dormir 7 h o más",`Duerme ${c.sueno} h. Horario fijo para acostarse y levantarse, y cenar al menos 2 h antes. La falta de sueño frena la síntesis de proteína muscular (${cite("lamon")}).`]);
 return H;
}
function alerts(c){
 const x=calc(c),A=[];
 const lp=c.perim[c.perim.length-1];
 if(!lp)A.push(["bad","Faltan las medidas iniciales","Registra perímetros y fotos para tener punto de partida.","seg"]);
 else{const d=diffD(lp.fecha,TODAY);
  if(d>=30)A.push(["bad",`Medición mensual pendiente (hace ${d} días)`,"Toca medir perímetros y hacer fotos."+(c.ciclo?" Mejor entre los días 5 y 10 del ciclo.":""),"seg"]);
  else if(d>=26)A.push(["warn",`Medición mensual en ${30-d} días`,"Recuérdaselo para que tenga la cinta a mano.","seg"]);}
 const ph=PHOTOS[c.id]||{};const lastPhoto=Object.keys(ph).sort().pop();
 if(!lastPhoto||diffD(lastPhoto,TODAY)>=30)A.push(["warn","Fotos del mes sin subir","Frente, perfil y espalda, con la misma luz y a la misma hora que la vez anterior.","seg"]);
 c.flags.filter(f=>diffD(f.fecha,TODAY)<=14).forEach(f=>A.push(["bad",f.titulo,f.texto,"asistente"]));
 const de=c.dietaExt||{},q=c.cuestionario||{};
 if(de.estado==="revision"||de.estado==="recibida")A.push(["bad","Dieta propia pendiente de validar",`La subió el ${fmtD(de.fecha||TODAY)}. Revísala, corrige lo necesario y envíasela validada.`,"alta"]);
 if(q.estado==="pendiente")A.push(["warn","Cuestionario de alimentación sin rellenar","Le aparece como primera tarea en su app. Sin él no podemos adaptarnos a lo que ya come.","alta"]);
 if(q.estado==="enviado")A.push(["warn","Cuestionario recibido sin convertir","Conviértelo en sus comidas y genera la propuesta con cambios mínimos.","alta"]);
 if(x.daysLogged<14)A.push(["info",`Calibrando: ${x.daysLogged}/14 días de peso`,"Hasta tener 2 semanas de peso diario, las calorías salen de la fórmula y son orientativas.","seg"]);
 if(x.implied&&x.gapPct>0.2)A.push(["warn","Posible registro incompleto",`Con lo que dice comer (${r0(x.intake.k)} kcal) y su ritmo de peso, su gasto real sería ~${r0(x.implied)} kcal, un ${r0(x.gapPct*100)} % menos de lo esperable. Pídele 1 semana pesándolo todo.`,"plan"]);
 if(x.slopeWk!==null){const[a,b]=x.rateKg;
  if(x.slopeWk>b+0.02)A.push(["bad",`Sube demasiado rápido: +${r2(x.slopeWk)} kg/sem`,`Objetivo para su fase: ${r2(a)} a ${r2(b)} kg/sem. Revisa la propuesta del lunes en Semana.`,"semana"]);
  else if(x.slopeWk<a-0.02)A.push(["warn",`Por debajo del ritmo: ${x.slopeWk>0?"+":""}${r2(x.slopeWk)} kg/sem`,`Objetivo: ${r2(a)} a ${r2(b)} kg/sem. Revisa la propuesta del lunes en Semana.`,"semana"]);
  else A.push(["ok",`Ritmo correcto: ${x.slopeWk>0?"+":""}${r2(x.slopeWk)} kg/sem`,"Dentro del rango de su fase. Mantener.","seg"]);}
 const pr=weekAvg(c,"prop");const fkg=pr.F/c.peso;
 if(pr.k&&fkg<0.5)A.push([c.sexo==="h"?"bad":"warn",`Grasa baja en el plan: ${r2(fkg)} g/kg`,"Por debajo de 0,5 g/kg.","plan"]);
 if(!c.trabajo||!c.trabajo.modalidad)A.push(["info","Falta trabajo y actividad diaria","Complétalo en Entrevista para generar recomendaciones de hábitos (pausas, paseos…).","entrevista"]);
 if(c.sueno<7)A.push(["warn",`Duerme ${c.sueno} h`,"Menos de 7 h empeora la recuperación y la síntesis de proteína muscular.","resumen"]);
 if(c.ciclo){const cd=cycleDay(c,TODAY),[ph2]=cyclePhase(c,cd);
  if(diffD(c.ciclo.inicio,TODAY)>c.ciclo.len+5)A.push(["bad","Retraso de la regla",`Han pasado ${diffD(c.ciclo.inicio,TODAY)} días desde el último inicio. Revisa déficit y estrés; si se repite, derivar al ginecólogo.`,"seg"]);
  if(ph2==="pm")A.push(["info","Semana premenstrual","Puede retener líquidos: no tomar decisiones por la báscula estos días.","seg"]);
  if(x.ea!==null&&x.ea<30)A.push(["bad",`Disponibilidad energética baja: ${r0(x.ea)} kcal/kg magra`,"Riesgo de alteraciones del ciclo. Subir calorías.","plan"]);
  if(!c.lacteos)A.push(["info","Sin lácteos: vigilar calcio","Bebida vegetal enriquecida en calcio, almendras, legumbres, tofu o sardinas.","plan"]);}
 const order={bad:0,warn:1,info:2,ok:3};return A.sort((a,b)=>order[a[0]]-order[b[0]]);
}

function chart(c){
 const pts=c.pesos.slice(-35);if(pts.length<2)return'<p class="muted">Aún no hay suficientes pesos.</p>';
 const W=640,H=220,pl=40,pr=12,pt=12,pb=26;
 const ws=pts.map(p=>p[1]);let lo=Math.min(...ws),hi=Math.max(...ws);const pad=Math.max(0.3,(hi-lo)*0.15);lo=Math.floor((lo-pad)*2)/2;hi=Math.ceil((hi+pad)*2)/2;
 const d0=pts[0][0],n=diffD(d0,pts[pts.length-1][0])||1;
 const X=d=>pl+diffD(d0,d)/n*(W-pl-pr),Y=w=>pt+(hi-w)/(hi-lo)*(H-pt-pb);
 let bands="";
 if(c.ciclo){for(let i=0;i<=n;i++){const d=addD(d0,i);if(cyclePhase(c,cycleDay(c,d))[0]==="pm"){bands+=`<rect x="${X(d)-(W-pl-pr)/n/2}" y="${pt}" width="${(W-pl-pr)/n}" height="${H-pt-pb}" fill="var(--band)"/>`}}}
 const ma=pts.map((p,i)=>{const s=pts.slice(Math.max(0,i-6),i+1);return[p[0],s.reduce((a,b)=>a+b[1],0)/s.length]});
 let grid="";for(let v=lo;v<=hi+0.001;v+=(hi-lo)>3?1:0.5){grid+=`<line x1="${pl}" x2="${W-pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${pl-6}" y="${Y(v)+3}" text-anchor="end">${v.toFixed(1)}</text>`}
 let xl="";for(let i=0;i<=n;i+=7){const d=addD(d0,i);xl+=`<text x="${X(d)}" y="${H-8}" text-anchor="middle">${fmtD(d)}</text>`}
 const last=ma[ma.length-1];
 return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución del peso">${bands}${grid}${xl}
  ${pts.map(p=>`<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="2.4" fill="var(--muted)" opacity=".55"/>`).join("")}
  <polyline fill="none" stroke="var(--brand-2)" stroke-width="2.5" points="${ma.map(p=>X(p[0])+","+Y(p[1])).join(" ")}"/>
  <circle cx="${X(last[0])}" cy="${Y(last[1])}" r="4.5" fill="var(--brand-2)"/><text x="${X(last[0])-6}" y="${Y(last[1])-9}" text-anchor="end" style="fill:var(--fg);font-weight:600">${last[1].toFixed(1)}</text></svg>
  <div class="legend"><span><i style="background:var(--muted)"></i>Peso diario</span><span><i style="background:var(--brand-2)"></i>Media 7 días</span>${c.ciclo?'<span><i style="background:var(--band);height:10px"></i>Semana premenstrual (no cuenta para el ritmo)</span>':""}</div>`;
}
const CQ=[["fuera","¿Cuántas veces comes fuera a la semana?","seg",[["0","Casi nunca"],["1","1"],["2-3","2–3"],["4+","4 o más"]]],
 ["finde","¿Qué cambia el fin de semana?","area","Horarios, comidas fuera, alcohol…"],
 ["noNeg","Lo que no quieres quitar por nada","area","Tu café con leche, el chocolate de después de comer…"],
 ["noGusta","Lo que no te gusta, no comes o te sienta mal","area"],
 ["cocina","¿Quién cocina en casa?","seg",[["yo","Yo"],["otro","Pareja o familia"],["compro","Compro hecho"]]],
 ["tiempo","Tiempo para cocinar","seg",[["poco","Poco"],["normal","Normal"],["mucho","Me gusta cocinar"]]],
 ["tupper","¿Comes de tupper en el trabajo?","seg",[["si","Sí"],["aveces","A veces"],["no","No"]]],
 ["presupuesto","Presupuesto para la compra","seg",[["ajustado","Ajustado"],["normal","Normal"],["holgado","Sin problema"]]],
 ["hambre","¿Cuándo tienes más hambre?","seg",[["manana","Mañana"],["tarde","Tarde"],["noche","Noche"],["igual","Igual todo el día"]]],
 ["picoteo","¿Picas entre horas?","seg",[["nunca","Nunca"],["aveces","A veces"],["mucho","A menudo"]]],
 ["picaQue","Si picas, ¿qué sueles picar?","text"],
 ["agua","Agua al día","seg",[["<1","Menos de 1 L"],["1-2","1–2 L"],[">2","Más de 2 L"]]],
 ["bebidas","Refrescos, zumos o alcohol a la semana","text"],
 ["dieta","¿Ya tienes una dieta que quieras seguir?","seg",[["no","No"],["si","Sí, te la paso"]]]];
const qVal=(k,v)=>{const q=CQ.find(x=>x[0]===k);if(q&&q[2]==="seg"){const o=q[3].find(o=>o[0]===v);return o?o[1]:v}return v};
const TRAB=[["profesion","Profesión","text"],["horario","Horario laboral","text"],["modalidad","Cómo trabaja","sel",[["oficina","Sentado en oficina"],["teletrabajo","Teletrabajo"],["mixto","Mixto"],["pie","De pie"],["fisico","Trabajo físico"]]],["horasSentado","Horas sentado al día (total)","number"],["desplazamiento","Desplazamiento","sel",[["coche","Coche"],["transporte","Transporte público"],["andando","Andando"],["bici","Bici"]]],["pausas","¿Puede levantarse en el trabajo?","sel",[["si","Sí"],["aveces","A veces"],["no","No"]]],["actividadExtra","Otra actividad diaria","text"],["pantallas","Horas de pantalla fuera del trabajo","number"]];
const WSTEPS=[
 {t:"Datos básicos",f:[["nombre","Nombre","text"],["sexo","Sexo","seg",[["h","Hombre"],["m","Mujer"]]],["edad","Edad","number"],["peso","Peso (kg)","number"],["altura","Altura (cm)","number"],["grasa","% de grasa","number","Opcional"],["metodoGrasa","Método de medida de grasa","text","Báscula, pliegues, DEXA…"]]},
 {t:"Objetivo",f:[["fase","Fase de trabajo","seg",[["definicion","Definición"],["mantenimiento","Mantenimiento"],["volumen","Volumen"]]],["fecha","Fecha límite o evento","text","p. ej. boda en junio, hasta marzo 2028"],["pesoObj","Peso o meta concreta","text"],["porque","¿Por qué ahora? ¿Qué quiere conseguir?","area"],["intentos","Dietas o intentos anteriores y cómo fueron","area"]]},
 {t:"Trabajo y día a día",f:[["profesion","¿De qué trabaja?","text"],["horario","Horario laboral","text","p. ej. 8:00–15:00, turnos…"],["modalidad","Cómo trabaja","seg",[["oficina","Sentado en oficina"],["teletrabajo","Teletrabajo"],["mixto","Mixto"],["pie","De pie"],["fisico","Trabajo físico"]]],["horasSentado","Horas sentado al día (trabajo + casa + coche)","number"],["desplazamiento","¿Cómo va al trabajo?","seg",[["coche","Coche"],["transporte","Transporte público"],["andando","Andando"],["bici","Bici"]]],["pausas","¿Puede levantarse durante el trabajo?","seg",[["si","Sí"],["aveces","A veces"],["no","No"]]],["actividadExtra","Otra actividad diaria","text","Perro, niños, paseos, tareas de casa…"],["pantallas","Horas de pantalla fuera del trabajo","number"]]},
 {t:"Entreno y actividad",f:[["diasEnt","Días que entrena","multi",WD.map((w,i)=>[i,w])],["hora","Hora habitual de entreno","text"],["dur","Duración (min)","number"],["tipo","Tipo de entreno","text","Fuerza, hipertrofia, cardio, deporte…"],["exp","Años entrenando fuerza de forma constante","number"],["pasos","Pasos diarios habituales","number"],["pasosMin","Pasos en días flojos","number"]]},
 {t:"Alimentación",f:[["ncomidas","Comidas al día y horarios","text","p. ej. 4: 7:30 / 13:00 / 17:30 / 21:00"],["diaEnt","Un día normal de entreno (con cantidades)","area"],["diaDesc","Un día sin entreno","area"],["finde","¿Cambia el fin de semana? ¿Comidas fuera?","area"],["pesaComida","¿Pesa la comida? ¿En crudo o cocinado?","text"],["alcohol","Alcohol y bebidas con azúcar","text"],["cocina","¿Quién cocina? ¿Tiempo para cocinar?","text"]]},
 {t:"Salud y hábitos",f:[["intol","Intolerancias o alergias","text"],["noToma","Alimentos que no toma o no le gustan","text"],["sueno","Horas de sueño","number"],["calidadSueno","Calidad del sueño (1–5)","number"],["estres","Estrés (1–5)","number"],["digestion","Digestión, hinchazón, tránsito","text"],["salud","Patologías o medicación","area","Si hay algo relevante, coordinar con su médico"],["suplementos","Suplementos que toma","text"]]},
 {t:"Ciclo menstrual",women:true,f:[["cicloRegular","¿Ciclo regular?","seg",[["si","Sí"],["no","No"],["na","No aplica (menopausia, embarazo…)"]]],["cicloLen","Duración del ciclo (días)","number"],["cicloInicio","Fecha de inicio de la última regla","date"],["sangrado","Días de sangrado","number"],["anticonceptivo","Anticonceptivo hormonal","seg",[["no","No"],["si","Sí"]]],["sintomas","Síntomas premenstruales","area","Hinchazón, hambre, cansancio, dolor…"],["cambiosCiclo","¿Ha cambiado el ciclo con dietas anteriores?","text"]]},
 {t:"Medidas iniciales",f:[["_perim","Perímetros (cm)","perim"],["_fotos","Fotos de inicio","fotos"]]}
];

/* ======================= INTEGRACIÓN CON LA WEB (Supabase) ======================= */
const PLAN_KEYS=["sexo","edad","altura","grasa","fase","exp","dias","hora","dur","pasos","pasosMin","sueno","lacteos","diasEnt","trabajo","entrevista","entrevistaFecha","dayTypes","reglas","kcalAprobadas","dietaVal","pesoInicial"];
const CLI_KEYS=["pesos","perim","fotos","cuestionario","dietaSub","eventos","checkins","pasosBajos","ciclo","entrevistaCli"];
const defDay=()=>[["Desayuno",[]],["Comida",[]],["Merienda",[]],["Cena",[]]];
function defaults(){return{sexo:"h",edad:30,altura:170,grasa:null,fase:"mantenimiento",exp:0,dias:3,hora:"",dur:60,pasos:7000,pasosMin:5000,sueno:7,lacteos:true,diasEnt:[0,2,4],
 trabajo:{},entrevista:{},entrevistaFecha:null,dayTypes:[{id:"tipo",nombre:"Día tipo",dias:7,actual:defDay(),prop:defDay()}],reglas:{...REGLAS0},kcalAprobadas:null,dietaVal:null,pesoInicial:null,
 pesos:[],perim:[],fotos:{},cuestionario:{estado:"pendiente",comidas:MEALQ.map(([n,on])=>({nombre:n,on,hora:"",texto:""})),resp:{}},dietaSub:null,eventos:[],checkins:{},pasosBajos:{},ciclo:null,
 entrevistaCli:null,ajustes:[],flags:[],registros:[]}}
function derive(c){
 c.pesos.sort((a,b)=>a[0]<b[0]?-1:1);
 c.peso=c.pesos.length?c.pesos[c.pesos.length-1][1]:(c.pesoInicial||70);
 c.reglas={...REGLAS0,...c.reglas};
 const dv=c.dietaVal||{},ds=c.dietaSub;
 c.dietaExt={estado:dv.estado||(ds?"recibida":"ninguna"),fecha:ds&&ds.fecha,texto:ds&&ds.texto,fotos:(ds&&ds.fotos)||[],orig:dv.orig,corr:dv.corr,nota:dv.nota,validada:dv.validada};
 PHOTOS[c.id]=c.fotos||{};
 c.dias=c.diasEnt.length||c.dias;
 if(c.dayTypes.length>1){c.dayTypes[0].dias=c.diasEnt.length;c.dayTypes[1].dias=7-c.diasEnt.length}
}
let S=null;const URLS={};const MINDIFF={},DEXDIFF={};
window.EYLNutri={view:function(o){const root=document.createElement("div");root.className="nu";root.innerHTML='<p class="nmuted" style="text-align:center;padding:40px 0">Cargando nutrición…</p>';start(o,root);return root}};
async function start(o,root){
 S={root,sb:o.sb,coach:!!o.coach,flash:o.flash||function(){},tab:"resumen",ctab:"inicio",dayIdx:0,wk:weekStart(addD(TODAY,o.coach?1:0)),selDay:null,openEq:null,wiz:null,qedit:false,draft:{}};
 bind(root);
 try{const id=o.client.id;
  const [a,b]=await Promise.all([S.sb.from("nutri_plan").select("data").eq("cliente_id",id).maybeSingle(),S.sb.from("nutri_cliente").select("data").eq("cliente_id",id).maybeSingle()]);
  if(a.error)throw a.error;if(b.error)throw b.error;
  const c={...defaults(),...(a.data?a.data.data:{}),...(b.data?b.data.data:{})};c.id=id;c.nombre=o.client.nombre||o.client.email||"";derive(c);S.c=c;render();
 }catch(e){root.innerHTML=`<p class="err">No se pudo cargar la nutrición. ${esc(e.message||"")}</p>`}
}
/* guardar: lo del entrenador va entero a nutri_plan; lo del cliente se fusiona con lo último guardado para no pisar cambios del otro lado */
let saveT=null;const dirty=new Set();
function save(...keys){keys.forEach(k=>dirty.add(k));derive(S.c);clearTimeout(saveT);saveT=setTimeout(doSave,600)}
async function doSave(){
 const c=S.c;const ks=[...dirty];dirty.clear();setSync("Guardando…");
 try{
  const planK=ks.filter(k=>PLAN_KEYS.includes(k)),cliK=ks.filter(k=>CLI_KEYS.includes(k));
  if(planK.length&&S.coach){const o={};PLAN_KEYS.forEach(k=>{if(c[k]!==undefined)o[k]=c[k]});const r=await S.sb.from("nutri_plan").upsert({cliente_id:c.id,data:o});if(r.error)throw r.error}
  if(cliK.length){const cur=await S.sb.from("nutri_cliente").select("data").eq("cliente_id",c.id).maybeSingle();if(cur.error)throw cur.error;
   const o={...(cur.data?cur.data.data:{})};cliK.forEach(k=>{o[k]=c[k]});const r=await S.sb.from("nutri_cliente").upsert({cliente_id:c.id,data:o});if(r.error)throw r.error}
  setSync("Guardado ✓");
 }catch(e){ks.forEach(k=>dirty.add(k));setSync("Sin conexión: se guardará al volver");clearTimeout(saveT);saveT=setTimeout(doSave,8000)}
}
window.addEventListener("online",()=>{if(dirty.size)doSave()});
function setSync(t){const s=S&&S.root.querySelector("#nsync");if(s)s.textContent=t}
/* fotos: se reducen en el móvil antes de subir y se guardan en una carpeta privada por cliente */
async function resizeImg(file){const url=URL.createObjectURL(file);try{const img=new Image();await new Promise((r,j)=>{img.onload=r;img.onerror=j;img.src=url});
 const s=Math.min(1,1600/Math.max(img.width,img.height));const cv=document.createElement("canvas");cv.width=Math.round(img.width*s);cv.height=Math.round(img.height*s);
 cv.getContext("2d").drawImage(img,0,0,cv.width,cv.height);return await new Promise(r=>cv.toBlob(r,"image/jpeg",0.82))}finally{URL.revokeObjectURL(url)}}
async function upImg(file,path){const blob=await resizeImg(file);const r=await S.sb.storage.from("nutri").upload(path,blob,{upsert:true,contentType:"image/jpeg"});if(r.error)throw r.error;URLS[path]=URL.createObjectURL(blob);return path}
async function hydrate(){const els=[...S.root.querySelectorAll("img[data-path]")];const need=[...new Set(els.map(e=>e.dataset.path).filter(p=>!URLS[p]))];
 if(need.length){try{const r=await S.sb.storage.from("nutri").createSignedUrls(need,3600);(r.data||[]).forEach(x=>{if(x.signedUrl)URLS[x.path]=x.signedUrl})}catch(e){}}
 els.forEach(e=>{if(URLS[e.dataset.path])e.src=URLS[e.dataset.path]})}
const img=(p,alt)=>`<img data-path="${esc(p)}" alt="${esc(alt)}">`;

/* ======================= RENDER ======================= */
const faseTxt={volumen:"Volumen",definicion:"Definición",mantenimiento:"Mantenimiento"};
const L=l=>"l-"+l;
function render(){const c=S.c;S.root.innerHTML=S.coach?coachHTML(c):clientHTML(c);hydrate();const b=S.root.querySelector(".nmsgs");if(b)b.scrollTop=b.scrollHeight}
function checksHTML(list){return `<ul class="nchecks">${list.map(([l,t])=>`<li class="${L(l)}"><i></i><span>${esc(t)}</span></li>`).join("")}</ul>`}
function alertsHTML(A){return `<div class="nalerts">${A.map(([t,ti,tx,go])=>`<div class="nalert ${L(t)}"><i></i><div><b>${ti}</b><span>${tx}</span></div>${go&&S.coach?`<button class="btn ghost small" data-tab="${go==="asistente"?"resumen":go}">Ver</button>`:"<span></span>"}</div>`).join("")||'<p class="nmuted">Sin avisos.</p>'}</div>`}
function mealsList(meals){return meals.filter(m=>m[2]||m[1].length).map(m=>`<div class="nmealq"><div class="nrow nbetween"><b>${esc(m[0])}</b><span class="nnum nsmall">${r0(macros([m]).k)} kcal</span></div>
 ${m[2]?`<span class="nsmall">${esc(m[2].desc)}: ya está contado en tu día.</span>`:`<span class="nsmall">${m[1].map(([id,g])=>FOODS[id]?`${g} g ${FOODS[id][0].toLowerCase()}`:"").filter(Boolean).join(" · ")||"—"}</span>`}</div>`).join("")}
function dayCtx(c,date){const W=weekPlan(c,weekStart(date));return{d:W.days.find(x=>x.date===date),W}}
const hasPlan=c=>c.dayTypes.some(t=>t.prop.some(m=>m[1].length));

/* ---------- ENTRENADOR ---------- */
const TABS=[["resumen","Resumen"],["alta","Alta y dieta"],["semana","Semana"],["plan","Comidas base"],["seg","Seguimiento"],["entrevista","Entrevista"]];
function coachHTML(c){
 if(S.wiz)return wizardHTML();
 const ec=c.entrevistaCli||{};
 if(!c.entrevistaFecha)return `<div class="npanel"><h2>Nutrición de ${esc(c.nombre)}</h2>
  ${ec.estado==="enviada"?`<div class="ntask hot"><div><b>Ha enviado su entrevista inicial</b><span>El ${fmtD(ec.fecha||TODAY)}. Revísala, corrige lo que haga falta, añade una nota si quieres y valídala.</span></div><span></span></div>
   <button class="btn primary wide" data-act="wizreview">Revisar y validar</button>`
  :`<p class="nmuted">${ec.estado==="borrador"?"Ha empezado la entrevista inicial en su app, pero aún no la ha enviado.":"Aún no ha rellenado la entrevista inicial. Le sale como primera tarea al entrar en su app."} Cuando la envíe, te llegará aquí para validarla.</p>
   <button class="btn ghost wide" data-act="wizstart">Rellenarla yo</button>`}
  ${c.cuestionario.estado!=="pendiente"?'<p class="nsmall">✓ Ya ha rellenado su cuestionario de comida.</p>':""}
  ${c.dietaExt.estado!=="ninguna"?'<p class="nsmall">✓ Ya ha subido su dieta. La revisas en «Alta y dieta» después de la entrevista.</p>':""}</div>`;
 const A=alerts(c);const nBad=A.filter(a=>a[0]==="bad").length;const altaN=altaSteps(c).filter(s=>!s[1]).length;
 const body={resumen:resumenHTML,alta:altaHTML,semana:semanaHTML,plan:planHTML,seg:segHTML,entrevista:entrevistaHTML}[S.tab](c);
 return `<div class="ntabs" role="tablist">${TABS.map(([id,l])=>`<button type="button" role="tab" data-tab="${id}" aria-selected="${S.tab===id}">${l}${id==="resumen"&&nBad?`<span class="nbadge">${nBad}</span>`:""}${id==="alta"&&altaN?`<span class="nbadge gold">${altaN}</span>`:""}</button>`).join("")}</div>
 <div class="nhead"><span class="nchip phase">${faseTxt[c.fase]}</span><span class="nsmall nmuted">${c.sexo==="h"?"Hombre":"Mujer"} · ${c.edad} años · ${r1(c.peso)} kg · ${c.altura} cm${c.grasa?` · ${c.grasa} % grasa`:""}</span><span id="nsync" class="nsmall nmuted"></span></div>${body}`;
}
function resumenHTML(c){
 const x=calc(c),A=alerts(c),pr=weekAvg(c,"prop"),H=habitos(c);const kc=c.kcalAprobadas||pr.k;
 let cyc="";if(c.ciclo&&c.ciclo.inicio){const cd=cycleDay(c,TODAY),Lc=c.ciclo.len;const[,lab]=cyclePhase(c,cd);
  cyc=`<div class="npanel"><div class="nrow nbetween"><h2>Ciclo</h2><span class="nchip">Día ${cd} de ${Lc} · ${lab}</span></div>
   <div class="ncycle" style="grid-template-columns:repeat(${Lc},1fr)">${Array.from({length:Lc},(_,i)=>`<i class="${cyclePhase(c,i+1)[0]}${i+1===cd?" today":""}"></i>`).join("")}</div>
   <p class="nsmall nmuted">Pesos, perímetros y fotos se comparan en la misma fase: días 5–10. Próxima regla prevista: <b>${fmtD(addD(c.ciclo.inicio,Lc))}</b>.</p></div>`}
 return `<div class="npanel"><h2>Avisos</h2>${alertsHTML(A)}</div>
 <div class="npanel"><div class="nrow nbetween"><h2>Objetivo</h2><span class="nsmall nmuted">${x.metodo==="real"?"Con su ritmo de peso real":"Por fórmula (calibrando)"}</span></div>
  <div class="nkpis">
   <div><span class="nk">Plan vigente</span><span class="nv">${pr.k?r0(kc):"—"}</span><span class="ns">kcal/día de media${c.kcalAprobadas?" · aprobado":""}</span></div>
   <div><span class="nk">Calculado</span><span class="nv">${r0(x.kcalObj)}</span><span class="ns">kcal/día</span></div>
   <div><span class="nk">Proteína</span><span class="nv">${r0(x.P)} g</span><span class="ns">${r1(x.P/c.peso)} g/kg · plan ${r0(pr.P)}</span></div>
   <div><span class="nk">Grasa mínima</span><span class="nv">${r0(x.F)} g</span><span class="ns">${r2(x.F/c.peso)} g/kg · plan ${r0(pr.F)}</span></div>
   <div><span class="nk">Ritmo objetivo</span><span class="nv">${x.rateKg[0]>0?"+":""}${r2(x.rateKg[0])}…${r2(x.rateKg[1])}</span><span class="ns">kg/semana${x.adv?" · avanzado":""}</span></div>
   <div><span class="nk">Ritmo real</span><span class="nv">${x.slopeWk===null?"—":(x.slopeWk>0?"+":"")+r2(x.slopeWk)}</span><span class="ns">${x.slopeWk===null?`faltan ${Math.max(0,14-x.daysLogged)} días de peso`:"kg/semana"}</span></div>
  </div></div>
 ${cyc}
 <div class="npanel"><h2>Hábitos fuera de la dieta</h2>${H.length?`<div class="nhabits">${H.map(([ic,t,tx])=>`<div class="nhabit"><span aria-hidden="true">${ic}</span><div><b>${t}</b><span>${tx}</span></div></div>`).join("")}</div>`:`<p class="nmuted nsmall">Completa trabajo y actividad diaria en «Entrevista».</p>`}</div>
 <div class="npanel"><h2>Cómo sale el cálculo</h2><div class="ntbl"><table class="nmini"><tbody>
  ${x.ffm?`<tr><td>Masa magra</td><td>${r1(x.ffm)} kg</td></tr>`:""}
  <tr><td>Basal (Mifflin${x.katch?" / Katch":""})</td><td>${r0(x.mif)}${x.katch?" / "+r0(x.katch):""}</td></tr>
  <tr><td>Pasos (~${(+c.pasos).toLocaleString("es-ES")}/día)</td><td>+${r0(x.pasosK)}</td></tr>
  <tr><td>Entreno (${c.dias}×${c.dur} min/sem)</td><td>+${r0(x.entK)}</td></tr>
  <tr><td>Gasto estimado por fórmula</td><td><b>${r0(x.tdee)}</b></td></tr>
  ${x.implied?`<tr><td>Gasto deducido del peso real</td><td><b>${r0(x.implied)}</b></td></tr>`:""}
  <tr><td>Mínimo diario (nunca por debajo)</td><td>${r0(x.floor)}</td></tr>
 </tbody></table></div></div>`;
}
/* ----- alta y dieta ----- */
function altaHTML(c){
 const St=altaSteps(c);const first=St.findIndex(s=>!s[1]);
 return `<div class="npanel"><h2>Estado del alta</h2><div class="npipe">${St.map((s,i)=>`<div class="npstep ${s[1]?"done":i===first?"now":""}"><span class="nn">${s[1]?"✓":i+1}</span><div><b>${s[0]}</b><span>${esc(s[2])}</span></div></div>`).join("")}</div>
  <p class="nsmall nmuted">Al entrar en su app, lo primero que le sale es el cuestionario de comida y, si dice que trae dieta, que la suba.</p></div>
 ${c.dietaExt.estado!=="ninguna"?dietHTML(c):""}${cuestHTML(c)}`;
}
function dietHTML(c){
 const de=c.dietaExt;const T=dayTarget(c,c.dayTypes[0]);const est={recibida:["ev","Recibida"],revision:["ev","Pendiente de validar"],validada:["ent","Validada"]}[de.estado]||["","—"];
 let h=`<div class="npanel"><div class="nrow nbetween"><h2>Dieta que ha subido</h2><span class="nchip ${est[0]}">${est[1]}</span></div>
  <h3>Lo que ha enviado (${fmtD(de.fecha||TODAY)})</h3>${de.texto?`<div class="nnote" style="white-space:pre-wrap">${esc(de.texto)}</div>`:""}
  ${de.fotos.length?`<div class="nthumbs">${de.fotos.map((p,i)=>`<a data-act="zoom" data-path="${esc(p)}">${img(p,"Página "+(i+1))}</a>`).join("")}</div>`:""}`;
 if(de.estado==="recibida")return h+`<button class="btn primary wide" data-act="drevisar">Empezar a revisarla</button><p class="nsmall nmuted">Primero la pasas tal cual (transcripción) y luego haces tu versión corregida.</p></div>`;
 const orig=de.orig||[],corr=de.corr||[];const to=macros(orig),tc=macros(corr);
 h+=`<h3>1 · Transcripción del original</h3>
  <div class="ntbl"><table><thead><tr><th>Alimento</th><th>Gramos</th><th>kcal</th><th>P</th><th>HC</th><th>G</th><th></th></tr></thead><tbody>${mealRows(orig,null,"dorig")}
   <tr class="ntot"><td>Total</td><td></td><td>${r0(to.k)}</td><td>${r0(to.P)}</td><td>${r0(to.C)}</td><td>${r0(to.F)}</td><td></td></tr></tbody></table></div>
  <div class="nrow"><button class="btn ghost small" data-addmeal="dorig">+ Comida</button></div>
  ${checksHTML(checkDiet(c,orig,T))}
  <div class="nrow nbetween"><h3>2 · Tu versión corregida</h3><div class="nrow"><button class="btn ghost small" data-act="dminimal"${orig.some(m=>m[1].length)?"":" disabled"}>Corregir con cambios mínimos</button><button class="btn ghost small" data-act="dcopy">Copiar el original</button></div></div>
  ${DEXDIFF[c.id]?`<div class="nnote"><b>Cambios propuestos:</b><ul class="ndiffs">${DEXDIFF[c.id].map(x=>`<li class="${x.big?"big":""}">${esc(x.t)}</li>`).join("")||"<li>Ninguno: ya cuadra.</li>"}</ul></div>`:""}
  <div class="ntbl"><table><thead><tr><th>Alimento</th><th>Gramos</th><th>Cambio</th><th>kcal</th><th>P</th><th>HC</th><th>G</th><th></th></tr></thead><tbody>${mealRows(corr,orig,"dext")}
   <tr class="ntot"><td>Total</td><td></td><td></td><td>${r0(tc.k)}</td><td>${r0(tc.P)}</td><td>${r0(tc.C)}</td><td>${r0(tc.F)}</td><td></td></tr></tbody></table></div>
  <div class="nrow"><button class="btn ghost small" data-addmeal="dext">+ Comida</button></div>
  ${checksHTML(checkDiet(c,corr,T))}
  <label class="nf">Nota para el cliente <small>Se le muestra junto a los cambios</small><textarea data-dnota="1" placeholder="Por qué cambias lo que cambias, en lenguaje sencillo">${esc(de.nota)}</textarea></label>
  <div class="nrow"><label class="nf" style="flex:1 1 180px">Aplicar a<select id="ndDay">${c.dayTypes.map((t,i)=>`<option value="${i}">${esc(t.nombre)}</option>`).join("")}</select></label>
   <button class="btn primary" data-act="dvalidate" style="align-self:end"${corr.some(m=>m[1].length)?"":" disabled"}>${de.estado==="validada"?"Volver a enviar":"Validar y enviar"}</button></div></div>`;
 return h;
}
function cuestHTML(c){
 const q=c.cuestionario;const est={pendiente:"Pendiente",enviado:"Recibido",convertido:"Pasado a sus comidas"}[q.estado]||"";
 return `<div class="npanel"><div class="nrow nbetween"><h2>Cuestionario de comida</h2><span class="nchip ${q.estado==="pendiente"?"":"ent"}">${est}</span></div>
 ${q.estado==="pendiente"?`<p class="nmuted nsmall">Aún no lo ha rellenado. Le sale como primera tarea al entrar en su app.</p>`:cuestAnswers(c)+`
 <div class="nrow"><button class="btn primary" data-act="qtoplan">${q.estado==="convertido"?"Ver sus comidas base":"Pasar a sus comidas base"}</button></div>
 <p class="nsmall nmuted">En «Comidas base» verás estas respuestas arriba para apuntar «Lo que come ahora». Marca con 🔒 lo que no quiere quitar y después pulsa «Propuesta con cambios mínimos».</p>`}</div>`;
}
function cuestAnswers(c){const q=c.cuestionario;return `<div class="ntbl"><table class="nmini"><tbody>${q.comidas.filter(m=>m.on).map(m=>`<tr><td style="white-space:nowrap;vertical-align:top"><b>${esc(m.nombre)}</b><br><span class="nsmall nmuted">${esc(m.hora)}</span></td><td class="ntxt">${esc(m.texto)||'<span class="nmuted">—</span>'}</td></tr>`).join("")}</tbody></table></div>
 <dl class="nqa">${CQ.filter(([k])=>q.resp[k]).map(([k,l])=>`<dt>${l}</dt><dd>${esc(qVal(k,q.resp[k]))}</dd>`).join("")}</dl>`}
/* ----- semana ----- */
function weeklyReview(c){
 const x=calc(c);const curK=c.kcalAprobadas||weekAvg(c,"prop").k;const ci=c.checkins[weekStart(TODAY)]||c.checkins[addD(weekStart(TODAY),-7)]||{};
 let ch=x.kcalObj-curK;const why=[];
 if(x.metodo!=="real"){ch=0;why.push("Aún calibrando: faltan días de peso para proponer cambios.")}
 else{why.push(`Ritmo real ${x.slopeWk>0?"+":""}${r2(x.slopeWk)} kg/sem frente a objetivo ${r2(x.rateKg[0])}…${r2(x.rateKg[1])}.`);
  const below=x.slopeWk<x.rateKg[0]-0.02,above=x.slopeWk>x.rateKg[1]+0.02;
  if(!below&&!above){why.push("Dentro del rango: mantener.");ch=0}
  else if(below&&ch<0){why.push(`El plan actual ya da ${sg(curK-x.intake.k)} kcal/día respecto a lo que comía. Esperar 2 semanas.`);ch=0}
  else if(above&&ch>0){why.push(`El plan actual ya da ${sg(curK-x.intake.k)} kcal/día respecto a lo que comía. Esperar 2 semanas.`);ch=0}
  if(Math.abs(ch)>250){why.push(`Cambio limitado a ±250 kcal/día (pedía ${sg(ch)}).`);ch=Math.sign(ch)*250}
  if(ci.adherencia!=null&&ci.adherencia<80){why.push(`Adherencia ${ci.adherencia} %: primero mejorar el cumplimiento.`);ch=0}
  if(ch<0&&((ci.hambre||0)>=4||(ci.energia||5)<=2)){why.push("Hambre alta o energía baja: se suaviza a la mitad.");ch=ch/2}
  if(ch!==0&&Math.abs(ch)<100){why.push(`Diferencia de ${sg(ch)} kcal: dentro del margen de error. Mantener.`);ch=0}}
 return{curK,ch,why,ci};
}
function semanaHTML(c){
 if(!hasPlan(c))return `<div class="npanel"><p class="nmuted">Primero monta su propuesta en «Comidas base». La semana se genera a partir de ahí.</p><button class="btn ghost" data-tab="plan">Ir a Comidas base</button></div>`;
 const W=weekPlan(c,S.wk);const R=weeklyReview(c);
 if(!S.selDay||diffD(S.wk,S.selDay)<0||diffD(S.wk,S.selDay)>6)S.selDay=diffD(S.wk,TODAY)>=0&&diffD(S.wk,TODAY)<7?TODAY:S.wk;
 const D=W.days.find(d=>d.date===S.selDay);
 const shop={};W.days.forEach(d=>d.meals.forEach(m=>(m[1]||[]).forEach(([id,g])=>{shop[id]=(shop[id]||0)+g})));
 const fmtG=g=>g>=1000?r1(g/1000)+" kg":r0(g)+" g";
 return `<div class="npanel"><div class="nrow nbetween"><button class="btn ghost small" data-wk="-7" aria-label="Semana anterior">←</button><h2>${fmtD(S.wk)} – ${fmtD(addD(S.wk,6))}</h2><button class="btn ghost small" data-wk="7" aria-label="Semana siguiente">→</button></div>
  <div class="nsmall nmuted">Días de entreno:</div><div class="nseg">${WD.map((w,i)=>`<button type="button" data-ent="${i}" aria-pressed="${c.diasEnt.includes(i)}">${w}</button>`).join("")}</div>
  <div class="nkpis"><div><span class="nk">Presupuesto semanal</span><span class="nv">${r0(W.budget).toLocaleString("es-ES")}</span><span class="ns">${r0(W.budget/7)} kcal/día de media</span></div>
   <div><span class="nk">Comidas fuera</span><span class="nv">${W.days.reduce((s,d)=>s+d.evs.length,0)}</span><span class="ns">se compensan el mismo día</span></div></div>
  <div class="nweek">${W.days.map(d=>{const dd=d.m.k-d.base;return`<button type="button" class="nwday${d.date===TODAY?" today":""}" data-sel="${d.date}" aria-pressed="${d.date===S.selDay}">
   <span class="dn">${WD[dow(d.date)]} ${new Date(d.date+"T12:00:00").getDate()}</span>
   <span class="nchips"><span class="nchip ${d.train?"ent":""}">${d.train?"Entreno":"Descanso"}</span>${d.evs.length?'<span class="nchip ev">Fuera</span>':""}${d.act.length?'<span class="nchip blue">+ activ.</span>':""}${d.cyc&&(d.cyc[0]==="pm"||d.cyc[0]==="m")?`<span class="nchip red">${d.cyc[1]}</span>`:""}</span>
   <span class="dk">${r0(d.m.k)}</span><span class="dm">P ${r0(d.m.P)} · HC ${r0(d.m.C)} · G ${r0(d.m.F)}</span>
   <span class="dm ${Math.abs(dd)>=20?(dd>0?"nup":"ndown"):""}">${Math.abs(dd)>=20?sg(dd)+" vs base":"= base"}</span></button>`}).join("")}</div>
  ${W.notes.map(n=>`<div class="nnote">${esc(n)}</div>`).join("")}</div>
 ${D?`<div class="npanel"><div class="nrow nbetween"><h2>${fmtDL(D.date)}</h2><button class="btn ghost small" data-lowsteps="${D.date}">${c.pasosBajos[D.date]?"Quitar «pocos pasos»":"Marcar «pocos pasos»"}</button></div>
  ${D.why.length?`<div class="nnote"><b>Por qué cambia:</b> ${D.why.map(esc).join(" · ")}</div>`:""}
  ${D.act.map(a=>`<div class="nalert l-info"><i></i><div><b>Actividad extra: ${esc(a.txt)}</b><span>${esc(a.det)} · por "${esc(a.motivo)}"</span></div><span></span></div>`).join("")}
  <div class="ntbl"><table><thead><tr><th>Comida / alimento</th><th>Gramos</th><th>kcal</th><th>P</th><th>HC</th><th>G</th><th></th></tr></thead><tbody>
  ${D.meals.map((m,mi)=>`<tr class="nmeal"><td colspan="7">${esc(m[0])} · ${r0(macros([m]).k)} kcal</td></tr>`+
   (m[2]?`<tr class="nadd"><td>${esc(m[2].desc)} <span class="nsmall nmuted">(estimado)</span></td><td>—</td><td>${r0(m[2].kcal)}</td><td>${r0(m[2].P)}</td><td>${r0(m[2].C)}</td><td>${r0(m[2].F)}</td><td></td></tr>`:"")+
   m[1].map(([id,g],ii)=>{const f=FOODS[id];if(!f)return"";const key=D.date+"|"+mi+"|"+ii;const eq=S.openEq===key?equivs(c,id,g):[];return`<tr><td>${f[0]}</td><td>${g} g</td><td>${r0(f[1]*g/100)}</td><td>${r1(f[2]*g/100)}</td><td>${r1(f[3]*g/100)}</td><td>${r1(f[4]*g/100)}</td><td>${EQ.some(([,ids])=>ids.includes(id))?`<button class="nx" data-eq="${key}" aria-label="Equivalencias">⇄</button>`:""}</td></tr>`+
    (eq.length?`<tr class="neq"><td colspan="7">Se puede cambiar por: ${eq.map(([o,gg])=>`<b>${gg} g</b> ${FOODS[o][0].toLowerCase()}`).join(" · ")}</td></tr>`:"")}).join("")).join("")}
  <tr class="ntot"><td>Total</td><td></td><td>${r0(D.m.k)}</td><td>${r0(D.m.P)}</td><td>${r0(D.m.C)}</td><td>${r0(D.m.F)}</td><td></td></tr></tbody></table></div>
  ${eventFormHTML(c,D,true)}</div>`:""}
 <div class="npanel"><h2>Revisión semanal</h2>
  ${R.ci&&Object.keys(R.ci).length?`<p class="nsmall">Check-in del cliente: hambre ${R.ci.hambre??"—"} · energía ${R.ci.energia??"—"} · sueño ${R.ci.sueno??"—"} · estrés ${R.ci.estres??"—"} · cumplimiento ${R.ci.adherencia??"—"} %</p>`:'<p class="nsmall nmuted">Sin check-in del cliente esta semana.</p>'}
  <div class="nnote"><b>Propuesta:</b> ${R.ch===0?"mantener":sg(R.ch)+" kcal/día"} (de ${r0(R.curK)} a ${r0(R.curK+R.ch)} de media)<br>${R.why.map(esc).join("<br>")}</div>
  <div class="nrow"><button class="btn primary small" data-approve="${r0(R.curK+R.ch)}"${R.ch===0?" disabled":""}>Aprobar</button>${c.kcalAprobadas?'<button class="btn ghost small" data-approve="0">Volver al plan base</button>':""}</div></div>
 <div class="npanel"><h2>Lista de la compra</h2><ul class="nshop">${Object.entries(shop).filter(([id])=>FOODS[id]).sort((a,b)=>FOODS[a[0]][0].localeCompare(FOODS[b[0]][0])).map(([id,g])=>`<li><span>${FOODS[id][0]}</span><span class="nnum">${fmtG(g)}</span></li>`).join("")}</ul><p class="nsmall nmuted">En crudo, 7 días, sin contar comidas fuera.</p></div>`;
}
function eventFormHTML(c,D,coach){
 const evs=c.eventos.filter(e=>e.fecha===D.date);
 return `<h3>${coach?"Añadir comida fuera":"¿Comes fuera?"}</h3>
 <form class="nform" data-form="ev" data-date="${D.date}"><label class="nf">Comida<select name="comida">${D.dt.prop.map(m=>`<option>${esc(m[0])}</option>`).join("")}</select></label>
  <label class="nf">Qué es<input name="desc" placeholder="p. ej. italiano con amigos" required></label>
  <label class="nf">Tipo<select name="kcal"><option value="700">Ligera</option><option value="1100" selected>Restaurante normal</option><option value="1500">Con alcohol o postre</option><option value="2000">Celebración larga</option></select></label>
  <label class="nf">¿Ya la has comido?<select name="reg"><option value="0">Todavía no</option><option value="1">Sí, ya</option></select></label>
  <div class="nwide"><button class="btn primary small" type="submit">Añadir</button></div></form>
 ${evs.map(e=>`<div class="nnote"><div class="nrow nbetween"><b>${esc(e.comida)}: ${esc(e.desc)}</b><button class="nx" data-delev="${e.id}" aria-label="Quitar">×</button></div>${esc(describeComp(c,e))}</div>`).join("")}
 <p class="nsmall nmuted">Se compensa ese mismo día: primero el resto de comidas y, si no llega, ${{pasos:"más pasos",cardio:"cardio suave",entreno:"alargando el entreno"}[c.reglas.actividad]}. El resto de la semana no se toca.</p>`;
}
/* ----- comidas base ----- */
function mealRows(meals,cmp,key){
 return meals.map(([name,items],mi)=>{const prev=cmp?(cmp.find(m=>m[0]===name)||[name,[]])[1]:null;
  return `<tr class="nmeal"><td colspan="${cmp?8:7}"><div class="nrow nbetween"><input class="nmname" data-mname="${key},${mi}" value="${esc(name)}" aria-label="Nombre de la comida"><span><button class="btn ghost small" data-additem="${key},${mi}">+ alimento</button><button class="nx" data-delmeal="${key},${mi}" aria-label="Quitar comida">×</button></span></div></td></tr>`+
  items.map(([id,g,lk],ii)=>{const f=FOODS[id]||["(desconocido)",0,0,0,0];const old=prev?prev.find(p=>p[0]===id):null;
   const ch=!cmp?"":!old?'<span class="nup">nuevo</span>':old[1]===g?'<span class="nsame">=</span>':`<span class="${g>old[1]?"nup":"ndown"}">${g>old[1]?"+":""}${g-old[1]} g</span>`;
   return `<tr class="${cmp&&!old?"nadd":""}"><td><select data-food="${key},${mi},${ii}" aria-label="Alimento">${Object.entries(FOODS).map(([k,v])=>`<option value="${k}"${k===id?" selected":""}>${esc(v[0])}</option>`).join("")}</select></td>
   <td class="g"><input type="number" inputmode="numeric" min="0" step="5" value="${g}" data-g="${key},${mi},${ii}" aria-label="Gramos"></td>${cmp?`<td>${ch}</td>`:""}
   <td>${r0(f[1]*g/100)}</td><td>${r1(f[2]*g/100)}</td><td>${r1(f[3]*g/100)}</td><td>${r1(f[4]*g/100)}</td>
   <td class="nnowrap"><button class="nx nlock" data-lock="${key},${mi},${ii}" aria-pressed="${!!lk}" title="${lk?"Fijo: el ajuste automático no lo toca":"Marcar como fijo (no negociable)"}" aria-label="Fijar">${lk?"🔒":"🔓"}</button><button class="nx" data-del="${key},${mi},${ii}" aria-label="Quitar">×</button></td></tr>`}).join("")}).join("");
}
function getMeals(c,key){if(key==="dext")return c.dietaVal.corr;if(key==="dorig")return c.dietaVal.orig;return c.dayTypes[S.dayIdx][key]}
function planHTML(c){
 S.dayIdx=Math.min(S.dayIdx,c.dayTypes.length-1);const d=c.dayTypes[S.dayIdx];
 const A=macros(d.actual),Pm=macros(d.prop),wa=weekAvg(c,"actual"),wk=weekAvg(c,"prop");
 return `${c.cuestionario.estado!=="pendiente"?`<details class="npanel"><summary><b>Sus respuestas del cuestionario</b> <span class="nsmall nmuted">(para apuntar lo que come ahora)</span></summary>${cuestAnswers(c)}</details>`:""}
 <div class="nrow nbetween"><div class="nseg">${c.dayTypes.map((t,i)=>`<button type="button" data-day="${i}" aria-pressed="${i===S.dayIdx}">${esc(t.nombre)}</button>`).join("")}</div>
  ${c.dayTypes.length<2?'<button class="btn ghost small" data-act="adddaytype">+ Día sin entreno distinto</button>':""}</div>
 <div class="npanel"><h2>${esc(d.nombre)}: lo que come ahora</h2>
  <div class="ntbl"><table><thead><tr><th>Alimento</th><th>Gramos</th><th>kcal</th><th>P</th><th>HC</th><th>G</th><th></th></tr></thead><tbody>${mealRows(d.actual,null,"actual")}
  <tr class="ntot"><td>Total</td><td></td><td>${r0(A.k)}</td><td>${r0(A.P)}</td><td>${r0(A.C)}</td><td>${r0(A.F)}</td><td></td></tr></tbody></table></div>
  <div class="nrow"><button class="btn ghost small" data-addmeal="actual">+ Comida</button></div></div>
 <div class="npanel"><div class="nrow nbetween"><h2>${esc(d.nombre)}: propuesta</h2><div class="nrow"><button class="btn primary small" data-act="minimal"${A.k?"":" disabled"}>Propuesta con cambios mínimos</button><button class="btn ghost small" data-act="copy">Copiar lo actual</button></div></div>
  <p class="nsmall nmuted">Parte de lo que ya come y toca lo justo para su objetivo. Lo marcado con 🔒 no se cambia.</p>
  ${MINDIFF[c.id+"|"+S.dayIdx]?`<div class="nnote"><b>Cambios propuestos:</b><ul class="ndiffs">${MINDIFF[c.id+"|"+S.dayIdx].map(x=>`<li class="${x.big?"big":""}">${esc(x.t)}</li>`).join("")||"<li>Ninguno: ya cuadra.</li>"}</ul></div>`:""}
  <div class="ntbl"><table><thead><tr><th>Alimento</th><th>Gramos</th><th>Cambio</th><th>kcal</th><th>P</th><th>HC</th><th>G</th><th></th></tr></thead><tbody>${mealRows(d.prop,d.actual,"prop")}
  <tr class="ntot"><td>Total</td><td></td><td></td><td>${r0(Pm.k)}</td><td>${r0(Pm.P)}</td><td>${r0(Pm.C)}</td><td>${r0(Pm.F)}</td><td></td></tr></tbody></table></div>
  <div class="nrow"><button class="btn ghost small" data-addmeal="prop">+ Comida</button></div>
  ${checksHTML(checkDiet(c,d.prop,dayTarget(c,d)))}</div>
 <div class="npanel"><h2>Media semanal</h2><div class="nkpis">
  ${[["Ahora",wa],["Propuesta",wk]].map(([l,m])=>`<div><span class="nk">${l}</span><span class="nv">${r0(m.k)}</span><span class="ns">P ${r0(m.P)} · HC ${r0(m.C)} · G ${r0(m.F)} (${r2(m.F/c.peso)} g/kg)</span></div>`).join("")}</div></div>`;
}
/* ----- seguimiento ----- */
function perimTable(c){
 const lp=c.perim[c.perim.length-1],first=c.perim[0];
 return `<div class="ntbl"><table><thead><tr><th>Fecha</th>${PERIM.map(p=>`<th>${p[1]}</th>`).join("")}</tr></thead><tbody>
  ${c.perim.map((m,i)=>`<tr><td>${fmtD(m.fecha)}${c.ciclo&&c.ciclo.inicio?` <span class="nsmall nmuted">· día ${cycleDay(c,m.fecha)}</span>`:""}</td>${PERIM.map(([k])=>{const pv=i?c.perim[i-1][k]:null;const dd=pv!=null&&m[k]!=null?m[k]-pv:null;return`<td>${m[k]??"—"}${dd?` <span class="${dd>0?"nup":"ndown"} nsmall">${dd>0?"+":""}${r1(dd)}</span>`:""}</td>`}).join("")}</tr>`).join("")||`<tr><td colspan="${PERIM.length+1}" class="nmuted">Sin mediciones.</td></tr>`}
  ${first&&c.perim.length>1?`<tr class="ntot"><td>Desde el inicio</td>${PERIM.map(([k])=>{const dd=(lp[k]??0)-(first[k]??0);return`<td class="${dd>0?"nup":dd<0?"ndown":"nsame"}">${dd>0?"+":""}${r1(dd)}</td>`}).join("")}</tr>`:""}
 </tbody></table></div>
 ${lp?`<div class="nnote"><b>Derecha − izquierda:</b> ${PAIRS.map(([l,d,i])=>{if(lp[d]==null||lp[i]==null)return`${l}: —`;const df=lp[d]-lp[i];const cl=Math.abs(df)>=1.5?"bad":Math.abs(df)>=1?"warn":"ok";return`${l} ${df>0?"+":""}${r1(df)} cm <span class="npill ${L(cl)}">${cl==="ok"?"equilibrado":cl==="warn"?"vigilar":"revisar"}</span>`}).join(" · ")}</div>`:""}`;
}
function perimForm(c){const lp=c.perim[c.perim.length-1];
 return `<form class="nform" data-form="perim"><label class="nf">Fecha<input type="date" name="fecha" value="${TODAY}"></label>${PERIM.map(([k,l])=>`<label class="nf">${l} (cm)<input type="number" inputmode="decimal" step="0.5" name="${k}" value="${lp&&lp[k]!=null?lp[k]:""}"></label>`).join("")}
  <div class="nwide"><button class="btn primary small" type="submit">Guardar medidas</button> <span class="nsmall nmuted">Misma hora, sin bombear, cinta sin apretar.${c.ciclo?" Mejor entre los días 5 y 10 del ciclo.":""}</span></div></form>`}
function photosHTML(c){
 const dates=Object.keys(c.fotos||{}).sort();const today=(c.fotos||{})[TODAY]||{};
 let h=`<div class="nphotos">${ANGLES.map(([k,l])=>`<label class="nslot">${today[k]?img(today[k],l):`<span>${l}<br><small>Toca para subir</small></span>`}<input type="file" accept="image/*" data-photo="${k}" aria-label="Foto ${l}"></label>`).join("")}</div>
  <p class="nsmall nmuted">Misma luz, misma ropa, misma hora y mismo sitio cada mes.</p>`;
 if(dates.length>=2){const a=S.cmpA||dates[0],b=S.cmpB||dates[dates.length-1],k=S.cmpK||"frente";
  h+=`<h3>Comparativa</h3><div class="nrow"><select data-cmp="A">${dates.map(d=>`<option${d===a?" selected":""}>${d}</option>`).join("")}</select><select data-cmp="B">${dates.map(d=>`<option${d===b?" selected":""}>${d}</option>`).join("")}</select><select data-cmp="K">${ANGLES.map(([v,l])=>`<option value="${v}"${v===k?" selected":""}>${l}</option>`).join("")}</select></div>
  <div class="ncmp">${[a,b].map(d=>`<figure>${c.fotos[d]&&c.fotos[d][k]?img(c.fotos[d][k],d):'<div class="nslot">Sin foto</div>'}<figcaption>${fmtD(d)}</figcaption></figure>`).join("")}</div>`}
 return h;
}
function segHTML(c){
 const x=calc(c);const lp=c.perim[c.perim.length-1];const due=!lp||diffD(lp.fecha,TODAY)>=30;
 return `<div class="npanel"><div class="nrow nbetween"><h2>Peso</h2><span class="nsmall nmuted">${x.slopeWk===null?`Calibrando ${x.daysLogged}/14 días`:`${x.slopeWk>0?"+":""}${r2(x.slopeWk)} kg/sem · objetivo ${r2(x.rateKg[0])}…${r2(x.rateKg[1])}`}</span></div>
  ${chart(c)}${weightForm()}</div>
 <div class="npanel"><div class="nrow nbetween"><h2>Perímetros</h2>${due?'<span class="npill l-bad">Toca medir</span>':`<span class="npill l-ok">Próxima: ${fmtD(addD(lp.fecha,30))}</span>`}</div>${perimTable(c)}${perimForm(c)}</div>
 <div class="npanel"><h2>Fotos del mes</h2>${photosHTML(c)}</div>`;
}
function weightForm(){return `<form class="nrow" data-form="peso"><label class="nf" style="flex:1 1 130px">Fecha<input type="date" name="fecha" value="${TODAY}"></label><label class="nf" style="flex:1 1 110px">Peso (kg)<input type="number" inputmode="decimal" step="0.1" min="30" max="250" name="peso" required></label><button class="btn primary small" type="submit" style="align-self:end">Guardar</button></form>`}
/* ----- entrevista (ficha) ----- */
const TRAB2=TRAB;
function entrevistaHTML(c){
 const e=c.entrevista||{},t=c.trabajo||{};
 return `<div class="npanel"><h2>Entrevista inicial</h2><dl class="nqa">${Object.entries(e).map(([k,v])=>k.startsWith("§")?`<h3>${esc(k.slice(1))}</h3>`:`<dt>${esc(k)}</dt><dd>${esc(v)||'<span class="nmuted">—</span>'}</dd>`).join("")}</dl>
  <button class="btn ghost small" data-act="wizstart">Repetir entrevista</button></div>
 <div class="npanel"><h2>Trabajo y día a día</h2><div class="nform">
  ${TRAB2.map(([k,l,ty,op])=>ty==="sel"?`<label class="nf">${l}<select data-tr="${k}"><option value="">—</option>${op.map(([v,tx])=>`<option value="${v}"${t[k]===v?" selected":""}>${tx}</option>`).join("")}</select></label>`:`<label class="nf">${l}<input type="${ty}" data-tr="${k}" value="${esc(t[k])}"></label>`).join("")}</div></div>
 <div class="npanel"><h2>Datos del cálculo</h2><div class="nform">
  ${[["edad","Edad",1],["altura","Altura (cm)",1],["grasa","% grasa",0.1],["dur","Duración entreno (min)",5],["pasos","Pasos/día",500],["pasosMin","Pasos en días flojos",500],["sueno","Sueño (h)",0.5],["exp","Años entrenando fuerza",0.5]].map(([k,l,s])=>`<label class="nf">${l}<input type="number" step="${s}" data-cf="${k}" value="${c[k]??""}"></label>`).join("")}
  <label class="nf">Fase<select data-cf="fase">${Object.entries(faseTxt).map(([k,v])=>`<option value="${k}"${c.fase===k?" selected":""}>${v}</option>`).join("")}</select></label>
  <label class="nf">Lácteos<select data-cf="lacteos"><option value="1"${c.lacteos?" selected":""}>Los toma</option><option value="0"${c.lacteos?"":" selected"}>No los toma</option></select></label>
  ${c.ciclo?`<label class="nf">Inicio última regla<input type="date" data-cyc="inicio" value="${c.ciclo.inicio||""}"></label><label class="nf">Duración del ciclo<input type="number" data-cyc="len" value="${c.ciclo.len}"></label>`:""}</div></div>
 <div class="npanel"><h2>Reglas de compensación</h2><p class="nsmall">Una comida fuera se compensa <b>ese mismo día</b>.</p><div class="nform">
  <label class="nf">Recortar en el resto de comidas, hasta (kcal)<input type="number" step="50" min="0" data-rule="recorte" value="${c.reglas.recorte}"></label>
  <label class="nf">Si no llega<select data-rulesel="actividad">${[["pasos","Más pasos"],["cardio","Cardio suave"],["entreno","Alargar el entreno"]].map(([v,t])=>`<option value="${v}"${c.reglas.actividad===v?" selected":""}>${t}</option>`).join("")}</select></label>
  <label class="nf">Máx. pasos extra<input type="number" step="500" min="0" data-rule="maxPasos" value="${c.reglas.maxPasos}"></label>
  <label class="nf">Máx. min de cardio<input type="number" step="5" min="0" data-rule="maxCardio" value="${c.reglas.maxCardio}"></label>
  ${c.fase==="volumen"?`<label class="nf">En volumen, no compensar si el exceso es menor de<input type="number" step="50" data-rule="umbralVol" value="${c.reglas.umbralVol}"></label>`:""}</div></div>`;
}
/* ----- entrevista inicial (asistente) ----- */
function wizStart(c,review){const base={nombre:c.nombre,sexo:c.sexo||"h",fase:c.fase||"mantenimiento",cicloRegular:"si",anticonceptivo:"no",diasEnt:(c.diasEnt||[0,2,4]).slice(),
 edad:c.entrevistaFecha?c.edad:"",peso:c.entrevistaFecha?c.peso:"",altura:c.entrevistaFecha?c.altura:"",grasa:c.grasa||"",...(c.trabajo||{})};
 const ec=c.entrevistaCli;const prev=ec&&ec.data?JSON.parse(JSON.stringify(ec.data)):{};
 S.wiz={step:0,review:!!review,client:!S.coach,data:{...base,...prev,nombre:c.nombre,_nota:(ec&&ec.nota)||""},files:{}};render()}
function stepsFor(){return WSTEPS.filter(s=>!s.women||S.wiz.data.sexo==="m")}
function wizardHTML(){
 const St=stepsFor(),s=St[S.wiz.step],d=S.wiz.data;
 const field=([k,l,type,extra])=>{
  if(k==="nombre"||k.startsWith("_"))return"";
  if(type==="seg")return`<div class="nwide"><span class="nk">${l}</span><div class="nseg">${extra.map(([v,t])=>`<button type="button" data-wseg="${k}" data-v="${v}" aria-pressed="${d[k]===v}">${t}</button>`).join("")}</div></div>`;
  if(type==="multi")return`<div class="nwide"><span class="nk">${l}</span><div class="nseg">${extra.map(([v,t])=>`<button type="button" data-wmulti="${k}" data-v="${v}" aria-pressed="${(d[k]||[]).includes(v)}">${t}</button>`).join("")}</div></div>`;
  if(type==="area")return`<label class="nf nwide">${l}${extra?` <small>${extra}</small>`:""}<textarea data-w="${k}">${esc(d[k])}</textarea></label>`;
  if(type==="perim")return`<div class="nwide nform">${PERIM.map(([pk,pl])=>`<label class="nf">${pl}<input type="number" inputmode="decimal" step="0.5" data-w="p_${pk}" value="${esc(d["p_"+pk])}"></label>`).join("")}</div>`;
  if(type==="fotos")return`<div class="nwide nphotos">${ANGLES.map(([ak,al])=>`<label class="nslot">${S.wiz.files[ak]?`<span>✓ ${al}</span>`:`<span>${al}<br><small>Toca para subir</small></span>`}<input type="file" accept="image/*" data-wphoto="${ak}" aria-label="Foto ${al}"></label>`).join("")}</div>`;
  return`<label class="nf">${l}${extra?` <small>${extra}</small>`:""}<input type="${type}" data-w="${k}" value="${esc(d[k])}"${type==="number"?' step="any" inputmode="decimal"':""}></label>`};
 return `<div class="npanel"><h2>${S.wiz.client?"Tu entrevista inicial":S.wiz.review?"Revisar entrevista · "+esc(d.nombre):"Entrevista inicial · "+esc(d.nombre)}</h2>${S.wiz.client&&S.wiz.step===0?'<p class="nsmall nmuted">Unos 10 minutos. Con esto tu entrenador calcula tu plan de comida y entreno. Se guarda según avanzas.</p>':""}<span class="nsmall nmuted">Paso ${S.wiz.step+1} de ${St.length}</span>
  <div class="nsteps">${St.map((_,i)=>`<span class="${i<S.wiz.step?"done":i===S.wiz.step?"cur":""}"></span>`).join("")}</div>
  <h3>${s.t}</h3><div class="nform">${s.f.map(field).join("")}</div>
  ${s.t==="Trabajo y día a día"?'<div class="nnote">Con esto la web le recomienda hábitos: pausas activas si pasa muchas horas sentado, paseos tras las comidas…</div>':""}
  ${s.t==="Ciclo menstrual"?'<div class="nnote">Para comparar peso y medidas siempre en la misma fase y detectar si el plan altera el ciclo.</div>':""}
  ${S.wiz.step===St.length-1&&!S.wiz.client?`<label class="nf">Nota para ${esc(d.nombre)} <small>Opcional. Se le muestra cuando valides</small><textarea data-w="_nota" placeholder="Algo que quieras explicarle o pedirle">${esc(d._nota)}</textarea></label>`:""}
  ${S.wiz.step===St.length-1&&S.wiz.client?'<div class="nnote">Al enviarla, tu entrenador la revisa y te avisa. Si algo no lo sabes, déjalo en blanco.</div>':""}
  <div class="nrow nbetween"><button class="btn ghost" type="button" data-wnav="-1">${S.wiz.step?"← Atrás":S.wiz.client?"Salir":"Cancelar"}</button><button class="btn primary" type="button" data-wnav="1">${S.wiz.step===St.length-1?(S.wiz.client?"Enviar a mi entrenador":S.wiz.review?"Validar":"Guardar"):"Siguiente →"}</button></div></div>`;
}
function wizDraft(){if(!S.wiz||!S.wiz.client)return;const d={...S.wiz.data};delete d._nota;S.c.entrevistaCli={...(S.c.entrevistaCli||{}),estado:"borrador",data:d};save("entrevistaCli")}
async function wizClientSend(){
 const c=S.c,d={...S.wiz.data},n=v=>parseFloat(String(v??"").replace(",","."));delete d._nota;
 if(!n(d.peso)||!n(d.altura)||!n(d.edad)){S.wiz.step=0;render();S.flash("Necesitamos al menos tu edad, peso y altura");return}
 if(n(d.peso)){c.pesos=c.pesos.filter(p=>p[0]!==TODAY);c.pesos.push([TODAY,n(d.peso)])}
 const m={fecha:TODAY};let any=false;PERIM.forEach(([k])=>{const v=n(d["p_"+k]);if(v){m[k]=v;any=true}});if(any){c.perim=c.perim.filter(p=>p.fecha!==TODAY);c.perim.push(m)}
 if(d.sexo==="m"&&d.cicloRegular!=="na"&&d.cicloInicio)c.ciclo={regular:d.cicloRegular==="si",len:n(d.cicloLen)||28,sangrado:n(d.sangrado)||5,inicio:d.cicloInicio,anticonceptivo:d.anticonceptivo==="si"};
 const files=S.wiz.files;S.wiz=null;S.ctab="inicio";
 for(const k of Object.keys(files)){try{const p=await upImg(files[k],`${c.id}/fotos/${TODAY}_${k}_${Date.now()}.jpg`);c.fotos[TODAY]=c.fotos[TODAY]||{};c.fotos[TODAY][k]=p}catch(e){S.flash("No se pudo subir una foto")}}
 c.entrevistaCli={estado:"enviada",fecha:TODAY,data:d};save("entrevistaCli","pesos","perim","fotos","ciclo");render();S.flash("¡Enviada a tu entrenador!");
}
async function wizFinish(){
 if(S.wiz.client)return wizClientSend();
 const c=S.c,d=S.wiz.data,n=v=>parseFloat(String(v??"").replace(",","."));const review=S.wiz.review;
 if(!n(d.peso)||!n(d.altura)||!n(d.edad)){S.wiz.step=0;render();S.flash("Faltan edad, peso o altura");return}
 const labels={};WSTEPS.forEach(s=>{if(s.women&&d.sexo!=="m")return;if(s.t==="Medidas iniciales")return;labels["§"+s.t]="";s.f.forEach(([k,l,t,ex])=>{if(k==="nombre")return;let v=d[k];if(t==="seg")v=(ex.find(e=>e[0]===v)||[,""])[1];if(t==="multi")v=(v||[]).map(i=>WD[i]).join(", ");labels[l]=v??""})});
 const de=(d.diasEnt||[]).slice().sort();
 Object.assign(c,{sexo:d.sexo,edad:n(d.edad),altura:n(d.altura),grasa:n(d.grasa)||null,fase:d.fase,exp:n(d.exp)||0,diasEnt:de.length?de:[0,2,4],dias:de.length||3,hora:d.hora||"",dur:n(d.dur)||60,
  pasos:n(d.pasos)||7000,pasosMin:n(d.pasosMin)||0,sueno:n(d.sueno)||7,lacteos:!/l[aá]ct/i.test((d.intol||"")+(d.noToma||"")),pesoInicial:n(d.peso),
  trabajo:{profesion:d.profesion||"",horario:d.horario||"",modalidad:d.modalidad||"",horasSentado:n(d.horasSentado)||0,desplazamiento:d.desplazamiento||"",pausas:d.pausas||"",actividadExtra:d.actividadExtra||"",pantallas:n(d.pantallas)||0},
  entrevista:labels,entrevistaFecha:TODAY});
 if(d.sexo==="m"&&d.cicloRegular!=="na"&&d.cicloInicio)c.ciclo={regular:d.cicloRegular==="si",len:n(d.cicloLen)||28,sangrado:n(d.sangrado)||5,inicio:d.cicloInicio,anticonceptivo:d.anticonceptivo==="si"};
 if(!review||!c.pesos.length){c.pesos=c.pesos.filter(p=>p[0]!==TODAY);c.pesos.push([TODAY,n(d.peso)])}
 const m={fecha:TODAY};let any=false;PERIM.forEach(([k])=>{const v=n(d["p_"+k]);if(v){m[k]=v;any=true}});if(any&&(!review||!c.perim.length)){c.perim=c.perim.filter(p=>p.fecha!==TODAY);c.perim.push(m)}
 const dd={...d};delete dd._nota;c.entrevistaCli={...(c.entrevistaCli||{}),estado:"validada",validada:TODAY,data:dd,nota:(d._nota||"").trim()};
 const files=S.wiz.files;S.wiz=null;S.tab="alta";
 for(const k of Object.keys(files)){try{const p=await upImg(files[k],`${c.id}/fotos/${TODAY}_${k}_${Date.now()}.jpg`);c.fotos[TODAY]=c.fotos[TODAY]||{};c.fotos[TODAY][k]=p}catch(e){S.flash("No se pudo subir una foto")}}
 save(...PLAN_KEYS,"pesos","perim","fotos","ciclo","entrevistaCli");render();S.flash(review?"Entrevista validada":"Entrevista guardada");
}

/* ---------- CLIENTE ---------- */
const CT=[["inicio","Inicio"],["comida","Mi comida"],["dieta","Mi dieta"],["hoy","Hoy"],["medidas","Medidas"]];
function clientHTML(c){
 if(S.wiz)return wizardHTML();
 const body={inicio:cInicio,comida:cComida,dieta:cDieta,hoy:cHoy,medidas:cMedidas}[S.ctab](c);
 return `<div class="ntabs" role="tablist">${CT.map(([k,l])=>`<button type="button" role="tab" data-ctab="${k}" aria-selected="${S.ctab===k}">${l}</button>`).join("")}</div><span id="nsync" class="nsmall nmuted"></span>${body}`;
}
function cInicio(c){
 const q=c.cuestionario,de=c.dietaExt;const T=[];
 if(q.estado==="pendiente")T.push(["hot","Cuéntanos qué comes","5 minutos. Así adaptamos el plan a ti y no al revés.","comida","Empezar"]);
 if(q.resp.dieta==="si"&&de.estado==="ninguna")T.push(["hot","Pásanos la dieta que ya sigues","Una foto, una captura o el texto. Tu entrenador la revisa.","dieta","Subir"]);
 if(de.estado==="recibida"||de.estado==="revision")T.push(["","Tu entrenador está revisando tu dieta","Te avisamos cuando esté validada.",null,null]);
 if(de.estado==="validada")T.push(["","Tu dieta está validada","Mira qué ha cambiado y por qué.","dieta","Ver"]);
 const ec=c.entrevistaCli||{};
 if(!c.entrevistaFecha&&ec.estado!=="enviada")T.unshift(["hot",ec.estado==="borrador"?"Termina tu entrevista inicial":"Rellena tu entrevista inicial","Unos 10 minutos. Es lo primero: con esto se calcula tu plan.","_wiz",ec.estado==="borrador"?"Seguir":"Empezar"]);
 if(!c.entrevistaFecha&&ec.estado==="enviada")T.unshift(["","Tu entrenador está revisando tu entrevista","Te avisamos cuando esté validada.",null,null]);
 if(c.entrevistaFecha&&ec.nota&&diffD(ec.validada||TODAY,TODAY)<=14)T.unshift(["","Tu entrevista está validada","De tu entrenador: "+ec.nota,null,null]);
 const lp=c.perim[c.perim.length-1];if(c.entrevistaFecha&&(!lp||diffD(lp.fecha,TODAY)>=30))T.push(["","Toca medirse este mes","Perímetros (brazos y muslos derecho e izquierdo) y 3 fotos."+(c.ciclo?" Mejor entre los días 5 y 10 de tu ciclo.":""),"medidas","Ir"]);
 const ws=weekStart(TODAY);const ci=c.checkins[ws];
 const hoyP=c.pesos.some(p=>p[0]===TODAY);const H=habitos(c);
 let dia="";if(hasPlan(c)){const{d}=dayCtx(c,TODAY);dia=`<div class="npanel"><h2>Tu día</h2><div class="nkpis"><div><span class="nk">Calorías</span><span class="nv">${r0(d.m.k)}</span><span class="ns">${d.train?"día de entreno":"día de descanso"}</span></div><div><span class="nk">Proteína</span><span class="nv">${r0(d.m.P)} g</span><span class="ns">en ${d.meals.length} comidas</span></div></div>
  ${d.act.map(a=>`<div class="ntask hot"><div><b>Hoy toca: ${esc(a.txt)}</b><span>${esc(a.det)}</span></div><span></span></div>`).join("")}<button class="btn ghost wide" data-ctab="hoy">Ver mis comidas de hoy</button></div>`}
 return `<div class="npanel"><h2>Para hoy</h2>${T.map(([cl,t,s,go,b])=>`<div class="ntask ${cl}"><div><b>${t}</b><span>${s}</span></div>${go?(go==="_wiz"?`<button class="btn primary small" data-act="wizstart">${b}</button>`:`<button class="btn primary small" data-ctab="${go}">${b}</button>`):"<span></span>"}</div>`).join("")}
  ${hoyP?'<p class="nsmall nmuted">Peso de hoy apuntado ✓</p>':`<form class="nrow" data-form="peso"><input type="hidden" name="fecha" value="${TODAY}"><label class="nf" style="flex:1 1 140px">Tu peso de hoy, en ayunas (kg)<input type="number" inputmode="decimal" step="0.1" min="30" max="250" name="peso" required></label><button class="btn primary small" type="submit" style="align-self:end">Guardar</button></form>`}</div>
 ${dia}
 ${c.entrevistaFecha?`<div class="npanel"><h2>Check-in de la semana</h2>${ci?'<p class="nsmall nmuted">Hecho ✓. ¡Gracias!</p>':`<p class="nsmall nmuted">1 minuto. Sirve para ajustar tu plan.</p>
  <form class="nform" data-form="checkin">${[["hambre","Hambre (1–5)"],["energia","Energía (1–5)"],["sueno","Sueño (1–5)"],["estres","Estrés (1–5)"],["adherencia","¿Cuánto has cumplido? (%)"]].map(([k,l])=>`<label class="nf">${l}<input type="number" inputmode="numeric" name="${k}" min="${k==="adherencia"?0:1}" max="${k==="adherencia"?100:5}"></label>`).join("")}<div class="nwide"><button class="btn primary small" type="submit">Enviar</button></div></form>`}</div>`:""}
 ${H.length?`<div class="npanel"><h2>Tus hábitos</h2><div class="nhabits">${H.map(([ic,t,tx])=>`<div class="nhabit"><span aria-hidden="true">${ic}</span><div><b>${t}</b><span>${tx}</span></div></div>`).join("")}</div></div>`:""}`;
}
function cComida(c){
 const q=c.cuestionario;
 if(q.estado!=="pendiente"&&!S.qedit)return `<div class="npanel"><h2>¡Gracias!</h2><p>Tu entrenador ya sabe cómo comes. Lo usará para que tu plan se parezca lo más posible a lo que ya haces.</p><button class="btn ghost" data-act="qedit">Editar mis respuestas</button></div>`;
 const ph={Desayuno:"Café con leche y tostada con tomate y aceite",Comida:"Arroz con pollo y ensalada",Cena:"Tortilla francesa con verduras",Merienda:"Una fruta y un yogur"};
 return `<div class="npanel"><h2>Tus comidas de un día normal</h2><p class="nsmall nmuted">Escríbelo como lo dirías. Si sabes cantidades, mejor; si no, "un plato", "un puñado"… también vale.</p>
  ${q.comidas.map((m,i)=>`<div class="nmealq"><div class="nrow nbetween"><label class="ntog"><input type="checkbox" data-cqon="${i}"${m.on?" checked":""}>${esc(m.nombre)}</label>${m.on?`<input class="ntime" type="time" data-cqhora="${i}" value="${esc(m.hora)}" aria-label="Hora">`:""}</div>
   ${m.on?`<textarea data-cqtxt="${i}" placeholder="${ph[m.nombre]||"Qué sueles tomar"}" aria-label="Qué comes en ${esc(m.nombre)}">${esc(m.texto)}</textarea>`:""}</div>`).join("")}</div>
 <div class="npanel"><h2>Tus gustos y tu día a día</h2><div class="nform">${CQ.map(([k,l,ty,op])=>ty==="seg"?`<div class="nwide"><span class="nk">${l}</span><div class="nseg">${op.map(([v,t])=>`<button type="button" data-cqseg="${k}" data-v="${v}" aria-pressed="${q.resp[k]===v}">${t}</button>`).join("")}</div></div>`:ty==="area"?`<label class="nf nwide">${l}${op?` <small>${op}</small>`:""}<textarea data-cq="${k}">${esc(q.resp[k])}</textarea></label>`:`<label class="nf nwide">${l}<input data-cq="${k}" value="${esc(q.resp[k])}"></label>`).join("")}</div></div>
 <button class="btn primary wide" data-act="qsend">Enviar a mi entrenador</button>`;
}
function cDieta(c){
 const de=c.dietaExt;
 if(de.estado==="ninguna"){const imgs=S.draft.dietImgs||[];
  return `<div class="npanel"><h2>¿Ya sigues una dieta?</h2><p class="nsmall nmuted">Pásanosla y tu entrenador la revisa. Lo que esté bien se queda; lo que no, te lo explica.</p>
   <label class="ndrop"><input type="file" accept="image/*" multiple data-dfiles="1" aria-label="Subir fotos o capturas">Toca para subir fotos o capturas<br><small>Si es un PDF, haz captura de cada página</small></label>
   ${imgs.length?`<p class="nsmall">${imgs.length} imagen${imgs.length>1?"es":""} lista${imgs.length>1?"s":""} para enviar ✓</p>`:""}
   <label class="nf">O pega el texto<textarea data-dtexto="1" placeholder="Desayuno: …">${esc(S.draft.dietText||"")}</textarea></label>
   <button class="btn primary wide" data-act="dsend">Enviar a mi entrenador</button></div>`}
 if(de.estado!=="validada")return `<div class="npanel"><h2>En revisión</h2><p>Tu entrenador está revisando la dieta que enviaste el ${fmtD(de.fecha||TODAY)}. Mientras, sigue como hasta ahora.</p></div>`;
 const diffs=[];(de.corr||[]).forEach(mm=>mm[1].forEach(([id,g])=>{if(!FOODS[id])return;const o=((de.orig||[]).find(x=>x[0]===mm[0])||[0,[]])[1].find(x=>x[0]===id);if(!o)diffs.push(`${mm[0]}: añadimos ${g} g de ${FOODS[id][0].toLowerCase()}`);else if(o[1]!==g)diffs.push(`${mm[0]}: ${FOODS[id][0].toLowerCase()} de ${o[1]} a ${g} g`)}));
 (de.orig||[]).forEach(mm=>mm[1].forEach(([id])=>{if(!FOODS[id])return;const cm=(de.corr||[]).find(x=>x[0]===mm[0]);if(!cm||!cm[1].some(x=>x[0]===id))diffs.push(`${mm[0]}: quitamos ${FOODS[id][0].toLowerCase()}`)}));
 return `<div class="npanel"><h2>Tu dieta validada</h2>${de.nota?`<div class="nnote"><b>De tu entrenador:</b> ${esc(de.nota)}</div>`:""}
  <h3>Qué ha cambiado</h3>${diffs.length?`<ul class="ndiffs">${diffs.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:"<p>Nada: estaba bien planteada.</p>"}${mealsList(de.corr||[])}</div>`;
}
function cHoy(c){
 if(!hasPlan(c))return `<div class="npanel"><h2>Tu plan de comidas está en camino</h2><p class="nmuted">Tu entrenador lo está preparando a partir de lo que ya comes.</p></div>`;
 const{d}=dayCtx(c,TODAY);
 return `<div class="npanel"><div class="nrow nbetween"><h2>${fmtDL(TODAY)}</h2><span class="nchip ${d.train?"ent":""}">${d.train?"Entreno":"Descanso"}</span></div>
  ${d.act.map(a=>`<div class="ntask hot"><div><b>Hoy toca: ${esc(a.txt)}</b><span>${esc(a.det)}. Es parte de tu plan de hoy por "${esc(a.motivo)}".</span></div><span></span></div>`).join("")}
  ${mealsList(d.meals)}</div>
 <div class="npanel">${eventFormHTML(c,d,false)}</div>`;
}
function cMedidas(c){
 const lp=c.perim[c.perim.length-1];const due=!lp||diffD(lp.fecha,TODAY)>=30;
 return `<div class="npanel"><h2>Peso</h2><p class="nsmall nmuted">Cada mañana, en ayunas, después de ir al baño. Lo que cuenta es la media de la semana.</p>${chart(c)}${weightForm()}</div>
 <div class="npanel"><div class="nrow nbetween"><h2>Medidas del mes</h2>${due?'<span class="npill l-warn">Toca medir</span>':`<span class="npill l-ok">Próxima: ${fmtD(addD(lp.fecha,30))}</span>`}</div>${perimForm(c)}${c.perim.length?perimTable(c):""}</div>
 <div class="npanel"><h2>Fotos del mes</h2>${photosHTML(c)}</div>`;
}

/* ======================= EVENTOS ======================= */
function path(c,key,mi){return getMeals(c,key)[mi]}
function bind(root){
 root.addEventListener("click",onClick);root.addEventListener("change",onChange);
 root.addEventListener("submit",e=>{e.preventDefault();onSubmit(e.target)});
}
function onClick(e){
 const b=e.target.closest("button,a[data-act]");if(!b||!S||!S.c)return;const c=S.c,ds=b.dataset;
 if(ds.tab){S.tab=ds.tab;render();return}
 if(ds.ctab){S.ctab=ds.ctab;render();window.scrollTo(0,0);return}
 if(ds.day){S.dayIdx=+ds.day;render();return}
 if(ds.wk){S.wk=addD(S.wk,+ds.wk);S.selDay=null;S.openEq=null;render();return}
 if(ds.sel){S.selDay=ds.sel;S.openEq=null;render();return}
 if(ds.eq){S.openEq=S.openEq===ds.eq?null:ds.eq;render();return}
 if(ds.ent){const i=+ds.ent;c.diasEnt=c.diasEnt.includes(i)?c.diasEnt.filter(x=>x!==i):[...c.diasEnt,i].sort();save("diasEnt","dayTypes","dias");render();return}
 if(ds.lowsteps){if(c.pasosBajos[ds.lowsteps])delete c.pasosBajos[ds.lowsteps];else c.pasosBajos[ds.lowsteps]=true;save("pasosBajos");render();return}
 if(ds.delev){c.eventos=c.eventos.filter(x=>x.id!==ds.delev);save("eventos");render();return}
 if(ds.approve!==undefined){const v=+ds.approve;c.kcalAprobadas=v>0?v:null;save("kcalAprobadas");render();S.flash(v>0?`Aprobado: ${v} kcal/día de media`:"Plan base restaurado");return}
 if(ds.wseg){collectWiz();S.wiz.data[ds.wseg]=ds.v;render();return}
 if(ds.wmulti){collectWiz();const v=+ds.v;const a=S.wiz.data[ds.wmulti]||[];S.wiz.data[ds.wmulti]=a.includes(v)?a.filter(x=>x!==v):[...a,v];render();return}
 if(ds.wnav){collectWiz();const St=stepsFor();const s=S.wiz.step+ +ds.wnav;if(s<0){wizDraft();S.wiz=null;render();return}if(s>=St.length){wizFinish();return}S.wiz.step=s;wizDraft();render();window.scrollTo(0,0);return}
 if(ds.cqseg){c.cuestionario.resp[ds.cqseg]=ds.v;save("cuestionario");render();return}
 if(ds.addmeal){const ms=getMeals(c,ds.addmeal);const nm=["Desayuno","Media mañana","Post-entreno","Comida","Merienda","Cena","Recena"].find(x=>!ms.some(m=>m[0]===x))||"Comida extra";ms.push([nm,[["pollo",100]]]);saveMeals(ds.addmeal);render();return}
 if(ds.additem){const[k,mi]=ds.additem.split(",");path(c,k,+mi)[1].push(["pollo",100]);saveMeals(k);render();return}
 if(ds.delmeal){const[k,mi]=ds.delmeal.split(",");getMeals(c,k).splice(+mi,1);saveMeals(k);render();return}
 if(ds.del){const[k,mi,ii]=ds.del.split(",");path(c,k,+mi)[1].splice(+ii,1);saveMeals(k);render();return}
 if(ds.lock){const[k,mi,ii]=ds.lock.split(",");const it=path(c,k,+mi)[1][+ii];it[2]=it[2]?0:1;saveMeals(k);render();return}
 const act=ds.act;if(!act)return;
 if(act==="wizstart"){wizStart(c,false);window.scrollTo(0,0);return}
 if(act==="wizreview"){wizStart(c,true);window.scrollTo(0,0);return}
 if(act==="qedit"){S.qedit=true;render();return}
 if(act==="qsend"){const q=c.cuestionario;if(!q.comidas.some(m=>m.on&&m.texto.trim())){S.flash("Cuéntanos al menos una comida");return}
  q.estado=q.estado==="convertido"?"convertido":"enviado";q.fecha=TODAY;S.qedit=false;save("cuestionario");S.ctab=q.resp.dieta==="si"&&c.dietaExt.estado==="ninguna"?"dieta":"inicio";render();S.flash(S.ctab==="dieta"?"¡Gracias! Ahora pásanos tu dieta":"¡Enviado a tu entrenador!");return}
 if(act==="dsend"){dietSend();return}
 if(act==="qtoplan"){if(c.cuestionario.estado==="enviado"){c.cuestionario.estado="convertido";save("cuestionario")}S.tab="plan";S.dayIdx=0;render();window.scrollTo(0,0);return}
 if(act==="drevisar"){c.dietaVal={estado:"revision",orig:defDay(),corr:[],nota:""};save("dietaVal");render();return}
 if(act==="dcopy"){c.dietaVal.corr=JSON.parse(JSON.stringify(c.dietaVal.orig||[]));delete DEXDIFF[c.id];save("dietaVal");render();return}
 if(act==="dminimal"){const r=minimalAdjust(c,c.dietaVal.orig||[],dayTarget(c,c.dayTypes[0]));c.dietaVal.corr=r.meals;DEXDIFF[c.id]=r.diffs;save("dietaVal");render();return}
 if(act==="dvalidate"){const i=+(S.root.querySelector("#ndDay")||{value:0}).value;const dt=c.dayTypes[i];const dv=c.dietaVal;
  dt.actual=JSON.parse(JSON.stringify(dv.orig&&dv.orig.some(m=>m[1].length)?dv.orig:dv.corr));dt.prop=JSON.parse(JSON.stringify(dv.corr));dv.estado="validada";dv.validada=TODAY;save("dietaVal","dayTypes");render();S.flash("Validada: el cliente ya la ve");return}
 if(act==="minimal"){const d=c.dayTypes[S.dayIdx];const r=minimalAdjust(c,d.actual,dayTarget(c,d));d.prop=r.meals;MINDIFF[c.id+"|"+S.dayIdx]=r.diffs;save("dayTypes");render();return}
 if(act==="copy"){const d=c.dayTypes[S.dayIdx];d.prop=JSON.parse(JSON.stringify(d.actual));save("dayTypes");render();return}
 if(act==="adddaytype"){c.dayTypes[0].nombre="Día de entreno";c.dayTypes.push({id:"desc",nombre:"Día sin entreno",dias:7-c.diasEnt.length,actual:JSON.parse(JSON.stringify(c.dayTypes[0].actual)),prop:JSON.parse(JSON.stringify(c.dayTypes[0].prop))});S.dayIdx=1;save("dayTypes");render();return}
}
function saveMeals(k){save(k==="dext"||k==="dorig"?"dietaVal":"dayTypes")}
function onChange(e){
 const t=e.target;if(!S||!S.c)return;const c=S.c,ds=t.dataset;
 if(ds.food){const[k,mi,ii]=ds.food.split(",");path(c,k,+mi)[1][+ii][0]=t.value;saveMeals(k);render();return}
 if(ds.g){const[k,mi,ii]=ds.g.split(",");path(c,k,+mi)[1][+ii][1]=Math.max(0,+t.value||0);saveMeals(k);render();return}
 if(ds.mname){const[k,mi]=ds.mname.split(",");path(c,k,+mi)[0]=t.value.trim()||"Comida";saveMeals(k);return}
 if(ds.cf){c[ds.cf]=ds.cf==="fase"?t.value:ds.cf==="lacteos"?t.value==="1":(parseFloat(t.value)||0);save(ds.cf);render();S.flash("Recalculado");return}
 if(ds.tr){c.trabajo=c.trabajo||{};c.trabajo[ds.tr]=t.type==="number"?(parseFloat(t.value)||0):t.value;save("trabajo");render();return}
 if(ds.rule){c.reglas[ds.rule]=Math.max(0,parseFloat(t.value)||0);save("reglas");render();return}
 if(ds.rulesel){c.reglas[ds.rulesel]=t.value;save("reglas");render();return}
 if(ds.cyc){c.ciclo[ds.cyc]=ds.cyc==="len"?(parseInt(t.value)||28):t.value;save("ciclo");render();return}
 if(ds.cqon!==undefined){c.cuestionario.comidas[+ds.cqon].on=t.checked;save("cuestionario");render();return}
 if(ds.cqhora!==undefined){c.cuestionario.comidas[+ds.cqhora].hora=t.value;save("cuestionario");return}
 if(ds.cqtxt!==undefined){c.cuestionario.comidas[+ds.cqtxt].texto=t.value;save("cuestionario");return}
 if(ds.cq){c.cuestionario.resp[ds.cq]=t.value;save("cuestionario");return}
 if(ds.dtexto){S.draft.dietText=t.value;return}
 if(ds.dnota){c.dietaVal.nota=t.value;save("dietaVal");return}
 if(ds.cmp){S["cmp"+ds.cmp]=t.value;render();return}
 if(ds.dfiles){S.draft.dietImgs=(S.draft.dietImgs||[]).concat([...(t.files||[])]).slice(0,8);render();return}
 if(ds.wphoto){collectWiz();const f=t.files&&t.files[0];if(f)S.wiz.files[ds.wphoto]=f;render();return}
 if(ds.photo){const f=t.files&&t.files[0];if(!f)return;S.flash("Subiendo foto…");
  upImg(f,`${c.id}/fotos/${TODAY}_${ds.photo}_${Date.now()}.jpg`).then(p=>{c.fotos[TODAY]=c.fotos[TODAY]||{};c.fotos[TODAY][ds.photo]=p;save("fotos");render();S.flash("Foto guardada")},()=>S.flash("No se pudo subir la foto"));return}
}
async function dietSend(){
 const c=S.c;const imgs=S.draft.dietImgs||[];const txt=(S.draft.dietText||"").trim();
 if(!imgs.length&&!txt){S.flash("Sube una foto o pega el texto");return}
 S.flash("Enviando…");const fotos=[];
 try{for(let i=0;i<imgs.length;i++)fotos.push(await upImg(imgs[i],`${c.id}/dieta/${Date.now()}_${i}.jpg`))}catch(e){S.flash("No se pudo subir una imagen. Prueba otra vez.");return}
 c.dietaSub={fecha:TODAY,texto:txt,fotos};S.draft={};save("dietaSub");render();S.flash("Enviada a tu entrenador");
}
function onSubmit(f){
 if(!S||!S.c)return;const c=S.c;const v=n=>f.elements[n]?f.elements[n].value:"";const kind=f.dataset.form;
 if(kind==="peso"){const d=v("fecha")||TODAY,w=parseFloat(String(v("peso")).replace(",","."));if(!w)return;c.pesos=c.pesos.filter(p=>p[0]!==d);c.pesos.push([d,w]);save("pesos");render();S.flash("Peso guardado");return}
 if(kind==="perim"){const m={fecha:v("fecha")||TODAY};PERIM.forEach(([k])=>{const x=parseFloat(String(v(k)).replace(",","."));if(x)m[k]=x});c.perim=c.perim.filter(p=>p.fecha!==m.fecha);c.perim.push(m);c.perim.sort((a,b)=>a.fecha<b.fecha?-1:1);save("perim");render();S.flash("Medidas guardadas");return}
 if(kind==="ev"){const desc=v("desc").trim();if(!desc)return;const fecha=f.dataset.date,comida=v("comida");c.eventos=c.eventos.filter(e=>!(e.fecha===fecha&&e.comida===comida));
  c.eventos.push({id:"e"+Date.now(),fecha,comida,desc,kcal:+v("kcal"),registrado:v("reg")==="1"});save("eventos");render();S.flash("Añadido. Mira cómo queda tu día");return}
 if(kind==="checkin"){const ci={};["hambre","energia","sueno","estres","adherencia"].forEach(k=>{const x=v(k);if(x!=="")ci[k]=+x});c.checkins[weekStart(TODAY)]=ci;save("checkins");render();S.flash("¡Gracias!");return}
}
function collectWiz(){S.root.querySelectorAll("[data-w]").forEach(el=>{S.wiz.data[el.dataset.w]=el.value})}
})();
