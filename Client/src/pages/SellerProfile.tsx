import { ArrowLeft, MoreVertical, MessageSquare, Bookmark, Star, CheckCircle, Mail, Calendar, Plane } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const services = [
  { icon: Mail, title: "Email Management" },
  { icon: Calendar, title: "Calendar Scheduling" },
  { icon: Plane, title: "Travel Booking" },
];

const reviews = [
  {
    id: "1",
    name: "Mark T.",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop",
    date: "2 days ago",
    rating: 5,
    comment: "Sarah organized my entire inbox in two days! She is incredibly efficient and easy to communicate with. Highly recommend for any busy professional.",
  },
  {
    id: "2",
    name: "Jessica L.",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
    date: "1 week ago",
    rating: 4,
    comment: "Great experience working with Sarah on my travel plans. Everything was booked perfectly.",
  },
];

const SellerProfile = () => {
  const { id } = useParams();

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4">
        <Link to="/buyer-dashboard" className="p-2 -ml-2">
          <ArrowLeft className="h-6 w-6 text-foreground" />
        </Link>
        <h1 className="font-semibold text-foreground">Worker Profile</h1>
        <button className="p-2 -mr-2">
          <MoreVertical className="h-6 w-6 text-foreground" />
        </button>
      </header>

      {/* Profile Section */}
      <section className="flex flex-col items-center px-4 py-6">
        <div className="relative">
          <Avatar className="h-28 w-28 border-4 border-card">
            <AvatarImage 
              src="https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop" 
              alt="Sarah Jenkins" 
            />
            <AvatarFallback>SJ</AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-1">
            <CheckCircle className="h-5 w-5 text-primary-foreground" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-foreground mt-4">Sarah Jenkins</h2>
        <p className="text-muted-foreground">Executive Virtual Assistant</p>
        
        <span className="inline-flex items-center gap-1 mt-2 px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full">
          <CheckCircle className="h-4 w-4" />
          VERIFIED PRO
        </span>

        <div className="flex gap-3 mt-6 w-full max-w-xs">
          <Button className="flex-1 gap-2" variant="default">
            <MessageSquare className="h-4 w-4" />
            Message
          </Button>
          <Button className="flex-1 gap-2" variant="secondary">
            <Bookmark className="h-4 w-4" />
            Save
          </Button>
        </div>
      </section>

      {/* About Section */}
      <section className="px-4 py-4">
        <h3 className="text-lg font-semibold text-foreground mb-3">About Me</h3>
        <p className="text-muted-foreground leading-relaxed">
          I am a highly organized Executive Assistant with over 5 years of experience managing complex 
          calendars, travel arrangements, and inbox zero strategies for C-suite executives. I thrive in 
          fast-paced environments and pride myself on my proactive problem-solving skills.
        </p>
      </section>

      {/* Services Section */}
      <section className="px-4 py-4">
        <h3 className="text-lg font-semibold text-foreground mb-3">Services Offered</h3>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {services.map((service) => (
            <div 
              key={service.title}
              className="flex-shrink-0 bg-card border border-border rounded-xl p-4 min-w-[140px]"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <service.icon className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">{service.title}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Reviews Section */}
      <section className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Client Reviews</h3>
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
            <span className="font-semibold text-foreground">4.9</span>
            <span className="text-muted-foreground">(124)</span>
          </div>
        </div>
        
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={review.avatar} alt={review.name} />
                    <AvatarFallback>{review.name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground">{review.name}</p>
                    <p className="text-xs text-muted-foreground">{review.date}</p>
                  </div>
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star 
                      key={i}
                      className={`h-4 w-4 ${i < review.rating ? 'fill-[hsl(var(--star))] text-[hsl(var(--star))]' : 'text-muted'}`}
                    />
                  ))}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{review.comment}</p>
            </div>
          ))}
        </div>

        <button className="w-full text-center text-primary text-sm font-medium mt-4 hover:underline">
          View all 124 reviews
        </button>
      </section>

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <p className="text-xs text-muted-foreground">Starting at</p>
            <p className="text-2xl font-bold text-foreground">$30<span className="text-sm font-normal text-muted-foreground">/hr</span></p>
          </div>
          <Link to={`/booking/${id || '1'}`}>
            <Button size="lg" className="px-8">
              Book Now
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SellerProfile;
