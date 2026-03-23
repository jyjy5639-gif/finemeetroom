// ── 관리자 암호 ────────────────────────────────
const ADMIN_PW = '0132';
function authThen(fn) {
  const pw = prompt('관리자 암호를 입력하세요.');
  if (pw === null) return;
  if (pw === ADMIN_PW) { fn(); }
  else { toast('암호가 올바르지 않습니다', '🔒'); }
}

// ── 이메일 알림 (EmailJS) ──────────────────────
// EmailJS 설정: https://emailjs.com 에서 발급
const EMAILJS_SERVICE_ID  = 'finepartners0114';   // 예: 'service_abc123'
const EMAILJS_TEMPLATE_ID = 'template_p9a1wdd';   // 예: 'template_xyz456'
const EMAILJS_PUBLIC_KEY  = 'GMOOURMEXUo4WBLxL';   // Account > Public Key

async function sendReservationEmail(emails, info) {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) return;
  if (!emails || emails.length === 0) return;
  try {
    emailjs.init(EMAILJS_PUBLIC_KEY);
    for (const email of emails) {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        to_email:   email,
        name:       info.name,
        room_name:  info.room,
        date:       info.date,
        start_time: info.start,
        end_time:   info.end,
        dept:       info.dept,
        purpose:    info.purpose,
      });
    }
  } catch(e) {
    console.warn('이메일 전송 실패:', e);
  }
}

// ── 기본 회의실 / 부서 ────────────────────────
const DEFAULT_ROOMS = [
  {name:'회의실1',  cap:6,  color:'#e8522a', light:'#fdf0ec', textColor:'#b03018', features:['모니터 연결 가능', '화이트보드']},
  {name:'회의실2',  cap:6,  color:'#2a7ae8', light:'#ecf2fd', textColor:'#1a58b0', features:['모니터 연결 가능', '화이트보드']},
  {name:'회의실3',  cap:6,  color:'#2ab87a', light:'#ecfaf3', textColor:'#1a885a', features:['모니터 연결 가능', '화이트보드']},
  {name:'회의실4',  cap:6,  color:'#c7832a', light:'#fdf5ec', textColor:'#8f5a18', features:['모니터 연결 가능', '화이트보드']},
  {name:'대회의실', cap:12, color:'#7a2ae8', light:'#f3ecfd', textColor:'#5a18b0', features:['모니터 연결 가능', '화이트보드']},
];
const DEFAULT_DEPTS = ['투자본부','경영지원본부','투자1부','투자2부','투자3부','투자업무부','자금부','회계부','리스크관리부','인사총무부','기타'];

let ROOMS = [...DEFAULT_ROOMS];
let DEPTS = [...DEFAULT_DEPTS];
let USERS = []; // {name, email}

async function loadRoomsAndDepts() {
  try {
    const snap = await db.collection('settings').get();
    snap.docs.forEach(d => {
      if (d.id === 'rooms' && Array.isArray(d.data().value)) ROOMS = d.data().value;
      if (d.id === 'depts' && Array.isArray(d.data().value)) DEPTS = d.data().value;
      if (d.id === 'users' && Array.isArray(d.data().value)) USERS = d.data().value;
    });
  } catch(e) { console.warn('설정 로드 실패, 기본값 사용:', e.message); }
}

async function saveSettingToDb(key, value) {
  await db.collection('settings').doc(key).set({ value, updated_at: new Date().toISOString() });
}

function makeRoomColors(hex) {
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return { light:`rgba(${r},${g},${b},0.08)`, textColor:`rgb(${Math.round(r*.7)},${Math.round(g*.7)},${Math.round(b*.7)})` };
}

// ── Firebase ───────────────────────────────────
let db = null;
const CFG_API_KEY = 'meetroom_firebase_apikey';
const CFG_PROJ_ID = 'meetroom_firebase_projectid';

function initFirebase() {
  const cfg = window.MEETROOM_CONFIG || {};
  const apiKey    = localStorage.getItem(CFG_API_KEY)  || cfg.firebaseApiKey    || '';
  const projectId = localStorage.getItem(CFG_PROJ_ID)  || cfg.firebaseProjectId || '';
  if (!apiKey || !projectId) return false;
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp({
        apiKey,
        projectId,
        authDomain: `${projectId}.firebaseapp.com`,
      });
    }
    db = firebase.firestore();
    return true;
  } catch(e) { console.error('Firebase init error:', e); return false; }
}

