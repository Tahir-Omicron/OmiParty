-- Drop the old constraint
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_game_mode_check;

-- Add the new constraint with all 4 game modes
ALTER TABLE public.rooms ADD CONSTRAINT rooms_game_mode_check 
CHECK (game_mode IN ('sabotage', 'auction', 'canvas', 'wordbomb', NULL));
