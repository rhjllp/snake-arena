const $ = id => document.getElementById(id);
let me = null, socket = null, snake = [], food = {x:10,y:10}, dir = {x:1,y:0}, nextDir = {x:1,y:0};
let score = 0, best = 0, timer = null, running = false;
const canvas = $("board"), ctx = canvas.getContext("2d"), cells = 20, cell = 20;

async function api(url, options={}) {
  const response = await fetch(url, {
    credentials:"same-origin",
    headers:{"Content-Type":"application/json", ...(options.headers||{})},
    ...options
  });
  const data = await response.json().catch(()=>({error:"Lỗi máy chủ"}));
  if (!response.ok) throw new Error(data.error || "Có lỗi xảy ra");
  return data;
}
function showAuth(message="") {
  $("authPanel").hidden = false; $("gamePanel").hidden = true; $("adminPanel").hidden = true;
  $("authMessage").textContent = message;
}
function showGame() {
  $("authPanel").hidden = true; $("gamePanel").hidden = false;
  $("playerName").textContent = me.username;
  $("roleLabel").textContent = me.role === "admin" ? "Quản trị viên" : "Người chơi";
  $("adminBtn").hidden = me.role !== "admin";
  $("bestScore").textContent = best;
  connectSocket(); loadLeaderboard(); draw();
}
async function refreshMe() {
  try {
    const data = await api("/api/me");
    if (data.user) { me=data.user; best=me.score||0; showGame(); }
    else showAuth();
  } catch { showAuth("Không thể kết nối máy chủ."); }
}
$("loginBtn").onclick = async () => {
  try { const d=await api("/api/login",{method:"POST",body:JSON.stringify({username:$("username").value,password:$("password").value})}); me=d.user; best=me.score||0; showGame(); }
  catch(e){$("authMessage").textContent=e.message;}
};
$("registerBtn").onclick = async () => {
  try { const d=await api("/api/register",{method:"POST",body:JSON.stringify({username:$("username").value,password:$("password").value})}); me=d.user; best=0; showGame(); }
  catch(e){$("authMessage").textContent=e.message;}
};
$("logoutBtn").onclick = async () => {
  stopGame(); if(socket) socket.disconnect(); await api("/api/logout",{method:"POST"}); me=null; showAuth("Đã đăng xuất.");
};
function connectSocket() {
  if(socket) socket.disconnect();
  socket=io();
  socket.on("onlineCount", n=>$("onlineCount").textContent=n);
}
async function loadLeaderboard() {
  try {
    const d=await api("/api/leaderboard");
    $("leaderboard").innerHTML="";
    if(!d.leaderboard.length){$("leaderboard").innerHTML="<li>Chưa có điểm. Hãy chơi đầu tiên!</li>";return;}
    d.leaderboard.forEach((p,i)=>{const li=document.createElement("li");li.textContent=`${p.username} — ${p.score} điểm`; $("leaderboard").appendChild(li);});
  } catch {}
}
function placeFood() {
  do { food={x:Math.floor(Math.random()*cells),y:Math.floor(Math.random()*cells)}; }
  while(snake.some(p=>p.x===food.x&&p.y===food.y));
}
function startGame() {
  stopGame(); snake=[{x:8,y:10},{x:7,y:10},{x:6,y:10}];
  dir={x:1,y:0}; nextDir={x:1,y:0}; score=0; $("score").textContent=score;
  placeFood(); running=true; $("gameMessage").textContent="Đang chơi! Dùng phím mũi tên hoặc nút điều khiển.";
  timer=setInterval(tick,125); draw();
}
function stopGame(){running=false;if(timer)clearInterval(timer);timer=null;}
function tick() {
  dir=nextDir;
  const head={x:snake[0].x+dir.x,y:snake[0].y+dir.y};
  const ate=head.x===food.x&&head.y===food.y;
  const body=ate?snake:snake.slice(0,-1);
  if(head.x<0||head.y<0||head.x>=cells||head.y>=cells||body.some(p=>p.x===head.x&&p.y===head.y)){
    stopGame(); $("gameMessage").textContent=`Game over! Bạn đạt ${score} điểm.`; saveScore(); return;
  }
  snake.unshift(head);
  if(ate){score+=10;$("score").textContent=score;placeFood();}
  else snake.pop();
  draw();
}
function setDirection(name) {
  const dirs={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
  const d=dirs[name]; if(!d)return;
  if(d.x===-dir.x&&d.y===-dir.y)return;
  nextDir=d;
}
function draw() {
  ctx.fillStyle="#091321";ctx.fillRect(0,0,400,400);
  ctx.strokeStyle="#14243a";ctx.lineWidth=.5;
  for(let i=0;i<=cells;i++){ctx.beginPath();ctx.moveTo(i*cell,0);ctx.lineTo(i*cell,400);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*cell);ctx.lineTo(400,i*cell);ctx.stroke();}
  ctx.fillStyle="#ff6b78";ctx.beginPath();ctx.arc(food.x*cell+10,food.y*cell+10,7,0,Math.PI*2);ctx.fill();
  snake.forEach((p,i)=>{ctx.fillStyle=i===0?"#a5ffd0":"#42c98b";ctx.fillRect(p.x*cell+2,p.y*cell+2,cell-4,cell-4);});
  if(!snake.length){ctx.fillStyle="#8da2bd";ctx.font="15px system-ui";ctx.textAlign="center";ctx.fillText("Nhấn Chơi mới",200,205);}
}
async function saveScore() {
  try {const d=await api("/api/score",{method:"POST",body:JSON.stringify({score})});best=d.bestScore;$("bestScore").textContent=best;await loadLeaderboard();}
  catch(e){$("gameMessage").textContent += " (Không lưu được điểm: "+e.message+")";}
}
$("startBtn").onclick=startGame;
document.querySelectorAll("[data-dir]").forEach(b=>b.addEventListener("click",()=>setDirection(b.dataset.dir)));
document.addEventListener("keydown",e=>{const map={ArrowUp:"up",ArrowDown:"down",ArrowLeft:"left",ArrowRight:"right",w:"up",s:"down",a:"left",d:"right"};if(map[e.key]){e.preventDefault();setDirection(map[e.key]);}});
let touchStart=null;
canvas.addEventListener("touchstart",e=>{const t=e.changedTouches[0];touchStart={x:t.clientX,y:t.clientY};},{passive:true});
canvas.addEventListener("touchend",e=>{if(!touchStart)return;const t=e.changedTouches[0],dx=t.clientX-touchStart.x,dy=t.clientY-touchStart.y;if(Math.max(Math.abs(dx),Math.abs(dy))>20)setDirection(Math.abs(dx)>Math.abs(dy)?(dx>0?"right":"left"):(dy>0?"down":"up"));touchStart=null;},{passive:true});

$("adminBtn").onclick=async()=>{ $("adminPanel").hidden=false; await loadAdmin(); };
$("closeAdmin").onclick=()=>{$("adminPanel").hidden=true;};
async function loadAdmin(){
  try{
    const d=await api("/api/admin/overview");
    $("totalUsers").textContent=d.totalUsers;$("adminOnline").textContent=d.online;
    $("userRows").innerHTML="";
    d.users.filter(u=>u.role!=="admin").forEach(u=>{
      const tr=document.createElement("tr");
      const name=document.createElement("td");name.textContent=u.username;
      const points=document.createElement("td");points.textContent=u.score;
      const status=document.createElement("td");status.textContent=u.banned?"Đã khóa":(u.isOnline?"Online":"Offline");
      const action=document.createElement("td");const btn=document.createElement("button");btn.className="secondary";btn.textContent=u.banned?"Mở khóa":"Khóa";
      btn.onclick=async()=>{try{await api(`/api/admin/user/${encodeURIComponent(u.id)}/ban`,{method:"POST"});loadAdmin();}catch(e){alert(e.message);}};
      action.appendChild(btn);tr.append(name,points,status,action);$("userRows").appendChild(tr);
    });
  }catch(e){alert(e.message);}
}
refreshMe();
