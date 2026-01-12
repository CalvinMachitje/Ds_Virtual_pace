import { 
  Palette, 
  Code, 
  Video, 
  PenTool, 
  Megaphone, 
  Music, 
  Camera,
  FileText 
} from "lucide-react";

const categories = [
  { name: "Graphics & Design", icon: Palette, color: "bg-pink-500/20 text-pink-400" },
  { name: "Programming & Tech", icon: Code, color: "bg-primary/20 text-primary" },
  { name: "Video & Animation", icon: Video, color: "bg-purple-500/20 text-purple-400" },
  { name: "Writing & Translation", icon: PenTool, color: "bg-orange-500/20 text-orange-400" },
  { name: "Digital Marketing", icon: Megaphone, color: "bg-green-500/20 text-green-400" },
  { name: "Music & Audio", icon: Music, color: "bg-red-500/20 text-red-400" },
  { name: "Photography", icon: Camera, color: "bg-cyan-500/20 text-cyan-400" },
  { name: "Business", icon: FileText, color: "bg-amber-500/20 text-amber-400" },
];

const Categories = () => {
  return (
    <section className="py-16 md:py-24 bg-card/50">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Explore Popular Categories
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Browse through our most popular service categories and find the perfect match for your needs
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
          {categories.map((category) => (
            <a
              key={category.name}
              href="#"
              className="group flex flex-col items-center gap-4 p-6 bg-card rounded-xl border border-border shadow-card hover:shadow-card-hover hover:border-primary/50 transition-all duration-300 hover:-translate-y-1"
            >
              <div className={`p-4 rounded-xl ${category.color} transition-transform group-hover:scale-110`}>
                <category.icon className="h-7 w-7" />
              </div>
              <span className="text-sm font-medium text-center text-foreground">
                {category.name}
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Categories;
