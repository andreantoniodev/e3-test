import { z } from 'zod';

export const EvolutionApiWebhookBodySchema = z.object({
  event: z.string().optional(),
  instance: z.string().optional(),
  data: z.unknown().optional(),
  progress: z.union([z.number(), z.string()]).optional(),
  isLatest: z.boolean().optional(),
});

export type EvolutionApiWebhookBodyDto = z.infer<
  typeof EvolutionApiWebhookBodySchema
>;
