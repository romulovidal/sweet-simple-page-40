interface Props { title: string; icon?: React.ReactNode; children: React.ReactNode; }
const Section = ({ title, icon, children }: Props) => (
  <section className="px-4 py-4">
    <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-dark-muted mb-2">
      {icon}
      {title}
    </h3>
    {children}
  </section>
);
export default Section;
