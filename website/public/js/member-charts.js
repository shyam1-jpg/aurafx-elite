(function () {
  var charts = [];
  var desk = { layout: 1, sync: false, theme: 'dark', panes: [] };
  var cache = {};
  var tools = {};
  var pending = {};
  var records = [];
  var rootEl = null;
  var options = {};
  var saveTimer = null;
  var syncing = false;
  var listening = false;

  function destroy() {
    charts.forEach(function (chart) {
      try { chart.remove(); } catch (error) { /* chart already gone */ }
    });
    charts = [];
    records = [];
  }

  function palette() {
    if (desk.theme === 'light') {
      return {
        bg: '#f7f4ea',
        text: '#1c1a14',
        grid: 'rgba(160, 120, 20, 0.16)',
        up: '#1f8f4e',
        down: '#c0392b',
        gold: '#9a7b1a',
        muted: '#6b6254',
        ema: ['#9a7b1a', '#5c5344', '#1c1a14']
      };
    }
    return {
      bg: '#12182a',
      text: '#e8eaf2',
      grid: 'rgba(212, 175, 55, 0.1)',
      up: '#2ecc71',
      down: '#e74c3c',
      gold: '#d4af37',
      muted: '#8b90a5',
      ema: ['#d4af37', '#e8eaf2', '#8b90a5']
    };
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function freshPane(index) {
    var presets = [
      { instrument: 'XAUUSD', timeframe: 'H1' },
      { instrument: 'EURUSD', timeframe: 'H4' },
      { instrument: 'GBPUSD', timeframe: 'D1' },
      { instrument: 'USDJPY', timeframe: 'H1' }
    ];
    var preset = presets[index] || presets[0];
    var known = {};
    (options.instruments || []).forEach(function (item) { known[item.id] = true; });
    return {
      id: 'p' + (index + 1),
      instrument: known[preset.instrument] || !(options.instruments || []).length ? preset.instrument : options.instruments[0].id,
      timeframe: preset.timeframe,
      style: 'candles',
      indicators: {},
      drawings: []
    };
  }

  function ensurePanes() {
    var count = desk.layout === 2 || desk.layout === 4 ? desk.layout : 1;
    desk.layout = count;
    var next = [];
    for (var i = 0; i < count; i++) next.push(desk.panes[i] || freshPane(i));
    desk.panes = next;
  }

  function colorsFor(style) {
    var colors = palette();
    return {
      layout: { background: { color: colors.bg }, textColor: colors.text },
      grid: { vertLines: { color: colors.grid }, horzLines: { color: colors.grid } },
      rightPriceScale: { borderColor: colors.grid },
      timeScale: { borderColor: colors.grid, timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 }
    };
  }

  function dropPane(index) {
    charts = charts.filter(function (chart) {
      if (chart.__pane !== index) return true;
      try { chart.remove(); } catch (error) { /* already removed */ }
      return false;
    });
  }

  function makeChart(el, height, index) {
    var chart = window.LightweightCharts.createChart(el, Object.assign({
      width: el.clientWidth || 320,
      height: height,
      autoSize: false
    }, colorsFor()));
    chart.__pane = index;
    chart.__host = el;
    charts.push(chart);
    return chart;
  }

  function heikin(bars) {
    var out = [];
    var prevOpen = 0;
    var prevClose = 0;
    bars.forEach(function (bar, index) {
      var close = (bar.open + bar.high + bar.low + bar.close) / 4;
      var open = index === 0 ? (bar.open + bar.close) / 2 : (prevOpen + prevClose) / 2;
      out.push({
        time: bar.time,
        open: open,
        high: Math.max(bar.high, open, close),
        low: Math.min(bar.low, open, close),
        close: close
      });
      prevOpen = open;
      prevClose = close;
    });
    return out;
  }

  function addMain(chart, style, bars) {
    var colors = palette();
    if (style === 'line' || style === 'area') {
      var line = bars.map(function (bar) { return { time: bar.time, value: bar.close }; });
      var series = style === 'area'
        ? chart.addAreaSeries({
          lineColor: colors.gold,
          topColor: 'rgba(212, 175, 55, 0.28)',
          bottomColor: 'rgba(212, 175, 55, 0.02)',
          priceLineVisible: false
        })
        : chart.addLineSeries({ color: colors.gold, lineWidth: 2, priceLineVisible: false });
      series.setData(line);
      return series;
    }
    if (style === 'bars') {
      var barsSeries = chart.addBarSeries({ upColor: colors.up, downColor: colors.down });
      barsSeries.setData(bars);
      return barsSeries;
    }
    var candles = chart.addCandlestickSeries({
      upColor: style === 'hollow' ? 'rgba(0,0,0,0)' : colors.up,
      downColor: colors.down,
      borderVisible: true,
      borderUpColor: colors.up,
      borderDownColor: colors.down,
      wickUpColor: colors.up,
      wickDownColor: colors.down
    });
    candles.setData(style === 'heikin' ? heikin(bars) : bars);
    return candles;
  }

  function addLine(chart, points, color, dashed) {
    if (!points || !points.length) return;
    var series = chart.addLineSeries({
      color: color,
      lineWidth: 1,
      lineStyle: dashed ? 2 : 0,
      priceLineVisible: false,
      lastValueVisible: false
    });
    series.setData(points);
  }

  function priceAt(bars, time) {
    var best = null;
    var gap = Infinity;
    (bars || []).forEach(function (bar) {
      var next = Math.abs(bar.time - time);
      if (next < gap) {
        gap = next;
        best = bar.close;
      }
    });
    return best;
  }

  function snap(bars, time) {
    var best = time;
    var gap = Infinity;
    (bars || []).forEach(function (bar) {
      var next = Math.abs(bar.time - time);
      if (next < gap) {
        gap = next;
        best = bar.time;
      }
    });
    return best;
  }

  function drawLayer(record) {
    var canvas = record.overlay;
    var chart = record.chart;
    var series = record.series;
    if (!canvas || !chart || !series) return;
    var width = record.box.clientWidth;
    var height = record.box.clientHeight;
    if (!width || !height) return;
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    var color = desk.theme === 'light' ? '#9a7b1a' : '#d4af37';
    (record.drawings || []).forEach(function (drawing) {
      if (drawing.type === 'hline') {
        var yLine = series.priceToCoordinate(drawing.a.price);
        if (yLine == null) return;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, yLine);
        ctx.lineTo(width, yLine);
        ctx.stroke();
        return;
      }
      if (!drawing.b) return;
      var x1 = chart.timeScale().timeToCoordinate(drawing.a.time);
      var y1 = series.priceToCoordinate(drawing.a.price);
      var x2 = chart.timeScale().timeToCoordinate(drawing.b.time);
      var y2 = series.priceToCoordinate(drawing.b.price);
      if (x1 == null || y1 == null || x2 == null || y2 == null) return;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1.5;
      if (drawing.type === 'trendline') {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      } else if (drawing.type === 'rect') {
        ctx.fillStyle = desk.theme === 'light' ? 'rgba(154, 123, 26, 0.12)' : 'rgba(212, 175, 55, 0.12)';
        ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
        ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      } else if (drawing.type === 'fib') {
        [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].forEach(function (ratio) {
          var price = drawing.a.price + (drawing.b.price - drawing.a.price) * ratio;
          var y = series.priceToCoordinate(price);
          if (y == null) return;
          ctx.beginPath();
          ctx.moveTo(Math.min(x1, x2), y);
          ctx.lineTo(Math.max(x1, x2), y);
          ctx.stroke();
          ctx.font = '11px sans-serif';
          ctx.fillText(String(ratio), Math.min(x1, x2) + 4, y - 3);
        });
      }
    });
  }

  function linkScales(group) {
    group.forEach(function (chart) {
      chart.timeScale().subscribeVisibleLogicalRangeChange(function (range) {
        if (!range || syncing) return;
        syncing = true;
        group.forEach(function (other) {
          if (other !== chart) other.timeScale().setVisibleLogicalRange(range);
        });
        syncing = false;
      });
    });
  }

  function paintPane(index, payload) {
    var pane = desk.panes[index];
    var section = rootEl.querySelector('[data-pane="' + index + '"]');
    if (!section || !pane) return;
    var note = section.querySelector('.pane-note');
    var box = section.querySelector('.price-chart');
    var overlay = section.querySelector('.draw-layer');
    var slot = section.querySelector('.sub-slot');
    dropPane(index);
    box.innerHTML = '';
    slot.innerHTML = '';
    records[index] = null;
    if (!window.LightweightCharts) {
      note.textContent = 'The chart library did not load. No sample candles are drawn.';
      return;
    }
    if (!payload || payload.available === false || !(payload.bars || []).length) {
      note.textContent = (payload && payload.note) || 'No candles to draw.';
      return;
    }
    var colors = palette();
    var height = window.innerWidth < 860 ? 220 : (desk.layout === 4 ? 210 : desk.layout === 2 ? 280 : 340);
    var chart = makeChart(box, height, index);
    var series = addMain(chart, pane.style || 'candles', payload.bars);
    (payload.overlays || []).forEach(function (line) {
      if (line && line.price != null) {
        series.createPriceLine({ price: line.price, color: line.color, lineWidth: 1, lineStyle: 2, title: line.title });
      }
    });
    var ind = payload.indicators || {};
    var flags = pane.indicators || {};
    if (flags.ema20) addLine(chart, ind.ema20, colors.ema[0], false);
    if (flags.ema50) addLine(chart, ind.ema50, colors.ema[1], false);
    if (flags.ema200) addLine(chart, ind.ema200, colors.ema[2], false);
    if (flags.bollinger && ind.bollinger) {
      addLine(chart, ind.bollinger.upper, colors.gold, true);
      addLine(chart, ind.bollinger.middle, colors.muted, true);
      addLine(chart, ind.bollinger.lower, colors.gold, true);
    }
    if (flags.vwap) {
      if (payload.volume_available && ind.vwap && ind.vwap.length) addLine(chart, ind.vwap, colors.gold, false);
    }
    var group = [chart];
    function addSub(title, build) {
      var wrap = document.createElement('div');
      wrap.className = 'sub-chart';
      var label = document.createElement('p');
      label.className = 'sub-label';
      label.textContent = title;
      var host = document.createElement('div');
      wrap.appendChild(label);
      wrap.appendChild(host);
      slot.appendChild(wrap);
      var sub = makeChart(host, 78, index);
      build(sub);
      group.push(sub);
    }
    if (flags.volume) {
      if (payload.volume_available && ind.volume && ind.volume.length) {
        addSub('Volume', function (sub) {
          var hist = sub.addHistogramSeries({ color: colors.gold, priceFormat: { type: 'volume' }, priceLineVisible: false });
          hist.setData(ind.volume);
        });
      }
    }
    if (flags.rsi && ind.rsi && ind.rsi.length) {
      addSub('RSI 14', function (sub) {
        var line = sub.addLineSeries({ color: colors.gold, lineWidth: 1, priceLineVisible: false });
        line.setData(ind.rsi);
        line.createPriceLine({ price: 70, color: colors.muted, lineStyle: 2, title: '70' });
        line.createPriceLine({ price: 30, color: colors.muted, lineStyle: 2, title: '30' });
      });
    }
    if (flags.macd && ind.macd && ind.macd.line && ind.macd.line.length) {
      addSub('MACD 12 26 9', function (sub) {
        var hist = sub.addHistogramSeries({ priceLineVisible: false });
        hist.setData((ind.macd.hist || []).map(function (point) {
          return { time: point.time, value: point.value, color: point.value >= 0 ? 'rgba(46,204,113,0.75)' : 'rgba(231,76,60,0.75)' };
        }));
        addLine(sub, ind.macd.line, colors.gold, false);
        addLine(sub, ind.macd.signal, colors.muted, false);
      });
    }
    if (flags.atr && ind.atr && ind.atr.length) {
      addSub('ATR 14', function (sub) {
        addLine(sub, ind.atr, colors.gold, false);
      });
    }
    linkScales(group);
    chart.timeScale().fitContent();
    var record = {
      index: index,
      chart: chart,
      series: series,
      bars: payload.bars,
      box: box,
      overlay: overlay,
      drawings: pane.drawings || []
    };
    records[index] = record;
    overlay.classList.toggle('armed', !!tools[index] && tools[index] !== 'select');
    chart.timeScale().subscribeVisibleLogicalRangeChange(function () { drawLayer(record); });
    chart.subscribeCrosshairMove(function (param) {
      drawLayer(record);
      if (!desk.sync || syncing) return;
      syncing = true;
      records.forEach(function (other) {
        if (!other || other === record) return;
        if (!param || param.time == null) {
          other.chart.clearCrosshairPosition();
        } else {
          var price = priceAt(other.bars, param.time);
          if (price != null) {
            try { other.chart.setCrosshairPosition(price, param.time, other.series); } catch (error) { /* time not on that series */ }
          }
        }
      });
      syncing = false;
    });
    var extra = '';
    if (pane.timeframe && pane.timeframe !== 'H1' && pane.timeframe !== 'M15') extra = ' Signal prices stay on the hourly engine.';
    if (pane.style === 'heikin') extra += ' Heikin Ashi redraws the bodies. Support, resistance and signal prices stay on the real price scale.';
    if ((flags.vwap || flags.volume) && !payload.volume_available) extra += ' Volume and VWAP stay off because this feed has no usable volume.';
    var base = payload.note || '';
    if (pane.timeframe !== 'M15') base = base.split('. ').slice(0, 2).join('. ');
    if (base && base.slice(-1) !== '.') base += '.';
    note.textContent = (base + extra).trim();
    drawList(section, pane);
    drawLayer(record);
  }

  function drawList(section, pane) {
    var list = section.querySelector('.draw-list');
    var names = { trendline: 'Trendline', hline: 'Horizontal line', fib: 'Fib retracement', rect: 'Rectangle' };
    list.innerHTML = (pane.drawings || []).map(function (drawing) {
      return '<li><span>' + esc(names[drawing.type] || drawing.type) + '</span> <button type="button" data-remove="' + esc(drawing.id) + '">Remove</button></li>';
    }).join('');
  }

  function scheduleSave() {
    var status = document.getElementById('chartStatus');
    if (status) status.textContent = 'Saving layout…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 500);
  }

  function saveNow() {
    var status = document.getElementById('chartStatus');
    return fetch('/api/members/chart-layout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ desk: desk })
    }).then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
      .then(function (result) {
        if (!status) return;
        status.textContent = result.ok ? 'Layout saved for this member.' : ((result.body && result.body.error) || 'The layout was not saved.');
      }).catch(function () {
        if (status) status.textContent = 'The layout was not saved.';
      });
  }

  function loadPane(index) {
    var pane = desk.panes[index];
    var key = pane.instrument + '|' + pane.timeframe;
    if (cache[key]) {
      paintPane(index, cache[key]);
      return Promise.resolve();
    }
    return fetch('/api/members/candles?instrument=' + encodeURIComponent(pane.instrument) + '&timeframe=' + encodeURIComponent(pane.timeframe), {
      credentials: 'same-origin',
      cache: 'no-store'
    }).then(function (res) { return res.json().then(function (body) { return { status: res.status, body: body }; }); })
      .then(function (result) {
        if (result.status === 403) {
          cache[key] = { available: false, bars: [], note: (result.body && result.body.note) || 'Charts are locked on this tier.' };
        } else {
          cache[key] = result.body;
        }
        paintPane(index, cache[key]);
      }).catch(function () {
        paintPane(index, { available: false, bars: [], note: 'The candle request failed. No sample candles are drawn.' });
      });
  }

  function render() {
    if (!rootEl || !rootEl.isConnected) return;
    destroy();
    ensurePanes();
    var grid = rootEl.querySelector('#chartGrid');
    var instruments = options.instruments || [];
    grid.className = 'chart-grid n' + desk.layout;
    grid.innerHTML = desk.panes.map(function (pane, index) {
      var opts = instruments.map(function (item) {
        return '<option value="' + esc(item.id) + '"' + (item.id === pane.instrument ? ' selected' : '') + '>' + esc(item.name || item.id) + '</option>';
      }).join('');
      var frames = ['M15', 'H1', 'H4', 'D1'].map(function (frame) {
        return '<option value="' + frame + '"' + (pane.timeframe === frame ? ' selected' : '') + '>' + frame + '</option>';
      }).join('');
      var styles = [
        ['candles', 'Candles'], ['hollow', 'Hollow'], ['heikin', 'Heikin Ashi'],
        ['bars', 'Bars'], ['line', 'Line'], ['area', 'Area']
      ].map(function (item) {
        return '<option value="' + item[0] + '"' + (pane.style === item[0] ? ' selected' : '') + '>' + item[1] + '</option>';
      }).join('');
      var indicators = [
        ['ema20', 'EMA 20'], ['ema50', 'EMA 50'], ['ema200', 'EMA 200'],
        ['bollinger', 'Bollinger'], ['vwap', 'VWAP'], ['rsi', 'RSI'],
        ['macd', 'MACD'], ['atr', 'ATR'], ['volume', 'Volume']
      ].map(function (item) {
        return '<label><input type="checkbox" data-ind="' + item[0] + '"' + (pane.indicators && pane.indicators[item[0]] ? ' checked' : '') + '> ' + item[1] + '</label>';
      }).join('');
      var tool = tools[index] || 'select';
      var toolsHtml = [
        ['select', 'Select'], ['trendline', 'Trend'], ['hline', 'Horizontal'], ['fib', 'Fib'], ['rect', 'Rectangle']
      ].map(function (item) {
        return '<button type="button" data-tool="' + item[0] + '"' + (tool === item[0] ? ' class="on"' : '') + '>' + item[1] + '</button>';
      }).join('');
      return '<section class="chart-pane" data-pane="' + index + '"><div class="pane-tools">' +
        '<label>Market <select data-field="instrument">' + opts + '</select></label>' +
        '<label>Time <select data-field="timeframe">' + frames + '</select></label>' +
        '<label>Style <select data-field="style">' + styles + '</select></label>' +
        '<div class="ind-row">' + indicators + '</div><div class="tool-row">' + toolsHtml + '</div></div>' +
        '<div class="price-wrap"><div class="price-chart"></div><canvas class="draw-layer" aria-hidden="true"></canvas></div>' +
        '<div class="sub-slot"></div><p class="pane-note mem-note"></p><ul class="draw-list"></ul></section>';
    }).join('');
    var shell = rootEl.querySelector('.chart-desk');
    if (shell) shell.classList.toggle('light', desk.theme === 'light');
    var themeBtn = document.getElementById('chartTheme');
    if (themeBtn) themeBtn.textContent = desk.theme === 'light' ? 'Dark' : 'Light';
    rootEl.querySelectorAll('[data-layout]').forEach(function (button) {
      button.classList.toggle('on', Number(button.getAttribute('data-layout')) === desk.layout);
    });
    var sync = document.getElementById('chartSync');
    if (sync) sync.checked = !!desk.sync;
    desk.panes.forEach(function (_, index) { loadPane(index); });
    bindGrid();
  }

  function bindGrid() {
    var grid = rootEl.querySelector('#chartGrid');
    grid.onchange = function (event) {
      var section = event.target.closest('[data-pane]');
      if (!section) return;
      var index = Number(section.getAttribute('data-pane'));
      var pane = desk.panes[index];
      if (event.target.getAttribute('data-field')) {
        pane[event.target.getAttribute('data-field')] = event.target.value;
        scheduleSave();
        if (event.target.getAttribute('data-field') === 'style') {
          var cached = cache[pane.instrument + '|' + pane.timeframe];
          if (cached) paintPane(index, cached);
          else loadPane(index);
        } else loadPane(index);
      }
      if (event.target.getAttribute('data-ind')) {
        pane.indicators = pane.indicators || {};
        pane.indicators[event.target.getAttribute('data-ind')] = event.target.checked;
        scheduleSave();
        var hit = cache[pane.instrument + '|' + pane.timeframe];
        if (hit) paintPane(index, hit);
      }
    };
    grid.onclick = function (event) {
      var section = event.target.closest('[data-pane]');
      if (!section) return;
      var index = Number(section.getAttribute('data-pane'));
      var pane = desk.panes[index];
      if (event.target.getAttribute('data-tool')) {
        tools[index] = event.target.getAttribute('data-tool');
        section.querySelectorAll('[data-tool]').forEach(function (button) {
          button.classList.toggle('on', button === event.target);
        });
        var layer = section.querySelector('.draw-layer');
        if (layer) layer.classList.toggle('armed', tools[index] !== 'select');
        pending[index] = null;
      }
      if (event.target.getAttribute('data-remove')) {
        var id = event.target.getAttribute('data-remove');
        pane.drawings = (pane.drawings || []).filter(function (drawing) { return drawing.id !== id; });
        scheduleSave();
        var cached = cache[pane.instrument + '|' + pane.timeframe];
        if (cached) paintPane(index, cached);
      }
    };
    grid.querySelectorAll('.draw-layer').forEach(function (overlay) {
      overlay.addEventListener('click', function (event) {
        var section = overlay.closest('[data-pane]');
        var index = Number(section.getAttribute('data-pane'));
        var tool = tools[index] || 'select';
        if (tool === 'select') return;
        var record = records[index];
        if (!record) {
          var missing = document.getElementById('chartStatus');
          if (missing) missing.textContent = 'This pane has no candles to draw on.';
          return;
        }
        var rect = overlay.getBoundingClientRect();
        var time = record.chart.timeScale().coordinateToTime(event.clientX - rect.left);
        var price = record.series.coordinateToPrice(event.clientY - rect.top);
        if (time == null || price == null || !isFinite(price) || price <= 0) {
          var status = document.getElementById('chartStatus');
          if (status) status.textContent = 'Click inside the candle area to place the point.';
          return;
        }
        time = snap(record.bars, typeof time === 'number' ? time : Number(time));
        var point = { time: time, price: Math.round(price * 1e6) / 1e6 };
        var pane = desk.panes[index];
        pane.drawings = pane.drawings || [];
        if (tool === 'hline') {
          pane.drawings.push({ id: 'd' + Date.now().toString(36) + pane.drawings.length, type: 'hline', a: point });
        } else if (!pending[index]) {
          pending[index] = point;
          var status = document.getElementById('chartStatus');
          if (status) status.textContent = 'Click the second point.';
          return;
        } else {
          pane.drawings.push({
            id: 'd' + Date.now().toString(36) + pane.drawings.length,
            type: tool,
            a: pending[index],
            b: point
          });
          pending[index] = null;
        }
        scheduleSave();
        var cached = cache[pane.instrument + '|' + pane.timeframe];
        if (cached) paintPane(index, cached);
      });
    });
  }

  function screenshot() {
    var status = document.getElementById('chartStatus');
    var shots = records.filter(function (record) { return record && record.chart && record.chart.takeScreenshot; });
    if (!shots.length) {
      if (status) status.textContent = 'Nothing to capture yet.';
      return;
    }
    try {
      var images = shots.map(function (record) { return { image: record.chart.takeScreenshot(), overlay: record.overlay }; });
      var cols = desk.layout === 1 ? 1 : 2;
      var rows = Math.ceil(images.length / cols);
      var cellW = Math.max.apply(null, images.map(function (item) { return item.image.width; }));
      var cellH = Math.max.apply(null, images.map(function (item) { return item.image.height; }));
      var board = document.createElement('canvas');
      board.width = cellW * cols;
      board.height = cellH * rows;
      var ctx = board.getContext('2d');
      ctx.fillStyle = desk.theme === 'light' ? '#f7f4ea' : '#0a0c12';
      ctx.fillRect(0, 0, board.width, board.height);
      images.forEach(function (item, index) {
        var x = (index % cols) * cellW;
        var y = Math.floor(index / cols) * cellH;
        ctx.drawImage(item.image, x, y);
        if (item.overlay && item.overlay.width) ctx.drawImage(item.overlay, x, y, cellW, item.image.height);
      });
      var link = document.createElement('a');
      link.href = board.toDataURL('image/png');
      link.download = 'aurafx-charts.png';
      link.click();
      if (status) status.textContent = 'Screenshot downloaded.';
    } catch (error) {
      if (status) status.textContent = 'This browser blocked the chart screenshot.';
    }
  }

  function mount(root, next) {
    destroy();
    rootEl = root;
    options = next || {};
    root.innerHTML = '<div class="chart-desk" id="chartDeskInner"><div class="chart-bar">' +
      '<div class="chart-layouts" role="group" aria-label="Chart layout">' +
      '<button type="button" data-layout="1">1</button><button type="button" data-layout="2">2</button><button type="button" data-layout="4">4</button></div>' +
      '<label class="chart-check"><input type="checkbox" id="chartSync"> Sync crosshair</label>' +
      '<button type="button" id="chartTheme">Light</button>' +
      '<button type="button" id="chartFull">Fullscreen</button>' +
      '<button type="button" id="chartShot">Screenshot</button>' +
      '<button type="button" id="chartSave">Save layout</button>' +
      '<span id="chartStatus" class="mem-note"></span></div><div class="chart-grid" id="chartGrid"></div></div>';
    root.className = 'chart-root';
    root.querySelector('.chart-layouts').addEventListener('click', function (event) {
      var layout = Number(event.target.getAttribute('data-layout'));
      if (layout !== 1 && layout !== 2 && layout !== 4) return;
      desk.layout = layout;
      ensurePanes();
      scheduleSave();
      render();
    });
    document.getElementById('chartSync').addEventListener('change', function (event) {
      desk.sync = !!event.target.checked;
      scheduleSave();
    });
    document.getElementById('chartTheme').addEventListener('click', function () {
      desk.theme = desk.theme === 'light' ? 'dark' : 'light';
      scheduleSave();
      render();
    });
    document.getElementById('chartFull').addEventListener('click', function () {
      var node = root.querySelector('.chart-desk');
      var status = document.getElementById('chartStatus');
      if (node.requestFullscreen) node.requestFullscreen();
      else if (status) status.textContent = 'Fullscreen is not available in this browser.';
    });
    document.getElementById('chartShot').addEventListener('click', screenshot);
    document.getElementById('chartSave').addEventListener('click', saveNow);
    fetch('/api/members/chart-layout', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
      .then(function (result) {
        if (!rootEl || !rootEl.isConnected) return;
        if (result.ok && result.body.desk) desk = result.body.desk;
        render();
      }).catch(function () { render(); });
    if (!listening) {
      window.addEventListener('resize', resize);
      listening = true;
    }
  }

  function resize() {
    if (!rootEl) return;
    charts.forEach(function (chart) {
      var host = chart.__host;
      if (!host) return;
      var width = host.clientWidth || (host.parentElement && host.parentElement.clientWidth);
      if (width) chart.applyOptions({ width: width });
    });
    records.forEach(function (record) { if (record) drawLayer(record); });
  }

  window.AuraMemberCharts = { mount: mount, destroy: destroy };
})();