async function saveConfig() {
  const apiKey    = document.getElementById('cfgApiKey').value.trim();
  const projectId = document.getElementById('cfgProjectId').value.trim();
  const btn = document.getElementById('setupBtn');
  if (!apiKey || !projectId) { showSetupError('API Key와 Project ID를 모두 입력해주세요.'); return; }
  btn.disabled = true; btn.textContent = '연결 확인 중...';
  localStorage.setItem(CFG_API_KEY, apiKey);
  localStorage.setItem(CFG_PROJ_ID, projectId);
  if (!initFirebase()) {
    showSetupError('Firebase 초기화 실패');
    btn.disabled = false; btn.textContent = '연결 확인 및 시작';
    return;
  }
  try {
    await db.collection('reservations').limit(1).get();
    startApp();
  } catch(e) {
    localStorage.removeItem(CFG_API_KEY); localStorage.removeItem(CFG_PROJ_ID);
    showSetupError('연결 실패: ' + e.message);
    btn.disabled = false; btn.textContent = '연결 확인 및 시작';
  }
}

function showSetupError(msg) {
  const el = document.getElementById('setupError');
  el.textContent = '❌ ' + msg; el.classList.add('show');
}

function resetConfig() {
  if (!confirm('Firebase 설정을 초기화하고 재설정 화면으로 돌아갑니다.')) return;
  localStorage.removeItem(CFG_API_KEY); localStorage.removeItem(CFG_PROJ_ID);
  location.reload();
}

async function startApp() {
  document.getElementById('setupScreen').style.display = 'none';
  document.getElementById('appHeader').style.display = 'flex';
  document.getElementById('appLayout').style.display = 'grid';
  await loadRoomsAndDepts();
  updateRoomSelectOptions();
  updateDeptSelectOptions();
  loadData();
  setInterval(loadData, 30000);
}

// ── 상태 ───────────────────────────────────────
let reservations = [];
let selDate = new Date(); selDate.setHours(0,0,0,0);
let calView = new Date(selDate);
let roomFilter = 'all', listFilter = 'all', page = 'grid';
let prefillRoom = null, prefillStart = null;
let isEditMode = false, editingResId = null;

const pad = n => String(n).padStart(2,'0');
const toDateStr = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const toMin = t => { const [h,m]=t.split(':').map(Number); return h*60+m; };
const fromMin = m => `${pad(Math.floor(m/60))}:${pad(m%60)}`;
const isToday = d => { const t=new Date(); return d.toDateString()===t.toDateString(); };

function getSlots(sh=9,eh=18){const s=[];for(let h=sh;h<eh;h++){s.push(`${pad(h)}:00`);s.push(`${pad(h)}:30`);}return s;}
function getResAt(ri,date,slot){const sm=toMin(slot),em=sm+30;return reservations.find(r=>r.room_idx===ri&&r.date===date&&toMin(r.start_time)<em&&toMin(r.end_time)>sm)||null;}
function hasConflict(ri,date,start,end){const sm=toMin(start),em=toMin(end);return reservations.some(r=>r.room_idx===ri&&r.date===date&&toMin(r.start_time)<em&&toMin(r.end_time)>sm);}
function countFree(ri,date){return getSlots().filter(s=>!getResAt(ri,date,s)).length;}

function setSyncState(state){
  const dot=document.getElementById('syncDot'), lbl=document.getElementById('syncLabel');
  if(!dot)return;
  dot.className='sync-dot'+(state==='loading'?' loading':state==='error'?' error':'');
  lbl.textContent=state==='loading'?'동기화 중...':state==='error'?'연결 오류':'실시간 공유 중';
}

async function loadData(){
  setSyncState('loading');
  try {
    const snap = await db.collection('reservations').get();
    reservations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setSyncState('ok'); render();
  } catch(e) { setSyncState('error'); toast('데이터 로드 실패: '+e.message,'❌'); }
}

function render(){
  const days=['일','월','화','수','목','금','토'];
  document.getElementById('hDate').textContent=`${selDate.getFullYear()}.${pad(selDate.getMonth()+1)}.${pad(selDate.getDate())} (${days[selDate.getDay()]})`;
  document.getElementById('viewTitle').textContent=isToday(selDate)?'오늘의 회의실 현황':`${selDate.getMonth()+1}월 ${selDate.getDate()}일 현황`;
  // 모바일 날짜 네비 업데이트
  const mdnDate = document.getElementById('mdnDate');
  const mdnDay  = document.getElementById('mdnDay');
  if(mdnDate) mdnDate.textContent=`${selDate.getMonth()+1}/${selDate.getDate()}`;
  if(mdnDay)  mdnDay.textContent=`${selDate.getFullYear()}년 ${days[selDate.getDay()]}요일${isToday(selDate)?' · 오늘':''}`;
  renderSidebar(); renderMiniCal(); renderOverview();
  if(page==='grid') renderGrid(); else if(page==='list') renderList();
}

