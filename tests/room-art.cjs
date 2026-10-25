const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const script of source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
  if (script[1].trim()) new vm.Script(script[1]);
}
const drawing = source.slice(source.indexOf('const f=n=>'), source.indexOf("const WD=['일'"));
const skins = source.slice(source.indexOf('const SKINS='), source.indexOf('const SKIN_KEY='));
const manifest = JSON.parse(source.match(/const FURNITURE_ART=(.*);\nfunction drawBoardNotes/)[1]);
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
const near = (a, b, label, tolerance = .15) => assert(Math.abs(a - b) <= tolerance, `${label}: ${a} vs ${b}`);
const output = [];

const times = [{hour:10,time:'auto',expected:'day'},{hour:18,time:'auto',expected:'dusk'},{hour:23,time:'auto',expected:'night'},
  {hour:23,time:'day',expected:'day'},{hour:10,time:'dusk',expected:'dusk'},{hour:10,time:'night',expected:'night'}];
for (const {hour,time,expected} of times) for (const skin of ['beige', 'winter']) for (const populated of [false, true]) {
  const rooms = {};
  const docs = populated ? ['drawer', 'stack', 'board', 'wish', 'wish', 'wish', 'wish', 'trash'].map((place, i) => ({
    id: `test-${i}`, place, title: '<따뜻한 & 생각>', shelf: 1, blocks: [], photos: [], created: 1000
  })) : [];
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-10-25T12:00:00'])); }
    getHours() { return hour; }
  }
  const context = {
    Date: Clock, Math, Set, skin, roomTime:time, NOTE_COL: ['#F3E4C0', '#DDE6D8', '#F1DCD5', '#DFE5EA'],
    POS: { 1: '윗칸', 2: '가운데칸', 3: '아랫칸' }, wcats: [],
    esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    hashStr: () => 0, srcOf: () => '', shelfName: k => '생각 ' + k, all: () => docs,
    byNew: (a, b) => b.created - a.created,
    nextDday: () => populated ? { title: '긴 여행 일정 <&>', lab: 'D-1000' } : null,
    tops: (place, shelf) => docs.filter(d => d.place === place && (place !== 'drawer' || d.shelf === shelf)),
    $: selector => ({ set innerHTML(value) { rooms[selector] = value; } })
  };
  vm.createContext(context);
  vm.runInContext(skins + '\n' + drawing + "\nconst WD=['일','월','화','수','목','금','토'];renderRoom();", context);
  assert.equal(Object.keys(rooms).length, 3);
  const scenes = {};
  for (const [room, svg] of Object.entries(rooms)) {
    assert(!/undefined|NaN|<따뜻한/.test(svg), `${room}: valid escaped SVG`);
    const parts = {};
    for (const match of svg.matchAll(/<svg class="furniture-viewport"[^>]+>/g)) {
      const a = attrs(match[0]), [,, bw, bh] = a.viewBox.split(' ').map(Number);
      const sx = Number(a.width) / bw, sy = Number(a.height) / bh;
      assert(Math.abs(sx / sy - 1) < .004, `${a['data-art']}: image must not stretch`);
      parts[a['data-art']] = { x: +a.x, y: +a.y, w: +a.width, h: +a.height };
    }
    for (const match of svg.matchAll(/href="(assets\/[^"]+)"/g)) assert(fs.existsSync(path.join(root, match[1])), match[1]);
    const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(ids.length, new Set(ids).size, `${room}: unique SVG IDs`);
    for (const match of svg.matchAll(/url\(#([^)]+)\)/g)) assert(ids.includes(match[1]), `${room}: missing ${match[1]}`);
    scenes[room] = parts;
    output.push({ hour, skin, populated, room, svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 740">' + svg + '</svg>' });
  }
  const desk = scenes['#room']['continuous-desk'], other = scenes['#room2']['continuous-desk'];
  near(desk.x - other.x, 360, 'single desk across swipe boundary');
  near(desk.y, other.y, 'matching desk height');
  near(desk.w, other.w, 'matching desk width');
  near(desk.y + desk.h, 604, 'desk feet meet the floor');
  const surface = desk.y + desk.h * manifest['continuous-desk'].surface;
  for (const [room, name] of [['#room2', 'computer']]) {
    const p = scenes[room][name];
    near(p.y + p.h, surface, `${name}: base meets the tabletop`);
  }
  const cabinet = scenes['#room']['drawer-cabinet'], book = scenes['#room'].scrapbook;
  near(book.y + book.h * manifest.scrapbook.baseline, cabinet.y + cabinet.h * manifest['drawer-cabinet'].surface, 'book body rests on cabinet');
  const garments = Object.keys(scenes['#room2']).filter(n => n.startsWith('garment-'));
  assert.equal(garments.length, populated ? 4 : 0, 'clothes follow live wish count');
  assert(scenes['#room']['chair-backless'], 'original upholstered seat is restored without backrest');
  assert.equal(manifest['chair-backless'].src,manifest.chair.src,'same chair artwork retained');
  assert(scenes['#room']['chair-backless'].x>desk.x+(238-61)/1415*desk.w+3,'chair clears desk leg silhouette');
  const window=scenes['#room2']['window-frame'];
  assert(window.x>=5 && window.x+window.w<=350,'both right-window edges remain in the page');
  assert(rooms['#room2'].includes('class="connected-ladder"'),'full connected ladder present');
  near(window.w,scenes['#room']['window-frame'].w,'both window widths match');
  near(window.h,scenes['#room']['window-frame'].h,'both window heights match');
  assert.equal(rooms['#room'].includes('class="window-light"'),expected!=='night','day and dusk reflections remain visible');
  assert(!scenes['#room2'].curtain, 'right room has no curtain');
  assert(scenes['#room'].curtain, 'left curtain remains');
  assert(!scenes['#room2']['calendar-base'], 'calendar remains removed');
  assert(!rooms['#room2'].includes('class="wall-picture"'), 'standalone wall picture removed');
  assert(!rooms['#room2'].includes('assets/loft-reference-source.jpg'), 'closed triangular loft replaced');
  assert(scenes['#room2']['loft-platform'], 'approved open platform artwork present');
  assert(rooms['#room2'].includes('data-structure="open-mezzanine"'), 'ceiling is part of the room');
  assert(scenes['#roomUp']['attic-bed'], 'matching daybed in upstairs interior');
  near(scenes['#roomUp']['attic-bed'].y+scenes['#roomUp']['attic-bed'].h,554,'daybed rests on the floor');
  assert(rooms['#roomUp'].includes('data-go="box"'), 'memo box remains accessible upstairs');
  assert(rooms['#roomUp'].includes('data-nav="down"'), 'return from upstairs remains accessible');
  assert(rooms['#roomUp'].includes('class="attic-window"'), 'upstairs window responds to time theme');
  for(const room of ['#room2','#roomUp']){
    const lamp=attrs(rooms[room].match(/<g class="loft-pendant"[^>]+>/)[0]);
    assert.equal(lamp['data-lit'],String(expected!=='day'),'day bulbs unlit, dusk/night bulbs warm');
  }
  const shelf=attrs(rooms['#room2'].match(/<svg class="bookcase-three"[^>]+>/)[0]);
  assert.equal(shelf['data-tiers'],'3','larger three-tier bookcase');
  assert(+shelf.width>=100,'shelf content is enlarged');
  near(+shelf.y + +shelf.height,572,'bookcase base meets floor');
  assert(rooms['#room2'].includes('data-direction="right"'),'ladder exits toward right');
  assert.equal(rooms['#room2'].includes('class="loft-day-lamp"'),expected==='day','daytime attic lamp is dimmed');
  assert(scenes['#room2']['clothes-rail'].y<335, 'clothes rail reaches higher');
  near(scenes['#room2']['clothes-rail'].y+scenes['#room2']['clothes-rail'].h,566,'clothes rail stays on floor');
  assert.equal(rooms['#room'].includes('class="night-lighting"'),expected==='night','warm wall bulbs only light at night');
  for (const room of ['#room','#room2']) assert(rooms[room].includes('data-period="'+expected+'"'), 'manual time overrides device clock');
  assert.equal(rooms['#room'].includes('class="basket-front"'),populated,'basket front covers paper only when occupied');
  if(populated)assert(rooms['#room'].indexOf('class="basket-front"')>rooms['#room'].indexOf('class="basket-contents"'),'paper is behind the rim');
  for (const action of ['data-go="dday"', 'data-go="wish"', 'data-soon="pc"', 'data-soon="shelf"', 'aria-label="옥탑방으로 올라가기"']) {
    assert(rooms['#room2'].includes(action), action);
  }
}
if (process.env.ROOM_ART_OUTPUT) fs.writeFileSync(process.env.ROOM_ART_OUTPUT, JSON.stringify(output));
console.log('Passed 24 scene states: automatic/manual time, image proportions, surface contact, basket layering and memo actions.');
