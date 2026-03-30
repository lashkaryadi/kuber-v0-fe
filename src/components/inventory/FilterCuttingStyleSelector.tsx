import React, { useState, useMemo } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CUTTING_STYLES, CuttingStyleCode } from '@/types/inventory';

interface FilterCuttingStyleSelectorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const FilterCuttingStyleSelector: React.FC<FilterCuttingStyleSelectorProps> = ({
  value,
  onChange,
  placeholder = 'All Styles',
  className
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Create options from CUTTING_STYLES with "All Styles"
  const options = useMemo(() => {
    const allOption = { code: 'ALL', name: 'All Styles' };
    const styleOptions = Object.entries(CUTTING_STYLES).map(([code, name]) => ({
      code: code as CuttingStyleCode,
      name
    }));
    return [allOption as any, ...styleOptions];
  }, []);

  // Filter based on search
  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options;

    return options.filter(option =>
      option.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      option.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [options, searchQuery]);

  // Find selected
  const selectedOption = useMemo(() => {
    return options.find(opt => opt.code === value);
  }, [options, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {selectedOption ? 
            (selectedOption.code === 'ALL' ? placeholder : `${selectedOption.code} - ${selectedOption.name}`)
            : placeholder
          }
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput
            placeholder="Search cutting styles..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="h-9"
          />
          <CommandList>
            <CommandEmpty>
              <div className="p-2 text-center">
                <p className="text-sm text-muted-foreground">No styles found.</p>
              </div>
            </CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.code}
                  value={option.code}
                  onSelect={() => {
                    onChange(option.code);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.code ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.code === 'ALL' ? option.name : `${option.code} - ${option.name}`}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
