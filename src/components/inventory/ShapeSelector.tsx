import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { InventoryShape } from "@/types/inventory";
import api from "@/services/api";
import { toast } from "sonner";

interface ShapeSelectorProps {
  shapes: InventoryShape[];
  onChange: (shapes: InventoryShape[]) => void;
  isSingleShape?: boolean;
}

export const ShapeSelector: React.FC<ShapeSelectorProps> = ({
  shapes,
  onChange,
  isSingleShape = false,
}) => {
  const [creatingShapeIndex, setCreatingShapeIndex] = useState<number | null>(
    null,
  );
  const [availableShapes, setAvailableShapes] = useState<
    { _id: string; name: string }[]
  >([]);
  const [shapesLoaded, setShapesLoaded] = useState(false);
  const [isCreatingNewShape, setIsCreatingNewShape] = useState(false);
  const [newShapeName, setNewShapeName] = useState("");

  useEffect(() => {
    fetchShapes();
  }, []);

  const fetchShapes = async () => {
    try {
      const res = await api.getShapes();
      // Safely handle response data
      const shapes = res.success && Array.isArray(res.data) ? res.data : [];
      setAvailableShapes(shapes.filter((s: { _id?: string; name?: string }) => s && s._id && s.name));
    } catch (error) {
      console.error("Error fetching shapes:", error);
      toast.error("Failed to load shapes");
      setAvailableShapes([]); // Set empty array on error
    } finally {
      setShapesLoaded(true);
    }
  };

  // Build the display list: ensure current shape values are always included
  // so Radix Select can match the value even if the API hasn't returned yet
  const getDisplayShapes = () => {
    const currentShapeNames = shapes
      .map(s => s.shape)
      .filter(Boolean);

    if (availableShapes.length === 0 && !shapesLoaded) {
      // Shapes haven't loaded yet — show current values as temporary options
      return currentShapeNames.map(name => ({ _id: `temp-${name}`, name }));
    }

    // Shapes loaded — ensure any current values not in the list are added
    const existing = new Set(availableShapes.map(s => s.name));
    const extras = currentShapeNames
      .filter(name => !existing.has(name))
      .map(name => ({ _id: `temp-${name}`, name }));

    return [...availableShapes, ...extras];
  };

  const handleCreateShape = async () => {
    const shapeName = newShapeName.trim();

    if (!shapeName) {
      toast.error("Please enter a shape name");
      return;
    }

    try {
      const response = await api.createShape({ name: shapeName });

      if (!response.success) {
        toast.error(response.message || "Failed to create shape");
        return;
      }

      toast.success("Shape created successfully");

      await fetchShapes();

      // 🔥 SINGLE SHAPE MODE
      if (isSingleShape) {
        onChange([{ shape: shapeName, pieces: 0, weight: 0 }]);
      }

      // 🔥 MIX SHAPE MODE (CRITICAL FIX)
      else if (creatingShapeIndex !== null) {
        const updated = shapes.map((s, i) =>
          i === creatingShapeIndex ? { ...s, shape: shapeName } : s,
        );
        onChange(updated);
      }

      setNewShapeName("");
      setIsCreatingNewShape(false);
      setCreatingShapeIndex(null);
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error?.message || "Failed to create shape");
    }
  };

  const handleAddShape = () => {
    if (shapes && shapes.some(s => !s.shape)) {
      toast.error("Please complete all shape entries before adding a new one");
      return;
    }
    onChange([...(shapes || []), { shape: '', pieces: 0, weight: 0 }]);
  };

  const handleRemoveShape = (index: number) => {
    onChange(shapes.filter((_, i) => i !== index));
  };

  const handleShapeChange = (
    index: number,
    field: "shape" | "pieces" | "weight",
    value: string | number,
  ) => {
    const updatedShapes = shapes.map((s, i) =>
      i === index ? { ...s, [field]: value } : s,
    );
    onChange(updatedShapes);
  };

  /* ================= SINGLE SHAPE ================= */

  if (isSingleShape) {
    const displayShapes = getDisplayShapes();

    return (
      <div className="space-y-2">
        <Select
          value={shapes[0]?.shape || ""}
          onValueChange={(value) => {
            if (value === "create_new") {
              setIsCreatingNewShape(true);
            } else {
              onChange([{ shape: value, pieces: 0, weight: 0 }]);
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select shape..." />
          </SelectTrigger>
          <SelectContent>
            {displayShapes.length > 0 ? (
              displayShapes.map((shape) => (
                <SelectItem key={shape._id} value={shape.name}>
                  {shape.name}
                </SelectItem>
              ))
            ) : (
              <div className="px-2 py-1 text-sm text-muted-foreground">
                No shapes available
              </div>
            )}
            <SelectItem value="create_new" className="text-primary">
              + Create New Shape
            </SelectItem>
          </SelectContent>
        </Select>

        {isCreatingNewShape && (
          <div className="flex gap-2">
            <Input
              placeholder="New shape name"
              value={newShapeName}
              onChange={(e) => setNewShapeName(e.target.value)}
            />
            <Button size="sm" onClick={handleCreateShape}>
              Create
            </Button>
          </div>
        )}
      </div>
    );
  }

  /* ================= MIX SHAPES ================= */

  const displayShapes = getDisplayShapes();

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Label>Shapes *</Label>
        <Button size="sm" variant="outline" onClick={handleAddShape}>
          <Plus className="w-4 h-4 mr-1" /> Add Shape
        </Button>
      </div>

      {shapes.map((shape, index) => (
        <div
          key={`${shape.shape}-${index}`}
          className="grid grid-cols-4 gap-2 items-end"
        >
          <Select
            value={shape.shape}
            onValueChange={(value) => {
              if (value === "create_new") {
                setIsCreatingNewShape(true);
                setCreatingShapeIndex(index);
              } else {
                handleShapeChange(index, "shape", value);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Shape" />
            </SelectTrigger>
            <SelectContent>
              {displayShapes.length > 0 ? (
                displayShapes.map((shape) => (
                  <SelectItem key={shape._id} value={shape.name}>
                    {shape.name}
                  </SelectItem>
                ))
              ) : (
                <div className="px-2 py-1 text-sm text-muted-foreground">
                  No shapes available
                </div>
              )}
              <SelectItem value="create_new">+ Create New</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="number"
            placeholder="Pieces"
            value={shape.pieces}
            onChange={(e) =>
              handleShapeChange(index, "pieces", Number(e.target.value))
            }
          />

          <Input
            type="number"
            step="0.01"
            placeholder="Weight"
            value={shape.weight}
            onChange={(e) =>
              handleShapeChange(index, "weight", Number(e.target.value))
            }
          />

          <Button variant="ghost" onClick={() => handleRemoveShape(index)}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      ))}

      {isCreatingNewShape && (
        <div className="flex gap-2">
          <Input
            placeholder="New shape name"
            value={newShapeName}
            onChange={(e) => setNewShapeName(e.target.value)}
          />
          <Button size="sm" onClick={handleCreateShape}>
            Create
          </Button>
        </div>
      )}
    </div>
  );
};
