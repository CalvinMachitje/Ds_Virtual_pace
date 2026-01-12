import GigCard from "./GigCard";

const gigs = [
  {
    image: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=500&h=375&fit=crop",
    sellerImage: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&face",
    sellerName: "Alex Johnson",
    sellerLevel: "Top Rated",
    title: "I will design a modern and professional logo for your brand",
    rating: 4.9,
    reviews: 1247,
    price: 50,
  },
  {
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500&h=375&fit=crop",
    sellerImage: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&face",
    sellerName: "Sarah Miller",
    sellerLevel: "Level 2",
    title: "I will create a responsive WordPress website for your business",
    rating: 4.8,
    reviews: 856,
    price: 150,
  },
  {
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=500&h=375&fit=crop",
    sellerImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&face",
    sellerName: "Mike Chen",
    sellerLevel: "Top Rated",
    title: "I will edit and color grade your video professionally",
    rating: 5.0,
    reviews: 2103,
    price: 75,
  },
  {
    image: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=500&h=375&fit=crop",
    sellerImage: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&face",
    sellerName: "Emma Wilson",
    sellerLevel: "Level 2",
    title: "I will write SEO optimized content for your website or blog",
    rating: 4.9,
    reviews: 634,
    price: 30,
  },
  {
    image: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=500&h=375&fit=crop",
    sellerImage: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&face",
    sellerName: "David Park",
    sellerLevel: "Top Rated",
    title: "I will develop a custom mobile app for iOS and Android",
    rating: 4.9,
    reviews: 892,
    price: 500,
  },
  {
    image: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=500&h=375&fit=crop",
    sellerImage: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&face",
    sellerName: "Lisa Anderson",
    sellerLevel: "Level 1",
    title: "I will create stunning social media graphics and posts",
    rating: 4.7,
    reviews: 423,
    price: 25,
  },
  {
    image: "https://images.unsplash.com/photo-1558403194-611308249627?w=500&h=375&fit=crop",
    sellerImage: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&face",
    sellerName: "James Taylor",
    sellerLevel: "Top Rated",
    title: "I will produce professional voiceover for your project",
    rating: 5.0,
    reviews: 1567,
    price: 100,
  },
  {
    image: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=500&h=375&fit=crop",
    sellerImage: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&face",
    sellerName: "Rachel Green",
    sellerLevel: "Level 2",
    title: "I will design a beautiful UI/UX for your mobile app",
    rating: 4.8,
    reviews: 745,
    price: 200,
  },
];

const FeaturedGigs = () => {
  return (
    <section className="py-16 md:py-24">
      <div className="container">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              Popular Services
            </h2>
            <p className="text-muted-foreground text-lg">
              Explore our most in-demand professional services
            </p>
          </div>
          <a
            href="#"
            className="text-primary font-medium hover:underline underline-offset-4"
          >
            See all services →
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {gigs.map((gig, index) => (
            <GigCard key={index} {...gig} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedGigs;
