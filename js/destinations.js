const DESTINATIONS_DATA_URL = "data/destinations.json";
const DESTINATION_DETAIL_URL = "destination-detail.html";
const PAGE_SIZE = 6;
const SEARCH_FIELDS = [
  "name",
  "location.state",
  "location.district",
  "categories",
  "weather",
  "budget.includes",
  "duration",
  "difficulty",
  "crowd",
  "bestSeason",
  "bestTime",
  "companions",
  "description",
  "nearbyAttractions",
  "safety",
  "seasonalStatus",
  "season",
  "status",
];

const searchInput = document.getElementById("destination-search");
const selectionContext = document.getElementById("destination-selection-context");
const selectionLabel = document.getElementById("destination-selection-label");
const clearSelectionButton = document.getElementById("destination-clear-selection");
const filterFields = document.getElementById("destination-filters");
const primaryFilters = document.getElementById("destination-primary-filters");
const additionalFilters = document.getElementById("destination-additional-filters");
const moreFilters = document.getElementById("destination-more-filters");
const moreFiltersToggle = document.getElementById("destination-more-toggle");
const filterToggle = document.getElementById("destination-filter-toggle");
const filterCount = document.getElementById("destination-filter-count");
const filtersPanel = document.getElementById("destination-filters");
const clearFiltersButton = document.getElementById("clear-destination-filters");
const resultCount = document.getElementById("destination-result-count");
const activeFilters = document.getElementById("destination-active-filters");
const destinationGrid = document.getElementById("destination-grid");
const emptyState = document.getElementById("destination-empty-state");
const errorMessage = document.getElementById("destination-error");
const pagination = document.getElementById("destination-pagination");
const previousPageButton = document.getElementById("destination-previous-page");
const nextPageButton = document.getElementById("destination-next-page");
const pageNumbers = document.getElementById("destination-page-numbers");

let destinations = [];
let filteredDestinations = [];
let destinationSelection = null;
let currentPage = 1;
let compactFiltersOpen = false;
let activeFilterGroup = primaryFilters;
const searchableText = new WeakMap();
const compactFilters = window.matchMedia("(max-width: 760px)");

function getField(record, path) {
  return path.split(".").reduce((value, key) => value?.[key], record);
}

function getTextValues(value) {
  if (Array.isArray(value)) {
    return value.flatMap(getTextValues);
  }
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(getTextValues);
  }
  return value === null || value === undefined ? [] : [String(value)];
}

