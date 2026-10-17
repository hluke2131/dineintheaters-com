import { jsonLdString, type JsonLdObject } from "@/lib/structured-data";

/** Server-rendered <script type="application/ld+json">. Takes already-built
 * data, so it reads nothing from the request. */
export function JsonLd({ data }: { data: JsonLdObject }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdString(data) }}
    />
  );
}
