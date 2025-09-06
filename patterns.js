// Pattern Packs für Anfänger / Aufsteiger / Profi
// Jede Factory liefert ein Objekt { steps: [ { items:[{side, style}] } ... ] }
// side: -1 (links) | +1 (rechts)
// style: 'auto' | 'straight' | 's-h' (horizontale S) | 's-v' (vertikale S)

const L = -1, R = +1;
const rnd = (a,b)=> a + Math.random()*(b-a);
const pick = arr => arr[Math.floor(Math.random()*arr.length)];
const randSide = ()=> Math.random()<0.5 ? L : R;

function patLR(){
  return { name:'LR', steps:[
    { items:[{ side:L, style:'auto' }] },
    { items:[{ side:R, style:'auto' }] },
  ]};
}
function patRL(){
  return { name:'RL', steps:[
    { items:[{ side:R, style:'auto' }] },
    { items:[{ side:L, style:'auto' }] },
  ]};
}
function patLRStraight(){
  return { name:'LRStraight', steps:[
    { items:[{ side:L, style:'straight' }] },
    { items:[{ side:R, style:'straight' }] },
  ]};
}
function patRLStraight(){
  return { name:'RLStraight', steps:[
    { items:[{ side:R, style:'straight' }] },
    { items:[{ side:L, style:'straight' }] },
  ]};
}
function patDoubleStraight(){
  // Doppelfaust – zwei gerade gleichzeitig
  return { name:'DoubleStraight', steps:[
    { items:[{ side:L, style:'straight' }, { side:R, style:'straight' }] },
  ]};
}
function patS_H(){
  // Eine horizontale S-Kurve, Seite zufällig
  return { name:'S-H', steps:[
    { items:[{ side: randSide(), style:'s-h' }] },
  ]};
}
function patS_V(){
  // Eine vertikale S-Kurve (oben→unten driftend), Seite zufällig
  return { name:'S-V', steps:[
    { items:[{ side: randSide(), style:'s-v' }] },
  ]};
}
function patMixStraightThenS(){
  // Erst gerade auf Seite A, dann S (H oder V) auf Seite B
  const a = randSide(); const b = -a;
  const sStyle = Math.random()<0.5 ? 's-h' : 's-v';
  return { name:'MixStraightThenS', steps:[
    { items:[{ side:a, style:'straight' }] },
    { items:[{ side:b, style:sStyle }] },
  ]};
}

function patMixStraightThenSV(){
  // Erst gerade auf Seite A, dann vertikale S auf Seite B
  const a = randSide(); const b = -a;
  return { name:'MixStraightThenSV', steps:[
    { items:[{ side:a, style:'straight' }] },
    { items:[{ side:b, style:'s-v' }] },
  ]};
}
function patTriplet(){
  // Dreierfolge (lesbarer Rhythmus)
  const a = randSide(), b = -a;
  const midStyle = Math.random()<0.5 ? 's-h' : 's-v';
  return { name:'Triplet', steps:[
    { items:[{ side:a, style:'auto' }] },
    { items:[{ side:b, style:midStyle }] },
    { items:[{ side:a, style:'auto' }] },
  ]};
}

function patTripletV(){
  // Dreierfolge mit vertikaler S in der Mitte
  const a = randSide(), b = -a;
  return { name:'TripletV', steps:[
    { items:[{ side:a, style:'auto' }] },
    { items:[{ side:b, style:'s-v' }] },
    { items:[{ side:a, style:'auto' }] },
  ]};
}

// Pools mit einfacher Gewichtung durch Mehrfachnennung
const POOLS = {
  'Anfänger': [
    patLR, patLR, patLR, patLR,
    patRL, patRL, patRL,
    patDoubleStraight,
    patMixStraightThenS
  ],
  'Aufsteiger': [
    patLR, patLR,
    patRL, patRL,
    patDoubleStraight, patDoubleStraight,
    patS_H, patS_H,
    patS_V, patS_V,
    patMixStraightThenS, patMixStraightThenS,
    patTriplet
  ],
  'Profi': [
    patDoubleStraight, patDoubleStraight, patDoubleStraight,
    patS_H, patS_H, patS_H, patS_H,
    patS_V, patS_V, patS_V, patS_V,
    patMixStraightThenS, patMixStraightThenS, patMixStraightThenS,
    patTriplet, patTriplet
  ],
  'Doppelfaust': [
    // ausschließlich simultane Geraden
    patDoubleStraight
  ],
  'DuckWeave': [
    patS_V, patS_V, patS_V, patS_V,
    patMixStraightThenSV, patMixStraightThenSV,
    patTripletV, patTripletV
  ],
  'JabOnly': [
    patLRStraight, patLRStraight,
    patRLStraight, patRLStraight,
    patDoubleStraight
  ]
};

export function pickPattern(diffName){
  const pool = POOLS[diffName] || POOLS['Aufsteiger'];
  return pick(pool)();
}
