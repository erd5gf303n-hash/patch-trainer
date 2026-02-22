// app.js（フルコード）
// 追加：ステータス表示（問題数/正解数/正解率）
// 仕様：Enter/Ctrl+Enterなどのキーボードショートカットは無し
//
// 前提（index.html）
// - #question : 問題文表示
// - #answer  : テキストエリア
// - #result  : 正解/不正解
// - #correct : 模範解答表示（pre）
// - #explain : 解説表示
// - #place   : 書く場所（select）
// - （任意）#status : ステータス表示（無くてもOK）
// - ボタンから check(), reveal(), next(), shuffle() を呼ぶ

let questions = [];
let order = [];
let pos = 0;

// 学習統計
let answeredCount = 0; // 判定した回数
let correctCount = 0;  // 正解数

// ---------- helpers ----------
function $(id) {
  return document.getElementById(id);
}

function normalizeCode(s) {
  // 空白・改行・区切り周りだけ軽く正規化（厳しすぎない）
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

// ---------- status ----------
function updateStatus() {
  const el = $("status");
  if (!el) return; // status欄が無ければ何もしない

  const total = questions.length || 0;
  const current = total ? (pos + 1) : 0;

  const accuracy = answeredCount === 0
    ? 0
    : Math.round((correctCount / answeredCount) * 100);

  el.textContent =
    `問題数：${current}問目/全${total}問　｜　正解数：${correctCount}問/${answeredCount}問　｜　正解率：${accuracy}%`;
}

// ---------- question render ----------
function renderQuestion() {
  const q = currentQ();
  if (!q) return;

  // 問題文だけ表示（ヘッダはstatus側で見せる）
  $("question").textContent = q.prompt ?? "";
}

// ---------- place judge ----------
function expectedPlacesFromQuestion(q) {
  // place_answers（配列）優先
  if (Array.isArray(q.place_answers)) return q.place_answers;
  // place_answer（単一）
  if (typeof q.place_answer === "string" && q.place_answer) return [q.place_answer];
  // 旧キー救済（もしあれば）
  if (typeof q.place_group_answer === "string" && q.place_group_answer) return [q.place_group_answer];
  return [];
}

function isPlaceRequired(q) {
  // 未指定は必須扱い（＝置き場判定を常に有効化）
  if (typeof q.place_required === "boolean") return q.place_required;
  return true;
}

// ---------- core ----------
function showQuestion() {
  const q = currentQ();
  if (!q) {
    if ($("question")) $("question").textContent = "問題が読み込めませんでした。";
    return;
  }

  clearAnswerUI();
  renderQuestion();
  updateStatus();
}

function check() {
  const q = currentQ();
  if (!q) return;

  const userCodeRaw = $("answer")?.value ?? "";
  const userCode = normalizeCode(userCodeRaw);
  const expCode = normalizeCode(q.expected ?? "");

  const selectedPlace = getSelectedPlace();
  const expectedPlaces = expectedPlacesFromQuestion(q);
  const placeRequired = isPlaceRequired(q);

  // 置き場判定
  let placeOK = true;
  if (placeRequired) {
    if (!selectedPlace) {
      placeOK = false;
    } else if (expectedPlaces.length > 0) {
      placeOK = expectedPlaces.includes(selectedPlace);
    } else {
      // 正解の置き場が未定義なら採点しない（OK扱い）
      placeOK = true;
    }
  }

  // コード判定（空欄は不正解）
  const codeOK = userCode.length > 0 && userCode === expCode;

  // 集計（判定したらカウント）
  answeredCount += 1;
  if (codeOK && placeOK) correctCount += 1;

  // 表示
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

    const reasons = [];
    if (!codeOK) reasons.push("コードが一致しません（第2引数：ThisItem/LookUp/Defaults、フィールド名、カンマ、引用符など）。");
    if (!placeOK) {
      if (!selectedPlace) reasons.push("置き場が未選択です。");
      else reasons.push(`置き場が違います（選択：${selectedPlace}）。`);
    }

    // 問題側に explain/focus があれば補足
    let extra = "";
    if (q.explain) extra = `\n\n補足：${q.explain}`;
    else if (q.focus) extra = `\n\n狙い：${q.focus}`;

    $("explain").textContent = reasons.join(" ") + extra;
  }

  updateStatus();
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
    // 1周したらシャッフルして先頭へ
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

// 任意：統計リセット（使いたければボタン追加して呼ぶ）
function resetStats() {
  answeredCount = 0;
  correctCount = 0;
  updateStatus();
}

// ---------- init ----------
async function init() {
  try {
    // キャッシュ回避（Pages反映遅れ対策）
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
    if ($("question")) {
      $("question").textContent =
        "読み込みに失敗しました。\n" +
        "・questions.json の場所/名前\n" +
        "・JSONの構文（カンマ/引用符/[]/{}）\n" +
        "を確認してください。\n\n" +
        `詳細: ${err?.message ?? err}`;
    }
  }
}

init();

// onclick から呼べるようにグローバル公開
window.check = check;
window.reveal = reveal;
window.next = next;
window.shuffle = shuffle;
window.resetStats = resetStats;
