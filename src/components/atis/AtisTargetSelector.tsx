import React, { useState, useEffect } from "react";
import { 
  Users, 
  User, 
  UsersRound, 
  Tag, 
  Phone, 
  Globe, 
  Plus, 
  X, 
  Search, 
  Loader2,
  AlertCircle
} from "lucide-react";
import { atisTargetDb, AtisTarget, AtisTargetType } from "./atisTargetDb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";

interface AtisTargetSelectorProps {
  configId: string;
  targets: AtisTarget[];
  onChange: (newTargets: AtisTarget[]) => void;
  disabled?: boolean;
}

const TARGET_TYPES: { value: AtisTargetType; label: string; icon: any }[] = [
  { value: 'profile', label: 'Perfil', icon: User },
  { value: 'contact', label: 'Contato', icon: Users },
  { value: 'group', label: 'Grupo', icon: UsersRound },
  { value: 'tag', label: 'Tag', icon: Tag },
  { value: 'jid_individual', label: 'JID Individual', icon: Phone },
  { value: 'all_authenticated', label: 'Todos Autenticados', icon: Globe },
];

export const AtisTargetSelector: React.FC<AtisTargetSelectorProps> = ({
  configId,
  targets,
  onChange,
  disabled = false
}) => {
  const [selectedType, setSelectedType] = useState<AtisTargetType>('contact');
  const [searchValue, setSearchValue] = useState("");
  const [options, setOptions] = useState<any[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [open, setOpen] = useState(false);

  // Load options based on selected type
  useEffect(() => {
    if (selectedType === 'all_authenticated' || selectedType === 'jid_individual') {
      setOptions([]);
      return;
    }

    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        let res: any[] = [];
        if (selectedType === 'profile') {
          res = await atisTargetDb.searchProfiles(searchValue);
        } else if (selectedType === 'contact') {
          res = await atisTargetDb.searchContacts(searchValue);
        } else if (selectedType === 'group') {
          res = await atisTargetDb.searchGroups(searchValue);
        } else if (selectedType === 'tag') {
          const tags = await atisTargetDb.getTags();
          res = tags
            .filter(t => t.toLowerCase().includes(searchValue.toLowerCase()))
            .map(t => ({ id: t, name: t }));
        }
        setOptions(res);
      } catch (e: any) {
        console.error("Error loading target options", e);
      } finally {
        setLoadingOptions(false);
      }
    };

    const timer = setTimeout(loadOptions, 300);
    return () => clearTimeout(timer);
  }, [selectedType, searchValue]);

  const addTarget = (value: string, displayName?: string, secondaryInfo?: string) => {
    // Prevent duplicates
    const isDuplicate = targets.some(t => t.target_type === selectedType && t.target_id === value);
    if (isDuplicate) {
      toast.info("Este destinatário já foi adicionado.");
      return;
    }

    const newTarget: AtisTarget = {
      config_id: configId,
      target_type: selectedType,
      target_id: value,
      active: true,
      metadata: {},
      display_name: displayName || value,
      secondary_info: secondaryInfo
    };

    onChange([...targets, newTarget]);
    setSearchValue("");
    setOpen(false);
  };

  const removeTarget = (index: number) => {
    const newTargets = [...targets];
    newTargets.splice(index, 1);
    onChange(newTargets);
  };

  const renderTargetItem = (target: AtisTarget, index: number) => {
    const typeInfo = TARGET_TYPES.find(t => t.value === target.target_type);
    const Icon = typeInfo?.icon || AlertCircle;
    
    return (
      <div 
        key={target.id || `temp-${index}`}
        className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] group"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-[hsl(var(--dark-card))] text-primary">
            <Icon className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold truncate">
              {target.display_name || target.target_id}
            </p>
            <p className="text-[10px] text-[hsl(var(--dark-muted))] truncate flex items-center gap-1">
              {typeInfo?.label}
              {target.secondary_info && <span>• {target.secondary_info}</span>}
              {!typeInfo && <span className="text-amber-500">Tipo não reconhecido</span>}
            </p>
          </div>
        </div>
        <button
          disabled={disabled}
          onClick={() => removeTarget(index)}
          className="p-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-500 text-[hsl(var(--dark-muted))] transition-colors disabled:opacity-50"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--dark-muted))] px-1">
            Novo Destinatário
          </Label>
          <div className="flex gap-2">
            <Select
              disabled={disabled}
              value={selectedType}
              onValueChange={(val: AtisTargetType) => setSelectedType(val)}
            >
              <SelectTrigger className="w-[160px] h-10 bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card-hover))] text-xs">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent className="bg-[hsl(var(--dark-card))] border-[hsl(var(--dark-card-hover))]">
                {TARGET_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value} className="text-xs">
                    <div className="flex items-center gap-2">
                      <t.icon className="w-3.5 h-3.5" />
                      {t.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedType === 'all_authenticated' ? (
              <Button 
                disabled={disabled}
                onClick={() => addTarget("all", "Todos os autenticados")}
                className="flex-1 h-10 gap-2"
              >
                <Plus className="w-4 h-4" /> Adicionar
              </Button>
            ) : selectedType === 'jid_individual' ? (
              <div className="flex-1 flex gap-2">
                <Input
                  disabled={disabled}
                  placeholder="Ex: 5585999999999@s.whatsapp.net"
                  value={searchValue}
                  onChange={e => setSearchValue(e.target.value)}
                  className="h-10 bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card-hover))] text-xs"
                />
                <Button 
                  disabled={disabled || !searchValue.includes('@')}
                  onClick={() => addTarget(searchValue)}
                  className="h-10 px-3"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    disabled={disabled}
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="flex-1 h-10 justify-between bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card-hover))] text-xs font-normal"
                  >
                    {searchValue || "Selecionar..."}
                    <Search className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0 bg-[hsl(var(--dark-card))] border-[hsl(var(--dark-card-hover))]">
                  <Command shouldFilter={false}>
                    <CommandInput 
                      placeholder={`Buscar ${TARGET_TYPES.find(t => t.value === selectedType)?.label.toLowerCase()}...`} 
                      value={searchValue}
                      onValueChange={setSearchValue}
                      className="text-xs"
                    />
                    <CommandList>
                      <CommandEmpty className="py-6 text-center text-xs text-[hsl(var(--dark-muted))]">
                        {loadingOptions ? (
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Buscando...
                          </div>
                        ) : (
                          "Nenhum resultado encontrado."
                        )}
                      </CommandEmpty>
                      <CommandGroup>
                        {options.map((opt) => (
                          <CommandItem
                            key={opt.id}
                            value={opt.id}
                            onSelect={() => {
                              if (selectedType === 'profile') {
                                addTarget(opt.id, opt.display_name, opt.whatsapp);
                              } else if (selectedType === 'contact') {
                                addTarget(opt.id, opt.name, opt.phone);
                              } else if (selectedType === 'group') {
                                // IMPORTANT: Preserve wa_group_id literally
                                addTarget(opt.wa_group_id || opt.id, opt.name, opt.wa_group_id);
                              } else if (selectedType === 'tag') {
                                addTarget(opt.id, opt.name);
                              }
                            }}
                            className="text-xs cursor-pointer"
                          >
                            <div className="flex flex-col">
                              <span className="font-semibold">{opt.display_name || opt.name}</span>
                              {(opt.whatsapp || opt.phone || opt.wa_group_id) && (
                                <span className="text-[10px] text-[hsl(var(--dark-muted))]">
                                  {opt.whatsapp || opt.phone || opt.wa_group_id}
                                </span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--dark-muted))] px-1">
          Lista de Destinatários ({targets.length})
        </Label>
        
        {targets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 rounded-2xl bg-[hsl(var(--dark-bg))] border border-dashed border-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-muted))]">
            <Users className="w-8 h-8 opacity-20 mb-2" />
            <p className="text-xs">Nenhum destinatário vinculado</p>
          </div>
        ) : (
          <ScrollArea className="h-[200px] pr-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {targets.map((target, idx) => renderTargetItem(target, idx))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
};