function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function getDestinationSelection(value) {
  const normalizedValue = normalizeText(value);
  const selectedById = destinations.find(
    (destination) => normalizeText(destination.id) === normalizedValue
  );
  const selectedByName = destinations.find(
    (destination) => normalizeText(destination.name) === normalizedValue
  );
  const selectedByState = destinations.filter((destination) => {
    const state = normalizeText(destination.location?.state);
    return state === normalizedValue || state.includes(normalizedValue);
  });
  let anchors = selectedById || selectedByName
    ? [selectedById || selectedByName]
    : selectedByState;

  if (!anchors.length && normalizedValue.length > 1) {
    anchors = destinations.filter((destination) => {
      const relatedText = [
        destination.name,
        destination.location?.district,
        destination.description,
        ...(Array.isArray(destination.nearbyAttractions) ? destination.nearbyAttractions : []),
      ];
      return relatedText.some((text) => normalizeText(text).includes(normalizedValue));
    });
  }

  if (!anchors.length) {
    return { label: value, destinations: [] };
  }

  const isRegionSelection = !selectedById && !selectedByName && anchors.length > 1;
  const relatedDestinations = destinations
    .map((destination, index) => {
      const relevance = anchors.reduce((best, anchor) => {
        const destinationState = normalizeText(destination.location?.state);
        const anchorState = normalizeText(anchor.location?.state);
        const destinationDistrict = normalizeText(destination.location?.district);
        const anchorDistrict = normalizeText(anchor.location?.district);
        const sameState = Boolean(anchorState && destinationState === anchorState);
        const sameDistrict = Boolean(anchorDistrict && destinationDistrict === anchorDistrict);
        const anchorCategories = (Array.isArray(anchor.categories) ? anchor.categories : [])
          .map(normalizeText);
        const sharedCategories = (Array.isArray(destination.categories) ? destination.categories : [])
          .filter((category) => anchorCategories.includes(normalizeText(category))).length;
        const destinationWeather = normalizeText(destination.weather);
        const anchorWeather = normalizeText(anchor.weather);
        const destinationSeason = normalizeText(destination.bestSeason);
        const anchorSeason = normalizeText(anchor.bestSeason);
        const destinationDifficulty = normalizeText(destination.difficulty);
        const anchorDifficulty = normalizeText(anchor.difficulty);
        const sameWeather = Boolean(anchorWeather && destinationWeather === anchorWeather);
        const sameSeason = Boolean(anchorSeason && destinationSeason === anchorSeason);
        const sameDifficulty = Boolean(
          anchorDifficulty && destinationDifficulty === anchorDifficulty
        );
        const similarTravelProfile = sharedCategories >= 2
          && (sameWeather || (sameSeason && sameDifficulty));
        const isRelated = isRegionSelection
          ? sameState
          : sameState || sameDistrict || similarTravelProfile;
        const score = (sameState ? 100 : 0)
          + (sameDistrict ? 25 : 0)
          + sharedCategories * 10
          + (sameWeather ? 4 : 0)
          + (sameSeason ? 2 : 0)
          + (sameDifficulty ? 1 : 0);

        return isRelated && score > best ? score : best;
      }, 0);
      return { destination, index, relevance };
    })
    .filter(({ relevance }) => relevance > 0)
    .sort((left, right) => right.relevance - left.relevance || left.index - right.index)
    .map(({ destination }) => destination);

  return {
    label: selectedById || selectedByName
      ? (selectedById || selectedByName).name
      : value,
    destinations: relatedDestinations,
  };
}

