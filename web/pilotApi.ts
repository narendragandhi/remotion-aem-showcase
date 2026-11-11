let accessToken = '';
export const setPilotAccessToken = (token: string): void => { accessToken = token; };
export const pilotFetch: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(input, { ...init, headers });
};