function mobileDateMove(dir){
  selDate.setDate(selDate.getDate()+dir);
  render();
}
function mobileDateToday(){
  selDate=new Date(); selDate.setHours(0,0,0,0);
  render();
}

function renderSidebar(){
  const ds=toDateStr(selDate); let html='';
  ROOMS.forEach((r,i)=>{
    const free=countFree(i,ds);
    html+=`<div class="room-item${roomFilter===i?' active':''}" onclick="setRoomFilter(${i})">
      <div class="ri-dot" style="background:${r.color}"></div>
      <div style="flex:1"><div class="ri-name">${r.name}</div><div class="ri-cap">${r.cap}인실</div></div>
      <div class="ri-avail" style="color:${roomFilter===i?'inherit':r.color}">${free}</div>
    </div>`;
  });
  document.getElementById('sidebarRooms').innerHTML=html;
  document.getElementById('ri-all').className='room-item'+(roomFilter==='all'?' active':'');
}

function renderMiniCal(){
  const y=calView.getFullYear(),m=calView.getMonth();
  document.getElementById('mcTitle').textContent=`${y}년 ${m+1}월`;
  const first=new Date(y,m,1),last=new Date(y,m+1,0),today=new Date();today.setHours(0,0,0,0);
  let html=['S','M','T','W','T','F','S'].map(d=>`<div class="mc-dl">${d}</div>`).join('');
  for(let i=0;i<first.getDay();i++){const dd=new Date(y,m,-first.getDay()+1+i+1);html+=`<div class="mc-d other" onclick="pickDate(${dd.getFullYear()},${dd.getMonth()},${dd.getDate()})">${dd.getDate()}</div>`;}
  for(let d=1;d<=last.getDate();d++){const cur=new Date(y,m,d);let c='mc-d';if(cur.getTime()===today.getTime())c+=' today';if(cur.getTime()===selDate.getTime())c+=' sel';html+=`<div class="${c}" onclick="pickDate(${y},${m},${d})">${d}</div>`;}
  document.getElementById('mcGrid').innerHTML=html;
}

function renderOverview(){
  const ds=toDateStr(selDate),all=getSlots(); let html='';
  ROOMS.forEach((r,i)=>{
    const free=all.filter(s=>!getResAt(i,ds,s)).length;
    const bar=all.slice(0,24).map(s=>`<div class="ov-slot" style="background:${getResAt(i,ds,s)?r.color:'#e0dcd6'}"></div>`).join('');
    const featureStr = r.features && r.features.length > 0 ? r.features.join(', ') : '';
    html+=`<div class="ov-card${roomFilter===i?' selected':''}" onclick="setRoomFilter(${i})" style="border-top:3px solid ${r.color}">
      <div class="ov-room-name">${r.name}</div><div class="ov-capacity">${r.cap}인 · 09–18h</div>
      ${featureStr ? `<div class="ov-features">${featureStr}</div>` : ''}
      <div class="ov-avail" style="color:${r.color}">${free}</div><div class="ov-avail-label">슬롯 가능</div>
      <div class="ov-mini-bar">${bar}</div>
    </div>`;
  });
  document.getElementById('overviewGrid').innerHTML=html;
}

function renderGrid(){
  const ds=toDateStr(selDate), slots=getSlots(9,18);
  const rooms=roomFilter==='all'?ROOMS.map((_,i)=>i):[roomFilter];
  let thead=`<thead><tr><th class="time-col">TIME</th>`;
  rooms.forEach(ri=>{
    const featureStr = ROOMS[ri].features && ROOMS[ri].features.length > 0 ? `<div style="font-size:9px;color:var(--text-dim);margin-top:4px;">${ROOMS[ri].features.join(', ')}</div>` : '';
    thead+=`<th><div class="th-room"><div class="th-pip" style="background:${ROOMS[ri].color}"></div><div>${ROOMS[ri].name}<span style="color:var(--text-dim);font-size:10px;margin-left:3px;">(${ROOMS[ri].cap}인)</span>${featureStr}</div></div></th>`;
  });
  thead+=`</tr></thead>`;
  let tbody=`<tbody>`;
  slots.forEach(slot=>{
    tbody+=`<tr${slot.endsWith(':00')?' class="hour-start"':''}><td class="time-cell">${slot}</td>`;
    rooms.forEach(ri=>{
      const res=getResAt(ri,ds,slot);
      if(res){
        const r=ROOMS[ri];
        tbody+=`<td><div class="slot-booked" style="background:${r.light};color:${r.textColor}" onclick="openDetailModal('${res.id}')" title="${res.dept} · ${res.name}">
          <div class="sb-name">${res.name}</div><div class="sb-meta">${res.purpose}</div>
        </div></td>`;
      } else {
        tbody+=`<td><div class="slot-empty" onclick="openModalWith(${ri},'${slot}')"><span class="slot-add">＋</span></div></td>`;
      }
    });
    tbody+=`</tr>`;
  });
  document.getElementById('timeTable').innerHTML=thead+tbody+`</tbody>`;
}

