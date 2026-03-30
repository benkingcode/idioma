import { createMiddleware } from '@/idiomi/middleware';

export const proxy = createMiddleware();

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
