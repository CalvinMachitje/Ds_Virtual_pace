import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Jennifer Smith",
    role: "CEO, TechStart Inc.",
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&face",
    content: "D's Virtual Space transformed our business. We found amazing developers who delivered beyond our expectations. The platform made the entire process seamless.",
    rating: 5,
  },
  {
    name: "Marcus Johnson",
    role: "Marketing Director",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&face",
    content: "I've tried many freelance platforms, but this one stands out. The quality of work and professionalism of sellers here is unmatched.",
    rating: 5,
  },
  {
    name: "Emily Rodriguez",
    role: "Founder, DesignLab",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&face",
    content: "As a freelancer, this platform has given me access to clients worldwide. The secure payment system and fair policies make it my go-to choice.",
    rating: 5,
  },
];

const Testimonials = () => {
  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            What Our Users Say
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Join thousands of satisfied customers and freelancers
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="relative bg-card rounded-2xl border border-border p-8 shadow-card hover:shadow-card-hover hover:border-primary/50 transition-all duration-300"
            >
              <Quote className="absolute top-6 right-6 h-8 w-8 text-primary/30" />
              
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-star text-star" />
                ))}
              </div>

              <p className="text-foreground mb-6 leading-relaxed">
                "{testimonial.content}"
              </p>

              <div className="flex items-center gap-4">
                <img
                  src={testimonial.image}
                  alt={testimonial.name}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-border"
                />
                <div>
                  <p className="font-semibold text-foreground">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
