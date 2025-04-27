'use client';

import { useState, useTransition, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { Moon, Sun } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { updateThemeServerAction } from './actions'; // Import the real server action

interface ThemeSwitcherProps {
  currentTheme: string; // Passed from server component
}

export function ThemeSwitcher({ currentTheme }: ThemeSwitcherProps) {
  const { setTheme, theme: activeTheme } = useTheme();
  const [isPending, startTransition] = useTransition();
  // Use state to manage the radio group value, synced with next-themes
  const [selectedValue, setSelectedValue] = useState(currentTheme);

  useEffect(() => {
    // Sync local state if next-themes value changes (e.g., via system change)
    setSelectedValue(activeTheme ?? 'system');
  }, [activeTheme]);

  const handleThemeChange = (value: string) => {
    if (!value) return;
    setSelectedValue(value); // Update local state immediately for visual feedback
    setTheme(value); // Update next-themes immediately

    startTransition(async () => {
      const formData = new FormData();
      formData.append('theme', value);
      const result = await updateThemeServerAction(formData);

      if (!result.success) {
        toast.error(`Error saving theme preference: ${result.error || 'Unknown error'}`);
        // Revert might be complex if user changes multiple times quickly
      } else {
        toast.success('Theme preference saved.');
      }
    });
  };

  return (
    // Removed form wrapper, action called directly
    <RadioGroup
      value={selectedValue} // Control the value via state
      onValueChange={handleThemeChange}
      className="flex flex-col space-y-1"
      disabled={isPending}
    >
      <div className="flex items-center space-x-3 space-y-0">
        <RadioGroupItem value="light" id="theme-light" />
        <Label htmlFor="theme-light" className="font-normal">
          Light
        </Label>
      </div>
      <div className="flex items-center space-x-3 space-y-0">
        <RadioGroupItem value="dark" id="theme-dark" />
        <Label htmlFor="theme-dark" className="font-normal">
          Dark
        </Label>
      </div>
      <div className="flex items-center space-x-3 space-y-0">
        <RadioGroupItem value="system" id="theme-system" />
        <Label htmlFor="theme-system" className="font-normal">
          System
        </Label>
      </div>
    </RadioGroup>
  );
}
