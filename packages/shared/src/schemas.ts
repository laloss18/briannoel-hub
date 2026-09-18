import { z } from 'zod';

const ulid = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'must be a valid ULID');

export const baseRecordSchema = z.object({
  id: ulid,
  client_id: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  deleted_at: z.string().datetime().nullable(),
});

export const syncDemoSchema = baseRecordSchema.extend({
  label: z.string().min(1).max(120),
  value: z.number().finite(),
});

export type SyncDemo = z.infer<typeof syncDemoSchema>;
