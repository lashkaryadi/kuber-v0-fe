import React, { useState, useMemo } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LotTypeOption {
  value: string;
  label: string;
}

interface LotTypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const lots: LotTypeOption[] = [
  { value: 'ALL', label: 'All Types' },
  { value: 'single', label: 'Single' },
  { value: 'mix', label: 'Mix' }
];

export const LotTypeSelector: React.FC<LotTypeSelectorProps> = ({
  value,
  onChange,
  placeholder = 'All Types',
  className
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter based on search
  const filteredLotTypes = useMemo(() => {
    if (!searchQuery) return lots;

    return lots.filter(lot =>
      lot.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lot.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  // Find selected
  const selectedType = useMemo(() => {
    return lots.find(lot => lot.value === value);
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {selectedType ? selectedType.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput
            placeholder="Search lot type..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="h-9"
          />
          <CommandList>
            <CommandEmpty>
              <div className="p-2 text-center">
                <p className="text-sm text-muted-foreground">No lot types found.</p>
              </div>
            </CommandEmpty>
            <CommandGroup>
              {filteredLotTypes.map((lot) => (
                <CommandItem
                  key={lot.value}
                  value={lot.value}
                  onSelect={() => {
                    onChange(lot.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === lot.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {lot.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
