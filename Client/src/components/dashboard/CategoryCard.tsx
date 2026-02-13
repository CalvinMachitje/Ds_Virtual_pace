import { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

interface CategoryCardProps {
  icon: LucideIcon;
  title: string;
  count: string;
  slug: string;
}

const CategoryCard = ({ icon: Icon, title, count, slug }: CategoryCardProps) => {
  return (
    <Link 
      to={`/category/${slug}`}
      className="bg-card p-4 rounded-xl hover:bg-card/80 transition-colors border border-border group"
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <h3 className="font-semibold text-foreground text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground">{count}</p>
    </Link>
  );
};

export default CategoryCard;
