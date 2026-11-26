-- ============================================================
-- Plataforma de Batismo — Ministério Atalaias de Betel
-- Inscrição, curso (6 lições), exercícios/prova com sorteio de
-- questões por código, média, recuperação, conversa, certificado
-- PDF com QR de validação, cargo "auxiliar" (só agenda versículos).
-- ============================================================

-- ------------------------------------------------------------
-- 0. Cargo auxiliar no enum app_role (mesmo padrão do super_admin)
-- ------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'super_admin', 'auxiliar');
    ELSE
        BEGIN
            ALTER TYPE public.app_role ADD VALUE 'auxiliar';
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END;
    END IF;
END $$;

-- Helper: o usuário é auxiliar? (comparação por texto — não usa o
-- valor novo do enum, seguro dentro da mesma transação)
CREATE OR REPLACE FUNCTION public.is_auxiliar(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = 'auxiliar'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_auxiliar(uuid) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 1. Configurações do curso (linha única, editável no admin)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.batismo_configuracoes (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  media_minima numeric(4,2) NOT NULL DEFAULT 6.0,
  questoes_por_exercicio integer NOT NULL DEFAULT 5 CHECK (questoes_por_exercicio > 0),
  questoes_prova_final integer NOT NULL DEFAULT 10 CHECK (questoes_prova_final > 0),
  tempo_exercicio_min integer NOT NULL DEFAULT 40 CHECK (tempo_exercicio_min > 0),
  tempo_prova_final_min integer NOT NULL DEFAULT 60 CHECK (tempo_prova_final_min > 0),
  intervalo_liberacao_horas integer NOT NULL DEFAULT 24 CHECK (intervalo_liberacao_horas >= 0),
  inscricoes_abertas boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.batismo_configuracoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Todos leem configuracoes do batismo" ON public.batismo_configuracoes;
CREATE POLICY "Todos leem configuracoes do batismo" ON public.batismo_configuracoes
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins gerenciam configuracoes do batismo" ON public.batismo_configuracoes;
CREATE POLICY "Admins gerenciam configuracoes do batismo" ON public.batismo_configuracoes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.batismo_configuracoes TO authenticated;
GRANT ALL ON public.batismo_configuracoes TO service_role;

-- ------------------------------------------------------------
-- 2. Lições do curso (conteúdo editável no admin)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.batismo_licoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem integer NOT NULL UNIQUE CHECK (ordem > 0),
  titulo text NOT NULL,
  objetivo text NOT NULL DEFAULT '',
  conteudo text NOT NULL DEFAULT '',
  versiculo_chave text NOT NULL DEFAULT '',
  versiculo_referencia text NOT NULL DEFAULT '',
  referencias jsonb NOT NULL DEFAULT '[]'::jsonb,
  frase_para_guardar text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.batismo_licoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Alunos leem licoes ativas do batismo" ON public.batismo_licoes;
CREATE POLICY "Alunos leem licoes ativas do batismo" ON public.batismo_licoes
  FOR SELECT TO authenticated USING (ativo = true OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins gerenciam licoes do batismo" ON public.batismo_licoes;
CREATE POLICY "Admins gerenciam licoes do batismo" ON public.batismo_licoes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.batismo_licoes TO authenticated;
GRANT ALL ON public.batismo_licoes TO service_role;

-- ------------------------------------------------------------
-- 3. Banco de questões com códigos (L1-01, PF-01...)
--    A resposta correta NUNCA é exposta ao aluno: ele só recebe
--    questões pela RPC batismo_iniciar_tentativa (sem a resposta).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.batismo_questoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  licao_id uuid REFERENCES public.batismo_licoes(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('exercicio', 'prova_final')),
  enunciado text NOT NULL,
  alternativas jsonb NOT NULL DEFAULT '[]'::jsonb,
  resposta_correta text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.batismo_questoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins gerenciam questoes do batismo" ON public.batismo_questoes;
CREATE POLICY "Admins gerenciam questoes do batismo" ON public.batismo_questoes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.batismo_questoes TO authenticated;
GRANT ALL ON public.batismo_questoes TO service_role;

-- ------------------------------------------------------------
-- 4. Inscrições dos alunos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.batismo_inscricoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  data_nascimento date NOT NULL,
  whatsapp text,
  whatsapp_responsavel text,
  nome_responsavel text,
  status text NOT NULL DEFAULT 'inscrito'
    CHECK (status IN ('inscrito', 'em_andamento', 'aprovado', 'reprovado', 'conversa_realizada', 'certificado_gerado')),
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  recuperacao_autorizada boolean NOT NULL DEFAULT false,
  conversa_em timestamptz,
  data_batismo date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (whatsapp IS NOT NULL AND length(btrim(whatsapp)) > 0)
    OR (whatsapp_responsavel IS NOT NULL AND length(btrim(whatsapp_responsavel)) > 0)
  )
);

-- Menor de idade sem WhatsApp próprio precisa do WhatsApp do responsável
CREATE OR REPLACE FUNCTION public.batismo_validar_inscricao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.data_nascimento > (CURRENT_DATE - interval '18 years')::date
     AND (NEW.whatsapp IS NULL OR length(btrim(NEW.whatsapp)) = 0)
     AND (NEW.whatsapp_responsavel IS NULL OR length(btrim(NEW.whatsapp_responsavel)) = 0) THEN
    RAISE EXCEPTION 'WHATSAPP_RESPONSAVEL_OBRIGATORIO';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS batismo_validar_inscricao_trg ON public.batismo_inscricoes;
CREATE TRIGGER batismo_validar_inscricao_trg
  BEFORE INSERT OR UPDATE ON public.batismo_inscricoes
  FOR EACH ROW EXECUTE FUNCTION public.batismo_validar_inscricao();

ALTER TABLE public.batismo_inscricoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aluno le a propria inscricao do batismo" ON public.batismo_inscricoes;
CREATE POLICY "Aluno le a propria inscricao do batismo" ON public.batismo_inscricoes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Aluno cria a propria inscricao do batismo" ON public.batismo_inscricoes;
CREATE POLICY "Aluno cria a propria inscricao do batismo" ON public.batismo_inscricoes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins gerenciam inscricoes do batismo" ON public.batismo_inscricoes;
CREATE POLICY "Admins gerenciam inscricoes do batismo" ON public.batismo_inscricoes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.batismo_inscricoes TO authenticated;
GRANT ALL ON public.batismo_inscricoes TO service_role;

-- ------------------------------------------------------------
-- 5. Tentativas (exercício / prova final / recuperação)
--    Criadas e corrigidas só pelas RPCs (SECURITY DEFINER).
--    Após o envio, ficam travadas: aluno não edita nem refaz.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.batismo_tentativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inscricao_id uuid NOT NULL REFERENCES public.batismo_inscricoes(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('exercicio', 'prova_final', 'recuperacao')),
  licao_id uuid REFERENCES public.batismo_licoes(id) ON DELETE SET NULL,
  questoes_sorteadas jsonb NOT NULL DEFAULT '[]'::jsonb,
  iniciada_em timestamptz NOT NULL DEFAULT now(),
  prazo_em timestamptz NOT NULL,
  enviada_em timestamptz,
  status text NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'enviada')),
  nota numeric(5,2),
  acertos integer,
  total integer NOT NULL DEFAULT 0,
  termos_aceitos_em timestamptz,
  duration_ms bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS batismo_tentativas_inscricao_idx
  ON public.batismo_tentativas (inscricao_id, tipo, licao_id);

ALTER TABLE public.batismo_tentativas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aluno le as proprias tentativas do batismo" ON public.batismo_tentativas;
CREATE POLICY "Aluno le as proprias tentativas do batismo" ON public.batismo_tentativas
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.batismo_inscricoes i
      WHERE i.id = batismo_tentativas.inscricao_id AND i.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Admins gerenciam tentativas do batismo" ON public.batismo_tentativas;
CREATE POLICY "Admins gerenciam tentativas do batismo" ON public.batismo_tentativas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.batismo_tentativas TO authenticated;
GRANT ALL ON public.batismo_tentativas TO service_role;

-- ------------------------------------------------------------
-- 6. Respostas de cada tentativa (imutáveis após o envio)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.batismo_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tentativa_id uuid NOT NULL REFERENCES public.batismo_tentativas(id) ON DELETE CASCADE,
  questao_codigo text NOT NULL,
  resposta text NOT NULL,
  correta boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tentativa_id, questao_codigo)
);

ALTER TABLE public.batismo_respostas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aluno le as proprias respostas do batismo" ON public.batismo_respostas;
CREATE POLICY "Aluno le as proprias respostas do batismo" ON public.batismo_respostas
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM public.batismo_tentativas t
      JOIN public.batismo_inscricoes i ON i.id = t.inscricao_id
      WHERE t.id = batismo_respostas.tentativa_id AND i.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Admins leem respostas do batismo" ON public.batismo_respostas;
CREATE POLICY "Admins leem respostas do batismo" ON public.batismo_respostas
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.batismo_respostas TO authenticated;
GRANT ALL ON public.batismo_respostas TO service_role;

-- ------------------------------------------------------------
-- 7. Certificados emitidos (código único AB-AAAA-NNNN)
-- ------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.batismo_certificado_seq START WITH 1;

CREATE TABLE IF NOT EXISTS public.batismo_certificados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inscricao_id uuid NOT NULL UNIQUE REFERENCES public.batismo_inscricoes(id) ON DELETE CASCADE,
  codigo text NOT NULL UNIQUE,
  emitido_em timestamptz NOT NULL DEFAULT now(),
  pdf_path text,
  valido boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.batismo_certificados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aluno le o proprio certificado do batismo" ON public.batismo_certificados;
CREATE POLICY "Aluno le o proprio certificado do batismo" ON public.batismo_certificados
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.batismo_inscricoes i
      WHERE i.id = batismo_certificados.inscricao_id AND i.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Admins gerenciam certificados do batismo" ON public.batismo_certificados;
CREATE POLICY "Admins gerenciam certificados do batismo" ON public.batismo_certificados
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.batismo_certificados TO authenticated;
GRANT ALL ON public.batismo_certificados TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.batismo_certificado_seq TO authenticated, service_role;