function renderList(){
  const ds=toDateStr(selDate);
  let fHtml=`<button class="filter-chip${listFilter==='all'?' active':''}" onclick="setListFilter('all')">전체</button>`;
  ROOMS.forEach((r,i)=>{fHtml+=`<button class="filter-chip${listFilter===i?' active':''}" onclick="setListFilter(${i})"><div class="chip-dot" style="background:${r.color}"></div>${r.name}</button>`;});
  document.getElementById('listFilters').innerHTML=fHtml;
  let data=[...reservations].filter(r=>r.date===ds);
  if(listFilter!=='all') data=data.filter(r=>r.room_idx===listFilter);
  data.sort((a,b)=>a.room_idx-b.room_idx||toMin(a.start_time)-toMin(b.start_time));
  let tbody='';
  if(!data.length){
    tbody=`<tr class="empty-row"><td colspan="8">선택한 날짜에 예약이 없습니다</td></tr>`;
  } else {
    data.forEach(r=>{
      const rm=ROOMS[r.room_idx], ca=r.created_at?r.created_at.slice(0,16).replace('T',' '):'';
      tbody+=`<tr>
        <td><span class="room-badge" style="background:${rm.light};color:${rm.textColor}">${rm.name}</span></td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:12px">${r.date}</td>
        <td><span class="time-range">${r.start_time} ~ ${r.end_time}</span></td>
        <td>${r.dept}</td><td>${r.name}</td>
        <td style="color:var(--text-mid)">${r.purpose}</td>
        <td style="font-size:11px;color:var(--text-dim);font-family:'JetBrains Mono',monospace">${ca}</td>
        <td><button class="btn-cancel" onclick="confirmCancel('${r.id}')">취소</button></td>
      </tr>`;
    });
  }
  document.getElementById('listBody').innerHTML=tbody;
}

function switchPage(p){
  page=p;
  document.getElementById('pagGrid').style.display=p==='grid'?'':'none';
  document.getElementById('pagList').style.display=p==='list'?'':'none';
  document.getElementById('pagAdmin').style.display=p==='admin'?'':'none';
  document.querySelector('.sidebar').style.display=p==='admin'?'none':'';
  document.getElementById('appLayout').style.gridTemplateColumns=p==='admin'?'1fr':'220px 1fr';
  document.querySelector('.view-bar').style.display=p==='admin'?'none':'';
  document.querySelector('.overview-grid').style.display=p==='admin'?'none':'';
  document.querySelectorAll('.nav-tab').forEach((t,i)=>t.classList.toggle('active',i===(p==='grid'?0:p==='list'?1:2)));
  // 모바일 탭바 active
  ['grid','list','admin'].forEach(id=>{
    const el=document.getElementById('mtab-'+id);
    if(el) el.classList.toggle('active', id===p);
  });
  // 모바일 날짜 네비: 관리 탭이 아닐 때만 표시
  const mdn = document.getElementById('mobileDateNav');
  if(mdn) mdn.style.display = p==='admin' ? 'none' : '';
  if(p==='admin') renderAdmin(); else render();
}

function renderAdmin(){ renderRoomEditor(); renderDeptEditor(); renderUserEditor(); }

function renderRoomEditor(){
  const allFeatures = ['모니터 연결 가능', '화이트보드'];
  let html='';
  ROOMS.forEach((r,i)=>{
    const featureChecks = allFeatures.map(f =>
      `<label style="display:flex;align-items:center;gap:6px;font-size:12px;margin:6px 0;cursor:pointer;line-height:1;">
        <input type="checkbox" class="room-feature-${i}" value="${f}" ${r.features && r.features.includes(f) ? 'checked' : ''} style="margin:0;cursor:pointer;width:16px;height:16px;flex-shrink:0;">
        ${f}
      </label>`
    ).join('');
    html+=`<div class="room-editor-card" id="rcard-${i}">
      <input type="color" class="room-color-preview" value="${r.color}" id="rcolor-${i}" onchange="updateRoomPreview(${i})">
      <div style="flex:1">
        <input type="text" value="${r.name}" id="rname-${i}" placeholder="회의실 이름" style="display:block;width:100%;margin-bottom:6px;">
        <div style="font-size:10px;color:var(--text-mid);margin-bottom:4px;">특징:</div>
        <div style="padding:4px;border:1px solid var(--border);border-radius:4px;background:var(--bg);font-size:11px;">
          ${featureChecks}
        </div>
      </div>
      <div class="room-cap-wrap">
        <input type="number" value="${r.cap}" id="rcap-${i}" min="1" max="100" style="width:70px">
        <span class="room-cap-label">인</span>
      </div>
      <div style="width:10px;height:10px;border-radius:3px;background:${r.color};flex-shrink:0" id="rpip-${i}"></div>
      <button class="btn-del-room" onclick="deleteRoomEditor(${i})" title="삭제">×</button>
    </div>`;
  });
  document.getElementById('roomEditorList').innerHTML=html;
}

