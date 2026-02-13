import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  onFilter?: () => void;
}

const SearchBar = ({ 
  placeholder = "What task do you need help with?", 
  onSearch,
  onFilter 
}: SearchBarProps) => {
  return (
    <div className="flex items-center gap-2 px-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          className="pl-10 bg-secondary border-border h-12 text-foreground placeholder:text-muted-foreground"
          onChange={(e) => onSearch?.(e.target.value)}
        />
      </div>
      <button 
        onClick={onFilter}
        className="p-3 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
      >
        <SlidersHorizontal className="h-5 w-5 text-foreground" />
      </button>
    </div>
  );
};

export default SearchBar;
