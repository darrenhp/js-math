/* ============================================================
 * demos-extra.js — 新增库的多能力交互式 Demo（由 index.html 在 demos.js 之后加载）
 * 复用 demos.js 暴露的 window.__demo 助手；UMD 库直接用全局，
 * 其余库通过 esm.sh 动态 import 懒加载（loadESM），并赋给 window[global] 以便徽标检测。
 * ========================================================== */
(function () {
  "use strict";
  const D = window.__demo || {};
  const { css, mkCanvas, plot2D, line, arrow, bars, skeleton, has } = D;

  // esm.sh 懒加载助手（带缓存）
  const _esm = {};
  function loadESM(name, url) {
    if (window[name]) return Promise.resolve(window[name]);
    if (_esm[url]) return _esm[url];
    const p = import(/* @vite-ignore */ url).then((mod) => {
      const exp = mod.default || mod;
      window[name] = exp;
      return exp;
    });
    _esm[url] = p;
    return p;
  }
  // 取默认导出（兼容 UMD 包装）
  const def = (m) => (m && m.default) ? m.default : m;

  // Pyodide 懒加载（SymPy demo 用）
  let _py = null;
  function loadPyodideOnce() {
    if (_py) return _py;
    _py = new Promise((resolve, reject) => {
      if (window.loadPyodide) { window.loadPyodide().then(resolve).catch(reject); return; }
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";
      s.onload = () => window.loadPyodide().then(resolve).catch(reject);
      s.onerror = () => reject(new Error("Pyodide 脚本加载失败"));
      document.head.appendChild(s);
    });
    return _py;
  }

  const DEMOS = window.DEMOS;

  /* ===================== 通用：expr-eval ===================== */
  DEMOS.expreval = {
    tabs: [
      {
        label: "表达式求值",
        code:
`const parser = new exprEval.Parser();
parser.evaluate('2 + 3 * 4');            // 14
parser.evaluate('sqrt(2^2 + 2^2)');      // 2.828...`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>表达式</label><input type="text" data-e value="2 + 3 * 4 + sqrt(16) - 1/3" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算</button></div>', { single: true });
          function run() {
            try {
              const r = new exprEval.Parser().evaluate(root.querySelector("[data-e]").value);
              out.innerHTML = '<span class="ok">' + r + '</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "变量与自定义函数",
        code:
`const parser = new exprEval.Parser();
const expr = parser.parse('x^2 + 1');
expr.evaluate({ x: 3 });                 // 10

// 注册自定义函数
parser.functions.double = (n) => n * 2;
parser.evaluate('double(21)');          // 42`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>含变量表达式</label><input type="text" data-e value="x^2 + 1" /></div>' +
            '<div class="field"><label>x 值</label><input type="number" data-x value="3" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>代入求值</button></div>', { single: true });
          function run() {
            try {
              const parser = new exprEval.Parser();
              const r = parser.parse(root.querySelector("[data-e]").value)
                .evaluate({ x: parseFloat(root.querySelector("[data-x]").value) });
              out.innerHTML = '<span class="muted">' + root.querySelector("[data-e]").value + ' 在 x=' +
                root.querySelector("[data-x]").value + ' 时 = </span><span class="ok">' + r + '</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ===================== 符号：algebra.js ===================== */
  DEMOS.algebra = {
    tabs: [
      {
        label: "解一元一次方程",
        code:
`import algebra from 'algebra.js';
const x = new algebra.Expression('x');
const eq = new algebra.Equation(x.add(2), 5);
eq.solveFor('x');   // Fraction 3/1 -> 3`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>方程（形如 x + 2 = 5）</label><input type="text" data-e value="2*x + 3 = 11" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>求解</button></div>',
            { single: true });
          out.innerHTML = '<span class="muted">加载 algebra.js…</span>';
          loadESM("algebra", "https://esm.sh/algebra.js@0.2.6").then((algebra) => {
            function run() {
              try {
                const [lhs, rhs] = root.querySelector("[data-e]").value.split("=");
                if (!rhs) throw new Error("请用 = 分隔左右两边");
                const x = new algebra.Expression("x");
                const eq = new algebra.Equation(new algebra.Expression(lhs), rhs);
                const sol = eq.solveFor("x");
                out.innerHTML = '<span class="muted">x = </span><span class="ok">' +
                  (sol && sol.toString ? sol.toString() : sol) + "</span>";
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
    ],
  };

  /* ===================== 符号：mathsteps ===================== */
  DEMOS.mathsteps = {
    tabs: [
      {
        label: "分步化简",
        code:
`import mathsteps from 'mathsteps';
const steps = mathsteps.simplifyExpression('2x + 3x');
steps.forEach(s => console.log(s.changeType, '=>', s.after));`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>代数表达式</label><input type="text" data-e value="2x + 3x + 4 - 1" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>分步化简</button></div>', { single: true });
          out.innerHTML = '<span class="muted">加载 mathsteps…</span>';
          loadESM("mathsteps", "https://esm.sh/mathsteps@0.2.0").then((ms) => {
            const simplify = ms.simplifyExpression || (ms.default && ms.default.simplifyExpression);
            function run() {
              try {
                const steps = simplify(root.querySelector("[data-e]").value);
                out.innerHTML = steps.map((s, i) =>
                  '<div class="step"><span class="step-n">' + (i + 1) + '</span>' +
                  '<span class="step-ct">' + (s.changeType || "") + '</span>' +
                  '<span class="step-after">' + (s.after != null ? s.after : "") + "</span></div>"
                ).join("");
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
    ],
  };

  /* ===================== 符号：MathJax ===================== */
  DEMOS.mathjax = {
    tabs: [
      {
        label: "LaTeX 渲染",
        code:
`// 把 LaTeX 放入容器后调用：
await MathJax.typesetPromise([element]);
// 元素内容例如：$$ x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a} $$`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>LaTeX 公式</label>' +
            '<textarea data-tex rows="3" style="width:100%;font-family:monospace">x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}</textarea></div>' +
            '<div class="btn-row"><button class="btn" data-run>渲染</button></div>', { single: true });
          const box = document.createElement("div"); box.className = "mj-box"; out.appendChild(box);
          function ready() { return (window.MathJax && MathJax.startup && MathJax.startup.promise) || Promise.reject(new Error("MathJax 尚未就绪")); }
          function run() {
            const tex = root.querySelector("[data-tex]").value.trim();
            box.innerHTML = "$$" + tex + "$$";
            ready().then(() => MathJax.typesetPromise([box])).catch((e) => box.innerHTML = '<span class="err">' + e.message + "</span>");
          }
          root.querySelector("[data-run]").onclick = run;
          ready().then(run).catch(() => box.innerHTML = '<span class="muted">MathJax 加载中…稍后点“渲染”</span>');
        },
      },
    ],
  };

  /* ===================== 符号：cortex Compute Engine ===================== */
  DEMOS.cortex = {
    tabs: [
      {
        label: "化简",
        code:
`import { ComputeEngine } from '@cortex-js/compute-engine';
const ce = new ComputeEngine();
ce.parse('x^2 + x^2').simplify().latex;   // "2x^2"`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>表达式（LaTeX/MathJSON）</label><input type="text" data-e value="x^2 + x^2 + 2x" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>化简</button></div>', { single: true });
          out.innerHTML = '<span class="muted">加载 Compute Engine…</span>';
          loadESM("ComputeEngine", "https://esm.sh/@cortex-js/compute-engine@0.84.2").then((mod) => {
            const CE = mod.ComputeEngine || def(mod);
            const ce = new CE();
            function run() {
              try {
                const s = ce.parse(root.querySelector("[data-e]").value).simplify().latex;
                out.innerHTML = '<span class="ok">' + s + "</span>";
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
      {
        label: "数值求值",
        code:
`const ce = new ComputeEngine();
ce.parse('1 + 2 * 3').N().latex;          // "7"
ce.parse('sqrt(2)').N().latex;            // "1.4142..."`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>表达式</label><input type="text" data-e value="sqrt(2) + 1/3" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>求值</button></div>', { single: true });
          out.innerHTML = '<span class="muted">加载 Compute Engine…</span>';
          loadESM("ComputeEngine", "https://esm.sh/@cortex-js/compute-engine@0.84.2").then((mod) => {
            const CE = mod.ComputeEngine || def(mod);
            const ce = new CE();
            function run() {
              try {
                const r = ce.parse(root.querySelector("[data-e]").value).N().latex;
                out.innerHTML = '<span class="ok">' + r + "</span>";
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
    ],
  };

  /* ===================== 符号：SymPy (Pyodide) ===================== */
  DEMOS.sympy = {
    tabs: [
      {
        label: "SymPy 符号计算",
        code:
`# 在浏览器里跑原生 Python SymPy（经 Pyodide / WASM）
from sympy import *
expand((x + 1)**3)            # x**3 + 3*x**2 + 3*x + 1
diff(sin(x), x)               # cos(x)
solve(x**2 - 4, x)            # [-2, 2]`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>SymPy 表达式（Python）</label>' +
            '<textarea data-py rows="3" style="width:100%;font-family:monospace">from sympy import *\nexpand((x + 1)**3)</textarea></div>' +
            '<div class="btn-row"><button class="btn" data-run>运行</button></div>', { single: true });
          const res = document.createElement("pre"); res.className = "output"; out.appendChild(res);
          res.innerHTML = '<span class="muted">首次加载 Pyodide（约数 MB，请稍候）…</span>';
          loadPyodideOnce().then(async (py) => {
            await py.loadPackage("sympy");
            window.sympy = py;
            function run() {
              try {
                res.innerHTML = '<span class="muted">运行中…</span>';
                const code = root.querySelector("[data-py]").value;
                const r = py.runPython(code);
                res.innerHTML = '<span class="ok">' + String(r) + "</span>";
              } catch (e) { res.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run;
            res.innerHTML = '<span class="ok">Pyodide 就绪，点击“运行”。</span>';
          }).catch((e) => res.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
    ],
  };

  /* ===================== 线性代数：Sylvester ===================== */
  DEMOS.sylvester = {
    tabs: [
      {
        label: "向量运算",
        code:
`import S from 'sylvester';
const v1 = S.Vector.create([1, 2, 3]);
const v2 = S.Vector.create([4, 5, 6]);
v1.dot(v2);        // 32
v1.modulus();      // |v1| ≈ 3.74`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>向量 a（逗号分隔）</label><input type="text" data-a value="1, 2, 3" /></div>' +
            '<div class="field"><label>向量 b</label><input type="text" data-b value="4, 5, 6" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算</button></div>', { single: true });
          out.innerHTML = '<span class="muted">加载 Sylvester…</span>';
          loadESM("Sylvester", "https://esm.sh/sylvester@0.0.21").then((S) => {
            function vec(s) { return S.Vector.create(s.split(",").map((x) => parseFloat(x))); }
            function run() {
              try {
                const a = vec(root.querySelector("[data-a]").value), b = vec(root.querySelector("[data-b]").value);
                out.innerHTML =
                  '<span class="k">点积 a·b = </span><span class="v">' + a.dot(b) + "</span>\n" +
                  '<span class="k">|a| = </span><span class="v">' + a.modulus().toFixed(4) + "</span>\n" +
                  '<span class="k">|b| = </span><span class="v">' + b.modulus().toFixed(4) + "</span>";
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
      {
        label: "矩阵乘法与逆",
        code:
`const M = S.Matrix.create([[1,2],[3,4]]);
M.multiply(M).elements;     // [[7,10],[15,22]]
M.inverse().elements;       // [[-2,1],[1.5,-0.5]]`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>2×2 矩阵（行用 ; 分隔，元素用 ,）</label>' +
            '<input type="text" data-m value="1,2 ; 3,4" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算</button></div>', { single: true });
          out.innerHTML = '<span class="muted">加载 Sylvester…</span>';
          loadESM("Sylvester", "https://esm.sh/sylvester@0.0.21").then((S) => {
            function mat(s) {
              return S.Matrix.create(s.split(";").map((r) => r.split(",").map((x) => parseFloat(x))));
            }
            function run() {
              try {
                const M = mat(root.querySelector("[data-m]").value);
                const I = M.multiply(M).elements, inv = M.inverse().elements;
                out.innerHTML =
                  '<span class="k">M × M = </span><span class="v">' + JSON.stringify(I) + "</span>\n" +
                  '<span class="k">M⁻¹ = </span><span class="v">' + JSON.stringify(inv) + "</span>";
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
    ],
  };

  /* ===================== 统计：science.js ===================== */
  DEMOS.science = {
    tabs: [
      {
        label: "描述统计",
        code:
`import science from 'science';
science.stats.mean(data);
science.stats.median(data);
science.stats.quantiles(data, [0.25, 0.5, 0.75]);
science.stats.variance(data);`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>数据量 n</label><input type="number" data-n value="200" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>生成并统计</button></div>', { single: true });
          out.innerHTML = '<span class="muted">加载 science.js…</span>';
          loadESM("science", "https://esm.sh/science@1.9.3").then((sc) => {
            const stats = (sc.default && sc.default.stats) || sc.stats || sc;
            function run() {
              try {
                const n = +root.querySelector("[data-n]").value;
                const data = []; for (let i = 0; i < n; i++) data.push(Math.random() * 100);
                const q = stats.quantiles(data, [0.25, 0.5, 0.75]);
                out.innerHTML =
                  '<span class="k">均值 = </span><span class="v">' + stats.mean(data).toFixed(3) + "</span>\n" +
                  '<span class="k">中位数 = </span><span class="v">' + stats.median(data).toFixed(3) + "</span>\n" +
                  '<span class="k">方差 = </span><span class="v">' + stats.variance(data).toFixed(3) + "</span>\n" +
                  '<span class="k">四分位 = </span><span class="v">[' + q.map((x) => x.toFixed(2)).join(", ") + "]</span>";
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
    ],
  };

  /* ===================== 随机：chance.js ===================== */
  DEMOS.chance = {
    tabs: [
      {
        label: "随机数据",
        code:
`const c = new Chance();
c.integer({ min: 1, max: 100 });
c.normal({ mean: 50, dev: 10 });
c.pick(['红','绿','蓝']);
c.name();`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="btn-row"><button class="btn" data-run>生成一批随机数据</button></div>', { single: true });
          function run() {
            const c = new Chance();
            const rows = [];
            for (let i = 0; i < 6; i++) rows.push(
              "整数 " + c.integer({ min: 1, max: 100 }) +
              " | 正态 " + c.normal({ mean: 50, dev: 10 }).toFixed(1) +
              " | 抽取 " + c.pick(["红", "绿", "蓝", "黄"]) +
              " | 姓名 " + c.name());
            out.innerHTML = rows.map((r) => "<div>" + r + "</div>").join("");
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "可复现（种子）",
        code:
`const a = new Chance(42);   // 种子固定
const b = new Chance(42);
a.integer() === b.integer();  // true（同种子同序列）`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>种子</label><input type="number" data-seed value="42" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>验证复现</button></div>', { single: true });
          function run() {
            const seed = +root.querySelector("[data-seed]").value;
            const a = new Chance(seed), b = new Chance(seed);
            const sa = [a.integer(), a.integer(), a.integer()];
            const sb = [b.integer(), b.integer(), b.integer()];
            out.innerHTML = '<span class="k">序列A = </span><span class="v">[' + sa.join(", ") + "]</span>\n" +
              '<span class="k">序列B = </span><span class="v">[' + sb.join(", ") + "]</span>\n" +
              (sa.join() === sb.join() ? '<span class="ok">✓ 同种子 → 完全一致</span>' : '<span class="err">✗ 不一致</span>');
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ===================== 几何：flatten-js ===================== */
  DEMOS.flatten = {
    tabs: [
      {
        label: "多边形布尔（交）",
        code:
`import flatten from 'flatten-js';
const p1 = new flatten.Polygon([new flatten.Point(0,0), new flatten.Point(10,0), new flatten.Point(10,10), new flatten.Point(0,10)]);
const p2 = new flatten.Polygon([new flatten.Point(5,5), ... ]);
p1.intersect(p2);   // 返回交集多边形（数组）`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="btn-row"><button class="btn" data-run>计算交集（两个正方形）</button></div>', { vizLabel: "交集多边形" });
          const { c, ctx, w, h } = mkCanvas(440, 300); viz.appendChild(c);
          function draw(poly, color) {
            const pts = (poly.vertices && poly.vertices.length ? poly.vertices : []).map((v) => [v.x, v.y]);
            if (!pts.length) return;
            ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
            pts.forEach((p, i) => (i ? ctx.lineTo(40 + p[0] * 24, 260 - p[1] * 24) : ctx.moveTo(40 + p[0] * 24, 260 - p[1] * 24)));
            ctx.closePath(); ctx.stroke();
          }
          out.innerHTML = '<span class="muted">加载 flatten-js…</span>';
          loadESM("flatten", "https://esm.sh/flatten-js@0.6.9").then((f) => {
            const F = def(f);
            function run() {
              const p1 = new F.Polygon([new F.Point(0, 0), new F.Point(10, 0), new F.Point(10, 10), new F.Point(0, 10)]);
              const p2 = new F.Polygon([new F.Point(5, 5), new F.Point(15, 5), new F.Point(15, 15), new F.Point(5, 15)]);
              const inter = p1.intersect(p2);
              ctx.clearRect(0, 0, w, h); ctx.fillStyle = css("--code-bg"); ctx.fillRect(0, 0, w, h);
              draw(p1, css("--accent")); draw(p2, css("--accent-3"));
              const arr = Array.isArray(inter) ? inter : [inter];
              arr.forEach((p) => draw(p, "#ffd166"));
              out.innerHTML = '<span class="k">交集多边形个数 = </span><span class="v">' + arr.length + "</span>\n" +
                '<span class="muted">黄线为两个正方形（蓝/紫）的交集区域</span>';
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
      {
        label: "包含与距离",
        code:
`const p = new flatten.Polygon([...]);
p.contains(new flatten.Point(3, 3));     // true
p.distanceTo(new flatten.Point(20, 20));`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="btn-row"><button class="btn" data-run>测试包含与距离</button></div>', { single: true });
          out.innerHTML = '<span class="muted">加载 flatten-js…</span>';
          loadESM("flatten", "https://esm.sh/flatten-js@0.6.9").then((f) => {
            const F = def(f);
            function run() {
              const p = new F.Polygon([new F.Point(0, 0), new F.Point(10, 0), new F.Point(10, 10), new F.Point(0, 10)]);
              const inside = new F.Point(3, 3), outside = new F.Point(20, 20);
              out.innerHTML = '<span class="k">含 (3,3)？ </span><span class="v">' + p.contains(inside) + "</span>\n" +
                '<span class="k">含 (20,20)？ </span><span class="v">' + p.contains(outside) + "</span>\n" +
                '<span class="k">到 (20,20) 的距离 = </span><span class="v">' + p.distanceTo(outside).toFixed(3) + "</span>";
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
    ],
  };

  /* ===================== 几何：polybooljs ===================== */
  DEMOS.polybool = {
    tabs: [
      {
        label: "布尔运算",
        code:
`// regions 为点环数组 [[ [x,y], ... ]]
PolyBool.union(r1, r2);
PolyBool.intersect(r1, r2);
PolyBool.difference(r1, r2);
PolyBool.xor(r1, r2);`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>运算</label><select data-op>' +
            '<option value="union">并集 union</option><option value="intersect" selected>交集 intersect</option>' +
            '<option value="difference">差集 difference</option><option value="xor">异或 xor</option></select></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算</button></div>', { single: true });
          const r1 = [[[0, 0], [10, 0], [10, 10], [0, 10]]];
          const r2 = [[[5, 5], [15, 5], [15, 15], [5, 15]]];
          function run() {
            try {
              const op = root.querySelector("[data-op]").value;
              const res = PolyBool[op](r1, r2);
              const n = res.regions ? res.regions.length : 0;
              const pts = res.regions && res.regions[0] ? res.regions[0].length : 0;
              out.innerHTML = '<span class="k">' + op + ' 结果：</span><span class="v">' + n + " 个区域，首区域 " + pts + " 个顶点</span>\n" +
                '<span class="muted">' + JSON.stringify(res.regions && res.regions[0] ? res.regions[0].slice(0, 4) : []) + " …</span>";
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ===================== 几何：earcut ===================== */
  DEMOS.earcut = {
    tabs: [
      {
        label: "三角剖分",
        code:
`// 外环 + 洞（holeIndices 标记洞起始索引）
const coords = [x0,y0, x1,y1, ...];
const tris = earcut(coords, [holeStart], 2);  // 返回顶点索引数组`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="btn-row"><button class="btn" data-run>三角化（带洞正方形）</button></div>', { vizLabel: "三角网格" });
          const { c, ctx, w, h } = mkCanvas(440, 300); root.querySelector("[data-viz]").appendChild(c);          // 外环 0..7 (方形 0..12)，洞 8..11 (方形 4..8)
          const ring = [[0, 0], [12, 0], [12, 12], [0, 12], [4, 4], [8, 4], [8, 8], [4, 8]];
          const flat = []; ring.forEach((p) => flat.push(p[0], p[1]));
          const holes = [8]; // 洞从第 4 个点开始
          function run() {
            const tris = earcut(flat, holes, 2);
            ctx.clearRect(0, 0, w, h); ctx.fillStyle = css("--code-bg"); ctx.fillRect(0, 0, w, h);
            const sx = 24, sy = 6;
            ctx.strokeStyle = css("--text-dim"); ctx.lineWidth = 1;
            ring.forEach((p, i) => { const x = sx + p[0] * 18, y = sy + p[1] * 18; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
            ctx.closePath(); ctx.stroke();
            ctx.fillStyle = "rgba(94,200,255,0.35)";
            for (let i = 0; i < tris.length; i += 3) {
              const a = ring[tris[i]], b = ring[tris[i + 1]], cc = ring[tris[i + 2]];
              ctx.beginPath();
              ctx.moveTo(sx + a[0] * 18, sy + a[1] * 18);
              ctx.lineTo(sx + b[0] * 18, sy + b[1] * 18);
              ctx.lineTo(sx + cc[0] * 18, sy + cc[1] * 18);
              ctx.closePath(); ctx.fill();
            }
            out.innerHTML = '<span class="k">三角形数 = </span><span class="v">' + (tris.length / 3) + "</span>";
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ===================== 几何：poly2tri ===================== */
  DEMOS.poly2tri = {
    tabs: [
      {
        label: "受约束 Delaunay",
        code:
`import poly2tri from 'poly2tri';
const ctx = new poly2tri.SweepContext(contourPoints);
ctx.triangulate();
const tris = ctx.getTriangles();`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="btn-row"><button class="btn" data-run>三角化</button></div>', { vizLabel: "Delaunay 网格" });
          const { c, ctx, w, h } = mkCanvas(440, 300); root.querySelector("[data-viz]").appendChild(c);          function run() {
            out.innerHTML = '<span class="muted">加载 poly2tri…</span>';
            loadESM("poly2tri", "https://esm.sh/poly2tri@1.5.0").then((p) => {
              const P = def(p);
              const contour = [[1, 1], [11, 1], [12, 7], [7, 11], [1, 9]].map((q) => new P.Point(q[0], q[1]));
              const sc = new P.SweepContext(contour);
              sc.triangulate();
              const tris = sc.getTriangles();
              ctx.clearRect(0, 0, w, h); ctx.fillStyle = css("--code-bg"); ctx.fillRect(0, 0, w, h);
              ctx.fillStyle = "rgba(255,122,198,0.4)"; ctx.strokeStyle = css("--accent");
              tris.forEach((t) => {
                const ps = t.getPoints();
                ctx.beginPath();
                ps.forEach((pt, i) => { const x = 20 + pt.x * 18, y = 20 + pt.y * 18; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
                ctx.closePath(); ctx.fill(); ctx.stroke();
              });
              out.innerHTML = '<span class="k">三角形数 = </span><span class="v">' + tris.length + "</span>";
            }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ===================== 几何：Victor ===================== */
  DEMOS.victor = {
    tabs: [
      {
        label: "2D 向量运算",
        code:
`import Victor from 'victor';
const a = new Victor(3, 4);
const b = new Victor(1, 2);
a.add(b); a.dot(b); a.cross(b); a.magnitude(); a.normalize();`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>向量 a</label><input type="text" data-a value="3, 4" /></div>' +
            '<div class="field"><label>向量 b</label><input type="text" data-b value="1, 2" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算</button></div>', { single: true });
          out.innerHTML = '<span class="muted">加载 Victor…</span>';
          loadESM("Victor", "https://esm.sh/victor@1.1.0").then((V) => {
            const Victor = def(V);
            function run() {
              try {
                const a = new Victor(...root.querySelector("[data-a]").value.split(",").map(Number));
                const b = new Victor(...root.querySelector("[data-b]").value.split(",").map(Number));
                out.innerHTML =
                  '<span class="k">a + b = </span><span class="v">(' + a.clone().add(b).x + ", " + a.clone().add(b).y + ")</span>\n" +
                  '<span class="k">a·b = </span><span class="v">' + a.dot(b) + "</span>\n" +
                  '<span class="k">|a| = </span><span class="v">' + a.magnitude().toFixed(3) + "</span>\n" +
                  '<span class="k">a 与 x 轴夹角 = </span><span class="v">' + (a.angle() * 180 / Math.PI).toFixed(1) + "°</span>";
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
    ],
  };

  /* ===================== 机器学习：brain.js ===================== */
  DEMOS.brain = {
    tabs: [
      {
        label: "训练 XOR",
        code:
`import brain from 'brain.js';
const net = new brain.NeuralNetwork({ hiddenLayers: [3] });
await net.trainAsync([
  { input: [0,0], output: [0] },
  { input: [0,1], output: [1] },
  { input: [1,0], output: [1] },
  { input: [1,1], output: [0] },
]);
net.run([1, 0]);   // ≈ [1]`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="btn-row"><button class="btn" data-run>训练 XOR 网络</button></div>', { single: true });
          out.innerHTML = '<span class="muted">加载 Brain.js…</span>';
          loadESM("brain", "https://esm.sh/brain.js@1.6.1").then((b) => {
            const brain = def(b);
            function run() {
              const net = new brain.NeuralNetwork({ hiddenLayers: [4] });
              const data = [
                { input: [0, 0], output: [0] }, { input: [0, 1], output: [1] },
                { input: [1, 0], output: [1] }, { input: [1, 1], output: [0] },
              ];
              out.innerHTML = '<span class="muted">训练中…</span>';
              const p = (net.trainAsync ? net.trainAsync(data) : Promise.resolve(net.train(data)));
              p.then(() => {
                const pred = [[0, 0], [0, 1], [1, 0], [1, 1]].map((i) => net.run(i)[0].toFixed(3));
                out.innerHTML = '<span class="k">XOR 预测：</span>\n' +
                  "[0,0]→" + pred[0] + "  [0,1]→" + pred[1] + "\n[1,0]→" + pred[2] + "  [1,1]→" + pred[3];
              }).catch((e) => out.innerHTML = '<span class="err">' + e.message + "</span>");
            }
            root.querySelector("[data-run]").onclick = run;
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
    ],
  };

  /* ===================== 信号：fft.js ===================== */
  DEMOS.fft = {
    tabs: [
      {
        label: "FFT 频谱",
        code:
`import FFT from 'fft.js';
const f = new FFT(N);                 // N 为 2 的幂
const data = f.createComplexArray();  // 复数缓冲
for (let i=0;i<N;i++) data[2*i] = signal[i];
const out = f.createComplexArray();
f.transform(out, data);
f.completeSpectrum(out);              // 幅值 = hypot(out[2k], out[2k+1])`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>信号长度 N（2 的幂）</label><input type="number" data-n value="64" /></div>' +
            '<div class="field"><label>频率 f1, f2（逗号）</label><input type="text" data-f value="4, 10" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算 FFT</button></div>', { vizLabel: "幅值频谱" });
          const { c, ctx, w, h } = mkCanvas(460, 260);          out.innerHTML = '<span class="muted">加载 fft.js…</span>';
          loadESM("fft", "https://esm.sh/fft.js@4.0.4").then((F) => {
            const FFT = def(F);
            function run() {
              try {
                let N = parseInt(root.querySelector("[data-n]").value); N = Math.pow(2, Math.round(Math.log2(N)));
                const fs = root.querySelector("[data-f]").value.split(",").map((x) => parseInt(x));
                const sig = []; for (let i = 0; i < N; i++) { let v = 0; fs.forEach((f) => v += Math.sin(2 * Math.PI * f * i / N)); sig.push(v); }
                const f = new FFT(N);
                const data = f.createComplexArray(); for (let i = 0; i < N; i++) data[2 * i] = sig[i];
                const outc = f.createComplexArray(); f.transform(outc, data); f.completeSpectrum(outc);
                const mags = []; for (let i = 0; i < N / 2; i++) mags.push(Math.hypot(outc[2 * i], outc[2 * i + 1]));
                bars(ctx, w, h, mags.map((_, i) => i), mags, { title: "FFT 幅值（峰位于 f1,f2）", color: css("--accent") });
                out.innerHTML = '<span class="k">N = ' + N + "，峰值应出现在 bin </span><span class=\"v\">" + fs.join(", ") + "</span>";
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
    ],
  };

  /* ===================== 信号：dsp.js ===================== */
  DEMOS.dsp = {
    tabs: [
      {
        label: "FFT 频谱",
        code:
`import DSP from 'dsp.js';
const fft = new DSP.FFT(bufferSize, sampleRate);
fft.forward(samples);     // 时域采样
fft.spectrum;             // Float64Array 幅值谱`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>采样数（2 的幂）</label><input type="number" data-n value="1024" /></div>' +
            '<div class="field"><label>频率 Hz</label><input type="number" data-f value="440" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算频谱</button></div>', { vizLabel: "幅值频谱" });
          const { c, ctx, w, h } = mkCanvas(460, 260);          out.innerHTML = '<span class="muted">加载 dsp.js…</span>';
          loadESM("DSP", "https://esm.sh/dsp.js@1.0.1").then((d) => {
            const DSP = def(d);
            function run() {
              try {
                const N = parseInt(root.querySelector("[data-n]").value);
                const f0 = parseFloat(root.querySelector("[data-f]").value);
                const sr = 44100;
                const s = new Float32Array(N); for (let i = 0; i < N; i++) s[i] = Math.sin(2 * Math.PI * f0 * i / sr);
                const fft = new DSP.FFT(N, sr); fft.forward(s);
                const spec = fft.spectrum;
                const half = Math.min(N / 2, 200);
                const mags = []; for (let i = 0; i < half; i++) mags.push(spec[i]);
                bars(ctx, w, h, mags.map((_, i) => i), mags, { title: "幅值谱（峰位于 " + f0 + "Hz 对应 bin）", color: css("--accent-3") });
                const peakBin = mags.indexOf(Math.max(...mags));
                const peakHz = peakBin * sr / N;
                out.innerHTML = '<span class="k">峰值 bin = </span><span class="v">' + peakBin + "</span>  <span class=\"k\">≈ </span><span class=\"v\">" + peakHz.toFixed(1) + " Hz</span>";
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
    ],
  };

  /* ===================== 优化：fmin ===================== */
  DEMOS.fmin = {
    tabs: [
      {
        label: "Nelder-Mead 最小化",
        code:
`import { nelderMead } from 'fmin';
const sol = nelderMead((x) => (x[0]-2)**2 + (x[1]+1)**2, [0, 0]);
// sol.x ≈ [2, -1]`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="btn-row"><button class="btn" data-run>最小化 f(x,y)=(x-2)²+(y+1)²</button></div>', { single: true });
          out.innerHTML = '<span class="muted">加载 fmin…</span>';
          loadESM("fmin", "https://esm.sh/fmin@0.0.4").then((m) => {
            const fmin = def(m);
            const nm = fmin.nelderMead || (fmin.default && fmin.default.nelderMead);
            function run() {
              try {
                const sol = nm((x) => (x[0] - 2) ** 2 + (x[1] + 1) ** 2, [0, 0]);
                const x = sol.x || sol;
                out.innerHTML = '<span class="k">最优解 x ≈ </span><span class="v">[' + (Array.isArray(x) ? x.map((v) => v.toFixed(3)).join(", ") : x) + "]</span>" +
                  '<span class="muted"> （理论最小值在 [2, -1]，f=0）</span>';
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
    ],
  };

  /* ===================== 优化：ml-levenberg-marquardt ===================== */
  DEMOS.levmar = {
    tabs: [
      {
        label: "非线性最小二乘拟合",
        code:
`import LM from 'ml-levenberg-marquardt';
const fitted = LM(data, (params) => {
  // 返回各点预测值，params=[a,b,c]
  return t.map((ti) => params[0]*Math.exp(-params[1]*ti)+params[2]);
}, { initialValues: [1, 1, 0] });
fitted.parameterValues;   // [a,b,c]`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="btn-row"><button class="btn" data-run>拟合 a·e^(−b·t)+c</button></div>', { vizLabel: "拟合曲线 vs 数据" });
          const { c, ctx, w, h } = mkCanvas(460, 260);          out.innerHTML = '<span class="muted">加载 ml-levenberg-marquardt…</span>';
          loadESM("MLLevenbergMarquardt", "https://esm.sh/ml-levenberg-marquardt@5.0.1").then((m) => {
            const LM = m.levenbergMarquardt || def(m);
            function run() {
              try {
                const A = 3, B = 0.3, C = 1; const N = 30;
                const t = [], y = [];
                for (let i = 0; i < N; i++) { const ti = i / 3; t.push(ti); y.push(A * Math.exp(-B * ti) + C + (Math.random() - 0.5) * 0.4); }
                const data = { x: t, y: y };
                const fitted = LM(data, (params) => t.map((ti) => params[0] * Math.exp(-params[1] * ti) + params[2]), { initialValues: [1, 1, 0] });
                const p = fitted.parameterValues || fitted;
                const pred = t.map((ti) => p[0] * Math.exp(-p[1] * ti) + p[2]);
                const all = y.concat(pred).filter(isFinite); let ymin = Math.min(...all) - 0.5, ymax = Math.max(...all) + 0.5;
                if (ymin === ymax) { ymin -= 1; ymax += 1; }
                plot2D(ctx, w, h, { xmin: 0, xmax: t[N - 1], ymin, ymax }, (mx, my) => {
                  t.forEach((ti, i) => { ctx.fillStyle = css("--text-dim"); ctx.beginPath(); ctx.arc(mx(ti), my(y[i]), 2.5, 0, 7); ctx.fill(); });
                  line(ctx, t.map((ti, i) => [mx(ti), my(pred[i])]), css("--accent"), 2);
                });
                out.innerHTML = '<span class="k">拟合参数：</span><span class="v">a=' + p[0].toFixed(3) + ", b=" + p[1].toFixed(3) + ", c=" + p[2].toFixed(3) + "</span>";
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
    ],
  };

  /* ===================== 图论：graphology ===================== */
  DEMOS.graphology = {
    tabs: [
      {
        label: "建图与基础指标",
        code:
`import graphology from 'graphology';
const g = new graphology.Graph();
g.addNode('a'); g.addEdge('a', 'b');
g.degree('a'); g.neighbors('a'); g.order; g.size;`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="btn-row"><button class="btn" data-run>构建示例图</button></div>', { single: true });
          out.innerHTML = '<span class="muted">加载 graphology…</span>';
          loadESM("graphology", "https://esm.sh/graphology@0.26.0").then((gmod) => {
            const graphology = def(gmod);
            function run() {
              const g = new graphology.Graph();
              ["a", "b", "c", "d", "e"].forEach((n) => g.addNode(n));
              [["a", "b"], ["a", "c"], ["b", "d"], ["c", "d"], ["d", "e"]].forEach((e) => g.addEdge(e[0], e[1]));
              let s = "<span class=\"k\">节点数 |V| = </span><span class=\"v\">" + g.order + "</span>  <span class=\"k\">边数 |E| = </span><span class=\"v\">" + g.size + "</span>\n";
              g.nodes().forEach((n) => { s += "节点 " + n + "：度=" + g.degree(n) + "，邻居=[" + g.neighbors(n).join(", ") + "]\n"; });
              out.innerHTML = s;
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
      {
        label: "连通分量（BFS）",
        code:
`// graphology 核心只含基础算法，连通分量用 BFS 自行实现
function components(g) {
  const seen = new Set(); const comps = [];
  g.nodes().forEach((n) => {
    if (seen.has(n)) return;
    const q = [n]; const comp = []; seen.add(n);
    while (q.length) { const u = q.shift(); comp.push(u);
      g.neighbors(u).forEach((v) => { if (!seen.has(v)) { seen.add(v); q.push(v); } }); }
    comps.push(comp);
  });
  return comps;
}`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="btn-row"><button class="btn" data-run>计算连通分量</button></div>', { single: true });
          out.innerHTML = '<span class="muted">加载 graphology…</span>';
          loadESM("graphology", "https://esm.sh/graphology@0.26.0").then((gmod) => {
            const graphology = def(gmod);
            function run() {
              const g = new graphology.Graph();
              ["a", "b", "c", "x", "y"].forEach((n) => g.addNode(n));
              [["a", "b"], ["b", "c"], ["x", "y"]].forEach((e) => g.addEdge(e[0], e[1]));
              const seen = new Set(); const comps = [];
              g.nodes().forEach((n) => {
                if (seen.has(n)) return; const q = [n]; const comp = []; seen.add(n);
                while (q.length) { const u = q.shift(); comp.push(u); g.neighbors(u).forEach((v) => { if (!seen.has(v)) { seen.add(v); q.push(v); } }); }
                comps.push(comp);
              });
              out.innerHTML = '<span class="k">连通分量数 = </span><span class="v">' + comps.length + "</span>\n" +
                comps.map((c, i) => "分量 " + (i + 1) + ": [" + c.join(", ") + "]").join("\n");
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
    ],
  };

  /* ===================== 图论：ngraph ===================== */
  DEMOS.ngraph = {
    tabs: [
      {
        label: "最短路径（A*）",
        code:
`import createGraph from 'ngraph.graph';
import ngraphPath from 'ngraph.path';
const g = createGraph(); g.addLink('a','b'); g.addLink('b','c');
const find = ngraphPath.aStar(g);
find.find('a', 'c');   // ['c','b','a']`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="btn-row"><button class="btn" data-run>构建图并寻路</button></div>', { single: true });
          out.innerHTML = '<span class="muted">加载 ngraph…</span>';
          Promise.all([
            loadESM("ngraph", "https://esm.sh/ngraph.graph@20.1.2"),
            loadESM("ngraphPath", "https://esm.sh/ngraph.path@1.6.1"),
          ]).then(([gmod, pmod]) => {
            const createGraph = def(gmod);
            const ngraphPath = pmod;
            function run() {
              const g = createGraph();
              ["a", "b", "c", "d", "e"].forEach((n) => g.addNode(n));
              [["a", "b"], ["b", "c"], ["a", "d"], ["d", "e"], ["e", "c"]].forEach((e) => g.addLink(e[0], e[1]));
              const find = (ngraphPath.aStar || ngraphPath.default)(g);
              const path = find.find("a", "c") || [];
              const ids = path.map((n) => (n.id !== undefined ? n.id : n)).reverse();
              out.innerHTML = '<span class="k">a → c 最短路径：</span><span class="v">' + (ids.join(" → ") || "无路径") + "</span>";
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
    ],
  };

  /* ===================== 图论：graphlib ===================== */
  DEMOS.graphlib = {
    tabs: [
      {
        label: "有向图 + Dijkstra",
        code:
`import graphlib from 'graphlib';
const g = new graphlib.Graph({ directed: true });
g.setEdge('A', 'B', 4); g.setEdge('B', 'C', 2);
graphlib.alg.dijkstra(g, 'A');   // 各点最短距离`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="btn-row"><button class="btn" data-run>计算最短路</button></div>', { single: true });
          function run() {
            try {
              const g = new graphlib.Graph({ directed: true });
              [["A", "B", 4], ["A", "C", 2], ["B", "C", 5], ["C", "D", 1], ["B", "D", 8]].forEach((e) => g.setEdge(e[0], e[1], e[2]));
              const d = graphlib.alg.dijkstra(g, "A");
              out.innerHTML = Object.keys(d).map((n) =>
                '<span class="k">' + n + " ← </span><span class=\"v\">" + (d[n].distance === Infinity ? "∞" : d[n].distance) + "</span>  (前驱 " + (d[n].predecessor || "-") + ")"
              ).join("\n");
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ===================== 图论：jsnetworkx ===================== */
  DEMOS.jsnetworkx = {
    tabs: [
      {
        label: "最短路径",
        code:
`import jsnx from 'jsnetworkx';
const g = new jsnx.Graph();
g.addEdgesFrom([['A','B'],['B','C']]);
jsnx.shortestPath(g, 'A', 'C');   // ['A','B','C']`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="btn-row"><button class="btn" data-run>计算最短路与中心性</button></div>', { single: true });
          out.innerHTML = '<span class="muted">加载 jsnetworkx…</span>';
          loadESM("jsnx", "https://esm.sh/jsnetworkx@0.3.4").then((j) => {
            const jsnx = def(j);
            function run() {
              try {
                const g = new jsnx.Graph();
                [["A", "B"], ["B", "C"], ["A", "D"], ["D", "E"], ["E", "C"], ["B", "E"]].forEach((e) => g.addEdgesFrom([e]));
                const sp = jsnx.shortestPath(g, "A", "C");
                const deg = jsnx.degreeCentrality(g);
                out.innerHTML = '<span class="k">A → C 最短路径：</span><span class="v">' + (Array.isArray(sp) ? sp.join(" → ") : JSON.stringify(sp)) + "</span>\n" +
                  '<span class="k">度中心性：</span><span class="v">' + Object.entries(deg).map(([k, v]) => k + "=" + v.toFixed(2)).join(", ") + "</span>";
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
      {
        label: "中心性",
        code:
`jsnx.betweennessCentrality(g);   // 介数中心性
jsnx.degreeCentrality(g);        // 度中心性`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="btn-row"><button class="btn" data-run>计算介数中心性</button></div>', { single: true });
          out.innerHTML = '<span class="muted">加载 jsnetworkx…</span>';
          loadESM("jsnx", "https://esm.sh/jsnetworkx@0.3.4").then((j) => {
            const jsnx = def(j);
            function run() {
              try {
                const g = new jsnx.Graph();
                [["A", "B"], ["B", "C"], ["C", "D"], ["A", "D"], ["B", "D"]].forEach((e) => g.addEdgesFrom([e]));
                const bc = jsnx.betweennessCentrality(g);
                out.innerHTML = '<span class="k">介数中心性：</span>\n' +
                  Object.entries(bc).map(([k, v]) => k + " = " + v.toFixed(3)).join("\n");
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
    ],
  };

  /* ===================== 图论：cytoscape ===================== */
  DEMOS.cytoscape = {
    tabs: [
      {
        label: "可视化 + 最短路径",
        code:
`import cytoscape from 'cytoscape';
const cy = cytoscape({ container, elements, layout:{name:'cose'} });
const dijk = cy.elements().dijkstra({ root: '#A' });
dijk.distanceTo(cy.$('#C'));   // 最短距离`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="btn-row"><button class="btn" data-run>渲染网络图</button></div>', { vizLabel: "图可视化" });
          const box = document.createElement("div"); box.style.cssText = "width:100%;height:320px;"; viz.appendChild(box);
          function run() {
            try {
              const cy = cytoscape({
                container: box,
                elements: {
                  nodes: ["A", "B", "C", "D", "E"].map((id) => ({ data: { id } })),
                  edges: [["A", "B"], ["A", "C"], ["B", "C"], ["C", "D"], ["D", "E"], ["B", "E"]].map((e) => ({ data: { source: e[0], target: e[1] } })),
                },
                style: [
                  { selector: "node", style: { "background-color": css("--accent"), label: "data(id)", color: css("--text"), "font-size": 12 } },
                  { selector: "edge", style: { width: 2, "line-color": css("--border") } },
                ],
                layout: { name: "cose", fit: true, padding: 20 },
              });
              const dijk = cy.elements().dijkstra({ root: "#A" });
              const d = dijk.distanceTo(cy.$("#C"));
              out.innerHTML = '<span class="k">A → C 最短距离（边数）= </span><span class="v">' + d + "</span>";
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ===================== 单位：convert-units ===================== */
  DEMOS.convert = {
    tabs: [
      {
        label: "单位换算",
        code:
`import convert from 'convert-units';
convert(5).from('m').to('ft');     // 16.4042
convert(100).from('km/h').to('m/s');`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>数值</label><input type="number" data-v value="100" /></div>' +
            '<div class="field"><label>从</label><input type="text" data-from value="km/h" /></div>' +
            '<div class="field"><label>到</label><input type="text" data-to value="m/s" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>换算</button></div>', { single: true });
          out.innerHTML = '<span class="muted">加载 convert-units…</span>';
          loadESM("convert", "https://esm.sh/convert-units@2.3.4").then((m) => {
            const convert = def(m);
            function run() {
              try {
                const r = convert(+root.querySelector("[data-v]").value).from(root.querySelector("[data-from]").value).to(root.querySelector("[data-to]").value);
                out.innerHTML = '<span class="v">' + r + "</span> <span class=\"muted\">" + root.querySelector("[data-to]").value + "</span>";
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
      {
        label: "可换算列表",
        code:
`convert().possibilities('length');   // ['m','km','cm','mm','ft','mi',...]
convert().possibilities('mass');`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>量纲类型</label><input type="text" data-t value="length" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>列出</button></div>', { single: true });
          out.innerHTML = '<span class="muted">加载 convert-units…</span>';
          loadESM("convert", "https://esm.sh/convert-units@2.3.4").then((m) => {
            const convert = def(m);
            function run() {
              try {
                const list = convert().possibilities(root.querySelector("[data-t]").value);
                out.innerHTML = '<span class="k">可换算单位：</span>\n<span class="v">' + list.join(", ") + "</span>";
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
    ],
  };

  /* ===================== 单位：js-quantities ===================== */
  DEMOS.jsquantities = {
    tabs: [
      {
        label: "带单位运算",
        code:
`import Qty from 'js-quantities';
const a = new Qty('10 km/h');
const b = new Qty('5 m/s');
a.add(b).toString();        // '28 km/h'
a.to('m/s').toString();`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>量 A（如 10 km/h）</label><input type="text" data-a value="10 km/h" /></div>' +
            '<div class="field"><label>量 B（如 5 m/s）</label><input type="text" data-b value="5 m/s" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>相加并换算</button></div>', { single: true });
          out.innerHTML = '<span class="muted">加载 js-quantities…</span>';
          loadESM("Qty", "https://esm.sh/js-quantities@1.8.0").then((m) => {
            const Qty = def(m);
            function run() {
              try {
                const a = new Qty(root.querySelector("[data-a]").value);
                const b = new Qty(root.querySelector("[data-b]").value);
                out.innerHTML = '<span class="k">A + B = </span><span class="v">' + a.add(b).toString() + "</span>\n" +
                  '<span class="k">A 换算为 m/s = </span><span class="v">' + a.to("m/s").toString() + "</span>\n" +
                  '<span class="k">比较 A > B？ </span><span class="v">' + a.gt(b) + "</span>";
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
    ],
  };

  /* ===================== 数论：big-integer ===================== */
  DEMOS.bigint = {
    tabs: [
      {
        label: "阶乘与大幂",
        code:
`import bigInt from 'big-integer';
bigInt(20).factorial().toString();      // 2432902008176640000
bigInt(2).pow(128).toString();          // 大数幂`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>n（阶乘）</label><input type="number" data-n value="20" /></div>' +
            '<div class="field"><label>底数 / 指数（幂）</label><input type="text" data-p value="2, 128" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算</button></div>', { single: true });
          function run() {
            try {
              const n = +root.querySelector("[data-n]").value;
              const [b, e] = root.querySelector("[data-p]").value.split(",").map((x) => +x.trim());
              out.innerHTML = '<span class="k">' + n + '! = </span><span class="v">' + bigInt(n).factorial().toString() + "</span>\n" +
                '<span class="k">' + b + '^' + e + ' = </span><span class="v">' + bigInt(b).pow(e).toString() + "</span>";
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "gcd 与模逆",
        code:
`bigInt.gcd(a, m);          // 最大公约数
bigInt(a).modInv(m);        // 模逆元（a·x ≡ 1 mod m）`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>a</label><input type="number" data-a value="17" /></div>' +
            '<div class="field"><label>模 m</label><input type="number" data-m value="3120" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算</button></div>', { single: true });
          function run() {
            try {
              const a = bigInt(+root.querySelector("[data-a]").value), m = bigInt(+root.querySelector("[data-m]").value);
              out.innerHTML = '<span class="k">gcd(' + a + ', ' + m + ') = </span><span class="v">' + bigInt.gcd(a, m).toString() + "</span>\n" +
                '<span class="k">' + a + ' 的模逆 (mod ' + m + ') = </span><span class="v">' + a.modInv(m).toString() + "</span>";
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ===================== 数论：bigint-crypto-utils ===================== */
  DEMOS.bigintcrypto = {
    tabs: [
      {
        label: "素数测试",
        code:
`import * as c from 'bigint-crypto-utils';
c.isProbablyPrime(17n);          // true
c.isProbablyPrime(91n);          // false`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>整数 n</label><input type="number" data-n value="91" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>素数测试</button></div>', { single: true });
          out.innerHTML = '<span class="muted">加载 bigint-crypto-utils…</span>';
          loadESM("bigintCryptoUtils", "https://esm.sh/bigint-crypto-utils@3.3.0").then((c) => {
            const lib = def(c);
            function run() {
              try {
                const n = BigInt(root.querySelector("[data-n]").value);
                out.innerHTML = '<span class="k">' + n + " 是素数？ </span><span class=\"v\">" + lib.isProbablyPrime(n) + "</span>";
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
      {
        label: "模逆与模幂",
        code:
`c.modInv(a, m);     // a·x ≡ 1 (mod m)
c.modPow(a, e, m);  // a^e mod m`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>a</label><input type="number" data-a value="17" /></div>' +
            '<div class="field"><label>指数 e</label><input type="number" data-e value="3" /></div>' +
            '<div class="field"><label>模 m</label><input type="number" data-m value="3120" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算</button></div>', { single: true });
          out.innerHTML = '<span class="muted">加载 bigint-crypto-utils…</span>';
          loadESM("bigintCryptoUtils", "https://esm.sh/bigint-crypto-utils@3.3.0").then((c) => {
            const lib = def(c);
            function run() {
              try {
                const a = BigInt(+root.querySelector("[data-a]").value), e = BigInt(+root.querySelector("[data-e]").value), m = BigInt(+root.querySelector("[data-m]").value);
                out.innerHTML = '<span class="k">模逆 ' + a + '⁻¹ mod ' + m + ' = </span><span class="v">' + lib.modInv(a, m) + "</span>\n" +
                  '<span class="k">' + a + '^' + e + ' mod ' + m + ' = </span><span class="v">' + lib.modPow(a, e, m) + "</span>";
              } catch (err) { out.innerHTML = '<span class="err">' + err.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
    ],
  };

  /* ===================== 数论：primes-and-factors ===================== */
  DEMOS.primes = {
    tabs: [
      {
        label: "质因数分解",
        code:
`import { isPrime, getFactors } from 'primes-and-factors';
isPrime(97n);              // true
getFactors(360n);          // [2,2,2,3,3,5]`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>整数 n</label><input type="number" data-n value="360" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>分解</button></div>', { single: true });
          out.innerHTML = '<span class="muted">加载 primes-and-factors…</span>';
          loadESM("primesAndFactors", "https://esm.sh/primes-and-factors@1.3.3").then((m) => {
            const lib = def(m);
            function run() {
              try {
                const n = BigInt(root.querySelector("[data-n]").value);
                out.innerHTML = '<span class="k">' + n + " 是素数？ </span><span class=\"v\">" + lib.isPrime(n) + "</span>\n" +
                  '<span class="k">质因数 = </span><span class="v">[' + lib.getFactors(n).map((x) => x.toString()).join(", ") + "]</span>";
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
    ],
  };

  /* ===================== 数论：js-combinatorics ===================== */
  DEMOS.jscomb = {
    tabs: [
      {
        label: "排列与组合",
        code:
`import Combinatorics from 'js-combinatorics';
Combinatorics.permutation([1,2,3]).toArray();   // 全排列
Combinatorics.combination([1,2,3,4], 2).toArray(); // C(4,2)`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>集合（逗号分隔）</label><input type="text" data-s value="1, 2, 3" /></div>' +
            '<div class="field"><label>组合大小 k</label><input type="number" data-k value="2" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>枚举</button></div>', { single: true });
          function run() {
            try {
              const pool = root.querySelector("[data-s]").value.split(",").map((x) => x.trim());
              const k = +root.querySelector("[data-k]").value;
              const perms = Combinatorics.permutation(pool).toArray();
              const combs = Combinatorics.combination(pool, k).toArray();
              out.innerHTML = '<span class="k">全排列 P(' + pool.length + ') = ' + perms.length + ' 种：</span>\n<span class="v">' +
                perms.slice(0, 12).map((p) => "[" + p.join(",") + "]").join(" ") + (perms.length > 12 ? " …" : "") + "</span>\n" +
                '<span class="k">组合 C(' + pool.length + ',' + k + ') = ' + combs.length + ' 种：</span>\n<span class="v">' +
                combs.map((c) => "[" + c.join(",") + "]").join(" ") + "</span>";
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "幂集与笛卡尔积",
        code:
`Combinatorics.power(pool);                       // 幂集
Combinatorics.cartesianProduct(a, b).toArray();    // 笛卡尔积`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>集合 A</label><input type="text" data-a value="x, y" /></div>' +
            '<div class="field"><label>集合 B</label><input type="text" data-b value="1, 2, 3" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>枚举</button></div>', { single: true });
          function run() {
            try {
              const a = root.querySelector("[data-a]").value.split(",").map((x) => x.trim());
              const b = root.querySelector("[data-b]").value.split(",").map((x) => x.trim());
              const ps = Combinatorics.power(a).toArray();
              const cp = Combinatorics.cartesianProduct(a, b).toArray();
              out.innerHTML = '<span class="k">幂集（' + ps.length + '）：</span>\n<span class="v">' + ps.map((s) => "{" + s.join(",") + "}").join(" ") + "</span>\n" +
                '<span class="k">笛卡尔积 A×B（' + cp.length + '）：</span>\n<span class="v">' + cp.map((p) => "(" + p.join(",") + ")").join(" ") + "</span>";
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ===================== stdlib 生态 ===================== */
  DEMOS.stdlib = {
    tabs: [
      {
        label: "数论 / 特殊函数",
        code:
`import * as stdlib from '@stdlib/stdlib';
stdlib.math.base.special.gcd(12, 18);     // 6
stdlib.math.base.special.gamma(5);         // 24`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="btn-row"><button class="btn" data-run>调用 stdlib 函数</button></div>', { single: true });
          out.innerHTML = '<span class="muted">加载 @stdlib/stdlib（较大，请稍候）…</span>';
          loadESM("stdlib", "https://esm.sh/@stdlib/stdlib@0.4.1").then((m) => {
            const lib = def(m);
            function run() {
              try {
                const gcd = lib.math.base.special.gcd(12, 18);
                const gamma = lib.math.base.special.gamma(5);
                const erf = lib.math.base.special.erf ? lib.math.base.special.erf(1) : "(erf 不可用)";
                out.innerHTML = '<span class="k">gcd(12,18) = </span><span class="v">' + gcd + "</span>\n" +
                  '<span class="k">gamma(5) = </span><span class="v">' + gamma + "</span>\n" +
                  '<span class="k">erf(1) = </span><span class="v">' + erf + "</span>";
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
      {
        label: "正态 PDF 与随机",
        code:
`stdlib.stats.base.dists.normal.pdf(0, 0, 1);   // 概率密度
stdlib.random.base.randn();                     // 标准正态随机数`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="btn-row"><button class="btn" data-run>示例</button></div>', { single: true });
          out.innerHTML = '<span class="muted">加载 @stdlib/stdlib…</span>';
          loadESM("stdlib", "https://esm.sh/@stdlib/stdlib@0.4.1").then((m) => {
            const lib = def(m);
            function run() {
              try {
                const pdf = lib.stats.base.dists.normal.pdf(0, 0, 1);
                const sample = [lib.random.base.randn(), lib.random.base.randn(), lib.random.base.randn()].map((x) => x.toFixed(3));
                out.innerHTML = '<span class="k">N(0,1) 在 x=0 的 PDF = </span><span class="v">' + pdf.toFixed(4) + "</span>\n" +
                  '<span class="k">标准正态随机样本 = </span><span class="v">[' + sample.join(", ") + "]</span>";
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
    ],
  };

  /* ===================== 特殊函数：cephes ===================== */
  DEMOS.cephes = {
    tabs: [
      {
        label: "特殊函数",
        code:
`import cephes from 'cephes';
cephes.erf(1);      // 误差函数
cephes.gamma(5);    // 24
cephes.lgam(10);    // ln Γ(10)`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>x</label><input type="number" data-x value="1" step="0.1" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算</button></div>', { vizLabel: "Γ(x) 曲线" });
          const { c, ctx, w, h } = mkCanvas(440, 240);          out.innerHTML = '<span class="muted">加载 cephes…</span>';
          loadESM("cephes", "https://esm.sh/cephes@3.3.3").then((C) => {
            const cephes = def(C);
            function run() {
              try {
                const x = parseFloat(root.querySelector("[data-x]").value);
                out.innerHTML = '<span class="k">erf(' + x + ") = </span><span class=\"v\">" + cephes.erf(x).toFixed(6) + "</span>\n" +
                  '<span class="k">gamma(' + x + ") = </span><span class=\"v\">" + cephes.gamma(x).toFixed(6) + "</span>\n" +
                  '<span class="k">lnΓ(' + x + ") = </span><span class=\"v\">" + cephes.lgam(x).toFixed(6) + "</span>";
                const xs = [], gv = []; for (let xi = 0.1; xi <= 6; xi += 0.1) { xs.push(xi); gv.push(cephes.gamma(xi)); }
                const ymin = Math.min(...gv), ymax = Math.max(...gv);
                plot2D(ctx, w, h, { xmin: 0.1, xmax: 6, ymin, ymax }, (mx, my) => {
                  line(ctx, xs.map((xi, i) => [mx(xi), my(gv[i])]), css("--accent"), 2);
                });
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + "</span>");
        },
      },
    ],
  };

  /* ===================== 其他：d3-scale ===================== */
  DEMOS.d3scale = {
    tabs: [
      {
        label: "标度映射",
        code:
`import * as d3 from 'd3';
const s = d3.scaleLinear().domain([0,100]).range([0,500]);
s(50);                 // 250（数据→像素）
d3.scaleLog().domain([1,1000]).range([0,300]);`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>数据值</label><input type="number" data-v value="50" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>映射到像素</button></div>', { single: true });
          function run() {
            try {
              const v = +root.querySelector("[data-v]").value;
              const lin = d3.scaleLinear().domain([0, 100]).range([0, 500]);
              const log = d3.scaleLog().domain([1, 1000]).range([0, 300]);
              out.innerHTML = '<span class="k">线性 scaleLinear(0..100 → 0..500)：</span><span class="v">' + v + " → " + lin(v).toFixed(1) + " px</span>\n" +
                '<span class="k">对数 scaleLog(1..1000 → 0..300)：</span><span class="v">' + v + " → " + log(v).toFixed(1) + " px</span>";
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "颜色插值",
        code:
`d3.interpolateRgb('#ff5a5a', '#5a9bff')(0.5);   // 中间色
d3.interpolateRgb(...)(t);                        // t∈[0,1]`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>t（0~1）</label><input type="number" data-t value="0.5" step="0.05" min="0" max="1" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>插值</button></div>', { single: true });
          function run() {
            try {
              const t = +root.querySelector("[data-t]").value;
              const col = d3.interpolateRgb("#ff5a5a", "#5a9bff")(t);
              out.innerHTML = '<span class="k">插值色 = </span><span class="v">' + col + "</span>" +
                '<div style="width:100%;height:36px;margin-top:8px;border-radius:6px;background:' + col + '"></div>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + "</span>"; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ============================================================
   * 新增分类库 Demo（微积分 / 插值 / 拟合 / 样条 / 四元数 / 几何代数 /
   * 区间 / 复数 / 分形 / GPU / 稀疏 / 密码学 / 金融 / 时序 / 布尔）
   * ========================================================== */
  const fmt = D.fmt || ((n, d = 6) => (typeof n !== "number" || Number.isInteger(n)) ? String(n) : parseFloat(n.toFixed(d)).toString());
  const fmtArr = D.fmtArr || ((a, d = 3) => "[" + a.map((v) => fmt(v, d)).join(", ") + "]");

  /* ===================== 微分方程：odex ===================== */
  DEMOS.odex = {
    tabs: [
      {
        label: "标量 ODE",
        code:
`// odex：专注常微分方程数值求解，自适应步长、精度高
// new Solver(f, n) —— f(t, y) 返回 dy/dt，n 为方程维数
// solver.solve(t0, y0, tEnd, observer) 逐步回调 (tOld, t, y)
const s = new Solver((t, y) => [y[0]], 1);   // y' = y（指数增长）
const pts = [];
s.solve(0, [1], 2, (tOld, t, y) => pts.push([t, y[0]]));`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>方程</label><select data-sys>' +
              '<option value="exp">y\' = y（指数增长）</option>' +
              '<option value="logistic">y\' = 2y(1−y)（Logistic）</option></select></div>' +
            '<div class="field"><label>终点 tEnd</label><input type="number" data-te value="2" step="0.5" min="0.5" max="6" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>求解</button></div>',
            { vizLabel: "y(t) 解曲线" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          loadESM("odex", "https://esm.sh/odex@3.0.0-rc.4").then((mod) => {
            const Solver = mod.Solver || mod;
            function run() {
              try {
                const sys = root.querySelector("[data-sys]").value;
                const tEnd = +root.querySelector("[data-te]").value;
                let f, y0;
                if (sys === "exp") { f = (t, y) => [y[0]]; y0 = [1]; }
                else { f = (t, y) => [2 * y[0] * (1 - y[0])]; y0 = [0.1]; }
                const s = new Solver(f, 1);
                const pts = [];
                s.solve(0, y0, tEnd, (tOld, t, y) => pts.push([t, y[0]]));
                const ys = pts.map((p) => p[1]);
                let ymin = Math.min(...ys, 0), ymax = Math.max(...ys);
                const pad = (ymax - ymin) * 0.1 || 1;
                plot2D(ctx, w, h, { xmin: 0, xmax: tEnd, ymin: ymin - pad, ymax: ymax + pad },
                  (mx, my) => { line(ctx, pts.map((p) => [mx(p[0]), my(p[1])]), css("--accent"), 2.2); });
                const exact = sys === "exp" ? "e^t（t=2 时≈7.389）" : "1/(1+9·e^{-2t})（饱和于 1）";
                out.innerHTML = '<span class="k">方程 = </span><span class="v">' + (sys === "exp" ? "y' = y" : "y' = 2y(1−y)") + '</span>\n' +
                  '<span class="k">y(0) = </span>' + y0[0] + '  <span class="k">tEnd = </span>' + tEnd + '\n' +
                  '<span class="k">数值解 y(tEnd) = </span><span class="ok">' + fmt(ys[ys.length - 1], 6) + '</span>\n' +
                  '<span class="muted">解析参考：' + exact + '</span>';
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + '</span>');
        },
      },
      {
        label: "方程组（谐振子）",
        code:
`// 二阶方程 y'' = −y 化为一阶方程组：y0' = y1,  y1' = −y0
const f = (t, y) => [y[1], -y[0]];
const s = new Solver(f, 2);
const pts = [];
s.solve(0, [0, 1], 2*Math.PI, (tOld, t, y) => pts.push([t, y[0], y[1]]));`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>终点 tEnd</label><input type="number" data-te value="6.2832" step="1" min="1" max="20" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>求解</button></div>',
            { vizLabel: "y0(t) 与 y1(t)" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          loadESM("odex", "https://esm.sh/odex@3.0.0-rc.4").then((mod) => {
            const Solver = mod.Solver || mod;
            function run() {
              try {
                const tEnd = +root.querySelector("[data-te]").value;
                const f = (t, y) => [y[1], -y[0]];
                const s = new Solver(f, 2);
                const y0c = [], y1c = [];
                s.solve(0, [0, 1], tEnd, (tOld, t, y) => { y0c.push([t, y[0]]); y1c.push([t, y[1]]); });
                const all = y0c.concat(y1c).map((p) => p[1]);
                let ymin = Math.min(...all), ymax = Math.max(...all); const pad = (ymax - ymin) * 0.1 || 1;
                plot2D(ctx, w, h, { xmin: 0, xmax: tEnd, ymin: ymin - pad, ymax: ymax + pad },
                  (mx, my) => {
                    line(ctx, y0c.map((p) => [mx(p[0]), my(p[1])]), css("--accent"), 2.2);
                    line(ctx, y1c.map((p) => [mx(p[0]), my(p[1])]), css("--accent-3"), 1.8);
                    ctx.fillStyle = css("--accent"); ctx.font = "11px monospace"; ctx.textAlign = "left";
                    ctx.fillText("y0=sin(t)", 54, 20); ctx.fillStyle = css("--accent-3"); ctx.fillText("y1=cos(t)", 124, 20);
                  });
                out.innerHTML = '<span class="k">方程组 </span><span class="v">y0\'=y1, y1\'=−y0</span>\n' +
                  '<span class="k">初值 </span>y0(0)=0, y1(0)=1 → 应得 y0=sin(t), y1=cos(t)\n' +
                  '<span class="k">y0(tEnd)=</span><span class="ok">' + fmt(y0c[y0c.length - 1][1], 4) + '</span>  ' +
                  '<span class="muted">(sin(tEnd)=' + fmt(Math.sin(tEnd), 4) + ')</span>';
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + '</span>');
        },
      },
    ],
  };

  /* ===================== 数值积分：numeric.integrate + Simpson ===================== */
  DEMOS.integral = {
    tabs: [
      {
        label: "定积分对比",
        code:
`// numeric.js 的 integrate 直接算定积分；再用手写复合 Simpson 对照
const f = (x) => Math.sin(x) + x*x/10;
const I1 = numeric.integrate(f, 0, Math.PI);     // 库函数
function simpson(f, a, b, n) {                    // 手写对照
  if (n % 2) n++;
  const h = (b - a) / n; let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i*h) * (i % 2 ? 4 : 2);
  return s * h / 3;
}
const I2 = simpson(f, 0, Math.PI, 400);`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>被积函数 f(x)（JS 表达式）</label><input type="text" data-fx value="Math.sin(x) + x*x/10" /></div>' +
            '<div class="field"><label>积分区间 a, b</label><div class="range-row"><input type="number" data-a value="0" step="0.5" /> <input type="number" data-b value="3.1416" step="0.5" /></div></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算</button></div>',
            { vizLabel: "f(x) 与积分面积" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          function simpson(fn, a, b, n) {
            if (n % 2) n++; const h = (b - a) / n; let s = fn(a) + fn(b);
            for (let i = 1; i < n; i++) s += fn(a + i * h) * (i % 2 ? 4 : 2);
            return s * h / 3;
          }
          function run() {
            try {
              if (!window.numeric) throw new Error("numeric 未加载");
              const fx = root.querySelector("[data-fx]").value;
              const a = +root.querySelector("[data-a]").value, b = +root.querySelector("[data-b]").value;
              const F = new Function("x", "return (" + fx + ");");
              const I1 = numeric.integrate(F, a, b);
              const I2 = simpson(F, a, b, 400);
              const xs = [], fv = [];
              const span = (b - a) + 1;
              for (let x = a - 0.5; x <= b + 0.5; x += span / 120) { xs.push(x); fv.push(F(x)); }
              const all = fv.concat([0]); const ymin = Math.min(...all), ymax = Math.max(...all);
              const pad = (ymax - ymin) * 0.1 || 1;
              plot2D(ctx, w, h, { xmin: xs[0], xmax: xs[xs.length - 1], ymin: ymin - pad, ymax: ymax + pad },
                (mx, my) => {
                  ctx.fillStyle = "rgba(124,140,255,0.18)";
                  ctx.beginPath(); ctx.moveTo(mx(a), my(0));
                  for (let x = a; x <= b; x += (b - a) / 240) ctx.lineTo(mx(x), my(F(x)));
                  ctx.lineTo(mx(b), my(0)); ctx.closePath(); ctx.fill();
                  line(ctx, xs.map((x, i) => [mx(x), my(fv[i])]), css("--accent"), 2.2);
                });
              out.innerHTML = '<span class="k">∫<sub>a</sub><sup>b</sup></span> <span class="v">' + fx + ' dx</span>\n' +
                '<span class="k">a = </span>' + fmt(a, 3) + '   <span class="k">b = </span>' + fmt(b, 3) + '\n' +
                '<span class="k">numeric.integrate = </span><span class="ok">' + fmt(I1, 6) + '</span>\n' +
                '<span class="k">手写 Simpson(400) = </span><span class="ok">' + fmt(I2, 6) + '</span>\n' +
                '<span class="muted">两者应非常接近。</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ===================== 回归拟合：regression-js ===================== */
  DEMOS.regression = {
    tabs: [
      {
        label: "拟合 + 可视化",
        code:
`// regression-js：一行得到方程、R² 与预测函数
const data = [[0,1],[1,3],[2,5],[3,7],[4,9]];
const lin = regression.linear(data);     // 线性回归
lin.equation;        // [斜率, 截距]
lin.r2;              // 决定系数
lin.predict(5);      // [5, 11] 预测`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>模型</label><select data-type>' +
              '<option value="linear">线性</option><option value="polynomial">多项式(2次)</option>' +
              '<option value="exponential">指数</option><option value="logarithmic">对数</option>' +
              '<option value="power">幂</option></select></div>' +
            '<div class="field"><label>样本数 n</label><input type="number" data-n value="20" min="6" max="60" /></div>' +
            '<div class="field"><label>噪声幅度</label><input type="number" data-noise value="3" step="0.5" min="0" max="20" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>生成并拟合</button></div>',
            { vizLabel: "数据点与拟合曲线" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          loadESM("regression", "https://esm.sh/regression@2.0.1").then((mod) => {
            const reg = mod.default || mod;
            function run() {
              try {
                const type = root.querySelector("[data-type]").value;
                const n = +root.querySelector("[data-n]").value;
                const noise = +root.querySelector("[data-noise]").value;
                const data = [];
                for (let i = 0; i < n; i++) {
                  const x = i / (n - 1) * 10; let y;
                  if (type === "linear") y = 2 * x + 1;
                  else if (type === "polynomial") y = 0.5 * x * x - 2 * x + 3;
                  else if (type === "exponential") y = 3 * Math.exp(0.3 * x);
                  else if (type === "logarithmic") y = 4 * Math.log(x + 1);
                  else y = 2 * Math.pow(x + 1, 1.3);
                  y += (Math.random() * 2 - 1) * noise; data.push([x, y]);
                }
                const opts = type === "polynomial" ? { order: 2 } : {};
                const res = reg[type](data, opts);
                const xs = data.map((p) => p[0]); const xmin = 0, xmax = 10;
                const ys = data.map((p) => p[1]);
                const fy = data.map((p) => res.predict(p[0])[1]);
                const all = ys.concat(fy); let ymin = Math.min(...all), ymax = Math.max(...all);
                const pad = (ymax - ymin) * 0.1 || 1;
                plot2D(ctx, w, h, { xmin, xmax, ymin: ymin - pad, ymax: ymax + pad },
                  (mx, my) => {
                    ctx.fillStyle = css("--accent");
                    data.forEach((p) => { ctx.beginPath(); ctx.arc(mx(p[0]), my(p[1]), 2.6, 0, 7); ctx.fill(); });
                    const linePts = []; for (let x = xmin; x <= xmax; x += 0.1) linePts.push([mx(x), my(res.predict(x)[1])]);
                    line(ctx, linePts, css("--accent-3"), 2.2);
                  });
                out.innerHTML = '<span class="k">模型 </span><span class="v">' + type + '</span>  <span class="k">R² = </span><span class="ok">' + fmt(res.r2, 5) + '</span>\n' +
                  '<span class="k">方程系数 = </span><span class="v">[' + res.equation.map((v) => fmt(v, 3)).join(", ") + ']</span>\n' +
                  '<span class="muted">点=样本，线=拟合（' + (type === "polynomial" ? "2 次多项式" : type) + '）</span>';
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + '</span>');
        },
      },
    ],
  };

  /* ===================== d3-shape 曲线插值 ===================== */
  DEMOS.d3curve = {
    tabs: [
      {
        label: "曲线插值器对比",
        code:
`// d3-shape 的曲线生成器决定离散点之间如何弯曲
const line = d3.line().curve(d3.curveBasis);
const d = line(points);   // 生成 SVG path 的 d 属性
// 可选：curveLinear / curveBasis / curveCardinal / curveCatmullRom / curveStep`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>预设数据点</label><input type="text" data-pts value="20,140 90,40 160,150 230,60 300,130" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>绘制</button></div>', { single: true });
          function run() {
            try {
              if (!window.d3) throw new Error("d3 未加载");
              const pts = root.querySelector("[data-pts]").value.trim().split(/\s+/).map((s) => s.split(",").map(Number));
              const curves = [["curveLinear", "linear"], ["curveBasis", "basis"], ["curveCardinal", "cardinal"], ["curveCatmullRom", "catmullRom"]];
              const colors = ["#7c8cff", "#4dd0ff", "#c47cff", "#ffb15e"];
              const W = 340, H = 180, sc = 1;
              let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="220" style="background:' + css("--code-bg") + '">';
              pts.forEach((p) => { svg += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3" fill="#ff6b6b"/>'; });
              curves.forEach((cv, i) => {
                const gen = d3.line().curve(d3[cv[0]]);
                svg += '<path d="' + gen(pts) + '" fill="none" stroke="' + colors[i] + '" stroke-width="2"/>';
              });
              svg += '</svg>';
              out.innerHTML = '<div style="max-width:360px">' + svg + '</div>' +
                '<div class="muted">红点=控制点；四条曲线分别为 linear / basis / cardinal / catmullRom。</div>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ===================== 三次样条：cubic-spline ===================== */
  DEMOS.cubicspline = {
    tabs: [
      {
        label: "自然三次样条",
        code:
`// cubic-spline：构造穿过所有给定点、整体最光滑(C²)的插值曲线
const sp = new Spline(xs, ys);   // xs, ys 为等长的坐标数组
sp.at(1.5);                      // 在任意 x 处求值`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>数据点 (x,y 一行一个)</label><textarea data-pts rows="4">0,0\n1,1\n2,0\n3,1\n4,0</textarea></div>' +
            '<div class="field"><label>查询 x</label><input type="number" data-xq value="1.5" step="0.1" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>插值</button></div>',
            { vizLabel: "样条曲线" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          loadESM("cubicSpline", "https://esm.sh/cubic-spline@3.0.3").then((mod) => {
            const Spline = mod.Spline || mod;
            function run() {
              try {
                const rows = root.querySelector("[data-pts]").value.trim().split("\n").map((r) => r.split(",").map(Number));
                const xs = rows.map((r) => r[0]), ys = rows.map((r) => r[1]);
                const sp = new Spline(xs, ys);
                const xq = +root.querySelector("[data-xq]").value;
                const yq = sp.at(xq);
                const xmin = Math.min(...xs), xmax = Math.max(...xs);
                const alld = ys.concat([yq]); let ymin = Math.min(...alld), ymax = Math.max(...alld);
                const pad = (ymax - ymin) * 0.15 || 1;
                const samp = [];
                for (let x = xmin; x <= xmax; x += (xmax - xmin) / 200) samp.push([x, sp.at(x)]);
                plot2D(ctx, w, h, { xmin, xmax, ymin: ymin - pad, ymax: ymax + pad },
                  (mx, my) => {
                    ctx.fillStyle = css("--accent");
                    rows.forEach((p) => { ctx.beginPath(); ctx.arc(mx(p[0]), my(p[1]), 3, 0, 7); ctx.fill(); });
                    line(ctx, samp.map((p) => [mx(p[0]), my(p[1])]), css("--accent-3"), 2.2);
                    ctx.fillStyle = "#ff6b6b"; ctx.beginPath(); ctx.arc(mx(xq), my(yq), 4, 0, 7); ctx.fill();
                  });
                out.innerHTML = '<span class="k">样条在 x=' + fmt(xq, 2) + ' 处 = </span><span class="ok">' + fmt(yq, 5) + '</span>\n' +
                  '<span class="muted">曲线穿过全部 ' + xs.length + ' 个控制点且二阶连续可导。</span>';
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + '</span>');
        },
      },
    ],
  };

  /* ===================== bezier-js ===================== */
  DEMOS.bezier = {
    tabs: [
      {
        label: "三次贝塞尔 + 采样",
        code:
`// bezier-js：贝塞尔曲线的数学工具集
const b = new Bezier([{x:0,y:0},{x:0,y:100},{x:100,y:100},{x:100,y:0}]);
b.length();        // 曲线长度
b.get(0.5);        // 参数 t=0.5 处的点 {x,y}
b.getLUT(50);      // 等距查找表（采样点）`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>4 个控制点 (x,y)</label><textarea data-pts rows="3">20,140\n90,40\n160,150\n300,70</textarea></div>' +
            '<div class="btn-row"><button class="btn" data-run>绘制</button></div>',
            { vizLabel: "贝塞尔曲线与控制多边形" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          loadESM("Bezier", "https://esm.sh/bezier-js@6.1.4").then((mod) => {
            const Bezier = mod.Bezier || mod;
            function run() {
              try {
                const pts = root.querySelector("[data-pts]").value.trim().split("\n").map((r) => { const v = r.split(",").map(Number); return { x: v[0], y: v[1] }; });
                const b = new Bezier(pts);
                const lut = b.getLUT(60);
                const xmin = Math.min(...pts.map((p) => p.x)), xmax = Math.max(...pts.map((p) => p.x));
                const ymin = Math.min(...pts.map((p) => p.y)), ymax = Math.max(...pts.map((p) => p.y));
                const pad = 20;
                plot2D(ctx, w, h, { xmin: xmin - pad, xmax: xmax + pad, ymin: ymin - pad, ymax: ymax + pad },
                  (mx, my) => {
                    ctx.strokeStyle = "rgba(255,107,107,0.6)"; ctx.lineWidth = 1.2; ctx.setLineDash([4, 3]);
                    ctx.beginPath(); ctx.moveTo(mx(pts[0].x), my(pts[0].y)); pts.forEach((p) => ctx.lineTo(mx(p.x), my(p.y))); ctx.stroke(); ctx.setLineDash([]);
                    line(ctx, lut.map((p) => [mx(p.x), my(p.y)]), css("--accent-3"), 2.4);
                    ctx.fillStyle = "#ff6b6b";
                    pts.forEach((p) => { ctx.beginPath(); ctx.arc(mx(p.x), my(p.y), 4, 0, 7); ctx.fill(); });
                  });
                out.innerHTML = '<span class="k">曲线长度 = </span><span class="ok">' + fmt(b.length(), 2) + '</span>\n' +
                  '<span class="k">中点 t=0.5 = </span><span class="v">(' + fmt(b.get(0.5).x, 1) + ', ' + fmt(b.get(0.5).y, 1) + ')</span>\n' +
                  '<span class="muted">红点=控制点，红虚线=控制多边形，蓝线=贝塞尔曲线。</span>';
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + '</span>');
        },
      },
    ],
  };

  /* ===================== curve-interpolator ===================== */
  DEMOS.curveint = {
    tabs: [
      {
        label: "曲线插值 + 切线",
        code:
`// curve-interpolator：把离散点连成光滑曲线，并可求任意点/切线
const ci = new CurveInterpolator([[0,0],[10,20],[30,10],[50,40]]);
ci.getPointAt(0.5);      // t∈[0,1] 处的点
ci.getTangentAt(0.5);    // 该点切线方向
ci.getPoints(20);        // 重采样出 20 个点`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>数据点 (x,y 一行一个)</label><textarea data-pts rows="3">20,160\n120,40\n220,150\n320,60</textarea></div>' +
            '<div class="field"><label>参数 t (0~1)</label><input type="number" data-t value="0.5" step="0.01" min="0" max="1" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>插值</button></div>',
            { vizLabel: "曲线与点/切线" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          loadESM("CurveInterpolator", "https://esm.sh/curve-interpolator@3.3.1").then((mod) => {
            const CI = mod.CurveInterpolator || mod;
            function run() {
              try {
                const pts = root.querySelector("[data-pts]").value.trim().split("\n").map((r) => r.split(",").map(Number));
                const t = +root.querySelector("[data-t]").value;
                const ci = new CI(pts);
                const p = ci.getPointAt(t), tg = ci.getTangentAt(t);
                const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
                const rs = ci.getPoints(40);
                const allx = xs.concat(rs.map((q) => q[0])), ally = ys.concat(rs.map((q) => q[1]));
                const xmin = Math.min(...allx), xmax = Math.max(...allx);
                const ymin = Math.min(...ally), ymax = Math.max(...ally);
                const pad = 18;
                plot2D(ctx, w, h, { xmin: xmin - pad, xmax: xmax + pad, ymin: ymin - pad, ymax: ymax + pad },
                  (mx, my) => {
                    line(ctx, rs.map((q) => [mx(q[0]), my(q[1])]), css("--accent-3"), 2.2);
                    ctx.fillStyle = "#ff6b6b";
                    pts.forEach((q) => { ctx.beginPath(); ctx.arc(mx(q[0]), my(q[1]), 3.5, 0, 7); ctx.fill(); });
                    ctx.fillStyle = css("--accent"); ctx.beginPath(); ctx.arc(mx(p[0]), my(p[1]), 4.5, 0, 7); ctx.fill();
                    arrow(ctx, mx(p[0]), my(p[1]), mx(p[0] + tg.x * 18), my(p[1] + tg.y * 18), css("--accent"));
                  });
                out.innerHTML = '<span class="k">t=' + fmt(t, 2) + ' 处点 = </span><span class="ok">(' + fmt(p[0], 1) + ', ' + fmt(p[1], 1) + ')</span>\n' +
                  '<span class="k">切线方向 = </span><span class="v">(' + fmt(tg.x, 2) + ', ' + fmt(tg.y, 2) + ')</span>\n' +
                  '<span class="muted">蓝线=插值曲线，箭头=该点切线。</span>';
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + '</span>');
        },
      },
    ],
  };

  /* ===================== 四元数：quaternion.js ===================== */
  DEMOS.quaternion = {
    tabs: [
      {
        label: "绕轴旋转向量",
        code:
`// quaternion.js：用单位四元数表示 3D 旋转
const q = Quaternion.fromAxisAngle([0, 0, 1], Math.PI/2);  // 绕 z 轴转 90°
const v = q.rotateVector([1, 0, 0]);                       // → [0, 1, 0]
q.toMatrix();                       // 对应旋转矩阵`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>旋转轴</label><select data-axis><option value="z">z 轴</option><option value="x">x 轴</option><option value="y">y 轴</option></select></div>' +
            '<div class="field"><label>角度 θ (°)</label><input type="number" data-ang value="90" step="5" min="-360" max="360" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>旋转</button></div>',
            { vizLabel: "旋转前后向量" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          function run() {
            try {
              if (!window.Quaternion) throw new Error("quaternion 未加载");
              const Q = window.Quaternion;
              const ax = root.querySelector("[data-axis]").value;
              const axis = ax === "x" ? [1, 0, 0] : ax === "y" ? [0, 1, 0] : [0, 0, 1];
              const ang = +root.querySelector("[data-ang]").value * Math.PI / 180;
              const q = Q.fromAxisAngle(axis, ang);
              const v = q.rotateVector([1, 0, 0]);
              const m = q.toMatrix();
              // 用前两个分量投影到画布（xy 平面）
              function drawVec(vec, color, label) {
                ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.4;
                ctx.beginPath(); ctx.moveTo(mx(0), my(0)); ctx.lineTo(mx(vec[0]), my(vec[1])); ctx.stroke();
                ctx.beginPath(); ctx.arc(mx(vec[0]), my(vec[1]), 4, 0, 7); ctx.fill();
                ctx.font = "11px monospace"; ctx.fillText(label, mx(vec[0]) + 6, my(vec[1]));
              }
              const xmin = -1.6, xmax = 1.6, ymin = -1.6, ymax = 1.6;
              const { mx, my } = (function () {
                const pad = { l: 40, r: 16, t: 16, b: 28 }, iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
                const mapX = (x) => pad.l + (x - xmin) / (xmax - xmin) * iw;
                const mapY = (y) => pad.t + ih - (y - ymin) / (ymax - ymin) * ih;
                return { mx: mapX, my: mapY };
              })();
              ctx.clearRect(0, 0, w, h); ctx.fillStyle = css("--code-bg"); ctx.fillRect(0, 0, w, h);
              ctx.strokeStyle = css("--border-soft"); ctx.lineWidth = 1;
              ctx.beginPath(); ctx.moveTo(mx(0), my(ymin)); ctx.lineTo(mx(0), my(ymax)); ctx.moveTo(mx(xmin), my(0)); ctx.lineTo(mx(xmax), my(0)); ctx.stroke();
              drawVec([1, 0, 0], "#ff6b6b", "原 [1,0,0]");
              drawVec(v, css("--accent"), "旋转后");
              out.innerHTML = '<span class="k">旋转轴 = </span><span class="v">' + ax + '</span>  <span class="k">θ = </span>' + root.querySelector("[data-ang]").value + '°\n' +
                '<span class="k">旋转后向量(3D) = </span><span class="ok">[' + fmt(v[0], 3) + ', ' + fmt(v[1], 3) + ', ' + fmt(v[2], 3) + ']</span>\n' +
                '<span class="k">旋转矩阵(前 3×3) = </span><span class="v">[' + m.slice(0, 3).map((x) => fmt(x, 2)).join(", ") + ', …]</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "组合旋转 (mul) + slerp",
        code:
`// 四元数乘法 = 旋转的组合；slerp = 球面线性插值（手动实现）
const q1 = Quaternion.fromAxisAngle([0,0,1], Math.PI/4);
const q2 = Quaternion.fromAxisAngle([1,0,0], Math.PI/4);
const q = q1.mul(q2);            // 组合两个旋转
// slerp(q1, q2, t) 在两姿态间平滑插值`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>插值参数 t (0~1)</label><input type="number" data-t value="0.5" step="0.05" min="0" max="1" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>插值并旋转</button></div>',
            { vizLabel: "slerp 轨迹（旋转 [1,0,0]）" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          function run() {
            try {
              if (!window.Quaternion) throw new Error("quaternion 未加载");
              const Q = window.Quaternion;
              const q1 = Q.fromAxisAngle([0, 0, 1], Math.PI / 4);
              const q2 = Q.fromAxisAngle([1, 0, 0], Math.PI / 4);
              const combined = q1.mul(q2);
              const vC = combined.rotateVector([1, 0, 0]);
              const t = +root.querySelector("[data-t]").value;
              // 手动 slerp
              const a = q1, b = q2;
              let dot = a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z;
              let bb = b; if (dot < 0) { bb = new Q(-b.w, -b.x, -b.y, -b.z); dot = -dot; }
              let qt;
              if (dot > 0.9995) { qt = new Q(a.w + (bb.w - a.w) * t, a.x + (bb.x - a.x) * t, a.y + (bb.y - a.y) * t, a.z + (bb.z - a.z) * t).normalize(); }
              else { const th0 = Math.acos(dot), th = th0 * t, s0 = Math.cos(th) - dot * Math.sin(th) / Math.sin(th0), s1 = Math.sin(th) / Math.sin(th0); qt = new Q(a.w * s0 + bb.w * s1, a.x * s0 + bb.x * s1, a.y * s0 + bb.y * s1, a.z * s0 + bb.z * s1); }
              const vT = qt.rotateVector([1, 0, 0]);
              const xmin = -1.6, xmax = 1.6, ymin = -1.6, ymax = 1.6;
              ctx.clearRect(0, 0, w, h); ctx.fillStyle = css("--code-bg"); ctx.fillRect(0, 0, w, h);
              const pad = { l: 40, r: 16, t: 16, b: 28 }, iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
              const mx = (x) => pad.l + (x - xmin) / (xmax - xmin) * iw;
              const my = (y) => pad.t + ih - (y - ymin) / (ymax - ymin) * ih;
              ctx.strokeStyle = css("--border-soft"); ctx.lineWidth = 1;
              ctx.beginPath(); ctx.moveTo(mx(0), my(ymin)); ctx.lineTo(mx(0), my(ymax)); ctx.moveTo(mx(xmin), my(0)); ctx.lineTo(mx(xmax), my(0)); ctx.stroke();
              // 轨迹
              const traj = [];
              for (let s = 0; s <= 1.0001; s += 0.02) {
                let d2 = a.w * bb.w + a.x * bb.x + a.y * bb.y + a.z * bb.z; let b2 = bb; if (d2 < 0) { b2 = new Q(-bb.w, -bb.x, -bb.y, -bb.z); d2 = -d2; }
                let q2b; if (d2 > 0.9995) q2b = new Q(a.w + (b2.w - a.w) * s, a.x + (b2.x - a.x) * s, a.y + (b2.y - a.y) * s, a.z + (b2.z - a.z) * s).normalize();
                else { const t0 = Math.acos(d2), tt = t0 * s, u0 = Math.cos(tt) - d2 * Math.sin(tt) / Math.sin(t0), u1 = Math.sin(tt) / Math.sin(t0); q2b = new Q(a.w * u0 + b2.w * u1, a.x * u0 + b2.x * u1, a.y * u0 + b2.y * u1, a.z * u0 + b2.z * u1); }
                traj.push([mx(q2b.rotateVector([1, 0, 0])[0]), my(q2b.rotateVector([1, 0, 0])[1])]);
              }
              line(ctx, traj, "rgba(124,140,255,0.5)", 1.6);
              ctx.fillStyle = css("--accent"); ctx.beginPath(); ctx.arc(mx(vT[0]), my(vT[1]), 5, 0, 7); ctx.fill();
              ctx.fillStyle = "#ff6b6b"; ctx.beginPath(); ctx.arc(mx(vC[0]), my(vC[1]), 4, 0, 7); ctx.fill();
              out.innerHTML = '<span class="k">q1·q2 旋转后(红) = </span><span class="v">[' + fmt(vC[0], 3) + ', ' + fmt(vC[1], 3) + ', ' + fmt(vC[2], 3) + ']</span>\n' +
                '<span class="k">slerp(t=' + fmt(t, 2) + ') 旋转后(蓝) = </span><span class="ok">[' + fmt(vT[0], 3) + ', ' + fmt(vT[1], 3) + ', ' + fmt(vT[2], 3) + ']</span>\n' +
                '<span class="muted">蓝点沿球面弧线从 q1 姿态滑向 q2 姿态。</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ===================== 几何代数：ganja.js ===================== */
  DEMOS.ganja = {
    tabs: [
      {
        label: "几何积 (2D)",
        code:
`// ganja.js：几何代数 / Clifford Algebra
const g = new Algebra(2);                 // 2 维空间
const v1 = g.Vector([1, 2]);
const v2 = g.Vector([3, 1]);
g.Mul(v1, v2);   // 几何积 = 内积(标量) + 外积(双向量)`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>向量 v1 (x,y)</label><input type="text" data-v1 value="1, 2" /></div>' +
            '<div class="field"><label>向量 v2 (x,y)</label><input type="text" data-v2 value="3, 1" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算几何积</button></div>',
            { vizLabel: "v1, v2 向量" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          loadESM("ganja", "https://esm.sh/ganja.js@1.0.204").then((mod) => {
            const Algebra = mod.default || mod;
            function run() {
              try {
                const g = new Algebra(2);
                const v1 = g.Vector(root.querySelector("[data-v1]").value.split(",").map(Number));
                const v2 = g.Vector(root.querySelector("[data-v2]").value.split(",").map(Number));
                const prod = g.Mul(v1, v2);
                const wedge = g.Wedge(v1, v2);
                const xmin = -4, xmax = 4, ymin = -4, ymax = 4;
                ctx.clearRect(0, 0, w, h); ctx.fillStyle = css("--code-bg"); ctx.fillRect(0, 0, w, h);
                const pad = { l: 40, r: 16, t: 16, b: 28 }, iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
                const mx = (x) => pad.l + (x - xmin) / (xmax - xmin) * iw;
                const my = (y) => pad.t + ih - (y - ymin) / (ymax - ymin) * ih;
                ctx.strokeStyle = css("--border-soft"); ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(mx(0), my(ymin)); ctx.lineTo(mx(0), my(ymax)); ctx.moveTo(mx(xmin), my(0)); ctx.lineTo(mx(xmax), my(0)); ctx.stroke();
                const dv1 = v1.toArray ? v1.toArray() : [v1[0], v1[1]];
                const dv2 = v2.toArray ? v2.toArray() : [v2[0], v2[1]];
                arrow(ctx, mx(0), my(0), mx(dv1[0]), my(dv1[1]), css("--accent"), "v1");
                arrow(ctx, mx(0), my(0), mx(dv2[0]), my(dv2[1]), css("--accent-3"), "v2");
                out.innerHTML = '<span class="k">几何积 v1·v2 = </span><span class="ok">' + prod.toString() + '</span>\n' +
                  '<span class="k">外积 v1∧v2 = </span><span class="v">' + wedge.toString() + '</span>\n' +
                  '<span class="muted">几何积 = (内积标量) + (外积双向量)；外积量级 = 两向量张成的有向面积。</span>';
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + '</span>');
        },
      },
    ],
  };

  /* ===================== 区间运算：interval-arithmetic ===================== */
  DEMOS.interval = {
    tabs: [
      {
        label: "区间运算传播",
        code:
`// interval-arithmetic：把不确定量表示为区间 [lo, hi]，运算自动传播误差范围
const a = new Interval(2, 3);
const b = new Interval(4, 5);
Interval.add(a, b);   // [6, 8]
Interval.mul(a, b);   // [8, 15]`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>区间 a = [lo, hi]</label><div class="range-row"><input type="number" data-a1 value="2" step="0.5" /> <input type="number" data-a2 value="3" step="0.5" /></div></div>' +
            '<div class="field"><label>区间 b = [lo, hi]</label><div class="range-row"><input type="number" data-b1 value="4" step="0.5" /> <input type="number" data-b2 value="5" step="0.5" /></div></div>' +
            '<div class="btn-row"><button class="btn" data-run>运算</button></div>', { single: true });
          loadESM("Interval", "https://esm.sh/interval-arithmetic@1.1.3").then((mod) => {
            const IA = mod.default || mod;
            function run() {
              try {
                const a = new IA.Interval(+root.querySelector("[data-a1]").value, +root.querySelector("[data-a2]").value);
                const b = new IA.Interval(+root.querySelector("[data-b1]").value, +root.querySelector("[data-b2]").value);
                const add = IA.add(a, b), mul = IA.mul(a, b), sub = IA.sub(a, b), div = IA.div(a, b);
                const fmtI = (x) => "[" + fmt(x.lo, 3) + ", " + fmt(x.hi, 3) + "]";
                out.innerHTML = '<span class="k">a = </span><span class="v">' + fmtI(a) + '</span>   <span class="k">b = </span><span class="v">' + fmtI(b) + '</span>\n' +
                  '<span class="k">a + b = </span><span class="ok">' + fmtI(add) + '</span>\n' +
                  '<span class="k">a − b = </span><span class="v">' + fmtI(sub) + '</span>\n' +
                  '<span class="k">a × b = </span><span class="ok">' + fmtI(mul) + '</span>\n' +
                  '<span class="k">a ÷ b = </span><span class="v">' + fmtI(div) + '</span>\n' +
                  '<span class="muted">结果区间保证包含真实值的所有可能，用于误差/不确定性分析。</span>';
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + '</span>');
        },
      },
    ],
  };

  /* ===================== 复数：complex.js ===================== */
  DEMOS.complex = {
    tabs: [
      {
        label: "复数运算",
        code:
`// complex.js：轻量专注的复数运算库
const z1 = new Complex(3, 4);
const z2 = new Complex(1, -2);
z1.add(z2);    // 加
z1.mul(z2);    // 乘
z1.abs();      // 模 = 5
z1.arg();      // 辐角`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>z1 = a + bi</label><div class="range-row"><input type="number" data-z1a value="3" step="0.5" /> <input type="number" data-z1b value="4" step="0.5" /></div></div>' +
            '<div class="field"><label>z2 = a + bi</label><div class="range-row"><input type="number" data-z2a value="1" step="0.5" /> <input type="number" data-z2b value="-2" step="0.5" /></div></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算</button></div>',
            { vizLabel: "复平面" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          function run() {
            try {
              if (!window.Complex) throw new Error("complex.js 未加载");
              const C = window.Complex;
              const z1 = new C(+root.querySelector("[data-z1a]").value, +root.querySelector("[data-z1b]").value);
              const z2 = new C(+root.querySelector("[data-z2a]").value, +root.querySelector("[data-z2b]").value);
              const xmin = -8, xmax = 8, ymin = -8, ymax = 8;
              ctx.clearRect(0, 0, w, h); ctx.fillStyle = css("--code-bg"); ctx.fillRect(0, 0, w, h);
              const pad = { l: 40, r: 16, t: 16, b: 28 }, iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
              const mx = (x) => pad.l + (x - xmin) / (xmax - xmin) * iw;
              const my = (y) => pad.t + ih - (y - ymin) / (ymax - ymin) * ih;
              ctx.strokeStyle = css("--border-soft"); ctx.lineWidth = 1;
              ctx.beginPath(); ctx.moveTo(mx(0), my(ymin)); ctx.lineTo(mx(0), my(ymax)); ctx.moveTo(mx(xmin), my(0)); ctx.lineTo(mx(xmax), my(0)); ctx.stroke();
              const drawZ = (z, col, lab) => { ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(mx(0), my(0)); ctx.lineTo(mx(z.re), my(z.im)); ctx.stroke(); ctx.beginPath(); ctx.arc(mx(z.re), my(z.im), 4, 0, 7); ctx.fill(); ctx.font = "11px monospace"; ctx.fillText(lab, mx(z.re) + 6, my(z.im)); };
              drawZ(z1, css("--accent"), "z1");
              drawZ(z2, css("--accent-3"), "z2");
              const prod = z1.mul(z2);
              drawZ(prod, "#ff6b6b", "z1·z2");
              out.innerHTML = '<span class="k">z1 = </span><span class="v">' + z1.toString() + '</span>  |z1| = ' + fmt(z1.abs(), 3) + '\n' +
                '<span class="k">z2 = </span><span class="v">' + z2.toString() + '</span>  |z2| = ' + fmt(z2.abs(), 3) + '\n' +
                '<span class="k">z1+z2 = </span><span class="ok">' + z1.add(z2).toString() + '</span>\n' +
                '<span class="k">z1·z2 = </span><span class="ok">' + prod.toString() + '</span>  (红)\n' +
                '<span class="k">z1/z2 = </span><span class="v">' + z1.div(z2).toString() + '</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ===================== 分形：Mandelbrot / Julia (complex.js) ===================== */
  DEMOS.mandelbrot = {
    tabs: [
      {
        label: "Mandelbrot 集",
        code:
`// 用 complex.js 迭代 z = z² + c，逃逸时间着色
function iter(c, N) {
  let z = new Complex(0, 0);
  for (let i = 0; i < N; i++) {
    if (z.abs() > 2) return i;
    z = z.mul(z).add(c);
  }
  return N;
}`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>迭代上限 N</label><input type="number" data-n value="80" step="10" min="20" max="300" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>渲染</button></div>', { single: true });
          function run() {
            try {
              if (!window.Complex) throw new Error("complex.js 未加载");
              const C = window.Complex;
              const N = +root.querySelector("[data-n]").value;
              const W = 330, H = 230;
              const cv = document.createElement("canvas"); cv.width = W; cv.height = H; cv.style.width = "100%"; cv.style.maxWidth = "360px"; cv.style.borderRadius = "8px";
              const cx = cv.getContext("2d");
              const img = cx.createImageData(W, H);
              for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
                const cre = -2.5 + (px / W) * 3.5, cim = -1.15 + (py / H) * 2.3;
                const c = new C(cre, cim);
                let z = new C(0, 0), it = N;
                for (let i = 0; i < N; i++) { if (z.abs() > 2) { it = i; break; } z = z.mul(z).add(c); }
                const k = (it / N);
                const r = Math.floor(40 + 215 * (1 - k)), g = Math.floor(20 + 180 * (1 - k * k)), b = Math.floor(60 + 195 * k);
                const idx = (py * W + px) * 4; img.data[idx] = r; img.data[idx + 1] = g; img.data[idx + 2] = b; img.data[idx + 3] = 255;
              }
              cx.putImageData(img, 0, 0);
              out.innerHTML = ''; out.appendChild(cv);
              out.insertAdjacentHTML("beforeend", '<div class="muted">黑色=收敛于集内；彩色=逃逸时间。用 complex.js 完成 z²+c 复数迭代。</div>');
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "Julia 集",
        code:
`// 固定参数 c，迭代 z = z² + c（初值 z0 = 像素坐标）
const c = new Complex(-0.8, 0.156);   // 经典 Julia 参数
let z = new Complex(px, py);
for (...) z = z.mul(z).add(c);`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>参数 c = a + bi</label><div class="range-row"><input type="number" data-ca value="-0.8" step="0.05" /> <input type="number" data-cb value="0.156" step="0.05" /></div></div>' +
            '<div class="field"><label>迭代上限 N</label><input type="number" data-n value="80" step="10" min="20" max="300" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>渲染</button></div>', { single: true });
          function run() {
            try {
              if (!window.Complex) throw new Error("complex.js 未加载");
              const C = window.Complex;
              const ca = +root.querySelector("[data-ca]").value, cb = +root.querySelector("[data-cb]").value;
              const N = +root.querySelector("[data-n]").value;
              const W = 330, H = 230;
              const cv = document.createElement("canvas"); cv.width = W; cv.height = H; cv.style.width = "100%"; cv.style.maxWidth = "360px"; cv.style.borderRadius = "8px";
              const cx = cv.getContext("2d");
              const img = cx.createImageData(W, H);
              const c = new C(ca, cb);
              for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
                let z = new C(-2 + (px / W) * 4, -1.15 + (py / H) * 2.3);
                let it = N;
                for (let i = 0; i < N; i++) { if (z.abs() > 2) { it = i; break; } z = z.mul(z).add(c); }
                const k = (it / N);
                const r = Math.floor(40 + 215 * k), g = Math.floor(20 + 180 * (1 - k * k)), b = Math.floor(60 + 195 * (1 - k));
                const idx = (py * W + px) * 4; img.data[idx] = r; img.data[idx + 1] = g; img.data[idx + 2] = b; img.data[idx + 3] = 255;
              }
              cx.putImageData(img, 0, 0);
              out.innerHTML = ''; out.appendChild(cv);
              out.insertAdjacentHTML("beforeend", '<div class="muted">c = ' + ca + ' + ' + cb + 'i。Julia 集由固定 c、不同初值 z0 的逃逸行为决定。</div>');
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ===================== GPU 加速：gpu.js ===================== */
  DEMOS.gpujs = {
    tabs: [
      {
        label: "向量相加 (GPU kernel)",
        code:
`// gpu.js：把 JS 函数编译到 GPU(WebGL) 上并行执行
const gpu = new GPU();
const kernel = gpu.createKernel(function (a, b) {
  return a[this.thread.x] + b[this.thread.x];
}).setOutput([64]);
const result = kernel(arrA, arrB);   // 在 GPU 上并行完成`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>向量长度 n</label><input type="number" data-n value="64" step="16" min="16" max="512" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>在 GPU 上计算</button></div>', { single: true });
          loadESM("GPU", "https://esm.sh/gpu.js@2.16.0").then((mod) => {
            const GPUc = mod.GPU || mod.default || mod;
            function run() {
              try {
                const n = +root.querySelector("[data-n]").value;
                const gpu = new GPUc();
                const a = new Float32Array(n), b = new Float32Array(n);
                for (let i = 0; i < n; i++) { a[i] = i * 0.5; b[i] = Math.sin(i); }
                const kernel = gpu.createKernel(function (x, y) { return x[this.thread.x] + y[this.thread.x]; }).setOutput([n]);
                const res = kernel(a, b);
                const head = []; for (let i = 0; i < Math.min(8, n); i++) head.push(fmt(a[i], 2) + "+" + fmt(b[i], 2) + "=" + fmt(res[i], 2));
                out.innerHTML = '<span class="k">GPU kernel 并行计算 ' + n + ' 个元素之和</span>\n' +
                  '<span class="muted">前 8 项：</span>\n<span class="v">' + head.join("\n") + '</span>\n' +
                  '<span class="muted">gpu.js 把 kernel 编译为 WebGL 着色器，在 GPU 上大规模并行；适合大数组/矩阵。</span>';
              } catch (e) { out.innerHTML = '<span class="err">GPU 计算失败（需支持 WebGL）：' + e.message + '</span>'; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + '</span>');
        },
      },
      {
        label: "矩阵乘法 (GPU)",
        code:
`const gpu = new GPU();
const mm = gpu.createKernel(function (a, b) {
  let sum = 0;
  for (let i = 0; i < 2; i++) sum += a[this.thread.y][i] * b[i][this.thread.x];
  return sum;
}).setOutput([2, 2]);
mm(A, B);   // 2×2 矩阵乘积`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="btn-row"><button class="btn" data-run>GPU 矩阵乘法</button></div>', { single: true });
          loadESM("GPU", "https://esm.sh/gpu.js@2.16.0").then((mod) => {
            const GPUc = mod.GPU || mod.default || mod;
            function run() {
              try {
                const gpu = new GPUc();
                const A = [[1, 2], [3, 4]], B = [[5, 6], [7, 8]];
                const mm = gpu.createKernel(function (a, b) { let s = 0; for (let i = 0; i < 2; i++) s += a[this.thread.y][i] * b[i][this.thread.x]; return s; }).setOutput([2, 2]);
                const R = mm(A, B);
                out.innerHTML = '<span class="k">A = </span><span class="v">[[1,2],[3,4]]</span>  <span class="k">B = </span><span class="v">[[5,6],[7,8]]</span>\n' +
                  '<span class="k">A·B (GPU) =</span>\n<span class="ok">  [ ' + R[0].map((v) => fmt(v, 1)).join(", ") + ' ]\n  [ ' + R[1].map((v) => fmt(v, 1)).join(", ") + ' ]</span>\n' +
                  '<span class="muted">应得 [[19,22],[43,50]]。</span>';
              } catch (e) { out.innerHTML = '<span class="err">GPU 计算失败：' + e.message + '</span>'; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + '</span>');
        },
      },
    ],
  };

  /* ===================== 稀疏矩阵：ml-sparse-matrix ===================== */
  DEMOS.mlsparse = {
    tabs: [
      {
        label: "构建 / 转置 / 取值",
        code:
`// ml-sparse-matrix：机器学习场景的稀疏矩阵
const sm = new SparseMatrix([[1,0,0],[0,2,0],[0,0,3]]);
sm.get(1, 1);          // 2
sm.transpose();        // 转置
sm.to2DArray();        // 还原为二维数组`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="btn-row"><button class="btn" data-run>构建并操作</button></div>', { single: true });
          loadESM("SparseMatrix", "https://esm.sh/ml-sparse-matrix@3.1.0").then((mod) => {
            const SM = mod.SparseMatrix || mod;
            function run() {
              try {
                const data = [[1, 0, 0], [0, 2, 0], [0, 0, 3]];
                const sm = new SM(data);
                const tr = sm.transpose();
                const dens = sm.to2DArray();
                out.innerHTML = '<span class="k">稀疏矩阵：</span><span class="v">' + JSON.stringify(data) + '</span>\n' +
                  '<span class="k">get(1,1) = </span><span class="ok">' + sm.get(1, 1) + '</span>\n' +
                  '<span class="k">transpose(0,0) = </span><span class="v">' + tr.get(0, 0) + '</span>\n' +
                  '<span class="k">非零点数 = </span><span class="v">' + dens.flat().filter((v) => v !== 0).length + ' / ' + (dens.length * dens[0].length) + '</span>\n' +
                  '<span class="muted">稀疏存储只保留非零项，节省内存与计算。</span>';
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + '</span>');
        },
      },
      {
        label: "稀疏 × 向量",
        code:
`// 构造三对角稀疏矩阵，乘以向量（只遍历非零项）
const sm = new SparseMatrix(tridiag(12));
sm.mmul(columnVector);   // 稀疏矩阵乘法`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>维数 n</label><input type="number" data-n value="12" step="1" min="4" max="40" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>稀疏乘向量</button></div>', { single: true });
          loadESM("SparseMatrix", "https://esm.sh/ml-sparse-matrix@3.1.0").then((mod) => {
            const SM = mod.SparseMatrix || mod;
            function run() {
              try {
                const n = +root.querySelector("[data-n]").value;
                const rows = [];
                for (let i = 0; i < n; i++) { const r = []; for (let j = 0; j < n; j++) r.push(i === j ? 2 : (Math.abs(i - j) === 1 ? -1 : 0)); rows.push(r); }
                const sm = new SM(rows);
                const v = []; for (let i = 0; i < n; i++) v.push(i + 1);
                const dense = sm.to2DArray();
                const res = []; for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < n; j++) s += dense[i][j] * v[j]; res.push(s); }
                const nz = dense.flat().filter((x) => x !== 0).length;
                out.innerHTML = '<span class="k">三对角矩阵 ' + n + '×' + n + '：</span>非零 ' + nz + ' / ' + (n * n) + '（密度 ' + fmt(nz / (n * n) * 100, 1) + '%）\n' +
                  '<span class="k">向量 x = </span><span class="v">[1, 2, …, ' + n + ']</span>\n' +
                  '<span class="k">A·x (前 8) = </span><span class="ok">[' + res.slice(0, 8).map((x) => fmt(x, 1)).join(", ") + (n > 8 ? ', …]' : ']') + '</span>\n' +
                  '<span class="muted">稀疏乘法仅遍历非零项，远快于稠密乘法。</span>';
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + '</span>');
        },
      },
    ],
  };

  /* ===================== 椭圆曲线密码学：elliptic ===================== */
  DEMOS.elliptic = {
    tabs: [
      {
        label: "签名 / 验证",
        code:
`// elliptic：椭圆曲线密码学
const ec = new elliptic.ec('secp256k1');
const key = ec.genKeyPair();
const sig = key.sign('message');
key.verify('message', sig);   // true`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>待签名消息</label><input type="text" data-msg value="transfer 1 BTC" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>生成密钥并签名</button></div>', { single: true });
          loadESM("elliptic", "https://esm.sh/elliptic@6.6.1").then((mod) => {
            const ell = mod.default || mod;
            function run() {
              try {
                const ec = new ell.ec("secp256k1");
                const key = ec.genKeyPair();
                const msg = root.querySelector("[data-msg]").value;
                const sig = key.sign(msg);
                const ok = key.verify(msg, sig);
                const pub = key.getPublic().encode("hex");
                out.innerHTML = '<span class="k">曲线 = </span><span class="v">secp256k1</span>\n' +
                  '<span class="k">公钥(hex, 前 24) = </span><span class="v">' + pub.slice(0, 24) + '…</span>\n' +
                  '<span class="k">签名 r = </span><span class="v">' + sig.r.toString(16).slice(0, 16) + '…</span>\n' +
                  '<span class="k">verify(msg, sig) = </span><span class="ok">' + ok + '</span>\n' +
                  '<span class="muted">比特币 / 区块链广泛使用的 ECDSA 方案。</span>';
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + '</span>');
        },
      },
      {
        label: "篡改检测",
        code:
`// 篡改消息后，原签名应验证失败
key.verify('tampered', sig);   // false`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>原始消息</label><input type="text" data-m1 value="pay Alice 1 BTC" /></div>' +
            '<div class="field"><label>篡改后消息</label><input type="text" data-m2 value="pay Alice 99 BTC" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>签名并验证</button></div>', { single: true });
          loadESM("elliptic", "https://esm.sh/elliptic@6.6.1").then((mod) => {
            const ell = mod.default || mod;
            function run() {
              try {
                const ec = new ell.ec("secp256k1");
                const key = ec.genKeyPair();
                const m1 = root.querySelector("[data-m1]").value;
                const m2 = root.querySelector("[data-m2]").value;
                const sig = key.sign(m1);
                const ok1 = key.verify(m1, sig);
                const ok2 = key.verify(m2, sig);
                out.innerHTML = '<span class="k">verify(原始消息, sig) = </span><span class="ok">' + ok1 + '</span>\n' +
                  '<span class="k">verify(篡改消息, sig) = </span><span class="err">' + ok2 + '</span>\n' +
                  '<span class="muted">签名与消息绑定，任何篡改都会使验证失败 → 完整性保证。</span>';
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + '</span>');
        },
      },
    ],
  };

  /* ===================== 大数运算：bn.js ===================== */
  DEMOS.bn = {
    tabs: [
      {
        label: "大整数算术",
        code:
`// bn.js：二进制大数（比特币 / 区块链常用）
const a = new BN('123456789012345678901234567890');
const b = new BN('987654321098765432109876543210');
a.add(b);   // 精确大整数加法`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>大整数 a</label><input type="text" data-a value="123456789012345678901234567890" /></div>' +
            '<div class="field"><label>大整数 b</label><input type="text" data-b value="987654321098765432109876543210" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算</button></div>', { single: true });
          loadESM("BN", "https://esm.sh/bn.js@5.2.5").then((mod) => {
            const BN = mod.default || mod;
            function run() {
              try {
                const a = new BN(root.querySelector("[data-a]").value);
                const b = new BN(root.querySelector("[data-b]").value);
                out.innerHTML = '<span class="k">a + b = </span><span class="ok">' + a.add(b).toString() + '</span>\n' +
                  '<span class="k">a − b = </span><span class="v">' + a.sub(b).toString() + '</span>\n' +
                  '<span class="k">a × b = </span><span class="v">' + a.mul(b).toString().slice(0, 60) + '…</span>\n' +
                  '<span class="muted">bn.js 支持任意精度整数/模运算，远超 JS 安全整数范围。</span>';
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + '</span>');
        },
      },
      {
        label: "模幂 (redPow)",
        code:
`// 在模 m 下做快速幂：a^e mod m
const m = new BN('1000000007');
const aR = a.toRed(BN.red(m));
aR.redPow(new BN('65537'));   // a^65537 mod m`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>底数 a</label><input type="text" data-a value="12345678901234567890" /></div>' +
            '<div class="field"><label>指数 e</label><input type="text" data-e value="65537" /></div>' +
            '<div class="field"><label>模 m</label><input type="text" data-m value="1000000007" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>模幂</button></div>', { single: true });
          loadESM("BN", "https://esm.sh/bn.js@5.2.5").then((mod) => {
            const BN = mod.default || mod;
            function run() {
              try {
                const a = new BN(root.querySelector("[data-a]").value);
                const e = new BN(root.querySelector("[data-e]").value);
                const m = new BN(root.querySelector("[data-m]").value);
                const r = a.toRed(BN.red(m)).redPow(e);
                out.innerHTML = '<span class="k">a^e mod m = </span><span class="ok">' + r.toString() + '</span>\n' +
                  '<span class="muted">模幂是 RSA / 椭圆曲线签名验证的核心运算，bn.js 用蒙哥马利约简加速。</span>';
              } catch (err) { out.innerHTML = '<span class="err">' + err.message + '</span>'; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + '</span>');
        },
      },
    ],
  };

  /* ===================== 大数运算：jsbn ===================== */
  DEMOS.jsbn = {
    tabs: [
      {
        label: "大整数加减乘",
        code:
`// jsbn：早期大数库（RSA 相关），API 为 BigInteger
const a = new BigInteger('123456789012345678901234567890');
const b = new BigInteger('987654321098765432109876543210');
a.add(b);   // 大整数加法`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>大整数 a</label><input type="text" data-a value="123456789012345678901234567890" /></div>' +
            '<div class="field"><label>大整数 b</label><input type="text" data-b value="987654321098765432109876543210" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算</button></div>', { single: true });
          loadESM("jsbn", "https://esm.sh/jsbn@1.1.0").then((mod) => {
            const BI = mod.BigInteger || mod;
            function run() {
              try {
                const a = new BI(root.querySelector("[data-a]").value);
                const b = new BI(root.querySelector("[data-b]").value);
                out.innerHTML = '<span class="k">a + b = </span><span class="ok">' + a.add(b).toString() + '</span>\n' +
                  '<span class="k">a − b = </span><span class="v">' + a.subtract(b).toString() + '</span>\n' +
                  '<span class="k">a × b = </span><span class="v">' + a.multiply(b).toString().slice(0, 60) + '…</span>';
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + '</span>');
        },
      },
      {
        label: "模幂 (RSA 风格)",
        code:
`// 手写模幂：result = a^e mod n（平方-乘法）
function modPow(a, e, n) {
  let r = new BigInteger('1'), base = a;
  while (e.compareTo(BigInteger.ZERO) > 0) {
    if (e.isEven()) {} else r = r.multiply(base).mod(n);
    base = base.multiply(base).mod(n);
    e = e.shiftRight(1);
  }
  return r;
}`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>底数 a</label><input type="text" data-a value="123456789" /></div>' +
            '<div class="field"><label>指数 e</label><input type="text" data-e value="65537" /></div>' +
            '<div class="field"><label>模 n</label><input type="text" data-n value="1000000007" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>模幂</button></div>', { single: true });
          loadESM("jsbn", "https://esm.sh/jsbn@1.1.0").then((mod) => {
            const BI = mod.BigInteger || mod;
            function modPow(a, e, n) {
              let r = new BI("1"), base = a;
              while (e.compareTo(new BI("0")) > 0) {
                if (e.testBit(0)) r = r.multiply(base).mod(n);
                base = base.multiply(base).mod(n);
                e = e.shiftRight(1);
              }
              return r;
            }
            function run() {
              try {
                const a = new BI(root.querySelector("[data-a]").value);
                const e = new BI(root.querySelector("[data-e]").value);
                const n = new BI(root.querySelector("[data-n]").value);
                out.innerHTML = '<span class="k">a^e mod n = </span><span class="ok">' + modPow(a, e, n).toString() + '</span>\n' +
                  '<span class="muted">平方-乘法把指数位运算化，将 O(e) 降到 O(log e)，是 RSA 加解密基础。</span>';
              } catch (err) { out.innerHTML = '<span class="err">' + err.message + '</span>'; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + '</span>');
        },
      },
    ],
  };

  /* ===================== 金融数学：financejs ===================== */
  DEMOS.finance = {
    tabs: [
      {
        label: "现值 / 终值",
        code:
`// financejs：常见金融公式
const f = new Finance();
f.PV(rate, nper, pmt, fv, type);   // 现值
f.FV(rate, nper, pmt, fv, type);   // 终值`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="range-row"><span>利率%</span><input type="number" data-r value="10" step="1" /></div>' +
            '<div class="range-row"><span>期数n</span><input type="number" data-n value="10" step="1" /></div>' +
            '<div class="range-row"><span>每期pmt</span><input type="number" data-p value="-1000" step="100" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算 PV / FV</button></div>', { single: true });
          loadESM("Finance", "https://esm.sh/financejs@4.1.0").then((mod) => {
            const F = new (mod.default || mod)();
            function run() {
              try {
                const rate = +root.querySelector("[data-r]").value / 100;
                const nper = +root.querySelector("[data-n]").value;
                const pmt = +root.querySelector("[data-p]").value;
                const pv = F.PV(rate, nper, pmt, 0, 0);
                const fv = F.FV(rate, nper, pmt, 0, 0);
                out.innerHTML = '<span class="k">PV(利率=' + (rate * 100) + '%, n=' + nper + ', pmt=' + pmt + ') = </span><span class="ok">' + fmt(pv, 2) + '</span>\n' +
                  '<span class="k">FV(同参数) = </span><span class="v">' + fmt(fv, 2) + '</span>\n' +
                  '<span class="muted">PV/FV 把一系列现金流折算到当前 / 未来价值。</span>';
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + '</span>');
        },
      },
      {
        label: "NPV / IRR / XIRR",
        code:
`// 注意：financejs 的 IRR / NPV 为可变参数（逐笔现金流）
f.NPV(rate, cf1, cf2, ...);
f.IRR(cf1, cf2, ...);          // 返回百分比
f.XIRR(amounts, dates);        // 不等间隔 IRR`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>现金流（逗号分隔，首笔为负）</label><input type="text" data-cf value="-1000, 300, 400, 500, 600" /></div>' +
            '<div class="range-row"><span>折现率%</span><input type="number" data-r value="10" step="1" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算</button></div>', { single: true });
          loadESM("Finance", "https://esm.sh/financejs@4.1.0").then((mod) => {
            const F = new (mod.default || mod)();
            function run() {
              try {
                const cfs = root.querySelector("[data-cf]").value.split(",").map((s) => +s.trim());
                const rate = +root.querySelector("[data-r]").value / 100;
                const npv = F.NPV(rate, ...cfs);
                const irr = F.IRR(...cfs);
                const dts = cfs.map((_, i) => new Date(2020 + i, 0, 1));
                const xirr = F.XIRR(cfs, dts);
                out.innerHTML = '<span class="k">现金流 = </span><span class="v">[' + cfs.join(", ") + ']</span>\n' +
                  '<span class="k">NPV(rate=' + (rate * 100) + '%) = </span><span class="ok">' + fmt(npv, 2) + '</span>\n' +
                  '<span class="k">IRR = </span><span class="ok">' + fmt(irr / 100, 4) + ' (' + irr + '%)</span>\n' +
                  '<span class="k">XIRR(按年) ≈ </span><span class="v">' + fmt(xirr / 100, 4) + ' (' + xirr + '%)</span>\n' +
                  '<span class="muted">financejs 的 IRR/XIRR 返回百分比值。</span>';
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + '</span>');
        },
      },
    ],
  };

  /* ===================== 内部收益率：自实现 IRR / XIRR ===================== */
  DEMOS.irr = {
    tabs: [
      {
        label: "IRR（内部收益率）",
        code:
`// 自实现 IRR：找使 NPV=0 的折现率（二分法）
function npv(rate, cfs) {
  let s = 0;
  for (let t = 0; t < cfs.length; t++) s += cfs[t] / Math.pow(1 + rate, t);
  return s;
}
// 在 [-0.9, 5] 上对 npv 二分求根`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>现金流（逗号分隔，首笔为负）</label><input type="text" data-cf value="-1000, 300, 400, 500, 600" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算 IRR</button></div>',
            { vizLabel: "NPV(r) 曲线与根" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          function npv(rate, cfs) { let s = 0; for (let t = 0; t < cfs.length; t++) s += cfs[t] / Math.pow(1 + rate, t); return s; }
          function run() {
            try {
              const cfs = root.querySelector("[data-cf]").value.split(",").map((s) => +s.trim());
              let lo = -0.9, hi = 5;
              if (npv(lo, cfs) * npv(hi, cfs) > 0) throw new Error("NPV 在区间两端同号，无法二分（可改用牛顿法）");
              for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (npv(mid, cfs) * npv(lo, cfs) <= 0) hi = mid; else lo = mid; }
              const r = (lo + hi) / 2;
              const xs = [], ys = [];
              for (let rr = -0.9; rr <= 1.0001; rr += 0.02) { xs.push(rr); ys.push(npv(rr, cfs)); }
              const ymin = Math.min(...ys, 0), ymax = Math.max(...ys, 0); const pad = (ymax - ymin) * 0.1 || 1;
              plot2D(ctx, w, h, { xmin: -0.9, xmax: 1, ymin: ymin - pad, ymax: ymax + pad },
                (mx, my) => {
                  line(ctx, xs.map((x, i) => [mx(x), my(ys[i])]), css("--accent"), 2.2);
                  ctx.strokeStyle = css("--border"); ctx.beginPath(); ctx.moveTo(mx(-0.9), my(0)); ctx.lineTo(mx(1), my(0)); ctx.stroke();
                  ctx.fillStyle = css("--accent-3"); ctx.beginPath(); ctx.arc(mx(r), my(0), 4.5, 0, 7); ctx.fill();
                });
              out.innerHTML = '<span class="k">现金流 = </span><span class="v">[' + cfs.join(", ") + ']</span>\n' +
                '<span class="k">IRR = </span><span class="ok">' + fmt(r, 4) + ' (' + fmt(r * 100, 2) + '%)</span>\n' +
                '<span class="muted">蓝点=NPV=0 的根，即内部收益率。</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "XIRR（带日期）",
        code:
`// XIRR：现金流发生在不等间隔日期
// f(r) = Σ cf_t / (1+r)^(days_t/365) = 0
function xnpv(rate, cfs, days) {
  let s = 0;
  for (let i = 0; i < cfs.length; i++) s += cfs[i] / Math.pow(1 + rate, days[i] / 365);
  return s;
}`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>每行：金额,日期(YYYY-MM-DD)</label><textarea data-cf rows="4">-1000, 2020-01-01\n200, 2021-03-01\n1200, 2022-06-15</textarea></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算 XIRR</button></div>', { single: true });
          function xnpv(rate, cfs, days) { let s = 0; for (let i = 0; i < cfs.length; i++) s += cfs[i] / Math.pow(1 + rate, days[i] / 365); return s; }
          function run() {
            try {
              const rows = root.querySelector("[data-cf]").value.trim().split("\n").map((r) => r.split(","));
              const cfs = rows.map((r) => +r[0].trim());
              const d0 = new Date(rows[0][1].trim());
              const days = rows.map((r) => (new Date(r[1].trim()) - d0) / (24 * 3600 * 1000));
              let lo = -0.9, hi = 5;
              if (xnpv(lo, cfs, days) * xnpv(hi, cfs, days) > 0) throw new Error("XNPV 区间同号，无法二分");
              for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (xnpv(mid, cfs, days) * xnpv(lo, cfs, days) <= 0) hi = mid; else lo = mid; }
              const r = (lo + hi) / 2;
              out.innerHTML = '<span class="k">现金流 = </span><span class="v">[' + cfs.join(", ") + ']</span>\n' +
                '<span class="k">XIRR = </span><span class="ok">' + fmt(r, 4) + ' (' + fmt(r * 100, 2) + '%)</span>\n' +
                '<span class="muted">按实际天数折算，解决不等间隔现金流的收益率。</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ===================== 时间序列分析：自实现 ===================== */
  DEMOS.timeseries = {
    tabs: [
      {
        label: "移动平均平滑",
        code:
`// 时间序列：用滑动窗口均值平滑噪声
function movingAvg(arr, win) {
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const s = Math.max(0, i - win + 1);
    let sum = 0; for (let j = s; j <= i; j++) sum += arr[j];
    out.push(sum / (i - s + 1));
  }
  return out;
}`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>窗口长度 win</label><input type="number" data-win value="5" step="1" min="2" max="20" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>生成并平滑</button></div>',
            { vizLabel: "原始序列 vs 移动平均" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          function movingAvg(arr, win) { const out = []; for (let i = 0; i < arr.length; i++) { const s = Math.max(0, i - win + 1); let sum = 0; for (let j = s; j <= i; j++) sum += arr[j]; out.push(sum / (i - s + 1)); } return out; }
          function run() {
            try {
              const win = +root.querySelector("[data-win]").value;
              const n = 60, raw = [];
              for (let i = 0; i < n; i++) raw.push(10 + 3 * Math.sin(i / 4) + (Math.random() * 2 - 1) * 2.5);
              const ma = movingAvg(raw, win);
              const xmin = 0, xmax = n - 1;
              const all = raw.concat(ma); let ymin = Math.min(...all), ymax = Math.max(...all); const pad = (ymax - ymin) * 0.1 || 1;
              plot2D(ctx, w, h, { xmin, xmax, ymin: ymin - pad, ymax: ymax + pad },
                (mx, my) => {
                  line(ctx, raw.map((v, i) => [mx(i), my(v)]), "rgba(255,107,107,0.7)", 1.4);
                  line(ctx, ma.map((v, i) => [mx(i), my(v)]), css("--accent"), 2.4);
                });
              out.innerHTML = '<span class="k">窗口 win = </span><span class="v">' + win + '</span>\n' +
                '<span class="muted">红=含噪原始序列，蓝=移动平均平滑后的趋势。</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
      {
        label: "自相关 (ACF)",
        code:
`// 自相关：衡量序列自身在不同时滞下的相似度
function acf(arr, maxLag) {
  const mean = arr.reduce((a,b)=>a+b,0)/arr.length;
  const denom = arr.reduce((s,x)=>s+(x-mean)**2,0);
  const out = [];
  for (let lag = 0; lag <= maxLag; lag++) {
    let num = 0;
    for (let i = 0; i < arr.length - lag; i++) num += (arr[i]-mean)*(arr[i+lag]-mean);
    out.push(num/denom);
  }
  return out;
}`,
        mount(root) {
          const { out, viz } = skeleton(root,
            '<div class="field"><label>最大时滞 maxLag</label><input type="number" data-lag value="12" step="1" min="2" max="30" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>计算 ACF</button></div>',
            { vizLabel: "自相关系数" });
          const { c, ctx, w, h } = mkCanvas(430, 260); viz.appendChild(c);
          function acf(arr, maxLag) { const mean = arr.reduce((a, b) => a + b, 0) / arr.length; const denom = arr.reduce((s, x) => s + (x - mean) ** 2, 0); const out = []; for (let lag = 0; lag <= maxLag; lag++) { let num = 0; for (let i = 0; i < arr.length - lag; i++) num += (arr[i] - mean) * (arr[i + lag] - mean); out.push(num / denom); } return out; }
          function run() {
            try {
              const maxLag = +root.querySelector("[data-lag]").value;
              const n = 80, arr = [];
              for (let i = 0; i < n; i++) arr.push(10 + 4 * Math.sin(i / 5) + (Math.random() * 2 - 1) * 1.5);
              const a = acf(arr, maxLag);
              bars(ctx, w, h, a.map((_, i) => i), a, { title: "ACF (lag→)", color: css("--accent-3") });
              out.innerHTML = '<span class="k">最大时滞 = </span><span class="v">' + maxLag + '</span>\n' +
                '<span class="k">lag=0 自相关 = </span><span class="ok">' + fmt(a[0], 3) + '</span>\n' +
                '<span class="muted">周期性序列会在对应时滞处出现明显的自相关峰值。</span>';
            } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
          }
          root.querySelector("[data-run]").onclick = run; run();
        },
      },
    ],
  };

  /* ===================== 布尔代数：boolean ===================== */
  DEMOS.booleanjs = {
    tabs: [
      {
        label: "解析与求值",
        code:
`// boolean：布尔表达式解析库（把变量替换为 true/false 后求值）
const expr = 'A and (B or not C)';
boolean(expr).toString();   // 未赋值变量默认视为 false`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>布尔表达式</label><input type="text" data-expr value="A and (B or not C)" /></div>' +
            '<div class="range-row"><span>A</span><select data-a><option value="1">true</option><option value="0">false</option></select>' +
            '<span>B</span><select data-b><option value="1">true</option><option value="0">false</option></select>' +
            '<span>C</span><select data-c><option value="1">true</option><option value="0">false</option></select></div>' +
            '<div class="btn-row"><button class="btn" data-run>求值</button></div>', { single: true });
          loadESM("booleanjs", "https://esm.sh/boolean@3.2.0").then((mod) => {
            const make = mod.boolean || mod;
            function run() {
              try {
                const expr = root.querySelector("[data-expr]").value;
                const map = { A: root.querySelector("[data-a]").value === "1", B: root.querySelector("[data-b]").value === "1", C: root.querySelector("[data-c]").value === "1" };
                const vars = [...new Set((expr.match(/[A-Za-z_]\w*/g) || []))].filter((v) => !["and", "or", "not", "true", "false", "xor", "nand", "nor", "xnor", "implies"].includes(v));
                let sub = expr;
                vars.forEach((v) => { sub = sub.replace(new RegExp(v, "g"), map[v] ? "true" : "false"); });
                const res = make(sub).toString();
                out.innerHTML = '<span class="k">表达式 = </span><span class="v">' + expr + '</span>\n' +
                  '<span class="k">代入 = </span><span class="v">A=' + map.A + ', B=' + map.B + ', C=' + map.C + '</span>\n' +
                  '<span class="k">结果 = </span><span class="ok">' + res + '</span>\n' +
                  '<span class="muted">变量替换为 true/false 后由 boolean 解析求值。</span>';
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + '</span>');
        },
      },
      {
        label: "真值表",
        code:
`// 枚举所有变量组合，代入后由 boolean 求值，生成真值表
const vars = ['A','B','C'];
vars.forEach(combo => {
  const sub = expr.replace(/A/g, combo.A? 'true':'false')...;
  table.push(boolean(sub).toString());
});`,
        mount(root) {
          const { out } = skeleton(root,
            '<div class="field"><label>布尔表达式（变量用大写字母）</label><input type="text" data-expr value="A and (B or not C)" /></div>' +
            '<div class="btn-row"><button class="btn" data-run>生成真值表</button></div>', { single: true });
          loadESM("booleanjs", "https://esm.sh/boolean@3.2.0").then((mod) => {
            const make = mod.boolean || mod;
            function run() {
              try {
                const expr = root.querySelector("[data-expr]").value;
                const vars = [...new Set((expr.match(/[A-Za-z_]\w*/g) || []))].filter((v) => !["and", "or", "not", "true", "false", "xor", "nand", "nor", "xnor", "implies"].includes(v));
                if (vars.length > 5) throw new Error("变量过多（最多 5 个，2^" + vars.length + " 行）");
                let html = '<table style="border-collapse:collapse;font:11px monospace"><tr>' + vars.map((v) => '<th style="padding:2px 6px;border:1px solid ' + css("--border") + '">' + v + '</th>').join("") + '<th style="padding:2px 6px;border:1px solid ' + css("--border") + '">结果</th></tr>';
                for (let mask = 0; mask < (1 << vars.length); mask++) {
                  const map = {}; vars.forEach((v, i) => { map[v] = !!(mask & (1 << (vars.length - 1 - i))); });
                  let sub = expr; vars.forEach((v) => { sub = sub.replace(new RegExp(v, "g"), map[v] ? "true" : "false"); });
                  const res = make(sub).toString();
                  html += '<tr>' + vars.map((v) => '<td style="padding:2px 6px;border:1px solid ' + css("--border") + '">' + (map[v] ? 1 : 0) + '</td>').join("") + '<td style="padding:2px 6px;border:1px solid ' + css("--border") + ';color:' + css("--accent") + '">' + res + '</td></tr>';
                }
                html += '</table>';
                out.innerHTML = '<span class="k">变量：</span><span class="v">' + vars.join(", ") + '</span>（' + (1 << vars.length) + ' 行）\n' + html;
              } catch (e) { out.innerHTML = '<span class="err">' + e.message + '</span>'; }
            }
            root.querySelector("[data-run]").onclick = run; run();
          }).catch((e) => out.innerHTML = '<span class="err">加载失败：' + e.message + '</span>');
        },
      },
    ],
  };

  console.log("[demos-extra] loaded", Object.keys(DEMOS).length, "demos");
})();
