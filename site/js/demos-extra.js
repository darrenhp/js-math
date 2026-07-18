/* ============================================================
 * demos-extra.js — 新增库的多能力交互式 Demo（由 index.html 在 demos.js 之后加载）
 * 复用 demos.js 暴露的 window.__demo 助手；UMD 库直接用全局，
 * 其余库通过 esm.sh 动态 import 懒加载（loadESM），并赋给 window[global] 以便徽标检测。
 * ========================================================== */
(function () {
  "use strict";
  const D = window.__demo || {};
  const { css, mkCanvas, plot2D, line, bars, skeleton, has } = D;

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

  console.log("[demos-extra] loaded", Object.keys(DEMOS).length, "demos");
})();
