// app.js（フル）
// 左サイド：進捗（問題数/正解数/正解率）＋ 間違えた問題リスト ＋ 苦手だけ出題モード
// ショートカット：無し
//
// 前提（index.html）
// #question, #answer, #result, #correct, #explain, #place
// （任意）#status, #wrongList
// ボタンから check(), reveal(), next(), shuffle() を呼ぶ

let questions = [];
let order = [];
let pos = 0;

// 統計
let answeredCount = 0;
let correctCount = 0;

// 苦手管理（間違えた問題の集合）
// wrongMap[id] = { idx, misses }
const wrongMap = Object.create(null);

// 出題モード
// mode = "all" | "wrong"
let mode = "all";

function $(id) { return document.getElementById(id); }

// 軽い正規化（厳しすぎない）
function normalizeCode(s) {
  return (s ?? "")
    .trim()
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*;\s*/g, ";")
    .replace(/\s*,\s*/g, ",")
    .replace(/\s*\(\s*/g, "(")
    .replace(/\s*\)\s*/g, ")")
    .replace(/\s*{\s*/g, "{")
    .replace(/\s*}\s*/g, "}")
    .replace(/\s*:\s*/g, ":");
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getSelectedPlace() {
  const sel = $("place");
  return sel ? (sel.value || "") : "";
}

function setPlaceValue(v) {
  const sel = $("place");
  if (!sel) return;
  sel.value = v ?? "";
}

function clearAnswerUI() {
  if ($("answer")) $("answer").value = "";
  if ($("result")) $("result").textContent = "";
  if ($("correct")) $("correct").textContent = "";
  if ($("explain")) $("explain").textContent = "";
  setPlaceValue("");
}

function currentQ() {
  if (!questions.length) return null;
  return questions[order[pos]];
}

// ------- 置き場（正解） -------
function expectedPlacesFromQuestion(q) {
  if (Array.isArray(q.place_answers)) return q.place_answers;
  if (typeof q.place_answer === "string" && q.place_answer) return [q.place_answer];
  if (typeof q.place_group_answer === "string" && q.place_group_answer) return [q.place_group_answer]; // 旧救済
  return [];
}

function isPlaceRequired(q) {
  if (typeof q.place_required === "boolean") return q.place_required;
  return true; // 未指定なら必須（＝常に判定）
}

// ------- 左サイド表示 -------
function updateStatus() {
  const el = $("status");
  if (!el) return;

  const total = questions.length || 0;
  const current = total ? (pos + 1) : 0;

  const accuracy = answeredCount === 0
    ? 0
    : Math.round((correctCount / answeredCount) * 100);

  const wrongCount = Object.keys(wrongMap).length;

  // 見やすいように改行表示
  el.innerHTML =
    `問題数：${current}問目/全${total}問<br>` +
    `正解数：${correctCount}問/${answeredCount}問<br>` +
    `正解率：${accuracy}%<br>` +
    `苦手：${wrongCount}問<br>` +
    `モード：${mode === "wrong" ? "苦手だけ" : "全問題"}`;
}

function updateWrongList() {
  const list = $("wrongList");
  if (!list) return;

  const ids = Object.keys(wrongMap);
  if (ids.length === 0) {
    list.textContent = "まだありません";
    list.classList.add("muted");
    return;
  }

  list.classList.remove("muted");
  list.innerHTML = "";

  // misses多い順に並べる
  ids.sort((a, b) => (wrongMap[b].misses - wrongMap[a].misses));

  for (const id of ids) {
    const info = wrongMap[id];
    const q = questions[info.idx];
    const prompt = (q?.prompt ?? "").replace(/\s+/g, " ").trim();

    const div = document.createElement("div");
    div.className = "wrong-item";
    div.onclick = () => jumpToQuestionByIdx(info.idx);

    const meta = document.createElement("div");
    meta.className = "wrong-meta";
    meta.innerHTML =
      `<span class="badge">id:${id}</span>` +
      `<span class="badge">×${info.misses}</span>`;

    const text = document.createElement("div");
    text.className = "wrong-text";
    text.textContent = prompt || "(問題文なし)";

    div.appendChild(meta);
    div.appendChild(text);
    list.appendChild(div);
  }
}

// ------- 画面表示 -------
function renderQuestion() {
  const q = currentQ();
  if (!q) return;
  $("question").textContent = q.prompt ?? "";
}

function showQuestion() {
  const q = currentQ();
  if (!q) {
    if ($("question")) $("question").textContent = "問題が読み込めませんでした。";
    return;
  }
  clearAnswerUI();
  renderQuestion();
  updateStatus();
  updateWrongList();
}

