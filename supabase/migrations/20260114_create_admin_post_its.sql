-- Create admin_post_its table
CREATE TABLE IF NOT EXISTS public.admin_post_its (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    target_audience TEXT NOT NULL CHECK (target_audience IN ('all', 'premium', 'free')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    bg_color TEXT DEFAULT 'bg-yellow-200 dark:bg-yellow-600'
);

-- Enable RLS
ALTER TABLE public.admin_post_its ENABLE ROW LEVEL SECURITY;

-- Policies for admin_post_its
CREATE POLICY "Admins can do everything on admin_post_its" ON public.admin_post_its
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'superadmin')
        )
    );

CREATE POLICY "Users can read active post-its" ON public.admin_post_its
    FOR SELECT
    USING (
        (expires_at IS NULL OR expires_at > NOW())
    );

-- Create user_dismissed_post_its table
CREATE TABLE IF NOT EXISTS public.user_dismissed_post_its (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    post_it_id UUID REFERENCES public.admin_post_its(id) ON DELETE CASCADE,
    dismissed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, post_it_id)
);

-- Enable RLS
ALTER TABLE public.user_dismissed_post_its ENABLE ROW LEVEL SECURITY;

-- Policies for user_dismissed_post_its
CREATE POLICY "Users can insert their own dismissals" ON public.user_dismissed_post_its
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read their own dismissals" ON public.user_dismissed_post_its
    FOR SELECT
    USING (auth.uid() = user_id);
