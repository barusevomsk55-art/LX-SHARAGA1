(() => {
"use strict";
const byId=id=>document.getElementById(id);
const DAYS=["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"];
const SHORT=["ПН","ВТ","СР","ЧТ","ПТ","СБ","ВС"];
const SUBJECTS=[
["Разговоры о важном","Информатика","Информатика","Алгебра","Алгебра","Физика","Физика"],
["Англ. язык","Физкультура","Геометрия","Геометрия","Физика","История","Литература","Литература"],
["Алгебра","Алгебра","Обществознание","ОБЗР","География","Информатика","Информатика"],
["Рус. язык","Рус. язык","Физика","Физика","История","Обществознание","Литература","Физкультура"],
["Геометрия","ВиС","Англ. язык","Англ. язык","Биология","Химия"],[],[]];
const START=["08:30","09:20","10:15","11:10","12:05","13:00","13:50","14:50"];
const END=["09:10","10:00","10:55","11:50","12:45","13:40","14:30","15:30"];
const BREAKS=[["09:10","09:20"],["10:00","10:15"],["10:55","11:10"],["11:50","12:05"],["12:45","13:00"],["13:40","13:50"],["14:30","14:50"]];
const clone=o=>JSON.parse(JSON.stringify(o));
const initial=()=>({version:1,baseStart:"2026-11-09",schedule:SUBJECTS.map(a=>a.map((subject,i)=>({subject,room:"",teacher:"",description:"",id:`${Date.now()}-${i}-${Math.random()}`}))),bells:START.map((start,i)=>({start,end:END[i]})),breaks:clone(BREAKS),exceptions:{},settings:{theme:"light",motion:true}});
let data;
try{data=JSON.parse(localStorage.getItem("lx-sharaga-v3"))||initial()}catch{data=initial()}
// Cloudflare Quick Tunnel URL. Обновляется при перезапуске Quick Tunnel.
const API_BASE="https://ware-lot-smooth-knit.trycloudflare.com";
let apiOnline=false;
function apiStatus(message){const el=byId("apiStatus");if(el)el.textContent=message}
function save(){localStorage.setItem("lx-sharaga-v3",JSON.stringify(data));const status=byId("saveStatus");if(status)status.textContent="Изменения сохранены в браузере"}
async function apiRequest(path,options={}) {
  const response=await fetch(API_BASE+path,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.error||("HTTP "+response.status));
  return payload;
}
async function checkApi(){
  try{await apiRequest("/api/health");apiOnline=true;apiStatus("Сервер подключён. Расписание синхронизируется.");}
  catch(e){apiOnline=false;apiStatus("Сервер недоступен: "+e.message);}
}
async function pullSchedule(){
  try{
    const obj=await apiRequest("/api/schedule");
    if(!obj||!Array.isArray(obj.schedule)||obj.schedule.length!==7||!Array.isArray(obj.bells)||!Array.isArray(obj.breaks))throw new Error("Сервер вернул расписание неверного формата.");
    data={...data,...obj};localStorage.setItem("lx-sharaga-v3",JSON.stringify(data));renderAll();
    apiStatus("Загружено актуальное школьное расписание с сервера.");
  }catch(e){apiStatus("Не удалось загрузить расписание с сервера: "+e.message);}
}
async function saveToServer(){
  let secret=sessionStorage.getItem("lx-api-secret");
  if(!secret){secret=prompt("Пароль для изменения расписания находится в файле data/api_secret.txt внутри папки Python-сервиса. Введите его:");if(!secret)return;sessionStorage.setItem("lx-api-secret",secret);}
  const button=byId("saveToServerBtn");if(button){button.disabled=true;button.textContent="Сохраняем…";}
  try{
    await apiRequest("/api/schedule",{method:"PUT",headers:{"Authorization":"Bearer "+secret},body:JSON.stringify(data)});
    apiStatus("Расписание успешно сохранено на сервере. Telegram использует обновлённые данные.");
    const status=byId("saveStatus");if(status)status.textContent="Сохранено на сервере";
  }catch(e){
    if(/401|парол/i.test(e.message)){sessionStorage.removeItem("lx-api-secret");}
    apiStatus("Ошибка сохранения: "+e.message);
    alert("Не удалось сохранить расписание на сервере: "+e.message);
  }finally{if(button){button.disabled=false;button.textContent="Сохранить расписание";}}
}
let selectedDate=new Date(); selectedDate.setHours(0,0,0,0);
let editorDay=0;
const pad=n=>String(n).padStart(2,"0");
const dateKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseTime=(date,time)=>{const [h,m]=time.split(":").map(Number);const d=new Date(date);d.setHours(h,m,0,0);return d};
const fmtDate=d=>new Intl.DateTimeFormat("ru-RU",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(d);
const timeZone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone||"локальное время";
const weekday=d=>(d.getDay()+6)%7;
function lessonsFor(d){const key=dateKey(d);if(data.exceptions[key])return data.exceptions[key];return data.schedule[weekday(d)]||[]}
function bellFor(i){return data.bells[i]||{start:START[i],end:END[i]}}
function dayEvents(d){const lessons=lessonsFor(d);return lessons.map((l,i)=>({type:"lesson",i,lesson:l,start:bellFor(i).start,end:bellFor(i).end})).filter(e=>e.lesson)}
function activeState(now){const d=new Date(now);d.setHours(0,0,0,0);const lessons=dayEvents(d);if(weekday(d)>4)return {state:"weekend"};if(!lessons.length)return {state:"empty"};const first=parseTime(d,lessons[0].start),last=parseTime(d,lessons[lessons.length-1].end);if(now<first)return {state:"before",target:first};if(now>=last)return {state:"done"};for(let i=0;i<lessons.length;i++){const s=parseTime(d,lessons[i].start),e=parseTime(d,lessons[i].end);if(now>=s&&now<e)return {state:"lesson",event:lessons[i],target:e};if(i<lessons.length-1){const next=parseTime(d,lessons[i+1].start);if(now>=e&&now<next)return {state:"break",event:lessons[i+1],target:next}}}return {state:"done"}}
function nextLesson(now){const d=new Date(now);d.setHours(0,0,0,0);return dayEvents(d).find(e=>parseTime(d,e.start)>now)||null}
function renderClock(){const now=new Date();byId("clock").textContent=`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;byId("dateTitle").textContent=fmtDate(now);byId("timezone").textContent=timeZone();byId("footerZone").textContent=timeZone();byId("settingsZone").textContent=timeZone();const a=activeState(now);const labels={weekend:["Сегодня выходной","Можно отдохнуть"],empty:["Занятий нет","На выбранную дату уроки не запланированы"],before:["До начала занятий","Первый звонок ещё впереди"],lesson:["Сейчас идёт урок",a.event?.lesson.subject||""],break:["Сейчас перемена",`Следующий урок: ${a.event?.lesson.subject||""}`],done:["Учебный день завершён","Все уроки на сегодня закончились"]};byId("stateTitle").textContent=labels[a.state][0];byId("stateDescription").textContent=labels[a.state][1];let target=a.target;let caption=a.state==="lesson"?"до конца урока":a.state==="break"?"до конца перемены":"до начала занятий";if(!target&&a.state==="done"){target=null;caption="занятия завершены"}if(!target&&a.state==="weekend"){caption="выходной день"}byId("timerCaption").textContent=caption;byId("timer").textContent=target?duration(target-now):"—";let next=nextLesson(now);if(a.state==="lesson")next={...a.event};if(a.state==="break")next=a.event;if(next){byId("nextSubject").textContent=next.lesson.subject;byId("nextNumber").textContent=`${next.i+1} УРОК`;byId("nextTime").textContent=`${next.start} — ${next.end}`;byId("nextRoom").textContent=next.lesson.room?`Кабинет ${next.lesson.room}`:"Кабинет не указан"}else{byId("nextSubject").textContent="На сегодня всё";byId("nextNumber").textContent="—";byId("nextTime").textContent="Следующий учебный день";byId("nextRoom").textContent="Хорошего отдыха"}}
function duration(ms){let s=Math.max(0,Math.floor(ms/1000));return `${pad(Math.floor(s/3600))}:${pad(Math.floor(s%3600/60))}:${pad(s%60)}`}
function renderDays(){const nav=byId("dayNav");nav.innerHTML="";for(let i=0;i<7;i++){const b=document.createElement("button");b.className="day-btn"+(weekday(selectedDate)===i?" active":"");b.textContent=SHORT[i];b.addEventListener("click",()=>{const d=new Date(selectedDate);d.setDate(d.getDate()+i-weekday(d));selectedDate=d;renderAll()});nav.append(b)}}
function renderSchedule(){const d=selectedDate,lessons=lessonsFor(d),list=byId("scheduleList");byId("scheduleDate").textContent=fmtDate(d);byId("lessonCount").textContent=`${lessons.length} уроков`;list.innerHTML="";if(!lessons.length){list.innerHTML='<div class="empty-state">На эту дату занятий нет.<br>Выбери учебный день или добавь уроки в редакторе.</div>';return}
const now=new Date();lessons.forEach((lesson,i)=>{const b=bellFor(i);const row=document.createElement("div");row.className="lesson-row";if(dateKey(d)===dateKey(now)&&now>=parseTime(d,b.start)&&now<parseTime(d,b.end))row.classList.add("current");row.innerHTML=`<div class="lesson-time">${escapeHtml(b.start)}<br>${escapeHtml(b.end)}</div><div class="lesson-main"><span class="lesson-number">${i+1}</span><div><div class="lesson-subject">${escapeHtml(lesson.subject)}</div><div class="lesson-meta">${lesson.teacher?escapeHtml(lesson.teacher):" "}${lesson.description?" · "+escapeHtml(lesson.description):""}</div></div></div><div class="lesson-room">${lesson.room?"каб. "+escapeHtml(lesson.room):""}</div>`;list.append(row);if(i<lessons.length-1){const br=data.breaks[i];if(br){const el=document.createElement("div");el.className="break-row";el.innerHTML=`<span>Перемена</span><span>${escapeHtml(br[0])} — ${escapeHtml(br[1])}</span>`;list.append(el)}}})}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function renderBells(){const p=byId("bellPreview");p.innerHTML=data.bells.map((b,i)=>`<span class="bell-chip">${i+1}: ${escapeHtml(b.start)}–${escapeHtml(b.end)}</span>`).join("")}
function renderAll(){renderDays();renderSchedule();renderBells();renderClock()}
function applyTheme(theme){data.settings.theme=theme;document.body.classList.toggle("dark",theme==="dark");const toggle=byId("themeToggle");if(toggle){toggle.setAttribute("aria-pressed",String(theme==="dark"));toggle.setAttribute("aria-label",theme==="dark"?"Включить светлую тему":"Включить тёмную тему");byId("themeLabel").textContent=theme==="dark"?"После звонка":"Учебный день";}if(byId("themeSelect"))byId("themeSelect").value=theme;}
function download(name,content,type="application/json"){const blob=new Blob([content],{type});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function exportJSON(){download("lx-sharaga-schedule.json",JSON.stringify(data,null,2))}
function renderEditor(){const sel=byId("editorDay");sel.innerHTML=DAYS.map((d,i)=>`<option value="${i}">${d}</option>`).join("");sel.value=editorDay;renderSubjectEditor();renderBellEditor()}
function renderSubjectEditor(){const wrap=byId("subjectEditor"),arr=data.schedule[editorDay]||[];wrap.innerHTML="";arr.forEach((l,i)=>{const row=document.createElement("div");row.className="edit-row";row.innerHTML=`<strong>${i+1}</strong><input aria-label="Предмет" value="${escapeHtml(l.subject)}" data-field="subject"><input aria-label="Кабинет" placeholder="Кабинет" value="${escapeHtml(l.room||"")}" data-field="room"><button aria-label="Удалить урок">×</button>`;row.querySelectorAll("input").forEach(inp=>inp.addEventListener("change",()=>{l[inp.dataset.field]=inp.value;save();renderAll()}));row.querySelector("button").addEventListener("click",()=>{if(confirm("Удалить этот урок?")){arr.splice(i,1);save();renderSubjectEditor();renderAll()}});wrap.append(row)})}
function renderBellEditor(){const be=byId("bellEditor"),br=byId("breakEditor");be.innerHTML="<h3>Звонки</h3>";data.bells.forEach((b,i)=>{const row=document.createElement("div");row.className="bell-edit";row.innerHTML=`<strong>${i+1} урок</strong><input type="time" value="${b.start}" aria-label="Начало"><input type="time" value="${b.end}" aria-label="Конец">`;row.querySelectorAll("input").forEach((inp,j)=>inp.addEventListener("change",()=>{b[j?"end":"start"]=inp.value;save();renderAll()}));be.append(row)});br.innerHTML="<h3>Перемены</h3>";data.breaks.forEach((b,i)=>{const row=document.createElement("div");row.className="bell-edit";row.innerHTML=`<strong>${i+1}</strong><input type="time" value="${b[0]}"><input type="time" value="${b[1]}">`;row.querySelectorAll("input").forEach((inp,j)=>inp.addEventListener("change",()=>{b[j]=inp.value;save();renderAll()}));br.append(row)})}
function openEditor(){renderEditor();byId("editorDialog").showModal()}
byId("editBtn").onclick=openEditor;byId("editorDay").onchange=e=>{editorDay=+e.target.value;renderSubjectEditor()};byId("addLessonBtn").onclick=()=>{data.schedule[editorDay].push({subject:"Новый урок",room:"",teacher:"",description:"",id:crypto.randomUUID?.()||String(Date.now())});save();renderSubjectEditor();renderAll()};
byId("saveToServerBtn").onclick=saveToServer;byId("doneEditing").onclick=()=>{byId("editorDialog").close();renderAll()};byId("todayBtn").onclick=()=>{selectedDate=new Date();selectedDate.setHours(0,0,0,0);renderAll()};byId("calendarBtn").onclick=()=>{byId("datePicker").classList.toggle("visible");byId("datePicker").value=dateKey(selectedDate)};byId("datePicker").onchange=e=>{if(e.target.value){selectedDate=new Date(e.target.value+"T00:00:00");renderAll()}};
byId("exportBtn").onclick=exportJSON;byId("backupBtn").onclick=exportJSON;
byId("copyDayBtn").onclick=()=>{const target=prompt("В какой день скопировать? Введи номер 1–5.");const n=Number(target)-1;if(n>=0&&n<5&&n!==editorDay){data.schedule[n]=clone(data.schedule[editorDay]);save();alert("Расписание скопировано.")}else if(target!==null)alert("Укажи номер учебного дня от 1 до 5.")};
byId("resetBtn").onclick=()=>{if(confirm("Восстановить исходное расписание? Все изменения расписания будут потеряны.")){data=initial();save();renderAll();renderEditor()}};
byId("importFile").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const obj=JSON.parse(await f.text());if(!obj||!Array.isArray(obj.schedule)||obj.schedule.length!==7||!Array.isArray(obj.bells)||obj.bells.length!==8||!Array.isArray(obj.breaks)||obj.breaks.length!==7)throw Error("Неверная структура файла.");if(!obj.schedule.every(day=>Array.isArray(day)&&day.every(l=>l&&typeof l.subject==="string")))throw Error("Некорректный список уроков.");data={...data,...obj};save();renderAll();renderEditor();alert("Расписание импортировано.")}catch(err){alert("Не удалось импортировать JSON: "+err.message)}e.target.value=""};
function exportICS(){let out=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//LX SHARAGA//Schedule//RU","CALSCALE:GREGORIAN"];const start=new Date("2026-11-09T00:00:00");for(let day=0;day<5;day++){const d=new Date(start);d.setDate(d.getDate()+day);lessonsFor(d).forEach((l,i)=>{const b=bellFor(i),stamp=t=>{const [h,m]=t.split(":");return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${h}${m}00`};out.push("BEGIN:VEVENT",`UID:lx-${dateKey(d)}-${i}@sharaga`,`DTSTART:${stamp(b.start)}`,`DTEND:${stamp(b.end)}`,`SUMMARY:${l.subject.replace(/[,;\\]/g,"\\$&")}`,"END:VEVENT")})}out.push("END:VCALENDAR");download("lx-sharaga.ics",out.join("\r\n"),"text/calendar;charset=utf-8")}
byId("exportICSBtn").onclick=exportICS;
byId("settingsBtn").onclick=()=>{initGithubSettings();byId("themeSelect").value=data.settings.theme||"light";byId("motionToggle").checked=data.settings.motion!==false;byId("settingsDialog").showModal()};
byId("settingsDone").onclick=()=>{applyTheme(byId("themeSelect").value);data.settings.motion=byId("motionToggle").checked;document.body.classList.toggle("no-motion",!data.settings.motion);save();byId("settingsDialog").close()};
byId("themeToggle").onclick=()=>{applyTheme(data.settings.theme==="dark"?"light":"dark");save()};
byId("telegramInfoBtn").addEventListener("click",()=>{localStorage.setItem("lx-sharaga-telegram-opened","1")});
byId("telegramDone").onclick=()=>byId("telegramDialog").close();
document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===t));document.querySelectorAll(".tab-content").forEach(x=>x.classList.add("hidden"));byId("tab-"+t.dataset.tab).classList.remove("hidden")});
applyTheme(data.settings.theme||"light");if(data.settings.motion===false)document.body.classList.add("no-motion");
if("serviceWorker"in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js").catch(()=>{});
renderAll();checkApi();pullSchedule();setInterval(renderClock,1000);
})();
