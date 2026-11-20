(function() {
  'use strict';
  if (window.__cr_suite_v8_1__) return;
  window.__cr_suite_v8_1__ = true;

  const API_BASE = window.location.origin;
  const AUTH_KEY = "YOUR_API_KEY_HERE";

  function isHome() {
    const h = window.location.hash || "";
    return h === "" || h === "#" || h === "#/" || h === "#/home" || h.startsWith("#/home?");
  }
  function isDetails() {
    const h = window.location.hash || "";
    return h.startsWith("#/details") || h.includes("/details?");
  }
  function isLists() {
    const h = window.location.hash || "";
    return h.startsWith("#/lists") || h.startsWith("#/watchlist");
  }

  // --- WATCHLIST LOCAL STORAGE & SYNC ---
  function getWatchlist() {
    try {
      return JSON.parse(localStorage.getItem("cr_watchlist") || "[]");
    } catch(e) { return []; }
  }
  function isBookmarked(id) {
    var wl = getWatchlist();
    return wl.some(function(i) { return i.id === id; });
  }
  function toggleBookmark(item) {
    var wl = getWatchlist();
    var idx = wl.findIndex(function(i) { return i.id === item.id; });
    var added = false;
    if (idx >= 0) {
      wl.splice(idx, 1);
    } else {
      wl.push(item);
      added = true;
    }
    localStorage.setItem("cr_watchlist", JSON.stringify(wl));

    getActiveUserId().then(function(uid) {
      if (!uid) return;
      var method = added ? "POST" : "DELETE";
      fetch(API_BASE + "/Users/" + uid + "/FavoriteItems/" + item.id + "?ApiKey=" + AUTH_KEY, { method: method }).catch(function(){});
    });

    updateBookmarkUI(item.id, added);
    return added;
  }
  function updateBookmarkUI(id, isAdded) {
    document.querySelectorAll('[data-bookmark-id="' + id + '"]').forEach(function(btn) {
      if (isAdded) {
        btn.classList.add("bookmarked", "active");
        btn.innerHTML = '<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:currentColor;"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
      } else {
        btn.classList.remove("bookmarked", "active");
        btn.innerHTML = '<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
      }
    });
  }

  // 1. INJECT HEADER (DESKTOP SEARCH & MOBILE LOGO/ICONS)
  function injectHeaderElements() {
    var h = window.location.hash || "";
    if (h.includes("login")) {
      var s = document.getElementById("crHeaderSearch"); if (s) s.remove();
      var b = document.getElementById("crToolbarWatchlistBtn"); if (b) b.remove();
      var mob = document.getElementById("crMobileHeaderActions"); if (mob) mob.remove();
      var logo = document.getElementById("crMobileLogo"); if (logo) logo.remove();
      return;
    }

    // Suppress JE "More from JE" launcher
    var jeLauncher = document.getElementById("je-header-launcher");
    if (jeLauncher) jeLauncher.style.setProperty("display", "none", "important");
    var jePanel = document.getElementById("je-header-launcher-panel");
    if (jePanel) jePanel.remove();
    var randomBtn = document.getElementById("randomItemButton");
    if (randomBtn) randomBtn.style.setProperty("display", "none", "important");

    var toolbar = document.querySelector(".MuiToolbar-root");
    if (!toolbar) return;

    // Mobile Crunchyroll Logo (Left)
    if (!document.getElementById("crMobileLogo")) {
      var mobLogo = document.createElement("a");
      mobLogo.id = "crMobileLogo";
      mobLogo.href = "#/home";
      mobLogo.title = "Crunchyroll";
      mobLogo.innerHTML = '<svg viewBox="0 0 36 36" style="width:34px;height:34px;display:block;"><circle cx="18" cy="18" r="16" fill="#F47521"/><path d="M18 7a11 11 0 1 0 11 11A11.012 11.012 0 0 0 18 7zm0 18a7 7 0 1 1 7-7 7.008 7.008 0 0 1-7 7z" fill="#000000"/><circle cx="21" cy="16" r="3.2" fill="#F47521"/></svg>';
      toolbar.prepend(mobLogo);
    }

    // Desktop search bar
    var target = document.querySelector(".je-header-action") ||
                 document.querySelector(".MuiToolbar-root > div:nth-child(2)");
    if (target && !document.getElementById("crHeaderSearch")) {
      var wrap = document.createElement("div");
      wrap.id = "crHeaderSearch";
      wrap.innerHTML = '<div class="cr-search-wrapper">' +
        '<span class="cr-search-icon">' +
          '<svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:currentColor;"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5S11.99 14 9.5 14z"/></svg>' +
        '</span>' +
        '<input type="text" class="cr-search-input" placeholder="Search anime, movies, series..." />' +
      '</div>';
      var input = wrap.querySelector(".cr-search-input");
      input.addEventListener("keydown", function(e) {
        if (e.key === "Enter" && input.value.trim()) {
          window.location.hash = "#/search?query=" + encodeURIComponent(input.value.trim());
        }
      });
      target.prepend(wrap);
    }

    // Desktop toolbar bookmark button
    var userSec = document.querySelector(".MuiToolbar-root > div:last-child");
    if (userSec && !document.getElementById("crToolbarWatchlistBtn")) {
      var btn = document.createElement("button");
      btn.id = "crToolbarWatchlistBtn";
      btn.title = "My Lists";
      btn.innerHTML = '<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
      btn.onclick = function() {
        window.location.hash = "#/lists";
      };
      userSec.prepend(btn);
    }

    // Mobile Header Actions (Cast & Search icons)
    if (userSec && !document.getElementById("crMobileHeaderActions")) {
      var mobActions = document.createElement("div");
      mobActions.id = "crMobileHeaderActions";
      mobActions.innerHTML = 
        '<button class="cr-mobile-icon-btn" title="Cast"><svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:currentColor;"><path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg></button>' +
        '<button class="cr-mobile-icon-btn" id="crMobileSearchBtn" title="Search"><svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:currentColor;"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5S11.99 14 9.5 14z"/></svg></button>';
      var mobSearch = mobActions.querySelector("#crMobileSearchBtn");
      if (mobSearch) {
        mobSearch.onclick = function() { window.location.hash = "#/search"; };
      }
      userSec.appendChild(mobActions);
    }
  }

  // 2. INJECT FIXED MOBILE BOTTOM NAVIGATION BAR (4 TABS WITH USER PFP)
  function injectMobileBottomNav() {
    if (document.getElementById("crMobileBottomNav")) {
      updateActiveBottomTab();
      return;
    }
    var nav = document.createElement("nav");
    nav.id = "crMobileBottomNav";
    nav.innerHTML = 
      '<a class="cr-bottom-tab" data-tab="home" href="#/home">' +
        '<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>' +
        '<span>Home</span>' +
      '</a>' +
      '<a class="cr-bottom-tab" data-tab="lists" href="#/lists">' +
        '<svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>' +
        '<span>My Lists</span>' +
      '</a>' +
      '<a class="cr-bottom-tab" data-tab="browse" href="#/search">' +
        '<svg viewBox="0 0 24 24"><path d="M4 4h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4zM4 10h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4zM4 16h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4z"/></svg>' +
        '<span>Browse</span>' +
      '</a>' +
      '<a class="cr-bottom-tab" data-tab="account" href="#/settings">' +
        '<div class="cr-avatar-fallback">' +
          '<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>' +
        '</div>' +
        '<span>Account</span>' +
      '</a>';
    document.body.appendChild(nav);

    // Dynamic User PFP loading
    getActiveUserId().then(function(uid) {
      if (!uid) return;
      var accTab = nav.querySelector('[data-tab="account"]');
      if (!accTab) return;

      var avatarImg = document.createElement("img");
      avatarImg.className = "cr-bottom-user-avatar";
      avatarImg.src = API_BASE + "/Users/" + uid + "/Images/Primary?quality=80";
      avatarImg.alt = "Account";
      avatarImg.onload = function() {
        var fallback = accTab.querySelector(".cr-avatar-fallback");
        if (fallback) fallback.remove();
        accTab.prepend(avatarImg);
      };
    });

    updateActiveBottomTab();
  }

  function updateActiveBottomTab() {
    var h = window.location.hash || "";
    var nav = document.getElementById("crMobileBottomNav");
    if (!nav) return;
    nav.querySelectorAll(".cr-bottom-tab").forEach(function(tab) {
      tab.classList.remove("active");
    });
    if (isHome()) {
      var t = nav.querySelector('[data-tab="home"]'); if (t) t.classList.add("active");
    } else if (isLists()) {
      var t = nav.querySelector('[data-tab="lists"]'); if (t) t.classList.add("active");
    } else if (h.includes("search")) {
      var t = nav.querySelector('[data-tab="browse"]'); if (t) t.classList.add("active");
    } else if (h.includes("settings") || h.includes("user")) {
      var t = nav.querySelector('[data-tab="account"]'); if (t) t.classList.add("active");
    }
  }

  function purgeNavLinks() {
    var stack = document.querySelector(".MuiStack-root");
    if (!stack) return;
    var links = stack.querySelectorAll("a.MuiButton-root");
    for (var i = 1; i < links.length; i++) {
      links[i].style.display = "none";
    }
  }

  function getActiveUserId() {
    if (window.ApiClient && typeof window.ApiClient.getCurrentUserId === "function") {
      var id = window.ApiClient.getCurrentUserId();
      if (id) return Promise.resolve(id);
    }
    return fetch(API_BASE + "/Users?ApiKey=" + AUTH_KEY)
      .then(function(r) { return r.json(); })
      .then(function(users) {
        var sv = users.find(function(u) { return u.Name.toLowerCase() === "svetlin"; });
        return sv ? sv.Id : (users[0] ? users[0].Id : null);
      })
      .catch(function() { return null; });
  }

  // 3. BUILD HOMEPAGE (CLEAN ANIME-ONLY HERO & MOST POPULAR)
  var currentSlide = 0;
  var slideTimer = null;

  function buildCrunchyrollHome() {
    var page = document.querySelector("#indexPage") ||
               document.querySelector(".page:not(.hide)");
    if (!page) return;
    if (document.getElementById("crCrunchyrollHome") || document.getElementById("crHeroBanner")) return;

    var isTV = document.documentElement.classList.contains("layout-tv") ||
               document.body.classList.contains("layout-tv") ||
               navigator.userAgent.toLowerCase().includes("tv") ||
               window.location.href.includes("layout=tv");

    if (isTV) {
      // --- TV MODE ---
      var homeTab = document.getElementById("homeTab") || page;
      var hero = document.createElement("div");
      hero.id = "crHeroBanner";
      hero.className = "cr-tv-hero";
      homeTab.insertBefore(hero, homeTab.firstChild);

      getActiveUserId().then(function(uid) {
        if (!uid) return;
        var token = (window.ApiClient && window.ApiClient.accessToken()) ? window.ApiClient.accessToken() : AUTH_KEY;
        var url = API_BASE + "/Users/" + uid + "/Items?Recursive=true&IncludeItemTypes=Series&Fields=Overview,Genres,BackdropImageTags,PrimaryImageAspectRatio,UserData&SortBy=SortName&ApiKey=" + token;
        fetch(url)
          .then(function(r) { return r.json(); })
          .then(function(data) {
            var items = data.Items || [];
            var heroItems = items.filter(function(i) {
              return i.BackdropImageTags && i.BackdropImageTags.length > 0;
            });
            populateHero(hero, heroItems.slice(0, 8), uid, true);
          });
      });
      return;
    }

    // --- DESKTOP & MOBILE MODE ---
    var container = document.createElement("div");
    container.id = "crCrunchyrollHome";

    var hero = document.createElement("div");
    hero.id = "crHeroBanner";
    container.appendChild(hero);

    var popSec = document.createElement("div");
    popSec.className = "cr-section";
    popSec.id = "crMostPopularSection";
    popSec.innerHTML = 
      '<div class="cr-section-header">' +
        '<h2 class="cr-section-title">Most Popular</h2>' +
      '</div>' +
      '<div class="cr-cards-row" id="crMostPopularRow"></div>' +
      '<button class="cr-row-btn left">&#10094;</button>' +
      '<button class="cr-row-btn right">&#10095;</button>';
    container.appendChild(popSec);

    page.appendChild(container);

    getActiveUserId().then(function(uid) {
      if (!uid) return;
      var token = (window.ApiClient && window.ApiClient.accessToken()) ? window.ApiClient.accessToken() : AUTH_KEY;
      var url = API_BASE + "/Users/" + uid + "/Items?Recursive=true&IncludeItemTypes=Series&Fields=Overview,Genres,BackdropImageTags,PrimaryImageAspectRatio,UserData&SortBy=SortName&ApiKey=" + token;
      fetch(url)
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var items = data.Items || [];
          var heroItems = items.filter(function(i) {
            return i.BackdropImageTags && i.BackdropImageTags.length > 0;
          });
          populateHero(hero, heroItems.slice(0, 8), uid, false);
          populateCardsRow(document.getElementById("crMostPopularRow"), items);
        });
    });
  }

  function populateHero(heroEl, items, uid, isTV) {
    if (!items || !items.length) return;
    heroEl.innerHTML = "";

    items.forEach(function(item, idx) {
      var slide = document.createElement("div");
      slide.className = "cr-hero-slide" + (idx === 0 ? " active" : "");
      
      var bgUrl = API_BASE + "/Items/" + item.Id + "/Images/Backdrop/0?maxWidth=1920&quality=85";
      var genres = (item.Genres || []).slice(0, 3).join(", ") || "Anime";
      var desc = item.Overview || "Stream popular series on your personalized anime portal.";
      var isBook = isBookmarked(item.Id);
      var detailHash = "#/details?id=" + item.Id;

      slide.innerHTML = 
        '<div class="cr-hero-bg" style="background-image: url(\'' + bgUrl + '\');"></div>' +
        '<div class="cr-hero-gradient"></div>' +
        '<div class="cr-hero-content">' +
          '<h1 class="cr-hero-title">' + item.Name + '</h1>' +
          '<div class="cr-hero-tags">' +
            '<span class="cr-tag-badge">16+</span>' +
            '<span class="cr-tag-subdub">Sub | Dub</span>' +
            '<span class="cr-tag-genres">• ' + genres + '</span>' +
          '</div>' +
          '<p class="cr-hero-desc">' + desc + '</p>' +
          '<div class="cr-hero-actions">' +
            '<a class="cr-btn-watch' + (isTV ? ' focusable emby-button cr-tv-focus' : '') + '" ' + (isTV ? 'tabindex="0" ' : '') + 'href="' + detailHash + '">' +
              '<svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:currentColor;"><path d="M8 5v14l11-7z"/></svg>' +
              '<span>Start Watching E1</span>' +
            '</a>' +
            '<button tabindex="0" class="cr-btn-bookmark focusable emby-button' + (isBook ? ' bookmarked active' : '') + (isTV ? ' focusable emby-button cr-tv-focus' : '') + '" ' + (isTV ? 'tabindex="0" ' : '') + 'data-bookmark-id="' + item.Id + '" title="Add to Watchlist">' +
              '<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:' + (isBook ? 'currentColor' : 'none') + ';stroke:currentColor;stroke-width:2;"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>' +
            '</button>' +
          '</div>' +
        '</div>';

      var bBtn = slide.querySelector('.cr-btn-bookmark');
      bBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleBookmark({ id: item.Id, name: item.Name, type: item.Type });
      };

      heroEl.appendChild(slide);
    });

    // Arrows
    var prevBtn = document.createElement("button");
    prevBtn.className = "cr-hero-arrow prev";
    prevBtn.innerHTML = "&#10094;";
    prevBtn.onclick = function() { changeSlide(currentSlide - 1, items.length); };
    heroEl.appendChild(prevBtn);

    var nextBtn = document.createElement("button");
    nextBtn.className = "cr-hero-arrow next";
    nextBtn.innerHTML = "&#10095;";
    nextBtn.onclick = function() { changeSlide(currentSlide + 1, items.length); };
    heroEl.appendChild(nextBtn);

    // Dashes
    var dashes = document.createElement("div");
    dashes.className = "cr-hero-dashes";
    for (var i = 0; i < items.length; i++) {
      var dash = document.createElement("div");
      dash.className = "cr-hero-dash" + (i === 0 ? " active" : "");
      dash.setAttribute("data-idx", i);
      dash.onclick = (function(index) {
        return function() { changeSlide(index, items.length); };
      })(i);
      dashes.appendChild(dash);
    }
    heroEl.appendChild(dashes);

    // Auto rotate
    if (slideTimer) clearInterval(slideTimer);
    slideTimer = setInterval(function() {
      changeSlide(currentSlide + 1, items.length);
    }, 6000);
  }

  function changeSlide(targetIdx, total) {
    if (total <= 0) return;
    currentSlide = (targetIdx + total) % total;

    var slides = document.querySelectorAll(".cr-hero-slide");
    var dashes = document.querySelectorAll(".cr-hero-dash");

    slides.forEach(function(s, idx) {
      if (idx === currentSlide) s.classList.add("active");
      else s.classList.remove("active");
    });
    dashes.forEach(function(d, idx) {
      if (idx === currentSlide) d.classList.add("active");
      else d.classList.remove("active");
    });
  }

  function populateCardsRow(rowEl, items) {
    if (!rowEl) return;
    rowEl.innerHTML = "";

    items.forEach(function(item) {
      var card = document.createElement("a");
      card.className = "cr-poster-card focusable emby-button"; card.setAttribute("tabindex", "0");
      card.href = "#/details?id=" + item.Id;

      var imgUrl = API_BASE + "/Items/" + item.Id + "/Images/Primary?maxHeight=450&quality=85";
      var sub = item.Type === "Series" ? "Series" : (item.ProductionYear ? "" + item.ProductionYear : "Anime");

      card.innerHTML = 
        '<div class="cr-poster-img-wrap">' +
          '<img class="cr-poster-img" src="' + imgUrl + '" alt="' + item.Name + '" loading="lazy" />' +
        '</div>' +
        '<div class="cr-poster-title">' + item.Name + '</div>' +
        '<div class="cr-poster-subtitle">' + sub + '</div>';

      rowEl.appendChild(card);
    });

    // Arrow handlers
    var sec = rowEl.closest(".cr-section");
    if (sec) {
      var leftBtn = sec.querySelector(".cr-row-btn.left");
      var rightBtn = sec.querySelector(".cr-row-btn.right");
      if (leftBtn) leftBtn.onclick = function() { rowEl.scrollBy({ left: -600, behavior: "smooth" }); };
      if (rightBtn) rightBtn.onclick = function() { rowEl.scrollBy({ left: 600, behavior: "smooth" }); };
    }
  }

  // 4. BUILD SERIES DETAILS PAGE OVERHAUL
  function buildCrunchyrollSeriesPage() {
    var page = document.querySelector("#itemDetailPage") || document.querySelector(".page:not(.hide)");
    if (!page) return;
    if (document.getElementById("crSeriesDetailPage")) return;

    var m = window.location.hash.match(/id=([a-f0-9]+)/i);
    if (!m) return;
    var itemId = m[1];

    getActiveUserId().then(function(uid) {
      if (!uid) return;

      fetch(API_BASE + "/Users/" + uid + "/Items/" + itemId + "?ApiKey=" + AUTH_KEY)
        .then(function(r) { return r.json(); })
        .then(function(item) {
          if (!item) return;

          fetch(API_BASE + "/Shows/" + itemId + "/Episodes?UserId=" + uid + "&Fields=Overview,PrimaryImageAspectRatio,UserData&ApiKey=" + AUTH_KEY)
            .then(function(r) { return r.json(); })
            .then(function(epData) {
              var episodes = epData.Items || [];
              renderSeriesDetailPage(page, item, episodes, uid);
            });
        });
    });
  }

  function renderSeriesDetailPage(pageEl, item, episodes, uid) {
    if (document.getElementById("crSeriesDetailPage")) return;

    var container = document.createElement("div");
    container.id = "crSeriesDetailPage";

    var bgUrl = item.BackdropImageTags && item.BackdropImageTags.length > 0 ?
      API_BASE + "/Items/" + item.Id + "/Images/Backdrop/0?maxWidth=1920&quality=85" :
      API_BASE + "/Items/" + item.Id + "/Images/Primary?maxWidth=1920&quality=85";

    var genres = (item.Genres || []).join(", ") || "Anime, Shonen";
    var desc = item.Overview || "";
    var isBook = isBookmarked(item.Id);
    var isItemWatched = item.UserData && item.UserData.Played;

    // Smart Continue button logic
    var nextEp = episodes.find(function(e) { return e.UserData && !e.UserData.Played; });
    var btnText = "Start Watching E1";
    var playEpId = episodes[0] ? episodes[0].Id : item.Id;

    if (isItemWatched) {
      btnText = "Rewatch E1";
      playEpId = episodes[0] ? episodes[0].Id : item.Id;
    } else if (nextEp) {
      var epNum = nextEp.IndexNumber || 1;
      btnText = epNum > 1 ? "Continue E" + epNum : "Start Watching E1";
      playEpId = nextEp.Id;
    }

    container.innerHTML = 
      '<div class="cr-detail-hero" style="background-image: url(\'' + bgUrl + '\');">' +
        '<div class="cr-detail-hero-gradient"></div>' +
        '<div class="cr-detail-hero-content">' +
          '<h1 class="cr-detail-title">' + item.Name + '</h1>' +
          '<div class="cr-detail-tags">' +
            '<span class="cr-tag-badge">16+</span>' +
            '<span class="cr-tag-subdub">Sub | Dub</span>' +
            '<span class="cr-tag-genres">• ' + genres + '</span>' +
          '</div>' +
          '<p class="cr-detail-desc">' + desc + '</p>' +
          '<div class="cr-detail-actions">' +
            '<button class="cr-btn-watch focusable emby-button" tabindex="0" id="crDetailPlayBtn">' +
              '<svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:currentColor;"><path d="M8 5v14l11-7z"/></svg>' +
              '<span>' + btnText + '</span>' +
            '</button>' +
            '<button tabindex="0" class="cr-btn-bookmark focusable emby-button' + (isBook ? ' bookmarked active' : '') + '" data-bookmark-id="' + item.Id + '" title="Watchlist">' +
              '<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:' + (isBook ? 'currentColor' : 'none') + ';stroke:currentColor;stroke-width:2;"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>' +
            '</button>' +
            '<button class="cr-btn-watched' + (isItemWatched ? ' watched' : '') + '" id="crDetailWatchedToggle" title="Mark Series Watched">' +
              '<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:currentColor;"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="cr-episodes-section">' +
        '<h2 class="cr-section-title">Episodes (' + episodes.length + ')</h2>' +
        '<div class="cr-episodes-grid" id="crEpisodesGrid"></div>' +
      '</div>';

    // Play button
    var playBtn = container.querySelector("#crDetailPlayBtn");
    if (playBtn) {
      playBtn.onclick = function() {
        if (window.playbackManager) {
          window.playbackManager.play({ ids: [playEpId] });
        } else {
          window.location.hash = "#/video?id=" + playEpId;
        }
      };
    }

    // Bookmark toggle
    var bBtn = container.querySelector('.cr-btn-bookmark');
    if (bBtn) {
      bBtn.onclick = function() {
        toggleBookmark({ id: item.Id, name: item.Name, type: item.Type });
      };
    }

    // Watched toggle
    var wBtn = container.querySelector('#crDetailWatchedToggle');
    if (wBtn) {
      wBtn.onclick = function() {
        var markWatched = !wBtn.classList.contains("watched");
        var method = markWatched ? "POST" : "DELETE";
        fetch(API_BASE + "/Users/" + uid + "/PlayedItems/" + item.Id + "?ApiKey=" + AUTH_KEY, { method: method })
          .then(function() {
            wBtn.classList.toggle("watched", markWatched);
          });
      };
    }

    // Populate Episodes Grid
    var grid = container.querySelector("#crEpisodesGrid");
    episodes.forEach(function(ep) {
      var epCard = document.createElement("div");
      epCard.className = "cr-episode-card";
      var epThumb = ep.Id ? API_BASE + "/Items/" + ep.Id + "/Images/Primary?maxHeight=300&quality=80" : bgUrl;
      var epNum = ep.IndexNumber || 1;
      var epName = ep.Name || ("Episode " + epNum);
      var dur = ep.RunTimeTicks ? Math.round(ep.RunTimeTicks / (10000000 * 60)) + "m" : "24m";

      epCard.innerHTML = 
        '<div class="cr-episode-thumb-wrap">' +
          '<img class="cr-episode-thumb" src="' + epThumb + '" alt="' + epName + '" loading="lazy" />' +
          '<span class="cr-episode-duration">' + dur + '</span>' +
        '</div>' +
        '<div class="cr-episode-info">' +
          '<div class="cr-episode-title">E' + epNum + ' - ' + epName + '</div>' +
          '<div class="cr-episode-sub">Sub | Dub</div>' +
        '</div>';

      epCard.onclick = function() {
        if (window.playbackManager) {
          window.playbackManager.play({ ids: [ep.Id] });
        } else {
          window.location.hash = "#/video?id=" + ep.Id;
        }
      };

      grid.appendChild(epCard);
    });

    pageEl.appendChild(container);
  }

  // 5. BUILD MY LISTS PAGE OVERHAUL (#/lists)
  function buildCrunchyrollMyLists() {
    var page = document.querySelector("#myPreferencesMenuPage") ||
               document.querySelector(".page:not(.hide)");
    if (!page) return;
    if (document.getElementById("crMyListsPage")) return;

    var container = document.createElement("div");
    container.id = "crMyListsPage";

    container.innerHTML = 
      '<div class="cr-mylists-header">' +
        '<h1 class="cr-mylists-title">' +
          '<svg viewBox="0 0 24 24" style="width:32px;height:32px;fill:currentColor;"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>' +
          '<span>My Lists</span>' +
        '</h1>' +
      '</div>' +
      '<div class="cr-mylists-nav">' +
        '<button class="cr-mylists-tab-btn active" data-tab="watchlist">WATCHLIST</button>' +
        '<button class="cr-mylists-tab-btn" data-tab="crunchylists">CRUNCHYLISTS</button>' +
        '<button class="cr-mylists-tab-btn" data-tab="history">HISTORY</button>' +
      '</div>' +
      '<div id="crMyListsContent"></div>';

    page.appendChild(container);

    // Tab buttons
    container.querySelectorAll(".cr-mylists-tab-btn").forEach(function(btn) {
      btn.onclick = function() {
        container.querySelectorAll(".cr-mylists-tab-btn").forEach(function(b) { b.classList.remove("active"); });
        btn.classList.add("active");
        renderListsTab(btn.getAttribute("data-tab"));
      };
    });

    renderListsTab("watchlist");
  }

  function renderListsTab(tabName) {
    var contentEl = document.getElementById("crMyListsContent");
    if (!contentEl) return;
    contentEl.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">Loading...</div>';

    getActiveUserId().then(function(uid) {
      if (!uid) return;

      if (tabName === "watchlist") {
        var bookmarkedIds = getWatchlist().map(function(i) { return i.id; });
        var playedUrl = API_BASE + "/Users/" + uid + "/Items?Recursive=true&IncludeItemTypes=Series,Movie&Filters=IsPlayed&Fields=PrimaryImageAspectRatio,UserData&ApiKey=" + AUTH_KEY;

        fetch(playedUrl)
          .then(function(r) { return r.json(); })
          .then(function(pData) {
            var playedItems = pData.Items || [];
            var allItemsMap = {};
            playedItems.forEach(function(it) { allItemsMap[it.Id] = it; });

            if (bookmarkedIds.length > 0) {
              fetch(API_BASE + "/Users/" + uid + "/Items?Ids=" + bookmarkedIds.join(",") + "&Fields=PrimaryImageAspectRatio,UserData&ApiKey=" + AUTH_KEY)
                .then(function(r) { return r.json(); })
                .then(function(bData) {
                  (bData.Items || []).forEach(function(it) { allItemsMap[it.Id] = it; });
                  renderWatchlistItems(contentEl, Object.values(allItemsMap));
                })
                .catch(function() {
                  renderWatchlistItems(contentEl, Object.values(allItemsMap));
                });
            } else {
              renderWatchlistItems(contentEl, Object.values(allItemsMap));
            }
          });
      } else if (tabName === "crunchylists") {
        contentEl.innerHTML = 
          '<div class="cr-empty-box">' +
            '<div class="cr-empty-icon">&#128218;</div>' +
            '<p class="cr-empty-text">Create and organize your favorite anime into custom Crunchylists!</p>' +
            '<button class="cr-btn-home-feed" onclick="window.location.hash=\'#/home\'">Explore Shows</button>' +
          '</div>';
      } else if (tabName === "history") {
        var histUrl = API_BASE + "/Users/" + uid + "/Items?Recursive=true&IncludeItemTypes=Episode,Movie&Filters=IsPlayed&SortBy=DatePlayed&SortOrder=Descending&Limit=24&Fields=PrimaryImageAspectRatio,UserData,SeriesName&ApiKey=" + AUTH_KEY;
        fetch(histUrl)
          .then(function(r) { return r.json(); })
          .then(function(data) {
            renderWatchlistItems(contentEl, data.Items || []);
          });
      }
    });
  }

  function renderWatchlistItems(containerEl, items) {
    if (!items || items.length === 0) {
      containerEl.innerHTML = 
        '<div class="cr-empty-box">' +
          '<div class="cr-empty-icon">&#128148;</div>' +
          '<p class="cr-empty-text">Your Watchlist needs some love.<br/>Let\'s fill it up with awesome anime.</p>' +
          '<a class="cr-btn-home-feed" href="#/home">Go to Home Feed</a>' +
        '</div>';
      return;
    }

    var grid = document.createElement("div");
    grid.className = "cr-watchlist-grid";

    items.forEach(function(item) {
      var card = document.createElement("a");
      card.className = "cr-poster-card focusable emby-button"; card.setAttribute("tabindex", "0");
      var detailId = item.SeriesId || item.Id;
      card.href = "#/details?id=" + detailId;

      var imgId = item.Type === "Episode" && item.SeriesId ? item.SeriesId : item.Id;
      var imgUrl = API_BASE + "/Items/" + imgId + "/Images/Primary?maxHeight=450&quality=85";
      var title = item.SeriesName || item.Name;
      var sub = item.Type === "Episode" ? (item.Name || "Episode") : (item.Type === "Series" ? "Series" : "Movie");
      var isWatched = item.UserData && item.UserData.Played;

      card.innerHTML = 
        '<div class="cr-poster-img-wrap">' +
          '<img class="cr-poster-img" src="' + imgUrl + '" alt="' + title + '" loading="lazy" />' +
          (isWatched ? '<span class="cr-history-badge">&#10003; WATCHED</span>' : '') +
        '</div>' +
        '<div class="cr-poster-title">' + title + '</div>' +
        '<div class="cr-poster-subtitle">' + sub + '</div>';

      grid.appendChild(card);
    });

    containerEl.innerHTML = "";
    containerEl.appendChild(grid);
  }

  // MAIN CONTROLLER
  var debounceTimeout = null;
  function setup() {
    purgeNavLinks();
    injectHeaderElements();
    injectMobileBottomNav();

    if (isHome()) {
      var listsEl = document.getElementById("crMyListsPage"); if (listsEl) listsEl.remove();
      var detEl = document.getElementById("crSeriesDetailPage"); if (detEl) detEl.remove();
      buildCrunchyrollHome();
    } else if (isDetails()) {
      var homeEl = document.getElementById("crCrunchyrollHome"); if (homeEl) homeEl.remove();
      var listsEl = document.getElementById("crMyListsPage"); if (listsEl) listsEl.remove();
      buildCrunchyrollSeriesPage();
    } else if (isLists()) {
      var homeEl = document.getElementById("crCrunchyrollHome"); if (homeEl) homeEl.remove();
      var detEl = document.getElementById("crSeriesDetailPage"); if (detEl) detEl.remove();
      buildCrunchyrollMyLists();
    }
  }

  var observer = new MutationObserver(function() {
    // Suppress JE
    var jeLauncher = document.getElementById("je-header-launcher");
    if (jeLauncher) jeLauncher.style.setProperty("display", "none", "important");
    var jePanel = document.getElementById("je-header-launcher-panel");
    if (jePanel) jePanel.remove();
    var randomBtn = document.getElementById("randomItemButton");
    if (randomBtn) randomBtn.style.setProperty("display", "none", "important");

    if (isHome() && !document.getElementById("crCrunchyrollHome")) {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(setup, 60);
    } else if (isDetails() && !document.getElementById("crSeriesDetailPage")) {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(setup, 60);
    } else if (isLists() && !document.getElementById("crMyListsPage")) {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(setup, 60);
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener("DOMContentLoaded", function() {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  window.addEventListener("hashchange", function() { setTimeout(setup, 120); });
  window.addEventListener("popstate", function() { setTimeout(setup, 120); });

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setup();
  } else {
    window.addEventListener("DOMContentLoaded", setup);
  }

  // --- TV REMOTE & KEYBOARD D-PAD SPATIAL NAVIGATION ---
  document.addEventListener("keydown", function(e) {
    var active = document.activeElement;
    if (!active) return;

    var isCard = active.classList.contains("cr-poster-card") || active.classList.contains("card");
    var isHeroBtn = active.classList.contains("cr-btn-watch") || active.classList.contains("cr-btn-bookmark");

    if (e.key === "ArrowRight") {
      if (isCard) {
        var next = active.nextElementSibling;
        if (next && (next.classList.contains("cr-poster-card") || next.classList.contains("card"))) {
          e.preventDefault();
          next.focus();
          next.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
      } else if (isHeroBtn && active.classList.contains("cr-btn-watch")) {
        var bookmark = document.querySelector(".cr-hero-slide.active .cr-btn-bookmark") || document.querySelector(".cr-btn-bookmark");
        if (bookmark) {
          e.preventDefault();
          bookmark.focus();
        }
      }
    } else if (e.key === "ArrowLeft") {
      if (isCard) {
        var prev = active.previousElementSibling;
        if (prev && (prev.classList.contains("cr-poster-card") || prev.classList.contains("card"))) {
          e.preventDefault();
          prev.focus();
          prev.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
      } else if (isHeroBtn && active.classList.contains("cr-btn-bookmark")) {
        var watch = document.querySelector(".cr-hero-slide.active .cr-btn-watch") || document.querySelector(".cr-btn-watch");
        if (watch) {
          e.preventDefault();
          watch.focus();
        }
      }
    } else if (e.key === "ArrowDown") {
      if (isHeroBtn) {
        var firstCard = document.querySelector(".cr-poster-card") || document.querySelector(".card");
        if (firstCard) {
          e.preventDefault();
          firstCard.focus();
          firstCard.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    } else if (e.key === "ArrowUp") {
      if (isCard) {
        var watchBtn = document.querySelector(".cr-hero-slide.active .cr-btn-watch") || document.querySelector(".cr-btn-watch");
        if (watchBtn) {
          e.preventDefault();
          watchBtn.focus();
          watchBtn.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    } else if (e.key === "Enter" || e.keyCode === 13) {
      if (isCard) {
        e.preventDefault();
        active.click();
      }
    }
  });

})();