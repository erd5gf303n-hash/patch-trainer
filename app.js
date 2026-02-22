function getSelectedPlace() {
  const sel = document.getElementById("place");
  return sel ? sel.value : "";
}

function check() {
  const q = currentQ(); // ←あなたのコードで現在の問題を返す関数名に合わせてOK

  // --- コード判定（あなたの既存ロジックがあればそれを残してOK）
  const userCode = normalize(document.getElementById("answer").value);
  const expCode  = normalize(q.expected || "");
  const codeOK = userCode === expCode;

  // --- 置き場判定（ここが本体）
  const selectedPlace = getSelectedPlace();

  // JSON側の正解（複数対応もできるように）
  const expectedPlaces = Array.isArray(q.place_answers)
    ? q.place_answers
    : (q.place_answer ? [q.place_answer] : []);

  // 必須かどうか（未指定なら true 扱いにして「必ず判定」させる）
  const placeRequired = (q.place_required !== undefined) ? q.place_required : true;

  let placeOK = true;

  if (placeRequired) {
    // まだ選んでないならNG
    if (!selectedPlace) {
      placeOK = false;
    } else if (expectedPlaces.length > 0) {
      // 正解候補に入っているか
      placeOK = expectedPlaces.includes(selectedPlace);
    } else {
      // 正解が定義されてない問題は「置き場採点しない」
      placeOK = true;
    }
  }

  // --- デバッグ表示（今だけ。動いたら消してOK）
  console.log("[PLACE DEBUG]",
    { selectedPlace, expectedPlaces, placeRequired, placeOK }
  );

  // --- 総合判定
  const ok = codeOK && placeOK;

  const result = document.getElementById("result");
  const correct = document.getElementById("correct");
  const explain = document.getElementById("explain");

  if (ok) {
    result.textContent = "正解";
  } else {
    result.textContent = "不正解";
    correct.textContent =
      "模範:\n" + (q.expected || "") +
      "\n\n置き場:\n" + (expectedPlaces.length ? expectedPlaces.join(" / ") : "(指定なし)");

    explain.textContent = "";
    if (!codeOK) explain.textContent += "コードが一致しません。";
    if (!placeOK) explain.textContent += (explain.textContent ? " / " : "") + "置き場が違います（または未選択）。";
  }
}
