-- Create badges table
CREATE TABLE IF NOT EXISTS public.badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    requirement_days INTEGER NOT NULL,
    icon TEXT NOT NULL, -- emoji or lucide icon name
    category TEXT DEFAULT 'streak',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_badges table
CREATE TABLE IF NOT EXISTS public.user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, badge_id)
);

-- Enable RLS
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Policies for badges
CREATE POLICY "Everyone can view badges" ON public.badges FOR SELECT USING (true);

-- Policies for user_badges
CREATE POLICY "Users can view their own earned badges" ON public.user_badges
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own earned badges" ON public.user_badges
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Insert initial streak badges
INSERT INTO public.badges (name, description, requirement_days, icon) VALUES
('Primeiros Passos', 'Completou 3 dias de leitura seguidos', 3, '🌱'),
('Fiel na Palavra', 'Completou 5 dias de leitura seguidos', 5, '📜'),
('Constância Espiritual', 'Completou 10 dias de leitura seguidos', 10, '🔥'),
('Guerreiro da Luz', 'Completou 15 dias de leitura seguidos', 15, '🛡️'),
('Sentinela do Reino', 'Completou 30 dias de leitura seguidos', 30, '🏰'),
('Mestre das Escrituras', 'Completou 60 dias de leitura seguidos', 60, '👑'),
('Atalaia de Honra', 'Completou 100 dias de leitura seguidos', 100, '💎');
