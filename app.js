// app.js

let questions = [];
let order = [];
let idx = 0;

let attempted = 0;
let correctCount = 0;

// wrongMap: { [id]: { q, count } }
let wrongMap = {};

// ========= util =========
function normalizeFx(s){
  return (s || "")
    .replace(/\u3000/g, " ")           // 全角スペース→半角
    .replace(/\s+/g, "")              // 空白/改行を全部除去
    .replace(/[“”]/g, '"')            // 変形ダブルクォート
    .replace(/[’‘]/g, "'");           // 変形シングルクォート
}

function escapeHtml(str){
  return (str || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

// ========= render =========
function renderStatus(){
  const total = order.length || 0;
  const currentNo = Math.min(idx + 1, total);

  const rate = attempted === 0 ? 0 : Math.round((correctCount / attempted) * 100);

  const wrongCount = Object.values(wrongMap).reduce((sum, v) => sum + v.count, 0);

  const mode = (Object.keys(wrongMap).length > 0 && window.__mode === "weak")
    ? "苦手だけ出題"
    : "全問題";

  document.getElementById("status").innerHTML =
    `問題数：${currentNo}問目/全${total}問<br>` +
    `正解数：${correctCount}問/${attempted}問<br>` +
    `正解率：${rate}%<br>` +
    `苦手：${wrongCount}問<br>` +
    `モード：${mode}`;
}

function renderWrongList(){
  const wrap = document.getElementById("wrongList");
  const arr = Object.values(wrongMap)
    .sort((a,b)=> b.count - a.count)
    .slice(0, 12); // 多すぎたら上位だけ

  if(arr.length === 0){
    wrap.innerHTML = `<div class="muted">まだありません</div>`;
    return;
  }

  wrap.innerHTML = arr.map(v=>{
    const q = v.q;
    return `
      <div class="wrong-item">
        <div class="wrong-top">
          <span class="badge">id:${q.id}</span>
          <span class="badge badge-red">×${v.count}</span>
        </div>
        <div class="wrong-prompt">${escapeHtml(q.prompt)}</div>
      </div>
    `;
  }).join("");
}

function showQuestion(){
  const q = questions[ order[idx] ];
  if(!q) return;

  // 問題文
  document.getElementById("question").textContent = q.prompt;

  // 入力初期化
  document.getElementById("answer").value = "";
  document.getElementById("place").value = "";

  // 結果を隠す
  document.getElementById("resultWrap").style.display = "none";
  document.getElementById("resultTitle").textContent = "";
  document.getElementById("correct").textContent = "";
  document.getElementById("explain").textContent = "";
  document.getElementById("placeCorrectLine").textContent = "";

  // 次へは「判定後」に押せるほうが安全なので無効化
  document.getElementById("btnNext").disabled = true;

  renderStatus();
}

function markWrong(q){
  if(!wrongMap[q.id]){
    wrongMap[q.id] = { q, count: 0 };
  }
  wrongMap[q.id].count += 1;
  renderWrongList();
}

// ========= judge =========
function check(){
  const q = questions[ order[idx] ];
  if(!q) return;

  attempted += 1;

  const userFx = normalizeFx(document.getElementById("answer").value);
  const expectedFx = normalizeFx(q.expected);

  const codeOk = userFx === expectedFx;

  // 置く場所判定
  let placeOk = true;
  let placeMsg = "";

  const selected = document.getElementById("place").value;

  // place_required が true のときだけ厳密判定
  if(q.place_required){
    placeOk = (selected === (q.place_answer || ""));
    if(!selected){
      placeOk = false;
      placeMsg = "（置く場所：未選択）";
    }
  }

  const ok = codeOk && placeOk;

  if(ok){
    correctCount += 1;
  }else{
    markWrong(q);
  }

  // 結果表示（置く場所の下）
  const wrap = document.getElementById("resultWrap");
  const title = document.getElementById("resultTitle");
  const correct = document.getElementById("correct");
  const explain = document.getElementById("explain");
  const box = document.getElementById("resultBox");
  const placeLine = document.getElementById("placeCorrectLine");

  wrap.style.display = "block";

  title.textContent = ok ? "正解" : "不正解";

  // 色
  box.classList.remove("ok","ng");
  box.classList.add(ok ? "ok" : "ng");

  // 正解表示
  let out = "【模範】\n" + q.expected;
  if(q.place_required){
    out += "\n\n【置き場】\n" + (q.place_answer || "(未設定)");
  }
  correct.textContent = out;

  if(q.place_required){
    placeLine.textContent = `あなたの選択：${selected || "(未選択)"} / 正解：${q.place_answer || "(未設定)"} ${placeMsg}`;
  }else{
    placeLine.textContent = "置く場所はこの問題では自由（目安）";
  }

  // 解説
  explain.textContent = q.explain || q.focus || "";

  // 次へ有効化
  document.getElementById("btnNext").disabled = false;

  renderStatus();
}

function next(){
  if(idx < order.length - 1){
    idx += 1;
    showQuestion();
  }else{
    // 最終問題後：最終結果表示
    document.getElementById("question").textContent = "終了！おつかれさまでした。";
    document.getElementById("btnNext").disabled = true;
  }
}

// ========= init =========
async function init(){
  try{
    const res = await fetch("questions.json", { cache: "no-store" });
    if(!res.ok) throw new Error("questions.json が読み込めませんでした");
    questions = await res.json();

    // order作成（全問題）
    order = questions.map((_, i)=> i);

    // 初期はシャッフル
    shuffle(order);

    idx = 0;
    attempted = 0;
    correctCount = 0;
    wrongMap = {};
    window.__mode = "all";

    renderWrongList();
    renderStatus();
    showQuestion();
  }catch(e){
    document.getElementById("question").textContent = "読み込みエラー：" + e.message;
    console.error(e);
  }
}

function shuffle(arr){
  for(let i=arr.length-1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

window.check = check;
window.next = next;

init();
