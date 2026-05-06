import type { AppRouter } from "@my-better-t-app/api/routers/index";
import { env } from "@my-better-t-app/env/web";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { toast } from "sonner";

import { getClerkAuthToken } from "@/utils/clerk-auth";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      toast.error(error.message, {
        action: {
          label: "retry",
          onClick: query.invalidate,
        },
      });
    },
  }),
});

const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${env.NEXT_PUBLIC_SERVER_URL}/trpc`,
      headers: async () => {
        if (typeof window !== "undefined") {
          const token = await getClerkAuthToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        }

        const { auth } = await import("@clerk/nextjs/server");
        const clerkAuth = await auth();
        const token = await clerkAuth.getToken();

        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});
