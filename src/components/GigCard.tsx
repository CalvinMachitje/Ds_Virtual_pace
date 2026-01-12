import { Star, Heart } from "lucide-react";

interface GigCardProps {
  image: string;
  sellerImage: string;
  sellerName: string;
  sellerLevel: string;
  title: string;
  rating: number;
  reviews: number;
  price: number;
}

const GigCard = ({
  image,
  sellerImage,
  sellerName,
  sellerLevel,
  title,
  rating,
  reviews,
  price,
}: GigCardProps) => {
  return (
    <div className="group bg-card rounded-xl border border-border overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300">
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <button className="absolute top-3 right-3 p-2 bg-background/80 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background">
          <Heart className="h-4 w-4 text-muted-foreground hover:text-destructive transition-colors" />
        </button>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <img
            src={sellerImage}
            alt={sellerName}
            className="w-8 h-8 rounded-full object-cover ring-2 ring-border"
          />
          <div>
            <p className="text-sm font-medium text-foreground">{sellerName}</p>
            <p className="text-xs text-primary font-medium">{sellerLevel}</p>
          </div>
        </div>

        <h3 className="text-sm text-foreground line-clamp-2 mb-3 group-hover:text-primary transition-colors">
          {title}
        </h3>

        <div className="flex items-center gap-1 mb-3">
          <Star className="h-4 w-4 fill-star text-star" />
          <span className="text-sm font-semibold text-foreground">{rating}</span>
          <span className="text-sm text-muted-foreground">({reviews})</span>
        </div>

        <div className="pt-3 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Starting at</span>
          <span className="text-lg font-bold text-foreground">${price}</span>
        </div>
      </div>
    </div>
  );
};

export default GigCard;
