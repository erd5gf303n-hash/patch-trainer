// Patch特訓 - app.js（完全版）
//
// 前提：questions.json は配列。
// 必須キー：id, prompt, expected
// 置く場所を聞く場合：place_required=true, place_answer="OnSelect" など
// 解説：explain（任意）

let allQuestions = [];
let deck = [];
let index = 0;

let attempted = 0;
let correct = 0;

// 苦手：id -> {count, prompt}
let wrongMap = new Map();

// mode: "all" | "weak"
let mode = "all";

const el = (id) => document.getElementById(id);

function norm(s){
  if(!s) return "";
  return String(s)
    .replace(/\u3000/g, " ")               // 全角スペース
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, "")                  // すべての空白を無視
    .replace(/;$/g, "")                   // 末尾セミコロン1個
    .trim();
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function shuffle(arr){
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildDeck(){
  if(mode === "weak"){
    const weakIds = new Set([...wrongMap.keys()]);
    const weak = allQuestions.filter(q => weakIds.has(q.id));
    deck = shuffle([...weak]);
    if(deck.length === 0){
      // 苦手が無い場合は全問題へ自動退避
      mode = "all";
      setModeUI();
      deck = shuffle([...allQuestions]);
    }
  }else{
    deck = shuffle([...allQuestions]);
  }
  index = 0;
  renderQuestion();
  renderStatus();
}

function setModeUI(){
  const a = el("modeAll");
  const w = el("modeWeak");
  a.setAttribute("aria-pressed", mode === "all" ? "true" : "false");
  w.setAttribute("aria-pressed", mode === "weak" ? "true" : "false");
}

function renderStatus(){
  const total = deck.length || 0;
  const currentNo = total ? (index + 1) : 0;

  const acc = attempted ? Math.round((correct / attempted) * 100) : 0;

  el("status").innerHTML =
    `問題数：${currentNo}問目/全${total}問<br>` +
    `正解数：${correct}問/${attempted}問<br>` +
    `正解率：${acc}%<br>` +
    `苦手：${wrongMap.size}問<br>` +
    `モード：${mode === "all" ? "全問題" : "苦手だけ"}`;

  renderWrongList();
}

function renderWrongList(){
  const wrap = el("wrongList");
  wrap.innerHTML = "";

  if(wrongMap.size === 0){
    wrap.innerHTML = `<div class="muted">まだありません</div>`;
    return;
  }

  // count降順
  const items = [...wrongMap.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a,b) => b.count - a.count);

  for(const it of items){
    const div = document.createElement("div");
    div.className = "wrong-item";
    div.innerHTML = `
      <div class="wrong-top">
        <span class="badge">id:${escapeHtml(it.id)}</span>
        <span class="badge badge-red">×${it.count}</span>
      </div>
      <div class="wrong-text">${escapeHtml(it.prompt).slice(0, 80)}${it.prompt.length > 80 ? "…" : ""}</div>
    `;
    // クリックでその問題へジャンプ（今のdeck内にある場合）
    div.style.cursor = "pointer";
    div.addEventListener("click", () => jumpToId(it.id));
    wrap.appendChild(div);
  }
}

function jumpToId(id){
  const i = deck.findIndex(q => q.id === id);
  if(i >= 0){
    index = i;
    renderQuestion(true);
    renderStatus();
  }else{
    // デッキに無い（苦手だけ等）なら、全問題に切り替えて作り直す
    mode = "all";
    setModeUI();
    buildDeck();
    const j = deck.findIndex(q => q.id === id);
    if(j >= 0){
      index = j;
      renderQuestion(true);
      renderStatus();
    }
  }
}

function current(){
  return deck[index];
}

function hideResult(){
  el("resultArea").style.display = "none";
  el("resultTitle").textContent = "";
  el("correct").textContent = "";
  el("placeCorrect").textContent = "";
  el("explain").textContent = "";
  el("resultCard").className = "result-card";
}

function renderQuestion(keepAnswer=false){
  const q = current();
  if(!q){
    el("question").textContent = "問題がありません。questions.json を確認してください。";
    return;
  }

  el("question").textContent = q.prompt;

  if(!keepAnswer){
    el("answer").value = "";
    el("place").value = "";
    hideResult();
  }else{
    // keepAnswerでも結果は隠す（ジャンプ時など）
    hideResult();
  }
}

