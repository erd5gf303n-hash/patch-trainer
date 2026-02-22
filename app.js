// app.js（フルコード）
// 前提：index.html 側に以下の要素がある
// #question, #answer, #result, #correct, #explain
// 置き場：<select id="place"> ... </select>
// ボタン：onclick="check()", "reveal()", "next()", "shuffle()"

let questions = [];
let order = [];
let pos = 0;

// ---------- helpers ----------
function $(id) {
  return document.getElementById(id);
}

function normalizeCode(s) {
  // 「空白の違い」程度は吸収する（完全一致は維持）
  // ※ここを緩くしすぎると誤答も通るので、最初は控えめ
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
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
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
  setPlaceValue(""); // プルダウンを未選択に戻す
}

function currentQ() {
  if (!questions.length) return null;
  return questions[order[pos]];
}

function renderProgress() {
  // 「読み込み中」を消したいので、進捗は question に小さく付けるだけ
  const q = currentQ();
  if (!q) return;
  const total = questions.length;
  const n = pos + 1;

  const header = `【${n}/${total}】(id:${q.id ?? "?"})`;
  // question欄へヘッダ＋本文を表示
  const body = q.prompt ?? "";
  $("question").textContent = `${header}\n${body}`;
}

// ---------- core ----------
function showQuestion() {
  const q = currentQ();
  if (!q) {
    if ($("question")) $("question").textContent = "問題が読み込めませんでした。";
    return;
  }
  clearAnswerUI();
  renderProgress();
}

function expectedPlacesFromQuestion(q) {
  // 置き場の正解を柔軟に吸収
  // 優先：place_answers（配列）
  // 次：place_answer（単一）
  // 次：place_group_answer（古い形式を単一扱いで救済）
  if (Array.isArray(q.place_answers)) return q.place_answers;
  if (typeof q.place_answer === "string" && q.place_answer) return [q.place_answer];
  if (typeof q.place_group_answer === "string" && q.place_group_answer) return [q.place_group_answer];
  return [];
}

function isPlaceRequired(q) {
  // 指定が無ければ「必須」にする（＝必ず判定させる）
  if (typeof q.place_required === "boolean") return q.place_required;
  return true;
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
    // 未選択はNG
    if (!selectedPlace) {
      placeOK = false;
    } else if (expectedPlaces.length > 0) {
      // 正解候補に含まれているか
      placeOK = expectedPlaces.includes(selectedPlace);
    } else {
      // 正解が定義されていない問題は採点しない（＝OK扱い）
      placeOK = true;
    }
  }

  const ok = codeOK && placeOK;

  // 表示
  if (ok) {
    $("result").textContent = "正解";
    $("correct").textContent = "";
    $("explain").textContent = "OK。次は「なぜその置き場か」を1行で言語化してから次へ。";
  } else {
    $("result").textContent = "不正解";

    // 模範解答を表示
    const placeText =
      expectedPlaces.length > 0 ? expectedPlaces.join(" / ") : "(指定なし)";
    $("correct").textContent =
      `【模範】\n${q.expected ?? ""}\n\n【置き場】\n${placeText}`;

    // 解説（理由）
    const reasons = [];
    if (!codeOK) {
      reasons.push("コードが一致しません（引数・ThisItem/LookUp/Defaults・引用符・カンマ等を確認）。");
    }
    if (!placeOK) {
      if (!selectedPlace) {
        reasons.push("置き場が未選択です。");
      } else {
        reasons.push("置き場が違います（Patchは基本“イベント”側＝OnSelect/OnVisible、表示用プロパティには置かない）。");
      }
    }
    $("explain").textContent = reasons.join(" ");
  }

  // デバッグしたい時だけ使う（必要なら残してOK）
  // console.log("[DEBUG]", { selectedPlace, expectedPlaces, placeRequired, placeOK, codeOK });
}

function reveal() {
  const q = currentQ();
  if (!q) return;

  const expectedPlaces = expectedPlacesFromQuestion(q);
  const placeText =
    expectedPlaces.length > 0 ? expectedPlaces.join(" / ") : "(指定なし)";

  $("correct").textContent =
    `【模範】\n${q.expected ?? ""}\n\n【置き場】\n${placeText}`;

  if (q.focus) {
    $("explain").textContent = `狙い：${q.focus}`;
  } else {
    $("explain").textContent = "";
  }
}

function next() {
  if (!questions.length) return;
  pos += 1;
  if (pos >= order.length) {
    // 1周したら再シャッフル
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

// ---------- keyboard shortcuts ----------
function wireShortcuts() {
  const ta = $("answer");
  if (!ta) return;

  ta.addEventListener("keydown", (e) => {
    // Enter：判定（通常Enterは改行になるので、判定を優先したいなら preventDefault）
    // Ctrl+Enter：次へ
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      next();
      return;
    }

    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      // Enter単体で判定
      e.preventDefault();
      check();
      return;
    }
  });
}

// ---------- init ----------
async function init() {
  try {
    // キャッシュ回避（更新が反映されない対策）
    const url = `./questions.json?v=${Date.now()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`questions.json fetch failed: ${res.status}`);

    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("questions.json is not an array");

    // idが無い場合は付与
    questions = data.map((q, i) => ({
      id: q.id ?? (i + 1),
      ...q,
    }));

    // 最低限フィールドチェック
    const broken = questions.find(x => !x.prompt || !x.expected);
    if (broken) {
      // 動作はさせつつ、注意を出す
      console.warn("Some questions are missing prompt/expected:", broken);
    }

    shuffle();
    wireShortcuts();
  } catch (err) {
    console.error(err);
    if ($("question")) {
      $("question").textContent =
        "読み込みに失敗しました。\n" +
        "・questions.json のファイル名/場所\n" +
        "・JSONの構文（カンマ/改行/引用符）\n" +
        "を確認してください。\n\n" +
        `詳細: ${err?.message ?? err}`;
    }
  }
}

init();

// グローバルに公開（onclick から呼べるようにする）
window.check = check;
window.reveal = reveal;
window.next = next;
window.shuffle = shuffle;
