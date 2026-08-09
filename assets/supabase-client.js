import { createClient as createSupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.112.2';

const clientCache = new Map();

function adaptStudentProfileQuery(query) {
  let builder = query;
  const adapter = {
    select(columns, options) {
      const normalizedColumns = columns === 'id, status' ? 'id, is_active' : columns;
      builder = builder.select(normalizedColumns, options);
      return adapter;
    },
    eq(column, value) {
      builder = builder.eq(column, value);
      return adapter;
    },
    async maybeSingle() {
      const result = await builder.maybeSingle();
      if (result?.error) {
        console.error('Falha ao validar perfil no Supabase:', result.error);
        return { data: null, error: null };
      }
      if (!result?.data) return result;
      return {
        ...result,
        data: {
          ...result.data,
          status: result.data.is_active === true ? 'active' : 'inactive'
        }
      };
    }
  };
  return adapter;
}

export function createClient(url, publishableKey, options = {}) {
  const cacheKey = `${url}\u0000${publishableKey}`;
  const cached = clientCache.get(cacheKey);
  if (cached) return cached;

  const client = createSupabaseClient(url, publishableKey, options);
  const originalFrom = client.from.bind(client);
  const adaptedClient = new Proxy(client, {
    get(target, property, receiver) {
      if (property === 'from') {
        return (table) => table === 'student_profiles'
          ? adaptStudentProfileQuery(originalFrom(table))
          : originalFrom(table);
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
  clientCache.set(cacheKey, adaptedClient);
  return adaptedClient;
}
