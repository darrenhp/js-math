/* ============================================================
 * app.js — 导航、路由、搜索、主题
 * ========================================================== */
(function () {
  "use strict";
  const CATS = window.CATEGORIES, LIBS = window.LIBS, DEMOS = window.DEMOS;
  const $ = (s, r = document) => r.querySelector(s);
  const nav = $("#nav"), contentInner = $("#contentInner");
  const libByCat = (cid) => LIBS.filter((l) => l.cat === cid);
  const catById = (id) => CATS.find((c) => c.id === id);

  /* ---------- 构建侧边栏 ---------- */
  function buildNav(filter) {
    nav.innerHTML = "";
    const f = (filter || "").trim().toLowerCase();
    CATS.forEach((cat) => {
      let libs = libByCat(cat.id);
      if (f) libs = libs.filter((l) =>
        (l.name + l.tagline + l.useCases.join("") + l.positioning).toLowerCase().includes(f));
      if (!libs.length) return;
      const group = document.createElement("div"); group.className = "nav-group";
      group.innerHTML = `<div class="nav-group-title"><span class="dot" style="background:${cat.color}"></span>${cat.name}</div>`;
      libs.forEach((lib) => {
        const item = document.createElement("div");
        item.className = "nav-item"; item.dataset.id = lib.id;
        const loaded = window.__libHas(lib.global);
        item.innerHTML = `<span class="ni-name">${lib.name}</span>
          <span class="ni-badge" style="${loaded ? "" : "opacity:.5"}">${loaded ? "●" : "○"}</span>`;
        item.onclick = () => { location.hash = "#/" + lib.id; };
        group.appendChild(item);
      });
      nav.appendChild(group);
    });
    $("#libCount").textContent = `${LIBS.length} 个库 · ${CATS.length} 类`;
  }

  window.__libHas = function (name) {
    return name.split("|").some((n) =>
      n.split(".").reduce((o, k) => (o == null ? o : o[k]), window) != null);
  };

  /* ---------- 首页 ---------- */
  function renderWelcome() {
    setActive(null);
    let loadedN = LIBS.filter((l) => window.__libHas(l.global)).length;
    contentInner.innerHTML =
      `<div class="welcome">
        <h2>JavaScript 数学库能力演示</h2>
        <p class="lead">一站式浏览 20+ 个前端数学库：涵盖通用计算、线性代数、统计、几何、随机数、符号计算、机器学习。每个库都配有<strong>可实时运行、可交互调参</strong>的 Demo 与可视化。点击左侧任意库开始探索。</p>
        <div class="stat-row">
          <div class="stat"><div class="num">${LIBS.length}</div><div class="lab">收录库</div></div>
          <div class="stat"><div class="num">${CATS.length}</div><div class="lab">分类</div></div>
          <div class="stat"><div class="num">${loadedN}/${LIBS.length}</div><div class="lab">已成功加载</div></div>
          <div class="stat"><div class="num">100%</div><div class="lab">纯前端运行</div></div>
        </div>
        <div class="cat-cards" id="catCards"></div>
        <div class="badge-note">💡 每个 Demo 都在你的浏览器本地实时计算，可自由修改输入与参数观察结果变化。</div>
      </div>`;
    const cc = $("#catCards");
    CATS.forEach((cat) => {
      const card = document.createElement("div"); card.className = "cat-card";
      const libs = libByCat(cat.id);
      card.innerHTML =
        `<div class="cc-head"><span class="cc-dot" style="background:${cat.color}"></span><span class="cc-title">${cat.name}</span></div>
         <div class="cc-libs">${libs.map((l) => `<span class="cc-lib">${l.name}</span>`).join("")}</div>`;
      card.onclick = () => { location.hash = "#/" + libs[0].id; };
      cc.appendChild(card);
    });
  }

  /* ---------- 库详情 ---------- */
  function renderLib(lib) {
    // 运行上一个 demo 的清理钩子
    (window.__demoCleanups || []).forEach((fn) => { try { fn(); } catch (e) {} });
    window.__demoCleanups = [];

    const cat = catById(lib.cat);
    const loaded = window.__libHas(lib.global);
    const card = document.createElement("div"); card.className = "lib-card";
    card.innerHTML =
      `<div class="lib-head">
        <div class="lib-cat-tag"><span class="dot" style="background:${cat.color}"></span>${cat.name}</div>
        <div class="lib-title-row">
          <h2 class="lib-title">${lib.name}</h2>
          <div class="lib-links">
            <a href="${lib.npm}" target="_blank" rel="noopener">npm</a>
            <a href="${lib.site}" target="_blank" rel="noopener">官网 / 文档</a>
          </div>
        </div>
        <p class="lib-tagline">${lib.tagline}</p>
      </div>

      <div class="info-grid">
        <div class="info-box span-2"><h3>🎯 核心定位</h3><p>${lib.positioning}</p></div>
        <div class="info-box"><h3>⚡ 核心能力</h3><ul>${lib.capabilities.map((x) => `<li>${x}</li>`).join("")}</ul></div>
        <div class="info-box"><h3>🧩 适用场景</h3><ul>${lib.useCases.map((x) => `<li>${x}</li>`).join("")}</ul></div>
        <div class="info-box span-2">
          <div class="pros-cons">
            <div class="pc-col pros"><h4>优点</h4><ul>${lib.pros.map((x) => `<li>${x}</li>`).join("")}</ul></div>
            <div class="pc-col cons"><h4>缺点</h4><ul>${lib.cons.map((x) => `<li>${x}</li>`).join("")}</ul></div>
          </div>
        </div>
      </div>

      <div class="demo-wrap">
        <div class="demo-head">
          <span class="demo-dot"></span><h3>交互式 Demo · ${lib.name}</h3>
          <button class="code-btn" id="codeBtn" type="button" title="查看当前演示的代码">{'</>'} 查看代码</button>
          <span class="lib-loaded ${loaded ? "ok" : "fail"}">${loaded ? "● 库已加载" : "○ 库未加载(CDN)"}</span>
        </div>
        <div class="demo-body" id="demoBody"></div>
      </div>`;
    contentInner.innerHTML = ""; contentInner.appendChild(card);

    const body = $("#demoBody");
    window.__activeDemoCode = "";
    window.__activeDemoName = "";
    const demo = DEMOS[lib.demo];
    if (demo && window.__renderDemo) {
      try { window.__renderDemo(body, demo); }
      catch (e) { body.innerHTML = `<div class="output"><span class="err">Demo 运行出错：${e.message}</span></div>`; }
    } else {
      body.innerHTML = `<div class="output"><span class="muted">该库 Demo 建设中。</span></div>`;
    }
    contentInner.parentElement.scrollTop = 0;
    setActive(lib.id);

    const codeBtn = $("#codeBtn");
    if (codeBtn) codeBtn.onclick = () => openCodeModal(lib.name);
  }

  function setActive(id) {
    nav.querySelectorAll(".nav-item").forEach((it) =>
      it.classList.toggle("active", it.dataset.id === id));
  }

  /* ---------- 路由 ---------- */
  function route() {
    const h = location.hash.replace(/^#\/?/, "");
    if (!h) { renderWelcome(); return; }
    const lib = LIBS.find((l) => l.id === h);
    if (lib) renderLib(lib); else renderWelcome();
    closeSidebar();
  }

  /* ---------- 搜索 ---------- */
  $("#searchInput").addEventListener("input", (e) => buildNav(e.target.value));

  /* ---------- 主题 ---------- */
  const root = document.documentElement;
  const savedTheme = localStorage.getItem("jsmath-theme") || "dark";
  root.setAttribute("data-theme", savedTheme);
  const tbtn = $("#themeToggle");
  const setThemeIcon = () => (tbtn.textContent = root.getAttribute("data-theme") === "dark" ? "🌙" : "☀️");
  setThemeIcon();
  tbtn.onclick = () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next); localStorage.setItem("jsmath-theme", next); setThemeIcon();
    // 重新渲染当前页以刷新 canvas 主题色
    route();
  };

  /* ---------- 移动端侧边栏 ---------- */
  const sidebar = $("#sidebar"), scrim = $("#scrim");
  function closeSidebar() { sidebar.classList.remove("open"); scrim.classList.remove("show"); }
  $("#menuBtn").onclick = () => { sidebar.classList.add("open"); scrim.classList.add("show"); };
  scrim.onclick = closeSidebar;

  /* ---------- 代码弹窗 + 语法高亮 ---------- */
  function highlightJS(src) {
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|\b(const|let|var|function|return|if|else|for|while|new|of|in|typeof|await|async|class|extends|true|false|null|undefined|this|throw|catch|switch|case|break)\b|\b(\d+(?:\.\d+)?)\b|([A-Za-z_$][\w$]*)(?=\s*\()/g;
    let out = "", last = 0, m;
    while ((m = re.exec(src))) {
      out += esc(src.slice(last, m.index));
      if (m[1]) out += '<span class="tk-com">' + esc(m[1]) + "</span>";
      else if (m[2]) out += '<span class="tk-str">' + esc(m[2]) + "</span>";
      else if (m[3]) out += '<span class="tk-kw">' + esc(m[3]) + "</span>";
      else if (m[4]) out += '<span class="tk-num">' + esc(m[4]) + "</span>";
      else if (m[5]) out += '<span class="tk-fn">' + esc(m[5]) + "</span>";
      last = re.lastIndex;
    }
    out += esc(src.slice(last));
    return out;
  }

  let codeModalEl = null;
  function ensureCodeModal() {
    if (codeModalEl) return codeModalEl;
    const el = document.createElement("div");
    el.className = "code-modal";
    el.id = "codeModal";
    el.innerHTML =
      '<div class="code-modal-card">' +
        '<div class="code-modal-head">' +
          '<span class="code-modal-title" id="codeModalTitle"></span>' +
          '<div class="code-modal-actions">' +
            '<button class="code-copy" id="codeCopy" type="button">复制</button>' +
            '<button class="code-close" id="codeClose" type="button" aria-label="关闭">✕</button>' +
          "</div>" +
        "</div>" +
        '<pre class="code-modal-body"><code id="codeModalCode"></code></pre>' +
      "</div>";
    document.body.appendChild(el);
    const close = () => el.classList.remove("open");
    el.querySelector("#codeClose").onclick = close;
    el.onclick = (e) => { if (e.target === el) close(); };
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    el.querySelector("#codeCopy").onclick = () => {
      const code = window.__activeDemoCode || "";
      const btn = el.querySelector("#codeCopy");
      const done = () => { btn.textContent = "已复制 ✓"; setTimeout(() => (btn.textContent = "复制"), 1400); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, done);
      else done();
    };
    codeModalEl = el;
    return el;
  }

  function openCodeModal(libName) {
    const el = ensureCodeModal();
    const code = window.__activeDemoCode || "// 暂无示例代码";
    el.querySelector("#codeModalTitle").textContent = libName + " · " + (window.__activeDemoName || "");
    el.querySelector("#codeModalCode").innerHTML = highlightJS(code);
    el.classList.add("open");
  }

  /* ---------- 启动 ---------- */
  function boot() {
    buildNav();
    window.addEventListener("hashchange", route);
    route();
    // 库加载状态可能在脚本后就绪，稍后刷新徽标
    setTimeout(() => buildNav($("#searchInput").value), 600);
  }
  boot();
})();
