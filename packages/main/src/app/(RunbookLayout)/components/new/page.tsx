import { AddComponentForm } from "@/components/components/add-component-form";

export default async function NewComponentPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  const { type } = await searchParams;
  return (
    <AddComponentForm
      initialType={type === "REAMER" ? "REAMER" : "BIT"}
    />
  );
}
