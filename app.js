(function () {
  "use strict";

  const BUDGET_FACTORS = {
    low: { stay: 25, food: 18, local: 10, activity: 12 },
    medium: { stay: 55, food: 30, local: 20, activity: 28 },
    high: { stay: 120, food: 60, local: 35, activity: 50 },
  };

  const VIBE_PLANS = {
    adventure: ["Trail or cycling route", "Adventure activity window", "Local food lane"],
    chill: ["Slow breakfast and cafe time", "One scenic walk", "Sunset and relaxed dinner"],
    history: ["Old town walk", "Museum or heritage site", "Evening cultural lane"],
    food: ["Morning market", "Cooking class or tasting", "Local signature dinner"],
    nature: ["Early nature block", "Botanical or lakeside hour", "Light evening"],
  };

  const TIPS = [
    "Buy a transit day pass if you plan 3+ rides; it usually costs less and saves queue time.",
    "For crowd control, target major spots within 90 minutes of opening.",
    "Keep one indoor backup block per day for weather changes.",
  ];
  const NEARBY_TOP_N = 10;

  /**

   * Nearby places: only temples, monuments, museums, nature, heritage, etc.
   * Excludes schools, hospitals, offices, and similar non-attraction POIs.
   */
  const PLACE_EXCLUDE_TITLE =
    /\b(university|college|campus|\bschool\b|hospital|clinic|medical\s+cent(?:er|re)|pharmacy|morgue|cemetery|graveyard|prison|jail|police\s+station|fire\s+station|courthouse|embassy|consulate|parking\s+garage|office\s+tower|data\s+center)\b/i;

  const PLACE_EXCLUDE_CATEGORY =
    /\b(universit|college|schools|academ|hospitals?|clinics?|medical\s+schools?|health\s+care|cemeteries|prisons?|elementary|secondary|high\s+school|students?|faculty|airports?|railway\s+stations?|bus\s+stations?|metro\s+stations?|shopping\s+malls?|supermarkets?|office\s+buildings?|residential)\b/i;

  const PLACE_INCLUDE_TITLE =
    /\b(temple|mosque|shrine|cathedral|basilica|synagogue|gurdwara|stupa|pagoda|minaret|minar|monument|museum|memorial|fort|fortress|palace|castle|citadel|bastion|gate|ruins|archaeological|heritage|historic\s+(site|district)|national\s+park|nature\s+reserve|wildlife|botanical|garden|waterfall|lake|beach|mountain|observatory|zoo|aquarium|amphitheatre|amphitheater|tower|bridge|square|plaza|mausoleum|tomb|scenic|viewpoint|landmark|world\s+heritage)\b/i;

  const PLACE_INCLUDE_CATEGORY =
    /\b(temples?|mosques?|shrines?|monuments?|museums?|memorials?|forts?|palaces?|castles?|historic\s+sites?|world\s+heritage|national\s+parks?|nature\s+reserves?|natural\s+features?|botanical\s+gardens?|parks?\s+in|gardens?\s+in|archaeological\s+sites?|religious\s+buildings?|churches?|cathedrals?|basilicas?|tourist\s+attractions?|visitor\s+attractions?|landmarks?|heritage|scenic|protected\s+areas?|lakes?|beaches?|mountains?|waterfalls?)\b/i;

  const MOOD_PICK_COUNT = 6;

  const MOOD_META = {
    peaceful: {
      label: "Peaceful",
      sub: "Calm lakes, gardens, and easy strolls — low noise, soft scenery.",
      themeClass: "mood-results--peaceful",
    },
    adventure: {
      label: "Adventure",
      sub: "Forts, viewpoints, wildlife — places with energy and scale.",
      themeClass: "mood-results--adventure",
    },
    romantic: {
      label: "Romantic",
      sub: "Palaces, lakes, and heritage corners made for slow wandering.",
      themeClass: "mood-results--romantic",
    },
    natural_escape: {
      label: "Natural escape",
      sub: "Parks, reserves, water, and green space away from the concrete.",
      themeClass: "mood-results--natural_escape",
    },
    spiritual: {
      label: "Spiritual",
      sub: "Temples, shrines, and sacred architecture — contemplative stops.",
      themeClass: "mood-results--spiritual",
    },
  };

  const MOOD_KEYWORDS = {
    peaceful: {
      match: ["lake", "garden", "botanical", "park", "viewpoint", "scenic", "lagoon", "river", "canal", "promenade", "reservoir", "quiet", "walk"],
      penalize: /\b(fort|battle|prison|jail)\b/i,
    },
    adventure: {
      match: ["fort", "wildlife", "zoo", "trek", "safari", "tower", "cliff", "observatory", "adventure", "trail", "mountain", "canyon", "trekking", "paraglid", "bungee"],
      penalize: /\b(cemetery|hospital|clinic)\b/i,
    },
    romantic: {
      match: ["palace", "lake", "garden", "bridge", "heritage", "mausoleum", "haveli", "plaza", "square", "memorial", "romantic"],
      penalize: /\b(cemetery|hospital|prison)\b/i,
    },
    natural_escape: {
      match: ["national park", "nature", "wildlife", "waterfall", "beach", "mountain", "forest", "reserve", "botanical", "sanctuary", "lake", "garden", "park", "scenic"],
      penalize: /\b(shopping|mall|office)\b/i,
    },
    spiritual: {
      match: ["temple", "mosque", "shrine", "cathedral", "gurdwara", "stupa", "monastery", "ashram", "mandir", "dargah", "pilgrim", "synagogue", "basilica", "minar", "pagoda"],
      penalize: /\b(nightclub|casino)\b/i,
    },
  };

  const state = {
    expenses: [],
    placeHistory: new Map(),
    lastUserLat: null,
    lastUserLon: null,
    lastAddress: null,
    nearbyPool: null,
  };

  let locationMap;
  let locationMarker;

  const ui = {
    locationText: document.getElementById("location-text"),
    detectBtn: document.getElementById("detect-btn"),
    originLocationBtn: document.getElementById("origin-location-btn"),
    originInput: document.getElementById("origin"),
    destinationInput: document.getElementById("destination"),
    originSuggest: document.getElementById("origin-suggest"),
    destinationSuggest: document.getElementById("destination-suggest"),
    places: document.getElementById("places"),
    tripForm: document.getElementById("trip-form"),
    resultSection: document.getElementById("result-section"),
    resultHeading: document.getElementById("result-heading"),
    resultMeta: document.getElementById("result-meta"),
    tipText: document.getElementById("tip-text"),
    itinerary: document.getElementById("itinerary"),
    welcomeText: document.getElementById("welcome-text"),
    locationMap: document.getElementById("location-map"),
    budgetSummary: document.getElementById("budget-summary"),
    expenseForm: document.getElementById("expense-form"),
    expenseNote: document.getElementById("expense-note"),
    expenseAmount: document.getElementById("expense-amount"),
    expenseList: document.getElementById("expense-list"),
    expenseTotal: document.getElementById("expense-total"),
    moodResults: document.getElementById("mood-results"),
    moodPlaces: document.getElementById("mood-places"),
    moodResultsTitle: document.getElementById("mood-results-title"),
    moodResultsSub: document.getElementById("mood-results-sub"),
  };

  function updateLocationMap(lat, lon) {
    if (locationMap) {
      locationMap.setView([lat, lon], 14);
      locationMarker.setLatLng([lat, lon]);
    }
  }

  function initializeMap() {
    const redIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    locationMap = L.map('location-map').setView([28.63, 77.20], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(locationMap);

    locationMarker = L.marker([28.63, 77.20], { icon: redIcon }).addTo(locationMap);
  }

  function clampDays(value) {
    const n = parseInt(value, 10);
    if (Number.isNaN(n)) return 2;
    return Math.max(1, Math.min(14, n));
  }

  function normalizeBudget(value) {
    return ["low", "medium", "high"].includes(value) ? value : "medium";
  }

  function normalizeVibe(value) {
    return Object.prototype.hasOwnProperty.call(VIBE_PLANS, value) ? value : "chill";
  }

  function loadWelcomeName() {
    if (!ui.welcomeText) return;
    var name = localStorage.getItem("wandercraftName");
    ui.welcomeText.textContent = name ? "Welcome back, " + name + "!" : "Welcome back!";
  }

  function dailyBudget(budget) {
    return BUDGET_FACTORS[budget];
  }

  function haversineKm(aLat, aLon, bLat, bLon) {
    const R = 6371;
    const toRad = Math.PI / 180;
    const dLat = (bLat - aLat) * toRad;
    const dLon = (bLon - aLon) * toRad;
    const lat1 = aLat * toRad;
    const lat2 = bLat * toRad;
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  const SUGGEST_DEBOUNCE_MS = 300;

  async function reverseGeocodeAddress(lat, lon) {
    try {
      const res = await fetch(
        "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=" +
          encodeURIComponent(lat) +
          "&lon=" +
          encodeURIComponent(lon)
      );
      const data = await res.json();
      if (!data || !data.address) return null;
      return data.address;
    } catch (error) {
      return null;
    }
  }

  function cityFromAddress(addr) {
    if (!addr) return null;
    return (
      addr.city ||
      addr.town ||
      addr.village ||
      addr.municipality ||
      addr.state_district ||
      addr.county ||
      null
    );
  }

  function wikiCategorySlug(cityName) {
    return String(cityName || "")
      .trim()
      .replace(/\s+/g, "_");
  }

  async function geocodePlace(name) {
    const query = String(name || "").trim();
    if (!query) return null;
    try {
      const res = await fetch(
        "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" +
          encodeURIComponent(query)
      );
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) return null;
      return {
        lat: Number(data[0].lat),
        lon: Number(data[0].lon),
        label: data[0].display_name || query,
      };
    } catch (error) {
      return null;
    }
  }

  async function reverseGeocodeName(lat, lon) {
    const addr = await reverseGeocodeAddress(lat, lon);
    const city = cityFromAddress(addr);
    if (city) return city;
    if (addr && addr.state) return addr.state;
    return null;
  }

  async function getRouteDetails(origin, destination) {
    const [from, to] = await Promise.all([geocodePlace(origin), geocodePlace(destination)]);
    if (!from || !to) {
      return { km: null, from: from, to: to, stops: [] };
    }

    const km = haversineKm(from.lat, from.lon, to.lat, to.lon);
    if (km < 120) {
      return { km: km, from: from, to: to, stops: [] };
    }

    const stopCount = km > 900 ? 3 : km > 350 ? 2 : 1;
    const stops = [];
    for (let i = 1; i <= stopCount; i += 1) {
      const f = i / (stopCount + 1);
      const lat = from.lat + (to.lat - from.lat) * f;
      const lon = from.lon + (to.lon - from.lon) * f;
      // Reverse geocode points on the line for practical mid-route stop ideas.
      // This is an approximation, not turn-by-turn route snapping.
      // It still gives useful city/town names between endpoints.
      const name = await reverseGeocodeName(lat, lon);
      if (!name) continue;
      const lower = name.toLowerCase();
      if (
        lower === String(origin).trim().toLowerCase() ||
        lower === String(destination).trim().toLowerCase()
      ) {
        continue;
      }
      if (!stops.some(function (s) { return s.toLowerCase() === lower; })) {
        stops.push(name);
      }
    }

    return { km: km, from: from, to: to, stops: stops };
  }

  function renderBudgetSuggestion(days, budget, routeKm) {
    const base = dailyBudget(budget);
    const total = {
      stay: base.stay * days,
      food: base.food * days,
      local: base.local * days,
      activity: base.activity * days,
    };
    const stayAndDaily = total.stay + total.food + total.local + total.activity;
    const travel = routeKm ? routeKm * (budget === "low" ? 0.08 : budget === "medium" ? 0.14 : 0.26) : 0;
    const expected = stayAndDaily + travel;
    const uncertainty = expected * (budget === "low" ? 0.14 : budget === "medium" ? 0.18 : 0.22);
    const estimated = expected + uncertainty;

    ui.budgetSummary.innerHTML = "";
    [
      ["Stay", total.stay],
      ["Food", total.food],
      ["Local transport", total.local],
      ["Activities", total.activity],
      ["Travel route", travel],
      ["Expected", expected],
      ["Estimated", estimated],
    ].forEach((item, idx, arr) => {
      const box = document.createElement("article");
      box.className = "budget-box" + (idx === arr.length - 1 ? " budget-box--total" : "");
      box.innerHTML = "<p>" + item[0] + "</p><strong>$" + item[1].toFixed(0) + "</strong>";
      ui.budgetSummary.appendChild(box);
    });
  }

  function buildItinerary(origin, destination, vibe, days) {
    const plan = VIBE_PLANS[vibe];
    const out = [];
    for (let i = 1; i <= days; i += 1) {
      out.push({
        title: "Day " + i,
        theme: plan[(i - 1) % plan.length],
        slots: [
          { time: "08:30 - 10:00", name: "Morning start", desc: "Transit + breakfast buffer in " + destination + "." },
          { time: "10:30 - 13:00", name: plan[(i - 1) % plan.length], desc: "Core vibe activity aligned to your chosen style." },
          { time: "13:00 - 15:30", name: "Lunch and rest", desc: "Unscheduled rest window to avoid overpacking." },
          { time: "16:00 - 19:00", name: "Second block", desc: "Neighborhood level exploration away from generic tourist strips." },
          { time: "Evening", name: "Light close", desc: "Dinner and flexible walk. Route: " + origin + " to " + destination + "." },
        ],
      });
    }
    return out;
  }

  function renderRouteStops(stops, routeKm) {
    if (!stops.length && !routeKm) return;
    const card = document.createElement("article");
    card.className = "day-card";
    const chips = stops.length
      ? stops.map(function (s) { return '<span class="stop-chip">' + escapeHtml(s) + "</span>"; }).join("")
      : '<span class="stop-chip">Direct route recommended</span>';
    card.innerHTML =
      '<div class="day-card__head"><h4 class="day-card__title">Route highlights</h4><p class="day-card__theme">' +
      (routeKm ? "~" + routeKm.toFixed(0) + " km total distance" : "Distance unavailable") +
      '</p></div><div class="route-stops"><p class="route-stops__label">Possible in-between stops</p><div class="stop-chips">' +
      chips +
      "</div></div>";
    ui.itinerary.appendChild(card);
  }

  async function renderItinerary(payload) {
    const days = clampDays(payload.duration);
    const vibe = normalizeVibe(payload.vibe);
    const budget = normalizeBudget(payload.budget);
    const cards = buildItinerary(payload.origin, payload.destination, vibe, days);
    const route = await getRouteDetails(payload.origin, payload.destination);

    ui.resultHeading.textContent = payload.destination;
    const routeInfo = route.km ? " • ~" + route.km.toFixed(0) + " km route" : "";
    const stopInfo = route.stops.length ? " • " + route.stops.length + " stop ideas" : "";
    ui.resultMeta.textContent =
      days + " days • " + vibe + " vibe • " + budget + " budget • from " + payload.origin + routeInfo + stopInfo;
    ui.tipText.textContent = TIPS[(payload.destination.length + days) % TIPS.length];
    ui.itinerary.innerHTML = "";
    renderRouteStops(route.stops, route.km);

    cards.forEach((day) => {
      const card = document.createElement("article");
      card.className = "day-card";
      const list = day.slots
        .map(function (slot) {
          return (
            '<li class="slot"><p class="slot__time">' +
            escapeHtml(slot.time) +
            '</p><h5 class="slot__name">' +
            escapeHtml(slot.name) +
            '</h5><p class="slot__desc">' +
            escapeHtml(slot.desc) +
            "</p></li>"
          );
        })
        .join("");
      card.innerHTML =
        '<div class="day-card__head"><h4 class="day-card__title">' +
        escapeHtml(day.title) +
        '</h4><p class="day-card__theme">' +
        escapeHtml(day.theme) +
        '</p></div><ul class="slot-list">' +
        list +
        "</ul>";
      ui.itinerary.appendChild(card);
    });

    renderBudgetSuggestion(days, budget, route.km);
    ui.resultSection.hidden = false;
    ui.resultHeading.focus({ preventScroll: true });
  }

  async function detectLocation() {
    if (!navigator.geolocation) {
      ui.locationText.textContent = "Geolocation not supported in this browser.";
      if (ui.places) {
        ui.places.innerHTML =
          "<p class=\"places-empty\">Location is unavailable in this browser.</p>";
      }
      return;
    }

    ui.locationText.textContent = "Detecting precise position...";
    if (ui.places) {
      ui.places.innerHTML =
        '<p class="places-status"><span class="places-status__dot" aria-hidden="true"></span> Finding top picks in your area…</p>';
    }

    navigator.geolocation.getCurrentPosition(
      async function (position) {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const addr = await reverseGeocodeAddress(lat, lon);
        if (addr) {
          const city = cityFromAddress(addr) || "your area";
          ui.locationText.textContent = city + " (" + lat.toFixed(3) + ", " + lon.toFixed(3) + ")";
        } else {
          ui.locationText.textContent = "Lat " + lat.toFixed(3) + ", Lon " + lon.toFixed(3);
        }
        updateLocationMap(lat, lon);
        state.lastUserLat = lat;
        state.lastUserLon = lon;
        state.lastAddress = addr;
        await loadNearbyPlaces(lat, lon, addr);
      },
      function () {
        ui.locationText.textContent = "Location permission denied. You can still use planner manually.";
        if (ui.places) {
          ui.places.innerHTML =
            "<p class=\"places-empty\">Allow location access to see five curated tourist picks for your current city. You can still type cities manually in the planner.</p>";
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function fillOriginWithCurrentLocation() {
    if (!navigator.geolocation) return;
    if (!ui.originLocationBtn || !ui.originInput) return;

    const initialLabel = ui.originLocationBtn.textContent;
    ui.originLocationBtn.disabled = true;
    ui.originLocationBtn.textContent = "Detecting...";

    navigator.geolocation.getCurrentPosition(
      async function (position) {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const name = await reverseGeocodeName(lat, lon);
        if (name) {
          ui.originInput.value = name;
        } else {
          ui.originInput.value = lat.toFixed(3) + ", " + lon.toFixed(3);
        }
        ui.originInput.focus();
        ui.originLocationBtn.disabled = false;
        ui.originLocationBtn.textContent = initialLabel;
      },
      function () {
        ui.originLocationBtn.disabled = false;
        ui.originLocationBtn.textContent = initialLabel;
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function normalizeWikiTitle(t) {
    return String(t || "").replace(/_/g, " ");
  }

  function stripCategoryPrefix(catTitle) {
    return catTitle.replace(/^Category:/i, "");
  }

  function isTouristAttraction(title, categoryTitles) {
    const t = normalizeWikiTitle(title);
    if (PLACE_EXCLUDE_TITLE.test(t)) return false;
    if (/^list\s+of\b/i.test(t)) return false;

    const cats = (categoryTitles || []).map(stripCategoryPrefix);
    const catBlob = cats.join(" | ");
    if (PLACE_EXCLUDE_CATEGORY.test(catBlob)) return false;

    if (PLACE_INCLUDE_TITLE.test(t)) return true;
    if (PLACE_INCLUDE_CATEGORY.test(catBlob)) return true;

    return false;
  }

  function guessPlaceKind(title, categoryTitles) {
    const t = normalizeWikiTitle(title).toLowerCase();
    const c = (categoryTitles || []).join(" ").toLowerCase();
    if (/temple|mosque|shrine|cathedral|basilica|synagogue|gurdwara|stupa|pagoda/.test(t + c))
      return "Sacred / heritage";
    if (/museum|gallery/.test(t + c)) return "Museum";
    if (/fort|palace|castle|monument|memorial|heritage|world heritage|historic/.test(t + c))
      return "Monument & history";
    if (/park|garden|nature|national park|reserve|waterfall|lake|beach|mountain|wildlife|scenic/.test(t + c))
      return "Nature & outdoors";
    return "Attraction";
  }

  function scorePlaceForMood(mood, title, categoryTitles) {
    const cfg = MOOD_KEYWORDS[mood];
    if (!cfg) return 0;
    const blob = (normalizeWikiTitle(title) + " " + (categoryTitles || []).join(" ")).toLowerCase();
    let s = 0;
    cfg.match.forEach(function (word) {
      if (blob.indexOf(word) >= 0) s += 2;
    });
    if (cfg.penalize && cfg.penalize.test(blob)) s -= 4;
    return s;
  }

  function pickPlacesForMood(mood, items, catMap) {
    const scored = items.map(function (it) {
      const cats = catMap[it.pageid] || [];
      const moodScore = scorePlaceForMood(mood, it.title, cats);
      return { item: it, moodScore: moodScore };
    });
    const maxScore = scored.reduce(function (m, x) {
      return Math.max(m, x.moodScore);
    }, 0);
    if (maxScore <= 0) {
      return items
        .slice()
        .sort(function (a, b) {
          return a.dist - b.dist;
        })
        .slice(0, MOOD_PICK_COUNT);
    }
    scored.sort(function (a, b) {
      if (b.moodScore !== a.moodScore) return b.moodScore - a.moodScore;
      return a.item.dist - b.item.dist;
    });
    return scored.slice(0, MOOD_PICK_COUNT).map(function (x) {
      return x.item;
    });
  }

  async function fetchCategoriesForPageIds(pageIds) {
    if (!pageIds.length) return {};
    const out = {};
    const chunkSize = 45;
    for (let i = 0; i < pageIds.length; i += chunkSize) {
      const chunk = pageIds.slice(i, i + chunkSize);
      const url =
        "https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=categories&cllimit=40&pageids=" +
        chunk.join("|");
      const res = await fetch(url);
      const data = await res.json();
      const pages = data.query && data.query.pages ? data.query.pages : {};
      Object.keys(pages).forEach(function (pid) {
        const p = pages[pid];
        if (!p.categories) {
          out[p.pageid] = [];
          return;
        }
        out[p.pageid] = p.categories.map(function (c) {
          return c.title;
        });
      });
    }
    return out;
  }

  async function fetchThumbnailsForPageIds(pageIds) {
    if (!pageIds.length) return {};
    const out = {};
    const chunkSize = 45;
    for (let i = 0; i < pageIds.length; i += chunkSize) {
      const chunk = pageIds.slice(i, i + chunkSize);
      const url =
        "https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=360&pageids=" +
        chunk.join("|");
      const res = await fetch(url);
      const data = await res.json();
      const pages = data.query && data.query.pages ? data.query.pages : {};
      Object.keys(pages).forEach(function (pid) {
        const p = pages[pid];
        if (p.thumbnail && p.thumbnail.source) {
          out[p.pageid] = p.thumbnail.source;
        }
      });
    }
    return out;
  }

  async function fetchCategoryMembers(cmtitle, maxTotal) {
    const out = [];
    let cmcontinue = null;
    const cap = Math.min(maxTotal, 120);
    while (out.length < cap) {
      let url =
        "https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&list=categorymembers&cmnamespace=0&cmlimit=50&cmtitle=" +
        encodeURIComponent(cmtitle);
      if (cmcontinue) url += "&cmcontinue=" + encodeURIComponent(cmcontinue);
      const res = await fetch(url);
      const data = await res.json();
      const list = data.query && data.query.categorymembers ? data.query.categorymembers : [];
      list.forEach(function (m) {
        if (m.pageid && m.title && out.length < cap) {
          out.push({ pageid: m.pageid, title: m.title });
        }
      });
      if (!data.continue || !data.continue.cmcontinue) break;
      cmcontinue = data.continue.cmcontinue;
    }
    return out;
  }

  async function fetchCoordinatesForPageIds(pageIds) {
    const coordMap = {};
    if (!pageIds.length) return coordMap;
    const chunkSize = 48;
    for (let i = 0; i < pageIds.length; i += chunkSize) {
      const chunk = pageIds.slice(i, i + chunkSize);
      const url =
        "https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=coordinates&coprimary=primary&pageids=" +
        chunk.join("|");
      const res = await fetch(url);
      const data = await res.json();
      const pages = data.query && data.query.pages ? data.query.pages : {};
      Object.keys(pages).forEach(function (pid) {
        const p = pages[pid];
        if (p.coordinates && p.coordinates[0]) {
          coordMap[p.pageid] = {
            lat: Number(p.coordinates[0].lat),
            lon: Number(p.coordinates[0].lon),
          };
        }
      });
    }
    return coordMap;
  }

  async function fetchGeoItems(lat, lon, radius, limit) {
    const geoRes = await fetch(
      "https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gsradius=" +
        encodeURIComponent(radius) +
        "&gslimit=" +
        encodeURIComponent(limit) +
        "&format=json&origin=*&gscoord=" +
        encodeURIComponent(lat + "|" + lon)
    );
    const geoData = await geoRes.json();
    return geoData && geoData.query && geoData.query.geosearch ? geoData.query.geosearch : [];
  }

  async function collectCityCategoryCandidates(cityName) {
    const slug = wikiCategorySlug(cityName);
    if (!slug) return [];
    const categoryTitles = [
      "Category:Visitor_attractions_in_" + slug,
      "Category:Tourist_attractions_in_" + slug,
      "Category:Landmarks_in_" + slug,
    ];
    const seen = new Map();
    for (let t = 0; t < categoryTitles.length; t += 1) {
      const members = await fetchCategoryMembers(categoryTitles[t], 90);
      members.forEach(function (m) {
        if (!seen.has(m.pageid)) seen.set(m.pageid, { pageid: m.pageid, title: m.title });
      });
      if (seen.size >= 40) break;
    }
    return Array.from(seen.values());
  }

  async function fetchNearbyCandidateList(lat, lon, addressHint) {
    const addr = addressHint || (await reverseGeocodeAddress(lat, lon));
    const cityName = cityFromAddress(addr);

    const candidateMap = new Map();

    if (cityName) {
      const fromCats = await collectCityCategoryCandidates(cityName);
      fromCats.forEach(function (item) {
        candidateMap.set(item.pageid, { pageid: item.pageid, title: item.title });
      });
    }

    const radii = [10000, 28000, 70000, 150000, 250000];
    for (let i = 0; i < radii.length; i += 1) {
      const items = await fetchGeoItems(lat, lon, radii[i], 50);
      items.forEach(function (item) {
        const prev = candidateMap.get(item.pageid);
        if (!prev) {
          candidateMap.set(item.pageid, item);
          return;
        }
        const prevDist = prev.dist != null ? prev.dist : Infinity;
        if (item.dist != null && item.dist < prevDist) {
          candidateMap.set(item.pageid, Object.assign({}, prev, item));
        }
      });
    }

    const raw = Array.from(candidateMap.values());
    if (!raw.length) return null;

    const pageIds = raw.map(function (g) {
      return g.pageid;
    });
    const catMap = await fetchCategoriesForPageIds(pageIds);

    let filtered = raw.filter(function (g) {
      const cats = catMap[g.pageid] || [];
      return isTouristAttraction(g.title, cats);
    });

    const missingCoordIds = filtered
      .filter(function (g) {
        return g.lat == null || g.lon == null || g.dist == null;
      })
      .map(function (g) {
        return g.pageid;
      });
    const coordMap = await fetchCoordinatesForPageIds(missingCoordIds);

    filtered = filtered.map(function (g) {
      let d = g.dist;
      let la = g.lat;
      let lo = g.lon;
      const c = coordMap[g.pageid];
      if (c) {
        la = c.lat;
        lo = c.lon;
      }
      if ((d == null || Number.isNaN(d)) && la != null && lo != null) {
        d = haversineKm(lat, lon, la, lo) * 1000;
      }
      return { pageid: g.pageid, title: g.title, dist: d != null ? d : 1e15, lat: la, lon: lo };
    });

    filtered.sort(function (a, b) {
      return a.dist - b.dist;
    });

    return { items: filtered, catMap: catMap, lat: lat, lon: lon, address: addr };
  }

  async function loadNearbyPlaces(lat, lon, addressHint) {
    if (!ui.places) return;
    ui.places.innerHTML =
      '<p class="places-status"><span class="places-status__dot" aria-hidden="true"></span> Finding top picks in your area…</p>';
    try {
      const pack = await fetchNearbyCandidateList(lat, lon, addressHint);
      if (!pack || !pack.items.length) {
        ui.places.innerHTML =
          "<p class=\"places-empty\">No attraction list was found for Wikipedia near your coordinates. Try refreshing after enabling a more precise location.</p>";
        state.nearbyPool = null;
        return;
      }

      state.nearbyPool = {
        items: pack.items,
        catMap: pack.catMap,
        lat: pack.lat,
        lon: pack.lon,
      };

      let display = pack.items.slice(0, NEARBY_TOP_N);
      if (!display.length) {
        ui.places.innerHTML =
          "<p class=\"places-empty\">No temples, monuments, or similar sights matched after filtering out schools, hospitals, and transport hubs. Try again from a more central spot in your city.</p>";
        return;
      }

      const thumbs = await fetchThumbnailsForPageIds(
        display.map(function (x) {
          return x.pageid;
        })
      );

      renderPlaceCards(display, pack.catMap, thumbs, ui.places);
    } catch (error) {
      ui.places.innerHTML =
        "<p class=\"places-empty\">Unable to load nearby attractions right now.</p>";
      state.nearbyPool = null;
    }
  }

  async function showMoodResults(mood) {
    const meta = MOOD_META[mood];
    if (!meta || !ui.moodResults || !ui.moodPlaces) return;

    ui.moodResults.hidden = false;
    ui.moodResults.className = "mood-results " + meta.themeClass;
    if (ui.moodResultsTitle) ui.moodResultsTitle.textContent = meta.label + " — near you";
    if (ui.moodResultsSub) ui.moodResultsSub.textContent = meta.sub;

    ui.moodPlaces.innerHTML =
      '<p class="places-status"><span class="places-status__dot" aria-hidden="true"></span> Matching places to your mood…</p>';

    ui.moodResults.scrollIntoView({ behavior: "smooth", block: "start" });
    if (ui.moodResultsTitle) ui.moodResultsTitle.focus({ preventScroll: true });

    try {
      if (!state.nearbyPool || !state.nearbyPool.items.length) {
        if (state.lastUserLat == null || state.lastUserLon == null) {
          ui.moodPlaces.innerHTML =
            "<p class=\"places-empty\">Turn on location first so we can suggest mood-matched places nearby.</p>";
          return;
        }
        const pack = await fetchNearbyCandidateList(state.lastUserLat, state.lastUserLon, state.lastAddress);
        if (!pack || !pack.items.length) {
          ui.moodPlaces.innerHTML =
            "<p class=\"places-empty\">Could not load attractions for your area. Refresh location and try again.</p>";
          return;
        }
        state.nearbyPool = {
          items: pack.items,
          catMap: pack.catMap,
          lat: pack.lat,
          lon: pack.lon,
        };
      }

      const pool = state.nearbyPool;
      const picked = pickPlacesForMood(mood, pool.items, pool.catMap);
      if (!picked.length) {
        ui.moodPlaces.innerHTML =
          "<p class=\"places-empty\">No mood matches in the current list. Try refreshing your location.</p>";
        return;
      }

      const thumbs = await fetchThumbnailsForPageIds(
        picked.map(function (x) {
          return x.pageid;
        })
      );
      renderPlaceCards(picked, pool.catMap, thumbs, ui.moodPlaces);
    } catch (error) {
      ui.moodPlaces.innerHTML =
        "<p class=\"places-empty\">Something went wrong loading mood picks. Please try again.</p>";
    }
  }

  function renderPlaceCards(items, catMap, thumbs, containerEl) {
    const container = containerEl || ui.places;
    if (!container) return;
    container.innerHTML = "";
    items.forEach(function (item) {
      const cats = catMap[item.pageid] || [];
      const kind = guessPlaceKind(item.title, cats);
      const thumb = thumbs[item.pageid];
      const card = document.createElement("article");
      card.className = "place-card";
      card.tabIndex = 0;
      card.dataset.title = item.title;

      const media = document.createElement("div");
      media.className = "place-card__media" + (thumb ? "" : " place-card__media--empty");
      media.setAttribute("aria-hidden", thumb ? "false" : "true");
      if (thumb) {
        const img = document.createElement("img");
        img.src = thumb;
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        media.appendChild(img);
      }

      const body = document.createElement("div");
      body.className = "place-card__body";
      const badge = document.createElement("span");
      badge.className = "place-card__badge";
      badge.textContent = kind;
      const h4 = document.createElement("h4");
      h4.textContent = normalizeWikiTitle(item.title);
      const meta = document.createElement("p");
      meta.className = "place-card__meta";
      meta.textContent =
        item.dist >= 1e11
          ? "In your city (distance unavailable)"
          : "~" +
            (item.dist >= 1000
              ? (item.dist / 1000).toFixed(1) + " km"
              : Number(item.dist).toFixed(0) + " m") +
            " away";
      body.appendChild(badge);
      body.appendChild(h4);
      body.appendChild(meta);

      const history = document.createElement("div");
      history.className = "place-history";
      history.setAttribute("role", "tooltip");
      const histLabel = document.createElement("span");
      histLabel.className = "place-history__label";
      histLabel.textContent = "About";
      const histText = document.createElement("p");
      histText.className = "place-history__text";
      histText.textContent = "Loading…";
      history.appendChild(histLabel);
      history.appendChild(histText);

      card.appendChild(media);
      card.appendChild(body);
      card.appendChild(history);

      card.addEventListener("mouseenter", function () {
        loadPlaceHistory(card, item.title);
      });
      card.addEventListener("focus", function () {
        loadPlaceHistory(card, item.title);
      });
      container.appendChild(card);
    });
  }

  async function loadPlaceHistory(card, title) {
    const panel = card.querySelector(".place-history");
    if (!panel) return;
    const textEl = panel.querySelector(".place-history__text");
    if (state.placeHistory.has(title)) {
      if (textEl) textEl.textContent = state.placeHistory.get(title);
      return;
    }
    try {
      const res = await fetch(
        "https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title.replace(/ /g, "_"))
      );
      const data = await res.json();
      const text = data.extract ? data.extract.slice(0, 280) : "No short summary on Wikipedia yet.";
      state.placeHistory.set(title, text);
      if (textEl) textEl.textContent = text;
    } catch (error) {
      if (textEl) textEl.textContent = "Unable to fetch summary.";
    }
  }

  function addExpense(note, amount) {
    state.expenses.push({ note: note, amount: amount });
    renderExpenses();
  }

  function renderExpenses() {
    ui.expenseList.innerHTML = "";
    let total = 0;
    state.expenses.forEach(function (entry) {
      total += entry.amount;
      const li = document.createElement("li");
      li.innerHTML = "<span>" + escapeHtml(entry.note) + "</span><strong>₹" + entry.amount.toFixed(2) + "</strong>";
      ui.expenseList.appendChild(li);
    });
    ui.expenseTotal.textContent = total.toFixed(2);
  }

  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value;
    return div.innerHTML;
  }

  async function fetchPlaceSuggestions(query) {
    const q = String(query || "").trim();
    if (q.length < 2) return [];
    try {
      const [nomiRes, wikiRes] = await Promise.all([
        fetch(
          "https://nominatim.openstreetmap.org/search?format=jsonv2&q=" +
            encodeURIComponent(q) +
            "&limit=8&addressdetails=1&dedupe=1"
        ).then(function (r) {
          return r.json();
        }),
        fetch(
          "https://en.wikipedia.org/w/api.php?action=opensearch&search=" +
            encodeURIComponent(q) +
            "&limit=8&namespace=0&format=json&origin=*"
        ).then(function (r) {
          return r.json();
        }),
      ]);

      const seen = new Set();
      const rows = [];

      function addRow(label, meta) {
        const key = label.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        rows.push({ label: label, meta: meta || "" });
      }

      if (Array.isArray(nomiRes)) {
        nomiRes.forEach(function (p) {
          if (p.display_name) addRow(p.display_name, p.type || p.addresstype || "Place");
        });
      }

      if (Array.isArray(wikiRes) && wikiRes.length >= 2 && Array.isArray(wikiRes[1])) {
        const titles = wikiRes[1];
        const descs = wikiRes[2] || [];
        titles.forEach(function (title, idx) {
          const d = descs[idx] ? String(descs[idx]).slice(0, 96) : "Wikipedia article";
          addRow(title, d);
        });
      }

      return rows.slice(0, 14);
    } catch (error) {
      return [];
    }
  }

  function setupPlaceSuggest(inputEl, listEl) {
    if (!inputEl || !listEl) return;
    let timer = null;

    function hideList() {
      listEl.hidden = true;
      listEl.innerHTML = "";
    }

    function renderRows(rows) {
      listEl.innerHTML = "";
      if (!rows.length) {
        hideList();
        return;
      }
      rows.forEach(function (row) {
        const li = document.createElement("li");
        li.setAttribute("role", "presentation");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.setAttribute("role", "option");
        btn.innerHTML =
          "<span>" +
          escapeHtml(row.label) +
          '</span><span class="place-suggest__meta">' +
          escapeHtml(row.meta) +
          "</span>";
        btn.addEventListener("mousedown", function (e) {
          e.preventDefault();
          inputEl.value = row.label;
          hideList();
          inputEl.focus();
        });
        li.appendChild(btn);
        listEl.appendChild(li);
      });
      listEl.hidden = false;
    }

    inputEl.addEventListener("input", function () {
      clearTimeout(timer);
      const v = inputEl.value.trim();
      if (v.length < 2) {
        hideList();
        return;
      }
      timer = window.setTimeout(function () {
        fetchPlaceSuggestions(v).then(renderRows);
      }, SUGGEST_DEBOUNCE_MS);
    });

    inputEl.addEventListener("blur", function () {
      window.setTimeout(hideList, 200);
    });

    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Escape") hideList();
    });
  }

  ui.tripForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const formData = new FormData(ui.tripForm);
    const origin = String(formData.get("origin") || "").trim();
    const destination = String(formData.get("destination") || "").trim();
    if (!origin || !destination) return;
    renderItinerary({
      origin: origin,
      destination: destination,
      vibe: String(formData.get("vibe") || "chill"),
      duration: String(formData.get("duration") || "2"),
      budget: String(formData.get("budget") || "medium"),
    }).catch(function () {
      ui.resultSection.hidden = false;
      ui.resultMeta.textContent = "Unable to compute route details right now. Showing local itinerary only.";
    });
  });

  ui.expenseForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const note = ui.expenseNote.value.trim();
    const amount = Number(ui.expenseAmount.value);
    if (!note || Number.isNaN(amount) || amount <= 0) return;
    addExpense(note, amount);
    ui.expenseForm.reset();
    ui.expenseNote.focus();
  });

  ui.detectBtn.addEventListener("click", function () {
    detectLocation();
  });
  if (ui.originLocationBtn) {
    ui.originLocationBtn.addEventListener("click", function () {
      fillOriginWithCurrentLocation();
    });
  }

  loadWelcomeName();
  detectLocation();
  initializeMap();
  setupPlaceSuggest(ui.originInput, ui.originSuggest);
  setupPlaceSuggest(ui.destinationInput, ui.destinationSuggest);

  document.querySelectorAll(".mood-card").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const mood = btn.getAttribute("data-mood");
      if (mood) showMoodResults(mood);
    });
  });
})();
