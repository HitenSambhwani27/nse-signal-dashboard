import { redirect } from "next/navigation";

export default async function ChartsSymbolRedirect({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  redirect(`/symbol/${symbol}/chart`);
}
