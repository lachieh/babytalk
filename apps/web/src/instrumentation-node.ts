import { getConfig } from "@/lib/env";

try {
  await getConfig();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error(
    "\nSet the missing values as environment variables (e.g. BUBSIE_WEB_API_URL) or in .config/bubsie_web.yaml."
  );
  process.exit(1);
}
