let questions = [];
let index = 0;

fetch("questions.json")
  .then(res => res.json())
  .then(data => {
    questions = data;
    show();
  });

function show() {
  document.getElementById("question").innerText = questions[index].prompt;
  document.getElementById("answer").value = "";
  document.getElementById("result").innerText = "";
  document.getElementById("correct").innerText = "";
}

function check() {
  let user = document.getElementById("answer").value.trim();
  let correct = questions[index].expected;

  if (user === correct) {
    document.getElementById("result").innerText = "正解！";
  } else {
    document.getElementById("result").innerText = "不正解";
    document.getElementById("correct").innerText = correct;
  }
}

function next() {
  index++;
  if (index >= questions.length) index = 0;
  show();
}