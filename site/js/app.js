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
  let activeCat = CATS[0] && CATS[0].id;

  /* ---------- 构建侧边栏（仅当前分类；搜索时为全局） ---------- */
  function navItem(lib) {
    const item = document.createElement("div");
    item.className = "nav-item"; item.dataset.id = lib.id;
    const loaded = window.__libHas(lib.global);
    item.innerHTML = `<span class="ni-name">${lib.name}</span>
      <span class="ni-badge" style="${loaded ? "" : "opacity:.5"}">${loaded ? "●" : "○"}</span>`;
    item.onclick = () => { location.hash = "#/" + lib.id; };
    return item;
  }
  function navGroup(cat, libs) {
    const group = document.createElement("div"); group.className = "nav-group";
    group.innerHTML = `<div class="nav-group-title"><span class="dot" style="background:${cat.color}"></span>${cat.name}</div>`;
    libs.forEach((l) => group.appendChild(navItem(l)));
    return group;
  }
  function buildNav(filter) {
    nav.innerHTML = "";
    const f = (filter || "").trim().toLowerCase();
    if (f) {
      CATS.forEach((cat) => {
        const libs = libByCat(cat.id).filter((l) =>
          (l.name + l.tagline + l.useCases.join("") + l.positioning).toLowerCase().includes(f));
        if (libs.length) nav.appendChild(navGroup(cat, libs));
      });
    } else if (activeCat) {
      const cat = catById(activeCat);
      if (cat) nav.appendChild(navGroup(cat, libByCat(cat.id)));
    }
    const matchN = nav.querySelectorAll(".nav-item").length;
    $("#libCount").textContent = f ? `${matchN} 个匹配 · ${CATS.length} 类` : `${LIBS.length} 个库 · ${CATS.length} 类`;
    // 重新应用当前路由高亮（buildNav 会重建 DOM，需恢复 active）
    const cur = location.hash.replace(/^#\/?/, "");
    setActive(LIBS.some((l) => l.id === cur) ? cur : null);
  }

  /* ---------- 分类 banner ---------- */
  function buildBanner() {
    const inner = $("#bannerInner"); if (!inner) return;
    inner.innerHTML = "";
    CATS.forEach((cat) => {
      const n = LIBS.filter((l) => l.cat === cat.id).length;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "cat-chip"; chip.dataset.cat = cat.id;
      chip.style.setProperty("--chip", cat.color);
      chip.innerHTML = `<span class="dot"></span>${cat.name}<span class="count">${n}</span>`;
      chip.onclick = () => selectCategory(cat.id);
      inner.appendChild(chip);
    });
  }
  function updateBanner() {
    const inner = $("#bannerInner"); if (!inner) return;
    inner.querySelectorAll(".cat-chip").forEach((c) =>
      c.classList.toggle("active", c.dataset.cat === activeCat));
  }
  function selectCategory(catId) {
    if (!catById(catId)) return;
    activeCat = catId;
    $("#searchInput").value = "";   // 退出搜索态，回到该分类列表
    updateBanner();
    buildNav("");
    const first = libByCat(catId)[0];
    if (first) location.hash = "#/" + first.id;
  }

  window.__libHas = function (name) {
    return name.split("|").some((n) =>
      n.split(".").reduce((o, k) => (o == null ? o : o[k]), window) != null);
  };

  /* ---------- 首页 ---------- */
  function renderWelcome() {
    activeCat = activeCat || (CATS[0] && CATS[0].id);
    setActive(null);
    updateBanner();
    buildNav("");
    let loadedN = LIBS.filter((l) => window.__libHas(l.global)).length;
    contentInner.innerHTML =
      `<div class="welcome">
        <h2>JavaScript 数学库能力演示</h2>
        <p class="lead">一站式浏览 ${LIBS.length} 个前端数学库，覆盖 ${CATS.length} 个分类：通用计算、符号计算 / 逻辑代数、线性代数 / 矩阵 / 稀疏、统计 / 概率、几何 / 空间计算、机器学习、信号处理 / 时间序列、数值分析 / 插值拟合、图论、单位换算、数论 / 特殊数制、数学函数 / 特殊函数、密码学、金融数学、可视化 / 分形、GPU 加速等。每个库都配有<strong>可实时运行、可交互调参</strong>的 Demo 与可视化。点击左侧任意库开始探索。</p>
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
    if (lib) {
      activeCat = lib.cat;
      updateBanner();
      buildNav($("#searchInput").value);
      renderLib(lib);
    } else {
      renderWelcome();
    }
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
    buildBanner();
    updateBanner();
    buildNav();
    window.addEventListener("hashchange", route);
    route();
    // 库加载状态可能在脚本后就绪，稍后刷新徽标
    setTimeout(() => buildNav($("#searchInput").value), 600);
  }
  boot();
})();
