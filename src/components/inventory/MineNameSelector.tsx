import React, { useState, useMemo } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MineNameSelectorProps {
  mineNames: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const MineNameSelector: React.FC<MineNameSelectorProps> = ({
  mineNames,
  value,
  onChange,
  placeholder = 'Select a mine...',
  className
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter based on search
  const filteredMines = useMemo(() => {
    if (!searchQuery) return mineNames;

    return mineNames.filter(mine =>
      mine.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [mineNames, searchQuery]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {value ? value : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput
            placeholder="Search mines..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="h-9"
          />
          <CommandList>
            <CommandEmpty>
              <div className="p-2 text-center">
                <p className="text-sm text-muted-foreground">No mines found.</p>
              </div>
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                key="none"
                value=""
                onSelect={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === '' ? "opacity-100" : "opacity-0"
                  )}
                />
                No mine selected
              </CommandItem>
              {filteredMines.map((mine) => (
                <CommandItem
                  key={mine}
                  value={mine}
                  onSelect={() => {
                    onChange(mine);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === mine ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {mine}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
