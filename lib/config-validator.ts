import {z} from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters long'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export function validateConfig(): {success: boolean; config?: EnvConfig; errors?: string[]} {
  const rawConfig = {
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  };

  const result = EnvSchema.safeParse(rawConfig);
  if (result.success) {
    return {success: true, config: result.data};
  }

  const errors = result.error.issues.map((issue) => 
    `${issue.path.join('.')}: ${issue.message}`
  );

  return {success: false, errors};
}

export function logConfigWarnings() {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
      console.warn('[CONFIG WARNING] AUTH_SECRET is weak or missing in production!');
    }
  }
}

export function validateConfigOrExit() {
  const result = validateConfig();
  if (!result.success) {
    console.error('[CONFIG ERROR] Application cannot start due to invalid configuration:');
    result.errors?.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }
  logConfigWarnings();
  return result.config!;
}
