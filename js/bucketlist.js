/**
 * TourEase Saved Trips & Itinerary Dashboard Module
 * Handles:
 * - "Save" Dashboard Drawer
 * - Starting Point (Origin) selection with 30+ Indian cities & GPS Geolocation
 * - Road/Travel Distance calculation (Haversine + Indian highway route factor)
 * - Travel fare and Total Trip Amount estimation (Fare + Destination stay/activity budget)
 * - Travel Mode switching (Smart, Train/Bus, Flight, Road Trip)
 * - LocalStorage persistence and markdown export with budget & distance breakdown
 */

(function () {
  const STORAGE_KEY = "tourease_saved_bucketlist";
  const ORIGIN_STORAGE_KEY = "tourease_starting_point";
  const TRAVEL_MODE_KEY = "tourease_travel_mode";
  let estimateShown = false;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }

  function safeLocalOrHttpUrl(value, fallback) {
    if (typeof value !== "string" || !value.trim()) return fallback;
    try {
      const url = new URL(value, window.location.href);
      return ["http:", "https:"].includes(url.protocol) ? url.href : fallback;
    } catch (error) {
      return fallback;
    }
  }

  // Catalog of major Indian cities as starting hubs
  const STARTING_CITIES = [
    { name: "New Delhi", state: "Delhi", lat: 28.6139, lng: 77.2090 },
    { name: "Mumbai", state: "Maharashtra", lat: 19.0760, lng: 72.8777 },
    { name: "Bengaluru", state: "Karnataka", lat: 12.9716, lng: 77.5946 },
    { name: "Kolkata", state: "West Bengal", lat: 22.5726, lng: 88.3639 },
    { name: "Chennai", state: "Tamil Nadu", lat: 13.0827, lng: 80.2707 },
    { name: "Hyderabad", state: "Telangana", lat: 17.3850, lng: 78.4867 },
    { name: "Ahmedabad", state: "Gujarat", lat: 23.0225, lng: 72.5714 },
    { name: "Pune", state: "Maharashtra", lat: 18.5204, lng: 73.8567 },
    { name: "Jaipur", state: "Rajasthan", lat: 26.9124, lng: 75.7873 },
    { name: "Lucknow", state: "Uttar Pradesh", lat: 26.8467, lng: 80.9462 },
    { name: "Chandigarh", state: "Punjab/Haryana", lat: 30.7333, lng: 76.7794 },
    { name: "Kochi", state: "Kerala", lat: 9.9312, lng: 76.2673 },
    { name: "Goa (Panaji)", state: "Goa", lat: 15.4909, lng: 73.8278 },
    { name: "Guwahati", state: "Assam", lat: 26.1445, lng: 91.7362 },
    { name: "Varanasi", state: "Uttar Pradesh", lat: 25.3176, lng: 82.9739 },
    { name: "Bhopal", state: "Madhya Pradesh", lat: 23.2599, lng: 77.4126 },
    { name: "Patna", state: "Bihar", lat: 25.5941, lng: 85.1376 },
    { name: "Indore", state: "Madhya Pradesh", lat: 22.7196, lng: 75.8577 },
    { name: "Bhubaneswar", state: "Odisha", lat: 20.2961, lng: 85.8245 },
    { name: "Coimbatore", state: "Tamil Nadu", lat: 11.0168, lng: 76.9558 },
    { name: "Surat", state: "Gujarat", lat: 21.1702, lng: 72.8311 },
    { name: "Visakhapatnam", state: "Andhra Pradesh", lat: 17.6868, lng: 83.2185 },
    { name: "Nagpur", state: "Maharashtra", lat: 21.1458, lng: 79.0882 },
    { name: "Amritsar", state: "Punjab", lat: 31.6340, lng: 74.8723 },
    { name: "Srinagar", state: "Jammu & Kashmir", lat: 34.0837, lng: 74.7973 },
    { name: "Dehradun", state: "Uttarakhand", lat: 30.3165, lng: 78.0322 },
    { name: "Shimla", state: "Himachal Pradesh", lat: 31.1048, lng: 77.1734 },
    { name: "Agra", state: "Uttar Pradesh", lat: 27.1767, lng: 78.0081 },
    { name: "Ranchi", state: "Jharkhand", lat: 23.3441, lng: 85.3096 },
    { name: "Raipur", state: "Chhattisgarh", lat: 21.2514, lng: 81.6296 },
    { name: "Madurai", state: "Tamil Nadu", lat: 9.9252, lng: 78.1198 },
    { name: "Thiruvananthapuram", state: "Kerala", lat: 8.5241, lng: 76.9366 }
  ];

  // Representative center coordinates for all Indian states/UTs for fallback
  const STATE_COORDINATES = {
    "andhra pradesh": { lat: 15.9129, lng: 79.7400 },
    "arunachal pradesh": { lat: 28.2180, lng: 94.7278 },
    "assam": { lat: 26.2006, lng: 92.9376 },
    "bihar": { lat: 25.0961, lng: 85.3131 },
    "chhattisgarh": { lat: 21.2787, lng: 81.8661 },
    "goa": { lat: 15.2993, lng: 74.1240 },
    "gujarat": { lat: 22.2587, lng: 71.1924 },
    "haryana": { lat: 29.0588, lng: 76.0856 },
    "himachal pradesh": { lat: 31.1048, lng: 77.1734 },
    "jharkhand": { lat: 23.6102, lng: 85.2799 },
    "karnataka": { lat: 15.3173, lng: 75.7139 },
    "kerala": { lat: 10.8505, lng: 76.2711 },
    "madhya pradesh": { lat: 22.9734, lng: 78.6569 },
    "maharashtra": { lat: 19.7515, lng: 75.7139 },
    "manipur": { lat: 24.6637, lng: 93.9063 },
    "meghalaya": { lat: 25.4670, lng: 91.3662 },
    "mizoram": { lat: 23.1645, lng: 92.9376 },
    "nagaland": { lat: 26.1584, lng: 94.5624 },
    "odisha": { lat: 20.9517, lng: 85.0985 },
    "punjab": { lat: 31.1471, lng: 75.3412 },
    "rajasthan": { lat: 27.0238, lng: 74.2179 },
    "sikkim": { lat: 27.5330, lng: 88.5122 },
    "tamil nadu": { lat: 11.1271, lng: 78.6569 },
    "telangana": { lat: 18.1124, lng: 79.0193 },
    "tripura": { lat: 23.9408, lng: 91.9882 },
    "uttar pradesh": { lat: 26.8467, lng: 80.9462 },
    "uttarakhand": { lat: 30.0668, lng: 79.0193 },
    "west bengal": { lat: 22.9868, lng: 87.8550 },
    "delhi": { lat: 28.6139, lng: 77.2090 },
    "jammu and kashmir": { lat: 33.7782, lng: 76.5762 },
    "ladakh": { lat: 34.1526, lng: 77.5771 },
    "puducherry": { lat: 11.9416, lng: 79.8083 },
    "chandigarh": { lat: 30.7333, lng: 76.7794 },
    "andaman and nicobar": { lat: 11.7401, lng: 92.6586 }
  };

  // In-memory lookup for full destinations database
  const destinationCatalog = new Map();

  // Load and index destinations.json asynchronously to enrich items
  async function loadDestinationCatalog() {
    try {
      if (Array.isArray(window.destinations) && window.destinations.length > 0) {
        indexDestinations(window.destinations);
        return;
      }
      const res = await fetch("data/destinations.json");
      if (!res.ok) return;
      const data = await res.json();
      const list = data.destinations || data;
      if (Array.isArray(list)) {
        indexDestinations(list);
        renderDrawerItems();
      }
    } catch (e) {
      // Non-critical, fallback coordinates exist
    }
  }

  function indexDestinations(list) {
    list.forEach((dest) => {
      if (dest && dest.id) {
        destinationCatalog.set(String(dest.id), dest);
        if (dest.name) {
          destinationCatalog.set(dest.name.toLowerCase().trim(), dest);
        }
      }
    });
  }

  // --- Storage Helpers ---
  function getSavedItems() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      const items = data ? JSON.parse(data) : [];
      if (!Array.isArray(items)) return [];
      // Remove legacy Inspiration bookmarks while retaining all destination saves.
      const destinations = items.filter((item) => item?.type !== "story");
      if (destinations.length !== items.length) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(destinations));
        } catch (storageError) {
          console.warn("Unable to remove legacy story bookmarks from localStorage", storageError);
        }
      }
      return destinations;
    } catch (e) {
      console.warn("Unable to read saved destinations from localStorage", e);
      return [];
    }
  }

  function saveItems(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn("Unable to save destinations to localStorage", e);
    }
    updateAllBadges();
    renderDrawerItems();
  }

  function isItemSaved(id) {
    const items = getSavedItems();
    return items.some((item) => String(item.id) === String(id));
  }

  function getStartingPoint() {
    try {
      const stored = localStorage.getItem(ORIGIN_STORAGE_KEY);
      if (stored) {
        const point = JSON.parse(stored);
        if (point && typeof point === "object") {
          return {
            ...point,
            name: typeof point.name === "string" && point.name.trim() ? point.name : "Selected starting point",
          };
        }
      }
    } catch (e) {}
    // Default to New Delhi
    return {
      name: "New Delhi",
      state: "Delhi",
      lat: 28.6139,
      lng: 77.2090,
      isCustom: false
    };
  }

  function setStartingPoint(point) {
    try {
      localStorage.setItem(ORIGIN_STORAGE_KEY, JSON.stringify(point));
    } catch (e) {}
    updateStartingPointUI();
    renderDrawerItems();
  }

  function getTravelMode() {
    try {
      return localStorage.getItem(TRAVEL_MODE_KEY) || "smart";
    } catch (e) {
      return "smart";
    }
  }

  function setTravelMode(mode) {
    try {
      localStorage.setItem(TRAVEL_MODE_KEY, mode);
    } catch (e) {}
    updateTravelModeUI();
    renderDrawerItems();
  }

  // --- Toggle Save Item ---
  function toggleSaveItem(item) {
    const items = getSavedItems();
    const index = items.findIndex((i) => String(i.id) === String(item.id));
    let saved = false;

    if (index >= 0) {
      items.splice(index, 1);
      saved = false;
    } else {
      // Find matching coordinates and budget if missing
      const lookup = destinationCatalog.get(String(item.id)) ||
                     destinationCatalog.get(String(item.name || "").toLowerCase().trim());

      const lat = item.lat != null ? item.lat : lookup?.location?.latitude;
      const lng = item.lng != null ? item.lng : lookup?.location?.longitude;
      const budgetMin = item.budgetMin != null ? item.budgetMin : lookup?.budget?.min;
      const budgetMax = item.budgetMax != null ? item.budgetMax : lookup?.budget?.max;
      const state = item.state || lookup?.location?.state || "";
      const district = item.district || lookup?.location?.district || "";

      items.push({
        id: String(item.id),
        name: item.name || item.title || item.location || "Place in India",
        location: item.location || [district, state].filter(Boolean).join(", ") || state || "India",
        state: state,
        district: district,
        image: item.image || lookup?.images?.[0]?.url || "assets/travel-placeholder.svg",
        category: item.category || (Array.isArray(item.categories) ? item.categories[0] : "") || "Travel",
        difficulty: item.difficulty || lookup?.difficulty || "",
        budget: item.budget || (budgetMin ? `INR ${budgetMin}–${budgetMax || budgetMin}` : ""),
        budgetMin: budgetMin,
        budgetMax: budgetMax,
        lat: lat,
        lng: lng,
        url: item.url || (item.id ? `destination-detail.html?id=${encodeURIComponent(item.id)}` : "destinations.html"),
        type: item.type || "destination",
        savedAt: new Date().toISOString(),
      });
      saved = true;
    }

    saveItems(items);
    updateCardButtons(item.id, saved);
    return saved;
  }

  function removeItem(id) {
    const items = getSavedItems().filter((item) => String(item.id) !== String(id));
    saveItems(items);
    updateCardButtons(id, false);
  }

  function clearAllItems() {
    if (!confirm("Are you sure you want to clear your saved destinations?")) {
      return;
    }
    saveItems([]);
    document.querySelectorAll(".destination-card__save-btn").forEach((btn) => {
      btn.classList.remove("is-saved");
      btn.setAttribute("aria-pressed", "false");
    });
  }

  function updateCardButtons(id, isSaved) {
    document.querySelectorAll(".destination-card__save-btn[data-save-id]")
      .forEach((btn) => {
        if (btn.dataset.saveId !== String(id)) return;
        btn.classList.toggle("is-saved", isSaved);
        btn.setAttribute("aria-pressed", String(isSaved));
        btn.setAttribute("title", isSaved ? "Remove from saved" : "Save destination");
      });
  }

  function updateAllBadges() {
    const count = getSavedItems().length;
    document.querySelectorAll(".bucketlist-fab__badge, .navbar-saved-badge, #bucketlist-count").forEach((el) => {
      el.textContent = String(count);
      el.hidden = count === 0;
    });
    const drawerCount = document.getElementById("drawer-item-count");
    if (drawerCount) {
      drawerCount.textContent = `${count} ${count === 1 ? "destination" : "destinations"}`;
    }
  }

  // --- Distance & Amount Calculation Engine ---
  function resolveItemCoords(item) {
    if (item.lat != null && item.lng != null && String(item.lat).trim() !== "" && String(item.lng).trim() !== ""
      && Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng))) {
      const lat = Number(item.lat);
      const lng = Number(item.lng);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
    }

    // Check catalog lookup
    const lookup = destinationCatalog.get(String(item.id)) ||
                   destinationCatalog.get(String(item.name || "").toLowerCase().trim());
    if (lookup?.location?.latitude != null && lookup?.location?.longitude != null
      && String(lookup.location.latitude).trim() !== "" && String(lookup.location.longitude).trim() !== "") {
      const lat = Number(lookup.location.latitude);
      const lng = Number(lookup.location.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
    }

    // Check starting cities list for city match
    const cityName = (item.name || "").toLowerCase();
    const cityMatch = STARTING_CITIES.find((c) => cityName.includes(c.name.toLowerCase()));
    if (cityMatch) {
      return { lat: cityMatch.lat, lng: cityMatch.lng };
    }

    // Check state coordinates fallback
    const locStr = `${item.location || ""} ${item.state || ""}`.toLowerCase();
    for (const [stateKey, coords] of Object.entries(STATE_COORDINATES)) {
      if (locStr.includes(stateKey)) {
        return coords;
      }
    }

    return null;
  }

  function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
    if (![lat1, lon1, lat2, lon2].every(Number.isFinite)
      || lat1 < -90 || lat1 > 90 || lat2 < -90 || lat2 > 90
      || lon1 < -180 || lon1 > 180 || lon2 < -180 || lon2 > 180) return null;
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const straightKm = R * c;
    // Road travel in India is approx 1.25x straight-line distance
    return Math.max(15, Math.round(straightKm * 1.25));
  }

  function calculateRoute(items, start = getStartingPoint()) {
    if (!items.length) return { legs: [], totalDistanceKm: 0, hasInvalidLeg: false };
    const points = [start, ...items, start];
    const legs = points.slice(0, -1).map((from, index) => {
      const to = points[index + 1];
      const fromCoords = resolveItemCoords(from);
      const toCoords = resolveItemCoords(to);
      const distanceKm = fromCoords && toCoords
        ? calculateDistanceKm(fromCoords.lat, fromCoords.lng, toCoords.lat, toCoords.lng)
        : null;
      return { from, to, distanceKm };
    });
    const hasInvalidLeg = legs.some((leg) => leg.distanceKm == null);
    return {
      legs,
      totalDistanceKm: hasInvalidLeg ? null : legs.reduce((total, leg) => total + leg.distanceKm, 0),
      hasInvalidLeg,
    };
  }

  function resolveItemBudget(item) {
    if (item.budgetMin != null && item.budgetMax != null) {
      const min = Number(item.budgetMin);
      const max = Number(item.budgetMax);
      if (Number.isFinite(min) && Number.isFinite(max) && min >= 0 && max >= min) {
        return { min, max };
      }
    }
    const lookup = destinationCatalog.get(String(item.id));
    if (lookup?.budget?.min != null) {
      const min = Number(lookup.budget.min);
      const max = Number(lookup.budget.max ?? lookup.budget.min);
      if (Number.isFinite(min) && Number.isFinite(max) && min >= 0 && max >= min) {
        return { min, max };
      }
    }
    if (typeof item.budget === "string") {
      const nums = item.budget.match(/\d[\d,]*/g);
      if (nums && nums.length >= 2) {
        return {
          min: parseInt(nums[0].replace(/,/g, ""), 10),
          max: parseInt(nums[1].replace(/,/g, ""), 10),
        };
      } else if (nums && nums.length === 1) {
        const val = parseInt(nums[0].replace(/,/g, ""), 10);
        return { min: val, max: Math.round(val * 1.8) };
      }
    }
    // Standard sensible travel budget fallback for India (₹1,500 – ₹3,500 per day/visit)
    return { min: 1500, max: 3500 };
  }

  function calculateTransitFare(distanceKm, mode) {
    if (!distanceKm) return { min: 0, max: 0, label: "Local" };

    if (mode === "train") {
      const min = Math.max(150, Math.round(distanceKm * 0.95)); // Sleeper / 2S
      const max = Math.max(350, Math.round(distanceKm * 2.1));  // 3AC / 2AC
      return { min, max, label: "Train (Sleeper/3AC)" };
    }

    if (mode === "flight") {
      if (distanceKm < 350) {
        return { min: 2200, max: 4000, label: "Connecting/Cab" };
      }
      const min = Math.round(2800 + distanceKm * 2.4);
      const max = Math.round(3800 + distanceKm * 3.8);
      return { min, max, label: "Domestic Flight" };
    }

    if (mode === "drive") {
      const min = Math.round(distanceKm * 7.5); // Fuel & Tolls
      const max = Math.round(distanceKm * 11.0); // Cab / Outstation taxi
      return { min, max, label: "Road Trip (Fuel/Cab)" };
    }

    // Default: 'smart' (Smart optimal mode based on distance)
    if (distanceKm <= 100) {
      return { min: 250, max: 650, label: "Local Transit / Cab" };
    } else if (distanceKm <= 400) {
      return { min: 450, max: 1200, label: "Express Train / Bus" };
    } else if (distanceKm <= 950) {
      return { min: 1100, max: 2800, label: "Train 3AC / Fast Bus" };
    } else {
      return { min: 2200, max: 5400, label: "Train 2AC / Flight" };
    }
  }

  function calculateItemMetrics(item, origin, mode) {
    const coords = resolveItemCoords(item);
    const distanceKm = coords && origin
      ? calculateDistanceKm(origin.lat, origin.lng, coords.lat, coords.lng)
      : null;

    const fare = calculateTransitFare(distanceKm || 0, mode);
    const stay = resolveItemBudget(item);

    const roundTripFare = {
      ...fare,
      min: fare.min * 2,
      max: fare.max * 2,
      label: `${fare.label} round trip`,
    };
    const totalMin = roundTripFare.min + stay.min;
    const totalMax = roundTripFare.max + stay.max;

    return {
      distanceKm,
      fare: roundTripFare,
      stay,
      totalMin,
      totalMax
    };
  }

  // --- Export Markdown Plan ---
  function exportItinerary() {
    const items = getSavedItems();
    if (!items.length) {
      alert("Your Save list is empty. Save some destinations first!");
      return;
    }

    const mode = getTravelMode();
    const origin = getStartingPoint();
    const route = calculateRoute(items, origin);
    const modeLabels = {
      smart: "⚡ Smart Plan (Best distance-based transit)",
      train: "🚆 Train / Bus",
      flight: "✈️ Flight",
      drive: "🚗 Road Trip (Cab / Self-drive)"
    };

    let grandTotalMin = 0;
    let grandTotalMax = 0;

    let markdown = `# 🧭 My TourEase Travel Plan & Cost Breakdown\n`;
    markdown += `Generated on: ${new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}\n`;
    markdown += `📍 **Route starts and ends at:** ${origin.name}\n`;
    markdown += `🚀 **Travel Mode Preference:** ${modeLabels[mode] || mode}\n`;
    markdown += `Total Saved Destinations: ${items.length}\n\n`;
    markdown += `---\n\n`;

    markdown += `## Route Legs\n`;
    route.legs.forEach((leg) => {
      markdown += `- ${leg.from.name} → ${leg.to.name}: ${leg.distanceKm == null ? "Unavailable (coordinates missing/invalid)" : `${leg.distanceKm.toLocaleString("en-IN")} km`}\n`;
    });
    const routeFare = route.totalDistanceKm == null ? null : calculateTransitFare(route.totalDistanceKm, mode);
    const stayTotals = items.reduce((totals, item) => {
      const stay = resolveItemBudget(item);
      totals.min += stay.min;
      totals.max += stay.max;
      return totals;
    }, { min: 0, max: 0 });
    grandTotalMin = stayTotals.min + (routeFare?.min || 0);
    grandTotalMax = stayTotals.max + (routeFare?.max || 0);
    markdown += `- **Total route distance:** ${route.totalDistanceKm == null ? "Unavailable (check route coordinates)" : `${route.totalDistanceKm.toLocaleString("en-IN")} km`}\n`;
    markdown += `- **Estimated route fare (${routeFare?.label || "unavailable"}):** ${routeFare ? `₹${routeFare.min.toLocaleString("en-IN")} – ₹${routeFare.max.toLocaleString("en-IN")}` : "Unavailable (check destination coordinates)"}\n\n`;

    items.forEach((item, index) => {
      const stay = resolveItemBudget(item);

      markdown += `## ${index + 1}. ${item.name}\n`;
      if (item.location) markdown += `- 📍 **Location:** ${item.location}\n`;
      markdown += `- 🏨 **Local Stay & Activities Budget:** ₹${stay.min.toLocaleString("en-IN")} – ₹${stay.max.toLocaleString("en-IN")}\n`;
      if (item.category) markdown += `- 🏷️ **Category:** ${item.category}\n`;
      if (item.difficulty) markdown += `- ⚡ **Difficulty:** ${item.difficulty}\n`;
      if (item.url) markdown += `- 🔗 **Link:** ${window.location.origin}/${item.url}\n`;
      markdown += `\n`;
    });

    markdown += `---\n\n`;
    markdown += `### 📊 Trip Summary\n`;
    markdown += `- **Route starts and ends at:** ${origin.name}\n`;
    markdown += `- **Total Route Distance:** ${route.totalDistanceKm == null ? "Unavailable (check route coordinates)" : `${route.totalDistanceKm.toLocaleString("en-IN")} km`}\n`;
    markdown += `- **Grand Total Estimated Amount:** ${routeFare ? `₹${grandTotalMin.toLocaleString("en-IN")} – ₹${grandTotalMax.toLocaleString("en-IN")}` : "Unavailable (route coordinates needed for transit fare)"}\n\n`;
    markdown += `Plan your incredible journeys across India with TourEase (https://tourease.app)\n`;

    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `TourEase-Plan-${origin.name.replace(/\s+/g, "_")}-${Date.now()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // --- UI Update Helpers ---
  function updateStartingPointUI() {
    const origin = getStartingPoint();
    const select = document.getElementById("bucketlist-origin-select");
    const summaryOrigin = document.getElementById("bucketlist-summary-origin");
    const customWrap = document.getElementById("bucketlist-custom-origin-wrap");
    const currentCityBadge = document.getElementById("bucketlist-current-city-label");

    if (currentCityBadge) {
      currentCityBadge.textContent = origin.name;
    }
    if (summaryOrigin) {
      summaryOrigin.textContent = origin.name;
    }

    if (select) {
      const match = Array.from(select.options).some((opt) => opt.value === origin.name);
      if (match) {
        select.value = origin.name;
        if (customWrap) customWrap.style.display = "none";
      } else {
        select.value = "CUSTOM";
        if (customWrap) customWrap.style.display = "flex";
      }
    }
  }

  function updateTravelModeUI() {
    const currentMode = getTravelMode();
    document.querySelectorAll(".bucketlist-mode-chip").forEach((chip) => {
      const isActive = chip.getAttribute("data-mode") === currentMode;
      chip.classList.toggle("is-active", isActive);
      chip.setAttribute("aria-checked", String(isActive));
    });
  }

  // --- Render Drawer Items ---
  function renderDrawerItems() {
    const body = document.getElementById("bucketlist-drawer-body");
    const summaryDist = document.getElementById("bucketlist-summary-distance");
    const summaryAmount = document.getElementById("bucketlist-summary-amount");
    const summaryOrigin = document.getElementById("bucketlist-summary-origin");
    if (!body) return;

    const items = getSavedItems();
    const mode = getTravelMode();
    const origin = getStartingPoint();
    const route = calculateRoute(items, origin);

    if (summaryOrigin) {
      summaryOrigin.textContent = origin.name;
    }

    if (!items.length) {
      body.innerHTML = `
        <div class="bucketlist-empty">
          <svg viewBox="0 0 24 24">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
          </svg>
          <h3>Your Save Dashboard is Empty</h3>
          <p>Save destinations to build an ordered route from your starting point and back.</p>
          <a class="bucketlist-btn bucketlist-btn--primary" href="destinations.html">Explore Destinations</a>
        </div>
      `;
      if (summaryDist) summaryDist.textContent = "0 km";
      if (summaryAmount) summaryAmount.textContent = "₹0";
      const estimateButton = document.getElementById("estimate-travel-budget-btn");
      const estimateResult = document.getElementById("bucketlist-budget-result");
      if (estimateButton) estimateButton.disabled = true;
      if (estimateResult) estimateResult.hidden = true;
      return;
    }

    const routeFare = route.totalDistanceKm == null ? null : calculateTransitFare(route.totalDistanceKm, mode);
    const stayTotals = items.reduce((totals, item) => {
      const stay = resolveItemBudget(item);
      totals.min += stay.min;
      totals.max += stay.max;
      return totals;
    }, { min: 0, max: 0 });
    const totalTripMin = routeFare ? stayTotals.min + routeFare.min : null;
    const totalTripMax = routeFare ? stayTotals.max + routeFare.max : null;

    body.innerHTML = "";

    const routeSection = document.createElement("section");
    routeSection.className = "bucketlist-route";
    routeSection.setAttribute("aria-label", "Planned route legs");
    const routeTitle = document.createElement("h3");
      routeTitle.textContent = `Route legs · starts and returns to ${origin.name}`;
    routeSection.appendChild(routeTitle);
    if (!items.length) {
      const emptyRoute = document.createElement("p");
      emptyRoute.textContent = "Save a destination to build your route.";
      routeSection.appendChild(emptyRoute);
    } else {
      const routeList = document.createElement("ol");
      route.legs.forEach((leg) => {
        const row = document.createElement("li");
        row.textContent = `${leg.from.name} → ${leg.to.name}: ${leg.distanceKm == null ? "Distance unavailable (missing or invalid coordinates)" : `${leg.distanceKm.toLocaleString("en-IN")} km`}`;
        routeList.appendChild(row);
      });
      routeSection.appendChild(routeList);
    }
    const routeTotal = document.createElement("p");
    routeTotal.className = "bucketlist-route__total";
    routeTotal.textContent = route.totalDistanceKm == null
      ? "Total route distance unavailable. Check starting location and destination coordinates."
      : `Total route distance: ${route.totalDistanceKm.toLocaleString("en-IN")} km`;
    routeSection.appendChild(routeTotal);
    body.appendChild(routeSection);

    items.forEach((item) => {
      const stay = resolveItemBudget(item);

      const card = document.createElement("div");
      card.className = "bucketlist-item";

      const diffClass = (item.difficulty || "").toLowerCase().includes("easy")
        ? "bucketlist-item__badge--easy"
        : (item.difficulty || "").toLowerCase().includes("hard") ||
          (item.difficulty || "").toLowerCase().includes("difficult")
        ? "bucketlist-item__badge--hard"
        : "bucketlist-item__badge--moderate";

      const formattedTotal = `₹${stay.min.toLocaleString("en-IN")} – ₹${stay.max.toLocaleString("en-IN")}`;
      const safeImage = safeLocalOrHttpUrl(item.image, "assets/travel-placeholder.svg");
      const safeDetailUrl = safeLocalOrHttpUrl(item.url, "destinations.html");

      card.innerHTML = `
        <img class="bucketlist-item__image" src="${escapeHtml(safeImage)}" alt="${escapeHtml(item.name)}" onerror="this.src='assets/travel-placeholder.svg'">
        <div class="bucketlist-item__info">
          <div class="bucketlist-item__header-row">
            <h4 class="bucketlist-item__title"><a href="${escapeHtml(safeDetailUrl)}">${escapeHtml(item.name)}</a></h4>
          </div>
          <span class="bucketlist-item__meta">${escapeHtml(item.location || "India")}</span>

          <!-- Destination stay estimate -->
          <div class="bucketlist-metric-container">
            <div class="bucketlist-metric-pill bucketlist-metric-pill--amount" title="Destination stay and activity estimate">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M15 9h-4.5a2 2 0 0 0 0 4h3a2 2 0 0 1 0 4H9"/><path d="M12 7v10"/></svg>
              <div class="bucketlist-metric-amount-text">
                <span class="bucketlist-amount-main"><strong>${formattedTotal}</strong></span>
                <span class="bucketlist-amount-sub">Stay &amp; activities</span>
              </div>
            </div>
          </div>

          <div class="bucketlist-item__badges">
            ${item.category ? `<span class="bucketlist-item__badge">${escapeHtml(item.category)}</span>` : ""}
            ${item.difficulty ? `<span class="bucketlist-item__badge ${diffClass}">${escapeHtml(item.difficulty)}</span>` : ""}
          </div>
        </div>
        <button class="bucketlist-item__remove" type="button" aria-label="Remove ${escapeHtml(item.name)}" data-remove-id="${escapeHtml(item.id)}" title="Remove">
          ✕
        </button>
      `;

      card.querySelector("[data-remove-id]").addEventListener("click", () => {
        removeItem(item.id);
      });

      body.appendChild(card);
    });

    if (summaryDist) summaryDist.textContent = route.totalDistanceKm == null ? "Unavailable" : `${route.totalDistanceKm.toLocaleString("en-IN")} km`;
    if (summaryAmount) {
      summaryAmount.textContent = totalTripMin == null
        ? "Unavailable"
        : `₹${totalTripMin.toLocaleString("en-IN")} – ₹${totalTripMax.toLocaleString("en-IN")}`;
    }
    const estimateButton = document.getElementById("estimate-travel-budget-btn");
    const estimateResult = document.getElementById("bucketlist-budget-result");
    if (estimateButton) estimateButton.disabled = items.length === 0;
    if (estimateResult) {
      estimateResult.hidden = !estimateShown || items.length === 0;
      if (items.length) {
        estimateResult.textContent = totalTripMin == null
          ? "Travel fare estimate unavailable because one or more route legs lack valid coordinates. Destination stay estimates remain available."
          : `Estimated combined route budget: ₹${totalTripMin.toLocaleString("en-IN")} – ₹${totalTripMax.toLocaleString("en-IN")}. Includes all route legs and destination stays; costs are approximate.`;
      }
    }
  }

  // --- Create Drawer DOM with Starting Point & Mode Selectors ---
  function createDrawerDOM() {
    if (document.getElementById("bucketlist-drawer")) return;

    // Overlay
    const overlay = document.createElement("div");
    overlay.id = "bucketlist-overlay";
    overlay.className = "bucketlist-overlay";
    overlay.setAttribute("aria-hidden", "true");

    // Drawer
    const drawer = document.createElement("aside");
    drawer.id = "bucketlist-drawer";
    drawer.className = "bucketlist-drawer";
    drawer.setAttribute("aria-label", "Save Dashboard");
    drawer.setAttribute("aria-hidden", "true");

    const currentOrigin = getStartingPoint();
    const currentMode = getTravelMode();

    drawer.innerHTML = `
      <!-- Header -->
      <div class="bucketlist-drawer__header">
        <div class="bucketlist-drawer__title-wrap">
          <div class="bucketlist-drawer__title-group">
            <h2 class="bucketlist-drawer__title">Save</h2>
            <span class="bucketlist-drawer__badge-tag">Dashboard</span>
          </div>
          <span id="drawer-item-count" class="bucketlist-drawer__count">0 destinations</span>
        </div>
        <button id="close-bucketlist-drawer" class="bucketlist-drawer__close" type="button" aria-label="Close save dashboard">×</button>
      </div>

      <!-- Starting Point & Route Calculator Bar -->
      <section class="bucketlist-origin-bar" aria-label="Trip Origin and Settings">
        <div class="bucketlist-origin-bar__header">
          <div class="bucketlist-origin-title">
            <svg class="bucketlist-origin-icon" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <span>Starting Point (Origin)</span>
          </div>
          <button type="button" id="origin-geo-btn" class="bucketlist-geo-btn" title="Use your device GPS location">
            <svg viewBox="0 0 24 24"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>
            <span id="geo-btn-text">Detect Location</span>
          </button>
        </div>

        <div class="bucketlist-origin-controls">
          <div class="bucketlist-select-wrapper">
            <select id="bucketlist-origin-select" class="bucketlist-origin-select" aria-label="Select starting city">
              ${STARTING_CITIES.map(
                (city) =>
                  `<option value="${city.name}" ${city.name === currentOrigin.name ? "selected" : ""}>${city.name} (${city.state})</option>`
              ).join("")}
              <option value="CUSTOM" ${currentOrigin.isCustom ? "selected" : ""}>✏️ Custom City / Place...</option>
            </select>
          </div>

          <!-- Custom City Form (Hidden by default unless Custom is chosen) -->
          <div id="bucketlist-custom-origin-wrap" class="bucketlist-custom-origin" style="${currentOrigin.isCustom ? "display:flex;" : "display:none;"}">
              <input
              type="text"
              id="bucketlist-custom-origin-input"
              class="bucketlist-origin-input"
              placeholder="Enter city or town in India..."
              value="${escapeHtml(currentOrigin.isCustom ? currentOrigin.name : "")}"
            />
            <button type="button" id="bucketlist-custom-origin-save" class="bucketlist-origin-btn-save">Set</button>
          </div>
        </div>

        <!-- Travel Mode Selector -->
        <div class="bucketlist-travel-modes" role="radiogroup" aria-label="Travel transit mode">
          <button type="button" class="bucketlist-mode-chip ${currentMode === "smart" ? "is-active" : ""}" data-mode="smart" title="Smart optimal transit based on distance">
            ⚡ Smart Mode
          </button>
          <button type="button" class="bucketlist-mode-chip ${currentMode === "train" ? "is-active" : ""}" data-mode="train" title="Train / Bus Fare calculation">
            🚆 Train / Bus
          </button>
          <button type="button" class="bucketlist-mode-chip ${currentMode === "flight" ? "is-active" : ""}" data-mode="flight" title="Flight Fare calculation">
            ✈️ Flight
          </button>
          <button type="button" class="bucketlist-mode-chip ${currentMode === "drive" ? "is-active" : ""}" data-mode="drive" title="Driving / Cab road trip fare">
            🚗 Road Trip
          </button>
        </div>
      </section>

      <!-- Items List -->
      <div id="bucketlist-drawer-body" class="bucketlist-drawer__body"></div>

      <!-- Footer Summary & Actions -->
      <div class="bucketlist-drawer__footer">
        <div class="bucketlist-summary-grid">
          <div class="bucketlist-summary-stat">
            <span class="bucketlist-summary-stat__label">Starting Point</span>
            <span id="bucketlist-summary-origin" class="bucketlist-summary-stat__value">${escapeHtml(currentOrigin.name)}</span>
          </div>
          <div class="bucketlist-summary-stat">
            <span class="bucketlist-summary-stat__label">Total Distance</span>
            <span id="bucketlist-summary-distance" class="bucketlist-summary-stat__value">0 km</span>
          </div>
          <div class="bucketlist-summary-stat bucketlist-summary-stat--highlight">
            <span class="bucketlist-summary-stat__label">Total Est. Amount</span>
            <span id="bucketlist-summary-amount" class="bucketlist-summary-stat__value">₹0</span>
          </div>
        </div>
        <button id="estimate-travel-budget-btn" class="bucketlist-btn bucketlist-btn--primary" type="button" disabled>
          Estimate Travel Budget
        </button>
        <p id="bucketlist-budget-result" class="bucketlist-budget-result" aria-live="polite" hidden></p>
        <div class="bucketlist-actions">
          <button id="export-itinerary-btn" class="bucketlist-btn bucketlist-btn--primary" type="button">
            📥 Export Plan & Budget
          </button>
          <button id="clear-bucketlist-btn" class="bucketlist-btn bucketlist-btn--secondary" type="button">
            Clear All
          </button>
        </div>
      </div>
    `;

    // Floating Button
    const fab = document.createElement("button");
    fab.id = "bucketlist-fab";
    fab.className = "bucketlist-fab";
    fab.type = "button";
    fab.setAttribute("aria-label", "Open save dashboard");
    fab.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
      </svg>
      <span>Saved</span>
      <span class="bucketlist-fab__badge">0</span>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
    document.body.appendChild(fab);

    // Event Listeners
    fab.addEventListener("click", openDrawer);
    overlay.addEventListener("click", closeDrawer);
    drawer.querySelector("#close-bucketlist-drawer").addEventListener("click", closeDrawer);
    drawer.querySelector("#export-itinerary-btn").addEventListener("click", exportItinerary);
    drawer.querySelector("#estimate-travel-budget-btn").addEventListener("click", () => {
      estimateShown = true;
      renderDrawerItems();
    });
    drawer.querySelector("#clear-bucketlist-btn").addEventListener("click", clearAllItems);

    // Origin Selector Change
    const originSelect = drawer.querySelector("#bucketlist-origin-select");
    const customWrap = drawer.querySelector("#bucketlist-custom-origin-wrap");
    const customInput = drawer.querySelector("#bucketlist-custom-origin-input");
    const customSave = drawer.querySelector("#bucketlist-custom-origin-save");

    originSelect.addEventListener("change", (e) => {
      const val = e.target.value;
      if (val === "CUSTOM") {
        customWrap.style.display = "flex";
        customInput.focus();
      } else {
        customWrap.style.display = "none";
        const found = STARTING_CITIES.find((c) => c.name === val);
        if (found) {
          setStartingPoint({
            name: found.name,
            state: found.state,
            lat: found.lat,
            lng: found.lng,
            isCustom: false,
          });
        }
      }
    });

    // Custom Origin Save
    customSave.addEventListener("click", () => {
      const cityName = (customInput.value || "").trim();
      if (!cityName) return;

      // Check if coordinates exist in city or state catalog
      const cityMatch = STARTING_CITIES.find((c) => c.name.toLowerCase().includes(cityName.toLowerCase()));
      let lat = cityMatch ? cityMatch.lat : null;
      let lng = cityMatch ? cityMatch.lng : null;

      if (!lat) {
        for (const [st, coords] of Object.entries(STATE_COORDINATES)) {
          if (cityName.toLowerCase().includes(st)) {
            lat = coords.lat;
            lng = coords.lng;
            break;
          }
        }
      }
      // If still unknown, approximate with Central India coordinates
      if (!lat) {
        lat = 22.9734;
        lng = 78.6569;
      }

      setStartingPoint({
        name: cityName,
        state: "Custom",
        lat: lat,
        lng: lng,
        isCustom: true,
      });
    });

    customInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        customSave.click();
      }
    });

    // Geolocation detection
    const geoBtn = drawer.querySelector("#origin-geo-btn");
    const geoText = drawer.querySelector("#geo-btn-text");

    geoBtn.addEventListener("click", () => {
      if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
      }
      geoText.textContent = "Detecting...";
      geoBtn.disabled = true;

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;

          // Find closest known city from STARTING_CITIES to give a clean display name
          let closestCity = STARTING_CITIES[0];
          let minDistance = Infinity;

          STARTING_CITIES.forEach((city) => {
            const d = calculateDistanceKm(lat, lng, city.lat, city.lng);
            if (d < minDistance) {
              minDistance = d;
              closestCity = city;
            }
          });

          const detectedName = minDistance <= 50 ? closestCity.name : `My Location (${lat.toFixed(2)}, ${lng.toFixed(2)})`;

          setStartingPoint({
            name: detectedName,
            state: closestCity.state || "Detected",
            lat: lat,
            lng: lng,
            isCustom: true,
          });

          geoText.textContent = "Detected!";
          setTimeout(() => {
            geoText.textContent = "Detect Location";
            geoBtn.disabled = false;
          }, 2000);
        },
        (err) => {
          console.warn("Geolocation error", err);
          alert("Unable to retrieve location. Please choose a city from the list.");
          geoText.textContent = "Detect Location";
          geoBtn.disabled = false;
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    });

    // Travel Mode Chips
    drawer.querySelectorAll(".bucketlist-mode-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const mode = chip.getAttribute("data-mode");
        setTravelMode(mode);
      });
    });

    // Keyboard support
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && drawer.classList.contains("is-open")) {
        closeDrawer();
      }
    });
  }

  function openDrawer() {
    const overlay = document.getElementById("bucketlist-overlay");
    const drawer = document.getElementById("bucketlist-drawer");
    if (!overlay || !drawer) return;
    updateStartingPointUI();
    updateTravelModeUI();
    renderDrawerItems();
    overlay.classList.add("is-open");
    drawer.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeDrawer() {
    const overlay = document.getElementById("bucketlist-overlay");
    const drawer = document.getElementById("bucketlist-drawer");
    if (!overlay || !drawer) return;
    overlay.classList.remove("is-open");
    drawer.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    drawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  // --- Initialize on DOMContentLoaded ---
  document.addEventListener("DOMContentLoaded", () => {
    createDrawerDOM();
    updateAllBadges();
    updateStartingPointUI();
    updateTravelModeUI();
    renderDrawerItems();

    // Hook up any existing navbar "Saved" buttons
    document.querySelectorAll(".js-open-bucketlist").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        openDrawer();
      });
    });

    // Load full dataset in background to enrich any older or partially saved items
    loadDestinationCatalog();
  });

  // Expose global API
  window.tourEaseBucketlist = {
    isSaved: isItemSaved,
    toggle: toggleSaveItem,
    remove: removeItem,
    getAll: getSavedItems,
    openDrawer: openDrawer,
    closeDrawer: closeDrawer,
    updateCardButtons: updateCardButtons,
    getStartingPoint: getStartingPoint,
    setStartingPoint: setStartingPoint,
    getTravelMode: getTravelMode,
    setTravelMode: setTravelMode,
    calculateItemMetrics: calculateItemMetrics,
    calculateRoute: calculateRoute,
  };
})();
