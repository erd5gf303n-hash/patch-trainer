// app.js（フルコード・ショートカット無し版）
// 前提：index.html 側に以下の要素がある
// #question, #answer, #result, #correct, #explain
// 置き場：<select id="place"> ... </select>
// ボタン：onclick="check()", "reveal()", "next()", "shuffle()"

let questions = [];
let order = [];
let pos = 0;
let correctCount = 0;
let answeredCount = 0;

// ---------- helpers ----------
function $(id) {
  return document.getElementById(id);
}

function normalizeCode(s) {
  // まずは“軽い”正規化（空白差で落ちすぎない程度）
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
  $("answer") && ($("answer").value = "");
  $("result") && ($("result").textContent = "");
  $("correct") && ($("correct").textContent = "");
  $("explain") && ($("explain").textContent = "");
  setPlaceValue(""); // 未選択に戻す
}

function currentQ() {
  if (!questions.length) return null;
  return questions[order[pos]];
}

function renderQuestion() {
  const q = currentQ();
  if (!q) return;

  const total = questions.length;
  const n = pos + 1;

  // 表示：番号 + 本文（idは邪魔なら消してOK）
  const header = `【${n}/${total}】`;
  const body = q.prompt ?? "";
  $("question").textContent = `${header}\n${body}`;
}

// ---------- place judge ----------
function expectedPlacesFromQuestion(q) {
  // place_answers（配列）を優先
  if (Array.isArray(q.place_answers)) return q.place_answers;
  // place_answer（単一）
  if (typeof q.place_answer === "string" && q.place_answer) return [q.place_answer];
  // 古いキー救済（あれば）
  if (typeof q.place_group_answer === "string" && q.place_group_answer) return [q.place_group_answer];
  return [];
}

function isPlaceRequired(q) {
  // 未指定は「必須」にして、置き場判定を常に有効化
  if (typeof q.place_required === "boolean") return q.place_required;
  return true;
}

// ---------- core ----------
function showQuestion() {
  const q = currentQ();
  if (!q) {
    $("question") && ($("question").textContent = "問題が読み込めませんでした。");
    return;
  }
  clearAnswerUI();
  renderQuestion();
  function updateStatus() {
  const total = questions.length;
  const current = pos + 1;

  const accuracy = answeredCount === 0 
    ? 0 
    : Math.round((correctCount / answeredCount) * 100);

  document.getElementById("status").textContent =
    `問題数：${current}問目 / 全${total}問　｜　正解数：${correctCount}問 / ${answeredCount}問　｜　正解率：${accuracy}%`;
}
}

function check() {
  const q = currentQ();
  if (!q) return;

  const userCode = normalizeCode($("answer")?.value ?? "");
  const expCode = normalizeCode(q.expected ?? "");

  const codeOK = userCode.length > 0 && userCode === expCode;

  const selectedPlace = getSelectedPlace();
  const expectedPlaces = expectedPlacesFromQuestion(q);
  const placeRequired = isPlaceRequired(q);

  let placeOK = true;

  if (placeRequired) {
    if (!selectedPlace) {
      placeOK = false;
    } else if (expectedPlaces.length > 0) {
      placeOK = expectedPlaces.includes(selectedPlace);
    } else {
      // 正解の置き場が未定義なら採点しない
      placeOK = true;
    }
  }

  const ok = codeOK && placeOK;

  if (ok) {
    $("result").textContent = "正解";
    $("correct").textContent = "";
    $("explain").textContent = q.explain ? q.explain : "OK。次へ。";
  } else {
    $("result").textContent = "不正解";

    const placeText = expectedPlaces.length ? expectedPlaces.join(" / ") : "(指定なし)";

    $("correct").textContent =
      `【模範】\n${q.expected ?? ""}\n\n【置き場】\n${placeText}`;

    // 解説：間違った要因を分けて表示
    const reasons = [];
    if (!codeOK) reasons.push("コードが一致しません。第2引数（ThisItem/LookUp/Defaults）や、フィールド名・カンマ・引用符を確認。");
    if (!placeOK) {
      if (!selectedPlace) reasons.push("置き場が未選択です。");
      else reasons.push(`置き場が違います。選択：${selectedPlace}`);
    }

    // JSONに explain があれば最後に付ける
    let extra = "";
    if (q.explain) extra = `\n\n補足：${q.explain}`;

    $("explain").textContent = reasons.join(" ") + extra;
  }
}

function reveal() {
  const q = currentQ();
  if (!q) return;

  const expectedPlaces = expectedPlacesFromQuestion(q);
  const placeText = expectedPlaces.length ? expectedPlaces.join(" / ") : "(指定なし)";

  $("correct").textContent =
    `【模範】\n${q.expected ?? ""}\n\n【置き場】\n${placeText}`;

  $("result").textContent = "";
  $("explain").textContent = q.explain ? q.explain : (q.focus ? `狙い：${q.focus}` : "");
}

function next() {
  if (!questions.length) return;

  pos += 1;
  if (pos >= order.length) {
    // 1周したら自動でシャッフルして先頭に戻す
    shuffle();
    return;
  }
  showQuestion();
}

function shuffle() {
  if (!questions.length) return;
  order = shuffleArray([...Array(questions.length).keys()]);
  pos = 0;
  showQuestion();
}

// ---------- init ----------
async function init() {
  try {
    // キャッシュ回避（更新が反映されない対策）
    const res = await fetch(`./questions.json?v=${Date.now()}`);
    if (!res.ok) throw new Error(`questions.json fetch failed: ${res.status}`);

    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("questions.json is not an array");

    questions = data.map((q, i) => ({
      id: q.id ?? (i + 1),
      ...q,
    }));

    if (!questions.length) throw new Error("questions is empty");

    shuffle();
  } catch (err) {
    console.error(err);
    $("question") && ($("question").textContent =
      "読み込みに失敗しました。\n" +
      "・questions.json の場所/名前\n" +
      "・JSONの構文（カンマ/引用符/[]/{}）\n" +
      "を確認してください。\n\n" +
      `詳細: ${err?.message ?? err}`
    );
  }
}

init();

// onclick から呼べるようにグローバル公開
window.check = check;
window.reveal = reveal;
window.next = next;
window.shuffle = shuffle;
