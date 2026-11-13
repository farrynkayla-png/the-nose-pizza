(function () {
  var SITE = window.SITE || {};

  // --- Apply site settings to links ---------------------------------
  var links = {
    order: SITE.orderUrl,
    whatsapp: SITE.whatsapp && "https://wa.me/" + SITE.whatsapp,
    phone: SITE.phone && "tel:" + SITE.phone.replace(/\s/g, ""),
    email: SITE.email && "mailto:" + SITE.email,
    instagram: SITE.instagram,
    facebook: SITE.facebook,
  };

  document.querySelectorAll("[data-link]").forEach(function (el) {
    var href = links[el.dataset.link];
    if (!href) {
      (el.closest("li") || el).hidden = true;
      return;
    }
    el.href = href;
    // Ordering opens in the same tab (smoother in Instagram's browser); everything else in a new one
    if (/^https?:/.test(href) && el.dataset.link !== "order") {
      el.target = "_blank";
      el.rel = "noopener";
    }
  });

  document.querySelectorAll("[data-fill]").forEach(function (el) {
    var value = SITE[el.dataset.fill];
    if (value) el.textContent = value;
  });

  function whatsappUrl(message) {
    return "https://wa.me/" + SITE.whatsapp + "?text=" + encodeURIComponent(message);
  }

  // --- Wavy lettering: each letter of .hand text rides a wave ----------
  document.querySelectorAll(".hand").forEach(function (el) {
    var text = el.textContent;
    var letters = text.split("").map(function (ch, i) {
      var phase = i * 0.6;
      // still pose for reduced motion; the animation takes over otherwise
      var still = "translateY(" + (Math.sin(phase) * 0.2).toFixed(3) + "em) skewY(" + (Math.cos(phase) * 14).toFixed(1) + "deg)";
      return '<span style="--i:' + i + ";--still:" + still + '">' + (ch === " " ? "&nbsp;" : ch.replace(/[&<>]/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; })) + "</span>";
    }).join("");
    el.innerHTML = '<span class="sr-only">' + text.replace(/[&<>]/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }) + '</span><span class="wave-letters" aria-hidden="true">' + letters + "</span>";
  });

  // --- Mobile nav ----------------------------------------------------
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("nav");
  if (toggle && nav) {
    var setNav = function (open) {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
      nav.classList.toggle("open", open);
    };
    toggle.addEventListener("click", function () {
      setNav(toggle.getAttribute("aria-expanded") !== "true");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setNav(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("open")) {
        setNav(false);
        toggle.focus();
      }
    });
  }

  // --- Current page in nav ------------------------------------------
  var page = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("#nav a").forEach(function (a) {
    if (a.getAttribute("href") === page) a.setAttribute("aria-current", "page");
  });

  // --- Footer year ---------------------------------------------------
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  // --- Basket (saved in this browser, sent as one WhatsApp message) --
  var PRODUCTS = window.PRODUCTS || [];
  var SHIPPING = SITE.shipping || { flat: 99, freeOver: 600 };
  var BASKET_KEY = "nose-basket";

  function loadBasket() {
    try { return JSON.parse(localStorage.getItem(BASKET_KEY)) || []; } catch (e) { return []; }
  }
  function saveBasket() {
    try { localStorage.setItem(BASKET_KEY, JSON.stringify(basket)); } catch (e) { /* private mode: basket lasts this page only */ }
  }
  var basket = loadBasket().filter(function (line) { return findProduct(line.id); });

  function findProduct(id) {
    for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === id) return PRODUCTS[i];
    return null;
  }
  function linePrice(line) {
    var p = findProduct(line.id);
    if (p.options && p.options.prices) {
      var i = p.options.choices.indexOf(line.option);
      if (i >= 0) return p.options.prices[i];
    }
    return p.price;
  }
  function lineLabel(line) {
    var p = findProduct(line.id);
    var detail = line.option ? p.options.label + ": " + line.option : p.size;
    return p.name + " (" + detail + ")";
  }
  function money(n) { return "R" + n.toLocaleString("en-ZA"); }

  function addToBasket(id, option) {
    var existing = basket.filter(function (l) { return l.id === id && l.option === option; })[0];
    if (existing) existing.qty += 1;
    else basket.push({ id: id, option: option || "", qty: 1 });
    saveBasket();
    renderBasket();
  }

  // Basket bar + dialog are built once and shared by every page
  var bar = document.createElement("button");
  bar.type = "button";
  bar.className = "basket-bar";
  bar.hidden = true;
  document.body.appendChild(bar);

  var dialog = document.createElement("dialog");
  dialog.className = "basket";
  dialog.setAttribute("aria-labelledby", "basket-title");
  document.body.appendChild(dialog);
  var delivery = "courier";

  bar.addEventListener("click", function () {
    renderBasket();
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute("open", "");
  });
  dialog.addEventListener("click", function (e) {
    if (e.target === dialog || e.target.closest("[data-basket-close]")) dialog.close();
    var qtyBtn = e.target.closest("[data-qty]");
    if (qtyBtn) {
      var line = basket[+qtyBtn.dataset.index];
      line.qty += +qtyBtn.dataset.qty;
      if (line.qty < 1) basket.splice(+qtyBtn.dataset.index, 1);
      saveBasket();
      renderBasket();
    }
    if (e.target.closest("[data-basket-clear]")) {
      basket = [];
      saveBasket();
      renderBasket();
      dialog.close();
    }
  });
  dialog.addEventListener("change", function (e) {
    if (e.target.name === "delivery") {
      delivery = e.target.value;
      renderBasket();
    }
  });

  function renderBasket() {
    var count = basket.reduce(function (n, l) { return n + l.qty; }, 0);
    var subtotal = basket.reduce(function (n, l) { return n + l.qty * linePrice(l); }, 0);
    var collectOnly = basket.some(function (l) { return findProduct(l.id).collectOnly; });
    if (collectOnly) delivery = "collect";
    var shipping = delivery === "courier" && subtotal < SHIPPING.freeOver ? SHIPPING.flat : 0;
    var total = subtotal + shipping;

    bar.hidden = count === 0;
    bar.innerHTML = "<span>Your order · " + count + (count === 1 ? " item" : " items") + "</span><strong>" + money(subtotal) + "</strong>";

    var rows = basket.map(function (l, i) {
      return '<li><div><strong>' + findProduct(l.id).name + "</strong><span>" + (l.option ? findProduct(l.id).options.label + ": " + l.option : findProduct(l.id).size) + "</span></div>" +
        '<div class="basket-qty"><button type="button" data-qty="-1" data-index="' + i + '" aria-label="One less">−</button><span>' + l.qty +
        '</span><button type="button" data-qty="1" data-index="' + i + '" aria-label="One more">+</button></div>' +
        '<span class="basket-price">' + money(l.qty * linePrice(l)) + "</span></li>";
    }).join("");

    var lines = basket.map(function (l) { return "• " + l.qty + " × " + lineLabel(l) + " – " + money(l.qty * linePrice(l)); });
    var message = "Hi The Nose! I'd like to order:\n" + lines.join("\n") +
      "\n\n" + (delivery === "courier" ? "Delivery: courier (" + (shipping ? money(shipping) : "free") + ")" : "Delivery: I'll collect from 155 Main Road") +
      "\nTotal: " + money(total) +
      (delivery === "courier" ? "\n\nMy name and delivery address: " : "\n\nMy name: ");

    dialog.innerHTML =
      '<div class="basket-head"><h2 id="basket-title">Your order</h2><button type="button" class="basket-x" data-basket-close aria-label="Close">×</button></div>' +
      (count ? '<ul class="basket-lines">' + rows + "</ul>" +
        '<fieldset class="basket-delivery"><legend>Delivery</legend>' +
        '<label><input type="radio" name="delivery" value="courier"' + (delivery === "courier" ? " checked" : "") + (collectOnly ? " disabled" : "") +
        "> Courier anywhere in SA · " + money(SHIPPING.flat) + ", free over " + money(SHIPPING.freeOver) + "</label>" +
        '<label><input type="radio" name="delivery" value="collect"' + (delivery === "collect" ? " checked" : "") + "> Collect from 155 Main Road · free</label>" +
        (collectOnly ? '<p class="basket-warn">Something in your order is fresh or frozen, so it\'s collection only.</p>' : "") +
        "</fieldset>" +
        '<dl class="basket-totals"><div><dt>Subtotal</dt><dd>' + money(subtotal) + "</dd></div><div><dt>Delivery</dt><dd>" + (shipping ? money(shipping) : "Free") +
        '</dd></div><div class="basket-total"><dt>Total</dt><dd>' + money(total) + "</dd></div></dl>" +
        '<a class="btn btn-primary btn-block" target="_blank" rel="noopener" href="' + whatsappUrl(message) + '">Send order on WhatsApp</a>' +
        '<p class="basket-note">We\'ll confirm stock and reply with a secure card payment link. <button type="button" class="link-btn" data-basket-clear>Clear order</button></p>'
        : "<p>Your order is empty.</p>");
  }
  renderBasket();

  // --- Product cards -------------------------------------------------
  function productCard(p) {
    var card = document.createElement("article");
    card.className = "product";
    card.id = p.id;
    card.dataset.category = p.category;

    var media = p.image
      ? '<img src="' + p.image + '" alt="' + p.name + '" loading="lazy">'
      : '<div class="ph"><img src="images/logo-nose-cream.png" alt=""><span>photo coming soon</span></div>';

    var priceLabel = p.options && p.options.prices ? "From " + money(Math.min.apply(null, p.options.prices)) : money(p.price);
    var note = p.note ? '<p class="product-note">' + p.note + "</p>" : "";
    var details = p.details ? '<details class="product-details"><summary>Details</summary><p>' + p.details + "</p></details>" : "";
    var picker = "";
    if (p.options) {
      picker = '<label class="product-option">' + p.options.label +
        ' <select data-option>' + p.options.choices.map(function (c) { return "<option>" + c + "</option>"; }).join("") + "</select></label>";
    }
    var action = p.buyUrl
      ? '<a class="btn btn-primary btn-block" href="' + p.buyUrl + '">Order for collection</a>'
      : '<button class="btn btn-primary btn-block" type="button" data-add="' + p.id + '">Add to order</button>';

    card.innerHTML =
      '<div class="product-media">' + media + "</div>" +
      '<div class="product-body">' +
      '<div class="product-top"><h3>' + p.name + '</h3><span class="price">' + priceLabel + "</span></div>" +
      '<p class="product-size">' + p.size + "</p>" +
      "<p>" + p.description + "</p>" + note + details + picker + action +
      "</div>";
    return card;
  }

  document.querySelectorAll("[data-products]").forEach(function (grid) {
    var featuredOnly = grid.dataset.products === "featured";
    PRODUCTS.filter(function (p) { return !featuredOnly || p.featured; })
      .forEach(function (p) { grid.appendChild(productCard(p)); });

    grid.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-add]");
      if (!btn) return;
      var select = btn.closest(".product").querySelector("[data-option]");
      addToBasket(btn.dataset.add, select ? select.value : "");
      btn.textContent = "Added ✓";
      setTimeout(function () { btn.textContent = "Add to order"; }, 1500);
    });
  });

  // --- Hero chef: toss the pizza on load and on tap -------------------
  var chefPizza = document.querySelector("[data-chef-pizza]");
  if (chefPizza && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var tossPizza = function () {
      chefPizza.classList.remove("tossing");
      void chefPizza.offsetWidth; // restart the animation
      chefPizza.classList.add("tossing");
    };
    chefPizza.addEventListener("click", tossPizza);
    chefPizza.addEventListener("animationend", function (e) {
      if (e.animationName === "chef-toss") chefPizza.classList.remove("tossing");
    });
    setTimeout(tossPizza, 900);
  }

  // --- "Can't decide?" pizza picker ---------------------------------
  var PIZZAS = window.PIZZAS || [];
  var result = document.querySelector("[data-picker-result]");
  if (result && PIZZAS.length) {
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var toss = document.querySelector("[data-picker-toss]");
    var photo = document.querySelector("[data-picker-photo]");
    var intro = document.querySelector("[data-picker-intro]");
    var names = document.querySelectorAll("[data-picker-name]");
    var desc = document.querySelector("[data-picker-desc]");
    var tip = document.querySelector("[data-picker-tip]");
    var order = document.querySelector("[data-picker-order]");
    var honey = document.querySelector("[data-picker-honey]");
    var note = document.querySelector("[data-picker-note]");
    var spin = document.querySelector("[data-picker-spin]");
    var last = -1;

    var randomIndex = function () {
      var i;
      do { i = Math.floor(Math.random() * PIZZAS.length); } while (PIZZAS.length > 1 && i === last);
      return i;
    };
    var showName = function (name) { names.forEach(function (el) { el.textContent = name; }); };

    var reveal = function (pizza) {
      showName(pizza.name);
      desc.textContent = pizza.description;
      tip.hidden = !pizza.tip;
      tip.textContent = pizza.tip || "";
      result.classList.remove("spinning");
      if (pizza.image) {
        toss.hidden = true;
        photo.src = pizza.image;
        photo.alt = pizza.name;
        photo.hidden = false;
      }
      toss.classList.remove("tossing");
      // Straight into the Storekit basket when we know the PLU, otherwise the pizza section
      order.href = pizza.plu && SITE.basketUrl ? SITE.basketUrl + pizza.plu + ":1" : (SITE.orderPizzaUrl || SITE.orderUrl);
      honey.hidden = !(pizza.plu && SITE.basketUrl && SITE.honeyPlu && /honey/i.test(pizza.tip || ""));
      if (!honey.hidden) honey.href = SITE.basketUrl + pizza.plu + ":1," + SITE.honeyPlu + ":1";
      order.hidden = false;
      note.hidden = false;
      spin.disabled = false;
      spin.textContent = "Toss again";
    };

    spin.addEventListener("click", function () {
      var pick = last = randomIndex();
      var pizza = PIZZAS[pick];
      intro.hidden = true;
      result.hidden = false;
      if (reduceMotion) return reveal(pizza);

      // Toss the illustrated pizza while names shuffle, then land on the photo
      spin.disabled = true;
      order.hidden = true;
      honey.hidden = true;
      note.hidden = true;
      photo.hidden = true;
      toss.hidden = false;
      toss.classList.remove("tossing");
      void toss.offsetWidth; // restart the animation
      toss.classList.add("tossing");
      result.classList.add("spinning");
      desc.textContent = "";
      tip.hidden = true;

      var loaded = !pizza.image;
      var tossed = false;
      if (pizza.image) {
        var img = new Image();
        img.onload = img.onerror = function () { loaded = true; if (tossed) reveal(pizza); };
        img.src = pizza.image;
        setTimeout(function () { if (!loaded) { loaded = true; if (tossed) reveal(pizza); } }, 2500);
      }
      var timer = setInterval(function () {
        showName(PIZZAS[Math.floor(Math.random() * PIZZAS.length)].name);
      }, 80);
      setTimeout(function () {
        clearInterval(timer);
        tossed = true;
        if (loaded) reveal(pizza);
        else showName(pizza.name);
      }, 1300);
    });
  }

  // --- Loyalty card demo: fill the pizza slice by slice -------------
  var sliceCard = document.querySelector("[data-slice-card]");
  if (sliceCard) {
    var slices = sliceCard.querySelectorAll("[data-slice]");
    var count = sliceCard.querySelector("[data-slice-count]");
    var msg = sliceCard.querySelector("[data-slice-msg]");
    var add = sliceCard.querySelector("[data-slice-add]");
    var reset = sliceCard.querySelector("[data-slice-reset]");
    var filled = 0;
    var messages = {
      1: "Your first slice! Every order earns one.",
      2: "Two down. Mamma would be proud.",
      3: "Three slices – nearly halfway.",
      4: "Half a pizza! 🎉 That's a free hot honey drizzle or extra cannoli.",
      5: "Five slices. The oven's warming up.",
      6: "Six! You can almost smell it.",
      7: "One more slice to go…",
      8: "The whole pizza! 🍕 Pick a free Margherita or a Classic Cannoli Combo.",
    };
    add.addEventListener("click", function () {
      if (filled >= slices.length) return;
      slices[filled].classList.add("on");
      filled += 1;
      count.textContent = filled;
      msg.textContent = messages[filled];
      reset.hidden = false;
      if (filled === slices.length) {
        sliceCard.classList.add("full");
        add.disabled = true;
      }
    });
    reset.addEventListener("click", function () {
      filled = 0;
      slices.forEach(function (s) { s.classList.remove("on"); });
      sliceCard.classList.remove("full");
      count.textContent = "0";
      msg.textContent = "Tap below to see how it works.";
      add.disabled = false;
      reset.hidden = true;
    });
  }

  // --- Shop filters --------------------------------------------------
  var filters = document.querySelectorAll("[data-filter]");
  filters.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var cat = btn.dataset.filter;
      filters.forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
      document.querySelectorAll(".product").forEach(function (card) {
        card.hidden = cat !== "all" && card.dataset.category !== cat;
      });
    });
  });

  // --- Forms ---------------------------------------------------------
  // Links like <a data-prefill='{"enquirer":"Wedding planner"}'> fill in the form they jump to
  document.querySelectorAll("[data-prefill]").forEach(function (link) {
    link.addEventListener("click", function () {
      var form = document.querySelector(link.getAttribute("href") + " form") || document.querySelector(link.getAttribute("href"));
      if (!form) return;
      var values = JSON.parse(link.dataset.prefill);
      Object.keys(values).forEach(function (name) {
        form.querySelectorAll('[name="' + name + '"]').forEach(function (field) {
          if (field.type === "radio" || field.type === "checkbox") {
            if (field.value === values[name]) field.checked = true;
          } else {
            field.value = values[name];
          }
          field.dispatchEvent(new Event("change", { bubbles: true }));
        });
      });
    });
  });

  // Show fields only for certain answers: data-show-when="enquirer=Wedding planner|Venue|Company"
  document.querySelectorAll("[data-show-when]").forEach(function (el) {
    var parts = el.dataset.showWhen.split("=");
    var form = el.closest("form");
    var update = function () {
      var checked = form.querySelector('[name="' + parts[0] + '"]:checked');
      el.hidden = !checked || parts[1].split("|").indexOf(checked.value) < 0;
    };
    form.addEventListener("change", update);
    update();
  });

  // "Date not set yet" makes the date optional and greys it out
  document.querySelectorAll("[data-date-flexible]").forEach(function (box) {
    var date = document.getElementById(box.dataset.dateFlexible);
    box.addEventListener("change", function () {
      date.disabled = box.checked;
      if (box.checked) date.value = "";
    });
  });

  // --- Thank-you page: message depends on which form was sent ---------
  var thanks = document.querySelectorAll("[data-thanks]");
  if (thanks.length) {
    var form = new URLSearchParams(location.search).get("f") || "event";
    var shown = false;
    thanks.forEach(function (el) {
      el.hidden = el.dataset.thanks !== form;
      if (!el.hidden) shown = true;
    });
    if (!shown) thanks[0].hidden = false;
  }
})();
