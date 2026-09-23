import { redirect } from 'next/navigation'

/** Legacy driver share URL. The live card is /card/[token] (also redirected in next.config). */
export default async function LegacyDriverCardRedirect({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  redirect(`/card/${token}`)
}