function updateRoomPreview(i){ document.getElementById(`rpip-${i}`).style.background=document.getElementById(`rcolor-${i}`).value; }

function addRoomEditor(){ ROOMS.push({name:'새 회의실',cap:6,color:'#888888',light:'rgba(136,136,136,0.08)',textColor:'#555555',features:[]}); renderRoomEditor(); }

function deleteRoomEditor(i){
  if(ROOMS.length<=1){toast('회의실은 최소 1개 이상 필요합니다','⚠️');return;}
  if(!confirm(`"${ROOMS[i].name}"을 삭제하시겠습니까?`))return;
  ROOMS.splice(i,1); renderRoomEditor();
}

async function saveRooms(){
  const newRooms=[];
  const allFeatures=['모니터 연결 가능','화이트보드'];
  document.querySelectorAll('[id^="rcard-"]').forEach((_,i)=>{
    const name=document.getElementById(`rname-${i}`).value.trim();
    const cap=parseInt(document.getElementById(`rcap-${i}`).value)||4;
    const color=document.getElementById(`rcolor-${i}`).value;
    const {light,textColor}=makeRoomColors(color);
    const selectedFeatures=[];
    allFeatures.forEach(feature=>{
      const checkbox=document.querySelector(`.room-feature-${i}[value="${feature}"]`);
      if(checkbox&&checkbox.checked){selectedFeatures.push(feature);}
    });
    if(name) newRooms.push({name,cap,color,light,textColor,features:selectedFeatures});
  });
  if(!newRooms.length){toast('회의실 이름을 입력해주세요','⚠️');return;}
  ROOMS=newRooms;
  try {
    await saveSettingToDb('rooms',ROOMS);
    updateRoomSelectOptions(); renderRoomEditor();
    const fb=document.getElementById('roomSaveFeedback');
    fb.classList.add('show'); setTimeout(()=>fb.classList.remove('show'),2500);
    toast('✅ 회의실 설정이 저장되었습니다');
  } catch(e){ toast('저장 실패: '+e.message,'❌'); }
}

function renderDeptEditor(){
  let html='';
  DEPTS.forEach((d,i)=>{
    html+=`<div class="dept-row">
      <input type="text" value="${d}" id="dept-${i}" placeholder="부서명">
      <button class="btn-del-room" onclick="deleteDept(${i})" title="삭제">×</button>
    </div>`;
  });
  document.getElementById('deptEditorList').innerHTML=html;
}

function addDeptEditor(){
  DEPTS.push(''); renderDeptEditor();
  setTimeout(()=>{ const els=document.querySelectorAll('[id^="dept-"]'); if(els.length) els[els.length-1].focus(); },50);
}

function deleteDept(i){
  if(DEPTS.length<=1){toast('부서는 최소 1개 이상 필요합니다','⚠️');return;}
  DEPTS.splice(i,1); renderDeptEditor();
}

async function saveDepts(){
  const newDepts=[];
  document.querySelectorAll('[id^="dept-"]').forEach(el=>{ const v=el.value.trim(); if(v) newDepts.push(v); });
  if(!newDepts.length){toast('부서명을 입력해주세요','⚠️');return;}
  DEPTS=newDepts;
  try {
    await saveSettingToDb('depts',DEPTS);
    updateDeptSelectOptions();
    const fb=document.getElementById('deptSaveFeedback');
    fb.classList.add('show'); setTimeout(()=>fb.classList.remove('show'),2500);
    toast('✅ 부서 목록이 저장되었습니다');
  } catch(e){ toast('저장 실패: '+e.message,'❌'); }
}

