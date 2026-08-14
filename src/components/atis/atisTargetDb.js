import { atisDb } from "./atisDb";
export const atisTargetDb = {
    async getByConfig(configId) {
        const { data, error } = await atisDb
            .from("atis_notification_targets")
            .select("*")
            .eq("config_id", configId);
        if (error)
            throw error;
        return data || [];
    },
    async insert(targets) {
        const { data, error } = await atisDb
            .from("atis_notification_targets")
            .insert(targets);
        if (error)
            throw error;
        return data;
    },
    async delete(ids) {
        const { error } = await atisDb
            .from("atis_notification_targets")
            .delete()
            .in("id", ids);
        if (error)
            throw error;
    },
    async update(id, patch) {
        const { error } = await atisDb
            .from("atis_notification_targets")
            .update(patch)
            .eq("id", id);
        if (error)
            throw error;
    },
    // Resolver helpers
    async searchProfiles(query) {
        const { data, error } = await atisDb
            .from("profiles")
            .select("id, display_name, whatsapp")
            .ilike("display_name", `%${query}%`)
            .limit(20);
        if (error)
            throw error;
        return data || [];
    },
    async searchContacts(query) {
        const { data, error } = await atisDb
            .from("atis_contacts")
            .select("id, name, phone")
            .ilike("name", `%${query}%`)
            .limit(20);
        if (error)
            throw error;
        return data || [];
    },
    async searchGroups(query) {
        const { data, error } = await atisDb
            .from("atis_groups")
            .select("id, wa_group_id, name")
            .ilike("name", `%${query}%`)
            .limit(20);
        if (error)
            throw error;
        return data || [];
    },
    async getTags() {
        // Tags are in atis_contacts.tags text[]
        const { data, error } = await atisDb
            .from("atis_contacts")
            .select("tags");
        if (error)
            throw error;
        const allTags = new Set();
        data?.forEach((c) => {
            c.tags?.forEach((t) => allTags.add(t));
        });
        return Array.from(allTags).sort();
    }
};
