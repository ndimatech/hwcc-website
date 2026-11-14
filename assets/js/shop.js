/* His Word Christian Centre: shop (cart + Yoco checkout).
   Products, colours, sizes and prices come from _data/shop.json via the page markup.
   The checkout server (Cloudflare Worker, see worker/) re-prices every order from the same file,
   so a price changed in the browser is ignored. */
(function () {
  var shop = document.querySelector('[data-shop]');
  if (!shop) return;
  // Test mode: the shop is hidden from the public and shows only at /?shoptest=1 (remembered for this visit).
  if (shop.hasAttribute('data-shop-test')) {
    var on = /[?&]shoptest=1/.test(window.location.search);
    try { if (on) sessionStorage.setItem('hwcc-shoptest', '1'); else on = sessionStorage.getItem('hwcc-shoptest') === '1'; } catch (e) {}
    if (!on) return;
    shop.hidden = false;
    document.querySelectorAll('[data-shop-test-link]').forEach(function (el) { el.hidden = false; });
    shop.querySelectorAll('[data-test-item]').forEach(function (el) { el.hidden = false; });   // R10 payment-test item
    var give = document.getElementById('give');   // shop sand, then Give on maroon so the two are clearly separate
    if (give) { give.classList.remove('sec-sand'); give.classList.add('sec-maroon'); }
    var note = document.createElement('p');
    note.className = 'shop-note'; note.textContent = 'TEST MODE: this shop is not public yet.';
    shop.querySelector('.shop-head').prepend(note);
  }
  var API = (shop.getAttribute('data-api') || '').replace(/\/$/, '');
  var DELIVERY = Number(shop.getAttribute('data-delivery')) || 0;
  var TS_KEY = shop.getAttribute('data-turnstile') || '';

  // ---- Bot check (Cloudflare Turnstile): usually invisible; a box appears only when Cloudflare is unsure ----
  var ts = { id: null, loading: false };
  function mountBotCheck() {
    if (!TS_KEY || ts.loading) return;
    ts.loading = true;
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = function () {
      var box = drawer.querySelector('[data-botcheck]');
      if (window.turnstile && box) ts.id = window.turnstile.render(box, { sitekey: TS_KEY, appearance: 'interaction-only' });
    };
    document.head.appendChild(s);
  }
  function botToken() { try { return ts.id != null && window.turnstile ? window.turnstile.getResponse(ts.id) || '' : ''; } catch (e) { return ''; } }
  function botReset() { try { if (ts.id != null && window.turnstile) window.turnstile.reset(ts.id); } catch (e) {} }
  var KEY = 'hwcc-cart';
  var PROVINCES = ['Gauteng', 'Eastern Cape', 'Free State', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'];

  function R(c) { return 'R' + Math.round(c / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); }
  function count(event) { try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: event, event: true }); } catch (e) {} }

  // ---- Catalogue, read from the cards ----
  var products = {};
  shop.querySelectorAll('[data-product]').forEach(function (el) {
    var colours = {};
    el.querySelectorAll('.swatch input').forEach(function (i) { colours[i.value] = { name: i.getAttribute('data-label'), img: i.getAttribute('data-img') }; });
    products[el.getAttribute('data-product')] = { el: el, name: el.getAttribute('data-name'), price: Number(el.getAttribute('data-price')), colours: colours };
  });

  // ---- Cart storage (falls back to memory if storage is blocked) ----
  var memory = [];
  function load() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return memory; }
  }
  function save(cart) { memory = cart; try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {} render(); }
  function valid(line) { var p = products[line.p]; return p && p.colours[line.c] && line.s && line.q > 0; }
  function cart() { return load().filter(valid); }
  function subtotal(c) { return c.reduce(function (t, l) { return t + products[l.p].price * l.q; }, 0); }

  // ---- Filters ----
  shop.querySelectorAll('[data-filter]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var f = btn.getAttribute('data-filter');
      shop.querySelectorAll('[data-filter]').forEach(function (b) { var on = b === btn; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
      Object.keys(products).forEach(function (id) { var el = products[id].el; el.hidden = f !== 'all' && el.getAttribute('data-kind') !== f; });
    });
  });

  // ---- Product cards ----
  Object.keys(products).forEach(function (id) {
    var p = products[id], el = p.el, img = el.querySelector('[data-product-img]'), msg = el.querySelector('[data-msg]');
    el.addEventListener('change', function (e) {
      if (e.target.name === id + '-colour') {
        var c = p.colours[e.target.value];
        img.src = c.img; img.alt = p.name + ', ' + c.name;
        el.querySelector('[data-colour-name]').textContent = c.name;
      }
      msg.textContent = '';
    });
    el.querySelector('[data-add]').addEventListener('click', function () {
      var col = el.querySelector('input[name="' + id + '-colour"]:checked');
      var size = el.querySelector('input[name="' + id + '-size"]:checked');
      if (!size) { msg.textContent = 'Please choose a size.'; el.querySelector('.sizes input').focus(); return; }
      var c = cart(), found = c.filter(function (l) { return l.p === id && l.c === col.value && l.s === size.value; })[0];
      if (found) found.q = Math.min(found.q + 1, 20); else c.push({ p: id, c: col.value, s: size.value, q: 1 });
      save(c);
      msg.textContent = 'Added: ' + p.colours[col.value].name + ', size ' + size.value + '.';
      count('shop-add: ' + p.name);
    });
  });

  // ---- Floating cart button ----
  var fab = document.createElement('button');
  fab.type = 'button'; fab.className = 'cart-fab'; fab.hidden = true;
  fab.setAttribute('data-goatcounter-click', 'shop-open-cart');
  document.body.appendChild(fab);
  fab.addEventListener('click', openDrawer);

  // ---- Drawer ----
  var drawer = document.createElement('div');
  drawer.className = 'drawer'; drawer.hidden = true;
  drawer.innerHTML =
    '<div class="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="cart-h">' +
      '<div class="drawer-top"><h2 id="cart-h">Your order</h2><button type="button" class="drawer-close" data-close>Close</button></div>' +
      '<ul class="cart-lines" data-lines></ul>' +
      '<form class="form-grid" data-checkout novalidate>' +
        '<fieldset class="opt form-grid"><legend>How would you like to get it?</legend>' +
          '<label class="choice"><input type="radio" name="fulfilment" value="collect" checked><span><b>Collect At Church</b>Free. We\'ll let you know when it\'s ready.</span></label>' +
          '<label class="choice"><input type="radio" name="fulfilment" value="deliver"><span><b>Delivery, ' + R(DELIVERY) + '</b>Sent by courier once it\'s ready.</span></label>' +
        '</fieldset>' +
        '<label class="field">Full name<input name="name" autocomplete="name" required maxlength="80"></label>' +
        '<label class="field">Cellphone (WhatsApp)<input name="phone" type="tel" autocomplete="tel" inputmode="tel" required maxlength="20" placeholder="e.g. 082 123 4567"></label>' +
        '<label class="field">Email (for your receipt)<input name="email" type="email" autocomplete="email" required maxlength="120"></label>' +
        '<div class="form-grid" data-address hidden>' +
          '<label class="field">Street address<input name="street" autocomplete="street-address" maxlength="120"></label>' +
          '<label class="field">Suburb<input name="suburb" maxlength="60"></label>' +
          '<label class="field">City or town<input name="city" autocomplete="address-level2" maxlength="60"></label>' +
          '<label class="field">Province<select name="province">' + PROVINCES.map(function (p) { return '<option>' + p + '</option>'; }).join('') + '</select></label>' +
          '<label class="field">Postal code<input name="postalCode" inputmode="numeric" autocomplete="postal-code" maxlength="4"></label>' +
        '</div>' +
        '<label class="field">Notes (optional)<textarea name="notes" maxlength="400"></textarea></label>' +
        '<div class="totals" data-totals></div>' +
        '<div class="botcheck" data-botcheck></div>' +
        '<button type="submit" class="btn btn-dark" data-pay>Pay</button>' +
        '<p class="checkout-msg" data-checkout-msg role="status"></p>' +
        '<p class="product-detail">Payment is by card through Yoco\'s secure checkout. Made to order: ready in 2 weeks. <a href="returns.html" target="_blank" rel="noopener">Returns and refunds</a> · <a href="privacy.html" target="_blank" rel="noopener">Privacy</a></p>' +
      '</form>' +
    '</div>';
  document.body.appendChild(drawer);
  var lines = drawer.querySelector('[data-lines]'), form = drawer.querySelector('[data-checkout]');
  var totals = drawer.querySelector('[data-totals]'), payBtn = drawer.querySelector('[data-pay]'), cmsg = drawer.querySelector('[data-checkout-msg]');
  var lastFocus = null;

  function openDrawer() {
    lastFocus = document.activeElement; drawer.hidden = false; document.body.classList.add('drawer-open');
    mountBotCheck();
    drawer.querySelector('[data-close]').focus();
  }
  function closeDrawer() {
    drawer.hidden = true; document.body.classList.remove('drawer-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  drawer.addEventListener('click', function (e) { if (e.target === drawer || e.target.closest('[data-close]')) closeDrawer(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !drawer.hidden) closeDrawer(); });

  function deliveryOn() { return form.fulfilment.value === 'deliver'; }
  form.addEventListener('change', function (e) {
    if (e.target.name === 'fulfilment') { drawer.querySelector('[data-address]').hidden = !deliveryOn(); render(); }
  });

  lines.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-i]'); if (!b) return;
    var c = cart(), i = Number(b.getAttribute('data-i')), act = b.getAttribute('data-act');
    if (act === 'plus') c[i].q = Math.min(c[i].q + 1, 20);
    if (act === 'minus') c[i].q -= 1;
    if (act === 'remove' || c[i].q < 1) c.splice(i, 1);
    save(c);
  });

  function render() {
    var c = cart(), n = c.reduce(function (t, l) { return t + l.q; }, 0);
    fab.hidden = n === 0;
    fab.innerHTML = 'Cart <b>' + n + '</b>';
    fab.setAttribute('aria-label', 'Open cart, ' + n + (n === 1 ? ' item' : ' items'));
    if (!c.length) {
      lines.innerHTML = '<li class="cart-empty">Your cart is empty.</li>';
      form.hidden = true; return;
    }
    form.hidden = false;
    lines.innerHTML = c.map(function (l, i) {
      var p = products[l.p], col = p.colours[l.c];
      return '<li class="cart-line"><img src="' + esc(col.img) + '" alt="">' +
        '<div><h3>' + esc(p.name) + '</h3><p>' + esc(col.name) + ' · Size ' + esc(l.s) + '</p>' +
        '<div class="qty"><button type="button" data-i="' + i + '" data-act="minus" aria-label="One fewer">−</button><span>' + Number(l.q) + '</span>' +
        '<button type="button" data-i="' + i + '" data-act="plus" aria-label="One more">+</button></div></div>' +
        '<div class="line-end">' + R(p.price * l.q) + '<button type="button" class="line-remove" data-i="' + i + '" data-act="remove">Remove</button></div></li>';
    }).join('');
    var sub = subtotal(c), del = deliveryOn() ? DELIVERY : 0;
    totals.innerHTML = '<span>Items</span><span>' + R(sub) + '</span>' +
      '<span>' + (del ? 'Delivery' : 'Collect At Church') + '</span><span>' + (del ? R(del) : 'Free') + '</span>' +
      '<span class="grand">Total</span><span class="grand">' + R(sub + del) + '</span>';
    payBtn.textContent = 'Pay ' + R(sub + del);
  }

  var ERRORS = {
    missing_details: 'Please fill in your name, cellphone and email.',
    invalid_phone: 'Please check your cellphone number.',
    invalid_email: 'Please check your email address (one address, no commas).',
    invalid_province: 'Please choose your province.',
    unknown_product: 'An item in your cart is no longer available. Please remove it and try again.',
    unknown_colour: 'An item in your cart is no longer available. Please remove it and try again.',
    unknown_size: 'An item in your cart is no longer available. Please remove it and try again.',
    invalid_quantity: 'Please check the quantities in your cart (up to 20 each).',
    missing_address: 'Please fill in your street address and city or town.',
    invalid_postal_code: 'Please enter a 4-digit postal code.',
    too_many_requests: 'Too many tries. Please wait a minute and try again.',
    shop_closed: 'The shop is closed at the moment.',
    payment_unavailable: 'Card payments are not available right now. Please try again later.',
    verification_failed: 'Please complete the security check above Pay, then try again.',
    verification_unavailable: 'Our security check is not available right now. Please try again in a minute.',
  };

  form.addEventListener('submit', function (e) {
    e.preventDefault(); cmsg.textContent = '';
    var c = cart(); if (!c.length) return;
    var f = form, body = {
      items: c.map(function (l) { return { productId: l.p, colourId: l.c, size: l.s, qty: l.q }; }),
      fulfilment: f.fulfilment.value,
      name: f.name.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim(), notes: f.notes.value.trim(),
      turnstileToken: botToken(),
    };
    if (!body.name || !body.phone || !body.email) { cmsg.textContent = ERRORS.missing_details; return; }
    if (deliveryOn()) {
      body.address = { street: f.street.value.trim(), suburb: f.suburb.value.trim(), city: f.city.value.trim(), province: f.province.value, postalCode: f.postalCode.value.trim() };
      if (!body.address.street || !body.address.city) { cmsg.textContent = ERRORS.missing_address; return; }
      if (!/^\d{4}$/.test(body.address.postalCode)) { cmsg.textContent = ERRORS.invalid_postal_code; return; }
    }
    if (!API) { cmsg.textContent = 'Online payment is being set up and will open soon.'; return; }
    payBtn.disabled = true; payBtn.textContent = 'Opening secure checkout…';
    count('shop-checkout');
    fetch(API + '/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok && res.d.redirectUrl) {
          window.location.href = res.d.redirectUrl; return;
        }
        cmsg.textContent = ERRORS[res.d && res.d.error] || 'Something went wrong. Please try again.';
        botReset(); payBtn.disabled = false; render();
      })
      .catch(function () { cmsg.textContent = 'Could not reach the checkout. Please check your connection and try again.'; payBtn.disabled = false; render(); });
  });

  // ---- Coming back from Yoco: ?order=<id>[&cancelled=1|&failed=1] ----
  function banner(title, text) {
    var b = document.querySelector('.order-banner') || document.body.appendChild(document.createElement('div'));
    b.className = 'order-banner'; b.setAttribute('role', 'status');
    b.innerHTML = '<h2>' + esc(title) + '</h2><p>' + text + '</p><button type="button">Close</button>';
    b.querySelector('button').onclick = function () { b.remove(); };
  }
  var qs = new URLSearchParams(window.location.search), orderId = qs.get('order');
  if (orderId && API) {
    if (window.history.replaceState) window.history.replaceState(null, '', window.location.pathname + '#shop');
    if (qs.get('cancelled') || qs.get('failed')) {
      banner(qs.get('failed') ? 'Payment didn\'t go through' : 'Payment cancelled', 'Nothing was charged. Your cart is still saved; you can try again whenever you\'re ready.');
    } else {
      banner('Confirming your payment…', 'This takes a few seconds.');
      var tries = 0;
      (function poll() {
        fetch(API + '/api/orders/' + encodeURIComponent(orderId)).then(function (r) { return r.json(); }).then(function (o) {
          if (o.status === 'paid') {
            save([]);
            banner('Thank you! Order ' + esc(o.orderNo) + ' is paid.', 'Please keep your order number. Everything is made to order, so allow 2 weeks; we\'ll let you know when it\'s ' + (o.fulfilment === 'deliver' ? 'on its way.' : 'ready to Collect At Church.'));
            count('shop-paid');
          } else if (o.status === 'pending' && ++tries < 20) {
            setTimeout(poll, 3000);
          } else if (o.status === 'pending') {
            banner('Still confirming…', 'Your payment is taking longer than usual to confirm. If it went through, you\'ll get an email shortly. Questions? WhatsApp the church office.');
          } else {
            banner('Payment not completed', 'This order wasn\'t paid. Your cart is still saved.');
          }
        }).catch(function () { if (++tries < 20) setTimeout(poll, 3000); });
      })();
    }
  }

  render();
})();
