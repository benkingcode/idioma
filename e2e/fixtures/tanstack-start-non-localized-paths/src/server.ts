import {
  createStartHandler,
  defaultStreamHandler,
  defineHandlerCallback,
} from '@tanstack/react-start/server';
import { createServerEntry } from '@tanstack/react-start/server-entry';
import { handleLocale } from './idiomi/server';

const customHandler = defineHandlerCallback(async (ctx) => {
  const { redirectResponse, localizedCtx } = handleLocale(ctx);
  if (redirectResponse) return redirectResponse;
  return defaultStreamHandler(localizedCtx);
});

export default createServerEntry({
  fetch: createStartHandler(customHandler),
});
