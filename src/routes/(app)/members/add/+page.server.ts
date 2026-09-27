import type { Actions } from "./$types";

import { createClientActions } from "$lib/server/client-pages";

export const actions = createClientActions satisfies Actions;