function clearDestinationSelection() {
  destinationSelection = null;
  selectionContext.hidden = true;
  const url = new URL(window.location.href);
  url.searchParams.delete("destination");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

function destinationSearchText(destination) {
  return SEARCH_FIELDS
    .flatMap((path) => getTextValues(getField(destination, path)))
    .join(" ")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

function uniqueFieldValues(path) {
  const values = new Set();
  destinations.forEach((destination) => {
    getTextValues(getField(destination, path)).forEach((value) => {
      const trimmed = value.trim();
      if (trimmed) {
        values.add(trimmed);
      }
    });
  });
  return [...values].sort((left, right) => left.localeCompare(right));
}

function hasField(path) {
  return destinations.some((destination) => getField(destination, path) !== undefined);
}

function addSelectFilter(path, label) {
  if (!hasField(path)) {
    return;
  }
  const options = uniqueFieldValues(path);
  if (!options.length) {
    return;
  }

  const field = document.createElement("label");
  field.className = "destination-filter";
  const caption = document.createElement("span");
  caption.textContent = label;
  const select = document.createElement("select");
  select.name = path;
  select.dataset.filterPath = path;
  const anyOption = document.createElement("option");
  anyOption.value = "";
  anyOption.textContent = `Any ${label.toLocaleLowerCase()}`;
  select.append(anyOption);
  options.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
  field.append(caption, select);
  activeFilterGroup.append(field);
}

function addTextFilter(path, label, placeholder) {
  if (!hasField(path)) {
    return;
  }
  const field = document.createElement("label");
  field.className = "destination-filter";
  const caption = document.createElement("span");
  caption.textContent = label;
  const input = document.createElement("input");
  input.type = "search";
  input.name = path;
  input.dataset.filterPath = path;
  input.placeholder = placeholder;
  field.append(caption, input);
  activeFilterGroup.append(field);
}

function addBudgetFilter() {
  if (!hasField("budget.min") || !hasField("budget.max")) {
    return;
  }
  const fieldset = document.createElement("fieldset");
  fieldset.className = "destination-filter destination-filter--budget";
  const legend = document.createElement("legend");
  legend.textContent = `Budget (${destinations.find((destination) => destination.budget?.currency)?.budget.currency || "INR"})`;
  const inputs = document.createElement("div");
  inputs.className = "destination-budget-inputs";
  [
    { key: "budgetMin", label: "Minimum", placeholder: "Min" },
    { key: "budgetMax", label: "Maximum", placeholder: "Max" },
  ].forEach(({ key, label, placeholder }) => {
    const control = document.createElement("label");
    control.className = "destination-budget-input";
    const caption = document.createElement("span");
    caption.className = "visually-hidden";
    caption.textContent = label;
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "500";
    input.inputMode = "numeric";
    input.placeholder = placeholder;
    input.setAttribute("aria-label", `${label} budget in INR`);
    input.dataset.budgetPart = key;
    control.append(caption, input);
    inputs.append(control);
  });
  fieldset.append(legend, inputs);
  activeFilterGroup.append(fieldset);
}

function buildFilters() {
  activeFilterGroup = primaryFilters;
  addSelectFilter("location.state", "State");
  addBudgetFilter();
  addSelectFilter("duration", "Duration");
  addSelectFilter("difficulty", "Difficulty");
  addSelectFilter("categories", "Category");

  activeFilterGroup = additionalFilters;
  addSelectFilter("crowd", "Crowd level");
  addSelectFilter("bestSeason", "Best season");
  addSelectFilter("companions", "Companions");
  addTextFilter("weather", "Weather", "Filter by weather");
}

function getActiveFilterValues() {
  const selected = [...filterFields.querySelectorAll("[data-filter-path]")]
    .filter((control) => control.value.trim())
    .map((control) => ({
      key: control.dataset.filterPath,
      label: control.closest(".destination-filter").querySelector("span").textContent,
      value: control.value.trim(),
      type: control.tagName === "SELECT" ? "select" : "text",
    }));
  const budgetMin = filterFields.querySelector('[data-budget-part="budgetMin"]')?.value.trim();
  const budgetMax = filterFields.querySelector('[data-budget-part="budgetMax"]')?.value.trim();
  if (budgetMin) {
    selected.push({ key: "budgetMin", label: "Min budget", value: budgetMin, type: "budget" });
  }
  if (budgetMax) {
    selected.push({ key: "budgetMax", label: "Max budget", value: budgetMax, type: "budget" });
  }
  const query = searchInput.value.trim();
  if (query) {
    selected.unshift({ key: "search", label: "Search", value: query, type: "search" });
  }
  return selected;
}

function matchesDestination(destination, filters, query, budgetMin, budgetMax) {
  if (query && !searchableText.get(destination).includes(query)) {
    return false;
  }

  for (const [path, selectedValue] of filters) {
    const candidateValues = getTextValues(getField(destination, path));
    const normalizedSelected = normalizeText(selectedValue);
    const matchesValue = path === "weather"
      ? (value) => normalizeText(value).includes(normalizedSelected)
      : (value) => normalizeText(value) === normalizedSelected;
    if (!candidateValues.some(matchesValue)) {
      return false;
    }
  }

  if (budgetMin !== null && Number(destination.budget?.max) < budgetMin) {
    return false;
  }
  if (budgetMax !== null && Number(destination.budget?.min) > budgetMax) {
    return false;
  }
  return true;
}

function currentBudgetValue(selector) {
  const raw = filterFields.querySelector(selector)?.value.trim();
  if (!raw) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function updateActiveFilters() {
  const entries = getActiveFilterValues();
  activeFilters.replaceChildren();
  entries.forEach(({ key, label, value }) => {
    const chip = document.createElement("button");
    chip.className = "destination-filter-chip";
    chip.type = "button";
    chip.dataset.clearFilter = key;
    chip.setAttribute("aria-label", `Remove ${label} filter ${value}`);
    const text = document.createElement("span");
    text.textContent = `${label}: ${value}`;
    const close = document.createElement("span");
    close.setAttribute("aria-hidden", "true");
    close.textContent = "×";
    chip.append(text, close);
    activeFilters.append(chip);
  });

  const activeCount = entries.length;
  clearFiltersButton.disabled = activeCount === 0 && !destinationSelection;
  filterCount.hidden = activeCount === 0;
  filterCount.textContent = String(activeCount);
  filterToggle.setAttribute("aria-expanded", String(compactFiltersOpen));
}

function formatBudget(destination) {
  const budget = destination.budget;
  if (!budget || !Number.isFinite(Number(budget.min)) || !Number.isFinite(Number(budget.max))) {
    return "";
  }
  const currency = budget.currency || "INR";
  const formatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
  return `${currency} ${formatter.format(Number(budget.min))}–${formatter.format(Number(budget.max))}`;
}

function createDestinationCard(destination) {
  const link = document.createElement("a");
  link.className = "destination-card";
  link.href = `${DESTINATION_DETAIL_URL}?id=${encodeURIComponent(destination.id)}`;
  const media = document.createElement("div");
  media.className = "destination-card__media";
  const image = destination.images?.find((entry) => typeof entry?.url === "string" && entry.url.trim());
  if (image) {
    const img = document.createElement("img");
    img.className = "destination-card__image";
    img.src = image.url;
    img.alt = `${destination.name || "Destination"} in ${destination.location?.state || "India"}`;
    img.loading = "lazy";
    img.decoding = "async";
    const fallback = document.createElement("span");
    fallback.className = "destination-card__image-fallback";
    fallback.textContent = "Image unavailable";
    fallback.hidden = true;
    img.addEventListener("error", () => {
      img.hidden = true;
      fallback.hidden = false;
      media.classList.add("is-fallback");
    }, { once: true });
    media.append(img, fallback);
  } else {
    media.classList.add("is-fallback");
    const fallback = document.createElement("span");
    fallback.className = "destination-card__image-fallback";
    fallback.textContent = "Image unavailable";
    media.append(fallback);
  }

  const content = document.createElement("div");
  content.className = "destination-card__content";
  const categoryList = Array.isArray(destination.categories) ? destination.categories : [];
  const eyebrow = document.createElement("p");
  eyebrow.className = "destination-card__eyebrow";
  eyebrow.textContent = categoryList.slice(0, 2).join(" · ") || destination.location?.state || "India";
  const title = document.createElement("h3");
  title.className = "destination-card__title";
  title.textContent = destination.name || "Untitled destination";
  const place = document.createElement("p");
  place.className = "destination-card__location";
  place.textContent = [destination.location?.district, destination.location?.state]
    .filter(Boolean)
    .join(", ");
  const metadata = document.createElement("div");
  metadata.className = "destination-card__metadata";
  [formatBudget(destination), destination.duration, destination.difficulty]
    .filter(Boolean)
    .forEach((value) => {
      const item = document.createElement("span");
      item.textContent = value;
      metadata.append(item);
    });
  content.append(eyebrow, title, place, metadata);
  link.append(media, content);
  return link;
}

function renderPageNumbers(totalPages) {
  pageNumbers.replaceChildren();
  if (totalPages <= 1) {
    return;
  }

  const pages = new Set([1, totalPages]);
  for (let page = Math.max(1, currentPage - 1); page <= Math.min(totalPages, currentPage + 1); page += 1) {
    pages.add(page);
  }

  let previousPage = 0;
  [...pages].sort((left, right) => left - right).forEach((page) => {
    if (previousPage && page - previousPage > 1) {
      const ellipsis = document.createElement("span");
      ellipsis.className = "destination-page-ellipsis";
      ellipsis.setAttribute("aria-hidden", "true");
      ellipsis.textContent = "…";
      pageNumbers.append(ellipsis);
    }

    const button = document.createElement("button");
    button.className = "destination-page-button";
    button.type = "button";
    button.dataset.page = String(page);
    button.textContent = String(page);
    button.setAttribute("aria-label", `Page ${page}`);
    button.setAttribute("aria-current", page === currentPage ? "page" : "false");
    button.disabled = page === currentPage;
    pageNumbers.append(button);
    previousPage = page;
  });
}

function renderCurrentPage() {
  const totalPages = Math.max(1, Math.ceil(filteredDestinations.length / PAGE_SIZE));
  currentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageDestinations = filteredDestinations.slice(startIndex, startIndex + PAGE_SIZE);
  destinationGrid.replaceChildren(...pageDestinations.map(createDestinationCard));
  destinationGrid.setAttribute("aria-busy", "false");

  if (filteredDestinations.length) {
    const firstShown = startIndex + 1;
    const lastShown = Math.min(startIndex + PAGE_SIZE, filteredDestinations.length);
    resultCount.textContent = `Showing ${firstShown}–${lastShown} of ${filteredDestinations.length.toLocaleString()} ${
      filteredDestinations.length === 1 ? "destination" : "destinations"
    }`;
  } else {
    resultCount.textContent = "0 destinations";
  }
  emptyState.hidden = filteredDestinations.length !== 0;
  pagination.hidden = totalPages <= 1;
  previousPageButton.disabled = currentPage <= 1;
  nextPageButton.disabled = currentPage >= totalPages;
  renderPageNumbers(totalPages);
}

function renderDestinations() {
  const query = normalizeText(searchInput.value);
  const filters = new Map(
    [...filterFields.querySelectorAll("[data-filter-path]")]
      .filter((control) => control.value.trim())
      .map((control) => [control.dataset.filterPath, control.value.trim()])
  );
  const budgetMin = currentBudgetValue('[data-budget-part="budgetMin"]');
  const budgetMax = currentBudgetValue('[data-budget-part="budgetMax"]');
  const sourceDestinations = destinationSelection
    ? destinationSelection.destinations
    : destinations;
  filteredDestinations = sourceDestinations.filter((destination) =>
    matchesDestination(destination, filters, query, budgetMin, budgetMax)
  );
  currentPage = 1;
  renderCurrentPage();
  updateActiveFilters();
}

function clearFilters() {
  clearDestinationSelection();
  searchInput.value = "";
  filterFields.querySelectorAll("[data-filter-path]").forEach((control) => {
    control.value = "";
  });
  filterFields.querySelectorAll("[data-budget-part]").forEach((control) => {
    control.value = "";
  });
  setMoreFiltersExpanded(false);
  renderDestinations();
}

function setMoreFiltersExpanded(expanded) {
  moreFilters.classList.toggle("is-open", expanded);
  moreFiltersToggle.setAttribute("aria-expanded", String(expanded));
  moreFiltersToggle.innerHTML = `<span aria-hidden="true">${expanded ? "−" : "+"}</span> ${
    expanded ? "Less Filters" : "More Filters"
  }`;
  const additionalControls = additionalFilters.querySelectorAll("select, input");
  additionalControls.forEach((control) => {
    control.inert = !expanded;
  });
}

function setCompactFilterVisibility() {
  filterToggle.hidden = !compactFilters.matches;
  if (!compactFilters.matches) {
    filtersPanel.hidden = false;
  } else {
    compactFiltersOpen = false;
    filtersPanel.hidden = true;
  }
  filterToggle.setAttribute("aria-expanded", String(compactFiltersOpen));
}

function goToPage(page) {
  const totalPages = Math.max(1, Math.ceil(filteredDestinations.length / PAGE_SIZE));
  const nextPage = Math.min(Math.max(1, page), totalPages);
  if (nextPage === currentPage) {
    return;
  }

  currentPage = nextPage;
  renderCurrentPage();
  document.querySelector(".destination-results").scrollIntoView({
    block: "start",
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  });
}

async function loadDestinations() {
  try {
    const response = await fetch(DESTINATIONS_DATA_URL);
    if (!response.ok) {
      throw new Error(`Destination data request failed (${response.status}).`);
    }
    const data = await response.json();
    if (!data || !Array.isArray(data.destinations)) {
      throw new Error("Destination data must contain a destinations array.");
    }
    destinations = data.destinations.filter((destination) => (
      destination && typeof destination.id === "string" && destination.id.trim()
    ));
    if (destinations.length !== data.destinations.length) {
      console.error("Some destination records were skipped because they do not have a stable id.");
    }
    if (!destinations.length) {
      throw new Error("No destinations with stable ids are available.");
    }

    destinations.forEach((destination) => {
      searchableText.set(destination, destinationSearchText(destination));
    });
    buildFilters();
    const requestedDestination = new URLSearchParams(window.location.search).get("destination");
    if (requestedDestination) {
      destinationSelection = getDestinationSelection(requestedDestination);
      selectionLabel.textContent = `Destinations related to ${destinationSelection.label}`;
      selectionContext.hidden = false;
    }
    renderDestinations();
    errorMessage.hidden = true;
  } catch (error) {
    console.error("Unable to load destinations.", error);
    destinationGrid.setAttribute("aria-busy", "false");
    resultCount.textContent = "Destinations are unavailable";
    errorMessage.textContent = "We couldn’t load destinations right now. Please refresh the page to try again.";
    errorMessage.hidden = false;
  }
}

clearSelectionButton.addEventListener("click", () => {
  clearDestinationSelection();
  renderDestinations();
});
searchInput.addEventListener("input", renderDestinations);
filterFields.addEventListener("change", renderDestinations);
filterFields.addEventListener("input", (event) => {
  if (event.target.matches("[data-budget-part], [data-filter-path]")) {
    renderDestinations();
  }
});
clearFiltersButton.addEventListener("click", clearFilters);
moreFiltersToggle.addEventListener("click", () => {
  setMoreFiltersExpanded(moreFiltersToggle.getAttribute("aria-expanded") !== "true");
});
activeFilters.addEventListener("click", (event) => {
  const chip = event.target.closest("[data-clear-filter]");
  if (!chip) {
    return;
  }
  if (chip.dataset.clearFilter === "search") {
    searchInput.value = "";
  } else if (chip.dataset.clearFilter === "budgetMin" || chip.dataset.clearFilter === "budgetMax") {
    filterFields.querySelector(`[data-budget-part="${chip.dataset.clearFilter}"]`).value = "";
  } else {
    filterFields.querySelector(`[data-filter-path="${CSS.escape(chip.dataset.clearFilter)}"]`).value = "";
  }
  renderDestinations();
});
previousPageButton.addEventListener("click", () => {
  goToPage(currentPage - 1);
});
nextPageButton.addEventListener("click", () => {
  goToPage(currentPage + 1);
});
pageNumbers.addEventListener("click", (event) => {
  const button = event.target.closest("[data-page]");
  if (button) {
    goToPage(Number(button.dataset.page));
  }
});
filterToggle.addEventListener("click", () => {
  compactFiltersOpen = !compactFiltersOpen;
  filtersPanel.hidden = !compactFiltersOpen;
  filterToggle.setAttribute("aria-expanded", String(compactFiltersOpen));
});
compactFilters.addEventListener("change", setCompactFilterVisibility);
setMoreFiltersExpanded(false);
setCompactFilterVisibility();
loadDestinations();