import { readingPlans } from "@/data/bible";

const PlansPage = () => {
  return (
    <div className="pb-20 min-h-screen">
      <header className="px-5 pt-12 pb-4">
        <h1 className="text-2xl font-bold">Planos de Leitura</h1>
        <p className="text-sm text-[hsl(var(--dark-muted))] mt-1">
          Escolha um plano e cresça na Palavra
        </p>
      </header>

      <div className="px-5 space-y-3">
        {readingPlans.map((plan) => (
          <div
            key={plan.id}
            className="bg-[hsl(var(--dark-card))] rounded-xl p-4 flex items-center gap-4 active:bg-[hsl(var(--dark-card-hover))] transition-colors"
          >
            <div className="w-14 h-14 rounded-xl bg-primary/15 flex items-center justify-center text-2xl flex-shrink-0">
              {plan.image}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{plan.title}</p>
              <p className="text-xs text-[hsl(var(--dark-muted))] mt-0.5">{plan.description}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
                  {plan.days} dias
                </span>
                <span className="text-[10px] text-[hsl(var(--dark-muted))]">{plan.category}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlansPage;
