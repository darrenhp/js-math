/* ============================================================
 * demos.js — 每个库的多能力交互式 Demo（Tab 化）+ 代码查看
 * 每个 Demo 是一个对象 { tabs: [...] }，每个 tab 演示一项能力，
 * 并带有 code 字符串（在「查看代码」弹窗中展示当前演示的逻辑）。
 * ========================================================== */
(function () {
  "use strict";

  /* ---------- 通用工具 ---------- */
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  window.__demoCleanups = [];
  const onCleanup = (fn) => window.__demoCleanups.push(fn);
  const has = (name) => name.split("|").some((n) =>
    n.split(".").reduce((o, k) => (o == null ? o : o[k]), window) != null);

  function mkCanvas(w, h) {
    const c = document.createElement("canvas");
    const dpr = window.devicePixelRatio || 1;
    c.width = w * dpr; c.height = h * dpr;
    c.style.width = w + "px"; c.style.height = h + "px";
    const ctx = c.getContext("2d"); ctx.scale(dpr, dpr);
    return { c, ctx, w, h };
  }
  function fmt(n, d = 6) {
    if (typeof n !== "number") return String(n);
    if (!isFinite(n)) return String(n);
    if (Number.isInteger(n)) return String(n);
    return parseFloat(n.toFixed(d)).toString();
  }
  function fmtArr(a, d = 3) { return "[" + a.map((v) => fmt(v, d)).join(", ") + "]"; }

  // 折线 / 散点坐标系
  function plot2D(ctx, w, h, dom, drawFn) {
    const pad = { l: 46, r: 16, t: 16, b: 30 };
    const { xmin, xmax, ymin, ymax } = dom;
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const mapX = (x) => pad.l + ((x - xmin) / (xmax - xmin)) * iw;
    const mapY = (y) => pad.t + ih - ((y - ymin) / (ymax - ymin)) * ih;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = css("--code-bg"); ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = css("--border-soft"); ctx.fillStyle = css("--text-faint");
    ctx.font = "10px ui-monospace, monospace"; ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const x = xmin + ((xmax - xmin) * i) / 5, px = mapX(x);
      ctx.beginPath(); ctx.moveTo(px, pad.t); ctx.lineTo(px, pad.t + ih); ctx.stroke();
      ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(fmt(x, 2), px, pad.t + ih + 5);
    }
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (let i = 0; i <= 5; i++) {
      const y = ymin + ((ymax - ymin) * i) / 5, py = mapY(y);
      ctx.beginPath(); ctx.moveTo(pad.l, py); ctx.lineTo(pad.l + iw, py); ctx.stroke();
      ctx.fillText(fmt(y, 2), pad.l - 6, py);
    }
    ctx.strokeStyle = css("--border"); ctx.lineWidth = 1.4;
    if (ymin < 0 && ymax > 0) { ctx.beginPath(); ctx.moveTo(pad.l, mapY(0)); ctx.lineTo(pad.l + iw, mapY(0)); ctx.stroke(); }
    if (xmin < 0 && xmax > 0) { ctx.beginPath(); ctx.moveTo(mapX(0), pad.t); ctx.lineTo(mapX(0), pad.t + ih); ctx.stroke(); }
    drawFn(mapX, mapY, ctx);
  }
  function line(ctx, pts, color, wdt = 2) {
    ctx.strokeStyle = color; ctx.lineWidth = wdt; ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
  }
  function arrow(ctx, x0, y0, x1, y1, color, label) {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    const a = Math.atan2(y1 - y0, x1 - x0), s = 8;
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - s * Math.cos(a - 0.4), y1 - s * Math.sin(a - 0.4));
    ctx.lineTo(x1 - s * Math.cos(a + 0.4), y1 - s * Math.sin(a + 0.4));
    ctx.closePath(); ctx.fill();
    if (label) { ctx.font = "12px monospace"; ctx.fillText(label, x1 + 6, y1); }
  }
  function heat(ctx, mat, ox, oy, size, title) {
    const rows = mat.length, cols = mat[0].length;
    let mn = Infinity, mx = -Infinity;
    mat.forEach((r) => r.forEach((v) => { mn = Math.min(mn, v); mx = Math.max(mx, v); }));
    const cw = size / cols, ch = size / rows;
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const t = mx === mn ? 0.5 : (mat[i][j] - mn) / (mx - mn);
      ctx.fillStyle = "hsl(" + (230 - t * 200) + ", 70%, " + (28 + t * 34) + "%)";
      ctx.fillRect(ox + j * cw, oy + i * ch, cw - 1.5, ch - 1.5);
      ctx.fillStyle = "#fff"; ctx.font = "10px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(fmt(mat[i][j], 2), ox + j * cw + cw / 2, oy + i * ch + ch / 2);
    }
    ctx.fillStyle = css("--text-dim"); ctx.font = "11px monospace"; ctx.textAlign = "center";
    ctx.fillText(title, ox + size / 2, oy - 8);
  }

  // 柱状图：labels 为 x 轴标签，values 为数值（可为 BigInt/Number），opts.title/color/valFmt
  function bars(ctx, w, h, labels, values, opts = {}) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = css("--code-bg"); ctx.fillRect(0, 0, w, h);
    const pad = { l: 12, r: 12, t: 24, b: 24 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const nums = values.map((v) => Number(v));
    const mx = Math.max(...nums, 1), n = nums.length;
    const bw = iw / Math.max(n, 1);
    if (opts.title) {
      ctx.fillStyle = css("--text-dim"); ctx.font = "11px monospace";
      ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(opts.title, pad.l, 5);
    }
    const color = opts.color || css("--accent");
    for (let i = 0; i < n; i++) {
      const bh = mx > 0 ? (nums[i] / mx) * ih : 0;
      const x = pad.l + i * bw, y = pad.t + ih - bh;
      ctx.fillStyle = color; ctx.fillRect(x + 2, y, Math.max(bw - 4, 1), bh);
      ctx.fillStyle = css("--text"); ctx.font = "9px monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      const vl = opts.valFmt ? opts.valFmt(values[i]) : String(values[i]);
      if (bw > 16) ctx.fillText(vl, x + bw / 2, y - 2);
      ctx.fillStyle = css("--text-faint"); ctx.textBaseline = "top";
      ctx.fillText(String(labels[i]), x + bw / 2, pad.t + ih + 4);
    }
  }

  // 标准骨架：左控件+结果，右可视化
  function skeleton(root, controlsHTML, opts = {}) {
    const single = opts.single ? "single" : "";
    root.innerHTML =
      '<div class="demo-grid ' + single + '">' +
        '<div class="controls">' + controlsHTML +
          '<div><div class="result-label">运行结果</div><div class="output" data-out></div></div>' +
        '</div>' +
        (opts.single ? "" : '<div><div class="result-label">' + (opts.vizLabel || "可视化") + '</div><div class="viz" data-viz></div></div>') +
      '</div>';
    return { out: root.querySelector("[data-out]"), viz: root.querySelector("[data-viz]") };
  }

  /* ============================================================
   * Tab 框架
   * ========================================================== */
  window.__activeDemoCode = "";
  window.__activeDemoName = "";
  function tabDemo(body, demo) {
    body.innerHTML =
      '<div class="dtabs" id="dtabs">' +
        demo.tabs.map((t, i) => '<button class="dtab" data-i="' + i + '" type="button">' + t.label + '</button>').join("") +
      '</div><div class="dtab-body" id="dtabBody"></div>';
    const tabBody = body.querySelector("#dtabBody");
    let cleanup = null;
    function select(i) {
      if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
      body.querySelectorAll(".dtab").forEach((b, idx) => b.classList.toggle("active", idx === i));
      const tab = demo.tabs[i];
      window.__activeDemoCode = tab.code || "// 暂无示例代码";
      window.__activeDemoName = tab.label;
      tabBody.innerHTML = "";
      const c = tab.mount(tabBody);
      if (typeof c === "function") cleanup = c;
    }
    body.querySelectorAll(".dtab").forEach((b) => b.addEventListener("click", () => select(+b.dataset.i)));
    select(0);
  }
  window.__renderDemo = tabDemo;

  // esm.sh 懒加载（供无 UMD 全局、只能 ESM 引入的库，如 numjs）
  const _esm = {};
  function loadESM(name, url) {
    if (window[name]) return Promise.resolve(window[name]);
    if (_esm[url]) return _esm[url];
    const p = import(/* @vite-ignore */ url).then((mod) => {
      const exp = (mod && mod.array) ? mod : (mod.default || mod);
      window[name] = exp;
      return exp;
    });
    _esm[url] = p;
    return p;
  }

  /* ============================================================
   * DEMOS 集合
   * ========================================================== */
  const DEMOS = {};

  /* ---------- math.js ---------- */
  DEMOS.mathjs = {
    tabs: [
      {
        label: "表达式求值",
        code:
`// 支持复数、矩阵、分数、单位等混合表达式
const r = math.evaluate('sqrt(3^2 + 4^2) + 2i * (1 + i)');
math.format(r, { precision: 8 });      // 5 + 2i

// 矩阵运算内嵌于表达式
math.evaluate('[1, 2; 3, 4] * [5; 6]'); // [17; 39]

// 有理数结果
math.evaluate('1/3 + 1/6');            // 1/2 (分数形式)`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>表达式 <span class="hint">支持复数 i、矩阵 [a,b;c,d]、分数</span></label>' +
            '<input type="text" data-expr value="sqrt(3^2 + 4^2) + 2i * (1 + i)" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算</button></div>', { single: true });
          function run() {
            try {
              if (!window.math) throw new Error("math.js 未加载");
              const r = math.evaluate(root.querySelector("[data-expr]").value);
              out.innerHTML = '<span class="muted">表达式 = </span><span class="ok">' +
                math.format(r, { precision: 8 }) + '</span>\n<span class="muted">类型：</span><span class="v">' +
                (r && r.constructor ? r.constructor.name : typeof r) + '</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "函数绘图 + 导数",
        code:
`const fx = 'x^2 + sin(3x)';
const d = math.derivative(fx, 'x');     // 2 x + 3 cos(3 x)
const f = math.compile(fx);
const df = math.compile(d.toString());

// 在 [-5,5] 上采样并绘制 f(x) 与 f'(x)
const xs = [], fv = [], dv = [];
for (let x = -5; x <= 5; x += 0.05) {
  xs.push(x); fv.push(f.evaluate({ x })); dv.push(df.evaluate({ x }));
}`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>函数 f(x)</label><input type="text" data-fx value="x^2 + sin(3x)" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算并绘图</button></div>',
            { vizLabel: "f(x) 与 f'(x)" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          function run() {
            let html = "";
            try {
              const fx = root.querySelector("[data-fx]").value;
              const d = math.derivative(fx, "x");
              html += '<span class="muted">f(x)  = </span>' + fx + '\n<span class="muted">f\'(x) = </span><span class="v">' + d.toString() + '</span>';
              const f = math.compile(fx), df = math.compile(d.toString());
              const xs = [], fv = [], dv = [];
              for (let x = -5; x <= 5; x += 0.05) { xs.push(x); fv.push(f.evaluate({ x })); dv.push(df.evaluate({ x })); }
              const all = fv.concat(dv).filter((v) => isFinite(v));
              let ymin = Math.min(...all), ymax = Math.max(...all);
              if (ymin === ymax) { ymin -= 1; ymax += 1; }
              const pad = (ymax - ymin) * 0.1; ymin -= pad; ymax += pad;
              plot2D(ctx, w, h, { xmin: -5, xmax: 5, ymin, ymax }, (mx, my) => {
                line(ctx, xs.map((x, i) => [mx(x), my(fv[i])]), css("--accent"), 2.2);
                line(ctx, xs.map((x, i) => [mx(x), my(dv[i])]), css("--accent-3"), 1.8);
                ctx.fillStyle = css("--accent"); ctx.font = "11px monospace"; ctx.textAlign = "left";
                ctx.fillText("f(x)", 54, 20); ctx.fillStyle = css("--accent-3"); ctx.fillText("f'(x)", 92, 20);
              });
            } catch (e) { html += '\n<span class="err">错误: ' + e.message + '</span>'; }
            out.innerHTML = html;
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "矩阵运算",
        code:
`const A = math.matrix([[4, 3, 2], [1, 5, 1], [2, 1, 6]]);
math.det(A);                       // 行列式
math.inv(A);                       // 逆
A.transpose();                     // 转置
math.multiply(A, A);               // 矩阵相乘 A·A
math.trace(A);                     // 迹`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>矩阵 A（每行一组，逗号分隔）</label>' +
            '<textarea data-A rows="3">4, 3, 2\n1, 5, 1\n2, 1, 6</textarea></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算</button></div>',
            { vizLabel: "矩阵热力图 (A 与 A·A)" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          function run() {
            try {
              const data = root.querySelector("[data-A]").value.trim().split("\n").map((r) => r.split(",").map(Number));
              const A = math.matrix(data);
              const prod = math.multiply(A, A);
              out.innerHTML =
                '<span class="k">det(A) = </span><span class="v">' + fmt(math.det(A), 4) + '</span>\n' +
                '<span class="k">trace  = </span><span class="v">' + fmt(math.trace(A), 4) + '</span>\n' +
                '<span class="k">Aᵀ 首行 = </span><span class="v">[ ' + A.transpose().toArray()[0].map((v) => fmt(v, 2)).join(", ") + ' ]</span>\n\n' +
                '<span class="k">A⁻¹ =</span>\n' + math.inv(A).toArray().map((r) => "  [ " + r.map((v) => fmt(v, 3)).join(", ") + " ]").join("\n") +
                '\n<span class="muted">（右侧为 A 与 A·A 的热力图）</span>';
              ctx.clearRect(0, 0, w, h); ctx.fillStyle = css("--code-bg"); ctx.fillRect(0, 0, w, h);
              heat(A.toArray(), 30, 40, 160, "A");
              heat(prod.toArray(), 240, 40, 160, "A·A");
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "单位换算",
        code:
`// 物理量可直接带单位运算与换算
math.unit('100 km/h').to('m/s').toNumber();   // 27.78
math.unit('1 kg').to('g').toNumber();          // 1000
math.unit('90 deg').to('rad').toNumber();      // 1.5708
// 不同单位可直接相加
math.evaluate('2 hour + 30 minute').to('minute').toNumber(); // 150`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>数值 + 单位</label><input type="text" data-v value="100 km/h" /></div>' +
            '<div class="field"><label>目标单位</label><input type="text" data-to value="m/s" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>换算</button></div>', { single: true });
          function run() {
            try {
              const u = math.unit(root.querySelector("[data-v]").value);
              const to = root.querySelector("[data-to]").value;
              const r = u.to(to);
              out.innerHTML =
                '<span class="muted">' + root.querySelector("[data-v]").value + ' = </span>\n' +
                '<span class="ok">' + r.format() + '</span>  <span class="muted">(' + fmt(r.toNumber(), 5) + ' ' + to + ')</span>\n' +
                '<span class="muted">// 单位维度：' + u.format().split(" ")[0] + ' → ' + to + '</span>';
            } catch (e) { out.innerHTML = '<span class="err">无法换算: ' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "生成函数 / EGF",
        code:
`// 由生成函数闭式 G(x) 求数列 a_n
// 普通生成函数(OGF)：a_n = [x^n] G(x) = G⁽ⁿ⁾(0) / n!
// 指数生成函数(EGF)：a_n = n! · [x^n] G(x)
const G = '1/(1-x-x^2)';          // 斐波那契的 OGF
let cur = math.parse(G), fact = 1, a = [];
for (let n = 0; n <= 8; n++) {
  const c = cur.compile().evaluate({ x: 0 }) / fact; // 泰勒系数
  a.push(Math.round(c));
  cur = math.derivative(cur, 'x');   // 符号求导，逐阶推进
  fact *= (n + 1);
}
// a = [1,1,2,3,5,8,13,21,34]  → 斐波那契数`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>生成函数闭式 G(x) <span class="hint">如 1/(1-x)、1/(1-x-x^2)、e^x、1/(1-2x)</span></label>' +
            '<input type="text" data-g value="1/(1-x-x^2)" /></div>' +
            '<div class="field"><label>模式</label><select data-mode>' +
            '<option value="ogf">普通生成函数 OGF：a_n=[x^n]G</option>' +
            '<option value="egf">指数生成函数 EGF：a_n=n!·[x^n]G</option></select></div>' +
            '<div class="field"><label>项数 N</label><div class="range-row"><input type="range" data-n min="4" max="9" value="8" /><span class="range-val" data-nv>8</span></div></div>' +
            '<div class="btn-row"><button class="btn" data-run>展开系数</button></div>',
            { vizLabel: "系数 a_n 柱状图" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          root.querySelector("[data-n]").oninput = (e) => (root.querySelector("[data-nv]").textContent = e.target.value);
          function run() {
            try {
              if (!window.math) throw new Error("math.js 未加载");
              const G = root.querySelector("[data-g]").value;
              const mode = root.querySelector("[data-mode]").value;
              const N = +root.querySelector("[data-n]").value;
              let cur = math.parse(G), fact = 1; const ogf = [], seq = [];
              for (let n = 0; n <= N; n++) {
                const cn = cur.compile().evaluate({ x: 0 }) / fact;
                ogf.push(cn);
                let nf = 1; for (let j = 2; j <= n; j++) nf *= j;
                seq.push(mode === "egf" ? cn * nf : cn);
                cur = math.derivative(cur, "x"); fact *= (n + 1);
              }
              const rounded = seq.map((v) => Math.abs(v - Math.round(v)) < 1e-6 ? Math.round(v) : parseFloat(v.toFixed(4)));
              out.innerHTML =
                '<span class="k">G(x) = </span><span class="v">' + G + '</span>\n' +
                '<span class="k">G\'(x) = </span><span class="v">' + math.derivative(G, "x").toString() + '</span>\n\n' +
                '<span class="muted">' + (mode === "egf" ? "EGF" : "OGF") + ' 数列 a₀…aₙ：</span>\n' +
                '<span class="ok">' + rounded.join(", ") + '</span>';
              bars(ctx, w, h, rounded.map((_, i) => "a" + i), rounded, { title: (mode === "egf" ? "EGF" : "OGF") + " 系数 a_n", color: css("--accent-3") });
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-mode]").onchange = run;
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ---------- decimal.js ---------- */
  DEMOS.decimal = {
    tabs: [
      {
        label: "高精度四则",
        code:
`Decimal.set({ precision: 20 });
const a = new Decimal('0.1');
const b = new Decimal('0.2');
a.plus(b).toString();          // 0.3  (精确)
a.plus(b).comparedTo(0.3);     // 0  (与 0.3 完全相等)
// 对比原生 Number
0.1 + 0.2;                      // 0.30000000000000004`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>数值 A</label><input type="text" data-a value="0.1" /></div>' +
            '<div class="field"><label>数值 B</label><input type="text" data-b value="0.2" /></div>' +
            '<div class="field"><label>运算</label><select data-op>' +
            '<option value="add">A + B</option><option value="sub">A − B</option><option value="mul">A × B</option>' +
            '<option value="div">A ÷ B</option><option value="pow">A ^ B</option><option value="sqrt">√A</option></select></div>' +
            '<div class="field"><label>有效精度 (significant digits)</label>' +
            '<div class="range-row"><input type="range" data-p min="5" max="50" value="20" /><span class="range-val" data-pv>20</span></div></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算</button></div>', { single: true });
          const pv = root.querySelector("[data-pv]"), pr = root.querySelector("[data-p]");
          pr.oninput = () => (pv.textContent = pr.value);
          function run() {
            try {
              Decimal.set({ precision: +pr.value });
              const a = new Decimal(root.querySelector("[data-a]").value);
              const b = new Decimal(root.querySelector("[data-b]").value);
              const op = root.querySelector("[data-op]").value;
              let d, native; const na = +a, nb = +b;
              switch (op) {
                case "add": d = a.plus(b); native = na + nb; break;
                case "sub": d = a.minus(b); native = na - nb; break;
                case "mul": d = a.times(b); native = na * nb; break;
                case "div": d = a.div(b); native = na / nb; break;
                case "pow": d = a.pow(b); native = Math.pow(na, nb); break;
                case "sqrt": d = a.sqrt(); native = Math.sqrt(na); break;
              }
              out.innerHTML =
                '<span class="k">decimal.js  </span><span class="ok">' + d.toString() + '</span>\n' +
                '<span class="k">原生 Number </span><span class="v">' + native + '</span>\n\n' +
                '<span class="muted">例：0.1 + 0.2 在原生下 = 0.30000000000000004，decimal.js 精确无误</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "超越函数",
        code:
`Decimal.set({ precision: 30 });
new Decimal(2).sin().toFixed(20);     // 0.90929742682568169540
new Decimal(1).cos().toFixed(20);     // 0.54030230586813971740
new Decimal(10).log().toFixed(15);    // 2.302585092994046
new Decimal(1).exp().toFixed(12);     // 2.718281828459`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>输入 x</label><input type="text" data-x value="2" /></div>' +
            '<div class="field"><label>精度</label><div class="range-row"><input type="range" data-p min="10" max="40" value="25" /><span class="range-val" data-pv>25</span></div></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算 sin/cos/exp/ln</button></div>', { single: true });
          const pv = root.querySelector("[data-pv]"), pr = root.querySelector("[data-p]");
          pr.oninput = () => (pv.textContent = pr.value);
          function run() {
            try {
              Decimal.set({ precision: +pr.value });
              const x = new Decimal(root.querySelector("[data-x]").value);
              out.innerHTML =
                '<span class="k">sin(x) = </span><span class="ok">' + x.sin().toFixed(+pr.value) + '</span>\n' +
                '<span class="k">cos(x) = </span><span class="ok">' + x.cos().toFixed(+pr.value) + '</span>\n' +
                '<span class="k">exp(x) = </span><span class="ok">' + x.exp().toFixed(+pr.value) + '</span>\n' +
                '<span class="k">ln(x)  = </span><span class="ok">' + (x.gt(0) ? x.log().toFixed(+pr.value) : "定义域外") + '</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "舍入与格式化",
        code:
`const d = new Decimal('1234.56789');
d.toFixed(2);            // "1234.57"
d.toExponential(3);      // "1.235e+3"
d.toPrecision(5);        // "1234.6"
d.toSignificantDigits(); // 自动有效数字
// 不同舍入模式
Decimal.set({ rounding: Decimal.ROUND_HALF_UP });`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>数值</label><input type="text" data-v value="1234.56789" /></div>' +
            '<div class="field"><label>保留小数位</label><div class="range-row"><input type="range" data-dp min="0" max="8" value="2" /><span class="range-val" data-dpv>2</span></div></div>' +
            '<div class="btn-row"><button class="btn" data-run>格式化</button></div>', { single: true });
          const dpv = root.querySelector("[data-dpv]"), dp = root.querySelector("[data-dp]");
          dp.oninput = () => (dpv.textContent = dp.value);
          function run() {
            try {
              const d = new Decimal(root.querySelector("[data-v]").value);
              out.innerHTML =
                '<span class="k">toFixed(' + dp.value + ')      </span><span class="ok">' + d.toFixed(+dp.value) + '</span>\n' +
                '<span class="k">toExponential   </span><span class="ok">' + d.toExponential(3) + '</span>\n' +
                '<span class="k">toPrecision(6)  </span><span class="ok">' + d.toPrecision(6) + '</span>\n' +
                '<span class="k">abs / neg       </span><span class="ok">' + d.abs() + ' / ' + d.neg() + '</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ---------- big.js ---------- */
  DEMOS.big = {
    tabs: [
      {
        label: "电商精确结算",
        code:
`const price = new Big('19.99');
const qty   = new Big('3');
const disc  = new Big('0.85');
const total = price.times(qty).times(disc);  // 50.97255
total.round(2);                              // 50.97
// 等价原生：19.99 * 3 * 0.85 = 50.972549999999994`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>商品单价</label><input type="text" data-price value="19.99" /></div>' +
            '<div class="field"><label>数量</label><input type="number" data-qty value="3" /></div>' +
            '<div class="field"><label>折扣（0~1）</label><input type="text" data-disc value="0.85" /></div>' +
            '<div class="field"><label>小数保留位</label><div class="range-row"><input type="range" data-dp min="0" max="8" value="2" /><span class="range-val" data-dv>2</span></div></div>' +
            '<div class="btn-row"><button class="btn" data-run>结算</button></div>', { single: true });
          const dv = root.querySelector("[data-dv]"), dp = root.querySelector("[data-dp]");
          dp.oninput = () => (dv.textContent = dp.value);
          function run() {
            try {
              const price = new Big(root.querySelector("[data-price]").value);
              const qty = new Big(root.querySelector("[data-qty]").value);
              const disc = new Big(root.querySelector("[data-disc]").value);
              const total = price.times(qty).times(disc);
              const rounded = total.round(+dp.value);
              const native = (+price * +qty * +disc);
              out.innerHTML =
                '<span class="muted">单价 × 数量 × 折扣</span>\n' +
                '<span class="k">big.js 精确  </span><span class="ok">¥ ' + total.toString() + '</span>\n' +
                '<span class="k">保留 ' + dp.value + ' 位   </span><span class="ok">¥ ' + rounded.toString() + '</span>\n' +
                '<span class="k">原生浮点     </span><span class="v">¥ ' + native + '</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "多运算对比",
        code:
`const a = new Big('7'), b = new Big('3');
a.plus(b);   // 10
a.minus(b);  // 4
a.times(b);  // 21
a.div(b);    // 2.3333... (精确无限循环小数)
a.mod(b);    // 1
a.pow(3);    // 343
a.cmp(b);    // 1 (a 更大)
a.gt(b);     // true`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>数值 A</label><input type="text" data-a value="7" /></div>' +
            '<div class="field"><label>数值 B</label><input type="text" data-b value="3" /></div>' +
            '<div class="field"><label>小数位</label><div class="range-row"><input type="range" data-dp min="1" max="10" value="4" /><span class="range-val" data-dv>4</span></div></div>' +
            '<div class="btn-row"><button class="btn" data-run>全部运算</button></div>', { single: true });
          const dv = root.querySelector("[data-dv]"), dp = root.querySelector("[data-dp]");
          dp.oninput = () => (dv.textContent = dp.value);
          function run() {
            try {
              const a = new Big(root.querySelector("[data-a]").value);
              const b = new Big(root.querySelector("[data-b]").value);
              const D = +dp.value;
              out.innerHTML =
                '<span class="k">A + B   </span><span class="ok">' + a.plus(b) + '</span>\n' +
                '<span class="k">A − B   </span><span class="ok">' + a.minus(b) + '</span>\n' +
                '<span class="k">A × B   </span><span class="ok">' + a.times(b) + '</span>\n' +
                '<span class="k">A ÷ B   </span><span class="ok">' + a.div(b).toFixed(D) + '</span>\n' +
                '<span class="k">A mod B </span><span class="ok">' + a.mod(b) + '</span>\n' +
                '<span class="k">A ^ B   </span><span class="ok">' + a.pow(b) + '</span>\n' +
                '<span class="k">A 比较 B</span><span class="v">' + (a.cmp(b) > 0 ? "A > B" : a.cmp(b) < 0 ? "A < B" : "A = B") + '</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ---------- bignumber.js ---------- */
  DEMOS.bignumber = {
    tabs: [
      {
        label: "大数阶乘 & 幂",
        code:
`let f = new BigNumber(1);
for (let i = 2; i <= 50; i++) f = f.times(i);
f.toFixed();                 // 50! (65 位)
f.toFixed().length;          // 65
new BigNumber(2).pow(256);   // 2^256 (78 位大整数)`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>阶乘 n!（n 越大越能体现大数威力）</label>' +
            '<div class="range-row"><input type="range" data-n min="5" max="120" value="50" /><span class="range-val" data-nv>50</span></div></div>' +
            '<div class="field"><label>大数幂：base ^ exp</label>' +
            '<div style="display:flex;gap:8px"><input type="text" data-base value="2" style="flex:1" />' +
            '<input type="text" data-exp value="256" style="flex:1" /></div></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算</button></div>', { single: true });
          const nv = root.querySelector("[data-nv]"), n = root.querySelector("[data-n]");
          n.oninput = () => (nv.textContent = n.value);
          function run() {
            try {
              let f = new BigNumber(1);
              for (let i = 2; i <= +n.value; i++) f = f.times(i);
              const base = new BigNumber(root.querySelector("[data-base]").value);
              const p = base.pow(+root.querySelector("[data-exp]").value);
              out.innerHTML =
                '<span class="k">' + n.value + '! =</span>\n<span class="ok">' + f.toFixed() + '</span>\n' +
                '<span class="muted">（共 ' + f.toFixed().length + ' 位数字）</span>\n\n' +
                '<span class="k">' + root.querySelector("[data-base]").value + ' ^ ' + root.querySelector("[data-exp]").value + ' =</span>\n<span class="v">' + p.toFixed() + '</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "进制转换",
        code:
`new BigNumber('255').toString(16);   // "ff"
new BigNumber('255').toString(2);    // "11111111"
new BigNumber('z').toString(36);     // 进制 2~36
new BigNumber('3.14159').dp;         // 小数位数 5
new BigNumber('10').isInteger();     // true`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>十进制数值</label><input type="text" data-v value="255" /></div>' +
            '<div class="field"><label>目标进制 (2~36)</label><input type="number" data-base value="16" min="2" max="36" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>转换</button></div>', { single: true });
          function run() {
            try {
              const v = new BigNumber(root.querySelector("[data-v]").value);
              const base = +root.querySelector("[data-base]").value;
              out.innerHTML =
                '<span class="k">十进制 </span><span class="ok">' + v.toFixed() + '</span>\n' +
                '<span class="k">十六进制 </span><span class="ok">' + v.toString(16) + '</span>\n' +
                '<span class="k">二进制 </span><span class="ok">' + v.toString(2) + '</span>\n' +
                '<span class="k">目标进制 ' + base + ' </span><span class="v">' + v.toString(base) + '</span>\n' +
                '<span class="k">小数位 </span><span class="v">' + (v.decimalPlaces == null ? v.dp : v.decimalPlaces()) + '</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "舍入模式 & 比较",
        code:
`const x = new BigNumber('2.5');
x.decimalPlaces(0, BigNumber.ROUND_HALF_UP);   // 3
x.decimalPlaces(0, BigNumber.ROUND_DOWN);      // 2
x.comparedTo(2);                               // 1
x.isGreaterThan(2);                            // true
x.toFraction();                                // [5, 2]`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>数值</label><input type="text" data-v value="2.5" /></div>' +
            '<div class="field"><label>舍入模式</label><select data-rm>' +
            '<option value="1">ROUND_HALF_UP 四舍五入</option>' +
            '<option value="2">ROUND_HALF_EVEN 银行家</option>' +
            '<option value="3">ROUND_CEIL 向上</option>' +
            '<option value="4">ROUND_FLOOR 向下</option></select></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算</button></div>', { single: true });
          function run() {
            try {
              const x = new BigNumber(root.querySelector("[data-v]").value);
              const rm = +root.querySelector("[data-rm]").value;
              out.innerHTML =
                '<span class="k">舍入到整数 </span><span class="ok">' + x.decimalPlaces(0, rm).toFixed() + '</span>\n' +
                '<span class="k">对比 2     </span><span class="v">' + (x.comparedTo(2) > 0 ? ">" : x.comparedTo(2) < 0 ? "<" : "=") + ' 2</span>\n' +
                '<span class="k">是否整数   </span><span class="v">' + x.isInteger() + '</span>\n' +
                '<span class="k">转分数     </span><span class="v">' + x.toFraction().join("/") + '</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ---------- numeric.js ---------- */
  DEMOS.numeric = {
    tabs: [
      {
        label: "解线性方程组",
        code:
`const A = [[2,1,-1],[-3,-1,2],[-2,1,2]];
const b = [8, -11, -3];
const x = numeric.solve(A, b);   // [2, 3, -1]
numeric.det(A);                  // 行列式
numeric.inv(A);                  // 逆`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>矩阵 A（每行一组，逗号分隔）</label>' +
            '<textarea data-A rows="3">2, 1, -1\n-3, -1, 2\n-2, 1, 2</textarea></div>' +
            '<div class="field"><label>向量 b</label><input type="text" data-b value="8, -11, -3" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>求解 Ax = b</button></div>', { single: true });
          function parseM(s) { return s.trim().split("\n").map((r) => r.split(",").map(Number)); }
          function run() {
            try {
              const A = parseM(root.querySelector("[data-A]").value);
              const b = root.querySelector("[data-b]").value.split(",").map(Number);
              const x = numeric.solve(A, b);
              out.innerHTML =
                '<span class="k">解 x = </span><span class="ok">[ ' + x.map((v) => fmt(v, 4)).join(", ") + ' ]</span>\n' +
                '<span class="k">det(A) = </span><span class="v">' + fmt(numeric.det(A), 4) + '</span>\n\n' +
                '<span class="k">A⁻¹ =</span>\n' + numeric.inv(A).map((r) => "  [ " + r.map((v) => fmt(v, 3)).join(", ") + " ]").join("\n");
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "特征值 / 分解",
        code:
`numeric.det(A);                       // 行列式
numeric.inv(A);                       // 逆
const e = numeric.eig(A);             // 特征值分解
e.lambda.x;                           // 实部特征值
numeric.LU(A);                        // LU 分解
numeric.transpose(A);                 // 转置`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>方阵 A</label>' +
            '<textarea data-A rows="3">4, 1, 2\n0, 3, -1\n2, 1, 5</textarea></div>' +
            '<div class="btn-row"><button class="btn" data-run>分解</button></div>', { single: true });
          function run() {
            try {
              const A = root.querySelector("[data-A]").value.trim().split("\n").map((r) => r.split(",").map(Number));
              const e = numeric.eig(A);
              out.innerHTML =
                '<span class="k">det(A)        = </span><span class="ok">' + fmt(numeric.det(A), 4) + '</span>\n' +
                '<span class="k">特征值(实部)  = </span><span class="v">[ ' + e.lambda.x.map((v) => fmt(v, 3)).join(", ") + ' ]</span>\n' +
                '<span class="k">特征值(虚部)  = </span><span class="v">[ ' + e.lambda.y.map((v) => fmt(v, 3)).join(", ") + ' ]</span>\n' +
                '<span class="k">tr(A)         = </span><span class="v">' + fmt(A.reduce((s, r, i) => s + r[i], 0), 3) + '</span>\n' +
                '<span class="k">Aᵀ (转置) 首行 = </span><span class="v">[ ' + numeric.transpose(A)[0].map((v) => fmt(v, 2)).join(", ") + ' ]</span>';
            } catch (e2) { out.innerHTML = '<span class="err">' + e2.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ---------- ml-matrix ---------- */
  DEMOS.mlmatrix = {
    tabs: [
      {
        label: "求逆 + 验证",
        code:
`const A = new MLMatrix([[4,3,2],[1,5,1],[2,1,6]]);
const inv = MLMatrix.inverse(A);
const I = A.mmul(inv);          // ≈ 单位矩阵
MLMatrix.determinant(A);`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>方阵 A（每行一组，逗号分隔）</label>' +
            '<textarea data-A rows="3">4, 3, 2\n1, 5, 1\n2, 1, 6</textarea></div>' +
            '<div class="btn-row"><button class="btn" data-run>求逆并验证 A·A⁻¹ = I</button></div>',
            { vizLabel: "矩阵热力图 (A 与 A⁻¹)" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          const NS = window.mlMatrix || window.MLMatrix || null;
          const Matrix = NS && (NS.Matrix || NS.default || NS);
          function run() {
            try {
              if (!Matrix) throw new Error("ml-matrix 未加载");
              const data = root.querySelector("[data-A]").value.trim().split("\n").map((r) => r.split(",").map(Number));
              const A = new Matrix(data);
              const inv = Matrix.inverse ? Matrix.inverse(A) : A.inverse();
              const I = A.mmul(inv);
              out.innerHTML =
                '<span class="k">det(A) = </span><span class="v">' + fmt(A.determinant ? A.determinant() : NS.determinant(A), 4) + '</span>\n' +
                '<span class="k">A⁻¹ =</span>\n' + inv.to2DArray().map((r) => "  [ " + r.map((v) => fmt(v, 3)).join(", ") + " ]").join("\n") +
                '\n\n<span class="ok">A·A⁻¹ ≈ I：</span>\n' + I.to2DArray().map((r) => "  [ " + r.map((v) => fmt(Math.abs(v) < 1e-10 ? 0 : v, 2)).join(", ") + " ]").join("\n");
              ctx.clearRect(0, 0, w, h); ctx.fillStyle = css("--code-bg"); ctx.fillRect(0, 0, w, h);
              heat(A.to2DArray(), 30, 40, 160, "A");
              heat(inv.to2DArray(), 240, 40, 160, "A⁻¹");
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "乘法 & 转置",
        code:
`const A = new MLMatrix([[...]]);
const B = new MLMatrix([[...]]);
MLMatrix.multiply(A, B);    // A·B
A.transpose();              // Aᵀ
MLMatrix.add(A, B);         // 逐元素加
A.scale(2);                 // 逐元素缩放`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>矩阵 A</label><textarea data-A rows="2">1, 2, 3\n4, 5, 6</textarea></div>' +
            '<div class="field"><label>矩阵 B</label><textarea data-B rows="2">6, 5, 4\n3, 2, 1</textarea></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算 A·B 与 Aᵀ</button></div>',
            { vizLabel: "A·B 结果热力图" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          const NS = window.mlMatrix || window.MLMatrix || null;
          const Matrix = NS && (NS.Matrix || NS.default || NS);
          function run() {
            try {
              if (!Matrix) throw new Error("ml-matrix 未加载");
              const A = new Matrix(root.querySelector("[data-A]").value.trim().split("\n").map((r) => r.split(",").map(Number)));
              const B = new Matrix(root.querySelector("[data-B]").value.trim().split("\n").map((r) => r.split(",").map(Number)));
              const P = Matrix.multiply(A, B);
              out.innerHTML =
                '<span class="k">A·B =</span>\n' + P.to2DArray().map((r) => "  [ " + r.map((v) => fmt(v, 2)).join(", ") + " ]").join("\n") +
                '\n<span class="k">Aᵀ 首行 = </span><span class="v">[ ' + A.transpose().to2DArray()[0].map((v) => fmt(v, 2)).join(", ") + ' ]</span>' +
                '\n<span class="muted">A 形状 ' + A.rows + '×' + A.columns + '，B 形状 ' + B.rows + '×' + B.columns + '</span>';
              ctx.clearRect(0, 0, w, h); ctx.fillStyle = css("--code-bg"); ctx.fillRect(0, 0, w, h);
              heat(P.to2DArray(), 135, 40, 200, "A · B");
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "矩阵分解 (SVD)",
        code:
`const A = new MLMatrix([[...]]);
const svd = new MLMatrix.SingularValueDecomposition(A);
svd.s;                 // 奇异值向量
svd.U, svd.V;         // 左/右奇异向量
// 重构：U · diag(s) · Vᵀ ≈ A`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>矩阵 A（m×n）</label>' +
            '<textarea data-A rows="3">3, 2, 2\n2, 3, -2</textarea></div>' +
            '<div class="btn-row"><button class="btn" data-run>奇异值分解</button></div>', { single: true });
          function run() {
            try {
              const NS = window.mlMatrix || window.MLMatrix;
              if (!NS || !NS.SingularValueDecomposition) throw new Error("SVD 未加载");
              const data = root.querySelector("[data-A]").value.trim().split("\n").map((r) => r.split(",").map(Number));
              const svd = new NS.SingularValueDecomposition(data);
              const s = svd.s;
              let err = 0;
              if (svd.U && svd.V) {
                const recon = NS.Matrix.multiply(NS.Matrix.multiply(new NS.Matrix(svd.U), new NS.Matrix([s.map((v, i) => (i < s.length ? v : 0))])), new NS.Matrix(svd.V).transpose());
                for (let i = 0; i < data.length; i++) for (let j = 0; j < data[0].length; j++) err += Math.abs(recon.get(i, j) - data[i][j]);
              }
              out.innerHTML =
                '<span class="k">奇异值 s = </span><span class="ok">[ ' + s.map((v) => fmt(v, 4)).join(", ") + ' ]</span>\n' +
                '<span class="k">秩 (非零奇异值) = </span><span class="v">' + s.filter((v) => v > 1e-9).length + '</span>\n' +
                '<span class="muted">重构误差 Σ|A−U·diag(s)·Vᵀ| ≈ ' + fmt(err, 6) + '</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ---------- gl-matrix ---------- */
  DEMOS.glmatrix = {
    tabs: [
      {
        label: "mat4 立方体",
        code:
`const m = glMatrix.mat4.create();
glMatrix.mat4.rotateX(m, m, rx);
glMatrix.mat4.rotateY(m, m, ry);
glMatrix.mat4.scale(m, m, [s, s, s]);
// 用 vec3.transformMat4 把 8 个顶点投影到 2D`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>绕 X 轴旋转</label><div class="range-row"><input type="range" data-rx min="0" max="360" value="30" /><span class="range-val" data-rxv>30°</span></div></div>' +
            '<div class="field"><label>绕 Y 轴旋转</label><div class="range-row"><input type="range" data-ry min="0" max="360" value="45" /><span class="range-val" data-ryv>45°</span></div></div>' +
            '<div class="field"><label>缩放</label><div class="range-row"><input type="range" data-s min="50" max="150" value="100" /><span class="range-val" data-sv>1.0</span></div></div>',
            { vizLabel: "mat4 变换后的立方体投影" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          const gm = window.glMatrix;
          const V = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
          const E = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
          function run() {
            if (!gm) { out.innerHTML = '<span class="err">gl-matrix 未加载</span>'; return; }
            const rx = +root.querySelector("[data-rx]").value, ry = +root.querySelector("[data-ry]").value;
            const s = +root.querySelector("[data-s]").value / 100;
            root.querySelector("[data-rxv]").textContent = rx + "°";
            root.querySelector("[data-ryv]").textContent = ry + "°";
            root.querySelector("[data-sv]").textContent = s.toFixed(2);
            const m = gm.mat4.create();
            gm.mat4.rotateX(m, m, rx * Math.PI / 180);
            gm.mat4.rotateY(m, m, ry * Math.PI / 180);
            gm.mat4.scale(m, m, [s, s, s]);
            const proj = V.map((v) => {
              const o = gm.vec3.create(); gm.vec3.transformMat4(o, v, m);
              const f = 120 / (4 - o[2] * 0.5);
              return [w / 2 + o[0] * f, h / 2 - o[1] * f];
            });
            ctx.clearRect(0, 0, w, h); ctx.fillStyle = css("--code-bg"); ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = css("--accent-2"); ctx.lineWidth = 2;
            E.forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(proj[a][0], proj[a][1]); ctx.lineTo(proj[b][0], proj[b][1]); ctx.stroke(); });
            ctx.fillStyle = css("--accent"); proj.forEach((p) => { ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, 7); ctx.fill(); });
            out.innerHTML = '<span class="muted">4×4 变换矩阵 (列主序)：</span>\n' +
              [0,1,2,3].map((r) => "  " + [0,1,2,3].map((cc) => fmt(m[cc*4+r], 2).padStart(6)).join(" ")).join("\n");
          }
          ["data-rx","data-ry","data-s"].forEach((k) => (root.querySelector("[" + k + "]").oninput = run));
          run();
        },
      },
      {
        label: "向量运算",
        code:
`const a = glMatrix.vec3.fromValues(1, 2, 3);
const b = glMatrix.vec3.fromValues(4, 0, -1);
glMatrix.vec3.dot(a, b);          // 点积 1
glMatrix.vec3.cross(out, a, b);   // 叉积
glMatrix.vec3.length(a);          // 模长 √14
glMatrix.vec3.distance(a, b);     // 距离
glMatrix.vec3.normalize(out, a);  // 单位向量
glMatrix.vec3.lerp(out, a, b, 0.5); // 插值`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>向量 A (x,y,z)</label><input type="text" data-a value="1, 2, 3" /></div>' +
            '<div class="field"><label>向量 B (x,y,z)</label><input type="text" data-b value="4, 0, -1" /></div>' +
            '<div class="field"><label>插值系数 t</label><div class="range-row"><input type="range" data-t min="0" max="100" value="50" /><span class="range-val" data-tv>0.5</span></div></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算</button></div>', { single: true });
          const tv = root.querySelector("[data-tv]"), t = root.querySelector("[data-t]");
          t.oninput = () => (tv.textContent = (t.value / 100).toFixed(2));
          function run() {
            try {
              const gm = window.glMatrix; if (!gm) throw new Error("gl-matrix 未加载");
              const a = gm.vec3.fromValues(...root.querySelector("[data-a]").value.split(",").map(Number));
              const b = gm.vec3.fromValues(...root.querySelector("[data-b]").value.split(",").map(Number));
              const tt = +root.querySelector("[data-t]").value / 100;
              const cross = gm.vec3.create(), norm = gm.vec3.create(), lerp = gm.vec3.create();
              gm.vec3.cross(cross, a, b); gm.vec3.normalize(norm, a); gm.vec3.lerp(lerp, a, b, tt);
              out.innerHTML =
                '<span class="k">点积 dot       = </span><span class="ok">' + fmt(gm.vec3.dot(a, b), 3) + '</span>\n' +
                '<span class="k">叉积 cross     = </span><span class="ok">' + fmtArr(cross, 3) + '</span>\n' +
                '<span class="k">模长 |a|       = </span><span class="ok">' + fmt(gm.vec3.length(a), 4) + '</span>\n' +
                '<span class="k">距离 dist      = </span><span class="ok">' + fmt(gm.vec3.distance(a, b), 4) + '</span>\n' +
                '<span class="k">a 单位化       = </span><span class="ok">' + fmtArr(norm, 3) + '</span>\n' +
                '<span class="k">lerp(a,b,' + tt.toFixed(2) + ') = </span><span class="v">' + fmtArr(lerp, 3) + '</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "矩阵 / 投影",
        code:
`const proj = glMatrix.mat4.create();
glMatrix.mat4.perspective(proj, Math.PI/4, 1.5, 0.1, 100);
const view = glMatrix.mat4.create();
glMatrix.mat4.lookAt(view, [0,0,5], [0,0,0], [0,1,0]);
// 把世界坐标点投影到裁剪空间
glMatrix.vec3.transformMat4(out, worldPoint, proj);`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>视场角 fovy (°)</label><div class="range-row"><input type="range" data-f min="20" max="90" value="45" /><span class="range-val" data-fv>45</span></div></div>' +
            '<div class="field"><label>宽高比 aspect</label><div class="range-row"><input type="range" data-a min="50" max="250" value="150" /><span class="range-val" data-av>1.5</span></div></div>' +
            '<div class="btn-row"><button class="btn" data-run>生成投影矩阵</button></div>', { single: true });
          const fv = root.querySelector("[data-fv]"), av = root.querySelector("[data-av]");
          root.querySelector("[data-f]").oninput = () => (fv.textContent = root.querySelector("[data-f]").value);
          root.querySelector("[data-a]").oninput = () => (av.textContent = (root.querySelector("[data-a]").value / 100).toFixed(2));
          function run() {
            try {
              const gm = window.glMatrix; if (!gm) throw new Error("gl-matrix 未加载");
              const fovy = +root.querySelector("[data-f]").value * Math.PI / 180;
              const aspect = +root.querySelector("[data-a]").value / 100;
              const proj = gm.mat4.create();
              gm.mat4.perspective(proj, fovy, aspect, 0.1, 100);
              const view = gm.mat4.create();
              gm.mat4.lookAt(view, [0, 0, 5], [0, 0, 0], [0, 1, 0]);
              const p = gm.mat4.create(); gm.mat4.multiply(p, proj, view);
              out.innerHTML =
                '<span class="muted">perspective × lookAt 合成后的 4×4 矩阵（列主序）：</span>\n' +
                [0,1,2,3].map((r) => "  " + [0,1,2,3].map((cc) => fmt(p[cc*4+r], 3).padStart(8)).join(" ")).join("\n") +
                '\n<span class="muted">// 常用于把 3D 世界坐标变换到裁剪空间</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ---------- numjs ---------- */
  DEMOS.numjs = {
    tabs: [
      {
        label: "reshape / 转置",
        code:
`const a = nj.array([1,2,...,12]).reshape(3, 4);
a.toString();        // 3×4 矩阵
a.T.toString();      // 转置
a.add(100);          // 逐元素 +100
a.sum(); a.mean(); a.max();`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>一维数据（逗号分隔）</label><input type="text" data-arr value="1,2,3,4,5,6,7,8,9,10,11,12" /></div>' +
            '<div class="field"><label>reshape 行 × 列</label><div style="display:flex;gap:8px"><input type="number" data-r value="3" style="flex:1" /><input type="number" data-c value="4" style="flex:1" /></div></div>' +
            '<div class="btn-row"><button class="btn" data-run>运行 NumPy 风格运算</button></div>', { single: true });
          out.innerHTML = '<span class="muted">加载 numjs…</span>';
          loadESM("nj", "https://esm.sh/numjs@0.16.1").then((nj) => {
            function run() {
              try {
                const arr = root.querySelector("[data-arr]").value.split(",").map(Number);
                const r = +root.querySelector("[data-r]").value, cc = +root.querySelector("[data-c]").value;
                const a = nj.array(arr).reshape(r, cc);
                const t = a.T;
                out.innerHTML =
                  '<span class="k">ndarray (' + r + '×' + cc + ') =</span>\n' + a.toString() + '\n\n' +
                  '<span class="k">转置 aᵀ =</span>\n' + t.toString() + '\n\n' +
                  '<span class="k">a + 100 =</span>\n' + a.add(100).toString() + '\n\n' +
                  '<span class="k">sum=</span><span class="v">' + a.sum() + '</span>  ' +
                  '<span class="k">mean=</span><span class="v">' + fmt(a.mean(), 3) + '</span>  ' +
                  '<span class="k">max=</span><span class="v">' + a.max() + '</span>';
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + '</span>');
        },
      },
      {
        label: "统计 & 切片",
        code:
`a.mean(0);          // 沿轴 0 求均值
a.sum(1);           // 沿轴 1 求行和
a.max(0); a.min(1);
a.std();            // 标准差
const sub = a.slice({ rows: [0,2], columns: [1,3] });  // 切片`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>矩阵数据（每行一组，逗号分隔）</label><textarea data-A rows="3">1, 5, 3\n4, 2, 8\n6, 0, 7</textarea></div>' +
            '<div class="btn-row"><button class="btn" data-run>按轴统计 + 切片</button></div>', { single: true });
          out.innerHTML = '<span class="muted">加载 numjs…</span>';
          loadESM("nj", "https://esm.sh/numjs@0.16.1").then((nj) => {
            function run() {
              try {
                const data = root.querySelector("[data-A]").value.trim().split("\n").map((r) => r.split(",").map(Number));
                const a = nj.array(data);
                const slice = a.slice({ rows: [0, 2], columns: [1, 3] });
                out.innerHTML =
                  '<span class="k">a =</span>\n' + a.toString() + '\n' +
                  '<span class="k">按列均值 mean(0) = </span><span class="v">' + fmtArr(a.mean(0).tolist(), 3) + '</span>\n' +
                  '<span class="k">按行求和 sum(1) = </span><span class="v">' + fmtArr(a.sum(1).tolist(), 2) + '</span>\n' +
                  '<span class="k">标准差 std = </span><span class="v">' + fmt(a.std(), 4) + '</span>\n' +
                  '<span class="k">切片 rows[0,2) cols[1,3) =</span>\n' + slice.toString();
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + '</span>');
        },
      },
      {
        label: "点积 & 函数",
        code:
`const x = nj.array([1,2,3]);
const y = nj.array([4,5,6]);
x.dot(y);                    // 点积 32
x.add(y);                    // 逐元素加
x.multiply(y);               // 逐元素乘
nj.exp(x);                   // e^x 逐元素`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>向量 x（逗号分隔）</label><input type="text" data-x value="1, 2, 3" /></div>' +
            '<div class="field"><label>向量 y（逗号分隔）</label><input type="text" data-y value="4, 5, 6" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>向量运算</button></div>', { single: true });
          out.innerHTML = '<span class="muted">加载 numjs…</span>';
          loadESM("nj", "https://esm.sh/numjs@0.16.1").then((nj) => {
            function run() {
              try {
                const x = nj.array(root.querySelector("[data-x]").value.split(",").map(Number));
                const y = nj.array(root.querySelector("[data-y]").value.split(",").map(Number));
                out.innerHTML =
                  '<span class="k">点积 x·y     = </span><span class="ok">' + x.dot(y) + '</span>\n' +
                  '<span class="k">x + y        = </span><span class="ok">' + fmtArr(x.add(y).tolist(), 2) + '</span>\n' +
                  '<span class="k">x * y(逐元素)= </span><span class="ok">' + fmtArr(x.multiply(y).tolist(), 2) + '</span>\n' +
                  '<span class="k">e^x         = </span><span class="ok">' + fmtArr(nj.exp(x).tolist(), 3) + '</span>';
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + '</span>');
        },
      },
    ],
  };

  /* ---------- simple-statistics ---------- */
  DEMOS.simplestats = {
    tabs: [
      {
        label: "描述统计 + 回归",
        code:
`ss.mean(y); ss.median(y);
ss.standardDeviation(y); ss.variance(y);
const reg = ss.linearRegression(points);
const line = ss.linearRegressionLine(reg);
ss.rSquared(points, line);`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>数据序列 y（x 取索引 0,1,2…）</label><textarea data-d rows="2">2, 3.5, 3, 5, 4.8, 6.2, 6, 7.5, 8.1, 9</textarea></div>' +
            '<div class="btn-row"><button class="btn" data-run>统计 + 线性回归</button></div>',
            { vizLabel: "散点与回归直线" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          function run() {
            try {
              const y = root.querySelector("[data-d]").value.split(",").map(Number).filter((v) => !isNaN(v));
              const pts = y.map((v, i) => [i, v]);
              const reg = ss.linearRegression(pts);
              const rl = ss.linearRegressionLine(reg);
              const r2 = ss.rSquared(pts, rl);
              out.innerHTML =
                '<span class="k">均值   </span><span class="v">' + fmt(ss.mean(y), 3) + '</span>   ' +
                '<span class="k">中位数 </span><span class="v">' + fmt(ss.median(y), 3) + '</span>\n' +
                '<span class="k">标准差 </span><span class="v">' + fmt(ss.standardDeviation(y), 3) + '</span>   ' +
                '<span class="k">方差   </span><span class="v">' + fmt(ss.variance(y), 3) + '</span>\n' +
                '<span class="k">最小/最大 </span><span class="v">' + ss.min(y) + ' / ' + ss.max(y) + '</span>\n\n' +
                '<span class="ok">回归：y = ' + fmt(reg.m, 3) + '·x + ' + fmt(reg.b, 3) + '</span>\n' +
                '<span class="k">R² = </span><span class="v">' + fmt(r2, 4) + '</span>';
              const ymin = Math.min(...y) - 1, ymax = Math.max(...y) + 1;
              plot2D(ctx, w, h, { xmin: 0, xmax: y.length - 1, ymin, ymax }, (mx, my) => {
                line(ctx, [[mx(0), my(rl(0))], [mx(y.length - 1), my(rl(y.length - 1))]], css("--accent-3"), 2.2);
                ctx.fillStyle = css("--accent");
                pts.forEach((p) => { ctx.beginPath(); ctx.arc(mx(p[0]), my(p[1]), 4, 0, 7); ctx.fill(); });
              });
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "分位数 / 相关",
        code:
`ss.quantileSorted(ss.sorted(y), 0.5); // 中位数
ss.mode(y);                            // 众数
ss.sampleCorrelation(x, y);            // 皮尔逊相关
ss.sampleCovariance(x, y);             // 协方差
ss.rSquared(points, line);`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>序列 X</label><input type="text" data-x value="1, 2, 3, 4, 5, 6, 7, 8" /></div>' +
            '<div class="field"><label>序列 Y</label><input type="text" data-y value="2, 4, 5, 4, 6, 7, 8, 10" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算</button></div>', { single: true });
          function run() {
            try {
              const x = root.querySelector("[data-x]").value.split(",").map(Number);
              const y = root.querySelector("[data-y]").value.split(",").map(Number);
              const sorted = ss.sorted(y);
              out.innerHTML =
                '<span class="k">Q1 / 中位 / Q3 = </span><span class="ok">' +
                  fmt(ss.quantileSorted(sorted, 0.25), 2) + ' / ' + fmt(ss.quantileSorted(sorted, 0.5), 2) + ' / ' + fmt(ss.quantileSorted(sorted, 0.75), 2) + '</span>\n' +
                '<span class="k">众数 mode   = </span><span class="ok">' + fmt(ss.mode(y), 2) + '</span>\n' +
                '<span class="k">皮尔逊相关  = </span><span class="ok">' + fmt(ss.sampleCorrelation(x, y), 4) + '</span>\n' +
                '<span class="k">协方差      = </span><span class="ok">' + fmt(ss.sampleCovariance(x, y), 4) + '</span>\n' +
                '<span class="k">极值 min/max= </span><span class="v">' + ss.min(y) + ' / ' + ss.max(y) + '</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "概率分布",
        code:
`ss.normalPdf(x, mean, sd);
ss.normalCdf(x, mean, sd);
ss.bernoulliDistribution(0.4);   // {0:0.6, 1:0.4}
ss.poissonDistribution(3);       // 泊松 PMF
ss.epsilon;                      // 浮点容差`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>分布</label><select data-dist>' +
            '<option value="normal">正态分布 PDF</option><option value="bern">伯努利分布</option><option value="pois">泊松分布</option></select></div>' +
            '<div class="field"><label>参数 p / λ / σ</label><div class="range-row"><input type="range" data-p min="1" max="50" value="15" /><span class="range-val" data-pv>1.5</span></div></div>' +
            '<div class="btn-row"><button class="btn" data-run>绘制分布</button></div>',
            { vizLabel: "概率质量 / 密度" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          function run() {
            try {
              const dist = root.querySelector("[data-dist]").value;
              const p = +root.querySelector("[data-p]").value / 10;
              root.querySelector("[data-pv]").textContent = p.toFixed(1);
              let html = "", pts = [], xmin, xmax, ymax = 0;
              if (dist === "normal") {
                xmin = -5; xmax = 5;
                for (let x = xmin; x <= xmax; x += 0.1) { const v = ss.normalPdf(x, 0, p); pts.push([x, v]); ymax = Math.max(ymax, v); }
                html = '<span class="k">N(0, ' + p + ') PDF 峰值 ≈ </span><span class="ok">' + fmt(ss.normalPdf(0, 0, p), 4) + '</span>';
              } else if (dist === "bern") {
                const d = ss.bernoulliDistribution(p);
                pts = [[0, d[0]], [1, d[1]]]; ymax = 1; xmin = -0.5; xmax = 1.5;
                html = '<span class="k">Bernoulli(' + p + ') = </span><span class="ok">P(0)=' + fmt(d[0], 3) + ', P(1)=' + fmt(d[1], 3) + '</span>';
              } else {
                const d = ss.poissonDistribution(p);
                pts = Object.keys(d).map((k) => [+k, d[k]]); ymax = Math.max(...pts.map((q) => q[1])); xmin = -0.5; xmax = pts.length;
                html = '<span class="k">Poisson(' + p + ') 期望 = </span><span class="ok">' + fmt(p, 2) + '</span>';
              }
              plot2D(ctx, w, h, { xmin, xmax, ymin: 0, ymax: ymax * 1.15 || 1 }, (mx, my) => {
                if (dist === "normal") line(ctx, pts.map((q) => [mx(q[0]), my(q[1])]), css("--accent"), 2.2);
                else pts.forEach((q) => { ctx.fillStyle = css("--accent"); ctx.fillRect(mx(q[0]) - 12, my(q[1]), 24, h - 46 - (my(q[1]) - 16)); });
              });
              out.innerHTML = html;
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-p]").oninput = run;
          root.querySelector("[data-dist]").onchange = run;
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ---------- d3-array / d3-random ---------- */
  DEMOS.d3stats = {
    tabs: [
      {
        label: "直方图分箱",
        code:
`const gen = d3.randomNormal(mu, sigma);
const data = Array.from({ length: n }, gen);
const bins = d3.bin().domain(d3.extent(data)).thresholds(k)(data);
d3.mean(data); d3.median(data); d3.deviation(data);`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>样本数量</label><div class="range-row"><input type="range" data-n min="100" max="5000" step="100" value="2000" /><span class="range-val" data-nv>2000</span></div></div>' +
            '<div class="field"><label>均值 μ</label><div class="range-row"><input type="range" data-m min="-5" max="5" step="0.5" value="0" /><span class="range-val" data-mv>0</span></div></div>' +
            '<div class="field"><label>标准差 σ</label><div class="range-row"><input type="range" data-s min="0.5" max="4" step="0.1" value="1.5" /><span class="range-val" data-sv>1.5</span></div></div>' +
            '<div class="field"><label>分箱数</label><div class="range-row"><input type="range" data-b min="10" max="60" value="30" /><span class="range-val" data-bv>30</span></div></div>',
            { vizLabel: "d3.bin 直方图" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          function run() {
            try {
              if (!window.d3 || !d3.randomNormal) throw new Error("d3-random 未加载");
              const n = +root.querySelector("[data-n]").value, m = +root.querySelector("[data-m]").value,
                s = +root.querySelector("[data-s]").value, nb = +root.querySelector("[data-b]").value;
              root.querySelector("[data-nv]").textContent = n; root.querySelector("[data-mv]").textContent = m;
              root.querySelector("[data-sv]").textContent = s; root.querySelector("[data-bv]").textContent = nb;
              const gen = d3.randomNormal(m, s);
              const data = Array.from({ length: n }, gen);
              const ext = d3.extent(data);
              const bins = d3.bin().domain(ext).thresholds(nb)(data);
              const maxc = d3.max(bins, (b) => b.length);
              out.innerHTML =
                '<span class="k">样本均值 </span><span class="v">' + fmt(d3.mean(data), 3) + '</span>  ' +
                '<span class="k">中位数 </span><span class="v">' + fmt(d3.median(data), 3) + '</span>\n' +
                '<span class="k">范围 </span><span class="v">[' + fmt(ext[0], 2) + ', ' + fmt(ext[1], 2) + ']</span>  ' +
                '<span class="k">偏差 </span><span class="v">' + fmt(d3.deviation(data), 3) + '</span>\n' +
                '<span class="muted">共 ' + bins.length + ' 个分箱，最高频次 ' + maxc + '</span>';
              ctx.clearRect(0, 0, w, h); ctx.fillStyle = css("--code-bg"); ctx.fillRect(0, 0, w, h);
              const pad = 24, iw = w - 2 * pad, ih = h - 2 * pad, bw = iw / bins.length;
              bins.forEach((b, i) => {
                const bh = (b.length / maxc) * ih;
                const t = i / bins.length;
                ctx.fillStyle = "hsl(" + (45 - t * 10) + ", 70%, " + (45 + (b.length / maxc) * 20) + "%)";
                ctx.fillRect(pad + i * bw, h - pad - bh, bw - 1, bh);
              });
              ctx.strokeStyle = css("--border"); ctx.beginPath(); ctx.moveTo(pad, h - pad); ctx.lineTo(w - pad, h - pad); ctx.stroke();
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          ["data-n","data-m","data-s","data-b"].forEach((k) => (root.querySelector("[" + k + "]").oninput = run));
          run();
        },
      },
      {
        label: "聚合运算",
        code:
`d3.sum(data); d3.mean(data);
d3.extent(data);          // [min, max]
d3.deviation(data);
d3.quantile(sorted, 0.9); // 90 分位
d3.bisect(sorted, x);     // 插入位置`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>数据（逗号分隔）</label><input type="text" data-d value="3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5" /></div>' +
            '<div class="field"><label>分位数 q (0~1)</label><div class="range-row"><input type="range" data-q min="0" max="100" value="90" /><span class="range-val" data-qv>0.90</span></div></div>' +
            '<div class="btn-row"><button class="btn" data-run>聚合</button></div>', { single: true });
          function run() {
            try {
              if (!window.d3) throw new Error("d3-array 未加载");
              const d = root.querySelector("[data-d]").value.split(",").map(Number);
              const q = +root.querySelector("[data-q]").value / 100;
              root.querySelector("[data-qv]").textContent = q.toFixed(2);
              const sorted = d.slice().sort((a, b) => a - b);
              out.innerHTML =
                '<span class="k">sum  = </span><span class="ok">' + fmt(d3.sum(d), 3) + '</span>\n' +
                '<span class="k">mean = </span><span class="ok">' + fmt(d3.mean(d), 3) + '</span>\n' +
                '<span class="k">extent = </span><span class="ok">' + fmtArr(d3.extent(d), 3) + '</span>\n' +
                '<span class="k">deviation = </span><span class="ok">' + fmt(d3.deviation(d), 4) + '</span>\n' +
                '<span class="k">quantile ' + q.toFixed(2) + ' = </span><span class="ok">' + fmt(d3.quantile(sorted, q), 3) + '</span>\n' +
                '<span class="k">bisect 4 的位置 = </span><span class="v">' + d3.bisect(sorted, 4) + '</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-q]").oninput = run;
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "多分布采样",
        code:
`d3.randomNormal(mu, sigma)();     // 正态
d3.randomLogNormal(mu, sigma)();  // 对数正态
d3.randomUniform(a, b)();         // 均匀
d3.randomInt(1, 6)();             // 整数
// 每个都是可用 ` + '`new` 调用的随机源',
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>随机数源</label><select data-src>' +
            '<option value="normal">randomNormal(0,1)</option><option value="lognormal">randomLogNormal(0,0.5)</option>' +
            '<option value="uniform">randomUniform(-3,3)</option><option value="int">randomInt(1,6) 掷骰</option></select></div>' +
            '<div class="field"><label>样本数</label><div class="range-row"><input type="range" data-n min="200" max="3000" step="100" value="1500" /><span class="range-val" data-nv>1500</span></div></div>' +
            '<div class="btn-row"><button class="btn" data-run>采样并统计</button></div>',
            { vizLabel: "采样分布直方图" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          function run() {
            try {
              if (!window.d3 || !d3.randomNormal) throw new Error("d3-random 未加载");
              const src = root.querySelector("[data-src]").value;
              const n = +root.querySelector("[data-n]").value;
              root.querySelector("[data-nv]").textContent = n;
              let gen, label;
              if (src === "normal") { gen = d3.randomNormal(0, 1); label = "N(0,1)"; }
              else if (src === "lognormal") { gen = d3.randomLogNormal(0, 0.5); label = "LogNormal(0,0.5)"; }
              else if (src === "uniform") { gen = d3.randomUniform(-3, 3); label = "U(-3,3)"; }
              else { gen = d3.randomInt(1, 6); label = "掷骰 1~6"; }
              const data = Array.from({ length: n }, gen);
              const ext = d3.extent(data);
              const bins = d3.bin().domain(ext).thresholds(28)(data);
              const maxc = d3.max(bins, (b) => b.length);
              out.innerHTML =
                '<span class="k">分布 </span><span class="ok">' + label + '</span>\n' +
                '<span class="k">均值 </span><span class="v">' + fmt(d3.mean(data), 3) + '</span>  ' +
                '<span class="k">范围 </span><span class="v">[' + fmt(ext[0], 2) + ', ' + fmt(ext[1], 2) + ']</span>';
              ctx.clearRect(0, 0, w, h); ctx.fillStyle = css("--code-bg"); ctx.fillRect(0, 0, w, h);
              const pad = 24, iw = w - 2 * pad, ih = h - 2 * pad, bw = iw / bins.length;
              bins.forEach((b, i) => {
                const bh = (b.length / maxc) * ih;
                ctx.fillStyle = css("--accent-2"); ctx.fillRect(pad + i * bw, h - pad - bh, bw - 1, bh);
              });
              ctx.strokeStyle = css("--border"); ctx.beginPath(); ctx.moveTo(pad, h - pad); ctx.lineTo(w - pad, h - pad); ctx.stroke();
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-src]").onchange = run;
          root.querySelector("[data-n]").oninput = run;
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ---------- jStat ---------- */
  DEMOS.jstat = {
    tabs: [
      {
        label: "概率密度 PDF",
        code:
`jStat.normal.pdf(x, mu, sigma);
jStat.studentt.pdf(x, df);
jStat.chisquare.pdf(x, k);
jStat.exponential.pdf(x, lambda);
// 曲线下面积（积分）≈ 1`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>概率分布</label><select data-dist>' +
            '<option value="normal">正态分布 Normal</option><option value="studentt">t 分布</option>' +
            '<option value="chisquare">卡方分布 χ²</option><option value="exponential">指数分布</option></select></div>' +
            '<div class="field"><label>参数 1 <span class="hint" data-l1></span></label><div class="range-row"><input type="range" data-p1 min="0.5" max="8" step="0.1" value="0" /><span class="range-val" data-p1v></span></div></div>' +
            '<div class="field"><label>参数 2 <span class="hint" data-l2></span></label><div class="range-row"><input type="range" data-p2 min="0.3" max="4" step="0.1" value="1" /><span class="range-val" data-p2v></span></div></div>',
            { vizLabel: "概率密度函数 PDF" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          const meta = {
            normal: { l1: "均值 μ", l2: "标准差 σ", p1: [-4,4,0], p2: [0.3,4,1], x: [-8,8] },
            studentt: { l1: "自由度 df", l2: "—", p1: [1,30,5], p2: null, x: [-6,6] },
            chisquare: { l1: "自由度 k", l2: "—", p1: [1,20,4], p2: null, x: [0,25] },
            exponential: { l1: "速率 λ", l2: "—", p1: [0.2,3,1], p2: null, x: [0,12] },
          };
          function setup() {
            const d = root.querySelector("[data-dist]").value, mm = meta[d];
            const p1 = root.querySelector("[data-p1]"), p2 = root.querySelector("[data-p2]");
            root.querySelector("[data-l1]").textContent = mm.l1;
            p1.min = mm.p1[0]; p1.max = mm.p1[1]; p1.value = mm.p1[2];
            if (mm.p2) { p2.disabled = false; p2.min = mm.p2[0]; p2.max = mm.p2[1]; p2.value = mm.p2[2]; root.querySelector("[data-l2]").textContent = mm.l2; }
            else { p2.disabled = true; root.querySelector("[data-l2]").textContent = "（本分布不需要）"; }
          }
          function pdf(d, x, a, b) {
            if (d === "normal") return jStat.normal.pdf(x, a, b);
            if (d === "studentt") return jStat.studentt.pdf(x, a);
            if (d === "chisquare") return jStat.chisquare.pdf(x, a);
            if (d === "exponential") return jStat.exponential.pdf(x, a);
          }
          function run() {
            try {
              if (!window.jStat) throw new Error("jStat 未加载");
              const d = root.querySelector("[data-dist]").value, mm = meta[d];
              const a = +root.querySelector("[data-p1]").value, b = +root.querySelector("[data-p2]").value;
              root.querySelector("[data-p1v]").textContent = a;
              root.querySelector("[data-p2v]").textContent = mm.p2 ? b : "—";
              const [xmin, xmax] = mm.x; const xs = [], ys = [];
              for (let x = xmin; x <= xmax; x += (xmax - xmin) / 240) { xs.push(x); ys.push(pdf(d, x, a, b) || 0); }
              const ymax = Math.max(...ys) * 1.15 || 1;
              plot2D(ctx, w, h, { xmin, xmax, ymin: 0, ymax }, (mx, my) => {
                const pts = xs.map((x, i) => [mx(x), my(ys[i])]);
                ctx.fillStyle = css("--accent") + "33"; ctx.beginPath(); ctx.moveTo(mx(xmin), my(0));
                pts.forEach((p) => ctx.lineTo(p[0], p[1])); ctx.lineTo(mx(xmax), my(0)); ctx.closePath(); ctx.fill();
                line(ctx, pts, css("--warn"), 2.4);
              });
              out.innerHTML = '<span class="k">分布 </span><span class="ok">' + d + '</span>\n' +
                '<span class="k">PDF 峰值 </span><span class="v">' + fmt(Math.max(...ys), 4) + '</span>\n' +
                '<span class="muted">曲线下面积（积分）≈ 1</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-dist]").onchange = () => { setup(); run(); };
          ["data-p1","data-p2"].forEach((k) => (root.querySelector("[" + k + "]").oninput = run));
          setup(); run();
        },
      },
      {
        label: "CDF & 分位数",
        code:
`jStat.normal.cdf(x, mu, sigma);        // 累积概率
jStat.normal.inv(p, mu, sigma);        // 分位数(逆CDF)
jStat.studentt.cdf(t, df);
jStat.chisquare.inv(p, k);`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>分布</label><select data-dist>' +
            '<option value="normal">正态分布</option><option value="studentt">t 分布</option><option value="chisquare">卡方分布</option></select></div>' +
            '<div class="field"><label>均值/自由度参数</label><input type="text" data-p1 value="0" /></div>' +
            '<div class="field"><label>标准差/第二参数</label><input type="text" data-p2 value="1" /></div>' +
            '<div class="field"><label>查询值 x 或概率 p</label><input type="text" data-x value="1.96" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算 CDF / 分位数</button></div>', { single: true });
          function run() {
            try {
              if (!window.jStat) throw new Error("jStat 未加载");
              const d = root.querySelector("[data-dist]").value;
              const a = +root.querySelector("[data-p1]").value, b = +root.querySelector("[data-p2]").value;
              const x = +root.querySelector("[data-x]").value;
              let cdf, inv, cdfV, invV;
              if (d === "normal") { cdf = jStat.normal; } else if (d === "studentt") { cdf = jStat.studentt; } else { cdf = jStat.chisquare; }
              if (d === "normal") {
                cdfV = jStat.normal.cdf(x, a, b); invV = jStat.normal.inv(0.95, a, b);
              } else if (d === "studentt") {
                cdfV = jStat.studentt.cdf(x, a); invV = jStat.studentt.inv(0.95, a);
              } else {
                cdfV = jStat.chisquare.cdf(x, a); invV = jStat.chisquare.inv(0.95, a);
              }
              out.innerHTML =
                '<span class="k">CDF(' + x + ') = </span><span class="ok">' + fmt(cdfV, 4) + '</span>  <span class="muted">(P(X ≤ ' + x + '))</span>\n' +
                '<span class="k">95% 分位数 = </span><span class="ok">' + fmt(invV, 4) + '</span>  <span class="muted">(P(X ≤ q) = 0.95)</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "分布统计量 + 抽样",
        code:
`jStat.normal.mean(mu, sigma);
jStat.normal.variance(mu, sigma);
jStat.normal.sample(mu, sigma);     // 抽一个样本
jStat.corrcoeff(matrix);            // 相关系数矩阵`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>分布</label><select data-dist>' +
            '<option value="normal">正态分布 N(μ,σ)</option><option value="lognormal">对数正态</option><option value="gamma">伽马</option></select></div>' +
            '<div class="field"><label>参数 1 (μ / α)</label><input type="text" data-p1 value="2" /></div>' +
            '<div class="field"><label>参数 2 (σ / β)</label><input type="text" data-p2 value="1" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>统计 + 抽样</button></div>', { single: true });
          function run() {
            try {
              if (!window.jStat) throw new Error("jStat 未加载");
              const d = root.querySelector("[data-dist]").value;
              const a = +root.querySelector("[data-p1]").value, b = +root.querySelector("[data-p2]").value;
              let mean, variance, samples = [];
              if (d === "normal") {
                mean = jStat.normal.mean(a, b); variance = jStat.normal.variance(a, b);
                samples = Array.from({ length: 5 }, () => jStat.normal.sample(a, b));
              } else if (d === "lognormal") {
                mean = jStat.lognormal.mean(a, b); variance = jStat.lognormal.variance(a, b);
                samples = Array.from({ length: 5 }, () => jStat.lognormal.sample(a, b));
              } else {
                mean = jStat.gamma.mean(a, b); variance = jStat.gamma.variance(a, b);
                samples = Array.from({ length: 5 }, () => jStat.gamma.sample(a, b));
              }
              out.innerHTML =
                '<span class="k">' + d + ' 理论均值 = </span><span class="ok">' + fmt(mean, 4) + '</span>\n' +
                '<span class="k">理论方差 = </span><span class="ok">' + fmt(variance, 4) + '</span>\n' +
                '<span class="k">抽样 5 个 = </span>\n<span class="v">' + samples.map((s) => fmt(s, 4)).join("\n") + '</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ---------- turf.js ---------- */
  DEMOS.turf = {
    tabs: [
      {
        label: "距离 / 方位",
        code:
`const from = turf.point([lon, lat]);
const to = turf.point([lon, lat]);
turf.distance(from, to, { units: 'kilometers' });
turf.bearing(from, to);          // 初始方位角
turf.midpoint(from, to);         // 中点`,
        mount(root) {
          const cities = {
            "北京→上海": [[116.40, 39.90], [121.47, 31.23]],
            "广州→成都": [[113.26, 23.13], [104.07, 30.57]],
            "乌鲁木齐→哈尔滨": [[87.62, 43.82], [126.53, 45.80]],
          };
          const { out, viz } = skeleton(root,
            '<div class="field"><label>预设线路</label><select data-preset>' + Object.keys(cities).map((k) => '<option>' + k + '</option>').join("") + '</select></div>' +
            '<div class="field"><label>起点 (经度, 纬度)</label><input type="text" data-p1 value="116.40, 39.90" /></div>' +
            '<div class="field"><label>终点 (经度, 纬度)</label><input type="text" data-p2 value="121.47, 31.23" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算距离 / 方位</button></div>',
            { vizLabel: "地理点投影" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          function run() {
            try {
              if (!window.turf) throw new Error("turf 未加载");
              const a = root.querySelector("[data-p1]").value.split(",").map(Number);
              const b = root.querySelector("[data-p2]").value.split(",").map(Number);
              const from = turf.point(a), to = turf.point(b);
              const dist = turf.distance(from, to, { units: "kilometers" });
              const bearing = turf.bearing(from, to);
              const mid = turf.midpoint(from, to).geometry.coordinates;
              out.innerHTML =
                '<span class="k">大圆距离 </span><span class="ok">' + fmt(dist, 1) + ' km</span>\n' +
                '<span class="k">初始方位角 </span><span class="v">' + fmt(bearing, 1) + '°</span>\n' +
                '<span class="k">中点坐标 </span><span class="v">[' + fmt(mid[0], 3) + ', ' + fmt(mid[1], 3) + ']</span>';
              ctx.clearRect(0, 0, w, h); ctx.fillStyle = css("--code-bg"); ctx.fillRect(0, 0, w, h);
              const lo = [73, 135], la = [18, 54], pad = 26;
              const mapX = (x) => pad + (x - lo[0]) / (lo[1] - lo[0]) * (w - 2 * pad);
              const mapY = (y) => h - pad - (y - la[0]) / (la[1] - la[0]) * (h - 2 * pad);
              ctx.strokeStyle = css("--accent-3"); ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
              ctx.beginPath(); ctx.moveTo(mapX(a[0]), mapY(a[1])); ctx.lineTo(mapX(b[0]), mapY(b[1])); ctx.stroke(); ctx.setLineDash([]);
              [[a, css("--accent"), "起"], [b, css("--accent-2"), "终"]].forEach(([p, col, t]) => {
                ctx.fillStyle = col; ctx.beginPath(); ctx.arc(mapX(p[0]), mapY(p[1]), 6, 0, 7); ctx.fill();
                ctx.fillStyle = css("--text"); ctx.font = "11px sans-serif"; ctx.textAlign = "center";
                ctx.fillText(t, mapX(p[0]), mapY(p[1]) - 10);
              });
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-preset]").onchange = (e) => {
            const p = cities[e.target.value];
            root.querySelector("[data-p1]").value = p[0].join(", ");
            root.querySelector("[data-p2]").value = p[1].join(", "); run();
          };
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "面积 / 质心",
        code:
`const poly = turf.polygon([[[...], ...]]);
turf.area(poly);              // 面积 (m²)
turf.centroid(poly);          // 质心
turf.bbox(poly);              // 包围盒 [w,s,e,n]
turf.bboxPolygon(poly);`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>多边形顶点 (lng,lat，逗号分隔，顺时针)</label>' +
            '<textarea data-poly rows="4">116.0,39.8\n117.0,39.8\n117.0,40.8\n116.0,40.8\n116.0,39.8</textarea></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算面积 / 质心</button></div>',
            { vizLabel: "多边形与质心" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          function run() {
            try {
              if (!window.turf) throw new Error("turf 未加载");
              const ring = root.querySelector("[data-poly]").value.trim().split("\n").map((r) => r.split(",").map(Number));
              const poly = turf.polygon([ring]);
              const area = turf.area(poly);
              const cen = turf.centroid(poly).geometry.coordinates;
              const bbox = turf.bbox(poly);
              out.innerHTML =
                '<span class="k">面积   </span><span class="ok">' + fmt(area / 1e6, 2) + ' km²</span>  <span class="muted">(' + fmt(area, 0) + ' m²)</span>\n' +
                '<span class="k">质心   </span><span class="v">[' + fmt(cen[0], 4) + ', ' + fmt(cen[1], 4) + ']</span>\n' +
                '<span class="k">bbox   </span><span class="v">[W ' + fmt(bbox[0], 2) + ', S ' + fmt(bbox[1], 2) + ', E ' + fmt(bbox[2], 2) + ', N ' + fmt(bbox[3], 2) + ']</span>\n' +
                '<span class="muted">顶点数：' + (ring.length - 1) + '（含闭合点）</span>';
              ctx.clearRect(0, 0, w, h); ctx.fillStyle = css("--code-bg"); ctx.fillRect(0, 0, w, h);
              const pad = 30;
              const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
              const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
              const mapX = (x) => pad + (x - xmin) / (xmax - xmin || 1) * (w - 2 * pad);
              const mapY = (y) => h - pad - (y - ymin) / (ymax - ymin || 1) * (h - 2 * pad);
              ctx.strokeStyle = css("--accent"); ctx.fillStyle = css("--accent") + "22"; ctx.lineWidth = 2;
              ctx.beginPath(); ring.forEach((p, i) => (i ? ctx.lineTo(mapX(p[0]), mapY(p[1])) : ctx.moveTo(mapX(p[0]), mapY(p[1])))); ctx.closePath(); ctx.fill(); ctx.stroke();
              ctx.fillStyle = css("--accent-3"); ctx.beginPath(); ctx.arc(mapX(cen[0]), mapY(cen[1]), 6, 0, 7); ctx.fill();
              ctx.fillStyle = css("--text"); ctx.font = "11px sans-serif"; ctx.textAlign = "center"; ctx.fillText("质心", mapX(cen[0]), mapY(cen[1]) - 10);
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "缓冲区 / 点在面内",
        code:
`const pt = turf.point([lon, lat]);
const buf = turf.buffer(pt, 200, { units: 'kilometers' });
turf.booleanPointInPolygon(pt2, poly);  // 布尔判定
turf.nearestPointOnLine(line, pt);`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>圆心 (经度,纬度)</label><input type="text" data-c value="116.40, 39.90" /></div>' +
            '<div class="field"><label>半径 (km)</label><div class="range-row"><input type="range" data-r min="50" max="800" value="300" /><span class="range-val" data-rv>300</span></div></div>' +
            '<div class="field"><label>待测点 (经度,纬度)</label><input type="text" data-p value="119.0, 41.0" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>判定点是否在缓冲区内</button></div>',
            { vizLabel: "缓冲区与待测点" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          function run() {
            try {
              if (!window.turf) throw new Error("turf 未加载");
              const cen = root.querySelector("[data-c]").value.split(",").map(Number);
              const r = +root.querySelector("[data-r]").value;
              const p = root.querySelector("[data-p]").value.split(",").map(Number);
              root.querySelector("[data-rv]").textContent = r;
              const buf = turf.buffer(turf.point(cen), r, { units: "kilometers" });
              const inside = turf.booleanPointInPolygon(turf.point(p), buf);
              const bbox = turf.bbox(buf);
              out.innerHTML =
                '<span class="k">缓冲区半径 </span><span class="ok">' + r + ' km</span>\n' +
                '<span class="k">待测点 </span><span class="v">[' + fmt(p[0], 2) + ', ' + fmt(p[1], 2) + ']</span>\n' +
                '<span class="' + (inside ? "ok" : "err") + '">点' + (inside ? "在" : "不在") + '缓冲区内 ' + (inside ? "✓" : "✗") + '</span>\n' +
                '<span class="muted">缓冲区经度范围 [' + fmt(bbox[0], 2) + ', ' + fmt(bbox[2], 2) + ']</span>';
              ctx.clearRect(0, 0, w, h); ctx.fillStyle = css("--code-bg"); ctx.fillRect(0, 0, w, h);
              const pad = 24;
              const bx = turf.bbox(buf);
              const mapX = (x) => pad + (x - bx[0]) / (bx[2] - bx[0] || 1) * (w - 2 * pad);
              const mapY = (y) => h - pad - (y - bx[1]) / (bx[3] - bx[1] || 1) * (h - 2 * pad);
              const bp = buf.geometry.coordinates[0];
              ctx.strokeStyle = css("--accent-2"); ctx.fillStyle = css("--accent-2") + "22"; ctx.lineWidth = 2;
              ctx.beginPath(); bp.forEach((pt, i) => (i ? ctx.lineTo(mapX(pt[0]), mapY(pt[1])) : ctx.moveTo(mapX(pt[0]), mapY(pt[1])))); ctx.closePath(); ctx.fill(); ctx.stroke();
              const drawPt = (pp, col, t) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(mapX(pp[0]), mapY(pp[1]), 6, 0, 7); ctx.fill(); ctx.fillStyle = css("--text"); ctx.font = "11px sans-serif"; ctx.textAlign = "center"; ctx.fillText(t, mapX(pp[0]), mapY(pp[1]) - 10); };
              drawPt(cen, css("--accent"), "圆心"); drawPt(p, inside ? css("--good") : css("--bad"), "待测");
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-r]").oninput = run;
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ---------- Three.js Math ---------- */
  DEMOS.threemath = {
    tabs: [
      {
        label: "旋转立方体",
        code:
`const q = new THREE.Quaternion();
const axis = new THREE.Vector3(0, 1, 0).normalize();
q.setFromAxisAngle(axis, angle);   // 无万向锁
cube.quaternion.multiply(q);       // 应用到网格`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>旋转速度</label><div class="range-row"><input type="range" data-sp min="0" max="100" value="40" /><span class="range-val" data-spv>0.40</span></div></div>' +
            '<div class="field"><label>四元数旋转轴</label><select data-axis><option value="y">Y 轴</option><option value="x">X 轴</option><option value="xy">X+Y 对角</option></select></div>',
            { vizLabel: "WebGL 实时渲染（Three.js Math 驱动）" });
          const holder = document.createElement("div"); viz.appendChild(holder);
          if (!window.THREE) { out.innerHTML = '<span class="err">Three.js 未加载</span>'; return; }
          const W = 430, H = 260;
          const scene = new THREE.Scene();
          const cam = new THREE.PerspectiveCamera(50, W / H, 0.1, 100); cam.position.z = 4;
          let renderer;
          try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
          catch (e) { out.innerHTML = '<span class="err">WebGL 不可用: ' + e.message + '</span>'; return; }
          renderer.setSize(W, H); renderer.setPixelRatio(window.devicePixelRatio || 1);
          holder.appendChild(renderer.domElement); renderer.domElement.style.borderRadius = "6px";
          const geo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
          const mat = new THREE.MeshStandardMaterial({ color: 0x7c8cff, metalness: 0.3, roughness: 0.4 });
          const cube = new THREE.Mesh(geo, mat); scene.add(cube);
          if (THREE.WireframeGeometry) scene.add(new THREE.LineSegments(new THREE.WireframeGeometry(geo), new THREE.LineBasicMaterial({ color: 0xff7ac6 })));
          const l1 = new THREE.DirectionalLight(0xffffff, 1); l1.position.set(3, 4, 5); scene.add(l1);
          scene.add(new THREE.AmbientLight(0x8899ff, 0.6));
          let raf, running = true;
          const q = new THREE.Quaternion(), axisVec = new THREE.Vector3();
          function frame() {
            if (!running) return;
            const sp = +root.querySelector("[data-sp]").value / 100;
            root.querySelector("[data-spv]").textContent = sp.toFixed(2);
            const ax = root.querySelector("[data-axis]").value;
            axisVec.set(ax.includes("x") ? 1 : 0, ax.includes("y") ? 1 : 0, 0).normalize();
            q.setFromAxisAngle(axisVec, sp * 0.05);
            cube.quaternion.multiply(q);
            scene.children.forEach((o) => { if (o.type === "LineSegments") o.quaternion.copy(cube.quaternion); });
            renderer.render(scene, cam);
            raf = requestAnimationFrame(frame);
          }
          frame();
          out.innerHTML = '<span class="muted">Three.js 用 <span class="code-inline">Quaternion.setFromAxisAngle</span> 驱动旋转，无万向锁问题。</span>';
          return () => { running = false; cancelAnimationFrame(raf); renderer.dispose(); geo.dispose(); mat.dispose(); };
        },
      },
      {
        label: "向量运算",
        code:
`const v1 = new THREE.Vector3(1, 2, 3);
const v2 = new THREE.Vector3(4, 0, -1);
v1.dot(v2);          // 点积
v1.cross(v2);        // 叉积
v1.angleTo(v2);      // 夹角(弧度)
v1.distanceTo(v2);   // 距离
v1.clone().normalize();`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>向量 A (x,y,z)</label><input type="text" data-a value="1, 2, 3" /></div>' +
            '<div class="field"><label>向量 B (x,y,z)</label><input type="text" data-b value="4, 0, -1" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算并绘制</button></div>',
            { vizLabel: "向量箭头示意" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          function run() {
            if (!window.THREE) { out.innerHTML = '<span class="err">Three.js 未加载</span>'; return; }
            try {
              const a = new THREE.Vector3(...root.querySelector("[data-a]").value.split(",").map(Number));
              const b = new THREE.Vector3(...root.querySelector("[data-b]").value.split(",").map(Number));
              const cross = new THREE.Vector3().crossVectors(a, b);
              const angle = a.angleTo(b) * 180 / Math.PI;
              out.innerHTML =
                '<span class="k">点积 </span><span class="v">' + a.dot(b) + '</span>  ' +
                '<span class="k">夹角 </span><span class="v">' + fmt(angle, 2) + '°</span>\n' +
                '<span class="k">叉积 </span><span class="v">(' + fmt(cross.x, 2) + ', ' + fmt(cross.y, 2) + ', ' + fmt(cross.z, 2) + ')</span>\n' +
                '<span class="k">距离 </span><span class="v">' + fmt(a.distanceTo(b), 3) + '</span>  ' +
                '<span class="k">|a| </span><span class="v">' + fmt(a.length(), 3) + '</span>';
              ctx.clearRect(0, 0, w, h); ctx.fillStyle = css("--code-bg"); ctx.fillRect(0, 0, w, h);
              const cx = w / 2, cy = h / 2, s = 22;
              arrow(ctx, cx, cy, cx + a.x * s, cy - a.y * s, css("--accent"), "A");
              arrow(ctx, cx, cy, cx + b.x * s, cy - b.y * s, css("--accent-2"), "B");
              arrow(ctx, cx, cy, cx + cross.x * s * 0.5, cy - cross.y * s * 0.5, css("--accent-3"), "A×B");
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "矩阵变换",
        code:
`const m = new THREE.Matrix4();
m.compose(position, quaternion, scale);
const p = new THREE.Vector3(x, y, z);
p.applyMatrix4(m);                  // 变换点
p.project(camera);                  // 投影到 NDC (-1~1)
new THREE.Euler().setFromQuaternion(q); // 欧拉角`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>平移 (x,y,z)</label><input type="text" data-t value="1, 0.5, 0" /></div>' +
            '<div class="field"><label>缩放 (x,y,z)</label><input type="text" data-s value="1.5, 1, 1" /></div>' +
            '<div class="field"><label>旋转角 (°)</label><input type="text" data-r value="45" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>合成并变换点</button></div>', { single: true });
          function run() {
            if (!window.THREE) { out.innerHTML = '<span class="err">Three.js 未加载</span>'; return; }
            try {
              const t = new THREE.Vector3(...root.querySelector("[data-t]").value.split(",").map(Number));
              const sc = new THREE.Vector3(...root.querySelector("[data-s]").value.split(",").map(Number));
              const ang = +root.querySelector("[data-r]").value * Math.PI / 180;
              const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang);
              const m = new THREE.Matrix4().compose(t, q, sc);
              const euler = new THREE.Euler().setFromQuaternion(q);
              const p = new THREE.Vector3(1, 1, 1).applyMatrix4(m);
              out.innerHTML =
                '<span class="k">变换后点 (1,1,1) = </span><span class="ok">(' + fmt(p.x, 3) + ', ' + fmt(p.y, 3) + ', ' + fmt(p.z, 3) + ')</span>\n' +
                '<span class="k">欧拉角 y = </span><span class="v">' + fmt(euler.y * 180 / Math.PI, 2) + '°</span>\n' +
                '<span class="k">矩阵(列主序) =</span>\n' +
                [0,1,2,3].map((r) => "  " + [0,1,2,3].map((cc) => fmt(m.elements[cc*4+r], 3).padStart(8)).join(" ")).join("\n");
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ---------- paper.js ---------- */
  DEMOS.paper = {
    tabs: [
      {
        label: "万花尺曲线",
        code:
`const path = new paper.Path();
for (let i = 0; i <= steps; i++) {
  const t = ...;
  path.add(new paper.Point(x, y));
}
path.smooth();`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>外圈半径 R</label><div class="range-row"><input type="range" data-R min="40" max="110" value="90" /><span class="range-val" data-Rv>90</span></div></div>' +
            '<div class="field"><label>内圈半径 r</label><div class="range-row"><input type="range" data-r min="10" max="80" value="42" /><span class="range-val" data-rv>42</span></div></div>' +
            '<div class="field"><label>画笔偏移 d</label><div class="range-row"><input type="range" data-d min="10" max="90" value="60" /><span class="range-val" data-dv>60</span></div></div>' +
            '<div class="btn-row"><button class="btn" data-run>绘制万花尺曲线</button></div>',
            { vizLabel: "paper.js 矢量路径" });
          if (!window.paper) { out.innerHTML = '<span class="err">paper.js 未加载</span>'; return; }
          const { c } = mkCanvas(430, 260); viz.appendChild(c);
          const scope = new paper.PaperScope(); scope.setup(c);
          function gcd(a, b) { a = Math.round(a); b = Math.round(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }
          function run() {
            scope.activate(); scope.project.clear();
            const R = +root.querySelector("[data-R]").value, r = +root.querySelector("[data-r]").value, d = +root.querySelector("[data-d]").value;
            root.querySelector("[data-Rv]").textContent = R; root.querySelector("[data-rv]").textContent = r; root.querySelector("[data-dv]").textContent = d;
            const cx = 215, cy = 130;
            const path = new scope.Path({ strokeColor: css("--accent"), strokeWidth: 1.6 });
            const steps = 1800;
            for (let i = 0; i <= steps; i++) {
              const t = (i / steps) * Math.PI * 2 * (r / gcd(R, r));
              const x = cx + (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
              const y = cy + (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
              path.add(new scope.Point(x, y));
            }
            path.smooth(); scope.view.draw();
            out.innerHTML = '<span class="muted">用 paper.js 的 <span class="code-inline">Path</span> + <span class="code-inline">Point</span> 逐点生成万花尺（Hypotrochoid）矢量曲线，共 ' + steps + ' 个采样点。</span>';
          }
          ["data-R","data-r","data-d"].forEach((k) => (root.querySelector("[" + k + "]").oninput = run));
          root.querySelector("[data-run]").onclick = run; run();
          return () => { try { scope.project.clear(); scope.view.remove(); } catch (e) {} };
        },
      },
      {
        label: "几何布尔运算",
        code:
`const c1 = new paper.Path.Circle(center1, r1);
const c2 = new paper.Path.Circle(center2, r2);
c1.unite(c2);       // 并集
c1.intersect(c2);   // 交集
c1.subtract(c2);    // 差集`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>布尔运算</label><select data-op>' +
            '<option value="unite">并集 unite</option><option value="intersect">交集 intersect</option><option value="subtract">差集 subtract</option></select></div>' +
            '<div class="field"><label>圆心距</label><div class="range-row"><input type="range" data-o min="20" max="120" value="60" /><span class="range-val" data-ov>60</span></div></div>' +
            '<div class="btn-row"><button class="btn" data-run>运算</button></div>',
            { vizLabel: "布尔结果路径" });
          if (!window.paper) { out.innerHTML = '<span class="err">paper.js 未加载</span>'; return; }
          const { c } = mkCanvas(430, 260); viz.appendChild(c);
          const scope = new paper.PaperScope(); scope.setup(c);
          function run() {
            scope.activate(); scope.project.clear();
            const off = +root.querySelector("[data-o]").value;
            root.querySelector("[data-ov]").textContent = off;
            const op = root.querySelector("[data-op]").value;
            const c1 = new scope.Path.Circle(new scope.Point(190, 130), 60);
            const c2 = new scope.Path.Circle(new scope.Point(190 + off, 130), 60);
            c1.strokeColor = css("--accent"); c1.fillColor = css("--accent") + "33"; c1.strokeWidth = 1.5;
            c2.strokeColor = css("--accent-2"); c2.fillColor = css("--accent-2") + "33"; c2.strokeWidth = 1.5;
            let res;
            try { res = op === "unite" ? c1.unite(c2) : op === "intersect" ? c1.intersect(c2) : c1.subtract(c2); }
            catch (e) { out.innerHTML = '<span class="err">该运算需要 paper.js 完整布尔支持</span>'; return; }
            res.strokeColor = css("--accent-3"); res.fillColor = css("--accent-3") + "44"; res.strokeWidth = 2;
            out.innerHTML = '<span class="muted">两个圆（半径 60，圆心距 ' + off + '）做 <span class="code-inline">' + op + '</span> 后得到的矢量路径。</span>';
          }
          root.querySelector("[data-op]").onchange = run;
          root.querySelector("[data-o]").oninput = run;
          root.querySelector("[data-run]").onclick = run; run();
          return () => { try { scope.project.clear(); scope.view.remove(); } catch (e) {} };
        },
      },
    ],
  };

  /* ---------- seedrandom ---------- */
  DEMOS.seedrandom = {
    tabs: [
      {
        label: "可复现序列",
        code:
`const rng = new Math.seedrandom('workbuddy-2026');
const seq = Array.from({ length: n }, () => rng());
// 相同种子 → 完全相同序列`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>随机种子</label><input type="text" data-seed value="workbuddy-2026" /></div>' +
            '<div class="field"><label>生成数量</label><div class="range-row"><input type="range" data-n min="8" max="40" value="20" /><span class="range-val" data-nv>20</span></div></div>' +
            '<div class="btn-row"><button class="btn" data-run>用该种子生成</button><button class="btn ghost" data-again>再次生成（应完全相同）</button></div>',
            { vizLabel: "两次生成序列对比" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          let last = null;
          function gen() {
            const seed = root.querySelector("[data-seed]").value;
            const n = +root.querySelector("[data-n]").value;
            const rng = new Math.seedrandom(seed);
            return Array.from({ length: n }, () => rng());
          }
          function draw(a, b) {
            ctx.clearRect(0, 0, w, h); ctx.fillStyle = css("--code-bg"); ctx.fillRect(0, 0, w, h);
            const pad = 20, iw = w - 2 * pad, half = (h - 3 * pad) / 2;
            [[a, css("--accent"), pad, "第一次"], [b, css("--accent-2"), pad * 2 + half, "第二次"]].forEach(([arr, col, oy, t]) => {
              if (!arr) return; const bw = iw / arr.length;
              arr.forEach((v, i) => { ctx.fillStyle = col; ctx.fillRect(pad + i * bw, oy + half - v * half, bw - 2, v * half); });
              ctx.fillStyle = css("--text-faint"); ctx.font = "11px sans-serif"; ctx.textAlign = "left"; ctx.fillText(t, pad, oy - 4);
            });
          }
          function run() {
            root.querySelector("[data-nv]").textContent = root.querySelector("[data-n]").value;
            if (!Math.seedrandom) { out.innerHTML = '<span class="err">seedrandom 未加载</span>'; return; }
            const a = gen(); last = a; draw(a, null);
            out.innerHTML = '<span class="k">序列 = </span>' + a.slice(0, 6).map((v) => fmt(v, 4)).join(", ") + ' …\n<span class="muted">点击「再次生成」验证：相同种子 → 完全相同的序列。</span>';
          }
          root.querySelector("[data-run]").onclick = run;
          root.querySelector("[data-n]").oninput = run;
          root.querySelector("[data-again]").onclick = () => {
            const b = gen(); const same = last && b.every((v, i) => v === last[i]);
            draw(last, b);
            out.innerHTML = '<span class="' + (same ? "ok" : "err") + '">两次序列' + (same ? "完全一致 ✓（可复现）" : "不一致 ✗") + '</span>\n<span class="k">序列 = </span>' + b.slice(0, 6).map((v) => fmt(v, 4)).join(", ") + ' …';
          };
          run();
        },
      },
      {
        label: "多种 PRNG 算法",
        code:
`new Math.seedrandom('seed', { algo: 'alea' });
new Math.seedrandom('seed', { algo: 'xorshift128' });
new Math.seedrandom('seed', { algo: 'tychei' });
new Math.seedrandom('seed', { algo: 'xfast' });
// 不同算法产生不同但可复现的序列`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>种子</label><input type="text" data-seed value="hello" /></div>' +
            '<div class="field"><label>每个算法取前 N 个</label><div class="range-row"><input type="range" data-n min="3" max="8" value="5" /><span class="range-val" data-nv>5</span></div></div>' +
            '<div class="btn-row"><button class="btn" data-run>对比算法</button></div>', { single: true });
          function run() {
            try {
              if (!Math.seedrandom) throw new Error("seedrandom 未加载");
              const seed = root.querySelector("[data-seed]").value;
              const n = +root.querySelector("[data-n]").value;
              root.querySelector("[data-nv]").textContent = n;
              const algos = ["alea", "xorshift128", "tychei", "xfast"];
              let html = "";
              algos.forEach((algo) => {
                let seq;
                try { const rng = new Math.seedrandom(seed, { algo }); seq = Array.from({ length: n }, () => rng()).map((v) => fmt(v, 4)); }
                catch (e) { seq = ["不支持"]; }
                html += '<span class="k">' + algo + ' = </span><span class="v">' + seq.join(", ") + '</span>\n';
              });
              out.innerHTML = html + '<span class="muted">// 同一 seed 下各算法序列固定可复现</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-n]").oninput = run;
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "正态分布采样",
        code:
`const rng = new Math.seedrandom('seed');
function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2*Math.log(u)) * Math.cos(2*Math.PI*v);
}`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>种子</label><input type="text" data-seed value="gauss-2026" /></div>' +
            '<div class="field"><label>样本数</label><div class="range-row"><input type="range" data-n min="200" max="3000" step="100" value="1500" /><span class="range-val" data-nv>1500</span></div></div>' +
            '<div class="btn-row"><button class="btn" data-run>Box-Muller 采样</button></div>',
            { vizLabel: "正态采样直方图" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          function run() {
            try {
              if (!Math.seedrandom) throw new Error("seedrandom 未加载");
              const seed = root.querySelector("[data-seed]").value;
              const n = +root.querySelector("[data-n]").value;
              root.querySelector("[data-nv]").textContent = n;
              const rng = new Math.seedrandom(seed);
              const data = [];
              for (let i = 0; i < n; i++) {
                let u = 0, v = 0; while (u === 0) u = rng(); while (v === 0) v = rng();
                data.push(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v));
              }
              const mean = data.reduce((s, x) => s + x, 0) / n;
              const sd = Math.sqrt(data.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
              const ext = [Math.min(...data), Math.max(...data)];
              const bins = d3bin(ext, 28, data);
              const maxc = Math.max(...bins.map((b) => b.length));
              out.innerHTML =
                '<span class="k">样本均值 </span><span class="ok">' + fmt(mean, 3) + '</span>  <span class="muted">(理论 0)</span>\n' +
                '<span class="k">样本标准差 </span><span class="ok">' + fmt(sd, 3) + '</span>  <span class="muted">(理论 1)</span>';
              ctx.clearRect(0, 0, w, h); ctx.fillStyle = css("--code-bg"); ctx.fillRect(0, 0, w, h);
              const pad = 24, iw = w - 2 * pad, ih = h - 2 * pad, bw = iw / bins.length;
              bins.forEach((b, i) => {
                const bh = (b.length / maxc) * ih;
                ctx.fillStyle = css("--accent"); ctx.fillRect(pad + i * bw, h - pad - bh, bw - 1, bh);
              });
              ctx.strokeStyle = css("--border"); ctx.beginPath(); ctx.moveTo(pad, h - pad); ctx.lineTo(w - pad, h - pad); ctx.stroke();
              function d3bin(e, k, d) {
                const lo = e[0], hi = e[1], ww = (hi - lo) / k || 1;
                const arr = Array.from({ length: k }, () => 0);
                d.forEach((x) => { let idx = Math.floor((x - lo) / ww); if (idx >= k) idx = k - 1; if (idx < 0) idx = 0; arr[idx]++; });
                return arr;
              }
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-n]").oninput = run;
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ---------- random-js ---------- */
  DEMOS.randomjs = {
    tabs: [
      {
        label: "骰子分布",
        code:
`const r = new Random(Random.engines.mersenneTwister128());
r.integer(1, faces);   // 掷骰
const counts = {};
for (let i=0;i<n;i++) counts[r.integer(1,faces)-1]++;`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>骰子面数</label><input type="number" data-faces value="6" /></div>' +
            '<div class="field"><label>投掷次数</label><div class="range-row"><input type="range" data-n min="60" max="6000" step="60" value="1200" /><span class="range-val" data-nv>1200</span></div></div>' +
            '<div class="btn-row"><button class="btn" data-run>投掷并统计分布</button></div>',
            { vizLabel: "点数分布直方图（应趋于均匀）" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          function run() {
            try {
              const RNS = window.Random; if (!RNS) throw new Error("random-js 未加载");
              const engine = (RNS.MersenneTwister19937 || RNS.nativeMath) ? (RNS.MersenneTwister19937 ? RNS.MersenneTwister19937.autoSeed() : RNS.nativeMath) : RNS.nativeMath;
              const RandomCls = RNS.Random || RNS;
              const r = new RandomCls(engine);
              const faces = +root.querySelector("[data-faces]").value, n = +root.querySelector("[data-n]").value;
              root.querySelector("[data-nv]").textContent = n;
              const counts = new Array(faces).fill(0);
              for (let i = 0; i < n; i++) counts[r.integer(1, faces) - 1]++;
              const maxc = Math.max(...counts), expect = n / faces;
              ctx.clearRect(0, 0, w, h); ctx.fillStyle = css("--code-bg"); ctx.fillRect(0, 0, w, h);
              const pad = 30, iw = w - 2 * pad, ih = h - 2 * pad, bw = iw / faces;
              counts.forEach((cc, i) => {
                const bh = (cc / maxc) * ih;
                ctx.fillStyle = css("--good"); ctx.fillRect(pad + i * bw + 3, h - pad - bh, bw - 6, bh);
                ctx.fillStyle = css("--text-dim"); ctx.font = "10px monospace"; ctx.textAlign = "center";
                ctx.fillText(i + 1, pad + i * bw + bw / 2, h - pad + 12);
              });
              ctx.strokeStyle = css("--accent-3"); ctx.setLineDash([5, 4]); ctx.beginPath();
              ctx.moveTo(pad, h - pad - (expect / maxc) * ih); ctx.lineTo(w - pad, h - pad - (expect / maxc) * ih); ctx.stroke(); ctx.setLineDash([]);
              out.innerHTML = '<span class="k">各点数次数 </span>[' + counts.join(", ") + ']\n' +
                '<span class="k">理论期望 </span><span class="v">' + fmt(expect, 1) + '</span> 次/点（虚线）\n' +
                '<span class="muted">random-js 基于 Mersenne Twister，输出无偏均匀分布。</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-n]").oninput = run;
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "多种生成器",
        code:
`const r = new Random(engine);
r.integer(1, 6);     // 整数
r.real(0, 1);        // 实数
r.bool();            // 布尔
r.string(10);        // 随机字符串
r.uuid();            // UUID
r.dice(6);           // 掷骰
r.shuffle([...]);    // 洗牌
r.sample(pool, k);   // 抽样`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>生成数量</label><input type="number" data-n value="8" min="1" max="20" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>生成各类随机量</button></div>', { single: true });
          function run() {
            try {
              const RNS = window.Random; if (!RNS) throw new Error("random-js 未加载");
              const engine = RNS.MersenneTwister19937 ? RNS.MersenneTwister19937.autoSeed() : RNS.nativeMath;
              const r = new (RNS.Random || RNS)(engine);
              const n = Math.max(1, Math.min(20, +root.querySelector("[data-n]").value));
              const lines = [];
              lines.push('<span class="k">integer(1,6) = </span><span class="ok">' + r.integer(1, 6) + '</span>');
              lines.push('<span class="k">real(0,1)   = </span><span class="ok">' + r.real(0, 1).toFixed(4) + '</span>');
              lines.push('<span class="k">bool()      = </span><span class="ok">' + r.bool() + '</span>');
              lines.push('<span class="k">dice(6)     = </span><span class="ok">' + r.dice(6) + '</span>');
              lines.push('<span class="k">string(10)  = </span><span class="ok">"' + r.string(10) + '"</span>');
              try { lines.push('<span class="k">uuid()      = </span><span class="ok">' + r.uuid() + '</span>'); } catch (e2) {}
              const pool = ["A", "B", "C", "D", "E", "F", "G", "H"];
              lines.push('<span class="k">shuffle     = </span><span class="ok">[' + r.shuffle(pool.slice()).join("") + ']</span>');
              lines.push('<span class="k">sample(3)   = </span><span class="ok">[' + r.sample(pool, 3).join(", ") + ']</span>');
              out.innerHTML = lines.join("\n") + '\n<span class="muted">// 共生成 ' + n + ' 组示例</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "种子可复现",
        code:
`const engine = Random.engines.mersenneTwister128(12345);
const r = new Random(engine);
const seq1 = Array.from({length:n}, () => r.integer(1,100));
// 用相同种子重建引擎 → seq2 === seq1`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>种子整数</label><input type="number" data-seed value="12345" /></div>' +
            '<div class="field"><label>序列长度</label><div class="range-row"><input type="range" data-n min="5" max="20" value="10" /><span class="range-val" data-nv>10</span></div></div>' +
            '<div class="btn-row"><button class="btn" data-run>两次生成对比</button></div>',
            { vizLabel: "两次序列对比" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          function gen(seed, n) {
            const RNS = window.Random;
            const eng = RNS.engines.mersenneTwister128(+seed);
            const r = new (RNS.Random || RNS)(eng);
            return Array.from({ length: n }, () => r.integer(1, 100));
          }
          function draw(a, b) {
            ctx.clearRect(0, 0, w, h); ctx.fillStyle = css("--code-bg"); ctx.fillRect(0, 0, w, h);
            const pad = 20, iw = w - 2 * pad, half = (h - 3 * pad) / 2;
            [[a, css("--accent"), pad, "种子引擎"], [b, css("--accent-2"), pad * 2 + half, "重建种子"]].forEach(([arr, col, oy, t]) => {
              if (!arr) return; const bw = iw / arr.length;
              arr.forEach((v, i) => { ctx.fillStyle = col; ctx.fillRect(pad + i * bw, oy + half - v / 100 * half, bw - 2, v / 100 * half); });
              ctx.fillStyle = css("--text-faint"); ctx.font = "11px sans-serif"; ctx.textAlign = "left"; ctx.fillText(t, pad, oy - 4);
            });
          }
          function run() {
            root.querySelector("[data-nv]").textContent = root.querySelector("[data-n]").value;
            try {
              const RNS = window.Random; if (!RNS || !RNS.engines) throw new Error("random-js 未加载");
              const seed = root.querySelector("[data-seed]").value, n = +root.querySelector("[data-n]").value;
              const a = gen(seed, n), b = gen(seed, n);
              const same = a.every((v, i) => v === b[i]);
              draw(a, b);
              out.innerHTML = '<span class="k">序列 = </span>' + a.join(", ") + '\n<span class="' + (same ? "ok" : "err") + '">两次完全一致 ' + (same ? "✓（可复现）" : "✗") + '</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-n]").oninput = run;
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ---------- ml.js (KMeans + KNN) ---------- */
  DEMOS.mljs = {
    tabs: [
      {
        label: "KMeans 聚类",
        code:
`const km = new ML.KMeans(data, k);
km.clusters;        // 每个点的簇标号
km.centroids;       // 质心坐标
// 可视化聚类结果`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>聚类数 k</label><div class="range-row"><input type="range" data-k min="2" max="6" value="3" /><span class="range-val" data-kv>3</span></div></div>' +
            '<div class="btn-row"><button class="btn" data-run>重新生成数据并聚类</button></div>',
            { vizLabel: "KMeans 聚类结果（★ 为质心）" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          const palette = ["#7c8cff", "#4dd6c1", "#ff7ac6", "#ffc234", "#6be585", "#ff9f6b"];
          let data = [];
          function genData(k) {
            data = [];
            for (let i = 0; i < k; i++) {
              const cx = 0.15 + Math.random() * 0.7, cy = 0.15 + Math.random() * 0.7;
              for (let j = 0; j < 40; j++) data.push([cx + (Math.random() - 0.5) * 0.22, cy + (Math.random() - 0.5) * 0.22]);
            }
          }
          function run(regen) {
            try {
              const KMeans = window.ML && (window.ML.KMeans || (window.ML.Clustering && window.ML.Clustering.KMeans));
              if (!KMeans) throw new Error("ml.js (KMeans) 未加载");
              const k = +root.querySelector("[data-k]").value;
              root.querySelector("[data-kv]").textContent = k;
              if (regen || data.length === 0) genData(k);
              const res = (typeof KMeans === "function" && KMeans.prototype && KMeans.prototype.predict) ? new KMeans(data, k) : KMeans(data, k);
              const clusters = res.clusters || res;
              const centroids = (res.centroids || []).map((cd) => cd.centroid || cd);
              ctx.clearRect(0, 0, w, h); ctx.fillStyle = css("--code-bg"); ctx.fillRect(0, 0, w, h);
              const pad = 20, mapX = (x) => pad + x * (w - 2 * pad), mapY = (y) => pad + y * (h - 2 * pad);
              data.forEach((p, i) => { ctx.fillStyle = palette[(clusters[i] || 0) % palette.length]; ctx.beginPath(); ctx.arc(mapX(p[0]), mapY(p[1]), 3.2, 0, 7); ctx.fill(); });
              centroids.forEach((cd, i) => { ctx.fillStyle = palette[i % palette.length]; ctx.font = "20px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("★", mapX(cd[0]), mapY(cd[1])); });
              out.innerHTML = '<span class="ok">聚类完成，k = ' + k + '</span>\n<span class="k">共 ' + data.length + ' 个点</span>\n<span class="muted">质心坐标：</span>\n' + centroids.map((cd, i) => '  簇' + (i + 1) + ': [' + fmt(cd[0], 3) + ', ' + fmt(cd[1], 3) + ']').join("\n");
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-k]").oninput = () => run(true);
          root.querySelector("[data-run]").onclick = () => run(true); run(true);
        },
      },
      {
        label: "KNN 分类",
        code:
`const knn = new ML.KNN(features, labels, { k: 3 });
knn.predict([x, y]);   // 预测类别
// 在网格上逐点预测 → 决策边界`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>近邻数 k</label><div class="range-row"><input type="range" data-k min="1" max="7" value="3" /><span class="range-val" data-kv>3</span></div></div>' +
            '<div class="btn-row"><button class="btn" data-run>生成两类数据并训练</button></div>',
            { vizLabel: "KNN 决策边界（● 训练点，背景为预测）" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          const palette = ["#7c8cff", "#ff7ac6"];
          let feat = [], lab = [];
          function genData() {
            feat = []; lab = [];
            const centers = [[0.3, 0.35], [0.7, 0.65]];
            centers.forEach((ct, ci) => { for (let i = 0; i < 25; i++) feat.push([ct[0] + (Math.random() - 0.5) * 0.25, ct[1] + (Math.random() - 0.5) * 0.25]); lab.push(ci); });
          }
          function run() {
            try {
              const KNN = window.ML && window.ML.KNN; if (!KNN) throw new Error("ml.js (KNN) 未加载");
              const k = +root.querySelector("[data-k]").value; root.querySelector("[data-kv]").textContent = k;
              genData();
              const knn = new KNN(feat, lab, { k });
              ctx.clearRect(0, 0, w, h); ctx.fillStyle = css("--code-bg"); ctx.fillRect(0, 0, w, h);
              const pad = 16, gw = (w - 2 * pad) / 44, gh = (h - 2 * pad) / 44, mapX = (x) => pad + x * (w - 2 * pad), mapY = (y) => pad + y * (h - 2 * pad);
              for (let i = 0; i < 44; i++) for (let j = 0; j < 44; j++) {
                const x = (i + 0.5) / 44, y = (j + 0.5) / 44;
                const cl = knn.predict([x, y]);
                ctx.fillStyle = palette[cl % 2] + "22";
                ctx.fillRect(mapX(x) - gw / 2, mapY(y) - gh / 2, gw, gh);
              }
              feat.forEach((p, idx) => { ctx.fillStyle = palette[lab[idx] % 2]; ctx.beginPath(); ctx.arc(mapX(p[0]), mapY(p[1]), 4, 0, 7); ctx.fill(); });
              out.innerHTML = '<span class="ok">KNN (k=' + k + ') 训练完成</span>\n<span class="k">两类样本各 25 个</span>\n<span class="muted">背景为该参数下的预测决策边界</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-k]").oninput = run;
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ---------- fraction.js ---------- */
  DEMOS.fraction = {
    tabs: [
      {
        label: "分数四则",
        code:
`const a = new Fraction('1/3');
const b = new Fraction('1/6');
a.add(b).toFraction();   // "1/2"
a.mul(b).toFraction();
a.valueOf();             // 小数
a.toString();            // 循环小数`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>分数 A（可写 1/3、0.25、"0.(3)" 循环小数）</label><input type="text" data-a value="1/3" /></div>' +
            '<div class="field"><label>分数 B</label><input type="text" data-b value="1/6" /></div>' +
            '<div class="field"><label>运算</label><select data-op><option value="add">A + B</option><option value="sub">A − B</option><option value="mul">A × B</option><option value="div">A ÷ B</option></select></div>' +
            '<div class="btn-row"><button class="btn" data-run>精确计算</button></div>', { single: true });
          function mk(s) {
            s = s.trim();
            if (s.includes("/")) { const pr = s.split("/").map(Number); return new Fraction(pr[0], pr[1]); }
            return new Fraction(s);
          }
          function run() {
            try {
              if (!window.Fraction) throw new Error("fraction.js 未加载");
              const a = mk(root.querySelector("[data-a]").value), b = mk(root.querySelector("[data-b]").value);
              const op = root.querySelector("[data-op]").value;
              const r = op === "add" ? a.add(b) : op === "sub" ? a.sub(b) : op === "mul" ? a.mul(b) : a.div(b);
              out.innerHTML =
                '<span class="k">精确分数 </span><span class="ok">' + r.toFraction() + '</span>\n' +
                '<span class="k">小数值   </span><span class="v">' + r.valueOf() + '</span>\n' +
                '<span class="k">循环小数 </span><span class="v">' + r.toString() + '</span>\n' +
                '<span class="muted">// 结果已自动约分为最简分数</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-op]").onchange = run;
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "小数 ↔ 分数",
        code:
`new Fraction('0.(3)').toFraction();  // 1/3 循环小数转分数
new Fraction(0.25).toFraction();     // 1/4
new Fraction(0.1).toFraction();      // 1/10
new Fraction('1.5').add('2.25');     // 分数相加`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>小数 / 循环小数</label><input type="text" data-v value="0.(3)" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>转为精确分数</button></div>', { single: true });
          function run() {
            try {
              if (!window.Fraction) throw new Error("fraction.js 未加载");
              const v = root.querySelector("[data-v]").value.trim();
              const f = new Fraction(v);
              out.innerHTML =
                '<span class="k">输入 </span><span class="ok">' + v + '</span>\n' +
                '<span class="k">精确分数 </span><span class="ok">' + f.toFraction() + '</span>\n' +
                '<span class="k">小数近似 </span><span class="v">' + f.valueOf() + '</span>\n' +
                '<span class="muted">// 0.(3) 无限循环也能精确表示为 1/3</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "进阶运算",
        code:
`const a = new Fraction(2, 3);
a.pow(-2);          // (2/3)^-2 = 9/4
a.mod(1);           // 取模
a.abs();            // 绝对值
a.inverse();        // 倒数
a.add(new Fraction(1, 2));  // 加 1/2
a.compare(new Fraction(1, 2));`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>分数 A（如 2/3）</label><input type="text" data-a value="2/3" /></div>' +
            '<div class="field"><label>指数 n（用于 pow）</label><input type="text" data-n value="-2" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算幂/取模/倒数等</button></div>', { single: true });
          function mk(s) { s = s.trim(); if (s.includes("/")) { const pr = s.split("/").map(Number); return new Fraction(pr[0], pr[1]); } return new Fraction(s); }
          function run() {
            try {
              if (!window.Fraction) throw new Error("fraction.js 未加载");
              const a = mk(root.querySelector("[data-a]").value);
              const n = +root.querySelector("[data-n]").value;
              out.innerHTML =
                '<span class="k">a = </span><span class="ok">' + a.toFraction() + '</span>\n' +
                '<span class="k">a^' + n + ' = </span><span class="ok">' + a.pow(n).toFraction() + '</span>\n' +
                '<span class="k">a mod 1 = </span><span class="ok">' + a.mod(1).toFraction() + '</span>\n' +
                '<span class="k">|a| = </span><span class="ok">' + a.abs().toFraction() + '</span>\n' +
                '<span class="k">1/a = </span><span class="ok">' + a.inverse().toFraction() + '</span>\n' +
                '<span class="k">a + 1/2 = </span><span class="v">' + a.add(new Fraction(1, 2)).toFraction() + '</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ---------- Algebrite ---------- */
  DEMOS.algebrite = {
    tabs: [
      {
        label: "化简 / 展开 / 分解",
        code:
`Algebrite.run('simplify(x^2 + 2*x + 1)');
Algebrite.run('factor(x^2 + 2*x + 1)');   // (x + 1)^2
Algebrite.run('expand((x + 1)^3)');`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>表达式</label><input type="text" data-expr value="x^2 + 2*x + 1" /></div>' +
            '<div class="field"><label>操作</label><select data-op>' +
            '<option value="simplify">化简 simplify</option><option value="factor">因式分解 factor</option><option value="expand">展开 expand</option></select></div>' +
            '<div class="btn-row"><button class="btn" data-run>符号运算</button></div>', { single: true });
          function run() {
            try {
              if (!window.Algebrite) throw new Error("Algebrite 未加载");
              const expr = root.querySelector("[data-expr]").value, op = root.querySelector("[data-op]").value;
              const res = Algebrite.run(op + "(" + expr + ")");
              out.innerHTML = '<span class="muted">' + op + '(' + expr + ')</span>\n<span class="k">= </span><span class="ok">' + res + '</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
          }
          root.querySelector("[data-op]").onchange = run;
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "求导 / 积分",
        code:
`Algebrite.run('d(x^2 + sin(x), x)');        // 2 x + cos(x)
Algebrite.run('integral(x^2 + 1, x)');      // x^3 / 3 + x`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>表达式</label><input type="text" data-expr value="x^2 + sin(x)" /></div>' +
            '<div class="field"><label>操作</label><select data-op><option value="d">求导 d/dx</option><option value="integral">不定积分 ∫dx</option></select></div>' +
            '<div class="field"><label>变量</label><input type="text" data-var value="x" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>符号运算</button></div>', { single: true });
          function run() {
            try {
              if (!window.Algebrite) throw new Error("Algebrite 未加载");
              const expr = root.querySelector("[data-expr]").value, op = root.querySelector("[data-op]").value, v = root.querySelector("[data-var]").value;
              const cmd = op === "d" ? "d(" + expr + ", " + v + ")" : "integral(" + expr + ", " + v + ")";
              const res = Algebrite.run(cmd);
              out.innerHTML = '<span class="muted">' + cmd + '</span>\n<span class="k">= </span><span class="ok">' + res + '</span>' +
                (op === "d" || op === "integral" ? '\n\n<span class="muted">// 纯符号计算，非数值近似</span>' : "");
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
          }
          root.querySelector("[data-op]").onchange = run;
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "解方程 / 代入",
        code:
`Algebrite.run('solve(2*x + 3 = 7, x)');   // 2
Algebrite.run('sub(x = 2, x^2 + 1)');     // 5
Algebrite.run('together(1/x + 1/(x+1))');`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>操作</label><select data-op>' +
            '<option value="solve">解方程 solve</option><option value="sub">代入 sub</option><option value="together">通分 together</option></select></div>' +
            '<div class="field"><label>表达式</label><input type="text" data-expr value="2*x + 3 = 7" /></div>' +
            '<div class="field"><label>变量 / 代入式</label><input type="text" data-v value="x" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>符号运算</button></div>', { single: true });
          function run() {
            try {
              if (!window.Algebrite) throw new Error("Algebrite 未加载");
              const op = root.querySelector("[data-op]").value, expr = root.querySelector("[data-expr]").value, v = root.querySelector("[data-v]").value;
              let cmd;
              if (op === "solve") cmd = "solve(" + expr + ", " + v + ")";
              else if (op === "sub") cmd = "sub(" + v + ", " + expr + ")";
              else cmd = "together(" + expr + ")";
              const res = Algebrite.run(cmd);
              out.innerHTML = '<span class="muted">' + cmd + '</span>\n<span class="k">= </span><span class="ok">' + res + '</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
          }
          root.querySelector("[data-op]").onchange = run;
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ---------- TensorFlow.js ---------- */
  DEMOS.tfjs = {
    tabs: [
      {
        label: "线性回归训练",
        code:
`const model = tf.sequential();
model.add(tf.layers.dense({ units: 1, inputShape: [1] }));
model.compile({ optimizer: tf.train.sgd(0.02), loss: 'meanSquaredError' });
await model.fit(xs, ys, { epochs });   // 浏览器内 GPU 训练
const w = model.getWeights();`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>目标函数：y = 2x − 1（含噪声），让模型自己学出来</label></div>' +
            '<div class="field"><label>训练轮数 epochs</label><div class="range-row"><input type="range" data-ep min="20" max="150" value="80" /><span class="range-val" data-epv>80</span></div></div>' +
            '<div class="btn-row"><button class="btn" data-run>开始训练</button><button class="btn ghost" data-pred>预测 x=10</button></div>',
            { vizLabel: "训练损失曲线 (loss)" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          if (!window.tf) { out.innerHTML = '<span class="err">TensorFlow.js 未加载</span>'; return; }
          let training = false;
          root.querySelector("[data-ep]").oninput = (e) => (root.querySelector("[data-epv]").textContent = e.target.value);
          async function train() {
            if (training) return; training = true;
            const epochs = +root.querySelector("[data-ep]").value;
            out.innerHTML = '<span class="muted">正在浏览器中训练（GPU/WebGL 加速）…</span>';
            const N = 40;
            const xsArr = Array.from({ length: N }, (_, i) => (i / N) * 8 - 4);
            const ysArr = xsArr.map((x) => 2 * x - 1 + (Math.random() - 0.5) * 1.2);
            const xs = tf.tensor2d(xsArr, [N, 1]), ys = tf.tensor2d(ysArr, [N, 1]);
            const model = tf.sequential();
            model.add(tf.layers.dense({ units: 1, inputShape: [1] }));
            model.compile({ optimizer: tf.train.sgd(0.02), loss: "meanSquaredError" });
            const losses = [];
            await model.fit(xs, ys, {
              epochs, callbacks: {
                onEpochEnd: (ep, logs) => {
                  losses.push(logs.loss);
                  const ymax = Math.max(...losses) * 1.1 || 1;
                  plot2D(ctx, w, h, { xmin: 0, xmax: epochs, ymin: 0, ymax }, (mx, my) => {
                    line(ctx, losses.map((l, i) => [mx(i), my(l)]), css("--accent-2"), 2.2);
                  });
                },
              },
            });
            const kk = (await (await model.getWeights())[0].data())[0], bb = (await (await model.getWeights())[1].data())[0];
            window.__tfModel = model; window.__tfData = { xs: xsArr, ys: ysArr };
            out.innerHTML = '<span class="ok">训练完成！</span>\n' +
              '<span class="k">学到的权重 w = </span><span class="v">' + fmt(kk, 3) + '</span> <span class="muted">(目标 2)</span>\n' +
              '<span class="k">学到的偏置 b = </span><span class="v">' + fmt(bb, 3) + '</span> <span class="muted">(目标 -1)</span>\n' +
              '<span class="k">最终 loss = </span><span class="v">' + fmt(losses[losses.length - 1], 5) + '</span>\n' +
              '<span class="muted">→ 切换到「预测曲线」可查看拟合效果</span>';
            xs.dispose(); ys.dispose(); training = false;
          }
          root.querySelector("[data-run]").onclick = train;
          root.querySelector("[data-pred]").onclick = async () => {
            if (!window.__tfModel) { out.innerHTML = '<span class="err">请先训练模型</span>'; return; }
            const p = window.__tfModel.predict(tf.tensor2d([10], [1, 1]));
            const val = (await p.data())[0]; p.dispose();
            out.innerHTML = '<span class="k">预测 f(10) = </span><span class="ok">' + fmt(val, 3) + '</span>  <span class="muted">(真值 2×10-1 = 19)</span>';
          };
        },
      },
      {
        label: "预测曲线",
        code:
`// 用训练好的模型在 x∈[-4,12] 上预测
const xsPred = tf.range(-4, 12, 0.5);
const ysPred = model.predict(xsPred.reshape([-1, 1]));
// 把训练散点与拟合直线画在一起`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>先到「线性回归训练」训练模型，再查看拟合曲线</label></div>' +
            '<div class="btn-row"><button class="btn" data-run>绘制拟合曲线</button></div>',
            { vizLabel: "训练散点 + 模型拟合直线" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          function run() {
            if (!window.tf || !window.__tfModel) {
              out.innerHTML = '<span class="err">尚未训练，请先切到「线性回归训练」并点击开始训练。</span>'; return;
            }
            try {
              const data = window.__tfData;
              const xsT = tf.tensor1d(data.xs);
              const ysP = window.__tfModel.predict(xsT.reshape([-1, 1]));
              Promise.all([ysP.data()]).then(([preds]) => {
                const pts = data.xs.map((x, i) => [x, data.ys[i]]);
                const xmin = -4.5, xmax = 12, ymin = -11, ymax = 23;
                plot2D(ctx, w, h, { xmin, xmax, ymin, ymax }, (mx, my) => {
                  ctx.fillStyle = css("--accent");
                  pts.forEach((p) => { ctx.beginPath(); ctx.arc(mx(p[0]), my(p[1]), 4, 0, 7); ctx.fill(); });
                  line(ctx, data.xs.map((x, i) => [mx(x), my(preds[i])]), css("--accent-3"), 2.4);
                  ctx.fillStyle = css("--accent-3"); ctx.font = "11px monospace"; ctx.textAlign = "left"; ctx.fillText("拟合线", mx(xmax) - 46, my(preds[preds.length - 1]) - 6);
                });
                out.innerHTML = '<span class="ok">拟合完成</span>\n<span class="k">蓝点 </span><span class="v">训练数据</span>  <span class="k">粉线 </span><span class="v">模型预测 y = wx + b</span>';
                xsT.dispose(); ysP.dispose();
              });
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ---------- nerdamer（符号计算 / 解方程）---------- */
  DEMOS.nerdamer = {
    tabs: [
      {
        label: "化简 / 展开 / 因式分解",
        code:
`nerdamer('expand((x+1)^3)').toString();      // 1+3*x+3*x^2+x^3
nerdamer('factor(x^2+2x+1)').toString();     // (1+x)^2
nerdamer('simplify((x^2-1)/(x-1))').toString(); // 1+x`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>表达式</label><input type="text" data-expr value="(x+1)^3" /></div>' +
            '<div class="field"><label>操作</label><select data-op>' +
            '<option value="expand">展开 expand</option><option value="factor">因式分解 factor</option><option value="simplify">化简 simplify</option></select></div>' +
            '<div class="btn-row"><button class="btn" data-run>运行</button></div>', { single: true });
          function run() {
            try {
              if (!window.nerdamer) throw new Error("nerdamer 未加载");
              const expr = root.querySelector("[data-expr]").value, op = root.querySelector("[data-op]").value;
              const res = nerdamer(op + "(" + expr + ")").toString();
              out.innerHTML = '<span class="muted">' + op + "(" + expr + ")</span>\n<span class=\"k\">= </span><span class=\"ok\">" + res + "</span>";
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
          }
          root.querySelector("[data-op]").onchange = run;
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "求导 / 积分",
        code:
`nerdamer('diff(x^3+2x, x)').toString();       // 2+3*x^2
nerdamer('integrate(x^2+1, x)').toString();   // x+x^3/3`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>表达式</label><input type="text" data-expr value="x^3+2*x" /></div>' +
            '<div class="field"><label>操作</label><select data-op><option value="diff">求导 diff</option><option value="integrate">积分 integrate</option></select></div>' +
            '<div class="field"><label>变量</label><input type="text" data-var value="x" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>运行</button></div>', { single: true });
          function run() {
            try {
              if (!window.nerdamer) throw new Error("nerdamer 未加载");
              const expr = root.querySelector("[data-expr]").value, op = root.querySelector("[data-op]").value, v = root.querySelector("[data-var]").value;
              const cmd = op + "(" + expr + ", " + v + ")";
              const res = nerdamer(cmd).toString();
              out.innerHTML = '<span class="muted">' + cmd + "</span>\n<span class=\"k\">= </span><span class=\"ok\">" + res + "</span>";
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
          }
          root.querySelector("[data-op]").onchange = run;
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "解方程 solve ⭐",
        code:
`// 一元方程（含多解）
nerdamer.solve('x^2-5*x+6=0', 'x').toString();   // [2,3]

// 多元方程组
nerdamer.solveEquations(['x+y=10', 'x-y=2']);    // x=6, y=4`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>模式</label><select data-mode>' +
            '<option value="one">一元方程 solve</option><option value="sys">方程组 solveEquations</option></select></div>' +
            '<div class="field" data-one><label>方程</label><input type="text" data-eq value="x^2-5*x+6=0" />' +
            '<label style="margin-top:8px">变量</label><input type="text" data-v value="x" /></div>' +
            '<div class="field" data-sys style="display:none"><label>方程组（每行一个）</label><textarea data-eqs rows="3">x+y=10\nx-y=2</textarea></div>' +
            '<div class="btn-row"><button class="btn" data-run>求解</button></div>', { single: true });
          function toggle() {
            const sys = root.querySelector("[data-mode]").value === "sys";
            root.querySelector("[data-one]").style.display = sys ? "none" : "";
            root.querySelector("[data-sys]").style.display = sys ? "" : "none";
          }
          function run() {
            try {
              if (!window.nerdamer) throw new Error("nerdamer 未加载");
              const mode = root.querySelector("[data-mode]").value;
              if (mode === "one") {
                const eq = root.querySelector("[data-eq]").value, v = root.querySelector("[data-v]").value;
                const sol = nerdamer.solve(eq, v).toString();
                out.innerHTML = '<span class="muted">solve(' + eq + ", " + v + ")</span>\n<span class=\"k\">" + v + " ∈ </span><span class=\"ok\">" + sol + "</span>";
              } else {
                const eqs = root.querySelector("[data-eqs]").value.split("\n").map((s) => s.trim()).filter(Boolean);
                const flat = nerdamer.solveEquations(eqs);
                // 返回形如 [[ 'x',6 ],[ 'y',4 ]] 或扁平 [x,6,y,4]
                let pairs = [];
                if (Array.isArray(flat) && Array.isArray(flat[0])) pairs = flat.map((p) => p[0] + " = " + p[1]);
                else { const a = flat.toString().split(","); for (let i = 0; i < a.length; i += 2) pairs.push(a[i] + " = " + a[i + 1]); }
                out.innerHTML = '<span class="muted">solveEquations:</span>\n' + eqs.map((e) => "  " + e).join("\n") + '\n\n<span class="k">解：</span><span class="ok">' + pairs.join("，  ") + "</span>";
              }
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
          }
          root.querySelector("[data-mode]").onchange = () => { toggle(); run(); };
          root.querySelector("[data-run]").onclick = run; toggle(); run();
        },
      },
      {
        label: "系数提取 / 级数",
        code:
`// 提取多项式（生成函数）各项系数
nerdamer('coeffs((x+1)^5, x)').toString();  // [1,5,10,10,5,1]

// 几何级数 = 1/(1-x) 的截断（全 1 序列的生成函数）
nerdamer('sum(x^k, k, 0, 5)').toString();   // 1+x+x^2+x^3+x^4+x^5`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>操作</label><select data-op>' +
            '<option value="coeffs">提取系数 coeffs</option><option value="sum">几何级数 sum</option></select></div>' +
            '<div class="field" data-c><label>多项式（生成函数）</label><input type="text" data-poly value="(x+1)^5" /></div>' +
            '<div class="field" data-s style="display:none"><label>级数项数 n</label><div class="range-row"><input type="range" data-n min="3" max="10" value="6" /><span class="range-val" data-nv>6</span></div></div>' +
            '<div class="btn-row"><button class="btn" data-run>运行</button></div>',
            { vizLabel: "系数柱状图" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          root.querySelector("[data-n]").oninput = (e) => (root.querySelector("[data-nv]").textContent = e.target.value);
          function toggle() {
            const sum = root.querySelector("[data-op]").value === "sum";
            root.querySelector("[data-c]").style.display = sum ? "none" : "";
            root.querySelector("[data-s]").style.display = sum ? "" : "none";
          }
          function run() {
            try {
              if (!window.nerdamer) throw new Error("nerdamer 未加载");
              const op = root.querySelector("[data-op]").value;
              if (op === "coeffs") {
                const poly = root.querySelector("[data-poly]").value;
                const str = nerdamer("coeffs(" + poly + ", x)").toString();
                const arr = str.replace(/[\[\]]/g, "").split(",").map((s) => Number(s.trim()));
                out.innerHTML = '<span class="muted">coeffs(' + poly + ", x)</span>\n<span class=\"k\">系数 [x⁰,x¹,…] = </span><span class=\"ok\">[" + arr.join(", ") + "]</span>\n<span class=\"muted\">// 即生成函数各项系数</span>";
                bars(ctx, w, h, arr.map((_, i) => "x" + i), arr, { title: "各项系数", color: css("--accent") });
              } else {
                const n = +root.querySelector("[data-n]").value;
                const str = nerdamer("sum(x^k, k, 0, " + n + ")").toString();
                const arr = new Array(n + 1).fill(1);
                out.innerHTML = '<span class="muted">sum(x^k, k, 0, ' + n + ")</span>\n<span class=\"ok\">" + str + "</span>\n\n<span class=\"muted\">// 全 1 序列的生成函数 = 1/(1-x) 的前 " + (n + 1) + " 项</span>";
                bars(ctx, w, h, arr.map((_, i) => "x" + i), arr, { title: "系数（全为 1）", color: css("--accent-2") });
              }
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
          }
          root.querySelector("[data-op]").onchange = () => { toggle(); run(); };
          root.querySelector("[data-run]").onclick = run; toggle(); run();
        },
      },
    ],
  };

  /* ---------- Polynomial.js（rawify · 生成函数系数运算）---------- */
  DEMOS.polynomialrw = (function () {
    function coeffArr(poly, upto) {
      const co = poly.coeff || {}; const a = [];
      for (let i = 0; i <= upto; i++) a.push(Number(co[i] || 0));
      return a;
    }
    return {
      tabs: [
        {
          label: "系数卷积（多项式乘法）",
          code:
`// 多项式乘法 = 两个系数序列的「卷积」
const A = new Polynomial('1 + 2x + 3x^2');  // 系数 [1,2,3]
const B = new Polynomial('1 + x');          // 系数 [1,1]
const C = A.mul(B);                         // (1+2x+3x^2)(1+x)
C.toString();          // 1+3x+5x^2+3x^3
C.coeff;               // {0:1,1:3,2:5,3:3}  ← 卷积结果`,
          mount(root) {
            const { out, viz } = skeleton(root,
              '<div class="field"><label>多项式 A</label><input type="text" data-a value="1 + 2x + 3x^2" /></div>' +
              '<div class="field"><label>多项式 B</label><input type="text" data-b value="1 + x" /></div>' +
              '<div class="btn-row"><button class="btn" data-run>相乘（卷积）</button></div>',
              { vizLabel: "乘积系数（卷积结果）" });
            const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
            function run() {
              try {
                if (!window.Polynomial) throw new Error("Polynomial.js 未加载");
                Polynomial.setField && Polynomial.setField("R");
                const A = new Polynomial(root.querySelector("[data-a]").value);
                const B = new Polynomial(root.querySelector("[data-b]").value);
                const C = A.mul(B);
                const deg = (C.degree ? C.degree() : Object.keys(C.coeff).reduce((m, k) => Math.max(m, +k), 0));
                const arr = coeffArr(C, deg);
                out.innerHTML =
                  '<span class="k">A = </span><span class="v">' + A.toString() + '</span>\n' +
                  '<span class="k">B = </span><span class="v">' + B.toString() + '</span>\n' +
                  '<span class="k">A·B = </span><span class="ok">' + C.toString() + '</span>\n' +
                  '<span class="k">系数（卷积）= </span><span class="v">[' + arr.join(", ") + ']</span>';
                bars(ctx, w, h, arr.map((_, i) => "x" + i), arr, { title: "A·B 各次项系数", color: css("--accent") });
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          },
        },
        {
          label: "幂级数 / 二项式系数",
          code:
`// (1+x)^n 的系数 = 帕斯卡三角第 n 行（二项式系数）
const base = new Polynomial('1 + x');
const P = base.pow(6);           // (1+x)^6
P.toString();  // 1+6x+15x^2+20x^3+15x^4+6x^5+x^6
P.coeff;       // {0:1,1:6,2:15,3:20,4:15,5:6,6:1}`,
          mount(root) {
            const { out, viz } = skeleton(root,
              '<div class="field"><label>基多项式</label><input type="text" data-base value="1 + x" /></div>' +
              '<div class="field"><label>幂次 n</label><div class="range-row"><input type="range" data-n min="1" max="10" value="6" /><span class="range-val" data-nv>6</span></div></div>' +
              '<div class="btn-row"><button class="btn" data-run>展开</button></div>',
              { vizLabel: "各次项系数（帕斯卡行）" });
            const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
            root.querySelector("[data-n]").oninput = (e) => (root.querySelector("[data-nv]").textContent = e.target.value);
            function run() {
              try {
                if (!window.Polynomial) throw new Error("Polynomial.js 未加载");
                Polynomial.setField && Polynomial.setField("R");
                const n = +root.querySelector("[data-n]").value;
                const base = new Polynomial(root.querySelector("[data-base]").value);
                const P = base.pow(n);
                const deg = (P.degree ? P.degree() : Object.keys(P.coeff).reduce((m, k) => Math.max(m, +k), 0));
                const arr = coeffArr(P, deg);
                out.innerHTML =
                  '<span class="k">(' + base.toString() + ')^' + n + ' =</span>\n<span class="ok">' + P.toString() + '</span>\n\n' +
                  '<span class="k">系数 = </span><span class="v">[' + arr.join(", ") + ']</span>';
                bars(ctx, w, h, arr.map((_, i) => "x" + i), arr, { title: "系数（帕斯卡第 " + n + " 行）", color: css("--accent-3") });
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          },
        },
        {
          label: "分数域系数 + 求导 / 求值",
          code:
`// 切到有理数域 Q，系数以精确分数表示
Polynomial.setField('Q');
const P = new Polynomial('1/2 x^2 + 1/3 x + 1');
P.derive().toString();   // 求导
P.result(3);             // 在 x=3 处求值（分数）
Polynomial.setField('R');`,
          mount(root) {
            const { out } = skeleton(root,
              '<div class="field"><label>多项式（可含分数系数）</label><input type="text" data-p value="1/2 x^2 + 1/3 x + 1" /></div>' +
              '<div class="field"><label>求值点 x =</label><input type="text" data-x value="3" /></div>' +
              '<div class="btn-row"><button class="btn" data-run>运行（Q 域）</button></div>', { single: true });
            function fracOf(v) { return v && v.toFraction ? v.toFraction() : String(v); }
            function run() {
              try {
                if (!window.Polynomial) throw new Error("Polynomial.js 未加载");
                if (!window.Fraction) throw new Error("需要 Fraction.js（有理数域依赖）");
                Polynomial.setField("Q");
                const P = new Polynomial(root.querySelector("[data-p]").value);
                const D = P.derive();
                const xv = root.querySelector("[data-x]").value;
                const val = P.result(new Fraction(xv));
                out.innerHTML =
                  '<span class="k">P(x)  = </span><span class="v">' + P.toString() + '</span>\n' +
                  '<span class="k">P\'(x) = </span><span class="v">' + D.toString() + '</span>\n' +
                  '<span class="k">P(' + xv + ') = </span><span class="ok">' + fracOf(val) + '</span>  <span class="muted">(精确有理数)</span>';
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
              finally { try { Polynomial.setField("R"); } catch (e) {} }
            }
            root.querySelector("[data-run]").onclick = run; run();
          },
        },
        {
          label: "组合计数：硬币找零（生成函数）",
          code:
`// 用生成函数数「凑出金额」的方案数
// 每种面额 c 贡献因子 (1 + x^c + x^2c + ...)
// 各因子相乘后，x^N 的系数 = 凑出 N 的方案数
let G = new Polynomial('1');
for (const c of [1, 2, 5]) {
  let f = '1';
  for (let k = c; k <= N; k += c) f += ' + x^' + k;
  G = G.mul(new Polynomial(f));
}
G.coeff[N];   // = 凑出金额 N 的方案数`,
          mount(root) {
            const { out, viz } = skeleton(root,
              '<div class="field"><label>硬币面额（逗号分隔）</label><input type="text" data-coins value="1, 2, 5" /></div>' +
              '<div class="field"><label>目标金额 N</label><div class="range-row"><input type="range" data-n min="5" max="30" value="10" /><span class="range-val" data-nv>10</span></div></div>' +
              '<div class="btn-row"><button class="btn" data-run>用生成函数求方案数</button></div>',
              { vizLabel: "凑出 0…N 的方案数" });
            const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
            root.querySelector("[data-n]").oninput = (e) => (root.querySelector("[data-nv]").textContent = e.target.value);
            function run() {
              try {
                if (!window.Polynomial) throw new Error("Polynomial.js 未加载");
                Polynomial.setField && Polynomial.setField("R");
                const coins = root.querySelector("[data-coins]").value.split(",").map((s) => parseInt(s.trim(), 10)).filter((x) => x > 0);
                const N = +root.querySelector("[data-n]").value;
                let G = new Polynomial("1");
                for (const cc of coins) {
                  let f = "1";
                  for (let k = cc; k <= N; k += cc) f += " + " + (k === 1 ? "x" : "x^" + k);
                  G = G.mul(new Polynomial(f));
                }
                const arr = coeffArr(G, N);
                out.innerHTML =
                  '<span class="k">面额 = </span><span class="v">{' + coins.join(", ") + '}</span>\n' +
                  '<span class="k">凑出 N=' + N + ' 的方案数 = </span><span class="ok">' + arr[N] + '</span>\n\n' +
                  '<span class="muted">// 方案数 = 生成函数中 x^' + N + ' 的系数</span>';
                bars(ctx, w, h, arr.map((_, i) => i), arr, { title: "凑出金额 0…" + N + " 的方案数", color: css("--accent-2") });
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          },
        },
      ],
    };
  })();

  /* ---------- polynomium（多元 / 多变量生成函数）---------- */
  DEMOS.polynomium = (function () {
    function powP(pm, p, n) { let r = pm.constant(1); for (let i = 0; i < n; i++) r = pm.mul(r, p); return r; }
    return {
      tabs: [
        {
          label: "双变量生成函数 (x+y)^n",
          code:
`const pm = polynomium;
const x = pm.variable('x'), y = pm.variable('y');
let p = pm.add(x, y);            // x + y
let P = p;
for (let i = 1; i < n; i++) P = pm.mul(P, p);  // (x+y)^n
pm.toString(P);   // 展开为多项式（多项系数 = 二项式系数）`,
          mount(root) {
            const { out } = skeleton(root,
              '<div class="field"><label>幂次 n</label><div class="range-row"><input type="range" data-n min="1" max="6" value="3" /><span class="range-val" data-nv>3</span></div></div>' +
              '<div class="btn-row"><button class="btn" data-run>展开 (x+y)^n</button></div>', { single: true });
            root.querySelector("[data-n]").oninput = (e) => (root.querySelector("[data-nv]").textContent = e.target.value);
            function run() {
              try {
                if (!window.polynomium) throw new Error("polynomium 未加载");
                const pm = polynomium, n = +root.querySelector("[data-n]").value;
                const p = pm.add(pm.variable("x"), pm.variable("y"));
                const P = powP(pm, p, n);
                out.innerHTML =
                  '<span class="k">(x + y)^' + n + ' =</span>\n<span class="ok">' + pm.toString(P) + '</span>\n\n' +
                  '<span class="muted">// 各项系数即二项式系数 C(' + n + ', k)</span>';
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          },
        },
        {
          label: "三维计数 (x+y+z)^n",
          code:
`const pm = polynomium;
const x = pm.variable('x'), y = pm.variable('y'), z = pm.variable('z');
let base = pm.add(pm.add(x, y), z);   // x + y + z
let P = base;
for (let i = 1; i < n; i++) P = pm.mul(P, base);  // (x+y+z)^n
// 展开项数 = C(n+2, 2)（三维计数 / 多项式定理）`,
          mount(root) {
            const { out } = skeleton(root,
              '<div class="field"><label>幂次 n</label><div class="range-row"><input type="range" data-n min="1" max="4" value="2" /><span class="range-val" data-nv>2</span></div></div>' +
              '<div class="btn-row"><button class="btn" data-run>展开 (x+y+z)^n</button></div>', { single: true });
            root.querySelector("[data-n]").oninput = (e) => (root.querySelector("[data-nv]").textContent = e.target.value);
            function run() {
              try {
                if (!window.polynomium) throw new Error("polynomium 未加载");
                const pm = polynomium, n = +root.querySelector("[data-n]").value;
                const base = pm.add(pm.add(pm.variable("x"), pm.variable("y")), pm.variable("z"));
                const P = powP(pm, base, n);
                const str = pm.toString(P);
                const terms = str.split("+").length;
                out.innerHTML =
                  '<span class="k">(x + y + z)^' + n + ' =</span>\n<span class="ok">' + str + '</span>\n\n' +
                  '<span class="k">展开项数 = </span><span class="v">' + terms + '</span>  <span class="muted">(= C(' + (n + 2) + ", 2) = " + ((n + 2) * (n + 1) / 2) + ")</span>";
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          },
        },
        {
          label: "多点求值 / 代入",
          code:
`const pm = polynomium;
const x = pm.variable('x'), y = pm.variable('y');
const P = pm.mul(pm.add(x, y), pm.add(x, y));  // (x+y)^2
pm.evaluate(P, { x: 2, y: 3 });   // = 25`,
          mount(root) {
            const { out } = skeleton(root,
              '<div class="field"><label>x =</label><input type="text" data-x value="2" /></div>' +
              '<div class="field"><label>y =</label><input type="text" data-y value="3" /></div>' +
              '<div class="btn-row"><button class="btn" data-run>代入 (x+y)^2 求值</button></div>', { single: true });
            function run() {
              try {
                if (!window.polynomium) throw new Error("polynomium 未加载");
                const pm = polynomium;
                const base = pm.add(pm.variable("x"), pm.variable("y"));
                const P = pm.mul(base, base);
                const xv = Number(root.querySelector("[data-x]").value), yv = Number(root.querySelector("[data-y]").value);
                const val = pm.evaluate(P, { x: xv, y: yv });
                out.innerHTML =
                  '<span class="k">P(x,y) = </span><span class="v">' + pm.toString(P) + '</span>\n' +
                  '<span class="k">代入 x=' + xv + ", y=" + yv + " → </span><span class=\"ok\">" + val + "</span>\n" +
                  '<span class="muted">// 校验：(x+y)^2 = (' + xv + "+" + yv + ")^2 = " + Math.pow(xv + yv, 2) + "</span>";
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          },
        },
      ],
    };
  })();

  /* ---------- jisg（OEIS 标准整数序列）---------- */
  DEMOS.jisg = (function () {
    const SEQS = [
      { id: "A000045", name: "斐波那契 Fibonacci" },
      { id: "A000108", name: "卡特兰 Catalan" },
      { id: "A000041", name: "整数分拆 Partitions" },
      { id: "A000079", name: "2 的幂 2^n" },
      { id: "A000142", name: "阶乘 Factorial" },
      { id: "A000217", name: "三角形数 Triangular" },
      { id: "A000040", name: "素数 Primes" },
      { id: "A000032", name: "卢卡斯 Lucas" },
      { id: "A000027", name: "自然数 Naturals" },
    ];
    function take(id, n) {
      const gen = window.jisg && window.jisg[id];
      if (typeof gen !== "function") throw new Error("序列 " + id + " 不可用");
      const it = gen(), out = [];
      for (let i = 0; i < n; i++) out.push(it.next().value);
      return out;
    }
    const opts = SEQS.map((s) => '<option value="' + s.id + '">' + s.id + " · " + s.name + "</option>").join("");
    return {
      tabs: [
        {
          label: "OEIS 序列生成",
          code:
`// jisg 内置 300+ 条 OEIS 序列，返回惰性生成器
const gen = jisg.A000108();      // 卡特兰数
const first = [];
for (let i = 0; i < 8; i++) first.push(gen.next().value);
// first = [1n,1n,2n,5n,14n,42n,132n,429n]（BigInt 精确）`,
          mount(root) {
            const { out, viz } = skeleton(root,
              '<div class="field"><label>序列</label><select data-seq>' + opts + "</select></div>" +
              '<div class="field"><label>项数 N</label><div class="range-row"><input type="range" data-n min="6" max="16" value="10" /><span class="range-val" data-nv>10</span></div></div>' +
              '<div class="btn-row"><button class="btn" data-run>生成</button></div>',
              { vizLabel: "序列前 N 项" });
            const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
            root.querySelector("[data-n]").oninput = (e) => (root.querySelector("[data-nv]").textContent = e.target.value);
            function run() {
              try {
                if (!window.jisg) throw new Error("jisg 未加载");
                const id = root.querySelector("[data-seq]").value, n = +root.querySelector("[data-n]").value;
                const arr = take(id, n);
                out.innerHTML =
                  '<span class="k">' + id + ' 前 ' + n + ' 项：</span>\n<span class="ok">' + arr.map(String).join(", ") + "</span>";
                bars(ctx, w, h, arr.map((_, i) => i), arr, { title: id + " 前 " + n + " 项", color: css("--accent"), valFmt: (v) => String(v).length > 6 ? "" : String(v) });
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-seq]").onchange = run;
            root.querySelector("[data-run]").onclick = run; run();
          },
        },
        {
          label: "验证数列（对照标准序列）",
          code:
`// 把自己算出的数列与 OEIS 标准序列逐项对照
const mine = [1, 1, 2, 5, 14, 42, 132];
const gen = jisg.A000108();
let ok = true, at = -1;
for (let i = 0; i < mine.length; i++) {
  if (BigInt(mine[i]) !== gen.next().value) { ok = false; at = i; break; }
}
// ok=true 表示与卡特兰数完全一致`,
          mount(root) {
            const { out } = skeleton(root,
              '<div class="field"><label>你的数列（逗号分隔）</label><input type="text" data-mine value="1, 1, 2, 5, 14, 42, 132" /></div>' +
              '<div class="field"><label>对照序列</label><select data-seq>' + opts + "</select></div>" +
              '<div class="btn-row"><button class="btn" data-run>验证</button></div>', { single: true });
            function run() {
              try {
                if (!window.jisg) throw new Error("jisg 未加载");
                const mine = root.querySelector("[data-mine]").value.split(",").map((s) => s.trim()).filter(Boolean);
                const id = root.querySelector("[data-seq]").value;
                const std = take(id, mine.length);
                let ok = true, at = -1;
                for (let i = 0; i < mine.length; i++) {
                  if (BigInt(mine[i]) !== std[i]) { ok = false; at = i; break; }
                }
                if (ok) {
                  out.innerHTML = '<span class="ok">✓ 完全匹配</span>\n<span class="muted">你的数列与 ' + id + ' 前 ' + mine.length + ' 项一致。</span>\n<span class="k">标准：</span><span class="v">' + std.map(String).join(", ") + "</span>";
                } else {
                  out.innerHTML = '<span class="err">✗ 第 ' + (at + 1) + ' 项不符</span>\n<span class="k">你的：</span><span class="v">' + mine[at] + '</span>\n<span class="k">标准 ' + id + '：</span><span class="ok">' + std[at] + "</span>";
                }
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-seq]").onchange = run;
            root.querySelector("[data-run]").onclick = run; run();
          },
        },
        {
          label: "与多项式库对照（帕斯卡行）",
          code:
`// 交叉验证：(1+x)^n 的系数(Polynomial.js) 应等于
// 帕斯卡三角第 n 行(jisg A007318 按行展平)
const P = new Polynomial('1 + x').pow(n);   // 系数即第 n 行
const gen = jisg.A007318();                 // 1 |1,1 |1,2,1 |…
const start = n * (n + 1) / 2;              // 第 n 行起点
// 取 n+1 个元素与 P 的系数逐项比较`,
          mount(root) {
            const { out, viz } = skeleton(root,
              '<div class="field"><label>行号 n</label><div class="range-row"><input type="range" data-n min="1" max="9" value="5" /><span class="range-val" data-nv>5</span></div></div>' +
              '<div class="btn-row"><button class="btn" data-run>交叉验证</button></div>',
              { vizLabel: "第 n 行二项式系数" });
            const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
            root.querySelector("[data-n]").oninput = (e) => (root.querySelector("[data-nv]").textContent = e.target.value);
            function run() {
              try {
                if (!window.jisg) throw new Error("jisg 未加载");
                if (!window.Polynomial) throw new Error("Polynomial.js 未加载");
                if (typeof window.jisg.A007318 !== "function") throw new Error("A007318 不可用");
                const n = +root.querySelector("[data-n]").value;
                Polynomial.setField && Polynomial.setField("R");
                const P = new Polynomial("1 + x").pow(n);
                const co = P.coeff || {}; const polyRow = [];
                for (let i = 0; i <= n; i++) polyRow.push(Number(co[i] || 0));
                const it = window.jisg.A007318(); const flat = [];
                const need = (n + 1) * (n + 2) / 2;
                for (let i = 0; i < need; i++) flat.push(Number(it.next().value));
                const start = n * (n + 1) / 2;
                const jisgRow = flat.slice(start, start + n + 1);
                const same = polyRow.length === jisgRow.length && polyRow.every((v, i) => v === jisgRow[i]);
                out.innerHTML =
                  '<span class="k">(1+x)^' + n + ' 系数 (Polynomial.js)：</span>\n<span class="v">[' + polyRow.join(", ") + ']</span>\n' +
                  '<span class="k">A007318 第 ' + n + ' 行 (jisg)：</span>\n<span class="v">[' + jisgRow.join(", ") + ']</span>\n\n' +
                  (same ? '<span class="ok">✓ 两库结果完全一致</span>' : '<span class="err">✗ 结果不一致</span>');
                bars(ctx, w, h, polyRow.map((_, i) => "C" + i), polyRow, { title: "帕斯卡第 " + n + " 行", color: css("--accent-3") });
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          },
        },
      ],
    };
  })();

  window.DEMOS = DEMOS;
  // 暴露通用助手，供 demos-extra.js 复用
  window.__demo = { css, mkCanvas, fmt, fmtArr, plot2D, line, arrow, heat, bars, skeleton, has, onCleanup };
})();