// ------- 判定 -------
function check() {
  const q = currentQ();
  if (!q) return;

  const userCode = normalizeCode($("answer")?.value ?? "");
  const expCode  = normalizeCode(q.expected ?? "");
  const codeOK = userCode.length > 0 && userCode === expCode;

  const selectedPlace = getSelectedPlace();
  const expectedPlaces = expectedPlacesFromQuestion(q);
  const placeRequired = isPlaceRequired(q);

  let placeOK = true;
  if (placeRequired) {
    if (!selectedPlace) placeOK = false;
    else if (expectedPlaces.length > 0) placeOK = expectedPlaces.includes(selectedPlace);
    else placeOK = true; // 正解定義がない問題は採点しない
  }

  answeredCount += 1;

  const ok = codeOK && placeOK;
  if (ok) {
    correctCount += 1;

    // 苦手リストから外す（克服したら消える設計）
    const id = String(q.id ?? "");
    if (id && wrongMap[id]) delete wrongMap[id];

    $("result").textContent = "正解";
    $("correct").textContent = "";
    $("explain").textContent = q.explain ? q.explain : "OK。次へ。";
  } else {
    // 苦手として登録（misses加算）
    const id = String(q.id ?? "");
    if (id) {
      if (!wrongMap[id]) {
        wrongMap[id] = { idx: order[pos], misses: 1 };
      } else {
        wrongMap[id].misses += 1;
      }
    }

    $("result").textContent = "不正解";

    const placeText = expectedPlaces.length ? expectedPlaces.join(" / ") : "(指定なし)";
    $("correct").textContent = `【模範】\n${q.expected ?? ""}\n\n【置き場】\n${placeText}`;

    const reasons = [];
    if (!codeOK) reasons.push("コードが一致しません（第2引数：ThisItem/LookUp/Defaults、フィールド名、カンマ、引用符など）。");
    if (!placeOK) {
      if (!selectedPlace) reasons.push("置き場が未選択です。");
      else reasons.push(`置き場が違います（選択：${selectedPlace}）。`);
    }

    let extra = "";
    if (q.explain) extra = `\n\n補足：${q.explain}`;
    else if (q.focus) extra = `\n\n狙い：${q.focus}`;

    $("explain").textContent = reasons.join(" ") + extra;
  }

  updateStatus();
  updateWrongList();
}

function reveal() {
  const q = currentQ();
  if (!q) return;

  const expectedPlaces = expectedPlacesFromQuestion(q);
  const placeText = expectedPlaces.length ? expectedPlaces.join(" / ") : "(指定なし)";

  $("correct").textContent = `【模範】\n${q.expected ?? ""}\n\n【置き場】\n${placeText}`;
  $("result").textContent = "";
  $("explain").textContent = q.explain ? q.explain : (q.focus ? `狙い：${q.focus}` : "");
}

function next() {
  if (!questions.length) return;

  pos += 1;
  if (pos >= order.length) {
    // 1周したら自動でシャッフル
    shuffle();
    return;
  }
  showQuestion();
}

function shuffle() {
  if (!questions.length) return;

  if (mode === "wrong") {
    // 苦手だけ出題中：苦手が無いなら全問題へ戻す
    const wrongIdxs = Object.values(wrongMap).map(v => v.idx);
    if (wrongIdxs.length === 0) {
      mode = "all";
      order = shuffleArray([...Array(questions.length).keys()]);
      pos = 0;
      showQuestion();
      return;
    }
    order = shuffleArray([...wrongIdxs]);
    pos = 0;
    showQuestion();
    return;
  }

  // 全問題モード
  order = shuffleArray([...Array(questions.length).keys()]);
  pos = 0;
  showQuestion();
}

// ------- サイド機能 -------
function resetStats() {
  answeredCount = 0;
  correctCount = 0;
  updateStatus();
}

function startWrongMode() {
  mode = "wrong";
  shuffle(); // モードに応じた order を作り直す
}

function startAllMode() {
  mode = "all";
  shuffle();
}

function jumpToQuestionByIdx(idx) {
  // 現在のorderにその問題が含まれていればそこへ移動
  // 含まれていない（例：苦手モード中で全問題クリック）場合は、その問題を先頭にして再構成
  const p = order.indexOf(idx);
  if (p >= 0) {
    pos = p;
    showQuestion();
    return;
  }

  // 現在モードに合わせてorderを作り直す
  if (mode === "wrong") {
    // 苦手モードなら、その問題を含めた苦手リストで再構築
    const wrongIdxs = Object.values(wrongMap).map(v => v.idx);
    if (!wrongIdxs.includes(idx)) wrongIdxs.unshift(idx);
    order = shuffleArray([...wrongIdxs]);
  } else {
    // 全問題モードなら、idxを先頭にして残りをシャッフル
    const rest = [...Array(questions.length).keys()].filter(x => x !== idx);
    order = [idx, ...shuffleArray(rest)];
  }
  pos = 0;
  showQuestion();
}

// ------- init -------
async function init() {
  try {
    const res = await fetch(`./questions.json?v=${Date.now()}`);
    if (!res.ok) throw new Error(`questions.json fetch failed: ${res.status}`);

    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("questions.json is not an array");

    questions = data.map((q, i) => ({
      id: q.id ?? (i + 1),
      ...q,
    }));

    if (!questions.length) throw new Error("questions is empty");

    mode = "all";
    shuffle();
  } catch (err) {
    console.error(err);
    if ($("question")) {
      $("question").textContent =
        "読み込みに失敗しました。\n" +
        "・questions.json の場所/名前\n" +
        "・JSONの構文（カンマ/引用符/[]/{}）\n" +
        "を確認してください。\n\n" +
        `詳細: ${err?.message ?? err}`;
    }
    const s = $("status");
    if (s) s.textContent = "読み込み失敗";
  }
}

init();

// グローバル公開（onclick用）
window.check = check;
window.reveal = reveal;
window.next = next;
window.shuffle = shuffle;

window.resetStats = resetStats;
window.startWrongMode = startWrongMode;
window.startAllMode = startAllMode;
