<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Patch特訓</title>

<style>
:root{
  --border:#ddd;
  --bg:#fafafa;
  --card:#fff;
  --text:#111;
  --muted:#666;
  --ok:#2e7d32;
  --ng:#c62828;
  --blue:#1976d2;
}

*{ box-sizing:border-box; }
body{
  margin:0;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans JP",sans-serif;
  color:var(--text);
}

.container{
  display:flex;
  min-height:100vh;
}

/* ===== 左サイド ===== */
.sidebar{
  width:320px;
  border-right:1px solid var(--border);
  background:var(--bg);
  padding:16px;
}

.card{
  border:1px solid var(--border);
  border-radius:12px;
  padding:12px;
  background:#fff;
  margin-bottom:14px;
}

.section-title{
  font-size:13px;
  font-weight:800;
  color:#444;
  margin-bottom:8px;
}

#status{
  line-height:1.75;
  font-weight:700;
}

.small-note{
  margin-top:8px;
  font-size:12px;
  color:var(--muted);
}

.wrong-list{
  display:flex;
  flex-direction:column;
  gap:10px;
}

.wrong-item{
  border:1px solid var(--border);
  border-radius:10px;
  padding:10px;
}

.badge{
  font-size:12px;
  border:1px solid var(--border);
  padding:2px 8px;
  border-radius:999px;
}

.badge-red{
  background:#ffecec;
  border-color:#f0b4b4;
}

/* ===== メイン ===== */
.main{
  flex:1;
  padding:24px;
}

.main-inner{
  max-width:900px;
  margin:0 auto;
}

h1{
  margin-bottom:16px;
}

.box{
  border:1px solid var(--border);
  border-radius:12px;
  padding:12px;
  background:#fff;
  margin-bottom:14px;
}

textarea{
  width:100%;
  height:90px;
  font-size:16px;
  padding:10px;
  border-radius:10px;
  border:1px solid var(--border);
  font-family:monospace;
}

/* 置く場所 + ボタン */
.place-area{
  display:flex;
  gap:12px;
}

select{
  width:100%;
  padding:10px;
  border-radius:10px;
  border:1px solid var(--border);
}

.place-buttons{
  display:flex;
  flex-direction:column;
  gap:10px;
  width:120px;
}

.place-buttons button{
  padding:12px;
  border:none;
  border-radius:10px;
  color:#fff;
  font-weight:800;
  cursor:pointer;
}

#btnCheck{ background:#e53935; }
#btnNext{ background:#1976d2; }

/* 判定エリア */
.result-title{
  font-size:22px;
  font-weight:900;
}

.result-box{
  border:1px solid var(--border);
  border-radius:12px;
  padding:12px;
  margin-top:10px;
}

.ok{ background:#f1fbf2; }
.ng{ background:#fff1f1; }

pre{
  white-space:pre-wrap;
  font-family:monospace;
}
</style>
</head>

<body>
<div class="container">

  <!-- 左サイド -->
  <aside class="sidebar">
    <div class="card">
      <div class="section-title">進捗</div>
      <div id="status">読み込み中…</div>
    </div>

    <div class="card">
      <div class="section-title">間違えた問題</div>
      <div id="wrongList" class="wrong-list"></div>
    </div>
  </aside>

  <!-- メイン -->
  <main class="main">
    <div class="main-inner">

      <h1>Patch特訓</h1>

      <!-- 問題 -->
      <div class="box">
        <div class="section-title">問題</div>
        <div id="question"></div>
      </div>

      <!-- 回答 -->
      <div class="box">
        <div class="section-title">回答（Power Fx）</div>
        <textarea id="answer"></textarea>
      </div>

      <!-- 置く場所 -->
      <div class="box">
        <div class="section-title">置く場所</div>

        <div class="place-area">
          <div style="flex:1;">
            <select id="place">
              <option value="">選択してください</option>
              <option value="Text">Text</option>
              <option value="Items">Items</option>
              <option value="Visible">Visible</option>
              <option value="Set">Set</option>
              <option value="UpdateContext">UpdateContext</option>
              <option value="OnSelect">OnSelect</option>
              <option value="OnVisible">OnVisible</option>
            </select>
          </div>

          <div class="place-buttons">
            <button id="btnCheck" onclick="check()">判定</button>
            <button id="btnNext" onclick="next()">次へ</button>
          </div>
        </div>
      </div>

      <!-- 判定 -->
      <div id="resultWrap" style="display:none;">
        <div class="result-title" id="resultTitle"></div>

        <div class="result-box" id="resultBox">
          <div class="section-title">正解</div>
          <pre id="correct"></pre>
          <div id="placeCorrectLine"></div>
        </div>

        <div class="result-box">
          <div class="section-title">解説</div>
          <div id="explain"></div>
        </div>
      </div>

    </div>
  </main>

</div>

<script src="app.js"></script>
</body>
</html>
