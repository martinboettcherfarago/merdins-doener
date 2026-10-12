(()=>{var Na=[0,1,2,4],ui=1440,zl=["Mo","Di","Mi","Do","Fr","Sa","So"],le={GRASS:0,WATER:1,SAND:2,ROCK:3},Kt={NONE:0,FERTILE:1,ORE:2},Ae={NONE:0,RES:1,COM:2,IND:3,OFF:4},Et={1:{key:"res",name:"Wohnen",short:"W",color:6537850,shape:"circle"},2:{key:"com",name:"Gewerbe",short:"G",color:5020648,shape:"triangle"},3:{key:"ind",name:"Industrie",short:"I",color:15643455,shape:"square"},4:{key:"off",name:"B\xFCro",short:"B",color:10976224,shape:"diamond"}},wn={1:{cap:[0,8,18,36,70,140],power:[0,2,3,6,11,20],water:[0,2,3,6,11,20],garbage:[0,1,1.6,3,5.5,10],need:[0,0,25,40,55,70],edu:[0,0,0,0,.25,.45]},2:{cap:[0,5,10,20,36,64],power:[0,3,5,8,14,22],water:[0,1,2,4,6,10],garbage:[0,1.5,2.5,4,7,11],need:[0,0,25,40,55,70],edu:[0,0,0,0,.1,.25]},3:{cap:[0,8,16,28,44,64],power:[0,5,8,13,19,26],water:[0,3,5,8,11,14],garbage:[0,2.5,4,6,8,10],need:[0,0,20,32,45,58],edu:[0,0,0,.1,.2,.35],pollution:[0,1,1.35,1.7,1.9,1.5]},4:{cap:[0,10,22,44,80,140],power:[0,4,7,12,20,32],water:[0,2,3,5,8,12],garbage:[0,1,2,3,5,8],need:[0,0,30,45,60,75],edu:[0,.1,.2,.3,.4,.5]}},Ua={1:.058,2:.068,3:.058,4:.088},Je={NONE:0,LANE:1,STREET:2,AVENUE:3,HIGHWAY:4},wt={1:{key:"lane",name:"Gasse",cost:8,upkeep:.12,capacity:260,speed:.75,lv:0,noise:.4,desc:"G\xFCnstig, wenig Kapazit\xE4t. Ideal f\xFCr ruhige Wohnviertel."},2:{key:"street",name:"Stra\xDFe",cost:16,upkeep:.25,capacity:650,speed:1,lv:0,noise:.7,desc:"Die Standardstra\xDFe mit zwei Fahrspuren."},3:{key:"avenue",name:"Allee",cost:40,upkeep:.6,capacity:1400,speed:1.2,lv:7,noise:.85,desc:"Breiter Boulevard mit B\xE4umen. Hohe Kapazit\xE4t, steigert den Bodenwert."},4:{key:"highway",name:"Autobahn",cost:0,upkeep:0,capacity:3200,speed:1.7,lv:-6,noise:1.3,desc:"Anbindung an das Umland."}},Ol=5,$s=6,Bl=2,zt=[{pop:0,name:"Weiler",reward:0},{pop:150,name:"Dorf",reward:6e3},{pop:500,name:"Kleinstadt",reward:12e3},{pop:1500,name:"Stadt",reward:25e3},{pop:4e3,name:"Gro\xDFstadt",reward:45e3},{pop:1e4,name:"Metropole",reward:9e4},{pop:25e3,name:"Weltstadt",reward:16e4},{pop:5e4,name:"Megastadt",reward:3e5}],nt={coal:{name:"Kohlekraftwerk",cat:"power",size:[2,2],cost:7e3,upkeep:85,unlock:0,power:700,water_use:10,pollution:5,noise:1,lv:-18,lvRadius:7,desc:"Viel Strom f\xFCr wenig Geld \u2013 aber dreckig."},wind:{name:"Windrad",cat:"power",size:[1,1],cost:2200,upkeep:18,unlock:0,power:90,noise:.3,lv:-2,lvRadius:2,desc:"Saubere Energie, wenig Leistung."},solar:{name:"Solarpark",cat:"power",size:[2,2],cost:9500,upkeep:30,unlock:3,power:380,desc:"Leise und sauber."},gas:{name:"Gaskraftwerk",cat:"power",size:[2,2],cost:14e3,upkeep:110,unlock:3,power:1400,water_use:12,pollution:2,noise:.8,lv:-8,lvRadius:5,desc:"Solide Leistung, m\xE4\xDFige Abgase."},fusion:{name:"Fusionsreaktor",cat:"power",size:[3,3],cost:12e4,upkeep:600,unlock:5,power:9e3,water_use:40,lv:-4,lvRadius:4,desc:"Gewaltige Mengen sauberer Energie."},watertower:{name:"Wasserturm",cat:"water",size:[1,1],cost:1500,upkeep:14,unlock:0,water:220,power_use:4,desc:"Kann \xFCberall stehen. Kleine Kapazit\xE4t."},pump:{name:"Pumpwerk",cat:"water",size:[1,1],cost:3200,upkeep:32,unlock:0,water:800,power_use:10,needsWater:!0,desc:"Muss direkt am Wasser stehen."},waterworks:{name:"Wasserwerk",cat:"water",size:[2,2],cost:16e3,upkeep:120,unlock:4,water:3200,power_use:30,needsWater:!0,desc:"Gro\xDFes Wasserwerk am Ufer."},landfill:{name:"Deponie",cat:"garbage",size:[2,2],cost:3e3,upkeep:38,unlock:0,service:{type:"garbage",radius:15,capacity:650},pollution:1.2,lv:-14,lvRadius:5,desc:"Sammelt den M\xFCll der Umgebung."},incinerator:{name:"M\xFCllverbrennung",cat:"garbage",size:[2,2],cost:11e3,upkeep:110,unlock:3,service:{type:"garbage",radius:20,capacity:2200},power:220,pollution:2.5,lv:-10,lvRadius:5,desc:"Verbrennt M\xFCll und erzeugt etwas Strom."},recycling:{name:"Recyclinghof",cat:"garbage",size:[2,2],cost:15e3,upkeep:95,unlock:4,service:{type:"garbage",radius:18,capacity:1600},lv:-3,lvRadius:3,desc:"Sauber und leise."},police:{name:"Polizeiwache",cat:"services",size:[1,1],cost:3200,upkeep:45,unlock:1,service:{type:"police",radius:10,capacity:2600},power_use:5,water_use:3,desc:"Senkt die Kriminalit\xE4t."},policehq:{name:"Polizeipr\xE4sidium",cat:"services",size:[2,2],cost:14e3,upkeep:150,unlock:4,service:{type:"police",radius:18,capacity:14e3},power_use:14,water_use:8,desc:"Gro\xDFe Reichweite."},fire:{name:"Feuerwache",cat:"services",size:[1,1],cost:3e3,upkeep:42,unlock:1,service:{type:"fire",radius:10,capacity:3200},power_use:5,water_use:6,desc:"L\xF6scht Br\xE4nde und senkt das Brandrisiko."},firehq:{name:"Feuerwehrzentrale",cat:"services",size:[2,2],cost:13e3,upkeep:130,unlock:4,service:{type:"fire",radius:18,capacity:14e3},power_use:12,water_use:14,desc:"Gro\xDFe Reichweite."},clinic:{name:"Arztpraxis",cat:"services",size:[1,1],cost:2800,upkeep:40,unlock:1,service:{type:"health",radius:8,capacity:2200},power_use:4,water_use:4,desc:"Gesundheitsversorgung f\xFCr die Nachbarschaft."},hospital:{name:"Krankenhaus",cat:"services",size:[2,2],cost:15e3,upkeep:160,unlock:3,service:{type:"health",radius:17,capacity:12e3},power_use:18,water_use:16,desc:"Versorgt gro\xDFe Stadtteile."},school:{name:"Schule",cat:"education",size:[2,1],cost:4200,upkeep:60,unlock:1,service:{type:"edu",radius:10,capacity:2800,eduMax:.6},power_use:6,water_use:5,desc:"Grundbildung. Gebildete B\xFCrger erm\xF6glichen h\xF6here Stufen."},university:{name:"Universit\xE4t",cat:"education",size:[3,2],cost:26e3,upkeep:260,unlock:4,service:{type:"edu",radius:22,capacity:11e3,eduMax:1},power_use:20,water_use:14,lv:12,lvRadius:8,desc:"Hochschulbildung \u2013 n\xF6tig f\xFCr B\xFCros und Hochh\xE4user."},library:{name:"Bibliothek",cat:"education",size:[1,1],cost:2400,upkeep:28,unlock:2,service:{type:"edu",radius:7,capacity:1600,eduMax:.45},lv:6,lvRadius:5,power_use:3,desc:"Etwas Bildung und mehr Bodenwert."},park:{name:"Kleiner Park",cat:"parks",size:[1,1],cost:450,upkeep:4,unlock:0,park:.55,parkRadius:4,desc:"B\xE4ume, B\xE4nke, gute Laune."},plaza:{name:"Brunnenplatz",cat:"parks",size:[1,1],cost:800,upkeep:6,unlock:1,park:.45,parkRadius:4,comBoost:4,desc:"Gepflasterter Platz mit Brunnen. Gut f\xFCr Gesch\xE4fte."},citypark:{name:"Stadtpark",cat:"parks",size:[2,2],cost:2600,upkeep:16,unlock:2,park:.85,parkRadius:7,desc:"Gro\xDFer Park mit Teich."},sports:{name:"Sportplatz",cat:"parks",size:[2,2],cost:3600,upkeep:22,unlock:2,park:.7,parkRadius:8,noise:.5,desc:"Fu\xDFball am Wochenende."},playground:{name:"Spielplatz",cat:"parks",size:[1,1],cost:600,upkeep:5,unlock:1,park:.5,parkRadius:3,resBoost:3,desc:"Familien lieben ihn."},townhall:{name:"Rathaus",cat:"services",size:[2,2],cost:9e3,upkeep:60,unlock:2,unique:!0,lv:10,lvRadius:8,happy:3,taxBonus:.08,power_use:8,water_use:4,desc:"Einmalig. +8 % Steuereinnahmen, etwas mehr Gl\xFCck."},station:{name:"Pulsbahn-Station",cat:"transit",size:[1,1],cost:1400,upkeep:12,unlock:2,onRoad:!0,desc:"Hochbahn-Haltestelle. Auch \xFCber Stra\xDFen baubar. Einzugsradius 4 Felder."},ferris:{name:"Riesenrad",cat:"landmarks",size:[2,2],cost:18e3,upkeep:60,unlock:3,unique:!0,landmark:!0,lv:25,lvRadius:12,happy:5,tourism:140,desc:"Dreht sich \u2013 und mit ihm die Besucherzahlen."},tvtower:{name:"Fernsehturm",cat:"landmarks",size:[1,1],cost:22e3,upkeep:70,unlock:4,unique:!0,landmark:!0,lv:20,lvRadius:16,happy:4,tourism:170,desc:"Weithin sichtbar."},stadium:{name:"Stadion",cat:"landmarks",size:[3,3],cost:4e4,upkeep:160,unlock:4,unique:!0,landmark:!0,lv:8,lvRadius:12,happy:8,tourism:260,noise:1.6,desc:"Heimspiel! Viel Gl\xFCck, viel L\xE4rm."},opera:{name:"Opernhaus",cat:"landmarks",size:[2,2],cost:32e3,upkeep:120,unlock:4,unique:!0,landmark:!0,lv:30,lvRadius:12,happy:5,tourism:190,desc:"Kultur steigert den Bodenwert enorm."},observatory:{name:"Sternwarte",cat:"landmarks",size:[1,1],cost:16e3,upkeep:50,unlock:3,unique:!0,landmark:!0,lv:15,lvRadius:10,happy:2,tourism:90,eduCity:.08,desc:"Bildung w\xE4chst in der ganzen Stadt schneller."},doener:{name:"M\xEArd\xEEn\u2019s D\xF6nerpalast",cat:"landmarks",size:[1,1],cost:9e3,upkeep:25,unlock:2,unique:!0,landmark:!0,lv:12,lvRadius:10,happy:7,tourism:110,comBoost:10,desc:"Der cheesyste D\xF6ner der Stadt. Gl\xFCck und Kundschaft im Umkreis."},lighthouse:{name:"Leuchtturm",cat:"landmarks",size:[1,1],cost:12e3,upkeep:30,unlock:3,unique:!0,landmark:!0,needsWater:!0,lv:18,lvRadius:10,happy:3,tourism:120,desc:"Nur am Wasser. Romantik pur."}},Hl=[{id:"roads",name:"Stra\xDFen",key:"R"},{id:"zones",name:"Zonen",key:"Z"},{id:"power",name:"Strom"},{id:"water",name:"Wasser"},{id:"garbage",name:"M\xFCll"},{id:"services",name:"Dienste"},{id:"education",name:"Bildung"},{id:"parks",name:"Parks"},{id:"transit",name:"Pulsbahn"},{id:"landmarks",name:"Wahrzeichen"}],Ie={lineCost:1500,trackCostPerTile:35,trainCost:2600,trainUpkeep:26,wagonCost:1400,wagonUpkeep:9,lineUpkeep:15,stationUpkeep:12,catchment:4.5,baseCapacity:6,wagonCapacity:6,fare:4,stationCapacity:14,overcrowdDays:1.4,trackHeight:3.1,maxLevelUnderTrack:4,speed:3.2},Pi=[{id:"smoke",name:"Rauchmelderpflicht",desc:"Brandrisiko \u221250 %.",cost:.35,unlock:1},{id:"tempo30",name:"Tempo 30",desc:"L\xE4rm \u221240 %, Autos fahren langsamer.",cost:.05,unlock:1},{id:"recycling",name:"M\xFClltrennung",desc:"M\xFCllaufkommen \u221230 %.",cost:.45,unlock:2},{id:"bikes",name:"Fahrradstadt",desc:"15 % weniger Autofahrten, Gl\xFCck +3.",cost:.55,unlock:2},{id:"freetransit",name:"Kostenlose Pulsbahn",desc:"Fahrg\xE4ste +40 %, Gl\xFCck +3, keine Ticketeinnahmen.",cost:0,unlock:2},{id:"lowrise",name:"Hochhausverbot",desc:"Geb\xE4ude h\xF6chstens Stufe 3. Wohngl\xFCck +2.",cost:0,unlock:2},{id:"cleanind",name:"Saubere Industrie",desc:"Industrie-Abgase \u221240 %, Industrie-Nachfrage \u221220 %.",cost:.5,unlock:3},{id:"tenants",name:"Mieterschutz",desc:"Wohngl\xFCck +5, Wohnsteuer \u221210 %.",cost:0,unlock:3},{id:"education",name:"Bildungsoffensive",desc:"Bildung w\xE4chst 60 % schneller.",cost:.6,unlock:3},{id:"nightquiet",name:"Nachtruhe",desc:"L\xE4rm \u221225 %, Gewerbesteuer \u221210 %.",cost:0,unlock:3}],Xs=[{amount:25e3,weeks:20,rate:.012},{amount:6e4,weeks:30,rate:.015},{amount:15e4,weeks:40,rate:.02}],Fa=[{id:"river",name:"Flusstal",desc:"Ein Fluss teilt das Land, H\xFCgel an den R\xE4ndern."},{id:"coast",name:"K\xFCste",desc:"Strand und Meer im Osten."},{id:"lakes",name:"Seenplatte",desc:"Viele kleine Seen und W\xE4lder."},{id:"islands",name:"Inselreich",desc:"Br\xFCcken und Bahnen verbinden die Inseln."},{id:"mountains",name:"Bergland",desc:"T\xE4ler zwischen schroffen Gipfeln."}],Gl=[{id:64,name:"Klein (64\xB2)"},{id:96,name:"Mittel (96\xB2)"},{id:128,name:"Gro\xDF (128\xB2)"}],Li=[{id:"relaxed",name:"Entspannt",money:8e4,costMul:.75,desc:"Mehr Startgeld, g\xFCnstigere Bauten."},{id:"normal",name:"Normal",money:4e4,costMul:1,desc:"Ausgewogen."},{id:"hard",name:"Anspruchsvoll",money:22e3,costMul:1.25,desc:"Knappe Kassen, Bankrott droht."},{id:"sandbox",name:"Sandkasten",money:9999999,costMul:0,desc:"Unbegrenztes Geld, alles freigeschaltet."}];function Cn(s){let e=s>>>0;return function(){e=e+1831565813>>>0;let t=e;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}}function dt(s,e,t=0){let n=Math.imul(s|0,374761393)+Math.imul(e|0,668265263)+Math.imul(t|0,982451653)>>>0;return n=Math.imul(n^n>>>13,1274126177),n=(n^n>>>16)>>>0,n/4294967296}function Ii(s){let e=s|0,t=(a,o)=>dt(a,o,e),n=a=>a*a*(3-2*a);function i(a,o){let l=Math.floor(a),c=Math.floor(o),h=a-l,u=o-c,d=t(l,c),p=t(l+1,c),g=t(l,c+1),x=t(l+1,c+1),m=n(h),f=n(u);return d+(p-d)*m+(g-d)*f+(d-p-g+x)*m*f}function r(a,o,l=4){let c=0,h=.5,u=1,d=0;for(let p=0;p<l;p++)c+=h*i(a*u,o*u),d+=h,h*=.5,u*=2.03;return c/d}return{noise:i,fbm:r}}var ve=(s,e,t)=>s<e?e:s>t?t:s;var za=(s,e,t)=>{let n=ve((t-s)/(e-s),0,1);return n*n*(3-2*n)},qs=class{constructor(){this.items=[],this.prio=[]}get size(){return this.items.length}push(e,t){let n=this.items,i=this.prio;n.push(e),i.push(t);let r=n.length-1;for(;r>0;){let a=r-1>>1;if(i[a]<=t)break;n[r]=n[a],i[r]=i[a],r=a}n[r]=e,i[r]=t}pop(){let e=this.items,t=this.prio,n=e[0],i=e.pop(),r=t.pop();if(e.length>0){let a=0,o=e.length;for(;;){let l=2*a+1,c=l+1,h=a,u=r;if(l<o&&t[l]<u&&(h=l,u=t[l]),c<o&&t[c]<u&&(h=c,u=t[c]),h===a)break;e[a]=e[h],t[a]=t[h],a=h}e[a]=i,t[a]=r}return n}},Ys=class{constructor(){this.handlers={}}on(e,t){var n;return((n=this.handlers)[e]||(n[e]=[])).push(t),()=>this.off(e,t)}off(e,t){let n=this.handlers[e];n&&(this.handlers[e]=n.filter(i=>i!==t))}emit(e,...t){let n=this.handlers[e];if(n)for(let i of n.slice())i(...t)}},Oa=new Intl.NumberFormat("de-DE"),$e=s=>Oa.format(Math.round(s));function Xe(s){let e=Math.round(s);return(e<0?"\u2212":"")+Oa.format(Math.abs(e))+" \u20AC"}function Ba(s){let e=Math.abs(s),t=s<0?"\u2212":"";return e>=1e6?t+(e/1e6).toFixed(e>=1e7?0:1).replace(".",",")+" Mio.":e>=1e4?t+Math.round(e/1e3)+" Tsd.":t+Oa.format(Math.round(e))}function Rn(s,e){return e[Math.floor(s()*e.length)%e.length]}var qn=class{constructor(){this.items=[],this.cum=[],this.total=0}build(e,t){this.items=[],this.cum=[];let n=0;for(let i of e){let r=t(i);r>0&&(n+=r,this.items.push(i),this.cum.push(n))}this.total=n}sample(e){if(this.total<=0)return null;let t=e()*this.total,n=0,i=this.cum.length-1;for(;n<i;){let r=n+i>>1;this.cum[r]<t?n=r+1:i=r}return this.items[n]}},Au=["Lichten","Rosen","Falken","Eichen","Sonnen","Linden","Wolken","Kirsch","Birken","Silber","Mond","Heide","Sternen","Weiden","Ahorn","Klee","Morgen","Bern","Tann","Wiesen"],Ru=["berg","feld","hausen","au","stadt","dorf","br\xFCck","hafen","tal","heim","burg","furt","grund","hain","ried","stein"],Cu=["","","","","Neu-","Bad ","Alt-","Ober","Unter"];function Ha(s){let e=Rn(s,Cu),t=Rn(s,Au);return(e==="Ober"||e==="Unter")&&(t=t.toLowerCase()),e+t+Rn(s,Ru)}var Pu=["Markt","Rosen","Linden","Hafen","Park","M\xFChlen","Brunnen","Turm","Garten","Schloss","Werk","Wiesen","Kirch","Bach","Sonnen","Uhren","Kasten","Glocken","Weber","L\xF6wen","Tor","Insel","Feld","H\xFCgel"],Lu=["platz","stra\xDFe","allee","gasse","ring","br\xFCcke","ufer","tor","hof","weg","h\xF6he","damm"];function Vl(s,e){for(let n=0;n<40;n++){let i=Rn(s,Pu)+Rn(s,Lu);if(!e.has(i))return e.add(i),i}let t="Halt "+(e.size+1);return e.add(t),t}var Iu=["Lena","Jonas","Mia","Paul","Emma","Ben","Hanna","Elias","Lea","Noah","Sofia","Finn","Marie","Luca","Aylin","Mehmet","Ida","Karl","Greta","Milan","Nora","Yusuf","Clara","Theo","Zeynep","Anton","Frieda","Emil","Leni","Oskar"],Wl="ABCDEFGHJKLMNOPRSTUVWZ";function $l(s){return Rn(s,Iu)+" "+Wl[Math.floor(s()*Wl.length)]+"."}function vs(s){let e=new Uint8Array(s.buffer,s.byteOffset,s.byteLength),t="",n=32768;for(let i=0;i<e.length;i+=n)t+=String.fromCharCode.apply(null,e.subarray(i,i+n));return typeof btoa=="function"?btoa(t):Buffer.from(t,"binary").toString("base64")}function ys(s,e){let t=typeof atob=="function"?atob(s):Buffer.from(s,"base64").toString("binary"),n=new Uint8Array(t.length);for(let i=0;i<t.length;i++)n[i]=t.charCodeAt(i);return new e(n.buffer)}function Xl(s,e,t){let n=s,i=s,r=n*i,a=Cn(e^2654435769),o=Ii(e),l=Ii(e+101),c=Ii(e+202),h=Ii(e+303),u=Ii(e+404),d=new Uint8Array(r),p=new Uint8Array(r),g=new Uint8Array(r),x=(C,P)=>P*n+C,m=(C,P)=>C>=0&&P>=0&&C<n&&P<i,f=64/s,y=(C,P,N,F,z=4)=>C.fbm(P*f/F,N*f/F,z),v=n/2,M=i/2,T=Math.floor(i/2+(a()-.5)*i*.25);for(let C=0;C<i;C++)for(let P=0;P<n;P++){let N=x(P,C),F=y(o,P,C,14),z=Math.max(Math.abs(P-v),Math.abs(C-M))/(n/2),G=le.GRASS;if(t==="river")F*.78+za(.62,1,z)*.42>.74&&(G=le.ROCK),y(l,P,C,9)<.24&&z<.85&&(G=le.WATER);else if(t==="coast"){let Y=n*.68+(l.fbm(C*f/16,1.7)-.5)*n*.32;P>Y?G=le.WATER:(F*.75+za(.55,1,(Y-P)/n+Math.abs(C-M)/i*.6)*.3>.76&&P<Y-6&&(G=le.ROCK),y(l,P+50,C,8)<.2&&P<Y-5&&(G=le.WATER))}else if(t==="lakes")y(l,P,C,9)<.34?G=le.WATER:F>.72+(1-z)*.08&&(G=le.ROCK);else if(t==="islands"){let Y=(P-v)/(n/2),J=(C-M)/(i/2),B=1-Math.sqrt(Y*Y+J*J);y(l,P,C,11)*.95+B*.45<.6?G=le.WATER:F>.76&&(G=le.ROCK)}else t==="mountains"&&(y(o,P,C,11,5)>.56-(1-z)*.06&&(G=le.ROCK),y(l,P,C,7)<.2&&(G=le.WATER));d[N]=G}let E=(C,P)=>{for(let[N,F,z]of C){let G=Math.ceil(z+1);for(let Y=Math.floor(F-G);Y<=F+G;Y++)for(let J=Math.floor(N-G);J<=N+G;J++){if(!m(J,Y))continue;Math.hypot(J+.5-N,Y+.5-F)<z&&(d[x(J,Y)]=le.WATER)}}};if(t==="river"||t==="mountains"){let C=[],P=a()*Math.PI*2,N=t==="river"?n*.58:n*(.35+a()*.3);for(let F=-2;F<i+2;F+=.5){let z=N+Math.sin(F/i*Math.PI*2.2+P)*n*.11+(c.fbm(F*f/14,3.3)-.5)*n*.22,G=(t==="river"?1.5:1)+h.fbm(F*f/10,7.1)*1.6;C.push([z,F,G])}E(C);for(let F=0;F<i;F++)for(let z=0;z<n;z++){if(d[x(z,F)]!==le.ROCK)continue;let G=!1;for(let Y=1;Y<=3&&!G;Y++)for(let[J,B]of[[Y,0],[-Y,0],[0,Y],[0,-Y]])if(m(z+J,F+B)&&d[x(z+J,F+B)]===le.WATER){G=!0;break}G&&(d[x(z,F)]=le.GRASS)}}if(t==="coast"){let C=[],P=i*(.2+a()*.2);for(let N=n*.2;N<n;N+=.5)P+=(c.noise(N*.1,9.1)-.5)*1.2,C.push([N,P,1.1]);E(C)}if(t==="mountains")for(let P=0;P<3;P++){let N=2,F=T+.5,z=(a()-.5)*1.6;for(let G=0;G<n*1.4&&(z+=(a()-.5)*.35,z=ve(z,-1.3,1.3),N+=Math.cos(z)*.9,F+=Math.sin(z)*.9,!!m(Math.floor(N),Math.floor(F)));G++){let Y=4+h.noise(G*.05,P*3)*3;for(let J=Math.floor(F-Y);J<=F+Y;J++)for(let B=Math.floor(N-Y);B<=N+Y;B++)m(B,J)&&Math.hypot(B-N,J-F)<Y&&d[x(B,J)]===le.ROCK&&(d[x(B,J)]=le.GRASS)}}let b=6;for(let C=T-7;C<=T+7;C++)for(let P=0;P<b+12;P++){if(!m(P,C))continue;let N=Math.hypot((P-b)*.8,C-T);P<b+1&&Math.abs(C-T)<=1?d[x(P,C)]=le.GRASS:N<9&&(d[x(P,C)]=le.GRASS)}for(let C=0;C<2;C++)for(let P=0;P<i;P++)for(let N=0;N<n;N++){let F=x(N,P),z=d[F],G=0,Y=0;for(let[J,B]of[[1,0],[-1,0],[0,1],[0,-1]])m(N+J,P+B)&&(Y++,d[x(N+J,P+B)]===z&&G++);G===0&&Y>0&&z!==le.GRASS&&(d[F]=le.GRASS)}let L=new Uint8Array(r).fill(255);{let C=[];for(let P=0;P<r;P++)d[P]===le.WATER&&(L[P]=0,C.push(P));for(let P=0;P<C.length;P++){let N=C[P],F=L[N];if(F>=8)continue;let z=N%n,G=N/n|0;for(let[Y,J]of[[1,0],[-1,0],[0,1],[0,-1]]){let B=z+Y,Z=G+J;if(!m(B,Z))continue;let ne=x(B,Z);L[ne]>F+1&&(L[ne]=F+1,C.push(ne))}}}let _=t==="coast"||t==="islands"?2:1;for(let C=0;C<i;C++)for(let P=0;P<n;P++){let N=x(P,C);d[N]===le.GRASS&&L[N]<=_&&(_>1||u.noise(P*.4,C*.4)>.45)&&(d[N]=le.SAND)}for(let C=0;C<i;C++)for(let P=0;P<n;P++){let N=x(P,C);if(d[N]!==le.GRASS)continue;let F=y(c,P,C,7),z=Math.hypot(P-b,C-T),G=.55+(z<12?.12:0);F>G?p[N]=ve(1+Math.floor((F-G)/.05),1,3):u.noise(P*.9,C*.9)>.93&&z>6&&(p[N]=1)}let w=new Uint8Array(r).fill(255);{let C=[];for(let P=0;P<r;P++)d[P]===le.ROCK&&(w[P]=0,C.push(P));for(let P=0;P<C.length;P++){let N=C[P],F=w[N];if(F>=10)continue;let z=N%n,G=N/n|0;for(let[Y,J]of[[1,0],[-1,0],[0,1],[0,-1]]){let B=z+Y,Z=G+J;if(!m(B,Z))continue;let ne=x(B,Z);w[ne]>F+1&&(w[ne]=F+1,C.push(ne))}}}for(let C=0;C<i;C++)for(let P=0;P<n;P++){let N=x(P,C);if(d[N]!==le.GRASS&&d[N]!==le.SAND)continue;let F=y(h,P,C,9),z=y(u,P,C,6);w[N]<=4&&z>.52?g[N]=Kt.ORE:F>.63&&w[N]>3&&d[N]===le.GRASS&&(g[N]=Kt.FERTILE)}let U=[];for(let C=0;C<b;C++){let P=x(C,T);d[P]=le.GRASS,p[P]=0,g[P]=0,U.push(P)}let H=new Uint8Array(r);{let C=[],P=new Int16Array(r).fill(-1);for(let N=0;N<r;N++)d[N]!==le.ROCK&&(P[N]=0,C.push(N));for(let N=0;N<C.length;N++){let F=C[N],z=F%n,G=F/n|0;for(let[Y,J]of[[1,0],[-1,0],[0,1],[0,-1]]){let B=z+Y,Z=G+J;if(!m(B,Z))continue;let ne=x(B,Z);P[ne]<0&&(P[ne]=P[F]+1,C.push(ne))}}for(let N=0;N<r;N++)H[N]=Math.max(0,Math.min(255,P[N]<0?12:P[N]))}let K=n+1,I=new Float32Array(K*(i+1));for(let C=0;C<=i;C++)for(let P=0;P<=n;P++){let N=0,F=0,z=0,G=0,Y=0;for(let[B,Z]of[[-1,-1],[0,-1],[-1,0],[0,0]]){let ne=ve(P+B,0,n-1),me=ve(C+Z,0,i-1),fe=x(ne,me),Pe=d[fe];Pe===le.ROCK?(F++,G+=H[fe]):Pe===le.WATER?(z++,Y+=L[fe]):N++}let J=0;if(N>0)J=F>0?.1:0;else if(F>0&&z===0){let B=G/F;J=.45+B*.55+o.noise(P*.35,C*.35)*(.6+B*.35),J=Math.min(J,7.5)}else z>0&&F===0?J=-.85:J=.15;I[C*K+P]=J}{let C=new Int16Array(r).fill(-1),P=[];for(let N=0;N<r;N++)d[N]!==le.WATER&&(C[N]=0,P.push(N));for(let N=0;N<P.length;N++){let F=P[N],z=F%n,G=F/n|0;for(let[Y,J]of[[1,0],[-1,0],[0,1],[0,-1]]){let B=z+Y,Z=G+J;if(!m(B,Z))continue;let ne=x(B,Z);C[ne]<0&&(C[ne]=C[F]+1,P.push(ne))}}for(let N=0;N<=i;N++)for(let F=0;F<=n;F++){let z=N*K+F;if(I[z]!==-.85)continue;let G=99;for(let[Y,J]of[[-1,-1],[0,-1],[-1,0],[0,0]]){let B=ve(F+Y,0,n-1),Z=ve(N+J,0,i-1);G=Math.min(G,C[x(B,Z)])}I[z]=-.35-Math.min(G,4)*.22}}return{W:n,H:i,seed:e,type:t,terrain:d,trees:p,resource:g,vh:I,waterDist:L,highway:U,entry:U[0],highwayEnd:U[U.length-1],highwayY:T}}var Du=[[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0],[0,2],[0,-2],[1,1],[-1,1],[1,-1],[-1,-1]];function Ks(s){let{W:e,H:t,N:n,road:i}=s,r=s.roadComp;r.fill(-1);let a=0,o=[];for(let c=0;c<n;c++){if(!i[c]||r[c]>=0)continue;let h=a++;for(r[c]=h,o.push(c);o.length;){let u=o.pop(),d=u%e,p=u/e|0;d>0&&i[u-1]&&r[u-1]<0&&(r[u-1]=h,o.push(u-1)),d<e-1&&i[u+1]&&r[u+1]<0&&(r[u+1]=h,o.push(u+1)),p>0&&i[u-e]&&r[u-e]<0&&(r[u-e]=h,o.push(u-e)),p<t-1&&i[u+e]&&r[u+e]<0&&(r[u+e]=h,o.push(u+e))}}s.compCount=a,s.outsideComp=i[s.world.entry]?r[s.world.entry]:-1;let l=s.access;l.fill(-1);for(let c=0;c<t;c++)for(let h=0;h<e;h++){let u=c*e+h;if(!i[u])for(let[d,p]of Du){let g=h+d,x=c+p;if(g<0||x<0||g>=e||x>=t)continue;let m=x*e+g;if(i[m]&&i[m]!==Je.HIGHWAY){l[u]=m;break}}}for(let c of s.buildings.values())Ga(s,c);s.pathCache.clear(),s.netVersion++}function Ga(s,e){let{W:t,H:n,road:i}=s;if(e.zone){let r=e.y*t+e.x;e.access=s.access[r]}else if(e.key==="station")e.access=-1;else{let r=-1;for(let a=e.y-1;a<=e.y+e.h&&r<0;a++)for(let o=e.x-1;o<=e.x+e.w;o++){if(o<0||a<0||o>=t||a>=n)continue;let l=o>=e.x&&o<e.x+e.w&&a>=e.y&&a<e.y+e.h,c=(o===e.x-1||o===e.x+e.w)&&(a===e.y-1||a===e.y+e.h);if(l||c)continue;let h=a*t+o;if(i[h]&&i[h]!==Je.HIGHWAY){r=h;break}}e.access=r}if(e.comp=e.access>=0?s.roadComp[e.access]:-1,e.connected=e.comp>=0&&e.comp===s.outsideComp,e.zone&&e.access>=0){let r=e.access%t,a=e.access/t|0,o=r-e.x,l=a-e.y;Math.abs(o)>=Math.abs(l)?e.rot=o>0?1:3:e.rot=l>0?0:2}}function ku(s,e){let t=s.road[e],n=wt[t];if(!n)return 99;let i=s.congestion[e],r=i>.75?1+(i-.75)*3:1;return 2/n.speed*r}var Zs=class{constructor(){this.map=new Map}clear(){this.map.clear()}get(e,t){return this.map.get(e*65536+t)}set(e,t,n){this.map.size>5e3&&this.map.clear(),this.map.set(e*65536+t,n)}};function _s(s,e,t){if(e<0||t<0)return null;if(e===t)return{path:new Int32Array([e]),cost:0};let n=s.pathCache.get(e,t);if(n!==void 0)return n;let{W:i,road:r,N:a}=s;if(s.roadComp[e]!==s.roadComp[t]||s.roadComp[e]<0)return s.pathCache.set(e,t,null),null;let o=s._gScore||(s._gScore=new Float32Array(a)),l=s._came||(s._came=new Int32Array(a)),c=s._stamp||(s._stamp=new Uint32Array(a));s._stampId=(s._stampId||0)+1;let h=s._stampId,u=t%i,d=t/i|0,p=new qs;o[e]=0,l[e]=-1,c[e]=h,p.push(e,0);let g=2/1.7,x=!1,m=0;for(;p.size;){let v=p.pop();if(v===t){x=!0;break}if(++m>4e4)break;let M=v%i,T=v/i|0,E=o[v];for(let b=0;b<4;b++){let L=M,_=T;if(b===0?L++:b===1?L--:b===2?_++:_--,L<0||_<0||L>=i||_>=s.H)continue;let w=_*i+L;if(!r[w])continue;let U=E+ku(s,w);(c[w]!==h||U<o[w])&&(c[w]=h,o[w]=U,l[w]=v,p.push(w,U+(Math.abs(L-u)+Math.abs(_-d))*g))}}if(!x)return s.pathCache.set(e,t,null),null;let f=[];for(let v=t;v!==-1;v=l[v])f.push(v);f.reverse();let y={path:Int32Array.from(f),cost:o[t]};return s.pathCache.set(e,t,y),y}function ql(s,e){let{W:t,H:n,road:i}=s;if(!i[e])return 0;let r=e%t,a=e/t|0,o=0;return a>0&&i[e-t]&&(o|=1),r<t-1&&i[e+1]&&(o|=2),a<n-1&&i[e+t]&&(o|=4),r>0&&i[e-1]&&(o|=8),i[e]===Je.HIGHWAY&&r===0&&(o|=8),o}var Wa=["police","fire","health","garbage","edu"];function dn(s){return s.zone?null:nt[s.key]}function js(s){return s.cap?.35+.65*(s.occ/s.cap):1}function Nu(s,e){return e.construct<1||e.abandoned?0:e.zone?wn[e.zone].power[e.level]*js(e):dn(e).power_use||0}function Uu(s,e){if(e.construct<1||e.abandoned)return 0;let t=1+s.eff("waterUse");return e.zone?wn[e.zone].water[e.level]*js(e)*t:(dn(e).water_use||0)*t}function Fu(s,e){return e.construct<1||e.abandoned||!e.zone?0:wn[e.zone].garbage[e.level]*js(e)*(s.policies.has("recycling")?.7:1)}function di(s){let e=s.compCount,t=new Float32Array(e+1),n=new Float32Array(e+1),i=new Float32Array(e+1),r=new Float32Array(e+1),a=s.mods.power*(1+s.eff("powerMul")),o=s.mods.water;for(let p of s.buildings.values())if(!(p.comp<0)){if(!p.zone&&p.construct>=1&&!p.abandoned){let g=dn(p);g.power&&(t[p.comp]+=g.power*a)}n[p.comp]+=Nu(s,p)}let l=0,c=0;for(let p=0;p<e;p++)l+=t[p],c+=n[p];let h=p=>n[p]<=0?1:Math.min(1,t[p]/n[p]);for(let p of s.buildings.values()){if(p.comp<0){p.powered=!1;continue}let g=h(p.comp);if(p.powered=g>=.999||dt(p.id,7)<g,!p.zone&&p.construct>=1&&!p.abandoned){let x=dn(p);x.water&&p.powered&&(i[p.comp]+=x.water*o)}r[p.comp]+=Uu(s,p)}let u=0,d=0;for(let p=0;p<e;p++)u+=i[p],d+=r[p];for(let p of s.buildings.values()){if(p.comp<0){p.watered=!1;continue}let g=r[p.comp]<=0?1:Math.min(1,i[p.comp]/r[p.comp]);p.watered=g>=.999||dt(p.id,13)<g}s.util={powerSupply:l,powerDemand:c,waterSupply:u,waterDemand:d,pSup:t,pDem:n,wSup:i,wDem:r}}function Sn(s,e,t,n,i){let{W:r,H:a}=s,o=Math.max(0,Math.floor(e-n)),l=Math.min(r-1,Math.ceil(e+n)),c=Math.max(0,Math.floor(t-n)),h=Math.min(a-1,Math.ceil(t+n));for(let u=c;u<=h;u++)for(let d=o;d<=l;d++){let p=Math.hypot(d+.5-e,u+.5-t);p<=n&&i(u*r+d,p)}}function Qs(s){let{N:e}=s,t=s._bestD||(s._bestD=new Float32Array(e)),n=s._bestF||(s._bestF=new Int32Array(e)),i=[];for(let u of s.buildings.values())u.zone&&!u.abandoned&&i.push(u);for(let u of Wa){let d=s.cov[u];d.fill(0),t.fill(1e9),n.fill(-1);let p=[];for(let f of s.buildings.values()){let y=dn(f);!y||!y.service||y.service.type!==u||f.construct<1||f.abandoned||p.push(f)}p.forEach((f,y)=>{let v=dn(f).service;Sn(s,f.x+f.w/2,f.y+f.h/2,v.radius,(M,T)=>{T<t[M]&&(t[M]=T,n[M]=y)})});let g=new Float32Array(p.length);for(let f of i){let y=n[f.y*s.W+f.x];y<0||(g[y]+=u==="garbage"?Fu(s,f):f.occ)}let x=p.map((f,y)=>{let v=dn(f).service,M=u==="garbage"?1+s.eff("garbageCov"):u==="health"?1+s.eff("healthCov"):1,T=g[y]<=0?1:Math.min(1,v.capacity*M/g[y]);return f.powered||(T*=.45),f.connected||(T*=.25),f.load=g[y]/v.capacity,T}),m=s.nearestFac[u];if(m&&m.fill(0),u==="edu"){p.forEach((f,y)=>{let v=dn(f).service;Sn(s,f.x+f.w/2,f.y+f.h/2,v.radius,(M,T)=>{let E=ve(x[y],0,1)*(1-.45*(T/v.radius)**2)*v.eduMax;E>d[M]&&(d[M]=E)})});continue}for(let f=0;f<e;f++){let y=n[f];if(y<0)continue;let v=p[y],M=dn(v).service,T=M.radius,E=1-.45*(t[f]/T)*(t[f]/T),b=ve(x[y],0,1)*E;u==="edu"&&(b*=M.eduMax),d[f]=b,m&&(m[f]=v.id)}}let{park:r,lvBonus:a,happyBonus:o,comBoost:l,resBoost:c}=s.cov;r.fill(0),a.fill(0),o.fill(0),l.fill(0),c.fill(0);let h=0;for(let u of s.buildings.values()){if(u.zone||u.construct<1||u.abandoned)continue;let d=dn(u),p=u.x+u.w/2,g=u.y+u.h/2;if(d.park&&Sn(s,p,g,d.parkRadius,(x,m)=>{r[x]=Math.min(1,r[x]+d.park*(1-m/(d.parkRadius+.5)))}),d.lv&&Sn(s,p,g,d.lvRadius,(x,m)=>{a[x]+=d.lv*(1-m/(d.lvRadius+.5))}),d.happy){let x=d.lvRadius||8;Sn(s,p,g,x,(m,f)=>{o[m]+=d.happy*(1-.5*f/x)})}d.comBoost&&Sn(s,p,g,d.lvRadius||5,x=>{l[x]+=d.comBoost}),d.resBoost&&Sn(s,p,g,d.parkRadius||4,x=>{c[x]+=d.resBoost}),d.tourism&&(h+=d.tourism*(u.powered?1:.5))}s.stats.tourism=h*(1+s.eff("tourism")/100)+s.eff("tourismAdd")}function Js(s,e,t,n,i,r){for(let a=0;a<n;a++){let o=0,l=a*t;for(let c=-i;c<=i;c++)o+=s[l+ve(c,0,t-1)];for(let c=0;c<t;c++)r[l+c]=o/(2*i+1),o+=s[l+ve(c+i+1,0,t-1)]-s[l+ve(c-i,0,t-1)]}for(let a=0;a<t;a++){let o=0;for(let l=-i;l<=i;l++)o+=r[ve(l,0,n-1)*t+a];for(let l=0;l<n;l++)e[l*t+a]=o/(2*i+1),o+=r[ve(l+i+1,0,n-1)*t+a]-r[ve(l-i,0,n-1)*t+a]}}function er(s){let{W:e,H:t,N:n,road:i}=s,r=s._em||(s._em=new Float32Array(n)),a=s._tmp||(s._tmp=new Float32Array(n)),o=s._tmp2||(s._tmp2=new Float32Array(n)),l=s.mods.pollution*(s.policies.has("cleanind")?.6:1);r.fill(0);for(let b of s.buildings.values()){if(b.construct<1||b.abandoned)continue;let L=0;if(b.zone===Ae.IND)L=wn[3].pollution[b.level]*js(b)*l,b.spec==="farm"?L*=.15:b.spec==="mine"&&(L*=1.25);else if(!b.zone){let w=dn(b);w.pollution&&(L=w.pollution*(w.cat==="power"||w.cat==="garbage"?1:l))}if(!L)continue;let _=L*5/(b.w*b.h);for(let w=b.y;w<b.y+b.h;w++)for(let U=b.x;U<b.x+b.w;U++)r[w*e+U]+=_}for(let b=0;b<n;b++)i[b]&&(r[b]+=(i[b]===Je.HIGHWAY?.12:0)+s.congestion[b]*.12);Js(r,o,e,t,3,a),Js(o,r,e,t,2,a);let c=s.fields.pollution;for(let b=0;b<n;b++)c[b]=ve(r[b]*1.5,0,1);r.fill(0);let h=(s.policies.has("tempo30")?.6:1)*(s.policies.has("nightquiet")?.75:1);for(let b=0;b<n;b++)i[b]&&(r[b]+=wt[i[b]].noise*(.25+Math.min(1.5,s.congestion[b]))*.9);for(let b of s.buildings.values()){if(b.construct<1||b.abandoned)continue;let L=0;if(b.zone===Ae.IND?L=.5+b.level*.15:b.zone===Ae.COM?L=.15+b.level*.05:b.zone||(L=dn(b).noise||0),!L)continue;let _=L*2/(b.w*b.h);for(let w=b.y;w<b.y+b.h;w++)for(let U=b.x;U<b.x+b.w;U++)r[w*e+U]+=_}Js(r,o,e,t,2,a);let u=s.fields.noise;for(let b=0;b<n;b++)u[b]=ve(o[b]*1.1*h,0,1);r.fill(0);for(let b of s.buildings.values())b.zone&&b.crime&&(r[b.y*e+b.x]=b.crime);Js(r,o,e,t,2,a);let d=s.fields.crime;for(let b=0;b<n;b++)d[b]=ve(o[b]*1.6,0,1);let p=s.fields.landValue,{park:g,police:x,health:m,edu:f,garbage:y,transit:v,lvBonus:M}=s.cov,T=s.world.terrain,E=s.world.waterDist;for(let b=0;b<t;b++)for(let L=0;L<e;L++){let _=b*e+L,w=26,U=E[_];U>0&&U<=4&&(w+=11*(1-(U-1)/4)),T[_]===le.SAND&&(w+=3),w+=g[_]*26,w+=(x[_]+m[_])*.5*12+f[_]*8,w+=v[_]*9,w+=M[_],w-=c[_]*46+u[_]*16+d[_]*10,s.stats.pop>300&&(w-=(1-y[_])*5);let H=0;L>0&&i[_-1]&&(H=Math.max(H,wt[i[_-1]].lv)),L<e-1&&i[_+1]&&(H=Math.max(H,wt[i[_+1]].lv)),b>0&&i[_-e]&&(H=Math.max(H,wt[i[_-e]].lv)),b<t-1&&i[_+e]&&(H=Math.max(H,wt[i[_+e]].lv)),w+=H,p[_]=ve(w,0,100)}}function Va(s,e,t){let n=e.y*s.W+e.x,i=(l,c)=>(t&&Math.abs(c)>=.5&&t.push([l,c]),c),r=60;e.connected||(r+=i("Keine Verbindung zur Autobahn",-22)),r+=i(e.powered?"Strom":"Kein Strom",e.powered?0:-28),r+=i(e.watered?"Wasser":"Kein Wasser",e.watered?0:-24),s.stats.pop>250&&(r+=i("M\xFCllabfuhr",-(1-s.cov.garbage[n])*9)),s.stats.pop>300&&(r+=i("Gesundheit",s.cov.health[n]*11-5)),s.stats.pop>300&&(r+=i("Sicherheit",s.cov.police[n]*6-(e.crime||0)*12)),e.zone===Ae.RES&&(r+=i("Bildungsangebot",s.cov.edu[n]*6)),r+=i("Parks & Freizeit",s.cov.park[n]*12),r+=i("Bodenwert",(s.fields.landValue[n]-35)*.14),r+=i("Verschmutzung",-s.fields.pollution[n]*(e.zone===Ae.IND?10:30)),r+=i("L\xE4rm",-s.fields.noise[n]*(e.zone===Ae.RES?13:5));let a=s.taxes[e.zone];r+=i("Steuern",-(a-10)*1.7),e.zone===Ae.RES?(r+=i("Pendelzeit",-ve((e.commute-30)*.3,0,12)),r+=i("Arbeitslosigkeit",-s.stats.unemployment*22),s.policies.has("tenants")&&(r+=i("Mieterschutz",5)),s.policies.has("lowrise")&&(r+=i("Hochhausverbot",2)),r+=i("Spielpl\xE4tze",Math.min(6,s.cov.resBoost[n]))):r+=i("Arbeitskr\xE4fte",-(1-s.stats.jobFill)*9),e.zone===Ae.COM&&(r+=i("Kundschaft",ve(s.demand[2]*.06,-6,4)+Math.min(6,s.cov.comBoost[n]*.5))),r+=i("Pulsbahn",s.cov.transit[n]*5),s.transitPenalty&&s.transitPenalty[n]>0&&(r+=i("\xDCberf\xFCllte Station",-10)),r+=i("Wahrzeichen",Math.min(14,s.cov.happyBonus[n])),s.policies.has("bikes")&&(r+=i("Fahrradstadt",3)),s.policies.has("freetransit")&&(r+=i("Kostenlose Pulsbahn",3));let o=s.eff("happy");return o&&(r+=i("Ereignisse",o)),e.burning&&(r+=i("Feuer!",-30)),e.problemGarbage&&(r+=i("M\xFCllberge",-4)),ve(r,0,100)}function $a(s){let e=0,t=0,n=s.stats.unemployment;for(let i of s.buildings.values()){if(!i.zone||i.construct<1)continue;let r=i.y*s.W+i.x;if(i.crime=ve(.04+n*.5+i.level*.03+(1-i.happy/100)*.14+(s.stats.pop>1500?.06:0)-s.cov.police[r]*.75,0,1),i.problemGarbage=s.cov.garbage[r]<.25&&s.stats.pop>300,i.abandoned){i.happy=0;continue}let a=Va(s,i,null);i.happy+=(a-i.happy)*.35;let o=Math.max(1,i.occ);e+=i.happy*o,t+=o}s.stats.happiness=t>0?e/t:60}var zu=[2,2,3,4,5,5,5,5];function Xa(s,e,t){let n=s.sandbox?5:zu[s.milestone]??5;return s.policies.has("lowrise")&&(n=Math.min(n,3)),s.trackCount[t*s.W+e]>0&&(n=Math.min(n,Ie.maxLevelUnderTrack)),n}function tr(s){let e=wn[s.zone].cap[s.level];return s.spec&&(e=Math.round(e*1.2)),e}function qa(s){let e=s.stats,t=0,n=0,i=0,r=[0,0,0,0,0],a=[0,0,0,0,0],o=[0,0,0,0,0],l=0,c=0,h=0,u=0,d=0,p=0;for(let f of s.buildings.values())if(f.zone){if(o[f.zone]++,f.abandoned){l++;continue}f.burning&&u++,a[f.zone]+=f.cap,!(f.construct<1)&&(f.powered||c++,f.watered||h++,f.connected||d++,f.problemGarbage&&p++,f.zone===Ae.RES?(t+=f.occ,n+=f.cap,i+=f.occ*f.edu):r[f.zone]+=f.cap)}let g=t*.62,x=r[2]+r[3]+r[4],m=Math.min(g,x);e.pop=t,e.resCap=n,e.workers=g,e.jobs=x,e.jobsByZone=r,e.plannedByZone=a,e.countByZone=o,e.employed=m,e.unemployment=g>0?(g-m)/g:0,e.jobFill=x>0?m/x:1,e.edu=t>0?i/t:0,e.eduWorkers=i*.62,e.abandoned=l,e.unpowered=c,e.unwatered=h,e.burning=u,e.noRoad=d,e.garbageProb=p;for(let f of s.buildings.values())!f.zone||f.zone===Ae.RES||f.abandoned||f.construct<1||(f.occ=Math.round(f.cap*e.jobFill))}function Ya(s){let e=s.stats,t=s.demand,n=s.taxes,i=e.pop,r=e.happiness,a=e.plannedByZone,o=e.jobs*.98-e.workers,l=r>50?6:0,h=(i<400?50*(1-i/400):0)+ve(o/Math.max(30,e.workers*.12)*45,-70,70);h+=l+(r-52)*.5-(n[1]-10)*4.5,h+=s.eff("resDemand")+Math.min(15,e.tourism*.02),e.unemployment>.12&&(h-=(e.unemployment-.12)*140),s.peopleDemand=ve(h,-100,100);let u=Math.max(0,a[1]-i),d=h-ve(u/Math.max(40,a[1]*.1)*25,0,60),p=a[2]+a[3]+a[4],g=ve((e.workers*1.12+10-p)/Math.max(20,p*.15)*40,-90,60),x=i*.2+e.tourism*.5+8,m=ve((x-a[2])/Math.max(14,a[2]*.25)*40,-80,80)*.6+g*.5-(n[2]-10)*4+s.eff("comDemand"),f=a[2]*.8+30+i*.12,y=ve((f-a[3])/Math.max(18,a[3]*.25)*40,-80,80)*.6+g*(.6-e.edu*.3)-(n[3]-10)*4+s.eff("indDemand");s.policies.has("cleanind")&&(y-=20);let v=e.eduWorkers*.6+i*.03,M=ve((v-a[4])/Math.max(18,a[4]*.25)*40,-80,80)*.6+g*e.edu*.8-(n[4]-10)*4+s.eff("offDemand");s.isUnlocked("zone4")||(M=0),t[1]=ve(d,-100,100),t[2]=ve(m,-100,100),t[3]=ve(y,-100,100),t[4]=ve(M,-100,100)}function Yl(s){for(let e=1;e<=4;e++){let t=s.demand[e];if(t<=4)continue;s.growAcc[e]+=t/110;let n=0;for(;s.growAcc[e]>=1&&n<8;){s.growAcc[e]-=1,n++;let i=Ou(s,e);i>=0&&s.spawnZoneBuilding(i,e)}s.growAcc[e]=Math.min(s.growAcc[e],3)}}function Ou(s,e){let t=s.zoneFreeArray(e);if(!t.length)return-1;let n=-1,i=-1e9;for(let r=0;r<4;r++){let a=t[Math.floor(s.rng()*t.length)];if(!Bu(s,a))continue;let o=s.fields.landValue[a],l=e===Ae.IND?s.rng()*20-o*.2:o+s.rng()*15,c=Math.abs(s.access[a]-a);(c===1||c===s.W)&&(l+=12),l>i&&(i=l,n=a)}return n}function Bu(s,e){if(s.bld[e]||s.road[e]||s.stationAt[e]||s.rubble[e])return!1;let t=s.world.terrain[e];if(t===le.WATER||t===le.ROCK)return!1;let n=s.access[e];return n<0?!1:s.roadComp[n]===s.outsideComp&&s.outsideComp>=0}function Zl(s,e){for(let t of s.buildings.values()){if(t.construct>=1)continue;let n=t.zone?t.level>1?.35:.5:.6;t.construct=Math.min(1,t.construct+e/(n*1440)),t.construct>=1&&(t.construct=1,s.emit("buildingUpdated",t))}}function Hu(s,e){let t=s.cov;return 18+(t.fire[e]+t.police[e])*15+t.garbage[e]*10+t.transit[e]*6+Math.max(0,t.lvBonus[e])*.3+(s.world.resource[e]?6:0)}function Kl(s){let e=s.rng,t=s.stats,n=s.peopleDemand,i=s.mods.edu*(s.policies.has("education")?1.6:1)*(1+t.eduCity),r=s.mods.fire*(s.policies.has("smoke")?.5:1),a=[];for(let o of s.buildings.values()){if(!o.zone||o.construct<1)continue;o.age++;let l=o.y*s.W+o.x;if(o.abandoned){o.abandonedDays++,o.abandonedDays>=5&&a.push(o);continue}if(o.noPower=o.powered?0:o.noPower+1,o.noWater=o.watered?0:o.noWater+1,o.noRoad=o.connected?0:o.noRoad+1,o.unhappyDays=o.happy<18?o.unhappyDays+1:0,o.noPower>=7||o.noWater>=7||o.noRoad>=4||o.unhappyDays>=8){s.abandonBuilding(o);continue}if(o.zone===Ae.RES){let u=o.cap-o.occ;if(n>0&&o.happy>30&&o.connected&&u>0){let p=Math.min(u,Math.ceil(u*(.25+n/260)));o.occ+=p,p>=3&&e()<.35&&s.traffic.spawnMoveIn(o)}else(n<-25||o.happy<24)&&o.occ>0&&(o.occ-=Math.min(o.occ,Math.ceil(o.occ*.07)));let d=s.cov.edu[l];d>o.edu?o.edu=Math.min(d,o.edu+.035*i):o.edu=Math.max(d*.8,o.edu-.008)}let c=Xa(s,o.x,o.y),h=o.spec?Math.min(c,3):c;if(o.level>h)s.setBuildingLevel(o,h);else if(o.level<h&&o.powered&&o.watered&&o.happy>=45){let u=wn[o.zone],d=o.level+1,p=o.zone===Ae.IND?Hu(s,l):s.fields.landValue[l],g=o.zone===Ae.RES?o.occ>=o.cap*.7:t.jobFill>=.55,x=o.zone===Ae.RES?o.edu>=u.edu[d]:t.edu>=u.edu[d];p>=u.need[d]&&g&&x?(o.upCount++,o.upCount>=2&&e()<.3&&(o.upCount=0,s.setBuildingLevel(o,d))):o.upCount=0}if(!o.burning){let u=.0014*(.6+o.level*.15)*(1-s.cov.fire[l]*.85)*r;e()<u&&s.igniteBuilding(o)}}for(let o of a)s.removeBuilding(o,{silent:!0})}function Jl(s){let e=[];for(let t of s.buildings.values())t.burning&&e.push(t);for(let t of e){let n=t.y*s.W+t.x,i=(s.time-t.burning)/60;if(t.extinguishAt&&s.time>=t.extinguishAt){t.burning=0,t.extinguishAt=0,s.emit("buildingUpdated",t);continue}if(i>9){s.news("fire","Ein Geb\xE4ude ist vollst\xE4ndig niedergebrannt.","bad",t),s.removeBuilding(t,{rubble:!0,silent:!0});continue}if(s.rng()<.05*(1-s.cov.fire[n])){let r=[[1,0],[-1,0],[0,1],[0,-1]],[a,o]=r[Math.floor(s.rng()*4)],l=t.x+a,c=t.y+o;if(l>=0&&c>=0&&l<s.W&&c<s.H){let h=s.buildings.get(s.bld[c*s.W+l]);h&&h.zone&&!h.burning&&!h.abandoned&&s.igniteBuilding(h)}}}}function jl(s){let e=!1;for(;s.milestone<zt.length-1&&s.stats.pop>=zt[s.milestone+1].pop;){s.milestone++;let t=zt[s.milestone];s.sandbox||(s.money+=t.reward),s.milestone>=3&&s.milestone<=5&&s.transit.linesMax++,s.emit("milestone",s.milestone),e=!0}return e}function bs(s){let e={res:0,com:0,ind:0,off:0,tourism:0,fares:0},t={services:0,roads:0,transit:0,policies:0,loans:0},n=1+s.eff("taxMul")+(s.hasBuilt("townhall")?.08:0);for(let l of s.buildings.values())if(l.zone){if(l.abandoned||l.construct<1)continue;let c=l.occ*Ua[l.zone]*s.taxes[l.zone]*n;l.zone===Ae.RES?e.res+=c*(s.policies.has("tenants")?.9:1):l.zone===Ae.COM?e.com+=c*(s.policies.has("nightquiet")?.9:1)*(1+s.eff("comTax")):l.zone===Ae.IND?e.ind+=c:e.off+=c}else{let c=nt[l.key];if(l.key==="station")continue;t.services+=c.upkeep*s.upkeepMul()}e.tourism=s.stats.tourism*.55,e.fares=s.policies.has("freetransit")?0:s.transit.faresToday;let i=0;for(let l=0;l<s.N;l++){let c=s.road[l];!c||c===Je.HIGHWAY||(i+=wt[c].upkeep*(s.world.terrain[l]===le.WATER?3:1))}t.roads=i*s.upkeepMul();let r=s.transit;t.transit=(r.stations.size*Ie.stationUpkeep+r.lines.length*Ie.lineUpkeep+r.trains.length*Ie.trainUpkeep+r.totalWagons()*Ie.wagonUpkeep)*s.upkeepMul();for(let l of Pi)s.policies.has(l.id)&&(t.policies+=l.cost*(s.stats.pop/100));for(let l of s.loans)t.loans+=l.weekly/7;let a=Object.values(e).reduce((l,c)=>l+c,0),o=Object.values(t).reduce((l,c)=>l+c,0);return{inc:e,exp:t,income:a,expense:o,net:a-o}}function Ql(s){let e=bs(s);if(s.lastBudget=e,s.sandbox||(s.money+=e.net),s.weekIncome+=e.income,s.weekExpense+=e.expense,s.transit.faresToday=0,!s.sandbox){let t=s.difficulty==="hard"?-1e4:-25e3;s.money<t?(s.debtDays++,s.debtDays===1&&s.news("money","Die Stadtkasse ist tief im Minus! Steuern erh\xF6hen oder Kosten senken.","bad"),s.debtDays>=10&&s.emit("bankrupt")):s.debtDays=0}}function ec(s){for(let e of s.loans)e.weeksLeft--,s.sandbox||(s.money-=e.amount/e.weeks);s.loans=s.loans.filter(e=>e.weeksLeft>0)}var vt={CAR:0,TRUCK:1,VAN:2,FIRE:3,POLICE:4,GARBAGE:5},Di=(s,e,t)=>Math.exp(-.5*((s-e)/t)**2);function Gu(s){return .25+1.1*Di(s,8,1.3)+.9*Di(s,17.5,1.6)+.55*Di(s,13,2.5)}var nr=class{constructor(e){this.g=e,this.cars=[],this.hourCount=new Float32Array(e.N),this.spawnAcc=0,this.lists={res:new qn,job:new qn,com:new qn,ind:new qn,any:new qn},this.maxCars=900,this.nextId=1,this.tripsHour=0,this.flow=1}rebuildLists(){let e=this.g,t=[];for(let n of e.buildings.values())!n.zone||n.abandoned||n.construct<1||!n.connected||n.access<0||(t.push(n),n.transitShare=e.cov.transit[n.y*e.W+n.x]*.35);this.lists.res.build(t,n=>n.zone===Ae.RES?n.occ*(1-n.transitShare):0),this.lists.job.build(t,n=>n.zone!==Ae.RES?n.occ*(1-n.transitShare):0),this.lists.com.build(t,n=>n.zone===Ae.COM?n.cap:0),this.lists.ind.build(t,n=>n.zone===Ae.IND?n.occ+1:0),this.lists.any.build(t,()=>1)}update(e){let t=this.g;if(e<=0)return;let n=t.hour(),i=Gu(n),r=t.stats.pop,a=t.policies.has("bikes")?.85:1,o=r>0?Math.min(32,(.6+Math.sqrt(r)*.17*i)*a):0,l=r*1.5/24*i*a*(1-t.stats.transitShare);this.weight=o>0?l/(o*1.25):1,this.spawnAcc+=o*e;let c=0;for(;this.spawnAcc>=1&&c++<6;)this.spawnAcc-=1,this.cars.length<this.maxCars&&this.spawnTrip(n);this.spawnAcc>3&&(this.spawnAcc=3),Math.random()<e*.25*Math.min(4,t.buildings.size/60)&&this.spawnService();let h=t.policies.has("tempo30")?.78:1,u=this.cars,d=0;for(let p=0;p<u.length;p++){let g=u[p];this.advance(g,e,h)?u[d++]=g:this.arrive(g)}u.length=d}spawnTrip(e){let t=this.g,n=Math.random,i=this.lists,r=e<5||e>22.5?.35:1,a=Di(e,7.8,1.5)*1.2*r,o=Di(e,17.5,1.8)*r,l=(.3+Di(e,13,3)*.6)*r,c=i.ind.total>0?.28:0,h=a+o+l+c,u=n()*h,d=null,p=null,g=vt.CAR,x=-1,m=-1,f="",y=t.world.highwayEnd;if((u-=a)<0)d=i.res.sample(n),p=i.job.sample(n),f="work";else if((u-=o)<0)d=i.job.sample(n),p=i.res.sample(n),f="home";else if((u-=l)<0)d=i.res.sample(n),p=i.com.sample(n),f="shop";else{g=vt.TRUCK,f="freight";let T=n();T<.45?(d=i.ind.sample(n),p=i.com.sample(n)||null):T<.75?(d=i.ind.sample(n),m=y):(x=y,p=n()<.6?i.com.sample(n):i.ind.sample(n))}if(d&&(x=d.access),p&&(m=p.access),x<0||m<0||x===m)return;let v=_s(t,x,m);if(!v){d&&d.zone===Ae.RES&&(d.noRoute=(d.noRoute||0)+1);return}let M=4+v.cost*.6;f==="work"&&d&&(d.commute=d.commute*.75+M*.25),f==="home"&&p&&(p.commute=p.commute*.75+M*.25),this.addCar(g,v.path,null)}spawnService(){let e=this.g,t=this.lists.any.sample(Math.random);if(!t)return;let n=t.y*e.W+t.x,i=Math.random()<.6,r=i?e.nearestFac.garbage[n]:e.nearestFac.police[n],a=e.buildings.get(r);if(!a||a.access<0||a.access===t.access)return;let o=_s(e,a.access,t.access);o&&this.addCar(i?vt.GARBAGE:vt.POLICE,o.path,null)}spawnMoveIn(e){let t=this.g;if(this.cars.length>=this.maxCars||e.access<0)return;let n=_s(t,t.world.highwayEnd,e.access);n&&this.addCar(vt.VAN,n.path,null)}dispatchFire(e){let t=this.g,n=t.buildings.get(t.nearestFac.fire[e.y*t.W+e.x]);if(!n||n.access<0||e.access<0)return!1;let i=n.access===e.access?{path:new Int32Array([n.access])}:_s(t,n.access,e.access);return i?i.path.length<2?(t.extinguish(e),!0):(this.addCar(vt.FIRE,i.path,e.id,!0),!0):!1}addCar(e,t,n,i=!1){if(t.length<2||!i&&this.cars.length>=this.maxCars)return;let r={id:this.nextId++,type:e,path:t,piece:0,s:0,target:n,color:Math.floor(Math.random()*1e3),weight:e>=vt.FIRE?.5:this.weight||1,x:0,z:0,yaw:0,speedVar:.85+Math.random()*.3};this.hourCount[t[0]]+=r.weight,this.pose(r),this.cars.push(r)}pieceLen(e,t){let n=e.path,i=n.length-1;if(t===0||t===i)return .5;let r=this.g.W,a=n[t-1],o=n[t],l=n[t+1];return o-a===l-o?1:.785}advance(e,t,n){let i=this.g,r=e.path[e.piece],a=i.road[r],o=wt[a];if(!o)return!1;let l=i.congestion[r],c=l>.75?1/(1+(l-.75)*3):1,h=2.1*o.speed*c*n*e.speedVar;e.type===vt.FIRE&&(h*=1.35),(e.type===vt.TRUCK||e.type===vt.GARBAGE)&&(h*=.85),e.s+=h*t;let u=this.pieceLen(e,e.piece);for(;e.s>=u;){if(e.s-=u,e.piece++,e.piece>=e.path.length)return!1;let d=e.path[e.piece];if(!i.road[d])return!1;this.hourCount[d]+=e.weight,u=this.pieceLen(e,e.piece)}return this.pose(e,u),!0}pose(e,t){let n=this.g,i=n.W,r=-n.W/2+.5,a=-n.H/2+.5,o=e.path,l=o.length-1,c=e.piece;t===void 0&&(t=this.pieceLen(e,c));let h=Math.min(1,e.s/t),u=M=>o[M]%i,d=M=>o[M]/i|0,p,g,x,m;if(c===0){let M=u(0),T=d(0),E=(u(0)+u(1))/2,b=(d(0)+d(1))/2;p=M+(E-M)*h,g=T+(b-T)*h,x=E-M,m=b-T}else if(c===l){let M=(u(l-1)+u(l))/2,T=(d(l-1)+d(l))/2,E=u(l),b=d(l);p=M+(E-M)*h,g=T+(b-T)*h,x=E-M,m=b-T}else{let M=(u(c-1)+u(c))/2,T=(d(c-1)+d(c))/2,E=u(c),b=d(c),L=(u(c)+u(c+1))/2,_=(d(c)+d(c+1))/2,w=1-h;p=w*w*M+2*w*h*E+h*h*L,g=w*w*T+2*w*h*b+h*h*_,x=2*w*(E-M)+2*h*(L-E),m=2*w*(b-T)+2*h*(_-b)}let f=Math.hypot(x,m)||1;x/=f,m/=f;let y=n.road[o[c]],v=y===Je.HIGHWAY?.26:y===Je.AVENUE?.24:y===Je.LANE?.12:.16;e.x=p+r-m*v,e.z=g+a+x*v,e.yaw=Math.atan2(x,m)}arrive(e){if(e.type===vt.FIRE&&e.target){let t=this.g.buildings.get(e.target);t&&t.burning&&this.g.extinguish(t)}}hourly(){let e=this.g,t=e.trafficLoad,n=e.congestion,i=e.road,r=0,a=0;for(let o=0;o<e.N;o++){if(!i[o]){t[o]=0,n[o]=0,this.hourCount[o]=0;continue}t[o]=t[o]*.55+this.hourCount[o]*.45,this.hourCount[o]=0;let l=t[o]/wt[i[o]].capacity;if(n[o]=l,t[o]>0){let c=l>.75?1/(1+(l-.75)*3):1;r+=t[o],a+=t[o]*c}}this.flow=r>0?a/r:1,e.stats.trafficFlow=this.flow,this.rebuildLists()}clearOnRoad(e){let t=new Set(e);this.cars=this.cars.filter(n=>{for(let i=n.piece;i<n.path.length;i++)if(t.has(n.path[i]))return!1;return!0})}};var rn=[15225919,3117024,15904798,2271334,9394904,15757230,1092003,9071189,16747039,4609737],Ka=["Rot","Blau","Gelb","Gr\xFCn","Violett","Rosa","T\xFCrkis","Braun","Orange","Indigo"],Za=(s,e,t)=>Math.exp(-.5*((s-e)/t)**2),sr=class{constructor(e){this.g=e,this.stations=new Map,this.lines=[],this.trains=[],this.linesMax=2,this.freeTrains=0,this.freeWagons=0,this.nextStation=1,this.nextLine=1,this.nextTrain=1,this.usedNames=new Set,this.dist=new Map,this.faresToday=0,this.deliveredToday=0,this.deliveredTotal=0,this.version=0,this.arrivals=[]}totalWagons(){let e=0;for(let t of this.trains)e+=t.wagons;return e}canPlaceStation(e,t){let n=this.g;if(e<0||t<0||e>=n.W||t>=n.H)return"Au\xDFerhalb der Karte";let i=t*n.W+e,r=n.world.terrain[i];return r===le.WATER||r===le.ROCK?"Nicht auf Wasser oder Fels":n.bld[i]?"Feld ist bebaut":n.stationAt[i]?"Hier steht schon eine Station":n.road[i]===4?"Nicht auf der Autobahn":null}addStation(e,t){let n=this.g,i=t*n.W+e,r=this.nextStation++,a={id:r,x:e,y:t,name:Vl(n.rng,this.usedNames),waiting:[],over:0,penaltyUntil:0,w:[0,0,0,0,0],served:0};return this.stations.set(r,a),n.stationAt[i]=r,this.updateCatchment(a),this.changed(),a}removeStation(e){let t=this.g,n=this.stations.get(e);if(n){t.stationAt[n.y*t.W+n.x]=0,this.stations.delete(e),this.usedNames.delete(n.name);for(let i of[...this.lines])i.stops.includes(e)&&(i.stops=i.stops.filter(r=>r!==e),i.stops=i.stops.filter((r,a,o)=>a===0||o[a-1]!==r),i.loop&&i.stops.length<3&&(i.loop=!1),i.stops.length<2?this.removeLine(i.id,!0):this.rebuildLine(i));this.changed()}}lineCost(e,t){let n=0;for(let i=0;i<e.length-1;i++)n+=this.segLen(e[i],e[i+1]);return t&&(n+=this.segLen(e[e.length-1],e[0])),n*Ie.trackCostPerTile}segLen(e,t){let n=this.stations.get(e),i=this.stations.get(t),r=Math.abs(i.x-n.x),a=Math.abs(i.y-n.y),o=Math.min(r,a);return o*Math.SQRT2+Math.max(r,a)-o}createLine(e,t){let n=new Set(this.lines.map(a=>a.color)),i=0;for(;n.has(i)&&i<rn.length-1;)i++;let r={id:this.nextLine++,color:i,stops:[...e],loop:!!t,ridersToday:0,riders:0,pts:[],cum:[],stopD:[],length:0};return this.lines.push(r),this.rebuildLine(r),this.addTrainToLine(r,!0),this.changed(),r}extendLine(e,t,n){n?e.stops.unshift(t):e.stops.push(t),this.rebuildLine(e),this.changed()}removeLine(e,t){if(this.lines.find(i=>i.id===e)){for(let i of this.trains.filter(r=>r.line===e))this.freeTrains++,this.freeWagons+=i.wagons;this.trains=this.trains.filter(i=>i.line!==e),this.lines=this.lines.filter(i=>i.id!==e),this.recomputeTracks(),this.recomputeRouting(),this.changed()}}addTrainToLine(e,t){let n=this.trains.filter(r=>r.line===e.id).length,i={id:this.nextTrain++,line:e.id,d:0,dir:1,cur:0,to:0,targetD:0,state:"dwell",dwell:.6,pax:[],wagons:0,x:0,y:0,z:0,yaw:0};return n>0&&e.stops.length>1&&(i.cur=Math.floor(n*e.stops.length/(n+1))%e.stops.length,i.dir=n%2===0?1:-1,!e.loop&&i.cur===e.stops.length-1&&(i.dir=-1),!e.loop&&i.cur===0&&(i.dir=1)),i.d=e.stopD[i.cur]||0,this.trains.push(i),ir(this,i),this.changed(),i}removeTrainFromLine(e){let t=this.trains.filter(i=>i.line===e.id);if(t.length<=1)return!1;let n=t[t.length-1];return this.freeTrains++,this.freeWagons+=n.wagons,this.trains=this.trains.filter(i=>i!==n),this.changed(),!0}addWagonToLine(e){let t=this.trains.filter(n=>n.line===e.id&&n.wagons<3);return t.length?(t.sort((n,i)=>n.wagons-i.wagons),t[0].wagons++,this.changed(),!0):!1}trainCapacity(e){return Ie.baseCapacity+e.wagons*Ie.wagonCapacity}rebuildLine(e){let t=[],n=[],i=[],r=h=>this.stations.get(h),a=e.stops.length,o=e.loop?a:a-1,l=[0],c=(h,u,d)=>{if(t.length){let[p,g]=t[t.length-1];if(Math.abs(p-h)<1e-6&&Math.abs(g-u)<1e-6)return;l.push(l[l.length-1]+Math.hypot(h-p,u-g))}t.push([h,u]),i.push(d)};for(let h=0;h<o;h++){let u=r(e.stops[h]),d=r(e.stops[(h+1)%a]),p=u.x+.5,g=u.y+.5,x=d.x+.5,m=d.y+.5;h===0&&(c(p,g,h),n.push(0));let f=x-p,y=m-g,v=Math.min(Math.abs(f),Math.abs(y));if(v>0&&v!==Math.abs(f)||v>0&&v!==Math.abs(y)){let M,T;h%2===0?(M=p+Math.sign(f)*v,T=g+Math.sign(y)*v):(M=x-Math.sign(f)*v,T=m-Math.sign(y)*v),c(M,T,h)}c(x,m,h),e.loop&&h===o-1||n.push(l[l.length-1])}e.pts=t,e.cum=l,e.pair=i,e.stopD=n,e.length=l[l.length-1];for(let h of this.trains)h.line===e.id&&(h.cur=Math.min(h.cur,a-1),h.d=n[h.cur],h.state="dwell",h.dwell=.5,e.loop||(h.cur===0&&(h.dir=1),h.cur===a-1&&(h.dir=-1)),ir(this,h));this.recomputeTracks(),this.recomputeRouting()}recomputeTracks(){let e=this.g;e.trackCount.fill(0);let t=new Set;for(let i of this.lines){let r=new Set;if(i.pts){for(let a=0;a<i.pts.length-1;a++){let[o,l]=i.pts[a],[c,h]=i.pts[a+1],u=Math.hypot(c-o,h-l),d=Math.ceil(u/.25);for(let p=0;p<=d;p++){let g=Math.floor(o+(c-o)*p/d),x=Math.floor(l+(h-l)*p/d);g>=0&&x>=0&&g<e.W&&x<e.H&&r.add(x*e.W+g)}}for(let a of r)e.trackCount[a]++,t.add(a)}}let n=new Map;for(let i of this.lines){let r=i.stops.length,a=i.loop?r:r-1;i.segOffset=[];for(let o=0;o<a;o++){let l=i.stops[o],c=i.stops[(o+1)%r],h=l<c?l+"-"+c:c+"-"+l;n.has(h)||n.set(h,[]),n.get(h).push([i,o])}}for(let i of n.values()){let r=i.length;i.forEach(([a,o],l)=>{a.segOffset[o]=(l-(r-1)/2)*.3})}}recomputeRouting(){let e=new Map;for(let t of this.stations.keys())e.set(t,new Set);for(let t of this.lines){let n=t.stops.length;for(let i=0;i<n-1;i++)e.get(t.stops[i])?.add(t.stops[i+1]),e.get(t.stops[i+1])?.add(t.stops[i]);t.loop&&n>2&&(e.get(t.stops[n-1])?.add(t.stops[0]),e.get(t.stops[0])?.add(t.stops[n-1]))}this.dist=new Map;for(let t of this.stations.keys()){let n=new Map([[t,0]]),i=[t];for(let r=0;r<i.length;r++){let a=i[r];for(let o of e.get(a)||[])n.has(o)||(n.set(o,n.get(a)+1),i.push(o))}this.dist.set(t,n)}this.stationLines=new Map;for(let t of this.lines)for(let n of t.stops)this.stationLines.has(n)||this.stationLines.set(n,new Set),this.stationLines.get(n).add(t.id)}hops(e,t){let n=this.dist.get(e);if(!n)return 1/0;let i=n.get(t);return i===void 0?1/0:i}updateCatchment(e){let t=this.g,n=[0,0,0,0,0];Sn(t,e.x+.5,e.y+.5,Ie.catchment,a=>{let o=t.buildings.get(t.bld[a]);o&&o.zone&&!o.abandoned&&(n[o.zone]+=o.occ)}),e.w=n;let i=1,r=-1;for(let a=1;a<=4;a++)n[a]>r&&(r=n[a],i=a);e.shape=r>0?i:0}hourly(){for(let e of this.stations.values())this.updateCatchment(e)}applyCoverage(){let e=this.g,t=e.cov.transit;t.fill(0),e.transitPenalty.fill(0);let n=new Set(this.trains.map(a=>a.line));for(let a of this.stations.values()){let o=this.stationLines?.get(a.id),l=!1;if(o)for(let u of o)n.has(u)&&(l=!0);if(a.active=l,!l)continue;let c=Ie.catchment,h=a.penaltyUntil>e.time;Sn(e,a.x+.5,a.y+.5,c,(u,d)=>{let p=1-.35*(d/c);p>t[u]&&(t[u]=p),h&&(e.transitPenalty[u]=1)})}let i=0,r=0;for(let a of e.buildings.values())a.zone!==1||a.abandoned||(i+=t[a.y*e.W+a.x]*.35*a.occ,r+=a.occ);e.stats.transitShare=r>0?i/r:0}spawnPassengers(e){let t=this.g;if(!this.lines.length)return;let n=t.hour(),i=n<5||n>23?.25:1,r=Za(n,7.8,1.6)*1.3+.12,a=Za(n,17.3,1.8)*1.2+.1,o=.22+Za(n,13,3)*.5,l=(t.policies.has("freetransit")?1.4:1)*(1+t.eff("ridership")),c=e/60*i*l*.55;for(let h of this.stations.values()){if(!h.active)continue;let u=h.w,d=u[1]*.01*r*c,p=u[1]*.005*o*c,g=(u[2]+u[3]+u[4])*.01*a*c;h.acc=(h.acc||0)+d+p+g;let x=0;for(;h.acc>=1&&x++<6;){h.acc-=1;let m=t.rng()*(d+p+g),f;m<d?f=[3,4]:m<d+p?f=[2]:f=[1];let y=0,v=[];for(let E of this.stations.values())if(!(E===h||!E.active)&&this.hops(E.id,h.id)!==1/0)for(let b of f){let L=E.w[b];L>0&&(v.push([E,b,L]),y+=L)}if(y<=0)continue;let M=t.rng()*y,T=v[v.length-1];for(let E of v)if(M-=E[2],M<=0){T=E;break}h.waiting.push({dest:T[0].id,shape:T[1],t:t.time})}if(h.acc>4&&(h.acc=4),h.waiting.length>Ie.stationCapacity){if(h.over+=e/(Ie.overcrowdDays*1440),h.over>=1){h.over=0,h.penaltyUntil=t.time+2*1440;let m=Math.ceil(h.waiting.length/2);h.waiting.splice(0,m),t.news("transit",`Station ${h.name} ist hoffnungslos \xFCberf\xFCllt! ${m} Fahrg\xE4ste geben auf. Mehr Z\xFCge oder Waggons einsetzen.`,"bad",{x:h.x,y:h.y}),this.changed()}}else h.over=Math.max(0,h.over-e/720);h.waiting.length&&(h.waiting=h.waiting.filter(m=>this.hops(m.dest,h.id)!==1/0&&t.time-m.t<1440*1.5))}}update(e){if(e<=0)return;let t=this.g,n=Ie.speed*t.mods.trainSpeed;for(let i of this.trains){let r=this.lines.find(a=>a.id===i.line);if(!(!r||r.stops.length<2)){if(i.state==="dwell")i.dwell-=e,i.dwell<=0&&this.depart(i,r);else{let a=n*e,o=Math.abs(i.targetD-i.d);o<.8&&(a*=.45+.55*(o/.8)),a>=o?(i.d=i.targetD,this.arrive(i,r)):i.d+=i.dir*a}ir(this,i)}}}nextStop(e,t,n){let i=e.stops.length;if(e.loop)return{next:(t+n+i)%i,dir:n};let r=t+n;return(r<0||r>=i)&&(n=-n,r=t+n),{next:r,dir:n}}depart(e,t){let{next:n,dir:i}=this.nextStop(t,e.cur,e.dir);e.dir=i,e.to=n;let r=t.stops.length;t.loop?i>0?e.targetD=n===0?t.length:t.stopD[n]:(e.cur===0&&(e.d=t.length),e.targetD=t.stopD[n]):e.targetD=t.stopD[n],e.state="move"}arrive(e,t){let n=this.g;e.cur=e.to,t.loop&&e.d>=t.length-1e-6&&(e.d=0),e.state="dwell";let i=t.stops[e.cur],r=this.stations.get(i),{next:a}=this.nextStop(t,e.cur,e.dir),o=t.stops[a],l=0,c=[];for(let h of e.pax)h.dest===i?(l++,this.deliveredToday++,this.deliveredTotal++,this.faresToday+=Ie.fare,t.ridersToday++,r&&r.served++):this.hops(h.dest,o)<this.hops(h.dest,i)?c.push(h):(l++,r&&r.waiting.push(h));if(e.pax=c,r){let h=this.trainCapacity(e),u=[];for(let d of r.waiting)e.pax.length<h&&this.hops(d.dest,o)<this.hops(d.dest,i)?(e.pax.push(d),l++):u.push(d);r.waiting=u,this.arrivals.length<40&&this.arrivals.push({line:t.color,station:i,n:l})}e.dwell=.45+l*.09}daily(){for(let e of this.lines)e.riders=e.ridersToday,e.ridersToday=0;this.g.stats.ridersToday=this.deliveredToday,this.deliveredToday=0}changed(){this.version++}serialize(){return{stations:[...this.stations.values()].map(e=>({id:e.id,x:e.x,y:e.y,name:e.name,waiting:e.waiting,over:e.over,penaltyUntil:e.penaltyUntil})),lines:this.lines.map(e=>({id:e.id,color:e.color,stops:e.stops,loop:e.loop})),trains:this.trains.map(e=>({id:e.id,line:e.line,cur:e.cur,dir:e.dir,wagons:e.wagons,pax:e.pax})),linesMax:this.linesMax,freeTrains:this.freeTrains,freeWagons:this.freeWagons,nextStation:this.nextStation,nextLine:this.nextLine,nextTrain:this.nextTrain,deliveredTotal:this.deliveredTotal}}load(e){let t=this.g;this.stations=new Map,this.usedNames=new Set;for(let n of e.stations)this.stations.set(n.id,{...n,w:[0,0,0,0,0],served:0}),this.usedNames.add(n.name),t.stationAt[n.y*t.W+n.x]=n.id;this.lines=e.lines.map(n=>({...n,ridersToday:0,riders:0,pts:[],cum:[0],stopD:[],pair:[],length:0})),this.trains=[],Object.assign(this,{linesMax:e.linesMax,freeTrains:e.freeTrains,freeWagons:e.freeWagons,nextStation:e.nextStation,nextLine:e.nextLine,nextTrain:e.nextTrain,deliveredTotal:e.deliveredTotal||0});for(let n of this.lines)this.rebuildLine(n);for(let n of e.trains){let i=this.lines.find(a=>a.id===n.line);if(!i)continue;let r={id:n.id,line:n.line,d:i.stopD[n.cur]||0,dir:n.dir,cur:n.cur,to:n.cur,targetD:0,state:"dwell",dwell:.5,pax:n.pax||[],wagons:n.wagons,x:0,y:0,z:0,yaw:0};this.trains.push(r),ir(this,r)}for(let n of this.stations.values())this.updateCatchment(n);this.recomputeRouting(),this.changed()}};function Ja(s,e,t,n){let i=s.g,r=e.pts,a=e.cum;if(!r.length)return n.x=0,n.z=0,n.yaw=0,n;e.loop?t=(t%e.length+e.length)%e.length:t=Math.max(0,Math.min(e.length,t));let o=0,l=a.length-1;for(;o<l-1;){let v=o+l>>1;a[v]<=t?o=v:l=v}let c=Math.min(o,r.length-2),[h,u]=r[c],[d,p]=r[c+1],g=a[c+1]-a[c]||1,x=(t-a[c])/g,m=(d-h)/g,f=(p-u)/g,y=e.segOffset&&e.segOffset[e.pair[c+1]]||0;return n.x=h+(d-h)*x-f*y-i.W/2,n.z=u+(p-u)*x+m*y-i.H/2,n.yaw=Math.atan2(m,f),n}function ir(s,e){let t=s.lines.find(n=>n.id===e.line);t&&Ja(s,t,e.d,e)}var tc=s=>Math.round((6e3+s.stats.pop*3.2)/500)*500,nc=[{id:"grant",name:"F\xF6rdermittel",tag:"Geld",color:"#e3a925",w:3,text:s=>`${Xe(tc(s))} vom Land \u2013 sofort.`,apply:s=>{s.money+=tc(s)}},{id:"line",name:"Neue Linie",tag:"Pulsbahn",color:"#e8543f",w:2.4,cond:s=>s.isUnlocked("transit")&&s.transit.linesMax<10,text:()=>"Ein zus\xE4tzlicher Linienplatz f\xFCr die Pulsbahn.",apply:s=>{s.transit.linesMax++}},{id:"trains",name:"Zwei Z\xFCge",tag:"Pulsbahn",color:"#2f8fe0",w:2.2,cond:s=>s.isUnlocked("transit"),text:()=>"Zwei Z\xFCge gratis im Depot. Setze sie im Linienfenster ein.",apply:s=>{s.transit.freeTrains+=2}},{id:"wagons",name:"Waggons",tag:"Pulsbahn",color:"#22a866",w:2,cond:s=>s.isUnlocked("transit"),text:()=>"Drei Waggons gratis: +6 Pl\xE4tze je Waggon.",apply:s=>{s.transit.freeWagons+=3}},{id:"festival",name:"Stadtfest",tag:"Gl\xFCck",color:"#f06fae",w:2,text:()=>"+8 Gl\xFCck in der ganzen Stadt f\xFCr 7 Tage.",apply:s=>s.addEffect("happy",8,7,"Stadtfest")},{id:"boom",name:"Konjunktur",tag:"Geld",color:"#e3a925",w:1.6,cond:s=>s.stats.pop>200,text:()=>"+25 % Steuereinnahmen f\xFCr 7 Tage.",apply:s=>s.addEffect("taxMul",.25,7,"Konjunktur")},{id:"immigration",name:"Zuzugswelle",tag:"Wachstum",color:"#63c27a",w:2,text:()=>"Wohnnachfrage +35 f\xFCr 6 Tage.",apply:s=>s.addEffect("resDemand",35,6,"Zuzugswelle")},{id:"investors",name:"Investoren",tag:"Wachstum",color:"#4c9be8",w:1.8,cond:s=>s.stats.pop>150,text:()=>"Gewerbe- und B\xFCronachfrage +30 f\xFCr 6 Tage.",apply:s=>{s.addEffect("comDemand",30,6,"Investoren"),s.addEffect("offDemand",30,6,"Investoren")}},{id:"admin",name:"Schlanke Verwaltung",tag:"Dauerhaft",color:"#7d8a99",w:1.4,cond:s=>(s.cardCount.admin||0)<3,text:()=>"Unterhaltskosten dauerhaft \u22128 %.",apply:s=>{s.mods.upkeep*=.92}},{id:"grid",name:"Smart Grid",tag:"Dauerhaft",color:"#f2b01e",w:1.4,cond:s=>(s.cardCount.grid||0)<3,text:()=>"Alle Kraftwerke liefern dauerhaft 12 % mehr Strom.",apply:s=>{s.mods.power*=1.12}},{id:"pipes",name:"Rohrsanierung",tag:"Dauerhaft",color:"#38a3d1",w:1.3,cond:s=>(s.cardCount.pipes||0)<3,text:()=>"Wasserversorgung dauerhaft +12 %.",apply:s=>{s.mods.water*=1.12}},{id:"teachers",name:"Lehrkr\xE4fte",tag:"Dauerhaft",color:"#8f5ad8",w:1.3,cond:s=>s.milestone>=1&&(s.cardCount.teachers||0)<2,text:()=>"Bildung w\xE4chst dauerhaft 30 % schneller.",apply:s=>{s.mods.edu*=1.3}},{id:"firesafety",name:"Brandschutz",tag:"Dauerhaft",color:"#e8543f",w:1.1,cond:s=>(s.cardCount.firesafety||0)<2,text:()=>"Brandrisiko dauerhaft \u221230 %.",apply:s=>{s.mods.fire*=.7}},{id:"roadcrew",name:"Stra\xDFenbaukolonne",tag:"Bauen",color:"#5f6b78",w:1.6,text:()=>"Stra\xDFen kosten 7 Tage lang nur die H\xE4lfte.",apply:s=>s.addEffect("roadCost",-.5,7,"Stra\xDFenbaukolonne")},{id:"express",name:"Expressz\xFCge",tag:"Pulsbahn",color:"#10a9a3",w:1.2,cond:s=>s.isUnlocked("transit")&&(s.cardCount.express||0)<2,text:()=>"Pulsbahn-Z\xFCge dauerhaft 20 % schneller.",apply:s=>{s.mods.trainSpeed*=1.2}},{id:"filters",name:"Filteranlagen",tag:"Dauerhaft",color:"#22a866",w:1.2,cond:s=>s.stats.jobsByZone[3]>40&&(s.cardCount.filters||0)<3,text:()=>"Industrie-Abgase dauerhaft \u221215 %.",apply:s=>{s.mods.pollution*=.85}},{id:"tourism",name:"Werbekampagne",tag:"Tourismus",color:"#ff8a1f",w:1.1,cond:s=>s.stats.tourism>50,text:()=>"Touristen +50 % f\xFCr 7 Tage.",apply:s=>s.addEffect("tourism",50,7,"Werbekampagne")}];function ic(s){let e=[];for(let[t,n]of Object.entries(nt))n.landmark&&(s.landmarkVouchers.has(t)||s.hasBuilt(t)||s.milestone<n.unlock-1||e.push({id:"lm:"+t,name:n.name,tag:"Wahrzeichen",color:"#c06a2b",w:1.5,landmark:t,text:()=>`Schaltet ${n.name} frei \u2013 zum halben Preis. ${n.desc}`,apply:i=>{i.landmarkVouchers.add(t)}}));return e}function ja(s,e){return nc.find(t=>t.id===e)||ic(s).find(t=>t.id===e)||null}function sc(s){let e=[...nc.filter(n=>!n.cond||n.cond(s)),...ic(s)],t=[];for(let n=0;n<3&&e.length;n++){let i=e.reduce((o,l)=>o+l.w,0),r=s.rng()*i,a=e.length-1;for(let o=0;o<e.length;o++)if(r-=e[o].w,r<=0){a=o;break}t.push(e[a].id),e.splice(a,1)}s.pendingCards=t,s.emit("cards",t)}function rc(s,e){let t=ja(s,e);s.pendingCards=null,t&&(t.apply(s),s.cardCount[t.id]=(s.cardCount[t.id]||0)+1,s.cardsTaken.push({id:t.id,day:s.day()}),s.news("card",`Wochenkarte gew\xE4hlt: ${t.name}.`,"good"),s.emit("cardChosen",t))}var Qa=[{id:"mall",title:"Ein Investor klopft an",minPop:300,text:"Eine Handelskette m\xF6chte sich ansiedeln und bietet eine Spende \u2013 im Gegenzug will sie zwei Wochen lang Steuernachlass.",options:[{label:"Annehmen",hint:s=>`+${Xe(8e3+s.stats.pop*2)}, Gewerbesteuer \u221240 % f\xFCr 14 Tage, Gewerbenachfrage +25`,apply:s=>{s.money+=8e3+s.stats.pop*2,s.addEffect("comTax",-.4,14,"Steuerdeal"),s.addEffect("comDemand",25,10,"Handelskette")}},{label:"Ablehnen",hint:()=>"Nichts passiert.",apply:()=>{}}]},{id:"storm",title:"Sturmwarnung",minPop:150,text:"Ein Orkan zieht \xFCber die Region. Die Stadtwerke wollen Leitungen vorsorglich sichern.",options:[{label:"Sichern lassen",hint:()=>"\u22124.000 \u20AC",apply:s=>{s.money-=4e3}},{label:"Riskieren",hint:()=>"M\xF6glicherweise 2 Tage nur 55 % Kraftwerksleistung",apply:s=>{s.rng()<.65?(s.addEffect("powerMul",-.45,2,"Sturmsch\xE4den"),s.news("event","Der Sturm hat Stromleitungen besch\xE4digt.","bad")):s.news("event","Gl\xFCck gehabt \u2013 der Sturm ist vorbeigezogen.","good")}}]},{id:"heat",title:"Hitzewelle",minPop:200,text:"Seit Tagen \xFCber 35 Grad. Alle wollen duschen, gie\xDFen und baden.",options:[{label:"Wasser rationieren",hint:()=>"Gl\xFCck \u22124 f\xFCr 3 Tage",apply:s=>s.addEffect("happy",-4,3,"Wasserrationierung")},{label:"Laufen lassen",hint:()=>"Wasserverbrauch +35 % f\xFCr 3 Tage",apply:s=>s.addEffect("waterUse",.35,3,"Hitzewelle")}]},{id:"concert",title:"Open-Air-Konzert",minPop:500,text:"Eine bekannte Band m\xF6chte am Wochenende in deiner Stadt spielen.",options:[{label:"B\xFChne bezahlen",hint:()=>"\u22126.000 \u20AC, Gl\xFCck +6 und Touristen +120 f\xFCr 5 Tage",apply:s=>{s.money-=6e3,s.addEffect("happy",6,5,"Konzert"),s.addEffect("tourismAdd",120,5,"Konzert")}},{label:"Absagen",hint:()=>"Gl\xFCck \u22122 f\xFCr 3 Tage",apply:s=>s.addEffect("happy",-2,3,"Konzert abgesagt")}]},{id:"strike",title:"Streik bei der M\xFCllabfuhr",minPop:250,cond:s=>s.countBuilt("garbage")>0,text:"Die M\xFCllwerker fordern mehr Lohn und legen die Arbeit nieder.",options:[{label:"Lohnerh\xF6hung zahlen",hint:()=>"\u22125.000 \u20AC",apply:s=>{s.money-=5e3}},{label:"Aussitzen",hint:()=>"M\xFCllabfuhr 4 Tage stark eingeschr\xE4nkt",apply:s=>s.addEffect("garbageCov",-.6,4,"M\xFCllstreik")}]},{id:"partner",title:"St\xE4dtepartnerschaft",minPop:400,text:"Eine Stadt am Meer m\xF6chte Partnerstadt werden. Das kostet ein Fest, bringt aber Besucher.",options:[{label:"Feiern",hint:()=>"\u22123.000 \u20AC, Touristen +80 f\xFCr 10 Tage, Gl\xFCck +3",apply:s=>{s.money-=3e3,s.addEffect("tourismAdd",80,10,"Partnerstadt"),s.addEffect("happy",3,10,"Partnerstadt")}},{label:"Freundlich ablehnen",hint:()=>"Nichts passiert.",apply:()=>{}}]},{id:"startup",title:"Gr\xFCnderszene",minPop:1200,cond:s=>s.isUnlocked("zone4"),text:"Junge Firmen suchen B\xFCros. Ein Gr\xFCnderzentrum w\xFCrde helfen.",options:[{label:"F\xF6rdern",hint:()=>"\u22127.000 \u20AC, B\xFCronachfrage +45 f\xFCr 8 Tage",apply:s=>{s.money-=7e3,s.addEffect("offDemand",45,8,"Gr\xFCnderzentrum")}},{label:"Abwarten",hint:()=>"Nichts passiert.",apply:()=>{}}]},{id:"green",title:'B\xFCrgerinitiative \u201EMehr Gr\xFCn"',minPop:300,text:"Hunderte unterschreiben f\xFCr mehr Parks in der Stadt.",options:[{label:"Versprechen",hint:()=>"Parks 7 Tage kostenlos",apply:s=>s.addEffect("parkFree",1,7,"Parkoffensive")},{label:"Ignorieren",hint:()=>"Gl\xFCck \u22124 f\xFCr 5 Tage",apply:s=>s.addEffect("happy",-4,5,"Entt\xE4uschte Initiative")}]},{id:"flu",title:"Grippewelle",minPop:600,text:"Die Wartezimmer sind voll. Das Gesundheitsamt r\xE4t zur Impfkampagne.",options:[{label:"Impfkampagne",hint:()=>"\u22125.000 \u20AC",apply:s=>{s.money-=5e3}},{label:"Nichts tun",hint:()=>"Gesundheitsversorgung \u221235 % und Gl\xFCck \u22123 f\xFCr 4 Tage",apply:s=>{s.addEffect("healthCov",-.35,4,"Grippewelle"),s.addEffect("happy",-3,4,"Grippewelle")}}]},{id:"doener",title:"D\xF6ner-Festival",minPop:350,text:"M\xEArd\xEEn l\xE4dt zum gro\xDFen Chili-Cheese-D\xF6ner-Festival auf dem Marktplatz ein.",options:[{label:"Unterst\xFCtzen",hint:()=>"\u22122.500 \u20AC, Gl\xFCck +5 und Gewerbenachfrage +20 f\xFCr 5 Tage",apply:s=>{s.money-=2500,s.addEffect("happy",5,5,"D\xF6ner-Festival"),s.addEffect("comDemand",20,5,"D\xF6ner-Festival")}},{label:"Keine Zeit",hint:()=>"Nichts passiert.",apply:()=>{}}]},{id:"traffic",title:"Stau-Beschwerden",minPop:800,cond:s=>s.stats.trafficFlow<.75,text:"Pendler beschweren sich \xFCber den t\xE4glichen Stau. Die Zeitung fordert L\xF6sungen.",options:[{label:"Verkehrsgutachten",hint:()=>"\u22123.000 \u20AC, Pulsbahn-Fahrg\xE4ste +25 % f\xFCr 7 Tage",apply:s=>{s.money-=3e3,s.addEffect("ridership",.25,7,'Kampagne \u201ESteig um"')}},{label:"Abwiegeln",hint:()=>"Gl\xFCck \u22123 f\xFCr 4 Tage",apply:s=>s.addEffect("happy",-3,4,"Stau-Frust")}]}];function ac(s){if(s.pendingEvent||s.pendingCards||s.milestone<1||s.sandboxNoEvents||s.day()<s.nextEventDay)return;let e=Qa.filter(n=>s.stats.pop>=n.minPop&&(!n.cond||n.cond(s))&&n.id!==s.lastEventId);if(!e.length)return;let t=Rn(s.rng,e);s.pendingEvent=t.id,s.lastEventId=t.id,s.nextEventDay=s.day()+6+Math.floor(s.rng()*7),s.emit("event",t)}function oc(s,e){let t=Qa.find(i=>i.id===s.pendingEvent);if(s.pendingEvent=null,!t)return;let n=t.options[e];n&&n.apply(s),s.emit("eventResolved",t,e)}var Wu=[{when:s=>s.stats.unpowered>2,texts:["Schon wieder kein Strom! Mein K\xFChlschrank taut ab. #Stromausfall","Kerzenlicht ist romantisch, aber nicht jeden Abend. Wann kommt der Strom?","Ohne Strom kein WLAN. Ohne WLAN kein Leben."]},{when:s=>s.stats.unwatered>2,texts:["Kein Wasser aus dem Hahn. Ich dusche jetzt mit Mineralwasser.","Die Wasserversorgung reicht nicht. Bitte mehr Pumpwerke!"]},{when:s=>s.stats.garbageProb>3,texts:["Vor meinem Haus stapeln sich die M\xFCllt\xFCten. Es riecht\u2026","Die M\xFCllabfuhr war seit Tagen nicht da. #M\xFCllberg"]},{when:s=>s.stats.trafficFlow<.7,texts:["45 Minuten f\xFCr drei Kreuzungen. Ich steige aufs Fahrrad um.","Stau, Stau, Stau. Eine Pulsbahn-Linie w\xE4re sch\xF6n.","Ich kenne jetzt jedes Nummernschild auf meinem Arbeitsweg."]},{when:s=>s.taxes[1]>=14,texts:["Die Steuern sind viel zu hoch! Ich \xFCberlege wegzuziehen.","Mehr Steuern, aber wof\xFCr?"]},{when:s=>s.taxes[1]<=7,texts:["Niedrige Steuern \u2013 hier l\xE4sst es sich leben!"]},{when:s=>s.stats.unemployment>.12,texts:["Ich suche seit Wochen Arbeit. Gibt es hier keine Firmen?","Zu wenig Jobs in der Stadt. Wir brauchen Gewerbe und Industrie."]},{when:s=>s.stats.happiness>75,texts:["Ich liebe diese Stadt! \u2764","Sonnenschein, Parks und nette Nachbarn. Perfekt.","Bester B\xFCrgermeister aller Zeiten."]},{when:s=>s.stats.happiness<40&&s.stats.pop>100,texts:["Die Stimmung in der Stadt ist mies. Irgendwer muss was tun.","Ich packe die Umzugskartons."]},{when:s=>s.stats.ridersToday>40,texts:["Mit der Pulsbahn in 6 Minuten zur Arbeit. Herrlich!","Die Aussicht aus der Hochbahn ist der Wahnsinn.","Ich habe heute in der Pulsbahn meine Jugendliebe getroffen."]},{when:s=>s.transit.lines.length&&[...s.transit.stations.values()].some(e=>e.waiting.length>10),texts:["Die Station ist rappelvoll. Mehr Z\xFCge, bitte!","Drei Bahnen sind an mir vorbeigefahren \u2013 alle voll."]},{when:s=>s.stats.pollutionAvg>.25,texts:["Die Luft schmeckt nach Industrie. Ich will B\xE4ume!","Mein Balkon ist voller Ru\xDF."]},{when:s=>s.stats.crimeAvg>.35&&s.stats.pop>300,texts:["Mir wurde das Fahrrad geklaut. Schon wieder.","Nachts f\xFChle ich mich hier nicht mehr sicher. Mehr Polizei!"]},{when:s=>s.stats.pop>300&&s.stats.healthAvg<.3,texts:["Der n\xE4chste Arzt ist ewig weit weg.","Wir brauchen eine Arztpraxis im Viertel."]},{when:s=>s.stats.pop>300&&s.stats.edu<.15,texts:["Meine Kinder brauchen eine Schule!","Ohne Schule keine Zukunft."]},{when:s=>s.hasBuilt("doener"),texts:["Der Chili-Cheese-D\xF6ner bei M\xEArd\xEEn ist unschlagbar.","Eigene So\xDFen, ofenfrische Pide \u2013 M\xEArd\xEEn\u2019s ist ein Muss."]},{when:s=>s.stats.burning>0,texts:["Es brennt! Ich sehe Rauch \xFCber den D\xE4chern.","Wo bleibt die Feuerwehr?!"]},{when:()=>!0,texts:["Sch\xF6ner Tag heute.","Hat jemand meine Katze gesehen? Grau, hei\xDFt Pixel.","Neue B\xE4ckerei an der Ecke. Die Brezeln sind top.","Ich habe beim Joggen einen Fuchs gesehen!","Wer baut eigentlich all diese Stra\xDFen? Respekt.","Gestern Abend der Sonnenuntergang \xFCber der Stadt \u2013 wow."]}];function lc(s){if(s.stats.pop<20)return;let e=Wu.filter(i=>i.when(s)),t=e.length>1&&s.rng()<.75?e[Math.floor(s.rng()*(e.length-1))]:e[e.length-1];if(!t)return;let n=Rn(s.rng,t.texts);s.pushNews({kind:"chatter",author:$l(s.rng),text:n,mood:"info"})}var Yn=class s extends Ys{constructor(e){super();let{size:t=96,seed:n=12345,mapType:i="river",difficulty:r="normal",name:a="Neustadt"}=e;this.opts={size:t,seed:n,mapType:i,difficulty:r,name:a},this.name=a,this.world=Xl(t,n,i);let o=this.W=t,l=this.H=t,c=this.N=o*l;this.rng=Cn(n*7919^1540483477),this.road=new Uint8Array(c),this.zone=new Uint8Array(c),this.bld=new Int32Array(c),this.rubble=new Uint8Array(c),this.stationAt=new Int32Array(c),this.trackCount=new Uint8Array(c),this.roadComp=new Int32Array(c).fill(-1),this.access=new Int32Array(c).fill(-1),this.trafficLoad=new Float32Array(c),this.congestion=new Float32Array(c),this.transitPenalty=new Uint8Array(c),this.cov={};for(let u of[...Wa,"park","transit","lvBonus","happyBonus","comBoost","resBoost"])this.cov[u]=new Float32Array(c);this.nearestFac={fire:new Int32Array(c),police:new Int32Array(c),garbage:new Int32Array(c)},this.fields={pollution:new Float32Array(c),noise:new Float32Array(c),crime:new Float32Array(c),landValue:new Float32Array(c)},this.compCount=0,this.outsideComp=-1,this.netVersion=0,this.pathCache=new Zs,this.buildings=new Map,this.nextId=1,this.zoneFree=[null,new Set,new Set,new Set,new Set],this._zoneArr=[null,null,null,null,null],this.growAcc=[0,0,0,0,0];let h=Li.find(u=>u.id===r)||Li[1];this.difficulty=h.id,this.sandbox=h.id==="sandbox",this.costMul=this.sandbox?0:h.costMul,this.money=h.money,this.time=7*60,this.nextStep=this.time+10,this.lastHour=Math.floor(this.time/60),this.lastDay=0,this.speed=1,this.taxes={1:10,2:10,3:10,4:10},this.policies=new Set,this.milestone=this.sandbox?zt.length-1:0,this.mods={upkeep:1,power:1,water:1,edu:1,fire:1,trainSpeed:1,pollution:1},this.effects=[],this.loans=[],this.cardCount={},this.cardsTaken=[],this.landmarkVouchers=new Set,this.pendingCards=null,this.pendingEvent=null,this.nextEventDay=5,this.lastEventId=null,this.debtDays=0,this.weekIncome=0,this.weekExpense=0,this.history=[],this.newsLog=[],this.gameOver=!1,this.demand=[0,0,0,0,0],this.peopleDemand=0,this.stats={pop:0,resCap:0,workers:0,jobs:0,jobsByZone:[0,0,0,0,0],plannedByZone:[0,0,0,0,0],countByZone:[0,0,0,0,0],employed:0,unemployment:0,jobFill:1,edu:0,eduWorkers:0,eduCity:0,happiness:60,tourism:0,transitShare:0,trafficFlow:1,ridersToday:0,abandoned:0,unpowered:0,unwatered:0,burning:0,noRoad:0,garbageProb:0,pollutionAvg:0,crimeAvg:0,healthAvg:0},this.util={powerSupply:0,powerDemand:0,waterSupply:0,waterDemand:0},this.dirty={util:!0,coverage:!0,fields:!0};for(let u of this.world.highway)this.road[u]=Je.HIGHWAY;this.traffic=new nr(this),this.transit=new sr(this),this.sandbox&&(this.transit.linesMax=10),Ks(this),er(this),this.lastBudget=bs(this)}day(){return Math.floor(this.time/ui)}hour(){return this.time%ui/60}weekday(){return this.day()%7}week(){return Math.floor(this.day()/7)+1}year(){return Math.floor(this.day()/364)+1}clockText(){let e=Math.floor(this.time%ui),t=String(Math.floor(e/60)).padStart(2,"0"),n=String(Math.floor(e%60/15)*15).padStart(2,"0");return`${t}:${n}`}dateText(){return`${zl[this.weekday()]} \xB7 Woche ${this.week()} \xB7 Jahr ${this.year()}`}get blocking(){return!!(this.pendingCards||this.pendingEvent||this.gameOver)}eff(e){let t=0;for(let n of this.effects)n.key===e&&(t+=n.value);return t}addEffect(e,t,n,i){this.effects.push({key:e,value:t,until:this.time+n*ui,label:i}),this.dirty.coverage=!0,this.emit("effects")}upkeepMul(){return this.mods.upkeep*(this.sandbox||this.costMul===0?0:Math.max(.6,this.costMul))}isUnlocked(e){if(this.sandbox)return!0;if(e==="zone4"||e==="transit"||e==="avenue"||e==="loans")return this.milestone>=2;if(e==="policies")return this.milestone>=1;let t=nt[e];return t?t.landmark?this.landmarkVouchers.has(e)||this.milestone>=t.unlock+1:this.milestone>=t.unlock:!0}lockReason(e){if(this.isUnlocked(e))return null;let t=nt[e],n=2;t&&(n=t.landmark?t.unlock+1:t.unlock);let i=zt[n];return t&&t.landmark?`\xDCber eine Wochenkarte oder ab \u201E${i.name}" (${i.pop.toLocaleString("de-DE")} Einw.)`:`Ab \u201E${i.name}" (${i.pop.toLocaleString("de-DE")} Einwohner)`}hasBuilt(e){for(let t of this.buildings.values())if(t.key===e)return!0;return!1}countBuilt(e){let t=0;for(let n of this.buildings.values())!n.zone&&nt[n.key]?.cat===e&&t++;return t}canAfford(e){return this.sandbox||e<=0||this.money>=e}spend(e){this.sandbox||(this.money-=e),this.emit("money")}roadTileCost(e,t){let n=this.world.terrain[e],i=wt[t].cost*this.costMul*Math.max(.2,1+this.eff("roadCost"));return n===le.WATER&&(i*=Ol),this.world.trees[e]&&(i+=$s*this.costMul),i}planRoad(e,t){let n=0,i=[],r=[];for(let a of e){let o=this.world.terrain[a],l=this.road[a];if(!(l===Je.HIGHWAY&&t!==Je.HIGHWAY)&&l!==t){if(o===le.ROCK||this.bld[a]||this.stationAt[a]&&!l){i.push(a);continue}r.push(a),n+=this.roadTileCost(a,t)}}return{cost:n,invalid:i,build:r,ok:i.length===0&&r.length>0}}buildRoad(e,t){let n=this.planRoad(e,t);if(!n.ok)return{ok:!1,msg:n.invalid.length?"Hier kann keine Stra\xDFe gebaut werden.":"Nichts zu bauen."};if(!this.canAfford(n.cost))return{ok:!1,msg:"Nicht genug Geld."};let i=!1;for(let r of n.build)this.road[r]=t,this.zone[r]&&(this.zoneFree[this.zone[r]].delete(r),this.zone[r]=0,this._zoneDirty()),this.world.trees[r]&&(this.world.trees[r]=0,i=!0),this.rubble[r]=0;return this.spend(n.cost),this.afterNetworkChange(),i&&this.emit("treesChanged"),this.emit("zonesChanged"),{ok:!0,cost:n.cost}}afterNetworkChange(){Ks(this),this.dirty.util=this.dirty.coverage=!0,di(this),this.emit("roadsChanged")}_zoneDirty(){this._zoneArr=[null,null,null,null,null]}zoneFreeArray(e){return this._zoneArr[e]||(this._zoneArr[e]=[...this.zoneFree[e]]),this._zoneArr[e]}planZone(e,t){let n=0,i=[];for(let r of e){let a=this.world.terrain[r];a===le.WATER||a===le.ROCK||this.road[r]||this.stationAt[r]||this.bld[r]||this.zone[r]!==t&&(i.push(r),t&&(n+=Bl*this.costMul))}return{cost:n,apply:i,ok:i.length>0}}zoneTiles(e,t){let n=this.planZone(e,t);if(!n.ok)return{ok:!1,msg:"Keine passenden Felder."};if(!this.canAfford(n.cost))return{ok:!1,msg:"Nicht genug Geld."};for(let i of n.apply)this.zone[i]&&this.zoneFree[this.zone[i]].delete(i),this.zone[i]=t,t&&this.zoneFree[t].add(i);return this._zoneDirty(),this.spend(n.cost),this.emit("zonesChanged"),{ok:!0,cost:n.cost}}footprint(e,t){let n=nt[e],[i,r]=n.size;return t%2===1&&([i,r]=[r,i]),[i,r]}buildingCost(e){let t=nt[e],n=t.cost*this.costMul;return t.landmark&&this.landmarkVouchers.has(e)&&(n*=.5),t.cat==="parks"&&this.eff("parkFree")>0&&(n=0),Math.round(n)}checkPlace(e,t,n,i=0){let r=nt[e];if(!r)return"Unbekannt";if(!this.isUnlocked(e))return this.lockReason(e);if(e==="station")return this.transit.canPlaceStation(t,n);if(r.unique&&this.hasBuilt(e))return"Gibt es schon in deiner Stadt";let[a,o]=this.footprint(e,i),{W:l,H:c}=this;for(let d=n;d<n+o;d++)for(let p=t;p<t+a;p++){if(p<0||d<0||p>=l||d>=c)return"Au\xDFerhalb der Karte";let g=d*l+p,x=this.world.terrain[g];if(x===le.WATER)return"Nicht auf dem Wasser";if(x===le.ROCK)return"Nicht auf Fels";if(this.road[g])return"Stra\xDFe im Weg";if(this.bld[g])return"Fl\xE4che ist bebaut";if(this.stationAt[g])return"Station im Weg"}let h=!1,u=!1;for(let d=n-1;d<=n+o;d++)for(let p=t-1;p<=t+a;p++){if(p<0||d<0||p>=l||d>=c||p>=t&&p<t+a&&d>=n&&d<n+o)continue;let x=(p===t-1||p===t+a)&&(d===n-1||d===n+o),m=d*l+p;!x&&this.road[m]&&this.road[m]!==Je.HIGHWAY&&(h=!0),this.world.terrain[m]===le.WATER&&(u=!0)}return r.needsWater&&!u?"Muss direkt am Wasser stehen":h?null:"Braucht eine angrenzende Stra\xDFe"}placeCost(e,t,n,i=0){let r=this.buildingCost(e);if(e==="station")return r;let[a,o]=this.footprint(e,i);for(let l=n;l<n+o;l++)for(let c=t;c<t+a;c++)c>=0&&l>=0&&c<this.W&&l<this.H&&this.world.trees[l*this.W+c]&&(r+=$s*this.costMul);return r}placeBuilding(e,t,n,i=0){let r=this.checkPlace(e,t,n,i);if(r)return{ok:!1,msg:r};let a=this.placeCost(e,t,n,i);if(!this.canAfford(a))return{ok:!1,msg:"Nicht genug Geld."};if(this.spend(a),e==="station"){let d=n*this.W+t;this.zone[d]&&(this.zoneFree[this.zone[d]].delete(d),this.zone[d]=0,this._zoneDirty(),this.emit("zonesChanged")),this.world.trees[d]&&(this.world.trees[d]=0,this.emit("treesChanged"));let p=this.transit.addStation(t,n);return this.emit("transitChanged"),{ok:!0,cost:a,station:p}}let[o,l]=this.footprint(e,i),c=!1,h=!1;for(let d=n;d<n+l;d++)for(let p=t;p<t+o;p++){let g=d*this.W+p;this.world.trees[g]&&(this.world.trees[g]=0,c=!0),this.zone[g]&&(this.zoneFree[this.zone[g]].delete(g),this.zone[g]=0,h=!0),this.rubble[g]=0}h&&(this._zoneDirty(),this.emit("zonesChanged")),c&&this.emit("treesChanged");let u=this.makeBuilding({key:e,zone:0,x:t,y:n,w:o,h:l,level:1});return u.rot=i,nt[e].landmark&&this.landmarkVouchers.delete(e),this.dirty.util=this.dirty.coverage=!0,di(this),Qs(this),this.transit.applyCoverage(),{ok:!0,cost:a,building:u}}makeBuilding({key:e,zone:t,x:n,y:i,w:r,h:a,level:o}){let l={id:this.nextId++,key:e,zone:t,x:n,y:i,w:r,h:a,rot:0,level:o,cap:0,occ:0,variant:Math.floor(this.rng()*1e6),happy:62,age:0,edu:0,commute:16,powered:!1,watered:!1,construct:0,abandoned:!1,abandonedDays:0,burning:0,extinguishAt:0,noPower:0,noWater:0,noRoad:0,unhappyDays:0,upCount:0,spec:null,access:-1,comp:-1,connected:!1,crime:0,transitShare:0,load:0};for(let c=i;c<i+a;c++)for(let h=n;h<n+r;h++)this.bld[c*this.W+h]=l.id;if(t){let c=i*this.W+n,h=this.world.resource[c];t===Ae.IND&&h===Kt.FERTILE?l.spec="farm":t===Ae.IND&&h===Kt.ORE&&(l.spec="mine"),l.cap=tr(l)}return Ga(this,l),this.buildings.set(l.id,l),this.emit("buildingAdded",l),l}spawnZoneBuilding(e,t){this.zoneFree[t].delete(e),this._zoneDirty(),this.world.trees[e]&&(this.world.trees[e]=0,this.emit("treesChanged"));let n=e%this.W,i=e/this.W|0,r=this.makeBuilding({key:"zone",zone:t,x:n,y:i,w:1,h:1,level:1});return this.dirty.util=!0,r}setBuildingLevel(e,t){let n=t>e.level;e.level=t,e.cap=tr(e),e.occ>e.cap&&(e.occ=e.cap),e.construct=n?.35:1,this.emit("buildingRebuilt",e),this.dirty.util=!0}abandonBuilding(e){e.abandoned=!0,e.occ=0,e.abandonedDays=0,e.burning=0,this.emit("buildingUpdated",e),this.dirty.util=!0}removeBuilding(e,t={}){for(let n=e.y;n<e.y+e.h;n++)for(let i=e.x;i<e.x+e.w;i++){let r=n*this.W+i;this.bld[r]=0,t.rubble&&(this.rubble[r]=2),e.zone&&this.zone[r]&&!this.rubble[r]&&this.zoneFree[this.zone[r]].add(r)}this._zoneDirty(),this.buildings.delete(e.id),this.emit("buildingRemoved",e),t.rubble&&this.emit("rubbleChanged"),this.dirty.util=this.dirty.coverage=!0}igniteBuilding(e){if(e.burning||e.abandoned)return;e.burning=this.time,e.extinguishAt=0,this.emit("buildingUpdated",e),!this.traffic.dispatchFire(e)&&this.rng()<.6?this.news("fire","Feuer ausgebrochen \u2013 und keine Feuerwehr in der N\xE4he!","bad",e):this.rng()<.3&&this.news("fire","Feuer gemeldet. Die Feuerwehr ist unterwegs.","info",e)}extinguish(e){e.burning&&(e.extinguishAt=this.time+20,e.burning=0,this.emit("buildingUpdated",e))}planBulldoze(e){let t=new Set,n=[],i=[],r=0,a=0,o=0;for(let l of e)this.bld[l]&&t.add(this.bld[l]),this.road[l]&&this.road[l]!==Je.HIGHWAY&&(n.push(l),a+=wt[this.road[l]].cost*this.costMul*.3),this.stationAt[l]&&i.push(this.stationAt[l]),this.world.trees[l]&&!this.bld[l]&&(r++,o+=$s*this.costMul),this.rubble[l]&&(r+=0);for(let l of t){let c=this.buildings.get(l);c&&!c.zone&&(a+=nt[c.key].cost*this.costMul*.4)}return{blds:[...t],roads:n,stations:i,trees:r,net:o-a,any:t.size+n.length+i.length+r>0}}bulldoze(e){let t=this.planBulldoze(e);if(!t.any){let i=!1;for(let r of e)this.rubble[r]&&(this.rubble[r]=0,i=!0,this.zone[r]&&!this.bld[r]&&this.zoneFree[this.zone[r]].add(r));return i?(this._zoneDirty(),this.emit("rubbleChanged"),{ok:!0,cost:0}):{ok:!1,msg:"Hier gibt es nichts abzurei\xDFen."}}if(t.net>0&&!this.canAfford(t.net))return{ok:!1,msg:"Nicht genug Geld."};for(let i of t.blds){let r=this.buildings.get(i);r&&this.removeBuilding(r)}for(let i of t.stations)this.transit.removeStation(i);t.stations.length&&this.emit("transitChanged");let n=!1;for(let i of e)this.world.trees[i]&&!this.bld[i]&&(this.world.trees[i]=0,n=!0);if(n&&this.emit("treesChanged"),t.roads.length){for(let i of t.roads)this.road[i]=0;this.traffic.clearOnRoad(t.roads),this.afterNetworkChange()}return this.spend(t.net),di(this),this.emit("zonesChanged"),{ok:!0,cost:t.net}}linePlanCost(e,t){return Math.round((Ie.lineCost+this.transit.lineCost(e,t))*this.costMul)}createLine(e,t){if(!this.isUnlocked("transit"))return{ok:!1,msg:this.lockReason("station")};if(e.length<2)return{ok:!1,msg:"Eine Linie braucht mindestens zwei Stationen."};if(t&&e.length<3&&(t=!1),this.transit.lines.length>=this.transit.linesMax)return{ok:!1,msg:"Keine freie Linie. Neue Linien gibt es \xFCber Meilensteine und Wochenkarten."};let n=this.linePlanCost(e,t);if(!this.canAfford(n))return{ok:!1,msg:"Nicht genug Geld."};this.spend(n),this.transit.freeTrains>0&&this.transit.freeTrains--;let r=this.transit.createLine(e,t);return this.afterTransitChange(),{ok:!0,cost:n,line:r}}extendLine(e,t,n){let i=this.transit.lines.find(o=>o.id===e);if(!i)return{ok:!1};if(i.stops.includes(t)&&!(i.stops.length>=3&&(n&&i.stops[i.stops.length-1]===t||!n&&i.stops[0]===t)))return{ok:!1,msg:"Station ist schon auf der Linie."};if(!i.loop&&i.stops.length>=3&&(n&&i.stops[i.stops.length-1]===t||!n&&i.stops[0]===t)){let o=Math.round(this.transit.segLen(i.stops[i.stops.length-1],i.stops[0])*Ie.trackCostPerTile*this.costMul);return this.canAfford(o)?(this.spend(o),i.loop=!0,this.transit.rebuildLine(i),this.transit.changed(),this.afterTransitChange(),{ok:!0,cost:o,closed:!0}):{ok:!1,msg:"Nicht genug Geld."}}let r=n?i.stops[0]:i.stops[i.stops.length-1],a=Math.round(this.transit.segLen(r,t)*Ie.trackCostPerTile*this.costMul);return this.canAfford(a)?(this.spend(a),this.transit.extendLine(i,t,n),this.afterTransitChange(),{ok:!0,cost:a}):{ok:!1,msg:"Nicht genug Geld."}}removeLine(e){this.transit.removeLine(e),this.afterTransitChange()}addTrain(e){let t=this.transit.lines.find(r=>r.id===e);if(!t)return{ok:!1};if(this.transit.trains.filter(r=>r.line===e).length>=6)return{ok:!1,msg:"H\xF6chstens 6 Z\xFCge pro Linie."};let i=0;if(this.transit.freeTrains>0)this.transit.freeTrains--;else{if(i=Math.round(Ie.trainCost*this.costMul),!this.canAfford(i))return{ok:!1,msg:"Nicht genug Geld."};this.spend(i)}return this.transit.addTrainToLine(t),this.afterTransitChange(),{ok:!0,cost:i}}removeTrain(e){let t=this.transit.lines.find(n=>n.id===e);return t?this.transit.removeTrainFromLine(t)?(this.afterTransitChange(),{ok:!0}):{ok:!1,msg:"Jede Linie braucht mindestens einen Zug."}:{ok:!1}}addWagon(e){let t=this.transit.lines.find(r=>r.id===e);if(!t)return{ok:!1};let n=0,i=this.transit.freeWagons>0;return!i&&(n=Math.round(Ie.wagonCost*this.costMul),!this.canAfford(n))?{ok:!1,msg:"Nicht genug Geld."}:this.transit.addWagonToLine(t)?(i?this.transit.freeWagons--:this.spend(n),this.afterTransitChange(),{ok:!0,cost:n}):{ok:!1,msg:"Alle Z\xFCge haben schon 3 Waggons."}}afterTransitChange(){this.transit.applyCoverage(),this.emit("transitChanged")}setTax(e,t){this.taxes[e]=ve(Math.round(t),0,25),this.emit("money")}togglePolicy(e){let t=Pi.find(n=>n.id===e);return!t||!this.sandbox&&this.milestone<t.unlock?!1:(this.policies.has(e)?this.policies.delete(e):this.policies.add(e),this.dirty.coverage=this.dirty.util=!0,this.emit("policies"),!0)}takeLoan(e){let t=Xs[e];return!t||this.loans.length>=3?!1:(this.loans.push({amount:t.amount,weeks:t.weeks,weeksLeft:t.weeks,rate:t.rate,weekly:t.amount*t.rate}),this.money+=t.amount,this.emit("money"),!0)}repayLoan(e){let t=this.loans[e];if(!t)return!1;let n=t.amount/t.weeks*t.weeksLeft;return this.canAfford(n)?(this.money-=n,this.loans.splice(e,1),this.emit("money"),!0):!1}chooseCard(e){rc(this,e)}resolveEvent(e){oc(this,e)}news(e,t,n="info",i=null){this.pushNews({kind:e,author:"Stadtfunk",text:t,mood:n,x:i?i.x:void 0,y:i?i.y:void 0})}pushNews(e){e.time=this.time,this.newsLog.push(e),this.newsLog.length>80&&this.newsLog.shift(),this.emit("news",e)}update(e){let t=this.blocking?0:Na[this.speed],n=Math.min(e,.1)*t;if(n>0){this.time+=n*48;let i=0;for(;this.time>=this.nextStep&&i++<40&&(this.simStep(10),this.nextStep+=10,!this.blocking););this.time>this.nextStep+60&&(this.nextStep=this.time)}return this.traffic.update(n),this.transit.update(n),n}simStep(e){qa(this),Ya(this),Yl(this),Zl(this,e),this.dirty.util&&(di(this),this.dirty.util=!1),this.transit.spawnPassengers(e);let t=this.nextStep,n=Math.floor(t/60);n!==this.lastHour&&(this.lastHour=n,this.hourly(n%24));let i=Math.floor(t/ui);i!==this.lastDay&&(this.lastDay=i,this.daily(i)),this.emit("step")}hourly(e){di(this),(this.dirty.coverage||e%3===0)&&(Qs(this),this.transit.applyCoverage(),this.dirty.coverage=!1),e%2===0&&er(this),$a(this),this.traffic.hourly(),this.transit.hourly(),Jl(this),e%6===0&&this.pathCache.clear(),this.rng()<.2&&lc(this),this.emit("hour",e)}daily(e){Kl(this),Ql(this),this.transit.daily();let t=!1;for(let h=0;h<this.N;h++)this.rubble[h]&&(this.rubble[h]--,this.rubble[h]||(t=!0,this.zone[h]&&!this.bld[h]&&this.zoneFree[this.zone[h]].add(h)));t&&(this._zoneDirty(),this.emit("rubbleChanged"));let n=this.effects.length;this.effects=this.effects.filter(h=>h.until>this.time),this.effects.length!==n&&this.emit("effects");let i=0,r=0,a=0,o=0,l=0;for(let h of this.buildings.values()){if(h.zone===Ae.RES&&!h.abandoned){let u=h.y*this.W+h.x;i+=this.fields.pollution[u],r+=h.crime,a+=this.cov.health[u],o++}!h.zone&&nt[h.key]?.eduCity&&(l+=nt[h.key].eduCity)}this.stats.pollutionAvg=o?i/o:0,this.stats.crimeAvg=o?r/o:0,this.stats.healthAvg=o?a/o:1,this.stats.eduCity=l;let c=this.stats;this.history.push({d:e,pop:c.pop,money:Math.round(this.money),net:Math.round(this.lastBudget.net),inc:Math.round(this.lastBudget.income),exp:Math.round(this.lastBudget.expense),happy:Math.round(c.happiness),unemp:+(c.unemployment*100).toFixed(1),riders:c.ridersToday,flow:Math.round(c.trafficFlow*100),jobs:Math.round(c.jobs)}),this.history.length>400&&this.history.shift(),jl(this),ac(this),e%7===0&&this.weekly(),this.emit("day",e)}weekly(){ec(this);let e=this.weekIncome-this.weekExpense;this.week()>1&&this.news("report",`Wochenbilanz: ${e>=0?"+":""}${Xe(e)} (Einnahmen ${Xe(this.weekIncome)}, Ausgaben ${Xe(this.weekExpense)}).`,e>=0?"good":"bad"),this.weekIncome=0,this.weekExpense=0,this.milestone>=1&&sc(this),this.emit("week")}budget(){return bs(this)}maxLevelAt(e,t){return Xa(this,e,t)}serialize(){let e=[];for(let t of this.buildings.values())e.push([t.id,t.key,t.zone,t.x,t.y,t.w,t.h,t.rot,t.level,t.occ,t.variant,Math.round(t.happy),t.age,+t.edu.toFixed(3),Math.round(t.commute),+t.construct.toFixed(3),t.abandoned?1:0,t.abandonedDays,t.spec||""]);return{v:1,opts:this.opts,name:this.name,road:vs(this.road),zone:vs(this.zone),rubble:vs(this.rubble),trees:vs(this.world.trees),buildings:e,nextId:this.nextId,time:this.time,money:this.money,speed:this.speed,taxes:this.taxes,policies:[...this.policies],milestone:this.milestone,mods:this.mods,effects:this.effects,loans:this.loans,cardCount:this.cardCount,cardsTaken:this.cardsTaken,vouchers:[...this.landmarkVouchers],nextEventDay:this.nextEventDay,lastEventId:this.lastEventId,debtDays:this.debtDays,history:this.history,news:this.newsLog.slice(-30),transit:this.transit.serialize(),savedAt:Date.now(),pop:this.stats.pop}}static fromSave(e){let t=new s({...e.opts,name:e.name});t.road=ys(e.road,Uint8Array),t.zone=ys(e.zone,Uint8Array),t.rubble=ys(e.rubble,Uint8Array),t.world.trees=ys(e.trees,Uint8Array),t.nextId=e.nextId,t.buildings=new Map,t.bld.fill(0);for(let n of e.buildings){let[i,r,a,o,l,c,h,u,d,p,g,x,m,f,y,v,M,T,E]=n,b={id:i,key:r,zone:a,x:o,y:l,w:c,h,rot:u,level:d,cap:0,occ:p,variant:g,happy:x,age:m,edu:f,commute:y,powered:!1,watered:!1,construct:v,abandoned:!!M,abandonedDays:T,burning:0,extinguishAt:0,noPower:0,noWater:0,noRoad:0,unhappyDays:0,upCount:0,spec:E||null,access:-1,comp:-1,connected:!1,crime:0,transitShare:0,load:0};a&&(b.cap=tr(b));for(let L=l;L<l+h;L++)for(let _=o;_<o+c;_++)t.bld[L*t.W+_]=i;t.buildings.set(i,b)}Object.assign(t,{time:e.time,money:e.money,speed:e.speed||1,taxes:e.taxes,policies:new Set(e.policies),milestone:e.milestone,mods:{...t.mods,...e.mods},effects:e.effects||[],loans:e.loans||[],cardCount:e.cardCount||{},cardsTaken:e.cardsTaken||[],landmarkVouchers:new Set(e.vouchers||[]),nextEventDay:e.nextEventDay||5,lastEventId:e.lastEventId,debtDays:e.debtDays||0,history:e.history||[],newsLog:e.news||[]}),t.nextStep=Math.ceil(t.time/10)*10+10,t.lastHour=Math.floor(t.time/60),t.lastDay=Math.floor(t.time/ui);for(let n=0;n<t.N;n++)t.zone[n]&&!t.bld[n]&&!t.road[n]&&t.zoneFree[t.zone[n]].add(n);return t._zoneDirty(),Ks(t),t.transit.load(e.transit),qa(t),di(t),Qs(t),t.transit.applyCoverage(),er(t),$a(t),Ya(t),t.traffic.rebuildLists(),t.lastBudget=bs(t),t}};function eo(s){let e=s.W,t=s.world.highwayY,n=s.world.highwayEnd%e+1,i=(h,u)=>u*e+h,r=(h,u)=>h>=0&&u>=0&&h<e&&u<s.H,a=(h,u,d,p,g=Je.STREET)=>{if(u===p)for(let x=Math.min(h,d);x<=Math.max(h,d);x++)r(x,u)&&s.buildRoad([i(x,u)],g);else for(let x=Math.min(u,p);x<=Math.max(u,p);x++)r(h,x)&&s.buildRoad([i(h,x)],g)},o=(h,u,d,p,g)=>{let x=[];for(let m=u;m<=p;m++)for(let f=h;f<=d;f++)r(f,m)&&x.push(i(f,m));s.zoneTiles(x,g)},l=(h,u,d)=>{for(let p=0;p<7;p++)for(let[g,x]of[[0,0],[p,0],[-p,0],[0,p],[0,-p],[p,p],[-p,-p]])if(s.placeBuilding(h,u+g,d+x).ok)return!0;return!1},c=Math.min(34,e-n-4);a(n,t,n+c,t,Je.AVENUE);for(let h=n+3;h<=n+c;h+=5)a(h,t-11,h,t+11);for(let h of[-11,-6,6,11])a(n+3,t+h,n+c,t+h);if(l("coal",n+c-6,t+12),l("watertower",n+2,t-2),l("watertower",n+2,t+2),l("landfill",n+9,t+7),l("landfill",n+29,t+7),o(n+4,t-10,n+20,t-1,Ae.RES),o(n+4,t+1,n+14,t+10,Ae.COM),o(n+16,t+1,n+c,t+10,Ae.IND),o(n+22,t-10,n+c,t-1,Ae.RES),l("police",n+14,t-5),l("fire",n+24,t+5),l("clinic",n+9,t+7),l("school",n+18,t-8),l("park",n+6,t-4),l("park",n+27,t-4),l("plaza",n+11,t+2),l("wind",n+c+2,t-6),l("wind",n+c+2,t-9),s.sandbox){l("coal",n+c-14,t+12);for(let[h,u]of[[2,-6],[2,6],[2,-9],[2,9],[c+2,-3],[c+2,3]])l("watertower",n+h,t+u);l("hospital",n+15,t-8)}}var _l="160";var Xu=0,cc=1,qu=2;var Gh=1,bl=2,Nn=3,ai=0,$t=1,Ct=2;var ni=0,ii=1,ts=2,hc=3,uc=4,Yu=5,vi=100,Zu=101,Ku=102,dc=103,fc=104,Ju=200,ju=201,Qu=202,ed=203,No=204,Uo=205,td=206,nd=207,id=208,sd=209,rd=210,ad=211,od=212,ld=213,cd=214,hd=0,ud=1,dd=2,Ur=3,fd=4,pd=5,md=6,gd=7,Wh=0,xd=1,vd=2,si=0,yd=1,_d=2,bd=3,Ml=4,Md=5,wd=6;var Vh=300,ns=301,is=302,Fo=303,zo=304,ua=306,Oo=1e3,yn=1001,Bo=1002,Ot=1003,pc=1004;var to=1005;var jt=1006,Sd=1007;var Si=1008;var ri=1009,Ed=1010,Td=1011,wl=1012,$h=1013,ei=1014,ti=1015,Ls=1016,Xh=1017,qh=1018,bi=1020,Ad=1021,ln=1023,Rd=1024,Cd=1025,Mi=1026,ss=1027,Pd=1028,Yh=1029,Ld=1030,Zh=1031,Kh=1033,no=33776,io=33777,so=33778,ro=33779,mc=35840,gc=35841,xc=35842,vc=35843,Jh=36196,yc=37492,_c=37496,bc=37808,Mc=37809,wc=37810,Sc=37811,Ec=37812,Tc=37813,Ac=37814,Rc=37815,Cc=37816,Pc=37817,Lc=37818,Ic=37819,Dc=37820,kc=37821,ao=36492,Nc=36494,Uc=36495,Id=36283,Fc=36284,zc=36285,Oc=36286;var Fr=2300,zr=2301,oo=2302,Bc=2400,Hc=2401,Gc=2402;var jh=3e3,wi=3001,Dd=3200,kd=3201,Qh=0,Nd=1,pn="",ut="srgb",Fn="srgb-linear",Sl="display-p3",da="display-p3-linear",Or="linear",ft="srgb",Br="rec709",Hr="p3";var ki=7680;var Wc=519,Ud=512,Fd=513,zd=514,eu=515,Od=516,Bd=517,Hd=518,Gd=519,Vc=35044,Ci=35048;var $c="300 es",Ho=1035,Un=2e3,Gr=2001,oi=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){if(this._listeners===void 0)return!1;let n=this._listeners;return n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){if(this._listeners===void 0)return;let i=this._listeners[e];if(i!==void 0){let r=i.indexOf(t);r!==-1&&i.splice(r,1)}}dispatchEvent(e){if(this._listeners===void 0)return;let n=this._listeners[e.type];if(n!==void 0){e.target=this;let i=n.slice(0);for(let r=0,a=i.length;r<a;r++)i[r].call(this,e);e.target=null}}},Wt=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];var Nr=Math.PI/180,Go=180/Math.PI;function zs(){let s=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Wt[s&255]+Wt[s>>8&255]+Wt[s>>16&255]+Wt[s>>24&255]+"-"+Wt[e&255]+Wt[e>>8&255]+"-"+Wt[e>>16&15|64]+Wt[e>>24&255]+"-"+Wt[t&63|128]+Wt[t>>8&255]+"-"+Wt[t>>16&255]+Wt[t>>24&255]+Wt[n&255]+Wt[n>>8&255]+Wt[n>>16&255]+Wt[n>>24&255]).toLowerCase()}function nn(s,e,t){return Math.max(e,Math.min(t,s))}function Wd(s,e){return(s%e+e)%e}function lo(s,e,t){return(1-t)*s+t*e}function Xc(s){return(s&s-1)===0&&s!==0}function Wo(s){return Math.pow(2,Math.floor(Math.log(s)/Math.LN2))}function Ms(s,e){switch(e.constructor){case Float32Array:return s;case Uint32Array:return s/4294967295;case Uint16Array:return s/65535;case Uint8Array:return s/255;case Int32Array:return Math.max(s/2147483647,-1);case Int16Array:return Math.max(s/32767,-1);case Int8Array:return Math.max(s/127,-1);default:throw new Error("Invalid component type.")}}function tn(s,e){switch(e.constructor){case Float32Array:return s;case Uint32Array:return Math.round(s*4294967295);case Uint16Array:return Math.round(s*65535);case Uint8Array:return Math.round(s*255);case Int32Array:return Math.round(s*2147483647);case Int16Array:return Math.round(s*32767);case Int8Array:return Math.round(s*127);default:throw new Error("Invalid component type.")}}var Ge=class s{constructor(e=0,t=0){s.prototype.isVector2=!0,this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,n=this.y,i=e.elements;return this.x=i[0]*t+i[3]*n+i[6],this.y=i[1]*t+i[4]*n+i[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(nn(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let n=Math.cos(t),i=Math.sin(t),r=this.x-e.x,a=this.y-e.y;return this.x=r*n-a*i+e.x,this.y=r*i+a*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},qe=class s{constructor(e,t,n,i,r,a,o,l,c){s.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,i,r,a,o,l,c)}set(e,t,n,i,r,a,o,l,c){let h=this.elements;return h[0]=e,h[1]=i,h[2]=o,h[3]=t,h[4]=r,h[5]=l,h[6]=n,h[7]=a,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,i=t.elements,r=this.elements,a=n[0],o=n[3],l=n[6],c=n[1],h=n[4],u=n[7],d=n[2],p=n[5],g=n[8],x=i[0],m=i[3],f=i[6],y=i[1],v=i[4],M=i[7],T=i[2],E=i[5],b=i[8];return r[0]=a*x+o*y+l*T,r[3]=a*m+o*v+l*E,r[6]=a*f+o*M+l*b,r[1]=c*x+h*y+u*T,r[4]=c*m+h*v+u*E,r[7]=c*f+h*M+u*b,r[2]=d*x+p*y+g*T,r[5]=d*m+p*v+g*E,r[8]=d*f+p*M+g*b,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[1],i=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8];return t*a*h-t*o*c-n*r*h+n*o*l+i*r*c-i*a*l}invert(){let e=this.elements,t=e[0],n=e[1],i=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8],u=h*a-o*c,d=o*l-h*r,p=c*r-a*l,g=t*u+n*d+i*p;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);let x=1/g;return e[0]=u*x,e[1]=(i*c-h*n)*x,e[2]=(o*n-i*a)*x,e[3]=d*x,e[4]=(h*t-i*l)*x,e[5]=(i*r-o*t)*x,e[6]=p*x,e[7]=(n*l-c*t)*x,e[8]=(a*t-n*r)*x,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,i,r,a,o){let l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*a+c*o)+a+e,-i*c,i*l,-i*(-c*a+l*o)+o+t,0,0,1),this}scale(e,t){return this.premultiply(co.makeScale(e,t)),this}rotate(e){return this.premultiply(co.makeRotation(-e)),this}translate(e,t){return this.premultiply(co.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,n=e.elements;for(let i=0;i<9;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}},co=new qe;function tu(s){for(let e=s.length-1;e>=0;--e)if(s[e]>=65535)return!0;return!1}function Wr(s){return document.createElementNS("http://www.w3.org/1999/xhtml",s)}function Vd(){let s=Wr("canvas");return s.style.display="block",s}var qc={};function Cs(s){s in qc||(qc[s]=!0,console.warn(s))}var Yc=new qe().set(.8224621,.177538,0,.0331941,.9668058,0,.0170827,.0723974,.9105199),Zc=new qe().set(1.2249401,-.2249404,0,-.0420569,1.0420571,0,-.0196376,-.0786361,1.0982735),rr={[Fn]:{transfer:Or,primaries:Br,toReference:s=>s,fromReference:s=>s},[ut]:{transfer:ft,primaries:Br,toReference:s=>s.convertSRGBToLinear(),fromReference:s=>s.convertLinearToSRGB()},[da]:{transfer:Or,primaries:Hr,toReference:s=>s.applyMatrix3(Zc),fromReference:s=>s.applyMatrix3(Yc)},[Sl]:{transfer:ft,primaries:Hr,toReference:s=>s.convertSRGBToLinear().applyMatrix3(Zc),fromReference:s=>s.applyMatrix3(Yc).convertLinearToSRGB()}},$d=new Set([Fn,da]),rt={enabled:!0,_workingColorSpace:Fn,get workingColorSpace(){return this._workingColorSpace},set workingColorSpace(s){if(!$d.has(s))throw new Error(`Unsupported working color space, "${s}".`);this._workingColorSpace=s},convert:function(s,e,t){if(this.enabled===!1||e===t||!e||!t)return s;let n=rr[e].toReference,i=rr[t].fromReference;return i(n(s))},fromWorkingColorSpace:function(s,e){return this.convert(s,this._workingColorSpace,e)},toWorkingColorSpace:function(s,e){return this.convert(s,e,this._workingColorSpace)},getPrimaries:function(s){return rr[s].primaries},getTransfer:function(s){return s===pn?Or:rr[s].transfer}};function Qi(s){return s<.04045?s*.0773993808:Math.pow(s*.9478672986+.0521327014,2.4)}function ho(s){return s<.0031308?s*12.92:1.055*Math.pow(s,.41666)-.055}var Ni,Vr=class{static getDataURL(e){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let t;if(e instanceof HTMLCanvasElement)t=e;else{Ni===void 0&&(Ni=Wr("canvas")),Ni.width=e.width,Ni.height=e.height;let n=Ni.getContext("2d");e instanceof ImageData?n.putImageData(e,0,0):n.drawImage(e,0,0,e.width,e.height),t=Ni}return t.width>2048||t.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",e),t.toDataURL("image/jpeg",.6)):t.toDataURL("image/png")}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){let t=Wr("canvas");t.width=e.width,t.height=e.height;let n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);let i=n.getImageData(0,0,e.width,e.height),r=i.data;for(let a=0;a<r.length;a++)r[a]=Qi(r[a]/255)*255;return n.putImageData(i,0,0),t}else if(e.data){let t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(Qi(t[n]/255)*255):t[n]=Qi(t[n]);return{data:t,width:e.width,height:e.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}},Xd=0,$r=class{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:Xd++}),this.uuid=zs(),this.data=e,this.version=0}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let n={uuid:this.uuid,url:""},i=this.data;if(i!==null){let r;if(Array.isArray(i)){r=[];for(let a=0,o=i.length;a<o;a++)i[a].isDataTexture?r.push(uo(i[a].image)):r.push(uo(i[a]))}else r=uo(i);n.url=r}return t||(e.images[this.uuid]=n),n}};function uo(s){return typeof HTMLImageElement<"u"&&s instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&s instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&s instanceof ImageBitmap?Vr.getDataURL(s):s.data?{data:Array.from(s.data),width:s.width,height:s.height,type:s.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}var qd=0,cn=class s extends oi{constructor(e=s.DEFAULT_IMAGE,t=s.DEFAULT_MAPPING,n=yn,i=yn,r=jt,a=Si,o=ln,l=ri,c=s.DEFAULT_ANISOTROPY,h=pn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:qd++}),this.uuid=zs(),this.name="",this.source=new $r(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=i,this.magFilter=r,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new Ge(0,0),this.repeat=new Ge(1,1),this.center=new Ge(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new qe,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,typeof h=="string"?this.colorSpace=h:(Cs("THREE.Texture: Property .encoding has been replaced by .colorSpace."),this.colorSpace=h===wi?ut:pn),this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.needsPMREMUpdate=!1}get image(){return this.source.data}set image(e=null){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let n={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==Vh)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Oo:e.x=e.x-Math.floor(e.x);break;case yn:e.x=e.x<0?0:1;break;case Bo:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case Oo:e.y=e.y-Math.floor(e.y);break;case yn:e.y=e.y<0?0:1;break;case Bo:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}get encoding(){return Cs("THREE.Texture: Property .encoding has been replaced by .colorSpace."),this.colorSpace===ut?wi:jh}set encoding(e){Cs("THREE.Texture: Property .encoding has been replaced by .colorSpace."),this.colorSpace=e===wi?ut:pn}};cn.DEFAULT_IMAGE=null;cn.DEFAULT_MAPPING=Vh;cn.DEFAULT_ANISOTROPY=1;var Ut=class s{constructor(e=0,t=0,n=0,i=1){s.prototype.isVector4=!0,this.x=e,this.y=t,this.z=n,this.w=i}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,i){return this.x=e,this.y=t,this.z=n,this.w=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,n=this.y,i=this.z,r=this.w,a=e.elements;return this.x=a[0]*t+a[4]*n+a[8]*i+a[12]*r,this.y=a[1]*t+a[5]*n+a[9]*i+a[13]*r,this.z=a[2]*t+a[6]*n+a[10]*i+a[14]*r,this.w=a[3]*t+a[7]*n+a[11]*i+a[15]*r,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,i,r,l=e.elements,c=l[0],h=l[4],u=l[8],d=l[1],p=l[5],g=l[9],x=l[2],m=l[6],f=l[10];if(Math.abs(h-d)<.01&&Math.abs(u-x)<.01&&Math.abs(g-m)<.01){if(Math.abs(h+d)<.1&&Math.abs(u+x)<.1&&Math.abs(g+m)<.1&&Math.abs(c+p+f-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;let v=(c+1)/2,M=(p+1)/2,T=(f+1)/2,E=(h+d)/4,b=(u+x)/4,L=(g+m)/4;return v>M&&v>T?v<.01?(n=0,i=.707106781,r=.707106781):(n=Math.sqrt(v),i=E/n,r=b/n):M>T?M<.01?(n=.707106781,i=0,r=.707106781):(i=Math.sqrt(M),n=E/i,r=L/i):T<.01?(n=.707106781,i=.707106781,r=0):(r=Math.sqrt(T),n=b/r,i=L/r),this.set(n,i,r,t),this}let y=Math.sqrt((m-g)*(m-g)+(u-x)*(u-x)+(d-h)*(d-h));return Math.abs(y)<.001&&(y=1),this.x=(m-g)/y,this.y=(u-x)/y,this.z=(d-h)/y,this.w=Math.acos((c+p+f-1)/2),this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this.w=Math.max(e.w,Math.min(t.w,this.w)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this.w=Math.max(e,Math.min(t,this.w)),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},Vo=class extends oi{constructor(e=1,t=1,n={}){super(),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=1,this.scissor=new Ut(0,0,e,t),this.scissorTest=!1,this.viewport=new Ut(0,0,e,t);let i={width:e,height:t,depth:1};n.encoding!==void 0&&(Cs("THREE.WebGLRenderTarget: option.encoding has been replaced by option.colorSpace."),n.colorSpace=n.encoding===wi?ut:pn),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:jt,depthBuffer:!0,stencilBuffer:!1,depthTexture:null,samples:0},n),this.texture=new cn(i,n.mapping,n.wrapS,n.wrapT,n.magFilter,n.minFilter,n.format,n.type,n.anisotropy,n.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.flipY=!1,this.texture.generateMipmaps=n.generateMipmaps,this.texture.internalFormat=n.internalFormat,this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.depthTexture=n.depthTexture,this.samples=n.samples}setSize(e,t,n=1){(this.width!==e||this.height!==t||this.depth!==n)&&(this.width=e,this.height=t,this.depth=n,this.texture.image.width=e,this.texture.image.height=t,this.texture.image.depth=n,this.dispose()),this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.texture=e.texture.clone(),this.texture.isRenderTargetTexture=!0;let t=Object.assign({},e.texture.image);return this.texture.source=new $r(t),this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}},zn=class extends Vo{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}},Xr=class extends cn{constructor(e=null,t=1,n=1,i=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=Ot,this.minFilter=Ot,this.wrapR=yn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var $o=class extends cn{constructor(e=null,t=1,n=1,i=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=Ot,this.minFilter=Ot,this.wrapR=yn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var Bt=class{constructor(e=0,t=0,n=0,i=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=i}static slerpFlat(e,t,n,i,r,a,o){let l=n[i+0],c=n[i+1],h=n[i+2],u=n[i+3],d=r[a+0],p=r[a+1],g=r[a+2],x=r[a+3];if(o===0){e[t+0]=l,e[t+1]=c,e[t+2]=h,e[t+3]=u;return}if(o===1){e[t+0]=d,e[t+1]=p,e[t+2]=g,e[t+3]=x;return}if(u!==x||l!==d||c!==p||h!==g){let m=1-o,f=l*d+c*p+h*g+u*x,y=f>=0?1:-1,v=1-f*f;if(v>Number.EPSILON){let T=Math.sqrt(v),E=Math.atan2(T,f*y);m=Math.sin(m*E)/T,o=Math.sin(o*E)/T}let M=o*y;if(l=l*m+d*M,c=c*m+p*M,h=h*m+g*M,u=u*m+x*M,m===1-o){let T=1/Math.sqrt(l*l+c*c+h*h+u*u);l*=T,c*=T,h*=T,u*=T}}e[t]=l,e[t+1]=c,e[t+2]=h,e[t+3]=u}static multiplyQuaternionsFlat(e,t,n,i,r,a){let o=n[i],l=n[i+1],c=n[i+2],h=n[i+3],u=r[a],d=r[a+1],p=r[a+2],g=r[a+3];return e[t]=o*g+h*u+l*p-c*d,e[t+1]=l*g+h*d+c*u-o*p,e[t+2]=c*g+h*p+o*d-l*u,e[t+3]=h*g-o*u-l*d-c*p,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,i){return this._x=e,this._y=t,this._z=n,this._w=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let n=e._x,i=e._y,r=e._z,a=e._order,o=Math.cos,l=Math.sin,c=o(n/2),h=o(i/2),u=o(r/2),d=l(n/2),p=l(i/2),g=l(r/2);switch(a){case"XYZ":this._x=d*h*u+c*p*g,this._y=c*p*u-d*h*g,this._z=c*h*g+d*p*u,this._w=c*h*u-d*p*g;break;case"YXZ":this._x=d*h*u+c*p*g,this._y=c*p*u-d*h*g,this._z=c*h*g-d*p*u,this._w=c*h*u+d*p*g;break;case"ZXY":this._x=d*h*u-c*p*g,this._y=c*p*u+d*h*g,this._z=c*h*g+d*p*u,this._w=c*h*u-d*p*g;break;case"ZYX":this._x=d*h*u-c*p*g,this._y=c*p*u+d*h*g,this._z=c*h*g-d*p*u,this._w=c*h*u+d*p*g;break;case"YZX":this._x=d*h*u+c*p*g,this._y=c*p*u+d*h*g,this._z=c*h*g-d*p*u,this._w=c*h*u-d*p*g;break;case"XZY":this._x=d*h*u-c*p*g,this._y=c*p*u-d*h*g,this._z=c*h*g+d*p*u,this._w=c*h*u+d*p*g;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let n=t/2,i=Math.sin(n);return this._x=e.x*i,this._y=e.y*i,this._z=e.z*i,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,n=t[0],i=t[4],r=t[8],a=t[1],o=t[5],l=t[9],c=t[2],h=t[6],u=t[10],d=n+o+u;if(d>0){let p=.5/Math.sqrt(d+1);this._w=.25/p,this._x=(h-l)*p,this._y=(r-c)*p,this._z=(a-i)*p}else if(n>o&&n>u){let p=2*Math.sqrt(1+n-o-u);this._w=(h-l)/p,this._x=.25*p,this._y=(i+a)/p,this._z=(r+c)/p}else if(o>u){let p=2*Math.sqrt(1+o-n-u);this._w=(r-c)/p,this._x=(i+a)/p,this._y=.25*p,this._z=(l+h)/p}else{let p=2*Math.sqrt(1+u-n-o);this._w=(a-i)/p,this._x=(r+c)/p,this._y=(l+h)/p,this._z=.25*p}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<Number.EPSILON?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(nn(this.dot(e),-1,1)))}rotateTowards(e,t){let n=this.angleTo(e);if(n===0)return this;let i=Math.min(1,t/n);return this.slerp(e,i),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let n=e._x,i=e._y,r=e._z,a=e._w,o=t._x,l=t._y,c=t._z,h=t._w;return this._x=n*h+a*o+i*c-r*l,this._y=i*h+a*l+r*o-n*c,this._z=r*h+a*c+n*l-i*o,this._w=a*h-n*o-i*l-r*c,this._onChangeCallback(),this}slerp(e,t){if(t===0)return this;if(t===1)return this.copy(e);let n=this._x,i=this._y,r=this._z,a=this._w,o=a*e._w+n*e._x+i*e._y+r*e._z;if(o<0?(this._w=-e._w,this._x=-e._x,this._y=-e._y,this._z=-e._z,o=-o):this.copy(e),o>=1)return this._w=a,this._x=n,this._y=i,this._z=r,this;let l=1-o*o;if(l<=Number.EPSILON){let p=1-t;return this._w=p*a+t*this._w,this._x=p*n+t*this._x,this._y=p*i+t*this._y,this._z=p*r+t*this._z,this.normalize(),this}let c=Math.sqrt(l),h=Math.atan2(c,o),u=Math.sin((1-t)*h)/c,d=Math.sin(t*h)/c;return this._w=a*u+this._w*d,this._x=n*u+this._x*d,this._y=i*u+this._y*d,this._z=r*u+this._z*d,this._onChangeCallback(),this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){let e=Math.random(),t=Math.sqrt(1-e),n=Math.sqrt(e),i=2*Math.PI*Math.random(),r=2*Math.PI*Math.random();return this.set(t*Math.cos(i),n*Math.sin(r),n*Math.cos(r),t*Math.sin(i))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},k=class s{constructor(e=0,t=0,n=0){s.prototype.isVector3=!0,this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Kc.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Kc.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,n=this.y,i=this.z,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6]*i,this.y=r[1]*t+r[4]*n+r[7]*i,this.z=r[2]*t+r[5]*n+r[8]*i,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,n=this.y,i=this.z,r=e.elements,a=1/(r[3]*t+r[7]*n+r[11]*i+r[15]);return this.x=(r[0]*t+r[4]*n+r[8]*i+r[12])*a,this.y=(r[1]*t+r[5]*n+r[9]*i+r[13])*a,this.z=(r[2]*t+r[6]*n+r[10]*i+r[14])*a,this}applyQuaternion(e){let t=this.x,n=this.y,i=this.z,r=e.x,a=e.y,o=e.z,l=e.w,c=2*(a*i-o*n),h=2*(o*t-r*i),u=2*(r*n-a*t);return this.x=t+l*c+a*u-o*h,this.y=n+l*h+o*c-r*u,this.z=i+l*u+r*h-a*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,n=this.y,i=this.z,r=e.elements;return this.x=r[0]*t+r[4]*n+r[8]*i,this.y=r[1]*t+r[5]*n+r[9]*i,this.z=r[2]*t+r[6]*n+r[10]*i,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let n=e.x,i=e.y,r=e.z,a=t.x,o=t.y,l=t.z;return this.x=i*l-r*o,this.y=r*a-n*l,this.z=n*o-i*a,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return fo.copy(this).projectOnVector(e),this.sub(fo)}reflect(e){return this.sub(fo.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(nn(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y,i=this.z-e.z;return t*t+n*n+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){let i=Math.sin(t)*e;return this.x=i*Math.sin(n),this.y=Math.cos(t)*e,this.z=i*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),i=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=i,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=(Math.random()-.5)*2,t=Math.random()*Math.PI*2,n=Math.sqrt(1-e**2);return this.x=n*Math.cos(t),this.y=n*Math.sin(t),this.z=e,this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},fo=new k,Kc=new Bt,On=class{constructor(e=new k(1/0,1/0,1/0),t=new k(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(mn.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(mn.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=mn.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let n=e.geometry;if(n!==void 0){let r=n.getAttribute("position");if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let a=0,o=r.count;a<o;a++)e.isMesh===!0?e.getVertexPosition(a,mn):mn.fromBufferAttribute(r,a),mn.applyMatrix4(e.matrixWorld),this.expandByPoint(mn);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),ar.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),ar.copy(n.boundingBox)),ar.applyMatrix4(e.matrixWorld),this.union(ar)}let i=e.children;for(let r=0,a=i.length;r<a;r++)this.expandByObject(i[r],t);return this}containsPoint(e){return!(e.x<this.min.x||e.x>this.max.x||e.y<this.min.y||e.y>this.max.y||e.z<this.min.z||e.z>this.max.z)}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return!(e.max.x<this.min.x||e.min.x>this.max.x||e.max.y<this.min.y||e.min.y>this.max.y||e.max.z<this.min.z||e.min.z>this.max.z)}intersectsSphere(e){return this.clampPoint(e.center,mn),mn.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(ws),or.subVectors(this.max,ws),Ui.subVectors(e.a,ws),Fi.subVectors(e.b,ws),zi.subVectors(e.c,ws),Zn.subVectors(Fi,Ui),Kn.subVectors(zi,Fi),fi.subVectors(Ui,zi);let t=[0,-Zn.z,Zn.y,0,-Kn.z,Kn.y,0,-fi.z,fi.y,Zn.z,0,-Zn.x,Kn.z,0,-Kn.x,fi.z,0,-fi.x,-Zn.y,Zn.x,0,-Kn.y,Kn.x,0,-fi.y,fi.x,0];return!po(t,Ui,Fi,zi,or)||(t=[1,0,0,0,1,0,0,0,1],!po(t,Ui,Fi,zi,or))?!1:(lr.crossVectors(Zn,Kn),t=[lr.x,lr.y,lr.z],po(t,Ui,Fi,zi,or))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,mn).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(mn).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(Pn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),Pn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),Pn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),Pn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),Pn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),Pn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),Pn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),Pn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(Pn),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}},Pn=[new k,new k,new k,new k,new k,new k,new k,new k],mn=new k,ar=new On,Ui=new k,Fi=new k,zi=new k,Zn=new k,Kn=new k,fi=new k,ws=new k,or=new k,lr=new k,pi=new k;function po(s,e,t,n,i){for(let r=0,a=s.length-3;r<=a;r+=3){pi.fromArray(s,r);let o=i.x*Math.abs(pi.x)+i.y*Math.abs(pi.y)+i.z*Math.abs(pi.z),l=e.dot(pi),c=t.dot(pi),h=n.dot(pi);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>o)return!1}return!0}var Yd=new On,Ss=new k,mo=new k,Bn=class{constructor(e=new k,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let n=this.center;t!==void 0?n.copy(t):Yd.setFromPoints(e).getCenter(n);let i=0;for(let r=0,a=e.length;r<a;r++)i=Math.max(i,n.distanceToSquared(e[r]));return this.radius=Math.sqrt(i),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Ss.subVectors(e,this.center);let t=Ss.lengthSq();if(t>this.radius*this.radius){let n=Math.sqrt(t),i=(n-this.radius)*.5;this.center.addScaledVector(Ss,i/n),this.radius+=i}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(mo.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Ss.copy(e.center).add(mo)),this.expandByPoint(Ss.copy(e.center).sub(mo))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}},Ln=new k,go=new k,cr=new k,Jn=new k,xo=new k,hr=new k,vo=new k,rs=class{constructor(e=new k,t=new k(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,Ln)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=Ln.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(Ln.copy(this.origin).addScaledVector(this.direction,t),Ln.distanceToSquared(e))}distanceSqToSegment(e,t,n,i){go.copy(e).add(t).multiplyScalar(.5),cr.copy(t).sub(e).normalize(),Jn.copy(this.origin).sub(go);let r=e.distanceTo(t)*.5,a=-this.direction.dot(cr),o=Jn.dot(this.direction),l=-Jn.dot(cr),c=Jn.lengthSq(),h=Math.abs(1-a*a),u,d,p,g;if(h>0)if(u=a*l-o,d=a*o-l,g=r*h,u>=0)if(d>=-g)if(d<=g){let x=1/h;u*=x,d*=x,p=u*(u+a*d+2*o)+d*(a*u+d+2*l)+c}else d=r,u=Math.max(0,-(a*d+o)),p=-u*u+d*(d+2*l)+c;else d=-r,u=Math.max(0,-(a*d+o)),p=-u*u+d*(d+2*l)+c;else d<=-g?(u=Math.max(0,-(-a*r+o)),d=u>0?-r:Math.min(Math.max(-r,-l),r),p=-u*u+d*(d+2*l)+c):d<=g?(u=0,d=Math.min(Math.max(-r,-l),r),p=d*(d+2*l)+c):(u=Math.max(0,-(a*r+o)),d=u>0?r:Math.min(Math.max(-r,-l),r),p=-u*u+d*(d+2*l)+c);else d=a>0?-r:r,u=Math.max(0,-(a*d+o)),p=-u*u+d*(d+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,u),i&&i.copy(go).addScaledVector(cr,d),p}intersectSphere(e,t){Ln.subVectors(e.center,this.origin);let n=Ln.dot(this.direction),i=Ln.dot(Ln)-n*n,r=e.radius*e.radius;if(i>r)return null;let a=Math.sqrt(r-i),o=n-a,l=n+a;return l<0?null:o<0?this.at(l,t):this.at(o,t)}intersectsSphere(e){return this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){let n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,i,r,a,o,l,c=1/this.direction.x,h=1/this.direction.y,u=1/this.direction.z,d=this.origin;return c>=0?(n=(e.min.x-d.x)*c,i=(e.max.x-d.x)*c):(n=(e.max.x-d.x)*c,i=(e.min.x-d.x)*c),h>=0?(r=(e.min.y-d.y)*h,a=(e.max.y-d.y)*h):(r=(e.max.y-d.y)*h,a=(e.min.y-d.y)*h),n>a||r>i||((r>n||isNaN(n))&&(n=r),(a<i||isNaN(i))&&(i=a),u>=0?(o=(e.min.z-d.z)*u,l=(e.max.z-d.z)*u):(o=(e.max.z-d.z)*u,l=(e.min.z-d.z)*u),n>l||o>i)||((o>n||n!==n)&&(n=o),(l<i||i!==i)&&(i=l),i<0)?null:this.at(n>=0?n:i,t)}intersectsBox(e){return this.intersectBox(e,Ln)!==null}intersectTriangle(e,t,n,i,r){xo.subVectors(t,e),hr.subVectors(n,e),vo.crossVectors(xo,hr);let a=this.direction.dot(vo),o;if(a>0){if(i)return null;o=1}else if(a<0)o=-1,a=-a;else return null;Jn.subVectors(this.origin,e);let l=o*this.direction.dot(hr.crossVectors(Jn,hr));if(l<0)return null;let c=o*this.direction.dot(xo.cross(Jn));if(c<0||l+c>a)return null;let h=-o*Jn.dot(vo);return h<0?null:this.at(h/a,r)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},je=class s{constructor(e,t,n,i,r,a,o,l,c,h,u,d,p,g,x,m){s.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,i,r,a,o,l,c,h,u,d,p,g,x,m)}set(e,t,n,i,r,a,o,l,c,h,u,d,p,g,x,m){let f=this.elements;return f[0]=e,f[4]=t,f[8]=n,f[12]=i,f[1]=r,f[5]=a,f[9]=o,f[13]=l,f[2]=c,f[6]=h,f[10]=u,f[14]=d,f[3]=p,f[7]=g,f[11]=x,f[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new s().fromArray(this.elements)}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){let t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){let t=this.elements,n=e.elements,i=1/Oi.setFromMatrixColumn(e,0).length(),r=1/Oi.setFromMatrixColumn(e,1).length(),a=1/Oi.setFromMatrixColumn(e,2).length();return t[0]=n[0]*i,t[1]=n[1]*i,t[2]=n[2]*i,t[3]=0,t[4]=n[4]*r,t[5]=n[5]*r,t[6]=n[6]*r,t[7]=0,t[8]=n[8]*a,t[9]=n[9]*a,t[10]=n[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,n=e.x,i=e.y,r=e.z,a=Math.cos(n),o=Math.sin(n),l=Math.cos(i),c=Math.sin(i),h=Math.cos(r),u=Math.sin(r);if(e.order==="XYZ"){let d=a*h,p=a*u,g=o*h,x=o*u;t[0]=l*h,t[4]=-l*u,t[8]=c,t[1]=p+g*c,t[5]=d-x*c,t[9]=-o*l,t[2]=x-d*c,t[6]=g+p*c,t[10]=a*l}else if(e.order==="YXZ"){let d=l*h,p=l*u,g=c*h,x=c*u;t[0]=d+x*o,t[4]=g*o-p,t[8]=a*c,t[1]=a*u,t[5]=a*h,t[9]=-o,t[2]=p*o-g,t[6]=x+d*o,t[10]=a*l}else if(e.order==="ZXY"){let d=l*h,p=l*u,g=c*h,x=c*u;t[0]=d-x*o,t[4]=-a*u,t[8]=g+p*o,t[1]=p+g*o,t[5]=a*h,t[9]=x-d*o,t[2]=-a*c,t[6]=o,t[10]=a*l}else if(e.order==="ZYX"){let d=a*h,p=a*u,g=o*h,x=o*u;t[0]=l*h,t[4]=g*c-p,t[8]=d*c+x,t[1]=l*u,t[5]=x*c+d,t[9]=p*c-g,t[2]=-c,t[6]=o*l,t[10]=a*l}else if(e.order==="YZX"){let d=a*l,p=a*c,g=o*l,x=o*c;t[0]=l*h,t[4]=x-d*u,t[8]=g*u+p,t[1]=u,t[5]=a*h,t[9]=-o*h,t[2]=-c*h,t[6]=p*u+g,t[10]=d-x*u}else if(e.order==="XZY"){let d=a*l,p=a*c,g=o*l,x=o*c;t[0]=l*h,t[4]=-u,t[8]=c*h,t[1]=d*u+x,t[5]=a*h,t[9]=p*u-g,t[2]=g*u-p,t[6]=o*h,t[10]=x*u+d}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Zd,e,Kd)}lookAt(e,t,n){let i=this.elements;return an.subVectors(e,t),an.lengthSq()===0&&(an.z=1),an.normalize(),jn.crossVectors(n,an),jn.lengthSq()===0&&(Math.abs(n.z)===1?an.x+=1e-4:an.z+=1e-4,an.normalize(),jn.crossVectors(n,an)),jn.normalize(),ur.crossVectors(an,jn),i[0]=jn.x,i[4]=ur.x,i[8]=an.x,i[1]=jn.y,i[5]=ur.y,i[9]=an.y,i[2]=jn.z,i[6]=ur.z,i[10]=an.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,i=t.elements,r=this.elements,a=n[0],o=n[4],l=n[8],c=n[12],h=n[1],u=n[5],d=n[9],p=n[13],g=n[2],x=n[6],m=n[10],f=n[14],y=n[3],v=n[7],M=n[11],T=n[15],E=i[0],b=i[4],L=i[8],_=i[12],w=i[1],U=i[5],H=i[9],K=i[13],I=i[2],C=i[6],P=i[10],N=i[14],F=i[3],z=i[7],G=i[11],Y=i[15];return r[0]=a*E+o*w+l*I+c*F,r[4]=a*b+o*U+l*C+c*z,r[8]=a*L+o*H+l*P+c*G,r[12]=a*_+o*K+l*N+c*Y,r[1]=h*E+u*w+d*I+p*F,r[5]=h*b+u*U+d*C+p*z,r[9]=h*L+u*H+d*P+p*G,r[13]=h*_+u*K+d*N+p*Y,r[2]=g*E+x*w+m*I+f*F,r[6]=g*b+x*U+m*C+f*z,r[10]=g*L+x*H+m*P+f*G,r[14]=g*_+x*K+m*N+f*Y,r[3]=y*E+v*w+M*I+T*F,r[7]=y*b+v*U+M*C+T*z,r[11]=y*L+v*H+M*P+T*G,r[15]=y*_+v*K+M*N+T*Y,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[4],i=e[8],r=e[12],a=e[1],o=e[5],l=e[9],c=e[13],h=e[2],u=e[6],d=e[10],p=e[14],g=e[3],x=e[7],m=e[11],f=e[15];return g*(+r*l*u-i*c*u-r*o*d+n*c*d+i*o*p-n*l*p)+x*(+t*l*p-t*c*d+r*a*d-i*a*p+i*c*h-r*l*h)+m*(+t*c*u-t*o*p-r*a*u+n*a*p+r*o*h-n*c*h)+f*(-i*o*h-t*l*u+t*o*d+i*a*u-n*a*d+n*l*h)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){let i=this.elements;return e.isVector3?(i[12]=e.x,i[13]=e.y,i[14]=e.z):(i[12]=e,i[13]=t,i[14]=n),this}invert(){let e=this.elements,t=e[0],n=e[1],i=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8],u=e[9],d=e[10],p=e[11],g=e[12],x=e[13],m=e[14],f=e[15],y=u*m*c-x*d*c+x*l*p-o*m*p-u*l*f+o*d*f,v=g*d*c-h*m*c-g*l*p+a*m*p+h*l*f-a*d*f,M=h*x*c-g*u*c+g*o*p-a*x*p-h*o*f+a*u*f,T=g*u*l-h*x*l-g*o*d+a*x*d+h*o*m-a*u*m,E=t*y+n*v+i*M+r*T;if(E===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let b=1/E;return e[0]=y*b,e[1]=(x*d*r-u*m*r-x*i*p+n*m*p+u*i*f-n*d*f)*b,e[2]=(o*m*r-x*l*r+x*i*c-n*m*c-o*i*f+n*l*f)*b,e[3]=(u*l*r-o*d*r-u*i*c+n*d*c+o*i*p-n*l*p)*b,e[4]=v*b,e[5]=(h*m*r-g*d*r+g*i*p-t*m*p-h*i*f+t*d*f)*b,e[6]=(g*l*r-a*m*r-g*i*c+t*m*c+a*i*f-t*l*f)*b,e[7]=(a*d*r-h*l*r+h*i*c-t*d*c-a*i*p+t*l*p)*b,e[8]=M*b,e[9]=(g*u*r-h*x*r-g*n*p+t*x*p+h*n*f-t*u*f)*b,e[10]=(a*x*r-g*o*r+g*n*c-t*x*c-a*n*f+t*o*f)*b,e[11]=(h*o*r-a*u*r-h*n*c+t*u*c+a*n*p-t*o*p)*b,e[12]=T*b,e[13]=(h*x*i-g*u*i+g*n*d-t*x*d-h*n*m+t*u*m)*b,e[14]=(g*o*i-a*x*i-g*n*l+t*x*l+a*n*m-t*o*m)*b,e[15]=(a*u*i-h*o*i+h*n*l-t*u*l-a*n*d+t*o*d)*b,this}scale(e){let t=this.elements,n=e.x,i=e.y,r=e.z;return t[0]*=n,t[4]*=i,t[8]*=r,t[1]*=n,t[5]*=i,t[9]*=r,t[2]*=n,t[6]*=i,t[10]*=r,t[3]*=n,t[7]*=i,t[11]*=r,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],i=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,i))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let n=Math.cos(t),i=Math.sin(t),r=1-n,a=e.x,o=e.y,l=e.z,c=r*a,h=r*o;return this.set(c*a+n,c*o-i*l,c*l+i*o,0,c*o+i*l,h*o+n,h*l-i*a,0,c*l-i*o,h*l+i*a,r*l*l+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,i,r,a){return this.set(1,n,r,0,e,1,a,0,t,i,1,0,0,0,0,1),this}compose(e,t,n){let i=this.elements,r=t._x,a=t._y,o=t._z,l=t._w,c=r+r,h=a+a,u=o+o,d=r*c,p=r*h,g=r*u,x=a*h,m=a*u,f=o*u,y=l*c,v=l*h,M=l*u,T=n.x,E=n.y,b=n.z;return i[0]=(1-(x+f))*T,i[1]=(p+M)*T,i[2]=(g-v)*T,i[3]=0,i[4]=(p-M)*E,i[5]=(1-(d+f))*E,i[6]=(m+y)*E,i[7]=0,i[8]=(g+v)*b,i[9]=(m-y)*b,i[10]=(1-(d+x))*b,i[11]=0,i[12]=e.x,i[13]=e.y,i[14]=e.z,i[15]=1,this}decompose(e,t,n){let i=this.elements,r=Oi.set(i[0],i[1],i[2]).length(),a=Oi.set(i[4],i[5],i[6]).length(),o=Oi.set(i[8],i[9],i[10]).length();this.determinant()<0&&(r=-r),e.x=i[12],e.y=i[13],e.z=i[14],gn.copy(this);let c=1/r,h=1/a,u=1/o;return gn.elements[0]*=c,gn.elements[1]*=c,gn.elements[2]*=c,gn.elements[4]*=h,gn.elements[5]*=h,gn.elements[6]*=h,gn.elements[8]*=u,gn.elements[9]*=u,gn.elements[10]*=u,t.setFromRotationMatrix(gn),n.x=r,n.y=a,n.z=o,this}makePerspective(e,t,n,i,r,a,o=Un){let l=this.elements,c=2*r/(t-e),h=2*r/(n-i),u=(t+e)/(t-e),d=(n+i)/(n-i),p,g;if(o===Un)p=-(a+r)/(a-r),g=-2*a*r/(a-r);else if(o===Gr)p=-a/(a-r),g=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return l[0]=c,l[4]=0,l[8]=u,l[12]=0,l[1]=0,l[5]=h,l[9]=d,l[13]=0,l[2]=0,l[6]=0,l[10]=p,l[14]=g,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(e,t,n,i,r,a,o=Un){let l=this.elements,c=1/(t-e),h=1/(n-i),u=1/(a-r),d=(t+e)*c,p=(n+i)*h,g,x;if(o===Un)g=(a+r)*u,x=-2*u;else if(o===Gr)g=r*u,x=-1*u;else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return l[0]=2*c,l[4]=0,l[8]=0,l[12]=-d,l[1]=0,l[5]=2*h,l[9]=0,l[13]=-p,l[2]=0,l[6]=0,l[10]=x,l[14]=-g,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(e){let t=this.elements,n=e.elements;for(let i=0;i<16;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}},Oi=new k,gn=new je,Zd=new k(0,0,0),Kd=new k(1,1,1),jn=new k,ur=new k,an=new k,Jc=new je,jc=new Bt,as=class s{constructor(e=0,t=0,n=0,i=s.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=i}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,i=this._order){return this._x=e,this._y=t,this._z=n,this._order=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){let i=e.elements,r=i[0],a=i[4],o=i[8],l=i[1],c=i[5],h=i[9],u=i[2],d=i[6],p=i[10];switch(t){case"XYZ":this._y=Math.asin(nn(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,p),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(d,c),this._z=0);break;case"YXZ":this._x=Math.asin(-nn(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,p),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-u,r),this._z=0);break;case"ZXY":this._x=Math.asin(nn(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,p),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-nn(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,p),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(nn(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-u,r)):(this._x=0,this._y=Math.atan2(o,p));break;case"XZY":this._z=Math.asin(-nn(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-h,p),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return Jc.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Jc,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return jc.setFromEuler(this),this.setFromQuaternion(jc,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};as.DEFAULT_ORDER="XYZ";var Is=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}},Jd=0,Qc=new k,Bi=new Bt,In=new je,dr=new k,Es=new k,jd=new k,Qd=new Bt,eh=new k(1,0,0),th=new k(0,1,0),nh=new k(0,0,1),ef={type:"added"},tf={type:"removed"},Ht=class s extends oi{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Jd++}),this.uuid=zs(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=s.DEFAULT_UP.clone();let e=new k,t=new as,n=new Bt,i=new k(1,1,1);function r(){n.setFromEuler(t,!1)}function a(){t.setFromQuaternion(n,void 0,!1)}t._onChange(r),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new je},normalMatrix:{value:new qe}}),this.matrix=new je,this.matrixWorld=new je,this.matrixAutoUpdate=s.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=s.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Is,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return Bi.setFromAxisAngle(e,t),this.quaternion.multiply(Bi),this}rotateOnWorldAxis(e,t){return Bi.setFromAxisAngle(e,t),this.quaternion.premultiply(Bi),this}rotateX(e){return this.rotateOnAxis(eh,e)}rotateY(e){return this.rotateOnAxis(th,e)}rotateZ(e){return this.rotateOnAxis(nh,e)}translateOnAxis(e,t){return Qc.copy(e).applyQuaternion(this.quaternion),this.position.add(Qc.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(eh,e)}translateY(e){return this.translateOnAxis(th,e)}translateZ(e){return this.translateOnAxis(nh,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(In.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?dr.copy(e):dr.set(e,t,n);let i=this.parent;this.updateWorldMatrix(!0,!1),Es.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?In.lookAt(Es,dr,this.up):In.lookAt(dr,Es,this.up),this.quaternion.setFromRotationMatrix(In),i&&(In.extractRotation(i.matrixWorld),Bi.setFromRotationMatrix(In),this.quaternion.premultiply(Bi.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.parent!==null&&e.parent.remove(e),e.parent=this,this.children.push(e),e.dispatchEvent(ef)):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(tf)),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),In.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),In.multiply(e.parent.matrixWorld)),e.applyMatrix4(In),this.add(e),e.updateWorldMatrix(!1,!0),this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,i=this.children.length;n<i;n++){let a=this.children[n].getObjectByProperty(e,t);if(a!==void 0)return a}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);let i=this.children;for(let r=0,a=i.length;r<a;r++)i[r].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Es,e,jd),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Es,Qd,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let n=0,i=t.length;n<i;n++){let r=t[n];(r.matrixWorldAutoUpdate===!0||e===!0)&&r.updateMatrixWorld(e)}}updateWorldMatrix(e,t){let n=this.parent;if(e===!0&&n!==null&&n.matrixWorldAutoUpdate===!0&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix),t===!0){let i=this.children;for(let r=0,a=i.length;r<a;r++){let o=i[r];o.matrixWorldAutoUpdate===!0&&o.updateWorldMatrix(!1,!0)}}}toJSON(e){let t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});let i={};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.castShadow===!0&&(i.castShadow=!0),this.receiveShadow===!0&&(i.receiveShadow=!0),this.visible===!1&&(i.visible=!1),this.frustumCulled===!1&&(i.frustumCulled=!1),this.renderOrder!==0&&(i.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(i.userData=this.userData),i.layers=this.layers.mask,i.matrix=this.matrix.toArray(),i.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(i.matrixAutoUpdate=!1),this.isInstancedMesh&&(i.type="InstancedMesh",i.count=this.count,i.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(i.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(i.type="BatchedMesh",i.perObjectFrustumCulled=this.perObjectFrustumCulled,i.sortObjects=this.sortObjects,i.drawRanges=this._drawRanges,i.reservedRanges=this._reservedRanges,i.visibility=this._visibility,i.active=this._active,i.bounds=this._bounds.map(o=>({boxInitialized:o.boxInitialized,boxMin:o.box.min.toArray(),boxMax:o.box.max.toArray(),sphereInitialized:o.sphereInitialized,sphereRadius:o.sphere.radius,sphereCenter:o.sphere.center.toArray()})),i.maxGeometryCount=this._maxGeometryCount,i.maxVertexCount=this._maxVertexCount,i.maxIndexCount=this._maxIndexCount,i.geometryInitialized=this._geometryInitialized,i.geometryCount=this._geometryCount,i.matricesTexture=this._matricesTexture.toJSON(e),this.boundingSphere!==null&&(i.boundingSphere={center:i.boundingSphere.center.toArray(),radius:i.boundingSphere.radius}),this.boundingBox!==null&&(i.boundingBox={min:i.boundingBox.min.toArray(),max:i.boundingBox.max.toArray()}));function r(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?i.background=this.background.toJSON():this.background.isTexture&&(i.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(i.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){i.geometry=r(e.geometries,this.geometry);let o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){let l=o.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){let u=l[c];r(e.shapes,u)}else r(e.shapes,l)}}if(this.isSkinnedMesh&&(i.bindMode=this.bindMode,i.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(e.skeletons,this.skeleton),i.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(r(e.materials,this.material[l]));i.material=o}else i.material=r(e.materials,this.material);if(this.children.length>0){i.children=[];for(let o=0;o<this.children.length;o++)i.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){i.animations=[];for(let o=0;o<this.animations.length;o++){let l=this.animations[o];i.animations.push(r(e.animations,l))}}if(t){let o=a(e.geometries),l=a(e.materials),c=a(e.textures),h=a(e.images),u=a(e.shapes),d=a(e.skeletons),p=a(e.animations),g=a(e.nodes);o.length>0&&(n.geometries=o),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),u.length>0&&(n.shapes=u),d.length>0&&(n.skeletons=d),p.length>0&&(n.animations=p),g.length>0&&(n.nodes=g)}return n.object=i,n;function a(o){let l=[];for(let c in o){let h=o[c];delete h.metadata,l.push(h)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){let i=e.children[n];this.add(i.clone())}return this}};Ht.DEFAULT_UP=new k(0,1,0);Ht.DEFAULT_MATRIX_AUTO_UPDATE=!0;Ht.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var xn=new k,Dn=new k,yo=new k,kn=new k,Hi=new k,Gi=new k,ih=new k,_o=new k,bo=new k,Mo=new k,fr=!1,_i=class s{constructor(e=new k,t=new k,n=new k){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,i){i.subVectors(n,t),xn.subVectors(e,t),i.cross(xn);let r=i.lengthSq();return r>0?i.multiplyScalar(1/Math.sqrt(r)):i.set(0,0,0)}static getBarycoord(e,t,n,i,r){xn.subVectors(i,t),Dn.subVectors(n,t),yo.subVectors(e,t);let a=xn.dot(xn),o=xn.dot(Dn),l=xn.dot(yo),c=Dn.dot(Dn),h=Dn.dot(yo),u=a*c-o*o;if(u===0)return r.set(0,0,0),null;let d=1/u,p=(c*l-o*h)*d,g=(a*h-o*l)*d;return r.set(1-p-g,g,p)}static containsPoint(e,t,n,i){return this.getBarycoord(e,t,n,i,kn)===null?!1:kn.x>=0&&kn.y>=0&&kn.x+kn.y<=1}static getUV(e,t,n,i,r,a,o,l){return fr===!1&&(console.warn("THREE.Triangle.getUV() has been renamed to THREE.Triangle.getInterpolation()."),fr=!0),this.getInterpolation(e,t,n,i,r,a,o,l)}static getInterpolation(e,t,n,i,r,a,o,l){return this.getBarycoord(e,t,n,i,kn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,kn.x),l.addScaledVector(a,kn.y),l.addScaledVector(o,kn.z),l)}static isFrontFacing(e,t,n,i){return xn.subVectors(n,t),Dn.subVectors(e,t),xn.cross(Dn).dot(i)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,i){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[i]),this}setFromAttributeAndIndices(e,t,n,i){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,i),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return xn.subVectors(this.c,this.b),Dn.subVectors(this.a,this.b),xn.cross(Dn).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return s.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return s.getBarycoord(e,this.a,this.b,this.c,t)}getUV(e,t,n,i,r){return fr===!1&&(console.warn("THREE.Triangle.getUV() has been renamed to THREE.Triangle.getInterpolation()."),fr=!0),s.getInterpolation(e,this.a,this.b,this.c,t,n,i,r)}getInterpolation(e,t,n,i,r){return s.getInterpolation(e,this.a,this.b,this.c,t,n,i,r)}containsPoint(e){return s.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return s.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let n=this.a,i=this.b,r=this.c,a,o;Hi.subVectors(i,n),Gi.subVectors(r,n),_o.subVectors(e,n);let l=Hi.dot(_o),c=Gi.dot(_o);if(l<=0&&c<=0)return t.copy(n);bo.subVectors(e,i);let h=Hi.dot(bo),u=Gi.dot(bo);if(h>=0&&u<=h)return t.copy(i);let d=l*u-h*c;if(d<=0&&l>=0&&h<=0)return a=l/(l-h),t.copy(n).addScaledVector(Hi,a);Mo.subVectors(e,r);let p=Hi.dot(Mo),g=Gi.dot(Mo);if(g>=0&&p<=g)return t.copy(r);let x=p*c-l*g;if(x<=0&&c>=0&&g<=0)return o=c/(c-g),t.copy(n).addScaledVector(Gi,o);let m=h*g-p*u;if(m<=0&&u-h>=0&&p-g>=0)return ih.subVectors(r,i),o=(u-h)/(u-h+(p-g)),t.copy(i).addScaledVector(ih,o);let f=1/(m+x+d);return a=x*f,o=d*f,t.copy(n).addScaledVector(Hi,a).addScaledVector(Gi,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},nu={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Qn={h:0,s:0,l:0},pr={h:0,s:0,l:0};function wo(s,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?s+(e-s)*6*t:t<1/2?e:t<2/3?s+(e-s)*6*(2/3-t):s}var ie=class{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){let i=e;i&&i.isColor?this.copy(i):typeof i=="number"?this.setHex(i):typeof i=="string"&&this.setStyle(i)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=ut){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,rt.toWorkingColorSpace(this,t),this}setRGB(e,t,n,i=rt.workingColorSpace){return this.r=e,this.g=t,this.b=n,rt.toWorkingColorSpace(this,i),this}setHSL(e,t,n,i=rt.workingColorSpace){if(e=Wd(e,1),t=nn(t,0,1),n=nn(n,0,1),t===0)this.r=this.g=this.b=n;else{let r=n<=.5?n*(1+t):n+t-n*t,a=2*n-r;this.r=wo(a,r,e+1/3),this.g=wo(a,r,e),this.b=wo(a,r,e-1/3)}return rt.toWorkingColorSpace(this,i),this}setStyle(e,t=ut){function n(r){r!==void 0&&parseFloat(r)<1&&console.warn("THREE.Color: Alpha component of "+e+" will be ignored.")}let i;if(i=/^(\w+)\(([^\)]*)\)/.exec(e)){let r,a=i[1],o=i[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,t);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,t);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,t);break;default:console.warn("THREE.Color: Unknown color model "+e)}}else if(i=/^\#([A-Fa-f\d]+)$/.exec(e)){let r=i[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,t);if(a===6)return this.setHex(parseInt(r,16),t);console.warn("THREE.Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=ut){let n=nu[e.toLowerCase()];return n!==void 0?this.setHex(n,t):console.warn("THREE.Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Qi(e.r),this.g=Qi(e.g),this.b=Qi(e.b),this}copyLinearToSRGB(e){return this.r=ho(e.r),this.g=ho(e.g),this.b=ho(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=ut){return rt.fromWorkingColorSpace(Vt.copy(this),e),Math.round(nn(Vt.r*255,0,255))*65536+Math.round(nn(Vt.g*255,0,255))*256+Math.round(nn(Vt.b*255,0,255))}getHexString(e=ut){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=rt.workingColorSpace){rt.fromWorkingColorSpace(Vt.copy(this),t);let n=Vt.r,i=Vt.g,r=Vt.b,a=Math.max(n,i,r),o=Math.min(n,i,r),l,c,h=(o+a)/2;if(o===a)l=0,c=0;else{let u=a-o;switch(c=h<=.5?u/(a+o):u/(2-a-o),a){case n:l=(i-r)/u+(i<r?6:0);break;case i:l=(r-n)/u+2;break;case r:l=(n-i)/u+4;break}l/=6}return e.h=l,e.s=c,e.l=h,e}getRGB(e,t=rt.workingColorSpace){return rt.fromWorkingColorSpace(Vt.copy(this),t),e.r=Vt.r,e.g=Vt.g,e.b=Vt.b,e}getStyle(e=ut){rt.fromWorkingColorSpace(Vt.copy(this),e);let t=Vt.r,n=Vt.g,i=Vt.b;return e!==ut?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${i.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(i*255)})`}offsetHSL(e,t,n){return this.getHSL(Qn),this.setHSL(Qn.h+e,Qn.s+t,Qn.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(Qn),e.getHSL(pr);let n=lo(Qn.h,pr.h,t),i=lo(Qn.s,pr.s,t),r=lo(Qn.l,pr.l,t);return this.setHSL(n,i,r),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,n=this.g,i=this.b,r=e.elements;return this.r=r[0]*t+r[3]*n+r[6]*i,this.g=r[1]*t+r[4]*n+r[7]*i,this.b=r[2]*t+r[5]*n+r[8]*i,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Vt=new ie;ie.NAMES=nu;var nf=0,Hn=class extends oi{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:nf++}),this.uuid=zs(),this.name="",this.type="Material",this.blending=ii,this.side=ai,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=No,this.blendDst=Uo,this.blendEquation=vi,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new ie(0,0,0),this.blendAlpha=0,this.depthFunc=Ur,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Wc,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=ki,this.stencilZFail=ki,this.stencilZPass=ki,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBuild(){}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let n=e[t];if(n===void 0){console.warn(`THREE.Material: parameter '${t}' has value of undefined.`);continue}let i=this[t];if(i===void 0){console.warn(`THREE.Material: '${t}' is not a property of THREE.${this.type}.`);continue}i&&i.isColor?i.set(n):i&&i.isVector3&&n&&n.isVector3?i.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});let n={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==ii&&(n.blending=this.blending),this.side!==ai&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==No&&(n.blendSrc=this.blendSrc),this.blendDst!==Uo&&(n.blendDst=this.blendDst),this.blendEquation!==vi&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==Ur&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==Wc&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==ki&&(n.stencilFail=this.stencilFail),this.stencilZFail!==ki&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==ki&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function i(r){let a=[];for(let o in r){let l=r[o];delete l.metadata,a.push(l)}return a}if(t){let r=i(e.textures),a=i(e.images);r.length>0&&(n.textures=r),a.length>0&&(n.images=a)}return n}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,n=null;if(t!==null){let i=t.length;n=new Array(i);for(let r=0;r!==i;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}},Xt=class extends Hn{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new ie(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.combine=Wh,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}};var Rt=new k,mr=new Ge,pt=class{constructor(e,t,n=!1){if(Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=Vc,this._updateRange={offset:0,count:-1},this.updateRanges=[],this.gpuType=ti,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}get updateRange(){return console.warn("THREE.BufferAttribute: updateRange() is deprecated and will be removed in r169. Use addUpdateRange() instead."),this._updateRange}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let i=0,r=this.itemSize;i<r;i++)this.array[e+i]=t.array[n+i];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)mr.fromBufferAttribute(this,t),mr.applyMatrix3(e),this.setXY(t,mr.x,mr.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)Rt.fromBufferAttribute(this,t),Rt.applyMatrix3(e),this.setXYZ(t,Rt.x,Rt.y,Rt.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)Rt.fromBufferAttribute(this,t),Rt.applyMatrix4(e),this.setXYZ(t,Rt.x,Rt.y,Rt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Rt.fromBufferAttribute(this,t),Rt.applyNormalMatrix(e),this.setXYZ(t,Rt.x,Rt.y,Rt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Rt.fromBufferAttribute(this,t),Rt.transformDirection(e),this.setXYZ(t,Rt.x,Rt.y,Rt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=Ms(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=tn(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=Ms(t,this.array)),t}setX(e,t){return this.normalized&&(t=tn(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=Ms(t,this.array)),t}setY(e,t){return this.normalized&&(t=tn(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=Ms(t,this.array)),t}setZ(e,t){return this.normalized&&(t=tn(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=Ms(t,this.array)),t}setW(e,t){return this.normalized&&(t=tn(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=tn(t,this.array),n=tn(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,i){return e*=this.itemSize,this.normalized&&(t=tn(t,this.array),n=tn(n,this.array),i=tn(i,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this}setXYZW(e,t,n,i,r){return e*=this.itemSize,this.normalized&&(t=tn(t,this.array),n=tn(n,this.array),i=tn(i,this.array),r=tn(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this.array[e+3]=r,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==Vc&&(e.usage=this.usage),e}};var qr=class extends pt{constructor(e,t,n){super(new Uint16Array(e),t,n)}};var Yr=class extends pt{constructor(e,t,n){super(new Uint32Array(e),t,n)}};var Se=class extends pt{constructor(e,t,n){super(new Float32Array(e),t,n)}};var sf=0,fn=new je,So=new Ht,Wi=new k,on=new On,Ts=new On,Nt=new k,Qe=class s extends oi{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:sf++}),this.uuid=zs(),this.name="",this.type="BufferGeometry",this.index=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(tu(e)?Yr:qr)(e,1):this.index=e,this}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let r=new qe().getNormalMatrix(e);n.applyNormalMatrix(r),n.needsUpdate=!0}let i=this.attributes.tangent;return i!==void 0&&(i.transformDirection(e),i.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(e){return fn.makeRotationFromQuaternion(e),this.applyMatrix4(fn),this}rotateX(e){return fn.makeRotationX(e),this.applyMatrix4(fn),this}rotateY(e){return fn.makeRotationY(e),this.applyMatrix4(fn),this}rotateZ(e){return fn.makeRotationZ(e),this.applyMatrix4(fn),this}translate(e,t,n){return fn.makeTranslation(e,t,n),this.applyMatrix4(fn),this}scale(e,t,n){return fn.makeScale(e,t,n),this.applyMatrix4(fn),this}lookAt(e){return So.lookAt(e),So.updateMatrix(),this.applyMatrix4(So.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Wi).negate(),this.translate(Wi.x,Wi.y,Wi.z),this}setFromPoints(e){let t=[];for(let n=0,i=e.length;n<i;n++){let r=e[n];t.push(r.x,r.y,r.z||0)}return this.setAttribute("position",new Se(t,3)),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new On);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error('THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box. Alternatively set "mesh.frustumCulled" to "false".',this),this.boundingBox.set(new k(-1/0,-1/0,-1/0),new k(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,i=t.length;n<i;n++){let r=t[n];on.setFromBufferAttribute(r),this.morphTargetsRelative?(Nt.addVectors(this.boundingBox.min,on.min),this.boundingBox.expandByPoint(Nt),Nt.addVectors(this.boundingBox.max,on.max),this.boundingBox.expandByPoint(Nt)):(this.boundingBox.expandByPoint(on.min),this.boundingBox.expandByPoint(on.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Bn);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error('THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere. Alternatively set "mesh.frustumCulled" to "false".',this),this.boundingSphere.set(new k,1/0);return}if(e){let n=this.boundingSphere.center;if(on.setFromBufferAttribute(e),t)for(let r=0,a=t.length;r<a;r++){let o=t[r];Ts.setFromBufferAttribute(o),this.morphTargetsRelative?(Nt.addVectors(on.min,Ts.min),on.expandByPoint(Nt),Nt.addVectors(on.max,Ts.max),on.expandByPoint(Nt)):(on.expandByPoint(Ts.min),on.expandByPoint(Ts.max))}on.getCenter(n);let i=0;for(let r=0,a=e.count;r<a;r++)Nt.fromBufferAttribute(e,r),i=Math.max(i,n.distanceToSquared(Nt));if(t)for(let r=0,a=t.length;r<a;r++){let o=t[r],l=this.morphTargetsRelative;for(let c=0,h=o.count;c<h;c++)Nt.fromBufferAttribute(o,c),l&&(Wi.fromBufferAttribute(e,c),Nt.add(Wi)),i=Math.max(i,n.distanceToSquared(Nt))}this.boundingSphere.radius=Math.sqrt(i),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let n=e.array,i=t.position.array,r=t.normal.array,a=t.uv.array,o=i.length/3;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new pt(new Float32Array(4*o),4));let l=this.getAttribute("tangent").array,c=[],h=[];for(let w=0;w<o;w++)c[w]=new k,h[w]=new k;let u=new k,d=new k,p=new k,g=new Ge,x=new Ge,m=new Ge,f=new k,y=new k;function v(w,U,H){u.fromArray(i,w*3),d.fromArray(i,U*3),p.fromArray(i,H*3),g.fromArray(a,w*2),x.fromArray(a,U*2),m.fromArray(a,H*2),d.sub(u),p.sub(u),x.sub(g),m.sub(g);let K=1/(x.x*m.y-m.x*x.y);isFinite(K)&&(f.copy(d).multiplyScalar(m.y).addScaledVector(p,-x.y).multiplyScalar(K),y.copy(p).multiplyScalar(x.x).addScaledVector(d,-m.x).multiplyScalar(K),c[w].add(f),c[U].add(f),c[H].add(f),h[w].add(y),h[U].add(y),h[H].add(y))}let M=this.groups;M.length===0&&(M=[{start:0,count:n.length}]);for(let w=0,U=M.length;w<U;++w){let H=M[w],K=H.start,I=H.count;for(let C=K,P=K+I;C<P;C+=3)v(n[C+0],n[C+1],n[C+2])}let T=new k,E=new k,b=new k,L=new k;function _(w){b.fromArray(r,w*3),L.copy(b);let U=c[w];T.copy(U),T.sub(b.multiplyScalar(b.dot(U))).normalize(),E.crossVectors(L,U);let K=E.dot(h[w])<0?-1:1;l[w*4]=T.x,l[w*4+1]=T.y,l[w*4+2]=T.z,l[w*4+3]=K}for(let w=0,U=M.length;w<U;++w){let H=M[w],K=H.start,I=H.count;for(let C=K,P=K+I;C<P;C+=3)_(n[C+0]),_(n[C+1]),_(n[C+2])}}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new pt(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let d=0,p=n.count;d<p;d++)n.setXYZ(d,0,0,0);let i=new k,r=new k,a=new k,o=new k,l=new k,c=new k,h=new k,u=new k;if(e)for(let d=0,p=e.count;d<p;d+=3){let g=e.getX(d+0),x=e.getX(d+1),m=e.getX(d+2);i.fromBufferAttribute(t,g),r.fromBufferAttribute(t,x),a.fromBufferAttribute(t,m),h.subVectors(a,r),u.subVectors(i,r),h.cross(u),o.fromBufferAttribute(n,g),l.fromBufferAttribute(n,x),c.fromBufferAttribute(n,m),o.add(h),l.add(h),c.add(h),n.setXYZ(g,o.x,o.y,o.z),n.setXYZ(x,l.x,l.y,l.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let d=0,p=t.count;d<p;d+=3)i.fromBufferAttribute(t,d+0),r.fromBufferAttribute(t,d+1),a.fromBufferAttribute(t,d+2),h.subVectors(a,r),u.subVectors(i,r),h.cross(u),n.setXYZ(d+0,h.x,h.y,h.z),n.setXYZ(d+1,h.x,h.y,h.z),n.setXYZ(d+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)Nt.fromBufferAttribute(e,t),Nt.normalize(),e.setXYZ(t,Nt.x,Nt.y,Nt.z)}toNonIndexed(){function e(o,l){let c=o.array,h=o.itemSize,u=o.normalized,d=new c.constructor(l.length*h),p=0,g=0;for(let x=0,m=l.length;x<m;x++){o.isInterleavedBufferAttribute?p=l[x]*o.data.stride+o.offset:p=l[x]*h;for(let f=0;f<h;f++)d[g++]=c[p++]}return new pt(d,h,u)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new s,n=this.index.array,i=this.attributes;for(let o in i){let l=i[o],c=e(l,n);t.setAttribute(o,c)}let r=this.morphAttributes;for(let o in r){let l=[],c=r[o];for(let h=0,u=c.length;h<u;h++){let d=c[h],p=e(d,n);l.push(p)}t.morphAttributes[o]=l}t.morphTargetsRelative=this.morphTargetsRelative;let a=this.groups;for(let o=0,l=a.length;o<l;o++){let c=a[o];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){let e={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let n=this.attributes;for(let l in n){let c=n[l];e.data.attributes[l]=c.toJSON(e.data)}let i={},r=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],h=[];for(let u=0,d=c.length;u<d;u++){let p=c[u];h.push(p.toJSON(e.data))}h.length>0&&(i[l]=h,r=!0)}r&&(e.data.morphAttributes=i,e.data.morphTargetsRelative=this.morphTargetsRelative);let a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));let o=this.boundingSphere;return o!==null&&(e.data.boundingSphere={center:o.center.toArray(),radius:o.radius}),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let n=e.index;n!==null&&this.setIndex(n.clone(t));let i=e.attributes;for(let c in i){let h=i[c];this.setAttribute(c,h.clone(t))}let r=e.morphAttributes;for(let c in r){let h=[],u=r[c];for(let d=0,p=u.length;d<p;d++)h.push(u[d].clone(t));this.morphAttributes[c]=h}this.morphTargetsRelative=e.morphTargetsRelative;let a=e.groups;for(let c=0,h=a.length;c<h;c++){let u=a[c];this.addGroup(u.start,u.count,u.materialIndex)}let o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());let l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}},sh=new je,mi=new rs,gr=new Bn,rh=new k,Vi=new k,$i=new k,Xi=new k,Eo=new k,xr=new k,vr=new Ge,yr=new Ge,_r=new Ge,ah=new k,oh=new k,lh=new k,br=new k,Mr=new k,Re=class extends Ht{constructor(e=new Qe,t=new Xt){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=i.length;r<a;r++){let o=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(e,t){let n=this.geometry,i=n.attributes.position,r=n.morphAttributes.position,a=n.morphTargetsRelative;t.fromBufferAttribute(i,e);let o=this.morphTargetInfluences;if(r&&o){xr.set(0,0,0);for(let l=0,c=r.length;l<c;l++){let h=o[l],u=r[l];h!==0&&(Eo.fromBufferAttribute(u,e),a?xr.addScaledVector(Eo,h):xr.addScaledVector(Eo.sub(t),h))}t.add(xr)}return t}raycast(e,t){let n=this.geometry,i=this.material,r=this.matrixWorld;i!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),gr.copy(n.boundingSphere),gr.applyMatrix4(r),mi.copy(e.ray).recast(e.near),!(gr.containsPoint(mi.origin)===!1&&(mi.intersectSphere(gr,rh)===null||mi.origin.distanceToSquared(rh)>(e.far-e.near)**2))&&(sh.copy(r).invert(),mi.copy(e.ray).applyMatrix4(sh),!(n.boundingBox!==null&&mi.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,mi)))}_computeIntersections(e,t,n){let i,r=this.geometry,a=this.material,o=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,u=r.attributes.normal,d=r.groups,p=r.drawRange;if(o!==null)if(Array.isArray(a))for(let g=0,x=d.length;g<x;g++){let m=d[g],f=a[m.materialIndex],y=Math.max(m.start,p.start),v=Math.min(o.count,Math.min(m.start+m.count,p.start+p.count));for(let M=y,T=v;M<T;M+=3){let E=o.getX(M),b=o.getX(M+1),L=o.getX(M+2);i=wr(this,f,e,n,c,h,u,E,b,L),i&&(i.faceIndex=Math.floor(M/3),i.face.materialIndex=m.materialIndex,t.push(i))}}else{let g=Math.max(0,p.start),x=Math.min(o.count,p.start+p.count);for(let m=g,f=x;m<f;m+=3){let y=o.getX(m),v=o.getX(m+1),M=o.getX(m+2);i=wr(this,a,e,n,c,h,u,y,v,M),i&&(i.faceIndex=Math.floor(m/3),t.push(i))}}else if(l!==void 0)if(Array.isArray(a))for(let g=0,x=d.length;g<x;g++){let m=d[g],f=a[m.materialIndex],y=Math.max(m.start,p.start),v=Math.min(l.count,Math.min(m.start+m.count,p.start+p.count));for(let M=y,T=v;M<T;M+=3){let E=M,b=M+1,L=M+2;i=wr(this,f,e,n,c,h,u,E,b,L),i&&(i.faceIndex=Math.floor(M/3),i.face.materialIndex=m.materialIndex,t.push(i))}}else{let g=Math.max(0,p.start),x=Math.min(l.count,p.start+p.count);for(let m=g,f=x;m<f;m+=3){let y=m,v=m+1,M=m+2;i=wr(this,a,e,n,c,h,u,y,v,M),i&&(i.faceIndex=Math.floor(m/3),t.push(i))}}}};function rf(s,e,t,n,i,r,a,o){let l;if(e.side===$t?l=n.intersectTriangle(a,r,i,!0,o):l=n.intersectTriangle(i,r,a,e.side===ai,o),l===null)return null;Mr.copy(o),Mr.applyMatrix4(s.matrixWorld);let c=t.ray.origin.distanceTo(Mr);return c<t.near||c>t.far?null:{distance:c,point:Mr.clone(),object:s}}function wr(s,e,t,n,i,r,a,o,l,c){s.getVertexPosition(o,Vi),s.getVertexPosition(l,$i),s.getVertexPosition(c,Xi);let h=rf(s,e,t,n,Vi,$i,Xi,br);if(h){i&&(vr.fromBufferAttribute(i,o),yr.fromBufferAttribute(i,l),_r.fromBufferAttribute(i,c),h.uv=_i.getInterpolation(br,Vi,$i,Xi,vr,yr,_r,new Ge)),r&&(vr.fromBufferAttribute(r,o),yr.fromBufferAttribute(r,l),_r.fromBufferAttribute(r,c),h.uv1=_i.getInterpolation(br,Vi,$i,Xi,vr,yr,_r,new Ge),h.uv2=h.uv1),a&&(ah.fromBufferAttribute(a,o),oh.fromBufferAttribute(a,l),lh.fromBufferAttribute(a,c),h.normal=_i.getInterpolation(br,Vi,$i,Xi,ah,oh,lh,new k),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));let u={a:o,b:l,c,normal:new k,materialIndex:0};_i.getNormal(Vi,$i,Xi,u.normal),h.face=u}return h}var at=class s extends Qe{constructor(e=1,t=1,n=1,i=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:i,heightSegments:r,depthSegments:a};let o=this;i=Math.floor(i),r=Math.floor(r),a=Math.floor(a);let l=[],c=[],h=[],u=[],d=0,p=0;g("z","y","x",-1,-1,n,t,e,a,r,0),g("z","y","x",1,-1,n,t,-e,a,r,1),g("x","z","y",1,1,e,n,t,i,a,2),g("x","z","y",1,-1,e,n,-t,i,a,3),g("x","y","z",1,-1,e,t,n,i,r,4),g("x","y","z",-1,-1,e,t,-n,i,r,5),this.setIndex(l),this.setAttribute("position",new Se(c,3)),this.setAttribute("normal",new Se(h,3)),this.setAttribute("uv",new Se(u,2));function g(x,m,f,y,v,M,T,E,b,L,_){let w=M/b,U=T/L,H=M/2,K=T/2,I=E/2,C=b+1,P=L+1,N=0,F=0,z=new k;for(let G=0;G<P;G++){let Y=G*U-K;for(let J=0;J<C;J++){let B=J*w-H;z[x]=B*y,z[m]=Y*v,z[f]=I,c.push(z.x,z.y,z.z),z[x]=0,z[m]=0,z[f]=E>0?1:-1,h.push(z.x,z.y,z.z),u.push(J/b),u.push(1-G/L),N+=1}}for(let G=0;G<L;G++)for(let Y=0;Y<b;Y++){let J=d+Y+C*G,B=d+Y+C*(G+1),Z=d+(Y+1)+C*(G+1),ne=d+(Y+1)+C*G;l.push(J,B,ne),l.push(B,Z,ne),F+=6}o.addGroup(p,F,_),p+=F,d+=N}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}};function os(s){let e={};for(let t in s){e[t]={};for(let n in s[t]){let i=s[t][n];i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)?i.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][n]=null):e[t][n]=i.clone():Array.isArray(i)?e[t][n]=i.slice():e[t][n]=i}}return e}function Jt(s){let e={};for(let t=0;t<s.length;t++){let n=os(s[t]);for(let i in n)e[i]=n[i]}return e}function af(s){let e=[];for(let t=0;t<s.length;t++)e.push(s[t].clone());return e}function iu(s){return s.getRenderTarget()===null?s.outputColorSpace:rt.workingColorSpace}var of={clone:os,merge:Jt},lf=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,cf=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,en=class extends Hn{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=lf,this.fragmentShader=cf,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={derivatives:!1,fragDepth:!1,drawBuffers:!1,shaderTextureLOD:!1,clipCullDistance:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=os(e.uniforms),this.uniformsGroups=af(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let i in this.uniforms){let a=this.uniforms[i].value;a&&a.isTexture?t.uniforms[i]={type:"t",value:a.toJSON(e).uuid}:a&&a.isColor?t.uniforms[i]={type:"c",value:a.getHex()}:a&&a.isVector2?t.uniforms[i]={type:"v2",value:a.toArray()}:a&&a.isVector3?t.uniforms[i]={type:"v3",value:a.toArray()}:a&&a.isVector4?t.uniforms[i]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?t.uniforms[i]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?t.uniforms[i]={type:"m4",value:a.toArray()}:t.uniforms[i]={value:a}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let n={};for(let i in this.extensions)this.extensions[i]===!0&&(n[i]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}},Zr=class extends Ht{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new je,this.projectionMatrix=new je,this.projectionMatrixInverse=new je,this.coordinateSystem=Un}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(e,t){super.updateWorldMatrix(e,t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}},Qt=class extends Zr{constructor(e=50,t=1,n=.1,i=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=i,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=Go*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(Nr*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return Go*2*Math.atan(Math.tan(Nr*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}setViewOffset(e,t,n,i,r,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(Nr*.5*this.fov)/this.zoom,n=2*t,i=this.aspect*n,r=-.5*i,a=this.view;if(this.view!==null&&this.view.enabled){let l=a.fullWidth,c=a.fullHeight;r+=a.offsetX*i/l,t-=a.offsetY*n/c,i*=a.width/l,n*=a.height/c}let o=this.filmOffset;o!==0&&(r+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+i,t,t-n,e,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}},qi=-90,Yi=1,Xo=class extends Ht{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let i=new Qt(qi,Yi,e,t);i.layers=this.layers,this.add(i);let r=new Qt(qi,Yi,e,t);r.layers=this.layers,this.add(r);let a=new Qt(qi,Yi,e,t);a.layers=this.layers,this.add(a);let o=new Qt(qi,Yi,e,t);o.layers=this.layers,this.add(o);let l=new Qt(qi,Yi,e,t);l.layers=this.layers,this.add(l);let c=new Qt(qi,Yi,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[n,i,r,a,o,l]=t;for(let c of t)this.remove(c);if(e===Un)n.up.set(0,1,0),n.lookAt(1,0,0),i.up.set(0,1,0),i.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===Gr)n.up.set(0,-1,0),n.lookAt(-1,0,0),i.up.set(0,-1,0),i.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(let c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:i}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[r,a,o,l,c,h]=this.children,u=e.getRenderTarget(),d=e.getActiveCubeFace(),p=e.getActiveMipmapLevel(),g=e.xr.enabled;e.xr.enabled=!1;let x=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,e.setRenderTarget(n,0,i),e.render(t,r),e.setRenderTarget(n,1,i),e.render(t,a),e.setRenderTarget(n,2,i),e.render(t,o),e.setRenderTarget(n,3,i),e.render(t,l),e.setRenderTarget(n,4,i),e.render(t,c),n.texture.generateMipmaps=x,e.setRenderTarget(n,5,i),e.render(t,h),e.setRenderTarget(u,d,p),e.xr.enabled=g,n.texture.needsPMREMUpdate=!0}},Kr=class extends cn{constructor(e,t,n,i,r,a,o,l,c,h){e=e!==void 0?e:[],t=t!==void 0?t:ns,super(e,t,n,i,r,a,o,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}},qo=class extends zn{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let n={width:e,height:e,depth:1},i=[n,n,n,n,n,n];t.encoding!==void 0&&(Cs("THREE.WebGLCubeRenderTarget: option.encoding has been replaced by option.colorSpace."),t.colorSpace=t.encoding===wi?ut:pn),this.texture=new Kr(i,t.mapping,t.wrapS,t.wrapT,t.magFilter,t.minFilter,t.format,t.type,t.anisotropy,t.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=t.generateMipmaps!==void 0?t.generateMipmaps:!1,this.texture.minFilter=t.minFilter!==void 0?t.minFilter:jt}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},i=new at(5,5,5),r=new en({name:"CubemapFromEquirect",uniforms:os(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:$t,blending:ni});r.uniforms.tEquirect.value=t;let a=new Re(i,r),o=t.minFilter;return t.minFilter===Si&&(t.minFilter=jt),new Xo(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t,n,i){let r=e.getRenderTarget();for(let a=0;a<6;a++)e.setRenderTarget(this,a),e.clear(t,n,i);e.setRenderTarget(r)}},To=new k,hf=new k,uf=new qe,vn=class{constructor(e=new k(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,i){return this.normal.set(e,t,n),this.constant=i,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){let i=To.subVectors(n,t).cross(hf.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(i,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t){let n=e.delta(To),i=this.normal.dot(n);if(i===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let r=-(e.start.dot(this.normal)+this.constant)/i;return r<0||r>1?null:t.copy(e.start).addScaledVector(n,r)}intersectsLine(e){let t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let n=t||uf.getNormalMatrix(e),i=this.coplanarPoint(To).applyMatrix4(e),r=this.normal.applyMatrix3(n).normalize();return this.constant=-i.dot(r),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}},gi=new Bn,Sr=new k,Ds=class{constructor(e=new vn,t=new vn,n=new vn,i=new vn,r=new vn,a=new vn){this.planes=[e,t,n,i,r,a]}set(e,t,n,i,r,a){let o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(i),o[4].copy(r),o[5].copy(a),this}copy(e){let t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=Un){let n=this.planes,i=e.elements,r=i[0],a=i[1],o=i[2],l=i[3],c=i[4],h=i[5],u=i[6],d=i[7],p=i[8],g=i[9],x=i[10],m=i[11],f=i[12],y=i[13],v=i[14],M=i[15];if(n[0].setComponents(l-r,d-c,m-p,M-f).normalize(),n[1].setComponents(l+r,d+c,m+p,M+f).normalize(),n[2].setComponents(l+a,d+h,m+g,M+y).normalize(),n[3].setComponents(l-a,d-h,m-g,M-y).normalize(),n[4].setComponents(l-o,d-u,m-x,M-v).normalize(),t===Un)n[5].setComponents(l+o,d+u,m+x,M+v).normalize();else if(t===Gr)n[5].setComponents(o,u,x,v).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),gi.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),gi.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(gi)}intersectsSprite(e){return gi.center.set(0,0,0),gi.radius=.7071067811865476,gi.applyMatrix4(e.matrixWorld),this.intersectsSphere(gi)}intersectsSphere(e){let t=this.planes,n=e.center,i=-e.radius;for(let r=0;r<6;r++)if(t[r].distanceToPoint(n)<i)return!1;return!0}intersectsBox(e){let t=this.planes;for(let n=0;n<6;n++){let i=t[n];if(Sr.x=i.normal.x>0?e.max.x:e.min.x,Sr.y=i.normal.y>0?e.max.y:e.min.y,Sr.z=i.normal.z>0?e.max.z:e.min.z,i.distanceToPoint(Sr)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};function su(){let s=null,e=!1,t=null,n=null;function i(r,a){t(r,a),n=s.requestAnimationFrame(i)}return{start:function(){e!==!0&&t!==null&&(n=s.requestAnimationFrame(i),e=!0)},stop:function(){s.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(r){t=r},setContext:function(r){s=r}}}function df(s,e){let t=e.isWebGL2,n=new WeakMap;function i(c,h){let u=c.array,d=c.usage,p=u.byteLength,g=s.createBuffer();s.bindBuffer(h,g),s.bufferData(h,u,d),c.onUploadCallback();let x;if(u instanceof Float32Array)x=s.FLOAT;else if(u instanceof Uint16Array)if(c.isFloat16BufferAttribute)if(t)x=s.HALF_FLOAT;else throw new Error("THREE.WebGLAttributes: Usage of Float16BufferAttribute requires WebGL2.");else x=s.UNSIGNED_SHORT;else if(u instanceof Int16Array)x=s.SHORT;else if(u instanceof Uint32Array)x=s.UNSIGNED_INT;else if(u instanceof Int32Array)x=s.INT;else if(u instanceof Int8Array)x=s.BYTE;else if(u instanceof Uint8Array)x=s.UNSIGNED_BYTE;else if(u instanceof Uint8ClampedArray)x=s.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+u);return{buffer:g,type:x,bytesPerElement:u.BYTES_PER_ELEMENT,version:c.version,size:p}}function r(c,h,u){let d=h.array,p=h._updateRange,g=h.updateRanges;if(s.bindBuffer(u,c),p.count===-1&&g.length===0&&s.bufferSubData(u,0,d),g.length!==0){for(let x=0,m=g.length;x<m;x++){let f=g[x];t?s.bufferSubData(u,f.start*d.BYTES_PER_ELEMENT,d,f.start,f.count):s.bufferSubData(u,f.start*d.BYTES_PER_ELEMENT,d.subarray(f.start,f.start+f.count))}h.clearUpdateRanges()}p.count!==-1&&(t?s.bufferSubData(u,p.offset*d.BYTES_PER_ELEMENT,d,p.offset,p.count):s.bufferSubData(u,p.offset*d.BYTES_PER_ELEMENT,d.subarray(p.offset,p.offset+p.count)),p.count=-1),h.onUploadCallback()}function a(c){return c.isInterleavedBufferAttribute&&(c=c.data),n.get(c)}function o(c){c.isInterleavedBufferAttribute&&(c=c.data);let h=n.get(c);h&&(s.deleteBuffer(h.buffer),n.delete(c))}function l(c,h){if(c.isGLBufferAttribute){let d=n.get(c);(!d||d.version<c.version)&&n.set(c,{buffer:c.buffer,type:c.type,bytesPerElement:c.elementSize,version:c.version});return}c.isInterleavedBufferAttribute&&(c=c.data);let u=n.get(c);if(u===void 0)n.set(c,i(c,h));else if(u.version<c.version){if(u.size!==c.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");r(u.buffer,c,h),u.version=c.version}}return{get:a,remove:o,update:l}}var Tn=class s extends Qe{constructor(e=1,t=1,n=1,i=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:i};let r=e/2,a=t/2,o=Math.floor(n),l=Math.floor(i),c=o+1,h=l+1,u=e/o,d=t/l,p=[],g=[],x=[],m=[];for(let f=0;f<h;f++){let y=f*d-a;for(let v=0;v<c;v++){let M=v*u-r;g.push(M,-y,0),x.push(0,0,1),m.push(v/o),m.push(1-f/l)}}for(let f=0;f<l;f++)for(let y=0;y<o;y++){let v=y+c*f,M=y+c*(f+1),T=y+1+c*(f+1),E=y+1+c*f;p.push(v,M,E),p.push(M,T,E)}this.setIndex(p),this.setAttribute("position",new Se(g,3)),this.setAttribute("normal",new Se(x,3)),this.setAttribute("uv",new Se(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.width,e.height,e.widthSegments,e.heightSegments)}},ff=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,pf=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,mf=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,gf=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,xf=`#ifdef USE_ALPHATEST
	if ( diffuseColor.a < alphaTest ) discard;
#endif`,vf=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,yf=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,_f=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,bf=`#ifdef USE_BATCHING
	attribute float batchId;
	uniform highp sampler2D batchingTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,Mf=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( batchId );
#endif`,wf=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Sf=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Ef=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Tf=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,Af=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Rf=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#pragma unroll_loop_start
	for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
		plane = clippingPlanes[ i ];
		if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
	}
	#pragma unroll_loop_end
	#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
		bool clipped = true;
		#pragma unroll_loop_start
		for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
		}
		#pragma unroll_loop_end
		if ( clipped ) discard;
	#endif
#endif`,Cf=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Pf=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Lf=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,If=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,Df=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,kf=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	varying vec3 vColor;
#endif`,Nf=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif`,Uf=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
float luminance( const in vec3 rgb ) {
	const vec3 weights = vec3( 0.2126729, 0.7151522, 0.0721750 );
	return dot( weights, rgb );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Ff=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,zf=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,Of=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Bf=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Hf=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Gf=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Wf="gl_FragColor = linearToOutputTexel( gl_FragColor );",Vf=`
const mat3 LINEAR_SRGB_TO_LINEAR_DISPLAY_P3 = mat3(
	vec3( 0.8224621, 0.177538, 0.0 ),
	vec3( 0.0331941, 0.9668058, 0.0 ),
	vec3( 0.0170827, 0.0723974, 0.9105199 )
);
const mat3 LINEAR_DISPLAY_P3_TO_LINEAR_SRGB = mat3(
	vec3( 1.2249401, - 0.2249404, 0.0 ),
	vec3( - 0.0420569, 1.0420571, 0.0 ),
	vec3( - 0.0196376, - 0.0786361, 1.0982735 )
);
vec4 LinearSRGBToLinearDisplayP3( in vec4 value ) {
	return vec4( value.rgb * LINEAR_SRGB_TO_LINEAR_DISPLAY_P3, value.a );
}
vec4 LinearDisplayP3ToLinearSRGB( in vec4 value ) {
	return vec4( value.rgb * LINEAR_DISPLAY_P3_TO_LINEAR_SRGB, value.a );
}
vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}
vec4 LinearToLinear( in vec4 value ) {
	return value;
}
vec4 LinearTosRGB( in vec4 value ) {
	return sRGBTransferOETF( value );
}`,$f=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,Xf=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,qf=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,Yf=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Zf=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,Kf=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Jf=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,jf=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Qf=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,ep=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,tp=`#ifdef USE_LIGHTMAP
	vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
	vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
	reflectedLight.indirectDiffuse += lightMapIrradiance;
#endif`,np=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,ip=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,sp=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,rp=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	#if defined ( LEGACY_LIGHTS )
		if ( cutoffDistance > 0.0 && decayExponent > 0.0 ) {
			return pow( saturate( - lightDistance / cutoffDistance + 1.0 ), decayExponent );
		}
		return 1.0;
	#else
		float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
		if ( cutoffDistance > 0.0 ) {
			distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
		}
		return distanceFalloff;
	#endif
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,ap=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,op=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,lp=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,cp=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,hp=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,up=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,dp=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,fp=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,pp=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,mp=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,gp=`#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
	gl_FragDepthEXT = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,xp=`#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,vp=`#ifdef USE_LOGDEPTHBUF
	#ifdef USE_LOGDEPTHBUF_EXT
		varying float vFragDepth;
		varying float vIsPerspective;
	#else
		uniform float logDepthBufFC;
	#endif
#endif`,yp=`#ifdef USE_LOGDEPTHBUF
	#ifdef USE_LOGDEPTHBUF_EXT
		vFragDepth = 1.0 + gl_Position.w;
		vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
	#else
		if ( isPerspectiveMatrix( projectionMatrix ) ) {
			gl_Position.z = log2( max( EPSILON, gl_Position.w + 1.0 ) ) * logDepthBufFC - 1.0;
			gl_Position.z *= gl_Position.w;
		}
	#endif
#endif`,_p=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );
	
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,bp=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Mp=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,wp=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Sp=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Ep=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Tp=`#if defined( USE_MORPHCOLORS ) && defined( MORPHTARGETS_TEXTURE )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Ap=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	#ifdef MORPHTARGETS_TEXTURE
		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
			if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
		}
	#else
		objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];
		objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];
		objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];
		objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];
	#endif
#endif`,Rp=`#ifdef USE_MORPHTARGETS
	uniform float morphTargetBaseInfluence;
	#ifdef MORPHTARGETS_TEXTURE
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
		uniform sampler2DArray morphTargetsTexture;
		uniform ivec2 morphTargetsTextureSize;
		vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
			int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
			int y = texelIndex / morphTargetsTextureSize.x;
			int x = texelIndex - y * morphTargetsTextureSize.x;
			ivec3 morphUV = ivec3( x, y, morphTargetIndex );
			return texelFetch( morphTargetsTexture, morphUV, 0 );
		}
	#else
		#ifndef USE_MORPHNORMALS
			uniform float morphTargetInfluences[ 8 ];
		#else
			uniform float morphTargetInfluences[ 4 ];
		#endif
	#endif
#endif`,Cp=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	#ifdef MORPHTARGETS_TEXTURE
		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
			if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
		}
	#else
		transformed += morphTarget0 * morphTargetInfluences[ 0 ];
		transformed += morphTarget1 * morphTargetInfluences[ 1 ];
		transformed += morphTarget2 * morphTargetInfluences[ 2 ];
		transformed += morphTarget3 * morphTargetInfluences[ 3 ];
		#ifndef USE_MORPHNORMALS
			transformed += morphTarget4 * morphTargetInfluences[ 4 ];
			transformed += morphTarget5 * morphTargetInfluences[ 5 ];
			transformed += morphTarget6 * morphTargetInfluences[ 6 ];
			transformed += morphTarget7 * morphTargetInfluences[ 7 ];
		#endif
	#endif
#endif`,Pp=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Lp=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Ip=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Dp=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,kp=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,Np=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Up=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Fp=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,zp=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Op=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Bp=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Hp=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;
const vec3 PackFactors = vec3( 256. * 256. * 256., 256. * 256., 256. );
const vec4 UnpackFactors = UnpackDownscale / vec4( PackFactors, 1. );
const float ShiftRight8 = 1. / 256.;
vec4 packDepthToRGBA( const in float v ) {
	vec4 r = vec4( fract( v * PackFactors ), v );
	r.yzw -= r.xyz * ShiftRight8;	return r * PackUpscale;
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors );
}
vec2 packDepthToRG( in highp float v ) {
	return packDepthToRGBA( v ).yx;
}
float unpackRGToDepth( const in highp vec2 v ) {
	return unpackRGBAToDepth( vec4( v.xy, 0.0, 0.0 ) );
}
vec4 pack2HalfToRGBA( vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,Gp=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Wp=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Vp=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,$p=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Xp=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,qp=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Yp=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return shadow;
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
		vec3 lightToPosition = shadowCoord.xyz;
		float dp = ( length( lightToPosition ) - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );		dp += shadowBias;
		vec3 bd3D = normalize( lightToPosition );
		#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
			vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
			return (
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
			) * ( 1.0 / 9.0 );
		#else
			return texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
		#endif
	}
#endif`,Zp=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,Kp=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,Jp=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,jp=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Qp=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,em=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,tm=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,nm=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,im=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,sm=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,rm=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 OptimizedCineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color *= toneMappingExposure;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	return color;
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,am=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,om=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
		vec3 refractedRayExit = position + transmissionRay;
		vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
		vec2 refractionCoords = ndcPos.xy / ndcPos.w;
		refractionCoords += 1.0;
		refractionCoords /= 2.0;
		vec4 transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
		vec3 transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,lm=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,cm=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,hm=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,um=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,dm=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,fm=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,pm=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,mm=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,gm=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,xm=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,vm=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,ym=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( 1.0 );
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#endif
}`,_m=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,bm=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( 1.0 );
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,Mm=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,wm=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Sm=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Em=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Tm=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,Am=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Rm=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Cm=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Pm=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,Lm=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Im=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,Dm=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), opacity );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,km=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Nm=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Um=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,Fm=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,zm=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Om=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Bm=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,Hm=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Gm=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Wm=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Vm=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
	vec2 scale;
	scale.x = length( vec3( modelMatrix[ 0 ].x, modelMatrix[ 0 ].y, modelMatrix[ 0 ].z ) );
	scale.y = length( vec3( modelMatrix[ 1 ].x, modelMatrix[ 1 ].y, modelMatrix[ 1 ].z ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,$m=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,ze={alphahash_fragment:ff,alphahash_pars_fragment:pf,alphamap_fragment:mf,alphamap_pars_fragment:gf,alphatest_fragment:xf,alphatest_pars_fragment:vf,aomap_fragment:yf,aomap_pars_fragment:_f,batching_pars_vertex:bf,batching_vertex:Mf,begin_vertex:wf,beginnormal_vertex:Sf,bsdfs:Ef,iridescence_fragment:Tf,bumpmap_pars_fragment:Af,clipping_planes_fragment:Rf,clipping_planes_pars_fragment:Cf,clipping_planes_pars_vertex:Pf,clipping_planes_vertex:Lf,color_fragment:If,color_pars_fragment:Df,color_pars_vertex:kf,color_vertex:Nf,common:Uf,cube_uv_reflection_fragment:Ff,defaultnormal_vertex:zf,displacementmap_pars_vertex:Of,displacementmap_vertex:Bf,emissivemap_fragment:Hf,emissivemap_pars_fragment:Gf,colorspace_fragment:Wf,colorspace_pars_fragment:Vf,envmap_fragment:$f,envmap_common_pars_fragment:Xf,envmap_pars_fragment:qf,envmap_pars_vertex:Yf,envmap_physical_pars_fragment:ap,envmap_vertex:Zf,fog_vertex:Kf,fog_pars_vertex:Jf,fog_fragment:jf,fog_pars_fragment:Qf,gradientmap_pars_fragment:ep,lightmap_fragment:tp,lightmap_pars_fragment:np,lights_lambert_fragment:ip,lights_lambert_pars_fragment:sp,lights_pars_begin:rp,lights_toon_fragment:op,lights_toon_pars_fragment:lp,lights_phong_fragment:cp,lights_phong_pars_fragment:hp,lights_physical_fragment:up,lights_physical_pars_fragment:dp,lights_fragment_begin:fp,lights_fragment_maps:pp,lights_fragment_end:mp,logdepthbuf_fragment:gp,logdepthbuf_pars_fragment:xp,logdepthbuf_pars_vertex:vp,logdepthbuf_vertex:yp,map_fragment:_p,map_pars_fragment:bp,map_particle_fragment:Mp,map_particle_pars_fragment:wp,metalnessmap_fragment:Sp,metalnessmap_pars_fragment:Ep,morphcolor_vertex:Tp,morphnormal_vertex:Ap,morphtarget_pars_vertex:Rp,morphtarget_vertex:Cp,normal_fragment_begin:Pp,normal_fragment_maps:Lp,normal_pars_fragment:Ip,normal_pars_vertex:Dp,normal_vertex:kp,normalmap_pars_fragment:Np,clearcoat_normal_fragment_begin:Up,clearcoat_normal_fragment_maps:Fp,clearcoat_pars_fragment:zp,iridescence_pars_fragment:Op,opaque_fragment:Bp,packing:Hp,premultiplied_alpha_fragment:Gp,project_vertex:Wp,dithering_fragment:Vp,dithering_pars_fragment:$p,roughnessmap_fragment:Xp,roughnessmap_pars_fragment:qp,shadowmap_pars_fragment:Yp,shadowmap_pars_vertex:Zp,shadowmap_vertex:Kp,shadowmask_pars_fragment:Jp,skinbase_vertex:jp,skinning_pars_vertex:Qp,skinning_vertex:em,skinnormal_vertex:tm,specularmap_fragment:nm,specularmap_pars_fragment:im,tonemapping_fragment:sm,tonemapping_pars_fragment:rm,transmission_fragment:am,transmission_pars_fragment:om,uv_pars_fragment:lm,uv_pars_vertex:cm,uv_vertex:hm,worldpos_vertex:um,background_vert:dm,background_frag:fm,backgroundCube_vert:pm,backgroundCube_frag:mm,cube_vert:gm,cube_frag:xm,depth_vert:vm,depth_frag:ym,distanceRGBA_vert:_m,distanceRGBA_frag:bm,equirect_vert:Mm,equirect_frag:wm,linedashed_vert:Sm,linedashed_frag:Em,meshbasic_vert:Tm,meshbasic_frag:Am,meshlambert_vert:Rm,meshlambert_frag:Cm,meshmatcap_vert:Pm,meshmatcap_frag:Lm,meshnormal_vert:Im,meshnormal_frag:Dm,meshphong_vert:km,meshphong_frag:Nm,meshphysical_vert:Um,meshphysical_frag:Fm,meshtoon_vert:zm,meshtoon_frag:Om,points_vert:Bm,points_frag:Hm,shadow_vert:Gm,shadow_frag:Wm,sprite_vert:Vm,sprite_frag:$m},re={common:{diffuse:{value:new ie(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new qe},alphaMap:{value:null},alphaMapTransform:{value:new qe},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new qe}},envmap:{envMap:{value:null},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new qe}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new qe}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new qe},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new qe},normalScale:{value:new Ge(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new qe},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new qe}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new qe}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new qe}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new ie(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new ie(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new qe},alphaTest:{value:0},uvTransform:{value:new qe}},sprite:{diffuse:{value:new ie(16777215)},opacity:{value:1},center:{value:new Ge(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new qe},alphaMap:{value:null},alphaMapTransform:{value:new qe},alphaTest:{value:0}}},En={basic:{uniforms:Jt([re.common,re.specularmap,re.envmap,re.aomap,re.lightmap,re.fog]),vertexShader:ze.meshbasic_vert,fragmentShader:ze.meshbasic_frag},lambert:{uniforms:Jt([re.common,re.specularmap,re.envmap,re.aomap,re.lightmap,re.emissivemap,re.bumpmap,re.normalmap,re.displacementmap,re.fog,re.lights,{emissive:{value:new ie(0)}}]),vertexShader:ze.meshlambert_vert,fragmentShader:ze.meshlambert_frag},phong:{uniforms:Jt([re.common,re.specularmap,re.envmap,re.aomap,re.lightmap,re.emissivemap,re.bumpmap,re.normalmap,re.displacementmap,re.fog,re.lights,{emissive:{value:new ie(0)},specular:{value:new ie(1118481)},shininess:{value:30}}]),vertexShader:ze.meshphong_vert,fragmentShader:ze.meshphong_frag},standard:{uniforms:Jt([re.common,re.envmap,re.aomap,re.lightmap,re.emissivemap,re.bumpmap,re.normalmap,re.displacementmap,re.roughnessmap,re.metalnessmap,re.fog,re.lights,{emissive:{value:new ie(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:ze.meshphysical_vert,fragmentShader:ze.meshphysical_frag},toon:{uniforms:Jt([re.common,re.aomap,re.lightmap,re.emissivemap,re.bumpmap,re.normalmap,re.displacementmap,re.gradientmap,re.fog,re.lights,{emissive:{value:new ie(0)}}]),vertexShader:ze.meshtoon_vert,fragmentShader:ze.meshtoon_frag},matcap:{uniforms:Jt([re.common,re.bumpmap,re.normalmap,re.displacementmap,re.fog,{matcap:{value:null}}]),vertexShader:ze.meshmatcap_vert,fragmentShader:ze.meshmatcap_frag},points:{uniforms:Jt([re.points,re.fog]),vertexShader:ze.points_vert,fragmentShader:ze.points_frag},dashed:{uniforms:Jt([re.common,re.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:ze.linedashed_vert,fragmentShader:ze.linedashed_frag},depth:{uniforms:Jt([re.common,re.displacementmap]),vertexShader:ze.depth_vert,fragmentShader:ze.depth_frag},normal:{uniforms:Jt([re.common,re.bumpmap,re.normalmap,re.displacementmap,{opacity:{value:1}}]),vertexShader:ze.meshnormal_vert,fragmentShader:ze.meshnormal_frag},sprite:{uniforms:Jt([re.sprite,re.fog]),vertexShader:ze.sprite_vert,fragmentShader:ze.sprite_frag},background:{uniforms:{uvTransform:{value:new qe},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:ze.background_vert,fragmentShader:ze.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1}},vertexShader:ze.backgroundCube_vert,fragmentShader:ze.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:ze.cube_vert,fragmentShader:ze.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:ze.equirect_vert,fragmentShader:ze.equirect_frag},distanceRGBA:{uniforms:Jt([re.common,re.displacementmap,{referencePosition:{value:new k},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:ze.distanceRGBA_vert,fragmentShader:ze.distanceRGBA_frag},shadow:{uniforms:Jt([re.lights,re.fog,{color:{value:new ie(0)},opacity:{value:1}}]),vertexShader:ze.shadow_vert,fragmentShader:ze.shadow_frag}};En.physical={uniforms:Jt([En.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new qe},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new qe},clearcoatNormalScale:{value:new Ge(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new qe},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new qe},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new qe},sheen:{value:0},sheenColor:{value:new ie(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new qe},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new qe},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new qe},transmissionSamplerSize:{value:new Ge},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new qe},attenuationDistance:{value:0},attenuationColor:{value:new ie(0)},specularColor:{value:new ie(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new qe},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new qe},anisotropyVector:{value:new Ge},anisotropyMap:{value:null},anisotropyMapTransform:{value:new qe}}]),vertexShader:ze.meshphysical_vert,fragmentShader:ze.meshphysical_frag};var Er={r:0,b:0,g:0};function Xm(s,e,t,n,i,r,a){let o=new ie(0),l=r===!0?0:1,c,h,u=null,d=0,p=null;function g(m,f){let y=!1,v=f.isScene===!0?f.background:null;v&&v.isTexture&&(v=(f.backgroundBlurriness>0?t:e).get(v)),v===null?x(o,l):v&&v.isColor&&(x(v,1),y=!0);let M=s.xr.getEnvironmentBlendMode();M==="additive"?n.buffers.color.setClear(0,0,0,1,a):M==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,a),(s.autoClear||y)&&s.clear(s.autoClearColor,s.autoClearDepth,s.autoClearStencil),v&&(v.isCubeTexture||v.mapping===ua)?(h===void 0&&(h=new Re(new at(1,1,1),new en({name:"BackgroundCubeMaterial",uniforms:os(En.backgroundCube.uniforms),vertexShader:En.backgroundCube.vertexShader,fragmentShader:En.backgroundCube.fragmentShader,side:$t,depthTest:!1,depthWrite:!1,fog:!1})),h.geometry.deleteAttribute("normal"),h.geometry.deleteAttribute("uv"),h.onBeforeRender=function(T,E,b){this.matrixWorld.copyPosition(b.matrixWorld)},Object.defineProperty(h.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(h)),h.material.uniforms.envMap.value=v,h.material.uniforms.flipEnvMap.value=v.isCubeTexture&&v.isRenderTargetTexture===!1?-1:1,h.material.uniforms.backgroundBlurriness.value=f.backgroundBlurriness,h.material.uniforms.backgroundIntensity.value=f.backgroundIntensity,h.material.toneMapped=rt.getTransfer(v.colorSpace)!==ft,(u!==v||d!==v.version||p!==s.toneMapping)&&(h.material.needsUpdate=!0,u=v,d=v.version,p=s.toneMapping),h.layers.enableAll(),m.unshift(h,h.geometry,h.material,0,0,null)):v&&v.isTexture&&(c===void 0&&(c=new Re(new Tn(2,2),new en({name:"BackgroundMaterial",uniforms:os(En.background.uniforms),vertexShader:En.background.vertexShader,fragmentShader:En.background.fragmentShader,side:ai,depthTest:!1,depthWrite:!1,fog:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(c)),c.material.uniforms.t2D.value=v,c.material.uniforms.backgroundIntensity.value=f.backgroundIntensity,c.material.toneMapped=rt.getTransfer(v.colorSpace)!==ft,v.matrixAutoUpdate===!0&&v.updateMatrix(),c.material.uniforms.uvTransform.value.copy(v.matrix),(u!==v||d!==v.version||p!==s.toneMapping)&&(c.material.needsUpdate=!0,u=v,d=v.version,p=s.toneMapping),c.layers.enableAll(),m.unshift(c,c.geometry,c.material,0,0,null))}function x(m,f){m.getRGB(Er,iu(s)),n.buffers.color.setClear(Er.r,Er.g,Er.b,f,a)}return{getClearColor:function(){return o},setClearColor:function(m,f=1){o.set(m),l=f,x(o,l)},getClearAlpha:function(){return l},setClearAlpha:function(m){l=m,x(o,l)},render:g}}function qm(s,e,t,n){let i=s.getParameter(s.MAX_VERTEX_ATTRIBS),r=n.isWebGL2?null:e.get("OES_vertex_array_object"),a=n.isWebGL2||r!==null,o={},l=m(null),c=l,h=!1;function u(I,C,P,N,F){let z=!1;if(a){let G=x(N,P,C);c!==G&&(c=G,p(c.object)),z=f(I,N,P,F),z&&y(I,N,P,F)}else{let G=C.wireframe===!0;(c.geometry!==N.id||c.program!==P.id||c.wireframe!==G)&&(c.geometry=N.id,c.program=P.id,c.wireframe=G,z=!0)}F!==null&&t.update(F,s.ELEMENT_ARRAY_BUFFER),(z||h)&&(h=!1,L(I,C,P,N),F!==null&&s.bindBuffer(s.ELEMENT_ARRAY_BUFFER,t.get(F).buffer))}function d(){return n.isWebGL2?s.createVertexArray():r.createVertexArrayOES()}function p(I){return n.isWebGL2?s.bindVertexArray(I):r.bindVertexArrayOES(I)}function g(I){return n.isWebGL2?s.deleteVertexArray(I):r.deleteVertexArrayOES(I)}function x(I,C,P){let N=P.wireframe===!0,F=o[I.id];F===void 0&&(F={},o[I.id]=F);let z=F[C.id];z===void 0&&(z={},F[C.id]=z);let G=z[N];return G===void 0&&(G=m(d()),z[N]=G),G}function m(I){let C=[],P=[],N=[];for(let F=0;F<i;F++)C[F]=0,P[F]=0,N[F]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:C,enabledAttributes:P,attributeDivisors:N,object:I,attributes:{},index:null}}function f(I,C,P,N){let F=c.attributes,z=C.attributes,G=0,Y=P.getAttributes();for(let J in Y)if(Y[J].location>=0){let Z=F[J],ne=z[J];if(ne===void 0&&(J==="instanceMatrix"&&I.instanceMatrix&&(ne=I.instanceMatrix),J==="instanceColor"&&I.instanceColor&&(ne=I.instanceColor)),Z===void 0||Z.attribute!==ne||ne&&Z.data!==ne.data)return!0;G++}return c.attributesNum!==G||c.index!==N}function y(I,C,P,N){let F={},z=C.attributes,G=0,Y=P.getAttributes();for(let J in Y)if(Y[J].location>=0){let Z=z[J];Z===void 0&&(J==="instanceMatrix"&&I.instanceMatrix&&(Z=I.instanceMatrix),J==="instanceColor"&&I.instanceColor&&(Z=I.instanceColor));let ne={};ne.attribute=Z,Z&&Z.data&&(ne.data=Z.data),F[J]=ne,G++}c.attributes=F,c.attributesNum=G,c.index=N}function v(){let I=c.newAttributes;for(let C=0,P=I.length;C<P;C++)I[C]=0}function M(I){T(I,0)}function T(I,C){let P=c.newAttributes,N=c.enabledAttributes,F=c.attributeDivisors;P[I]=1,N[I]===0&&(s.enableVertexAttribArray(I),N[I]=1),F[I]!==C&&((n.isWebGL2?s:e.get("ANGLE_instanced_arrays"))[n.isWebGL2?"vertexAttribDivisor":"vertexAttribDivisorANGLE"](I,C),F[I]=C)}function E(){let I=c.newAttributes,C=c.enabledAttributes;for(let P=0,N=C.length;P<N;P++)C[P]!==I[P]&&(s.disableVertexAttribArray(P),C[P]=0)}function b(I,C,P,N,F,z,G){G===!0?s.vertexAttribIPointer(I,C,P,F,z):s.vertexAttribPointer(I,C,P,N,F,z)}function L(I,C,P,N){if(n.isWebGL2===!1&&(I.isInstancedMesh||N.isInstancedBufferGeometry)&&e.get("ANGLE_instanced_arrays")===null)return;v();let F=N.attributes,z=P.getAttributes(),G=C.defaultAttributeValues;for(let Y in z){let J=z[Y];if(J.location>=0){let B=F[Y];if(B===void 0&&(Y==="instanceMatrix"&&I.instanceMatrix&&(B=I.instanceMatrix),Y==="instanceColor"&&I.instanceColor&&(B=I.instanceColor)),B!==void 0){let Z=B.normalized,ne=B.itemSize,me=t.get(B);if(me===void 0)continue;let fe=me.buffer,Pe=me.type,Ue=me.bytesPerElement,Ee=n.isWebGL2===!0&&(Pe===s.INT||Pe===s.UNSIGNED_INT||B.gpuType===$h);if(B.isInterleavedBufferAttribute){let tt=B.data,W=tt.stride,qt=B.offset;if(tt.isInstancedInterleavedBuffer){for(let _e=0;_e<J.locationSize;_e++)T(J.location+_e,tt.meshPerAttribute);I.isInstancedMesh!==!0&&N._maxInstanceCount===void 0&&(N._maxInstanceCount=tt.meshPerAttribute*tt.count)}else for(let _e=0;_e<J.locationSize;_e++)M(J.location+_e);s.bindBuffer(s.ARRAY_BUFFER,fe);for(let _e=0;_e<J.locationSize;_e++)b(J.location+_e,ne/J.locationSize,Pe,Z,W*Ue,(qt+ne/J.locationSize*_e)*Ue,Ee)}else{if(B.isInstancedBufferAttribute){for(let tt=0;tt<J.locationSize;tt++)T(J.location+tt,B.meshPerAttribute);I.isInstancedMesh!==!0&&N._maxInstanceCount===void 0&&(N._maxInstanceCount=B.meshPerAttribute*B.count)}else for(let tt=0;tt<J.locationSize;tt++)M(J.location+tt);s.bindBuffer(s.ARRAY_BUFFER,fe);for(let tt=0;tt<J.locationSize;tt++)b(J.location+tt,ne/J.locationSize,Pe,Z,ne*Ue,ne/J.locationSize*tt*Ue,Ee)}}else if(G!==void 0){let Z=G[Y];if(Z!==void 0)switch(Z.length){case 2:s.vertexAttrib2fv(J.location,Z);break;case 3:s.vertexAttrib3fv(J.location,Z);break;case 4:s.vertexAttrib4fv(J.location,Z);break;default:s.vertexAttrib1fv(J.location,Z)}}}}E()}function _(){H();for(let I in o){let C=o[I];for(let P in C){let N=C[P];for(let F in N)g(N[F].object),delete N[F];delete C[P]}delete o[I]}}function w(I){if(o[I.id]===void 0)return;let C=o[I.id];for(let P in C){let N=C[P];for(let F in N)g(N[F].object),delete N[F];delete C[P]}delete o[I.id]}function U(I){for(let C in o){let P=o[C];if(P[I.id]===void 0)continue;let N=P[I.id];for(let F in N)g(N[F].object),delete N[F];delete P[I.id]}}function H(){K(),h=!0,c!==l&&(c=l,p(c.object))}function K(){l.geometry=null,l.program=null,l.wireframe=!1}return{setup:u,reset:H,resetDefaultState:K,dispose:_,releaseStatesOfGeometry:w,releaseStatesOfProgram:U,initAttributes:v,enableAttribute:M,disableUnusedAttributes:E}}function Ym(s,e,t,n){let i=n.isWebGL2,r;function a(h){r=h}function o(h,u){s.drawArrays(r,h,u),t.update(u,r,1)}function l(h,u,d){if(d===0)return;let p,g;if(i)p=s,g="drawArraysInstanced";else if(p=e.get("ANGLE_instanced_arrays"),g="drawArraysInstancedANGLE",p===null){console.error("THREE.WebGLBufferRenderer: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.");return}p[g](r,h,u,d),t.update(u,r,d)}function c(h,u,d){if(d===0)return;let p=e.get("WEBGL_multi_draw");if(p===null)for(let g=0;g<d;g++)this.render(h[g],u[g]);else{p.multiDrawArraysWEBGL(r,h,0,u,0,d);let g=0;for(let x=0;x<d;x++)g+=u[x];t.update(g,r,1)}}this.setMode=a,this.render=o,this.renderInstances=l,this.renderMultiDraw=c}function Zm(s,e,t){let n;function i(){if(n!==void 0)return n;if(e.has("EXT_texture_filter_anisotropic")===!0){let b=e.get("EXT_texture_filter_anisotropic");n=s.getParameter(b.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else n=0;return n}function r(b){if(b==="highp"){if(s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.HIGH_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.HIGH_FLOAT).precision>0)return"highp";b="mediump"}return b==="mediump"&&s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.MEDIUM_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let a=typeof WebGL2RenderingContext<"u"&&s.constructor.name==="WebGL2RenderingContext",o=t.precision!==void 0?t.precision:"highp",l=r(o);l!==o&&(console.warn("THREE.WebGLRenderer:",o,"not supported, using",l,"instead."),o=l);let c=a||e.has("WEBGL_draw_buffers"),h=t.logarithmicDepthBuffer===!0,u=s.getParameter(s.MAX_TEXTURE_IMAGE_UNITS),d=s.getParameter(s.MAX_VERTEX_TEXTURE_IMAGE_UNITS),p=s.getParameter(s.MAX_TEXTURE_SIZE),g=s.getParameter(s.MAX_CUBE_MAP_TEXTURE_SIZE),x=s.getParameter(s.MAX_VERTEX_ATTRIBS),m=s.getParameter(s.MAX_VERTEX_UNIFORM_VECTORS),f=s.getParameter(s.MAX_VARYING_VECTORS),y=s.getParameter(s.MAX_FRAGMENT_UNIFORM_VECTORS),v=d>0,M=a||e.has("OES_texture_float"),T=v&&M,E=a?s.getParameter(s.MAX_SAMPLES):0;return{isWebGL2:a,drawBuffers:c,getMaxAnisotropy:i,getMaxPrecision:r,precision:o,logarithmicDepthBuffer:h,maxTextures:u,maxVertexTextures:d,maxTextureSize:p,maxCubemapSize:g,maxAttributes:x,maxVertexUniforms:m,maxVaryings:f,maxFragmentUniforms:y,vertexTextures:v,floatFragmentTextures:M,floatVertexTextures:T,maxSamples:E}}function Km(s){let e=this,t=null,n=0,i=!1,r=!1,a=new vn,o=new qe,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(u,d){let p=u.length!==0||d||n!==0||i;return i=d,n=u.length,p},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(u,d){t=h(u,d,0)},this.setState=function(u,d,p){let g=u.clippingPlanes,x=u.clipIntersection,m=u.clipShadows,f=s.get(u);if(!i||g===null||g.length===0||r&&!m)r?h(null):c();else{let y=r?0:n,v=y*4,M=f.clippingState||null;l.value=M,M=h(g,d,v,p);for(let T=0;T!==v;++T)M[T]=t[T];f.clippingState=M,this.numIntersection=x?this.numPlanes:0,this.numPlanes+=y}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0}function h(u,d,p,g){let x=u!==null?u.length:0,m=null;if(x!==0){if(m=l.value,g!==!0||m===null){let f=p+x*4,y=d.matrixWorldInverse;o.getNormalMatrix(y),(m===null||m.length<f)&&(m=new Float32Array(f));for(let v=0,M=p;v!==x;++v,M+=4)a.copy(u[v]).applyMatrix4(y,o),a.normal.toArray(m,M),m[M+3]=a.constant}l.value=m,l.needsUpdate=!0}return e.numPlanes=x,e.numIntersection=0,m}}function Jm(s){let e=new WeakMap;function t(a,o){return o===Fo?a.mapping=ns:o===zo&&(a.mapping=is),a}function n(a){if(a&&a.isTexture){let o=a.mapping;if(o===Fo||o===zo)if(e.has(a)){let l=e.get(a).texture;return t(l,a.mapping)}else{let l=a.image;if(l&&l.height>0){let c=new qo(l.height/2);return c.fromEquirectangularTexture(s,a),e.set(a,c),a.addEventListener("dispose",i),t(c.texture,a.mapping)}else return null}}return a}function i(a){let o=a.target;o.removeEventListener("dispose",i);let l=e.get(o);l!==void 0&&(e.delete(o),l.dispose())}function r(){e=new WeakMap}return{get:n,dispose:r}}var Jr=class extends Zr{constructor(e=-1,t=1,n=1,i=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=i,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,i,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,i=(this.top+this.bottom)/2,r=n-e,a=n+e,o=i+t,l=i-t;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,a=r+c*this.view.width,o-=h*this.view.offsetY,l=o-h*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,l,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}},Ji=4,ch=[.125,.215,.35,.446,.526,.582],yi=20,Ao=new Jr,hh=new ie,Ro=null,Co=0,Po=0,xi=(1+Math.sqrt(5))/2,Zi=1/xi,uh=[new k(1,1,1),new k(-1,1,1),new k(1,1,-1),new k(-1,1,-1),new k(0,xi,Zi),new k(0,xi,-Zi),new k(Zi,0,xi),new k(-Zi,0,xi),new k(xi,Zi,0),new k(-xi,Zi,0)],jr=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(e,t=0,n=.1,i=100){Ro=this._renderer.getRenderTarget(),Co=this._renderer.getActiveCubeFace(),Po=this._renderer.getActiveMipmapLevel(),this._setSize(256);let r=this._allocateTargets();return r.depthBuffer=!0,this._sceneToCubeUV(e,n,i,r),t>0&&this._blur(r,0,0,t),this._applyPMREM(r),this._cleanup(r),r}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=ph(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=fh(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodPlanes.length;e++)this._lodPlanes[e].dispose()}_cleanup(e){this._renderer.setRenderTarget(Ro,Co,Po),e.scissorTest=!1,Tr(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===ns||e.mapping===is?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),Ro=this._renderer.getRenderTarget(),Co=this._renderer.getActiveCubeFace(),Po=this._renderer.getActiveMipmapLevel();let n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:jt,minFilter:jt,generateMipmaps:!1,type:Ls,format:ln,colorSpace:Fn,depthBuffer:!1},i=dh(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=dh(e,t,n);let{_lodMax:r}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=jm(r)),this._blurMaterial=Qm(r,e,t)}return i}_compileMaterial(e){let t=new Re(this._lodPlanes[0],e);this._renderer.compile(t,Ao)}_sceneToCubeUV(e,t,n,i){let o=new Qt(90,1,t,n),l=[1,-1,1,1,1,1],c=[1,1,1,-1,-1,-1],h=this._renderer,u=h.autoClear,d=h.toneMapping;h.getClearColor(hh),h.toneMapping=si,h.autoClear=!1;let p=new Xt({name:"PMREM.Background",side:$t,depthWrite:!1,depthTest:!1}),g=new Re(new at,p),x=!1,m=e.background;m?m.isColor&&(p.color.copy(m),e.background=null,x=!0):(p.color.copy(hh),x=!0);for(let f=0;f<6;f++){let y=f%3;y===0?(o.up.set(0,l[f],0),o.lookAt(c[f],0,0)):y===1?(o.up.set(0,0,l[f]),o.lookAt(0,c[f],0)):(o.up.set(0,l[f],0),o.lookAt(0,0,c[f]));let v=this._cubeSize;Tr(i,y*v,f>2?v:0,v,v),h.setRenderTarget(i),x&&h.render(g,o),h.render(e,o)}g.geometry.dispose(),g.material.dispose(),h.toneMapping=d,h.autoClear=u,e.background=m}_textureToCubeUV(e,t){let n=this._renderer,i=e.mapping===ns||e.mapping===is;i?(this._cubemapMaterial===null&&(this._cubemapMaterial=ph()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=fh());let r=i?this._cubemapMaterial:this._equirectMaterial,a=new Re(this._lodPlanes[0],r),o=r.uniforms;o.envMap.value=e;let l=this._cubeSize;Tr(t,0,0,3*l,2*l),n.setRenderTarget(t),n.render(a,Ao)}_applyPMREM(e){let t=this._renderer,n=t.autoClear;t.autoClear=!1;for(let i=1;i<this._lodPlanes.length;i++){let r=Math.sqrt(this._sigmas[i]*this._sigmas[i]-this._sigmas[i-1]*this._sigmas[i-1]),a=uh[(i-1)%uh.length];this._blur(e,i-1,i,r,a)}t.autoClear=n}_blur(e,t,n,i,r){let a=this._pingPongRenderTarget;this._halfBlur(e,a,t,n,i,"latitudinal",r),this._halfBlur(a,e,n,n,i,"longitudinal",r)}_halfBlur(e,t,n,i,r,a,o){let l=this._renderer,c=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");let h=3,u=new Re(this._lodPlanes[i],c),d=c.uniforms,p=this._sizeLods[n]-1,g=isFinite(r)?Math.PI/(2*p):2*Math.PI/(2*yi-1),x=r/g,m=isFinite(r)?1+Math.floor(h*x):yi;m>yi&&console.warn(`sigmaRadians, ${r}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${yi}`);let f=[],y=0;for(let b=0;b<yi;++b){let L=b/x,_=Math.exp(-L*L/2);f.push(_),b===0?y+=_:b<m&&(y+=2*_)}for(let b=0;b<f.length;b++)f[b]=f[b]/y;d.envMap.value=e.texture,d.samples.value=m,d.weights.value=f,d.latitudinal.value=a==="latitudinal",o&&(d.poleAxis.value=o);let{_lodMax:v}=this;d.dTheta.value=g,d.mipInt.value=v-n;let M=this._sizeLods[i],T=3*M*(i>v-Ji?i-v+Ji:0),E=4*(this._cubeSize-M);Tr(t,T,E,3*M,2*M),l.setRenderTarget(t),l.render(u,Ao)}};function jm(s){let e=[],t=[],n=[],i=s,r=s-Ji+1+ch.length;for(let a=0;a<r;a++){let o=Math.pow(2,i);t.push(o);let l=1/o;a>s-Ji?l=ch[a-s+Ji-1]:a===0&&(l=0),n.push(l);let c=1/(o-2),h=-c,u=1+c,d=[h,h,u,h,u,u,h,h,u,u,h,u],p=6,g=6,x=3,m=2,f=1,y=new Float32Array(x*g*p),v=new Float32Array(m*g*p),M=new Float32Array(f*g*p);for(let E=0;E<p;E++){let b=E%3*2/3-1,L=E>2?0:-1,_=[b,L,0,b+2/3,L,0,b+2/3,L+1,0,b,L,0,b+2/3,L+1,0,b,L+1,0];y.set(_,x*g*E),v.set(d,m*g*E);let w=[E,E,E,E,E,E];M.set(w,f*g*E)}let T=new Qe;T.setAttribute("position",new pt(y,x)),T.setAttribute("uv",new pt(v,m)),T.setAttribute("faceIndex",new pt(M,f)),e.push(T),i>Ji&&i--}return{lodPlanes:e,sizeLods:t,sigmas:n}}function dh(s,e,t){let n=new zn(s,e,t);return n.texture.mapping=ua,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function Tr(s,e,t,n,i){s.viewport.set(e,t,n,i),s.scissor.set(e,t,n,i)}function Qm(s,e,t){let n=new Float32Array(yi),i=new k(0,1,0);return new en({name:"SphericalGaussianBlur",defines:{n:yi,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${s}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:i}},vertexShader:El(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:ni,depthTest:!1,depthWrite:!1})}function fh(){return new en({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:El(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:ni,depthTest:!1,depthWrite:!1})}function ph(){return new en({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:El(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:ni,depthTest:!1,depthWrite:!1})}function El(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function e0(s){let e=new WeakMap,t=null;function n(o){if(o&&o.isTexture){let l=o.mapping,c=l===Fo||l===zo,h=l===ns||l===is;if(c||h)if(o.isRenderTargetTexture&&o.needsPMREMUpdate===!0){o.needsPMREMUpdate=!1;let u=e.get(o);return t===null&&(t=new jr(s)),u=c?t.fromEquirectangular(o,u):t.fromCubemap(o,u),e.set(o,u),u.texture}else{if(e.has(o))return e.get(o).texture;{let u=o.image;if(c&&u&&u.height>0||h&&u&&i(u)){t===null&&(t=new jr(s));let d=c?t.fromEquirectangular(o):t.fromCubemap(o);return e.set(o,d),o.addEventListener("dispose",r),d.texture}else return null}}}return o}function i(o){let l=0,c=6;for(let h=0;h<c;h++)o[h]!==void 0&&l++;return l===c}function r(o){let l=o.target;l.removeEventListener("dispose",r);let c=e.get(l);c!==void 0&&(e.delete(l),c.dispose())}function a(){e=new WeakMap,t!==null&&(t.dispose(),t=null)}return{get:n,dispose:a}}function t0(s){let e={};function t(n){if(e[n]!==void 0)return e[n];let i;switch(n){case"WEBGL_depth_texture":i=s.getExtension("WEBGL_depth_texture")||s.getExtension("MOZ_WEBGL_depth_texture")||s.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":i=s.getExtension("EXT_texture_filter_anisotropic")||s.getExtension("MOZ_EXT_texture_filter_anisotropic")||s.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":i=s.getExtension("WEBGL_compressed_texture_s3tc")||s.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||s.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":i=s.getExtension("WEBGL_compressed_texture_pvrtc")||s.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:i=s.getExtension(n)}return e[n]=i,i}return{has:function(n){return t(n)!==null},init:function(n){n.isWebGL2?(t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance")):(t("WEBGL_depth_texture"),t("OES_texture_float"),t("OES_texture_half_float"),t("OES_texture_half_float_linear"),t("OES_standard_derivatives"),t("OES_element_index_uint"),t("OES_vertex_array_object"),t("ANGLE_instanced_arrays")),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture")},get:function(n){let i=t(n);return i===null&&console.warn("THREE.WebGLRenderer: "+n+" extension not supported."),i}}}function n0(s,e,t,n){let i={},r=new WeakMap;function a(u){let d=u.target;d.index!==null&&e.remove(d.index);for(let g in d.attributes)e.remove(d.attributes[g]);for(let g in d.morphAttributes){let x=d.morphAttributes[g];for(let m=0,f=x.length;m<f;m++)e.remove(x[m])}d.removeEventListener("dispose",a),delete i[d.id];let p=r.get(d);p&&(e.remove(p),r.delete(d)),n.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,t.memory.geometries--}function o(u,d){return i[d.id]===!0||(d.addEventListener("dispose",a),i[d.id]=!0,t.memory.geometries++),d}function l(u){let d=u.attributes;for(let g in d)e.update(d[g],s.ARRAY_BUFFER);let p=u.morphAttributes;for(let g in p){let x=p[g];for(let m=0,f=x.length;m<f;m++)e.update(x[m],s.ARRAY_BUFFER)}}function c(u){let d=[],p=u.index,g=u.attributes.position,x=0;if(p!==null){let y=p.array;x=p.version;for(let v=0,M=y.length;v<M;v+=3){let T=y[v+0],E=y[v+1],b=y[v+2];d.push(T,E,E,b,b,T)}}else if(g!==void 0){let y=g.array;x=g.version;for(let v=0,M=y.length/3-1;v<M;v+=3){let T=v+0,E=v+1,b=v+2;d.push(T,E,E,b,b,T)}}else return;let m=new(tu(d)?Yr:qr)(d,1);m.version=x;let f=r.get(u);f&&e.remove(f),r.set(u,m)}function h(u){let d=r.get(u);if(d){let p=u.index;p!==null&&d.version<p.version&&c(u)}else c(u);return r.get(u)}return{get:o,update:l,getWireframeAttribute:h}}function i0(s,e,t,n){let i=n.isWebGL2,r;function a(p){r=p}let o,l;function c(p){o=p.type,l=p.bytesPerElement}function h(p,g){s.drawElements(r,g,o,p*l),t.update(g,r,1)}function u(p,g,x){if(x===0)return;let m,f;if(i)m=s,f="drawElementsInstanced";else if(m=e.get("ANGLE_instanced_arrays"),f="drawElementsInstancedANGLE",m===null){console.error("THREE.WebGLIndexedBufferRenderer: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.");return}m[f](r,g,o,p*l,x),t.update(g,r,x)}function d(p,g,x){if(x===0)return;let m=e.get("WEBGL_multi_draw");if(m===null)for(let f=0;f<x;f++)this.render(p[f]/l,g[f]);else{m.multiDrawElementsWEBGL(r,g,0,o,p,0,x);let f=0;for(let y=0;y<x;y++)f+=g[y];t.update(f,r,1)}}this.setMode=a,this.setIndex=c,this.render=h,this.renderInstances=u,this.renderMultiDraw=d}function s0(s){let e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,a,o){switch(t.calls++,a){case s.TRIANGLES:t.triangles+=o*(r/3);break;case s.LINES:t.lines+=o*(r/2);break;case s.LINE_STRIP:t.lines+=o*(r-1);break;case s.LINE_LOOP:t.lines+=o*r;break;case s.POINTS:t.points+=o*r;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",a);break}}function i(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:i,update:n}}function r0(s,e){return s[0]-e[0]}function a0(s,e){return Math.abs(e[1])-Math.abs(s[1])}function o0(s,e,t){let n={},i=new Float32Array(8),r=new WeakMap,a=new Ut,o=[];for(let c=0;c<8;c++)o[c]=[c,0];function l(c,h,u){let d=c.morphTargetInfluences;if(e.isWebGL2===!0){let p=h.morphAttributes.position||h.morphAttributes.normal||h.morphAttributes.color,g=p!==void 0?p.length:0,x=r.get(h);if(x===void 0||x.count!==g){let I=function(){H.dispose(),r.delete(h),h.removeEventListener("dispose",I)};x!==void 0&&x.texture.dispose();let y=h.morphAttributes.position!==void 0,v=h.morphAttributes.normal!==void 0,M=h.morphAttributes.color!==void 0,T=h.morphAttributes.position||[],E=h.morphAttributes.normal||[],b=h.morphAttributes.color||[],L=0;y===!0&&(L=1),v===!0&&(L=2),M===!0&&(L=3);let _=h.attributes.position.count*L,w=1;_>e.maxTextureSize&&(w=Math.ceil(_/e.maxTextureSize),_=e.maxTextureSize);let U=new Float32Array(_*w*4*g),H=new Xr(U,_,w,g);H.type=ti,H.needsUpdate=!0;let K=L*4;for(let C=0;C<g;C++){let P=T[C],N=E[C],F=b[C],z=_*w*4*C;for(let G=0;G<P.count;G++){let Y=G*K;y===!0&&(a.fromBufferAttribute(P,G),U[z+Y+0]=a.x,U[z+Y+1]=a.y,U[z+Y+2]=a.z,U[z+Y+3]=0),v===!0&&(a.fromBufferAttribute(N,G),U[z+Y+4]=a.x,U[z+Y+5]=a.y,U[z+Y+6]=a.z,U[z+Y+7]=0),M===!0&&(a.fromBufferAttribute(F,G),U[z+Y+8]=a.x,U[z+Y+9]=a.y,U[z+Y+10]=a.z,U[z+Y+11]=F.itemSize===4?a.w:1)}}x={count:g,texture:H,size:new Ge(_,w)},r.set(h,x),h.addEventListener("dispose",I)}let m=0;for(let y=0;y<d.length;y++)m+=d[y];let f=h.morphTargetsRelative?1:1-m;u.getUniforms().setValue(s,"morphTargetBaseInfluence",f),u.getUniforms().setValue(s,"morphTargetInfluences",d),u.getUniforms().setValue(s,"morphTargetsTexture",x.texture,t),u.getUniforms().setValue(s,"morphTargetsTextureSize",x.size)}else{let p=d===void 0?0:d.length,g=n[h.id];if(g===void 0||g.length!==p){g=[];for(let v=0;v<p;v++)g[v]=[v,0];n[h.id]=g}for(let v=0;v<p;v++){let M=g[v];M[0]=v,M[1]=d[v]}g.sort(a0);for(let v=0;v<8;v++)v<p&&g[v][1]?(o[v][0]=g[v][0],o[v][1]=g[v][1]):(o[v][0]=Number.MAX_SAFE_INTEGER,o[v][1]=0);o.sort(r0);let x=h.morphAttributes.position,m=h.morphAttributes.normal,f=0;for(let v=0;v<8;v++){let M=o[v],T=M[0],E=M[1];T!==Number.MAX_SAFE_INTEGER&&E?(x&&h.getAttribute("morphTarget"+v)!==x[T]&&h.setAttribute("morphTarget"+v,x[T]),m&&h.getAttribute("morphNormal"+v)!==m[T]&&h.setAttribute("morphNormal"+v,m[T]),i[v]=E,f+=E):(x&&h.hasAttribute("morphTarget"+v)===!0&&h.deleteAttribute("morphTarget"+v),m&&h.hasAttribute("morphNormal"+v)===!0&&h.deleteAttribute("morphNormal"+v),i[v]=0)}let y=h.morphTargetsRelative?1:1-f;u.getUniforms().setValue(s,"morphTargetBaseInfluence",y),u.getUniforms().setValue(s,"morphTargetInfluences",i)}}return{update:l}}function l0(s,e,t,n){let i=new WeakMap;function r(l){let c=n.render.frame,h=l.geometry,u=e.get(l,h);if(i.get(u)!==c&&(e.update(u),i.set(u,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",o)===!1&&l.addEventListener("dispose",o),i.get(l)!==c&&(t.update(l.instanceMatrix,s.ARRAY_BUFFER),l.instanceColor!==null&&t.update(l.instanceColor,s.ARRAY_BUFFER),i.set(l,c))),l.isSkinnedMesh){let d=l.skeleton;i.get(d)!==c&&(d.update(),i.set(d,c))}return u}function a(){i=new WeakMap}function o(l){let c=l.target;c.removeEventListener("dispose",o),t.remove(c.instanceMatrix),c.instanceColor!==null&&t.remove(c.instanceColor)}return{update:r,dispose:a}}var Qr=class extends cn{constructor(e,t,n,i,r,a,o,l,c,h){if(h=h!==void 0?h:Mi,h!==Mi&&h!==ss)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");n===void 0&&h===Mi&&(n=ei),n===void 0&&h===ss&&(n=bi),super(null,i,r,a,o,l,h,n,c),this.isDepthTexture=!0,this.image={width:e,height:t},this.magFilter=o!==void 0?o:Ot,this.minFilter=l!==void 0?l:Ot,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}},ru=new cn,au=new Qr(1,1);au.compareFunction=eu;var ou=new Xr,lu=new $o,cu=new Kr,mh=[],gh=[],xh=new Float32Array(16),vh=new Float32Array(9),yh=new Float32Array(4);function fs(s,e,t){let n=s[0];if(n<=0||n>0)return s;let i=e*t,r=mh[i];if(r===void 0&&(r=new Float32Array(i),mh[i]=r),e!==0){n.toArray(r,0);for(let a=1,o=0;a!==e;++a)o+=t,s[a].toArray(r,o)}return r}function Pt(s,e){if(s.length!==e.length)return!1;for(let t=0,n=s.length;t<n;t++)if(s[t]!==e[t])return!1;return!0}function Lt(s,e){for(let t=0,n=e.length;t<n;t++)s[t]=e[t]}function fa(s,e){let t=gh[e];t===void 0&&(t=new Int32Array(e),gh[e]=t);for(let n=0;n!==e;++n)t[n]=s.allocateTextureUnit();return t}function c0(s,e){let t=this.cache;t[0]!==e&&(s.uniform1f(this.addr,e),t[0]=e)}function h0(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(s.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Pt(t,e))return;s.uniform2fv(this.addr,e),Lt(t,e)}}function u0(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(s.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(s.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(Pt(t,e))return;s.uniform3fv(this.addr,e),Lt(t,e)}}function d0(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(s.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Pt(t,e))return;s.uniform4fv(this.addr,e),Lt(t,e)}}function f0(s,e){let t=this.cache,n=e.elements;if(n===void 0){if(Pt(t,e))return;s.uniformMatrix2fv(this.addr,!1,e),Lt(t,e)}else{if(Pt(t,n))return;yh.set(n),s.uniformMatrix2fv(this.addr,!1,yh),Lt(t,n)}}function p0(s,e){let t=this.cache,n=e.elements;if(n===void 0){if(Pt(t,e))return;s.uniformMatrix3fv(this.addr,!1,e),Lt(t,e)}else{if(Pt(t,n))return;vh.set(n),s.uniformMatrix3fv(this.addr,!1,vh),Lt(t,n)}}function m0(s,e){let t=this.cache,n=e.elements;if(n===void 0){if(Pt(t,e))return;s.uniformMatrix4fv(this.addr,!1,e),Lt(t,e)}else{if(Pt(t,n))return;xh.set(n),s.uniformMatrix4fv(this.addr,!1,xh),Lt(t,n)}}function g0(s,e){let t=this.cache;t[0]!==e&&(s.uniform1i(this.addr,e),t[0]=e)}function x0(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(s.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Pt(t,e))return;s.uniform2iv(this.addr,e),Lt(t,e)}}function v0(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(s.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Pt(t,e))return;s.uniform3iv(this.addr,e),Lt(t,e)}}function y0(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(s.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Pt(t,e))return;s.uniform4iv(this.addr,e),Lt(t,e)}}function _0(s,e){let t=this.cache;t[0]!==e&&(s.uniform1ui(this.addr,e),t[0]=e)}function b0(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(s.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Pt(t,e))return;s.uniform2uiv(this.addr,e),Lt(t,e)}}function M0(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(s.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Pt(t,e))return;s.uniform3uiv(this.addr,e),Lt(t,e)}}function w0(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(s.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Pt(t,e))return;s.uniform4uiv(this.addr,e),Lt(t,e)}}function S0(s,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i);let r=this.type===s.SAMPLER_2D_SHADOW?au:ru;t.setTexture2D(e||r,i)}function E0(s,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),t.setTexture3D(e||lu,i)}function T0(s,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),t.setTextureCube(e||cu,i)}function A0(s,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),t.setTexture2DArray(e||ou,i)}function R0(s){switch(s){case 5126:return c0;case 35664:return h0;case 35665:return u0;case 35666:return d0;case 35674:return f0;case 35675:return p0;case 35676:return m0;case 5124:case 35670:return g0;case 35667:case 35671:return x0;case 35668:case 35672:return v0;case 35669:case 35673:return y0;case 5125:return _0;case 36294:return b0;case 36295:return M0;case 36296:return w0;case 35678:case 36198:case 36298:case 36306:case 35682:return S0;case 35679:case 36299:case 36307:return E0;case 35680:case 36300:case 36308:case 36293:return T0;case 36289:case 36303:case 36311:case 36292:return A0}}function C0(s,e){s.uniform1fv(this.addr,e)}function P0(s,e){let t=fs(e,this.size,2);s.uniform2fv(this.addr,t)}function L0(s,e){let t=fs(e,this.size,3);s.uniform3fv(this.addr,t)}function I0(s,e){let t=fs(e,this.size,4);s.uniform4fv(this.addr,t)}function D0(s,e){let t=fs(e,this.size,4);s.uniformMatrix2fv(this.addr,!1,t)}function k0(s,e){let t=fs(e,this.size,9);s.uniformMatrix3fv(this.addr,!1,t)}function N0(s,e){let t=fs(e,this.size,16);s.uniformMatrix4fv(this.addr,!1,t)}function U0(s,e){s.uniform1iv(this.addr,e)}function F0(s,e){s.uniform2iv(this.addr,e)}function z0(s,e){s.uniform3iv(this.addr,e)}function O0(s,e){s.uniform4iv(this.addr,e)}function B0(s,e){s.uniform1uiv(this.addr,e)}function H0(s,e){s.uniform2uiv(this.addr,e)}function G0(s,e){s.uniform3uiv(this.addr,e)}function W0(s,e){s.uniform4uiv(this.addr,e)}function V0(s,e,t){let n=this.cache,i=e.length,r=fa(t,i);Pt(n,r)||(s.uniform1iv(this.addr,r),Lt(n,r));for(let a=0;a!==i;++a)t.setTexture2D(e[a]||ru,r[a])}function $0(s,e,t){let n=this.cache,i=e.length,r=fa(t,i);Pt(n,r)||(s.uniform1iv(this.addr,r),Lt(n,r));for(let a=0;a!==i;++a)t.setTexture3D(e[a]||lu,r[a])}function X0(s,e,t){let n=this.cache,i=e.length,r=fa(t,i);Pt(n,r)||(s.uniform1iv(this.addr,r),Lt(n,r));for(let a=0;a!==i;++a)t.setTextureCube(e[a]||cu,r[a])}function q0(s,e,t){let n=this.cache,i=e.length,r=fa(t,i);Pt(n,r)||(s.uniform1iv(this.addr,r),Lt(n,r));for(let a=0;a!==i;++a)t.setTexture2DArray(e[a]||ou,r[a])}function Y0(s){switch(s){case 5126:return C0;case 35664:return P0;case 35665:return L0;case 35666:return I0;case 35674:return D0;case 35675:return k0;case 35676:return N0;case 5124:case 35670:return U0;case 35667:case 35671:return F0;case 35668:case 35672:return z0;case 35669:case 35673:return O0;case 5125:return B0;case 36294:return H0;case 36295:return G0;case 36296:return W0;case 35678:case 36198:case 36298:case 36306:case 35682:return V0;case 35679:case 36299:case 36307:return $0;case 35680:case 36300:case 36308:case 36293:return X0;case 36289:case 36303:case 36311:case 36292:return q0}}var Yo=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=R0(t.type)}},Zo=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=Y0(t.type)}},Ko=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){let i=this.seq;for(let r=0,a=i.length;r!==a;++r){let o=i[r];o.setValue(e,t[o.id],n)}}},Lo=/(\w+)(\])?(\[|\.)?/g;function _h(s,e){s.seq.push(e),s.map[e.id]=e}function Z0(s,e,t){let n=s.name,i=n.length;for(Lo.lastIndex=0;;){let r=Lo.exec(n),a=Lo.lastIndex,o=r[1],l=r[2]==="]",c=r[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===i){_h(t,c===void 0?new Yo(o,s,e):new Zo(o,s,e));break}else{let u=t.map[o];u===void 0&&(u=new Ko(o),_h(t,u)),t=u}}}var es=class{constructor(e,t){this.seq=[],this.map={};let n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let i=0;i<n;++i){let r=e.getActiveUniform(t,i),a=e.getUniformLocation(t,r.name);Z0(r,a,this)}}setValue(e,t,n,i){let r=this.map[t];r!==void 0&&r.setValue(e,n,i)}setOptional(e,t,n){let i=t[n];i!==void 0&&this.setValue(e,n,i)}static upload(e,t,n,i){for(let r=0,a=t.length;r!==a;++r){let o=t[r],l=n[o.id];l.needsUpdate!==!1&&o.setValue(e,l.value,i)}}static seqWithValue(e,t){let n=[];for(let i=0,r=e.length;i!==r;++i){let a=e[i];a.id in t&&n.push(a)}return n}};function bh(s,e,t){let n=s.createShader(e);return s.shaderSource(n,t),s.compileShader(n),n}var K0=37297,J0=0;function j0(s,e){let t=s.split(`
`),n=[],i=Math.max(e-6,0),r=Math.min(e+6,t.length);for(let a=i;a<r;a++){let o=a+1;n.push(`${o===e?">":" "} ${o}: ${t[a]}`)}return n.join(`
`)}function Q0(s){let e=rt.getPrimaries(rt.workingColorSpace),t=rt.getPrimaries(s),n;switch(e===t?n="":e===Hr&&t===Br?n="LinearDisplayP3ToLinearSRGB":e===Br&&t===Hr&&(n="LinearSRGBToLinearDisplayP3"),s){case Fn:case da:return[n,"LinearTransferOETF"];case ut:case Sl:return[n,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space:",s),[n,"LinearTransferOETF"]}}function Mh(s,e,t){let n=s.getShaderParameter(e,s.COMPILE_STATUS),i=s.getShaderInfoLog(e).trim();if(n&&i==="")return"";let r=/ERROR: 0:(\d+)/.exec(i);if(r){let a=parseInt(r[1]);return t.toUpperCase()+`

`+i+`

`+j0(s.getShaderSource(e),a)}else return i}function eg(s,e){let t=Q0(e);return`vec4 ${s}( vec4 value ) { return ${t[0]}( ${t[1]}( value ) ); }`}function tg(s,e){let t;switch(e){case yd:t="Linear";break;case _d:t="Reinhard";break;case bd:t="OptimizedCineon";break;case Ml:t="ACESFilmic";break;case wd:t="AgX";break;case Md:t="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",e),t="Linear"}return"vec3 "+s+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}function ng(s){return[s.extensionDerivatives||s.envMapCubeUVHeight||s.bumpMap||s.normalMapTangentSpace||s.clearcoatNormalMap||s.flatShading||s.shaderID==="physical"?"#extension GL_OES_standard_derivatives : enable":"",(s.extensionFragDepth||s.logarithmicDepthBuffer)&&s.rendererExtensionFragDepth?"#extension GL_EXT_frag_depth : enable":"",s.extensionDrawBuffers&&s.rendererExtensionDrawBuffers?"#extension GL_EXT_draw_buffers : require":"",(s.extensionShaderTextureLOD||s.envMap||s.transmission)&&s.rendererExtensionShaderTextureLod?"#extension GL_EXT_shader_texture_lod : enable":""].filter(ji).join(`
`)}function ig(s){return[s.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":""].filter(ji).join(`
`)}function sg(s){let e=[];for(let t in s){let n=s[t];n!==!1&&e.push("#define "+t+" "+n)}return e.join(`
`)}function rg(s,e){let t={},n=s.getProgramParameter(e,s.ACTIVE_ATTRIBUTES);for(let i=0;i<n;i++){let r=s.getActiveAttrib(e,i),a=r.name,o=1;r.type===s.FLOAT_MAT2&&(o=2),r.type===s.FLOAT_MAT3&&(o=3),r.type===s.FLOAT_MAT4&&(o=4),t[a]={type:r.type,location:s.getAttribLocation(e,a),locationSize:o}}return t}function ji(s){return s!==""}function wh(s,e){let t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return s.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function Sh(s,e){return s.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}var ag=/^[ \t]*#include +<([\w\d./]+)>/gm;function Jo(s){return s.replace(ag,lg)}var og=new Map([["encodings_fragment","colorspace_fragment"],["encodings_pars_fragment","colorspace_pars_fragment"],["output_fragment","opaque_fragment"]]);function lg(s,e){let t=ze[e];if(t===void 0){let n=og.get(e);if(n!==void 0)t=ze[n],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,n);else throw new Error("Can not resolve #include <"+e+">")}return Jo(t)}var cg=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Eh(s){return s.replace(cg,hg)}function hg(s,e,t,n){let i="";for(let r=parseInt(e);r<parseInt(t);r++)i+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return i}function Th(s){let e="precision "+s.precision+` float;
precision `+s.precision+" int;";return s.precision==="highp"?e+=`
#define HIGH_PRECISION`:s.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:s.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}function ug(s){let e="SHADOWMAP_TYPE_BASIC";return s.shadowMapType===Gh?e="SHADOWMAP_TYPE_PCF":s.shadowMapType===bl?e="SHADOWMAP_TYPE_PCF_SOFT":s.shadowMapType===Nn&&(e="SHADOWMAP_TYPE_VSM"),e}function dg(s){let e="ENVMAP_TYPE_CUBE";if(s.envMap)switch(s.envMapMode){case ns:case is:e="ENVMAP_TYPE_CUBE";break;case ua:e="ENVMAP_TYPE_CUBE_UV";break}return e}function fg(s){let e="ENVMAP_MODE_REFLECTION";if(s.envMap)switch(s.envMapMode){case is:e="ENVMAP_MODE_REFRACTION";break}return e}function pg(s){let e="ENVMAP_BLENDING_NONE";if(s.envMap)switch(s.combine){case Wh:e="ENVMAP_BLENDING_MULTIPLY";break;case xd:e="ENVMAP_BLENDING_MIX";break;case vd:e="ENVMAP_BLENDING_ADD";break}return e}function mg(s){let e=s.envMapCubeUVHeight;if(e===null)return null;let t=Math.log2(e)-2,n=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),7*16)),texelHeight:n,maxMip:t}}function gg(s,e,t,n){let i=s.getContext(),r=t.defines,a=t.vertexShader,o=t.fragmentShader,l=ug(t),c=dg(t),h=fg(t),u=pg(t),d=mg(t),p=t.isWebGL2?"":ng(t),g=ig(t),x=sg(r),m=i.createProgram(),f,y,v=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(f=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,x].filter(ji).join(`
`),f.length>0&&(f+=`
`),y=[p,"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,x].filter(ji).join(`
`),y.length>0&&(y+=`
`)):(f=[Th(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,x,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+h:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors&&t.isWebGL2?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0&&t.isWebGL2?"#define MORPHTARGETS_TEXTURE":"",t.morphTargetsCount>0&&t.isWebGL2?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0&&t.isWebGL2?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.useLegacyLights?"#define LEGACY_LIGHTS":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.logarithmicDepthBuffer&&t.rendererExtensionFragDepth?"#define USE_LOGDEPTHBUF_EXT":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#if ( defined( USE_MORPHTARGETS ) && ! defined( MORPHTARGETS_TEXTURE ) )","	attribute vec3 morphTarget0;","	attribute vec3 morphTarget1;","	attribute vec3 morphTarget2;","	attribute vec3 morphTarget3;","	#ifdef USE_MORPHNORMALS","		attribute vec3 morphNormal0;","		attribute vec3 morphNormal1;","		attribute vec3 morphNormal2;","		attribute vec3 morphNormal3;","	#else","		attribute vec3 morphTarget4;","		attribute vec3 morphTarget5;","		attribute vec3 morphTarget6;","		attribute vec3 morphTarget7;","	#endif","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(ji).join(`
`),y=[p,Th(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,x,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+h:"",t.envMap?"#define "+u:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.useLegacyLights?"#define LEGACY_LIGHTS":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.logarithmicDepthBuffer&&t.rendererExtensionFragDepth?"#define USE_LOGDEPTHBUF_EXT":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==si?"#define TONE_MAPPING":"",t.toneMapping!==si?ze.tonemapping_pars_fragment:"",t.toneMapping!==si?tg("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",ze.colorspace_pars_fragment,eg("linearToOutputTexel",t.outputColorSpace),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(ji).join(`
`)),a=Jo(a),a=wh(a,t),a=Sh(a,t),o=Jo(o),o=wh(o,t),o=Sh(o,t),a=Eh(a),o=Eh(o),t.isWebGL2&&t.isRawShaderMaterial!==!0&&(v=`#version 300 es
`,f=[g,"precision mediump sampler2DArray;","#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+f,y=["precision mediump sampler2DArray;","#define varying in",t.glslVersion===$c?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===$c?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+y);let M=v+f+a,T=v+y+o,E=bh(i,i.VERTEX_SHADER,M),b=bh(i,i.FRAGMENT_SHADER,T);i.attachShader(m,E),i.attachShader(m,b),t.index0AttributeName!==void 0?i.bindAttribLocation(m,0,t.index0AttributeName):t.morphTargets===!0&&i.bindAttribLocation(m,0,"position"),i.linkProgram(m);function L(H){if(s.debug.checkShaderErrors){let K=i.getProgramInfoLog(m).trim(),I=i.getShaderInfoLog(E).trim(),C=i.getShaderInfoLog(b).trim(),P=!0,N=!0;if(i.getProgramParameter(m,i.LINK_STATUS)===!1)if(P=!1,typeof s.debug.onShaderError=="function")s.debug.onShaderError(i,m,E,b);else{let F=Mh(i,E,"vertex"),z=Mh(i,b,"fragment");console.error("THREE.WebGLProgram: Shader Error "+i.getError()+" - VALIDATE_STATUS "+i.getProgramParameter(m,i.VALIDATE_STATUS)+`

Program Info Log: `+K+`
`+F+`
`+z)}else K!==""?console.warn("THREE.WebGLProgram: Program Info Log:",K):(I===""||C==="")&&(N=!1);N&&(H.diagnostics={runnable:P,programLog:K,vertexShader:{log:I,prefix:f},fragmentShader:{log:C,prefix:y}})}i.deleteShader(E),i.deleteShader(b),_=new es(i,m),w=rg(i,m)}let _;this.getUniforms=function(){return _===void 0&&L(this),_};let w;this.getAttributes=function(){return w===void 0&&L(this),w};let U=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return U===!1&&(U=i.getProgramParameter(m,K0)),U},this.destroy=function(){n.releaseStatesOfProgram(this),i.deleteProgram(m),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=J0++,this.cacheKey=e,this.usedTimes=1,this.program=m,this.vertexShader=E,this.fragmentShader=b,this}var xg=0,jo=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e){let t=e.vertexShader,n=e.fragmentShader,i=this._getShaderStage(t),r=this._getShaderStage(n),a=this._getShaderCacheForMaterial(e);return a.has(i)===!1&&(a.add(i),i.usedTimes++),a.has(r)===!1&&(a.add(r),r.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderID(e){return this._getShaderStage(e.vertexShader).id}getFragmentShaderID(e){return this._getShaderStage(e.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){let t=this.shaderCache,n=t.get(e);return n===void 0&&(n=new Qo(e),t.set(e,n)),n}},Qo=class{constructor(e){this.id=xg++,this.code=e,this.usedTimes=0}};function vg(s,e,t,n,i,r,a){let o=new Is,l=new jo,c=[],h=i.isWebGL2,u=i.logarithmicDepthBuffer,d=i.vertexTextures,p=i.precision,g={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function x(_){return _===0?"uv":`uv${_}`}function m(_,w,U,H,K){let I=H.fog,C=K.geometry,P=_.isMeshStandardMaterial?H.environment:null,N=(_.isMeshStandardMaterial?t:e).get(_.envMap||P),F=N&&N.mapping===ua?N.image.height:null,z=g[_.type];_.precision!==null&&(p=i.getMaxPrecision(_.precision),p!==_.precision&&console.warn("THREE.WebGLProgram.getParameters:",_.precision,"not supported, using",p,"instead."));let G=C.morphAttributes.position||C.morphAttributes.normal||C.morphAttributes.color,Y=G!==void 0?G.length:0,J=0;C.morphAttributes.position!==void 0&&(J=1),C.morphAttributes.normal!==void 0&&(J=2),C.morphAttributes.color!==void 0&&(J=3);let B,Z,ne,me;if(z){let Yt=En[z];B=Yt.vertexShader,Z=Yt.fragmentShader}else B=_.vertexShader,Z=_.fragmentShader,l.update(_),ne=l.getVertexShaderID(_),me=l.getFragmentShaderID(_);let fe=s.getRenderTarget(),Pe=K.isInstancedMesh===!0,Ue=K.isBatchedMesh===!0,Ee=!!_.map,tt=!!_.matcap,W=!!N,qt=!!_.aoMap,_e=!!_.lightMap,De=!!_.bumpMap,pe=!!_.normalMap,gt=!!_.displacementMap,Oe=!!_.emissiveMap,R=!!_.metalnessMap,S=!!_.roughnessMap,$=_.anisotropy>0,ee=_.clearcoat>0,Q=_.iridescence>0,te=_.sheen>0,ge=_.transmission>0,ce=$&&!!_.anisotropyMap,ue=ee&&!!_.clearcoatMap,we=ee&&!!_.clearcoatNormalMap,Be=ee&&!!_.clearcoatRoughnessMap,j=Q&&!!_.iridescenceMap,st=Q&&!!_.iridescenceThicknessMap,Ye=te&&!!_.sheenColorMap,Le=te&&!!_.sheenRoughnessMap,ye=!!_.specularMap,de=!!_.specularColorMap,Fe=!!_.specularIntensityMap,it=ge&&!!_.transmissionMap,bt=ge&&!!_.thicknessMap,We=!!_.gradientMap,se=!!_.alphaMap,D=_.alphaTest>0,ae=!!_.alphaHash,oe=!!_.extensions,Te=!!C.attributes.uv1,be=!!C.attributes.uv2,lt=!!C.attributes.uv3,ct=si;return _.toneMapped&&(fe===null||fe.isXRRenderTarget===!0)&&(ct=s.toneMapping),{isWebGL2:h,shaderID:z,shaderType:_.type,shaderName:_.name,vertexShader:B,fragmentShader:Z,defines:_.defines,customVertexShaderID:ne,customFragmentShaderID:me,isRawShaderMaterial:_.isRawShaderMaterial===!0,glslVersion:_.glslVersion,precision:p,batching:Ue,instancing:Pe,instancingColor:Pe&&K.instanceColor!==null,supportsVertexTextures:d,outputColorSpace:fe===null?s.outputColorSpace:fe.isXRRenderTarget===!0?fe.texture.colorSpace:Fn,map:Ee,matcap:tt,envMap:W,envMapMode:W&&N.mapping,envMapCubeUVHeight:F,aoMap:qt,lightMap:_e,bumpMap:De,normalMap:pe,displacementMap:d&&gt,emissiveMap:Oe,normalMapObjectSpace:pe&&_.normalMapType===Nd,normalMapTangentSpace:pe&&_.normalMapType===Qh,metalnessMap:R,roughnessMap:S,anisotropy:$,anisotropyMap:ce,clearcoat:ee,clearcoatMap:ue,clearcoatNormalMap:we,clearcoatRoughnessMap:Be,iridescence:Q,iridescenceMap:j,iridescenceThicknessMap:st,sheen:te,sheenColorMap:Ye,sheenRoughnessMap:Le,specularMap:ye,specularColorMap:de,specularIntensityMap:Fe,transmission:ge,transmissionMap:it,thicknessMap:bt,gradientMap:We,opaque:_.transparent===!1&&_.blending===ii,alphaMap:se,alphaTest:D,alphaHash:ae,combine:_.combine,mapUv:Ee&&x(_.map.channel),aoMapUv:qt&&x(_.aoMap.channel),lightMapUv:_e&&x(_.lightMap.channel),bumpMapUv:De&&x(_.bumpMap.channel),normalMapUv:pe&&x(_.normalMap.channel),displacementMapUv:gt&&x(_.displacementMap.channel),emissiveMapUv:Oe&&x(_.emissiveMap.channel),metalnessMapUv:R&&x(_.metalnessMap.channel),roughnessMapUv:S&&x(_.roughnessMap.channel),anisotropyMapUv:ce&&x(_.anisotropyMap.channel),clearcoatMapUv:ue&&x(_.clearcoatMap.channel),clearcoatNormalMapUv:we&&x(_.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:Be&&x(_.clearcoatRoughnessMap.channel),iridescenceMapUv:j&&x(_.iridescenceMap.channel),iridescenceThicknessMapUv:st&&x(_.iridescenceThicknessMap.channel),sheenColorMapUv:Ye&&x(_.sheenColorMap.channel),sheenRoughnessMapUv:Le&&x(_.sheenRoughnessMap.channel),specularMapUv:ye&&x(_.specularMap.channel),specularColorMapUv:de&&x(_.specularColorMap.channel),specularIntensityMapUv:Fe&&x(_.specularIntensityMap.channel),transmissionMapUv:it&&x(_.transmissionMap.channel),thicknessMapUv:bt&&x(_.thicknessMap.channel),alphaMapUv:se&&x(_.alphaMap.channel),vertexTangents:!!C.attributes.tangent&&(pe||$),vertexColors:_.vertexColors,vertexAlphas:_.vertexColors===!0&&!!C.attributes.color&&C.attributes.color.itemSize===4,vertexUv1s:Te,vertexUv2s:be,vertexUv3s:lt,pointsUvs:K.isPoints===!0&&!!C.attributes.uv&&(Ee||se),fog:!!I,useFog:_.fog===!0,fogExp2:I&&I.isFogExp2,flatShading:_.flatShading===!0,sizeAttenuation:_.sizeAttenuation===!0,logarithmicDepthBuffer:u,skinning:K.isSkinnedMesh===!0,morphTargets:C.morphAttributes.position!==void 0,morphNormals:C.morphAttributes.normal!==void 0,morphColors:C.morphAttributes.color!==void 0,morphTargetsCount:Y,morphTextureStride:J,numDirLights:w.directional.length,numPointLights:w.point.length,numSpotLights:w.spot.length,numSpotLightMaps:w.spotLightMap.length,numRectAreaLights:w.rectArea.length,numHemiLights:w.hemi.length,numDirLightShadows:w.directionalShadowMap.length,numPointLightShadows:w.pointShadowMap.length,numSpotLightShadows:w.spotShadowMap.length,numSpotLightShadowsWithMaps:w.numSpotLightShadowsWithMaps,numLightProbes:w.numLightProbes,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:_.dithering,shadowMapEnabled:s.shadowMap.enabled&&U.length>0,shadowMapType:s.shadowMap.type,toneMapping:ct,useLegacyLights:s._useLegacyLights,decodeVideoTexture:Ee&&_.map.isVideoTexture===!0&&rt.getTransfer(_.map.colorSpace)===ft,premultipliedAlpha:_.premultipliedAlpha,doubleSided:_.side===Ct,flipSided:_.side===$t,useDepthPacking:_.depthPacking>=0,depthPacking:_.depthPacking||0,index0AttributeName:_.index0AttributeName,extensionDerivatives:oe&&_.extensions.derivatives===!0,extensionFragDepth:oe&&_.extensions.fragDepth===!0,extensionDrawBuffers:oe&&_.extensions.drawBuffers===!0,extensionShaderTextureLOD:oe&&_.extensions.shaderTextureLOD===!0,extensionClipCullDistance:oe&&_.extensions.clipCullDistance&&n.has("WEBGL_clip_cull_distance"),rendererExtensionFragDepth:h||n.has("EXT_frag_depth"),rendererExtensionDrawBuffers:h||n.has("WEBGL_draw_buffers"),rendererExtensionShaderTextureLod:h||n.has("EXT_shader_texture_lod"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:_.customProgramCacheKey()}}function f(_){let w=[];if(_.shaderID?w.push(_.shaderID):(w.push(_.customVertexShaderID),w.push(_.customFragmentShaderID)),_.defines!==void 0)for(let U in _.defines)w.push(U),w.push(_.defines[U]);return _.isRawShaderMaterial===!1&&(y(w,_),v(w,_),w.push(s.outputColorSpace)),w.push(_.customProgramCacheKey),w.join()}function y(_,w){_.push(w.precision),_.push(w.outputColorSpace),_.push(w.envMapMode),_.push(w.envMapCubeUVHeight),_.push(w.mapUv),_.push(w.alphaMapUv),_.push(w.lightMapUv),_.push(w.aoMapUv),_.push(w.bumpMapUv),_.push(w.normalMapUv),_.push(w.displacementMapUv),_.push(w.emissiveMapUv),_.push(w.metalnessMapUv),_.push(w.roughnessMapUv),_.push(w.anisotropyMapUv),_.push(w.clearcoatMapUv),_.push(w.clearcoatNormalMapUv),_.push(w.clearcoatRoughnessMapUv),_.push(w.iridescenceMapUv),_.push(w.iridescenceThicknessMapUv),_.push(w.sheenColorMapUv),_.push(w.sheenRoughnessMapUv),_.push(w.specularMapUv),_.push(w.specularColorMapUv),_.push(w.specularIntensityMapUv),_.push(w.transmissionMapUv),_.push(w.thicknessMapUv),_.push(w.combine),_.push(w.fogExp2),_.push(w.sizeAttenuation),_.push(w.morphTargetsCount),_.push(w.morphAttributeCount),_.push(w.numDirLights),_.push(w.numPointLights),_.push(w.numSpotLights),_.push(w.numSpotLightMaps),_.push(w.numHemiLights),_.push(w.numRectAreaLights),_.push(w.numDirLightShadows),_.push(w.numPointLightShadows),_.push(w.numSpotLightShadows),_.push(w.numSpotLightShadowsWithMaps),_.push(w.numLightProbes),_.push(w.shadowMapType),_.push(w.toneMapping),_.push(w.numClippingPlanes),_.push(w.numClipIntersection),_.push(w.depthPacking)}function v(_,w){o.disableAll(),w.isWebGL2&&o.enable(0),w.supportsVertexTextures&&o.enable(1),w.instancing&&o.enable(2),w.instancingColor&&o.enable(3),w.matcap&&o.enable(4),w.envMap&&o.enable(5),w.normalMapObjectSpace&&o.enable(6),w.normalMapTangentSpace&&o.enable(7),w.clearcoat&&o.enable(8),w.iridescence&&o.enable(9),w.alphaTest&&o.enable(10),w.vertexColors&&o.enable(11),w.vertexAlphas&&o.enable(12),w.vertexUv1s&&o.enable(13),w.vertexUv2s&&o.enable(14),w.vertexUv3s&&o.enable(15),w.vertexTangents&&o.enable(16),w.anisotropy&&o.enable(17),w.alphaHash&&o.enable(18),w.batching&&o.enable(19),_.push(o.mask),o.disableAll(),w.fog&&o.enable(0),w.useFog&&o.enable(1),w.flatShading&&o.enable(2),w.logarithmicDepthBuffer&&o.enable(3),w.skinning&&o.enable(4),w.morphTargets&&o.enable(5),w.morphNormals&&o.enable(6),w.morphColors&&o.enable(7),w.premultipliedAlpha&&o.enable(8),w.shadowMapEnabled&&o.enable(9),w.useLegacyLights&&o.enable(10),w.doubleSided&&o.enable(11),w.flipSided&&o.enable(12),w.useDepthPacking&&o.enable(13),w.dithering&&o.enable(14),w.transmission&&o.enable(15),w.sheen&&o.enable(16),w.opaque&&o.enable(17),w.pointsUvs&&o.enable(18),w.decodeVideoTexture&&o.enable(19),_.push(o.mask)}function M(_){let w=g[_.type],U;if(w){let H=En[w];U=of.clone(H.uniforms)}else U=_.uniforms;return U}function T(_,w){let U;for(let H=0,K=c.length;H<K;H++){let I=c[H];if(I.cacheKey===w){U=I,++U.usedTimes;break}}return U===void 0&&(U=new gg(s,w,_,r),c.push(U)),U}function E(_){if(--_.usedTimes===0){let w=c.indexOf(_);c[w]=c[c.length-1],c.pop(),_.destroy()}}function b(_){l.remove(_)}function L(){l.dispose()}return{getParameters:m,getProgramCacheKey:f,getUniforms:M,acquireProgram:T,releaseProgram:E,releaseShaderCache:b,programs:c,dispose:L}}function yg(){let s=new WeakMap;function e(r){let a=s.get(r);return a===void 0&&(a={},s.set(r,a)),a}function t(r){s.delete(r)}function n(r,a,o){s.get(r)[a]=o}function i(){s=new WeakMap}return{get:e,remove:t,update:n,dispose:i}}function _g(s,e){return s.groupOrder!==e.groupOrder?s.groupOrder-e.groupOrder:s.renderOrder!==e.renderOrder?s.renderOrder-e.renderOrder:s.material.id!==e.material.id?s.material.id-e.material.id:s.z!==e.z?s.z-e.z:s.id-e.id}function Ah(s,e){return s.groupOrder!==e.groupOrder?s.groupOrder-e.groupOrder:s.renderOrder!==e.renderOrder?s.renderOrder-e.renderOrder:s.z!==e.z?e.z-s.z:s.id-e.id}function Rh(){let s=[],e=0,t=[],n=[],i=[];function r(){e=0,t.length=0,n.length=0,i.length=0}function a(u,d,p,g,x,m){let f=s[e];return f===void 0?(f={id:u.id,object:u,geometry:d,material:p,groupOrder:g,renderOrder:u.renderOrder,z:x,group:m},s[e]=f):(f.id=u.id,f.object=u,f.geometry=d,f.material=p,f.groupOrder=g,f.renderOrder=u.renderOrder,f.z=x,f.group=m),e++,f}function o(u,d,p,g,x,m){let f=a(u,d,p,g,x,m);p.transmission>0?n.push(f):p.transparent===!0?i.push(f):t.push(f)}function l(u,d,p,g,x,m){let f=a(u,d,p,g,x,m);p.transmission>0?n.unshift(f):p.transparent===!0?i.unshift(f):t.unshift(f)}function c(u,d){t.length>1&&t.sort(u||_g),n.length>1&&n.sort(d||Ah),i.length>1&&i.sort(d||Ah)}function h(){for(let u=e,d=s.length;u<d;u++){let p=s[u];if(p.id===null)break;p.id=null,p.object=null,p.geometry=null,p.material=null,p.group=null}}return{opaque:t,transmissive:n,transparent:i,init:r,push:o,unshift:l,finish:h,sort:c}}function bg(){let s=new WeakMap;function e(n,i){let r=s.get(n),a;return r===void 0?(a=new Rh,s.set(n,[a])):i>=r.length?(a=new Rh,r.push(a)):a=r[i],a}function t(){s=new WeakMap}return{get:e,dispose:t}}function Mg(){let s={};return{get:function(e){if(s[e.id]!==void 0)return s[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new k,color:new ie};break;case"SpotLight":t={position:new k,direction:new k,color:new ie,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new k,color:new ie,distance:0,decay:0};break;case"HemisphereLight":t={direction:new k,skyColor:new ie,groundColor:new ie};break;case"RectAreaLight":t={color:new ie,position:new k,halfWidth:new k,halfHeight:new k};break}return s[e.id]=t,t}}}function wg(){let s={};return{get:function(e){if(s[e.id]!==void 0)return s[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ge};break;case"SpotLight":t={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ge};break;case"PointLight":t={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ge,shadowCameraNear:1,shadowCameraFar:1e3};break}return s[e.id]=t,t}}}var Sg=0;function Eg(s,e){return(e.castShadow?2:0)-(s.castShadow?2:0)+(e.map?1:0)-(s.map?1:0)}function Tg(s,e){let t=new Mg,n=wg(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let h=0;h<9;h++)i.probe.push(new k);let r=new k,a=new je,o=new je;function l(h,u){let d=0,p=0,g=0;for(let H=0;H<9;H++)i.probe[H].set(0,0,0);let x=0,m=0,f=0,y=0,v=0,M=0,T=0,E=0,b=0,L=0,_=0;h.sort(Eg);let w=u===!0?Math.PI:1;for(let H=0,K=h.length;H<K;H++){let I=h[H],C=I.color,P=I.intensity,N=I.distance,F=I.shadow&&I.shadow.map?I.shadow.map.texture:null;if(I.isAmbientLight)d+=C.r*P*w,p+=C.g*P*w,g+=C.b*P*w;else if(I.isLightProbe){for(let z=0;z<9;z++)i.probe[z].addScaledVector(I.sh.coefficients[z],P);_++}else if(I.isDirectionalLight){let z=t.get(I);if(z.color.copy(I.color).multiplyScalar(I.intensity*w),I.castShadow){let G=I.shadow,Y=n.get(I);Y.shadowBias=G.bias,Y.shadowNormalBias=G.normalBias,Y.shadowRadius=G.radius,Y.shadowMapSize=G.mapSize,i.directionalShadow[x]=Y,i.directionalShadowMap[x]=F,i.directionalShadowMatrix[x]=I.shadow.matrix,M++}i.directional[x]=z,x++}else if(I.isSpotLight){let z=t.get(I);z.position.setFromMatrixPosition(I.matrixWorld),z.color.copy(C).multiplyScalar(P*w),z.distance=N,z.coneCos=Math.cos(I.angle),z.penumbraCos=Math.cos(I.angle*(1-I.penumbra)),z.decay=I.decay,i.spot[f]=z;let G=I.shadow;if(I.map&&(i.spotLightMap[b]=I.map,b++,G.updateMatrices(I),I.castShadow&&L++),i.spotLightMatrix[f]=G.matrix,I.castShadow){let Y=n.get(I);Y.shadowBias=G.bias,Y.shadowNormalBias=G.normalBias,Y.shadowRadius=G.radius,Y.shadowMapSize=G.mapSize,i.spotShadow[f]=Y,i.spotShadowMap[f]=F,E++}f++}else if(I.isRectAreaLight){let z=t.get(I);z.color.copy(C).multiplyScalar(P),z.halfWidth.set(I.width*.5,0,0),z.halfHeight.set(0,I.height*.5,0),i.rectArea[y]=z,y++}else if(I.isPointLight){let z=t.get(I);if(z.color.copy(I.color).multiplyScalar(I.intensity*w),z.distance=I.distance,z.decay=I.decay,I.castShadow){let G=I.shadow,Y=n.get(I);Y.shadowBias=G.bias,Y.shadowNormalBias=G.normalBias,Y.shadowRadius=G.radius,Y.shadowMapSize=G.mapSize,Y.shadowCameraNear=G.camera.near,Y.shadowCameraFar=G.camera.far,i.pointShadow[m]=Y,i.pointShadowMap[m]=F,i.pointShadowMatrix[m]=I.shadow.matrix,T++}i.point[m]=z,m++}else if(I.isHemisphereLight){let z=t.get(I);z.skyColor.copy(I.color).multiplyScalar(P*w),z.groundColor.copy(I.groundColor).multiplyScalar(P*w),i.hemi[v]=z,v++}}y>0&&(e.isWebGL2?s.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=re.LTC_FLOAT_1,i.rectAreaLTC2=re.LTC_FLOAT_2):(i.rectAreaLTC1=re.LTC_HALF_1,i.rectAreaLTC2=re.LTC_HALF_2):s.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=re.LTC_FLOAT_1,i.rectAreaLTC2=re.LTC_FLOAT_2):s.has("OES_texture_half_float_linear")===!0?(i.rectAreaLTC1=re.LTC_HALF_1,i.rectAreaLTC2=re.LTC_HALF_2):console.error("THREE.WebGLRenderer: Unable to use RectAreaLight. Missing WebGL extensions.")),i.ambient[0]=d,i.ambient[1]=p,i.ambient[2]=g;let U=i.hash;(U.directionalLength!==x||U.pointLength!==m||U.spotLength!==f||U.rectAreaLength!==y||U.hemiLength!==v||U.numDirectionalShadows!==M||U.numPointShadows!==T||U.numSpotShadows!==E||U.numSpotMaps!==b||U.numLightProbes!==_)&&(i.directional.length=x,i.spot.length=f,i.rectArea.length=y,i.point.length=m,i.hemi.length=v,i.directionalShadow.length=M,i.directionalShadowMap.length=M,i.pointShadow.length=T,i.pointShadowMap.length=T,i.spotShadow.length=E,i.spotShadowMap.length=E,i.directionalShadowMatrix.length=M,i.pointShadowMatrix.length=T,i.spotLightMatrix.length=E+b-L,i.spotLightMap.length=b,i.numSpotLightShadowsWithMaps=L,i.numLightProbes=_,U.directionalLength=x,U.pointLength=m,U.spotLength=f,U.rectAreaLength=y,U.hemiLength=v,U.numDirectionalShadows=M,U.numPointShadows=T,U.numSpotShadows=E,U.numSpotMaps=b,U.numLightProbes=_,i.version=Sg++)}function c(h,u){let d=0,p=0,g=0,x=0,m=0,f=u.matrixWorldInverse;for(let y=0,v=h.length;y<v;y++){let M=h[y];if(M.isDirectionalLight){let T=i.directional[d];T.direction.setFromMatrixPosition(M.matrixWorld),r.setFromMatrixPosition(M.target.matrixWorld),T.direction.sub(r),T.direction.transformDirection(f),d++}else if(M.isSpotLight){let T=i.spot[g];T.position.setFromMatrixPosition(M.matrixWorld),T.position.applyMatrix4(f),T.direction.setFromMatrixPosition(M.matrixWorld),r.setFromMatrixPosition(M.target.matrixWorld),T.direction.sub(r),T.direction.transformDirection(f),g++}else if(M.isRectAreaLight){let T=i.rectArea[x];T.position.setFromMatrixPosition(M.matrixWorld),T.position.applyMatrix4(f),o.identity(),a.copy(M.matrixWorld),a.premultiply(f),o.extractRotation(a),T.halfWidth.set(M.width*.5,0,0),T.halfHeight.set(0,M.height*.5,0),T.halfWidth.applyMatrix4(o),T.halfHeight.applyMatrix4(o),x++}else if(M.isPointLight){let T=i.point[p];T.position.setFromMatrixPosition(M.matrixWorld),T.position.applyMatrix4(f),p++}else if(M.isHemisphereLight){let T=i.hemi[m];T.direction.setFromMatrixPosition(M.matrixWorld),T.direction.transformDirection(f),m++}}}return{setup:l,setupView:c,state:i}}function Ch(s,e){let t=new Tg(s,e),n=[],i=[];function r(){n.length=0,i.length=0}function a(u){n.push(u)}function o(u){i.push(u)}function l(u){t.setup(n,u)}function c(u){t.setupView(n,u)}return{init:r,state:{lightsArray:n,shadowsArray:i,lights:t},setupLights:l,setupLightsView:c,pushLight:a,pushShadow:o}}function Ag(s,e){let t=new WeakMap;function n(r,a=0){let o=t.get(r),l;return o===void 0?(l=new Ch(s,e),t.set(r,[l])):a>=o.length?(l=new Ch(s,e),o.push(l)):l=o[a],l}function i(){t=new WeakMap}return{get:n,dispose:i}}var el=class extends Hn{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=Dd,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},tl=class extends Hn{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}},Rg=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Cg=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function Pg(s,e,t){let n=new Ds,i=new Ge,r=new Ge,a=new Ut,o=new el({depthPacking:kd}),l=new tl,c={},h=t.maxTextureSize,u={[ai]:$t,[$t]:ai,[Ct]:Ct},d=new en({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Ge},radius:{value:4}},vertexShader:Rg,fragmentShader:Cg}),p=d.clone();p.defines.HORIZONTAL_PASS=1;let g=new Qe;g.setAttribute("position",new pt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let x=new Re(g,d),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Gh;let f=this.type;this.render=function(E,b,L){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||E.length===0)return;let _=s.getRenderTarget(),w=s.getActiveCubeFace(),U=s.getActiveMipmapLevel(),H=s.state;H.setBlending(ni),H.buffers.color.setClear(1,1,1,1),H.buffers.depth.setTest(!0),H.setScissorTest(!1);let K=f!==Nn&&this.type===Nn,I=f===Nn&&this.type!==Nn;for(let C=0,P=E.length;C<P;C++){let N=E[C],F=N.shadow;if(F===void 0){console.warn("THREE.WebGLShadowMap:",N,"has no shadow.");continue}if(F.autoUpdate===!1&&F.needsUpdate===!1)continue;i.copy(F.mapSize);let z=F.getFrameExtents();if(i.multiply(z),r.copy(F.mapSize),(i.x>h||i.y>h)&&(i.x>h&&(r.x=Math.floor(h/z.x),i.x=r.x*z.x,F.mapSize.x=r.x),i.y>h&&(r.y=Math.floor(h/z.y),i.y=r.y*z.y,F.mapSize.y=r.y)),F.map===null||K===!0||I===!0){let Y=this.type!==Nn?{minFilter:Ot,magFilter:Ot}:{};F.map!==null&&F.map.dispose(),F.map=new zn(i.x,i.y,Y),F.map.texture.name=N.name+".shadowMap",F.camera.updateProjectionMatrix()}s.setRenderTarget(F.map),s.clear();let G=F.getViewportCount();for(let Y=0;Y<G;Y++){let J=F.getViewport(Y);a.set(r.x*J.x,r.y*J.y,r.x*J.z,r.y*J.w),H.viewport(a),F.updateMatrices(N,Y),n=F.getFrustum(),M(b,L,F.camera,N,this.type)}F.isPointLightShadow!==!0&&this.type===Nn&&y(F,L),F.needsUpdate=!1}f=this.type,m.needsUpdate=!1,s.setRenderTarget(_,w,U)};function y(E,b){let L=e.update(x);d.defines.VSM_SAMPLES!==E.blurSamples&&(d.defines.VSM_SAMPLES=E.blurSamples,p.defines.VSM_SAMPLES=E.blurSamples,d.needsUpdate=!0,p.needsUpdate=!0),E.mapPass===null&&(E.mapPass=new zn(i.x,i.y)),d.uniforms.shadow_pass.value=E.map.texture,d.uniforms.resolution.value=E.mapSize,d.uniforms.radius.value=E.radius,s.setRenderTarget(E.mapPass),s.clear(),s.renderBufferDirect(b,null,L,d,x,null),p.uniforms.shadow_pass.value=E.mapPass.texture,p.uniforms.resolution.value=E.mapSize,p.uniforms.radius.value=E.radius,s.setRenderTarget(E.map),s.clear(),s.renderBufferDirect(b,null,L,p,x,null)}function v(E,b,L,_){let w=null,U=L.isPointLight===!0?E.customDistanceMaterial:E.customDepthMaterial;if(U!==void 0)w=U;else if(w=L.isPointLight===!0?l:o,s.localClippingEnabled&&b.clipShadows===!0&&Array.isArray(b.clippingPlanes)&&b.clippingPlanes.length!==0||b.displacementMap&&b.displacementScale!==0||b.alphaMap&&b.alphaTest>0||b.map&&b.alphaTest>0){let H=w.uuid,K=b.uuid,I=c[H];I===void 0&&(I={},c[H]=I);let C=I[K];C===void 0&&(C=w.clone(),I[K]=C,b.addEventListener("dispose",T)),w=C}if(w.visible=b.visible,w.wireframe=b.wireframe,_===Nn?w.side=b.shadowSide!==null?b.shadowSide:b.side:w.side=b.shadowSide!==null?b.shadowSide:u[b.side],w.alphaMap=b.alphaMap,w.alphaTest=b.alphaTest,w.map=b.map,w.clipShadows=b.clipShadows,w.clippingPlanes=b.clippingPlanes,w.clipIntersection=b.clipIntersection,w.displacementMap=b.displacementMap,w.displacementScale=b.displacementScale,w.displacementBias=b.displacementBias,w.wireframeLinewidth=b.wireframeLinewidth,w.linewidth=b.linewidth,L.isPointLight===!0&&w.isMeshDistanceMaterial===!0){let H=s.properties.get(w);H.light=L}return w}function M(E,b,L,_,w){if(E.visible===!1)return;if(E.layers.test(b.layers)&&(E.isMesh||E.isLine||E.isPoints)&&(E.castShadow||E.receiveShadow&&w===Nn)&&(!E.frustumCulled||n.intersectsObject(E))){E.modelViewMatrix.multiplyMatrices(L.matrixWorldInverse,E.matrixWorld);let K=e.update(E),I=E.material;if(Array.isArray(I)){let C=K.groups;for(let P=0,N=C.length;P<N;P++){let F=C[P],z=I[F.materialIndex];if(z&&z.visible){let G=v(E,z,_,w);E.onBeforeShadow(s,E,b,L,K,G,F),s.renderBufferDirect(L,null,K,G,E,F),E.onAfterShadow(s,E,b,L,K,G,F)}}}else if(I.visible){let C=v(E,I,_,w);E.onBeforeShadow(s,E,b,L,K,C,null),s.renderBufferDirect(L,null,K,C,E,null),E.onAfterShadow(s,E,b,L,K,C,null)}}let H=E.children;for(let K=0,I=H.length;K<I;K++)M(H[K],b,L,_,w)}function T(E){E.target.removeEventListener("dispose",T);for(let L in c){let _=c[L],w=E.target.uuid;w in _&&(_[w].dispose(),delete _[w])}}}function Lg(s,e,t){let n=t.isWebGL2;function i(){let D=!1,ae=new Ut,oe=null,Te=new Ut(0,0,0,0);return{setMask:function(be){oe!==be&&!D&&(s.colorMask(be,be,be,be),oe=be)},setLocked:function(be){D=be},setClear:function(be,lt,ct,Dt,Yt){Yt===!0&&(be*=Dt,lt*=Dt,ct*=Dt),ae.set(be,lt,ct,Dt),Te.equals(ae)===!1&&(s.clearColor(be,lt,ct,Dt),Te.copy(ae))},reset:function(){D=!1,oe=null,Te.set(-1,0,0,0)}}}function r(){let D=!1,ae=null,oe=null,Te=null;return{setTest:function(be){be?Ue(s.DEPTH_TEST):Ee(s.DEPTH_TEST)},setMask:function(be){ae!==be&&!D&&(s.depthMask(be),ae=be)},setFunc:function(be){if(oe!==be){switch(be){case hd:s.depthFunc(s.NEVER);break;case ud:s.depthFunc(s.ALWAYS);break;case dd:s.depthFunc(s.LESS);break;case Ur:s.depthFunc(s.LEQUAL);break;case fd:s.depthFunc(s.EQUAL);break;case pd:s.depthFunc(s.GEQUAL);break;case md:s.depthFunc(s.GREATER);break;case gd:s.depthFunc(s.NOTEQUAL);break;default:s.depthFunc(s.LEQUAL)}oe=be}},setLocked:function(be){D=be},setClear:function(be){Te!==be&&(s.clearDepth(be),Te=be)},reset:function(){D=!1,ae=null,oe=null,Te=null}}}function a(){let D=!1,ae=null,oe=null,Te=null,be=null,lt=null,ct=null,Dt=null,Yt=null;return{setTest:function(ht){D||(ht?Ue(s.STENCIL_TEST):Ee(s.STENCIL_TEST))},setMask:function(ht){ae!==ht&&!D&&(s.stencilMask(ht),ae=ht)},setFunc:function(ht,Zt,Mn){(oe!==ht||Te!==Zt||be!==Mn)&&(s.stencilFunc(ht,Zt,Mn),oe=ht,Te=Zt,be=Mn)},setOp:function(ht,Zt,Mn){(lt!==ht||ct!==Zt||Dt!==Mn)&&(s.stencilOp(ht,Zt,Mn),lt=ht,ct=Zt,Dt=Mn)},setLocked:function(ht){D=ht},setClear:function(ht){Yt!==ht&&(s.clearStencil(ht),Yt=ht)},reset:function(){D=!1,ae=null,oe=null,Te=null,be=null,lt=null,ct=null,Dt=null,Yt=null}}}let o=new i,l=new r,c=new a,h=new WeakMap,u=new WeakMap,d={},p={},g=new WeakMap,x=[],m=null,f=!1,y=null,v=null,M=null,T=null,E=null,b=null,L=null,_=new ie(0,0,0),w=0,U=!1,H=null,K=null,I=null,C=null,P=null,N=s.getParameter(s.MAX_COMBINED_TEXTURE_IMAGE_UNITS),F=!1,z=0,G=s.getParameter(s.VERSION);G.indexOf("WebGL")!==-1?(z=parseFloat(/^WebGL (\d)/.exec(G)[1]),F=z>=1):G.indexOf("OpenGL ES")!==-1&&(z=parseFloat(/^OpenGL ES (\d)/.exec(G)[1]),F=z>=2);let Y=null,J={},B=s.getParameter(s.SCISSOR_BOX),Z=s.getParameter(s.VIEWPORT),ne=new Ut().fromArray(B),me=new Ut().fromArray(Z);function fe(D,ae,oe,Te){let be=new Uint8Array(4),lt=s.createTexture();s.bindTexture(D,lt),s.texParameteri(D,s.TEXTURE_MIN_FILTER,s.NEAREST),s.texParameteri(D,s.TEXTURE_MAG_FILTER,s.NEAREST);for(let ct=0;ct<oe;ct++)n&&(D===s.TEXTURE_3D||D===s.TEXTURE_2D_ARRAY)?s.texImage3D(ae,0,s.RGBA,1,1,Te,0,s.RGBA,s.UNSIGNED_BYTE,be):s.texImage2D(ae+ct,0,s.RGBA,1,1,0,s.RGBA,s.UNSIGNED_BYTE,be);return lt}let Pe={};Pe[s.TEXTURE_2D]=fe(s.TEXTURE_2D,s.TEXTURE_2D,1),Pe[s.TEXTURE_CUBE_MAP]=fe(s.TEXTURE_CUBE_MAP,s.TEXTURE_CUBE_MAP_POSITIVE_X,6),n&&(Pe[s.TEXTURE_2D_ARRAY]=fe(s.TEXTURE_2D_ARRAY,s.TEXTURE_2D_ARRAY,1,1),Pe[s.TEXTURE_3D]=fe(s.TEXTURE_3D,s.TEXTURE_3D,1,1)),o.setClear(0,0,0,1),l.setClear(1),c.setClear(0),Ue(s.DEPTH_TEST),l.setFunc(Ur),Oe(!1),R(cc),Ue(s.CULL_FACE),pe(ni);function Ue(D){d[D]!==!0&&(s.enable(D),d[D]=!0)}function Ee(D){d[D]!==!1&&(s.disable(D),d[D]=!1)}function tt(D,ae){return p[D]!==ae?(s.bindFramebuffer(D,ae),p[D]=ae,n&&(D===s.DRAW_FRAMEBUFFER&&(p[s.FRAMEBUFFER]=ae),D===s.FRAMEBUFFER&&(p[s.DRAW_FRAMEBUFFER]=ae)),!0):!1}function W(D,ae){let oe=x,Te=!1;if(D)if(oe=g.get(ae),oe===void 0&&(oe=[],g.set(ae,oe)),D.isWebGLMultipleRenderTargets){let be=D.texture;if(oe.length!==be.length||oe[0]!==s.COLOR_ATTACHMENT0){for(let lt=0,ct=be.length;lt<ct;lt++)oe[lt]=s.COLOR_ATTACHMENT0+lt;oe.length=be.length,Te=!0}}else oe[0]!==s.COLOR_ATTACHMENT0&&(oe[0]=s.COLOR_ATTACHMENT0,Te=!0);else oe[0]!==s.BACK&&(oe[0]=s.BACK,Te=!0);Te&&(t.isWebGL2?s.drawBuffers(oe):e.get("WEBGL_draw_buffers").drawBuffersWEBGL(oe))}function qt(D){return m!==D?(s.useProgram(D),m=D,!0):!1}let _e={[vi]:s.FUNC_ADD,[Zu]:s.FUNC_SUBTRACT,[Ku]:s.FUNC_REVERSE_SUBTRACT};if(n)_e[dc]=s.MIN,_e[fc]=s.MAX;else{let D=e.get("EXT_blend_minmax");D!==null&&(_e[dc]=D.MIN_EXT,_e[fc]=D.MAX_EXT)}let De={[Ju]:s.ZERO,[ju]:s.ONE,[Qu]:s.SRC_COLOR,[No]:s.SRC_ALPHA,[rd]:s.SRC_ALPHA_SATURATE,[id]:s.DST_COLOR,[td]:s.DST_ALPHA,[ed]:s.ONE_MINUS_SRC_COLOR,[Uo]:s.ONE_MINUS_SRC_ALPHA,[sd]:s.ONE_MINUS_DST_COLOR,[nd]:s.ONE_MINUS_DST_ALPHA,[ad]:s.CONSTANT_COLOR,[od]:s.ONE_MINUS_CONSTANT_COLOR,[ld]:s.CONSTANT_ALPHA,[cd]:s.ONE_MINUS_CONSTANT_ALPHA};function pe(D,ae,oe,Te,be,lt,ct,Dt,Yt,ht){if(D===ni){f===!0&&(Ee(s.BLEND),f=!1);return}if(f===!1&&(Ue(s.BLEND),f=!0),D!==Yu){if(D!==y||ht!==U){if((v!==vi||E!==vi)&&(s.blendEquation(s.FUNC_ADD),v=vi,E=vi),ht)switch(D){case ii:s.blendFuncSeparate(s.ONE,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case ts:s.blendFunc(s.ONE,s.ONE);break;case hc:s.blendFuncSeparate(s.ZERO,s.ONE_MINUS_SRC_COLOR,s.ZERO,s.ONE);break;case uc:s.blendFuncSeparate(s.ZERO,s.SRC_COLOR,s.ZERO,s.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",D);break}else switch(D){case ii:s.blendFuncSeparate(s.SRC_ALPHA,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case ts:s.blendFunc(s.SRC_ALPHA,s.ONE);break;case hc:s.blendFuncSeparate(s.ZERO,s.ONE_MINUS_SRC_COLOR,s.ZERO,s.ONE);break;case uc:s.blendFunc(s.ZERO,s.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",D);break}M=null,T=null,b=null,L=null,_.set(0,0,0),w=0,y=D,U=ht}return}be=be||ae,lt=lt||oe,ct=ct||Te,(ae!==v||be!==E)&&(s.blendEquationSeparate(_e[ae],_e[be]),v=ae,E=be),(oe!==M||Te!==T||lt!==b||ct!==L)&&(s.blendFuncSeparate(De[oe],De[Te],De[lt],De[ct]),M=oe,T=Te,b=lt,L=ct),(Dt.equals(_)===!1||Yt!==w)&&(s.blendColor(Dt.r,Dt.g,Dt.b,Yt),_.copy(Dt),w=Yt),y=D,U=!1}function gt(D,ae){D.side===Ct?Ee(s.CULL_FACE):Ue(s.CULL_FACE);let oe=D.side===$t;ae&&(oe=!oe),Oe(oe),D.blending===ii&&D.transparent===!1?pe(ni):pe(D.blending,D.blendEquation,D.blendSrc,D.blendDst,D.blendEquationAlpha,D.blendSrcAlpha,D.blendDstAlpha,D.blendColor,D.blendAlpha,D.premultipliedAlpha),l.setFunc(D.depthFunc),l.setTest(D.depthTest),l.setMask(D.depthWrite),o.setMask(D.colorWrite);let Te=D.stencilWrite;c.setTest(Te),Te&&(c.setMask(D.stencilWriteMask),c.setFunc(D.stencilFunc,D.stencilRef,D.stencilFuncMask),c.setOp(D.stencilFail,D.stencilZFail,D.stencilZPass)),$(D.polygonOffset,D.polygonOffsetFactor,D.polygonOffsetUnits),D.alphaToCoverage===!0?Ue(s.SAMPLE_ALPHA_TO_COVERAGE):Ee(s.SAMPLE_ALPHA_TO_COVERAGE)}function Oe(D){H!==D&&(D?s.frontFace(s.CW):s.frontFace(s.CCW),H=D)}function R(D){D!==Xu?(Ue(s.CULL_FACE),D!==K&&(D===cc?s.cullFace(s.BACK):D===qu?s.cullFace(s.FRONT):s.cullFace(s.FRONT_AND_BACK))):Ee(s.CULL_FACE),K=D}function S(D){D!==I&&(F&&s.lineWidth(D),I=D)}function $(D,ae,oe){D?(Ue(s.POLYGON_OFFSET_FILL),(C!==ae||P!==oe)&&(s.polygonOffset(ae,oe),C=ae,P=oe)):Ee(s.POLYGON_OFFSET_FILL)}function ee(D){D?Ue(s.SCISSOR_TEST):Ee(s.SCISSOR_TEST)}function Q(D){D===void 0&&(D=s.TEXTURE0+N-1),Y!==D&&(s.activeTexture(D),Y=D)}function te(D,ae,oe){oe===void 0&&(Y===null?oe=s.TEXTURE0+N-1:oe=Y);let Te=J[oe];Te===void 0&&(Te={type:void 0,texture:void 0},J[oe]=Te),(Te.type!==D||Te.texture!==ae)&&(Y!==oe&&(s.activeTexture(oe),Y=oe),s.bindTexture(D,ae||Pe[D]),Te.type=D,Te.texture=ae)}function ge(){let D=J[Y];D!==void 0&&D.type!==void 0&&(s.bindTexture(D.type,null),D.type=void 0,D.texture=void 0)}function ce(){try{s.compressedTexImage2D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function ue(){try{s.compressedTexImage3D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function we(){try{s.texSubImage2D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Be(){try{s.texSubImage3D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function j(){try{s.compressedTexSubImage2D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function st(){try{s.compressedTexSubImage3D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Ye(){try{s.texStorage2D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Le(){try{s.texStorage3D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function ye(){try{s.texImage2D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function de(){try{s.texImage3D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Fe(D){ne.equals(D)===!1&&(s.scissor(D.x,D.y,D.z,D.w),ne.copy(D))}function it(D){me.equals(D)===!1&&(s.viewport(D.x,D.y,D.z,D.w),me.copy(D))}function bt(D,ae){let oe=u.get(ae);oe===void 0&&(oe=new WeakMap,u.set(ae,oe));let Te=oe.get(D);Te===void 0&&(Te=s.getUniformBlockIndex(ae,D.name),oe.set(D,Te))}function We(D,ae){let Te=u.get(ae).get(D);h.get(ae)!==Te&&(s.uniformBlockBinding(ae,Te,D.__bindingPointIndex),h.set(ae,Te))}function se(){s.disable(s.BLEND),s.disable(s.CULL_FACE),s.disable(s.DEPTH_TEST),s.disable(s.POLYGON_OFFSET_FILL),s.disable(s.SCISSOR_TEST),s.disable(s.STENCIL_TEST),s.disable(s.SAMPLE_ALPHA_TO_COVERAGE),s.blendEquation(s.FUNC_ADD),s.blendFunc(s.ONE,s.ZERO),s.blendFuncSeparate(s.ONE,s.ZERO,s.ONE,s.ZERO),s.blendColor(0,0,0,0),s.colorMask(!0,!0,!0,!0),s.clearColor(0,0,0,0),s.depthMask(!0),s.depthFunc(s.LESS),s.clearDepth(1),s.stencilMask(4294967295),s.stencilFunc(s.ALWAYS,0,4294967295),s.stencilOp(s.KEEP,s.KEEP,s.KEEP),s.clearStencil(0),s.cullFace(s.BACK),s.frontFace(s.CCW),s.polygonOffset(0,0),s.activeTexture(s.TEXTURE0),s.bindFramebuffer(s.FRAMEBUFFER,null),n===!0&&(s.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),s.bindFramebuffer(s.READ_FRAMEBUFFER,null)),s.useProgram(null),s.lineWidth(1),s.scissor(0,0,s.canvas.width,s.canvas.height),s.viewport(0,0,s.canvas.width,s.canvas.height),d={},Y=null,J={},p={},g=new WeakMap,x=[],m=null,f=!1,y=null,v=null,M=null,T=null,E=null,b=null,L=null,_=new ie(0,0,0),w=0,U=!1,H=null,K=null,I=null,C=null,P=null,ne.set(0,0,s.canvas.width,s.canvas.height),me.set(0,0,s.canvas.width,s.canvas.height),o.reset(),l.reset(),c.reset()}return{buffers:{color:o,depth:l,stencil:c},enable:Ue,disable:Ee,bindFramebuffer:tt,drawBuffers:W,useProgram:qt,setBlending:pe,setMaterial:gt,setFlipSided:Oe,setCullFace:R,setLineWidth:S,setPolygonOffset:$,setScissorTest:ee,activeTexture:Q,bindTexture:te,unbindTexture:ge,compressedTexImage2D:ce,compressedTexImage3D:ue,texImage2D:ye,texImage3D:de,updateUBOMapping:bt,uniformBlockBinding:We,texStorage2D:Ye,texStorage3D:Le,texSubImage2D:we,texSubImage3D:Be,compressedTexSubImage2D:j,compressedTexSubImage3D:st,scissor:Fe,viewport:it,reset:se}}function Ig(s,e,t,n,i,r,a){let o=i.isWebGL2,l=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,c=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),h=new WeakMap,u,d=new WeakMap,p=!1;try{p=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function g(R,S){return p?new OffscreenCanvas(R,S):Wr("canvas")}function x(R,S,$,ee){let Q=1;if((R.width>ee||R.height>ee)&&(Q=ee/Math.max(R.width,R.height)),Q<1||S===!0)if(typeof HTMLImageElement<"u"&&R instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&R instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&R instanceof ImageBitmap){let te=S?Wo:Math.floor,ge=te(Q*R.width),ce=te(Q*R.height);u===void 0&&(u=g(ge,ce));let ue=$?g(ge,ce):u;return ue.width=ge,ue.height=ce,ue.getContext("2d").drawImage(R,0,0,ge,ce),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+R.width+"x"+R.height+") to ("+ge+"x"+ce+")."),ue}else return"data"in R&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+R.width+"x"+R.height+")."),R;return R}function m(R){return Xc(R.width)&&Xc(R.height)}function f(R){return o?!1:R.wrapS!==yn||R.wrapT!==yn||R.minFilter!==Ot&&R.minFilter!==jt}function y(R,S){return R.generateMipmaps&&S&&R.minFilter!==Ot&&R.minFilter!==jt}function v(R){s.generateMipmap(R)}function M(R,S,$,ee,Q=!1){if(o===!1)return S;if(R!==null){if(s[R]!==void 0)return s[R];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+R+"'")}let te=S;if(S===s.RED&&($===s.FLOAT&&(te=s.R32F),$===s.HALF_FLOAT&&(te=s.R16F),$===s.UNSIGNED_BYTE&&(te=s.R8)),S===s.RED_INTEGER&&($===s.UNSIGNED_BYTE&&(te=s.R8UI),$===s.UNSIGNED_SHORT&&(te=s.R16UI),$===s.UNSIGNED_INT&&(te=s.R32UI),$===s.BYTE&&(te=s.R8I),$===s.SHORT&&(te=s.R16I),$===s.INT&&(te=s.R32I)),S===s.RG&&($===s.FLOAT&&(te=s.RG32F),$===s.HALF_FLOAT&&(te=s.RG16F),$===s.UNSIGNED_BYTE&&(te=s.RG8)),S===s.RGBA){let ge=Q?Or:rt.getTransfer(ee);$===s.FLOAT&&(te=s.RGBA32F),$===s.HALF_FLOAT&&(te=s.RGBA16F),$===s.UNSIGNED_BYTE&&(te=ge===ft?s.SRGB8_ALPHA8:s.RGBA8),$===s.UNSIGNED_SHORT_4_4_4_4&&(te=s.RGBA4),$===s.UNSIGNED_SHORT_5_5_5_1&&(te=s.RGB5_A1)}return(te===s.R16F||te===s.R32F||te===s.RG16F||te===s.RG32F||te===s.RGBA16F||te===s.RGBA32F)&&e.get("EXT_color_buffer_float"),te}function T(R,S,$){return y(R,$)===!0||R.isFramebufferTexture&&R.minFilter!==Ot&&R.minFilter!==jt?Math.log2(Math.max(S.width,S.height))+1:R.mipmaps!==void 0&&R.mipmaps.length>0?R.mipmaps.length:R.isCompressedTexture&&Array.isArray(R.image)?S.mipmaps.length:1}function E(R){return R===Ot||R===pc||R===to?s.NEAREST:s.LINEAR}function b(R){let S=R.target;S.removeEventListener("dispose",b),_(S),S.isVideoTexture&&h.delete(S)}function L(R){let S=R.target;S.removeEventListener("dispose",L),U(S)}function _(R){let S=n.get(R);if(S.__webglInit===void 0)return;let $=R.source,ee=d.get($);if(ee){let Q=ee[S.__cacheKey];Q.usedTimes--,Q.usedTimes===0&&w(R),Object.keys(ee).length===0&&d.delete($)}n.remove(R)}function w(R){let S=n.get(R);s.deleteTexture(S.__webglTexture);let $=R.source,ee=d.get($);delete ee[S.__cacheKey],a.memory.textures--}function U(R){let S=R.texture,$=n.get(R),ee=n.get(S);if(ee.__webglTexture!==void 0&&(s.deleteTexture(ee.__webglTexture),a.memory.textures--),R.depthTexture&&R.depthTexture.dispose(),R.isWebGLCubeRenderTarget)for(let Q=0;Q<6;Q++){if(Array.isArray($.__webglFramebuffer[Q]))for(let te=0;te<$.__webglFramebuffer[Q].length;te++)s.deleteFramebuffer($.__webglFramebuffer[Q][te]);else s.deleteFramebuffer($.__webglFramebuffer[Q]);$.__webglDepthbuffer&&s.deleteRenderbuffer($.__webglDepthbuffer[Q])}else{if(Array.isArray($.__webglFramebuffer))for(let Q=0;Q<$.__webglFramebuffer.length;Q++)s.deleteFramebuffer($.__webglFramebuffer[Q]);else s.deleteFramebuffer($.__webglFramebuffer);if($.__webglDepthbuffer&&s.deleteRenderbuffer($.__webglDepthbuffer),$.__webglMultisampledFramebuffer&&s.deleteFramebuffer($.__webglMultisampledFramebuffer),$.__webglColorRenderbuffer)for(let Q=0;Q<$.__webglColorRenderbuffer.length;Q++)$.__webglColorRenderbuffer[Q]&&s.deleteRenderbuffer($.__webglColorRenderbuffer[Q]);$.__webglDepthRenderbuffer&&s.deleteRenderbuffer($.__webglDepthRenderbuffer)}if(R.isWebGLMultipleRenderTargets)for(let Q=0,te=S.length;Q<te;Q++){let ge=n.get(S[Q]);ge.__webglTexture&&(s.deleteTexture(ge.__webglTexture),a.memory.textures--),n.remove(S[Q])}n.remove(S),n.remove(R)}let H=0;function K(){H=0}function I(){let R=H;return R>=i.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+R+" texture units while this GPU supports only "+i.maxTextures),H+=1,R}function C(R){let S=[];return S.push(R.wrapS),S.push(R.wrapT),S.push(R.wrapR||0),S.push(R.magFilter),S.push(R.minFilter),S.push(R.anisotropy),S.push(R.internalFormat),S.push(R.format),S.push(R.type),S.push(R.generateMipmaps),S.push(R.premultiplyAlpha),S.push(R.flipY),S.push(R.unpackAlignment),S.push(R.colorSpace),S.join()}function P(R,S){let $=n.get(R);if(R.isVideoTexture&&gt(R),R.isRenderTargetTexture===!1&&R.version>0&&$.__version!==R.version){let ee=R.image;if(ee===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(ee.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{ne($,R,S);return}}t.bindTexture(s.TEXTURE_2D,$.__webglTexture,s.TEXTURE0+S)}function N(R,S){let $=n.get(R);if(R.version>0&&$.__version!==R.version){ne($,R,S);return}t.bindTexture(s.TEXTURE_2D_ARRAY,$.__webglTexture,s.TEXTURE0+S)}function F(R,S){let $=n.get(R);if(R.version>0&&$.__version!==R.version){ne($,R,S);return}t.bindTexture(s.TEXTURE_3D,$.__webglTexture,s.TEXTURE0+S)}function z(R,S){let $=n.get(R);if(R.version>0&&$.__version!==R.version){me($,R,S);return}t.bindTexture(s.TEXTURE_CUBE_MAP,$.__webglTexture,s.TEXTURE0+S)}let G={[Oo]:s.REPEAT,[yn]:s.CLAMP_TO_EDGE,[Bo]:s.MIRRORED_REPEAT},Y={[Ot]:s.NEAREST,[pc]:s.NEAREST_MIPMAP_NEAREST,[to]:s.NEAREST_MIPMAP_LINEAR,[jt]:s.LINEAR,[Sd]:s.LINEAR_MIPMAP_NEAREST,[Si]:s.LINEAR_MIPMAP_LINEAR},J={[Ud]:s.NEVER,[Gd]:s.ALWAYS,[Fd]:s.LESS,[eu]:s.LEQUAL,[zd]:s.EQUAL,[Hd]:s.GEQUAL,[Od]:s.GREATER,[Bd]:s.NOTEQUAL};function B(R,S,$){if($?(s.texParameteri(R,s.TEXTURE_WRAP_S,G[S.wrapS]),s.texParameteri(R,s.TEXTURE_WRAP_T,G[S.wrapT]),(R===s.TEXTURE_3D||R===s.TEXTURE_2D_ARRAY)&&s.texParameteri(R,s.TEXTURE_WRAP_R,G[S.wrapR]),s.texParameteri(R,s.TEXTURE_MAG_FILTER,Y[S.magFilter]),s.texParameteri(R,s.TEXTURE_MIN_FILTER,Y[S.minFilter])):(s.texParameteri(R,s.TEXTURE_WRAP_S,s.CLAMP_TO_EDGE),s.texParameteri(R,s.TEXTURE_WRAP_T,s.CLAMP_TO_EDGE),(R===s.TEXTURE_3D||R===s.TEXTURE_2D_ARRAY)&&s.texParameteri(R,s.TEXTURE_WRAP_R,s.CLAMP_TO_EDGE),(S.wrapS!==yn||S.wrapT!==yn)&&console.warn("THREE.WebGLRenderer: Texture is not power of two. Texture.wrapS and Texture.wrapT should be set to THREE.ClampToEdgeWrapping."),s.texParameteri(R,s.TEXTURE_MAG_FILTER,E(S.magFilter)),s.texParameteri(R,s.TEXTURE_MIN_FILTER,E(S.minFilter)),S.minFilter!==Ot&&S.minFilter!==jt&&console.warn("THREE.WebGLRenderer: Texture is not power of two. Texture.minFilter should be set to THREE.NearestFilter or THREE.LinearFilter.")),S.compareFunction&&(s.texParameteri(R,s.TEXTURE_COMPARE_MODE,s.COMPARE_REF_TO_TEXTURE),s.texParameteri(R,s.TEXTURE_COMPARE_FUNC,J[S.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){let ee=e.get("EXT_texture_filter_anisotropic");if(S.magFilter===Ot||S.minFilter!==to&&S.minFilter!==Si||S.type===ti&&e.has("OES_texture_float_linear")===!1||o===!1&&S.type===Ls&&e.has("OES_texture_half_float_linear")===!1)return;(S.anisotropy>1||n.get(S).__currentAnisotropy)&&(s.texParameterf(R,ee.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(S.anisotropy,i.getMaxAnisotropy())),n.get(S).__currentAnisotropy=S.anisotropy)}}function Z(R,S){let $=!1;R.__webglInit===void 0&&(R.__webglInit=!0,S.addEventListener("dispose",b));let ee=S.source,Q=d.get(ee);Q===void 0&&(Q={},d.set(ee,Q));let te=C(S);if(te!==R.__cacheKey){Q[te]===void 0&&(Q[te]={texture:s.createTexture(),usedTimes:0},a.memory.textures++,$=!0),Q[te].usedTimes++;let ge=Q[R.__cacheKey];ge!==void 0&&(Q[R.__cacheKey].usedTimes--,ge.usedTimes===0&&w(S)),R.__cacheKey=te,R.__webglTexture=Q[te].texture}return $}function ne(R,S,$){let ee=s.TEXTURE_2D;(S.isDataArrayTexture||S.isCompressedArrayTexture)&&(ee=s.TEXTURE_2D_ARRAY),S.isData3DTexture&&(ee=s.TEXTURE_3D);let Q=Z(R,S),te=S.source;t.bindTexture(ee,R.__webglTexture,s.TEXTURE0+$);let ge=n.get(te);if(te.version!==ge.__version||Q===!0){t.activeTexture(s.TEXTURE0+$);let ce=rt.getPrimaries(rt.workingColorSpace),ue=S.colorSpace===pn?null:rt.getPrimaries(S.colorSpace),we=S.colorSpace===pn||ce===ue?s.NONE:s.BROWSER_DEFAULT_WEBGL;s.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,S.flipY),s.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,S.premultiplyAlpha),s.pixelStorei(s.UNPACK_ALIGNMENT,S.unpackAlignment),s.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,we);let Be=f(S)&&m(S.image)===!1,j=x(S.image,Be,!1,i.maxTextureSize);j=Oe(S,j);let st=m(j)||o,Ye=r.convert(S.format,S.colorSpace),Le=r.convert(S.type),ye=M(S.internalFormat,Ye,Le,S.colorSpace,S.isVideoTexture);B(ee,S,st);let de,Fe=S.mipmaps,it=o&&S.isVideoTexture!==!0&&ye!==Jh,bt=ge.__version===void 0||Q===!0,We=T(S,j,st);if(S.isDepthTexture)ye=s.DEPTH_COMPONENT,o?S.type===ti?ye=s.DEPTH_COMPONENT32F:S.type===ei?ye=s.DEPTH_COMPONENT24:S.type===bi?ye=s.DEPTH24_STENCIL8:ye=s.DEPTH_COMPONENT16:S.type===ti&&console.error("WebGLRenderer: Floating point depth texture requires WebGL2."),S.format===Mi&&ye===s.DEPTH_COMPONENT&&S.type!==wl&&S.type!==ei&&(console.warn("THREE.WebGLRenderer: Use UnsignedShortType or UnsignedIntType for DepthFormat DepthTexture."),S.type=ei,Le=r.convert(S.type)),S.format===ss&&ye===s.DEPTH_COMPONENT&&(ye=s.DEPTH_STENCIL,S.type!==bi&&(console.warn("THREE.WebGLRenderer: Use UnsignedInt248Type for DepthStencilFormat DepthTexture."),S.type=bi,Le=r.convert(S.type))),bt&&(it?t.texStorage2D(s.TEXTURE_2D,1,ye,j.width,j.height):t.texImage2D(s.TEXTURE_2D,0,ye,j.width,j.height,0,Ye,Le,null));else if(S.isDataTexture)if(Fe.length>0&&st){it&&bt&&t.texStorage2D(s.TEXTURE_2D,We,ye,Fe[0].width,Fe[0].height);for(let se=0,D=Fe.length;se<D;se++)de=Fe[se],it?t.texSubImage2D(s.TEXTURE_2D,se,0,0,de.width,de.height,Ye,Le,de.data):t.texImage2D(s.TEXTURE_2D,se,ye,de.width,de.height,0,Ye,Le,de.data);S.generateMipmaps=!1}else it?(bt&&t.texStorage2D(s.TEXTURE_2D,We,ye,j.width,j.height),t.texSubImage2D(s.TEXTURE_2D,0,0,0,j.width,j.height,Ye,Le,j.data)):t.texImage2D(s.TEXTURE_2D,0,ye,j.width,j.height,0,Ye,Le,j.data);else if(S.isCompressedTexture)if(S.isCompressedArrayTexture){it&&bt&&t.texStorage3D(s.TEXTURE_2D_ARRAY,We,ye,Fe[0].width,Fe[0].height,j.depth);for(let se=0,D=Fe.length;se<D;se++)de=Fe[se],S.format!==ln?Ye!==null?it?t.compressedTexSubImage3D(s.TEXTURE_2D_ARRAY,se,0,0,0,de.width,de.height,j.depth,Ye,de.data,0,0):t.compressedTexImage3D(s.TEXTURE_2D_ARRAY,se,ye,de.width,de.height,j.depth,0,de.data,0,0):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):it?t.texSubImage3D(s.TEXTURE_2D_ARRAY,se,0,0,0,de.width,de.height,j.depth,Ye,Le,de.data):t.texImage3D(s.TEXTURE_2D_ARRAY,se,ye,de.width,de.height,j.depth,0,Ye,Le,de.data)}else{it&&bt&&t.texStorage2D(s.TEXTURE_2D,We,ye,Fe[0].width,Fe[0].height);for(let se=0,D=Fe.length;se<D;se++)de=Fe[se],S.format!==ln?Ye!==null?it?t.compressedTexSubImage2D(s.TEXTURE_2D,se,0,0,de.width,de.height,Ye,de.data):t.compressedTexImage2D(s.TEXTURE_2D,se,ye,de.width,de.height,0,de.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):it?t.texSubImage2D(s.TEXTURE_2D,se,0,0,de.width,de.height,Ye,Le,de.data):t.texImage2D(s.TEXTURE_2D,se,ye,de.width,de.height,0,Ye,Le,de.data)}else if(S.isDataArrayTexture)it?(bt&&t.texStorage3D(s.TEXTURE_2D_ARRAY,We,ye,j.width,j.height,j.depth),t.texSubImage3D(s.TEXTURE_2D_ARRAY,0,0,0,0,j.width,j.height,j.depth,Ye,Le,j.data)):t.texImage3D(s.TEXTURE_2D_ARRAY,0,ye,j.width,j.height,j.depth,0,Ye,Le,j.data);else if(S.isData3DTexture)it?(bt&&t.texStorage3D(s.TEXTURE_3D,We,ye,j.width,j.height,j.depth),t.texSubImage3D(s.TEXTURE_3D,0,0,0,0,j.width,j.height,j.depth,Ye,Le,j.data)):t.texImage3D(s.TEXTURE_3D,0,ye,j.width,j.height,j.depth,0,Ye,Le,j.data);else if(S.isFramebufferTexture){if(bt)if(it)t.texStorage2D(s.TEXTURE_2D,We,ye,j.width,j.height);else{let se=j.width,D=j.height;for(let ae=0;ae<We;ae++)t.texImage2D(s.TEXTURE_2D,ae,ye,se,D,0,Ye,Le,null),se>>=1,D>>=1}}else if(Fe.length>0&&st){it&&bt&&t.texStorage2D(s.TEXTURE_2D,We,ye,Fe[0].width,Fe[0].height);for(let se=0,D=Fe.length;se<D;se++)de=Fe[se],it?t.texSubImage2D(s.TEXTURE_2D,se,0,0,Ye,Le,de):t.texImage2D(s.TEXTURE_2D,se,ye,Ye,Le,de);S.generateMipmaps=!1}else it?(bt&&t.texStorage2D(s.TEXTURE_2D,We,ye,j.width,j.height),t.texSubImage2D(s.TEXTURE_2D,0,0,0,Ye,Le,j)):t.texImage2D(s.TEXTURE_2D,0,ye,Ye,Le,j);y(S,st)&&v(ee),ge.__version=te.version,S.onUpdate&&S.onUpdate(S)}R.__version=S.version}function me(R,S,$){if(S.image.length!==6)return;let ee=Z(R,S),Q=S.source;t.bindTexture(s.TEXTURE_CUBE_MAP,R.__webglTexture,s.TEXTURE0+$);let te=n.get(Q);if(Q.version!==te.__version||ee===!0){t.activeTexture(s.TEXTURE0+$);let ge=rt.getPrimaries(rt.workingColorSpace),ce=S.colorSpace===pn?null:rt.getPrimaries(S.colorSpace),ue=S.colorSpace===pn||ge===ce?s.NONE:s.BROWSER_DEFAULT_WEBGL;s.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,S.flipY),s.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,S.premultiplyAlpha),s.pixelStorei(s.UNPACK_ALIGNMENT,S.unpackAlignment),s.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,ue);let we=S.isCompressedTexture||S.image[0].isCompressedTexture,Be=S.image[0]&&S.image[0].isDataTexture,j=[];for(let se=0;se<6;se++)!we&&!Be?j[se]=x(S.image[se],!1,!0,i.maxCubemapSize):j[se]=Be?S.image[se].image:S.image[se],j[se]=Oe(S,j[se]);let st=j[0],Ye=m(st)||o,Le=r.convert(S.format,S.colorSpace),ye=r.convert(S.type),de=M(S.internalFormat,Le,ye,S.colorSpace),Fe=o&&S.isVideoTexture!==!0,it=te.__version===void 0||ee===!0,bt=T(S,st,Ye);B(s.TEXTURE_CUBE_MAP,S,Ye);let We;if(we){Fe&&it&&t.texStorage2D(s.TEXTURE_CUBE_MAP,bt,de,st.width,st.height);for(let se=0;se<6;se++){We=j[se].mipmaps;for(let D=0;D<We.length;D++){let ae=We[D];S.format!==ln?Le!==null?Fe?t.compressedTexSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+se,D,0,0,ae.width,ae.height,Le,ae.data):t.compressedTexImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+se,D,de,ae.width,ae.height,0,ae.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):Fe?t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+se,D,0,0,ae.width,ae.height,Le,ye,ae.data):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+se,D,de,ae.width,ae.height,0,Le,ye,ae.data)}}}else{We=S.mipmaps,Fe&&it&&(We.length>0&&bt++,t.texStorage2D(s.TEXTURE_CUBE_MAP,bt,de,j[0].width,j[0].height));for(let se=0;se<6;se++)if(Be){Fe?t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+se,0,0,0,j[se].width,j[se].height,Le,ye,j[se].data):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+se,0,de,j[se].width,j[se].height,0,Le,ye,j[se].data);for(let D=0;D<We.length;D++){let oe=We[D].image[se].image;Fe?t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+se,D+1,0,0,oe.width,oe.height,Le,ye,oe.data):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+se,D+1,de,oe.width,oe.height,0,Le,ye,oe.data)}}else{Fe?t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+se,0,0,0,Le,ye,j[se]):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+se,0,de,Le,ye,j[se]);for(let D=0;D<We.length;D++){let ae=We[D];Fe?t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+se,D+1,0,0,Le,ye,ae.image[se]):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+se,D+1,de,Le,ye,ae.image[se])}}}y(S,Ye)&&v(s.TEXTURE_CUBE_MAP),te.__version=Q.version,S.onUpdate&&S.onUpdate(S)}R.__version=S.version}function fe(R,S,$,ee,Q,te){let ge=r.convert($.format,$.colorSpace),ce=r.convert($.type),ue=M($.internalFormat,ge,ce,$.colorSpace);if(!n.get(S).__hasExternalTextures){let Be=Math.max(1,S.width>>te),j=Math.max(1,S.height>>te);Q===s.TEXTURE_3D||Q===s.TEXTURE_2D_ARRAY?t.texImage3D(Q,te,ue,Be,j,S.depth,0,ge,ce,null):t.texImage2D(Q,te,ue,Be,j,0,ge,ce,null)}t.bindFramebuffer(s.FRAMEBUFFER,R),pe(S)?l.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,ee,Q,n.get($).__webglTexture,0,De(S)):(Q===s.TEXTURE_2D||Q>=s.TEXTURE_CUBE_MAP_POSITIVE_X&&Q<=s.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&s.framebufferTexture2D(s.FRAMEBUFFER,ee,Q,n.get($).__webglTexture,te),t.bindFramebuffer(s.FRAMEBUFFER,null)}function Pe(R,S,$){if(s.bindRenderbuffer(s.RENDERBUFFER,R),S.depthBuffer&&!S.stencilBuffer){let ee=o===!0?s.DEPTH_COMPONENT24:s.DEPTH_COMPONENT16;if($||pe(S)){let Q=S.depthTexture;Q&&Q.isDepthTexture&&(Q.type===ti?ee=s.DEPTH_COMPONENT32F:Q.type===ei&&(ee=s.DEPTH_COMPONENT24));let te=De(S);pe(S)?l.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,te,ee,S.width,S.height):s.renderbufferStorageMultisample(s.RENDERBUFFER,te,ee,S.width,S.height)}else s.renderbufferStorage(s.RENDERBUFFER,ee,S.width,S.height);s.framebufferRenderbuffer(s.FRAMEBUFFER,s.DEPTH_ATTACHMENT,s.RENDERBUFFER,R)}else if(S.depthBuffer&&S.stencilBuffer){let ee=De(S);$&&pe(S)===!1?s.renderbufferStorageMultisample(s.RENDERBUFFER,ee,s.DEPTH24_STENCIL8,S.width,S.height):pe(S)?l.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,ee,s.DEPTH24_STENCIL8,S.width,S.height):s.renderbufferStorage(s.RENDERBUFFER,s.DEPTH_STENCIL,S.width,S.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.DEPTH_STENCIL_ATTACHMENT,s.RENDERBUFFER,R)}else{let ee=S.isWebGLMultipleRenderTargets===!0?S.texture:[S.texture];for(let Q=0;Q<ee.length;Q++){let te=ee[Q],ge=r.convert(te.format,te.colorSpace),ce=r.convert(te.type),ue=M(te.internalFormat,ge,ce,te.colorSpace),we=De(S);$&&pe(S)===!1?s.renderbufferStorageMultisample(s.RENDERBUFFER,we,ue,S.width,S.height):pe(S)?l.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,we,ue,S.width,S.height):s.renderbufferStorage(s.RENDERBUFFER,ue,S.width,S.height)}}s.bindRenderbuffer(s.RENDERBUFFER,null)}function Ue(R,S){if(S&&S.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(t.bindFramebuffer(s.FRAMEBUFFER,R),!(S.depthTexture&&S.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");(!n.get(S.depthTexture).__webglTexture||S.depthTexture.image.width!==S.width||S.depthTexture.image.height!==S.height)&&(S.depthTexture.image.width=S.width,S.depthTexture.image.height=S.height,S.depthTexture.needsUpdate=!0),P(S.depthTexture,0);let ee=n.get(S.depthTexture).__webglTexture,Q=De(S);if(S.depthTexture.format===Mi)pe(S)?l.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,s.DEPTH_ATTACHMENT,s.TEXTURE_2D,ee,0,Q):s.framebufferTexture2D(s.FRAMEBUFFER,s.DEPTH_ATTACHMENT,s.TEXTURE_2D,ee,0);else if(S.depthTexture.format===ss)pe(S)?l.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,s.DEPTH_STENCIL_ATTACHMENT,s.TEXTURE_2D,ee,0,Q):s.framebufferTexture2D(s.FRAMEBUFFER,s.DEPTH_STENCIL_ATTACHMENT,s.TEXTURE_2D,ee,0);else throw new Error("Unknown depthTexture format")}function Ee(R){let S=n.get(R),$=R.isWebGLCubeRenderTarget===!0;if(R.depthTexture&&!S.__autoAllocateDepthBuffer){if($)throw new Error("target.depthTexture not supported in Cube render targets");Ue(S.__webglFramebuffer,R)}else if($){S.__webglDepthbuffer=[];for(let ee=0;ee<6;ee++)t.bindFramebuffer(s.FRAMEBUFFER,S.__webglFramebuffer[ee]),S.__webglDepthbuffer[ee]=s.createRenderbuffer(),Pe(S.__webglDepthbuffer[ee],R,!1)}else t.bindFramebuffer(s.FRAMEBUFFER,S.__webglFramebuffer),S.__webglDepthbuffer=s.createRenderbuffer(),Pe(S.__webglDepthbuffer,R,!1);t.bindFramebuffer(s.FRAMEBUFFER,null)}function tt(R,S,$){let ee=n.get(R);S!==void 0&&fe(ee.__webglFramebuffer,R,R.texture,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,0),$!==void 0&&Ee(R)}function W(R){let S=R.texture,$=n.get(R),ee=n.get(S);R.addEventListener("dispose",L),R.isWebGLMultipleRenderTargets!==!0&&(ee.__webglTexture===void 0&&(ee.__webglTexture=s.createTexture()),ee.__version=S.version,a.memory.textures++);let Q=R.isWebGLCubeRenderTarget===!0,te=R.isWebGLMultipleRenderTargets===!0,ge=m(R)||o;if(Q){$.__webglFramebuffer=[];for(let ce=0;ce<6;ce++)if(o&&S.mipmaps&&S.mipmaps.length>0){$.__webglFramebuffer[ce]=[];for(let ue=0;ue<S.mipmaps.length;ue++)$.__webglFramebuffer[ce][ue]=s.createFramebuffer()}else $.__webglFramebuffer[ce]=s.createFramebuffer()}else{if(o&&S.mipmaps&&S.mipmaps.length>0){$.__webglFramebuffer=[];for(let ce=0;ce<S.mipmaps.length;ce++)$.__webglFramebuffer[ce]=s.createFramebuffer()}else $.__webglFramebuffer=s.createFramebuffer();if(te)if(i.drawBuffers){let ce=R.texture;for(let ue=0,we=ce.length;ue<we;ue++){let Be=n.get(ce[ue]);Be.__webglTexture===void 0&&(Be.__webglTexture=s.createTexture(),a.memory.textures++)}}else console.warn("THREE.WebGLRenderer: WebGLMultipleRenderTargets can only be used with WebGL2 or WEBGL_draw_buffers extension.");if(o&&R.samples>0&&pe(R)===!1){let ce=te?S:[S];$.__webglMultisampledFramebuffer=s.createFramebuffer(),$.__webglColorRenderbuffer=[],t.bindFramebuffer(s.FRAMEBUFFER,$.__webglMultisampledFramebuffer);for(let ue=0;ue<ce.length;ue++){let we=ce[ue];$.__webglColorRenderbuffer[ue]=s.createRenderbuffer(),s.bindRenderbuffer(s.RENDERBUFFER,$.__webglColorRenderbuffer[ue]);let Be=r.convert(we.format,we.colorSpace),j=r.convert(we.type),st=M(we.internalFormat,Be,j,we.colorSpace,R.isXRRenderTarget===!0),Ye=De(R);s.renderbufferStorageMultisample(s.RENDERBUFFER,Ye,st,R.width,R.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+ue,s.RENDERBUFFER,$.__webglColorRenderbuffer[ue])}s.bindRenderbuffer(s.RENDERBUFFER,null),R.depthBuffer&&($.__webglDepthRenderbuffer=s.createRenderbuffer(),Pe($.__webglDepthRenderbuffer,R,!0)),t.bindFramebuffer(s.FRAMEBUFFER,null)}}if(Q){t.bindTexture(s.TEXTURE_CUBE_MAP,ee.__webglTexture),B(s.TEXTURE_CUBE_MAP,S,ge);for(let ce=0;ce<6;ce++)if(o&&S.mipmaps&&S.mipmaps.length>0)for(let ue=0;ue<S.mipmaps.length;ue++)fe($.__webglFramebuffer[ce][ue],R,S,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+ce,ue);else fe($.__webglFramebuffer[ce],R,S,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+ce,0);y(S,ge)&&v(s.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(te){let ce=R.texture;for(let ue=0,we=ce.length;ue<we;ue++){let Be=ce[ue],j=n.get(Be);t.bindTexture(s.TEXTURE_2D,j.__webglTexture),B(s.TEXTURE_2D,Be,ge),fe($.__webglFramebuffer,R,Be,s.COLOR_ATTACHMENT0+ue,s.TEXTURE_2D,0),y(Be,ge)&&v(s.TEXTURE_2D)}t.unbindTexture()}else{let ce=s.TEXTURE_2D;if((R.isWebGL3DRenderTarget||R.isWebGLArrayRenderTarget)&&(o?ce=R.isWebGL3DRenderTarget?s.TEXTURE_3D:s.TEXTURE_2D_ARRAY:console.error("THREE.WebGLTextures: THREE.Data3DTexture and THREE.DataArrayTexture only supported with WebGL2.")),t.bindTexture(ce,ee.__webglTexture),B(ce,S,ge),o&&S.mipmaps&&S.mipmaps.length>0)for(let ue=0;ue<S.mipmaps.length;ue++)fe($.__webglFramebuffer[ue],R,S,s.COLOR_ATTACHMENT0,ce,ue);else fe($.__webglFramebuffer,R,S,s.COLOR_ATTACHMENT0,ce,0);y(S,ge)&&v(ce),t.unbindTexture()}R.depthBuffer&&Ee(R)}function qt(R){let S=m(R)||o,$=R.isWebGLMultipleRenderTargets===!0?R.texture:[R.texture];for(let ee=0,Q=$.length;ee<Q;ee++){let te=$[ee];if(y(te,S)){let ge=R.isWebGLCubeRenderTarget?s.TEXTURE_CUBE_MAP:s.TEXTURE_2D,ce=n.get(te).__webglTexture;t.bindTexture(ge,ce),v(ge),t.unbindTexture()}}}function _e(R){if(o&&R.samples>0&&pe(R)===!1){let S=R.isWebGLMultipleRenderTargets?R.texture:[R.texture],$=R.width,ee=R.height,Q=s.COLOR_BUFFER_BIT,te=[],ge=R.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,ce=n.get(R),ue=R.isWebGLMultipleRenderTargets===!0;if(ue)for(let we=0;we<S.length;we++)t.bindFramebuffer(s.FRAMEBUFFER,ce.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+we,s.RENDERBUFFER,null),t.bindFramebuffer(s.FRAMEBUFFER,ce.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+we,s.TEXTURE_2D,null,0);t.bindFramebuffer(s.READ_FRAMEBUFFER,ce.__webglMultisampledFramebuffer),t.bindFramebuffer(s.DRAW_FRAMEBUFFER,ce.__webglFramebuffer);for(let we=0;we<S.length;we++){te.push(s.COLOR_ATTACHMENT0+we),R.depthBuffer&&te.push(ge);let Be=ce.__ignoreDepthValues!==void 0?ce.__ignoreDepthValues:!1;if(Be===!1&&(R.depthBuffer&&(Q|=s.DEPTH_BUFFER_BIT),R.stencilBuffer&&(Q|=s.STENCIL_BUFFER_BIT)),ue&&s.framebufferRenderbuffer(s.READ_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.RENDERBUFFER,ce.__webglColorRenderbuffer[we]),Be===!0&&(s.invalidateFramebuffer(s.READ_FRAMEBUFFER,[ge]),s.invalidateFramebuffer(s.DRAW_FRAMEBUFFER,[ge])),ue){let j=n.get(S[we]).__webglTexture;s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,j,0)}s.blitFramebuffer(0,0,$,ee,0,0,$,ee,Q,s.NEAREST),c&&s.invalidateFramebuffer(s.READ_FRAMEBUFFER,te)}if(t.bindFramebuffer(s.READ_FRAMEBUFFER,null),t.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),ue)for(let we=0;we<S.length;we++){t.bindFramebuffer(s.FRAMEBUFFER,ce.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+we,s.RENDERBUFFER,ce.__webglColorRenderbuffer[we]);let Be=n.get(S[we]).__webglTexture;t.bindFramebuffer(s.FRAMEBUFFER,ce.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+we,s.TEXTURE_2D,Be,0)}t.bindFramebuffer(s.DRAW_FRAMEBUFFER,ce.__webglMultisampledFramebuffer)}}function De(R){return Math.min(i.maxSamples,R.samples)}function pe(R){let S=n.get(R);return o&&R.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&S.__useRenderToTexture!==!1}function gt(R){let S=a.render.frame;h.get(R)!==S&&(h.set(R,S),R.update())}function Oe(R,S){let $=R.colorSpace,ee=R.format,Q=R.type;return R.isCompressedTexture===!0||R.isVideoTexture===!0||R.format===Ho||$!==Fn&&$!==pn&&(rt.getTransfer($)===ft?o===!1?e.has("EXT_sRGB")===!0&&ee===ln?(R.format=Ho,R.minFilter=jt,R.generateMipmaps=!1):S=Vr.sRGBToLinear(S):(ee!==ln||Q!==ri)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",$)),S}this.allocateTextureUnit=I,this.resetTextureUnits=K,this.setTexture2D=P,this.setTexture2DArray=N,this.setTexture3D=F,this.setTextureCube=z,this.rebindTextures=tt,this.setupRenderTarget=W,this.updateRenderTargetMipmap=qt,this.updateMultisampleRenderTarget=_e,this.setupDepthRenderbuffer=Ee,this.setupFrameBufferTexture=fe,this.useMultisampledRTT=pe}function Dg(s,e,t){let n=t.isWebGL2;function i(r,a=pn){let o,l=rt.getTransfer(a);if(r===ri)return s.UNSIGNED_BYTE;if(r===Xh)return s.UNSIGNED_SHORT_4_4_4_4;if(r===qh)return s.UNSIGNED_SHORT_5_5_5_1;if(r===Ed)return s.BYTE;if(r===Td)return s.SHORT;if(r===wl)return s.UNSIGNED_SHORT;if(r===$h)return s.INT;if(r===ei)return s.UNSIGNED_INT;if(r===ti)return s.FLOAT;if(r===Ls)return n?s.HALF_FLOAT:(o=e.get("OES_texture_half_float"),o!==null?o.HALF_FLOAT_OES:null);if(r===Ad)return s.ALPHA;if(r===ln)return s.RGBA;if(r===Rd)return s.LUMINANCE;if(r===Cd)return s.LUMINANCE_ALPHA;if(r===Mi)return s.DEPTH_COMPONENT;if(r===ss)return s.DEPTH_STENCIL;if(r===Ho)return o=e.get("EXT_sRGB"),o!==null?o.SRGB_ALPHA_EXT:null;if(r===Pd)return s.RED;if(r===Yh)return s.RED_INTEGER;if(r===Ld)return s.RG;if(r===Zh)return s.RG_INTEGER;if(r===Kh)return s.RGBA_INTEGER;if(r===no||r===io||r===so||r===ro)if(l===ft)if(o=e.get("WEBGL_compressed_texture_s3tc_srgb"),o!==null){if(r===no)return o.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(r===io)return o.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(r===so)return o.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(r===ro)return o.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(o=e.get("WEBGL_compressed_texture_s3tc"),o!==null){if(r===no)return o.COMPRESSED_RGB_S3TC_DXT1_EXT;if(r===io)return o.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(r===so)return o.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(r===ro)return o.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(r===mc||r===gc||r===xc||r===vc)if(o=e.get("WEBGL_compressed_texture_pvrtc"),o!==null){if(r===mc)return o.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(r===gc)return o.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(r===xc)return o.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(r===vc)return o.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(r===Jh)return o=e.get("WEBGL_compressed_texture_etc1"),o!==null?o.COMPRESSED_RGB_ETC1_WEBGL:null;if(r===yc||r===_c)if(o=e.get("WEBGL_compressed_texture_etc"),o!==null){if(r===yc)return l===ft?o.COMPRESSED_SRGB8_ETC2:o.COMPRESSED_RGB8_ETC2;if(r===_c)return l===ft?o.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:o.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(r===bc||r===Mc||r===wc||r===Sc||r===Ec||r===Tc||r===Ac||r===Rc||r===Cc||r===Pc||r===Lc||r===Ic||r===Dc||r===kc)if(o=e.get("WEBGL_compressed_texture_astc"),o!==null){if(r===bc)return l===ft?o.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:o.COMPRESSED_RGBA_ASTC_4x4_KHR;if(r===Mc)return l===ft?o.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:o.COMPRESSED_RGBA_ASTC_5x4_KHR;if(r===wc)return l===ft?o.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:o.COMPRESSED_RGBA_ASTC_5x5_KHR;if(r===Sc)return l===ft?o.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:o.COMPRESSED_RGBA_ASTC_6x5_KHR;if(r===Ec)return l===ft?o.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:o.COMPRESSED_RGBA_ASTC_6x6_KHR;if(r===Tc)return l===ft?o.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:o.COMPRESSED_RGBA_ASTC_8x5_KHR;if(r===Ac)return l===ft?o.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:o.COMPRESSED_RGBA_ASTC_8x6_KHR;if(r===Rc)return l===ft?o.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:o.COMPRESSED_RGBA_ASTC_8x8_KHR;if(r===Cc)return l===ft?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:o.COMPRESSED_RGBA_ASTC_10x5_KHR;if(r===Pc)return l===ft?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:o.COMPRESSED_RGBA_ASTC_10x6_KHR;if(r===Lc)return l===ft?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:o.COMPRESSED_RGBA_ASTC_10x8_KHR;if(r===Ic)return l===ft?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:o.COMPRESSED_RGBA_ASTC_10x10_KHR;if(r===Dc)return l===ft?o.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:o.COMPRESSED_RGBA_ASTC_12x10_KHR;if(r===kc)return l===ft?o.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:o.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(r===ao||r===Nc||r===Uc)if(o=e.get("EXT_texture_compression_bptc"),o!==null){if(r===ao)return l===ft?o.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:o.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(r===Nc)return o.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(r===Uc)return o.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(r===Id||r===Fc||r===zc||r===Oc)if(o=e.get("EXT_texture_compression_rgtc"),o!==null){if(r===ao)return o.COMPRESSED_RED_RGTC1_EXT;if(r===Fc)return o.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(r===zc)return o.COMPRESSED_RED_GREEN_RGTC2_EXT;if(r===Oc)return o.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return r===bi?n?s.UNSIGNED_INT_24_8:(o=e.get("WEBGL_depth_texture"),o!==null?o.UNSIGNED_INT_24_8_WEBGL:null):s[r]!==void 0?s[r]:null}return{convert:i}}var nl=class extends Qt{constructor(e=[]){super(),this.isArrayCamera=!0,this.cameras=e}},Tt=class extends Ht{constructor(){super(),this.isGroup=!0,this.type="Group"}},kg={type:"move"},Ps=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Tt,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Tt,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new k,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new k),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Tt,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new k,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new k),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let i=null,r=null,a=null,o=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){a=!0;for(let x of e.hand.values()){let m=t.getJointPose(x,n),f=this._getHandJoint(c,x);m!==null&&(f.matrix.fromArray(m.transform.matrix),f.matrix.decompose(f.position,f.rotation,f.scale),f.matrixWorldNeedsUpdate=!0,f.jointRadius=m.radius),f.visible=m!==null}let h=c.joints["index-finger-tip"],u=c.joints["thumb-tip"],d=h.position.distanceTo(u.position),p=.02,g=.005;c.inputState.pinching&&d>p+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&d<=p-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(r=t.getPose(e.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1));o!==null&&(i=t.getPose(e.targetRaySpace,n),i===null&&r!==null&&(i=r),i!==null&&(o.matrix.fromArray(i.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,i.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(i.linearVelocity)):o.hasLinearVelocity=!1,i.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(i.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(kg)))}return o!==null&&(o.visible=i!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let n=new Tt;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}},il=class extends oi{constructor(e,t){super();let n=this,i=null,r=1,a=null,o="local-floor",l=1,c=null,h=null,u=null,d=null,p=null,g=null,x=t.getContextAttributes(),m=null,f=null,y=[],v=[],M=new Ge,T=null,E=new Qt;E.layers.enable(1),E.viewport=new Ut;let b=new Qt;b.layers.enable(2),b.viewport=new Ut;let L=[E,b],_=new nl;_.layers.enable(1),_.layers.enable(2);let w=null,U=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(B){let Z=y[B];return Z===void 0&&(Z=new Ps,y[B]=Z),Z.getTargetRaySpace()},this.getControllerGrip=function(B){let Z=y[B];return Z===void 0&&(Z=new Ps,y[B]=Z),Z.getGripSpace()},this.getHand=function(B){let Z=y[B];return Z===void 0&&(Z=new Ps,y[B]=Z),Z.getHandSpace()};function H(B){let Z=v.indexOf(B.inputSource);if(Z===-1)return;let ne=y[Z];ne!==void 0&&(ne.update(B.inputSource,B.frame,c||a),ne.dispatchEvent({type:B.type,data:B.inputSource}))}function K(){i.removeEventListener("select",H),i.removeEventListener("selectstart",H),i.removeEventListener("selectend",H),i.removeEventListener("squeeze",H),i.removeEventListener("squeezestart",H),i.removeEventListener("squeezeend",H),i.removeEventListener("end",K),i.removeEventListener("inputsourceschange",I);for(let B=0;B<y.length;B++){let Z=v[B];Z!==null&&(v[B]=null,y[B].disconnect(Z))}w=null,U=null,e.setRenderTarget(m),p=null,d=null,u=null,i=null,f=null,J.stop(),n.isPresenting=!1,e.setPixelRatio(T),e.setSize(M.width,M.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(B){r=B,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(B){o=B,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(B){c=B},this.getBaseLayer=function(){return d!==null?d:p},this.getBinding=function(){return u},this.getFrame=function(){return g},this.getSession=function(){return i},this.setSession=async function(B){if(i=B,i!==null){if(m=e.getRenderTarget(),i.addEventListener("select",H),i.addEventListener("selectstart",H),i.addEventListener("selectend",H),i.addEventListener("squeeze",H),i.addEventListener("squeezestart",H),i.addEventListener("squeezeend",H),i.addEventListener("end",K),i.addEventListener("inputsourceschange",I),x.xrCompatible!==!0&&await t.makeXRCompatible(),T=e.getPixelRatio(),e.getSize(M),i.renderState.layers===void 0||e.capabilities.isWebGL2===!1){let Z={antialias:i.renderState.layers===void 0?x.antialias:!0,alpha:!0,depth:x.depth,stencil:x.stencil,framebufferScaleFactor:r};p=new XRWebGLLayer(i,t,Z),i.updateRenderState({baseLayer:p}),e.setPixelRatio(1),e.setSize(p.framebufferWidth,p.framebufferHeight,!1),f=new zn(p.framebufferWidth,p.framebufferHeight,{format:ln,type:ri,colorSpace:e.outputColorSpace,stencilBuffer:x.stencil})}else{let Z=null,ne=null,me=null;x.depth&&(me=x.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,Z=x.stencil?ss:Mi,ne=x.stencil?bi:ei);let fe={colorFormat:t.RGBA8,depthFormat:me,scaleFactor:r};u=new XRWebGLBinding(i,t),d=u.createProjectionLayer(fe),i.updateRenderState({layers:[d]}),e.setPixelRatio(1),e.setSize(d.textureWidth,d.textureHeight,!1),f=new zn(d.textureWidth,d.textureHeight,{format:ln,type:ri,depthTexture:new Qr(d.textureWidth,d.textureHeight,ne,void 0,void 0,void 0,void 0,void 0,void 0,Z),stencilBuffer:x.stencil,colorSpace:e.outputColorSpace,samples:x.antialias?4:0});let Pe=e.properties.get(f);Pe.__ignoreDepthValues=d.ignoreDepthValues}f.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await i.requestReferenceSpace(o),J.setContext(i),J.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(i!==null)return i.environmentBlendMode};function I(B){for(let Z=0;Z<B.removed.length;Z++){let ne=B.removed[Z],me=v.indexOf(ne);me>=0&&(v[me]=null,y[me].disconnect(ne))}for(let Z=0;Z<B.added.length;Z++){let ne=B.added[Z],me=v.indexOf(ne);if(me===-1){for(let Pe=0;Pe<y.length;Pe++)if(Pe>=v.length){v.push(ne),me=Pe;break}else if(v[Pe]===null){v[Pe]=ne,me=Pe;break}if(me===-1)break}let fe=y[me];fe&&fe.connect(ne)}}let C=new k,P=new k;function N(B,Z,ne){C.setFromMatrixPosition(Z.matrixWorld),P.setFromMatrixPosition(ne.matrixWorld);let me=C.distanceTo(P),fe=Z.projectionMatrix.elements,Pe=ne.projectionMatrix.elements,Ue=fe[14]/(fe[10]-1),Ee=fe[14]/(fe[10]+1),tt=(fe[9]+1)/fe[5],W=(fe[9]-1)/fe[5],qt=(fe[8]-1)/fe[0],_e=(Pe[8]+1)/Pe[0],De=Ue*qt,pe=Ue*_e,gt=me/(-qt+_e),Oe=gt*-qt;Z.matrixWorld.decompose(B.position,B.quaternion,B.scale),B.translateX(Oe),B.translateZ(gt),B.matrixWorld.compose(B.position,B.quaternion,B.scale),B.matrixWorldInverse.copy(B.matrixWorld).invert();let R=Ue+gt,S=Ee+gt,$=De-Oe,ee=pe+(me-Oe),Q=tt*Ee/S*R,te=W*Ee/S*R;B.projectionMatrix.makePerspective($,ee,Q,te,R,S),B.projectionMatrixInverse.copy(B.projectionMatrix).invert()}function F(B,Z){Z===null?B.matrixWorld.copy(B.matrix):B.matrixWorld.multiplyMatrices(Z.matrixWorld,B.matrix),B.matrixWorldInverse.copy(B.matrixWorld).invert()}this.updateCamera=function(B){if(i===null)return;_.near=b.near=E.near=B.near,_.far=b.far=E.far=B.far,(w!==_.near||U!==_.far)&&(i.updateRenderState({depthNear:_.near,depthFar:_.far}),w=_.near,U=_.far);let Z=B.parent,ne=_.cameras;F(_,Z);for(let me=0;me<ne.length;me++)F(ne[me],Z);ne.length===2?N(_,E,b):_.projectionMatrix.copy(E.projectionMatrix),z(B,_,Z)};function z(B,Z,ne){ne===null?B.matrix.copy(Z.matrixWorld):(B.matrix.copy(ne.matrixWorld),B.matrix.invert(),B.matrix.multiply(Z.matrixWorld)),B.matrix.decompose(B.position,B.quaternion,B.scale),B.updateMatrixWorld(!0),B.projectionMatrix.copy(Z.projectionMatrix),B.projectionMatrixInverse.copy(Z.projectionMatrixInverse),B.isPerspectiveCamera&&(B.fov=Go*2*Math.atan(1/B.projectionMatrix.elements[5]),B.zoom=1)}this.getCamera=function(){return _},this.getFoveation=function(){if(!(d===null&&p===null))return l},this.setFoveation=function(B){l=B,d!==null&&(d.fixedFoveation=B),p!==null&&p.fixedFoveation!==void 0&&(p.fixedFoveation=B)};let G=null;function Y(B,Z){if(h=Z.getViewerPose(c||a),g=Z,h!==null){let ne=h.views;p!==null&&(e.setRenderTargetFramebuffer(f,p.framebuffer),e.setRenderTarget(f));let me=!1;ne.length!==_.cameras.length&&(_.cameras.length=0,me=!0);for(let fe=0;fe<ne.length;fe++){let Pe=ne[fe],Ue=null;if(p!==null)Ue=p.getViewport(Pe);else{let tt=u.getViewSubImage(d,Pe);Ue=tt.viewport,fe===0&&(e.setRenderTargetTextures(f,tt.colorTexture,d.ignoreDepthValues?void 0:tt.depthStencilTexture),e.setRenderTarget(f))}let Ee=L[fe];Ee===void 0&&(Ee=new Qt,Ee.layers.enable(fe),Ee.viewport=new Ut,L[fe]=Ee),Ee.matrix.fromArray(Pe.transform.matrix),Ee.matrix.decompose(Ee.position,Ee.quaternion,Ee.scale),Ee.projectionMatrix.fromArray(Pe.projectionMatrix),Ee.projectionMatrixInverse.copy(Ee.projectionMatrix).invert(),Ee.viewport.set(Ue.x,Ue.y,Ue.width,Ue.height),fe===0&&(_.matrix.copy(Ee.matrix),_.matrix.decompose(_.position,_.quaternion,_.scale)),me===!0&&_.cameras.push(Ee)}}for(let ne=0;ne<y.length;ne++){let me=v[ne],fe=y[ne];me!==null&&fe!==void 0&&fe.update(me,Z,c||a)}G&&G(B,Z),Z.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:Z}),g=null}let J=new su;J.setAnimationLoop(Y),this.setAnimationLoop=function(B){G=B},this.dispose=function(){}}};function Ng(s,e){function t(m,f){m.matrixAutoUpdate===!0&&m.updateMatrix(),f.value.copy(m.matrix)}function n(m,f){f.color.getRGB(m.fogColor.value,iu(s)),f.isFog?(m.fogNear.value=f.near,m.fogFar.value=f.far):f.isFogExp2&&(m.fogDensity.value=f.density)}function i(m,f,y,v,M){f.isMeshBasicMaterial||f.isMeshLambertMaterial?r(m,f):f.isMeshToonMaterial?(r(m,f),u(m,f)):f.isMeshPhongMaterial?(r(m,f),h(m,f)):f.isMeshStandardMaterial?(r(m,f),d(m,f),f.isMeshPhysicalMaterial&&p(m,f,M)):f.isMeshMatcapMaterial?(r(m,f),g(m,f)):f.isMeshDepthMaterial?r(m,f):f.isMeshDistanceMaterial?(r(m,f),x(m,f)):f.isMeshNormalMaterial?r(m,f):f.isLineBasicMaterial?(a(m,f),f.isLineDashedMaterial&&o(m,f)):f.isPointsMaterial?l(m,f,y,v):f.isSpriteMaterial?c(m,f):f.isShadowMaterial?(m.color.value.copy(f.color),m.opacity.value=f.opacity):f.isShaderMaterial&&(f.uniformsNeedUpdate=!1)}function r(m,f){m.opacity.value=f.opacity,f.color&&m.diffuse.value.copy(f.color),f.emissive&&m.emissive.value.copy(f.emissive).multiplyScalar(f.emissiveIntensity),f.map&&(m.map.value=f.map,t(f.map,m.mapTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,t(f.alphaMap,m.alphaMapTransform)),f.bumpMap&&(m.bumpMap.value=f.bumpMap,t(f.bumpMap,m.bumpMapTransform),m.bumpScale.value=f.bumpScale,f.side===$t&&(m.bumpScale.value*=-1)),f.normalMap&&(m.normalMap.value=f.normalMap,t(f.normalMap,m.normalMapTransform),m.normalScale.value.copy(f.normalScale),f.side===$t&&m.normalScale.value.negate()),f.displacementMap&&(m.displacementMap.value=f.displacementMap,t(f.displacementMap,m.displacementMapTransform),m.displacementScale.value=f.displacementScale,m.displacementBias.value=f.displacementBias),f.emissiveMap&&(m.emissiveMap.value=f.emissiveMap,t(f.emissiveMap,m.emissiveMapTransform)),f.specularMap&&(m.specularMap.value=f.specularMap,t(f.specularMap,m.specularMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest);let y=e.get(f).envMap;if(y&&(m.envMap.value=y,m.flipEnvMap.value=y.isCubeTexture&&y.isRenderTargetTexture===!1?-1:1,m.reflectivity.value=f.reflectivity,m.ior.value=f.ior,m.refractionRatio.value=f.refractionRatio),f.lightMap){m.lightMap.value=f.lightMap;let v=s._useLegacyLights===!0?Math.PI:1;m.lightMapIntensity.value=f.lightMapIntensity*v,t(f.lightMap,m.lightMapTransform)}f.aoMap&&(m.aoMap.value=f.aoMap,m.aoMapIntensity.value=f.aoMapIntensity,t(f.aoMap,m.aoMapTransform))}function a(m,f){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,f.map&&(m.map.value=f.map,t(f.map,m.mapTransform))}function o(m,f){m.dashSize.value=f.dashSize,m.totalSize.value=f.dashSize+f.gapSize,m.scale.value=f.scale}function l(m,f,y,v){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,m.size.value=f.size*y,m.scale.value=v*.5,f.map&&(m.map.value=f.map,t(f.map,m.uvTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,t(f.alphaMap,m.alphaMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest)}function c(m,f){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,m.rotation.value=f.rotation,f.map&&(m.map.value=f.map,t(f.map,m.mapTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,t(f.alphaMap,m.alphaMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest)}function h(m,f){m.specular.value.copy(f.specular),m.shininess.value=Math.max(f.shininess,1e-4)}function u(m,f){f.gradientMap&&(m.gradientMap.value=f.gradientMap)}function d(m,f){m.metalness.value=f.metalness,f.metalnessMap&&(m.metalnessMap.value=f.metalnessMap,t(f.metalnessMap,m.metalnessMapTransform)),m.roughness.value=f.roughness,f.roughnessMap&&(m.roughnessMap.value=f.roughnessMap,t(f.roughnessMap,m.roughnessMapTransform)),e.get(f).envMap&&(m.envMapIntensity.value=f.envMapIntensity)}function p(m,f,y){m.ior.value=f.ior,f.sheen>0&&(m.sheenColor.value.copy(f.sheenColor).multiplyScalar(f.sheen),m.sheenRoughness.value=f.sheenRoughness,f.sheenColorMap&&(m.sheenColorMap.value=f.sheenColorMap,t(f.sheenColorMap,m.sheenColorMapTransform)),f.sheenRoughnessMap&&(m.sheenRoughnessMap.value=f.sheenRoughnessMap,t(f.sheenRoughnessMap,m.sheenRoughnessMapTransform))),f.clearcoat>0&&(m.clearcoat.value=f.clearcoat,m.clearcoatRoughness.value=f.clearcoatRoughness,f.clearcoatMap&&(m.clearcoatMap.value=f.clearcoatMap,t(f.clearcoatMap,m.clearcoatMapTransform)),f.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=f.clearcoatRoughnessMap,t(f.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),f.clearcoatNormalMap&&(m.clearcoatNormalMap.value=f.clearcoatNormalMap,t(f.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(f.clearcoatNormalScale),f.side===$t&&m.clearcoatNormalScale.value.negate())),f.iridescence>0&&(m.iridescence.value=f.iridescence,m.iridescenceIOR.value=f.iridescenceIOR,m.iridescenceThicknessMinimum.value=f.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=f.iridescenceThicknessRange[1],f.iridescenceMap&&(m.iridescenceMap.value=f.iridescenceMap,t(f.iridescenceMap,m.iridescenceMapTransform)),f.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=f.iridescenceThicknessMap,t(f.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),f.transmission>0&&(m.transmission.value=f.transmission,m.transmissionSamplerMap.value=y.texture,m.transmissionSamplerSize.value.set(y.width,y.height),f.transmissionMap&&(m.transmissionMap.value=f.transmissionMap,t(f.transmissionMap,m.transmissionMapTransform)),m.thickness.value=f.thickness,f.thicknessMap&&(m.thicknessMap.value=f.thicknessMap,t(f.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=f.attenuationDistance,m.attenuationColor.value.copy(f.attenuationColor)),f.anisotropy>0&&(m.anisotropyVector.value.set(f.anisotropy*Math.cos(f.anisotropyRotation),f.anisotropy*Math.sin(f.anisotropyRotation)),f.anisotropyMap&&(m.anisotropyMap.value=f.anisotropyMap,t(f.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=f.specularIntensity,m.specularColor.value.copy(f.specularColor),f.specularColorMap&&(m.specularColorMap.value=f.specularColorMap,t(f.specularColorMap,m.specularColorMapTransform)),f.specularIntensityMap&&(m.specularIntensityMap.value=f.specularIntensityMap,t(f.specularIntensityMap,m.specularIntensityMapTransform))}function g(m,f){f.matcap&&(m.matcap.value=f.matcap)}function x(m,f){let y=e.get(f).light;m.referencePosition.value.setFromMatrixPosition(y.matrixWorld),m.nearDistance.value=y.shadow.camera.near,m.farDistance.value=y.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:i}}function Ug(s,e,t,n){let i={},r={},a=[],o=t.isWebGL2?s.getParameter(s.MAX_UNIFORM_BUFFER_BINDINGS):0;function l(y,v){let M=v.program;n.uniformBlockBinding(y,M)}function c(y,v){let M=i[y.id];M===void 0&&(g(y),M=h(y),i[y.id]=M,y.addEventListener("dispose",m));let T=v.program;n.updateUBOMapping(y,T);let E=e.render.frame;r[y.id]!==E&&(d(y),r[y.id]=E)}function h(y){let v=u();y.__bindingPointIndex=v;let M=s.createBuffer(),T=y.__size,E=y.usage;return s.bindBuffer(s.UNIFORM_BUFFER,M),s.bufferData(s.UNIFORM_BUFFER,T,E),s.bindBuffer(s.UNIFORM_BUFFER,null),s.bindBufferBase(s.UNIFORM_BUFFER,v,M),M}function u(){for(let y=0;y<o;y++)if(a.indexOf(y)===-1)return a.push(y),y;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(y){let v=i[y.id],M=y.uniforms,T=y.__cache;s.bindBuffer(s.UNIFORM_BUFFER,v);for(let E=0,b=M.length;E<b;E++){let L=Array.isArray(M[E])?M[E]:[M[E]];for(let _=0,w=L.length;_<w;_++){let U=L[_];if(p(U,E,_,T)===!0){let H=U.__offset,K=Array.isArray(U.value)?U.value:[U.value],I=0;for(let C=0;C<K.length;C++){let P=K[C],N=x(P);typeof P=="number"||typeof P=="boolean"?(U.__data[0]=P,s.bufferSubData(s.UNIFORM_BUFFER,H+I,U.__data)):P.isMatrix3?(U.__data[0]=P.elements[0],U.__data[1]=P.elements[1],U.__data[2]=P.elements[2],U.__data[3]=0,U.__data[4]=P.elements[3],U.__data[5]=P.elements[4],U.__data[6]=P.elements[5],U.__data[7]=0,U.__data[8]=P.elements[6],U.__data[9]=P.elements[7],U.__data[10]=P.elements[8],U.__data[11]=0):(P.toArray(U.__data,I),I+=N.storage/Float32Array.BYTES_PER_ELEMENT)}s.bufferSubData(s.UNIFORM_BUFFER,H,U.__data)}}}s.bindBuffer(s.UNIFORM_BUFFER,null)}function p(y,v,M,T){let E=y.value,b=v+"_"+M;if(T[b]===void 0)return typeof E=="number"||typeof E=="boolean"?T[b]=E:T[b]=E.clone(),!0;{let L=T[b];if(typeof E=="number"||typeof E=="boolean"){if(L!==E)return T[b]=E,!0}else if(L.equals(E)===!1)return L.copy(E),!0}return!1}function g(y){let v=y.uniforms,M=0,T=16;for(let b=0,L=v.length;b<L;b++){let _=Array.isArray(v[b])?v[b]:[v[b]];for(let w=0,U=_.length;w<U;w++){let H=_[w],K=Array.isArray(H.value)?H.value:[H.value];for(let I=0,C=K.length;I<C;I++){let P=K[I],N=x(P),F=M%T;F!==0&&T-F<N.boundary&&(M+=T-F),H.__data=new Float32Array(N.storage/Float32Array.BYTES_PER_ELEMENT),H.__offset=M,M+=N.storage}}}let E=M%T;return E>0&&(M+=T-E),y.__size=M,y.__cache={},this}function x(y){let v={boundary:0,storage:0};return typeof y=="number"||typeof y=="boolean"?(v.boundary=4,v.storage=4):y.isVector2?(v.boundary=8,v.storage=8):y.isVector3||y.isColor?(v.boundary=16,v.storage=12):y.isVector4?(v.boundary=16,v.storage=16):y.isMatrix3?(v.boundary=48,v.storage=48):y.isMatrix4?(v.boundary=64,v.storage=64):y.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",y),v}function m(y){let v=y.target;v.removeEventListener("dispose",m);let M=a.indexOf(v.__bindingPointIndex);a.splice(M,1),s.deleteBuffer(i[v.id]),delete i[v.id],delete r[v.id]}function f(){for(let y in i)s.deleteBuffer(i[y]);a=[],i={},r={}}return{bind:l,update:c,dispose:f}}var ks=class{constructor(e={}){let{canvas:t=Vd(),context:n=null,depth:i=!0,stencil:r=!0,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:u=!1}=e;this.isWebGLRenderer=!0;let d;n!==null?d=n.getContextAttributes().alpha:d=a;let p=new Uint32Array(4),g=new Int32Array(4),x=null,m=null,f=[],y=[];this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=ut,this._useLegacyLights=!1,this.toneMapping=si,this.toneMappingExposure=1;let v=this,M=!1,T=0,E=0,b=null,L=-1,_=null,w=new Ut,U=new Ut,H=null,K=new ie(0),I=0,C=t.width,P=t.height,N=1,F=null,z=null,G=new Ut(0,0,C,P),Y=new Ut(0,0,C,P),J=!1,B=new Ds,Z=!1,ne=!1,me=null,fe=new je,Pe=new Ge,Ue=new k,Ee={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};function tt(){return b===null?N:1}let W=n;function qt(A,O){for(let X=0;X<A.length;X++){let q=A[X],V=t.getContext(q,O);if(V!==null)return V}return null}try{let A={alpha:!0,depth:i,stencil:r,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:u};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${_l}`),t.addEventListener("webglcontextlost",se,!1),t.addEventListener("webglcontextrestored",D,!1),t.addEventListener("webglcontextcreationerror",ae,!1),W===null){let O=["webgl2","webgl","experimental-webgl"];if(v.isWebGL1Renderer===!0&&O.shift(),W=qt(O,A),W===null)throw qt(O)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}typeof WebGLRenderingContext<"u"&&W instanceof WebGLRenderingContext&&console.warn("THREE.WebGLRenderer: WebGL 1 support was deprecated in r153 and will be removed in r163."),W.getShaderPrecisionFormat===void 0&&(W.getShaderPrecisionFormat=function(){return{rangeMin:1,rangeMax:1,precision:1}})}catch(A){throw console.error("THREE.WebGLRenderer: "+A.message),A}let _e,De,pe,gt,Oe,R,S,$,ee,Q,te,ge,ce,ue,we,Be,j,st,Ye,Le,ye,de,Fe,it;function bt(){_e=new t0(W),De=new Zm(W,_e,e),_e.init(De),de=new Dg(W,_e,De),pe=new Lg(W,_e,De),gt=new s0(W),Oe=new yg,R=new Ig(W,_e,pe,Oe,De,de,gt),S=new Jm(v),$=new e0(v),ee=new df(W,De),Fe=new qm(W,_e,ee,De),Q=new n0(W,ee,gt,Fe),te=new l0(W,Q,ee,gt),Ye=new o0(W,De,R),Be=new Km(Oe),ge=new vg(v,S,$,_e,De,Fe,Be),ce=new Ng(v,Oe),ue=new bg,we=new Ag(_e,De),st=new Xm(v,S,$,pe,te,d,l),j=new Pg(v,te,De),it=new Ug(W,gt,De,pe),Le=new Ym(W,_e,gt,De),ye=new i0(W,_e,gt,De),gt.programs=ge.programs,v.capabilities=De,v.extensions=_e,v.properties=Oe,v.renderLists=ue,v.shadowMap=j,v.state=pe,v.info=gt}bt();let We=new il(v,W);this.xr=We,this.getContext=function(){return W},this.getContextAttributes=function(){return W.getContextAttributes()},this.forceContextLoss=function(){let A=_e.get("WEBGL_lose_context");A&&A.loseContext()},this.forceContextRestore=function(){let A=_e.get("WEBGL_lose_context");A&&A.restoreContext()},this.getPixelRatio=function(){return N},this.setPixelRatio=function(A){A!==void 0&&(N=A,this.setSize(C,P,!1))},this.getSize=function(A){return A.set(C,P)},this.setSize=function(A,O,X=!0){if(We.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}C=A,P=O,t.width=Math.floor(A*N),t.height=Math.floor(O*N),X===!0&&(t.style.width=A+"px",t.style.height=O+"px"),this.setViewport(0,0,A,O)},this.getDrawingBufferSize=function(A){return A.set(C*N,P*N).floor()},this.setDrawingBufferSize=function(A,O,X){C=A,P=O,N=X,t.width=Math.floor(A*X),t.height=Math.floor(O*X),this.setViewport(0,0,A,O)},this.getCurrentViewport=function(A){return A.copy(w)},this.getViewport=function(A){return A.copy(G)},this.setViewport=function(A,O,X,q){A.isVector4?G.set(A.x,A.y,A.z,A.w):G.set(A,O,X,q),pe.viewport(w.copy(G).multiplyScalar(N).floor())},this.getScissor=function(A){return A.copy(Y)},this.setScissor=function(A,O,X,q){A.isVector4?Y.set(A.x,A.y,A.z,A.w):Y.set(A,O,X,q),pe.scissor(U.copy(Y).multiplyScalar(N).floor())},this.getScissorTest=function(){return J},this.setScissorTest=function(A){pe.setScissorTest(J=A)},this.setOpaqueSort=function(A){F=A},this.setTransparentSort=function(A){z=A},this.getClearColor=function(A){return A.copy(st.getClearColor())},this.setClearColor=function(){st.setClearColor.apply(st,arguments)},this.getClearAlpha=function(){return st.getClearAlpha()},this.setClearAlpha=function(){st.setClearAlpha.apply(st,arguments)},this.clear=function(A=!0,O=!0,X=!0){let q=0;if(A){let V=!1;if(b!==null){let he=b.texture.format;V=he===Kh||he===Zh||he===Yh}if(V){let he=b.texture.type,xe=he===ri||he===ei||he===wl||he===bi||he===Xh||he===qh,Me=st.getClearColor(),Ce=st.getClearAlpha(),He=Me.r,ke=Me.g,Ne=Me.b;xe?(p[0]=He,p[1]=ke,p[2]=Ne,p[3]=Ce,W.clearBufferuiv(W.COLOR,0,p)):(g[0]=He,g[1]=ke,g[2]=Ne,g[3]=Ce,W.clearBufferiv(W.COLOR,0,g))}else q|=W.COLOR_BUFFER_BIT}O&&(q|=W.DEPTH_BUFFER_BIT),X&&(q|=W.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),W.clear(q)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){t.removeEventListener("webglcontextlost",se,!1),t.removeEventListener("webglcontextrestored",D,!1),t.removeEventListener("webglcontextcreationerror",ae,!1),ue.dispose(),we.dispose(),Oe.dispose(),S.dispose(),$.dispose(),te.dispose(),Fe.dispose(),it.dispose(),ge.dispose(),We.dispose(),We.removeEventListener("sessionstart",Yt),We.removeEventListener("sessionend",ht),me&&(me.dispose(),me=null),Zt.stop()};function se(A){A.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),M=!0}function D(){console.log("THREE.WebGLRenderer: Context Restored."),M=!1;let A=gt.autoReset,O=j.enabled,X=j.autoUpdate,q=j.needsUpdate,V=j.type;bt(),gt.autoReset=A,j.enabled=O,j.autoUpdate=X,j.needsUpdate=q,j.type=V}function ae(A){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",A.statusMessage)}function oe(A){let O=A.target;O.removeEventListener("dispose",oe),Te(O)}function Te(A){be(A),Oe.remove(A)}function be(A){let O=Oe.get(A).programs;O!==void 0&&(O.forEach(function(X){ge.releaseProgram(X)}),A.isShaderMaterial&&ge.releaseShaderCache(A))}this.renderBufferDirect=function(A,O,X,q,V,he){O===null&&(O=Ee);let xe=V.isMesh&&V.matrixWorld.determinant()<0,Me=wu(A,O,X,q,V);pe.setMaterial(q,xe);let Ce=X.index,He=1;if(q.wireframe===!0){if(Ce=Q.getWireframeAttribute(X),Ce===void 0)return;He=2}let ke=X.drawRange,Ne=X.attributes.position,St=ke.start*He,sn=(ke.start+ke.count)*He;he!==null&&(St=Math.max(St,he.start*He),sn=Math.min(sn,(he.start+he.count)*He)),Ce!==null?(St=Math.max(St,0),sn=Math.min(sn,Ce.count)):Ne!=null&&(St=Math.max(St,0),sn=Math.min(sn,Ne.count));let kt=sn-St;if(kt<0||kt===1/0)return;Fe.setup(V,q,Me,X,Ce);let An,xt=Le;if(Ce!==null&&(An=ee.get(Ce),xt=ye,xt.setIndex(An)),V.isMesh)q.wireframe===!0?(pe.setLineWidth(q.wireframeLinewidth*tt()),xt.setMode(W.LINES)):xt.setMode(W.TRIANGLES);else if(V.isLine){let Ve=q.linewidth;Ve===void 0&&(Ve=1),pe.setLineWidth(Ve*tt()),V.isLineSegments?xt.setMode(W.LINES):V.isLineLoop?xt.setMode(W.LINE_LOOP):xt.setMode(W.LINE_STRIP)}else V.isPoints?xt.setMode(W.POINTS):V.isSprite&&xt.setMode(W.TRIANGLES);if(V.isBatchedMesh)xt.renderMultiDraw(V._multiDrawStarts,V._multiDrawCounts,V._multiDrawCount);else if(V.isInstancedMesh)xt.renderInstances(St,kt,V.count);else if(X.isInstancedBufferGeometry){let Ve=X._maxInstanceCount!==void 0?X._maxInstanceCount:1/0,La=Math.min(X.instanceCount,Ve);xt.renderInstances(St,kt,La)}else xt.render(St,kt)};function lt(A,O,X){A.transparent===!0&&A.side===Ct&&A.forceSinglePass===!1?(A.side=$t,A.needsUpdate=!0,Vs(A,O,X),A.side=ai,A.needsUpdate=!0,Vs(A,O,X),A.side=Ct):Vs(A,O,X)}this.compile=function(A,O,X=null){X===null&&(X=A),m=we.get(X),m.init(),y.push(m),X.traverseVisible(function(V){V.isLight&&V.layers.test(O.layers)&&(m.pushLight(V),V.castShadow&&m.pushShadow(V))}),A!==X&&A.traverseVisible(function(V){V.isLight&&V.layers.test(O.layers)&&(m.pushLight(V),V.castShadow&&m.pushShadow(V))}),m.setupLights(v._useLegacyLights);let q=new Set;return A.traverse(function(V){let he=V.material;if(he)if(Array.isArray(he))for(let xe=0;xe<he.length;xe++){let Me=he[xe];lt(Me,X,V),q.add(Me)}else lt(he,X,V),q.add(he)}),y.pop(),m=null,q},this.compileAsync=function(A,O,X=null){let q=this.compile(A,O,X);return new Promise(V=>{function he(){if(q.forEach(function(xe){Oe.get(xe).currentProgram.isReady()&&q.delete(xe)}),q.size===0){V(A);return}setTimeout(he,10)}_e.get("KHR_parallel_shader_compile")!==null?he():setTimeout(he,10)})};let ct=null;function Dt(A){ct&&ct(A)}function Yt(){Zt.stop()}function ht(){Zt.start()}let Zt=new su;Zt.setAnimationLoop(Dt),typeof self<"u"&&Zt.setContext(self),this.setAnimationLoop=function(A){ct=A,We.setAnimationLoop(A),A===null?Zt.stop():Zt.start()},We.addEventListener("sessionstart",Yt),We.addEventListener("sessionend",ht),this.render=function(A,O){if(O!==void 0&&O.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(M===!0)return;A.matrixWorldAutoUpdate===!0&&A.updateMatrixWorld(),O.parent===null&&O.matrixWorldAutoUpdate===!0&&O.updateMatrixWorld(),We.enabled===!0&&We.isPresenting===!0&&(We.cameraAutoUpdate===!0&&We.updateCamera(O),O=We.getCamera()),A.isScene===!0&&A.onBeforeRender(v,A,O,b),m=we.get(A,y.length),m.init(),y.push(m),fe.multiplyMatrices(O.projectionMatrix,O.matrixWorldInverse),B.setFromProjectionMatrix(fe),ne=this.localClippingEnabled,Z=Be.init(this.clippingPlanes,ne),x=ue.get(A,f.length),x.init(),f.push(x),Mn(A,O,0,v.sortObjects),x.finish(),v.sortObjects===!0&&x.sort(F,z),this.info.render.frame++,Z===!0&&Be.beginShadows();let X=m.state.shadowsArray;if(j.render(X,A,O),Z===!0&&Be.endShadows(),this.info.autoReset===!0&&this.info.reset(),st.render(x,A),m.setupLights(v._useLegacyLights),O.isArrayCamera){let q=O.cameras;for(let V=0,he=q.length;V<he;V++){let xe=q[V];Il(x,A,xe,xe.viewport)}}else Il(x,A,O);b!==null&&(R.updateMultisampleRenderTarget(b),R.updateRenderTargetMipmap(b)),A.isScene===!0&&A.onAfterRender(v,A,O),Fe.resetDefaultState(),L=-1,_=null,y.pop(),y.length>0?m=y[y.length-1]:m=null,f.pop(),f.length>0?x=f[f.length-1]:x=null};function Mn(A,O,X,q){if(A.visible===!1)return;if(A.layers.test(O.layers)){if(A.isGroup)X=A.renderOrder;else if(A.isLOD)A.autoUpdate===!0&&A.update(O);else if(A.isLight)m.pushLight(A),A.castShadow&&m.pushShadow(A);else if(A.isSprite){if(!A.frustumCulled||B.intersectsSprite(A)){q&&Ue.setFromMatrixPosition(A.matrixWorld).applyMatrix4(fe);let xe=te.update(A),Me=A.material;Me.visible&&x.push(A,xe,Me,X,Ue.z,null)}}else if((A.isMesh||A.isLine||A.isPoints)&&(!A.frustumCulled||B.intersectsObject(A))){let xe=te.update(A),Me=A.material;if(q&&(A.boundingSphere!==void 0?(A.boundingSphere===null&&A.computeBoundingSphere(),Ue.copy(A.boundingSphere.center)):(xe.boundingSphere===null&&xe.computeBoundingSphere(),Ue.copy(xe.boundingSphere.center)),Ue.applyMatrix4(A.matrixWorld).applyMatrix4(fe)),Array.isArray(Me)){let Ce=xe.groups;for(let He=0,ke=Ce.length;He<ke;He++){let Ne=Ce[He],St=Me[Ne.materialIndex];St&&St.visible&&x.push(A,xe,St,X,Ue.z,Ne)}}else Me.visible&&x.push(A,xe,Me,X,Ue.z,null)}}let he=A.children;for(let xe=0,Me=he.length;xe<Me;xe++)Mn(he[xe],O,X,q)}function Il(A,O,X,q){let V=A.opaque,he=A.transmissive,xe=A.transparent;m.setupLightsView(X),Z===!0&&Be.setGlobalState(v.clippingPlanes,X),he.length>0&&Mu(V,he,O,X),q&&pe.viewport(w.copy(q)),V.length>0&&Ws(V,O,X),he.length>0&&Ws(he,O,X),xe.length>0&&Ws(xe,O,X),pe.buffers.depth.setTest(!0),pe.buffers.depth.setMask(!0),pe.buffers.color.setMask(!0),pe.setPolygonOffset(!1)}function Mu(A,O,X,q){if((X.isScene===!0?X.overrideMaterial:null)!==null)return;let he=De.isWebGL2;me===null&&(me=new zn(1,1,{generateMipmaps:!0,type:_e.has("EXT_color_buffer_half_float")?Ls:ri,minFilter:Si,samples:he?4:0})),v.getDrawingBufferSize(Pe),he?me.setSize(Pe.x,Pe.y):me.setSize(Wo(Pe.x),Wo(Pe.y));let xe=v.getRenderTarget();v.setRenderTarget(me),v.getClearColor(K),I=v.getClearAlpha(),I<1&&v.setClearColor(16777215,.5),v.clear();let Me=v.toneMapping;v.toneMapping=si,Ws(A,X,q),R.updateMultisampleRenderTarget(me),R.updateRenderTargetMipmap(me);let Ce=!1;for(let He=0,ke=O.length;He<ke;He++){let Ne=O[He],St=Ne.object,sn=Ne.geometry,kt=Ne.material,An=Ne.group;if(kt.side===Ct&&St.layers.test(q.layers)){let xt=kt.side;kt.side=$t,kt.needsUpdate=!0,Dl(St,X,q,sn,kt,An),kt.side=xt,kt.needsUpdate=!0,Ce=!0}}Ce===!0&&(R.updateMultisampleRenderTarget(me),R.updateRenderTargetMipmap(me)),v.setRenderTarget(xe),v.setClearColor(K,I),v.toneMapping=Me}function Ws(A,O,X){let q=O.isScene===!0?O.overrideMaterial:null;for(let V=0,he=A.length;V<he;V++){let xe=A[V],Me=xe.object,Ce=xe.geometry,He=q===null?xe.material:q,ke=xe.group;Me.layers.test(X.layers)&&Dl(Me,O,X,Ce,He,ke)}}function Dl(A,O,X,q,V,he){A.onBeforeRender(v,O,X,q,V,he),A.modelViewMatrix.multiplyMatrices(X.matrixWorldInverse,A.matrixWorld),A.normalMatrix.getNormalMatrix(A.modelViewMatrix),V.onBeforeRender(v,O,X,q,A,he),V.transparent===!0&&V.side===Ct&&V.forceSinglePass===!1?(V.side=$t,V.needsUpdate=!0,v.renderBufferDirect(X,O,q,V,A,he),V.side=ai,V.needsUpdate=!0,v.renderBufferDirect(X,O,q,V,A,he),V.side=Ct):v.renderBufferDirect(X,O,q,V,A,he),A.onAfterRender(v,O,X,q,V,he)}function Vs(A,O,X){O.isScene!==!0&&(O=Ee);let q=Oe.get(A),V=m.state.lights,he=m.state.shadowsArray,xe=V.state.version,Me=ge.getParameters(A,V.state,he,O,X),Ce=ge.getProgramCacheKey(Me),He=q.programs;q.environment=A.isMeshStandardMaterial?O.environment:null,q.fog=O.fog,q.envMap=(A.isMeshStandardMaterial?$:S).get(A.envMap||q.environment),He===void 0&&(A.addEventListener("dispose",oe),He=new Map,q.programs=He);let ke=He.get(Ce);if(ke!==void 0){if(q.currentProgram===ke&&q.lightsStateVersion===xe)return Nl(A,Me),ke}else Me.uniforms=ge.getUniforms(A),A.onBuild(X,Me,v),A.onBeforeCompile(Me,v),ke=ge.acquireProgram(Me,Ce),He.set(Ce,ke),q.uniforms=Me.uniforms;let Ne=q.uniforms;return(!A.isShaderMaterial&&!A.isRawShaderMaterial||A.clipping===!0)&&(Ne.clippingPlanes=Be.uniform),Nl(A,Me),q.needsLights=Eu(A),q.lightsStateVersion=xe,q.needsLights&&(Ne.ambientLightColor.value=V.state.ambient,Ne.lightProbe.value=V.state.probe,Ne.directionalLights.value=V.state.directional,Ne.directionalLightShadows.value=V.state.directionalShadow,Ne.spotLights.value=V.state.spot,Ne.spotLightShadows.value=V.state.spotShadow,Ne.rectAreaLights.value=V.state.rectArea,Ne.ltc_1.value=V.state.rectAreaLTC1,Ne.ltc_2.value=V.state.rectAreaLTC2,Ne.pointLights.value=V.state.point,Ne.pointLightShadows.value=V.state.pointShadow,Ne.hemisphereLights.value=V.state.hemi,Ne.directionalShadowMap.value=V.state.directionalShadowMap,Ne.directionalShadowMatrix.value=V.state.directionalShadowMatrix,Ne.spotShadowMap.value=V.state.spotShadowMap,Ne.spotLightMatrix.value=V.state.spotLightMatrix,Ne.spotLightMap.value=V.state.spotLightMap,Ne.pointShadowMap.value=V.state.pointShadowMap,Ne.pointShadowMatrix.value=V.state.pointShadowMatrix),q.currentProgram=ke,q.uniformsList=null,ke}function kl(A){if(A.uniformsList===null){let O=A.currentProgram.getUniforms();A.uniformsList=es.seqWithValue(O.seq,A.uniforms)}return A.uniformsList}function Nl(A,O){let X=Oe.get(A);X.outputColorSpace=O.outputColorSpace,X.batching=O.batching,X.instancing=O.instancing,X.instancingColor=O.instancingColor,X.skinning=O.skinning,X.morphTargets=O.morphTargets,X.morphNormals=O.morphNormals,X.morphColors=O.morphColors,X.morphTargetsCount=O.morphTargetsCount,X.numClippingPlanes=O.numClippingPlanes,X.numIntersection=O.numClipIntersection,X.vertexAlphas=O.vertexAlphas,X.vertexTangents=O.vertexTangents,X.toneMapping=O.toneMapping}function wu(A,O,X,q,V){O.isScene!==!0&&(O=Ee),R.resetTextureUnits();let he=O.fog,xe=q.isMeshStandardMaterial?O.environment:null,Me=b===null?v.outputColorSpace:b.isXRRenderTarget===!0?b.texture.colorSpace:Fn,Ce=(q.isMeshStandardMaterial?$:S).get(q.envMap||xe),He=q.vertexColors===!0&&!!X.attributes.color&&X.attributes.color.itemSize===4,ke=!!X.attributes.tangent&&(!!q.normalMap||q.anisotropy>0),Ne=!!X.morphAttributes.position,St=!!X.morphAttributes.normal,sn=!!X.morphAttributes.color,kt=si;q.toneMapped&&(b===null||b.isXRRenderTarget===!0)&&(kt=v.toneMapping);let An=X.morphAttributes.position||X.morphAttributes.normal||X.morphAttributes.color,xt=An!==void 0?An.length:0,Ve=Oe.get(q),La=m.state.lights;if(Z===!0&&(ne===!0||A!==_)){let un=A===_&&q.id===L;Be.setState(q,A,un)}let Mt=!1;q.version===Ve.__version?(Ve.needsLights&&Ve.lightsStateVersion!==La.state.version||Ve.outputColorSpace!==Me||V.isBatchedMesh&&Ve.batching===!1||!V.isBatchedMesh&&Ve.batching===!0||V.isInstancedMesh&&Ve.instancing===!1||!V.isInstancedMesh&&Ve.instancing===!0||V.isSkinnedMesh&&Ve.skinning===!1||!V.isSkinnedMesh&&Ve.skinning===!0||V.isInstancedMesh&&Ve.instancingColor===!0&&V.instanceColor===null||V.isInstancedMesh&&Ve.instancingColor===!1&&V.instanceColor!==null||Ve.envMap!==Ce||q.fog===!0&&Ve.fog!==he||Ve.numClippingPlanes!==void 0&&(Ve.numClippingPlanes!==Be.numPlanes||Ve.numIntersection!==Be.numIntersection)||Ve.vertexAlphas!==He||Ve.vertexTangents!==ke||Ve.morphTargets!==Ne||Ve.morphNormals!==St||Ve.morphColors!==sn||Ve.toneMapping!==kt||De.isWebGL2===!0&&Ve.morphTargetsCount!==xt)&&(Mt=!0):(Mt=!0,Ve.__version=q.version);let ci=Ve.currentProgram;Mt===!0&&(ci=Vs(q,O,V));let Ul=!1,xs=!1,Ia=!1,Gt=ci.getUniforms(),hi=Ve.uniforms;if(pe.useProgram(ci.program)&&(Ul=!0,xs=!0,Ia=!0),q.id!==L&&(L=q.id,xs=!0),Ul||_!==A){Gt.setValue(W,"projectionMatrix",A.projectionMatrix),Gt.setValue(W,"viewMatrix",A.matrixWorldInverse);let un=Gt.map.cameraPosition;un!==void 0&&un.setValue(W,Ue.setFromMatrixPosition(A.matrixWorld)),De.logarithmicDepthBuffer&&Gt.setValue(W,"logDepthBufFC",2/(Math.log(A.far+1)/Math.LN2)),(q.isMeshPhongMaterial||q.isMeshToonMaterial||q.isMeshLambertMaterial||q.isMeshBasicMaterial||q.isMeshStandardMaterial||q.isShaderMaterial)&&Gt.setValue(W,"isOrthographic",A.isOrthographicCamera===!0),_!==A&&(_=A,xs=!0,Ia=!0)}if(V.isSkinnedMesh){Gt.setOptional(W,V,"bindMatrix"),Gt.setOptional(W,V,"bindMatrixInverse");let un=V.skeleton;un&&(De.floatVertexTextures?(un.boneTexture===null&&un.computeBoneTexture(),Gt.setValue(W,"boneTexture",un.boneTexture,R)):console.warn("THREE.WebGLRenderer: SkinnedMesh can only be used with WebGL 2. With WebGL 1 OES_texture_float and vertex textures support is required."))}V.isBatchedMesh&&(Gt.setOptional(W,V,"batchingTexture"),Gt.setValue(W,"batchingTexture",V._matricesTexture,R));let Da=X.morphAttributes;if((Da.position!==void 0||Da.normal!==void 0||Da.color!==void 0&&De.isWebGL2===!0)&&Ye.update(V,X,ci),(xs||Ve.receiveShadow!==V.receiveShadow)&&(Ve.receiveShadow=V.receiveShadow,Gt.setValue(W,"receiveShadow",V.receiveShadow)),q.isMeshGouraudMaterial&&q.envMap!==null&&(hi.envMap.value=Ce,hi.flipEnvMap.value=Ce.isCubeTexture&&Ce.isRenderTargetTexture===!1?-1:1),xs&&(Gt.setValue(W,"toneMappingExposure",v.toneMappingExposure),Ve.needsLights&&Su(hi,Ia),he&&q.fog===!0&&ce.refreshFogUniforms(hi,he),ce.refreshMaterialUniforms(hi,q,N,P,me),es.upload(W,kl(Ve),hi,R)),q.isShaderMaterial&&q.uniformsNeedUpdate===!0&&(es.upload(W,kl(Ve),hi,R),q.uniformsNeedUpdate=!1),q.isSpriteMaterial&&Gt.setValue(W,"center",V.center),Gt.setValue(W,"modelViewMatrix",V.modelViewMatrix),Gt.setValue(W,"normalMatrix",V.normalMatrix),Gt.setValue(W,"modelMatrix",V.matrixWorld),q.isShaderMaterial||q.isRawShaderMaterial){let un=q.uniformsGroups;for(let ka=0,Tu=un.length;ka<Tu;ka++)if(De.isWebGL2){let Fl=un[ka];it.update(Fl,ci),it.bind(Fl,ci)}else console.warn("THREE.WebGLRenderer: Uniform Buffer Objects can only be used with WebGL 2.")}return ci}function Su(A,O){A.ambientLightColor.needsUpdate=O,A.lightProbe.needsUpdate=O,A.directionalLights.needsUpdate=O,A.directionalLightShadows.needsUpdate=O,A.pointLights.needsUpdate=O,A.pointLightShadows.needsUpdate=O,A.spotLights.needsUpdate=O,A.spotLightShadows.needsUpdate=O,A.rectAreaLights.needsUpdate=O,A.hemisphereLights.needsUpdate=O}function Eu(A){return A.isMeshLambertMaterial||A.isMeshToonMaterial||A.isMeshPhongMaterial||A.isMeshStandardMaterial||A.isShadowMaterial||A.isShaderMaterial&&A.lights===!0}this.getActiveCubeFace=function(){return T},this.getActiveMipmapLevel=function(){return E},this.getRenderTarget=function(){return b},this.setRenderTargetTextures=function(A,O,X){Oe.get(A.texture).__webglTexture=O,Oe.get(A.depthTexture).__webglTexture=X;let q=Oe.get(A);q.__hasExternalTextures=!0,q.__hasExternalTextures&&(q.__autoAllocateDepthBuffer=X===void 0,q.__autoAllocateDepthBuffer||_e.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),q.__useRenderToTexture=!1))},this.setRenderTargetFramebuffer=function(A,O){let X=Oe.get(A);X.__webglFramebuffer=O,X.__useDefaultFramebuffer=O===void 0},this.setRenderTarget=function(A,O=0,X=0){b=A,T=O,E=X;let q=!0,V=null,he=!1,xe=!1;if(A){let Ce=Oe.get(A);Ce.__useDefaultFramebuffer!==void 0?(pe.bindFramebuffer(W.FRAMEBUFFER,null),q=!1):Ce.__webglFramebuffer===void 0?R.setupRenderTarget(A):Ce.__hasExternalTextures&&R.rebindTextures(A,Oe.get(A.texture).__webglTexture,Oe.get(A.depthTexture).__webglTexture);let He=A.texture;(He.isData3DTexture||He.isDataArrayTexture||He.isCompressedArrayTexture)&&(xe=!0);let ke=Oe.get(A).__webglFramebuffer;A.isWebGLCubeRenderTarget?(Array.isArray(ke[O])?V=ke[O][X]:V=ke[O],he=!0):De.isWebGL2&&A.samples>0&&R.useMultisampledRTT(A)===!1?V=Oe.get(A).__webglMultisampledFramebuffer:Array.isArray(ke)?V=ke[X]:V=ke,w.copy(A.viewport),U.copy(A.scissor),H=A.scissorTest}else w.copy(G).multiplyScalar(N).floor(),U.copy(Y).multiplyScalar(N).floor(),H=J;if(pe.bindFramebuffer(W.FRAMEBUFFER,V)&&De.drawBuffers&&q&&pe.drawBuffers(A,V),pe.viewport(w),pe.scissor(U),pe.setScissorTest(H),he){let Ce=Oe.get(A.texture);W.framebufferTexture2D(W.FRAMEBUFFER,W.COLOR_ATTACHMENT0,W.TEXTURE_CUBE_MAP_POSITIVE_X+O,Ce.__webglTexture,X)}else if(xe){let Ce=Oe.get(A.texture),He=O||0;W.framebufferTextureLayer(W.FRAMEBUFFER,W.COLOR_ATTACHMENT0,Ce.__webglTexture,X||0,He)}L=-1},this.readRenderTargetPixels=function(A,O,X,q,V,he,xe){if(!(A&&A.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Me=Oe.get(A).__webglFramebuffer;if(A.isWebGLCubeRenderTarget&&xe!==void 0&&(Me=Me[xe]),Me){pe.bindFramebuffer(W.FRAMEBUFFER,Me);try{let Ce=A.texture,He=Ce.format,ke=Ce.type;if(He!==ln&&de.convert(He)!==W.getParameter(W.IMPLEMENTATION_COLOR_READ_FORMAT)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}let Ne=ke===Ls&&(_e.has("EXT_color_buffer_half_float")||De.isWebGL2&&_e.has("EXT_color_buffer_float"));if(ke!==ri&&de.convert(ke)!==W.getParameter(W.IMPLEMENTATION_COLOR_READ_TYPE)&&!(ke===ti&&(De.isWebGL2||_e.has("OES_texture_float")||_e.has("WEBGL_color_buffer_float")))&&!Ne){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}O>=0&&O<=A.width-q&&X>=0&&X<=A.height-V&&W.readPixels(O,X,q,V,de.convert(He),de.convert(ke),he)}finally{let Ce=b!==null?Oe.get(b).__webglFramebuffer:null;pe.bindFramebuffer(W.FRAMEBUFFER,Ce)}}},this.copyFramebufferToTexture=function(A,O,X=0){let q=Math.pow(2,-X),V=Math.floor(O.image.width*q),he=Math.floor(O.image.height*q);R.setTexture2D(O,0),W.copyTexSubImage2D(W.TEXTURE_2D,X,0,0,A.x,A.y,V,he),pe.unbindTexture()},this.copyTextureToTexture=function(A,O,X,q=0){let V=O.image.width,he=O.image.height,xe=de.convert(X.format),Me=de.convert(X.type);R.setTexture2D(X,0),W.pixelStorei(W.UNPACK_FLIP_Y_WEBGL,X.flipY),W.pixelStorei(W.UNPACK_PREMULTIPLY_ALPHA_WEBGL,X.premultiplyAlpha),W.pixelStorei(W.UNPACK_ALIGNMENT,X.unpackAlignment),O.isDataTexture?W.texSubImage2D(W.TEXTURE_2D,q,A.x,A.y,V,he,xe,Me,O.image.data):O.isCompressedTexture?W.compressedTexSubImage2D(W.TEXTURE_2D,q,A.x,A.y,O.mipmaps[0].width,O.mipmaps[0].height,xe,O.mipmaps[0].data):W.texSubImage2D(W.TEXTURE_2D,q,A.x,A.y,xe,Me,O.image),q===0&&X.generateMipmaps&&W.generateMipmap(W.TEXTURE_2D),pe.unbindTexture()},this.copyTextureToTexture3D=function(A,O,X,q,V=0){if(v.isWebGL1Renderer){console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: can only be used with WebGL2.");return}let he=A.max.x-A.min.x+1,xe=A.max.y-A.min.y+1,Me=A.max.z-A.min.z+1,Ce=de.convert(q.format),He=de.convert(q.type),ke;if(q.isData3DTexture)R.setTexture3D(q,0),ke=W.TEXTURE_3D;else if(q.isDataArrayTexture||q.isCompressedArrayTexture)R.setTexture2DArray(q,0),ke=W.TEXTURE_2D_ARRAY;else{console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: only supports THREE.DataTexture3D and THREE.DataTexture2DArray.");return}W.pixelStorei(W.UNPACK_FLIP_Y_WEBGL,q.flipY),W.pixelStorei(W.UNPACK_PREMULTIPLY_ALPHA_WEBGL,q.premultiplyAlpha),W.pixelStorei(W.UNPACK_ALIGNMENT,q.unpackAlignment);let Ne=W.getParameter(W.UNPACK_ROW_LENGTH),St=W.getParameter(W.UNPACK_IMAGE_HEIGHT),sn=W.getParameter(W.UNPACK_SKIP_PIXELS),kt=W.getParameter(W.UNPACK_SKIP_ROWS),An=W.getParameter(W.UNPACK_SKIP_IMAGES),xt=X.isCompressedTexture?X.mipmaps[V]:X.image;W.pixelStorei(W.UNPACK_ROW_LENGTH,xt.width),W.pixelStorei(W.UNPACK_IMAGE_HEIGHT,xt.height),W.pixelStorei(W.UNPACK_SKIP_PIXELS,A.min.x),W.pixelStorei(W.UNPACK_SKIP_ROWS,A.min.y),W.pixelStorei(W.UNPACK_SKIP_IMAGES,A.min.z),X.isDataTexture||X.isData3DTexture?W.texSubImage3D(ke,V,O.x,O.y,O.z,he,xe,Me,Ce,He,xt.data):X.isCompressedArrayTexture?(console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: untested support for compressed srcTexture."),W.compressedTexSubImage3D(ke,V,O.x,O.y,O.z,he,xe,Me,Ce,xt.data)):W.texSubImage3D(ke,V,O.x,O.y,O.z,he,xe,Me,Ce,He,xt),W.pixelStorei(W.UNPACK_ROW_LENGTH,Ne),W.pixelStorei(W.UNPACK_IMAGE_HEIGHT,St),W.pixelStorei(W.UNPACK_SKIP_PIXELS,sn),W.pixelStorei(W.UNPACK_SKIP_ROWS,kt),W.pixelStorei(W.UNPACK_SKIP_IMAGES,An),V===0&&q.generateMipmaps&&W.generateMipmap(ke),pe.unbindTexture()},this.initTexture=function(A){A.isCubeTexture?R.setTextureCube(A,0):A.isData3DTexture?R.setTexture3D(A,0):A.isDataArrayTexture||A.isCompressedArrayTexture?R.setTexture2DArray(A,0):R.setTexture2D(A,0),pe.unbindTexture()},this.resetState=function(){T=0,E=0,b=null,pe.reset(),Fe.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Un}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=e===Sl?"display-p3":"srgb",t.unpackColorSpace=rt.workingColorSpace===da?"display-p3":"srgb"}get outputEncoding(){return console.warn("THREE.WebGLRenderer: Property .outputEncoding has been removed. Use .outputColorSpace instead."),this.outputColorSpace===ut?wi:jh}set outputEncoding(e){console.warn("THREE.WebGLRenderer: Property .outputEncoding has been removed. Use .outputColorSpace instead."),this.outputColorSpace=e===wi?ut:Fn}get useLegacyLights(){return console.warn("THREE.WebGLRenderer: The property .useLegacyLights has been deprecated. Migrate your lighting according to the following guide: https://discourse.threejs.org/t/updates-to-lighting-in-three-js-r155/53733."),this._useLegacyLights}set useLegacyLights(e){console.warn("THREE.WebGLRenderer: The property .useLegacyLights has been deprecated. Migrate your lighting according to the following guide: https://discourse.threejs.org/t/updates-to-lighting-in-three-js-r155/53733."),this._useLegacyLights=e}},sl=class extends ks{};sl.prototype.isWebGL1Renderer=!0;var ea=class s{constructor(e,t=1,n=1e3){this.isFog=!0,this.name="",this.color=new ie(e),this.near=t,this.far=n}clone(){return new s(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}},ta=class extends Ht{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t}};var na=class extends cn{constructor(e=null,t=1,n=1,i,r,a,o,l,c=Ot,h=Ot,u,d){super(null,a,o,l,c,h,i,r,u,d),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var ls=class extends pt{constructor(e,t,n,i=1){super(e,t,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=i}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){let e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}},Ki=new je,Ph=new je,Ar=[],Lh=new On,Fg=new je,As=new Re,Rs=new Bn,At=class extends Re{constructor(e,t,n){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new ls(new Float32Array(n*16),16),this.instanceColor=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let i=0;i<n;i++)this.setMatrixAt(i,Fg)}computeBoundingBox(){let e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new On),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Ki),Lh.copy(e.boundingBox).applyMatrix4(Ki),this.boundingBox.union(Lh)}computeBoundingSphere(){let e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new Bn),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Ki),Rs.copy(e.boundingSphere).applyMatrix4(Ki),this.boundingSphere.union(Rs)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){t.fromArray(this.instanceMatrix.array,e*16)}raycast(e,t){let n=this.matrixWorld,i=this.count;if(As.geometry=this.geometry,As.material=this.material,As.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Rs.copy(this.boundingSphere),Rs.applyMatrix4(n),e.ray.intersectsSphere(Rs)!==!1))for(let r=0;r<i;r++){this.getMatrixAt(r,Ki),Ph.multiplyMatrices(n,Ki),As.matrixWorld=Ph,As.raycast(e,Ar);for(let a=0,o=Ar.length;a<o;a++){let l=Ar[a];l.instanceId=r,l.object=this,t.push(l)}Ar.length=0}}setColorAt(e,t){this.instanceColor===null&&(this.instanceColor=new ls(new Float32Array(this.instanceMatrix.count*3),3)),t.toArray(this.instanceColor.array,e*3)}setMatrixAt(e,t){t.toArray(this.instanceMatrix.array,e*16)}updateMorphTargets(){}dispose(){this.dispatchEvent({type:"dispose"})}};var cs=class extends Hn{constructor(e){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new ie(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}},Ih=new k,Dh=new k,kh=new je,Io=new rs,Rr=new Bn,Ns=class extends Ht{constructor(e=new Qe,t=new cs){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[0];for(let i=1,r=t.count;i<r;i++)Ih.fromBufferAttribute(t,i-1),Dh.fromBufferAttribute(t,i),n[i]=n[i-1],n[i]+=Ih.distanceTo(Dh);e.setAttribute("lineDistance",new Se(n,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(e,t){let n=this.geometry,i=this.matrixWorld,r=e.params.Line.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Rr.copy(n.boundingSphere),Rr.applyMatrix4(i),Rr.radius+=r,e.ray.intersectsSphere(Rr)===!1)return;kh.copy(i).invert(),Io.copy(e.ray).applyMatrix4(kh);let o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=new k,h=new k,u=new k,d=new k,p=this.isLineSegments?2:1,g=n.index,m=n.attributes.position;if(g!==null){let f=Math.max(0,a.start),y=Math.min(g.count,a.start+a.count);for(let v=f,M=y-1;v<M;v+=p){let T=g.getX(v),E=g.getX(v+1);if(c.fromBufferAttribute(m,T),h.fromBufferAttribute(m,E),Io.distanceSqToSegment(c,h,d,u)>l)continue;d.applyMatrix4(this.matrixWorld);let L=e.ray.origin.distanceTo(d);L<e.near||L>e.far||t.push({distance:L,point:u.clone().applyMatrix4(this.matrixWorld),index:v,face:null,faceIndex:null,object:this})}}else{let f=Math.max(0,a.start),y=Math.min(m.count,a.start+a.count);for(let v=f,M=y-1;v<M;v+=p){if(c.fromBufferAttribute(m,v),h.fromBufferAttribute(m,v+1),Io.distanceSqToSegment(c,h,d,u)>l)continue;d.applyMatrix4(this.matrixWorld);let E=e.ray.origin.distanceTo(d);E<e.near||E>e.far||t.push({distance:E,point:u.clone().applyMatrix4(this.matrixWorld),index:v,face:null,faceIndex:null,object:this})}}}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=i.length;r<a;r++){let o=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}},Nh=new k,Uh=new k,ia=class extends Ns{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[];for(let i=0,r=t.count;i<r;i+=2)Nh.fromBufferAttribute(t,i),Uh.fromBufferAttribute(t,i+1),n[i]=i===0?0:n[i-1],n[i+1]=n[i]+Nh.distanceTo(Uh);e.setAttribute("lineDistance",new Se(n,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}};var Us=class extends Hn{constructor(e){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new ie(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}},Fh=new je,rl=new rs,Cr=new Bn,Pr=new k,li=class extends Ht{constructor(e=new Qe,t=new Us){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}raycast(e,t){let n=this.geometry,i=this.matrixWorld,r=e.params.Points.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Cr.copy(n.boundingSphere),Cr.applyMatrix4(i),Cr.radius+=r,e.ray.intersectsSphere(Cr)===!1)return;Fh.copy(i).invert(),rl.copy(e.ray).applyMatrix4(Fh);let o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=n.index,u=n.attributes.position;if(c!==null){let d=Math.max(0,a.start),p=Math.min(c.count,a.start+a.count);for(let g=d,x=p;g<x;g++){let m=c.getX(g);Pr.fromBufferAttribute(u,m),zh(Pr,m,l,i,e,t,this)}}else{let d=Math.max(0,a.start),p=Math.min(u.count,a.start+a.count);for(let g=d,x=p;g<x;g++)Pr.fromBufferAttribute(u,g),zh(Pr,g,l,i,e,t,this)}}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=i.length;r<a;r++){let o=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}};function zh(s,e,t,n,i,r,a){let o=rl.distanceSqToPoint(s);if(o<t){let l=new k;rl.closestPointToPoint(s,l),l.applyMatrix4(n);let c=i.ray.origin.distanceTo(l);if(c<i.near||c>i.far)return;r.push({distance:c,distanceToRay:Math.sqrt(o),point:l,index:e,face:null,object:a})}}var Gn=class extends cn{constructor(e,t,n,i,r,a,o,l,c){super(e,t,n,i,r,a,o,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}};var sa=class s extends Qe{constructor(e=1,t=32,n=0,i=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:e,segments:t,thetaStart:n,thetaLength:i},t=Math.max(3,t);let r=[],a=[],o=[],l=[],c=new k,h=new Ge;a.push(0,0,0),o.push(0,0,1),l.push(.5,.5);for(let u=0,d=3;u<=t;u++,d+=3){let p=n+u/t*i;c.x=e*Math.cos(p),c.y=e*Math.sin(p),a.push(c.x,c.y,c.z),o.push(0,0,1),h.x=(a[d]/e+1)/2,h.y=(a[d+1]/e+1)/2,l.push(h.x,h.y)}for(let u=1;u<=t;u++)r.push(u,u+1,0);this.setIndex(r),this.setAttribute("position",new Se(a,3)),this.setAttribute("normal",new Se(o,3)),this.setAttribute("uv",new Se(l,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.radius,e.segments,e.thetaStart,e.thetaLength)}},It=class s extends Qe{constructor(e=1,t=1,n=1,i=32,r=1,a=!1,o=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:i,heightSegments:r,openEnded:a,thetaStart:o,thetaLength:l};let c=this;i=Math.floor(i),r=Math.floor(r);let h=[],u=[],d=[],p=[],g=0,x=[],m=n/2,f=0;y(),a===!1&&(e>0&&v(!0),t>0&&v(!1)),this.setIndex(h),this.setAttribute("position",new Se(u,3)),this.setAttribute("normal",new Se(d,3)),this.setAttribute("uv",new Se(p,2));function y(){let M=new k,T=new k,E=0,b=(t-e)/n;for(let L=0;L<=r;L++){let _=[],w=L/r,U=w*(t-e)+e;for(let H=0;H<=i;H++){let K=H/i,I=K*l+o,C=Math.sin(I),P=Math.cos(I);T.x=U*C,T.y=-w*n+m,T.z=U*P,u.push(T.x,T.y,T.z),M.set(C,b,P).normalize(),d.push(M.x,M.y,M.z),p.push(K,1-w),_.push(g++)}x.push(_)}for(let L=0;L<i;L++)for(let _=0;_<r;_++){let w=x[_][L],U=x[_+1][L],H=x[_+1][L+1],K=x[_][L+1];h.push(w,U,K),h.push(U,H,K),E+=6}c.addGroup(f,E,0),f+=E}function v(M){let T=g,E=new Ge,b=new k,L=0,_=M===!0?e:t,w=M===!0?1:-1;for(let H=1;H<=i;H++)u.push(0,m*w,0),d.push(0,w,0),p.push(.5,.5),g++;let U=g;for(let H=0;H<=i;H++){let I=H/i*l+o,C=Math.cos(I),P=Math.sin(I);b.x=_*P,b.y=m*w,b.z=_*C,u.push(b.x,b.y,b.z),d.push(0,w,0),E.x=C*.5+.5,E.y=P*.5*w+.5,p.push(E.x,E.y),g++}for(let H=0;H<i;H++){let K=T+H,I=U+H;M===!0?h.push(I,I+1,K):h.push(I+1,I,K),L+=3}c.addGroup(f,L,M===!0?1:2),f+=L}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}},Ei=class s extends It{constructor(e=1,t=1,n=32,i=1,r=!1,a=0,o=Math.PI*2){super(0,e,t,n,i,r,a,o),this.type="ConeGeometry",this.parameters={radius:e,height:t,radialSegments:n,heightSegments:i,openEnded:r,thetaStart:a,thetaLength:o}}static fromJSON(e){return new s(e.radius,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}},al=class s extends Qe{constructor(e=[],t=[],n=1,i=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:e,indices:t,radius:n,detail:i};let r=[],a=[];o(i),c(n),h(),this.setAttribute("position",new Se(r,3)),this.setAttribute("normal",new Se(r.slice(),3)),this.setAttribute("uv",new Se(a,2)),i===0?this.computeVertexNormals():this.normalizeNormals();function o(y){let v=new k,M=new k,T=new k;for(let E=0;E<t.length;E+=3)p(t[E+0],v),p(t[E+1],M),p(t[E+2],T),l(v,M,T,y)}function l(y,v,M,T){let E=T+1,b=[];for(let L=0;L<=E;L++){b[L]=[];let _=y.clone().lerp(M,L/E),w=v.clone().lerp(M,L/E),U=E-L;for(let H=0;H<=U;H++)H===0&&L===E?b[L][H]=_:b[L][H]=_.clone().lerp(w,H/U)}for(let L=0;L<E;L++)for(let _=0;_<2*(E-L)-1;_++){let w=Math.floor(_/2);_%2===0?(d(b[L][w+1]),d(b[L+1][w]),d(b[L][w])):(d(b[L][w+1]),d(b[L+1][w+1]),d(b[L+1][w]))}}function c(y){let v=new k;for(let M=0;M<r.length;M+=3)v.x=r[M+0],v.y=r[M+1],v.z=r[M+2],v.normalize().multiplyScalar(y),r[M+0]=v.x,r[M+1]=v.y,r[M+2]=v.z}function h(){let y=new k;for(let v=0;v<r.length;v+=3){y.x=r[v+0],y.y=r[v+1],y.z=r[v+2];let M=m(y)/2/Math.PI+.5,T=f(y)/Math.PI+.5;a.push(M,1-T)}g(),u()}function u(){for(let y=0;y<a.length;y+=6){let v=a[y+0],M=a[y+2],T=a[y+4],E=Math.max(v,M,T),b=Math.min(v,M,T);E>.9&&b<.1&&(v<.2&&(a[y+0]+=1),M<.2&&(a[y+2]+=1),T<.2&&(a[y+4]+=1))}}function d(y){r.push(y.x,y.y,y.z)}function p(y,v){let M=y*3;v.x=e[M+0],v.y=e[M+1],v.z=e[M+2]}function g(){let y=new k,v=new k,M=new k,T=new k,E=new Ge,b=new Ge,L=new Ge;for(let _=0,w=0;_<r.length;_+=9,w+=6){y.set(r[_+0],r[_+1],r[_+2]),v.set(r[_+3],r[_+4],r[_+5]),M.set(r[_+6],r[_+7],r[_+8]),E.set(a[w+0],a[w+1]),b.set(a[w+2],a[w+3]),L.set(a[w+4],a[w+5]),T.copy(y).add(v).add(M).divideScalar(3);let U=m(T);x(E,w+0,y,U),x(b,w+2,v,U),x(L,w+4,M,U)}}function x(y,v,M,T){T<0&&y.x===1&&(a[v]=y.x-1),M.x===0&&M.z===0&&(a[v]=T/2/Math.PI+.5)}function m(y){return Math.atan2(y.z,-y.x)}function f(y){return Math.atan2(-y.y,Math.sqrt(y.x*y.x+y.z*y.z))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.vertices,e.indices,e.radius,e.details)}};var Lr=new k,Ir=new k,Do=new k,Dr=new _i,ra=class extends Qe{constructor(e=null,t=1){if(super(),this.type="EdgesGeometry",this.parameters={geometry:e,thresholdAngle:t},e!==null){let i=Math.pow(10,4),r=Math.cos(Nr*t),a=e.getIndex(),o=e.getAttribute("position"),l=a?a.count:o.count,c=[0,0,0],h=["a","b","c"],u=new Array(3),d={},p=[];for(let g=0;g<l;g+=3){a?(c[0]=a.getX(g),c[1]=a.getX(g+1),c[2]=a.getX(g+2)):(c[0]=g,c[1]=g+1,c[2]=g+2);let{a:x,b:m,c:f}=Dr;if(x.fromBufferAttribute(o,c[0]),m.fromBufferAttribute(o,c[1]),f.fromBufferAttribute(o,c[2]),Dr.getNormal(Do),u[0]=`${Math.round(x.x*i)},${Math.round(x.y*i)},${Math.round(x.z*i)}`,u[1]=`${Math.round(m.x*i)},${Math.round(m.y*i)},${Math.round(m.z*i)}`,u[2]=`${Math.round(f.x*i)},${Math.round(f.y*i)},${Math.round(f.z*i)}`,!(u[0]===u[1]||u[1]===u[2]||u[2]===u[0]))for(let y=0;y<3;y++){let v=(y+1)%3,M=u[y],T=u[v],E=Dr[h[y]],b=Dr[h[v]],L=`${M}_${T}`,_=`${T}_${M}`;_ in d&&d[_]?(Do.dot(d[_].normal)<=r&&(p.push(E.x,E.y,E.z),p.push(b.x,b.y,b.z)),d[_]=null):L in d||(d[L]={index0:c[y],index1:c[v],normal:Do.clone()})}}for(let g in d)if(d[g]){let{index0:x,index1:m}=d[g];Lr.fromBufferAttribute(o,x),Ir.fromBufferAttribute(o,m),p.push(Lr.x,Lr.y,Lr.z),p.push(Ir.x,Ir.y,Ir.z)}this.setAttribute("position",new Se(p,3))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}};var hs=class s extends al{constructor(e=1,t=0){let n=(1+Math.sqrt(5))/2,i=[-1,n,0,1,n,0,-1,-n,0,1,-n,0,0,-1,n,0,1,n,0,-1,-n,0,1,-n,n,0,-1,n,0,1,-n,0,-1,-n,0,1],r=[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];super(i,r,e,t),this.type="IcosahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new s(e.radius,e.detail)}};var Ti=class s extends Qe{constructor(e=.5,t=1,n=32,i=1,r=0,a=Math.PI*2){super(),this.type="RingGeometry",this.parameters={innerRadius:e,outerRadius:t,thetaSegments:n,phiSegments:i,thetaStart:r,thetaLength:a},n=Math.max(3,n),i=Math.max(1,i);let o=[],l=[],c=[],h=[],u=e,d=(t-e)/i,p=new k,g=new Ge;for(let x=0;x<=i;x++){for(let m=0;m<=n;m++){let f=r+m/n*a;p.x=u*Math.cos(f),p.y=u*Math.sin(f),l.push(p.x,p.y,p.z),c.push(0,0,1),g.x=(p.x/t+1)/2,g.y=(p.y/t+1)/2,h.push(g.x,g.y)}u+=d}for(let x=0;x<i;x++){let m=x*(n+1);for(let f=0;f<n;f++){let y=f+m,v=y,M=y+n+1,T=y+n+2,E=y+1;o.push(v,M,E),o.push(M,T,E)}}this.setIndex(o),this.setAttribute("position",new Se(l,3)),this.setAttribute("normal",new Se(c,3)),this.setAttribute("uv",new Se(h,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.innerRadius,e.outerRadius,e.thetaSegments,e.phiSegments,e.thetaStart,e.thetaLength)}};var us=class s extends Qe{constructor(e=1,t=32,n=16,i=0,r=Math.PI*2,a=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:n,phiStart:i,phiLength:r,thetaStart:a,thetaLength:o},t=Math.max(3,Math.floor(t)),n=Math.max(2,Math.floor(n));let l=Math.min(a+o,Math.PI),c=0,h=[],u=new k,d=new k,p=[],g=[],x=[],m=[];for(let f=0;f<=n;f++){let y=[],v=f/n,M=0;f===0&&a===0?M=.5/t:f===n&&l===Math.PI&&(M=-.5/t);for(let T=0;T<=t;T++){let E=T/t;u.x=-e*Math.cos(i+E*r)*Math.sin(a+v*o),u.y=e*Math.cos(a+v*o),u.z=e*Math.sin(i+E*r)*Math.sin(a+v*o),g.push(u.x,u.y,u.z),d.copy(u).normalize(),x.push(d.x,d.y,d.z),m.push(E+M,1-v),y.push(c++)}h.push(y)}for(let f=0;f<n;f++)for(let y=0;y<t;y++){let v=h[f][y+1],M=h[f][y],T=h[f+1][y],E=h[f+1][y+1];(f!==0||a>0)&&p.push(v,M,E),(f!==n-1||l<Math.PI)&&p.push(M,T,E)}this.setIndex(p),this.setAttribute("position",new Se(g,3)),this.setAttribute("normal",new Se(x,3)),this.setAttribute("uv",new Se(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.radius,e.widthSegments,e.heightSegments,e.phiStart,e.phiLength,e.thetaStart,e.thetaLength)}};var aa=class s extends Qe{constructor(e=1,t=.4,n=12,i=48,r=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:e,tube:t,radialSegments:n,tubularSegments:i,arc:r},n=Math.floor(n),i=Math.floor(i);let a=[],o=[],l=[],c=[],h=new k,u=new k,d=new k;for(let p=0;p<=n;p++)for(let g=0;g<=i;g++){let x=g/i*r,m=p/n*Math.PI*2;u.x=(e+t*Math.cos(m))*Math.cos(x),u.y=(e+t*Math.cos(m))*Math.sin(x),u.z=t*Math.sin(m),o.push(u.x,u.y,u.z),h.x=e*Math.cos(x),h.y=e*Math.sin(x),d.subVectors(u,h).normalize(),l.push(d.x,d.y,d.z),c.push(g/i),c.push(p/n)}for(let p=1;p<=n;p++)for(let g=1;g<=i;g++){let x=(i+1)*p+g-1,m=(i+1)*(p-1)+g-1,f=(i+1)*(p-1)+g,y=(i+1)*p+g;a.push(x,m,y),a.push(m,f,y)}this.setIndex(a),this.setAttribute("position",new Se(o,3)),this.setAttribute("normal",new Se(l,3)),this.setAttribute("uv",new Se(c,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.radius,e.tube,e.radialSegments,e.tubularSegments,e.arc)}};var Ze=class extends Hn{constructor(e){super(),this.isMeshStandardMaterial=!0,this.defines={STANDARD:""},this.type="MeshStandardMaterial",this.color=new ie(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new ie(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Qh,this.normalScale=new Ge(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}};function kr(s,e,t){return!s||!t&&s.constructor===e?s:typeof e.BYTES_PER_ELEMENT=="number"?new e(s):Array.prototype.slice.call(s)}function zg(s){return ArrayBuffer.isView(s)&&!(s instanceof DataView)}var ds=class{constructor(e,t,n,i){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=i!==void 0?i:new t.constructor(n),this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,n=this._cachedIndex,i=t[n],r=t[n-1];n:{e:{let a;t:{i:if(!(e<i)){for(let o=n+2;;){if(i===void 0){if(e<r)break i;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===o)break;if(r=i,i=t[++n],e<i)break e}a=t.length;break t}if(!(e>=r)){let o=t[1];e<o&&(n=2,r=o);for(let l=n-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===l)break;if(i=r,r=t[--n-1],e>=r)break e}a=n,n=0;break t}break n}for(;n<a;){let o=n+a>>>1;e<t[o]?a=o:n=o+1}if(i=t[n],r=t[n-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,r,i)}return this.interpolate_(n,r,e,i)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,i=this.valueSize,r=e*i;for(let a=0;a!==i;++a)t[a]=n[r+a];return t}interpolate_(){throw new Error("call to abstract method")}intervalChanged_(){}},ol=class extends ds{constructor(e,t,n,i){super(e,t,n,i),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Bc,endingEnd:Bc}}intervalChanged_(e,t,n){let i=this.parameterPositions,r=e-2,a=e+1,o=i[r],l=i[a];if(o===void 0)switch(this.getSettings_().endingStart){case Hc:r=e,o=2*t-n;break;case Gc:r=i.length-2,o=t+i[r]-i[r+1];break;default:r=e,o=n}if(l===void 0)switch(this.getSettings_().endingEnd){case Hc:a=e,l=2*n-t;break;case Gc:a=1,l=n+i[1]-i[0];break;default:a=e-1,l=t}let c=(n-t)*.5,h=this.valueSize;this._weightPrev=c/(t-o),this._weightNext=c/(l-n),this._offsetPrev=r*h,this._offsetNext=a*h}interpolate_(e,t,n,i){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,h=this._offsetPrev,u=this._offsetNext,d=this._weightPrev,p=this._weightNext,g=(n-t)/(i-t),x=g*g,m=x*g,f=-d*m+2*d*x-d*g,y=(1+d)*m+(-1.5-2*d)*x+(-.5+d)*g+1,v=(-1-p)*m+(1.5+p)*x+.5*g,M=p*m-p*x;for(let T=0;T!==o;++T)r[T]=f*a[h+T]+y*a[c+T]+v*a[l+T]+M*a[u+T];return r}},ll=class extends ds{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,h=(n-t)/(i-t),u=1-h;for(let d=0;d!==o;++d)r[d]=a[c+d]*u+a[l+d]*h;return r}},cl=class extends ds{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e){return this.copySampleValue_(e-1)}},_n=class{constructor(e,t,n,i){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=kr(t,this.TimeBufferType),this.values=kr(n,this.ValueBufferType),this.setInterpolation(i||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:kr(e.times,Array),values:kr(e.values,Array)};let i=e.getInterpolation();i!==e.DefaultInterpolation&&(n.interpolation=i)}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new cl(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new ll(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new ol(this.times,this.values,this.getValueSize(),e)}setInterpolation(e){let t;switch(e){case Fr:t=this.InterpolantFactoryMethodDiscrete;break;case zr:t=this.InterpolantFactoryMethodLinear;break;case oo:t=this.InterpolantFactoryMethodSmooth;break}if(t===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return console.warn("THREE.KeyframeTrack:",n),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return Fr;case this.InterpolantFactoryMethodLinear:return zr;case this.InterpolantFactoryMethodSmooth:return oo}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]*=e}return this}trim(e,t){let n=this.times,i=n.length,r=0,a=i-1;for(;r!==i&&n[r]<e;)++r;for(;a!==-1&&n[a]>t;)--a;if(++a,r!==0||a!==i){r>=a&&(a=Math.max(a,1),r=a-1);let o=this.getValueSize();this.times=n.slice(r,a),this.values=this.values.slice(r*o,a*o)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(console.error("THREE.KeyframeTrack: Invalid value size in track.",this),e=!1);let n=this.times,i=this.values,r=n.length;r===0&&(console.error("THREE.KeyframeTrack: Track is empty.",this),e=!1);let a=null;for(let o=0;o!==r;o++){let l=n[o];if(typeof l=="number"&&isNaN(l)){console.error("THREE.KeyframeTrack: Time is not a valid number.",this,o,l),e=!1;break}if(a!==null&&a>l){console.error("THREE.KeyframeTrack: Out of order keys.",this,o,l,a),e=!1;break}a=l}if(i!==void 0&&zg(i))for(let o=0,l=i.length;o!==l;++o){let c=i[o];if(isNaN(c)){console.error("THREE.KeyframeTrack: Value is not a valid number.",this,o,c),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),i=this.getInterpolation()===oo,r=e.length-1,a=1;for(let o=1;o<r;++o){let l=!1,c=e[o],h=e[o+1];if(c!==h&&(o!==1||c!==e[0]))if(i)l=!0;else{let u=o*n,d=u-n,p=u+n;for(let g=0;g!==n;++g){let x=t[u+g];if(x!==t[d+g]||x!==t[p+g]){l=!0;break}}}if(l){if(o!==a){e[a]=e[o];let u=o*n,d=a*n;for(let p=0;p!==n;++p)t[d+p]=t[u+p]}++a}}if(r>0){e[a]=e[r];for(let o=r*n,l=a*n,c=0;c!==n;++c)t[l+c]=t[o+c];++a}return a!==e.length?(this.times=e.slice(0,a),this.values=t.slice(0,a*n)):(this.times=e,this.values=t),this}clone(){let e=this.times.slice(),t=this.values.slice(),n=this.constructor,i=new n(this.name,e,t);return i.createInterpolant=this.createInterpolant,i}};_n.prototype.TimeBufferType=Float32Array;_n.prototype.ValueBufferType=Float32Array;_n.prototype.DefaultInterpolation=zr;var Ai=class extends _n{};Ai.prototype.ValueTypeName="bool";Ai.prototype.ValueBufferType=Array;Ai.prototype.DefaultInterpolation=Fr;Ai.prototype.InterpolantFactoryMethodLinear=void 0;Ai.prototype.InterpolantFactoryMethodSmooth=void 0;var hl=class extends _n{};hl.prototype.ValueTypeName="color";var ul=class extends _n{};ul.prototype.ValueTypeName="number";var dl=class extends ds{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=(n-t)/(i-t),c=e*o;for(let h=c+o;c!==h;c+=4)Bt.slerpFlat(r,0,a,c-o,a,c,l);return r}},Fs=class extends _n{InterpolantFactoryMethodLinear(e){return new dl(this.times,this.values,this.getValueSize(),e)}};Fs.prototype.ValueTypeName="quaternion";Fs.prototype.DefaultInterpolation=zr;Fs.prototype.InterpolantFactoryMethodSmooth=void 0;var Ri=class extends _n{};Ri.prototype.ValueTypeName="string";Ri.prototype.ValueBufferType=Array;Ri.prototype.DefaultInterpolation=Fr;Ri.prototype.InterpolantFactoryMethodLinear=void 0;Ri.prototype.InterpolantFactoryMethodSmooth=void 0;var fl=class extends _n{};fl.prototype.ValueTypeName="vector";var pl=class{constructor(e,t,n){let i=this,r=!1,a=0,o=0,l,c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this.itemStart=function(h){o++,r===!1&&i.onStart!==void 0&&i.onStart(h,a,o),r=!0},this.itemEnd=function(h){a++,i.onProgress!==void 0&&i.onProgress(h,a,o),a===o&&(r=!1,i.onLoad!==void 0&&i.onLoad())},this.itemError=function(h){i.onError!==void 0&&i.onError(h)},this.resolveURL=function(h){return l?l(h):h},this.setURLModifier=function(h){return l=h,this},this.addHandler=function(h,u){return c.push(h,u),this},this.removeHandler=function(h){let u=c.indexOf(h);return u!==-1&&c.splice(u,2),this},this.getHandler=function(h){for(let u=0,d=c.length;u<d;u+=2){let p=c[u],g=c[u+1];if(p.global&&(p.lastIndex=0),p.test(h))return g}return null}}},Og=new pl,ml=class{constructor(e){this.manager=e!==void 0?e:Og,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}load(){}loadAsync(e,t){let n=this;return new Promise(function(i,r){n.load(e,i,t,r)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}};ml.DEFAULT_MATERIAL_NAME="__DEFAULT";var oa=class extends Ht{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new ie(e),this.intensity=t}dispose(){}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,this.groundColor!==void 0&&(t.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(t.object.distance=this.distance),this.angle!==void 0&&(t.object.angle=this.angle),this.decay!==void 0&&(t.object.decay=this.decay),this.penumbra!==void 0&&(t.object.penumbra=this.penumbra),this.shadow!==void 0&&(t.object.shadow=this.shadow.toJSON()),t}},la=class extends oa{constructor(e,t,n){super(e,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Ht.DEFAULT_UP),this.updateMatrix(),this.groundColor=new ie(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}},ko=new je,Oh=new k,Bh=new k,gl=class{constructor(e){this.camera=e,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new Ge(512,512),this.map=null,this.mapPass=null,this.matrix=new je,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Ds,this._frameExtents=new Ge(1,1),this._viewportCount=1,this._viewports=[new Ut(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera,n=this.matrix;Oh.setFromMatrixPosition(e.matrixWorld),t.position.copy(Oh),Bh.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(Bh),t.updateMatrixWorld(),ko.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(ko),n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(ko)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.bias=e.bias,this.radius=e.radius,this.mapSize.copy(e.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}};var xl=class extends gl{constructor(){super(new Jr(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},ca=class extends oa{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Ht.DEFAULT_UP),this.updateMatrix(),this.target=new Ht,this.shadow=new xl}dispose(){this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}};var Tl="\\[\\]\\.:\\/",Bg=new RegExp("["+Tl+"]","g"),Al="[^"+Tl+"]",Hg="[^"+Tl.replace("\\.","")+"]",Gg=/((?:WC+[\/:])*)/.source.replace("WC",Al),Wg=/(WCOD+)?/.source.replace("WCOD",Hg),Vg=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",Al),$g=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",Al),Xg=new RegExp("^"+Gg+Wg+Vg+$g+"$"),qg=["material","materials","bones","map"],vl=class{constructor(e,t,n){let i=n||mt.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,i)}getValue(e,t){this.bind();let n=this._targetGroup.nCachedObjects_,i=this._bindings[n];i!==void 0&&i.getValue(e,t)}setValue(e,t){let n=this._bindings;for(let i=this._targetGroup.nCachedObjects_,r=n.length;i!==r;++i)n[i].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].unbind()}},mt=class s{constructor(e,t,n){this.path=t,this.parsedPath=n||s.parseTrackName(t),this.node=s.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,n){return e&&e.isAnimationObjectGroup?new s.Composite(e,t,n):new s(e,t,n)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(Bg,"")}static parseTrackName(e){let t=Xg.exec(e);if(t===null)throw new Error("PropertyBinding: Cannot parse trackName: "+e);let n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},i=n.nodeName&&n.nodeName.lastIndexOf(".");if(i!==void 0&&i!==-1){let r=n.nodeName.substring(i+1);qg.indexOf(r)!==-1&&(n.nodeName=n.nodeName.substring(0,i),n.objectName=r)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("PropertyBinding: can not parse propertyName from trackName: "+e);return n}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){let n=function(r){for(let a=0;a<r.length;a++){let o=r[a];if(o.name===t||o.uuid===t)return o;let l=n(o.children);if(l)return l}return null},i=n(e.children);if(i)return i}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)e[t++]=n[i]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node,t=this.parsedPath,n=t.objectName,i=t.propertyName,r=t.propertyIndex;if(e||(e=s.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){console.warn("THREE.PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let c=t.objectIndex;switch(n){case"materials":if(!e.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){console.error("THREE.PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){console.error("THREE.PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let h=0;h<e.length;h++)if(e[h].name===c){c=h;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){console.error("THREE.PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[n]===void 0){console.error("THREE.PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[n]}if(c!==void 0){if(e[c]===void 0){console.error("THREE.PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[c]}}let a=e[i];if(a===void 0){let c=t.nodeName;console.error("THREE.PropertyBinding: Trying to update property for track: "+c+"."+i+" but it wasn't found.",e);return}let o=this.Versioning.None;this.targetObject=e,e.needsUpdate!==void 0?o=this.Versioning.NeedsUpdate:e.matrixWorldNeedsUpdate!==void 0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(r!==void 0){if(i==="morphTargetInfluences"){if(!e.geometry){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[r]!==void 0&&(r=e.morphTargetDictionary[r])}l=this.BindingType.ArrayElement,this.resolvedProperty=a,this.propertyIndex=r}else a.fromArray!==void 0&&a.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=a):Array.isArray(a)?(l=this.BindingType.EntireArray,this.resolvedProperty=a):this.propertyName=i;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};mt.Composite=vl;mt.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};mt.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};mt.prototype.GetterByBindingType=[mt.prototype._getValue_direct,mt.prototype._getValue_array,mt.prototype._getValue_arrayElement,mt.prototype._getValue_toArray];mt.prototype.SetterByBindingTypeAndVersioning=[[mt.prototype._setValue_direct,mt.prototype._setValue_direct_setNeedsUpdate,mt.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[mt.prototype._setValue_array,mt.prototype._setValue_array_setNeedsUpdate,mt.prototype._setValue_array_setMatrixWorldNeedsUpdate],[mt.prototype._setValue_arrayElement,mt.prototype._setValue_arrayElement_setNeedsUpdate,mt.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[mt.prototype._setValue_fromArray,mt.prototype._setValue_fromArray_setNeedsUpdate,mt.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var tv=new Float32Array(1);var ha=class{constructor(e,t,n=0,i=1/0){this.ray=new rs(e,t),this.near=n,this.far=i,this.camera=null,this.layers=new Is,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){t.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t):t.isOrthographicCamera?(this.ray.origin.set(e.x,e.y,(t.near+t.far)/(t.near-t.far)).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t):console.error("THREE.Raycaster: Unsupported camera type: "+t.type)}intersectObject(e,t=!0,n=[]){return yl(e,this,n,t),n.sort(Hh),n}intersectObjects(e,t=!0,n=[]){for(let i=0,r=e.length;i<r;i++)yl(e[i],this,n,t);return n.sort(Hh),n}};function Hh(s,e){return s.distance-e.distance}function yl(s,e,t,n){if(s.layers.test(e.layers)&&s.raycast(e,t),n===!0){let i=s.children;for(let r=0,a=i.length;r<a;r++)yl(i[r],e,t,!0)}}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:_l}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=_l);var ps={uNight:{value:0},uTime:{value:0}};function hu(s={}){let e=new Ze({color:16777215,roughness:.82,metalness:.02,...s});return e.onBeforeCompile=t=>{t.uniforms.uNight=ps.uNight,t.vertexShader=t.vertexShader.replace("#include <common>",`#include <common>
attribute float aWin;
varying float vWin;
varying vec3 vWPos;
varying vec3 vWNorm;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vWin = aWin;
#ifdef USE_INSTANCING
  vec4 wpW = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
  vWNorm = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
#else
  vec4 wpW = modelMatrix * vec4(transformed, 1.0);
  vWNorm = normalize(mat3(modelMatrix) * objectNormal);
#endif
vWPos = wpW.xyz;`),t.fragmentShader=t.fragmentShader.replace("#include <common>",`#include <common>
uniform float uNight;
varying float vWin;
varying vec3 vWPos;
varying vec3 vWNorm;
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
if (vWin > 0.5) {
  vec3 nW = normalize(vWNorm);
  if (abs(nW.y) < 0.4) {
    float u = abs(nW.x) > 0.5 ? vWPos.z : vWPos.x;
    float v = vWPos.y;
    float sx = 0.15; float sy = 0.21; float wx = 0.48; float wy = 0.52; float base = 0.1;
    vec3 glass = vec3(0.22, 0.3, 0.38);
    if (vWin > 1.5 && vWin < 2.5) { sx = 0.11; sy = 0.17; wx = 0.82; wy = 0.64; glass = vec3(0.32, 0.45, 0.55); base = 0.06; }
    else if (vWin > 2.5 && vWin < 3.5) { sx = 0.2; sy = 0.26; wx = 0.72; wy = 0.6; base = 0.05; }
    else if (vWin > 3.5) { sx = 0.3; sy = 0.32; wx = 0.6; wy = 0.28; glass = vec3(0.4, 0.45, 0.5); base = 0.18; }
    vec2 g = vec2(u / sx, (v - base) / sy);
    vec2 cell = floor(g);
    vec2 f = fract(g);
    float m = step(abs(f.x - 0.5), wx * 0.5) * step(abs(f.y - 0.5), wy * 0.5) * step(base, v);
    vec2 tileId = floor(vWPos.xz + 0.5 * nW.xz);
    float h = hash21(cell + tileId * 17.13);
    float litAmount = smoothstep(0.0, 1.0, uNight);
    float lit = step(1.0 - litAmount * 0.62, h);
    vec3 warm = mix(vec3(1.0, 0.78, 0.45), vec3(0.85, 0.92, 1.0), step(0.86, h));
    vec3 dayGlass = glass * (0.85 + 0.3 * h);
    diffuseColor.rgb = mix(diffuseColor.rgb, dayGlass * (1.0 - 0.6 * litAmount), m * 0.88);
    totalEmissiveRadiance += m * lit * warm * (0.55 + 0.9 * litAmount);
    roughnessFactor = mix(roughnessFactor, 0.18, m);
  }
}`)},e.customProgramCacheKey=()=>"bldWin",e}function uu(){let s=new Ze({color:4169656,transparent:!0,opacity:.84,roughness:.1,metalness:.1,depthWrite:!1});return s.onBeforeCompile=e=>{e.uniforms.uTime=ps.uTime,e.uniforms.uNight=ps.uNight,e.vertexShader=e.vertexShader.replace("#include <common>",`#include <common>
uniform float uTime;
varying vec2 vXZ;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vXZ = (modelMatrix * vec4(transformed, 1.0)).xz;
transformed.z += sin(vXZ.x * 1.7 + uTime * 1.3) * 0.025 + cos(vXZ.y * 1.3 + uTime * 0.9) * 0.025;`),e.fragmentShader=e.fragmentShader.replace("#include <common>",`#include <common>
uniform float uTime;
uniform float uNight;
varying vec2 vXZ;`).replace("#include <color_fragment>",`#include <color_fragment>
float rip = sin(vXZ.x * 3.1 + uTime * 1.6) * sin(vXZ.y * 2.7 - uTime * 1.2);
diffuseColor.rgb += vec3(0.05, 0.07, 0.07) * smoothstep(0.55, 1.0, rip);
diffuseColor.rgb *= 1.0 - uNight * 0.35;`)},s.customProgramCacheKey=()=>"water",s}function du(){let s=document.createElement("canvas");s.width=s.height=64;let e=s.getContext("2d"),t=e.createRadialGradient(32,32,0,32,32,32);t.addColorStop(0,"rgba(255,255,255,1)"),t.addColorStop(.25,"rgba(255,255,255,0.6)"),t.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=t,e.fillRect(0,0,64,64);let n=new Gn(s);return n.colorSpace=ut,n}function pa(s,e=!0){return new en({uniforms:{uTex:{value:s},uScale:{value:300}},vertexShader:`
attribute float aSize;
attribute vec4 aColor;
varying vec4 vColor;
uniform float uScale;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`,fragmentShader:`
uniform sampler2D uTex;
varying vec4 vColor;
void main() {
  vec4 t = texture2D(uTex, gl_PointCoord);
  gl_FragColor = vec4(vColor.rgb, vColor.a * t.a);
  if (gl_FragColor.a < 0.01) discard;
}`,transparent:!0,depthWrite:!1,blending:e?ts:ii})}var ms=class{constructor(e,t){this.max=e,this.pos=new Float32Array(e*3),this.col=new Float32Array(e*4),this.size=new Float32Array(e),this.geo=new Qe,this.geo.setAttribute("position",new pt(this.pos,3).setUsage(Ci)),this.geo.setAttribute("aColor",new pt(this.col,4).setUsage(Ci)),this.geo.setAttribute("aSize",new pt(this.size,1).setUsage(Ci)),this.points=new li(this.geo,t),this.points.frustumCulled=!1,this.n=0}begin(){this.n=0}add(e,t,n,i,r,a,o,l){if(this.n>=this.max)return;let c=this.n++;this.pos[c*3]=e,this.pos[c*3+1]=t,this.pos[c*3+2]=n,this.col[c*4]=r,this.col[c*4+1]=a,this.col[c*4+2]=o,this.col[c*4+3]=l,this.size[c]=i}end(){this.geo.setDrawRange(0,this.n),this.geo.attributes.position.needsUpdate=!0,this.geo.attributes.aColor.needsUpdate=!0,this.geo.attributes.aSize.needsUpdate=!0}};var ma=class{constructor(e,t,n){this.camera=e,this.dom=t,this.size=n,this.target=new k(0,0,0),this.goal={x:0,z:0,dist:34,yaw:.7,pitch:.95},this.cur={...this.goal},this.keys=new Set,this.drag=null,this.minDist=6,this.maxDist=n*1.5,this.enabled=!0,this.autoRotate=0,this._ray=new ha,this._plane=new vn(new k(0,1,0),0),this.bind()}bind(){let e=this.dom;e.addEventListener("contextmenu",i=>i.preventDefault()),e.addEventListener("pointerdown",i=>{this.enabled&&(i.button===2||i.button===1||i.button===0&&i.altKey)&&(this.drag={mode:i.button===2&&!i.shiftKey?"pan":"rotate",x:i.clientX,y:i.clientY,id:i.pointerId,moved:0},e.setPointerCapture(i.pointerId))}),e.addEventListener("pointermove",i=>{if(!this.drag||i.pointerId!==this.drag.id)return;let r=i.clientX-this.drag.x,a=i.clientY-this.drag.y;this.drag.x=i.clientX,this.drag.y=i.clientY,this.drag.moved+=Math.abs(r)+Math.abs(a),this.drag.mode==="pan"?this.panScreen(r,a):(this.goal.yaw-=r*.006,this.goal.pitch=ve(this.goal.pitch+a*.005,.42,1.38))});let t=i=>{this.drag&&i.pointerId===this.drag.id&&(this.drag=null)};e.addEventListener("pointerup",t),e.addEventListener("pointercancel",t),e.addEventListener("wheel",i=>{if(!this.enabled)return;i.preventDefault();let r=Math.exp(Math.sign(i.deltaY)*Math.min(Math.abs(i.deltaY),120)*.0016),a=this.groundAt(i.clientX,i.clientY),o=ve(this.goal.dist*r,this.minDist,this.maxDist);if(a&&r<1){let l=1-o/this.goal.dist;this.goal.x+=(a.x-this.goal.x)*l*.9,this.goal.z+=(a.z-this.goal.z)*l*.9}this.goal.dist=o,this.clampGoal()},{passive:!1}),window.addEventListener("keydown",i=>{i.target&&(i.target.tagName==="INPUT"||i.target.tagName==="TEXTAREA")||this.keys.add(i.code)}),window.addEventListener("keyup",i=>this.keys.delete(i.code)),window.addEventListener("blur",()=>this.keys.clear()),this.touches=new Map,e.addEventListener("pointerdown",i=>{i.pointerType==="touch"&&this.touches.set(i.pointerId,{x:i.clientX,y:i.clientY})}),e.addEventListener("pointermove",i=>{if(i.pointerType!=="touch"||!this.touches.has(i.pointerId))return;let r=[...this.touches.values()];if(this.touches.size===2){let[a,o]=r,l=Math.hypot(a.x-o.x,a.y-o.y),c=Math.atan2(o.y-a.y,o.x-a.x),h={x:(a.x+o.x)/2,y:(a.y+o.y)/2};this.touches.set(i.pointerId,{x:i.clientX,y:i.clientY});let[u,d]=[...this.touches.values()],p=Math.hypot(u.x-d.x,u.y-d.y),g=Math.atan2(d.y-u.y,d.x-u.x),x={x:(u.x+d.x)/2,y:(u.y+d.y)/2};l>10&&(this.goal.dist=ve(this.goal.dist*(l/Math.max(10,p)),this.minDist,this.maxDist)),this.goal.yaw+=g-c,this.panScreen(x.x-h.x,x.y-h.y),this.pinching=!0}else this.touches.set(i.pointerId,{x:i.clientX,y:i.clientY})});let n=i=>{this.touches.delete(i.pointerId),this.touches.size<2&&setTimeout(()=>this.pinching=!1,50)};e.addEventListener("pointerup",n),e.addEventListener("pointercancel",n)}panScreen(e,t){let n=this.cur.dist*.0021,i=Math.cos(this.cur.yaw),r=Math.sin(this.cur.yaw);this.goal.x-=(e*i+t*r)*n,this.goal.z-=(-e*r+t*i)*n,this.clampGoal()}clampGoal(){let e=this.size/2+4;this.goal.x=ve(this.goal.x,-e,e),this.goal.z=ve(this.goal.z,-e,e)}groundAt(e,t){let n=this.dom.getBoundingClientRect(),i=new Ge((e-n.left)/n.width*2-1,-((t-n.top)/n.height)*2+1);this._ray.setFromCamera(i,this.camera);let r=new k;return this._ray.ray.intersectPlane(this._plane,r)?r:null}focus(e,t,n){this.goal.x=e,this.goal.z=t,n&&(this.goal.dist=n),this.clampGoal()}update(e){let t=this.keys,n=this.goal.dist*1.1*e,i=0,r=0;if((t.has("KeyW")||t.has("ArrowUp"))&&(r-=1),(t.has("KeyS")||t.has("ArrowDown"))&&(r+=1),(t.has("KeyA")||t.has("ArrowLeft"))&&(i-=1),(t.has("KeyD")||t.has("ArrowRight"))&&(i+=1),i||r){let c=Math.cos(this.cur.yaw),h=Math.sin(this.cur.yaw);this.goal.x+=(i*c+r*h)*n,this.goal.z+=(-i*h+r*c)*n,this.clampGoal()}t.has("KeyQ")&&(this.goal.yaw+=e*1.6),t.has("KeyE")&&(this.goal.yaw-=e*1.6),t.has("PageUp")&&(this.goal.pitch=ve(this.goal.pitch+e,.42,1.38)),t.has("PageDown")&&(this.goal.pitch=ve(this.goal.pitch-e,.42,1.38)),(t.has("Equal")||t.has("NumpadAdd"))&&(this.goal.dist=ve(this.goal.dist*(1-e*1.5),this.minDist,this.maxDist)),(t.has("Minus")||t.has("NumpadSubtract"))&&(this.goal.dist=ve(this.goal.dist*(1+e*1.5),this.minDist,this.maxDist)),this.autoRotate&&(this.goal.yaw+=e*this.autoRotate);let a=1-Math.exp(-e*9);for(let c of["x","z","dist","yaw","pitch"])this.cur[c]+=(this.goal[c]-this.cur[c])*a;let o=this.cur;this.target.set(o.x,0,o.z);let l=Math.cos(o.pitch);this.camera.position.set(o.x+Math.sin(o.yaw)*l*o.dist,Math.sin(o.pitch)*o.dist,o.z+Math.cos(o.yaw)*l*o.dist),this.camera.lookAt(this.target)}};var Ft=s=>new ie(s),bn={grass:[Ft(10209415),Ft(9683583),Ft(10734988),Ft(9420155)],fertile:Ft(9416298),ore:Ft(10918533),sand:Ft(15326379),rockLow:Ft(10260868),rockHigh:Ft(12893360),snow:Ft(15987180),bed:Ft(7310464),bedDeep:Ft(5600882),rubble:Ft(8221803)},ga=class{constructor(e){this.e=e,this.g=e.game,this.group=new Tt,e.scene.add(this.group),this.build(),this.buildTrees()}tileColor(e,t){let n=this.g.world,i=n.terrain[e],r=e%this.g.W,a=e/this.g.W|0;if(this.g.rubble[e])return t.copy(bn.rubble);if(i===le.SAND)return t.copy(bn.sand).offsetHSL(0,0,(dt(r,a,3)-.5)*.03);if(i===le.WATER)return t.copy(bn.bed);let o=bn.grass[Math.floor(dt(r,a,1)*4)%4];return t.copy(o),n.resource[e]===Kt.FERTILE?t.lerp(bn.fertile,.55):n.resource[e]===Kt.ORE&&t.lerp(bn.ore,.45),t.offsetHSL(0,0,(dt(r,a,2)-.5)*.025)}build(){let e=this.g,t=e.world,n=e.W,i=e.H,r=n+1,a=new Float32Array(n*i*18),o=new Float32Array(n*i*18),l=-n/2,c=-i/2,h=new ie,u=new ie,d=0;for(let f=0;f<i;f++)for(let y=0;y<n;y++){let v=f*n+y,M=t.vh[f*r+y],T=t.vh[f*r+y+1],E=t.vh[(f+1)*r+y],b=t.vh[(f+1)*r+y+1],L=[[[y,M,f],[y,E,f+1],[y+1,b,f+1]],[[y,M,f],[y+1,b,f+1],[y+1,T,f]]];this.tileColor(v,h);for(let _ of L){let w=(_[0][1]+_[1][1]+_[2][1])/3,U=h;t.terrain[v]===le.ROCK?(u.copy(bn.rockLow).lerp(bn.rockHigh,Math.min(1,w/4)),w>4.3&&u.lerp(bn.snow,Math.min(1,(w-4.3)/1.2)),u.offsetHSL(0,0,(dt(y*2+(_===L[0]?0:1),f,9)-.5)*.06),U=u):t.terrain[v]===le.WATER&&(u.copy(bn.bed).lerp(bn.bedDeep,Math.min(1,-w/1.1)),U=u);for(let H of _)a[d]=H[0]+l,a[d+1]=H[1],a[d+2]=H[2]+c,o[d]=U.r,o[d+1]=U.g,o[d+2]=U.b,d+=3}}let p=new Qe;p.setAttribute("position",new pt(a,3)),p.setAttribute("color",new pt(o,3)),p.computeVertexNormals(),this.colAttr=p.attributes.color;let g=new Ze({vertexColors:!0,roughness:.95,metalness:0,flatShading:!0});this.mesh=new Re(p,g),this.mesh.receiveShadow=!0,this.mesh.castShadow=!0,this.group.add(this.mesh);let x=new Tn(n,i,Math.min(128,n),Math.min(128,i)),m=new Re(x,uu());m.rotation.x=-Math.PI/2,m.position.y=-.14,m.receiveShadow=!0,m.renderOrder=1,this.group.add(m),this.water=m,this.buildSlab()}buildSlab(){let e=this.g,t=e.world,n=e.W,i=e.H,r=n+1,a=-n/2,o=-i/2,l=-3.2,c=[],h=[],u=[],d=[[0,Ft(7178834)],[-.25,Ft(8019779)],[-1.2,Ft(9203021)],[-2.2,Ft(7032888)],[l,Ft(5192490)]],p=y=>{for(let v=0;v<d.length-1;v++)if(y>=d[v+1][0]){let M=(d[v][0]-y)/(d[v][0]-d[v+1][0]);return d[v][1].clone().lerp(d[v+1][1],Math.max(0,Math.min(1,M)))}return d[d.length-1][1].clone()},g=(y,v,M,T,E,b,L)=>{let _=[[y,M,v],[T,b,E],[T,l,E],[y,l,v]],w=L?[0,3,2,0,2,1]:[0,1,2,0,2,3];for(let H of w){let K=_[H];c.push(K[0],K[1],K[2]);let I=p(K[1]>-.01?0:K[1]);h.push(I.r,I.g,I.b)}let U=-.14;if(M<U||b<U){let H=[[y,U,v],[T,U,E],[T,Math.min(b,U),E],[y,Math.min(M,U),v]];for(let K of w)u.push(H[K][0],H[K][1],H[K][2])}};for(let y=0;y<n;y++)g(y+a,o,t.vh[y],y+1+a,o,t.vh[y+1],!1),g(y+a,i+o,t.vh[i*r+y],y+1+a,i+o,t.vh[i*r+y+1],!0);for(let y=0;y<i;y++)g(a,y+o,t.vh[y*r],a,y+1+o,t.vh[(y+1)*r],!0),g(n+a,y+o,t.vh[y*r+n],n+a,y+1+o,t.vh[(y+1)*r+n],!1);let x=new Qe;x.setAttribute("position",new Se(c,3)),x.setAttribute("color",new Se(h,3)),x.computeVertexNormals();let m=new Re(x,new Ze({vertexColors:!0,roughness:1,flatShading:!0,side:Ct}));m.receiveShadow=!0,this.group.add(m);let f=new Re(new Tn(n,i),new Ze({color:4075298,roughness:1}));if(f.rotation.x=Math.PI/2,f.position.y=l,this.group.add(f),u.length){let y=new Qe;y.setAttribute("position",new Se(u,3)),y.computeVertexNormals();let v=new Re(y,new Ze({color:4169656,transparent:!0,opacity:.6,roughness:.1,side:Ct,depthWrite:!1}));this.group.add(v)}}refreshColors(){let e=this.g,t=e.W,n=e.H,i=this.colAttr.array,r=new ie;for(let a=0;a<n;a++)for(let o=0;o<t;o++){let l=a*t+o,c=e.world.terrain[l];if(c===le.ROCK||c===le.WATER)continue;this.tileColor(l,r);let h=l*18;for(let u=0;u<6;u++)i[h+u*3]=r.r,i[h+u*3+1]=r.g,i[h+u*3+2]=r.b}this.colAttr.needsUpdate=!0}buildTrees(){let e=this.g.N*4+4e3;this.treeMax=e;let t=new It(.025,.04,.22,5);t.translate(0,.11,0);let n=new hs(.17,0);n.translate(0,.33,0);let i=new Ei(.15,.48,6);i.translate(0,.42,0);let r=new Ze({roughness:.9,flatShading:!0});this.trunks=new At(t,new Ze({color:8018494,roughness:1}),e),this.leaves=new At(n,r,e),this.pines=new At(i,r.clone(),e);for(let a of[this.trunks,this.leaves,this.pines])a.castShadow=!0,a.receiveShadow=!0,a.frustumCulled=!1,a.count=0,this.group.add(a);this.leaves.setColorAt(0,new ie(1,1,1)),this.pines.setColorAt(0,new ie(1,1,1)),this.refreshTrees()}refreshTrees(){let e=this.g,t=e.W,n=e.H,i=new je,r=new Bt,a=new k,o=new k,l=new k(0,1,0),c=new ie,h=[6003279,5214026,6990170,4489027,7908700],u=[4160074,3501635,4884048],d=0,p=0,g=0,x=(y,v,M,T,E)=>{d>=this.treeMax||(r.setFromAxisAngle(l,E*6.28),a.set(M,M*(.9+E*7%1*.3),M),o.set(y,0,v),i.compose(o,r,a),this.trunks.setMatrixAt(d++,i),T?(this.pines.setMatrixAt(g,i),c.setHex(u[Math.floor(E*97)%3]),this.pines.setColorAt(g++,c)):(this.leaves.setMatrixAt(p,i),c.setHex(h[Math.floor(E*89)%5]),this.leaves.setColorAt(p++,c)))},m=-t/2,f=-n/2;for(let y=0;y<n;y++)for(let v=0;v<t;v++){let M=y*t+v,T=e.world.trees[M];if(T&&!e.bld[M]&&!e.road[M]){let E=T+1;for(let b=0;b<E;b++){let L=dt(v,y,31+b),_=dt(v,y,71+b),w=dt(v>>2,y>>2,5)>.55?dt(v,y,11+b)>.25:dt(v,y,11+b)>.85;x(v+m+.18+L*.64,y+f+.18+_*.64,.8+dt(v,y,51+b)*.6,w,dt(v,y,91+b))}}if(e.road[M]===Je.AVENUE){let E=v>0&&e.road[M-1]||v<t-1&&e.road[M+1],b=y>0&&e.road[M-t]||y<n-1&&e.road[M+t];E&&!b?x(v+m+.5,y+f+.5,.55,!1,dt(v,y,3)):b&&!E&&x(v+m+.5,y+f+.5,.55,!1,dt(v,y,4))}}this.trunks.count=d,this.leaves.count=p,this.pines.count=g;for(let y of[this.trunks,this.leaves,this.pines])y.instanceMatrix.needsUpdate=!0,y.instanceColor&&(y.instanceColor.needsUpdate=!0)}};var Ke=128;function Yg(){let s=document.createElement("canvas");s.width=Ke*16,s.height=Ke*4;let e=s.getContext("2d"),t={1:{w:.42,asphalt:"#6b6f76",walk:"#d8d2c4",line:null,curb:"#bdb6a8"},2:{w:.58,asphalt:"#565c66",walk:"#d6d0c3",line:"#f4f1e8",curb:"#b6ae9f"},3:{w:.82,asphalt:"#50555e",walk:"#d2cdbf",line:"#f4f1e8",median:"#7fae62",curb:"#b2aa9a"},4:{w:.9,asphalt:"#4b5059",walk:"#9fa39a",line:"#f4f1e8",edge:"#f2c94c",curb:"#8d9189"}};for(let n=1;n<=4;n++){let i=t[n];for(let r=0;r<16;r++){let a=r*Ke,o=(n-1)*Ke;e.save(),e.translate(a,o),e.beginPath(),e.rect(0,0,Ke,Ke),e.clip(),e.fillStyle=i.walk,e.fillRect(0,0,Ke,Ke),e.strokeStyle="rgba(0,0,0,0.05)",e.lineWidth=1;for(let x=8;x<Ke;x+=16)e.beginPath(),e.moveTo(x,0),e.lineTo(x,Ke),e.stroke(),e.beginPath(),e.moveTo(0,x),e.lineTo(Ke,x),e.stroke();let l=i.w*Ke,c=(Ke-l)/2,h=c+l,u=[r&1,r&2,r&4,r&8],d=u.filter(Boolean).length,p=(x,m)=>{e.fillStyle=x;let f=c+m,y=h-m;e.fillRect(f,f,y-f,y-f),u[0]&&e.fillRect(f,0,y-f,f+1),u[1]&&e.fillRect(y-1,f,Ke-y+1,y-f),u[2]&&e.fillRect(f,y-1,y-f,Ke-y+1),u[3]&&e.fillRect(0,f,f+1,y-f),d===0&&(e.beginPath(),e.arc(Ke/2,Ke/2,l*.62-m,0,Math.PI*2),e.fill()),d===1&&(e.beginPath(),e.arc(Ke/2,Ke/2,l*.6-m,0,Math.PI*2),e.fill())};p(i.curb,-3),p(i.asphalt,0);for(let x=0;x<90;x++){let m=dt(x,r,n)*Ke|0,f=dt(r,x,n+9)*Ke|0;e.fillStyle=`rgba(255,255,255,${.02+dt(x,x,r)*.03})`,e.fillRect(m,f,2,2)}let g=Ke/2;if(n===3){e.fillStyle=i.median;let x=Ke*.1;u[0]&&e.fillRect(g-x/2,0,x,d>2?c-6:g),u[2]&&e.fillRect(g-x/2,d>2?h+6:g,x,Ke),u[1]&&e.fillRect(d>2?h+6:g,g-x/2,Ke,x),u[3]&&e.fillRect(0,g-x/2,d>2?c-6:g,x),d===2&&(u[0]&&u[2]||u[1]&&u[3])||d===2&&(e.beginPath(),e.arc(g,g,x/2,0,Math.PI*2),e.fill())}if(i.line&&n!==3){e.strokeStyle=i.line,e.lineWidth=n===4?2.5:2,e.setLineDash([9,9]),e.lineDashOffset=0;let x=u[0]&&u[2]&&!u[1]&&!u[3],m=u[1]&&u[3]&&!u[0]&&!u[2];if(e.beginPath(),x)e.moveTo(g,0),e.lineTo(g,Ke);else if(m)e.moveTo(0,g),e.lineTo(Ke,g);else if(d===2){let f=[];u[0]&&f.push([g,0]),u[1]&&f.push([Ke,g]),u[2]&&f.push([g,Ke]),u[3]&&f.push([0,g]),e.moveTo(f[0][0],f[0][1]),e.quadraticCurveTo(g,g,f[1][0],f[1][1])}else u[0]&&(e.moveTo(g,0),e.lineTo(g,c-4)),u[2]&&(e.moveTo(g,h+4),e.lineTo(g,Ke)),u[1]&&(e.moveTo(h+4,g),e.lineTo(Ke,g)),u[3]&&(e.moveTo(0,g),e.lineTo(c-4,g));e.stroke(),e.setLineDash([])}if(n===4&&(e.strokeStyle=i.edge,e.lineWidth=2,(u[1]||u[3])&&(e.beginPath(),e.moveTo(0,c+5),e.lineTo(Ke,c+5),e.moveTo(0,h-5),e.lineTo(Ke,h-5),e.stroke()),(u[0]||u[2])&&(e.beginPath(),e.moveTo(c+5,0),e.lineTo(c+5,Ke),e.moveTo(h-5,0),e.lineTo(h-5,Ke),e.stroke())),d>=3&&(n===2||n===3)){e.fillStyle="rgba(245,242,233,0.9)";let x=4,m=9,f=(y,v)=>{for(let M=c+4;M<h-4;M+=x*2)y?e.fillRect(M,v,x,m):e.fillRect(v,M,m,x)};u[0]&&f(!0,c-m-2),u[2]&&f(!0,h+2),u[3]&&f(!1,c-m-2),u[1]&&f(!1,h+2)}e.restore()}}return s}var xa=class{constructor(e){this.e=e,this.g=e.game;let t=new Gn(Yg());t.colorSpace=ut,t.anisotropy=e.renderer.capabilities.getMaxAnisotropy(),t.generateMipmaps=!0,t.minFilter=Si,this.tex=t,this.mat=new Ze({map:t,roughness:.92,metalness:0,vertexColors:!0,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),this.mesh=null,this.group=new Tt,e.scene.add(this.group);let n=new at(1,1,1);n.translate(0,.5,0),this.bridge=new At(n,new Ze({color:12169893,roughness:.85}),6e3),this.bridge.castShadow=this.bridge.receiveShadow=!0,this.bridge.frustumCulled=!1,this.group.add(this.bridge);let i=new It(.012,.016,.42,4);i.translate(0,.21,0),this.poles=new At(i,new Ze({color:4869975,roughness:.6}),12e3),this.poles.frustumCulled=!1,this.group.add(this.poles),this.lampMat=new Ze({color:16773580,emissive:16765578,emissiveIntensity:0});let r=new at(.06,.025,.04);r.translate(0,.43,0),this.heads=new At(r,this.lampMat,12e3),this.heads.frustumCulled=!1,this.group.add(this.heads),this.lampPositions=[],this.rebuild()}rebuild(){let e=this.g,t=e.W,n=e.H,i=-t/2,r=-n/2,a=[],o=[],l=[],c=[],h=new je,u=new Bt,d=new k,p=new k,g=0,x=0;this.lampPositions=[],this.tileVert=new Int32Array(e.N).fill(-1);let m=(M,T,E,b,L,_,w,U)=>{let H=a.length/3;U>=0&&(this.tileVert[U]=H),a.push(M,L,T,E,L,T,E,L,b,M,L,b);let K=1.5/(Ke*16),I=1.5/(Ke*4),C=w/16+K,P=(w+1)/16-K,N=1-(_-1)/4-I,F=1-_/4+I;o.push(C,N,P,N,P,F,C,F);for(let z=0;z<4;z++)l.push(1,1,1);c.push(H,H+2,H+1,H,H+3,H+2)},f=(M,T,E,b,L,_)=>{g>=6e3||(p.set(M,T,E),d.set(b,L,_),u.identity(),h.compose(p,u,d),this.bridge.setMatrixAt(g++,h))};for(let M=0;M<n;M++)for(let T=0;T<t;T++){let E=M*t+T,b=e.road[E];if(!b)continue;let L=ql(e,E),_=e.world.terrain[E]===le.WATER,w=_?.24:.012;if(m(T+i,M+r,T+1+i,M+1+r,w,b,L,E),_&&(f(T+i+.5,.1,M+r+.5,1,.13,1),(T+M)%2===0&&f(T+i+.5,-1.2,M+r+.5,.16,1.32,.16)),(b===Je.STREET||b===Je.AVENUE||b===Je.HIGHWAY)&&x<12e3&&dt(T,M,77)<.7){let U=dt(T,M,78)<.5?1:-1,H=L&2||L&8,K=b===Je.HIGHWAY?.48:b===Je.AVENUE?.46:.36,I=T+i+.5+(H?0:U*K),C=M+r+.5+(H?U*K:0);p.set(I,w,C),d.set(1,1,1),u.identity(),h.compose(p,u,d),this.poles.setMatrixAt(x,h),this.heads.setMatrixAt(x,h),x++,this.lampPositions.push(I,w+.44,C)}}let y=e.world.highwayY;for(let M=1;M<=10;M++){let T=-M;m(T+i,y+r,T+1+i,y+1+r,.012,Je.HIGHWAY,10,-1),f(T+i+.5,-.12,y+r+.5,1,.13,1.02),M%2===0&&f(T+i+.5,-4,y+r+.5,.22,3.9,.22)}this.bridge.count=g,this.poles.count=this.heads.count=x,this.bridge.instanceMatrix.needsUpdate=!0,this.poles.instanceMatrix.needsUpdate=!0,this.heads.instanceMatrix.needsUpdate=!0;let v=new Qe;v.setAttribute("position",new Se(a,3)),v.setAttribute("uv",new Se(o,2)),v.setAttribute("color",new Se(l,3)),v.setIndex(c),v.computeVertexNormals(),this.mesh&&(this.group.remove(this.mesh),this.mesh.geometry.dispose()),this.mesh=new Re(v,this.mat),this.mesh.receiveShadow=!0,this.group.add(this.mesh)}setTrafficTint(e){let t=this.g,n=this.mesh.geometry.attributes.color,i=new ie,r=new ie(4572267),a=new ie(15909424),o=new ie(15026236);for(let l=0;l<t.N;l++){let c=this.tileVert[l];if(!(c<0)){if(!e)i.setRGB(1,1,1);else{let h=t.congestion[l];h<.6?i.copy(r).lerp(a,h/.6):i.copy(a).lerp(o,Math.min(1,(h-.6)/.6)),i.lerp(new ie(1,1,1),.15)}for(let h=0;h<4;h++)n.setXYZ(c+h,i.r,i.g,i.b)}}n.needsUpdate=!0}setNight(e){this.lampMat.emissiveIntensity=e*2.2}};function Zg(){let s=new Qe,e=[-.5,0,.5,.5,0,.5,0,1,.5,.5,0,-.5,-.5,0,-.5,0,1,-.5,-.5,0,-.5,-.5,0,.5,0,1,.5,-.5,0,-.5,0,1,.5,0,1,-.5,.5,0,.5,.5,0,-.5,0,1,-.5,.5,0,.5,0,1,-.5,0,1,.5,-.5,0,-.5,.5,0,-.5,.5,0,.5,-.5,0,-.5,.5,0,.5,-.5,0,.5];return s.setAttribute("position",new Se(e,3)),s.computeVertexNormals(),s}var fu={box:()=>{let s=new at(1,1,1);return s.translate(0,.5,0),s},gable:Zg,pyramid:()=>{let s=new Ei(.7071,1,4,1);return s.rotateY(Math.PI/4),s.translate(0,.5,0),s},cyl:()=>{let s=new It(.5,.5,1,14);return s.translate(0,.5,0),s},cone:()=>{let s=new It(.33,.5,1,16,1,!0);return s.translate(0,.5,0),s},sphere:()=>{let s=new hs(.5,1);return s.translate(0,.5,0),s},hemi:()=>new us(.5,16,8,0,Math.PI*2,0,Math.PI/2),glow:()=>{let s=new at(1,1,1);return s.translate(0,.5,0),s}},Kg={box:6e4,gable:14e3,pyramid:4e3,cyl:9e3,cone:600,sphere:12e3,hemi:800,glow:3e3},Rl=class{constructor(e,t){this.kind=e;let n=fu[e](),i=Kg[e];this.max=i;let r=new Float32Array(i);n.setAttribute("aWin",new ls(r,1)),this.win=n.attributes.aWin;let a;e==="box"?a=hu():e==="glow"?a=new Xt({color:16777215,toneMapped:!1}):e==="cone"?a=new Ze({roughness:.85,side:Ct}):a=new Ze({roughness:.8,metalness:.02,flatShading:e==="gable"||e==="pyramid"||e==="sphere"}),this.mesh=new At(n,a,i),this.mesh.castShadow=e!=="glow",this.mesh.receiveShadow=!0,this.mesh.frustumCulled=!1,this.mesh.count=0,this.mesh.setColorAt(0,new ie(1,1,1)),t.add(this.mesh),this.free=[],this.top=0,this.dirty=!1,this._zero=new je().makeScale(0,0,0)}alloc(){if(this.free.length)return this.free.pop();if(this.top>=this.max)return-1;let e=this.top++;return this.mesh.count=this.top,e}release(e){this.mesh.setMatrixAt(e,this._zero),this.free.push(e),this.dirty=!0}set(e,t,n,i){this.mesh.setMatrixAt(e,t),this.mesh.setColorAt(e,n),this.win.array[e]=i,this.dirty=!0}setColor(e,t){this.mesh.setColorAt(e,t),this.dirty=!0}setWin(e,t){this.win.array[e]=t,this.dirty=!0}flush(){this.dirty&&(this.mesh.instanceMatrix.needsUpdate=!0,this.mesh.instanceColor&&(this.mesh.instanceColor.needsUpdate=!0),this.win.needsUpdate=!0,this.dirty=!1)}},yt={resWall:[15984335,15324084,14214378,15194342,15849926,14674130,16051416,14930623],resRoof:[13132875,11882557,5989493,9067076,5209988,10178367],resBlock:[15326411,14271661,13621469,14864321,14012611,13220005],tower:[14209995,13029334,14998480,12568521],com:[16111470,15896427,8177366,15906244,10999179,16171659,10467056],comBlock:[15131096,14147043,15721426,14472938],awning:[15225919,3117024,2271334,15904798,9394904,15757230],ind:[12107449,10990525,13222578,10397600,11774106],indRoof:[7306374,8616299,6122338,8095116],off:[10466504,12043987,9349053,11123137,12832214,9675702],offTrim:[5201260,6187896,7108740]},_t=(s,e)=>e[Math.floor(s()*e.length)%e.length];function Jg(s){let e=[],t=Cn(s.variant+s.level*977+(s.spec?31:0)),n=(r,a,o,l,c,h,u,d,p=0,g=0,x)=>{e.push({k:r,x:a,y:o,z:l,sx:c,sy:h,sz:u,c:d,w:p,ry:g,...x})},i=s.level;if(s.zone===Ae.RES)if(i===1){let r=_t(t,yt.resWall),a=_t(t,yt.resRoof);if(t()<.35)for(let o of[-.22,.22])n("box",o,0,.02,.34,.32,.36,t()<.5?r:_t(t,yt.resWall),1),n("gable",o,.32,.02,.38,.2,.4,a,0,0);else{let o=.46+t()*.12,l=.4+t()*.1,c=.34+t()*.08;n("box",0,0,0,o,c,l,r,1),n("gable",0,c,0,o+.06,.24,l+.06,a,0,Math.PI/2),n("box",o*.25,c+.05,-.05,.06,.2,.06,9138012),t()<.6&&n("sphere",-.32,0,-.32,.22,.3,.22,6266706),n("box",0,0,.36,.1,.012,.28,14275009)}}else if(i===2){let r=_t(t,yt.resWall),a=_t(t,yt.resRoof),o=.62+t()*.12,l=.52+t()*.08,c=.62+t()*.1;n("box",0,0,-.02,o,c,l,r,1),n("gable",0,c,-.02,o+.06,.28,l+.06,a,0,Math.PI/2),t()<.5&&n("box",-o/2+.08,0,l/2+.02,.18,.28,.14,r,1),t()<.5&&n("sphere",.36,0,.34,.18,.26,.18,6266706)}else if(i===3){let r=_t(t,yt.resBlock),a=.95+t()*.25;n("box",0,0,0,.84,a,.72,r,1),n("box",0,a,0,.88,.04,.76,9407107),t()<.6?n("gable",0,a,0,.86,.22,.74,_t(t,yt.resRoof),0,Math.PI/2):n("box",.2,a,-.1,.2,.14,.2,12104102);for(let o=0;o<3;o++)n("box",-.28+o*.28,.3,.37,.18,.03,.06,16184042)}else if(i===4){let r=_t(t,yt.resBlock),a=1.8+t()*.5;n("box",0,0,0,.86,a,.84,r,1),n("box",0,a,0,.6,.22,.56,r,1),n("box",0,a+.22,0,.64,.03,.6,9407107),n("cyl",-.24,a,.22,.14,.2,.14,10134440);for(let o=0;o<4;o++)n("box",0,.35+o*.42,.43,.7,.03,.06,15855078)}else{let r=_t(t,yt.tower),a=3.4+t()*1.6;n("box",0,0,0,.94,.42,.94,_t(t,yt.resBlock),3),n("box",0,.42,0,.62,a,.62,r,1),n("box",0,.42+a,0,.5,.18,.5,r,1),t()<.5?n("box",0,.6+a,0,.04,.5,.04,10134440):n("pyramid",0,.6+a,0,.5,.35,.5,_t(t,yt.resRoof))}else if(s.zone===Ae.COM){let r=_t(t,yt.com),a=_t(t,yt.awning);if(i===1)n("box",0,0,-.02,.66,.4,.58,r,3),n("box",0,.3,.32,.68,.035,.14,a,0,0,{tilt:.25}),n("box",0,.4,-.02,.7,.04,.62,15328474),n("glow",0,.44,.12,.34,.1,.03,a);else if(i===2)n("box",0,0,-.02,.86,.72,.76,r,3),n("box",0,.3,.41,.86,.035,.14,a,0,0,{tilt:.25}),n("box",0,.72,-.02,.9,.04,.8,15328474),n("glow",.2,.76,.2,.36,.12,.03,_t(t,yt.awning));else if(i===3)n("box",0,0,0,.9,1.2,.9,_t(t,yt.comBlock),3),n("box",0,.36,.46,.9,.04,.12,a),n("glow",0,.95,.46,.6,.14,.02,a),n("box",.2,1.2,-.2,.3,.16,.3,12170154);else if(i===4){let o=1.9+t()*.4;n("box",0,0,0,.94,o,.94,_t(t,yt.comBlock),3),n("box",0,.4,.48,.94,.04,.12,a),n("glow",0,o+.05,.1,.7,.32,.04,a),n("box",0,o,.1,.06,.08,.06,1365)}else{let o=3.3+t()*1.4;n("box",0,0,0,.96,.6,.96,_t(t,yt.comBlock),3),n("box",0,.6,0,.7,o,.7,_t(t,yt.off),2),n("glow",0,.6+o-.3,.355,.5,.18,.02,a),n("box",0,.6+o,0,.56,.12,.56,8292240)}}else if(s.zone===Ae.IND)if(s.spec==="farm"){n("box",0,0,0,.94,.015,.94,10124117);let r=t()<.5?14205530:8368463;for(let a=0;a<4;a++)n("box",-.33+a*.17,.015,.1,.1,.04+i*.01,.62,r);n("box",.3,0,-.3,.3,.22,.26,11880250,0),n("gable",.3,.22,-.3,.32,.14,.28,7031354,0,Math.PI/2),i>=2&&n("cyl",.38,0,0,.14,.42+i*.06,.14,14013128),i>=3&&n("cyl",.2,0,0,.12,.38,.12,13223352)}else if(s.spec==="mine"){n("box",0,0,0,.94,.015,.94,9142647),n("pyramid",-.2,0,.18,.42,.24+i*.04,.42,5919822);let r=.22,a=.7+i*.12;for(let[o,l]of[[-.08,-.08],[.08,-.08],[-.08,.08],[.08,.08]])n("box",r+o,0,-.18+l,.03,a,.03,7162682);n("box",r,a,-.18,.24,.04,.24,7162682),n("cyl",r,a+.04,-.18,.18,.04,.18,4146250),n("box",.25,0,.25,.32,.22,.26,_t(t,yt.ind),4)}else{let r=_t(t,yt.ind),a=_t(t,yt.indRoof);if(i===1)n("box",0,0,0,.74,.38,.6,r,4),n("gable",0,.38,0,.78,.14,.64,a,0,Math.PI/2),n("cyl",.26,.2,-.18,.08,.55,.08,9268059,0,0,{smoke:1});else if(i===2){n("box",0,0,0,.88,.46,.8,r,4);for(let o=0;o<3;o++)n("gable",-.29+o*.29,.46,0,.3,.16,.8,a,0,0);n("cyl",-.3,.2,-.3,.1,.8,.1,9268059,0,0,{smoke:1})}else if(i===3)n("box",-.1,0,0,.66,.55,.84,r,4),n("box",-.1,.55,0,.7,.04,.88,a),n("cyl",.34,0,-.22,.2,.62,.2,14013128),n("cyl",.34,0,.12,.2,.62,.2,13354939),n("cyl",-.3,.5,-.3,.1,.9,.1,10312523,0,0,{smoke:1});else if(i===4)n("box",0,0,.05,.92,.7,.8,r,4),n("box",0,.7,.05,.94,.04,.84,a),n("cyl",-.3,.7,-.3,.12,1.2,.12,11752005,0,0,{smoke:1}),n("cyl",0,.7,-.3,.12,1,.12,15262940,0,0,{smoke:1}),n("sphere",.3,.7,-.25,.3,.3,.3,14473420);else{n("box",0,0,0,.92,.82,.9,15527921,2),n("box",0,.82,0,.94,.03,.92,9345700);for(let o=0;o<3;o++)n("box",-.25+o*.25,.86,0,.2,.02,.7,2703454,0,0,{tilt:.3});n("glow",0,.6,.455,.6,.04,.01,8378111)}}else if(s.zone===Ae.OFF){let r=_t(t,yt.off),a=_t(t,yt.offTrim),l=[0,.9,1.6,2.6,3.7,5.4][i]*(.9+t()*.25),c=i>=4?.72:.78;n("box",0,0,0,c,l,c,r,2),n("box",0,l,0,c+.03,.05,c+.03,a),i>=3&&n("box",0,l*.55,0,c+.04,.04,c+.04,a),i>=4&&n("box",0,l+.05,0,c*.7,l*.12,c*.7,r,2),i===5&&(n("cyl",0,l*1.17,0,.05,.9,.05,13620956),n("glow",0,l*1.17+.9,0,.05,.05,.05,16734794)),i<=2&&n("box",0,0,.42,.3,.2,.06,a)}else jg(s,n,t);return e}function jg(s,e,t){let n=s.key,[i,r]=nt[n]?nt[n].size:[s.w,s.h],a=o=>e("box",0,0,0,i-.06,.02,r-.06,o);switch(n){case"coal":a(9274488),e("box",-.35,0,.3,1.1,.7,.9,10194820,4),e("box",-.35,.7,.3,1.14,.05,.94,6183509),e("cone",.5,0,-.45,.9,1.25,.9,14275786,0,0,{steam:1}),e("cyl",-.7,0,-.5,.16,2.3,.16,12077628,0,0,{smoke:2}),e("cyl",-.7,1.3,-.5,.165,.25,.165,15789284),e("pyramid",.55,0,.55,.5,.25,.5,3091498);break;case"wind":e("cyl",0,0,0,.07,2.1,.07,15922163),e("box",0,2.08,-.06,.1,.1,.22,15198698),e("box",0,0,0,.3,.02,.3,11052187);break;case"solar":a(10465420);for(let o=0;o<4;o++)for(let l=0;l<3;l++)e("box",-.7+o*.47,.08,-.55+l*.55,.4,.03,.4,2771572,0,0,{tilt:-.45});break;case"gas":a(9276034),e("box",-.3,0,.3,1,.65,.8,12764872,4),e("sphere",.5,0,-.45,.65,.65,.65,15197144),e("cyl",-.6,.6,-.5,.12,1.3,.12,14012614,0,0,{smoke:1});break;case"fusion":a(13225940),e("hemi",0,0,0,2,1.6,2,15922422),e("cyl",0,0,0,2.5,.12,2.5,9412781),e("glow",0,.12,0,2.3,.05,2.3,6546431),e("box",1.1,0,1.1,.5,.5,.5,14673386,2);break;case"watertower":e("cyl",0,0,0,.12,.9,.12,12038308),e("sphere",0,.75,0,.55,.45,.55,9356767),e("box",0,0,0,.4,.02,.4,11052187);break;case"pump":e("box",0,0,0,.6,.4,.55,13096669,4),e("gable",0,.4,0,.64,.14,.59,5210010,0,Math.PI/2),e("cyl",.3,.1,.3,.08,.08,.5,6258575);break;case"waterworks":a(12040625),e("cyl",-.45,0,-.45,.8,.12,.8,10134955),e("cyl",-.45,.1,-.45,.7,.03,.7,4891591),e("cyl",.45,0,-.45,.8,.12,.8,10134955),e("cyl",.45,.1,-.45,.7,.03,.7,4891591),e("box",0,0,.5,1.6,.5,.7,14081762,4);break;case"landfill":a(8284754),e("pyramid",-.4,0,-.3,.8,.35,.8,9076066),e("pyramid",.35,0,-.35,.6,.25,.6,7306074),e("pyramid",.1,0,.35,.7,.3,.6,10127980),e("box",.6,0,.6,.35,.25,.3,10200218,4);break;case"incinerator":a(9276034),e("box",0,0,.2,1.4,.8,1,12172479,4),e("cyl",-.55,0,-.55,.2,2.2,.2,14209993,0,0,{smoke:2}),e("box",0,.8,.2,1.44,.04,1.04,6975348);break;case"recycling":a(10857884),e("box",-.25,0,-.2,1.1,.55,.9,7319147,4);for(let o=0;o<4;o++)e("box",-.6+o*.4,0,.65,.3,.2,.25,[3117024,15904798,15225919,2271334][o]);break;case"police":e("box",0,0,0,.78,.52,.66,14673388,1),e("box",0,.36,.335,.78,.08,.02,2777008),e("box",0,.52,0,.82,.04,.7,2768742),e("glow",0,.56,.1,.16,.05,.06,3968511),e("cyl",.36,0,.38,.02,.8,.02,13421772);break;case"policehq":a(13225425),e("box",0,0,0,1.6,.8,1.2,14673388,1),e("box",0,.8,-.1,.6,.6,.6,13095130,1),e("box",0,.55,.605,1.6,.1,.02,2777008),e("glow",0,1.42,-.1,.2,.06,.2,3968511);break;case"fire":e("box",0,0,0,.8,.5,.66,13190971,1),e("box",-.18,0,.335,.26,.32,.02,3815994),e("box",.18,0,.335,.26,.32,.02,3815994),e("box",.3,.5,-.2,.18,.42,.18,11942961),e("box",0,.5,0,.84,.04,.7,7219748);break;case"firehq":a(13222843),e("box",0,0,0,1.6,.7,1.2,13190971,1);for(let o=0;o<4;o++)e("box",-.6+o*.4,0,.605,.3,.42,.02,3815994);e("box",.55,.7,-.35,.3,.8,.3,11942961);break;case"clinic":e("box",0,0,0,.78,.55,.66,16185336,1),e("box",0,.55,0,.82,.04,.7,12042953),e("box",0,.6,0,.32,.03,.1,14894138),e("box",0,.6,0,.1,.03,.32,14894138);break;case"hospital":a(12963017),e("box",-.2,0,0,1.2,1.3,1,16054007,2),e("box",.6,0,.3,.6,.6,.9,15331056,1),e("box",-.2,1.3,0,.5,.03,.15,14894138),e("box",-.2,1.3,0,.15,.03,.5,14894138),e("cyl",.6,.6,.3,.45,.03,.45,5989488);break;case"school":e("box",0,0,0,i-.06,.02,r-.06,10272636),e("box",-.45,0,-.05,.9,.5,.7,15783306,1),e("gable",-.45,.5,-.05,.94,.2,.74,11882557,0,Math.PI/2),e("box",.5,.02,0,.8,.01,.7,13069131),e("box",.5,.03,0,.02,.01,.7,16777215);break;case"university":e("box",0,0,0,i-.06,.02,r-.06,9747832),e("box",-.9,0,-.3,1,.75,1,12019535,1),e("box",.9,0,-.3,1,.75,1,12019535,1),e("box",0,0,-.55,.9,1,.7,14273459,1),e("hemi",0,1,-.55,.6,.5,.6,7049098),e("box",0,.02,.55,1.6,.01,.12,15129803);break;case"library":e("box",0,0,0,.8,.5,.66,15261903,1),e("gable",0,.5,0,.84,.16,.7,8227471,0,Math.PI/2);for(let o=0;o<4;o++)e("cyl",-.27+o*.18,0,.36,.05,.45,.05,16118248);break;case"park":Qg(e,t,0,0,1);break;case"citypark":e("box",0,0,0,i-.04,.025,r-.04,8832111),e("cyl",.3,.02,.3,.8,.02,.6,4891591),e("box",0,.03,-.3,1.8,.008,.1,14866111),e("box",-.3,.03,0,.1,.008,1.8,14866111);for(let o=0;o<9;o++)e("sphere",-.8+t()*1.6,.12,-.8+t()*1.6,.26,.36,.26,[6266706,5214026,6990170][o%3]);break;case"plaza":e("box",0,0,0,.96,.02,.96,14735560),e("cyl",0,.02,0,.5,.08,.5,12235427),e("cyl",0,.06,0,.42,.03,.42,5944278),e("cyl",0,.06,0,.06,.25,.06,13682872);for(let[o,l]of[[-.38,-.38],[.38,.38]])e("sphere",o,.02,l,.18,.26,.18,6266706);break;case"sports":e("box",0,0,0,i-.04,.02,r-.04,5810266),e("box",0,.02,0,1.5,.004,.02,16777215),e("cyl",0,.02,0,.35,.004,.35,16777215),e("cyl",0,.022,0,.32,.004,.32,5810266),e("box",0,0,-.85,1.6,.25,.2,13749184);break;case"playground":e("box",0,0,0,.96,.02,.96,15127450),e("box",-.2,0,-.1,.24,.3,.24,15225919),e("box",.2,0,.2,.06,.25,.4,3117024,0,0,{tilt:.5}),e("box",.25,0,-.25,.3,.2,.04,15904798),e("sphere",-.35,.02,.35,.2,.28,.2,6266706);break;case"townhall":a(14209216),e("box",0,0,0,1.5,.8,1.1,15656144,1),e("gable",0,.8,0,1.54,.3,1.14,5989493,0,Math.PI/2),e("box",0,0,-.1,.36,1.6,.36,15261126,1),e("pyramid",0,1.6,-.1,.44,.45,.44,5209988),e("glow",0,1.3,.085,.18,.18,.02,16773312);break;case"ferris":a(14209216),e("box",0,0,0,.5,.2,.3,9394904);break;case"tvtower":e("cyl",0,0,0,.3,.2,.3,13619924),e("cyl",0,0,0,.14,5,.14,15330542),e("sphere",0,4.4,0,.62,.62,.62,12107974),e("glow",0,4.68,0,.64,.06,.64,16765562),e("cyl",0,5,0,.05,.9,.05,15330542),e("glow",0,5.9,0,.07,.07,.07,16728128);break;case"stadium":e("box",0,0,0,2.9,.02,2.9,12170150),e("cyl",0,0,0,2.7,.55,2.3,15131871),e("cyl",0,.02,0,2.1,.56,1.7,10170170),e("cyl",0,.03,0,1.6,.56,1.2,5217869);for(let[o,l]of[[-1.25,-1.25],[1.25,-1.25],[-1.25,1.25],[1.25,1.25]])e("cyl",o,0,l,.05,1.3,.05,11579568),e("glow",o,1.3,l,.2,.08,.1,16774872);break;case"opera":e("box",0,0,0,1.9,.18,1.9,15262422),e("sphere",-.4,.05,.1,.8,1.1,1.2,16316661,0,.4),e("sphere",.15,.05,-.1,.7,.95,1,15987438,0,.6),e("sphere",.55,.05,.25,.5,.7,.7,16316661,0,.8),e("box",0,.18,.75,1.4,.02,.2,5944278);break;case"observatory":e("box",0,0,0,.66,.42,.66,14867923,1),e("cyl",0,.42,0,.62,.08,.62,13354684),e("hemi",0,.5,0,.6,.55,.6,15987957),e("box",0,.62,.12,.08,.04,.3,3883080,0,0,{tilt:-.5});break;case"doener":e("box",0,0,0,.82,.5,.7,2300950,3),e("box",0,.38,.36,.84,.04,.14,16103733,0,0,{tilt:.25}),e("box",0,.5,0,.86,.04,.74,16103733),e("glow",0,.54,.25,.42,.2,.04,16103733),e("box",0,.54,-.15,.04,.06,.04,7829367);break;case"lighthouse":e("cyl",0,0,0,.42,.12,.42,10133668),e("cone",0,.1,0,.32,.5,.32,16053490),e("cyl",0,.6,0,.22,.5,.22,14174782),e("cyl",0,1.1,0,.21,.5,.21,16053490),e("cyl",0,1.6,0,.2,.4,.2,14174782),e("glow",0,2,0,.16,.18,.16,16773560),e("pyramid",0,2.18,0,.26,.18,.26,3357248);break;default:e("box",0,0,0,i*.8,.5,r*.8,13421772,1)}}function Qg(s,e,t,n,i){s("box",t,0,n,.97*i,.025,.97*i,9423732),s("box",t,.025,n,.12*i,.006,.97*i,14866111);let r=3+Math.floor(e()*2);for(let a=0;a<r;a++){let o=t+(e()<.5?-1:1)*(.18+e()*.22)*i,l=n+(-.4+e()*.8)*i;s("cyl",o,0,l,.04,.16,.04,8018494),s("sphere",o,.1,l,.24,.3,.24,[6266706,5214026,6990170,7908700][a%4])}s("box",t+.12*i,.025,n+.2*i,.05,.05,.16,9071439)}var va=class{constructor(e){this.e=e,this.g=e.game,this.pools={};for(let t of Object.keys(fu))this.pools[t]=new Rl(t,e.scene);this.inst=new Map,this.animated=new Map,this.tint=null,this.m4=new je,this.q=new Bt,this.e3=new as,this.v=new k,this.s=new k,this.c=new ie,this.emitters=new Map,this.constructing=new Set;for(let t of this.g.buildings.values())this.add(t)}origin(e){let t=this.g;return[e.x+e.w/2-t.W/2,e.y+e.h/2-t.H/2]}add(e){this.remove(e);let t=Jg(e),n={parts:[],b:e},[i,r]=this.origin(e),a=e.zone?e.rot*(Math.PI/2):0,o=Math.cos(a),l=Math.sin(a),c=[];for(let h of t){let u=this.pools[h.k],d=u.alloc();if(d<0)continue;let p=h.x,g=h.z,x=h.sx,m=h.sz,f=h.ry||0;!e.zone&&e.rot%2===1&&nt[e.key]&&nt[e.key].size[0]!==nt[e.key].size[1]&&([p,g]=[g,-p],f+=Math.PI/2);let y=i+p*o+g*l,v=r-p*l+g*o,M={...h,wx:y,wz:v,ry:f+a,sx:x,sz:m},T=new ie(h.c);n.parts.push({pool:u,idx:d,base:T,part:M}),(h.smoke||h.steam)&&c.push({x:y,y:h.y+h.sy,z:v,type:h.steam?"steam":"smoke",amount:h.smoke||1})}this.inst.set(e.id,n),c.length&&this.emitters.set(e.id,c),this.addAnimated(e),this.update(e)}addAnimated(e){let[t,n]=this.origin(e),i=null;if(e.key==="wind"){i=new Tt;let r=new Ze({color:16185335,roughness:.6});for(let a=0;a<3;a++){let o=new Re(new at(.05,.75,.015),r);o.position.y=.36;let l=new Tt;l.rotation.z=a*Math.PI*2/3,l.add(o),i.add(l)}i.position.set(t,2.13,n+.07),i.userData.spin={axis:"z",speed:2.2}}else if(e.key==="ferris"){i=new Tt;let r=new Ze({color:16118767,roughness:.5}),a=new Re(new aa(.85,.035,6,32),r);i.add(a);let o=[15225919,3117024,15904798,2271334,9394904,15757230];for(let c=0;c<12;c++){let h=c/12*Math.PI*2,u=new Re(new at(.02,.85,.02),r);u.position.set(Math.cos(h)*.42,Math.sin(h)*.42,0),u.rotation.z=h-Math.PI/2,i.add(u);let d=new Re(new at(.13,.12,.12),new Ze({color:o[c%6],emissive:o[c%6],emissiveIntensity:.15}));d.position.set(Math.cos(h)*.85,Math.sin(h)*.85,0),i.add(d)}let l=new Tt;for(let c of[-1,1]){let h=new Re(new at(.05,1.15,.05),r);h.position.set(c*.3,.55,0),h.rotation.z=c*.28,l.add(h)}l.position.set(t,0,n),this.e.scene.add(l),i.userData.extra=l,i.position.set(t,1.1,n),i.userData.spin={axis:"z",speed:.25}}else if(e.key==="doener"){i=new Tt;let r=new Re(new It(.06,.13,.38,10),new Ze({color:11036730,roughness:.9}));r.position.y=.19,i.add(r);let a=new Re(new It(.01,.01,.48,4),new Ze({color:12303291}));a.position.y=.22,i.add(a),i.position.set(t,.56,n-.15),i.userData.spin={axis:"y",speed:1.1}}else if(e.key==="lighthouse"){i=new Tt;let r=new Re(new Ei(.4,3.2,12,1,!0),new Xt({color:16774084,transparent:!0,opacity:.18,depthWrite:!1,side:Ct,blending:ts}));r.rotation.z=Math.PI/2,r.position.x=1.6,i.add(r),i.position.set(t,2.09,n),i.userData.spin={axis:"y",speed:.9},i.userData.nightOnly=r}i&&(i.traverse(r=>{r.isMesh&&(r.castShadow=!0)}),this.e.scene.add(i),this.animated.set(e.id,i))}remove(e){let t=this.inst.get(e.id);if(t){for(let i of t.parts)i.pool.release(i.idx);this.inst.delete(e.id)}this.emitters.delete(e.id),this.constructing.delete(e.id);let n=this.animated.get(e.id);n&&(this.e.scene.remove(n),n.userData.extra&&this.e.scene.remove(n.userData.extra),this.animated.delete(e.id))}update(e){let t=this.inst.get(e.id);if(!t)return;let n=e.construct,i=n<1;i?this.constructing.add(e.id):this.constructing.delete(e.id);let r=i?Math.max(.04,n):1,a=this.tint?this.tint(e):null;for(let o of t.parts){let l=o.part;this.e3.set(l.tilt||0,l.ry,0,"YXZ"),this.q.setFromEuler(this.e3),this.v.set(l.wx,l.y*r,l.wz),this.s.set(l.sx,l.sy*r,l.sz),this.m4.compose(this.v,this.q,this.s);let c=this.c.copy(o.base);a?c.copy(a):e.abandoned?c.lerp(new ie(7235423),.65):e.burning?c.lerp(new ie(2762018),.5):i&&c.lerp(new ie(15985366),.55);let h=e.abandoned||i||a?0:l.w;o.pool.set(o.idx,this.m4,c,h)}}setTint(e){this.tint=e;for(let t of this.inst.values())this.update(t.b)}frame(e,t,n){for(let i of this.constructing){let r=this.g.buildings.get(i);r&&this.update(r)}for(let i of this.animated.values()){let r=i.userData.spin;r&&(i.rotation[r.axis]+=e*r.speed),i.userData.nightOnly&&(i.userData.nightOnly.visible=n>.3)}for(let i of Object.values(this.pools))i.flush()}};function Cl(s){let e=[],t=[];for(let[i,r,a,o,l,c]of s){let h=new at(i,r,a).toNonIndexed();h.translate(o,l,c),e.push(...h.attributes.position.array),t.push(...h.attributes.normal.array)}let n=new Qe;return n.setAttribute("position",new Se(e,3)),n.setAttribute("normal",new Se(t,3)),n}function pu(s){let e=[],t=[],n=new je;for(let[r,a,o,l,c,h,u]of s){let d=new at(r,a,o).toNonIndexed();n.makeRotationY(u).setPosition(l,c,h),d.applyMatrix4(n),e.push(...d.attributes.position.array),t.push(...d.attributes.normal.array),d.dispose()}let i=new Qe;return i.setAttribute("position",new Se(e,3)),i.setAttribute("normal",new Se(t,3)),i}var mu=[15225919,3117024,15921904,3883080,15904798,2271334,10134443,9394904,13222838,2051705,11880250,16777215],ya=class{constructor(e){this.e=e,this.g=e.game;let t=1400;this.max=t;let n=Cl([[.14,.06,.26,0,.05,0],[.12,.05,.13,0,.105,-.015]]),i=Cl([[.15,.13,.2,0,.09,-.06],[.15,.09,.1,0,.065,.11]]),r=new Ze({roughness:.45,metalness:.2});this.cars=new At(n,r,t),this.trucks=new At(i,r.clone(),t);for(let a of[this.cars,this.trucks])a.castShadow=!0,a.frustumCulled=!1,a.count=0,a.setColorAt(0,new ie(1,1,1)),e.scene.add(a);this.m4=new je,this.q=new Bt,this.p=new k,this.s=new k(1,1,1),this.c=new ie,this.yAxis=new k(0,1,0)}frame(e,t,n){let i=this.g.traffic.cars,r=0,a=0,o=Math.floor(e*6)%2===0;for(let l of i){let c=l.type===vt.TRUCK||l.type===vt.GARBAGE,h=c?this.trucks:this.cars,u=c?a++:r++;if(u>=this.max)continue;this.q.setFromAxisAngle(this.yAxis,l.yaw);let p=this.g.road[l.path[Math.min(l.piece,l.path.length-1)]]&&this.g.world.terrain[l.path[Math.min(l.piece,l.path.length-1)]]===1?.24:.012;this.p.set(l.x,p,l.z),this.m4.compose(this.p,this.q,this.s),h.setMatrixAt(u,this.m4);let g;if(l.type===vt.FIRE?g=o?16722458:14165532:l.type===vt.POLICE?g=o?2976767:16053492:l.type===vt.GARBAGE?g=15895592:l.type===vt.VAN?g=15986662:l.type===vt.TRUCK?g=[14275786,7306374,11880250,3117024][l.color%4]:g=mu[l.color%mu.length],this.c.setHex(g),h.setColorAt(u,this.c),t>.25&&n){let x=Math.sin(l.yaw),m=Math.cos(l.yaw);n.add(l.x+x*.16,p+.06,l.z+m*.16,.16,1,.92,.7,.55*t),(l.type===vt.FIRE||l.type===vt.POLICE)&&n.add(l.x,p+.16,l.z,.3,l.type===vt.FIRE?1:.2,.2,l.type===vt.FIRE?.1:1,o?.9:.2)}}this.cars.count=Math.min(r,this.max),this.trucks.count=Math.min(a,this.max);for(let l of[this.cars,this.trucks])l.instanceMatrix.needsUpdate=!0,l.instanceColor&&(l.instanceColor.needsUpdate=!0)}},ex={1:2984526,2:2782148,3:13208084,4:8081344},_a=class{constructor(e){this.e=e,this.g=e.game,this.group=new Tt,e.scene.add(this.group),this.version=-1,this.H=Ie.trackHeight;let t=Cl([[.26,.2,.5,0,.1,0],[.22,.04,.44,0,.22,0]]);this.trainMat=new Ze({roughness:.35,metalness:.25,emissive:0}),this.trainCars=new At(t,this.trainMat,400),this.trainCars.castShadow=!0,this.trainCars.frustumCulled=!1,this.trainCars.count=0,this.trainCars.setColorAt(0,new ie(1,1,1)),e.scene.add(this.trainCars);let n={1:new It(.07,.07,.03,14),2:new It(.085,.085,.03,3),3:new at(.12,.03,.12),4:(()=>{let i=new at(.11,.03,.11);return i.rotateY(Math.PI/4),i})()};this.paxMesh={};for(let i of[1,2,3,4]){let r=new At(n[i],new Xt({color:ex[i]}),1200);r.frustumCulled=!1,r.count=0,e.scene.add(r),this.paxMesh[i]=r}this.ringGroup=new Tt,e.scene.add(this.ringGroup),this.rings=new Map,this.tmp={x:0,z:0,yaw:0},this.m4=new je,this.q=new Bt,this.p=new k,this.s=new k(1,1,1),this.c=new ie,this.yAxis=new k(0,1,0),this.highlightLine=null,this.rebuild()}rebuild(){let e=this.g,t=e.transit;this.version=t.version;for(let l of[...this.group.children])this.group.remove(l),l.traverse(c=>{c.geometry&&c.geometry.dispose()});let n=this.H,i=new It(.05,.07,n,6);i.translate(0,n/2,0);let r=new Ze({color:15328991,roughness:.7}),a=[];for(let l of t.lines){let c=new ie(rn[l.color]),h=[],u=[];for(let g=0;g<l.pts.length-1;g++){let[x,m]=l.pts[g],[f,y]=l.pts[g+1],v=Math.hypot(f-x,y-m);if(v<1e-4)continue;let M=(f-x)/v,T=(y-m)/v,E=l.segOffset&&l.segOffset[l.pair[g+1]]||0,b=x-T*E-e.W/2,L=m+M*E-e.H/2,_=f-T*E-e.W/2,w=y+M*E-e.H/2,U=Math.atan2(M,T);h.push([.2,.08,v+.2,(b+_)/2,n-.04,(L+w)/2,U]),u.push([.215,.03,v+.2,(b+_)/2,n-.085,(L+w)/2,U]);let H=Math.max(1,Math.round(v/2.5));for(let K=0;K<H;K++){let I=(K+.5)/H;a.push([b+(_-b)*I,L+(w-L)*I])}}if(!h.length)continue;let d=new Re(pu(h),new Ze({color:15855336,roughness:.6})),p=new Re(pu(u),new Ze({color:c,roughness:.5,emissive:c,emissiveIntensity:.25}));d.castShadow=d.receiveShadow=!0,p.userData.line=l.id,this.group.add(d,p)}let o=new At(i,r,Math.max(1,a.length));a.forEach(([l,c],h)=>{this.m4.makeTranslation(l,0,c),o.setMatrixAt(h,this.m4)}),o.count=a.length,o.castShadow=!0,this.group.add(o);for(let l of t.stations.values()){let c=l.x+.5-e.W/2,h=l.y+.5-e.H/2,u=new Tt,d=new Ze({color:16250352,roughness:.6}),p=new Ze({color:3028032,roughness:.5}),g=new Re(new at(.86,.1,.86),d);g.position.y=n-.12;let x=new Re(new at(.9,.05,.9),p);x.position.y=n+.42,u.add(g,x);for(let[f,y]of[[-.36,-.36],[.36,-.36],[-.36,.36],[.36,.36]]){let v=new Re(new It(.035,.035,n+.42,6),d);v.position.set(f,(n+.42)/2,y),u.add(v)}if(t.lines.filter(f=>f.stops.includes(l.id)).forEach((f,y)=>{let v=new Re(new at(.92,.035,.08),new Ze({color:rn[f.color],emissive:rn[f.color],emissiveIntensity:.35}));v.position.set(0,n+.38,.38-y*.1),u.add(v)}),l.shape){let f=l.shape===1?new It(.16,.16,.05,20):l.shape===2?new It(.2,.2,.05,3):new at(.26,.05,.26);l.shape===4&&f.rotateY(Math.PI/4);let y=new Re(f,new Ze({color:16777215,emissive:16777215,emissiveIntensity:.2}));y.position.y=n+.47;let v=new Re(f.clone().scale(1.25,.8,1.25),p);v.position.y=n+.45,u.add(v,y)}u.position.set(c,0,h),u.traverse(f=>{f.isMesh&&(f.castShadow=!0,f.receiveShadow=!0)}),u.userData.station=l.id,this.group.add(u)}for(let l of this.rings.values())this.ringGroup.remove(l);this.rings.clear()}frame(e,t){let n=this.g,i=n.transit;i.version!==this.version&&this.rebuild();let r=this.H,a=0;for(let l of i.trains){let c=i.lines.find(u=>u.id===l.line);if(!c)continue;let h=1+l.wagons;for(let u=0;u<h&&a<400;u++){let d=l.d-l.dir*u*.54,p=Ja(i,c,d,this.tmp);this.q.setFromAxisAngle(this.yAxis,p.yaw),this.p.set(p.x,r,p.z),this.m4.compose(this.p,this.q,this.s),this.trainCars.setMatrixAt(a,this.m4),this.c.setHex(rn[c.color]),u>0&&this.c.lerp(new ie(1,1,1),.25),this.trainCars.setColorAt(a,this.c),a++}}this.trainCars.count=a,this.trainCars.instanceMatrix.needsUpdate=!0,this.trainCars.instanceColor&&(this.trainCars.instanceColor.needsUpdate=!0),this.trainMat.emissive.setRGB(t*.25,t*.22,t*.15);let o={1:0,2:0,3:0,4:0};for(let l of i.stations.values()){let c=l.x+.5-n.W/2,h=l.y+.5-n.H/2,u=Math.min(l.waiting.length,24);for(let p=0;p<u;p++){let g=l.waiting[p],x=this.paxMesh[g.shape],m=o[g.shape]++;if(m>=1200)continue;let f=p%6,y=Math.floor(p/6);this.p.set(c-.32+f*.13,r+.58+y*.07,h-.05),this.m4.makeTranslation(this.p.x,this.p.y,this.p.z),x.setMatrixAt(m,this.m4)}let d=this.rings.get(l.id);if(l.over>.02){let g=Math.min(1,l.over);d||(d=new Re(new Ti(.62,.72,48,1,0,Math.PI*2*g),new Xt({color:15225919,transparent:!0,opacity:.9,side:Ct,depthWrite:!1})),d.rotation.x=-Math.PI/2,d.userData.prog=g,this.ringGroup.add(d),this.rings.set(l.id,d)),Math.abs(d.userData.prog-g)>.01&&(d.geometry.dispose(),d.geometry=new Ti(.62,.72,48,1,Math.PI/2,-Math.PI*2*g),d.userData.prog=g),d.position.set(c,r+.5,h),d.material.opacity=.6+.4*Math.sin(e*6)**2}else d&&(this.ringGroup.remove(d),d.geometry.dispose(),this.rings.delete(l.id))}for(let l of[1,2,3,4])this.paxMesh[l].count=Math.min(o[l],1200),this.paxMesh[l].instanceMatrix.needsUpdate=!0}};var Os=[{id:"none",name:"Normal"},{id:"power",name:"Strom",building:!0},{id:"water",name:"Wasser",building:!0},{id:"garbage",name:"M\xFCll",field:"cov:garbage"},{id:"health",name:"Gesundheit",field:"cov:health"},{id:"police",name:"Polizei",field:"cov:police"},{id:"fire",name:"Feuerwehr",field:"cov:fire"},{id:"edu",name:"Bildung",field:"cov:edu"},{id:"landValue",name:"Bodenwert",field:"fields:landValue",scale:70},{id:"pollution",name:"Verschmutzung",field:"fields:pollution",bad:!0},{id:"noise",name:"L\xE4rm",field:"fields:noise",bad:!0},{id:"crime",name:"Kriminalit\xE4t",field:"fields:crime",bad:!0},{id:"happiness",name:"Gl\xFCck",building:!0},{id:"traffic",name:"Verkehr"},{id:"transit",name:"Pulsbahn",field:"cov:transit"},{id:"resources",name:"Rohstoffe"}],ba=[new ie(15026236),new ie(15909424),new ie(4572267)];function gu(s,e,t){return e&&(s=1-s),s=Math.max(0,Math.min(1,s)),s<.5?t.copy(ba[0]).lerp(ba[1],s*2):t.copy(ba[1]).lerp(ba[2],(s-.5)*2)}var Ma=class{constructor(e){this.e=e,this.g=e.game;let t=this.g;this.mode="none",this.data=new Uint8Array(t.W*t.H*4),this.tex=new na(this.data,t.W,t.H,ln),this.tex.magFilter=jt,this.tex.minFilter=jt,this.tex.flipY=!1,this.tex.needsUpdate=!0;let n=new Re(new Tn(t.W,t.H),new Xt({map:this.tex,transparent:!0,depthWrite:!1,opacity:.78,toneMapped:!1}));n.rotation.x=-Math.PI/2,n.position.y=.05,n.renderOrder=3,n.visible=!1,e.scene.add(n),this.plane=n;let i=n.geometry.attributes.uv;for(let o=0;o<i.count;o++)i.setY(o,1-i.getY(o));let r=new Tn(.9,.9);r.rotateX(-Math.PI/2),this.zoneMat=new Xt({color:16777215,transparent:!0,opacity:.32,depthWrite:!1,toneMapped:!1}),this.zones=new At(r,this.zoneMat,t.N),this.zones.frustumCulled=!1,this.zones.count=0,this.zones.position.y=.035,this.zones.renderOrder=2,this.zones.setColorAt(0,new ie(1,1,1)),e.scene.add(this.zones);let a=new Tn(.98,.98);a.rotateX(-Math.PI/2),this.prevMat=new Xt({color:16777215,transparent:!0,opacity:.5,depthWrite:!1,toneMapped:!1}),this.preview=new At(a,this.prevMat,4096),this.preview.frustumCulled=!1,this.preview.count=0,this.preview.position.y=.06,this.preview.renderOrder=4,this.preview.setColorAt(0,new ie(1,1,1)),e.scene.add(this.preview),this.ghost=new Re(new at(1,1,1).translate(0,.5,0),new Ze({color:9429919,transparent:!0,opacity:.45,depthWrite:!1})),this.ghost.visible=!1,e.scene.add(this.ghost),this.ring=new Re(new Ti(.96,1,96),new Xt({color:16777215,transparent:!0,opacity:.85,side:Ct,depthWrite:!1,toneMapped:!1})),this.ring.rotation.x=-Math.PI/2,this.ring.position.y=.08,this.ring.visible=!1,e.scene.add(this.ring),this.disc=new Re(new sa(1,96),new Xt({color:16777215,transparent:!0,opacity:.1,depthWrite:!1,toneMapped:!1})),this.disc.rotation.x=-Math.PI/2,this.disc.position.y=.07,this.disc.visible=!1,e.scene.add(this.disc),this.sel=new ia(new ra(new at(1,1,1).translate(0,.5,0)),new cs({color:16777215,transparent:!0,opacity:.95,depthTest:!1})),this.sel.renderOrder=10,this.sel.visible=!1,e.scene.add(this.sel),this.lineGeo=new Qe,this.lineGeo.setAttribute("position",new pt(new Float32Array(3*64),3)),this.linePrev=new Ns(this.lineGeo,new cs({color:16777215,transparent:!0,opacity:.95,depthTest:!1})),this.linePrev.renderOrder=11,this.linePrev.visible=!1,e.scene.add(this.linePrev),this.m4=new je,this.c=new ie,this.zoneStrong=!1,this.refreshZones()}refreshZones(){let e=this.g,t=e.W,n=0;for(let i=0;i<e.N;i++){let r=e.zone[i];if(!r||e.bld[i])continue;let a=i%t,o=i/t|0;this.m4.makeTranslation(a+.5-t/2,0,o+.5-e.H/2),this.zones.setMatrixAt(n,this.m4),this.c.setHex(Et[r].color),e.access[i]>=0&&e.roadComp[e.access[i]]===e.outsideComp||this.c.lerp(new ie(5592405),.55),e.rubble[i]&&this.c.setHex(4473924),this.zones.setColorAt(n,this.c),n++}this.zones.count=n,this.zones.instanceMatrix.needsUpdate=!0,this.zones.instanceColor&&(this.zones.instanceColor.needsUpdate=!0)}setZoneStrong(e){this.zoneStrong=e,this.zoneMat.opacity=e?.55:.3}setMode(e){this.mode=e;let t=Os.find(n=>n.id===e);this.plane.visible=!!(t&&(t.field||e==="resources")),this.e.roads.setTrafficTint(e==="traffic"),t&&t.building?this.e.buildings.setTint(n=>this.buildingColor(n,e)):e!=="none"&&e!=="traffic"&&e!=="transit"?this.e.buildings.setTint(n=>this.fieldTint(n)):this.e.buildings.setTint(null),this.refresh()}fieldTint(e){return this._grey||(this._grey=new ie(15197148)),this._grey}buildingColor(e,t){let n=new ie;return t==="power"?n.setHex(e.powered?4572267:15026236):t==="water"?n.setHex(e.watered?4169952:15026236):t==="happiness"?e.zone?gu(e.happy/100,!1,n):n.setHex(14275788):null}refresh(){let e=this.g,t=Os.find(r=>r.id===this.mode);if(!t)return;if(t.building){this.e.buildings.setTint(r=>this.buildingColor(r,this.mode));return}if(this.mode==="traffic"){this.e.roads.setTrafficTint(!0);return}if(!this.plane.visible)return;let n=this.data,i=this.c;if(this.mode==="resources")for(let r=0;r<e.N;r++){let a=e.world.resource[r];a===Kt.FERTILE?(n[r*4]=120,n[r*4+1]=190,n[r*4+2]=70,n[r*4+3]=200):a===Kt.ORE?(n[r*4]=150,n[r*4+1]=110,n[r*4+2]=90,n[r*4+3]=220):n[r*4+3]=0}else{let[r,a]=t.field.split(":"),o=e[r][a],l=t.scale||1;for(let c=0;c<e.N;c++){let h=e.world.terrain[c];if(h===le.WATER||h===le.ROCK){n[c*4+3]=0;continue}let u=o[c]/l;a==="edu"&&(u=u/1),gu(u,t.bad,i),n[c*4]=i.r*255,n[c*4+1]=i.g*255,n[c*4+2]=i.b*255,n[c*4+3]=t.bad?Math.min(230,40+u*255):190}}this.tex.needsUpdate=!0}showTiles(e){let t=this.g,n=0;for(let i of e){if(n>=4096)break;let r=i.i%t.W,a=i.i/t.W|0,o=t.world.terrain[i.i]===le.WATER;this.m4.makeTranslation(r+.5-t.W/2,o?.22:0,a+.5-t.H/2),this.preview.setMatrixAt(n,this.m4),this.c.setHex(i.color),this.preview.setColorAt(n,this.c),n++}this.preview.count=n,this.preview.instanceMatrix.needsUpdate=!0,this.preview.instanceColor&&(this.preview.instanceColor.needsUpdate=!0)}clearTiles(){this.preview.count=0}showGhost(e,t,n,i,r,a=.6){let o=this.g;this.ghost.visible=!0,this.ghost.position.set(e+n/2-o.W/2,.01,t+i/2-o.H/2),this.ghost.scale.set(n*.96,a,i*.96),this.ghost.material.color.setHex(r?9429919:15761520)}hideGhost(){this.ghost.visible=!1}showRadius(e,t,n,i=16777215){this.ring.visible=this.disc.visible=!0,this.ring.position.x=this.disc.position.x=e,this.ring.position.z=this.disc.position.z=t,this.ring.scale.set(n,n,1),this.disc.scale.set(n,n,1),this.ring.material.color.setHex(i),this.disc.material.color.setHex(i)}hideRadius(){this.ring.visible=this.disc.visible=!1}select(e){if(!e){this.sel.visible=!1;return}let t=this.g;this.sel.visible=!0,this.sel.position.set(e.x+e.w/2-t.W/2,0,e.y+e.h/2-t.H/2);let n=e.station?Ie.trackHeight+.6:e.height||1;this.sel.scale.set(e.w+.04,n,e.h+.04)}showLinePreview(e,t){if(!e||e.length<2){this.linePrev.visible=!1;return}let n=this.lineGeo.attributes.position.array,i=Math.min(e.length,64);for(let r=0;r<i;r++)n[r*3]=e[r][0],n[r*3+1]=Ie.trackHeight,n[r*3+2]=e[r][1];this.lineGeo.setDrawRange(0,i),this.lineGeo.attributes.position.needsUpdate=!0,this.lineGeo.computeBoundingSphere(),this.linePrev.material.color.setHex(t),this.linePrev.visible=!0}};function tx(){let s=document.createElement("canvas");s.width=s.height=64;let e=s.getContext("2d"),t=e.createRadialGradient(32,32,2,32,32,30);t.addColorStop(0,"rgba(255,255,255,0.9)"),t.addColorStop(.6,"rgba(255,255,255,0.35)"),t.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=t,e.beginPath(),e.arc(32,32,30,0,Math.PI*2),e.fill();let n=new Gn(s);return n.colorSpace=ut,n}function nx(){let e=document.createElement("canvas");e.width=128*4,e.height=128*2;let t=e.getContext("2d"),n=(l,c,h)=>{t.fillStyle="rgba(20,24,32,0.85)",t.beginPath(),t.arc(l,c,54,0,Math.PI*2),t.fill(),t.strokeStyle=h,t.lineWidth=7,t.beginPath(),t.arc(l,c,50,0,Math.PI*2),t.stroke()},i=l=>[l%4*128+128/2,Math.floor(l/4)*128+128/2],[r,a]=i(0);n(r,a,"#f2c230"),t.fillStyle="#f2c230",t.beginPath(),t.moveTo(r+6,a-36),t.lineTo(r-18,a+4),t.lineTo(r-2,a+4),t.lineTo(r-8,a+36),t.lineTo(r+18,a-6),t.lineTo(r+2,a-6),t.closePath(),t.fill(),[r,a]=i(1),n(r,a,"#3fa0e0"),t.fillStyle="#5ab7f0",t.beginPath(),t.moveTo(r,a-34),t.bezierCurveTo(r+30,a,r+24,a+30,r,a+30),t.bezierCurveTo(r-24,a+30,r-30,a,r,a-34),t.fill(),[r,a]=i(2),n(r,a,"#b98a4a"),t.fillStyle="#d7a35c",t.fillRect(r-20,a-14,40,44),t.fillRect(r-26,a-24,52,8),t.fillRect(r-8,a-32,16,8),[r,a]=i(3),n(r,a,"#ff7a2a"),t.fillStyle="#ff8a2a",t.beginPath(),t.moveTo(r,a-36),t.bezierCurveTo(r+30,a-6,r+26,a+32,r,a+32),t.bezierCurveTo(r-26,a+32,r-28,a+2,r-8,a-12),t.bezierCurveTo(r-6,a,r+4,a-14,r,a-36),t.fill(),t.fillStyle="#ffd34a",t.beginPath(),t.arc(r,a+16,11,0,Math.PI*2),t.fill(),[r,a]=i(4),n(r,a,"#e5483c"),t.strokeStyle="#ffffff",t.lineWidth=8,t.beginPath(),t.moveTo(r-14,a-30),t.lineTo(r-20,a+30),t.moveTo(r+14,a-30),t.lineTo(r+20,a+30),t.stroke(),t.strokeStyle="#e5483c",t.lineWidth=9,t.beginPath(),t.moveTo(r-30,a-30),t.lineTo(r+30,a+30),t.stroke(),[r,a]=i(5),n(r,a,"#e5483c"),t.strokeStyle="#ffffff",t.lineWidth=7,t.beginPath(),t.arc(r,a+26,18,Math.PI*1.15,Math.PI*1.85),t.stroke(),t.fillStyle="#ffffff",t.beginPath(),t.arc(r-14,a-10,6,0,Math.PI*2),t.arc(r+14,a-10,6,0,Math.PI*2),t.fill(),[r,a]=i(6),n(r,a,"#9a9a9a"),t.fillStyle="#c9c9c9",t.beginPath(),t.moveTo(r-26,a),t.lineTo(r,a-26),t.lineTo(r+26,a),t.closePath(),t.fill(),t.fillRect(r-18,a,36,26),t.strokeStyle="#e5483c",t.lineWidth=6,t.beginPath(),t.moveTo(r-12,a+4),t.lineTo(r+12,a+22),t.moveTo(r+12,a+4),t.lineTo(r-12,a+22),t.stroke(),[r,a]=i(7),n(r,a,"#f06fae"),t.fillStyle="#ffffff";for(let l of[-16,0,16])t.beginPath(),t.arc(r+l,a-10,8,0,Math.PI*2),t.fill(),t.fillRect(r+l-7,a,14,22);let o=new Gn(e);return o.colorSpace=ut,o.flipY=!1,o}var Vn={POWER:0,WATER:1,GARBAGE:2,FIRE:3,ROAD:4,SAD:5,ABANDONED:6,CROWD:7},wa=class{constructor(e){this.e=e,this.g=e.game;let t=du();this.lights=new ms(16e3,pa(t,!0)),this.lights.points.renderOrder=6,e.scene.add(this.lights.points),this.smokeBuf=new ms(1600,pa(tx(),!1)),this.smokeBuf.points.renderOrder=5,e.scene.add(this.smokeBuf.points),this.fireBuf=new ms(1200,pa(t,!0)),this.fireBuf.points.renderOrder=7,e.scene.add(this.fireBuf.points),this.particles=[],this.fireParts=[],this.iconMax=3e3;let n=new Qe;this.iconPos=new Float32Array(this.iconMax*3),this.iconIdx=new Float32Array(this.iconMax),n.setAttribute("position",new pt(this.iconPos,3).setUsage(Ci)),n.setAttribute("aIcon",new pt(this.iconIdx,1).setUsage(Ci)),this.iconGeo=n,this.iconMat=new en({uniforms:{uTex:{value:nx()},uTime:{value:0},uSize:{value:30}},vertexShader:`
attribute float aIcon;
varying float vIcon;
uniform float uTime; uniform float uSize;
void main() {
  vIcon = aIcon;
  vec3 p = position;
  p.y += sin(uTime * 3.0 + position.x * 2.0 + position.z) * 0.06;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp(uSize * 24.0 / max(1.0, -mv.z), 14.0, uSize);
  gl_Position = projectionMatrix * mv;
}`,fragmentShader:`
uniform sampler2D uTex;
varying float vIcon;
void main() {
  float col = mod(vIcon, 4.0);
  float row = floor(vIcon / 4.0);
  vec2 uv = (vec2(col, row) + gl_PointCoord) / vec2(4.0, 2.0);
  vec4 t = texture2D(uTex, uv);
  if (t.a < 0.05) discard;
  gl_FragColor = t;
}`,transparent:!0,depthWrite:!1,depthTest:!1}),this.icons=new li(n,this.iconMat),this.icons.frustumCulled=!1,this.icons.renderOrder=20,e.scene.add(this.icons),this.iconTimer=0,this.showIcons=!0}emitSmoke(e,t,n,i){if(this.particles.length>=1500)return;let r=i==="steam";this.particles.push({x:e+(Math.random()-.5)*.05,y:t,z:n+(Math.random()-.5)*.05,vx:.08+Math.random()*.05,vy:.35+Math.random()*.2,vz:.03+(Math.random()-.5)*.06,age:0,life:r?3.2:2.6+Math.random(),size:r?.6:.32,steam:r,dark:i==="fire"})}updateIcons(e){let t=this.g,n=0,i=(r,a,o=0)=>{if(n>=this.iconMax)return;let l=r.x+r.w/2-t.W/2,c=r.y+r.h/2-t.H/2,h=(r.zone?[0,.7,1.1,1.5,2.5,4.8][r.level]:1.2)+.6+o;this.iconPos[n*3]=l,this.iconPos[n*3+1]=h,this.iconPos[n*3+2]=c,this.iconIdx[n]=a,n++};if(this.showIcons){for(let r of t.buildings.values())if(!(r.construct<1)){if(r.burning){i(r,Vn.FIRE);continue}if(r.abandoned){i(r,Vn.ABANDONED);continue}if(!r.zone){r.key!=="park"&&r.comp>=0&&!r.powered&&ix(r)&&i(r,Vn.POWER);continue}r.connected?!r.powered&&r.noPower>0?i(r,Vn.POWER):!r.watered&&r.noWater>0?i(r,Vn.WATER):r.problemGarbage?i(r,Vn.GARBAGE):r.happy<25&&i(r,Vn.SAD):i(r,Vn.ROAD)}for(let r of t.transit.stations.values())if(r.waiting.length>14){if(n>=this.iconMax)break;this.iconPos[n*3]=r.x+.5-t.W/2,this.iconPos[n*3+1]=4.6,this.iconPos[n*3+2]=r.y+.5-t.H/2,this.iconIdx[n]=Vn.CROWD,n++}}this.iconGeo.setDrawRange(0,n),this.iconGeo.attributes.position.needsUpdate=!0,this.iconGeo.attributes.aIcon.needsUpdate=!0}frame(e,t,n,i){let r=this.g;if(this.iconMat.uniforms.uTime.value=n,this.iconTimer-=e,this.iconTimer<=0&&(this.iconTimer=.5,this.updateIcons(n)),t>0){for(let[u,d]of this.e.buildings.emitters){let p=r.buildings.get(u);if(!p||p.construct<1||p.abandoned||!p.powered)continue;let g=(p.zone?1.1*(.3+p.occ/Math.max(1,p.cap)):2.2)*t;for(let x of d)Math.random()<g*x.amount&&this.emitSmoke(x.x,x.y,x.z,x.type)}for(let u of r.buildings.values()){if(!u.burning)continue;let d=u.x+u.w/2-r.W/2,p=u.y+u.h/2-r.H/2,g=u.zone?[0,.5,.8,1.1,2,4][u.level]:.6;for(let x=0;x<3;x++)this.fireParts.length<1100&&this.fireParts.push({x:d+(Math.random()-.5)*.6,y:Math.random()*g,z:p+(Math.random()-.5)*.6,vy:.6+Math.random()*.6,age:0,life:.5+Math.random()*.5});Math.random()<.5&&this.emitSmoke(d,g+.2,p,"fire")}}let a=this.smokeBuf;a.begin();let o=[],l=1-i*.7;for(let u of this.particles){if(u.age+=t>0?e:0,u.age>u.life)continue;let d=u.age/u.life;u.x+=u.vx*e*(t>0?1:0),u.y+=u.vy*e*(t>0?1:0)*(1-d*.5),u.z+=u.vz*e*(t>0?1:0);let p=(1-d)*(u.steam?.5:.55)*Math.min(1,d*6),g=u.dark?.25:u.steam?.97:.72;a.add(u.x,u.y,u.z,u.size*(1+d*2.2),g*l,g*l,g*l*1.02,p),o.push(u)}this.particles=o,a.end();let c=this.fireBuf;c.begin();let h=[];for(let u of this.fireParts){if(u.age+=e,u.age>u.life)continue;u.y+=u.vy*e;let d=u.age/u.life;c.add(u.x,u.y,u.z,.35*(1-d*.6),1,.55-d*.35,.15,(1-d)*.9),h.push(u)}this.fireParts=h,c.end()}beginLights(){this.lights.begin()}endLights(){this.lights.end()}addLampLights(e,t){if(t<.15)return;let n=t*.55;for(let i=0;i<e.length;i+=3)this.lights.add(e[i],e[i+1],e[i+2],.42,1,.82,.5,n)}addFireLights(){let e=this.g;for(let t of e.buildings.values())t.burning&&this.lights.add(t.x+t.w/2-e.W/2,.8,t.y+t.h/2-e.H/2,2.4,1,.45,.1,.5+Math.random()*.2)}};function ix(s){return["police","policehq","fire","firehq","clinic","hospital","school","university","library","pump","waterworks","watertower","townhall"].includes(s.key)}var Pl=[[0,791600,2042442,659234],[4.3,1121085,2831703,659234],[5.1,3821440,12159630,1710634],[6,8368861,16173728,6974066],[7.8,8831978,15266284,9085096],[18.2,8831978,15266284,9085096],[19.7,6983626,16167299,6971504],[20.6,3424634,12745340,2761266],[21.6,1318208,3620970,659234],[24,791600,2042442,659234]];function sx(s,e,t,n){for(let i=0;i<Pl.length-1;i++){let r=Pl[i],a=Pl[i+1];if(s>=r[0]&&s<=a[0]){let o=(s-r[0])/(a[0]-r[0]);e.setHex(r[1]).lerp(new ie(a[1]),o),t.setHex(r[2]).lerp(new ie(a[2]),o),n.setHex(r[3]).lerp(new ie(a[3]),o);return}}}var Bs=class{constructor(e,t,n){this.canvas=e,this.game=t,this.settings=n;let i=new ks({canvas:e,antialias:!0,powerPreference:"high-performance"});i.setPixelRatio(Math.min(window.devicePixelRatio||1,n.quality==="low"?1:2)),i.outputColorSpace=ut,i.toneMapping=Ml,i.toneMappingExposure=1,i.shadowMap.enabled=n.quality!=="low",i.shadowMap.type=bl,this.renderer=i;let r=new ta;this.scene=r,this.camera=new Qt(42,1,.3,1200),this.rig=new ma(this.camera,e,t.W);let a=t.world.highway[t.world.highway.length-1]%t.W;this.rig.focus(a+10-t.W/2,t.world.highwayY-t.H/2,30),this.rig.cur={...this.rig.goal,dist:70,yaw:.2},this.skyTop=new ie,this.skyHor=new ie,this.skyBot=new ie;let o=new en({uniforms:{top:{value:this.skyTop},hor:{value:this.skyHor},bot:{value:this.skyBot}},vertexShader:"varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",fragmentShader:`uniform vec3 top; uniform vec3 hor; uniform vec3 bot; varying vec3 vP;
void main(){ float y = vP.y; vec3 c = y > 0.0 ? mix(hor, top, pow(min(1.0, y * 1.6), 0.7)) : mix(hor, bot, min(1.0, -y * 2.5));
gl_FragColor = vec4(c, 1.0); }`,side:$t,depthWrite:!1,fog:!1});this.sky=new Re(new us(800,32,16),o),this.sky.renderOrder=-10,r.add(this.sky);let l=new Qe,c=[];for(let h=0;h<900;h++){let u=Math.random()*Math.PI*2,d=Math.acos(Math.random()*.9);c.push(Math.sin(d)*Math.cos(u)*700,Math.cos(d)*700,Math.sin(d)*Math.sin(u)*700)}l.setAttribute("position",new Se(c,3)),this.stars=new li(l,new Us({color:16777215,size:1.6,sizeAttenuation:!1,transparent:!0,opacity:0,fog:!1,depthWrite:!1})),r.add(this.stars),r.fog=new ea(15266284,120,420),this.hemi=new la(14675711,7035461,1),r.add(this.hemi),this.sun=new ca(16777215,2.5),this.sun.castShadow=!0,this.sun.shadow.mapSize.set(n.quality==="high"?4096:2048,n.quality==="high"?4096:2048),this.sun.shadow.bias=-4e-4,this.sun.shadow.normalBias=.03,r.add(this.sun),r.add(this.sun.target),this.terrain=new ga(this),this.roads=new xa(this),this.buildings=new va(this),this.vehicles=new ya(this),this.transit=new _a(this),this.overlay=new Ma(this),this.effects=new wa(this),this.dirty={trees:!1,zones:!1,roads:!1,terrainColors:!1,overlay:!1},this.bindGame(),this.time=0,this.overlayTimer=0,this.resize(),window.addEventListener("resize",()=>this.resize())}bindGame(){let e=this.game,t=this.dirty;this.unbind=[e.on("buildingAdded",n=>{this.buildings.add(n),t.zones=!0}),e.on("buildingRebuilt",n=>this.buildings.add(n)),e.on("buildingUpdated",n=>this.buildings.update(n)),e.on("buildingRemoved",n=>{this.buildings.remove(n),t.zones=!0,t.trees=!0}),e.on("roadsChanged",()=>{t.roads=!0,t.trees=!0,t.zones=!0}),e.on("zonesChanged",()=>{t.zones=!0}),e.on("treesChanged",()=>{t.trees=!0}),e.on("rubbleChanged",()=>{t.terrainColors=!0,t.zones=!0}),e.on("hour",()=>{t.overlay=!0})]}dispose(){for(let e of this.unbind)e();this.renderer.dispose()}resize(){let e=this.canvas.clientWidth||window.innerWidth,t=this.canvas.clientHeight||window.innerHeight;this.renderer.setSize(e,t,!1),this.camera.aspect=e/t,this.camera.updateProjectionMatrix(),this.effects&&(this.effects.lights.points.material.uniforms.uScale.value=t*.9),this.effects&&(this.effects.smokeBuf.points.material.uniforms.uScale.value=t*.9,this.effects.fireBuf.points.material.uniforms.uScale.value=t*.9)}pickTile(e,t){let n=this.rig.groundAt(e,t);if(!n)return null;let i=this.game,r=Math.floor(n.x+i.W/2),a=Math.floor(n.z+i.H/2);return r<0||a<0||r>=i.W||a>=i.H?{x:r,y:a,i:-1,wx:n.x,wz:n.z,out:!0}:{x:r,y:a,i:a*i.W+r,wx:n.x,wz:n.z}}dayNight(e){this.settings.alwaysDay&&(e=12);let t=(e-5.4)/15.4*Math.PI,n=Math.sin(t),i=1-Math.max(0,Math.min(1,(n+.08)/.3));this.night=i,ps.uNight.value=i,sx(e,this.skyTop,this.skyHor,this.skyBot),this.scene.fog.color.copy(this.skyHor);let r=this.rig.target,a;n>-.05?a=new k(-Math.cos(t),Math.max(.12,n),.45).normalize():a=new k(Math.cos(t)*.5,.75,-.35).normalize();let o=Math.min(90,Math.max(18,this.rig.cur.dist*1.15));this.sun.position.copy(r).addScaledVector(a,80),this.sun.target.position.copy(r);let l=this.sun.shadow.camera;l.right!==o&&(l.left=-o,l.right=o,l.top=o,l.bottom=-o,l.near=1,l.far=220,l.updateProjectionMatrix());let c=Math.max(0,n),h=1-Math.min(1,n/.45);n>-.05?(this.sun.color.setRGB(1,.93-h*.25,.85-h*.45),this.sun.intensity=.4+c*2.4):(this.sun.color.setRGB(.6,.7,1),this.sun.intensity=.75),this.hemi.intensity=.75+(1-i)*.6,i>.5?this.hemi.color.setHex(8228804):this.hemi.color.copy(this.skyTop).lerp(new ie(16777215),.55),this.hemi.groundColor.setHex(i>.5?2763326:7035461),this.stars.material.opacity=i*.9,this.renderer.toneMappingExposure=1+i*.25,this.roads.setNight(i)}frame(e,t){this.time+=e,ps.uTime.value=this.time;let n=this.game,i=this.dirty;i.roads&&(this.roads.rebuild(),i.roads=!1,this.overlay.mode==="traffic"&&this.roads.setTrafficTint(!0)),i.trees&&(this.terrain.refreshTrees(),i.trees=!1),i.zones&&(this.overlay.refreshZones(),i.zones=!1),i.terrainColors&&(this.terrain.refreshColors(),i.terrainColors=!1),this.overlayTimer-=e,i.overlay&&this.overlay.mode!=="none"&&this.overlayTimer<=0&&(this.overlay.refresh(),i.overlay=!1,this.overlayTimer=.6),this.rig.update(e),this.dayNight(n.hour()),this.sky.position.copy(this.camera.position),this.stars.position.copy(this.camera.position);let r=this.rig.cur.dist;this.scene.fog.near=r*2.2+30,this.scene.fog.far=r*6+200;let a=this.night;this.buildings.frame(e,this.time,a),this.effects.beginLights(),this.effects.addLampLights(this.roads.lampPositions,a),this.effects.addFireLights(),this.vehicles.frame(this.time,a,this.effects.lights),this.effects.endLights(),this.transit.frame(this.time,a),this.effects.frame(e,t,this.time,a),this.renderer.render(this.scene,this.camera)}};var Sa=class{constructor(e,t,n){this.e=e,this.g=e.game,this.ui=t,this.audio=n,this.tool={kind:"select"},this.drag=null,this.hover=null,this.rot=0,this.lineStops=[],this.lastMove=null;let i=e.canvas;this.onDown=r=>this.pointerDown(r),this.onMove=r=>{this.lastMove=r,this.pointerMove(r)},this.onUp=r=>this.pointerUp(r),this.onKey=r=>this.key(r),this.onDbl=r=>{(this.tool.kind==="line"||this.tool.kind==="extend")&&this.finishLine()},i.addEventListener("pointerdown",this.onDown),i.addEventListener("pointermove",this.onMove),i.addEventListener("pointerup",this.onUp),i.addEventListener("dblclick",this.onDbl),i.addEventListener("pointerleave",()=>{this.ui.tooltip(null)}),window.addEventListener("keydown",this.onKey)}dispose(){let e=this.e.canvas;e.removeEventListener("pointerdown",this.onDown),e.removeEventListener("pointermove",this.onMove),e.removeEventListener("pointerup",this.onUp),e.removeEventListener("dblclick",this.onDbl),window.removeEventListener("keydown",this.onKey)}setTool(e){this.cancelDrag(),this.tool=e||{kind:"select"},this.lineStops=[];let t=this.e.overlay;t.hideGhost(),t.hideRadius(),t.clearTiles(),t.showLinePreview(null),t.setZoneStrong(this.tool.kind==="zone"),this.ui.toolChanged(this.tool),this.ui.tooltip(null),this.lastMove&&this.pointerMove(this.lastMove)}cancelDrag(){this.drag=null,this.e.overlay.clearTiles()}key(e){e.target&&(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA")||(e.code==="Escape"?this.drag?this.cancelDrag():(this.tool.kind==="line"||this.tool.kind==="extend")&&this.lineStops.length?(this.lineStops=[],this.e.overlay.showLinePreview(null)):this.tool.kind!=="select"?this.setTool({kind:"select"}):this.ui.closePanels():e.code==="KeyR"&&this.tool.kind==="place"?(this.rot=(this.rot+1)%4,this.lastMove&&this.pointerMove(this.lastMove)):e.code==="Enter"&&(this.tool.kind==="line"||this.tool.kind==="extend")?this.finishLine():(e.code==="KeyB"||e.code==="Delete")&&this.setTool({kind:"bulldoze"}))}pointerDown(e){if(this.e.rig.pinching)return;if(e.button===2){this.rightDown={x:e.clientX,y:e.clientY};return}if(e.button!==0||e.altKey)return;let t=this.e.pickTile(e.clientX,e.clientY);if(e.pointerType==="touch"&&this.tool.kind==="select"){this.touchPan={x:e.clientX,y:e.clientY,id:e.pointerId,moved:0};return}if(!t||t.i<0)return;let n=this.tool.kind;(n==="road"||n==="zone"||n==="dezone"||n==="bulldoze")&&(this.drag={sx:t.x,sy:t.y,ex:t.x,ey:t.y},this.e.canvas.setPointerCapture(e.pointerId),this.updatePreview())}pointerMove(e){if(this.touchPan&&e.pointerId===this.touchPan.id){let n=e.clientX-this.touchPan.x,i=e.clientY-this.touchPan.y;this.touchPan.x=e.clientX,this.touchPan.y=e.clientY,this.touchPan.moved+=Math.abs(n)+Math.abs(i),this.e.rig.pinching||this.e.rig.panScreen(n,i);return}this.e.rig.pinching&&this.drag&&this.cancelDrag();let t=this.e.pickTile(e.clientX,e.clientY);if(this.hover=t,this.mouse={x:e.clientX,y:e.clientY},!t){this.ui.tooltip(null);return}if(this.drag){(t.i>=0||this.tool.kind!=="road")&&(this.drag.ex=Math.max(0,Math.min(this.g.W-1,t.x)),this.drag.ey=Math.max(0,Math.min(this.g.H-1,t.y))),this.updatePreview();return}this.updateHover()}pointerUp(e){if(e.button===2){let i=this.rightDown;this.rightDown=null,i&&Math.hypot(e.clientX-i.x,e.clientY-i.y)<5&&(this.tool.kind==="line"||this.tool.kind==="extend"?this.lineStops.length?this.finishLine():this.setTool({kind:"select"}):this.drag?this.cancelDrag():this.tool.kind!=="select"&&this.setTool({kind:"select"}));return}if(this.touchPan&&e.pointerId===this.touchPan.id){let i=this.touchPan;if(this.touchPan=null,i.moved>8)return}else if(e.button!==0)return;if(this.e.rig.pinching)return;let t=this.e.pickTile(e.clientX,e.clientY),n=this.tool.kind;if(this.drag){this.applyDrag(),this.cancelDrag(),this.updateHover();return}!t||t.i<0||(n==="select"?this.selectAt(t):n==="place"?this.placeAt(t):(n==="line"||n==="extend")&&this.lineClick(t))}roadTiles(){let e=this.drag,t=this.g.W,n=[],i=e.ex-e.sx,r=e.ey-e.sy,a=Math.abs(i)>=Math.abs(r),o=Math.sign(i),l=Math.sign(r),c=e.sx,h=e.sy;if(n.push(h*t+c),a){for(;c!==e.ex;)c+=o,n.push(h*t+c);for(;h!==e.ey;)h+=l,n.push(h*t+c)}else{for(;h!==e.ey;)h+=l,n.push(h*t+c);for(;c!==e.ex;)c+=o,n.push(h*t+c)}return n}rectTiles(){let e=this.drag,t=this.g.W,n=Math.min(e.sx,e.ex),i=Math.max(e.sx,e.ex),r=Math.min(e.sy,e.ey),a=Math.max(e.sy,e.ey),o=[];for(let l=r;l<=a;l++)for(let c=n;c<=i;c++)o.push(l*t+c);return o}updatePreview(){let e=this.g,t=this.e.overlay,n=this.tool.kind;if(this.drag){if(n==="road"){let i=this.roadTiles(),r=e.planRoad(i,this.tool.type),a=new Set(r.invalid);t.showTiles(i.map(c=>({i:c,color:a.has(c)?16732224:e.world.terrain[c]===le.WATER?8376575:10285232})));let o=r.build.filter(c=>e.world.terrain[c]===le.WATER).length,l=r.invalid.length?"Hindernis im Weg":`${wt[this.tool.type].name}: ${r.build.length} Felder${o?` (davon ${o} Br\xFCcke)`:""} \xB7 ${Xe(r.cost)}`;this.ui.tooltip(l,this.mouse,!r.invalid.length&&e.canAfford(r.cost))}else if(n==="zone"||n==="dezone"){let i=this.rectTiles(),r=n==="zone"?this.tool.zone:0,a=e.planZone(i,r),o=new Set(a.apply),l=r?Et[r].color:12303291;t.showTiles(i.filter(c=>o.has(c)).map(c=>({i:c,color:l}))),this.ui.tooltip(r?`${Et[r].name}: ${a.apply.length} Felder \xB7 ${Xe(a.cost)}`:`Zonen entfernen: ${a.apply.length} Felder`,this.mouse,!0)}else if(n==="bulldoze"){let i=this.rectTiles(),r=e.planBulldoze(i);t.showTiles(i.map(o=>({i:o,color:16734794})));let a=[];r.blds.length&&a.push(`${r.blds.length} Geb\xE4ude`),r.roads.length&&a.push(`${r.roads.length} Stra\xDFenfelder`),r.stations.length&&a.push(`${r.stations.length} Stationen`),r.trees&&a.push(`${r.trees} Wald`),this.ui.tooltip(a.length?`Abriss: ${a.join(", ")} \xB7 ${r.net>0?Xe(r.net):"+"+Xe(-r.net)}`:"Nichts abzurei\xDFen",this.mouse,!0)}}}updateHover(){let e=this.hover,t=this.g,n=this.e.overlay,i=this.tool.kind;if(!e||e.i<0){n.hideGhost(),n.hideRadius(),this.ui.tooltip(null),i==="select"&&n.select(this.ui.selectedBox());return}if(i==="select"){let r=t.buildings.get(t.bld[e.i]),a=t.transit.stations.get(t.stationAt[e.i]);r?n.select({x:r.x,y:r.y,w:r.w,h:r.h,height:this.buildingHeight(r)}):a?n.select({x:a.x,y:a.y,w:1,h:1,station:!0}):n.select(this.ui.selectedBox()),this.ui.tooltip(null)}else if(i==="place"){let r=this.tool.key,a=nt[r],[o,l]=t.footprint(r,this.rot),c=e.x-Math.floor((o-1)/2),h=e.y-Math.floor((l-1)/2),u=t.checkPlace(r,c,h,this.rot),d=t.placeCost(r,c,h,this.rot);n.showGhost(c,h,o,l,!u&&t.canAfford(d),r==="station"?Ie.trackHeight+.5:.6);let p=a.service?a.service.radius:a.parkRadius||(r==="station"?Ie.catchment:a.lvRadius||0);p?n.showRadius(c+o/2-t.W/2,h+l/2-t.H/2,p,a.service?16777215:10285232):n.hideRadius(),this.ui.tooltip(u||`${a.name} \xB7 ${Xe(d)}${o!==l?" \xB7 [R] drehen":""}`,this.mouse,!u&&t.canAfford(d)),this.placePos={x:c,y:h}}else if(i==="line"||i==="extend"){let r=this.linePreviewPoints(e),a=this.tool.kind==="extend"?rn[(t.transit.lines.find(c=>c.id===this.tool.line)||{color:0}).color]:rn[this.nextLineColor()];n.showLinePreview(r,a);let o=t.transit.stations.get(t.stationAt[e.i]),l;if(o)l=this.lineStops.length&&this.lineStops[0]===o.id&&this.lineStops.length>=3?`${o.name}: Ring schlie\xDFen`:`${o.name}${this.lineStops.length?" anfahren":": Linie beginnen"}`;else{let c=t.transit.canPlaceStation(e.x,e.y);l=c||`Neue Station hier \xB7 ${Xe(t.buildingCost("station"))}`}if(this.lineStops.length>=2&&(l+=" \xB7 Rechtsklick/Enter: fertig"),this.tool.kind==="line"&&this.lineStops.length>=1){let c=o&&!this.lineStops.includes(o.id)?[...this.lineStops,o.id]:this.lineStops;c.length>=2&&(l+=` \xB7 Linie \u2248 ${Xe(t.linePlanCost(c,!1))}`)}this.ui.tooltip(l,this.mouse,!0),o&&n.select({x:o.x,y:o.y,w:1,h:1,station:!0}),n.showRadius(e.x+.5-t.W/2,e.y+.5-t.H/2,Ie.catchment,10285232)}else{let r=i==="bulldoze"?16734794:i==="zone"?Et[this.tool.zone].color:16777215;if(this.e.overlay.showTiles([{i:e.i,color:r}]),i==="road"){let a=t.planRoad([e.i],this.tool.type);this.ui.tooltip(`${wt[this.tool.type].name} \xB7 ziehen zum Bauen \xB7 ${Xe(a.cost)}/Feld`,this.mouse,!0)}else i==="zone"?this.ui.tooltip(`${Et[this.tool.zone].name} \xB7 Fl\xE4che aufziehen`,this.mouse,!0):i==="dezone"?this.ui.tooltip("Zonen entfernen \xB7 Fl\xE4che aufziehen",this.mouse,!0):this.ui.tooltip("Abrei\xDFen \xB7 Fl\xE4che aufziehen",this.mouse,!0)}}buildingHeight(e){return e.zone?[0,.7,1,1.4,2.4,5][e.level]:{tvtower:6.5,wind:2.6,coal:2.4,incinerator:2.3,hospital:1.4,university:1.5,stadium:1,fusion:1.7,lighthouse:2.4,ferris:2,townhall:2.1}[e.key]||.9}nextLineColor(){let e=new Set(this.g.transit.lines.map(n=>n.color)),t=0;for(;e.has(t)&&t<9;)t++;return t}linePreviewPoints(e){let t=this.g,n=this.lineStops.map(o=>t.transit.stations.get(o)).filter(Boolean);if(this.tool.kind==="extend"&&!n.length){let o=t.transit.lines.find(l=>l.id===this.tool.line);if(o){let l=t.transit.stations.get(this.tool.atStart?o.stops[0]:o.stops[o.stops.length-1]);l&&n.push(l)}}let i=[],r=(o,l)=>i.push([o+.5-t.W/2,l+.5-t.H/2]),a=n.map(o=>[o.x,o.y]);e&&e.i>=0&&a.push([e.x,e.y]);for(let o=0;o<a.length;o++){let[l,c]=a[o];if(o>0){let[h,u]=a[o-1],d=l-h,p=c-u,g=Math.min(Math.abs(d),Math.abs(p));g>0&&Math.abs(d)!==Math.abs(p)&&((o-1)%2===0?r(h+Math.sign(d)*g,u+Math.sign(p)*g):r(l-Math.sign(d)*g,c-Math.sign(p)*g))}r(l,c)}return i}applyDrag(){let e=this.g,t=this.tool.kind,n;t==="road"?n=e.buildRoad(this.roadTiles(),this.tool.type):t==="zone"?n=e.zoneTiles(this.rectTiles(),this.tool.zone):t==="dezone"?n=e.zoneTiles(this.rectTiles(),0):t==="bulldoze"&&(n=e.bulldoze(this.rectTiles())),n&&(n.ok?(this.audio.play(t==="bulldoze"?"demolish":t==="road"?"road":"zone"),n.cost&&this.ui.floatMoney(-n.cost,this.mouse)):(this.audio.play("error"),this.ui.toast(n.msg,"bad")))}placeAt(e){let t=this.g,n=this.tool.key,[i,r]=t.footprint(n,this.rot),a=e.x-Math.floor((i-1)/2),o=e.y-Math.floor((r-1)/2),l=t.placeBuilding(n,a,o,this.rot);l.ok?(this.audio.play("place"),this.ui.floatMoney(-l.cost,this.mouse),nt[n].unique&&this.setTool({kind:"select"}),n==="station"&&l.station&&this.ui.toast(`Station ${l.station.name} gebaut. Mit dem Linien-Werkzeug verbinden.`,"info")):(this.audio.play("error"),this.ui.toast(l.msg,"bad")),this.updateHover()}selectAt(e){let t=this.g,n=t.buildings.get(t.bld[e.i]),i=t.transit.stations.get(t.stationAt[e.i]);i?(this.ui.inspect({type:"station",id:i.id}),this.audio.play("click")):n?(this.ui.inspect({type:"building",id:n.id}),this.audio.play("click")):t.road[e.i]?this.ui.inspect({type:"road",i:e.i}):this.ui.inspect({type:"tile",i:e.i})}lineClick(e){let t=this.g,n=t.transit.stations.get(t.stationAt[e.i]);if(!n){let i=t.transit.canPlaceStation(e.x,e.y);if(i){this.ui.toast(i,"bad"),this.audio.play("error");return}let r=t.placeBuilding("station",e.x,e.y,0);if(!r.ok){this.ui.toast(r.msg,"bad"),this.audio.play("error");return}n=r.station,this.ui.floatMoney(-r.cost,this.mouse)}if(this.tool.kind==="extend"){let i=t.transit.lines.find(a=>a.id===this.tool.line);if(!i){this.setTool({kind:"select"});return}let r=t.extendLine(i.id,n.id,this.tool.atStart);r.ok?(this.audio.play("line"),r.cost&&this.ui.floatMoney(-r.cost,this.mouse),r.closed&&this.setTool({kind:"select"})):(this.ui.toast(r.msg||"Geht nicht.","bad"),this.audio.play("error")),this.updateHover();return}if(this.lineStops.length>=3&&n.id===this.lineStops[0]){this.finishLine(!0);return}this.lineStops.includes(n.id)||(this.lineStops.push(n.id),this.audio.play("click"),this.updateHover())}finishLine(e=!1){let t=this.g;if(this.tool.kind==="extend"){this.setTool({kind:"select"});return}if(this.lineStops.length<2){this.lineStops=[],this.e.overlay.showLinePreview(null);return}let n=t.createLine(this.lineStops,e);n.ok?(this.audio.play("line"),this.ui.floatMoney(-n.cost,this.mouse),this.ui.toast(`Neue Linie mit ${n.line.stops.length} Stationen er\xF6ffnet.`,"good"),this.ui.openPanel("transit")):(this.audio.play("error"),this.ui.toast(n.msg,"bad")),this.lineStops=[],this.e.overlay.showLinePreview(null)}};var rx={roads:'<path d="M8 3 5 21M16 3l3 18M12 4v3M12 10.5v3M12 17v3"/>',zones:'<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',power:'<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',water:'<path d="M12 3c4 5 6 8.2 6 11a6 6 0 0 1-12 0c0-2.8 2-6 6-11Z"/>',garbage:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',services:'<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z"/><path d="M12 8v8M8 12h8"/>',education:'<path d="M2 9l10-5 10 5-10 5L2 9Z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6"/>',parks:'<path d="M12 21v-6M12 15c-4 0-6-2.5-6-5.5S8.5 3 12 3s6 3.5 6 6.5S16 15 12 15Z"/><path d="M8 21h8"/>',transit:'<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 10h14M8.5 21 10 17M15.5 21 14 17"/><circle cx="9" cy="13.5" r="0.8" fill="currentColor"/><circle cx="15" cy="13.5" r="0.8" fill="currentColor"/>',landmarks:'<path d="M12 2v4M12 6l3 3-3 13-3-13 3-3ZM7 22h10"/>',bulldoze:'<path d="M3 17h11l3-6h4M7 17l-2 4h12M14 11 9 6l-4 4 5 5"/>',select:'<path d="M5 3l14 8-6 2-2 6L5 3Z"/>',budget:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 15h2"/>',stats:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',policies:'<path d="M6 3h9l4 4v14H6Z"/><path d="M14 3v5h5M9 12h7M9 16h7"/>',news:'<path d="M4 5h12v14H6a2 2 0 0 1-2-2V5Z"/><path d="M16 9h3v8a2 2 0 0 1-2 2M7 9h6M7 13h6"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>',save:'<path d="M5 3h11l3 3v15H5Z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',pause:'<path d="M8 5v14M16 5v14"/>',play:'<path d="M7 5l12 7-12 7V5Z"/>',fast:'<path d="M4 6l8 6-8 6V6ZM12 6l8 6-8 6V6Z"/>',faster:'<path d="M2 6l6 6-6 6V6ZM9 6l6 6-6 6V6ZM16 6l6 6-6 6V6Z"/>',close:'<path d="M6 6l12 12M18 6 6 18"/>',eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',heart:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>',shield:'<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z"/>',flame:'<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.4 1.3-3.6 2.4-4.6.3 1.6 1 2.6 2 3C11 9 11 6 12 3Z"/>',cross:'<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z"/>',book:'<path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4V4ZM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6V4Z"/>',coin:'<circle cx="12" cy="12" r="8"/><path d="M14.5 9.5c-.5-.8-1.4-1.2-2.5-1.2-1.6 0-2.6.8-2.6 1.9 0 2.6 5.3 1.3 5.3 4 0 1.1-1.1 1.9-2.7 1.9-1.2 0-2.2-.5-2.7-1.4M12 6.5v1.8M12 15.8v1.7"/>',smoke:'<path d="M4 16h13a3 3 0 0 0 0-6 4 4 0 0 0-7.6-1.6A3.5 3.5 0 0 0 4 12v4ZM6 20h10"/>',sound:'<path d="M4 9v6h4l5 4V5L8 9H4ZM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>',mute:'<path d="M4 9v6h4l5 4V5L8 9H4ZM17 9l5 6M22 9l-5 6"/>',car:'<path d="M5 16h14v-4l-2-5H7l-2 5v4ZM5 12h14M7 19v-3M17 19v-3"/>',mask:'<circle cx="12" cy="12" r="9"/><path d="M8 10h.01M16 10h.01M8.5 15.5c2 1.5 5 1.5 7 0"/>',layers:'<path d="M12 3 2 8l10 5 10-5-10-5ZM2 13l10 5 10-5M2 17.5 12 22l10-4.5"/>',map:'<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14"/>',rotate:'<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',line:'<circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="6" r="2.5"/><path d="M7 16.5 11 12h4l2.2-4"/>',station:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>',menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',dezone:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8l8 8M16 8l-8 8"/>'};function ot(s,e=20,t=2){return`<svg width="${e}" height="${e}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${t}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${rx[s]||""}</svg>`}function Ea(s=34,e="#f6f2ea"){return`<svg width="${s}" height="${s}" viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M5 22h7l3-9 5 16 4-11 2 4h9" stroke="${e}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="35" cy="22" r="3" fill="#e8543f"/></svg>`}function xu(s,e,t={}){let n=Math.min(2,window.devicePixelRatio||1),i=s.clientWidth||300,r=s.clientHeight||120;s.width=i*n,s.height=r*n;let a=s.getContext("2d");a.scale(n,n),a.clearRect(0,0,i,r);let o=t.color||"#2f8fe0",l="#7a8294",c=44,h=8,u=10,d=18;if(!e.length){a.fillStyle=l,a.font="12px Barlow, sans-serif",a.fillText("Noch keine Daten \u2013 ein Spieltag vergeht in 30 Sekunden.",8,r/2);return}let p=Math.min(...e),g=Math.max(...e);t.zero&&(p=Math.min(0,p)),g-p<1e-6&&(g+=1,p-=t.zero?0:1);let x=g-p,m=T=>c+(e.length===1?i-c-h:T/(e.length-1)*(i-c-h)),f=T=>u+(1-(T-p)/x)*(r-u-d);a.strokeStyle="rgba(29,35,48,0.08)",a.lineWidth=1,a.fillStyle=l,a.font='600 11px "Barlow Condensed", Barlow, sans-serif',a.textAlign="right";for(let T=0;T<=3;T++){let E=p+x*T/3,b=f(E);a.beginPath(),a.moveTo(c,b),a.lineTo(i-h,b),a.stroke(),a.fillText(t.fmt?t.fmt(E):Math.round(E).toLocaleString("de-DE"),c-6,b+4)}t.zero&&p<0&&(a.strokeStyle="rgba(29,35,48,0.35)",a.beginPath(),a.moveTo(c,f(0)),a.lineTo(i-h,f(0)),a.stroke()),a.textAlign="left",a.fillText(t.startLabel||"",c,r-4),a.textAlign="right",a.fillText(t.endLabel||"",i-h,r-4);let y=a.createLinearGradient(0,u,0,r-d);y.addColorStop(0,o+"55"),y.addColorStop(1,o+"05"),a.beginPath(),a.moveTo(m(0),f(e[0])),e.forEach((T,E)=>a.lineTo(m(E),f(T))),a.lineTo(m(e.length-1),r-d),a.lineTo(m(0),r-d),a.closePath(),a.fillStyle=y,a.fill(),a.beginPath(),e.forEach((T,E)=>E?a.lineTo(m(E),f(T)):a.moveTo(m(E),f(T))),a.strokeStyle=o,a.lineWidth=2.2,a.lineJoin="round",a.stroke();let v=m(e.length-1),M=f(e[e.length-1]);a.fillStyle="#f6f2ea",a.beginPath(),a.arc(v,M,4.5,0,Math.PI*2),a.fill(),a.strokeStyle=o,a.lineWidth=2.5,a.stroke()}var $n=s=>"#"+s.toString(16).padStart(6,"0"),et=s=>String(s).replace(/[&<>"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[e]),ax={roads:"roads",zones:"zones",power:"power",water:"water",garbage:"garbage",services:"services",education:"education",parks:"parks",transit:"transit",landmarks:"landmarks"},vu={roads:"#5d6470",zones:"#4fae67",power:"#f2b01e",water:"#2f8fe0",garbage:"#a07a4a",services:"#e8543f",education:"#8f5ad8",parks:"#22a866",transit:"#e8543f",landmarks:"#c06a2b"},ox={none:"eye",power:"power",water:"water",garbage:"garbage",health:"cross",police:"shield",fire:"flame",edu:"book",landValue:"coin",pollution:"smoke",noise:"sound",crime:"mask",happiness:"heart",traffic:"car",transit:"line",resources:"map"},lx={power:"Gr\xFCn: versorgt. Rot: kein Strom. Strom flie\xDFt durch die Leitungen unter den Stra\xDFen \u2013 jedes zusammenh\xE4ngende Stra\xDFennetz ist ein eigenes Stromnetz.",water:"Blau: versorgt. Rot: kein Wasser. Pumpwerke brauchen Strom und m\xFCssen am Ufer stehen.",garbage:"Wie gut die M\xFCllabfuhr die Gegend erreicht. Jede Anlage hat eine begrenzte Kapazit\xE4t.",health:"Abdeckung durch Arztpraxen und Krankenh\xE4user.",police:"Abdeckung durch Polizeiwachen.",fire:"Abdeckung durch die Feuerwehr. Ohne Feuerwehr brennen Geb\xE4ude ab.",edu:"Bildungsniveau, das hier erreichbar ist. Hohe Stufen brauchen gebildete Bewohner.",landValue:"Bodenwert l\xE4sst Geb\xE4ude wachsen: Parks, Wasser, Dienste und die Pulsbahn heben ihn, L\xE4rm und Abgase senken ihn.",pollution:"Abgase von Industrie, Kraftwerken und Verkehr. Senkt Gl\xFCck und Bodenwert.",noise:"L\xE4rm von Stra\xDFen, Industrie und Stadien.",crime:"Kriminalit\xE4t steigt mit Arbeitslosigkeit und Unzufriedenheit.",happiness:"Gr\xFCn: gl\xFCcklich. Rot: ungl\xFCcklich. Klicke ein Geb\xE4ude an, um die Gr\xFCnde zu sehen.",traffic:"Gr\xFCn: freie Fahrt. Rot: Stau. Alleen haben die doppelte Kapazit\xE4t, die Pulsbahn nimmt Autos von der Stra\xDFe.",transit:"Einzugsgebiet der Pulsbahn-Stationen mit Zugverkehr.",resources:"Gr\xFCn: fruchtbarer Boden (Bauernh\xF6fe). Braun: Erz (Bergwerke). Industrie dort spezialisiert sich."},cx={1:["","H\xE4uschen","Einfamilienhaus","Stadthaus","Wohnblock","Wohnturm"],2:["","Kiosk","Ladenzeile","Kaufhaus","Gesch\xE4ftshaus","Einkaufsturm"],3:["","Werkstatt","Fabrik","Werk","Gro\xDFwerk","Hightech-Werk"],4:["","Kanzlei","B\xFCrohaus","B\xFCrokomplex","B\xFCroturm","Wolkenkratzer"]},yu=["#e8543f","#2f8fe0","#f2b01e","#22a866","#8f5ad8","#f06fae","#10a9a3","#ff8a1f"],Ta=class{constructor(e){this.app=e,this.g=e.game,this.root=document.getElementById("hud"),this.tip=document.getElementById("tooltip"),this.toasts=document.getElementById("toasts"),this.modalRoot=document.getElementById("modal-root"),this.cat=null,this.panel=null,this.sel=null,this.view="none",this.timer=0,this.panelTimer=0,this.newsSeen=this.g.newsLog.length,this.chartKey="pop",this.tutorialHidden=!!e.settings.tutorialDone,this.modalQueue=[],this.mount(),this.bindGame()}mount(){let e=this.root;e.hidden=!1,e.innerHTML=`
<div class="topbar">
  <div class="sign cityplate">
    <div class="logo">${Ea(24)}</div>
    <div style="min-width:0">
      <div class="name" id="u-name"></div>
      <div class="rank" id="u-rank"></div>
      <div class="rankbar"><i id="u-rankbar"></i></div>
    </div>
  </div>
  <div class="sign stats">
    <div class="stat"><span class="k">Einwohner</span><span class="v" id="u-pop">0</span><span class="d" id="u-popd"></span></div>
    <div class="stat"><span class="k">Kasse</span><span class="v" id="u-money"></span><span class="d" id="u-net"></span></div>
    <div class="stat opt"><span class="k">Gl\xFCck</span><span class="v" id="u-happy"></span><span class="d" id="u-happyd"></span></div>
    <div class="stat opt opt-wide"><span class="k">Arbeitslos</span><span class="v" id="u-unemp"></span><span class="d" id="u-jobs"></span></div>
    <div class="stat opt opt-wide"><span class="k">Pulsbahn</span><span class="v" id="u-riders"></span><span class="d" id="u-flow"></span></div>
  </div>
  <div class="sign demand" title="Nachfrage: Wohnen, Gewerbe, Industrie, B\xFCro">
    ${[1,2,3,4].map(n=>`<div class="col"><div class="bar"><i id="u-dem${n}" style="background:${$n(Et[n].color)}"></i></div><div class="lbl" style="color:${$n(Et[n].color)}">${Et[n].short}</div></div>`).join("")}
  </div>
  <div class="spacer"></div>
  <div class="sign clock">
    <div class="when"><span class="time num" id="u-time"></span><span class="date" id="u-date"></span></div>
    <div class="speed" id="u-speed">
      <button data-speed="0" title="Pause (Leertaste)">${ot("pause",16,2.4)}</button>
      <button data-speed="1" title="Normal (1)">${ot("play",15,2.2)}</button>
      <button data-speed="2" title="Schnell (2)">${ot("fast",17,2)}</button>
      <button data-speed="3" title="Sehr schnell (3)">${ot("faster",19,1.8)}</button>
    </div>
  </div>
  <div class="sign menubtns" id="u-menu">
    <button data-panel="budget" title="Haushalt">${ot("budget")}</button>
    <button data-panel="stats" title="Statistik">${ot("stats")}</button>
    <button data-panel="policies" title="Verordnungen">${ot("policies")}</button>
    <button data-panel="transit" title="Pulsbahn">${ot("transit")}</button>
    <button data-panel="news" title="Stadtfunk">${ot("news")}<span class="dot" id="u-newsdot" hidden></span></button>
    <button data-panel="settings" title="Optionen, Hilfe, Speichern">${ot("settings")}</button>
  </div>
</div>
<div class="ticker" id="u-ticker" hidden><span class="pip" id="u-tickpip"></span><span class="who" id="u-tickwho"></span><span class="txt" id="u-ticktxt"></span></div>
<div class="sign views" id="u-views">
  ${Os.map((n,i)=>`${i===1||i===13?'<div class="sep"></div>':""}<button data-view="${n.id}" title="${n.name}">${ot(ox[n.id]||"eye",19)}</button>`).join("")}
</div>
<div class="sign legend" id="u-legend" hidden></div>
<div class="sign tutorial" id="u-tutorial" hidden></div>
<div class="sign tray" id="u-tray" hidden></div>
<div class="sign toolbar">
  <div class="track" id="u-cats">
    <div class="rail"></div>
    <button class="cat" data-tool="select" title="Ausw\xE4hlen (Esc)"><span class="stop">${ot("select",20)}</span><span class="lbl">Info</span></button>
    ${Hl.map(n=>`<button class="cat" data-cat="${n.id}"><span class="stop">${ot(ax[n.id],21)}</span><span class="lbl">${n.name}</span></button>`).join("")}
    <button class="cat danger" data-tool="bulldoze" title="Abrei\xDFen (B)"><span class="stop">${ot("bulldoze",21)}</span><span class="lbl">Abriss</span></button>
  </div>
</div>
<div class="sign panel" id="u-panel" hidden></div>
<div class="sign inspector" id="u-insp" hidden></div>
`;let t=n=>document.getElementById(n);this.el={};for(let n of["name","rank","rankbar","pop","popd","money","net","happy","happyd","unemp","jobs","riders","flow","date","time","speed","menu","ticker","tickpip","tickwho","ticktxt","views","legend","tutorial","tray","cats","panel","insp","newsdot","dem1","dem2","dem3","dem4"])this.el[n]=t("u-"+n);this.el.name.textContent=this.g.name,this.el.speed.addEventListener("click",n=>{let i=n.target.closest("button[data-speed]");i&&this.setSpeed(+i.dataset.speed)}),this.el.menu.addEventListener("click",n=>{let i=n.target.closest("button[data-panel]");i&&(this.app.audio.play("click"),this.togglePanel(i.dataset.panel))}),this.el.views.addEventListener("click",n=>{let i=n.target.closest("button[data-view]");i&&(this.app.audio.play("click"),this.setView(this.view===i.dataset.view?"none":i.dataset.view))}),this.el.cats.addEventListener("click",n=>{let i=n.target.closest("button");i&&(this.app.audio.play("click"),i.dataset.tool?(this.closeTray(),this.app.input.setTool({kind:i.dataset.tool})):i.dataset.cat&&(this.cat===i.dataset.cat?this.closeTray():this.openTray(i.dataset.cat)))}),this.el.tray.addEventListener("click",n=>{let i=n.target.closest("button.item");i&&(this.app.audio.play("click"),this.pickItem(i.dataset))}),this.el.ticker.addEventListener("click",()=>this.openPanel("news")),this.el.panel.addEventListener("pointerdown",()=>{this.panelBusy=!0}),window.addEventListener("pointerup",()=>{this.panelBusy=!1}),this.el.panel.addEventListener("click",n=>this.panelClick(n)),this.el.panel.addEventListener("input",n=>this.panelInput(n)),this.el.panel.addEventListener("change",n=>this.panelChange(n)),this.el.insp.addEventListener("click",n=>this.inspClick(n)),this.el.tutorial.addEventListener("click",n=>{n.target.closest("[data-act=hidetut]")&&(this.tutorialHidden=!0,this.app.settings.tutorialDone=!0,this.app.saveSettings(),this.el.tutorial.hidden=!0)}),this.onKey=n=>{n.target&&(n.target.tagName==="INPUT"||n.target.tagName==="TEXTAREA"||n.target.tagName==="SELECT")||this.modalOpen()||(n.code==="Space"?(n.preventDefault(),this.setSpeed(this.g.speed===0?this.lastSpeed||1:0)):n.code==="Digit1"?this.setSpeed(1):n.code==="Digit2"?this.setSpeed(2):n.code==="Digit3"?this.setSpeed(3):n.code==="KeyM"?(this.app.settings.muted=!this.app.settings.muted,this.app.audio.applyVolumes(),this.app.saveSettings(),this.toast(this.app.settings.muted?"Ton aus":"Ton an")):n.code==="KeyI"?this.app.engine.effects.showIcons=!this.app.engine.effects.showIcons:(n.ctrlKey||n.metaKey)&&n.code==="KeyS"&&(n.preventDefault(),this.app.save(1),this.toast("Gespeichert in Platz 1.","good")))},window.addEventListener("keydown",this.onKey),this.refreshSpeed(),this.refreshHUD(),this.refreshTutorial()}dispose(){window.removeEventListener("keydown",this.onKey);for(let e of this.unbind||[])e();this.root.innerHTML="",this.root.hidden=!0,this.modalRoot.innerHTML="",this.tooltip(null)}bindGame(){let e=this.g;this.unbind=[e.on("news",t=>this.onNews(t)),e.on("milestone",t=>this.queueModal(()=>this.showMilestone(t))),e.on("cards",t=>this.queueModal(()=>this.showCards(t))),e.on("event",t=>this.queueModal(()=>this.showEvent(t))),e.on("bankrupt",()=>this.queueModal(()=>this.showBankrupt())),e.on("day",()=>{this.panel&&this.renderPanel()})]}setSpeed(e){e>0&&(this.lastSpeed=e),this.g.speed=e,this.refreshSpeed()}refreshSpeed(){for(let e of this.el.speed.querySelectorAll("button"))e.classList.toggle("on",+e.dataset.speed===this.g.speed)}openTray(e){this.cat=e;for(let t of this.el.cats.querySelectorAll(".cat"))t.classList.toggle("on",t.dataset.cat===e);this.renderTray(),this.el.tray.hidden=!1,this.el.tutorial.hidden=!0}closeTray(){this.cat=null,this.el.tray.hidden=!0;for(let e of this.el.cats.querySelectorAll(".cat"))e.classList.toggle("on",!1);this.markToolButtons()}trayItems(e){let t=this.g,n=[];if(e==="roads")for(let i of[Je.LANE,Je.STREET,Je.AVENUE]){let r=wt[i],a=i===Je.AVENUE&&!t.isUnlocked("avenue")?t.lockReason("zone4"):null;n.push({kind:"road",type:i,name:r.name,cost:`${Xe(r.cost*t.costMul)} / Feld`,desc:r.desc,color:"#5d6470",locked:a})}else if(e==="zones"){for(let i of[1,2,3,4]){let r=i===4&&!t.isUnlocked("zone4")?t.lockReason("zone4"):null,a={1:"Hier ziehen Menschen ein. Braucht Strom, Wasser und Jobs in der N\xE4he.",2:"L\xE4den und Kaufh\xE4user. Leben von Kundschaft und Waren.",3:"Fabriken schaffen Jobs, machen aber Abgase. Auf Erz oder fruchtbarem Boden entstehen Bergwerke und H\xF6fe.",4:"Saubere B\xFCros f\xFCr gebildete Arbeitskr\xE4fte."}[i];n.push({kind:"zone",zone:i,name:Et[i].name,cost:`${Xe(2*t.costMul)} / Feld`,desc:a,color:$n(Et[i].color),locked:r})}n.push({kind:"dezone",name:"Zonen entfernen",cost:"kostenlos",desc:"Entfernt Zonen von unbebauten Feldern.",color:"#9a9a9a"})}else if(e==="transit"){let i=t.isUnlocked("transit")?null:t.lockReason("station");n.push({kind:"line",name:"Linie zeichnen",cost:`ab ${Xe(Ie.lineCost*t.costMul)}`,desc:"Stationen nacheinander anklicken \u2013 leere Felder bekommen automatisch eine Station. Rechtsklick oder Enter beendet.",color:"#e8543f",locked:i}),n.push({kind:"place",key:"station",name:nt.station.name,cost:Xe(t.buildingCost("station")),desc:nt.station.desc,color:"#e8543f",locked:i}),n.push({kind:"panel",panel:"transit",name:"Linien verwalten",cost:`${t.transit.lines.length} / ${t.transit.linesMax} Linien`,desc:"Z\xFCge und Waggons einsetzen, Linien verl\xE4ngern.",color:"#2f8fe0",locked:i})}else for(let[i,r]of Object.entries(nt)){if(r.cat!==e||i==="station")continue;let a=t.isUnlocked(i)?r.unique&&t.hasBuilt(i)?"Schon gebaut":null:t.lockReason(i),o=r.desc,l=[];r.power&&l.push(`${r.power} MW`),r.water&&l.push(`${r.water} m\xB3`),r.service&&l.push(`Radius ${r.service.radius}`),r.upkeep&&l.push(`${Xe(r.upkeep*t.upkeepMul())}/Tag`),n.push({kind:"place",key:i,name:r.name,cost:Xe(t.buildingCost(i)),desc:o,facts:l.join(" \xB7 "),color:vu[e],locked:a,tag:r.landmark&&t.landmarkVouchers.has(i)?"\u221250 %":""})}return n}renderTray(){let e=this.trayItems(this.cat),t=this.app.input.tool;this.el.tray.innerHTML=e.map((n,i)=>`<button class="item${n.kind===t.kind&&(n.kind==="road"&&t.type===n.type||n.kind==="zone"&&t.zone===n.zone||n.kind==="place"&&t.key===n.key||n.kind==="dezone"||n.kind==="line")?" on":""}${n.locked?" locked":""}" data-i="${i}" data-kind="${n.kind}" data-type="${n.type||""}" data-zone="${n.zone||""}" data-key="${n.key||""}" data-panel="${n.panel||""}" ${n.locked?'data-locked="1"':""} title="${et(n.desc)}">
        ${n.tag?`<span class="tag">${n.tag}</span>`:""}
        <span class="sw" style="background:${n.color}"></span>
        <span class="n">${et(n.name)}</span>
        <span class="c">${n.cost}</span>
        ${n.locked?`<span class="lock">${et(n.locked)}</span>`:`<span class="x">${et(n.facts||n.desc).slice(0,90)}</span>`}
      </button>`).join("")}pickItem(e){if(e.locked){this.toast("Noch nicht freigeschaltet.","bad");return}let t=this.app.input;e.kind==="road"?t.setTool({kind:"road",type:+e.type}):e.kind==="zone"?t.setTool({kind:"zone",zone:+e.zone}):e.kind==="dezone"?t.setTool({kind:"dezone"}):e.kind==="place"?t.setTool({kind:"place",key:e.key}):e.kind==="line"?t.setTool({kind:"line"}):e.kind==="panel"&&this.openPanel(e.panel),this.renderTray()}toolChanged(e){e.kind==="select"&&this.cat&&this.closeTray(),this.cat&&this.renderTray(),this.markToolButtons(),e.kind==="line"&&this.view==="none"&&this.setView("transit",!0),e.kind!=="line"&&e.kind!=="extend"&&this.autoTransitView&&this.setView("none")}markToolButtons(){let e=this.app.input?this.app.input.tool.kind:"select";for(let t of this.el.cats.querySelectorAll(".cat[data-tool]"))t.classList.toggle("on",t.dataset.tool===e&&!this.cat)}setView(e,t=!1){this.view=e,this.autoTransitView=t,this.app.engine.overlay.setMode(e);for(let l of this.el.views.querySelectorAll("button"))l.classList.toggle("on",l.dataset.view===e);let n=Os.find(l=>l.id===e);if(e==="none"||!n){this.el.legend.hidden=!0;return}let i=n.bad,r=e==="resources"?"linear-gradient(90deg,#78be46,#966e5a)":`linear-gradient(90deg, ${i?"#45c46b, #f2c230, #e5483c":"#e5483c, #f2c230, #45c46b"})`,a=e==="resources"?["fruchtbar","Erz"]:i?["gering","hoch"]:e==="traffic"?["frei","Stau"]:["schlecht","gut"],o=e==="traffic"?"linear-gradient(90deg,#45c46b,#f2c230,#e5483c)":r;this.el.legend.innerHTML=`<h4>${n.name}</h4><div class="ramp" style="background:${o}"></div><div class="ends"><span>${a[0]}</span><span>${a[1]}</span></div><p>${lx[e]||""}</p>`,this.el.legend.hidden=!1}refreshHUD(){let e=this.g,t=e.stats,n=zt[e.milestone],i=zt[e.milestone+1];this.el.rank.textContent=i?`${n.name} \u2192 ${i.name} (${$e(i.pop)})`:n.name,this.el.rankbar.style.width=i?`${ve((t.pop-n.pop)/(i.pop-n.pop),0,1)*100}%`:"100%",this.el.pop.textContent=$e(t.pop);let r=e.history,a=r.length>=2?r[r.length-2].pop:0,o=r.length?r[r.length-1].pop-a:0;this.el.popd.textContent=r.length>=2?`${o>=0?"+":"\u2212"}${$e(Math.abs(o))} / Tag`:"",this.el.popd.className="d "+(o>=0?"pos":"neg"),this.el.money.textContent=e.sandbox?"\u221E":(Math.abs(e.money)>=1e6?Ba(e.money):$e(e.money))+" \u20AC",this.el.money.className="v"+(e.money<0?" neg":"");let l=e.lastBudget?e.lastBudget.net:0;this.el.net.textContent=`${l>=0?"+":"\u2212"}${$e(Math.abs(l))} \u20AC / Tag`,this.el.net.className="d "+(l>=0?"pos":"neg"),this.el.happy.textContent=`${Math.round(t.happiness)} %`;let c=t.happiness;this.el.happyd.textContent=c>=75?"begeistert":c>=60?"zufrieden":c>=45?"durchwachsen":c>=30?"unzufrieden":"w\xFCtend",this.el.happyd.className="d "+(c>=50?"pos":"neg"),this.el.unemp.textContent=`${Math.round(t.unemployment*100)} %`,this.el.jobs.textContent=`${$e(t.jobs)} Jobs`,this.el.riders.textContent=$e(t.ridersToday||0),this.el.flow.textContent=`Verkehr ${Math.round((t.trafficFlow||1)*100)} %`,this.el.date.textContent=e.dateText(),this.el.time.textContent=e.clockText();for(let h=1;h<=4;h++){let u=e.demand[h],d=this.el["dem"+h],p=Math.min(50,Math.abs(u)/2);d.style.height=p+"%",d.style.bottom=u>=0?"50%":`${50-p}%`,d.style.opacity=u>=0?1:.45}}refreshTutorial(){let e=this.g;if(this.tutorialHidden||e.sandbox||this.cat||this.panel){this.el.tutorial.hidden=!0;return}let t=0;for(let l=0;l<e.N;l++)e.road[l]&&e.road[l]!==Je.HIGHWAY&&t++;let n=0,i=0;for(let l=0;l<e.N;l++)e.zone[l]===1?n++:(e.zone[l]===2||e.zone[l]===3)&&i++;let r=l=>e.countBuilt(l)>0,a=[[t>0,"Ziehe eine Stra\xDFe vom Ende der Autobahn ins Land (Stra\xDFen \u2192 Stra\xDFe)."],[n>0||e.stats.countByZone[1]>0,"Weise entlang der Stra\xDFe Wohngebiet aus (Zonen \u2192 Wohnen)."],[i>0||e.stats.countByZone[2]+e.stats.countByZone[3]>0,"Gewerbe und Industrie schaffen Jobs \u2013 mit etwas Abstand zum Wohnen."],[r("power"),"Baue ein Kraftwerk an einer Stra\xDFe. Strom flie\xDFt durchs Stra\xDFennetz."],[r("water"),"Sorge f\xFCr Wasser: Wasserturm oder Pumpwerk am Ufer."],[r("garbage"),"Eine Deponie h\xE4lt die Stra\xDFen sauber."],[e.milestone>=1,`Erreiche ${zt[1].pop} Einwohner. Danach gibt es jede Woche eine Wochenkarte.`],[e.transit.lines.length>0,'Ab \u201EKleinstadt": Zeichne die erste Pulsbahn-Linie zwischen Wohnen und Arbeit.']],o=a.findIndex(l=>!l[0]);if(o<0){this.el.tutorial.hidden=!0;return}this.el.tutorial.hidden=!1,this.el.tutorial.innerHTML=`<h4><span>Erste Schritte</span><button class="close" data-act="hidetut" title="Ausblenden">${ot("close",16)}</button></h4><ol>${a.map((l,c)=>`<li class="${l[0]?"done":c===o?"now":""}">${l[1]}</li>`).join("")}</ol>`}onNews(e){this.el.ticker.hidden=!1,this.el.tickwho.textContent=e.author,this.el.ticktxt.textContent=e.text,this.el.tickpip.style.background=e.mood==="bad"?"var(--bad)":e.mood==="good"?"var(--good)":"var(--l-blue)",this.panel!=="news"?this.el.newsdot.hidden=!1:this.renderPanel(),e.kind!=="chatter"&&e.kind!=="report"&&e.kind!=="card"&&(this.toast(e.text,e.mood==="bad"?"bad":e.mood==="good"?"good":""),e.mood==="bad"&&this.app.audio.play("bad"))}tooltip(e,t,n=!0){if(!e||!t){this.tip.hidden=!0;return}this.tip.hidden=!1,this.tip.textContent=e,this.tip.className=n?"":"bad";let i=this.tip.offsetWidth,r=Math.min(t.x,window.innerWidth-i-24);this.tip.style.left=r+"px",this.tip.style.top=t.y+"px"}toast(e,t=""){let n=document.createElement("div");for(n.className="toast "+t,n.textContent=e,this.toasts.appendChild(n);this.toasts.children.length>4;)this.toasts.firstChild.remove();setTimeout(()=>{n.style.transition="opacity 0.4s",n.style.opacity="0",setTimeout(()=>n.remove(),400)},3200)}floatMoney(e,t){if(!t||!e||this.g.sandbox)return;let n=document.createElement("div");n.className="float-money"+(e>0?" pos":""),n.textContent=(e>0?"+":"\u2212")+Xe(Math.abs(e)).replace("\u2212",""),n.style.left=t.x+12+"px",n.style.top=t.y-10+"px",document.body.appendChild(n),setTimeout(()=>n.remove(),1300)}togglePanel(e){this.panel===e?this.closePanels():this.openPanel(e)}openPanel(e){this.panel=e;for(let t of this.el.menu.querySelectorAll("button"))t.classList.toggle("on",t.dataset.panel===e);e==="news"&&(this.el.newsdot.hidden=!0),this.el.panel.hidden=!1,this.el.insp.hidden=!0,this.sel=null,this.app.engine.overlay.select(null),this.renderPanel()}closePanels(){this.panel=null,this.el.panel.hidden=!0;for(let e of this.el.menu.querySelectorAll("button"))e.classList.remove("on");this.closeInspector()}renderPanel(){if(!this.panel)return;let e={budget:this.pBudget,stats:this.pStats,policies:this.pPolicies,transit:this.pTransit,news:this.pNews,settings:this.pSettings}[this.panel],t={budget:"Haushalt",stats:"Statistik",policies:"Verordnungen",transit:"Pulsbahn",news:"Stadtfunk",settings:"Optionen & Hilfe"},n=e.call(this),i=this.el.panel.querySelector(".body")?.scrollTop||0;this.el.panel.innerHTML=`<header><h2>${t[this.panel]}</h2><button class="close" data-act="close">${ot("close",18)}</button></header><div class="body">${n}</div>`,this.el.panel.querySelector(".body").scrollTop=i,this.panel==="stats"&&this.drawCharts()}pBudget(){let e=this.g,t=e.budget(),n=(o,l,c)=>`<div class="row"><span class="grow">${o}</span><span class="val ${c?"neg":""}">${c?"\u2212":""}${Xe(l)}</span></div>`,i=[1,2,3,4].map(o=>`<div class="slider"><label><span class="zdot" style="background:${$n(Et[o].color)}"></span> ${Et[o].name}</label><input type="range" min="0" max="25" step="1" value="${e.taxes[o]}" data-tax="${o}" id="tax-${o}"><span class="val num">${e.taxes[o]} %</span></div>`).join(""),r=e.loans.map((o,l)=>`<div class="row"><span class="grow">${Xe(o.amount)} \xB7 noch ${o.weeksLeft} Wochen<br><span style="font-size:12px;color:var(--ink-3)">Tilgung ${Xe(o.amount/o.weeks)} + Zinsen ${Xe(o.weekly)} pro Woche</span></span><button class="btn small ghost" data-act="repay" data-i="${l}">Abl\xF6sen</button></div>`).join(""),a=Xs.map((o,l)=>`<div class="row"><span class="grow">${Xe(o.amount)} \xFCber ${o.weeks} Wochen \xB7 ${(o.rate*100).toFixed(1).replace(".",",")} % Zins/Woche</span><button class="btn small" data-act="loan" data-i="${l}" ${e.loans.length>=3||!e.isUnlocked("loans")?"disabled":""}>Aufnehmen</button></div>`).join("");return`
<div class="sec"><h3>Bilanz pro Tag</h3>
  <div class="row"><span class="grow" style="font-weight:700">Saldo</span><span class="val ${t.net<0?"neg":"pos"}" style="font-size:20px">${t.net>=0?"+":"\u2212"}${Xe(Math.abs(t.net))}</span></div>
</div>
<div class="sec"><h3>Einnahmen \xB7 ${Xe(t.income)}</h3>
  ${n("Steuern Wohnen",t.inc.res)}${n("Steuern Gewerbe",t.inc.com)}${n("Steuern Industrie",t.inc.ind)}${n("Steuern B\xFCro",t.inc.off)}${n("Tourismus",t.inc.tourism)}${n("Pulsbahn-Tickets",t.inc.fares)}
</div>
<div class="sec"><h3>Ausgaben \xB7 ${Xe(t.expense)}</h3>
  ${n("Dienste & Versorgung",t.exp.services,!0)}${n("Stra\xDFenunterhalt",t.exp.roads,!0)}${n("Pulsbahn",t.exp.transit,!0)}${n("Verordnungen",t.exp.policies,!0)}${n("Kreditzinsen",t.exp.loans,!0)}
</div>
<div class="sec"><h3>Steuers\xE4tze</h3>${i}<p style="font-size:12.5px;color:var(--ink-3);margin:6px 0 0">\xDCber 10 % sinken Nachfrage und Gl\xFCck sp\xFCrbar.</p></div>
<div class="sec"><h3>Kredite</h3>${r||'<p style="color:var(--ink-3);margin:0 0 6px">Keine laufenden Kredite.</p>'}<div class="rule"></div>${e.isUnlocked("loans")?a:`<p style="color:var(--ink-3);margin:0">${e.lockReason("zone4")}</p>`}</div>`}pStats(){let e=this.g,t=e.stats,n=e.util,i=[["pop","Einwohner"],["money","Kasse"],["net","Saldo"],["happy","Gl\xFCck"],["riders","Fahrg\xE4ste"],["flow","Verkehrsfluss"]],r=(o,l,c)=>`<div class="meter"><i style="width:${ve(o/Math.max(1,l),0,1)*100}%;background:${c}"></i></div>`,a=t.countByZone;return`
<div class="sec"><h3>Verlauf</h3>
  <div class="chart-tabs">${i.map(([o,l])=>`<button data-act="chart" data-k="${o}" class="${this.chartKey===o?"on":""}">${l}</button>`).join("")}</div>
  <canvas class="chart" id="chart-main"></canvas>
</div>
<div class="sec"><h3>Versorgung</h3>
  <div class="kv"><span>Strom ${$e(n.powerDemand)} / ${$e(n.powerSupply)} MW</span><span class="v ${n.powerDemand>n.powerSupply?"neg":""}">${n.powerSupply?Math.round(n.powerDemand/n.powerSupply*100):0} %</span></div>
  ${r(n.powerDemand,n.powerSupply,n.powerDemand>n.powerSupply?"var(--bad)":"var(--l-yellow)")}
  <div class="kv" style="margin-top:8px"><span>Wasser ${$e(n.waterDemand)} / ${$e(n.waterSupply)} m\xB3</span><span class="v ${n.waterDemand>n.waterSupply?"neg":""}">${n.waterSupply?Math.round(n.waterDemand/n.waterSupply*100):0} %</span></div>
  ${r(n.waterDemand,n.waterSupply,n.waterDemand>n.waterSupply?"var(--bad)":"var(--l-blue)")}
</div>
<div class="sec"><h3>Bev\xF6lkerung & Arbeit</h3>
  <div class="kv">
    <span>Einwohner</span><span class="v">${$e(t.pop)}</span>
    <span>Arbeitskr\xE4fte</span><span class="v">${$e(t.workers)}</span>
    <span>Arbeitspl\xE4tze (G / I / B)</span><span class="v">${$e(t.jobsByZone[2])} / ${$e(t.jobsByZone[3])} / ${$e(t.jobsByZone[4])}</span>
    <span>Arbeitslosigkeit</span><span class="v">${Math.round(t.unemployment*100)} %</span>
    <span>Bildung (\xD8)</span><span class="v">${Math.round(t.edu*100)} %</span>
    <span>Touristen pro Tag</span><span class="v">${$e(t.tourism)}</span>
  </div>
</div>
<div class="sec"><h3>Geb\xE4ude</h3>
  <div class="kv">
    ${[1,2,3,4].map(o=>`<span><span class="zdot" style="background:${$n(Et[o].color)}"></span> ${Et[o].name}</span><span class="v">${$e(a[o])}</span>`).join("")}
    <span>Verlassen</span><span class="v ${t.abandoned?"neg":""}">${$e(t.abandoned)}</span>
    <span>Ohne Strom / Wasser</span><span class="v ${t.unpowered+t.unwatered?"neg":""}">${$e(t.unpowered)} / ${$e(t.unwatered)}</span>
  </div>
</div>
<div class="sec"><h3>Aktive Effekte</h3>${e.effects.length?e.effects.map(o=>`<div class="row"><span class="grow">${et(o.label)}</span><span class="val">noch ${Math.max(1,Math.ceil((o.until-e.time)/1440))} T.</span></div>`).join(""):'<p style="color:var(--ink-3);margin:0">Keine.</p>'}</div>`}drawCharts(){let e=document.getElementById("chart-main");if(!e)return;let t=this.g.history,n=this.chartKey,i=t.map(a=>a[n]??0),r={pop:"#4fae67",money:"#c98a0c",net:"#2f8fe0",happy:"#f06fae",riders:"#e8543f",flow:"#5d6470"}[n];xu(e,i,{color:r,zero:n==="net"||n==="money",startLabel:t.length?`Tag ${t[0].d}`:"",endLabel:t.length?`Tag ${t[t.length-1].d}`:"",fmt:a=>(Math.abs(a)>=1e4?Ba(a):Math.round(a).toLocaleString("de-DE"))+(n==="happy"||n==="flow"?" %":"")})}pPolicies(){let e=this.g;return'<p style="margin:0 0 10px;color:var(--ink-2);line-height:1.45">Verordnungen gelten f\xFCr die ganze Stadt. Die Kosten steigen mit der Einwohnerzahl.</p>'+Pi.map(t=>{let n=!e.sandbox&&e.milestone<t.unlock,i=e.policies.has(t.id),r=t.cost*(e.stats.pop/100);return`<div class="toggle${n?" locked":""}"><button class="switch${i?" on":""}" data-act="policy" data-id="${t.id}" ${n?"disabled":""} aria-label="${et(t.name)}"></button><div class="grow"><div class="t">${et(t.name)}</div><div class="s">${et(t.desc)} ${t.cost?`\xB7 ${Xe(r)}/Tag`:"\xB7 kostenlos"}${n?` \xB7 ab \u201E${zt[t.unlock].name}"`:""}</div></div></div>`}).join("")}pTransit(){let e=this.g,t=e.transit;if(!e.isUnlocked("transit"))return`<p style="line-height:1.5;color:var(--ink-2)">Die <b>Pulsbahn</b> ist eine Hochbahn, die \xFCber den D\xE4chern f\xE4hrt. Sie wird ab \u201E${zt[2].name}" (${$e(zt[2].pop)} Einwohner) freigeschaltet.</p>
<p style="line-height:1.5;color:var(--ink-2)">Fahrg\xE4ste warten an den Stationen. Ihre Form zeigt das Ziel: <b>\u25CF</b> nach Hause, <b>\u25B2</b> zum Einkaufen, <b>\u25A0</b> in die Industrie, <b>\u25C6</b> ins B\xFCro. Ist eine Station zu lange \xFCberf\xFCllt, geben die Leute auf und die Gegend wird unzufrieden.</p>`;let n=t.lines.map(i=>{let r=t.trains.filter(u=>u.line===i.id),a=r.reduce((u,d)=>u+d.wagons,0),o=r.reduce((u,d)=>u+d.pax.length,0),l=r.reduce((u,d)=>u+t.trainCapacity(d),0),c=$n(rn[i.color]),h=i.stops.map(u=>t.stations.get(u)).filter(Boolean);return`<div class="line-card">
  <div class="hd"><span class="badge" style="background:${c}">${i.id}</span><div class="grow"><div class="ttl">Linie ${Ka[i.color]}${i.loop?" \xB7 Ring":""}</div><div class="sub">${h.length} Stationen \xB7 ${i.length.toFixed(0)} Felder \xB7 gestern ${$e(i.riders)} Fahrg\xE4ste</div></div></div>
  <div class="stops" style="color:${c}">${h.map(u=>`<span style="color:var(--ink)">${et(u.name)}${u.waiting.length>10?` <b style="color:var(--bad)">(${u.waiting.length})</b>`:""}</span>`).join("")}</div>
  <div class="ctrl">
    <span>Z\xFCge: <b>${r.length}</b> \xB7 Auslastung ${l?Math.round(o/l*100):0} %</span>
    <span class="grp"><button class="mini" data-act="train-" data-l="${i.id}" ${r.length<=1?"disabled":""}>${ot("minus",14,2.6)}</button><button class="mini" data-act="train+" data-l="${i.id}" title="${t.freeTrains>0?"Aus dem Depot":Xe(Ie.trainCost*e.costMul)}">${ot("plus",14,2.6)}</button></span>
    <span>Waggons: <b>${a}</b> (+${Ie.wagonCapacity} Pl\xE4tze je Waggon)</span>
    <span class="grp"><button class="mini" data-act="wagon+" data-l="${i.id}" title="${t.freeWagons>0?"Aus dem Depot":Xe(Ie.wagonCost*e.costMul)}">${ot("plus",14,2.6)}</button></span>
  </div>
  <div class="acts">
    ${i.loop?"":`<button class="btn small ghost" data-act="extend" data-l="${i.id}" data-start="1">Anfang verl\xE4ngern</button><button class="btn small ghost" data-act="extend" data-l="${i.id}" data-start="0">Ende verl\xE4ngern</button>`}
    <button class="btn small ghost" data-act="delline" data-l="${i.id}" style="color:var(--bad)">${this.confirmDel===i.id?"Wirklich l\xF6schen?":"L\xF6schen"}</button>
  </div>
</div>`}).join("");return`
<div class="res-strip"><div><div class="k">Linien</div><div class="v">${t.lines.length} / ${t.linesMax}</div></div><div><div class="k">Z\xFCge im Depot</div><div class="v">${t.freeTrains}</div></div><div><div class="k">Waggons</div><div class="v">${t.freeWagons}</div></div></div>
<div class="acts" style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap"><button class="btn" data-act="newline" ${t.lines.length>=t.linesMax?"disabled":""}>${ot("line",16)} Neue Linie zeichnen</button><button class="btn ghost" data-act="station">${ot("station",16)} Station setzen</button></div>
${n||'<p style="color:var(--ink-2);line-height:1.5">Noch keine Linie. Klicke auf \u201ENeue Linie zeichnen" und dann nacheinander auf Felder in Wohn- und Arbeitsvierteln. Ein Klick auf die erste Station schlie\xDFt einen Ring.</p>'}
<div class="sec" style="margin-top:14px"><h3>So funktioniert es</h3><p style="font-size:13px;line-height:1.5;color:var(--ink-2);margin:0">Jede Station sammelt Fahrg\xE4ste im Umkreis von ${Ie.catchment} Feldern. Symbole \xFCber den Stationen zeigen das Ziel: \u25CF Wohnen, \u25B2 Gewerbe, \u25A0 Industrie, \u25C6 B\xFCro. Wird eine Station zu voll, l\xE4uft ein roter Ring \u2013 mehr Z\xFCge oder Waggons helfen. Unter der Trasse wachsen Geb\xE4ude h\xF6chstens bis Stufe ${Ie.maxLevelUnderTrack}.</p></div>`}pNews(){let t=[...this.g.newsLog].reverse();return t.length?t.map((n,i)=>{let r=n.author==="Stadtfunk",a=r?"SF":n.author.split(" ").map(h=>h[0]).join(""),o=r?n.mood==="bad"?"#d4433a":n.mood==="good"?"#2b9a57":"#1d2330":yu[(n.author.length+i)%yu.length],l=Math.floor(n.time/1440),c=String(Math.floor(n.time%1440/60)).padStart(2,"0");return`<div class="post"><span class="av" style="background:${o}">${et(a)}</span><div><div class="who">${et(n.author)}<span class="when">Tag ${l}, ${c} Uhr</span></div><div class="txt">${et(n.text)}</div></div></div>`}).join(""):'<p style="color:var(--ink-3)">Noch ist es ruhig in der Stadt.</p>'}pSettings(){let e=this.app.settings;return`
<div class="sec"><h3>Spielstand</h3>${[1,2,3].map(n=>{let i=this.app.slotMeta(n);return`<div class="slot"><div class="grow"><div class="t">Platz ${n}${i?": "+et(i.name):""}</div><div class="s">${i?`${$e(i.pop)} Einwohner \xB7 ${new Date(i.savedAt).toLocaleString("de-DE")}`:"leer"}</div></div><button class="btn small" data-act="save" data-k="${n}">Speichern</button>${i?`<button class="btn small ghost" data-act="load" data-k="${n}">Laden</button>`:""}</div>`}).join("")}
  <div class="acts" style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn small ghost" data-act="export">Als Datei exportieren</button><button class="btn small ghost" data-act="copy">In Zwischenablage</button><button class="btn small ghost" data-act="tomenu">Hauptmen\xFC</button></div>
  <p style="font-size:12px;color:var(--ink-3);margin:8px 0 0">Automatisch gespeichert wird jeden Spieltag.</p>
</div>
<div class="sec"><h3>Klang</h3>
  <div class="slider"><label>Gesamt</label><input type="range" min="0" max="1" step="0.05" value="${e.volume}" data-set="volume" id="set-volume"><span class="val num">${Math.round(e.volume*100)}</span></div>
  <div class="slider"><label>Musik</label><input type="range" min="0" max="1" step="0.05" value="${e.music}" data-set="music" id="set-music"><span class="val num">${Math.round(e.music*100)}</span></div>
  <div class="slider"><label>Effekte</label><input type="range" min="0" max="1" step="0.05" value="${e.sfx}" data-set="sfx" id="set-sfx"><span class="val num">${Math.round(e.sfx*100)}</span></div>
  <div class="toggle"><button class="switch${e.muted?"":" on"}" data-act="mute" aria-label="Ton"></button><div class="grow"><div class="t">Ton an</div><div class="s">Taste M schaltet stumm.</div></div></div>
</div>
<div class="sec"><h3>Darstellung</h3>
  <div class="toggle"><button class="switch${e.alwaysDay?" on":""}" data-act="alwaysDay" aria-label="Immer Tag"></button><div class="grow"><div class="t">Immer Tag</div><div class="s">Schaltet den Tag-Nacht-Wechsel ab.</div></div></div>
  <div class="toggle"><button class="switch${this.app.engine.effects.showIcons?" on":""}" data-act="icons" aria-label="Symbole"></button><div class="grow"><div class="t">Problem-Symbole</div><div class="s">Blitz, Tropfen, M\xFCll und Co. \xFCber Geb\xE4uden (Taste I).</div></div></div>
  <div class="field" style="margin-top:8px"><label for="set-quality">Grafikqualit\xE4t (ab n\xE4chster Stadt)</label><select id="set-quality" data-set="quality"><option value="high" ${e.quality==="high"?"selected":""}>Hoch \u2013 feine Schatten</option><option value="medium" ${e.quality==="medium"?"selected":""}>Mittel</option><option value="low" ${e.quality==="low"?"selected":""}>Niedrig \u2013 ohne Schatten</option></select></div>
</div>
<div class="sec help"><h3>Steuerung</h3>
  <div class="keys">
    <kbd>Rechte Maus</kbd><span>Karte verschieben</span>
    <kbd>Mittlere Maus / Alt+Links</kbd><span>Drehen und neigen</span>
    <kbd>Mausrad</kbd><span>Zoomen</span>
    <kbd>W A S D</kbd><span>Kamera bewegen</span>
    <kbd>Q / E</kbd><span>Kamera drehen</span>
    <kbd>Leertaste</kbd><span>Pause</span>
    <kbd>1 2 3</kbd><span>Geschwindigkeit</span>
    <kbd>R</kbd><span>Geb\xE4ude drehen</span>
    <kbd>B</kbd><span>Abriss</span>
    <kbd>Esc</kbd><span>Werkzeug abbrechen</span>
    <kbd>Strg+S</kbd><span>Schnellspeichern</span>
  </div>
  <h4>So w\xE4chst deine Stadt</h4>
  <ul>
    <li>Zonen brauchen eine Stra\xDFe h\xF6chstens zwei Felder entfernt, die mit der Autobahn verbunden ist.</li>
    <li>Strom und Wasser flie\xDFen durch das Stra\xDFennetz. Ein getrenntes Stra\xDFennetz braucht eigene Kraftwerke.</li>
    <li>Geb\xE4ude steigen auf, wenn Bodenwert, Bildung und Gl\xFCck stimmen. H\xF6here Stufen werden mit Meilensteinen frei.</li>
    <li>Die Nachfrage-Balken (W G I B) zeigen, was die Stadt gerade braucht.</li>
    <li>Jeden Montag w\xE4hlst du eine von drei Wochenkarten. Gelegentlich musst du \xFCber Ereignisse entscheiden.</li>
  </ul>
</div>`}panelClick(e){let t=e.target.closest("[data-act]");if(!t)return;let n=this.g,i=t.dataset.act;this.app.audio.play("click");let r=a=>{a&&a.ok===!1&&a.msg&&this.toast(a.msg,"bad")};switch(i){case"close":this.closePanels();return;case"loan":n.takeLoan(+t.dataset.i)&&(this.toast("Kredit aufgenommen.","good"),this.app.audio.play("money"));break;case"repay":n.repayLoan(+t.dataset.i)||this.toast("Nicht genug Geld zum Abl\xF6sen.","bad");break;case"chart":this.chartKey=t.dataset.k;break;case"policy":n.togglePolicy(t.dataset.id);break;case"newline":this.app.input.setTool({kind:"line"}),this.closePanels(),this.toast("Klicke nacheinander auf Stationen oder freie Felder. Rechtsklick beendet die Linie.");return;case"station":this.app.input.setTool({kind:"place",key:"station"}),this.closePanels();return;case"train+":r(n.addTrain(+t.dataset.l));break;case"train-":r(n.removeTrain(+t.dataset.l));break;case"wagon+":r(n.addWagon(+t.dataset.l));break;case"extend":this.app.input.setTool({kind:"extend",line:+t.dataset.l,atStart:t.dataset.start==="1"}),this.closePanels(),this.toast("Klicke auf Stationen oder freie Felder, um die Linie zu verl\xE4ngern. Rechtsklick beendet.");return;case"delline":this.confirmDel===+t.dataset.l?(n.removeLine(+t.dataset.l),this.confirmDel=null):(this.confirmDel=+t.dataset.l,setTimeout(()=>{this.confirmDel=null},4e3));break;case"save":this.app.save(+t.dataset.k),this.toast(`Gespeichert in Platz ${t.dataset.k}.`,"good");break;case"load":this.app.loadSlot(+t.dataset.k);return;case"export":this.app.exportSave();break;case"copy":this.app.copySave();break;case"tomenu":this.app.toMenu();return;case"mute":this.app.settings.muted=!this.app.settings.muted,this.app.audio.applyVolumes(),this.app.saveSettings();break;case"alwaysDay":this.app.settings.alwaysDay=!this.app.settings.alwaysDay,this.app.saveSettings();break;case"icons":this.app.engine.effects.showIcons=!this.app.engine.effects.showIcons;break}this.renderPanel(),this.refreshHUD()}panelInput(e){let t=e.target;t.dataset.tax?(this.g.setTax(+t.dataset.tax,+t.value),t.nextElementSibling.textContent=`${t.value} %`):t.dataset.set&&t.type==="range"&&(this.app.settings[t.dataset.set]=+t.value,t.nextElementSibling.textContent=Math.round(t.value*100),this.app.audio.applyVolumes())}panelChange(e){let t=e.target;t.dataset.tax?this.renderPanel():t.dataset.set&&(t.dataset.set==="quality"&&(this.app.settings.quality=t.value,this.toast("Gilt ab der n\xE4chsten geladenen Stadt.")),this.app.saveSettings())}inspect(e){if(!e){this.closeInspector();return}this.sel=e,this.renderInspector()}selectedBox(){let e=this.sel,t=this.g;if(!e)return null;if(e.type==="building"){let n=t.buildings.get(e.id);return n?{x:n.x,y:n.y,w:n.w,h:n.h,height:this.app.input.buildingHeight(n)}:null}if(e.type==="station"){let n=t.transit.stations.get(e.id);return n?{x:n.x,y:n.y,w:1,h:1,station:!0}:null}return null}closeInspector(){this.sel=null,this.el.insp.hidden=!0,this.app.engine.overlay.select(null)}renderInspector(){let e=this.sel,t=this.g;if(!e)return;let n="";if(e.type==="building"){let i=t.buildings.get(e.id);if(!i){this.closeInspector();return}n=i.zone?this.inspZone(i):this.inspService(i)}else if(e.type==="station"){let i=t.transit.stations.get(e.id);if(!i){this.closeInspector();return}n=this.inspStation(i)}else if(e.type==="road"){let i=e.i,r=t.road[i];if(!r){this.closeInspector();return}let a=wt[r],o=t.congestion[i];n=`<div class="stripe" style="background:#5d6470"></div><header><div class="grow"><h2>${a.name}</h2><div class="sub">${t.world.terrain[i]===le.WATER?"Br\xFCcke \xB7 ":""}Feld ${i%t.W}, ${Math.floor(i/t.W)}</div></div><button class="close" data-act="close">${ot("close",16)}</button></header>
<div class="body"><div class="kv"><span>Verkehr pro Stunde</span><span class="v">${$e(t.trafficLoad[i])}</span><span>Kapazit\xE4t</span><span class="v">${$e(a.capacity)}</span><span>Auslastung</span><span class="v ${o>.9?"neg":""}">${Math.round(o*100)} %</span></div>
<p style="font-size:12.5px;color:var(--ink-2);line-height:1.45;margin:8px 0 0">${et(a.desc)}</p></div>`}else if(e.type==="tile"){let i=e.i,r=["Wiese","Wasser","Strand","Fels"][t.world.terrain[i]],a=t.world.resource[i]===Kt.FERTILE?"fruchtbarer Boden":t.world.resource[i]===Kt.ORE?"Erzvorkommen":"";n=`<div class="stripe" style="background:#9bc887"></div><header><div class="grow"><h2>${r}${a?" \xB7 "+a:""}</h2><div class="sub">Feld ${i%t.W}, ${Math.floor(i/t.W)}${t.zone[i]?" \xB7 Zone "+Et[t.zone[i]].name:""}</div></div><button class="close" data-act="close">${ot("close",16)}</button></header>
<div class="body"><div class="kv"><span>Bodenwert</span><span class="v">${Math.round(t.fields.landValue[i])}</span><span>Verschmutzung</span><span class="v">${Math.round(t.fields.pollution[i]*100)} %</span><span>L\xE4rm</span><span class="v">${Math.round(t.fields.noise[i]*100)} %</span>${t.world.trees[i]?'<span>Wald</span><span class="v">ja</span>':""}</div>
${t.zone[i]&&!t.bld[i]?`<p style="font-size:12.5px;color:var(--ink-2);margin:8px 0 0">${t.access[i]<0?"Keine Stra\xDFe in Reichweite (max. 2 Felder).":t.roadComp[t.access[i]]!==t.outsideComp?"Die Stra\xDFe ist nicht mit der Autobahn verbunden.":t.demand[t.zone[i]]<=4?"Wartet auf Nachfrage.":"Bereit zum Bebauen."}</p>`:""}</div>`}this.el.insp.innerHTML=n,this.el.insp.hidden=!1,this.app.engine.overlay.select(this.selectedBox())}inspZone(e){let t=this.g,n=e.y*t.W+e.x,i=$n(Et[e.zone].color),r=cx[e.zone][e.level];e.spec==="farm"?r="Bauernhof":e.spec==="mine"&&(r="Bergwerk");let a=[],o=Va(t,e,a);a.sort((p,g)=>Math.abs(g[1])-Math.abs(p[1]));let l=(p,g)=>`<span class="chip ${p?"ok":"no"}">${g}</span>`,c=wn[e.zone],h=t.maxLevelAt(e.x,e.y),u="";if(e.abandoned)u='<span class="chip no">Verlassen \u2013 wird bald abgerissen</span>';else if(e.construct<1)u=`<span class="chip warn">Im Bau \xB7 ${Math.round(e.construct*100)} %</span>`;else if(e.level>=5)u="H\xF6chste Stufe erreicht.";else if(e.level>=h)u=t.trackCount[n]>0&&h===Ie.maxLevelUnderTrack?"Unter der Hochbahn ist keine h\xF6here Stufe m\xF6glich.":t.policies.has("lowrise")&&h===3?"Hochhausverbot begrenzt die H\xF6he.":`H\xF6here Stufen ab Meilenstein \u201E${zt[[0,0,2,3,4,4][e.level+1]??4].name}".`;else{let p=c.need[e.level+1],g=e.zone===Ae.IND?null:t.fields.landValue[n],x=[];g!==null?x.push(`Bodenwert ${Math.round(g)} / ${p}`):x.push(`Infrastruktur ${p}+ (Dienste, M\xFCll)`),c.edu[e.level+1]>0&&x.push(`Bildung ${Math.round((e.zone===Ae.RES?e.edu:t.stats.edu)*100)} / ${Math.round(c.edu[e.level+1]*100)} %`),e.happy<45&&x.push(`Gl\xFCck ${Math.round(e.happy)} / 45`),u=`F\xFCr Stufe ${e.level+1}: ${x.join(" \xB7 ")}`}let d=e.zone===Ae.RES?"Bewohner":"Besch\xE4ftigte";return`<div class="stripe" style="background:${i}"></div>
<header><div class="grow"><h2>${r}</h2><div class="sub">${Et[e.zone].name} \xB7 Stufe ${e.level} \xB7 Feld ${e.x}, ${e.y}</div></div><button class="close" data-act="close">${ot("close",16)}</button></header>
<div class="body">
  <div class="chips">${l(e.connected,"Stra\xDFe")}${l(e.powered,"Strom")}${l(e.watered,"Wasser")}${l(t.cov.garbage[n]>.3,"M\xFCllabfuhr")}${e.burning?'<span class="chip no">Brennt!</span>':""}${t.cov.transit[n]>0?'<span class="chip ok">Pulsbahn</span>':""}</div>
  <div class="kv"><span>${d}</span><span class="v">${$e(e.occ)} / ${$e(e.cap)}</span>
  <span>Gl\xFCck</span><span class="v ${e.happy<40?"neg":""}">${Math.round(e.happy)} % \u2192 ${Math.round(o)} %</span>
  <span>Bodenwert</span><span class="v">${Math.round(t.fields.landValue[n])}</span>
  ${e.zone===Ae.RES?`<span>Bildung</span><span class="v">${Math.round(e.edu*100)} %</span><span>Pendelzeit</span><span class="v">${Math.round(e.commute)} Min.</span>`:""}
  </div>
  <div class="sec" style="margin:12px 0 8px"><h3>Was das Gl\xFCck beeinflusst</h3><div class="factors">${a.slice(0,9).map(([p,g])=>`<span>${et(p)}</span><span class="v ${g<0?"neg":"pos"}">${g>0?"+":"\u2212"}${Math.abs(g).toFixed(0)}</span>`).join("")||"<span>Alles im Lot.</span><span></span>"}</div></div>
  <p style="font-size:12.5px;color:var(--ink-2);line-height:1.45;margin:6px 0 10px">${u}</p>
  <button class="btn small ghost" data-act="demolish" style="color:var(--bad)">Abrei\xDFen</button>
</div>`}inspService(e){let t=this.g,n=nt[e.key],i=[];return n.power&&i.push(["Stromerzeugung",`${$e(n.power*t.mods.power)} MW`]),n.water&&i.push(["Wasserf\xF6rderung",`${$e(n.water*t.mods.water)} m\xB3${e.powered?"":" (ohne Strom: 0)"}`]),n.service&&i.push(["Reichweite",`${n.service.radius} Felder`],["Auslastung",`${Math.round((e.load||0)*100)} %`]),n.tourism&&i.push(["Touristen",`${n.tourism} / Tag`]),n.park&&i.push(["Erholung",`Radius ${n.parkRadius}`]),i.push(["Unterhalt",`${Xe(n.upkeep*t.upkeepMul())} / Tag`]),`<div class="stripe" style="background:${vu[n.cat]||"#999"}"></div>
<header><div class="grow"><h2>${et(n.name)}</h2><div class="sub">Feld ${e.x}, ${e.y}</div></div><button class="close" data-act="close">${ot("close",16)}</button></header>
<div class="body">
  <div class="chips"><span class="chip ${e.connected||e.comp>=0?"ok":"no"}">Stra\xDFe</span><span class="chip ${e.powered||n.power?"ok":"no"}">${n.power?"Kraftwerk":"Strom"}</span>${e.construct<1?`<span class="chip warn">Im Bau \xB7 ${Math.round(e.construct*100)} %</span>`:""}</div>
  <div class="kv">${i.map(([a,o])=>`<span>${a}</span><span class="v">${o}</span>`).join("")}</div>
  <p style="font-size:12.5px;color:var(--ink-2);line-height:1.45;margin:8px 0 10px">${et(n.desc)}</p>
  <button class="btn small ghost" data-act="demolish" style="color:var(--bad)">Abrei\xDFen (+${Xe(n.cost*t.costMul*.4)})</button>
</div>`}inspStation(e){let i=this.g.transit.lines.filter(l=>l.stops.includes(e.id)),r=[0,0,0,0,0];for(let l of e.waiting)r[l.shape]++;let a=["","\u25CF","\u25B2","\u25A0","\u25C6"],o=e.over>.02?`<span class="chip no">\xDCberf\xFCllt \xB7 ${Math.round(e.over*100)} %</span>`:"";return`<div class="stripe" style="background:${i.length?$n(rn[i[0].color]):"#999"}"></div>
<header><div class="grow"><h2>${et(e.name)}</h2><div class="sub">Pulsbahn-Station \xB7 Feld ${e.x}, ${e.y}</div></div><button class="close" data-act="close">${ot("close",16)}</button></header>
<div class="body">
  <div class="chips">${i.map(l=>`<span class="chip" style="background:${$n(rn[l.color])};color:#fff">Linie ${Ka[l.color]}</span>`).join("")||'<span class="chip no">Keine Linie</span>'}${o}</div>
  <div class="kv"><span>Wartende Fahrg\xE4ste</span><span class="v ${e.waiting.length>Ie.stationCapacity?"neg":""}">${e.waiting.length} / ${Ie.stationCapacity}</span>
  <span>Ziele</span><span class="v">${[1,2,3,4].map(l=>`${a[l]} ${r[l]}`).join("  ")}</span>
  <span>Einzugsgebiet</span><span class="v">${$e(e.w[1])} Bew. \xB7 ${$e(e.w[2]+e.w[3]+e.w[4])} Jobs</span>
  <span>Fahrg\xE4ste angekommen</span><span class="v">${$e(e.served)}</span></div>
  <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap"><button class="btn small" data-act="linefrom">Linie von hier</button><button class="btn small ghost" data-act="demolish" style="color:var(--bad)">Abrei\xDFen</button></div>
</div>`}inspClick(e){let t=e.target.closest("[data-act]");if(!t)return;let n=this.g,i=this.sel,r=t.dataset.act;if(r==="close"){this.closeInspector();return}if(r==="demolish"&&i){let a=[];if(i.type==="building"){let l=n.buildings.get(i.id);if(l)for(let c=l.y;c<l.y+l.h;c++)for(let h=l.x;h<l.x+l.w;h++)a.push(c*n.W+h)}else if(i.type==="station"){let l=n.transit.stations.get(i.id);if(l){n.transit.removeStation(l.id),n.afterTransitChange(),this.closeInspector(),this.app.audio.play("demolish");return}}n.bulldoze(a).ok&&this.app.audio.play("demolish"),this.closeInspector();return}r==="linefrom"&&i&&i.type==="station"&&(this.app.input.setTool({kind:"line"}),this.app.input.lineStops=[i.id],this.closeInspector())}modalOpen(){return this.modalRoot.children.length>0}queueModal(e){this.modalQueue.push(e),this.modalOpen()||this.nextModal()}nextModal(){let e=this.modalQueue.shift();e&&e()}openModal(e,t){let n=document.createElement("div");return n.className="backdrop",n.innerHTML=e,this.modalRoot.appendChild(n),n.addEventListener("click",i=>t(i,()=>{n.remove(),this.nextModal()})),n}showMilestone(e){let t=zt[e];this.app.audio.play("milestone");let n=[];for(let[r,a]of Object.entries(nt))!a.landmark&&a.unlock===e&&n.push(a.name);e===2&&n.unshift("B\xFCro-Zone","Alleen","Pulsbahn (2 Linien)","Kredite"),e>=3&&e<=5&&n.push("+1 Pulsbahn-Linie");let i=[0,0,3,4,5][e];i&&n.push(`Geb\xE4ude bis Stufe ${i}`);for(let[r,a]of Object.entries(nt))a.landmark&&a.unlock+1===e&&n.push(`Wahrzeichen: ${a.name}`);this.refreshTutorial(),this.openModal(`<div class="modal milestone"><div class="eyebrow">Meilenstein erreicht</div><div class="big">${t.name}</div><p>${$e(t.pop)} Menschen nennen ${et(this.g.name)} jetzt ihr Zuhause.${t.reward&&!this.g.sandbox?` Das Land gratuliert mit <b>${Xe(t.reward)}</b>.`:""}</p>${n.length?`<ul>${n.map(r=>`<li>${et(r)}</li>`).join("")}</ul>`:""}<div class="acts" style="justify-content:center"><button class="btn" data-act="ok">Weiter bauen</button></div></div>`,(r,a)=>{r.target.closest("[data-act=ok]")&&a()})}showCards(e){let t=this.g;this.app.audio.play("card");let n=e.map(r=>ja(t,r)).filter(Boolean),i=`<div class="cards-wrap"><div class="head"><div class="eyebrow" style="color:#c9cdd8">Woche ${t.week()}</div><h2>W\xE4hle deine Wochenkarte</h2><p>Eine von drei \u2013 die anderen verfallen.</p></div>
<div class="cards">${n.map((r,a)=>`<button class="ticket" data-card="${r.id}"><div class="band" style="background:${r.color}"><span class="tag">${et(r.tag)}</span><span class="no">Nr. ${String(t.week()).padStart(3,"0")}-${a+1}</span></div><div class="perf"></div><div class="bd"><div class="nm">${et(r.name)}</div><div class="ds">${et(r.text(t))}</div><div class="go">Diese nehmen \u2192</div></div><span class="stamp" style="color:${r.color}">STADT<br>PULS</span></button>`).join("")}</div></div>`;this.openModal(i,(r,a)=>{let o=r.target.closest("[data-card]");o&&(t.chooseCard(o.dataset.card),this.app.audio.play("money"),a(),this.cat&&this.renderTray(),this.refreshHUD())})}showEvent(e){let t=this.g,n=`<div class="paper-news"><div class="mast"><b>${et(t.name)}er Anzeiger</b><span>${t.dateText()}</span></div><h2>${et(e.title)}</h2><p>${et(e.text)}</p>${e.options.map((i,r)=>`<button class="choice" data-opt="${r}"><b>${et(i.label)}</b><span>${et(i.hint(t))}</span></button>`).join("")}</div>`;this.openModal(n,(i,r)=>{let a=i.target.closest("[data-opt]");a&&(t.resolveEvent(+a.dataset.opt),this.app.audio.play("click"),r(),this.refreshHUD())})}showBankrupt(){let e=this.g;e.gameOver=!0,this.openModal(`<div class="modal"><div class="eyebrow">Zahlungsunf\xE4hig</div><h2>${et(e.name)} ist pleite</h2><p>Die Stadtkasse war zehn Tage lang tief im Minus. Das Land \xFCbernimmt die Verwaltung.</p><div class="acts"><button class="btn ghost" data-act="menu">Hauptmen\xFC</button><button class="btn" data-act="rescue">Mit Rettungspaket weiterspielen</button></div></div>`,(t,n)=>{let i=t.target.closest("[data-act]");if(i){if(i.dataset.act==="menu"){n(),this.app.toMenu();return}e.gameOver=!1,e.money=3e4,e.debtDays=0,e.addEffect("happy",-6,7,"Rettungspaket"),e.news("money","Das Land hat ein Rettungspaket \xFCber 30.000 \u20AC geschn\xFCrt \u2013 unter strengen Auflagen.","info"),n()}})}update(e){this.timer-=e,this.timer<=0&&(this.timer=.25,this.refreshHUD(),this.sel&&!this.el.insp.hidden&&this.renderInspector()),this.panelTimer-=e,this.panelTimer<=0&&(this.panelTimer=1.2,this.panel&&!this.panelBusy&&this.panel!=="settings"&&this.panel!=="budget"?this.renderPanel():this.panel==="budget"&&!this.panelBusy&&!this.el.panel.matches(":hover")&&this.renderPanel(),this.refreshTutorial())}};var Aa=class{constructor(e){this.app=e,this.root=document.getElementById("menu");let t=Cn(Date.now()&16777215);this.opts={name:Ha(t),mapType:"river",size:96,difficulty:"normal",seed:Math.floor(t()*99999)},this.view="main"}show(){this.root.hidden=!1,this.render()}hide(){this.root.hidden=!0,this.root.innerHTML=""}render(){let e=this.app,t=e.slotMeta("auto"),n=[1,2,3].map(l=>[l,e.slotMeta(l)]).filter(([,l])=>l),i=this.opts,r=Fa.find(l=>l.id===i.mapType),a=Li.find(l=>l.id===i.difficulty);this.root.innerHTML=`
<div class="menu">
  <div class="side">
    <div class="brand">${Ea(64)}<div><h1>Stadtpuls</h1></div></div>
    <p class="lede">Baue eine Stadt, die im Takt schl\xE4gt. Zonen, Strom und Wasser, Feuerwehr und Schulen \u2013 und eine Hochbahn \xFCber den D\xE4chern, deren Z\xFCge bei jeder Ankunft einen Ton spielen.</p>
    ${t?`<div class="card"><h3>Weiterspielen</h3><div class="slot"><div class="grow"><div class="t">${et(t.name)}</div><div class="s">${$e(t.pop)} Einwohner \xB7 ${new Date(t.savedAt).toLocaleString("de-DE")}</div></div><button class="btn" data-act="continue">Fortsetzen</button></div>${n.map(([l,c])=>`<div class="slot"><div class="grow"><div class="t">Platz ${l}: ${et(c.name)}</div><div class="s">${$e(c.pop)} Einwohner \xB7 ${new Date(c.savedAt).toLocaleString("de-DE")}</div></div><button class="btn small ghost" data-act="slot" data-k="${l}">Laden</button></div>`).join("")}</div>`:""}
    <div class="card">
      <h3>Neue Stadt gr\xFCnden</h3>
      <div class="field"><label for="m-name">Name der Stadt</label><div class="inline"><input type="text" id="m-name" maxlength="28" value="${et(i.name)}"><button class="btn ghost" data-act="rname" style="flex:none" title="Zuf\xE4lliger Name">W\xFCrfeln</button></div></div>
      <div class="field"><label>Landschaft</label><div class="seg">${Fa.map(l=>`<button data-act="map" data-v="${l.id}" class="${l.id===i.mapType?"on":""}">${l.name}</button>`).join("")}</div><div class="seg-hint">${et(r.desc)}</div></div>
      <div class="inline">
        <div class="field"><label for="m-size">Gr\xF6\xDFe</label><select id="m-size">${Gl.map(l=>`<option value="${l.id}" ${l.id===i.size?"selected":""}>${l.name}</option>`).join("")}</select></div>
        <div class="field"><label for="m-seed">Startwert</label><div class="inline"><input type="number" id="m-seed" value="${i.seed}" min="0" max="999999"><button class="btn ghost" data-act="rseed" style="flex:none" title="Neue Karte">\u21BB</button></div></div>
      </div>
      <div class="field"><label>Schwierigkeit</label><div class="seg">${Li.map(l=>`<button data-act="diff" data-v="${l.id}" class="${l.id===i.difficulty?"on":""}">${l.name}</button>`).join("")}</div><div class="seg-hint">${et(a.desc)}</div></div>
      <div class="acts"><button class="btn big go" data-act="start">Stadt gr\xFCnden</button><button class="btn big ghost" data-act="preview">Karte ansehen</button></div>
    </div>
    <div class="card"><h3>Spielstand aus Datei</h3><input type="file" id="m-file" accept=".json,application/json"><p class="seg-hint" style="margin:8px 0 0">Exportierte St\xE4nde (.json) lassen sich hier wieder laden.</p></div>
    <div class="foot">Rechte Maus verschiebt, Mausrad zoomt, Q/E dreht. Ein Spieltag dauert 30 Sekunden. \xB7 Das Konzept steht in <code>spiel/docs/</code>.</div>
  </div>
  <div></div>
</div>`;let o=this.root;o.querySelector(".menu").addEventListener("click",l=>this.click(l)),o.querySelector("#m-name").addEventListener("input",l=>{this.opts.name=l.target.value}),o.querySelector("#m-size").addEventListener("change",l=>{this.opts.size=+l.target.value,this.preview()}),o.querySelector("#m-seed").addEventListener("change",l=>{this.opts.seed=Math.max(0,Math.floor(+l.target.value||0)),this.preview()}),o.querySelector("#m-file").addEventListener("change",l=>{let c=l.target.files[0];c&&this.app.importFile(c)})}click(e){let t=e.target.closest("[data-act]");if(!t)return;let n=this.opts,i=t.dataset.act;if(i==="start"){n.name=(n.name||"").trim()||"Neustadt",this.app.newGame({...n});return}if(i==="continue"){this.app.loadSlot("auto");return}if(i==="slot"){this.app.loadSlot(+t.dataset.k);return}i==="rname"&&(n.name=Ha(Cn(Date.now()&65535))),i==="map"&&(n.mapType=t.dataset.v,this.preview()),i==="diff"&&(n.difficulty=t.dataset.v),i==="rseed"&&(n.seed=Math.floor(Math.random()*99999),this.preview()),i==="preview"&&this.preview(),this.render()}preview(){clearTimeout(this._pt),this._pt=setTimeout(()=>this.app.menuPreview({...this.opts}),60)}};var _u=[0,2,4,7,9,12,14,16,19,21,24],Hs=[[0,4,7,11],[9,12,16,19],[5,9,12,16],[7,11,14,17]],Gs=50,Ra=s=>440*Math.pow(2,(s-69)/12),Ca=class{constructor(e){this.settings=e,this.ctx=null,this.started=!1,this.chordIdx=0,this.nextChord=0,this.lastNote=0}start(){if(this.started)return;try{let l=window.AudioContext||window.webkitAudioContext;if(!l)return;this.ctx=new l}catch{return}let e=this.ctx;this.started=!0,this.master=e.createGain(),this.master.connect(e.destination),this.music=e.createGain(),this.sfx=e.createGain(),this.music.connect(this.master),this.sfx.connect(this.master),this.reverb=e.createConvolver();let t=e.sampleRate*2.6,n=e.createBuffer(2,t,e.sampleRate);for(let l=0;l<2;l++){let c=n.getChannelData(l);for(let h=0;h<t;h++)c[h]=(Math.random()*2-1)*Math.pow(1-h/t,3)}this.reverb.buffer=n,this.wet=e.createGain(),this.wet.gain.value=.35,this.reverb.connect(this.wet),this.wet.connect(this.master),this.delay=e.createDelay(1),this.delay.delayTime.value=.38,this.fb=e.createGain(),this.fb.gain.value=.32,this.delay.connect(this.fb),this.fb.connect(this.delay),this.delay.connect(this.music),this.padGain=e.createGain(),this.padGain.gain.value=0,this.padFilter=e.createBiquadFilter(),this.padFilter.type="lowpass",this.padFilter.frequency.value=900,this.padFilter.Q.value=.6,this.padFilter.connect(this.padGain),this.padGain.connect(this.music),this.padGain.connect(this.reverb),this.padOsc=[];for(let l=0;l<4;l++)for(let c of[-6,6]){let h=e.createOscillator();h.type=l===0?"triangle":"sine",h.detune.value=c,h.frequency.value=Ra(Gs+Hs[0][l]);let u=e.createGain();u.gain.value=l===0?.11:.07,h.connect(u),u.connect(this.padFilter),h.start(),this.padOsc.push({o:h,k:l})}let i=e.createBuffer(1,e.sampleRate*2,e.sampleRate),r=i.getChannelData(0),a=0;for(let l=0;l<r.length;l++)a=a*.97+(Math.random()*2-1)*.03,r[l]=a*3;this.noise=e.createBufferSource(),this.noise.buffer=i,this.noise.loop=!0,this.noiseGain=e.createGain(),this.noiseGain.gain.value=0;let o=e.createBiquadFilter();o.type="lowpass",o.frequency.value=500,this.noise.connect(o),o.connect(this.noiseGain),this.noiseGain.connect(this.sfx),this.noise.start(),this.applyVolumes(),this.padGain.gain.setTargetAtTime(1,e.currentTime,3)}applyVolumes(){if(!this.ctx)return;let e=this.settings,t=this.ctx.currentTime;this.master.gain.setTargetAtTime(e.muted?0:e.volume,t,.1),this.music.gain.setTargetAtTime(e.music,t,.2),this.sfx.gain.setTargetAtTime(e.sfx,t,.1),this.wet.gain.setTargetAtTime(.35*e.music,t,.2)}update(e,t,n){if(!this.ctx||this.ctx.state!=="running")return;let i=this.ctx.currentTime;if(i>this.nextChord){this.chordIdx=(this.chordIdx+1)%Hs.length;let a=Hs[this.chordIdx];for(let{o:l,k:c}of this.padOsc)l.frequency.setTargetAtTime(Ra(Gs+a[c]),i,1.2);let o=t?t.night:0;this.padFilter.frequency.setTargetAtTime(500+(1-o)*900,i,2),this.nextChord=i+7.5}let r=e.transit.arrivals;if(r.length)for(let a of r.splice(0,r.length)){if(i-this.lastNote<.09)continue;this.lastNote=i;let o=Hs[this.chordIdx],l=(a.line*2+a.station)%_u.length,c=Gs+12+_u[l],h=((c-Gs)%12+12)%12;!o.some(u=>u%12===h)&&Math.random()<.6&&(c+=2),this.pluck(Ra(c),.12+Math.min(.12,a.n*.01))}if(t&&e.speed>0){let a=Math.max(0,Math.min(1,1-t.rig.cur.dist/120)),o=Math.min(1,e.traffic.cars.length/400);this.noiseGain.gain.setTargetAtTime(.05*a*(.3+o),i,.5)}else this.noiseGain.gain.setTargetAtTime(0,i,.3)}pluck(e,t=.15){let n=this.ctx,i=n.currentTime,r=n.createOscillator();r.type="sine",r.frequency.value=e;let a=n.createOscillator();a.type="triangle",a.frequency.value=e*2;let o=n.createGain();o.gain.setValueAtTime(0,i),o.gain.linearRampToValueAtTime(t,i+.008),o.gain.exponentialRampToValueAtTime(8e-4,i+1.6);let l=n.createGain();l.gain.value=.25,r.connect(o),a.connect(l),l.connect(o),o.connect(this.music),o.connect(this.delay),o.connect(this.reverb),r.start(i),a.start(i),r.stop(i+1.7),a.stop(i+1.7)}tone(e,t,n="sine",i=.15,r=0,a){let o=this.ctx,l=o.currentTime+r,c=o.createOscillator();c.type=n,c.frequency.setValueAtTime(e,l);let h=o.createGain();return h.gain.setValueAtTime(0,l),h.gain.linearRampToValueAtTime(i,l+.01),h.gain.exponentialRampToValueAtTime(8e-4,l+t),c.connect(h),h.connect(a||this.sfx),a||h.connect(this.reverb),c.start(l),c.stop(l+t+.05),c}noiseBurst(e,t,n,i=0){let r=this.ctx,a=r.currentTime+i,o=Math.floor(r.sampleRate*e),l=r.createBuffer(1,o,r.sampleRate),c=l.getChannelData(0);for(let p=0;p<o;p++)c[p]=(Math.random()*2-1)*(1-p/o);let h=r.createBufferSource();h.buffer=l;let u=r.createBiquadFilter();u.type="bandpass",u.frequency.value=t,u.Q.value=.8;let d=r.createGain();d.gain.value=n,h.connect(u),u.connect(d),d.connect(this.sfx),h.start(a)}play(e){if(!this.ctx||this.ctx.state!=="running")return;let t=Hs[this.chordIdx],n=i=>Ra(Gs+24+t[i%4]);switch(e){case"click":this.tone(n(2),.12,"sine",.06);break;case"place":this.tone(n(0)/2,.25,"triangle",.16),this.tone(n(2),.3,"sine",.08,.04),this.noiseBurst(.08,900,.25);break;case"road":this.noiseBurst(.14,1800,.22),this.tone(n(1)/2,.15,"triangle",.07);break;case"zone":this.noiseBurst(.2,3e3,.08),this.tone(n(3),.25,"sine",.05);break;case"demolish":this.noiseBurst(.35,300,.5),this.tone(70,.4,"sine",.25);break;case"error":this.tone(220,.14,"square",.04),this.tone(185,.2,"square",.04,.12);break;case"line":[0,1,2,3].forEach(i=>this.tone(n(i),.5,"sine",.08,i*.07));break;case"milestone":[0,1,2,3].forEach(i=>{this.tone(n(i)/2,2.2,"triangle",.08,i*.12),this.tone(n(i),2.4,"sine",.06,i*.12+.05)});break;case"card":[3,2,1,0].forEach((i,r)=>this.tone(n(i)*2,.6,"sine",.05,r*.05));break;case"money":this.tone(n(2)*2,.15,"sine",.06),this.tone(n(3)*2,.25,"sine",.06,.07);break;case"bad":this.tone(n(0)/2,.6,"sine",.1),this.tone(n(0)/2*1.06,.6,"sine",.08);break}}};var gs={get(s){try{return localStorage.getItem(s)}catch{return null}},set(s,e){try{return localStorage.setItem(s,e),!0}catch{return!1}},del(s){try{localStorage.removeItem(s)}catch{}}},Pa=s=>`stadtpuls.save.${s}`;function hx(){let s={volume:.7,music:.7,sfx:.8,muted:!1,alwaysDay:!1,quality:"medium",tutorialDone:!1};try{return{...s,...JSON.parse(gs.get("stadtpuls.settings")||"{}")}}catch{return s}}function ux(){try{let s=document.createElement("canvas");return!!(s.getContext("webgl2")||s.getContext("webgl"))}catch{return!1}}var hn={settings:hx(),mode:"menu",game:null,engine:null,input:null,ui:null,menu:null,last:performance.now(),saveSettings(){gs.set("stadtpuls.settings",JSON.stringify(this.settings))},makeStage(){let s=document.getElementById("stage");s.innerHTML="";let e=document.createElement("canvas");return s.appendChild(e),e},teardown(){this.ui&&(this.ui.dispose(),this.ui=null),this.input&&(this.input.dispose(),this.input=null),this.engine&&(this.engine.dispose(),this.engine=null),this.game=null},showMenu(){this.teardown(),this.mode="menu",this.menu||(this.menu=new Aa(this)),this.menu.show(),this.menuPreview(null)},menuPreview(s){if(this.mode!=="menu")return;this.engine&&(this.engine.dispose(),this.engine=null);let e;s?(e=new Yn({size:s.size,seed:s.seed,mapType:s.mapType,difficulty:"sandbox",name:"Vorschau"}),e.speed=0):(e=new Yn({size:64,seed:7,mapType:"river",difficulty:"sandbox",name:"Demo"}),e.sandboxNoEvents=!0,eo(e),e.speed=3,e.on("cards",i=>e.chooseCard(i[0])));let t=this.makeStage();this.demo=e,this.engine=new Bs(t,e,{...this.settings,quality:this.settings.quality==="high"?"medium":this.settings.quality}),this.engine.rig.autoRotate=.05,this.engine.rig.enabled=!1;let n=e.world.highwayEnd%e.W+18-e.W/2;this.engine.rig.focus(s?0:n-4,s?0:e.world.highwayY-e.H/2,s?e.W*.95:40),this.engine.rig.goal.pitch=s?.95:.72,this.engine.rig.goal.yaw=.9,this.engine.rig.cur={...this.engine.rig.goal,dist:this.engine.rig.goal.dist*1.15}},newGame(s){let e=new Yn(s);e.news("info",`Willkommen in ${e.name}! Die Autobahn endet am Westrand \u2013 von dort aus beginnt deine Stadt.`,"good"),this.startGame(e)},startGame(s){this.audio.start(),this.menu&&this.menu.hide(),this.teardown(),this.mode="game",this.game=s;let e=this.makeStage();try{this.engine=new Bs(e,s,this.settings)}catch(t){console.error(t),document.getElementById("stage").innerHTML='<p class="noscript">WebGL konnte nicht gestartet werden.</p>';return}this.ui=new Ta(this),this.input=new Sa(this.engine,this.ui,this.audio),this.ui.markToolButtons(),s.on("day",()=>this.save("auto")),window.__stadtpuls=this,this.debug={buildDemoCity:eo}},toMenu(){this.game&&this.save("auto"),this.showMenu()},save(s){if(!this.game)return!1;let e=this.game.serialize(),t=gs.set(Pa(s),JSON.stringify(e));return t&&gs.set(Pa(s)+".meta",JSON.stringify({name:e.name,pop:e.pop,savedAt:e.savedAt})),t},slotMeta(s){try{return JSON.parse(gs.get(Pa(s)+".meta")||"null")}catch{return null}},loadSlot(s){let e=gs.get(Pa(s));if(!e){this.ui&&this.ui.toast("Kein Spielstand gefunden.","bad");return}this.loadData(JSON.parse(e))},loadData(s){try{let e=Yn.fromSave(s);this.startGame(e),this.ui.toast(`${e.name} geladen.`,"good")}catch(e){console.error(e),Ll("Der Spielstand konnte nicht geladen werden.")}},exportSave(){if(!this.game)return;let s=new Blob([JSON.stringify(this.game.serialize())],{type:"application/json"}),e=document.createElement("a");e.href=URL.createObjectURL(s),e.download=`stadtpuls-${this.game.name.replace(/[^a-z0-9äöüß-]+/gi,"_")}.json`,document.body.appendChild(e),e.click(),setTimeout(()=>{URL.revokeObjectURL(e.href),e.remove()},500),this.ui.toast('Export gestartet. Falls nichts passiert: \u201EIn Zwischenablage" nutzen.')},copySave(){if(!this.game)return;let s=JSON.stringify(this.game.serialize());navigator.clipboard?.writeText(s).then(()=>this.ui.toast("Spielstand in die Zwischenablage kopiert.","good"),()=>this.ui.toast("Zwischenablage nicht verf\xFCgbar.","bad"))},importFile(s){let e=new FileReader;e.onload=()=>{try{this.loadData(JSON.parse(e.result))}catch{Ll("Die Datei ist kein g\xFCltiger Stadtpuls-Spielstand.")}},e.readAsText(s)},frame(s){let e=Math.min(.1,(s-this.last)/1e3);this.last=s;try{if(this.mode==="game"&&this.game&&this.engine){let t=this.game.update(e);this.engine.frame(e,t),this.ui.update(e),this.audio.update(this.game,this.engine,e)}else if(this.mode==="menu"&&this.engine&&this.demo){let t=this.demo.update(e);this.engine.frame(e,t)}}catch(t){console.error(t),this._errShown||(this._errShown=!0,Ll("Es ist ein Fehler aufgetreten: "+t.message))}requestAnimationFrame(t=>this.frame(t))}};function Ll(s){let e=document.getElementById("modal-root"),t=document.createElement("div");t.className="backdrop",t.innerHTML='<div class="modal"><h2>Hinweis</h2><p></p><div class="acts"><button class="btn">OK</button></div></div>',t.querySelector("p").textContent=s,t.querySelector("button").onclick=()=>t.remove(),e.appendChild(t)}function bu(s){if(!ux()){document.getElementById("menu").innerHTML='<div class="loading">Dein Browser unterst\xFCtzt kein WebGL \u2013 Stadtpuls braucht 3D-Grafik.</div>';return}hn.audio=new Ca(hn.settings);let e=()=>{hn.audio.start(),hn.audio.ctx&&hn.audio.ctx.state==="suspended"&&hn.audio.ctx.resume()};if(window.addEventListener("pointerdown",e),window.addEventListener("keydown",e),s&&s.save)try{hn.startGame(Yn.fromSave(s.save))}catch{hn.showMenu()}else hn.showMenu();requestAnimationFrame(t=>{hn.last=t,hn.frame(t)})}var Xn=typeof window<"u"&&window.claude&&window.claude.hot;if(Xn&&Xn.snapshot)try{Xn.snapshot(()=>hn.game?{save:hn.game.serialize()}:{})}catch{}Xn&&Xn.ready?Xn.ready(bu):bu(Xn&&Xn.data?Xn.data:{});})();
/*! Bundled license information:

three/build/three.module.js:
  (**
   * @license
   * Copyright 2010-2023 Three.js Authors
   * SPDX-License-Identifier: MIT
   *)
*/
