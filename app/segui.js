/* ENTRENA YOUR LIFE · Control: calendario de mediciones, check-in semanal, tests de valoración y protocolos de dolor.
   Usa los estilos de nutrición (.nu). Datos en la tabla `seguimiento`; peso, perímetros y fotos se leen de `nutri_cliente`. */
(function(){"use strict";
/* ======================= FECHAS Y UTILIDADES ======================= */
const DAY=86400000;
const iso=d=>{const x=new Date(d);return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0")};
const TODAY=iso(Date.now());
const addD=(s,n)=>iso(new Date(s+"T12:00:00").getTime()+n*DAY);
const diffD=(a,b)=>Math.round((new Date(b+"T12:00:00")-new Date(a+"T12:00:00"))/DAY);
const fmtD=s=>new Date(s+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"});
const fmtDY=s=>new Date(s+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short",year:"numeric"});
const dow=s=>(new Date(s+"T12:00:00").getDay()+6)%7;
const weekStart=s=>addD(s,-dow(s));
const r1=n=>Math.round(n*10)/10;
const f2=n=>n.toFixed(2).replace(".",",");
const nf=n=>String(r1(n)).replace(".",",");
const num=v=>{if(v==null)return null;const x=parseFloat(String(v).replace(",","."));return isFinite(x)?x:null};
const esc=s=>String(s??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const L=t=>"l-"+t;
const doi=(t,d)=>`<a href="https://doi.org/${d}" target="_blank" rel="noopener">${t}</a>`;

/* ======================= CALENDARIO ======================= */
const TEST_WARN=56, TEST_DUE=84;   // batería cada 8-12 semanas
const MES=30;                      // perímetros y fotos

/* ======================= TESTS DE VALORACIÓN =======================
   mejor: "+" = más es mejor, "-" = menos es mejor. lr = se mide derecha e izquierda. */
const TESTS=[
 {k:"grip",n:"Fuerza de prensión",u:"kg",lr:true,mejor:"+",cat:"Fuerza",mat:"Dinamómetro de mano.",
  como:"De pie, brazo pegado al cuerpo y codo a 90° (siempre en la misma posición). Aprieta a tope 3-5 segundos. 2 intentos por mano con 1 minuto de descanso; apunta el mejor de cada mano."},
 {k:"sts5",n:"5 sentadillas a silla",u:"s",mejor:"-",cat:"Fuerza",mat:"Silla sin brazos de 43-45 cm y cronómetro. Siempre la misma silla.",
  como:"Brazos cruzados sobre el pecho. Levántate del todo y vuelve a sentarte 5 veces lo más rápido posible. El tiempo para al sentarte la 5.ª vez. Un intento de práctica y uno válido."},
 {k:"cmj",n:"Salto vertical (CMJ)",u:"cm",mejor:"+",cat:"Potencia",mat:"iPhone con la app My Jump Lab.",
  como:"Manos en la cintura. Baja rápido a la profundidad que te salga natural y salta al máximo; cae con las piernas estiradas. 3 saltos con 1 minuto de descanso; apunta el mejor. Graba de lado, con el móvil en el suelo a 1,5 m y a cámara lenta."},
 {k:"m6",n:"6 minutos marcha",u:"m",mejor:"+",cat:"Cardio",mat:"Recorrido llano de 20-30 m con dos conos y cronómetro. Siempre el mismo.",
  como:"Camina lo más rápido que puedas sin correr durante 6 minutos, de cono a cono. Apunta los metros totales. Haz este o el de 2 km, el que mejor encaje, y repite siempre el mismo."},
 {k:"km2",n:"2 km caminando",u:"min",mejor:"-",cat:"Cardio",mat:"Recorrido llano medido (pista, cinta o reloj con GPS).",
  como:"Camina 2 km lo más rápido que puedas sin correr. Apunta el tiempo en minutos con decimales (por ejemplo 18,5). Si llevas reloj, apunta en la nota las pulsaciones al terminar."},
 {k:"soren",n:"Biering-Sørensen (lumbar)",u:"s",mejor:"+",cat:"Core",mat:"Banco o camilla y alguien que sujete los tobillos.",
  como:"Boca abajo, con la cadera en el borde y el tronco fuera en horizontal; brazos cruzados al pecho. Aguanta recto todo lo que puedas. Para cuando el tronco cae de la horizontal o a los 240 s."},
 {k:"plancha",n:"Plancha lateral",u:"s",lr:true,mejor:"+",cat:"Core",mat:"Esterilla y cronómetro.",
  como:"Apoyado en el antebrazo y en los pies, con el cuerpo recto. Aguanta hasta que la cadera baje. Un lado, 5 minutos de descanso y el otro."},
 {k:"lunge",n:"Lunge test (tobillo)",u:"cm",lr:true,mejor:"+",cat:"Movilidad",mat:"Cinta métrica pegada al suelo, perpendicular a una pared.",
  como:"Descalzo, pie recto hacia la pared. Lleva la rodilla a tocar la pared sin levantar el talón y aleja el pie poco a poco. Apunta la máxima distancia del dedo gordo a la pared. Un cambio de menos de 2 cm puede ser error de medida."},
 {k:"sitreach",n:"Sit and reach",u:"cm",mejor:"+",cat:"Movilidad",mat:"Cajón de sit and reach o una cinta en un banco (0 = punta de los pies).",
  como:"Sentado, piernas estiradas y plantas contra el cajón. Lleva las manos juntas hacia delante despacio y aguanta 2 segundos. 2 intentos; apunta el mejor. Si no llegas a los pies, el número es negativo."},
 {k:"yb",n:"Y-Balance (compuesto)",u:"%",lr:true,mejor:"+",cat:"Equilibrio",mat:"Tres cintas en el suelo en forma de Y (o kit Y-Balance) y cinta métrica.",
  como:"Apoyado en una pierna, alcanza con la otra lo más lejos posible hacia delante, atrás-dentro y atrás-fuera sin caerte ni apoyar. 3 intentos por dirección. Compuesto = suma de las 3 mejores distancias ÷ (3 × longitud de pierna) × 100. La longitud de pierna va de la espina ilíaca anterior a la punta del tobillo interno.",calc:true},
 {k:"cintura",n:"Cintura",u:"cm",mejor:"-",cat:"Composición",mat:"Cinta métrica.",
  como:"De pie, relajado, al final de una espiración normal. Siempre en el mismo punto (a la altura del ombligo)."},
 {k:"altura",n:"Altura",u:"cm",cat:"Composición",mat:"Tallímetro o pared y escuadra.",como:"Descalzo, de espaldas a la pared, mirando al frente."}
];
const TBY=Object.fromEntries(TESTS.map(t=>[t.k,t]));
const TEST_SRC=[
 ["Fiabilidad de los tests de campo en adultos (revisión, 2022)","10.1007/s40279-021-01635-2"],
 ["Prensión y sentadillas a silla predicen la salud a largo plazo (BJSM, 2026)","10.1136/bjsports-2024-109173"],
 ["Viabilidad y seguridad de los tests (2 km caminando)","10.1186/s40798-024-00799-1"],
 ["Validez de My Jump Lab","10.3390/s24247897"],
 ["Lunge test: fiabilidad y cambio mínimo detectable","10.1016/j.math.2015.01.004"],
 ["Y-Balance: el test de equilibrio más práctico","10.26603/001c.94612"],
 ["Cintura/altura mejor que el IMC (punto de corte 0,5)","10.7759/cureus.38801"],
 ["Asimetría de prensión y mortalidad (2026)","10.1016/j.archger.2026.106237"]];

/* ======================= PROTOCOLOS DE DOLOR ======================= */
const ALARMA_GEN=["Dolor tras una caída o un golpe fuerte, con deformidad o sin poder apoyar o mover.","Fiebre, sudores nocturnos o pérdida de peso sin motivo junto con el dolor.","Dolor por la noche que no cambia al moverte ni al cambiar de postura.","Hormigueo, pérdida de fuerza o de sensibilidad que va a más.","Zona hinchada, caliente y roja."];
const ZONAS=[
 {k:"lumbar",n:"Zona lumbar",q:"Dolor en la parte baja de la espalda",
  urg:["Hormigueo o falta de sensibilidad en zona genital o entre los glúteos, o problemas para orinar o controlar el esfínter: urgencias.","Debilidad en una pierna que va a más (se te cae el pie, tropiezas)."],
  alarma:["Antecedente de cáncer, más de 50 años y dolor nuevo que no se parece a otros.","Dolor que baja por debajo de la rodilla con hormigueo: fisio o médico antes de seguir cargando."],
  hacer:["Mantente activo: caminar cada día ayuda más que el reposo. Nada de cama.","Sigue entrenando lo que no duele (piernas en máquina, tren superior sentado con respaldo).","Baja carga o rango en lo que moleste: peso muerto y remo con barra → peso muerto rumano con mancuernas ligeras, sentadilla con barra → goblet a un cajón.","Usa el semáforo: hasta 5/10 y sin empeorar al día siguiente, seguimos."],
  ejercicios:["Caminar 20-30 min","Gato-camello 2×10","Bird dog 3×8 por lado","Puente de glúteo 3×12","Plancha lateral corta 3×20 s","Peso muerto rumano ligero 3×10"],
  nota:"En la lumbalgia crónica, unas 3 sesiones/semana de 30 min durante 8 semanas es la dosis que mejor reduce el dolor; no hace falta mucho volumen.",
  src:[["Dosis de ejercicio en lumbalgia crónica (BJSM, 2026)","10.1136/bjsports-2026-111988"],["Señales de alarma de la columna (IFOMPT)","10.2519/jospt.2020.9971"]]},
 {k:"rodilla",n:"Rodilla (delante)",q:"Dolor alrededor o debajo de la rótula",
  urg:["Rodilla muy hinchada en pocas horas tras un giro o golpe, o no puedes apoyar."],
  alarma:["Se bloquea (no puedes estirarla del todo) o se va / falla.","Rodilla caliente y roja con fiebre."],
  hacer:["Alrededor de la rótula: baja temporalmente la sentadilla profunda, las zancadas largas, los saltos y bajar escaleras rápido. Trabaja en el rango que no duele.","Justo debajo de la rótula (tendón): los isométricos calman. Luego carga lenta y progresiva; los saltos vuelven al final.","Fortalece cadera y rodilla a la vez: es lo que más funciona.","Semáforo: hasta 5/10 durante el ejercicio y que a la mañana siguiente no esté peor."],
  ejercicios:["Sentadilla en pared isométrica 5×30-45 s","Extensión de cuádriceps 60°-0° 3×12","Sentadilla a cajón alto 3×10","Abducción de cadera con banda 3×15","Puente de glúteo a una pierna 3×10","Step-up bajo 3×10"],
  nota:"En el tendón rotuliano funcionan varias formas de carga (isométrica, lenta, excéntrica); lo importante es progresar la carga sin pasar del semáforo amarillo.",
  src:[["Consenso de dolor femoropatelar: ejercicio de cadera y rodilla","10.1136/bjsports-2016-096268"],["Carga en tendinopatía rotuliana (2026)","10.3390/jfmk11030348"],["Isométricos en tendinopatías (2026)","10.1016/j.clinthera.2026.04.027"]]},
 {k:"hombro",n:"Hombro",q:"Dolor al levantar el brazo o al empujar",
  urg:["Dolor en el hombro o brazo izquierdo con opresión en el pecho, falta de aire o sudor frío: urgencias.","Tras una caída no puedes levantar el brazo o el hombro se ve deformado."],
  alarma:["Hormigueo o dolor que baja por el brazo hasta la mano (puede venir del cuello).","Pérdida de fuerza clara al levantar el brazo, aunque no duela mucho."],
  hacer:["Quita temporalmente lo que reproduce el dolor: press por encima de la cabeza, fondos, aperturas profundas.","Cambia a rangos sin dolor: press en suelo, press landmine, flexiones con agarre neutro.","Fortalece el manguito y la escápula: el ejercicio mejora el dolor al moverse y la función.","Mira también el protocolo de hombro y escápula EYL (PDF)."],
  ejercicios:["Rotación externa con banda 3×12-15","Elevación en plano de la escápula (hasta 90°) 3×10","Remo con mancuerna 3×10","Press landmine 3×10","Retracción escapular en polea 3×12","Isométrico de rotación externa en pared 5×30 s"],
  nota:"El ejercicio reduce el dolor en movimiento frente a no hacer nada; no hace falta que el hombro deje de doler del todo para entrenar.",
  src:[["Ejercicio en dolor de hombro del manguito (2026)","10.1080/09593985.2026.2717392"]]},
 {k:"cervical",n:"Cuello",q:"Dolor o rigidez en la nuca",
  urg:["Mareo, visión doble, dificultad para hablar o tragar, caídas, adormecimiento de la cara o dolor de cabeza muy fuerte y nuevo: urgencias.","Dolor de cuello tras un accidente o golpe en la cabeza."],
  alarma:["Hormigueo o pérdida de fuerza en brazos o manos.","Torpeza al caminar o con las manos."],
  hacer:["Sigue activo y mueve el cuello con suavidad en el rango que no duele.","Baja temporalmente encogimientos pesados, press por encima de la cabeza y ejercicios con el cuello en tensión.","Fortalece cuello, escápula y parte alta de la espalda.","Revisa postura y descansos si pasa muchas horas sentado."],
  ejercicios:["Movilidad cervical suave 2×10 en cada dirección","Retracción de barbilla (doble mentón) 3×10","Isométricos de cuello con la mano 4×10 s","Remo y face pull ligero 3×12","Y-T en banco inclinado 3×10"],
  src:[["Guía de práctica clínica de dolor de cuello (2017)","10.2519/jospt.2017.0302"],["Señales de alarma de la columna (IFOMPT)","10.2519/jospt.2020.9971"]]},
 {k:"tobillo",n:"Tobillo (esguince)",q:"Torcedura del tobillo hacia fuera",
  urg:["No puedes dar 4 pasos seguidos apoyando, o duele al apretar el hueso de detrás del tobillo o la base del dedo pequeño del pie: médico para radiografía."],
  alarma:["Inestabilidad que se repite (se te tuerce a menudo).","Hinchazón o dolor que no mejora en 1-2 semanas."],
  hacer:["Los primeros días: apoyo según tolerancia, movilidad suave y hielo si alivia. Nada de inmovilizar sin indicación médica.","Empieza pronto con equilibrio y fuerza; es lo que más evita que se repita.","Vuelve a saltos y cambios de dirección cuando aguantes 30 s a una pierna sin molestias y el lunge test sea parecido al otro lado."],
  ejercicios:["Movilidad de tobillo en todas direcciones","Equilibrio a una pierna 3×30 s (luego ojos cerrados o en bosu)","Elevación de talones 3×15","Eversión con banda 3×15","Y-Balance como ejercicio","Saltitos suaves en el sitio cuando no duela"],
  src:[["Guía de esguince lateral de tobillo (revisión 2021)","10.2519/jospt.2021.0302"]]},
 {k:"codo",n:"Codo (por fuera)",q:"Dolor en la parte de fuera del codo al agarrar",
  urg:["Golpe o caída con deformidad o sin poder mover el codo."],
  alarma:["Hormigueo en los dedos.","Codo hinchado y caliente."],
  hacer:["Reduce el agarre fuerte: usa straps en tirones y peso muerto, agarre neutro y barras gruesas solo si no duelen.","Mantén el resto del entreno.","Empieza con isométricos de los extensores de la muñeca y pasa a ejercicios lentos con carga.","Semáforo: molestia hasta 5/10 permitida si al día siguiente no está peor."],
  ejercicios:["Isométrico de extensión de muñeca 5×30-45 s","Extensión de muñeca lenta con mancuerna (3 s bajando) 3×15","Pronación/supinación con martillo 3×12","Agarre con pelota o pinza suave 3×20"],
  src:[["Isométricos en tendinopatías (2026)","10.1016/j.clinthera.2026.04.027"]]},
 {k:"cadera",n:"Cadera (lateral)",q:"Dolor en la parte de fuera de la cadera, que empeora al tumbarse de ese lado",
  urg:["Tras una caída duele la ingle y no puedes apoyar: urgencias."],
  alarma:["Dolor en la ingle al caminar o al girar la cadera (puede ser la articulación, no el glúteo).","Dolor nocturno constante con fiebre."],
  hacer:["Evita cruzar las piernas y estar de pie cargando el peso en una cadera.","Duerme sin apoyarte en ese lado o con una almohada entre las rodillas.","Evita estiramientos que aprieten esa zona (cruzar la pierna hacia dentro, figura 4 intensa).","Educación + ejercicio funciona mejor que la infiltración y que esperar."],
  ejercicios:["Isométrico de abducción tumbado boca arriba con banda 5×30 s","Puente de glúteo 3×12","Sentadilla a cajón 3×10","Step-up 3×10","Peso muerto rumano 3×10","Abducción de pie con banda 3×15 (cuando no duela)"],
  src:[["Educación + ejercicio en tendinopatía glútea (BMJ, 2018)","10.1136/bmj.k1662"]]},
 {k:"aquiles",n:"Tendón de Aquiles",q:"Dolor por encima del talón, sobre todo por la mañana o al empezar a correr",
  urg:["Chasquido o sensación de patada en el talón y no puedes ponerte de puntillas: urgencias (posible rotura)."],
  alarma:["Hinchazón grande o dolor en los dos lados a la vez junto con otras articulaciones."],
  hacer:["Puedes seguir activo con el semáforo: hasta 5/10 y que a la mañana siguiente no esté peor.","Reduce saltos, sprints y cuestas mientras tanto.","Elevaciones de talón progresivas: de pie con las dos, luego a una pierna, luego con peso.","No estires el tendón colgando el talón de un escalón si duele."],
  ejercicios:["Isométrico de puntillas 5×30-45 s","Elevación de talones a dos piernas 3×15 (3 s bajando)","Elevación de talones a una pierna 3×12","Elevación de talones sentado con peso 3×12","Saltitos y comba cuando el semáforo esté verde"],
  src:[["Seguir activo con el modelo de control del dolor (Aquiles)","10.1177/0363546506298279"],["Guía de tendinopatía de Aquiles (revisión 2024)","10.1016/j.jphys.2025.06.001"]]}
];
const ZBY=Object.fromEntries(ZONAS.map(z=>[z.k,z]));
const RECUP=[[1,"Muy mal"],[2,"Mal"],[3,"Normal"],[4,"Bien"],[5,"Genial"]];

/* ======================= ESTADO Y DATOS ======================= */
let S=null;
function defaults(){return{checkins:{},tests:[]}}
window.EYLSegui={view:function(o){const root=document.createElement("div");root.className="nu sg";root.innerHTML='<p class="nmuted" style="text-align:center;padding:40px 0">Cargando…</p>';start(o,root);return root}};
async function start(o,root){
 S={root,sb:o.sb,coach:!!o.coach,flash:o.flash||function(){},id:o.client.id,nombre:o.client.nombre||"",tab:"control",zona:null,editCi:false,newTest:false};
 bind(root);
 try{
  const [a,b]=await Promise.all([S.sb.from("seguimiento").select("data").eq("cliente_id",S.id).maybeSingle(),S.sb.from("nutri_cliente").select("data").eq("cliente_id",S.id).maybeSingle()]);
  if(a.error)throw a.error;if(b.error)throw b.error;
  S.d={...defaults(),...(a.data?a.data.data:{})};
  const n=b.data?b.data.data:{};
  S.n={pesos:(n.pesos||[]).map(p=>p[0]).sort(),perim:(n.perim||[]).map(p=>p.fecha).sort(),fotos:Object.keys(n.fotos||{}).sort()};
  render();
 }catch(e){root.innerHTML=`<p class="err">No se pudo cargar el control. ${esc(e.message||"")}</p>`}
}
/* guardar: se lee lo último y se aplica solo este cambio, para no pisar lo que haya guardado la otra parte */
async function mutate(fn,ok){
 try{
  const cur=await S.sb.from("seguimiento").select("data").eq("cliente_id",S.id).maybeSingle();if(cur.error)throw cur.error;
  const d={...defaults(),...(cur.data?cur.data.data:{})};fn(d);
  const r=await S.sb.from("seguimiento").upsert({cliente_id:S.id,data:d});if(r.error)throw r.error;
  S.d=d;render();if(ok)S.flash(ok);return true;
 }catch(e){S.flash(/fetch|network/i.test(e.message||"")?"Sin conexión: no se ha guardado. Prueba otra vez.":"No se ha guardado: "+(e.message||"error"));return false}
}

/* ======================= CÁLCULOS ======================= */
const last=a=>a.length?a[a.length-1]:null;
function testsSorted(){return (S.d.tests||[]).slice().sort((a,b)=>a.fecha<b.fecha?-1:1)}
function val(t,k,side){const v=t.v&&t.v[k];if(v==null)return null;return side?num(v[side]):num(v)}
function asym(d,i){if(d==null||i==null)return null;const m=Math.max(d,i);return m?Math.abs(d-i)/m*100:0}
/* último test en el que se midió k (para no perder avisos si en la última batería no se repitió) */
function lastWith(k){const ts=testsSorted();for(let i=ts.length-1;i>=0;i--){if(ts[i].v&&ts[i].v[k]!=null)return ts[i]}return null}
function lastAltura(){const t=lastWith("altura");return t?val(t,"altura"):null}
function whtrLast(){const t=lastWith("cintura"),h=lastAltura();return t&&h?val(t,"cintura")/h:null}

function agenda(){
 const ws=weekStart(TODAY),ci=S.d.checkins[ws];
 const lp=last(S.n.pesos),lm=last(S.n.perim),lf=last(S.n.fotos),lt=last(testsSorted());
 const age=x=>x?diffD(x,TODAY):null;
 const it=[];
 const ap=age(lp);
 it.push({k:"peso",t:"Peso",f:"Cada día, en ayunas",st:ap===null?"bad":ap<=1?"ok":ap<=3?"warn":"bad",
  tx:ap===null?"Sin registros":ap===0?"Hoy ✓":`Último: hace ${ap} d`,go:"nutri"});
 it.push({k:"checkin",t:"Check-in semanal",f:"Cada semana (domingo o lunes)",st:ci?"ok":dow(TODAY)>=4?"bad":"warn",
  tx:ci?"Hecho esta semana ✓":"Pendiente esta semana",go:"checkin"});
 const am=age(lm);
 it.push({k:"perim",t:"Perímetros",f:"Cada mes",st:am===null||am>=MES?"bad":am>=MES-4?"warn":"ok",
  tx:am===null?"Sin medidas":am>=MES?`Toca medir (hace ${am} d)`:`Próxima: ${fmtD(addD(lm,MES))}`,go:"nutri"});
 const af=age(lf);
 it.push({k:"fotos",t:"Fotos",f:"Cada mes",st:af===null||af>=MES?"bad":af>=MES-4?"warn":"ok",
  tx:af===null?"Sin fotos":af>=MES?`Toca hacerlas (hace ${af} d)`:`Próximas: ${fmtD(addD(lf,MES))}`,go:"nutri"});
 const at=lt?age(lt.fecha):null;
 it.push({k:"tests",t:"Tests de valoración",f:"Cada 8-12 semanas",st:at===null||at>=TEST_DUE?"bad":at>=TEST_WARN?"warn":"ok",
  tx:at===null?"Falta la valoración inicial":at>=TEST_DUE?`Toca repetir (hace ${Math.round(at/7)} semanas)`:at>=TEST_WARN?`Se puede repetir ya (hace ${Math.round(at/7)} semanas)`:`Próxima: entre ${fmtD(addD(lt.fecha,TEST_WARN))} y ${fmtD(addD(lt.fecha,TEST_DUE))}`,go:"tests"});
 return it;
}
function alerts(){
 const A=[],c=S.coach,ws=weekStart(TODAY),cur=S.d.checkins[ws],prev=S.d.checkins[addD(ws,-7)];
 [[cur,"esta semana"],[prev,"la semana pasada"]].forEach(([ci,cuando],i)=>{
  if(!ci||ci.dolor==null)return;const z=ZBY[ci.zona];const zn=z?z.n.toLowerCase():"una zona";
  if(ci.dolor>=6&&(i===0||!cur))A.push(["bad",`Dolor ${ci.dolor}/10 en ${zn} ${cuando}`,c?"Revisa el protocolo y ajusta la pauta. Si hay señales de alarma, derivar.":"Mira el protocolo y avisa a tu entrenador antes del próximo entreno.",z?z.k:"dolor"]);
 });
 if(cur&&prev&&cur.zona&&cur.zona===prev.zona&&cur.dolor>=3&&prev.dolor>=3&&cur.dolor<6)
  A.push(["warn",`Dolor en ${ZBY[cur.zona]?ZBY[cur.zona].n.toLowerCase():"la misma zona"} dos semanas seguidas`,c?"Aplica el protocolo y vigila que no suba.":"Sigue el protocolo. Si en una semana no mejora, coméntalo.",cur.zona]);
 if(cur&&cur.recup!=null&&cur.recup<=2)A.push(["warn","Recuperación baja esta semana",c?"Valora bajar volumen o intensidad unos días y revisar sueño y estrés.":"Duerme un poco más esta semana y coméntalo con tu entrenador."]);
 [["grip","Prensión",10],["plancha","Plancha lateral",20],["yb","Y-Balance",10]].forEach(([k,n,lim])=>{const t=lastWith(k);if(!t)return;const a=asym(val(t,k,"d"),val(t,k,"i"));if(a!=null&&a>lim)A.push(["warn",`${n}: ${Math.round(a)} % de diferencia entre lados`,c?"Añade trabajo unilateral del lado débil y vuelve a medir en la próxima batería.":"Tu entrenador lo tendrá en cuenta en la pauta."])});
 const tl=lastWith("lunge");if(tl){const dl=val(tl,"lunge","d"),il=val(tl,"lunge","i");if(dl!=null&&il!=null&&Math.abs(dl-il)>=2)A.push(["warn",`Tobillo: ${nf(Math.abs(dl-il))} cm de diferencia en el lunge test`,"Más que el error de medida (~2 cm). Trabajar movilidad del tobillo más rígido."])}
 const w=whtrLast();
 if(w&&w>=0.5)A.push([w>=0.6?"bad":"warn",`Cintura/altura: ${f2(w)}`,"Desde 0,5 aumenta el riesgo cardiometabólico. Objetivo: bajar de 0,5."]);
 const order={bad:0,warn:1,info:2,ok:3};return A.sort((a,b)=>order[a[0]]-order[b[0]]);
}

/* ======================= VISTAS ======================= */
const TABS=[["control","Calendario"],["checkin","Check-in"],["tests","Tests"],["dolor","Dolor"]];
function render(){
 const A=alerts();
 S.root.innerHTML=`<nav class="ntabs" role="tablist" aria-label="Control">${TABS.map(([k,l])=>`<button type="button" role="tab" data-tab="${k}" aria-selected="${S.tab===k}">${l}${k==="control"&&A.some(a=>a[0]==="bad")?'<span class="nbadge">!</span>':""}</button>`).join("")}</nav>`+
  ({control:controlHTML,checkin:checkinHTML,tests:testsHTML,dolor:dolorHTML}[S.tab])(A);
 if(S.tab==="dolor"&&S.zona){const z=S.root.querySelector(`[data-z="${S.zona}"]`);if(z){z.open=true;setTimeout(()=>z.scrollIntoView({block:"start",behavior:"smooth"}),30)}S.zona=null}
}
function alertsHTML(A){return `<div class="nalerts">${A.map(([t,ti,tx,z])=>`<div class="nalert ${L(t)}"><i></i><div><b>${esc(ti)}</b><span>${esc(tx)}</span></div>${z?`<button class="btn ghost small" type="button" data-zona="${z}">Protocolo</button>`:"<span></span>"}</div>`).join("")||'<p class="nmuted">Todo en orden.</p>'}</div>`}

function controlHTML(A){
 const it=agenda();
 return `<div class="npanel"><h2>${S.coach?"Calendario de control":"Tu calendario de control"}</h2>
  <p class="nsmall nmuted">${S.coach?"Qué le toca medir y cuándo.":"Lo que te toca medir y cuándo. Cuanto más constante, mejor podemos ajustar tu plan."}</p>
  <div class="sgcal">${it.map(x=>`<button type="button" class="sgrow" data-go="${x.go}"><i class="${L(x.st)}"></i><span><b>${x.t}</b><small>${x.f}</small></span><em class="npill ${L(x.st)}">${esc(x.tx)}</em></button>`).join("")}</div>
  <p class="nsmall nmuted">Peso, perímetros y fotos se apuntan en Nutrición.</p></div>
 <div class="npanel"><h2>Avisos</h2>${alertsHTML(A)}</div>`;
}

function checkinHTML(){
 const ws=weekStart(TODAY),ci=S.d.checkins[ws];
 const weeks=Object.keys(S.d.checkins).sort().reverse().slice(0,10);
 let form;
 if(ci&&!S.editCi)form=`<div class="nkpis"><div><span class="nk">Dolor máx.</span><span class="nv">${ci.dolor??"—"}/10</span><span class="ns">${ci.zona&&ZBY[ci.zona]?ZBY[ci.zona].n:ci.zona==="otra"?"Otra zona":"Sin dolor"}</span></div>
   <div><span class="nk">Recuperación</span><span class="nv">${ci.recup??"—"}/5</span><span class="ns">${ci.recup?RECUP[ci.recup-1][1]:""}</span></div>
   <div><span class="nk">Pasos/día</span><span class="nv">${ci.pasos?Number(ci.pasos).toLocaleString("es-ES"):"—"}</span></div>
   <div><span class="nk">Sesiones</span><span class="nv">${ci.sesiones??"—"}</span></div></div>
   ${ci.nota?`<p class="nnote">${esc(ci.nota)}</p>`:""}
   ${ci.zona&&ZBY[ci.zona]&&ci.dolor>=3?`<button class="btn ghost small" type="button" data-zona="${ci.zona}">Ver protocolo de ${esc(ZBY[ci.zona].n.toLowerCase())}</button>`:""}
   <button class="btn ghost small" type="button" data-act="editci">Editar</button>`;
 else{const v=ci||{};
  form=`<form class="nform" data-form="checkin">
   <div class="nwide"><span class="nf">Dolor máximo esta semana (0 = nada, 10 = el peor)</span>
    <div class="nseg sgpain" role="group" aria-label="Dolor de 0 a 10">${Array.from({length:11},(_,i)=>`<button type="button" data-pick="dolor" data-v="${i}" aria-pressed="${v.dolor===i}">${i}</button>`).join("")}</div>
    <input type="hidden" name="dolor" value="${v.dolor??""}"></div>
   <label class="nf">Zona del dolor<select name="zona"><option value="">Ninguna</option>${ZONAS.map(z=>`<option value="${z.k}"${v.zona===z.k?" selected":""}>${z.n}</option>`).join("")}<option value="otra"${v.zona==="otra"?" selected":""}>Otra</option></select></label>
   <div class="nwide"><span class="nf">¿Cómo te has recuperado esta semana?</span>
    <div class="nseg" role="group" aria-label="Recuperación">${RECUP.map(([n,l])=>`<button type="button" data-pick="recup" data-v="${n}" aria-pressed="${v.recup===n}">${l}</button>`).join("")}</div>
    <input type="hidden" name="recup" value="${v.recup??""}"></div>
   <label class="nf">Pasos medios al día<input type="number" inputmode="numeric" name="pasos" min="0" max="60000" step="100" value="${v.pasos??""}"></label>
   <label class="nf">Entrenos hechos<input type="number" inputmode="numeric" name="sesiones" min="0" max="14" value="${v.sesiones??""}"></label>
   <label class="nf nwide">Algo que comentar<textarea name="nota" placeholder="Molestias, cansancio, viajes, cambios en el trabajo…">${esc(v.nota||"")}</textarea></label>
   <div class="nwide"><button class="btn primary small" type="submit">Guardar check-in</button></div></form>`}
 return `<div class="npanel"><div class="nrow nbetween"><h2>Semana del ${fmtD(ws)}</h2>${ci?'<span class="npill l-ok">Hecho</span>':'<span class="npill l-warn">Pendiente</span>'}</div>
  <p class="nsmall nmuted">1 minuto. ${S.coach?"Lo rellena el cliente cada semana.":"Hambre, energía y sueño van en el check-in de Nutrición."}</p>${form}</div>
 ${weeks.length?`<div class="npanel"><h2>Últimas semanas</h2><div class="ntbl"><table class="nmini"><thead><tr><th>Semana</th><th>Dolor</th><th>Zona</th><th>Recup.</th><th>Pasos</th><th>Ent.</th></tr></thead><tbody>
  ${weeks.map(w=>{const c=S.d.checkins[w];const pc=c.dolor>=6?"ndown":c.dolor>=3?"sgwarn":"";return `<tr><td>${fmtD(w)}</td><td class="${pc}">${c.dolor??"—"}</td><td class="ntxt">${c.zona&&ZBY[c.zona]?esc(ZBY[c.zona].n):c.zona==="otra"?"Otra":"—"}</td><td>${c.recup??"—"}</td><td>${c.pasos?Number(c.pasos).toLocaleString("es-ES"):"—"}</td><td>${c.sesiones??"—"}</td></tr>`}).join("")}
  </tbody></table></div>${weeks.some(w=>S.d.checkins[w].nota)?`<h3>Comentarios</h3>${weeks.filter(w=>S.d.checkins[w].nota).map(w=>`<p class="nsmall"><b>${fmtD(w)}:</b> ${esc(S.d.checkins[w].nota)}</p>`).join("")}`:""}</div>`:""}`;
}

function fmtVal(t,x,side){const v=val(x,t.k,side);return v==null?"—":nf(v)}
function trend(t,a,b,side){
 const va=val(a,t.k,side),vb=val(b,t.k,side);if(va==null||vb==null||!t.mejor)return"";
 const d=vb-va;if(!d)return` <span class="nsame nsmall">=</span>`;
 const good=(d>0)===(t.mejor==="+");return ` <span class="${good?"nup":"ndown"} nsmall">${d>0?"+":"−"}${nf(Math.abs(d))}</span>`;
}
function testsHTML(){
 const ts=testsSorted(),lt=last(ts),first=ts[0],prev=ts.length>1?ts[ts.length-2]:null;
 const due=!lt||diffD(lt.fecha,TODAY)>=TEST_WARN;
 let h=`<div class="npanel"><div class="nrow nbetween"><h2>Tests de valoración</h2>${lt?`<span class="npill ${due?"l-warn":"l-ok"}">${due?"Toca repetir":"Próxima: "+fmtD(addD(lt.fecha,TEST_WARN))}</span>`:'<span class="npill l-bad">Falta la inicial</span>'}</div>
  <p class="nsmall nmuted">Cada 8-12 semanas, en las mismas condiciones: misma hora, mismo calentamiento, sin entreno duro las 48 h anteriores. Si un test no se puede hacer, se deja en blanco.</p>
  ${S.newTest?newTestHTML():`<button class="btn primary small" type="button" data-act="newtest">+ Nueva valoración</button>`}</div>`;
 if(lt){
  const w=val(lt,"cintura")!=null?whtrLast():null;
  h+=`<div class="npanel"><div class="nrow nbetween"><h2>Resultados</h2><span class="nsmall nmuted">Último: ${fmtDY(lt.fecha)}${prev?` · cambio frente al ${fmtD(prev.fecha)}`:""}</span></div>
  <div class="ntbl"><table class="nmini sgtests"><thead><tr><th>Test</th><th>${first&&first!==lt?fmtD(first.fecha):""}</th><th>${fmtD(lt.fecha)}</th></tr></thead><tbody>
  ${TESTS.filter(t=>t.k!=="altura").map(t=>{
   const sides=t.lr?[["d","Dcha."],["i","Izq."]]:[[null,""]];
   if(!ts.some(x=>t.lr?(val(x,t.k,"d")!=null||val(x,t.k,"i")!=null):val(x,t.k)!=null))return"";
   return sides.map(([s,sl],j)=>`<tr><td>${j?"":`<b>${t.n}</b> `}<span class="nsmall nmuted">${sl?sl+" · ":""}${t.u}</span></td><td class="nmuted">${first&&first!==lt?fmtVal(t,first,s):""}</td><td>${fmtVal(t,lt,s)}${prev?trend(t,prev,lt,s):""}</td></tr>`).join("")}).join("")}
  ${w?`<tr class="ntot"><td><b>Cintura / altura</b></td><td></td><td class="${w>=0.5?"ndown":"nup"}">${f2(w)}</td></tr>`:""}
  </tbody></table></div>
  ${lt.nota?`<p class="nnote">${esc(lt.nota)}</p>`:""}
  <p class="nsmall nmuted">Verde = mejora, rojo = empeora. Los cambios pequeños (menos de un 5 %) pueden ser error de medida.</p></div>`;
  h+=`<details class="npanel"><summary><b>Historial (${ts.length})</b></summary>${ts.slice().reverse().map(x=>`<div class="nrow nbetween sghist"><span>${fmtDY(x.fecha)} · ${Object.keys(x.v||{}).length} tests</span>${S.coach?`<button class="nx" type="button" data-deltest="${x.id}" aria-label="Borrar valoración del ${fmtD(x.fecha)}">×</button>`:""}</div>`).join("")}</details>`;
 }
 h+=`<details class="npanel"><summary><b>Cómo se hace cada test</b></summary><div class="sgguide">${TESTS.map(t=>`<div><h3>${t.n} <span class="nchip">${t.cat}</span></h3><p class="nsmall"><b>Material:</b> ${esc(t.mat)}</p><p class="nsmall">${esc(t.como)}</p></div>`).join("")}</div></details>
  <details class="npanel"><summary><b>Por qué estos tests</b></summary><p class="nsmall">Son los más fiables en adultos según revisiones recientes de PubMed. La fuerza de prensión y las sentadillas a silla, además, predicen la salud a largo plazo. No uso tests como el FMS o el equilibrio a la pata coja porque su fiabilidad es baja.</p>
  <ul class="nsmall sgsrc">${TEST_SRC.map(([t,d])=>`<li>${doi(t,d)}</li>`).join("")}</ul></details>`;
 return h;
}
function newTestHTML(){
 const h=lastAltura();
 return `<form class="sgform" data-form="test">
  <label class="nf">Fecha<input type="date" name="fecha" value="${TODAY}" max="${TODAY}" required></label>
  ${TESTS.map(t=>`<fieldset class="sgf"><legend>${t.n} <span class="nsmall nmuted">(${t.u}${t.mejor?t.mejor==="+"?" · más es mejor":" · menos es mejor":""})</span></legend>
   <details class="sghow"><summary>Cómo se hace</summary><p class="nsmall"><b>Material:</b> ${esc(t.mat)}</p><p class="nsmall">${esc(t.como)}</p></details>
   ${t.calc?ybCalcHTML():""}
   <div class="sgin">${t.lr?`<label class="nf">Derecha<input type="text" inputmode="decimal" name="${t.k}_d" autocomplete="off"></label><label class="nf">Izquierda<input type="text" inputmode="decimal" name="${t.k}_i" autocomplete="off"></label>`
    :`<label class="nf">Resultado (${t.u})<input type="text" inputmode="decimal" name="${t.k}" autocomplete="off"${t.k==="altura"&&h?` value="${nf(h)}"`:""}></label>`}</div></fieldset>`).join("")}
  <label class="nf">Notas (condiciones, sensaciones, pulsaciones…)<textarea name="nota"></textarea></label>
  <div class="nrow"><button class="btn primary small" type="submit">Guardar valoración</button><button class="btn ghost small" type="button" data-act="canceltest">Cancelar</button></div>
 </form>`;
}
function ybCalcHTML(){return `<details class="sghow"><summary>Calculadora del compuesto</summary><div class="sgin sgyb">
  <label class="nf">Long. pierna (cm)<input type="text" inputmode="decimal" data-yb="len"></label>
  ${["d","i"].map(s=>["ant","pm","pl"].map(dir=>`<label class="nf">${s==="d"?"Dcha.":"Izq."} ${dir==="ant"?"delante":dir==="pm"?"atrás-dentro":"atrás-fuera"}<input type="text" inputmode="decimal" data-yb="${s}_${dir}"></label>`).join("")).join("")}
 </div><p class="nsmall nmuted">Al rellenar las 3 distancias de un lado se calcula su compuesto solo.</p></details>`}

function dolorHTML(){
 return `<div class="npanel"><h2>Si algo duele</h2>
  <p class="nsmall nmuted">Guía para actuar con las molestias más comunes. No sustituye el diagnóstico de un fisio o un médico. Ante la duda, para y ${S.coach?"deriva":"avisa a tu entrenador"}.</p>
  <h3>Semáforo del dolor</h3>
  <div class="sglight"><div class="l-ok"><b>0-2 · Verde</b><span>Sigue con normalidad.</span></div><div class="l-warn"><b>3-5 · Amarillo</b><span>Aceptable si a la mañana siguiente no está peor. Mantén la carga, no la subas.</span></div><div class="l-bad"><b>6-10 · Rojo</b><span>O si al día siguiente está peor: baja peso o rango, cambia el ejercicio y avisa.</span></div></div>
  <p class="nsmall nmuted">Basado en el modelo de control del dolor: seguir activo dentro de estos límites no empeora la recuperación (${doi("Silbernagel 2007","10.1177/0363546506298279")}).</p>
  <h3>Para y consulta si…</h3><ul class="nsmall sglist">${ALARMA_GEN.map(a=>`<li>${esc(a)}</li>`).join("")}</ul></div>
 ${ZONAS.map(z=>`<details class="npanel sgzone" data-z="${z.k}"><summary><b>${z.n}</b><small>${esc(z.q)}</small></summary>
  <div class="sgred"><b>Urgente</b><ul>${z.urg.map(a=>`<li>${esc(a)}</li>`).join("")}</ul></div>
  <div class="sgamber"><b>Consulta a fisio o médico</b><ul>${z.alarma.map(a=>`<li>${esc(a)}</li>`).join("")}</ul></div>
  <h3>Qué hacer</h3><ul class="nsmall sglist">${z.hacer.map(a=>`<li>${esc(a)}</li>`).join("")}</ul>
  <h3>Ejercicios que suelen ir bien</h3><ul class="nsmall sglist">${z.ejercicios.map(a=>`<li>${esc(a)}</li>`).join("")}</ul>
  <p class="nsmall nmuted">Siempre dentro del semáforo. ${S.coach?"Adáptalos a la pauta del cliente.":"Tu entrenador te los ajusta en la pauta."}</p>
  ${z.nota?`<p class="nnote">${esc(z.nota)}</p>`:""}
  <p class="nsmall nmuted">Fuentes (PubMed): ${z.src.map(([t,d])=>doi(t,d)).join(" · ")}</p></details>`).join("")}`;
}

/* ======================= EVENTOS ======================= */
function bind(root){
 root.addEventListener("click",onClick);
 root.addEventListener("submit",e=>{e.preventDefault();onSubmit(e.target)});
 root.addEventListener("input",onInput);
}
function onClick(e){
 const b=e.target.closest("button");if(!b)return;
 if(b.dataset.tab){S.tab=b.dataset.tab;render();return}
 if(b.dataset.zona){S.tab="dolor";S.zona=b.dataset.zona==="dolor"?null:b.dataset.zona;render();return}
 if(b.dataset.go){if(b.dataset.go==="nutri"){const t=[...document.querySelectorAll(".top .seg button")].find(x=>/nutri/i.test(x.textContent));if(t){t.click();return}}else{S.tab=b.dataset.go;render()}return}
 if(b.dataset.pick){const f=b.closest("form");f.querySelector(`[name="${b.dataset.pick}"]`).value=b.dataset.v;f.querySelectorAll(`[data-pick="${b.dataset.pick}"]`).forEach(x=>x.setAttribute("aria-pressed",String(x===b)));return}
 const a=b.dataset.act;
 if(a==="editci"){S.editCi=true;render();return}
 if(a==="newtest"){S.newTest=true;render();return}
 if(a==="canceltest"){S.newTest=false;render();return}
 if(b.dataset.deltest){
  if(b.dataset.armed!=="1"){b.dataset.armed="1";b.textContent="¿Borrar?";setTimeout(()=>{b.dataset.armed="";b.textContent="×"},4000);return}
  const id=b.dataset.deltest;mutate(d=>{d.tests=(d.tests||[]).filter(t=>t.id!==id)},"Valoración borrada");
 }
}
function onInput(e){
 const t=e.target;if(!t.dataset.yb)return;
 const f=t.closest("form"),g=k=>num(f.querySelector(`[data-yb="${k}"]`).value);const len=g("len");
 ["d","i"].forEach(s=>{const v=["ant","pm","pl"].map(d=>g(s+"_"+d));if(len&&v.every(x=>x!=null)){f.querySelector(`[name="yb_${s}"]`).value=nf((v[0]+v[1]+v[2])/(3*len)*100)}});
}
async function onSubmit(f){
 const fd=new FormData(f),v=k=>{const x=fd.get(k);return x==null?"":String(x).trim()};
 const btn=f.querySelector('[type="submit"]');if(btn)btn.disabled=true;
 if(f.dataset.form==="checkin"){
  const ci={};if(v("dolor")!=="")ci.dolor=+v("dolor");if(v("recup")!=="")ci.recup=+v("recup");
  if(v("zona"))ci.zona=v("zona");if(v("pasos")!=="")ci.pasos=Math.round(+v("pasos"));if(v("sesiones")!=="")ci.sesiones=+v("sesiones");if(v("nota"))ci.nota=v("nota");
  if(ci.dolor==null||ci.recup==null){S.flash("Marca el dolor y la recuperación.");if(btn)btn.disabled=false;return}
  if(ci.dolor===0)delete ci.zona;
  ci.fecha=TODAY;const ws=weekStart(TODAY);
  const ok=await mutate(d=>{d.checkins={...(d.checkins||{}),[ws]:ci}},"¡Gracias! Check-in guardado");
  if(ok){S.editCi=false;render();if(ci.dolor>=3&&ZBY[ci.zona])S.flash("Te dejo el protocolo de "+ZBY[ci.zona].n.toLowerCase()+" en la pestaña Dolor");}
  else if(btn)btn.disabled=false;return;
 }
 if(f.dataset.form==="test"){
  const t={id:"t"+Date.now().toString(36),fecha:v("fecha")||TODAY,v:{},por:S.coach?"entrenador":"cliente"},bad=[];
  TESTS.forEach(x=>{
   if(x.lr){const d=num(v(x.k+"_d")),i=num(v(x.k+"_i"));if((v(x.k+"_d")&&d==null)||(v(x.k+"_i")&&i==null))bad.push(x.n);if(d!=null||i!=null)t.v[x.k]={d,i}}
   else{const n=num(v(x.k));if(v(x.k)&&n==null)bad.push(x.n);if(n!=null)t.v[x.k]=n}});
  if(bad.length){S.flash("Revisa: "+bad.join(", "));if(btn)btn.disabled=false;return}
  if(!Object.keys(t.v).filter(k=>k!=="altura").length){S.flash("Rellena al menos un test.");if(btn)btn.disabled=false;return}
  if(v("nota"))t.nota=v("nota");
  const ok=await mutate(d=>{d.tests=[...(d.tests||[]),t]},"Valoración guardada");
  if(ok){S.newTest=false;render()}else if(btn)btn.disabled=false;
 }
}
})();
