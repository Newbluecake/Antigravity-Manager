import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, Plus, ArrowDown } from 'lucide-react';
import { GroupedSelect, SelectOption } from './GroupedSelect';

interface MappingListBuilderProps {
  value: string | string[];
  onChange: (value: string | string[]) => void;
  modelOptions: SelectOption[];
}

interface SortableItemProps {
  id: string;
  modelId: string;
  onRemove: () => void;
}

function SortableItem({ id, modelId, onRemove }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    position: 'relative' as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 mb-2 ${isDragging ? 'shadow-lg opacity-90' : ''}`}
    >
      <div {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
        <GripVertical size={14} />
      </div>
      <div className="flex-1 font-mono text-xs truncate" title={modelId}>
        {modelId}
      </div>
      <button
        onClick={onRemove}
        className="text-gray-400 hover:text-red-500 transition-colors p-1"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function MappingListBuilder({ value, onChange, modelOptions }: MappingListBuilderProps) {
  // Convert value to array for internal state
  const [items, setItems] = useState<string[]>([]);
  const [selectedToAdd, setSelectedToAdd] = useState<string>('');

  useEffect(() => {
    if (Array.isArray(value)) {
      setItems(value);
    } else if (value) {
      setItems([value]);
    } else {
      setItems([]);
    }
  }, [value]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.indexOf(active.id as string);
      const newIndex = items.indexOf(over.id as string);

      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);
      // Notify parent - if only 1 item, return string, else array
      onChange(newItems.length === 1 ? newItems[0] : newItems);
    }
  };

  const handleAdd = () => {
    if (selectedToAdd && !items.includes(selectedToAdd)) {
      const newItems = [...items, selectedToAdd];
      setItems(newItems);
      onChange(newItems.length === 1 ? newItems[0] : newItems);
      setSelectedToAdd('');
    }
  };

  const handleRemove = (modelId: string) => {
    const newItems = items.filter(id => id !== modelId);
    setItems(newItems);
    onChange(newItems.length === 1 ? newItems[0] : newItems);
  };

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <GroupedSelect
            value={selectedToAdd}
            onChange={setSelectedToAdd}
            options={modelOptions}
            placeholder="Add fallback model..."
            className="font-mono text-[10px] h-8"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={!selectedToAdd || items.includes(selectedToAdd)}
          className="btn btn-xs btn-primary h-8 w-8 p-0"
          title="Add to chain"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="bg-gray-50/50 dark:bg-gray-900/20 rounded-lg p-2 border border-gray-100 dark:border-gray-700/50 min-h-[50px]">
        {items.length === 0 ? (
          <div className="text-center text-gray-400 text-[10px] py-2 italic">
            No models configured. Add models to create a fallback chain.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items}
              strategy={verticalListSortingStrategy}
            >
              {items.map((id, index) => (
                <React.Fragment key={id}>
                  <SortableItem
                    id={id}
                    modelId={id}
                    onRemove={() => handleRemove(id)}
                  />
                  {index < items.length - 1 && (
                    <div className="flex justify-center -my-1.5 pb-1 relative z-0">
                      <ArrowDown size={12} className="text-gray-300 dark:text-gray-600" />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div className="text-[10px] text-gray-400">
        Models will be attempted in order from top to bottom.
      </div>
    </div>
  );
}
