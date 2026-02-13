import { Star } from "lucide-react";
import { Link } from "react-router-dom";

interface FeaturedCardProps {
  id: string;
  title: string;
  description: string;
  image: string;
  rating: number;
  isTopRated?: boolean;
}

const FeaturedCard = ({ id, title, description, image, rating, isTopRated }: FeaturedCardProps) => {
  return (
    <Link 
      to={`/seller/${id}`}
      className="relative min-w-[200px] rounded-xl overflow-hidden group"
    >
      <div className="aspect-[4/3] relative">
        <img 
          src={image} 
          alt={title} 
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
        
        {isTopRated && (
          <span className="absolute top-3 right-3 px-2 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded">
            TOP RATED
          </span>
        )}
        
        <div className="absolute bottom-3 left-3 right-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">{title}</h3>
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
              <span className="text-sm text-foreground">{rating}</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground truncate">{description}</p>
        </div>
      </div>
    </Link>
  );
};

export default FeaturedCard;
