import { useState } from "react";
import { Link } from "react-router-dom";
import { 
  FileText, Phone, Mail, Calendar, Database, 
  Headphones, Search as SearchIcon, Share2 
} from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import SearchBar from "@/components/dashboard/SearchBar";
import TrendingTags from "@/components/dashboard/TrendingTags";
import FeaturedCard from "@/components/dashboard/FeaturedCard";
import CategoryCard from "@/components/dashboard/CategoryCard";
import BottomNav from "@/components/dashboard/BottomNav";

const trendingTags = [
  { label: "Trending", isActive: true },
  { label: "Data Entry" },
  { label: "Virtual Assistant" },
  { label: "Graphic Design" },
  { label: "Web Development" },
];

const featuredSellers = [
  {
    id: "1",
    title: "Admin Masters",
    description: "Professional Executive Support",
    image: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&h=300&fit=crop",
    rating: 4.9,
    isTopRated: true,
  },
  {
    id: "2",
    title: "Quick Email Handler",
    description: "Inbox Zero Guaranteed",
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=300&fit=crop",
    rating: 4.8,
  },
  {
    id: "3",
    title: "Design Pro",
    description: "Creative Solutions Expert",
    image: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&h=300&fit=crop",
    rating: 4.7,
  },
];

const categories = [
  { icon: FileText, title: "Admin Support", count: "120+ Assistants", slug: "admin-support" },
  { icon: Phone, title: "Call Handling", count: "85+ Assistants", slug: "call-handling" },
  { icon: Mail, title: "Email Mgmt", count: "200+ Assistants", slug: "email-management" },
  { icon: Calendar, title: "Scheduling", count: "64+ Assistants", slug: "scheduling" },
  { icon: Database, title: "Data Entry", count: "310+ Assistants", slug: "data-entry" },
  { icon: Headphones, title: "Customer Support", count: "92+ Assistants", slug: "customer-support" },
  { icon: SearchIcon, title: "Web Research", count: "45+ Assistants", slug: "web-research" },
  { icon: Share2, title: "Social Media", count: "150+ Assistants", slug: "social-media" },
];

const BuyerDashboard = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-background pb-24">
      <DashboardHeader userName="Jessica" />
      
      <SearchBar 
        onSearch={setSearchQuery}
        placeholder="What task do you need help with?"
      />
      
      <TrendingTags tags={trendingTags} />

      {/* Featured Section */}
      <section className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Featured VAs</h2>
          <Link to="/featured" className="text-sm text-primary hover:underline">
            See All
          </Link>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {featuredSellers.map((seller) => (
            <FeaturedCard key={seller.id} {...seller} />
          ))}
        </div>
      </section>

      {/* Categories Section */}
      <section className="px-4 py-4">
        <h2 className="text-lg font-semibold text-foreground mb-4">Explore Categories</h2>
        <div className="grid grid-cols-2 gap-3">
          {categories.map((category) => (
            <CategoryCard key={category.slug} {...category} />
          ))}
        </div>
      </section>

      {/* Quick Match CTA */}
      <section className="px-4 py-4">
        <div className="bg-primary rounded-2xl p-6 relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-xl font-bold text-primary-foreground mb-1">
              Need a quick task done?
            </h3>
            <p className="text-primary-foreground/80 text-sm mb-4">
              Get matched with a VA in under 5 minutes.
            </p>
            <button className="px-6 py-2 bg-white text-primary font-semibold rounded-full hover:bg-white/90 transition-colors">
              Try Instant Match
            </button>
          </div>
          <div className="absolute right-0 bottom-0 w-32 h-32 bg-primary-foreground/10 rounded-full -mr-10 -mb-10" />
        </div>
      </section>

      <BottomNav />
    </div>
  );
};

export default BuyerDashboard;
