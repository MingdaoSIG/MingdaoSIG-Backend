const REQUIRED = ["MONGO_URI", "JWT_SECRET"] as const;

// Missing these does not stop the server, but a feature degrades.
const RECOMMENDED: Record<string, string> = {
  FRONTEND_BASE_URL: "join request emails will link to an invalid URL",
  GITHUB_TOKEN: "/ping fetches the latest versions from GitHub without a token"
};

export type Env = {
  MONGO_URI: string;
  JWT_SECRET: string;
  HOST: string;
  PORT: number;
};

/**
 * Checks the environment once at startup. Exits the process with a clear
 * message when a required variable is missing, instead of failing later on
 * the first request that needs it.
 */
export default function ValidateEnv(): Env {
  const missing = REQUIRED.filter(
    name => !process.env[name] || process.env[name]?.trim() === ""
  );

  if (missing.length > 0) {
    console.error(
      `Config : missing required environment variable(s): ${missing.join(
        ", "
      )}. Set them in the deployment environment or in .env, then restart.`
    );
    process.exit(1);
  }

  const port = Number(process.env.PORT || 3001);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    console.error(
      "Config : PORT must be an integer between 1 and 65535."
    );
    process.exit(1);
  }

  for (const [name, impact] of Object.entries(RECOMMENDED)) {
    if (!process.env[name]) {
      console.warn(`Config : ${name} is not set, ${impact}.`);
    }
  }

  return {
    MONGO_URI: process.env.MONGO_URI as string,
    JWT_SECRET: process.env.JWT_SECRET as string,
    HOST: process.env.HOST || "localhost",
    PORT: port
  };
}
