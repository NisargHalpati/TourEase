const hero = document.querySelector(".home-hero");
const heroImages = [
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f4/Khardung_La_%28pass%29%2C_Ladakh_Range%2C_North_India%2C_Himalaya.jpg/1920px-Khardung_La_%28pass%29%2C_Ladakh_Range%2C_North_India%2C_Himalaya.jpg",
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/78/NohKaLikai_Falls_V2_Wiki.jpg/1920px-NohKaLikai_Falls_V2_Wiki.jpg",
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a6/Kerala_backwaters%2C_Canal%2C_Palm_trees%2C_India.jpg/1920px-Kerala_backwaters%2C_Canal%2C_Palm_trees%2C_India.jpg",
  "https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=1920&h=1080&q=75&crop=entropy",
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f1/Krishansar_Lake%2C_Sonmarg%2C_Kashmir_valley%2C_India_01.jpg/1920px-Krishansar_Lake%2C_Sonmarg%2C_Kashmir_valley%2C_India_01.jpg",
  "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1920&h=1080&q=75&crop=entropy",
];

// Commons credits: Vyacheslav Argenberg (CC BY 4.0),
// Vikramjit Kakati (CC BY-SA 4.0), Vyacheslav Argenberg (CC BY 4.0),
// and Rohit Sharma (CC BY-SA 4.0), in destination order.
// File pages with full license details:
// commons.wikimedia.org/wiki/File:Khardung_La_(pass),_Ladakh_Range,_North_India,_Himalaya.jpg
// commons.wikimedia.org/wiki/File:NohKaLikai_Falls_V2_Wiki.jpg
// commons.wikimedia.org/wiki/File:Kerala_backwaters,_Canal,_Palm_trees,_India.jpg
// commons.wikimedia.org/wiki/File:Krishansar_Lake,_Sonmarg,_Kashmir_valley,_India_01.jpg
const destinations = [
  {
    name: "Ladakh",
    region: "Ladakh, India",
    image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f4/Khardung_La_%28pass%29%2C_Ladakh_Range%2C_North_India%2C_Himalaya.jpg/1920px-Khardung_La_%28pass%29%2C_Ladakh_Range%2C_North_India%2C_Himalaya.jpg",
    alt: "Mountain road winding through the high-altitude landscape of Ladakh",
  },
  {
    name: "Meghalaya",
    region: "Meghalaya, India",
    image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/78/NohKaLikai_Falls_V2_Wiki.jpg/1920px-NohKaLikai_Falls_V2_Wiki.jpg",
    alt: "Nohkalikai Falls dropping into a green valley in Meghalaya",
  },
  {
    name: "Kerala",
    region: "Kerala, India",
    image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a6/Kerala_backwaters%2C_Canal%2C_Palm_trees%2C_India.jpg/1920px-Kerala_backwaters%2C_Canal%2C_Palm_trees%2C_India.jpg",
    alt: "Palm-lined backwaters in Kerala",
  },
  {
    name: "Kashmir",
    region: "Kashmir, India",
    image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f1/Krishansar_Lake%2C_Sonmarg%2C_Kashmir_valley%2C_India_01.jpg/1920px-Krishansar_Lake%2C_Sonmarg%2C_Kashmir_valley%2C_India_01.jpg",
    alt: "Alpine lake surrounded by mountains in Kashmir",
  },
  {
    name: "Rajasthan",
    region: "Rajasthan, India",
    image: "https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=1920&h=1080&q=75&crop=entropy",
    alt: "Historic architecture and warm sandstone tones in Rajasthan",
  },
];

const destinationGrid = document.querySelector("#top-destinations-grid");

if (destinationGrid) {
  const createDestinationCard = ({ name, region, image, alt }, featured = false) => {
    const link = document.createElement("a");
    link.className = featured
      ? "top-destinations__card top-destinations__card--featured"
      : "top-destinations__card";
    link.href = "destinations.html";
    link.setAttribute("aria-label", `${name}, ${region}`);

    const photo = document.createElement("img");
    photo.className = "top-destinations__image";
    photo.src = image;
    photo.alt = alt;
    photo.loading = "lazy";
    photo.decoding = "async";

    const title = document.createElement("h3");
    title.className = "top-destinations__name";
    title.textContent = name;

    const location = document.createElement("p");
    location.className = "top-destinations__region";
    location.textContent = region;

    const information = document.createElement("div");
    information.className = "top-destinations__information";
    information.append(title, location);
    link.append(photo, information);
    return link;
  };

  const featuredCard = createDestinationCard(destinations[0], true);
  const supportingGrid = document.createElement("div");
  supportingGrid.className = "top-destinations__supporting";
  supportingGrid.append(...destinations.slice(1).map((destination) => createDestinationCard(destination)));
  destinationGrid.append(featuredCard, supportingGrid);
}

if (hero) {
  const imageLayers = Array.from(hero.querySelectorAll(".home-hero__image"));
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const slideshowDelay = 6000;

  if (imageLayers.length === 2) {
    const preloadImage = (src) =>
      new Promise((resolve) => {
        const image = new Image();
        const timeout = window.setTimeout(() => resolve(null), 15000);

        image.onload = () => {
          window.clearTimeout(timeout);
          resolve(src);
        };
        image.onerror = () => {
          window.clearTimeout(timeout);
          resolve(null);
        };
        image.src = src;
      });

    imageLayers[0].style.backgroundImage = `url("${heroImages[0]}")`;

    Promise.all(heroImages.map(preloadImage)).then((results) => {
      const availableImages = results.filter((src) => src !== null);

      if (availableImages.length === 0) {
        return;
      }

      let currentImage = 0;
      let activeLayer = 0;
      imageLayers[activeLayer].style.backgroundImage = `url("${availableImages[currentImage]}")`;

      if (prefersReducedMotion.matches || availableImages.length < 2) {
        return;
      }

      window.setInterval(() => {
        currentImage = (currentImage + 1) % availableImages.length;
        activeLayer = 1 - activeLayer;

        const nextLayer = imageLayers[activeLayer];
        nextLayer.style.backgroundImage = `url("${availableImages[currentImage]}")`;
        nextLayer.classList.add("is-visible");
        imageLayers[1 - activeLayer].classList.remove("is-visible");
      }, slideshowDelay);
    });
  }
}