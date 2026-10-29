/** The route tree a user lives in: '/superadmin' for a superadmin, '/admin' otherwise. */
export const routeBaseFor = (user) => (user?.role === 'superadmin' ? '/superadmin' : '/admin');