function trackWrong(q){
  const prev = wrongMap.get(q.id);
  if(prev){
    wrongMap.set(q.id, { count: prev.count + 1, prompt: q.prompt });
  }else{
    wrongMap.set(q.id, { count: 1, prompt: q.prompt });
  }
}

function showResult(isOk, q, details){
  el("resultArea").style.display = "block";

  const title = el("resultTitle");
  title.textContent = isOk ? "正解" : "不正解";
  title.className = "result-title " + (isOk ? "ok" : "ng");

  const card = el("resultCard");
  card.className = "result-card " + (isOk ? "ok" : "ng");

  // 正解表示
  const expected = q.expected || "";
  const placeLine =
    q.place_required
      ? `【置き場】${q.place_answer || "(未設定)"}`
      : `【置き場】（この問題は選択不要）`;

  el("correct").textContent = `【模範】\n${expected}`;
  el("placeCorrect").textContent = placeLine;

  // 解説
  const exp =
    q.explain
      ? q.explain
      : (isOk ? "OK。構文と置き場の意図が合っています。" : details);

  el("explain").textContent = exp;
}

function check(){
  const q = current();
  if(!q) return;

  const ans = el("answer").value;
  const place = el("place").value;

  const codeOk = norm(ans) === norm(q.expected);

  let placeOk = true;
  let placeMsg = "";

  if(q.place_required){
    if(!place){
      placeOk = false;
      placeMsg = "置く場所が未選択です。";
    }else{
      placeOk = (place === q.place_answer);
      if(!placeOk){
        placeMsg = `置き場が違います（あなた：${place} / 正解：${q.place_answer}）。`;
      }
    }
  }

  const ok = codeOk && placeOk;

  attempted += 1;
  if(ok) correct += 1;
  else trackWrong(q);

  renderStatus();

  const detail = (() => {
    const msgs = [];
    if(!codeOk) msgs.push("コードが一致しません（空白は無視して比較しています）。");
    if(q.place_required && !placeOk) msgs.push(placeMsg || "置き場が違います。");
    // 追加ヒント
    msgs.push("ヒント：第2引数（ThisItem / LookUp / Defaults）やフィールド名、カンマ、波括弧を確認。");
    return msgs.join("\n");
  })();

  showResult(ok, q, detail);
}

function next(){
  if(deck.length === 0) return;
  index = (index + 1) % deck.length;
  renderQuestion(false);
  renderStatus();
}

function resetStats(){
  attempted = 0;
  correct = 0;
  wrongMap = new Map();
  renderStatus();
  // 苦手モード中に苦手が消えるので全問題へ
  mode = "all";
  setModeUI();
  buildDeck();
}

async function init(){
  // UIイベント
  el("btnCheck").addEventListener("click", check);
  el("btnNext").addEventListener("click", next);

  el("modeAll").addEventListener("click", () => {
    mode = "all";
    setModeUI();
    buildDeck();
  });

  el("modeWeak").addEventListener("click", () => {
    mode = "weak";
    setModeUI();
    buildDeck();
  });

  el("btnReset").addEventListener("click", resetStats);

  // 読み込み
  try{
    const res = await fetch("./questions.json", { cache: "no-store" });
    if(!res.ok) throw new Error(`questions.json が取得できません (${res.status})`);
    const data = await res.json();

    if(!Array.isArray(data)) throw new Error("questions.json が配列ではありません");

    // 軽いバリデーション
    allQuestions = data
      .filter(q => q && (q.id !== undefined) && q.prompt && q.expected)
      .map(q => ({
        id: q.id,
        prompt: q.prompt,
        expected: q.expected,
        place_required: !!q.place_required,
        place_answer: q.place_answer || "",
        explain: q.explain || ""
      }));

    if(allQuestions.length === 0){
      throw new Error("有効な問題が0件です（id/prompt/expected が必要）");
    }

    setModeUI();
    buildDeck();
  }catch(e){
    el("question").textContent = "読み込みエラー: " + e.message;
    el("status").textContent = "読み込み失敗";
    console.error(e);
  }
}

init();

// グローバルに残しておく（念のため）
window.check = check;
window.next = next;
