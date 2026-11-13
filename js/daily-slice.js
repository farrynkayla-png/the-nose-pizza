// ------------------------------------------------------------
// The Daily Slice – the daily pizza word game
//
// A new 5-letter word every day at midnight (South African time).
// Progress, streaks and points are saved in the player's browser.
// To add words: append 5-letter words to ANSWERS (order = schedule,
// so only add to the end once the game is live).
// ------------------------------------------------------------
(function () {
  var root = document.querySelector("[data-daily-slice]");
  if (!root) return;

  var ANSWERS = [
    "DOUGH", "BASIL", "CRUST", "OLIVE", "HONEY", "PESTO", "SAUCE", "SLICE", "FLOUR", "YEAST",
    "OVENS", "PIZZA", "CAPER", "BACON", "ONION", "KNEAD", "PROOF", "FLAME", "EMBER", "SMOKE",
    "CRISP", "SPICY", "ZESTY", "SAUCY", "GOOEY", "MELTY", "TASTY", "HERBS", "THYME", "WHEAT",
    "PASTA", "NONNA", "MAMMA", "LATTE", "COCOA", "SUGAR", "LEMON", "CREAM", "PRAWN", "SQUID",
    "FUNGI", "FORNO", "PEELS", "BOXES", "ORDER", "CHEFS", "FRESH", "SALTY", "CHEWY", "GRAIN",
    "TOAST", "FEAST", "SNIFF", "NOSEY", "BAKED", "MOCHA", "SPOON", "PLATE", "TABLE",
  ].filter(function (w) { return w.length === 5; });

  var LAUNCH = Date.UTC(2026, 10, 6); // Daily Slice #1 = 6 November 2026
  var DAY = 86400000;
  var SAST = 2 * 3600000; // UTC+2
  var MAX = 6;
  var KEY = "daily-slice";

  var dayNumber = Math.floor((Date.now() + SAST - LAUNCH) / DAY) + 1;
  var answer = ANSWERS[((dayNumber - 1) % ANSWERS.length + ANSWERS.length) % ANSWERS.length];

  // --- Saved state ----------------------------------------------------
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* private mode: progress lasts this visit */ }
  }
  var store = load();
  store.stats = store.stats || { played: 0, wins: 0, streak: 0, best: 0, points: 0, dist: [0, 0, 0, 0, 0, 0], lastWin: 0 };
  if (!store.today || store.today.day !== dayNumber) store.today = { day: dayNumber, guesses: [], done: false, won: false };
  var today = store.today;
  var stats = store.stats;

  // --- Elements ---------------------------------------------------------
  var board = root.querySelector("[data-board]");
  var keyboard = root.querySelector("[data-keyboard]");
  var toast = root.querySelector("[data-toast]");
  var statsDialog = document.querySelector("[data-stats]");
  root.querySelector("[data-number]").textContent = "#" + dayNumber;

  var current = "";
  var busy = false;

  // Board: 6 rows × 5 tiles
  for (var r = 0; r < MAX; r++) {
    var row = document.createElement("div");
    row.className = "dd-row";
    for (var c = 0; c < 5; c++) {
      var tile = document.createElement("div");
      tile.className = "dd-tile";
      row.appendChild(tile);
    }
    board.appendChild(row);
  }

  // Keyboard
  ["QWERTYUIOP", "ASDFGHJKL", "+ZXCVBNM-"].forEach(function (letters) {
    var line = document.createElement("div");
    line.className = "dd-keys";
    letters.split("").forEach(function (ch) {
      var key = document.createElement("button");
      key.type = "button";
      key.className = "dd-key";
      if (ch === "+") { key.textContent = "Enter"; key.dataset.key = "Enter"; key.classList.add("dd-wide"); }
      else if (ch === "-") { key.textContent = "⌫"; key.dataset.key = "Backspace"; key.setAttribute("aria-label", "Delete"); key.classList.add("dd-wide"); }
      else { key.textContent = ch; key.dataset.key = ch; }
      line.appendChild(key);
    });
    keyboard.appendChild(line);
  });

  // --- Scoring ------------------------------------------------------------
  function score(guess) {
    var result = ["absent", "absent", "absent", "absent", "absent"];
    var left = answer.split("");
    for (var i = 0; i < 5; i++) if (guess[i] === answer[i]) { result[i] = "correct"; left[i] = null; }
    for (i = 0; i < 5; i++) {
      if (result[i] === "correct") continue;
      var j = left.indexOf(guess[i]);
      if (j >= 0) { result[i] = "present"; left[j] = null; }
    }
    return result;
  }

  var RANK = { absent: 1, present: 2, correct: 3 };
  function paintKeys() {
    var best = {};
    today.guesses.forEach(function (g) {
      score(g).forEach(function (s, i) {
        if (!best[g[i]] || RANK[s] > RANK[best[g[i]]]) best[g[i]] = s;
      });
    });
    keyboard.querySelectorAll("[data-key]").forEach(function (k) {
      k.dataset.state = best[k.dataset.key] || "";
    });
  }

  function paintRow(index, word, states, animate) {
    var tiles = board.children[index].children;
    for (var i = 0; i < 5; i++) {
      (function (tile, letter, state, delay) {
        tile.textContent = letter || "";
        tile.classList.toggle("filled", !!letter);
        if (!state) { tile.dataset.state = ""; return; }
        if (!animate) { tile.dataset.state = state; return; }
        setTimeout(function () {
          tile.classList.add("flip");
          setTimeout(function () { tile.dataset.state = state; }, 250);
        }, delay);
      })(tiles[i], word[i], states && states[i], i * 280);
    }
  }

  function render() {
    today.guesses.forEach(function (g, i) { paintRow(i, g, score(g), false); });
    if (!today.done && today.guesses.length < MAX) paintRow(today.guesses.length, current, null, false);
    paintKeys();
  }

  function say(text, ms) {
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(say.t);
    if (ms) say.t = setTimeout(function () { toast.hidden = true; }, ms);
  }

  function shake() {
    var row = board.children[today.guesses.length];
    row.classList.remove("shake");
    void row.offsetWidth;
    row.classList.add("shake");
  }

  // --- Turn -----------------------------------------------------------------
  var CHEERS = ["Mamma mia! 🤌", "Bellissimo!", "Chef's kiss!", "Pizza perfection!", "Nice slice!", "Phew, just in time!"];

  function submit() {
    if (current.length < 5) { shake(); say("Not enough letters", 1500); return; }
    var guess = current;
    var states = score(guess);
    today.guesses.push(guess);
    current = "";
    busy = true;
    paintRow(today.guesses.length - 1, guess, states, true);

    setTimeout(function () {
      busy = false;
      paintKeys();
      var won = guess === answer;
      if (won || today.guesses.length === MAX) finish(won);
      save();
    }, 5 * 280 + 300);
    save();
  }

  function finish(won) {
    today.done = true;
    today.won = won;
    stats.played += 1;
    if (won) {
      var tries = today.guesses.length;
      stats.wins += 1;
      stats.dist[tries - 1] += 1;
      stats.streak = stats.lastWin === dayNumber - 1 ? stats.streak + 1 : 1;
      stats.lastWin = dayNumber;
      stats.best = Math.max(stats.best, stats.streak);
      today.points = (MAX + 1 - tries) * 10 + Math.min(stats.streak, 10) * 2; // fewer guesses + streak bonus
      stats.points += today.points;
      say(CHEERS[tries - 1] + " +" + today.points + " points", 2500);
      root.classList.add("won");
    } else {
      stats.streak = 0;
      say("Today's word was " + answer, 3000);
    }
    save();
    setTimeout(openStats, won ? 1800 : 2200);
  }

  function press(key) {
    if (today.done || busy) return;
    if (key === "Enter") return submit();
    if (key === "Backspace") current = current.slice(0, -1);
    else if (/^[A-Z]$/.test(key) && current.length < 5) current += key;
    paintRow(today.guesses.length, current, null, false);
  }

  keyboard.addEventListener("click", function (e) {
    var k = e.target.closest("[data-key]");
    if (k) { press(k.dataset.key); k.blur(); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || (statsDialog && statsDialog.open)) return;
    if (e.key === "Enter" || e.key === "Backspace") { e.preventDefault(); press(e.key); }
    else if (/^[a-z]$/i.test(e.key)) press(e.key.toUpperCase());
  });

  // --- Stats + share ------------------------------------------------------
  function shareText() {
    var grid = today.guesses.map(function (g) {
      return score(g).map(function (s) { return s === "correct" ? "🟩" : s === "present" ? "🍕" : "⬛"; }).join("");
    }).join("\n");
    return "The Daily Slice #" + dayNumber + " " + (today.won ? today.guesses.length : "X") + "/6" +
      (stats.streak > 1 ? " 🔥" + stats.streak : "") + "\n" + grid + "\nthenosepizza.co.za/daily-slice.html";
  }

  function countdown() {
    var now = Date.now() + SAST;
    var left = DAY - (now % DAY);
    var h = Math.floor(left / 3600000), m = Math.floor(left / 60000) % 60, s = Math.floor(left / 1000) % 60;
    return h + "h " + ("0" + m).slice(-2) + "m " + ("0" + s).slice(-2) + "s";
  }

  function openStats() {
    if (!statsDialog) return;
    var maxDist = Math.max.apply(null, stats.dist.concat(1));
    statsDialog.querySelector("[data-stat-body]").innerHTML =
      '<div class="dd-stats">' +
      "<div><strong>" + stats.points + "</strong><span>Points</span></div>" +
      "<div><strong>" + stats.played + "</strong><span>Played</span></div>" +
      "<div><strong>" + (stats.played ? Math.round(stats.wins / stats.played * 100) : 0) + "%</strong><span>Won</span></div>" +
      "<div><strong>" + stats.streak + "</strong><span>Streak 🔥</span></div>" +
      "<div><strong>" + stats.best + "</strong><span>Best streak</span></div>" +
      "</div>" +
      '<h3 class="dd-sub">Guesses</h3><ol class="dd-dist">' +
      stats.dist.map(function (n, i) {
        var mine = today.won && today.guesses.length === i + 1;
        return '<li><span>' + (i + 1) + '</span><b class="' + (mine ? "mine" : "") + '" style="width:' + Math.max(8, n / maxDist * 100) + '%">' + n + "</b></li>";
      }).join("") + "</ol>" +
      (today.done
        ? '<p class="dd-result">' + (today.won ? "Solved in " + today.guesses.length + (today.points ? " · +" + today.points + " points" : "") : "Today's word was <strong>" + answer + "</strong>") + "</p>" +
          '<div class="btn-row"><button class="btn btn-primary" type="button" data-share>Share your result</button>' +
          '<a class="btn btn-outline" href="' + ((window.SITE && SITE.orderUrl) || "https://order.storekit.com/the-nose-pizza/menu/") + '">Order a pizza</a></div>' +
          '<p class="dd-next">Next slice in <span data-countdown>' + countdown() + "</span></p>"
        : "<p class=\"dd-result\">Finish today's word to share your result.</p>");
    if (statsDialog.showModal) statsDialog.showModal(); else statsDialog.setAttribute("open", "");
  }

  if (statsDialog) {
    setInterval(function () {
      var el = statsDialog.querySelector("[data-countdown]");
      if (el) el.textContent = countdown();
    }, 1000);
    statsDialog.addEventListener("click", function (e) {
      if (e.target === statsDialog || e.target.closest("[data-close]")) statsDialog.close();
      if (e.target.closest("[data-share]")) {
        var text = shareText();
        if (navigator.share) {
          navigator.share({ text: text }).catch(function () {});
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(function () { say("Copied – paste it anywhere!", 2000); });
        } else {
          window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank");
        }
      }
    });
  }
  document.querySelectorAll("[data-open-stats]").forEach(function (b) { b.addEventListener("click", openStats); });

  render();
  if (today.done) {
    if (today.won) root.classList.add("won");
    say(today.won ? "You've solved today's Daily Slice!" : "Today's word was " + answer + ". Back tomorrow!", 0);
  }
})();
