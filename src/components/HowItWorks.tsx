import { Search, UserCheck, CreditCard, ThumbsUp } from "lucide-react";

const steps = [
  {
    icon: Search,
    title: "Search Services",
    description: "Browse through thousands of services or search for exactly what you need",
  },
  {
    icon: UserCheck,
    title: "Choose a Seller",
    description: "Compare sellers, reviews, and prices to find your perfect match",
  },
  {
    icon: CreditCard,
    title: "Place Your Order",
    description: "Securely pay for the service and communicate with your seller",
  },
  {
    icon: ThumbsUp,
    title: "Get Results",
    description: "Receive your work and request revisions until you're satisfied",
  },
];

const HowItWorks = () => {
  return (
    <section className="py-16 md:py-24 bg-secondary/30">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            How It Works
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Get your project done in just a few simple steps
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="relative text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6">
                <step.icon className="h-8 w-8" />
              </div>
              
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-[60%] w-[80%] h-[2px] bg-gradient-to-r from-primary/30 to-transparent" />
              )}

              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                {index + 1}
              </div>

              <h3 className="text-xl font-semibold text-foreground mb-3">
                {step.title}
              </h3>
              <p className="text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
