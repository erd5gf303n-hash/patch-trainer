// app.js（フル）
// 改修点：
// - 正解/解説をdetailsで折りたたみ、判定後に自動でopen
// - textarea小型化（CSS側）
// - ショートカット無し
// - 判定ボタン：正解=緑 / 不正解=赤（③）
// - 左サイド：進捗（問題数/正解数/正解率）＋ 苦手リスト ＋ 苦手モード

let questions = [];
let order = [];
let pos = 0;

// 統計
let answeredCount = 0;
let correctCount = 0;

// 苦手管理: wrongMap[id] = { idx, misses }
const wrongMap = Object.create(null);

// 出題モード
let mode = "all"; // "all" | "wrong"

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

function currentQ() {
  if (!questions.length) return null;
  return questions[order[pos]];
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

// ------- details自動展開（判定後） -------
function openDetailsAfterCheck() {
  const c = $("correctDetails");
  const e = $("explainDetails");
  if (c) c.open = true;
  if (e) e.open = true;
}

// ------- 置き場（正解） -------
function expectedPlacesFromQuestion(q) {
  if (Array.isArray(q.place_answers)) return q.place_answers;
  if (typeof q.place_answer === "string" && q.place_answer) return [q.place_answer];
  // 旧データ救済
  if (typeof q.place_group_answer === "string" && q.place_group_answer) return [q.place_group_answer];
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

  // misses多い順
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

// ------- 表示クリア -------
function setCheckButtonState(state /* "correct" | "wrong" | "reset" */) {
  const btn = $("btnCheck");
  if (!btn) return;
  btn.classList.remove("correct", "wrong");
  if (state === "correct") btn.classList.add("correct");
  if (state === "wrong") btn.classList.add("wrong");
}

function clearAnswerUI() {
  if ($("answer")) $("answer").value = "";
  if ($("result")) $("result").textContent = "";
  if ($("correct")) $("correct").textContent = "";
  if ($("explain")) $("explain").textContent = "";
  setPlaceValue("");

  // 判定ボタン色を通常に戻す
  setCheckButtonState("reset");

  // detailsはたたむ（次問題で省スペース）
  const c = $("correctDetails");
  const e = $("explainDetails");
  if (c) c.open = false;
  if (e) e.open = false;
}

// ------- 問題表示 -------
function renderQuestion() {
  const q = currentQ();
  if (!q) return;
  if ($("question")) $("question").textContent = q.prompt ?? "";
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
    setCheckButtonState("correct"); // 正解 → 緑

    // 苦手から外す（克服したら消える）
    const id = String(q.id ?? "");
    if (id && wrongMap[id]) delete wrongMap[id];

    if ($("result")) $("result").textContent = "正解";
    if ($("correct")) $("correct").textContent = "";
    if ($("explain")) $("explain").textContent = q.explain ? q.explain : "OK。次へ。";
  } else {
    setCheckButtonState("wrong"); // 不正解 → 赤

    // 苦手として登録（misses加算）
    const id = String(q.id ?? "");
    if (id) {
      if (!wrongMap[id]) wrongMap[id] = { idx: order[pos], misses: 1 };
      else wrongMap[id].misses += 1;
    }

    if ($("result")) $("result").textContent = "不正解";

    const placeText = expectedPlaces.length ? expectedPlaces.join(" / ") : "(指定なし)";
    if ($("correct")) $("correct").textContent = `【模範】\n${q.expected ?? ""}\n\n【置き場】\n${placeText}`;

    const reasons = [];
    if (!codeOK) reasons.push("コードが一致しません（第2引数：ThisItem/LookUp/Defaults、フィールド名、カンマ、引用符など）。");
    if (!placeOK) {
      if (!selectedPlace) reasons.push("置き場が未選択です。");
      else reasons.push(`置き場が違います（選択：${selectedPlace}）。`);
    }

    let extra = "";
    if (q.explain) extra = `\n\n補足：${q.explain}`;
    else if (q.focus) extra = `\n\n狙い：${q.focus}`;

    if ($("explain")) $("explain").textContent = reasons.join(" ") + extra;
  }

  // ✅ 判定したら正解/解説を自動で開く（スクロール無し狙い）
  openDetailsAfterCheck();

  updateStatus();
  updateWrongList();
}

function next() {
  if (!questions.length) return;

  pos += 1;
  if (pos >= order.length) {
    shuffle(); // 1周したら再構成
    return;
  }
  showQuestion();
}

function shuffle() {
  if (!questions.length) return;

  if (mode === "wrong") {
    const wrongIdxs = Object.values(wrongMap).map(v => v.idx);
    if (wrongIdxs.length === 0) {
      // 苦手が無いなら全問題に戻す
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
  shuffle();
}

function startAllMode() {
  mode = "all";
  shuffle();
}

function jumpToQuestionByIdx(idx) {
  const p = order.indexOf(idx);
  if (p >= 0) {
    pos = p;
    showQuestion();
    return;
  }

  // orderに含まれない場合は再構成
  if (mode === "wrong") {
    const wrongIdxs = Object.values(wrongMap).map(v => v.idx);
    if (!wrongIdxs.includes(idx)) wrongIdxs.unshift(idx);
    order = shuffleArray([...wrongIdxs]);
  } else {
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
window.next = next;

window.resetStats = resetStats;
window.startWrongMode = startWrongMode;
window.startAllMode = startAllMode;
