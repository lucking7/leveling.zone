import { redirect } from 'next/navigation';

export default function QueryPage({ searchParams }: {
  searchParams: { ip?: string | string[]; external?: string | string[] };
}) {
  const ip = Array.isArray(searchParams.ip) ? searchParams.ip[0] : searchParams.ip;
  if (!ip) redirect('/');
  const params = new URLSearchParams({ ip });
  const external = Array.isArray(searchParams.external) ? searchParams.external[0] : searchParams.external;
  if (external === 'false') params.set('external', 'false');
  redirect(`/?${params}`);
}
