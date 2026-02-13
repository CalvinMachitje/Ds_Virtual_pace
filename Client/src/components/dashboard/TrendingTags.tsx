import { cn } from "@/lib/utils";

interface Tag {
  label: string;
  isActive?: boolean;
}

interface TrendingTagsProps {
  tags: Tag[];
  onTagClick?: (tag: string) => void;
}

const TrendingTags = ({ tags, onTagClick }: TrendingTagsProps) => {
  return (
    <div className="flex gap-2 px-4 overflow-x-auto py-4 scrollbar-hide">
      {tags.map((tag) => (
        <button
          key={tag.label}
          onClick={() => onTagClick?.(tag.label)}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
            tag.isActive
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-foreground hover:bg-secondary/80"
          )}
        >
          {tag.label}
        </button>
      ))}
    </div>
  );
};

export default TrendingTags;