// ── 사용자 관리 ────────────────────────────────
function renderUserEditor(){
  let html='';
  USERS.forEach((u,i)=>{
    html+=`<div class="dept-editor-card" id="ucard-${i}" style="display:flex;gap:8px;align-items:center;">
      <input type="text" value="${u.name}" id="uname-${i}" placeholder="이름" style="flex:1">
      <input type="email" value="${u.email}" id="uemail-${i}" placeholder="이메일" style="flex:2">
      <button class="btn-del-room" onclick="deleteUser(${i})" title="삭제">×</button>
    </div>`;
  });
  const el = document.getElementById('userEditorList');
  if(el) el.innerHTML = html || '<div style="font-size:12px;color:var(--text-dim);padding:8px 0;">등록된 사용자가 없습니다.</div>';
}

function addUserEditor(){
  USERS.push({name:'',email:''}); renderUserEditor();
  setTimeout(()=>{ const els=document.querySelectorAll('[id^="uname-"]'); if(els.length) els[els.length-1].focus(); },50);
}

function deleteUser(i){
  USERS.splice(i,1); renderUserEditor();
}

async function saveUsers(){
  const newUsers=[];
  USERS.forEach((_,i)=>{
    const name=document.getElementById(`uname-${i}`)?.value.trim();
    const email=document.getElementById(`uemail-${i}`)?.value.trim();
    if(name&&email) newUsers.push({name,email});
  });
  USERS=newUsers;
  try {
    await saveSettingToDb('users',USERS);
    const fb=document.getElementById('userSaveFeedback');
    fb.classList.add('show'); setTimeout(()=>fb.classList.remove('show'),2500);
    toast('✅ 사용자 목록이 저장되었습니다');
  } catch(e){ toast('저장 실패: '+e.message,'❌'); }
}

function updateRoomSelectOptions(){
  const sel=document.getElementById('fRoom'), cur=sel.value;
  sel.innerHTML='<option value="">선택</option>'+ROOMS.map((r,i)=>`<option value="${i}">${r.name} (${r.cap}인)</option>`).join('');
  sel.value=cur;
}

function updateDeptSelectOptions(){
  const sel=document.getElementById('fDept'), cur=sel.value;
  sel.innerHTML='<option value="">선택</option>'+DEPTS.map(d=>`<option>${d}</option>`).join('');
  sel.value=cur;
}

function setRoomFilter(v){roomFilter=v;render();}
function setListFilter(v){listFilter=v;renderList();}
function pickDate(y,m,d){selDate=new Date(y,m,d);render();}
function calMove(dir){calView.setMonth(calView.getMonth()+dir);renderMiniCal();}

async function openEditModal(id) {
  if (!id) return;
  const res = reservations.find(r => r.id === id);
  if (!res) return;

  isEditMode = true;
  editingResId = id;

  document.getElementById('fRoom').value = res.room_idx;
  document.getElementById('fDate').value = res.date;
  document.getElementById('fDept').value = res.dept;
  document.getElementById('fName').value = res.name;
  document.getElementById('fPurpose').value = res.purpose;

  document.querySelector('.modal-title').textContent = '예약 수정';
  document.getElementById('btnConfirm').textContent = '수정 확정';

  // 시작 슬롯 빌드 후 기존 시간 복원
  buildStartSlots();
  document.getElementById('fStart').value = res.start_time;
  buildEndSlots();
  document.getElementById('fEnd').value = res.end_time;
  updatePill();

  closeDetailModal();
  document.getElementById('overlay').classList.add('open');
}

let detailResId=null;
function openDetailModal(id){
  const res=reservations.find(r=>r.id===id); if(!res)return;
  const room=ROOMS[res.room_idx]; detailResId=id;
  const bar=document.getElementById('detailRoomBar');
  bar.style.cssText=`background:${room.light};color:${room.textColor};border-radius:8px;padding:10px 14px;font-size:13px;font-weight:600;margin-bottom:16px;display:flex;align-items:center;gap:8px;`;
  bar.innerHTML=`<div style="width:10px;height:10px;border-radius:3px;background:${room.color}"></div>${room.name} (${room.cap}인)`;
  document.getElementById('detailDate').textContent=res.date;
  document.getElementById('detailTime').textContent=`${res.start_time} ~ ${res.end_time}`;
  document.getElementById('detailDept').textContent=res.dept;
  document.getElementById('detailName').textContent=res.name;
  document.getElementById('detailPurpose').textContent=res.purpose;
  document.getElementById('detailEmailContainer').innerHTML = '';
  buildDetailEmailRow('detailEmailContainer');
  document.getElementById('detailOverlay').classList.add('open');
}
function closeDetailModal(){ document.getElementById('detailOverlay').classList.remove('open'); detailResId=null; }
async function cancelFromDetail(){
  if(!detailResId)return;
  if(!confirm('예약을 취소하시겠습니까?'))return;
  const idToDelete = detailResId;
  closeDetailModal(); setSyncState('loading');
  try { await db.collection('reservations').doc(idToDelete).delete(); toast('예약이 취소되었습니다','🗑️'); await loadData(); }
  catch(e){ setSyncState('error'); toast('취소 실패: '+e.message,'❌'); }
}

