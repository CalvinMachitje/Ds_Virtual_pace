const stats = [
  { value: "50K+", label: "Active Freelancers" },
  { value: "2M+", label: "Projects Completed" },
  { value: "98%", label: "Customer Satisfaction" },
  { value: "150+", label: "Countries Served" },
];

const Stats = () => {
  return (
    <section className="py-16 bg-primary">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-primary-foreground mb-2">
                {stat.value}
              </div>
              <div className="text-sm md:text-base text-primary-foreground/70">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;
