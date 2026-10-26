'use strict';
(() => {
  const {groups, schoolLogo} = window.FLOWER_DATA;
  const $ = id => document.getElementById(id);
  const palettes = [
    {light:'#f0b6bd',dark:'#af526a',wash:'#edcbd0'},
    {light:'#f6ccac',dark:'#cb8769',wash:'#f0ddc8'},
    {light:'#d3c0dc',dark:'#9b7ba6',wash:'#e0d3e6'},
    {light:'#f3dba1',dark:'#c5a267',wash:'#efe3bc'},
    {light:'#eab5c8',dark:'#bd6f91',wash:'#eed4de'},
    {light:'#d8dca9',dark:'#9ba467',wash:'#e2e6c3'}
  ];
  const arabic = new Intl.NumberFormat('ar');
  let activeGroup = null, activeStudent = null, lastFlower = null;
  let openingTimer = null, noticeTimer = null, confettiFrame = null, busy = false;
  let motion = !matchMedia('(prefers-reduced-motion: reduce)').matches, sound = false;
  let context = null, audioNodes = [];
  const opened = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem('gheras-flowers-settings') || 'null');
    if(saved) { motion = typeof saved.motion === 'boolean' ? saved.motion : motion; sound = saved.sound === true; }
  } catch {}

  function flowerSvg(index, id, extra='') {
    const p = palettes[index % palettes.length];
    const petal = (angle, inner=false) => `<g class="petal ${inner?'inner-petal':''}" style="--a:${angle}deg"><ellipse cx="100" cy="69" rx="${inner?21:22}" ry="${inner?37:43}" fill="url(#${id})" stroke="${p.dark}" stroke-opacity=".10" stroke-width=".7"/><path d="M100 32 Q93 64 100 105" fill="none" stroke="#fff" stroke-opacity=".19"/></g>`;
    return `<svg class="flower-svg ${extra}" viewBox="0 0 200 260" fill="none" aria-hidden="true"><defs><linearGradient id="${id}" x1="81" y1="25" x2="115" y2="109" gradientUnits="userSpaceOnUse"><stop stop-color="${p.light}"/><stop offset=".63" stop-color="${p.light}"/><stop offset="1" stop-color="${p.dark}"/></linearGradient></defs><path d="M99 115 C90 153 108 193 97 243" stroke="#7e9368" stroke-width="3.2" stroke-linecap="round"/><path d="M99 194 C66 190 50 169 49 155 C75 154 96 174 99 194Z" fill="#a0ae7e"/><path d="M99 194 L58 164" stroke="#d4d8b1" stroke-width="1"/><path d="M100 170 C124 162 141 141 139 127 C114 132 99 151 100 170Z" fill="#829a6b"/><path d="M101 168 L133 136" stroke="#c0cc9d" stroke-width="1"/><path class="sepal" d="M100 128 Q79 119 77 99 Q93 104 100 116 Q108 102 123 100 Q120 120 100 128" fill="#889e6d"/>${[-90,-45,0,45,90,135,180,225].map(a=>petal(a)).join('')}${[-25,47,119,191,263].map(a=>petal(a,true)).join('')}<g class="flower-center"><circle cx="100" cy="100" r="13" fill="#d5ae61"/><circle cx="100" cy="100" r="9" fill="#e8c982"/>${Array.from({length:9},(_,i)=>`<circle cx="${100+Math.cos(i*2.399)*Math.sqrt(i)*2.4}" cy="${100+Math.sin(i*2.399)*Math.sqrt(i)*2.4}" r="1.1" fill="#b6904f"/>`).join('')}</g></svg>`;
  }

  function normalize(name) {
    return name.replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/\s+/g,'').trim();
  }
  function key(index) { return `${activeGroup.id}:${index}`; }
  function saveSettings() {
    try { localStorage.setItem('gheras-flowers-settings',JSON.stringify({motion,sound})); } catch {}
  }
  function settings() {
    document.documentElement.classList.toggle('motion-off',!motion);
    $('motionToggle').setAttribute('aria-pressed',String(motion));
    $('motionToggle').innerHTML = `<span aria-hidden="true">✧</span> ${motion?'الحركة':'بلا حركة'}`;
    $('soundToggle').setAttribute('aria-pressed',String(sound));
    $('soundToggle').innerHTML = `<span aria-hidden="true">♫</span> ${sound?'الصوت':'صامت'}`;
    if(!motion) stopPetals();
  }
  function stopAudio() {
    for(const node of audioNodes) { try { node.stop(); } catch {} }
    audioNodes = [];
  }
  async function chime() {
    if(!sound || document.hidden) return;
    try {
      context ||= new (window.AudioContext || window.webkitAudioContext)();
      await context.resume();
      if(!sound || document.hidden) return;
      stopAudio();
      [523.25,659.25,783.99,1046.5].forEach((hz,i) => {
        const osc=context.createOscillator(), gain=context.createGain(), start=context.currentTime+i*.11;
        osc.type='sine'; osc.frequency.value=hz;
        gain.gain.setValueAtTime(0,start); gain.gain.linearRampToValueAtTime(.055,start+.035); gain.gain.exponentialRampToValueAtTime(.0001,start+.7);
        osc.connect(gain); gain.connect(context.destination); osc.start(start); osc.stop(start+.8);
        osc.onended=()=>{ osc.disconnect();gain.disconnect();audioNodes=audioNodes.filter(n=>n!==osc); };
        audioNodes.push(osc);
      });
    } catch {}
  }
  function notice(message) {
    $('status').textContent=message; $('status').hidden=false;
    clearTimeout(noticeTimer); noticeTimer=setTimeout(()=>$('status').hidden=true,4500);
  }
  function renderClasses() {
    const target=$('classChoices');
    for(const [i,group] of groups.entries()) {
      const button=document.createElement('button'); button.type='button'; button.className='class-card';
      button.innerHTML=`<small>الشعبة ${group.section} · ${arabic.format(group.students.length)} زهرة</small><strong>${group.title}</strong><span class="class-enter">إلى حديقة صفّي <span aria-hidden="true">←</span></span><span class="class-number" aria-hidden="true">0${i+1}</span><span class="class-art is-open">${flowerSvg(i,`class-flower-${i}`)}</span>`;
      button.onclick=()=>enterGarden(group.id); target.append(button);
    }
  }
  function enterGarden(id) {
    cancelOpening(); activeGroup=groups.find(g=>g.id===id);
    $('home').hidden=true; $('garden').hidden=false; $('searchName').value='';
    $('gardenEyebrow').textContent=`حديقة ${activeGroup.title} · الشعبة ${activeGroup.section}`;
    renderGarden(); window.scrollTo({top:0,behavior:'instant'}); $('gardenTitle').focus({preventScroll:true});
  }
  function renderGarden() {
    if(!activeGroup) return;
    const q=normalize($('searchName').value),grid=$('flowerGrid'); grid.replaceChildren();
    let count=0;
    activeGroup.students.forEach((name,i)=>{
      if(!normalize(name).includes(q)) return;
      count++;
      const button=document.createElement('button'); button.type='button'; button.className='flower-button';
      button.dataset.student=String(i); button.classList.toggle('opened',opened.has(key(i)));
      button.style.setProperty('--wash',palettes[i%palettes.length].wash); button.style.setProperty('--delay',`${-(i%7)*.8}s`);
      button.setAttribute('aria-label',`افتح زهرة التقدير للطالب ${name}`);
      const art=document.createElement('span'); art.className='flower-art'; art.innerHTML=flowerSvg(i,`garden-${activeGroup.id}-${i}`)+'<span class="mini-letter" aria-hidden="true">♡</span>';
      const label=document.createElement('span'); label.className='student-name'; label.textContent=name;
      const hint=document.createElement('span'); hint.className='flower-invite'; hint.textContent=opened.has(key(i))?'✓ أزهرت رسالتك · افتحها مجددًا':'المس زهرتك لتتفتح';
      button.append(art,label,hint); button.onclick=()=>openFlower(i,button); grid.append(button);
    });
    $('emptyState').hidden=count!==0;
    $('resultCount').textContent=`${arabic.format(count)} من ${arabic.format(activeGroup.students.length)} زهرة`;
    $('bloomCount').textContent=arabic.format(activeGroup.students.filter((_,i)=>opened.has(key(i))).length);
  }
  function openFlower(index,button) {
    if(busy) return;
    busy=true;activeStudent={name:activeGroup.students[index],index,group:activeGroup};lastFlower=button;
    button.classList.add('blooming'); button.setAttribute('aria-busy','true');
    chime();
    openingTimer=setTimeout(revealCard,motion?1450:0);
  }
  function revealCard() {
    clearTimeout(openingTimer);openingTimer=null;
    if(!activeStudent || $('garden').hidden) { cancelOpening();return; }
    busy=false; opened.add(key(activeStudent.index));
    if(lastFlower) {lastFlower.classList.remove('blooming');lastFlower.classList.add('opened');lastFlower.removeAttribute('aria-busy');}
    $('cardName').textContent=activeStudent.name;
    $('cardClass').textContent=`${activeStudent.group.title} · الشعبة ${activeStudent.group.section}`;
    $('certificateFlower').innerHTML=flowerSvg(activeStudent.index,'award-flower'); $('certificateFlower').classList.add('is-open');
    $('cardDialog').showModal();$('cardDialog').scrollTop=0;document.body.classList.add('dialog-open');
    $('closeCard').focus({preventScroll:true});petalShower();
  }
  function cancelOpening() {
    clearTimeout(openingTimer);openingTimer=null;busy=false;
    if(lastFlower){lastFlower.classList.remove('blooming');lastFlower.removeAttribute('aria-busy');}
  }
  function closeCard() {
    if($('cardDialog').open) $('cardDialog').close();
  }
  function onClose() {
    document.body.classList.remove('dialog-open');stopPetals();stopAudio();
    const index=activeStudent?.index;renderGarden();
    if(index!==undefined) $('flowerGrid').querySelector(`[data-student="${index}"]`)?.focus({preventScroll:true});
  }
  function goHome() {
    closeCard();cancelOpening();activeGroup=null;activeStudent=null;
    $('garden').hidden=true;$('home').hidden=false;window.scrollTo({top:0,behavior:'instant'});
    $('classChoices').querySelector('button')?.focus({preventScroll:true});
  }
  function stopPetals() {
    cancelAnimationFrame(confettiFrame);confettiFrame=null;
    const c=$('petalCanvas');c.getContext('2d').clearRect(0,0,c.width,c.height);
  }
  function petalShower() {
    stopPetals();if(!motion||document.hidden)return;
    const c=$('petalCanvas'),d=Math.min(devicePixelRatio||1,2),w=innerWidth,h=innerHeight;
    c.width=w*d;c.height=h*d;const ctx=c.getContext('2d');ctx.scale(d,d);
    const petals=Array.from({length:55},(_,i)=>({x:Math.random()*w,y:-30-Math.random()*h*.5,v:60+Math.random()*80,a:Math.random()*7,s:4+Math.random()*6,phase:Math.random()*7,color:palettes[i%palettes.length].light}));
    let first=null,previous=null;
    function frame(now) {
      first??=now;previous??=now;const dt=Math.min((now-previous)/1000,.05);previous=now;
      ctx.clearRect(0,0,w,h);const elapsed=(now-first)/1000;
      for(const p of petals){p.y+=p.v*dt;p.x+=Math.sin(elapsed*1.5+p.phase)*25*dt;p.a+=dt;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);ctx.globalAlpha=Math.min(1,Math.max(0,5-elapsed));ctx.fillStyle=p.color;ctx.beginPath();ctx.ellipse(0,0,p.s,p.s*.5,0,0,Math.PI*2);ctx.fill();ctx.restore();}
      if(elapsed<5)confettiFrame=requestAnimationFrame(frame);else stopPetals();
    }
    confettiFrame=requestAnimationFrame(frame);
  }

  function wrapText(ctx,text,maxWidth) {
    const lines=[];let line='';
    for(const word of text.split(/\s+/)){const next=line?`${line} ${word}`:word;if(line&&ctx.measureText(next).width>maxWidth){lines.push(line);line=word;}else line=next;}
    if(line)lines.push(line);return lines;
  }
  async function svgImage(svg) {
    const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
    try {const image=new Image();image.src=url;await image.decode();return image;} finally {URL.revokeObjectURL(url);}
  }
  async function downloadCard() {
    if(!activeStudent)return;
    const selected={...activeStudent}; $('downloadCard').disabled=true;
    try {
      await document.fonts.ready;
      const canvas=document.createElement('canvas');canvas.width=1500;canvas.height=1800;
      const x=canvas.getContext('2d');
      const bg=x.createLinearGradient(0,0,1500,1800);bg.addColorStop(0,'#f6f6e9');bg.addColorStop(.5,'#fffdf5');bg.addColorStop(1,'#f8eeea');x.fillStyle=bg;x.fillRect(0,0,1500,1800);
      x.strokeStyle='#cab38b';x.lineWidth=3;x.strokeRect(42,42,1416,1716);x.strokeStyle='#ded2b8';x.lineWidth=2;x.strokeRect(65,65,1370,1670);
      const logo=new Image();logo.src=schoolLogo;await logo.decode();
      const logoW=220,logoH=logoW*logo.naturalHeight/logo.naturalWidth;x.drawImage(logo,750-logoW/2,103,logoW,logoH);
      x.textAlign='center';x.direction='rtl';
      const put=(text,y,size,color,bold=false)=>{x.fillStyle=color;x.font=`${bold?'bold ':''}${size}px Tahoma,Arial`;x.fillText(text,750,y);};
      put('غراس الأخلاق · حديقة أبطال القرآن',310,25,'#8b9479');
      let svg=flowerSvg(selected.index,'export-flower');
      svg=svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ').replace('viewBox="0 0 200 260"','viewBox="0 0 200 180"');
      svg=svg.replace(/(<\/defs>)[\s\S]*?(?=<g class="petal)/,'$1');
      svg=svg.replace(/<g class="petal (inner-petal)?" style="--a:([^d]+)deg">/g,(_,inner,angle)=>`<g transform="rotate(${angle} 100 100)${inner?' translate(100 100) scale(.72) translate(-100 -100)':''}">`);
      const art=await svgImage(svg);x.drawImage(art,610,345,280,252);
      put('بطاقة شكر وتقدير',655,27,'#a48a60');put('أزهرتَ حضورًا.',765,85,'#a15368');put('إلى طالبنا العزيز',850,28,'#97917d');
      let font=66,nameLines;
      do{x.font=`bold ${font}px Tahoma,Arial`;nameLines=wrapText(x,selected.name,1190);if(nameLines.length<=2)break;font-=2;}while(font>40);
      nameLines.forEach((line,i)=>put(line,960+i*92,font,'#384f3d',true));
      const classY=1015+(nameLines.length-1)*92;
      x.strokeStyle='#d9d2bd';x.lineWidth=1;x.beginPath();x.moveTo(450,classY-8);x.lineTo(1050,classY-8);x.stroke();
      put(`${selected.group.title} · الشعبة ${selected.group.section}`,classY+43,28,'#8b8f74');
      const bodyY=Math.max(classY+145,1210);
      put('شكرًا لحضورك وتفاعلك في حصص القرآن الكريم.',bodyY,34,'#788570');
      put('بكلّ خطوةٍ تتعلّمها، تنمو زهرة جميلة.',bodyY+72,34,'#788570');
      put('بارك الله فيك، وزادك علمًا وخيرًا.',bodyY+144,34,'#657554');
      put('معلّمك المحبّ',1550,26,'#9a9480');put('عبد الرحمن نصر الله',1620,47,'#4c684e');
      put('لك في حديقتنا زهرة، وفي قلوبنا تقدير.',1710,26,'#ae987e');
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      if(!blob)throw new Error('No image');
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`أزهار التقدير - ${selected.name}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
      notice('بطاقة زهرتك جاهزة للحفظ 🌷');
    }catch{notice('تعذّر حفظ الصورة. يمكنك طباعة البطاقة من زر الطباعة.');}
    finally{$('downloadCard').disabled=false;}
  }

  document.querySelectorAll('.school-logo').forEach(image=>image.src=schoolLogo);
  $('heroBouquet').innerHTML=[0,1,4,3,2].map((p,i)=>flowerSvg(p,`hero-flower-${i}`,`hero-stem-${i}`)).join('');
  $('heroBouquet').classList.add('is-open');
  $('soundToggle').onclick=()=>{sound=!sound;saveSettings();settings();if(sound)chime();else stopAudio();};
  $('motionToggle').onclick=()=>{motion=!motion;saveSettings();settings();if(!motion&&busy)revealCard();};
  $('searchName').addEventListener('input',()=>{cancelOpening();renderGarden();});
  $('clearSearch').onclick=()=>{$('searchName').value='';renderGarden();$('searchName').focus();};
  $('backHome').onclick=goHome;$('brandHome').onclick=e=>{e.preventDefault();goHome();};
  $('closeCard').onclick=$('returnGarden').onclick=closeCard;
  $('cardDialog').addEventListener('close',onClose);
  $('cardDialog').addEventListener('click',e=>{if(e.target!==$('cardDialog'))return;const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeCard();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&busy){cancelOpening();lastFlower?.focus();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stopPetals();stopAudio();if(busy)cancelOpening();}});
  $('downloadCard').onclick=downloadCard;$('printCard').onclick=()=>window.print();
  settings();renderClasses();
})();