async function confirmCancel(id){
  if(!confirm('예약을 취소하시겠습니까?'))return;
  setSyncState('loading');
  try { await db.collection('reservations').doc(id).delete(); toast('예약이 취소되었습니다','🗑️'); await loadData(); }
  catch(e){ setSyncState('error'); toast('취소 실패: '+e.message,'❌'); }
}

function openModal(){prefillRoom=null;prefillStart=null;setupModal();document.getElementById('overlay').classList.add('open');}
function openModalWith(ri,slot){prefillRoom=ri;prefillStart=slot;setupModal();document.getElementById('overlay').classList.add('open');}
function closeModal(){document.getElementById('overlay').classList.remove('open');}

function buildDetailEmailRow(containerId){
  const container = document.getElementById(containerId);
  if(!container) return;
  const count = container.querySelectorAll('.email-row').length;
  if(count >= 5){ toast('최대 5개까지만 추가 가능합니다','⚠️'); return; }
  const row = document.createElement('div');
  row.className = 'email-row';
  row.style.cssText = 'display:flex;gap:8px;align-items:center;';
  row.innerHTML = `
    <select class="email-select" onchange="onEmailSelectChange(this)" style="flex:1;padding:9px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:13px;outline:none;">
      ${buildUserSelectOptions()}
    </select>
    <input type="email" class="email-input" placeholder="이메일 직접 입력" style="flex:1;padding:9px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:13px;outline:none;display:none;">
    <button type="button" onclick="this.closest('.email-row').remove()" style="padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:transparent;color:var(--text-mid);cursor:pointer;font-size:14px;flex-shrink:0;">✕</button>
  `;
  container.appendChild(row);
}

function addDetailEmailInput(){ buildDetailEmailRow('detailEmailContainer'); }

function collectEmailsFrom(containerId){
  return Array.from(document.querySelectorAll(`#${containerId} .email-row`)).map(row => {
    const sel = row.querySelector('.email-select');
    const input = row.querySelector('.email-input');
    if(sel.value === 'manual') return input.value.trim();
    if(sel.value.startsWith('user:')) {
      const idx = parseInt(sel.value.split(':')[1]);
      return USERS[idx]?.email || '';
    }
    return '';
  }).filter(e => e.includes('@'));
}

async function sendEmailFromDetail(){
  if(!detailResId) return;
  const res = reservations.find(r => r.id === detailResId);
  if(!res){ toast('예약 정보를 찾을 수 없습니다','❌'); return; }
  const emails = collectEmailsFrom('detailEmailContainer');
  if(emails.length === 0){ toast('이메일 수신자를 선택하거나 입력해주세요','⚠️'); return; }

  const btn = document.getElementById('btnSendEmail');
  btn.disabled = true; btn.textContent = '전송 중...';
  await sendReservationEmail(emails, {
    room: ROOMS[res.room_idx]?.name || '',
    date: res.date,
    start: res.start_time,
    end: res.end_time,
    dept: res.dept,
    name: res.name,
    purpose: res.purpose,
  });
  toast(`이메일을 ${emails.length}명에게 전송했습니다`, '📧');
  btn.disabled = false; btn.textContent = '이메일 보내기';
}

function setupModal(){
  isEditMode = false;
  editingResId = null;

  document.querySelector('.modal-title').textContent = '회의실 예약';
  document.getElementById('btnConfirm').textContent = '예약 확정';

  document.getElementById('fDate').value=toDateStr(selDate);
  document.getElementById('fRoom').value=prefillRoom!=null?String(prefillRoom):(roomFilter!=='all'?String(roomFilter):'');
  document.getElementById('fDept').value='';
  document.getElementById('fName').value='';
  document.getElementById('fPurpose').value='';
  document.getElementById('emailContainer').innerHTML='';
  addEmailInput();
  document.getElementById('conflictWarn').classList.remove('show');
  document.getElementById('btnConfirm').disabled=false;
  buildStartSlots(); updatePill();
}

function buildUserSelectOptions(){
  let opts = '<option value="">-- 선택 또는 직접 입력 --</option>';
  USERS.forEach((u,i) => {
    opts += `<option value="user:${i}">${u.name} (${u.email})</option>`;
  });
  opts += '<option value="manual">직접 입력</option>';
  return opts;
}

function addEmailInput(){ buildDetailEmailRow('emailContainer'); }

