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
  { name: "Graphics & Design", icon: Palette, color: "bg-pink-500/10 text-pink-600" },
  { name: "Programming & Tech", icon: Code, color: "bg-blue-500/10 text-blue-600" },
  { name: "Video & Animation", icon: Video, color: "bg-purple-500/10 text-purple-600" },
  { name: "Writing & Translation", icon: PenTool, color: "bg-orange-500/10 text-orange-600" },
  { name: "Digital Marketing", icon: Megaphone, color: "bg-green-500/10 text-green-600" },
  { name: "Music & Audio", icon: Music, color: "bg-red-500/10 text-red-600" },
  { name: "Photography", icon: Camera, color: "bg-cyan-500/10 text-cyan-600" },
  { name: "Business", icon: FileText, color: "bg-amber-500/10 text-amber-600" },
];

const Categories = () => {
  return (
    <section className="py-16 md:py-24 bg-secondary/30">
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
              className="group flex flex-col items-center gap-4 p-6 bg-card rounded-xl border border-border shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1"
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
