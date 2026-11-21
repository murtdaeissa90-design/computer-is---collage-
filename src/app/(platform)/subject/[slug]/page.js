import SubjectView from "@/components/SubjectView";
import { ALL_SUBJECTS } from "@/lib/subjects";

export const dynamicParams = false;

export function generateStaticParams() {
  return ALL_SUBJECTS.map((s) => ({ slug: s.slug }));
}

export default function SubjectPage({ params }) {
  return <SubjectView slug={params.slug} />;
}