function onEmailSelectChange(sel){
  const row = sel.closest('.email-row');
  const input = row.querySelector('.email-input');
  if(sel.value === 'manual'){
    input.style.display = '';
    input.focus();
  } else if(sel.value.startsWith('user:')){
    const idx = parseInt(sel.value.split(':')[1]);
    input.style.display = 'none';
    input.value = USERS[idx]?.email || '';
  } else {
    input.style.display = 'none';
    input.value = '';
  }
}


function buildStartSlots(){
  const all=getSlots(), sel=document.getElementById('fStart');
  sel.innerHTML=all.map(s=>`<option value="${s}">${s}</option>`).join('');
  if(prefillStart&&all.includes(prefillStart)) sel.value=prefillStart;
  buildEndSlots();
}

function buildEndSlots(){
  const ri=parseInt(document.getElementById('fRoom').value);
  const date=document.getElementById('fDate').value;
  const start=document.getElementById('fStart').value;
  if(!start)return;
  const sm=toMin(start), opts=[];
  for(let add=30;add<=480;add+=30){
    const em=sm+add; if(em>18*60)break;
    const et=fromMin(em);
    if(!isEditMode&&!isNaN(ri)&&date&&hasConflict(ri,date,start,et))break;
    opts.push(et);
  }
  document.getElementById('fEnd').innerHTML=opts.map(s=>`<option value="${s}">${s}</option>`).join('');
  checkConflict(); updatePill();
}

function onFormChange(){buildStartSlots();updatePill();}
function onStartChange(){buildEndSlots();updatePill();}

function checkConflict(){
  const ri=parseInt(document.getElementById('fRoom').value);
  const date=document.getElementById('fDate').value;
  const start=document.getElementById('fStart').value;
  const end=document.getElementById('fEnd').value;
  const conflict=isEditMode?false:(!isNaN(ri)&&date&&start&&end&&hasConflict(ri,date,start,end));
  document.getElementById('conflictWarn').classList.toggle('show',conflict);
  document.getElementById('btnConfirm').disabled=conflict;
  updatePill();
}

function updatePill(){
  const ri=parseInt(document.getElementById('fRoom').value);
  const start=document.getElementById('fStart').value, end=document.getElementById('fEnd').value;
  let txt=''; if(!isNaN(ri))txt+=ROOMS[ri].name; if(start&&end)txt+=` · ${start} ~ ${end}`;
  document.getElementById('infoPillText').textContent=txt||'회의실과 시간을 선택해주세요';
}

async function submitForm(){
  const ri=parseInt(document.getElementById('fRoom').value);
  const date=document.getElementById('fDate').value;
  const start=document.getElementById('fStart').value;
  const end=document.getElementById('fEnd').value;
  const dept=document.getElementById('fDept').value;
  const name=document.getElementById('fName').value.trim();
  const purpose=document.getElementById('fPurpose').value.trim();

  if(isNaN(ri)||!date||!start||!end||!dept||!name||!purpose){toast('모든 항목을 입력해주세요','⚠️');return;}

  document.getElementById('btnConfirm').disabled=true;
  const originalText = document.getElementById('btnConfirm').textContent;
  document.getElementById('btnConfirm').textContent = isEditMode ? '수정 중...' : '저장 중...';
  setSyncState('loading');

  try {
    const payload = {room_idx:ri,date,start_time:start,end_time:end,dept,name,purpose};

    if(isEditMode) {
      await db.collection('reservations').doc(editingResId).update(payload);
      toast(`예약이 수정되었습니다!`, '✏️');
    } else {
      await db.collection('reservations').add({ ...payload, created_at: new Date().toISOString() });
      toast(`${ROOMS[ri].name} ${start}~${end} 예약 완료!`, '✅');
    }

    closeModal();
    const [y,mo,d]=date.split('-').map(Number);
    selDate=new Date(y,mo-1,d);
    await loadData();

    isEditMode = false;
    editingResId = null;
  } catch(e){
    setSyncState('error');
    toast(`${isEditMode ? '수정' : '예약'} 실패: ${e.message}`, '❌');
    document.getElementById('btnConfirm').disabled=false;
  }
  document.getElementById('btnConfirm').textContent = originalText;
}

function toast(msg,icon='✅'){
  const t=document.getElementById('toast');
  document.getElementById('toastMsg').textContent=msg;
  document.getElementById('toastIcon').textContent=icon+' ';
  t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),3500);
}

document.getElementById('overlay').addEventListener('click',e=>{if(e.target===document.getElementById('overlay'))closeModal();});
document.getElementById('detailOverlay').addEventListener('click',e=>{if(e.target===document.getElementById('detailOverlay'))closeDetailModal();});

if(initFirebase()){ startApp(); } else { document.getElementById('setupScreen').style.display='flex'; }
