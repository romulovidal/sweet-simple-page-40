import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, Library, Loader2, BookOpen, Calendar, Quote, MessageSquare, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import PageHead from "@/components/PageHead";

const RevistasPage = () => {
  const [selectedRevista, setSelectedRevista] = useState<any>(null);
  const [selectedAula, setSelectedAula] = useState<any>(null);

  const { data: revistas, isLoading } = useQuery({
    queryKey: ["revistas-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_revistas")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: aulas, isLoading: isLoadingAulas } = useQuery({
    queryKey: ["revistas-aulas", selectedRevista?.id],
    queryFn: async () => {
      if (!selectedRevista?.id) return [];
      const { data, error } = await supabase
        .from("revista_aulas")
        .select("*")
        .eq("revista_id", selectedRevista.id)
        .order("lesson_number");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedRevista?.id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="pb-20 min-h-screen">
      <PageHead title="Revista de Estudos Bíblicos" description="Aprofunde seu conhecimento na Palavra com nossas lições bíblicas." path="/estudos/revistas" />
      
      <div className="px-5 pt-8 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Library className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Revistas de Estudo</h1>
            <p className="text-sm text-dark-muted">Lições bíblicas para o seu crescimento</p>
          </div>
        </div>

        {!selectedRevista ? (
          <div className="grid gap-4">
            {revistas?.map((revista) => (
              <button
                key={revista.id}
                onClick={() => setSelectedRevista(revista)}
                className="flex items-center gap-4 bg-dark-card p-4 rounded-2xl text-left hover:bg-dark-card-hover transition-colors group"
              >
                {revista.image_url ? (
                  <img src={revista.image_url} alt={revista.title} className="w-20 h-28 object-cover rounded-lg shadow-sm" />
                ) : (
                  <div className="w-20 h-28 bg-primary/5 rounded-lg flex items-center justify-center">
                    <Library className="w-8 h-8 text-primary/40" />
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="font-bold text-lg mb-1">{revista.title}</h2>
                  <p className="text-sm text-dark-muted line-clamp-2 mb-3">{revista.description}</p>
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-none">
                    Ver Lições
                  </Badge>
                </div>
                <ChevronRight className="w-5 h-5 text-dark-muted group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>
        ) : (
          <div>
            <Button 
              variant="ghost" 
              className="mb-6 -ml-2 text-dark-muted hover:text-foreground"
              onClick={() => setSelectedRevista(null)}
            >
              ← Voltar para Revistas
            </Button>

            <div className="mb-8">
              <h2 className="text-xl font-bold mb-2">{selectedRevista.title}</h2>
              <p className="text-sm text-dark-muted">{selectedRevista.description}</p>
            </div>

            {isLoadingAulas ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid gap-3">
                {aulas?.map((aula) => (
                  <Dialog key={aula.id}>
                    <DialogTrigger asChild>
                      <button className="flex items-center justify-between bg-dark-card p-4 rounded-xl text-left hover:bg-dark-card-hover transition-colors group">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                            {aula.lesson_number}
                          </div>
                          <div>
                            <p className="text-xs text-primary font-medium uppercase tracking-wider">Lição {aula.lesson_number}</p>
                            <h3 className="font-bold">{aula.title}</h3>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-dark-muted group-hover:text-primary" />
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl h-[90vh] p-0 overflow-hidden flex flex-col bg-background border-none">
                      <DialogHeader className="p-6 pb-2 shrink-0 border-b">
                        <div className="flex items-center gap-2 text-primary mb-1">
                          <BookOpen className="w-4 h-4" />
                          <span className="text-xs font-bold uppercase tracking-widest">Lição {aula.lesson_number}</span>
                        </div>
                        <DialogTitle className="text-2xl font-bold leading-tight">{aula.title}</DialogTitle>
                        {aula.date && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {aula.date}
                          </div>
                        )}
                      </DialogHeader>
                      <ScrollArea className="flex-1 p-6">
                        <div className="space-y-8 pb-10">
                          {/* Texto Áureo */}
                          {aula.golden_text && (
                            <div className="bg-primary/5 rounded-2xl p-5 border-l-4 border-primary italic relative">
                              <Quote className="absolute -top-3 -left-1 w-8 h-8 text-primary/10 rotate-180" />
                              <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Texto Áureo</h4>
                              <p className="text-lg leading-relaxed">{aula.golden_text}</p>
                            </div>
                          )}

                          {/* Verdade Prática */}
                          {aula.practical_truth && (
                            <div className="bg-secondary/30 rounded-2xl p-5">
                              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Verdade Prática</h4>
                              <p className="text-md leading-relaxed">{aula.practical_truth}</p>
                            </div>
                          )}

                          {/* Leitura Diária */}
                          {aula.daily_readings && Object.keys(aula.daily_readings).length > 0 && (
                            <section>
                              <h4 className="flex items-center gap-2 text-md font-bold mb-4">
                                <Calendar className="w-5 h-5 text-primary" /> Leitura Diária
                              </h4>
                              <div className="grid gap-2">
                                {Object.entries(aula.daily_readings).map(([day, text]) => (
                                  <div key={day} className="flex gap-3 text-sm p-3 rounded-lg bg-muted/50">
                                    <span className="font-bold text-primary min-w-[70px]">{day}:</span>
                                    <span className="text-muted-foreground">{text as string}</span>
                                  </div>
                                ))}
                              </div>
                            </section>
                          )}

                          {/* Leitura Bíblica em Classe */}
                          {aula.bible_reading_in_class && (
                            <section>
                              <h4 className="flex items-center gap-2 text-md font-bold mb-4">
                                <BookOpen className="w-5 h-5 text-primary" /> Leitura Bíblica em Classe
                              </h4>
                              <div className="bg-muted p-5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap">
                                {aula.bible_reading_in_class}
                              </div>
                            </section>
                          )}

                          {/* Introdução */}
                          {aula.introduction && (
                            <section>
                              <h4 className="text-md font-bold mb-3">Introdução</h4>
                              <p className="text-muted-foreground leading-relaxed">{aula.introduction}</p>
                            </section>
                          )}

                          {/* Tópicos */}
                          {aula.topics && Array.isArray(aula.topics) && aula.topics.map((topic: any, idx: number) => (
                            <section key={idx} className="space-y-4">
                              <h4 className="text-lg font-bold text-primary border-b pb-2">{topic.title}</h4>
                              <div className="space-y-4">
                                {topic.points?.map((point: any, pIdx: number) => (
                                  <div key={pIdx} className="space-y-2">
                                    <h5 className="font-bold text-md">{point.title}</h5>
                                    <p className="text-muted-foreground leading-relaxed text-sm">{point.content}</p>
                                  </div>
                                ))}
                              </div>
                            </section>
                          ))}

                          {/* Conclusão */}
                          {aula.conclusion && (
                            <section className="bg-muted/30 p-6 rounded-2xl border-t-2 border-primary/20">
                              <h4 className="text-md font-bold mb-3">Conclusão</h4>
                              <p className="text-muted-foreground leading-relaxed">{aula.conclusion}</p>
                            </section>
                          )}

                          {/* Questões */}
                          {aula.questions && Array.isArray(aula.questions) && aula.questions.length > 0 && (
                            <section>
                              <h4 className="flex items-center gap-2 text-md font-bold mb-4">
                                <MessageSquare className="w-5 h-5 text-primary" /> Questões para Refletir
                              </h4>
                              <div className="space-y-3">
                                {aula.questions.map((q: string, qIdx: number) => (
                                  <div key={qIdx} className="flex gap-3 text-sm p-4 rounded-xl bg-muted/50 border border-muted">
                                    <span className="font-bold text-primary">{qIdx + 1}.</span>
                                    <p>{q}</p>
                                  </div>
                                ))}
                              </div>
                            </section>
                          )}

                          {/* Hinos Sugeridos */}
                          {aula.hinos_sugeridos && (
                            <section className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10">
                              <Music className="w-5 h-5 text-primary" />
                              <div className="text-sm">
                                <span className="font-bold block">Hinos Sugeridos</span>
                                <span className="text-muted-foreground">{aula.hinos_sugeridos}</span>
                              </div>
                            </section>
                          )}
                        </div>
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RevistasPage;