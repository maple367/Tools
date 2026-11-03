"use strict";
(() => {
  const $ = (id) => document.getElementById(id);
  const KEY = "maple.home.v1";
  const defaults = {
    theme: "system",
    quote: true,
    seconds: false,
    hour12: false,
    newtab: true,
    engine: "bing",
    wallpaper: "",
  };
  const engines = {
    bing: "https://www.bing.com/search?q=",
    google: "https://www.google.com/search?q=",
    baidu: "https://www.baidu.com/s?wd=",
    duck: "https://duckduckgo.com/?q=",
  };
  const uid = () => crypto.randomUUID();
  const urlOf = (value) => {
    if (typeof value !== "string" || !value.trim())
      throw Error("请输入有效网址");
    const s = value.trim();
    const u = new URL(
      s.startsWith("/")
        ? s
        : /^[a-z][a-z\d+.-]*:/i.test(s)
          ? s
          : "https://" + s,
      location.origin,
    );
    if (!["https:", "http:"].includes(u.protocol) || u.username || u.password)
      throw Error("仅支持不含登录凭据的 HTTP / HTTPS 网址");
    return u.href;
  };
  const wallOK = (s) =>
    !s ||
    (typeof s === "string" &&
      (/^https:\/\//i.test(s) ||
        /^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(s)));
  const ICON_RESOLVER =
    "https://maple-home-icons.haihuang367.workers.dev/resolve";
  const iconLookups = new Map();
  const iconQueue = [];
  const pendingIconUrls = new Map();
  let runningIconLookups = 0,
    iconSaveTimer;
  function safeIconUrl(value) {
    if (
      typeof value !== "string" ||
      value.length > 2048 ||
      !/^https?:\/\//i.test(value)
    )
      return "";
    try {
      return urlOf(value);
    } catch {
      return "";
    }
  }
  function scheduleIconLookup(task) {
    return new Promise((resolve) => {
      iconQueue.push({ task, resolve });
      drainIconQueue();
    });
  }
  function drainIconQueue() {
    while (runningIconLookups < 3 && iconQueue.length) {
      const { task, resolve } = iconQueue.shift();
      runningIconLookups++;
      Promise.resolve()
        .then(task)
        .catch(() => "")
        .then(resolve)
        .finally(() => {
          runningIconLookups--;
          drainIconQueue();
        });
    }
  }
  function discoverIcon(pageUrl) {
    const origin = new URL(pageUrl).origin;
    const existing = iconLookups.get(origin);
    if (existing && existing.expires > Date.now()) return existing.promise;
    const entry = { expires: Date.now() + 300000 };
    entry.promise = scheduleIconLookup(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(
          ICON_RESOLVER + "?url=" + encodeURIComponent(origin),
          {
            signal: controller.signal,
            credentials: "omit",
            referrerPolicy: "no-referrer",
          },
        );
        if (!response.ok) return "";
        const result = await response.json();
        const iconUrl = safeIconUrl(result.iconUrl);
        if (iconUrl) entry.expires = Date.now() + 21600000;
        return iconUrl;
      } finally {
        clearTimeout(timeout);
      }
    });
    iconLookups.set(origin, entry);
    return entry.promise;
  }
  function rememberIcon(origin, iconUrl) {
    if (
      !state.links.some(
        (link) =>
          new URL(link.url).origin === origin && link.iconUrl !== iconUrl,
      )
    )
      return;
    pendingIconUrls.set(origin, iconUrl);
    clearTimeout(iconSaveTimer);
    // Store URL metadata only; never download or serialize image bytes.
    iconSaveTimer = setTimeout(() => {
      const next = {
        ...state,
        links: state.links.map((link) => {
          const cached = pendingIconUrls.get(new URL(link.url).origin);
          return cached ? { ...link, iconUrl: cached } : link;
        }),
      };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
        state = next;
      } catch {
        /* Optional URL metadata must not interrupt the page. */
      }
      pendingIconUrls.clear();
    }, 250);
  }
  function bookmarkIcon(link) {
    const box = el("span", "icon");
    const letter = el(
      "span",
      "icon-letter",
      Array.from(link.name)[0].toUpperCase(),
    );
    const img = el("img");
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.draggable = false;
    const rootIcon = new URL("/favicon.ico", link.url).href;
    let triedDiscovery = false,
      triedRoot = !safeIconUrl(link.iconUrl);
    img.onload = () => {
      letter.hidden = true;
      img.style.opacity = "1";
      if (img.src !== rootIcon) rememberIcon(new URL(link.url).origin, img.src);
    };
    img.onerror = async () => {
      if (!box.isConnected) return;
      if (!triedDiscovery) {
        triedDiscovery = true;
        const discovered = await discoverIcon(link.url);
        if (!box.isConnected) return;
        if (discovered && discovered !== img.src) {
          img.src = discovered;
          return;
        }
      }
      if (!triedRoot) {
        triedRoot = true;
        img.src = rootIcon;
        return;
      }
      img.remove();
    };
    img.style.opacity = "0";
    img.src = safeIconUrl(link.iconUrl) || rootIcon;
    box.append(letter, img);
    return box;
  }
  function cleanSettings(s = {}) {
    return {
      theme: [
        "system",
        "night",
        "light",
        "graphite",
        "ocean",
        "sand",
        "mist",
      ].includes(s.theme)
        ? s.theme
        : "system",
      quote: s.quote !== false,
      seconds: s.seconds === true,
      hour12: s.hour12 === true,
      newtab: s.newtab !== false,
      engine:
        s.engine === "bookmarks" || Object.hasOwn(engines, s.engine)
          ? s.engine
          : "bing",
      wallpaper:
        wallOK(s.wallpaper) && typeof s.wallpaper === "string"
          ? s.wallpaper
          : "",
    };
  }
  function validate(data) {
    if (
      !data ||
      data.version !== 1 ||
      !Array.isArray(data.links) ||
      data.links.length > 20000
    )
      throw Error("不是有效的 Maple 备份（版本 1）");
    return {
      version: 1,
      settings: cleanSettings(data.settings),
      links: data.links.map((l) => {
        if (
          !l ||
          typeof l.name !== "string" ||
          !l.name.trim() ||
          typeof l.group !== "string"
        )
          throw Error("备份中的收藏格式不正确");
        return {
          id: uid(),
          name: l.name.trim().slice(0, 200),
          url: urlOf(l.url),
          ...(safeIconUrl(l.iconUrl)
            ? { iconUrl: safeIconUrl(l.iconUrl) }
            : {}),
          group: l.group.trim().slice(0, 100) || "未分组",
        };
      }),
    };
  }
  let state = {
      version: 1,
      settings: { ...defaults },
      links: bookmarks.flatMap((g) =>
        g.links.map((l) => ({
          id: uid(),
          name: l.name,
          url: urlOf(l.url),
          group: g.title,
        })),
      ),
    },
    active = "全部",
    allView = false,
    editing = null,
    dragged = null,
    pendingWall = null,
    timer;
  let loadError = false,
    iconMigrationFailed = false;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      state = validate(saved);
      if (saved.links.some((link) => Object.hasOwn(link, "icon"))) {
        const migrated = {
          ...saved,
          links: saved.links.map(({ icon, ...link }) => link),
        };
        try {
          localStorage.setItem(KEY, JSON.stringify(migrated));
        } catch {
          iconMigrationFailed = true;
        }
      }
    }
  } catch {
    loadError = true;
  }
  function toast(s) {
    $("toast").textContent = s;
    $("toast").hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => ($("toast").hidden = true), 4500);
  }
  function commit(next) {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      state = next;
      return true;
    } catch {
      toast(
        "无法保存：浏览器存储不可用或空间不足。请先导出备份，或使用更小的壁纸。",
      );
      return false;
    }
  }
  function clock() {
    const d = new Date();
    $("clock").textContent = d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      ...(state.settings.seconds ? { second: "2-digit" } : {}),
      hour12: state.settings.hour12,
    });
    const year = String(d.getFullYear()).padStart(4, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
    $("date").textContent = `${year}/${month}/${day} ${weekday}.`;
    const clockText = $("clock").textContent;
    const columns = Array.from(clockText).reduce(
      (total, char) => total + (/[^\x00-\x7f]/.test(char) ? 2 : 1), 0,
    );
    $("clock").style.setProperty("--clock-columns", columns);
    $("clock").style.setProperty("--clock-glyphs", Array.from(clockText).length);
    $("clock").dateTime = d.toISOString();
  }
  const systemScheme = window.matchMedia("(prefers-color-scheme: dark)");
  function applyTheme() {
    document.body.dataset.theme =
      state.settings.theme === "system"
        ? systemScheme.matches
          ? "night"
          : "light"
        : state.settings.theme;
  }
  systemScheme.addEventListener("change", () => {
    if (state.settings.theme === "system") applyTheme();
  });
  let quoteController = null,
    quoteAttempted = false;
  async function updateQuote(force = false) {
    const target = $("hitokoto");
    if (!state.settings.quote) {
      quoteController?.abort();
      quoteController = null;
      quoteAttempted = false;
      target.hidden = true;
      target.textContent = "";
      return;
    }
    if (quoteAttempted && !force) return;
    quoteAttempted = true;
    quoteController?.abort();
    const controller = new AbortController();
    quoteController = controller;
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch("https://v1.hitokoto.cn/?c=i", {
        signal: controller.signal,
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      if (!response.ok) throw Error("一言暂不可用");
      const data = await response.json();
      if (
        typeof data.hitokoto !== "string" ||
        !data.hitokoto.trim() ||
        data.hitokoto.length > 300
      )
        throw Error("无效的一言内容");
      if (quoteController !== controller || !state.settings.quote) return;
      const source = [data.from_who, data.from]
        .filter((x) => typeof x === "string" && x.trim())
        .join(" · ")
        .slice(0, 160);
      target.textContent =
        data.hitokoto.trim() + (source ? " — " + source : "");
      target.hidden = false;
    } catch {
      // A failed optional quote must never interrupt the start page.
    } finally {
      clearTimeout(timeout);
      if (quoteController === controller) quoteController = null;
    }
  }
  $("hitokoto").onclick = () => updateQuote(true);
  function apply() {
    applyTheme();
    updateQuote();
    document.body.classList.toggle("has-wallpaper", !!state.settings.wallpaper);
    document.querySelector(".ambient").style.backgroundImage = state.settings
      .wallpaper
      ? `url(${JSON.stringify(state.settings.wallpaper)})`
      : "";
    $("engine").value = state.settings.engine;
    clock();
    render();
  }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function render() {
    const names = [...new Set(state.links.map((l) => l.group))];
    const partsOf = (group) =>
      group === "收藏夹栏" ? [] : group.split(" / ").filter(Boolean);
    const samePrefix = (parts, prefix) =>
      prefix.every((name, i) => parts[i] === name);
    if (
      active !== "全部" &&
      !names.some((g) => samePrefix(partsOf(g), partsOf(active)))
    )
      active = "全部";
    const current = active === "全部" ? [] : partsOf(active);
    const q =
      $("engine").value === "bookmarks"
        ? $("query").value.trim().toLowerCase()
        : "";
    const go = (path) => {
      active = path;
      allView = false;
      if ($("engine").value === "bookmarks") $("query").value = "";
      render();
    };
    $("groups").replaceChildren();
    $("folders").replaceChildren();
    $("group-list").replaceChildren();
    const root = el("button", "crumb", "收藏夹");
    root.onclick = () => go("全部");
    $("groups").append(root);
    if (!q && !allView)
      current.forEach((name, i) => {
        $("groups").append(el("span", "crumb-separator", "/"));
        const b = el("button", "crumb", name);
        b.onclick = () => go(current.slice(0, i + 1).join(" / "));
        if (i === current.length - 1) b.setAttribute("aria-current", "page");
        $("groups").append(b);
      });
    if (q) $("groups").append(el("span", "crumb-label", "搜索结果"));
    const all = el(
      "button",
      "all-bookmarks" + (allView ? " active" : ""),
      "全部收藏",
    );
    all.setAttribute("aria-pressed", String(allView));
    all.onclick = () => {
      active = "全部";
      allView = !allView;
      if ($("engine").value === "bookmarks") $("query").value = "";
      render();
    };
    $("groups").append(all);
    const groupOptions = new Set(names);
    names.forEach((g) =>
      partsOf(g).forEach((_, i, parts) =>
        groupOptions.add(parts.slice(0, i + 1).join(" / ")),
      ),
    );
    groupOptions.forEach((g) => {
      const o = el("option");
      o.value = g;
      $("group-list").append(o);
    });
    const children = new Map();
    if (!q && !allView)
      for (const link of state.links) {
        const parts = partsOf(link.group);
        if (samePrefix(parts, current) && parts.length > current.length) {
          const name = parts[current.length];
          children.set(name, (children.get(name) || 0) + 1);
        }
      }
    children.forEach((count, name) => {
      const path = [...current, name].join(" / ");
      const folder = el("button", "folder");
      folder.dataset.folder = path;
      const icon = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      for (const [key, value] of Object.entries({
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "1.5",
        "aria-hidden": "true",
        class: "folder-icon",
      }))
        icon.setAttribute(key, value);
      const outline = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      outline.setAttribute(
        "d",
        "M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z",
      );
      icon.append(outline);
      folder.append(icon);
      const label = el("span", "folder-label");
      label.append(el("strong", "", name), el("small", "", `${count} 项收藏`));
      folder.append(label, el("span", "folder-arrow", "›"));
      folder.onclick = () => go(path);
      $("folders").append(folder);
    });
    const list = state.links.filter((l) =>
      q
        ? [l.name, l.url, l.group].some((s) => s.toLowerCase().includes(q))
        : allView ||
          (samePrefix(partsOf(l.group), current) &&
            partsOf(l.group).length === current.length),
    );
    $("count").textContent = `${list.length} / ${state.links.length}`;
    $("empty").hidden = !!list.length || children.size > 0;
    $("links").replaceChildren();
    for (const l of list) {
      const tile = el("div", "tile");
      tile.draggable = true;
      tile.dataset.id = l.id;
      const a = el("a");
      a.href = l.url;
      a.target = state.settings.newtab ? "_blank" : "_self";
      a.rel = "noopener noreferrer";
      a.append(bookmarkIcon(l));
      const text = el("span", "tile-text");
      text.append(
        el("strong", "", l.name),
        el("small", "", new URL(l.url).hostname),
      );
      a.append(text);
      const edit = el("button", "edit", "···");
      edit.setAttribute("aria-label", `编辑 ${l.name}`);
      edit.onclick = () => openEditor(l);
      tile.append(a, edit);
      tile.addEventListener("dragstart", (e) => {
        dragged = l.id;
        e.dataTransfer.setData("text/plain", l.id);
      });
      tile.addEventListener("dragover", (e) => e.preventDefault());
      tile.addEventListener("drop", (e) => {
        e.preventDefault();
        if (!dragged || dragged === l.id) return;
        const links = [...state.links];
        const from = links.findIndex((x) => x.id === dragged),
          to = links.findIndex((x) => x.id === l.id);
        if (from < 0 || to < 0) return;
        links.splice(to, 0, links.splice(from, 1)[0]);
        if (commit({ ...state, links })) render();
        dragged = null;
      });
      tile.addEventListener("dragend", () => (dragged = null));
      $("links").append(tile);
    }
  }
  function openEditor(l) {
    editing = l?.id || null;
    $("editor-title").textContent = l ? "编辑收藏" : "添加收藏";
    $("link-name").value = l?.name || "";
    $("link-url").value = l?.url || "";
    $("link-group").value =
      l?.group || (active === "全部" ? "收藏夹栏" : active);
    $("delete-link").hidden = !l;
    $("editor").showModal();
  }
  $("add-open").onclick = () => openEditor();
  $("editor-close").onclick = () => $("editor").close();
  $("edit-form").onsubmit = (e) => {
    e.preventDefault();
    try {
      const name = $("link-name").value.trim(),
        group = $("link-group").value.trim();
      if (!name || !group) throw Error("名称和分组不能为空");
      const l = {
        id: editing || uid(),
        name,
        url: urlOf($("link-url").value),
        group,
      };
      const previous = state.links.find((x) => x.id === editing);
      if (previous?.url === l.url && safeIconUrl(previous.iconUrl))
        l.iconUrl = previous.iconUrl;
      const links = editing
        ? state.links.map((x) => (x.id === editing ? l : x))
        : [...state.links, l];
      if (commit({ ...state, links })) {
        render();
        $("editor").close();
        toast("收藏已保存");
      }
    } catch (err) {
      toast(err.message);
    }
  };
  $("delete-link").onclick = () => {
    if (
      confirm("删除这条收藏？") &&
      commit({ ...state, links: state.links.filter((x) => x.id !== editing) })
    ) {
      render();
      $("editor").close();
    }
  };
  function navigate(url) {
    if (state.settings.newtab)
      window.open(url, "_blank", "noopener,noreferrer");
    else location.assign(url);
  }
  $("search-form").onsubmit = (e) => {
    e.preventDefault();
    const q = $("query").value.trim();
    if (!q) return;
    if ($("engine").value === "bookmarks") {
      active = "全部";
      render();
      return;
    }
    try {
      if (
        /^https?:\/\//i.test(q) ||
        /^[\w.-]+\.[a-z]{2,}([/:?#]\S*)?$/i.test(q) ||
        /^localhost(:\d+)?(\/\S*)?$/.test(q)
      )
        navigate(urlOf(q));
      else navigate(engines[$("engine").value] + encodeURIComponent(q));
    } catch (err) {
      toast(err.message);
    }
  };
  $("engine").onchange = () => {
    commit({
      ...state,
      settings: { ...state.settings, engine: $("engine").value },
    });
    render();
  };
  $("query").oninput = () => {
    if ($("engine").value === "bookmarks") render();
  };
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "/" &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      !["INPUT", "TEXTAREA", "SELECT"].includes(
        document.activeElement.tagName,
      ) &&
      !document.querySelector("dialog[open]")
    ) {
      e.preventDefault();
      $("query").focus();
    }
  });
  let wallpaperRevision = 0;
  let wallpaperBusy = false;
  function wallpaperStatus(message, error = false) {
    const status = $("wallpaper-status");
    status.textContent = message;
    status.hidden = !message;
    status.dataset.error = String(error);
  }
  function setWallpaperBusy(busy) {
    wallpaperBusy = busy;
    $("settings-save").disabled = busy;
  }
  function loadWallpaperImage(src, failureMessage = "无法加载壁纸，请使用可直接打开的图片 HTTPS 地址") {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const finish = (error) => {
        clearTimeout(timeout);
        image.onload = image.onerror = null;
        if (error) reject(error);
        else resolve(image);
      };
      const timeout = setTimeout(() => {
        finish(new Error("壁纸加载超时，请检查图片直链或换一张图片"));
        image.src = "";
      }, 12000);
      image.onload = () => image.naturalWidth && image.naturalHeight
        ? finish()
        : finish(new Error("图片内容无效，请更换壁纸"));
      image.onerror = () => finish(new Error(failureMessage));
      image.src = src;
    });
  }
  async function prepareWallpaper(file) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      throw new Error("请选择 JPG / PNG / WebP 图片");
    if (file.size > 20 * 1024 * 1024)
      throw new Error("请选择 20 MB 以内的图片，保存前会自动压缩");
    const objectURL = URL.createObjectURL(file);
    try {
      const image = await loadWallpaperImage(objectURL, "无法读取图片，文件可能损坏或格式不受支持");
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("浏览器无法处理图片，请改用壁纸网址");
      for (const edge of [2560, 1920, 1280]) {
        const ratio = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
        canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        for (const quality of [0.85, 0.7, 0.55]) {
          let result = canvas.toDataURL("image/webp", quality);
          if (!result.startsWith("data:image/webp;")) {
            context.globalCompositeOperation = "destination-over";
            context.fillStyle = "#fff";
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.globalCompositeOperation = "source-over";
            result = canvas.toDataURL("image/jpeg", quality);
          }
          if (result.length <= 1.4 * 1024 * 1024) return result;
        }
      }
      throw new Error("图片压缩后仍过大，请选择较小图片或使用壁纸网址");
    } finally {
      URL.revokeObjectURL(objectURL);
    }
  }
  $("settings-open").onclick = () => {
    wallpaperRevision++;
    setWallpaperBusy(false);
    wallpaperStatus("");
    for (const k of ["theme", "wallpaper"])
      $(k).value = state.settings[k].startsWith("data:")
        ? ""
        : state.settings[k];
    for (const k of ["seconds", "hour12", "newtab", "quote"])
      $(k).checked = state.settings[k];
    pendingWall = null;
    $("wallpaper-file").value = "";
    $("settings").showModal();
  };
  $("settings").addEventListener("close", () => {
    wallpaperRevision++;
    setWallpaperBusy(false);
  });
  $("wallpaper").oninput = () => {
    wallpaperRevision++;
    setWallpaperBusy(false);
    pendingWall = null;
    $("wallpaper-file").value = "";
    wallpaperStatus("");
  };
  $("wallpaper-file").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const revision = ++wallpaperRevision;
    setWallpaperBusy(true);
    wallpaperStatus("正在处理壁纸…");
    try {
      const result = await prepareWallpaper(file);
      if (revision !== wallpaperRevision) return;
      pendingWall = result;
      $("wallpaper").value = "";
      wallpaperStatus("壁纸已就绪，保存设置后生效");
    } catch (error) {
      if (revision !== wallpaperRevision) return;
      e.target.value = "";
      wallpaperStatus(error.message, true);
    } finally {
      if (revision === wallpaperRevision) setWallpaperBusy(false);
    }
  };
  $("wallpaper-clear").onclick = () => {
    wallpaperRevision++;
    setWallpaperBusy(false);
    pendingWall = "";
    $("wallpaper").value = "";
    $("wallpaper-file").value = "";
    wallpaperStatus("保存设置后清除壁纸");
  };
  $("settings-save").onclick = async () => {
    if (wallpaperBusy) return;
    const s = { ...state.settings };
    for (const k of ["seconds", "hour12", "newtab", "quote"])
      s[k] = $(k).checked;
    s.theme = $("theme").value;
    s.wallpaper =
      pendingWall !== null
        ? pendingWall
        : $("wallpaper").value.trim() ||
          (state.settings.wallpaper.startsWith("data:")
            ? state.settings.wallpaper
            : "");
    if (!wallOK(s.wallpaper)) {
      wallpaperStatus("壁纸网址必须使用 HTTPS 图片直链", true);
      return;
    }
    const revision = wallpaperRevision;
    setWallpaperBusy(true);
    try {
      if (s.wallpaper && !s.wallpaper.startsWith("data:")) {
        wallpaperStatus("正在验证壁纸…");
        await loadWallpaperImage(s.wallpaper);
      }
      if (revision !== wallpaperRevision) return;
      if (!commit({ ...state, settings: s })) {
        wallpaperStatus("无法保存：浏览器存储不可用或空间不足，请使用壁纸网址或先导出备份", true);
        return;
      }
      apply();
      $("settings").close();
      toast("设置已保存");
    } catch (error) {
      if (revision === wallpaperRevision) wallpaperStatus(error.message, true);
    } finally {
      if (revision === wallpaperRevision) setWallpaperBusy(false);
    }
  };
  function parseHTML(html, barOnly = false) {
    // Detached DOMParser document: never attach imported markup or load its resources.
    const doc = new DOMParser().parseFromString(html, "text/html");
    const result = [];
    for (const a of doc.querySelectorAll("a[href]")) {
      try {
        const raw = a.getAttribute("href");
        if (!/^https?:\/\//i.test(raw)) continue;
        const path = [];
        let dl = a.closest("dl");
        while (dl) {
          let h = null;
          if (dl.parentElement?.tagName === "DT")
            h = Array.from(dl.parentElement.children).find(
              (x) => x.tagName === "H3",
            );
          if (!h) {
            let prev = dl.previousElementSibling;
            if (prev?.tagName === "H3") h = prev;
            else if (prev?.tagName === "DT") h = prev.querySelector("h3");
          }
          if (h)
            path.unshift({
              name: h.textContent.trim(),
              bar:
                h.getAttribute("PERSONAL_TOOLBAR_FOLDER")?.toLowerCase() ===
                "true",
            });
          dl = dl.parentElement?.closest("dl");
        }
        const barIndex = path.findIndex((folder) => folder.bar);
        if (barOnly && barIndex < 0) continue;
        const folders = (barOnly ? path.slice(barIndex + 1) : path).map(
          (folder) => folder.name,
        );
        result.push({
          id: uid(),
          name: (a.textContent.trim() || new URL(raw).hostname).slice(0, 200),
          url: urlOf(raw),
          group: (
            folders.join(" / ") || (barOnly ? "收藏夹栏" : "导入收藏")
          ).slice(0, 100),
        });
      } catch {
        /* Skip invalid / unsafe bookmark URLs. */
      }
    }
    return result;
  }
  $("import-open").onclick = () => $("import-dialog").showModal();
  $("import-file").onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      if (f.size > 10 * 1024 * 1024)
        throw Error("文件过大，请选择 10 MB 以内的书签文件");
      const incoming = parseHTML(await f.text(), $("import-bar-only").checked);
      const known = new Set(state.links.map((x) => x.url));
      const added = incoming.filter((x) => {
        if (known.has(x.url)) return false;
        known.add(x.url);
        return true;
      });
      if (state.links.length + added.length > 20000)
        throw Error("最多支持 20000 条收藏");
      if (!incoming.length) throw Error("未找到有效 HTTP / HTTPS 书签");
      if (commit({ ...state, links: [...state.links, ...added] })) {
        active = "全部";
        render();
        $("import-dialog").close();
        toast(
          `已导入 ${added.length} 条，跳过重复 ${incoming.length - added.length} 条`,
        );
      }
    } catch (err) {
      toast(err.message);
    } finally {
      e.target.value = "";
    }
  };
  $("export").onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = el("a");
    a.href = url;
    a.download = "maple-home-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $("restore-open").onclick = () => $("restore-file").click();
  $("restore-file").onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      if (f.size > 10 * 1024 * 1024) throw Error("备份不能超过 10 MB");
      const next = validate(JSON.parse(await f.text()));
      if (
        !confirm(
          `恢复 ${next.links.length} 条收藏及设置？将覆盖当前数据，请先导出备份。`,
        )
      )
        return;
      if (commit(next)) {
        active = "全部";
        apply();
        $("settings").close();
        toast("备份已恢复");
      }
    } catch (err) {
      toast("恢复失败：" + err.message);
    } finally {
      e.target.value = "";
    }
  };
  apply();
  setInterval(clock, 1000);
  if (iconMigrationFailed)
    toast("旧图标数据暂时无法清除，请检查浏览器存储权限；收藏仍可正常使用。");
  if (loadError)
    toast(
      "本地数据无法读取，当前显示默认收藏；原始存储尚未覆盖，请先检查或备份。",
    );
})();