-- ------------------------------------------------------------
-- 8. RPCs de sorteio, correção e média (server-side)
-- ------------------------------------------------------------

-- Recalcula o status da inscrição a partir das tentativas enviadas.
-- Média = média das 6 notas de exercício + nota da prova final
-- (se houver recuperação enviada, a nota dela substitui a da prova).
CREATE OR REPLACE FUNCTION public.batismo_recalcular_status(p_inscricao_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg record;
  notas_exercicios numeric[];
  nota_prova numeric;
  media numeric;
  total_licoes integer;
  status_atual text;
BEGIN
  SELECT * INTO cfg FROM public.batismo_configuracoes WHERE id = 1;
  SELECT status INTO status_atual FROM public.batismo_inscricoes WHERE id = p_inscricao_id;

  -- Não regride estados posteriores à aprovação
  IF status_atual IN ('conversa_realizada', 'certificado_gerado') THEN
    RETURN;
  END IF;

  SELECT count(*) INTO total_licoes FROM public.batismo_licoes WHERE ativo = true;

  SELECT array_agg(nota) INTO notas_exercicios
  FROM public.batismo_tentativas
  WHERE inscricao_id = p_inscricao_id AND tipo = 'exercicio' AND status = 'enviada';

  -- Nota da prova: recuperação enviada tem prioridade sobre a prova final
  SELECT nota INTO nota_prova
  FROM public.batismo_tentativas
  WHERE inscricao_id = p_inscricao_id AND tipo = 'recuperacao' AND status = 'enviada'
  ORDER BY enviada_em DESC LIMIT 1;

  IF nota_prova IS NULL THEN
    SELECT nota INTO nota_prova
    FROM public.batismo_tentativas
    WHERE inscricao_id = p_inscricao_id AND tipo = 'prova_final' AND status = 'enviada'
    ORDER BY enviada_em DESC LIMIT 1;
  END IF;

  IF notas_exercicios IS NOT NULL
     AND array_length(notas_exercicios, 1) >= total_licoes
     AND nota_prova IS NOT NULL THEN
    SELECT avg(n) INTO media FROM unnest(notas_exercicios || nota_prova) AS n;
    IF media >= cfg.media_minima THEN
      UPDATE public.batismo_inscricoes
      SET status = 'aprovado', recuperacao_autorizada = false, updated_at = now()
      WHERE id = p_inscricao_id;
    ELSE
      UPDATE public.batismo_inscricoes
      SET status = 'reprovado', updated_at = now()
      WHERE id = p_inscricao_id;
    END IF;
  ELSIF notas_exercicios IS NOT NULL AND array_length(notas_exercicios, 1) > 0 THEN
    UPDATE public.batismo_inscricoes
    SET status = 'em_andamento', updated_at = now()
    WHERE id = p_inscricao_id AND status = 'inscrito';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.batismo_recalcular_status(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.batismo_recalcular_status(uuid) TO service_role;

-- Inicia (ou retoma) uma tentativa: sorteia as questões no servidor,
-- embaralha as alternativas e NUNCA devolve a resposta correta.
CREATE OR REPLACE FUNCTION public.batismo_iniciar_tentativa(
  p_inscricao_id uuid,
  p_tipo text,
  p_licao_id uuid DEFAULT NULL,
  p_termos_aceitos boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  insc record;
  cfg record;
  licao record;
  existente record;
  qtd integer;
  tempo_min integer;
  sorteadas jsonb;
  nova_id uuid;
  prazo timestamptz;
  liberacao timestamptz;
  anterior_ok boolean;
  exercicios_ok integer;
  total_licoes integer;
BEGIN
  IF p_termos_aceitos IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'TERMOS_NAO_ACEITOS';
  END IF;

  SELECT * INTO insc FROM public.batismo_inscricoes WHERE id = p_inscricao_id;
  IF insc IS NULL OR insc.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'INSCRICAO_INVALIDA';
  END IF;

  SELECT * INTO cfg FROM public.batismo_configuracoes WHERE id = 1;

  -- Tentativa já enviada para este tipo/lição? Travada.
  IF EXISTS (
    SELECT 1 FROM public.batismo_tentativas
    WHERE inscricao_id = p_inscricao_id AND tipo = p_tipo
      AND licao_id IS NOT DISTINCT FROM p_licao_id AND status = 'enviada'
  ) THEN
    RAISE EXCEPTION 'TENTATIVA_JA_ENVIADA';
  END IF;

  -- Tentativa em andamento? Retoma (ou fecha com nota 0 se o prazo venceu).
  SELECT * INTO existente FROM public.batismo_tentativas
  WHERE inscricao_id = p_inscricao_id AND tipo = p_tipo
    AND licao_id IS NOT DISTINCT FROM p_licao_id AND status = 'em_andamento'
  ORDER BY iniciada_em DESC LIMIT 1;

  IF existente IS NOT NULL THEN
    IF now() <= existente.prazo_em THEN
      RETURN jsonb_build_object(
        'tentativa_id', existente.id,
        'prazo_em', existente.prazo_em,
        'questoes', existente.questoes_sorteadas
      );
    ELSE
      UPDATE public.batismo_tentativas
      SET status = 'enviada', enviada_em = now(), nota = 0, acertos = 0,
          duration_ms = GREATEST(0, (extract(epoch FROM (existente.prazo_em - existente.iniciada_em)) * 1000)::bigint)
      WHERE id = existente.id;
      PERFORM public.batismo_recalcular_status(p_inscricao_id);
      RAISE EXCEPTION 'TEMPO_ESGOTADO';
    END IF;
  END IF;

  IF p_tipo = 'exercicio' THEN
    SELECT * INTO licao FROM public.batismo_licoes WHERE id = p_licao_id AND ativo = true;
    IF licao IS NULL THEN
      RAISE EXCEPTION 'LICAO_INVALIDA';
    END IF;

    -- Ritmo: lição N libera em iniciado_em + (N-1) * intervalo
    liberacao := insc.iniciado_em + ((licao.ordem - 1) * cfg.intervalo_liberacao_horas) * interval '1 hour';
    IF now() < liberacao THEN
      RAISE EXCEPTION 'LICAO_NAO_LIBERADA';
    END IF;

    -- Lição anterior precisa estar concluída (exercício enviado)
    IF licao.ordem > 1 THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.batismo_tentativas t
        JOIN public.batismo_licoes l ON l.id = t.licao_id
        WHERE t.inscricao_id = p_inscricao_id AND t.tipo = 'exercicio'
          AND t.status = 'enviada' AND l.ordem = licao.ordem - 1
      ) INTO anterior_ok;
      IF NOT anterior_ok THEN
        RAISE EXCEPTION 'LICAO_ANTERIOR_PENDENTE';
      END IF;
    END IF;

    qtd := cfg.questoes_por_exercicio;
    tempo_min := cfg.tempo_exercicio_min;

    SELECT jsonb_agg(q ORDER BY random()) INTO sorteadas FROM (
      SELECT jsonb_build_object(
        'codigo', codigo,
        'enunciado', enunciado,
        'alternativas', (
          SELECT jsonb_agg(alt ORDER BY random())
          FROM jsonb_array_elements_text(alternativas) AS alt
        )
      ) AS q
      FROM public.batismo_questoes
      WHERE ativo = true AND tipo = 'exercicio' AND licao_id = p_licao_id
      ORDER BY random()
      LIMIT qtd
    ) s;

  ELSIF p_tipo IN ('prova_final', 'recuperacao') THEN
    IF p_tipo = 'recuperacao' THEN
      IF NOT insc.recuperacao_autorizada OR insc.status <> 'reprovado' THEN
        RAISE EXCEPTION 'RECUPERACAO_NAO_AUTORIZADA';
      END IF;
    END IF;

    SELECT count(*) INTO total_licoes FROM public.batismo_licoes WHERE ativo = true;
    SELECT count(*) INTO exercicios_ok FROM public.batismo_tentativas
    WHERE inscricao_id = p_inscricao_id AND tipo = 'exercicio' AND status = 'enviada';
    IF exercicios_ok < total_licoes THEN
      RAISE EXCEPTION 'EXERCICIOS_PENDENTES';
    END IF;

    qtd := cfg.questoes_prova_final;
    tempo_min := cfg.tempo_prova_final_min;

    SELECT jsonb_agg(q ORDER BY random()) INTO sorteadas FROM (
      SELECT jsonb_build_object(
        'codigo', codigo,
        'enunciado', enunciado,
        'alternativas', (
          SELECT jsonb_agg(alt ORDER BY random())
          FROM jsonb_array_elements_text(alternativas) AS alt
        )
      ) AS q
      FROM public.batismo_questoes
      WHERE ativo = true AND tipo = 'prova_final'
      ORDER BY random()
      LIMIT qtd
    ) s;
  ELSE
    RAISE EXCEPTION 'TIPO_INVALIDO';
  END IF;

  IF sorteadas IS NULL OR jsonb_array_length(sorteadas) = 0 THEN
    RAISE EXCEPTION 'SEM_QUESTOES_NO_BANCO';
  END IF;

  prazo := now() + tempo_min * interval '1 minute';

  INSERT INTO public.batismo_tentativas (
    inscricao_id, tipo, licao_id, questoes_sorteadas, prazo_em, total, termos_aceitos_em
  ) VALUES (
    p_inscricao_id, p_tipo, p_licao_id, sorteadas, prazo, jsonb_array_length(sorteadas), now()
  ) RETURNING id INTO nova_id;

  RETURN jsonb_build_object(
    'tentativa_id', nova_id,
    'prazo_em', prazo,
    'questoes', sorteadas
  );
END;
$$;

REVOKE ALL ON FUNCTION public.batismo_iniciar_tentativa(uuid, text, uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.batismo_iniciar_tentativa(uuid, text, uuid, boolean) TO authenticated, service_role;

-- Envia e corrige a tentativa no servidor. Depois do envio, travada.
CREATE OR REPLACE FUNCTION public.batismo_enviar_tentativa(
  p_tentativa_id uuid,
  p_respostas jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tent record;
  cfg record;
  acertos_count integer := 0;
  total_q integer;
  nota_final numeric;
  item jsonb;
  resposta_certa text;
  esta_correta boolean;
  dentro_do_prazo boolean;
  media_final numeric;
  notas_exercicios numeric[];
  nota_prova numeric;
  total_licoes integer;
  novo_status text;
BEGIN
  SELECT t.* INTO tent
  FROM public.batismo_tentativas t
  JOIN public.batismo_inscricoes i ON i.id = t.inscricao_id
  WHERE t.id = p_tentativa_id AND i.user_id = auth.uid();

  IF tent IS NULL THEN
    RAISE EXCEPTION 'TENTATIVA_INVALIDA';
  END IF;

  IF tent.status = 'enviada' THEN
    RAISE EXCEPTION 'TENTATIVA_JA_ENVIADA';
  END IF;

  SELECT * INTO cfg FROM public.batismo_configuracoes WHERE id = 1;
  total_q := tent.total;
  -- Tolerância de 5 min para o envio automático ao zerar o cronômetro.
  -- Depois disso, a tentativa é fechada com nota 0.
  dentro_do_prazo := now() <= tent.prazo_em + interval '5 minutes';

  IF dentro_do_prazo THEN
    FOR item IN SELECT * FROM jsonb_array_elements(coalesce(p_respostas, '[]'::jsonb))
    LOOP
      -- Só aceita respostas de questões que foram sorteadas nesta tentativa
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(tent.questoes_sorteadas) AS qs
        WHERE qs->>'codigo' = item->>'codigo'
      ) THEN
        CONTINUE;
      END IF;

      SELECT resposta_correta INTO resposta_certa
      FROM public.batismo_questoes WHERE codigo = item->>'codigo';

      esta_correta := (resposta_certa IS NOT NULL AND resposta_certa = item->>'resposta');
      IF esta_correta THEN
        acertos_count := acertos_count + 1;
      END IF;

      INSERT INTO public.batismo_respostas (tentativa_id, questao_codigo, resposta, correta)
      VALUES (p_tentativa_id, item->>'codigo', coalesce(item->>'resposta', ''), esta_correta)
      ON CONFLICT (tentativa_id, questao_codigo) DO NOTHING;
    END LOOP;
  END IF;

  nota_final := CASE WHEN total_q > 0 THEN round(acertos_count * 10.0 / total_q, 2) ELSE 0 END;

  UPDATE public.batismo_tentativas
  SET status = 'enviada',
      enviada_em = now(),
      nota = nota_final,
      acertos = acertos_count,
      duration_ms = GREATEST(0, (extract(epoch FROM (now() - tent.iniciada_em)) * 1000)::bigint)
  WHERE id = p_tentativa_id;

  PERFORM public.batismo_recalcular_status(tent.inscricao_id);

  -- Média atual (para a tela de resultado)
  SELECT count(*) INTO total_licoes FROM public.batismo_licoes WHERE ativo = true;
  SELECT array_agg(nota) INTO notas_exercicios
  FROM public.batismo_tentativas
  WHERE inscricao_id = tent.inscricao_id AND tipo = 'exercicio' AND status = 'enviada';
  SELECT nota INTO nota_prova
  FROM public.batismo_tentativas
  WHERE inscricao_id = tent.inscricao_id AND tipo = 'recuperacao' AND status = 'enviada'
  ORDER BY enviada_em DESC LIMIT 1;
  IF nota_prova IS NULL THEN
    SELECT nota INTO nota_prova
    FROM public.batismo_tentativas
    WHERE inscricao_id = tent.inscricao_id AND tipo = 'prova_final' AND status = 'enviada'
    ORDER BY enviada_em DESC LIMIT 1;
  END IF;
  IF notas_exercicios IS NOT NULL AND nota_prova IS NOT NULL THEN
    SELECT avg(n) INTO media_final FROM unnest(notas_exercicios || nota_prova) AS n;
  END IF;

  SELECT status INTO novo_status FROM public.batismo_inscricoes WHERE id = tent.inscricao_id;

  RETURN jsonb_build_object(
    'nota', nota_final,
    'acertos', acertos_count,
    'total', total_q,
    'media', media_final,
    'status_inscricao', novo_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.batismo_enviar_tentativa(uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.batismo_enviar_tentativa(uuid, jsonb) TO authenticated, service_role;

-- Admin reserva/cria o certificado (código único AB-AAAA-NNNN).
CREATE OR REPLACE FUNCTION public.batismo_criar_certificado(p_inscricao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  insc record;
  existente record;
  novo_codigo text;
  novo_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'APENAS_ADMIN';
  END IF;

  SELECT * INTO insc FROM public.batismo_inscricoes WHERE id = p_inscricao_id;
  IF insc IS NULL THEN
    RAISE EXCEPTION 'INSCRICAO_INVALIDA';
  END IF;

  SELECT * INTO existente FROM public.batismo_certificados WHERE inscricao_id = p_inscricao_id;
  IF existente IS NOT NULL THEN
    RETURN jsonb_build_object('id', existente.id, 'codigo', existente.codigo, 'pdf_path', existente.pdf_path);
  END IF;

  IF insc.conversa_em IS NULL AND insc.status NOT IN ('conversa_realizada', 'certificado_gerado') THEN
    RAISE EXCEPTION 'CONVERSA_PENDENTE';
  END IF;

  novo_codigo := 'AB-' || to_char(now(), 'YYYY') || '-' ||
                 lpad(nextval('public.batismo_certificado_seq')::text, 4, '0');

  INSERT INTO public.batismo_certificados (inscricao_id, codigo)
  VALUES (p_inscricao_id, novo_codigo)
  RETURNING id INTO novo_id;

  RETURN jsonb_build_object('id', novo_id, 'codigo', novo_codigo, 'pdf_path', NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.batismo_criar_certificado(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.batismo_criar_certificado(uuid) TO authenticated, service_role;

-- Validação pública por código (página /validar-certificado via QR).
-- Retorna só nome, curso, data e validade — nunca o PDF nem dados pessoais.
CREATE OR REPLACE FUNCTION public.validar_certificado(p_codigo text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN c.id IS NULL THEN jsonb_build_object('valido', false)
    ELSE jsonb_build_object(
      'valido', c.valido,
      'nome', i.nome,
      'curso', 'Curso de Preparação para o Batismo',
      'ministerio', 'Ministério Atalaias de Betel',
      'data_conclusao', to_char(c.emitido_em AT TIME ZONE 'America/Fortaleza', 'DD/MM/YYYY'),
      'codigo', c.codigo
    )
  END
  FROM (SELECT 1) AS dummy
  LEFT JOIN public.batismo_certificados c ON upper(c.codigo) = upper(btrim(p_codigo))
  LEFT JOIN public.batismo_inscricoes i ON i.id = c.inscricao_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.validar_certificado(text) FROM public;
GRANT EXECUTE ON FUNCTION public.validar_certificado(text) TO anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 9. Bucket privado de certificados (PDFs + imagem-modelo)
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificados', 'certificados', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admins gerenciam arquivos de certificados" ON storage.objects;
CREATE POLICY "Admins gerenciam arquivos de certificados" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'certificados' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'certificados' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Aluno baixa o proprio certificado" ON storage.objects;
CREATE POLICY "Aluno baixa o proprio certificado" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'certificados'
    AND EXISTS (
      SELECT 1
      FROM public.batismo_certificados c
      JOIN public.batismo_inscricoes i ON i.id = c.inscricao_id
      WHERE c.pdf_path = storage.objects.name AND i.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 10. Cargo auxiliar: só agenda versículos
--     (policies aditivas — não removem o acesso dos admins)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Auxiliar agenda versiculos" ON public.daily_verse_queue;
CREATE POLICY "Auxiliar agenda versiculos" ON public.daily_verse_queue
  FOR ALL TO authenticated
  USING (public.is_auxiliar(auth.uid()))
  WITH CHECK (public.is_auxiliar(auth.uid()));

DROP POLICY IF EXISTS "Auxiliar le configs do versiculo" ON public.admin_settings;
CREATE POLICY "Auxiliar le configs do versiculo" ON public.admin_settings
  FOR SELECT TO authenticated
  USING (
    public.is_auxiliar(auth.uid())
    AND key IN ('daily_verse_version', 'daily_verse_push_time', 'motivational_push_enabled', 'motivational_push_time')
  );

DROP POLICY IF EXISTS "Auxiliar cria configs do versiculo" ON public.admin_settings;
CREATE POLICY "Auxiliar cria configs do versiculo" ON public.admin_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_auxiliar(auth.uid())
    AND key IN ('daily_verse_version', 'daily_verse_push_time', 'motivational_push_enabled', 'motivational_push_time')
  );

DROP POLICY IF EXISTS "Auxiliar atualiza configs do versiculo" ON public.admin_settings;
CREATE POLICY "Auxiliar atualiza configs do versiculo" ON public.admin_settings
  FOR UPDATE TO authenticated
  USING (
    public.is_auxiliar(auth.uid())
    AND key IN ('daily_verse_version', 'daily_verse_push_time', 'motivational_push_enabled', 'motivational_push_time')
  )
  WITH CHECK (
    public.is_auxiliar(auth.uid())
    AND key IN ('daily_verse_version', 'daily_verse_push_time', 'motivational_push_enabled', 'motivational_push_time')
  );

-- ------------------------------------------------------------
-- 11. Cron diário: lembrete ao aluno quando a próxima lição libera
--     (12:00 UTC = 09:00 em America/Fortaleza)
-- ------------------------------------------------------------
DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT jobid INTO existing_job_id FROM cron.job WHERE jobname = 'batismo-lembretes-diario' LIMIT 1;
    IF existing_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(existing_job_id);
    END IF;
    PERFORM cron.schedule(
      'batismo-lembretes-diario',
      '0 12 * * *',
      $cron$select private.edge_call('batismo-notify', jsonb_build_object('mode', 'lembretes'));$cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Cron de lembretes do batismo nao agendado: %', SQLERRM;
END $$;

-- ------------------------------------------------------------
-- 12. Seeds (configuração, lições e banco de questões)
-- ------------------------------------------------------------
-- Seed: configurações padrão (linha única)
insert into public.batismo_configuracoes (id) values (1) on conflict (id) do nothing;

-- Seed: 6 lições do Curso de Preparação para o Batismo (Ministério Atalaias de Betel)
insert into public.batismo_licoes (ordem, titulo, objetivo, conteudo, versiculo_chave, versiculo_referencia, referencias, frase_para_guardar) values (1, 'O que é ser cristão', 'Entender o que é pecado, o que é fé, o que é arrependimento e o que significa nascer de novo.', '### O que é pecado?

Pecado é tudo aquilo que desobedece a Deus: mentir, roubar, odiar, desobedecer aos pais, falar palavrão, guardar mágoa... A Bíblia diz que **todos** pecaram (Romanos 3:23). Não existe ninguém perfeito. E o pecado nos separa de Deus, porque Deus é santo e puro.

### O que é fé?

Fé é confiar em Jesus de verdade. Não é só "acreditar que Deus existe". Fé é entregar a vida a Jesus, confiando que ele morreu na cruz pelos nossos pecados e ressuscitou. A salvação é um **presente** de Deus: não se compra, não se merece fazendo coisas boas. A gente recebe pela fé (Efésios 2:8-9).

### O que é arrependimento?

Arrependimento é mudar de direção. É como andar por uma rua errada, perceber o erro, dar meia-volta e andar na direção certa. Não é só sentir vergonha ou pedir desculpa e continuar igual: é **deixar o pecado e voltar para Deus** (Atos 2:38).

### O que é nascer de novo?

Jesus disse que ninguém pode ver o Reino de Deus se não nascer de novo (João 3:3). Nascer de novo é receber uma vida nova de Deus por dentro: o coração muda, a pessoa vira uma nova criatura (2 Coríntios 5:17). Quem recebe Jesus se torna filho de Deus (João 1:12).

### Na prática

Ser cristão não é ter uma religião nem nascer em família de igreja. Ser cristão é: reconhecer que é pecador, crer em Jesus de todo o coração, se arrepender e entregar a vida a ele. Isso se confessa com a boca e se crê com o coração (Romanos 10:9-10).', 'Se você confessar com a sua boca que Jesus é Senhor e crer em seu coração que Deus o ressuscitou dentre os mortos, será salvo. Pois com o coração se crê para justiça, e com a boca se confessa para salvação.', 'Romanos 10:9-10', '[{"referencia": "João 3:3", "texto": "Ninguém pode ver o Reino de Deus, se não nascer de novo."}, {"referencia": "Efésios 2:8-9", "texto": "Pois vocês são salvos pela graça, por meio da fé, e isto não vem de vocês, é dom de Deus; não por obras, para que ninguém se glorie."}, {"referencia": "Romanos 3:23", "texto": "pois todos pecaram e estão destituídos da glória de Deus"}]'::jsonb, 'Ser cristão é crer em Jesus de coração, se arrepender e nascer de novo.') on conflict (ordem) do nothing;
insert into public.batismo_licoes (ordem, titulo, objetivo, conteudo, versiculo_chave, versiculo_referencia, referencias, frase_para_guardar) values (2, 'O batismo nas águas', 'Entender o que é o batismo, por que se batizar, como ele é feito e por que ele não salva.', '### O que é o batismo?

O batismo nas águas é um **passo de obediência** que Jesus mandou fazer (Mateus 28:19). Quando a pessoa é batizada, ela está **declarando publicamente**: "Eu creio em Jesus, ele é meu Senhor e Salvador, e agora vou viver uma vida nova com ele."

### O batismo salva?

**Não.** Quem salva é Jesus, e a salvação se recebe pela fé (Efésios 2:8-9). O batismo não compra a salvação: ele **mostra** a fé que já existe no coração.

Pense assim: a aliança no dedo não faz o casamento — ela mostra que a pessoa é casada. Do mesmo jeito, o batismo não salva: ele mostra que a pessoa já creu em Jesus.

A prova está na Bíblia: o ladrão crucificado ao lado de Jesus creu nele e ouviu: "Hoje você estará comigo no paraíso" (Lucas 23:42-43). Ele **não foi batizado** — não teve tempo — e mesmo assim foi salvo, porque creu.

### Quem deve ser batizado?

Quem **creu em Jesus e se arrependeu**. No dia de Pentecostes, Pedro disse: "Arrependam-se, e cada um de vocês seja batizado..." (Atos 2:38). E quem aceitou a mensagem foi batizado (Atos 2:41). O oficial etíope perguntou o que impedia seu batismo, e Filipe respondeu: "Você pode, se crê de todo o coração" (Atos 8:37).

Por isso **não batizamos bebês**: bebê ainda não pode crer nem se arrepender. O batismo é para quem já entendeu e decidiu por si mesmo.

### Como é feito o batismo?

Por **imersão**: a pessoa mergulha nas águas. A palavra "batismo" vem de uma palavra grega que significa "mergulhar". Jesus mesmo foi batizado assim: "Assim que Jesus foi batizado, saiu da água" (Mateus 3:16) — ele estava dentro da água.

### O que o batismo representa?

Ele representa a morte e a ressurreição de Jesus — e a nossa também:

- **Ao mergulhar**: a velha vida de pecado fica para trás, como sepultada.
- **Ao sair da água**: começa a vida nova com Jesus.

É o que ensina Romanos 6:3-4 (versículo-chave abaixo).

### Na prática

Batizar-se é dizer para todo mundo: "Eu sou de Jesus." É o primeiro passo público da vida cristã. Não é um ritual mágico nem um costume: é obediência a Jesus e testemunho diante das pessoas.', 'Ou vocês não sabem que todos nós, que fomos batizados em Cristo Jesus, fomos batizados em sua morte? Portanto, fomos sepultados com ele na morte por meio do batismo, a fim de que, assim como Cristo foi ressuscitado dos mortos mediante a glória do Pai, também nós vivamos uma vida nova.', 'Romanos 6:3-4', '[{"referencia": "Atos 2:38", "texto": "Arrependam-se, e cada um de vocês seja batizado em nome de Jesus Cristo para perdão dos seus pecados, e receberão o dom do Espírito Santo."}, {"referencia": "Marcos 16:16", "texto": "Quem crer e for batizado será salvo, mas quem não crer será condenado."}, {"referencia": "Lucas 23:42-43", "texto": "o ladrão na cruz: salvo pela fé, sem batismo."}]'::jsonb, 'O batismo não salva: ele declara para todos que eu creio em Jesus.') on conflict (ordem) do nothing;
insert into public.batismo_licoes (ordem, titulo, objetivo, conteudo, versiculo_chave, versiculo_referencia, referencias, frase_para_guardar) values (3, 'A nova vida depois do batismo', 'Entender como viver depois do batismo: santidade, oração, leitura da Bíblia e comunhão com a igreja.', '### Uma vida nova de verdade

O batismo marca o começo de uma vida nova. A Bíblia diz que quem está em Cristo é **nova criação**: as coisas antigas passaram (2 Coríntios 5:17). Isso não quer dizer que a pessoa nunca mais erra — quer dizer que agora ela vive para Deus e não mais para o pecado.

### O que é santidade?

Santidade é ser **separado para Deus**: viver longe do pecado e perto de Deus. É como um copo limpo, reservado para uso especial. Deus nos chama a procurar "as coisas do alto" (Colossenses 3:1-3): pensar no que agrada a Deus e deixar para trás o que não agrada.

### Oração: conversar com Deus

Orar é conversar com Deus — não é discurso bonito nem fórmula decorada. É falar com o Pai com sinceridade: agradecer, pedir, contar as lutas. A Bíblia diz: "Orem continuamente" (1 Tessalonicenses 5:17). Orar todo dia mantém o coração perto de Deus.

### A Bíblia: a luz do caminho

A Palavra de Deus é como uma lâmpada que ilumina o caminho no escuro (Salmo 119:105). Quem lê a Bíblia aprende como Deus quer que vivamos e fica forte contra o pecado. Como um bebê precisa de leite para crescer, o cristão precisa da Palavra (1 Pedro 2:2).

### Igreja: ninguém caminha sozinho

Deus não nos chamou para viver a fé isolados. A igreja é a família da fé: juntos adoramos, aprendemos e cuidamos uns dos outros. A Bíblia manda não deixar de nos reunir (Hebreus 10:25). Os primeiros cristãos viviam assim: ensino, comunhão, partir do pão e orações (Atos 2:42).

### Na prática

A nova vida se sustenta com hábitos simples: **orar todo dia, ler a Bíblia, ir à igreja e fugir do pecado**. Quando cair, não desista: confesse a Deus, levante-se e continue. Deus perdoa quem se arrepende de verdade.', 'Portanto, já que vocês ressuscitaram com Cristo, procurem as coisas que são do alto, onde Cristo está assentado à direita de Deus. Mantenham o pensamento nas coisas do alto, e não nas coisas terrenas. Pois vocês morreram, e agora a sua vida está escondida com Cristo em Deus.', 'Colossenses 3:1-3', '[{"referencia": "Salmo 119:105", "texto": "A tua palavra é lâmpada que ilumina os meus passos e luz que clareia o meu caminho."}, {"referencia": "Hebreus 10:25", "texto": "Não deixemos de reunir-nos como igreja, segundo o costume de alguns, mas procuremos encorajar-nos uns aos outros..."}, {"referencia": "1 Tessalonicenses 5:17", "texto": "Orem continuamente."}]'::jsonb, 'Vida nova se vive todo dia: orando, lendo a Bíblia e junto com a igreja.') on conflict (ordem) do nothing;
insert into public.batismo_licoes (ordem, titulo, objetivo, conteudo, versiculo_chave, versiculo_referencia, referencias, frase_para_guardar) values (4, 'A Ceia do Senhor', 'Entender o que é a Ceia do Senhor, o que significam o pão e o cálice e como participar dela.', '> **Atenção:** esta lição fala **somente da Ceia**. O batismo foi a Lição 2. São duas coisas diferentes — na Lição 5 a gente compara as duas, uma de cada vez.

### O que é a Ceia do Senhor?

A Ceia é uma **lembrança** que Jesus deixou para a igreja. Na noite em que foi traído, Jesus estava à mesa com os discípulos. Ele pegou o pão, deu graças, partiu e disse: "Isto é o meu corpo, que é dado em favor de vocês; façam isto em memória de mim." Depois pegou o cálice e disse: "Este cálice é a nova aliança no meu sangue; façam isto, sempre que o beberem, em memória de mim" (1 Coríntios 11:23-25).

### O que o pão significa?

O pão representa o **corpo de Jesus**, entregue na cruz por nós. Ao comer do pão, lembramos que Jesus sofreu e morreu em nosso lugar.

### O que o cálice significa?

O cálice representa o **sangue de Jesus**, derramado para o perdão dos nossos pecados. É a "nova aliança": a promessa de Deus de perdoar e salvar todo aquele que crê em Jesus.

### Por que participamos da Ceia?

Por três motivos simples:

1. **Lembrar** a morte de Jesus na cruz ("em memória de mim").
2. **Anunciar** a morte do Senhor até que ele volte (1 Coríntios 11:26).
3. **Celebrar a comunhão**: somos um só corpo em Cristo (1 Coríntios 10:16-17).

### Como participar?

Com **respeito e autoexame**. A Bíblia diz: "Examine-se cada um a si mesmo, e então coma do pão e beba do cálice" (1 Coríntios 11:28). Antes de participar, a pessoa olha para o próprio coração: confessa os pecados a Deus, perdoa quem a ofendeu e se aproxima com sinceridade. Participar de qualquer jeito, sem pensar, é desrespeito (1 Coríntios 11:27).

### Na prática

A Ceia **não salva** ninguém e **não perdoa pecados** automaticamente. Ela é um memorial: um momento sagrado de lembrar o sacrifício de Jesus, agradecer e renovar a comunhão com Deus e com os irmãos.', 'Pois recebi do Senhor o que também lhes entreguei: Na noite em que foi traído, o Senhor Jesus tomou o pão e, tendo dado graças, partiu-o e disse: ''Isto é o meu corpo, que é dado em favor de vocês; façam isto em memória de mim.'' Da mesma forma, depois da ceia, ele tomou o cálice e disse: ''Este cálice é a nova aliança no meu sangue; façam isto, sempre que o beberem, em memória de mim.'' Porque, sempre que comerem deste pão e beberem deste cálice, vocês anunciam a morte do Senhor até que ele venha.', '1 Coríntios 11:23-26', '[{"referencia": "Lucas 22:19-20", "texto": "Jesus institui a Ceia: o pão (seu corpo) e o cálice (nova aliança no seu sangue)."}, {"referencia": "1 Coríntios 11:28", "texto": "Examine-se cada um a si mesmo, e então coma do pão e beba do cálice."}, {"referencia": "1 Coríntios 10:16-17", "texto": "um só pão, um só corpo: a comunhão da igreja."}]'::jsonb, 'A Ceia é a lembrança viva da cruz: pão e cálice que anunciam Jesus.') on conflict (ordem) do nothing;
insert into public.batismo_licoes (ordem, titulo, objetivo, conteudo, versiculo_chave, versiculo_referencia, referencias, frase_para_guardar) values (5, 'Batismo e Ceia: qual é a diferença?', 'Comparar o batismo e a Ceia, um de cada vez, sem confundir os dois.', 'Nas lições anteriores você aprendeu cada um separado. Agora vamos colocá-los lado a lado, com calma.

### Primeiro: o BATISMO

- **O que é:** a declaração pública de fé de quem creu em Jesus.
- **Quantas vezes:** **uma vez só** na vida.
- **Quando:** no **começo** da vida cristã, logo depois de crer e se arrepender.
- **O que mostra:** que a velha vida ficou para trás e a vida nova começou (Romanos 6:3-4).
- **Imagem para lembrar:** é como a **porta de entrada** — você passa por ela uma vez para entrar.

### Depois: a CEIA

- **O que é:** o memorial da morte de Jesus (pão e cálice).
- **Quantas vezes:** **muitas vezes**, durante toda a caminhada.
- **Quando:** ao longo da vida cristã, sempre que a igreja se reúne para celebrá-la.
- **O que mostra:** que lembramos a cruz e anunciamos a volta de Jesus (1 Coríntios 11:26).
- **Imagem para lembrar:** é como a **mesa da família** — você senta nela muitas vezes para comer junto.

### Resumindo, sem confusão

| | Batismo | Ceia |
|---|---|---|
| Quantas vezes | Uma vez só | Muitas vezes |
| Momento | Começo da vida cristã | Durante a caminhada |
| Significado | Declara a fé e a vida nova | Lembra a morte de Jesus |
| Salva? | Não — declara a fé | Não — é memorial |

### O que os dois têm em comum?

Os dois foram **ordenados por Jesus** e os dois **apontam para ele**: o batismo aponta para a morte e ressurreição de Jesus; a Ceia aponta para o corpo e o sangue dele na cruz. Nenhum dos dois salva — quem salva é Jesus, recebido pela fé.', 'Os que aceitaram a mensagem foram batizados, e naquele dia houve um acréscimo de cerca de três mil pessoas. Eles se dedicavam ao ensino dos apóstolos e à comunhão, ao partir do pão e às orações.', 'Atos 2:41-42', '[{"referencia": "Romanos 6:3-4", "texto": "o batismo: sepultados com Cristo, vida nova."}, {"referencia": "1 Coríntios 11:26", "texto": "a Ceia: anunciar a morte do Senhor até que ele venha."}, {"referencia": "Mateus 28:19", "texto": "Jesus manda batizar os que creem."}]'::jsonb, 'Batismo é uma vez, no começo; Ceia é muitas vezes, na caminhada.') on conflict (ordem) do nothing;
insert into public.batismo_licoes (ordem, titulo, objetivo, conteudo, versiculo_chave, versiculo_referencia, referencias, frase_para_guardar) values (6, 'Compromisso com a nova vida', 'Entender o fruto do Espírito, o valor de servir e de testemunhar de Jesus.', '### A vida nova dá fruto

Uma árvore saudável dá frutos. Assim também o cristão: quem vive com Jesus começa a mostrar mudanças no jeito de ser. A Bíblia chama isso de **fruto do Espírito**: "amor, alegria, paz, paciência, amabilidade, bondade, fidelidade, mansidão e domínio próprio" (Gálatas 5:22-23). Esse fruto não nasce de esforço próprio: é o Espírito Santo produzindo em nós.

### Servir: seguir o exemplo de Jesus

Jesus disse que não veio para ser servido, mas para servir (Marcos 10:45). Servir é ajudar os outros com alegria: na igreja (receber visitantes, ajudar na limpeza, tocar, cantar, cuidar das crianças) e fora dela (ajudar um vizinho, visitar um doente, repartir o que tem). Quem serve se parece com Jesus.

### Testemunhar: contar o que Jesus fez

Testemunhar é contar aos outros, com palavras e com atitudes, o que Jesus fez na nossa vida. Jesus mandou: "vão e façam discípulos de todas as nações, batizando-os..." (Mateus 28:19). A nossa vida também fala: "Assim brilhe a luz de vocês diante dos homens, para que vejam as suas boas obras e glorifiquem ao Pai de vocês" (Mateus 5:16).

### Compromisso é todo dia

A vida com Jesus não é uma fase que passa: é uma caminhada diária. Haverá dias difíceis e tentações, mas Deus nunca abandona os seus: "E eu estarei sempre com vocês, até o fim dos tempos" (Mateus 28:20).

### Na prática

Compromisso com a nova vida é: **frutificar** (deixar o Espírito mudar o caráter), **servir** (ajudar na igreja e fora dela) e **testemunhar** (contar de Jesus). Quem se batiza assume esse compromisso diante de Deus e das pessoas.', 'Mas o fruto do Espírito é: amor, alegria, paz, paciência, amabilidade, bondade, fidelidade, mansidão e domínio próprio. Contra essas coisas não há lei.', 'Gálatas 5:22-23', '[{"referencia": "Mateus 28:19-20", "texto": "Portanto, vão e façam discípulos de todas as nações, batizando-os em nome do Pai e do Filho e do Espírito Santo, ensinando-os a obedecer a tudo o que eu lhes ordenei. E eu estarei sempre com vocês, até o fim dos tempos."}, {"referencia": "Marcos 10:45", "texto": "Pois nem mesmo o Filho do homem veio para ser servido, mas para servir e dar a sua vida em resgate por muitos."}, {"referencia": "Mateus 5:16", "texto": "Assim brilhe a luz de vocês diante dos homens, para que vejam as suas boas obras e glorifiquem ao Pai de vocês, que está nos céus."}]'::jsonb, 'Nova vida dá fruto, serve e testemunha: assim se parece com Jesus.') on conflict (ordem) do nothing;

-- Seed: banco de 102 questões com códigos (L1-01..L6-12, PF-01..PF-30)
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L1-01', (select id from public.batismo_licoes where ordem = 1), 'exercicio', 'O que é pecado?', '["Só crimes graves", "Tudo que desobedece a Deus", "Só mentira", "Erro sem querer"]'::jsonb, 'Tudo que desobedece a Deus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L1-02', (select id from public.batismo_licoes where ordem = 1), 'exercicio', 'Como somos salvos?', '["Fazendo muitas boas obras", "Indo à igreja todo domingo", "Pela graça de Deus, por meio da fé em Jesus", "Sendo batizado"]'::jsonb, 'Pela graça de Deus, por meio da fé em Jesus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L1-03', (select id from public.batismo_licoes where ordem = 1), 'exercicio', 'O que é arrependimento?', '["Mudar de direção: deixar o pecado e voltar para Deus", "Sentir vergonha do que fez", "Pedir desculpa e continuar igual", "Chorar bastante"]'::jsonb, 'Mudar de direção: deixar o pecado e voltar para Deus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L1-04', (select id from public.batismo_licoes where ordem = 1), 'exercicio', 'O que significa "nascer de novo"?', '["Nascer outra vez da mãe", "Mudar de igreja", "Fazer aniversário", "Receber uma vida nova de Deus"]'::jsonb, 'Receber uma vida nova de Deus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L1-05', (select id from public.batismo_licoes where ordem = 1), 'exercicio', 'Segundo Romanos 10:9, para ser salvo é preciso...', '["Ser batizado primeiro", "Confessar Jesus como Senhor e crer que Deus o ressuscitou", "Dar o dízimo", "Nascer em família cristã"]'::jsonb, 'Confessar Jesus como Senhor e crer que Deus o ressuscitou') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L1-06', (select id from public.batismo_licoes where ordem = 1), 'exercicio', 'Segundo Romanos 3:23, quem já pecou?', '["Só os adultos", "Só quem comete crimes", "Todos", "Só quem não vai à igreja"]'::jsonb, 'Todos') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L1-07', (select id from public.batismo_licoes where ordem = 1), 'exercicio', 'O que o pecado faz com a nossa relação com Deus?', '["Separa a gente de Deus", "Aproxima a gente de Deus", "Não muda nada", "Faz Deus gostar mais da gente"]'::jsonb, 'Separa a gente de Deus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L1-08', (select id from public.batismo_licoes where ordem = 1), 'exercicio', 'Fé é só acreditar que Deus existe?', '["Sim, basta acreditar que ele existe", "Sim, se a pessoa for à igreja", "Não; fé é fazer muitas boas obras", "Não; fé é confiar em Jesus e entregar a vida a ele"]'::jsonb, 'Não; fé é confiar em Jesus e entregar a vida a ele') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L1-09', (select id from public.batismo_licoes where ordem = 1), 'exercicio', 'A salvação é comparada a quê na lição?', '["Um prêmio que a gente conquista", "Um presente de Deus", "Um salário pelo trabalho", "Um troféu de quem é bonzinho"]'::jsonb, 'Um presente de Deus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L1-10', (select id from public.batismo_licoes where ordem = 1), 'exercicio', 'Quem recebe Jesus se torna o quê (João 1:12)?', '["Pastor da igreja", "Uma pessoa famosa", "Alguém que nunca mais erra", "Filho de Deus"]'::jsonb, 'Filho de Deus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L1-11', (select id from public.batismo_licoes where ordem = 1), 'exercicio', '"Nova criatura" (2 Coríntios 5:17) quer dizer que a pessoa...', '["Recebe uma vida nova de Deus", "Muda de nome", "Muda de cidade", "Nunca mais sente tristeza"]'::jsonb, 'Recebe uma vida nova de Deus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L1-12', (select id from public.batismo_licoes where ordem = 1), 'exercicio', 'Ser cristão é...', '["Ter uma religião", "Crer em Jesus de coração, se arrepender e entregar a vida a ele", "Nascer em família de igreja", "Ir à igreja de vez em quando"]'::jsonb, 'Crer em Jesus de coração, se arrepender e entregar a vida a ele') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L2-01', (select id from public.batismo_licoes where ordem = 2), 'exercicio', 'O batismo salva a pessoa?', '["Sim, é o batismo que salva", "Só salva adultos", "Não; quem salva é a fé em Jesus, e o batismo declara essa fé", "Só salva se for no rio"]'::jsonb, 'Não; quem salva é a fé em Jesus, e o batismo declara essa fé') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L2-02', (select id from public.batismo_licoes where ordem = 2), 'exercicio', 'Quem deve ser batizado?', '["Quem crê em Jesus e se arrependeu", "Bebês", "Qualquer pessoa, mesmo sem crer", "Só quem nunca pecou"]'::jsonb, 'Quem crê em Jesus e se arrependeu') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L2-03', (select id from public.batismo_licoes where ordem = 2), 'exercicio', 'Como era o batismo na Bíblia?', '["Pingando água na cabeça", "Com óleo na testa", "Sem água nenhuma", "Por imersão, mergulhando nas águas"]'::jsonb, 'Por imersão, mergulhando nas águas') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L2-04', (select id from public.batismo_licoes where ordem = 2), 'exercicio', 'O que o batismo representa (Romanos 6)?', '["Um banho comum", "Morrer para o pecado e ressuscitar para uma vida nova", "Entrar para um clube", "Um costume antigo sem sentido"]'::jsonb, 'Morrer para o pecado e ressuscitar para uma vida nova') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L2-05', (select id from public.batismo_licoes where ordem = 2), 'exercicio', 'O ladrão na cruz foi salvo...', '["Porque foi batizado", "Porque fez boas obras", "Sem batismo, somente pela fé em Jesus", "Porque era religioso"]'::jsonb, 'Sem batismo, somente pela fé em Jesus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L2-06', (select id from public.batismo_licoes where ordem = 2), 'exercicio', 'Quem mandou batizar os que creem (Mateus 28:19)?', '["Moisés", "Jesus", "O apóstolo Paulo", "A igreja antiga"]'::jsonb, 'Jesus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L2-07', (select id from public.batismo_licoes where ordem = 2), 'exercicio', 'O batismo é um passo de quê?', '["Sorte", "Medo", "Obediência a Jesus", "Costume da família"]'::jsonb, 'Obediência a Jesus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L2-08', (select id from public.batismo_licoes where ordem = 2), 'exercicio', 'Na comparação da lição, a aliança no dedo...', '["Faz o casamento acontecer", "É só um enfeite sem sentido", "Salva a pessoa", "Mostra que a pessoa é casada, mas não faz o casamento"]'::jsonb, 'Mostra que a pessoa é casada, mas não faz o casamento') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L2-09', (select id from public.batismo_licoes where ordem = 2), 'exercicio', 'Por que não batizamos bebês?', '["Porque bebê ainda não pode crer nem se arrepender", "Porque bebê não gosta de água", "Porque a igreja não quer", "Porque bebê já nasceu salvo"]'::jsonb, 'Porque bebê ainda não pode crer nem se arrepender') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L2-10', (select id from public.batismo_licoes where ordem = 2), 'exercicio', 'A palavra "batismo" vem de uma palavra grega que significa...', '["Molhar a cabeça", "Mergulhar", "Lavar as mãos", "Entrar na igreja"]'::jsonb, 'Mergulhar') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L2-11', (select id from public.batismo_licoes where ordem = 2), 'exercicio', 'Ao mergulhar nas águas, o batismo representa...', '["Um banho para ficar limpo", "Receber um prêmio", "A velha vida de pecado ficando para trás, como sepultada", "Entrar para a igreja como sócio"]'::jsonb, 'A velha vida de pecado ficando para trás, como sepultada') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L2-12', (select id from public.batismo_licoes where ordem = 2), 'exercicio', 'O que Filipe respondeu ao oficial etíope que queria ser batizado (Atos 8:37)?', '["\"Você precisa esperar um ano\"", "\"Você precisa ser rico\"", "\"Você precisa nascer em família cristã\"", "\"Você pode, se crê de todo o coração\""]'::jsonb, '"Você pode, se crê de todo o coração"') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L3-01', (select id from public.batismo_licoes where ordem = 3), 'exercicio', 'Depois do batismo, a vida nova significa...', '["Nunca mais errar na vida", "Não precisar mais da igreja", "Ficar rico", "Viver para Deus, deixando o pecado para trás"]'::jsonb, 'Viver para Deus, deixando o pecado para trás') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L3-02', (select id from public.batismo_licoes where ordem = 3), 'exercicio', 'Para que serve a oração?', '["Para fazer uma lista de compras para Deus", "Para conversar com Deus", "Para falar bonito na igreja", "Para impressionar os outros"]'::jsonb, 'Para conversar com Deus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L3-03', (select id from public.batismo_licoes where ordem = 3), 'exercicio', 'No Salmo 119:105, a Bíblia é comparada a quê?', '["Lâmpada e luz para o caminho", "Espada e escudo", "Comida e bebida", "Casa e telhado"]'::jsonb, 'Lâmpada e luz para o caminho') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L3-04', (select id from public.batismo_licoes where ordem = 3), 'exercicio', 'Por que ir à igreja?', '["Por obrigação, sem vontade", "Para mostrar roupa nova", "Para adorar a Deus e fortalecer uns aos outros", "Não precisa ir"]'::jsonb, 'Para adorar a Deus e fortalecer uns aos outros') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L3-05', (select id from public.batismo_licoes where ordem = 3), 'exercicio', '"Santidade" quer dizer...', '["Ser perfeito, sem nenhum erro", "Ser separado para Deus, longe do pecado", "Usar roupa diferente dos outros", "Não falar com ninguém"]'::jsonb, 'Ser separado para Deus, longe do pecado') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L3-06', (select id from public.batismo_licoes where ordem = 3), 'exercicio', 'Quem está em Cristo é... (2 Coríntios 5:17)', '["Uma pessoa famosa", "Nova criação: as coisas antigas passaram", "Alguém que nunca mais erra", "Um anjo"]'::jsonb, 'Nova criação: as coisas antigas passaram') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L3-07', (select id from public.batismo_licoes where ordem = 3), 'exercicio', 'Ter uma vida nova quer dizer que a pessoa nunca mais erra?', '["Sim, nunca mais erra", "Sim, se for batizada", "Não; quer dizer que agora ela vive para Deus e não mais para o pecado", "Não; quer dizer que ela pode pecar à vontade"]'::jsonb, 'Não; quer dizer que agora ela vive para Deus e não mais para o pecado') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L3-08', (select id from public.batismo_licoes where ordem = 3), 'exercicio', 'Segundo Colossenses 3:1-3, devemos procurar e manter o pensamento em quê?', '["Nas coisas do alto", "Nas coisas terrenas", "Em ficar rico", "Em agradar todo mundo"]'::jsonb, 'Nas coisas do alto') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L3-09', (select id from public.batismo_licoes where ordem = 3), 'exercicio', 'O que a Bíblia manda sobre oração em 1 Tessalonicenses 5:17?', '["Orar só no domingo", "Orar só quando estiver triste", "Orar uma vez por mês", "Orem continuamente"]'::jsonb, 'Orem continuamente') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L3-10', (select id from public.batismo_licoes where ordem = 3), 'exercicio', 'Como um bebê precisa de leite para crescer, o cristão precisa de quê (1 Pedro 2:2)?', '["De dinheiro", "Da Palavra de Deus", "De elogios", "De sorte"]'::jsonb, 'Da Palavra de Deus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L3-11', (select id from public.batismo_licoes where ordem = 3), 'exercicio', 'Os primeiros cristãos se dedicavam a quê (Atos 2:42)?', '["A festas e passeios", "A ficar em casa sozinhos", "Ao ensino, à comunhão, ao partir do pão e às orações", "A discutir uns com os outros"]'::jsonb, 'Ao ensino, à comunhão, ao partir do pão e às orações') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L3-12', (select id from public.batismo_licoes where ordem = 3), 'exercicio', 'Quando o cristão cai e peca, o que ele deve fazer?', '["Desistir de Deus", "Esconder o pecado de todo mundo", "Culpar os outros", "Confessar a Deus, levantar-se e continuar"]'::jsonb, 'Confessar a Deus, levantar-se e continuar') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L4-01', (select id from public.batismo_licoes where ordem = 4), 'exercicio', 'O que é a Ceia do Senhor?', '["Uma festa da igreja", "Um memorial da morte de Jesus", "Um lanche depois do culto", "Um batismo diferente"]'::jsonb, 'Um memorial da morte de Jesus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L4-02', (select id from public.batismo_licoes where ordem = 4), 'exercicio', 'O pão da Ceia representa...', '["A comida do deserto", "Um símbolo sem sentido", "A igreja reunida", "O corpo de Jesus dado por nós"]'::jsonb, 'O corpo de Jesus dado por nós') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L4-03', (select id from public.batismo_licoes where ordem = 4), 'exercicio', 'O cálice da Ceia representa...', '["A nova aliança no sangue de Jesus", "Vinho comum", "A água do batismo", "A alegria da festa"]'::jsonb, 'A nova aliança no sangue de Jesus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L4-04', (select id from public.batismo_licoes where ordem = 4), 'exercicio', 'Antes de participar da Ceia, a Bíblia manda...', '["Jejuar uma semana", "Vestir roupa branca", "Examinar a si mesmo", "Confessar tudo ao pastor"]'::jsonb, 'Examinar a si mesmo') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L4-05', (select id from public.batismo_licoes where ordem = 4), 'exercicio', 'Quem instituiu a Ceia do Senhor?', '["O apóstolo Paulo", "Jesus, na noite em que foi traído", "A igreja antiga", "Moisés"]'::jsonb, 'Jesus, na noite em que foi traído') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L4-06', (select id from public.batismo_licoes where ordem = 4), 'exercicio', 'Quando Jesus disse "façam isto em memória de mim", ele quis dizer que a Ceia serve para...', '["Lembrar a morte de Jesus", "Matar a fome", "Fazer festa", "Batizar de novo"]'::jsonb, 'Lembrar a morte de Jesus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L4-07', (select id from public.batismo_licoes where ordem = 4), 'exercicio', 'A "nova aliança" no cálice é...', '["Um contrato de compra", "A promessa de Deus de perdoar e salvar quem crê em Jesus", "Um costume antigo", "Uma festa de casamento"]'::jsonb, 'A promessa de Deus de perdoar e salvar quem crê em Jesus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L4-08', (select id from public.batismo_licoes where ordem = 4), 'exercicio', 'Segundo 1 Coríntios 11:26, ao participar da Ceia nós anunciamos...', '["A nossa própria bondade", "A festa da igreja", "A morte do Senhor até que ele venha", "O dia do batismo"]'::jsonb, 'A morte do Senhor até que ele venha') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L4-09', (select id from public.batismo_licoes where ordem = 4), 'exercicio', 'A Ceia salva ou perdoa pecados automaticamente?', '["Sim, ela salva", "Sim, ela perdoa tudo sozinha", "Só salva quem come do pão", "Não; ela é um memorial da morte de Jesus"]'::jsonb, 'Não; ela é um memorial da morte de Jesus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L4-10', (select id from public.batismo_licoes where ordem = 4), 'exercicio', 'Antes de participar da Ceia, além de examinar a si mesmo, a pessoa deve...', '["Confessar os pecados a Deus e perdoar quem a ofendeu", "Comprar roupa nova", "Jejuar uma semana", "Falar com todo mundo da igreja"]'::jsonb, 'Confessar os pecados a Deus e perdoar quem a ofendeu') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L4-11', (select id from public.batismo_licoes where ordem = 4), 'exercicio', 'Participar da Ceia de qualquer jeito, sem pensar, é... (1 Coríntios 11:27)', '["Normal", "Desrespeito", "O certo a fazer", "Um costume bonito"]'::jsonb, 'Desrespeito') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L4-12', (select id from public.batismo_licoes where ordem = 4), 'exercicio', 'Na Ceia, a igreja é... (1 Coríntios 10:16-17)', '["Um grupo de estranhos", "Um clube social", "Um só corpo em Cristo", "Uma empresa"]'::jsonb, 'Um só corpo em Cristo') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L5-01', (select id from public.batismo_licoes where ordem = 5), 'exercicio', 'Quantas vezes a pessoa é batizada?', '["Uma vez só", "Todo ano", "Todo mês", "Quando quiser"]'::jsonb, 'Uma vez só') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L5-02', (select id from public.batismo_licoes where ordem = 5), 'exercicio', 'Quantas vezes participamos da Ceia?', '["Uma vez só", "Muitas vezes, durante a caminhada", "Nunca", "Só no dia do batismo"]'::jsonb, 'Muitas vezes, durante a caminhada') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L5-03', (select id from public.batismo_licoes where ordem = 5), 'exercicio', 'O batismo marca...', '["O meio da caminhada", "O fim da vida cristã", "Um feriado da igreja", "O começo da vida nova com Jesus"]'::jsonb, 'O começo da vida nova com Jesus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L5-04', (select id from public.batismo_licoes where ordem = 5), 'exercicio', 'A Ceia serve para...', '["Salvar a pessoa", "Batizar a pessoa de novo", "Lembrar a morte de Jesus e anunciar que ele voltará", "Perdoar pecados automaticamente"]'::jsonb, 'Lembrar a morte de Jesus e anunciar que ele voltará') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L5-05', (select id from public.batismo_licoes where ordem = 5), 'exercicio', 'Qual frase está certa?', '["Batismo é uma vez (começo); Ceia se repete (caminhada)", "Batismo e Ceia são a mesma coisa", "Ceia é uma vez; batismo se repete", "Nenhum dos dois importa"]'::jsonb, 'Batismo é uma vez (começo); Ceia se repete (caminhada)') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L5-06', (select id from public.batismo_licoes where ordem = 5), 'exercicio', 'Na lição, o batismo é comparado a quê?', '["À mesa da família", "À porta de entrada", "A uma festa", "A um prêmio"]'::jsonb, 'À porta de entrada') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L5-07', (select id from public.batismo_licoes where ordem = 5), 'exercicio', 'Na lição, a Ceia é comparada a quê?', '["À porta de entrada", "A um banho", "À mesa da família", "A uma corrida"]'::jsonb, 'À mesa da família') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L5-08', (select id from public.batismo_licoes where ordem = 5), 'exercicio', 'O que o batismo e a Ceia têm em comum?', '["Os dois salvam a pessoa", "Os dois são a mesma coisa", "Nenhum dos dois foi ordenado por Jesus", "Os dois foram ordenados por Jesus e apontam para ele"]'::jsonb, 'Os dois foram ordenados por Jesus e apontam para ele') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L5-09', (select id from public.batismo_licoes where ordem = 5), 'exercicio', 'Algum dos dois (batismo ou Ceia) salva a pessoa?', '["Não; quem salva é Jesus, recebido pela fé", "Sim, o batismo salva", "Sim, a Ceia salva", "Os dois salvam juntos"]'::jsonb, 'Não; quem salva é Jesus, recebido pela fé') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L5-10', (select id from public.batismo_licoes where ordem = 5), 'exercicio', 'Em Atos 2, qual foi a ordem das coisas?', '["Primeiro a Ceia, depois o batismo", "Primeiro creram e foram batizados; depois se dedicavam ao partir do pão", "Batismo e Ceia no mesmo momento", "Nenhum dos dois aconteceu"]'::jsonb, 'Primeiro creram e foram batizados; depois se dedicavam ao partir do pão') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L5-11', (select id from public.batismo_licoes where ordem = 5), 'exercicio', 'O batismo mostra que...', '["A pessoa ficou rica", "A pessoa nunca mais vai pecar", "A velha vida ficou para trás e a vida nova começou", "A pessoa entrou para um clube"]'::jsonb, 'A velha vida ficou para trás e a vida nova começou') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L5-12', (select id from public.batismo_licoes where ordem = 5), 'exercicio', 'A Ceia mostra que...', '["Lembramos a cruz e anunciamos a volta de Jesus", "A pessoa foi batizada de novo", "A igreja está em festa", "Os pecados foram perdoados automaticamente"]'::jsonb, 'Lembramos a cruz e anunciamos a volta de Jesus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L6-01', (select id from public.batismo_licoes where ordem = 6), 'exercicio', 'O fruto do Espírito inclui...', '["Riqueza e fama", "Poder e força", "Amor, alegria, paz, paciência...", "Sorte e sucesso"]'::jsonb, 'Amor, alegria, paz, paciência...') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L6-02', (select id from public.batismo_licoes where ordem = 6), 'exercicio', '"Servir" na igreja significa...', '["Ajudar os outros, como Jesus fez", "Ser servido pelos outros", "Mandar nas pessoas", "Só assistir ao culto"]'::jsonb, 'Ajudar os outros, como Jesus fez') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L6-03', (select id from public.batismo_licoes where ordem = 6), 'exercicio', 'Testemunhar é...', '["Discutir religião com todo mundo", "Falar mal de outras igrejas", "Guardar a fé só para si", "Contar aos outros o que Jesus fez na nossa vida"]'::jsonb, 'Contar aos outros o que Jesus fez na nossa vida') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L6-04', (select id from public.batismo_licoes where ordem = 6), 'exercicio', 'Em Mateus 28:19-20, Jesus mandou...', '["Ficar em casa esperando", "Fazer discípulos e batizar", "Construir templos grandes", "Não fazer nada"]'::jsonb, 'Fazer discípulos e batizar') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L6-05', (select id from public.batismo_licoes where ordem = 6), 'exercicio', 'A vida nova com Jesus é como...', '["Uma corrida de um dia só", "Um prêmio guardado na gaveta", "Uma caminhada diária com Jesus", "Uma fase que logo passa"]'::jsonb, 'Uma caminhada diária com Jesus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L6-06', (select id from public.batismo_licoes where ordem = 6), 'exercicio', 'O fruto do Espírito nasce de quê?', '["Do esforço próprio da pessoa", "Da sorte", "Do Espírito Santo produzindo em nós", "De nascer em família cristã"]'::jsonb, 'Do Espírito Santo produzindo em nós') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L6-07', (select id from public.batismo_licoes where ordem = 6), 'exercicio', 'Qual destas qualidades também faz parte do fruto do Espírito (Gálatas 5:22-23)?', '["Riqueza", "Fama", "Orgulho", "Mansidão"]'::jsonb, 'Mansidão') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L6-08', (select id from public.batismo_licoes where ordem = 6), 'exercicio', 'Segundo Marcos 10:45, Jesus veio para...', '["Ser servido pelos outros", "Servir e dar a sua vida em resgate por muitos", "Ficar rico", "Mandar em todo mundo"]'::jsonb, 'Servir e dar a sua vida em resgate por muitos') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L6-09', (select id from public.batismo_licoes where ordem = 6), 'exercicio', 'Qual destas atitudes é um exemplo de servir?', '["Ajudar na limpeza da igreja", "Esperar que façam tudo por você", "Reclamar de tudo", "Ficar só olhando"]'::jsonb, 'Ajudar na limpeza da igreja') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L6-10', (select id from public.batismo_licoes where ordem = 6), 'exercicio', 'Testemunhar de Jesus se faz com...', '["Só palavras", "Só discussões", "Palavras e atitudes", "Gritos"]'::jsonb, 'Palavras e atitudes') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L6-11', (select id from public.batismo_licoes where ordem = 6), 'exercicio', 'Em Mateus 5:16, Jesus diz que a nossa luz deve brilhar para que as pessoas...', '["Elogiem a gente", "Vejam as nossas boas obras e glorifiquem ao Pai", "Fiquem com inveja", "Tenham medo da gente"]'::jsonb, 'Vejam as nossas boas obras e glorifiquem ao Pai') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('L6-12', (select id from public.batismo_licoes where ordem = 6), 'exercicio', 'Jesus prometeu estar com os seus até quando (Mateus 28:20)?', '["Até o fim dos tempos", "Só por um ano", "Só nos dias de culto", "Só quando tudo está bem"]'::jsonb, 'Até o fim dos tempos') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-01', null, 'prova_final', 'Pecado é...', '["Só crimes graves", "Tudo que desobedece a Deus", "Apenas mentira", "Erro sem querer"]'::jsonb, 'Tudo que desobedece a Deus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-02', null, 'prova_final', 'A salvação se recebe...', '["Fazendo boas obras", "Sendo batizado", "Pela graça de Deus, por meio da fé em Jesus", "Nascendo em família cristã"]'::jsonb, 'Pela graça de Deus, por meio da fé em Jesus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-03', null, 'prova_final', 'Arrependimento é...', '["Mudar de direção: deixar o pecado e voltar para Deus", "Sentir vergonha", "Pedir desculpa e continuar igual", "Chorar na igreja"]'::jsonb, 'Mudar de direção: deixar o pecado e voltar para Deus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-04', null, 'prova_final', '"Nascer de novo" significa...', '["Mudar de igreja", "Fazer aniversário", "Nascer outra vez da mãe", "Receber uma vida nova de Deus"]'::jsonb, 'Receber uma vida nova de Deus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-05', null, 'prova_final', 'O batismo salva a pessoa?', '["Sim, é ele que salva", "Não; ele declara a fé de quem já creu em Jesus", "Só salva adultos", "Só salva se for no rio"]'::jsonb, 'Não; ele declara a fé de quem já creu em Jesus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-06', null, 'prova_final', 'Quem deve ser batizado?', '["Quem crê em Jesus e se arrependeu", "Bebês", "Qualquer pessoa, mesmo sem crer", "Só quem nunca pecou"]'::jsonb, 'Quem crê em Jesus e se arrependeu') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-07', null, 'prova_final', 'Na Bíblia, o batismo era feito...', '["Pingando água na cabeça", "Com óleo", "Por imersão, mergulhando nas águas", "Sem água"]'::jsonb, 'Por imersão, mergulhando nas águas') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-08', null, 'prova_final', 'Segundo Romanos 6, o batismo representa...', '["Um banho comum", "Entrar para um clube", "Um costume sem sentido", "Morrer para o pecado e ressuscitar para uma vida nova"]'::jsonb, 'Morrer para o pecado e ressuscitar para uma vida nova') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-09', null, 'prova_final', 'O ladrão na cruz foi salvo...', '["Porque foi batizado", "Sem batismo, somente pela fé em Jesus", "Porque fez boas obras", "Porque era religioso"]'::jsonb, 'Sem batismo, somente pela fé em Jesus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-10', null, 'prova_final', 'Orar é...', '["Conversar com Deus", "Fazer discurso bonito", "Repetir fórmula decorada", "Impressionar os outros"]'::jsonb, 'Conversar com Deus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-11', null, 'prova_final', 'No Salmo 119:105, a Palavra de Deus é...', '["Espada e escudo", "Comida e bebida", "Lâmpada e luz para o caminho", "Casa e telhado"]'::jsonb, 'Lâmpada e luz para o caminho') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-12', null, 'prova_final', 'A igreja serve para...', '["Mostrar roupa nova", "Cumprir obrigação", "Nada importante", "Adorar a Deus e fortalecer uns aos outros"]'::jsonb, 'Adorar a Deus e fortalecer uns aos outros') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-13', null, 'prova_final', 'A Ceia do Senhor é...', '["Um memorial da morte de Jesus", "Uma festa da igreja", "Um lanche depois do culto", "Um segundo batismo"]'::jsonb, 'Um memorial da morte de Jesus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-14', null, 'prova_final', 'O pão da Ceia representa...', '["A comida do deserto", "O corpo de Jesus dado por nós", "Um símbolo sem sentido", "A igreja reunida"]'::jsonb, 'O corpo de Jesus dado por nós') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-15', null, 'prova_final', 'O cálice da Ceia representa...', '["Vinho comum", "A água do batismo", "A nova aliança no sangue de Jesus", "A alegria da festa"]'::jsonb, 'A nova aliança no sangue de Jesus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-16', null, 'prova_final', 'Antes de participar da Ceia, devemos...', '["Jejuar uma semana", "Vestir roupa branca", "Confessar tudo ao pastor", "Examinar a nós mesmos"]'::jsonb, 'Examinar a nós mesmos') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-17', null, 'prova_final', 'O batismo acontece...', '["Uma vez só, no começo da vida cristã", "Todo ano", "Todo mês", "Quando a pessoa quiser repetir"]'::jsonb, 'Uma vez só, no começo da vida cristã') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-18', null, 'prova_final', 'A Ceia acontece...', '["Uma vez só", "Muitas vezes, durante a caminhada", "Nunca", "Só no dia do batismo"]'::jsonb, 'Muitas vezes, durante a caminhada') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-19', null, 'prova_final', 'O fruto do Espírito inclui...', '["Riqueza e fama", "Poder e força", "Amor, alegria, paz, paciência...", "Sorte e sucesso"]'::jsonb, 'Amor, alegria, paz, paciência...') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-20', null, 'prova_final', 'Na Grande Comissão (Mateus 28:19-20), Jesus mandou...', '["Ficar em casa esperando", "Construir templos grandes", "Não fazer nada", "Fazer discípulos de todas as nações e batizar"]'::jsonb, 'Fazer discípulos de todas as nações e batizar') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-21', null, 'prova_final', 'Segundo Romanos 3:23, quem já pecou?', '["Só os adultos", "Só quem comete crimes", "Todos", "Só quem não vai à igreja"]'::jsonb, 'Todos') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-22', null, 'prova_final', 'Quem recebe Jesus se torna o quê (João 1:12)?', '["Pastor da igreja", "Filho de Deus", "Uma pessoa famosa", "Alguém que nunca mais erra"]'::jsonb, 'Filho de Deus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-23', null, 'prova_final', 'Por que não batizamos bebês?', '["Porque bebê não gosta de água", "Porque bebê já nasceu salvo", "Porque a igreja não quer", "Porque bebê ainda não pode crer nem se arrepender"]'::jsonb, 'Porque bebê ainda não pode crer nem se arrepender') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-24', null, 'prova_final', 'A palavra "batismo" significa...', '["Mergulhar", "Molhar a cabeça", "Lavar as mãos", "Entrar na igreja"]'::jsonb, 'Mergulhar') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-25', null, 'prova_final', 'Quando o cristão cai e peca, o que ele deve fazer?', '["Desistir de Deus", "Esconder o pecado", "Confessar a Deus, levantar-se e continuar", "Culpar os outros"]'::jsonb, 'Confessar a Deus, levantar-se e continuar') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-26', null, 'prova_final', 'Os primeiros cristãos se dedicavam a quê (Atos 2:42)?', '["A festas e passeios", "Ao ensino, à comunhão, ao partir do pão e às orações", "A ficar em casa sozinhos", "A discutir uns com os outros"]'::jsonb, 'Ao ensino, à comunhão, ao partir do pão e às orações') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-27', null, 'prova_final', 'Quando Jesus disse "façam isto em memória de mim", ele quis dizer que a Ceia serve para...', '["Matar a fome", "Fazer festa", "Batizar de novo", "Lembrar a morte de Jesus"]'::jsonb, 'Lembrar a morte de Jesus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-28', null, 'prova_final', 'A Ceia perdoa pecados automaticamente?', '["Não; ela é um memorial da morte de Jesus", "Sim, ela perdoa tudo sozinha", "Só perdoa quem come do pão", "Só perdoa no domingo"]'::jsonb, 'Não; ela é um memorial da morte de Jesus') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-29', null, 'prova_final', 'Na lição, o batismo é como a porta de entrada e a Ceia é como...', '["Um prêmio", "A mesa da família", "Uma corrida", "Um banho"]'::jsonb, 'A mesa da família') on conflict (codigo) do nothing;
insert into public.batismo_questoes (codigo, licao_id, tipo, enunciado, alternativas, resposta_correta) values ('PF-30', null, 'prova_final', 'O compromisso com a nova vida é...', '["Frutificar, servir e testemunhar", "Só ir à igreja no domingo", "Guardar a fé só para si", "Esperar sem fazer nada"]'::jsonb, 'Frutificar, servir e testemunhar') on conflict (codigo) do nothing;
