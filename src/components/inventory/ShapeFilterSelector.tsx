import React, { useState, useMemo } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShapeFilterSelectorProps {
  shapes: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const ShapeFilterSelector: React.FC<ShapeFilterSelectorProps> = ({
  shapes,
  value,
  onChange,
  placeholder = 'All Shapes',
  className
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Add "All Shapes" to the beginning
  const shapeOptions = useMemo(() => {
    return ['ALL', ...shapes];
  }, [shapes]);

  // Filter based on search
  const filteredShapes = useMemo(() => {
    if (!searchQuery) return shapeOptions;

    return shapeOptions.filter(shape =>
      shape.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [shapeOptions, searchQuery]);

  // Find selected
  const selectedShape = value || 'ALL';
  const displayValue = selectedShape === 'ALL' ? placeholder : selectedShape;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {displayValue}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput
            placeholder="Search shapes..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="h-9"
          />
          <CommandList>
            <CommandEmpty>
              <div className="p-2 text-center">
                <p className="text-sm text-muted-foreground">No shapes found.</p>
              </div>
            </CommandEmpty>
            <CommandGroup>
              {filteredShapes.map((shape) => (
                <CommandItem
                  key={shape}
                  value={shape}
                  onSelect={() => {
                    onChange(shape);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedShape === shape ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {shape === 'ALL' ? 'All Shapes' : shape}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
