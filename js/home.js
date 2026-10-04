const hero = document.querySelector(".home-hero");

if (hero) {
  // Commons credits: Vyacheslav Argenberg (CC BY 4.0),
  // Vikramjit Kakati (CC BY-SA 4.0), Vyacheslav Argenberg (CC BY 4.0),
  // and Rohit Sharma (CC BY-SA 4.0), in destination order.
  // File pages with full license details:
  // commons.wikimedia.org/wiki/File:Khardung_La_(pass),_Ladakh_Range,_North_India,_Himalaya.jpg
  // commons.wikimedia.org/wiki/File:NohKaLikai_Falls_V2_Wiki.jpg
  // commons.wikimedia.org/wiki/File:Kerala_backwaters,_Canal,_Palm_trees,_India.jpg
  // commons.wikimedia.org/wiki/File:Krishansar_Lake,_Sonmarg,_Kashmir_valley,_India_01.jpg
  const heroImages = [
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f4/Khardung_La_%28pass%29%2C_Ladakh_Range%2C_North_India%2C_Himalaya.jpg/1920px-Khardung_La_%28pass%29%2C_Ladakh_Range%2C_North_India%2C_Himalaya.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/78/NohKaLikai_Falls_V2_Wiki.jpg/1920px-NohKaLikai_Falls_V2_Wiki.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a6/Kerala_backwaters%2C_Canal%2C_Palm_trees%2C_India.jpg/1920px-Kerala_backwaters%2C_Canal%2C_Palm_trees%2C_India.jpg",
    "https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=1920&h=1080&q=75&crop=entropy",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f1/Krishansar_Lake%2C_Sonmarg%2C_Kashmir_valley%2C_India_01.jpg/1920px-Krishansar_Lake%2C_Sonmarg%2C_Kashmir_valley%2C_India_01.jpg",
    "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1920&h=1080&q=75&crop=entropy",
  ];
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