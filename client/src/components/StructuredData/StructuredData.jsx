export default function StructuredData({
  instruction
}) {

  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",

    "headline": instruction.title,

    "description":
      `Инструкция по охране труда для ${instruction.profession}`,

    "author": {
      "@type": "Organization",
      "name": "БОЙКОВГРУПП"
    }
  };


  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema)
      }}
    />
  );
}