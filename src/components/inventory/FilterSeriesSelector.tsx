import React, { useState, useMemo } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Series {
  _id: string;
  name: string;
}

interface FilterSeriesSelectorProps {
  series: Series[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const FilterSeriesSelector: React.FC<FilterSeriesSelectorProps> = ({
  series,
  value,
  onChange,
  placeholder = 'All Series',
  className
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter based on search
  const filteredSeries = useMemo(() => {
    if (!searchQuery) return series;

    return series.filter(s =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [series, searchQuery]);

  // Find selected or show "All Series"
  const selectedSeries = useMemo(() => {
    if (value === 'ALL') return null;
    return series.find(s => s._id === value);
  }, [series, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {selectedSeries ? selectedSeries.name : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput
            placeholder="Search series..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="h-9"
          />
          <CommandList>
            <CommandEmpty>
              <div className="p-2 text-center">
                <p className="text-sm text-muted-foreground">No series found.</p>
              </div>
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                key="all"
                value="ALL"
                onSelect={() => {
                  onChange('ALL');
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === 'ALL' ? "opacity-100" : "opacity-0"
                  )}
                />
                All Series
              </CommandItem>
              {filteredSeries.map((s) => (
                <CommandItem
                  key={s._id}
                  value={s._id}
                  onSelect={() => {
                    onChange(s._id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === s._id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {s.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
