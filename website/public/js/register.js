(function () {

  var API = window.AURAFX_API_BASE || '';

  var config = null;

  var selectedPlan = 'free';

  var regId = null;
  var lastRegResponse = null;



  var RESTRICTED_COUNTRIES = { US: 'United States', KP: 'Korea (North)', IR: 'Iran' };



  var PLANS = {

    free: { id: 'free', name: 'Website dashboard', price: 0, desc: 'Live terminal · free' },

    mt5_bundle: { id: 'mt5_bundle', name: 'MT5 full bundle', price: 99, desc: 'Signals + Pro + EA' },

    mt5_rent: { id: 'mt5_rent', name: 'MT5 monthly rent', price: 15, desc: 'Per month · lower upfront' },

    mt4_waitlist: { id: 'mt4_waitlist', name: 'MT4 early access', price: 49, desc: 'One-time · coming soon' }

  };



  function $(id) { return document.getElementById(id); }



  function setMsg(text, ok) {

    var msg = $('regMsg');

    if (!msg) return;

    msg.textContent = text;

    msg.className = 'reg-msg ' + (ok ? 'ok' : 'err');

  }



  function showStep(n) {

    document.querySelectorAll('.reg-panel').forEach(function (p) {

      p.hidden = Number(p.getAttribute('data-panel')) !== n;

    });

    document.querySelectorAll('.reg-step').forEach(function (s) {

      var sn = Number(s.getAttribute('data-step'));

      s.classList.remove('active', 'done');

      if (sn === n) s.classList.add('active');

      if (sn < n) s.classList.add('done');

    });

  }



  function countryLabel() {

    var sel = $('country');

    if (!sel || !sel.value) return '';

    var opt = sel.options[sel.selectedIndex];

    return opt ? opt.textContent : sel.value;

  }



  function getLegalAccepted() {

    return {

      age18: $('agreeAge').checked,

      terms: $('agreeTerms').checked,

      privacy: $('agreePrivacy').checked,

      risk: $('agreeRisk').checked,

      responsible: $('agreeResponsible').checked,

      jurisdiction: $('agreeJurisdiction').checked,

      regulatory: $('agreeRegulatory').checked,

      refunds: $('agreeRefunds').checked,

      marketing: $('agreeMarketing').checked,

      version: '1.0',

      acceptedAt: new Date().toISOString()

    };

  }



  function heardFromLabel() {

    var sel = $('heardFrom');

    if (!sel || !sel.value) return '';

    var text = sel.options[sel.selectedIndex].textContent;

    if (sel.value === 'other') {

      var o = $('heardFromOther').value.trim();

      return o ? 'Other: ' + o : 'Other';

    }

    return text;

  }



  function getPayload() {

    var code = $('country').value;

    return {

      fullName: $('fullName').value.trim(),

      email: $('email').value.trim().toLowerCase(),

      phone: $('phone').value.trim(),

      country: countryLabel(),

      countryCode: code,

      city: $('city').value.trim(),

      postcode: $('postcode').value.trim(),

      addressLine: $('addressLine').value.trim(),

      experience: $('experience').value,

      interest: $('interest').value,

      heardFrom: $('heardFrom').value,

      heardFromLabel: heardFromLabel(),

      heardFromOther: $('heardFromOther').value.trim(),

      broker: $('broker').value.trim(),

      message: $('message').value.trim(),

      plan: selectedPlan,

      planPrice: PLANS[selectedPlan].price,

      legalAccepted: getLegalAccepted()

    };

  }



  function populateCountries() {

    var sel = $('country');

    if (!sel || !window.AURAFX_COUNTRIES) return;

    var list = window.AURAFX_COUNTRIES.slice().sort(function (a, b) {

      return a.name.localeCompare(b.name);

    });

    list.forEach(function (c) {

      var o = document.createElement('option');

      o.value = c.code;

      o.textContent = c.name;

      sel.appendChild(o);

    });

  }



  function validateStep1() {

    var p = getPayload();

    if (!p.fullName || !p.email || !p.phone || !p.countryCode || !p.city || !p.heardFrom) {

      alert('Please complete all required fields (name, email, phone, country, city, how you found us).');

      return false;

    }

    if (p.heardFrom === 'other' && !p.heardFromOther) {

      alert('Please tell us how you found us (Other field).');

      return false;

    }

    var legal = p.legalAccepted;

    if (!legal.age18 || !legal.terms || !legal.privacy || !legal.risk ||

        !legal.responsible || !legal.jurisdiction || !legal.regulatory || !legal.refunds) {

      alert('Please tick all required legal agreements before continuing.');

      return false;

    }

    if (RESTRICTED_COUNTRIES[p.countryCode]) {

      var ok = confirm(

        'You selected ' + RESTRICTED_COUNTRIES[p.countryCode] + '. Trading software may be restricted in your region. ' +

        'By continuing you confirm you are legally allowed to use these services. Continue?'

      );

      if (!ok) return false;

    }

    return true;

  }



  function renderPlans() {

    var grid = $('planGrid');

    if (!grid) return;

    var q = new URLSearchParams(location.search).get('plan');

    if (q && PLANS[q]) selectedPlan = q;



    grid.innerHTML = Object.keys(PLANS).map(function (key) {

      var pl = PLANS[key];

      var sel = key === selectedPlan ? ' selected' : '';

      var priceLabel = pl.price === 0 ? 'FREE' : '$' + pl.price + (key === 'mt5_rent' ? '/mo' : '');

      return '<div class="plan-card' + sel + '" data-plan="' + key + '">' +

        '<h4>' + pl.name + '</h4>' +

        '<div class="plan-price">' + priceLabel + '</div>' +

        '<p>' + pl.desc + '</p></div>';

    }).join('');



    grid.querySelectorAll('.plan-card').forEach(function (card) {

      card.addEventListener('click', function () {

        selectedPlan = card.getAttribute('data-plan');

        grid.querySelectorAll('.plan-card').forEach(function (c) {

          c.classList.toggle('selected', c.getAttribute('data-plan') === selectedPlan);

        });

      });

    });

  }



  async function loadConfig() {

    try {

      var r = await fetch(API + '/api/config');

      config = await r.json();

      if (config.plans) Object.keys(config.plans).forEach(function (k) { PLANS[k] = config.plans[k]; });

    } catch (e) {

      config = { paypalConfigured: false };

    }

  }



  async function saveRegistration(paymentStatus) {

    var payload = getPayload();

    payload.paymentStatus = paymentStatus || 'pending';

    var r = await fetch(API + '/api/register', {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify(payload)

    });

    var d = await r.json();

    if (!r.ok) throw new Error(d.error || 'Registration failed');

    regId = d.id;
    lastRegResponse = d;

    localStorage.setItem('aurafx_client', JSON.stringify({

      id: d.id, email: payload.email, fullName: payload.fullName,

      plan: selectedPlan, paymentStatus: paymentStatus, countryCode: payload.countryCode,
      emailVerified: !!d.emailVerified

    }));

    return d;

  }



  async function confirmPayment(paypalData) {

    var r = await fetch(API + '/api/payment', {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({

        registrationId: regId,

        email: getPayload().email,

        plan: selectedPlan,

        amount: PLANS[selectedPlan].price,

        paypalOrderId: paypalData.orderId || '',

        paypalStatus: paypalData.status || 'COMPLETED',

        payerEmail: paypalData.payerEmail || ''

      })

    });

    var d = await r.json();

    if (!r.ok) throw new Error(d.error || 'Payment save failed');

    return d;

  }



  function escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function showRegistrationSuccess(d) {
    var el = $('regSuccessBanner');
    if (!el || !d) return;
    el.hidden = false;
    var email = escHtml(getPayload().email);
    if (d.emailVerified) {
      el.className = 'reg-success-banner verified';
      el.innerHTML = '<h3>✓ Registration successful!</h3><p>Your email is verified. You can use the dashboard.</p>';
    } else if (d.verificationEmailSent) {
      el.className = 'reg-success-banner';
      el.innerHTML =
        '<h3>✓ Registration successful!</h3>' +
        '<p>We sent a <strong>verification link</strong> to <strong>' + email + '</strong>. Open it to confirm your email (check spam).</p>' +
        '<p style="margin-top:.75rem"><button type="button" class="btn btn-outline" id="btnResendVerify">Resend verification email</button></p>';
      var btn = $('btnResendVerify');
      if (btn) btn.onclick = resendVerification;
    } else {
      el.className = 'reg-success-banner warn';
      el.innerHTML =
        '<h3>✓ Registration successful!</h3>' +
        '<p>Your details are saved. Verification email was not sent — owner must add <code>RESEND_API_KEY</code> on the server (see EMAIL-SETUP.txt).</p>' +
        (d.verificationError ? '<p style="margin-top:.5rem;color:var(--bear);font-size:.8rem">' + escHtml(d.verificationError) + '</p>' : '');
    }
  }

  async function resendVerification() {
    setMsg('Sending verification email…', true);
    try {
      var r = await fetch(API + '/api/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: getPayload().email })
      });
      var d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setMsg(d.alreadyVerified ? 'Email already verified.' : '✓ Verification email sent again.', true);
    } catch (e) {
      setMsg(e.message, false);
    }
  }

  function finishSuccess(msg) {
    showRegistrationSuccess(lastRegResponse || { verificationEmailSent: true });
    setMsg(msg || '✓ Registration successful!', true);
    var dest = 'dashboard.html';
    if (selectedPlan === 'mt5_bundle' || selectedPlan === 'mt5_rent') {
      dest = 'mt5-install.html';
    }
    setTimeout(function () { location.href = dest; }, 6000);
  }



  function buildPaypalLink() {

    var email = (config && config.paypalBusinessEmail) || 'YOUR_PAYPAL_EMAIL';

    var amount = PLANS[selectedPlan].price;

    return 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=' +

      encodeURIComponent(email) + '&amount=' + amount + '&currency_code=USD&item_name=' +

      encodeURIComponent('AuraFX ' + PLANS[selectedPlan].name);

  }



  function initPaypalStep() {

    var pl = PLANS[selectedPlan];

    $('paySummary').innerHTML = '<strong>' + pl.name + '</strong> — ' +

      (pl.price === 0 ? '<span style="color:var(--bull)">FREE</span>' : '<strong style="color:var(--gold)">$' + pl.price + ' USD</strong>') +

      '<br><span style="color:var(--muted);font-size:.8rem">' + getPayload().email + ' · ' + getPayload().country + '</span>';



    $('btnFreeFinish').hidden = pl.price > 0;

    $('paypal-button-container').innerHTML = '';

    $('paypalFallback').hidden = true;

    $('paypalSetupNote').hidden = true;



    if (pl.price === 0) {

      setMsg('Free plan — click "Finish free" to open dashboard.', true);

      return;

    }



    if (!config || !config.paypalConfigured || !config.paypalClientId) {

      $('paypalSetupNote').hidden = false;

      $('paypalSetupNote').innerHTML =
        '<strong>PayPal is not set up yet.</strong> The site owner must add <code>PAYPAL_CLIENT_ID</code> and ' +
        '<code>PAYPAL_CLIENT_SECRET</code> to the server (see PAYPAL-SETUP.txt). ' +
        'Until then, paid plans cannot be completed online.';

      var canManual = config && config.allowManualPaymentConfirm;
      var hasBizEmail = config && config.paypalBusinessEmail &&
        config.paypalBusinessEmail.indexOf('your-paypal') < 0 &&
        config.paypalBusinessEmail.indexOf('YOUR_PAYPAL') < 0;

      if (hasBizEmail) {
        $('paypalFallback').hidden = false;
        $('paypalLink').href = buildPaypalLink();
      }

      if (canManual) {
        $('paypalFallback').hidden = false;
      } else {
        var btnManual = $('btnConfirmManual');
        if (btnManual) btnManual.hidden = true;
      }

      return;

    }



    loadPaypalSdk(config.paypalClientId, config.paypalMode).then(function () {

      if (!window.paypal) {

        $('paypalFallback').hidden = false;

        $('paypalLink').href = buildPaypalLink();

        return;

      }

      window.paypal.Buttons({

        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' },

        createOrder: function (data, actions) {

          return actions.order.create({

            purchase_units: [{

              description: 'AuraFX ' + pl.name,

              amount: { currency_code: 'USD', value: String(pl.price.toFixed(2)) }

            }]

          });

        },

        onApprove: function (data, actions) {

          setMsg('Processing PayPal payment…', true);

          return actions.order.capture().then(function (details) {

            return confirmPayment({

              orderId: data.orderID,

              status: details.status,

              payerEmail: details.payer && details.payer.email_address

            }).then(function () {

              finishSuccess('✓ PayPal payment received! Welcome to AuraFX.');

            });

          });

        },

        onError: function (err) {

          var detail = (err && err.message) ? err.message : 'Payment could not start';

          setMsg('PayPal error: ' + detail + ' — check PAYPAL-SETUP.txt (sandbox vs live keys).', false);

          console.error(err);

        }

      }).render('#paypal-button-container');

    });

  }



  function loadPaypalSdk(clientId, mode) {

    return new Promise(function (resolve) {

      if (window.paypal) return resolve();

      var s = document.createElement('script');

      s.src = 'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(clientId) +

        '&currency=USD&intent=capture' + (mode === 'live' ? '' : '&buyer-country=US');

      s.onload = resolve;

      s.onerror = resolve;

      document.head.appendChild(s);

    });

  }



  $('btnStep1Next').addEventListener('click', function () {

    if (!validateStep1()) return;

    renderPlans();

    showStep(2);

  });



  $('btnStep2Back').addEventListener('click', function () { showStep(1); });



  $('btnStep2Next').addEventListener('click', async function () {

    if (!validateStep1()) return;

    showStep(3);

    setMsg('Saving your details…', true);

    try {

      var reg = await saveRegistration(PLANS[selectedPlan].price === 0 ? 'free' : 'pending');

      showRegistrationSuccess(reg);

      setMsg('✓ Registration successful!', true);

      initPaypalStep();

    } catch (e) {

      setMsg(e.message + ' — run START-LIVE-WEBSITE.bat', false);

      showStep(2);

    }

  });



  $('btnStep3Back').addEventListener('click', function () { showStep(2); });



  $('btnFreeFinish').addEventListener('click', async function () {

    try {

      await saveRegistration('free');

      finishSuccess('✓ Registration complete! Opening dashboard…');

    } catch (e) {

      setMsg(e.message, false);

    }

  });



  $('btnConfirmManual').addEventListener('click', async function () {

    setMsg('Confirming payment…', true);

    try {

      await confirmPayment({ orderId: 'manual_' + Date.now(), status: 'MANUAL_CONFIRMED', payerEmail: '' });

      finishSuccess('✓ Payment marked complete. Opening dashboard…');

    } catch (e) {

      setMsg(e.message, false);

    }

  });



  function bindHeardFrom() {

    var sel = $('heardFrom');

    var wrap = $('heardFromOtherWrap');

    if (!sel || !wrap) return;

    function toggle() {

      var isOther = sel.value === 'other';

      wrap.hidden = !isOther;

      $('heardFromOther').required = isOther;

    }

    sel.addEventListener('change', toggle);

    toggle();

  }



  populateCountries();

  bindHeardFrom();

  loadConfig().then(function () {

    renderPlans();

    var q = new URLSearchParams(location.search).get('plan');

    if (q && PLANS[q]) selectedPlan = q;

    try {

      var saved = JSON.parse(localStorage.getItem('aurafx_client') || 'null');

      if (saved) {

        if (saved.fullName) $('fullName').value = saved.fullName;

        if (saved.email) $('email').value = saved.email;

        if (saved.countryCode) $('country').value = saved.countryCode;

      }

    } catch (e) { /* ignore */ }

  });

})();


