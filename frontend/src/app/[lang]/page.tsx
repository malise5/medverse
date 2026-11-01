import { redirect } from "next/navigation";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  redirect(`/${lang}/dashboard`);
}
