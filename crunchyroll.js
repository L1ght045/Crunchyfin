(function() {
  'use strict';
  if (window.__cr_suite_v7__) return;
  window.__cr_suite_v7__ = true;

  const API_BASE = window.location.origin;
  const AUTH_KEY = "YOUR_API_KEY_HERE";

  function isHome() {
    const h = window.location.hash || "";
    return h === "" || h === "#" || h === "#/" || h === "#/home" || h === "#/home?";
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

    // Also sync with Jellyfin favorite API
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

  // 1. INJECT HEADER SEARCH & BOOKMARK BUTTON (Picture 4)
  function injectHeaderElements() {
    var h = window.location.hash || "";
    if (h.includes("login")) {
      var s = document.getElementById("crHeaderSearch"); if (s) s.remove();
      var b = document.getElementById("crToolbarWatchlistBtn"); if (b) b.remove();
      return;
    }

    // Search bar
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

    // Bookmark button in toolbar right section (Picture 4)
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
  }

  // 2. HIDE MUI NAV LINKS (keep logo only)
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

  // 3. BUILD HOMEPAGE
  var currentSlide = 0;
  var slideTimer = null;
  var heroSlides = [];
  var isBuildingHome = false;

  function buildCrunchyrollHome() {
    if (!isHome()) {
      var old = document.getElementById("crCrunchyrollHome");
      if (old) old.remove();
      if (slideTimer) clearInterval(slideTimer);
      return Promise.resolve();
    }
    if (document.getElementById("crCrunchyrollHome") || isBuildingHome) return Promise.resolve();
    isBuildingHome = true;

    var homePage = document.querySelector("#indexPage") ||
                   document.querySelector(".homePage") ||
                   document.querySelector("#homeTab") ||
                   document.querySelector(".page:not(.hide)");
    if (!homePage) { isBuildingHome = false; return Promise.resolve(); }

    var container = document.createElement("div");
    container.id = "crCrunchyrollHome";

    return getActiveUserId().then(function(userId) {
      return fetch(API_BASE + "/Items?IncludeItemTypes=Series&Recursive=true&Fields=Overview,Genres,BackdropImageTags,ParentId&SortBy=SortName&ApiKey=" + AUTH_KEY + (userId ? "&userId=" + userId : ""))
        .then(function(r) { return r.json(); })
        .then(function(aData) {
          var allAnime = aData.Items || [];

          // --- HERO BANNER ---
          var heroItems = allAnime.filter(function(i) { return i.BackdropImageTags && i.BackdropImageTags.length > 0; }).slice(0, 6);
          if (heroItems.length > 0) {
            var bannerEl = document.createElement("div");
            bannerEl.id = "crHeroBanner";

            heroItems.forEach(function(item, idx) {
              var bgUrl = API_BASE + "/Items/" + item.Id + "/Images/Backdrop/0?maxWidth=1920&quality=85";
              var detailUrl = "#/details?id=" + item.Id + "&serverId=" + item.ServerId;
              var genres = (item.Genres || []).slice(0, 3).join(", ");
              var overview = item.Overview || "Stream this hit anime on your personal server.";
              var tmp = document.createElement("div");
              tmp.innerHTML = overview;
              overview = tmp.textContent || tmp.innerText || "";
              var isItemWatched = Boolean(item.UserData && item.UserData.Played);
            var inWl = isBookmarked(item.Id);

              var slide = document.createElement("div");
              slide.className = "cr-hero-slide" + (idx === 0 ? " active" : "");
              slide.innerHTML =
                '<div class="cr-hero-bg" style="background-image:url(\'' + bgUrl + '\')"></div>' +
                '<div class="cr-hero-gradient"></div>' +
                '<div class="cr-hero-content">' +
                  '<h1 class="cr-hero-title">' + item.Name + '</h1>' +
                  '<div class="cr-hero-tags">' +
                    '<span class="cr-tag-badge">16+</span>' +
                    '<span class="cr-tag-subdub">Sub | Dub</span>' +
                    '<span class="cr-tag-genres">' + (genres ? "\u2022 " + genres : "") + '</span>' +
                  '</div>' +
                  '<p class="cr-hero-desc">' + overview + '</p>' +
                  '<div class="cr-hero-actions">' +
                    '<a href="' + detailUrl + '" class="cr-btn-watch">' +
                      '<svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:currentColor;"><path d="M8 5v14l11-7z"/></svg>' +
                      ' Watch Now</a>' +
                    '<button class="cr-btn-bookmark' + (inWl ? " bookmarked" : "") + '" data-bookmark-id="' + item.Id + '" title="Add to Watchlist">' +
                      (inWl ? '<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:currentColor;"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>' :
                              '<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>') +
                    '</button>' +
                  '</div>' +
                '</div>';

              var bmBtn = slide.querySelector('.cr-btn-bookmark');
              bmBtn.addEventListener("click", function(e) {
                e.stopPropagation();
                toggleBookmark({ id: item.Id, name: item.Name, serverId: item.ServerId });
              });

              bannerEl.appendChild(slide);
            });

            var prevBtn = document.createElement("button");
            prevBtn.className = "cr-hero-arrow prev"; prevBtn.innerHTML = "&#10094;";
            prevBtn.addEventListener("click", function() { goToSlide((currentSlide - 1 + heroSlides.length) % heroSlides.length); });
            bannerEl.appendChild(prevBtn);

            var nextBtn = document.createElement("button");
            nextBtn.className = "cr-hero-arrow next"; nextBtn.innerHTML = "&#10095;";
            nextBtn.addEventListener("click", function() { goToSlide((currentSlide + 1) % heroSlides.length); });
            bannerEl.appendChild(nextBtn);

            var dashes = document.createElement("div");
            dashes.className = "cr-hero-dashes";
            heroItems.forEach(function(_, idx) {
              var dash = document.createElement("div");
              dash.className = "cr-hero-dash" + (idx === 0 ? " active" : "");
              dash.addEventListener("click", function() { goToSlide(idx); });
              dashes.appendChild(dash);
            });
            bannerEl.appendChild(dashes);

            bannerEl.addEventListener("mouseenter", function() { if (slideTimer) clearInterval(slideTimer); });
            bannerEl.addEventListener("mouseleave", function() { resetTimer(); });

            container.appendChild(bannerEl);
            heroSlides = bannerEl.querySelectorAll(".cr-hero-slide");
            resetTimer();
          }

          // --- MOST POPULAR ---
            if (allAnime.length > 0) {
              var popSec = document.createElement("div");
              popSec.className = "cr-section";
              popSec.innerHTML = '<div class="cr-section-header"><h2 class="cr-section-title">Most Popular</h2></div>';
              var popRow = document.createElement("div");
              popRow.className = "cr-cards-row";

              allAnime.forEach(function(item) {
                var posterUrl = API_BASE + "/Items/" + item.Id + "/Images/Primary?maxWidth=350&quality=85";
                var card = document.createElement("div");
                card.className = "cr-poster-card";
                card.onclick = function() { window.location.hash = "#/details?id=" + item.Id + "&serverId=" + item.ServerId; };
                card.innerHTML =
                  '<div class="cr-poster-thumb-wrap">' +
                    '<img class="cr-poster-thumb" src="' + posterUrl + '" alt="' + item.Name + '" onerror="this.style.display=\'none\'" />' +
                  '</div>' +
                  '<div class="cr-poster-info">' +
                    '<div class="cr-poster-title" title="' + item.Name + '">' + item.Name + '</div>' +
                    '<div class="cr-poster-subtitle">Sub | Dub</div>' +
                  '</div>';
                popRow.appendChild(card);
              });

              var pL = document.createElement("button");
              pL.className = "cr-row-btn left"; pL.innerHTML = "&#10094;";
              pL.onclick = function() { popRow.scrollBy({left:-600,behavior:"smooth"}); };
              var pR = document.createElement("button");
              pR.className = "cr-row-btn right"; pR.innerHTML = "&#10095;";
              pR.onclick = function() { popRow.scrollBy({left:600,behavior:"smooth"}); };
              popSec.appendChild(pL); popSec.appendChild(pR);
              popSec.appendChild(popRow);
              container.appendChild(popSec);
            }

            var homeTab = document.querySelector("#homeTab") || homePage;
            homeTab.prepend(container);
            isBuildingHome = false;
        });
    }).catch(function(err) {
      isBuildingHome = false;
    });
  }

  function goToSlide(idx) {
    if (!heroSlides.length) return;
    heroSlides.forEach(function(s, i) { s.classList.toggle("active", i === idx); });
    document.querySelectorAll(".cr-hero-dash").forEach(function(d, i) { d.classList.toggle("active", i === idx); });
    currentSlide = idx;
    resetTimer();
  }

  function resetTimer() {
    if (slideTimer) clearInterval(slideTimer);
    slideTimer = setInterval(function() {
      if (!heroSlides.length) return;
      goToSlide((currentSlide + 1) % heroSlides.length);
    }, 6000);
  }

  // ==============================================================
  // 4. BUILD CRUNCHYROLL ANIME SERIES DETAILS PAGE (PICTURE 2)
  // ==============================================================
  var isBuildingDetails = false;
  var currentSeriesId = null;

  function buildCrunchyrollSeriesPage() {
    console.log("[CR_SERIES] buildCrunchyrollSeriesPage invoked! hash=" + window.location.hash);
    if (!isDetails()) {
      var old = document.getElementById("crSeriesDetailPage");
      if (old) old.remove();
      currentSeriesId = null;
      return;
    }

    var h = window.location.hash || "";
    var m = h.match(/id=([a-f0-9]+)/i);
    if (!m) return;
    var itemId = m[1];

    if (currentSeriesId === itemId && document.getElementById("crSeriesDetailPage")) return;
    if (isBuildingDetails) return;
    isBuildingDetails = true;

    var detailPage = document.querySelector("#itemDetailPage");
    if (!detailPage) {
      isBuildingDetails = false;
      return;
    }

    // Check item type
    getActiveUserId().then(function(uid) {
      return fetch(API_BASE + "/Users/" + (uid || "") + "/Items/" + itemId + "?ApiKey=" + AUTH_KEY)
        .then(function(r) { return r.json(); })
        .then(function(item) {
          console.log("[CR_SERIES] Item fetched: " + item.Name + ", Type=" + item.Type);
          if (item.Type !== "Series") {
            // Not a series (e.g. single movie or episode) - don't replace with series page
            var old = document.getElementById("crSeriesDetailPage");
            if (old) old.remove();
            isBuildingDetails = false;
            return;
          }

          currentSeriesId = itemId;

          // Fetch seasons & episodes
          return Promise.all([
            fetch(API_BASE + "/Shows/" + itemId + "/Seasons?userId=" + (uid || "") + "&ApiKey=" + AUTH_KEY).then(function(r){return r.json();}),
            fetch(API_BASE + "/Shows/" + itemId + "/Episodes?userId=" + (uid || "") + "&Fields=Overview,RunTimeTicks,MediaStreams,UserData&ApiKey=" + AUTH_KEY).then(function(r){return r.json();})
          ]).then(function(res) {
            var seasons = res[0].Items || [];
            var episodes = res[1].Items || [];

            // Hide old Jellyfin details layout
            var oldWrap = detailPage.querySelector(".detailPageWrapperContainer");
            if (oldWrap) oldWrap.style.display = "none";
            var oldLogo = detailPage.querySelector(".detailLogo");
            if (oldLogo) oldLogo.style.display = "none";
            var oldBackdrop = detailPage.querySelector(".itemBackdrop");
            if (oldBackdrop) oldBackdrop.style.display = "none";

            var oldCr = document.getElementById("crSeriesDetailPage");
            if (oldCr) oldCr.remove();

            var container = document.createElement("div");
            container.id = "crSeriesDetailPage";

            // Metadata parsing
            var bgUrl = API_BASE + "/Items/" + item.Id + "/Images/Backdrop/0?maxWidth=1920&quality=90";
            var logoUrl = (item.ImageTags && item.ImageTags.Logo) ? (API_BASE + "/Items/" + item.Id + "/Images/Logo?maxWidth=500") : null;
            var genres = (item.Genres || []).join(", ");
            var rating = item.CommunityRating ? item.CommunityRating.toFixed(1) : "4.8";
            var ageRating = item.OfficialRating || "14+";
            var isItemWatched = Boolean(item.UserData && item.UserData.Played);
            var inWl = isBookmarked(item.Id);
            var firstEp = episodes[0];
             // Determine continue/start state from episode UserData
             var nextUpEp = null;
             var hasResume = false;
             episodes.forEach(function(ep) {
               if (!nextUpEp && ep.UserData && ep.UserData.PlaybackPositionTicks > 0 && !ep.UserData.Played) {
                 nextUpEp = ep;
                 hasResume = true;
               }
             });
             if (!nextUpEp) {
               episodes.forEach(function(ep) {
                 if (!nextUpEp && ep.UserData && !ep.UserData.Played) {
                   nextUpEp = ep;
                 }
               });
             }
             var hasAnyPlayed = episodes.some(function(ep) { return ep.UserData && (ep.UserData.Played || ep.UserData.PlaybackPositionTicks > 0); });
             var allPlayed = isItemWatched || (episodes.length > 0 && episodes.every(function(ep) { return ep.UserData && ep.UserData.Played; }));
             var targetEp = nextUpEp || firstEp;
             var watchBtnLabel, watchBtnIcon;

             if (allPlayed) {
               targetEp = firstEp;
               watchBtnLabel = "REWATCH E1";
               watchBtnIcon = '<svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:currentColor;"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>';
             } else if (hasResume || hasAnyPlayed || (nextUpEp && nextUpEp !== firstEp)) {
               var epNum = targetEp ? (targetEp.IndexNumber || 1) : 1;
               watchBtnLabel = "CONTINUE E" + epNum;
               watchBtnIcon = '<svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:currentColor;"><path d="M8 5v14l11-7z"/></svg>';
             } else {
               targetEp = firstEp;
               watchBtnLabel = "START WATCHING E1";
               watchBtnIcon = '<svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:currentColor;"><path d="M8 5v14l11-7z"/></svg>';
             }
             var watchFirstUrl = targetEp ? ("#/details?id=" + targetEp.Id + "&serverId=" + targetEp.ServerId) : ("#/details?id=" + item.Id + "&serverId=" + item.ServerId);

            // Clean overview
            var tmp = document.createElement("div");
            tmp.innerHTML = item.Overview || "Stream all episodes on your personal server.";
            var cleanDesc = tmp.textContent || tmp.innerText || "";

            // Audio & Subs languages
            var audioLangs = "Japanese, English";
            var subLangs = "English";
            if (firstEp && firstEp.MediaStreams) {
              var aList = firstEp.MediaStreams.filter(function(s){return s.Type==="Audio";}).map(function(s){return s.Language ? s.Language.toUpperCase() : "JP";});
              var sList = firstEp.MediaStreams.filter(function(s){return s.Type==="Subtitle";}).map(function(s){return s.Language ? s.Language.toUpperCase() : "EN";});
              if (aList.length) audioLangs = Array.from(new Set(aList)).join(", ");
              if (sList.length) subLangs = Array.from(new Set(sList)).join(", ");
            }

            container.innerHTML =
              '<div class="cr-detail-hero">' +
                '<div class="cr-detail-hero-bg" style="background-image:url(\'' + bgUrl + '\')"></div>' +
                '<div class="cr-detail-hero-gradient"></div>' +
                '<div class="cr-detail-hero-content">' +
                  (logoUrl ? '<img class="cr-detail-logo" src="' + logoUrl + '" alt="' + item.Name + '" onerror="this.style.display=\'none\'" />' : '') +
                  '<h1 class="cr-detail-title">' + item.Name + '</h1>' +
                  '<div class="cr-detail-tags">' +
                    '<span class="cr-tag-badge">' + ageRating + '</span>' +
                    '<span class="cr-tag-subdub">Sub | Dub</span>' +
                    '<span class="cr-tag-genres">' + (genres ? "\u2022 " + genres : "") + '</span>' +
                  '</div>' +
                  '<div class="cr-detail-rating-row">' +
                    '<span class="cr-stars">\u2605\u2605\u2605\u2605\u2605</span>' +
                    '<span>Average Rating: <b>' + rating + '</b></span>' +
                  '</div>' +
                  '<div class="cr-detail-actions">' +
                    '<a href="' + watchFirstUrl + '" class="cr-btn-watch">' +
                      watchBtnIcon + ' ' + watchBtnLabel + '</a>' +
                    '<button class="cr-btn-bookmark' + (inWl ? " bookmarked" : "") + '" data-bookmark-id="' + item.Id + '" title="Watchlist">' +
                      (inWl ? '<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:currentColor;"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>' :
                              '<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>') +
                    '</button>' +
                    '<button class="cr-btn-watched' + (isItemWatched ? " watched" : "") + '" title="' + (isItemWatched ? "Mark Unwatched" : "Mark as Watched") + '">' +
                      (isItemWatched ? '<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:currentColor;"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>' :
                                      '<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>') +
                    '</button>' +
                  '</div>' +
                  '<div class="cr-detail-synopsis-row">' +
                    '<div class="cr-detail-synopsis-col">' +
                      '<p>' + cleanDesc + '</p>' +
                    '</div>' +
                    '<div class="cr-detail-meta-col">' +
                      '<div><span class="cr-meta-label">Audio:</span> ' + audioLangs + '</div>' +
                      '<div><span class="cr-meta-label">Subtitles:</span> ' + subLangs + '</div>' +
                    '</div>' +
                  '</div>' +
                '</div>' +
              '</div>' +
              '<div class="cr-episodes-section">' +
                '<div class="cr-episodes-bar">' +
                  '<select class="cr-season-select">' +
                    (seasons.length > 0 ? seasons.map(function(s){return '<option value="' + s.Id + '">' + s.Name + '</option>';}).join('') : '<option>Season 1</option>') +
                  '</select>' +
                  '<span class="cr-sort-text">OLDEST</span>' +
                '</div>' +
                '<div class="cr-episodes-grid" id="crEpisodesGrid"></div>' +
              '</div>';

            var bmBtn = container.querySelector('.cr-btn-bookmark');
            bmBtn.addEventListener("click", function(e) {
              e.stopPropagation();
              toggleBookmark({ id: item.Id, name: item.Name, serverId: item.ServerId });
            });

            var watchedBtn = container.querySelector('.cr-btn-watched');
            if (watchedBtn) {
              watchedBtn.addEventListener("click", function(e) {
                e.stopPropagation();
                var method = isItemWatched ? "DELETE" : "POST";
                fetch(API_BASE + "/Users/" + (uid || "") + "/PlayedItems/" + item.Id + "?ApiKey=" + AUTH_KEY, { method: method })
                  .then(function() {
                    isItemWatched = !isItemWatched;
                    watchedBtn.classList.toggle("watched", isItemWatched);
                    watchedBtn.title = isItemWatched ? "Mark Unwatched" : "Mark as Watched";
                    watchedBtn.innerHTML = isItemWatched
                      ? '<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:currentColor;"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>'
                      : '<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>';
                  });
              });
            }

            // Populate episodes into grid
            var grid = container.querySelector("#crEpisodesGrid");
            function renderSeasonEpisodes(seasonId) {
              grid.innerHTML = "";
              var filteredEps = seasonId ? episodes.filter(function(e){ return e.SeasonId === seasonId; }) : episodes;
              if (filteredEps.length === 0) filteredEps = episodes;

              filteredEps.forEach(function(ep) {
                var epThumb = API_BASE + "/Items/" + ep.Id + "/Images/Primary?maxWidth=450&quality=85";
                var mins = ep.RunTimeTicks ? Math.round(ep.RunTimeTicks / (10000000 * 60)) : 24;
                var epNumber = ep.IndexNumber || 1;
                var epUrl = "#/details?id=" + ep.Id + "&serverId=" + ep.ServerId;

                var card = document.createElement("div");
                card.className = "cr-ep-card";
                card.onclick = function() {
                  window.location.hash = epUrl;
                };
                card.innerHTML =
                  '<div class="cr-ep-thumb-wrap">' +
                    '<img class="cr-ep-thumb" src="' + epThumb + '" alt="' + ep.Name + '" onerror="this.src=\'favicon.bc8d51405ec040305a87.ico\'" />' +
                    '<div class="cr-ep-duration">' + mins + 'm</div>' +
                    '<div class="cr-ep-play-overlay">' +
                      '<div class="cr-ep-play-icon"><svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:currentColor;"><path d="M8 5v14l11-7z"/></svg></div>' +
                    '</div>' +
                  '</div>' +
                  '<div class="cr-ep-info">' +
                    '<div class="cr-ep-series-name">' + item.Name + '</div>' +
                    '<div class="cr-ep-title">E' + epNumber + ' - ' + ep.Name + '</div>' +
                    '<div class="cr-ep-subdub">Dub | Sub</div>' +
                  '</div>';
                grid.appendChild(card);
              });
            }

            var seasonSelect = container.querySelector(".cr-season-select");
            if (seasonSelect) {
              seasonSelect.addEventListener("change", function() {
                renderSeasonEpisodes(seasonSelect.value);
              });
            }
            renderSeasonEpisodes(seasons.length > 0 ? seasons[0].Id : null);

            detailPage.prepend(container);
            isBuildingDetails = false;
          });
        }).catch(function(err) {
          console.error("[CR_SERIES] Error during series build:", err);
          isBuildingDetails = false;
        });
    });
  }

  // ==============================================================
  // 5. BUILD "MY LISTS" PAGE (PICTURE 3)
  // ==============================================================
  var isBuildingLists = false;

  function buildMyListsPage() {
    if (!isLists()) {
      var old = document.getElementById("crMyListsPage");
      if (old) old.remove();
      return;
    }
    if (document.getElementById("crMyListsPage") || isBuildingLists) return;
    isBuildingLists = true;

    var main = document.querySelector("main") || document.querySelector("#reactRoot") || document.body;
    var pages = main.querySelectorAll(".page");
    pages.forEach(function(p) { p.style.display = "none"; });

    var oldCr = document.getElementById("crMyListsPage");
    if (oldCr) oldCr.remove();

    var container = document.createElement("div");
    container.id = "crMyListsPage";

    container.innerHTML =
      '<div class="cr-mylists-header">' +
        '<svg viewBox="0 0 24 24" style="width:28px;height:28px;fill:none;stroke:#F47521;stroke-width:2.2;"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>' +
        '<h1 class="cr-mylists-title">My Lists</h1>' +
      '</div>' +
      '<div class="cr-mylists-tabs">' +
        '<button class="cr-mylists-tab-btn active" data-tab="watchlist">WATCHLIST</button>' +
        '<button class="cr-mylists-tab-btn" data-tab="crunchylists">CRUNCHYLISTS</button>' +
        '<button class="cr-mylists-tab-btn" data-tab="history">HISTORY</button>' +
      '</div>' +
      '<div id="crListsContent"></div>';

    main.prepend(container);

    function renderTab(tab) {
      container.querySelectorAll(".cr-mylists-tab-btn").forEach(function(b) {
        b.classList.toggle("active", b.getAttribute("data-tab") === tab);
      });
      var content = container.querySelector("#crListsContent");
      content.innerHTML = "";

      if (tab === "watchlist") {
        // Watchlist contains watched full titles from Jellyfin + bookmarked titles
        getActiveUserId().then(function(uid) {
          var wl = getWatchlist();
          var p = uid
            ? fetch(API_BASE + "/Users/" + uid + "/Items?IncludeItemTypes=Series,Movie&Filters=IsPlayed&SortBy=DatePlayed,SortName&SortOrder=Descending&Limit=50&Recursive=true&Fields=PrimaryImageAspectRatio&ApiKey=" + AUTH_KEY).then(function(r){return r.json();}).catch(function(){return {Items:[]};})
            : Promise.resolve({Items:[]});

          p.then(function(wData) {
            var watched = wData.Items || [];
            var seen = {};
            var combined = [];

            // Add watched full titles from Jellyfin
            watched.forEach(function(it) {
              seen[it.Id] = true;
              combined.push({
                id: it.Id,
                name: it.Name,
                serverId: it.ServerId,
                type: it.Type,
                isWatched: true
              });
            });

            // Add bookmarked titles
            wl.forEach(function(it) {
              if (!seen[it.id]) {
                seen[it.id] = true;
                combined.push({
                  id: it.id,
                  name: it.name,
                  serverId: it.serverId,
                  type: "Series",
                  isWatched: false
                });
              }
            });

            if (combined.length === 0) {
              content.innerHTML =
                '<div class="cr-empty-box">' +
                  '<div class="cr-empty-icon">' +
                    '<svg viewBox="0 0 64 64" style="width:72px;height:72px;fill:#F47521;margin-bottom:12px;"><path d="M32 6C17.6 6 6 17.6 6 32s11.6 26 26 26 26-11.6 26-26S46.4 6 32 6zm-8 20c2.2 0 4 1.8 4 4s-1.8 4-4 4-4-1.8-4-4 1.8-4 4-4zm16 0c2.2 0 4 1.8 4 4s-1.8 4-4 4-4-1.8-4-4 1.8-4 4-4zm-8 22c-6.1 0-11.4-3.8-13.6-9.2-.4-1 .1-2.2 1.1-2.6 1-.4 2.2.1 2.6 1.1 1.7 4.1 5.8 7 10 7s8.2-2.8 10-7c.4-1 1.6-1.5 2.6-1.1 1 .4 1.5 1.6 1.1 2.6-2.3 5.3-7.6 9.2-13.8 9.2z"/></svg>' +
                  '</div>' +
                  '<p class="cr-empty-text">Your WatchList needs some love.<br>Let\'s fill it up with awesome anime.</p>' +
                  '<a href="#/home" class="cr-btn-home-feed">GO TO HOME FEED</a>' +
                '</div>';
            } else {
              var grid = document.createElement("div");
              grid.className = "cr-watchlist-grid";
              combined.forEach(function(item) {
                var posterUrl = API_BASE + "/Items/" + item.id + "/Images/Primary?maxWidth=350&quality=85";
                var card = document.createElement("div");
                card.className = "cr-poster-card";
                card.onclick = function() { window.location.hash = "#/details?id=" + item.id + "&serverId=" + item.serverId; };
                card.innerHTML =
                  '<div class="cr-poster-thumb-wrap">' +
                    '<img class="cr-poster-thumb" src="' + posterUrl + '" alt="' + item.name + '" onerror="this.src=\'favicon.bc8d51405ec040305a87.ico\'" />' +
                    (item.isWatched ? '<div class="cr-history-badge">\u2713 Watched</div>' : '') +
                  '</div>' +
                  '<div class="cr-poster-info">' +
                    '<div class="cr-poster-title" title="' + item.name + '">' + item.name + '</div>' +
                    '<div class="cr-poster-subtitle">' + (item.type === "Movie" ? "Movie" : "Series") + '</div>' +
                  '</div>';
                grid.appendChild(card);
              });
              content.appendChild(grid);
            }
          });
        });
      } else if (tab === "crunchylists") {
        content.innerHTML =
          '<div class="cr-empty-box">' +
            '<div class="cr-empty-icon">' +
              '<svg viewBox="0 0 24 24" style="width:64px;height:64px;fill:#F47521;margin-bottom:12px;"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/></svg>' +
            '</div>' +
            '<p class="cr-empty-text">Organize your favorite series into custom CrunchyLists.<br>Manage and share your curated anime collections.</p>' +
            '<a href="#/playlists" class="cr-btn-home-feed">VIEW PLAYLISTS</a>' +
          '</div>';
      } else if (tab === "history") {
        getActiveUserId().then(function(uid) {
          if (!uid) return;
          fetch(API_BASE + "/Users/" + uid + "/Items?Filters=IsPlayed&SortBy=DatePlayed&SortOrder=Descending&Limit=24&Recursive=true&ApiKey=" + AUTH_KEY)
            .then(function(r){return r.json();})
            .then(function(hData) {
              var items = hData.Items || [];
              if (items.length === 0) {
                content.innerHTML = '<div class="cr-empty-box"><p class="cr-empty-text">No watched history recorded yet.</p></div>';
              } else {
                var grid = document.createElement("div");
                grid.className = "cr-episodes-grid";
                items.forEach(function(it) {
                  var thumbUrl = API_BASE + "/Items/" + it.Id + "/Images/Primary?maxWidth=450&quality=85";
                  var sTitle = it.SeriesName || it.Name;
                  var epInfo = it.SeriesName ? ("S" + (it.ParentIndexNumber||1) + ":E" + (it.IndexNumber||1) + " - " + it.Name) : "Watched";
                  var card = document.createElement("div");
                  card.className = "cr-ep-card";
                  card.onclick = function() { window.location.hash = "#/details?id=" + it.Id + "&serverId=" + it.ServerId; };
                  card.innerHTML =
                    '<div class="cr-ep-thumb-wrap">' +
                      '<img class="cr-ep-thumb" src="' + thumbUrl + '" alt="' + sTitle + '" onerror="this.style.display=\'none\'" />' +
                    '</div>' +
                    '<div class="cr-ep-info">' +
                      '<div class="cr-ep-series-name">' + sTitle + '</div>' +
                      '<div class="cr-ep-title">' + epInfo + '</div>' +
                    '</div>';
                  grid.appendChild(card);
                });
                content.appendChild(grid);
              }
            });
        });
      }
    }

    container.querySelectorAll(".cr-mylists-tab-btn").forEach(function(b) {
      b.onclick = function() {
        renderTab(b.getAttribute("data-tab"));
      };
    });

    renderTab("watchlist");
    isBuildingLists = false;
  }

  function setup() {
    purgeNavLinks();
    injectHeaderElements();

    if (isHome()) {
      var listsEl = document.getElementById("crMyListsPage");
      if (listsEl) listsEl.remove();
      var seriesEl = document.getElementById("crSeriesDetailPage");
      if (seriesEl) seriesEl.remove();
      buildCrunchyrollHome();
    } else if (isDetails()) {
      var homeEl = document.getElementById("crCrunchyrollHome");
      if (homeEl) homeEl.remove();
      var listsEl2 = document.getElementById("crMyListsPage");
      if (listsEl2) listsEl2.remove();
      buildCrunchyrollSeriesPage();
    } else if (isLists()) {
      var homeEl2 = document.getElementById("crCrunchyrollHome");
      if (homeEl2) homeEl2.remove();
      var seriesEl2 = document.getElementById("crSeriesDetailPage");
      if (seriesEl2) seriesEl2.remove();
      buildMyListsPage();
    } else {
      var hEl = document.getElementById("crCrunchyrollHome"); if (hEl) hEl.remove();
      var sEl = document.getElementById("crSeriesDetailPage"); if (sEl) sEl.remove();
      var lEl = document.getElementById("crMyListsPage"); if (lEl) lEl.remove();
      if (slideTimer) clearInterval(slideTimer);
    }
  }

  var debounceTimeout = null;
  var observer = new MutationObserver(function() {
    purgeNavLinks();
    injectHeaderElements();
    if (isHome() && !document.getElementById("crCrunchyrollHome") && !isBuildingHome) {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(setup, 60);
    } else if (isDetails() && !document.getElementById("crSeriesDetailPage") && !isBuildingDetails) {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(setup, 60);
    } else if (isLists() && !document.getElementById("crMyListsPage") && !isBuildingLists) {
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
})();
