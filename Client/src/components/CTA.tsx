import { Button } from "@/components/ui/button";
import { ArrowRight, Users } from "lucide-react";

const CTA = () => {
  return (
    <section className="py-16 md:py-24 bg-card relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5"></div>
      
      <div className="container relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-primary rounded-2xl">
              <Users className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Ready to Start Your Project?
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground mb-8">
            Join millions of businesses and freelancers who trust D's Virtual Space for quality work, on time, every time.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="h-14 px-8 text-base font-semibold">
              Find Services
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-8 text-base font-semibold border-border text-foreground hover:bg-secondary">
              Become a Seller
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
