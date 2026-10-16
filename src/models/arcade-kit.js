/** Original reusable low-poly kit. Units: metres, +Y up, +Z forward.
 * Every asset rests at y=0 and is centered on X/Z. The same source drives
 * Three.js sprites and exported glTF models; geometry contains no game rules. */
export const MATERIALS = {
  ink: { color: '#223b41', roughness: .65, metalness: .15 },
  dark: { color: '#112830', roughness: .55, metalness: .15 },
  blue: { color: '#58c9ec', roughness: .4, metalness: .22, tintable: true },
  mint: { color: '#96dbb5', roughness: .55, metalness: .12, tintable: true },
  lime: { color: '#d9f77c', roughness: .4, metalness: .12 },
  coral: { color: '#f58a79', roughness: .5, metalness: .12, tintable: true },
  amber: { color: '#f5c66d', roughness: .4, metalness: .35 },
  cream: { color: '#edf1d8', roughness: .62, metalness: .05 },
  steel: { color: '#a8bec9', roughness: .3, metalness: .7 },
  violet: { color: '#b0a2e5', roughness: .42, metalness: .2 },
  glow: { color: '#c0ffea', emissive: '#5cba9b', roughness: .3, metalness: .1 },
  glass: { color: '#b4e9e9', roughness: .16, metalness: .05, opacity: .22, doubleSided: true },
};
const part = (name, shape, args, material, position = [0,0,0], rotation = [0,0,0]) => ({name,shape,args,material,position,rotation});
const box = (name, size, mat, pos, rot) => part(name,'box',size,mat,pos,rot);
const cyl = (name, r1, r2, h, mat, pos, rot, open = false) => part(name,'cylinder',[r1,r2,h,12,1,open],mat,pos,rot);
const sphere = (name,r,mat,pos) => part(name,'sphere',[r,12,8],mat,pos);
const ring = (name,r,t,mat,pos,rot=[Math.PI/2,0,0]) => part(name,'torus',[r,t,6,20],mat,pos,rot);
const crate = (mat, label = 'cargo') => [
  box('body',[.74,.64,.66],mat,[0,.42,0]),
  box('base',[.82,.12,.76],'ink',[0,.08,0]),
  box('lid',[.82,.12,.76],'cream',[0,.8,0]),
  ...[-1,1].map(s => box(`strap-${s}`,[.09,.76,.79],'ink',[s*.27,.43,0])),
  box(`${label}-panel`,[.32,.28,.04],'dark',[0,.43,.352]),
  box(`${label}-mark`,[.13,.13,.035],'glow',[0,.43,.385],[0,0,Math.PI/4]),
];
const boots = [-1,1].flatMap(s => [box(`leg-${s}`,[.19,.25,.19],'ink',[s*.18,.23,0]),box(`boot-${s}`,[.26,.14,.38],'dark',[s*.18,.07,.065])]);
export const MODELS = {
  'scout-bot': { name: '巡游机器人 / Scout bot', category:'character', reuse:['runner','pins','shooter'], nodes:[
    ...boots,
    cyl('body',.3,.25,.47,'blue',[0,.57,0]),
    box('belt',[.56,.09,.36],'ink',[0,.39,0]),
    box('head',[.59,.39,.43],'blue',[0,.99,0]),
    box('visor',[.47,.15,.05],'dark',[0,1.005,.237]),
    ...[-1,1].map(s=>box(`eye-${s}`,[.075,.065,.025],'glow',[s*.12,1.02,.27])),
    ...[-1,1].map(s=>cyl(`arm-${s}`,.10,.08,.38,'cream',[s*.37,.59,0],[0,0,s*.16])),
    box('pack',[.34,.34,.15],'ink',[0,.61,-.25]),
    cyl('antenna',.025,.025,.16,'steel',[.22,1.27,0]),sphere('beacon',.055,'lime',[.22,1.38,0]),
  ]},
  'cargo-bot': { name:'货运机器人 / Cargo bot',category:'character',reuse:['warehouse','shooter','future-puzzle'],nodes:[
    ...[-1,1].map(s=>cyl(`wheel-${s}`,.19,.19,.14,'dark',[s*.29,.19,0],[0,0,Math.PI/2])),
    box('chassis',[.64,.24,.58],'ink',[0,.29,0]),
    box('body',[.55,.44,.46],'mint',[0,.57,0]),
    box('face',[.46,.22,.035],'dark',[0,.63,.25]),
    ...[-1,1].map(s=>box(`eye-${s}`,[.08,.075,.022],'glow',[s*.115,.65,.277])),
    box('lid',[.62,.075,.51],'cream',[0,.82,0]),
    box('handle',[.28,.08,.1],'amber',[0,.9,0]),
    ...[-1,1].map(s=>box(`fork-${s}`,[.095,.085,.45],'steel',[s*.21,.15,.32])),
  ]},
  'enemy-drone': {name:'警戒无人机 / Enemy drone',category:'character',reuse:['shooter','runner'],nodes:[
    sphere('core',.31,'coral',[0,.42,0]),box('visor',[.42,.12,.1],'dark',[0,.45,.27]),
    box('sensor',[.17,.055,.03],'amber',[0,.455,.33]),
    ...[-1,1].flatMap(s=>[box(`wing-${s}`,[.38,.08,.22],'ink',[s*.36,.43,0],[0,0,s*.2]),ring(`rotor-${s}`,.16,.035,'steel',[s*.49,.5,0]),box(`tip-${s}`,[.1,.15,.18],'coral',[s*.53,.36,0])]),
    cyl('engine',.12,.075,.2,'ink',[0,.1,0]),
  ]},
  'boss-sentry':{name:'重装守卫 / Boss sentry',category:'character',reuse:['shooter','runner'],nodes:[
    ...[-1,1].map(s=>box(`tread-${s}`,[.27,.35,.83],'dark',[s*.39,.175,0])),
    box('hull',[.86,.45,.68],'coral',[0,.53,0]),
    box('turret',[.71,.33,.54],'ink',[0,.91,0]),
    ...[-1,1].map(s=>cyl(`barrel-${s}`,.095,.095,.57,'steel',[s*.23,.91,.41],[Math.PI/2,0,0])),
    box('visor',[.34,.085,.035],'amber',[0,1.005,.29]),
    box('crest',[.39,.08,.35],'cream',[0,1.11,0]),
  ]},
  'cargo-crate':{name:'标准货箱 / Cargo crate',category:'prop',reuse:['warehouse','runner','shooter'],nodes:crate('amber')},
  'upgrade-crate':{name:'强化补给箱 / Upgrade crate',category:'prop',reuse:['shooter','runner'],nodes:[...crate('lime','upgrade'),box('upgrade-bar',[.23,.055,.025],'lime',[0,.43,.41]),box('upgrade-stem',[.055,.23,.025],'lime',[0,.43,.41])]},
  'floor-tile':{name:'模块地块 / Floor tile',category:'environment',reuse:['warehouse','shooter','runner'],nodes:[
    box('foundation',[1,.13,1],'dark',[0,.065,0]),box('surface',[.96,.055,.96],'ink',[0,.158,0]),
    ...[-1,1].map(s=>box(`stripe-${s}`,[.06,.01,.13],'mint',[s*.4,.19,-.36])),
  ]},
  'wall-block':{name:'模块墙体 / Wall block',category:'environment',reuse:['warehouse','pins','shooter'],nodes:[
    box('foot',[1,.12,1],'dark',[0,.06,0]),box('wall',[.88,.67,.88],'ink',[0,.44,0]),box('cap',[.96,.1,.96],'steel',[0,.83,0]),
    box('front',[.61,.28,.04],'mint',[0,.46,.46]),box('seam',[.05,.44,.05],'dark',[0,.46,.49]),
  ]},
  'dock-pad':{name:'发光泊位 / Dock pad',category:'environment',reuse:['warehouse','shooter','future-puzzle'],nodes:[
    box('base',[1,.12,1],'dark',[0,.06,0]),cyl('platform',.43,.43,.045,'ink',[0,.145,0]),
    ring('target-ring',.3,.025,'lime',[0,.176,0]),box('target-x',[.34,.02,.045],'glow',[0,.17,0]),box('target-z',[.045,.02,.34],'glow',[0,.17,0]),
  ]},
  'energy-gate':{name:'能量门框 / Energy gate',category:'prop',reuse:['runner','shooter','future-puzzle'],nodes:[
    ...[-1,1].flatMap(s=>[box(`foot-${s}`,[.38,.16,.43],'ink',[s*.68,.08,0]),box(`post-${s}`,[.14,1.55,.18],'blue',[s*.68,.86,0]),box(`light-${s}`,[.04,1.36,.025],'glow',[s*.68,.87,.11])]),
    box('top',[1.5,.18,.22],'cream',[0,1.71,0]),box('field',[1.22,1.49,.025],'glass',[0,.9,0]),box('badge',[.52,.24,.12],'lime',[0,1.7,.13]),
  ]},
  screw:{name:'十字螺丝 / Cross screw',category:'mechanical',reuse:['screws','warehouse','future-puzzle'],nodes:[
    cyl('shaft',.095,.075,.48,'steel',[0,.25,0]),
    ...[0,1,2,3,4].map(i=>ring(`thread-${i}`,.099,.018,'ink',[0,.06+i*.085,0])),
    cyl('head',.23,.19,.13,'steel',[0,.555,0]),box('slot-x',[.29,.014,.047],'dark',[0,.626,0]),box('slot-z',[.047,.014,.29],'dark',[0,.626,0]),
  ]},
  'metal-plate':{name:'通用连接板 / Connector plate',category:'mechanical',reuse:['screws','warehouse','future-puzzle'],nodes:[
    box('plate',[1.5,.11,.44],'blue',[0,.055,0]),
    ...[-1,1].flatMap(s=>[cyl(`end-${s}`,.22,.22,.11,'blue',[s*.75,.055,0]),cyl(`hole-${s}`,.095,.095,.006,'dark',[s*.67,.114,0]),ring(`rim-${s}`,.106,.013,'steel',[s*.67,.12,0])]),
    box('stamp',[.23,.012,.035],'cream',[0,.114,0]),
  ]},
  'test-tube':{name:'透明试管 / Glass test tube',category:'prop',reuse:['water-sort','future-puzzle'],nodes:[
    cyl('glass-wall',.23,.23,1.18,'glass',[0,.8,0],[0,0,0],true),sphere('glass-bottom',.23,'glass',[0,.23,0]),
    ring('rim',.231,.035,'cream',[0,1.4,0]),ring('foot',.198,.02,'glass',[0,.13,0]),
    ...[0,1,2,3].map(i=>box(`measure-${i}`,[.095,.018,.012],'cream',[.08,.45+i*.23,.226])),
  ]},
  coin:{name:'收藏金币 / Collectible coin',category:'prop',reuse:['pins','runner','shooter'],nodes:[
    cyl('coin',.38,.38,.1,'amber',[0,.4,0],[Math.PI/2,0,0]),ring('rim',.315,.027,'cream',[0,.4,.065],[0,0,0]),
    box('emblem',[.2,.2,.03],'cream',[0,.4,.067],[0,0,Math.PI/4]),
  ]},
};

