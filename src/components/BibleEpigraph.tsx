interface BibleEpigraphProps {
  title: string;
  continuesFromPreviousChapter?: boolean;
}

const BibleEpigraph = ({ title, continuesFromPreviousChapter = false }: BibleEpigraphProps) => {
  return (
    <div className="pt-5 pb-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/70">
        {continuesFromPreviousChapter ? "Secao em andamento" : "Secao"}
      </p>
      <h2 className="mt-1 text-base font-bold leading-tight text-[hsl(var(--dark-text))]">
        {title}
      </h2>
    </div>
  );
};

export default BibleEpigraph;
