import { QueryClient } from '@tanstack/react-query';

/** One client for the workspace: the provider and the router context share it. */
export const queryClient = new QueryClient();
