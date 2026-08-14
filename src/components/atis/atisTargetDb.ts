import { atisDb } from "./atisDb";

export type AtisTargetType = 'profile' | 'contact' | 'group' | 'tag' | 'jid_individual' | 'all_authenticated';

export interface AtisTarget {
  id?: string;
  config_id: string;
  target_type: AtisTargetType;
  target_id: string;
  active: boolean;
  metadata: any;
  created_at?: string;
  // UI helper fields
  display_name?: string;
  secondary_info?: string;
}

export const atisTargetDb = {
  async getByConfig(configId: string): Promise<AtisTarget[]> {
    const { data, error } = await atisDb
      .from("atis_notification_targets")
      .select("*")
      .eq("config_id", configId);
    
    if (error) throw error;
    return data || [];
  },

  async insert(targets: Partial<AtisTarget>[]) {
    const { data, error } = await atisDb
      .from("atis_notification_targets")
      .insert(targets);
    
    if (error) throw error;
    return data;
  },

  async delete(ids: string[]) {
    const { error } = await atisDb
      .from("atis_notification_targets")
      .delete()
      .in("id", ids);
    
    if (error) throw error;
  },

  async update(id: string, patch: Partial<AtisTarget>) {
    const { error } = await atisDb
      .from("atis_notification_targets")
      .update(patch)
      .eq("id", id);
    
    if (error) throw error;
  },

  // Resolver helpers
  async searchProfiles(query: string) {
    const { data, error } = await atisDb
      .from("profiles")
      .select("id, display_name, whatsapp")
      .ilike("display_name", `%${query}%`)
      .limit(20);
    
    if (error) throw error;
    return data || [];
  },

  async searchContacts(query: string) {
    const { data, error } = await atisDb
      .from("atis_contacts")
      .select("id, name, phone")
      .ilike("name", `%${query}%`)
      .limit(20);
    
    if (error) throw error;
    return data || [];
  },

  async searchGroups(query: string) {
    const { data, error } = await atisDb
      .from("atis_groups")
      .select("id, wa_group_id, name")
      .ilike("name", `%${query}%`)
      .limit(20);
    
    if (error) throw error;
    return data || [];
  },

  async getTags() {
    // Tags are in atis_contacts.tags text[]
    const { data, error } = await atisDb
      .from("atis_contacts")
      .select("tags");
    
    if (error) throw error;
    
    const allTags = new Set<string>();
    data?.forEach((c: any) => {
      c.tags?.forEach((t: string) => allTags.add(t));
    });
    
    return Array.from(allTags).sort();
  }
};
