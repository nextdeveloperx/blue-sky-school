import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

const categories = ["All", "Events", "Classrooms", "Celebrations"];

const galleryImages = [
  { src: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&h=600&fit=crop", category: "Classrooms", alt: "Students in classroom" },
  { src: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&h=600&fit=crop", category: "Events", alt: "School event" },
  { src: "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?w=800&h=600&fit=crop", category: "Celebrations", alt: "School celebration" },
  { src: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&h=600&fit=crop", category: "Classrooms", alt: "Library" },
  { src: "https://images.unsplash.com/photo-1571260899304-425eee4c7efc?w=800&h=600&fit=crop", category: "Classrooms", alt: "Students learning" },
  { src: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=600&fit=crop", category: "Events", alt: "School activities" },
  { src: "https://images.unsplash.com/photo-1577896851231-70ef18881754?w=800&h=600&fit=crop", category: "Celebrations", alt: "Annual day" },
  { src: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&h=600&fit=crop", category: "Events", alt: "Sports day" },
  { src: "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=800&h=600&fit=crop", category: "Events", alt: "Group activity" },
  { src: "https://images.unsplash.com/photo-1594608661623-aa0bd3a69d98?w=800&h=600&fit=crop", category: "Celebrations", alt: "Prize distribution" },
  { src: "https://images.unsplash.com/photo-1588072432836-e10032774350?w=800&h=600&fit=crop", category: "Classrooms", alt: "Science lab" },
  { src: "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=800&h=600&fit=crop", category: "Events", alt: "Art exhibition" },
];

const Gallery = () => {
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const filteredImages = activeCategory === "All"
    ? galleryImages
    : galleryImages.filter(img => img.category === activeCategory);

  useEffect(() => {
    if (!selectedImage) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedImage(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedImage]);

  return (
    <main className="pt-20">
      {/* Hero Section */}
      <section className="section-padding bg-muted">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="font-heading font-bold text-4xl md:text-5xl text-foreground mb-4">
              Our <span className="text-gradient">Gallery</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Explore moments from our vibrant school life
            </p>
          </motion.div>
        </div>
      </section>

      {/* Filter Tabs */}
      <section className="py-8 border-b border-border">
        <div className="section-container">
          <div className="flex flex-wrap justify-center gap-2">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                aria-pressed={activeCategory === category}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  activeCategory === category
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Grid */}
      <section className="section-padding">
        <div className="section-container">
          <motion.div 
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            <AnimatePresence mode="popLayout">
              {filteredImages.map((image, index) => (
                <motion.button
                  key={image.src}
                  type="button"
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="relative aspect-[4/3] overflow-hidden rounded-xl group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={() => setSelectedImage(image.src)}
                  aria-label={`View larger image: ${image.alt}`}
                >
                  <img
                    src={image.src}
                    alt={image.alt}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="absolute bottom-4 left-4">
                      <span className="text-sm text-white/90 bg-primary/80 px-3 py-1 rounded-full">
                        {image.category}
                      </span>
                    </div>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/90 flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
            role="dialog"
            aria-modal="true"
            aria-label="Gallery image preview"
          >
            <button
              type="button"
              className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-lg"
              onClick={() => setSelectedImage(null)}
              aria-label="Close image preview"
            >
              <X className="w-8 h-8" />
            </button>
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={selectedImage}
              alt="Gallery image"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
};

export default Gallery;
