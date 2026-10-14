const DESTINATIONS_DATA_URL = "data/destinations.json";

const detailRoot = document.getElementById("destination-detail");
const detailImage = document.getElementById("destination-detail-image");
const detailImageFallback = document.getElementById("destination-detail-image-fallback");
const detailCategory = document.getElementById("destination-detail-category");
const detailName = document.getElementById("destination-detail-name");
const detailLocation = document.getElementById("destination-detail-location");
const detailDescription = document.getElementById("destination-detail-description");
const detailFacts = document.getElementById("destination-detail-facts");
const detailWikipediaLink = document.getElementById("destination-detail-wikipedia");
const detailError = document.getElementById("destination-detail-error");

function addFact(value) {
  if (!value) {
    return;
  }
  const fact = document.createElement("span");
  fact.textContent = value;
  detailFacts.append(fact);
}

async function loadDestination() {
  const destinationId = new URLSearchParams(window.location.search).get("id");
  if (!destinationId) {
    detailError.textContent = "Choose a destination from the discovery page to view it.";
    detailError.hidden = false;
    return;
  }

  try {
    const response = await fetch(DESTINATIONS_DATA_URL);
    if (!response.ok) {
      throw new Error(`Destination data request failed (${response.status}).`);
    }
    const data = await response.json();
    if (!data || !Array.isArray(data.destinations)) {
      throw new Error("Destination data must contain a destinations array.");
    }

    const destination = data.destinations.find((item) => item.id === destinationId);
    if (!destination) {
      detailError.textContent = "That destination could not be found in the current destination data.";
      detailError.hidden = false;
      return;
    }

    const image = destination.images?.find((entry) => typeof entry?.url === "string" && entry.url.trim());
    if (image) {
      detailImage.src = image.url;
      detailImage.alt = `${destination.name || "Destination"} in ${destination.location?.state || "India"}`;
      detailImage.hidden = false;
      detailImage.addEventListener("error", () => {
        detailImage.hidden = true;
        detailImageFallback.hidden = false;
      }, { once: true });
    } else {
      detailImageFallback.hidden = false;
    }
    detailCategory.textContent = Array.isArray(destination.categories)
      ? destination.categories.join(" · ")
      : "";
    detailName.textContent = destination.name || "Untitled destination";
    const wikipediaSearch = new URL("https://en.wikipedia.org/w/index.php");
    wikipediaSearch.searchParams.set("search", destination.name || "Destination");
    detailWikipediaLink.href = wikipediaSearch.href;
    detailWikipediaLink.hidden = false;
    detailLocation.textContent = [destination.location?.district, destination.location?.state]
      .filter(Boolean)
      .join(", ");
    detailDescription.textContent = destination.description || "";

    const budget = destination.budget;
    if (budget && Number.isFinite(Number(budget.min)) && Number.isFinite(Number(budget.max))) {
      const currency = budget.currency || "INR";
      const formatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
      addFact(`${currency} ${formatter.format(Number(budget.min))}–${formatter.format(Number(budget.max))}`);
    }
    addFact(destination.duration);
    addFact(destination.difficulty);
    addFact(destination.crowd ? `${destination.crowd} crowds` : "");
    detailRoot.hidden = false;
    document.title = `TourEase | ${destination.name || "Destination"}`;
  } catch (error) {
    console.error("Unable to load the selected destination.", error);
    detailError.textContent = "We couldn’t load this destination right now. Please return to the discovery page and try again.";
    detailError.hidden = false;
  }
}

loadDestination();