// Modular expansion: shared palette, metre grid, grounded pivot, named submeshes.
Object.assign(MODELS, {
  'bridge-tile': {name:'模块桥面 / Bridge tile',category:'environment',reuse:['pins','runner','warehouse'],nodes:[
    box('deck',[1,.14,1],'steel',[0,.07,0]),
    ...[-1,1].flatMap(s=>[box(`rail-${s}`,[.06,.08,1],'amber',[s*.46,.4,0]),...[-1,1].map(z=>box(`post-${s}-${z}`,[.06,.34,.06],'ink',[s*.46,.24,z*.43]))]),
  ]},
  'corner-wall': {name:'转角墙 / Corner wall',category:'environment',reuse:['warehouse','pins'],nodes:[
    box('base',[1,.12,1],'dark',[0,.06,0]),box('back',[1,.8,.16],'ink',[0,.52,-.42]),box('side',[.16,.8,.84],'ink',[-.42,.52,.08]),box('trim',[1,.06,.18],'mint',[0,.95,-.42]),
  ]},
  'hazard-tile': {name:'危险地块 / Hazard tile',category:'environment',reuse:['runner','warehouse','shooter'],nodes:[
    box('base',[1,.12,1],'ink',[0,.06,0]),
    ...[-2,-1,0,1,2].map(i=>box(`stripe-${i}`,[.12,.015,.88],i%2?'dark':'amber',[i*.18,.128,0])),
  ]},
  'shield-cell': {name:'护盾电池 / Shield cell',category:'prop',reuse:['shooter','runner'],nodes:[
    cyl('base',.28,.3,.12,'ink',[0,.06,0]),cyl('cell',.22,.22,.6,'blue',[0,.42,0]),cyl('cap',.28,.28,.1,'cream',[0,.77,0]),
    ...[-1,1].map(s=>box(`light-${s}`,[.05,.42,.03],'glow',[s*.11,.43,.21])),
  ]},
  'repair-kit': {name:'维修补给 / Repair kit',category:'prop',reuse:['shooter','warehouse','runner'],nodes:[
    box('case',[.72,.48,.4],'mint',[0,.3,0]),box('foot',[.76,.06,.44],'ink',[0,.03,0]),box('handle',[.3,.09,.12],'ink',[0,.59,0]),box('badge-x',[.28,.08,.03],'cream',[0,.31,.215]),box('badge-y',[.08,.28,.03],'cream',[0,.31,.215]),
  ]},
  'sentry-turret': {name:'模块炮塔 / Sentry turret',category:'mechanical',reuse:['shooter','runner','warehouse'],nodes:[
    cyl('base',.36,.42,.18,'ink',[0,.09,0]),cyl('pivot',.17,.17,.26,'steel',[0,.31,0]),box('head',[.54,.3,.5],'blue',[0,.57,0]),cyl('barrel',.085,.085,.58,'dark',[0,.58,.46],[Math.PI/2,0,0]),box('sight',[.14,.06,.15],'glow',[0,.75,.1]),
  ]},
  'pin-handle': {name:'可抽拉插销 / Pull pin',category:'mechanical',reuse:['pins','screws'],nodes:[
    cyl('shaft',.055,.055,1.1,'steel',[0,.055,0],[0,0,Math.PI/2]),ring('grip',.17,.045,'amber',[.7,.215,0],[0,0,0]),box('stop',[.08,.16,.16],'ink',[.54,.08,0]),
  ]},
  'valve-wheel': {name:'机关阀门 / Valve wheel',category:'mechanical',reuse:['pins','water-sort','screws'],nodes:[
    cyl('base',.18,.22,.12,'ink',[0,.06,0]),cyl('stem',.065,.065,.28,'steel',[0,.26,0]),ring('wheel',.32,.045,'coral',[0,.44,0]),box('spoke-x',[.62,.045,.055],'coral',[0,.44,0]),box('spoke-z',[.055,.045,.62],'coral',[0,.44,0]),
  ]},
  'tube-rack': {name:'模块试管架 / Tube rack',category:'prop',reuse:['water-sort','warehouse'],nodes:[
    box('base',[1.6,.1,.6],'ink',[0,.05,0]),...[-1,1].map(s=>box(`support-${s}`,[.08,.65,.54],'mint',[s*.75,.425,0])),
    ...[-1,1].map(s=>box(`rail-${s}`,[1.6,.08,.08],'cream',[0,.73,s*.24])),
    ...[-.5,0,.5].map((x,i)=>ring(`socket-${i}`,.19,.025,'steel',[x,.73,0])),
  ]},
  'star-token': {name:'通关星章 / Star token',category:'prop',reuse:['runner','pins','screws','water-sort','warehouse','shooter'],nodes:[
    cyl('plinth',.28,.32,.1,'ink',[0,.05,0]),sphere('core',.18,'amber',[0,.48,0]),
    ...[0,1,2,3,4].map(i=>{const a=i*Math.PI*2/5;return box(`ray-${i}`,[.12,.32,.1],'amber',[Math.sin(a)*.2,.48+Math.cos(a)*.2,0],[0,0,-a]);}),
  ]},
});
